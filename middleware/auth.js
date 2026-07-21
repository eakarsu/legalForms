const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { jwtConfig } = require('../config/security');

const JWT_CONFIG = jwtConfig();

// Authentication middleware (supports both session and JWT)
const requireAuth = async (req, res, next) => {
    try {
        let userId = null;

        // Check for JWT token in Authorization header (for mobile/API)
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            try {
                const decoded = jwt.verify(token, JWT_CONFIG.secret, {
                    algorithms: [JWT_CONFIG.algorithm],
                    issuer: JWT_CONFIG.issuer,
                    audience: JWT_CONFIG.audience,
                    maxAge: JWT_CONFIG.expiresIn
                });
                userId = decoded.sub;
            } catch (_) {
                // Token invalid, continue to check session
            }
        }

        // Fall back to session-based auth (for web)
        if (!userId && req.session && req.session.userId) {
            userId = req.session.userId;
        }

        if (!userId) {
            // Return JSON for API requests, redirect for page requests
            if (req.path.startsWith('/api/')) {
                return res.status(401).json({ error: 'Not authenticated', redirect: '/login' });
            }
            return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
        }

        // Verify user still exists and is active
        const userResult = await db.query(
            'SELECT id, email, first_name, last_name FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            if (req.session) {
                req.session.destroy();
            }
            if (req.path.startsWith('/api/')) {
                return res.status(401).json({ error: 'User not found' });
            }
            return res.redirect('/login');
        }

        req.user = userResult.rows[0];

        // Load user role
        try {
            const roleResult = await db.query(
                `SELECT r.name as role_name FROM user_roles ur
                 JOIN roles r ON ur.role_id = r.id
                 WHERE ur.user_id = $1
                 LIMIT 1`,
                [userId]
            );
            req.user.role = roleResult.rows.length > 0 ? roleResult.rows[0].role_name : 'attorney';
        } catch (roleErr) {
            req.user.role = 'attorney'; // default role if table doesn't exist yet
        }

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        if (req.path.startsWith('/api/')) {
            return res.status(500).json({ error: 'Authentication error' });
        }
        res.status(500).send('Authentication error');
    }
};

// Optional authentication (for pages that work with or without login)
const optionalAuth = async (req, res, next) => {
    try {
        if (req.session.userId) {
            const userResult = await db.query(
                'SELECT id, email, first_name, last_name FROM users WHERE id = $1',
                [req.session.userId]
            );
            
            if (userResult.rows.length > 0) {
                req.user = userResult.rows[0];
            }
        }
        next();
    } catch (error) {
        console.error('Optional auth middleware error:', error);
        next();
    }
};

// Hash password utility
const hashPassword = async (password) => {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
};

// Verify password utility
const verifyPassword = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};

// Role-based authorization middleware
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            if (req.path.startsWith('/api/')) {
                return res.status(401).json({ error: 'Not authenticated' });
            }
            return res.redirect('/login');
        }

        const userRole = req.user.role || 'attorney';

        if (!allowedRoles.includes(userRole)) {
            if (req.path.startsWith('/api/')) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }
            return res.status(403).render('error', {
                message: 'You do not have permission to access this resource.'
            });
        }

        next();
    };
};

module.exports = {
    requireAuth,
    optionalAuth,
    hashPassword,
    verifyPassword,
    requireRole
};

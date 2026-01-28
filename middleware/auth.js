const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production';

// Authentication middleware (supports both session and JWT)
const requireAuth = async (req, res, next) => {
    try {
        let userId = null;

        // Check for JWT token in Authorization header (for mobile/API)
        const authHeader = req.headers.authorization;
        console.log('DEBUG requireAuth: path =', req.path);
        console.log('DEBUG requireAuth: authHeader =', authHeader ? authHeader.substring(0, 30) + '...' : 'none');
        console.log('DEBUG requireAuth: authHeader full length =', authHeader ? authHeader.length : 0);

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            console.log('DEBUG requireAuth: token length =', token.length);
            console.log('DEBUG requireAuth: JWT_SECRET =', JWT_SECRET.substring(0, 10) + '...');
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                userId = decoded.id;
                console.log('DEBUG requireAuth: JWT verified, userId =', userId);
            } catch (jwtError) {
                // Token invalid, continue to check session
                console.log('DEBUG requireAuth: JWT error =', jwtError.message);
            }
        } else {
            console.log('DEBUG requireAuth: No Bearer token found');
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

module.exports = {
    requireAuth,
    optionalAuth,
    hashPassword,
    verifyPassword
};


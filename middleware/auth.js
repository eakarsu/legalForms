const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

// Authentication middleware
const requireAuth = async (req, res, next) => {
    try {
        if (!req.session.userId) {
            // Return JSON for API requests, redirect for page requests
            if (req.path.startsWith('/api/')) {
                return res.status(401).json({ error: 'Not authenticated', redirect: '/login' });
            }
            return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
        }

        // Verify user still exists and is active
        const userResult = await db.query(
            'SELECT id, email, first_name, last_name FROM users WHERE id = $1',
            [req.session.userId]
        );

        if (userResult.rows.length === 0) {
            req.session.destroy();
            return res.redirect('/login');
        }

        req.user = userResult.rows[0];
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
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


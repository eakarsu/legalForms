const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { hashPassword, verifyPassword, requireAuth } = require('../middleware/auth');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const passport = require('../config/passport');
const { seedDemoDataForUser } = require('../lib/seedUserDemoData');

// Email configuration
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Registration page with demo data
router.get('/register', (req, res) => {
    // Pre-fill with demo data for new users to see example format
    const demoData = {
        firstName: 'John',
        lastName: 'Smith',
        email: 'john.smith@lawfirm.com'
    };

    res.render('auth/register', {
        title: 'Create Account - LegalFormsAI',
        errors: [],
        formData: demoData
    });
});

// Registration validation rules
const registerValidation = [
    body('firstName')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('First name must be between 2 and 50 characters'),
    body('lastName')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Last name must be between 2 and 50 characters'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please enter a valid email address'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Passwords do not match');
            }
            return true;
        }),
    body('terms')
        .equals('on')
        .withMessage('You must agree to the terms of service')
];

// Handle registration
router.post('/register', registerValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        const { firstName, lastName, email, password, phone, address } = req.body;

        if (!errors.isEmpty()) {
            return res.render('auth/register', {
                title: 'Create Account - LegalFormsAI',
                errors: errors.array(),
                formData: { firstName, lastName, email, phone, address }
            });
        }

        // Check if user already exists
        const existingUser = await db.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.render('auth/register', {
                title: 'Create Account - LegalFormsAI',
                errors: [{ msg: 'An account with this email already exists' }],
                formData: { firstName, lastName, email, phone, address }
            });
        }

        // Hash password and create user
        const hashedPassword = await hashPassword(password);
        const verificationToken = uuidv4();

        const userResult = await db.query(
            `INSERT INTO users (email, password_hash, first_name, last_name, phone, address, verification_token) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING id, email, first_name, last_name`,
            [email, hashedPassword, firstName, lastName, phone, address, verificationToken]
        );

        const newUser = userResult.rows[0];

        // Seed demo data for new user
        await seedDemoDataForUser(newUser.id);

        // Send verification email (optional)
        if (process.env.SMTP_HOST) {
            try {
                await transporter.sendMail({
                    from: process.env.FROM_EMAIL || 'noreply@legalaiforms.com',
                    to: email,
                    subject: 'Welcome to LegalFormsAI - Verify Your Account',
                    html: `
                        <h2>Welcome to LegalFormsAI!</h2>
                        <p>Hi ${firstName},</p>
                        <p>Thank you for creating an account with LegalFormsAI. Click the link below to verify your email address:</p>
                        <p><a href="${process.env.SITE_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}">Verify Email Address</a></p>
                        <p>If you didn't create this account, please ignore this email.</p>
                        <p>Best regards,<br>The LegalFormsAI Team</p>
                    `
                });
            } catch (emailError) {
                console.error('Email sending error:', emailError);
            }
        }

        // Log user in automatically
        req.session.userId = newUser.id;
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
            }
            res.redirect('/');
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.render('auth/register', {
            title: 'Create Account - LegalFormsAI',
            errors: [{ msg: 'Registration failed. Please try again.' }],
            formData: req.body
        });
    }
});

// Login page
router.get('/login', (req, res) => {
    const redirectUrl = req.query.redirect || '/';
    res.render('auth/login', {
        title: 'Login - LegalFormsAI',
        errors: [],
        redirectUrl: redirectUrl
    });
});

// Login validation
const loginValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please enter a valid email address'),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
];

// Handle login
router.post('/login', loginValidation, async (req, res) => {
    try {
        console.log('=== LOGIN ATTEMPT ===');
        const errors = validationResult(req);
        const { email, password, redirectUrl = '/' } = req.body;
        console.log('Email:', email);
        console.log('Redirect URL:', redirectUrl);

        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array());
            return res.render('auth/login', {
                title: 'Login - LegalPracticeAI',
                errors: errors.array(),
                redirectUrl: redirectUrl
            });
        }

        // Find user
        const userResult = await db.query(
            'SELECT id, email, password_hash, first_name, last_name FROM users WHERE email = $1',
            [email]
        );
        console.log('User found:', userResult.rows.length > 0);

        if (userResult.rows.length === 0) {
            console.log('No user found with email:', email);
            return res.render('auth/login', {
                title: 'Login - LegalPracticeAI',
                errors: [{ msg: 'Invalid email or password' }],
                redirectUrl: redirectUrl
            });
        }

        const user = userResult.rows[0];
        console.log('User ID:', user.id, 'Name:', user.first_name, user.last_name);

        // Verify password
        const isValidPassword = await verifyPassword(password, user.password_hash);
        console.log('Password valid:', isValidPassword);

        if (!isValidPassword) {
            console.log('Invalid password for user:', email);
            return res.render('auth/login', {
                title: 'Login - LegalPracticeAI',
                errors: [{ msg: 'Invalid email or password' }],
                redirectUrl: redirectUrl
            });
        }

        // Update last login
        await db.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );

        // Create session
        req.session.userId = user.id;
        console.log('Session userId set to:', user.id);
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
            }
            console.log('Session saved, redirecting to:', redirectUrl);
            res.redirect(redirectUrl);
        });

    } catch (error) {
        console.error('Login error:', error);
        res.render('auth/login', {
            title: 'Login - LegalFormsAI',
            errors: [{ msg: 'Login failed. Please try again.' }],
            redirectUrl: req.body.redirectUrl || '/'
        });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/');
    });
});

// Google OAuth Routes
router.get('/auth/google', (req, res, next) => {
    const callbackURL = process.env.GOOGLE_CALLBACK_URL || (process.env.SITE_URL || 'http://localhost:3000') + '/api/auth/callback/google';
    console.log('=== GOOGLE AUTH DEBUG ===');
    console.log('GOOGLE_CALLBACK_URL env:', process.env.GOOGLE_CALLBACK_URL);
    console.log('Callback URL being used:', callbackURL);
    console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET');
    console.log('=========================');
    next();
}, passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/api/auth/callback/google',
    passport.authenticate('google', { failureRedirect: '/login?error=google_auth_failed' }),
    (req, res) => {
        // Successful authentication - set session
        req.session.userId = req.user.id;
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
            }
            res.redirect('/dashboard');
        });
    }
);

// Test route to check if Microsoft auth is available
router.get('/auth/microsoft/test', (req, res) => {
    res.json({
        status: 'ok',
        microsoft_configured: !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET)
    });
});

// Microsoft OAuth Routes
router.get('/auth/microsoft', (req, res, next) => {
    const callbackURL = (process.env.SITE_URL || 'http://localhost:3000') + '/api/auth/callback/azure-ad';
    console.log('=== MICROSOFT AUTH DEBUG ===');
    console.log('Callback URL being used:', callbackURL);
    console.log('============================');
    next();
}, passport.authenticate('microsoft', { scope: ['user.read'] }));

router.get('/api/auth/callback/azure-ad',
    passport.authenticate('microsoft', { failureRedirect: '/login?error=microsoft_auth_failed' }),
    (req, res) => {
        // Successful authentication - set session
        req.session.userId = req.user.id;
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
            }
            res.redirect('/dashboard');
        });
    }
);

// ===========================================
// MOBILE API ENDPOINTS (JWT-based)
// ===========================================
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production';

// Helper to generate JWT token
function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '30d' }
    );
}

// Mobile Login API
router.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Find user
        const userResult = await db.query(
            'SELECT id, email, password_hash, first_name, last_name, created_at FROM users WHERE email = $1',
            [email]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const user = userResult.rows[0];

        // Verify password
        const isValidPassword = await verifyPassword(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Update last login
        await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

        // Generate token
        const token = generateToken(user);

        // Return user and token
        res.json({
            user: {
                id: String(user.id),
                email: user.email,
                name: `${user.first_name} ${user.last_name}`.trim(),
                subscription: 'free',
                createdAt: user.created_at
            },
            token: token
        });

    } catch (error) {
        console.error('Mobile login error:', error);
        res.status(500).json({ message: 'Login failed. Please try again.' });
    }
});

// Mobile Register API
router.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email and password are required' });
        }

        if (password.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters' });
        }

        // Check if user exists
        const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: 'An account with this email already exists' });
        }

        // Split name into first and last
        const nameParts = name.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        // Hash password and create user
        const hashedPassword = await hashPassword(password);
        const verificationToken = uuidv4();

        const userResult = await db.query(
            `INSERT INTO users (email, password_hash, first_name, last_name, verification_token)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, email, first_name, last_name, created_at`,
            [email, hashedPassword, firstName, lastName, verificationToken]
        );

        const newUser = userResult.rows[0];

        // Seed demo data
        await seedDemoDataForUser(newUser.id);

        // Generate token
        const token = generateToken(newUser);

        // Return user and token
        res.json({
            user: {
                id: String(newUser.id),
                email: newUser.email,
                name: `${newUser.first_name} ${newUser.last_name}`.trim(),
                subscription: 'free',
                createdAt: newUser.created_at
            },
            token: token
        });

    } catch (error) {
        console.error('Mobile register error:', error);
        res.status(500).json({ message: 'Registration failed. Please try again.' });
    }
});

// Mobile Verify Token API
router.get('/api/auth/verify', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const token = authHeader.substring(7);

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Get user from database
        const userResult = await db.query(
            'SELECT id, email, first_name, last_name, created_at FROM users WHERE id = $1',
            [decoded.id]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }

        const user = userResult.rows[0];

        res.json({
            id: String(user.id),
            email: user.email,
            name: `${user.first_name} ${user.last_name}`.trim(),
            subscription: 'free',
            createdAt: user.created_at
        });

    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ message: 'Invalid or expired token' });
    }
});

// Mobile Logout API
router.post('/api/auth/logout', (req, res) => {
    // For JWT, logout is handled client-side by deleting the token
    res.json({ success: true, message: 'Logged out successfully' });
});

// Mobile Social Login API (handles OAuth code exchange)
router.post('/api/auth/social', async (req, res) => {
    try {
        const { provider, code, code_verifier } = req.body;

        if (!provider || !code) {
            return res.status(400).json({ message: 'Provider and code are required' });
        }

        let userInfo;

        if (provider === 'google') {
            // Exchange code for tokens with Google
            // For iOS, use the reversed client ID as redirect URI and PKCE
            const googleClientId = process.env.GOOGLE_IOS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
            const reversedClientId = 'com.googleusercontent.apps.' + googleClientId.replace('.apps.googleusercontent.com', '');

            // Build token request params - use PKCE if code_verifier provided (iOS), otherwise use client_secret (web)
            const tokenParams = {
                code: code,
                client_id: googleClientId,
                redirect_uri: reversedClientId + ':/oauthredirect',
                grant_type: 'authorization_code'
            };

            if (code_verifier) {
                // iOS PKCE flow - no client_secret needed
                tokenParams.code_verifier = code_verifier;
            } else {
                // Web flow - use client_secret
                tokenParams.client_secret = process.env.GOOGLE_CLIENT_SECRET;
            }

            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(tokenParams)
            });

            const tokenData = await tokenResponse.json();
            if (tokenData.error) {
                console.error('Google token error:', tokenData);
                return res.status(400).json({ message: 'Failed to authenticate with Google' });
            }

            // Get user info from Google
            const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` }
            });

            userInfo = await userResponse.json();
            userInfo.provider = 'google';

        } else if (provider === 'microsoft') {
            // Exchange code for tokens with Microsoft
            // Use MSAL redirect URI format for iOS (public client - no secret needed)
            const msClientId = process.env.MICROSOFT_CLIENT_ID.replace(/"/g, '');
            const redirectUri = 'msal' + msClientId + '://auth';
            const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    code: code,
                    client_id: msClientId,
                    redirect_uri: redirectUri,
                    grant_type: 'authorization_code',
                    scope: 'openid profile email User.Read'
                })
            });

            const tokenData = await tokenResponse.json();
            if (tokenData.error) {
                console.error('Microsoft token error:', tokenData);
                return res.status(400).json({ message: 'Failed to authenticate with Microsoft' });
            }

            // Get user info from Microsoft Graph
            const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` }
            });

            const msUser = await userResponse.json();
            userInfo = {
                id: msUser.id,
                email: msUser.mail || msUser.userPrincipalName,
                name: msUser.displayName,
                given_name: msUser.givenName,
                family_name: msUser.surname,
                provider: 'microsoft'
            };

        } else if (provider === 'apple') {
            // Apple Sign In - the code contains the identity token
            // Decode the identity token to get user info
            const parts = code.split('.');
            if (parts.length !== 3) {
                return res.status(400).json({ message: 'Invalid Apple identity token' });
            }

            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            userInfo = {
                id: payload.sub,
                email: payload.email,
                provider: 'apple'
            };
        } else {
            return res.status(400).json({ message: 'Unsupported provider' });
        }

        if (!userInfo || !userInfo.email) {
            return res.status(400).json({ message: 'Could not retrieve user email from provider' });
        }

        // Check if user exists
        let userResult = await db.query(
            'SELECT id, email, first_name, last_name, created_at FROM users WHERE email = $1',
            [userInfo.email]
        );

        let user;

        if (userResult.rows.length === 0) {
            // Create new user
            const firstName = userInfo.given_name || userInfo.name?.split(' ')[0] || '';
            const lastName = userInfo.family_name || userInfo.name?.split(' ').slice(1).join(' ') || '';

            const newUserResult = await db.query(
                `INSERT INTO users (email, first_name, last_name, provider, provider_id, email_verified)
                 VALUES ($1, $2, $3, $4, $5, true)
                 RETURNING id, email, first_name, last_name, created_at`,
                [userInfo.email, firstName, lastName, userInfo.provider, userInfo.id]
            );

            user = newUserResult.rows[0];

            // Seed demo data for new user
            await seedDemoDataForUser(user.id);
        } else {
            user = userResult.rows[0];
        }

        // Update last login
        await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

        // Generate JWT token
        const token = generateToken(user);

        // Return user and token
        res.json({
            user: {
                id: String(user.id),
                email: user.email,
                name: `${user.first_name} ${user.last_name}`.trim(),
                subscription: 'free',
                createdAt: user.created_at
            },
            token: token
        });

    } catch (error) {
        console.error('Social login error:', error);
        res.status(500).json({ message: 'Social login failed. Please try again.' });
    }
});

module.exports = router;


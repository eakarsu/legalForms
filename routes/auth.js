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
    const callbackURL = (process.env.SITE_URL || 'http://localhost:3000') + '/auth/google/callback';
    console.log('=== GOOGLE AUTH DEBUG ===');
    console.log('Callback URL being used:', callbackURL);
    console.log('SITE_URL env:', process.env.SITE_URL);
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

module.exports = router;


const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const MicrosoftStrategy = require('passport-microsoft').Strategy;
const db = require('./database');
const { seedDemoDataForUser } = require('../lib/seedUserDemoData');

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
    try {
        const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
        done(null, result.rows[0] || null);
    } catch (err) {
        done(err, null);
    }
});

// Google OAuth Strategy - using NextAuth-style callback URL for compatibility
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const googleCallbackURL = process.env.GOOGLE_CALLBACK_URL || (process.env.SITE_URL || 'http://localhost:3000') + '/api/auth/callback/google';
    console.log('Google OAuth callback URL:', googleCallbackURL);
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: googleCallbackURL
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;

            if (!email) {
                return done(new Error('No email found in Google profile'), null);
            }

            // Check if user exists
            let result = await db.query('SELECT * FROM users WHERE email = $1', [email]);

            if (result.rows.length > 0) {
                // User exists - update OAuth info
                await db.query(
                    'UPDATE users SET google_id = $1, last_login = CURRENT_TIMESTAMP WHERE id = $2',
                    [profile.id, result.rows[0].id]
                );
                // Seed demo data if user has no data
                await seedDemoDataForUser(result.rows[0].id);
                return done(null, result.rows[0]);
            }

            // Create new user
            const firstName = profile.name?.givenName || profile.displayName?.split(' ')[0] || 'User';
            const lastName = profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '';

            result = await db.query(
                `INSERT INTO users (email, first_name, last_name, google_id, email_verified, created_at)
                 VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP)
                 RETURNING *`,
                [email, firstName, lastName, profile.id]
            );

            // Seed demo data for new user
            const newUser = result.rows[0];
            await seedDemoDataForUser(newUser.id);

            return done(null, newUser);
        } catch (err) {
            return done(err, null);
        }
    }));
}

// Microsoft OAuth Strategy - using NextAuth-style callback URL for compatibility
console.log('Microsoft OAuth check - Client ID exists:', !!process.env.MICROSOFT_CLIENT_ID);
console.log('Microsoft OAuth check - Client Secret exists:', !!process.env.MICROSOFT_CLIENT_SECRET);
if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
    const microsoftCallbackURL = process.env.MICROSOFT_CALLBACK_URL || (process.env.SITE_URL || 'http://localhost:3000') + '/api/auth/callback/azure-ad';
    console.log('Microsoft OAuth callback URL:', microsoftCallbackURL);
    console.log('Registering Microsoft OAuth Strategy...');
    passport.use(new MicrosoftStrategy({
        clientID: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        callbackURL: microsoftCallbackURL,
        scope: ['user.read']
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;

            if (!email) {
                return done(new Error('No email found in Microsoft profile'), null);
            }

            // Check if user exists
            let result = await db.query('SELECT * FROM users WHERE email = $1', [email]);

            if (result.rows.length > 0) {
                // User exists - update OAuth info
                await db.query(
                    'UPDATE users SET microsoft_id = $1, last_login = CURRENT_TIMESTAMP WHERE id = $2',
                    [profile.id, result.rows[0].id]
                );
                // Seed demo data if user has no data
                await seedDemoDataForUser(result.rows[0].id);
                return done(null, result.rows[0]);
            }

            // Create new user
            const firstName = profile.name?.givenName || profile.displayName?.split(' ')[0] || 'User';
            const lastName = profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '';

            result = await db.query(
                `INSERT INTO users (email, first_name, last_name, microsoft_id, email_verified, created_at)
                 VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP)
                 RETURNING *`,
                [email, firstName, lastName, profile.id]
            );

            // Seed demo data for new user
            const newUser = result.rows[0];
            await seedDemoDataForUser(newUser.id);

            return done(null, newUser);
        } catch (err) {
            return done(err, null);
        }
    }));
}

module.exports = passport;

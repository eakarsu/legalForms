/**
 * Two-Factor Authentication Routes
 * Handles 2FA setup, verification, and trusted devices
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

// =====================================================
// PAGE ROUTES
// =====================================================

// 2FA Setup Page
router.get('/2fa/setup', requireAuth, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT two_factor_enabled, two_factor_verified_at FROM users WHERE id = $1',
            [req.user.id]
        );

        const devicesResult = await db.query(
            'SELECT * FROM trusted_devices WHERE user_id = $1 AND expires_at > NOW() ORDER BY created_at DESC',
            [req.user.id]
        );

        // Get backup codes count
        const backupResult = await db.query(
            'SELECT code FROM backup_codes WHERE user_id = $1 AND used_at IS NULL',
            [req.user.id]
        );

        res.render('2fa/setup', {
            title: 'Two-Factor Authentication',
            user: {
                ...req.user,
                two_factor_enabled: result.rows[0]?.two_factor_enabled || false,
                two_factor_verified_at: result.rows[0]?.two_factor_verified_at
            },
            trustedDevices: devicesResult.rows,
            backupCodes: backupResult.rows.map(r => r.code),
            active: 'settings'
        });
    } catch (error) {
        console.error('2FA setup page error:', error);
        res.render('error', { message: 'Failed to load 2FA setup page' });
    }
});

// =====================================================
// 2FA API ROUTES
// =====================================================

// Get 2FA status
router.get('/api/2fa/status', requireAuth, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT two_factor_enabled, two_factor_verified_at FROM users WHERE id = $1',
            [req.user.id]
        );

        const user = result.rows[0];

        // Get trusted devices count
        const devicesResult = await db.query(
            'SELECT COUNT(*) as count FROM trusted_devices WHERE user_id = $1 AND expires_at > NOW()',
            [req.user.id]
        );

        res.json({
            enabled: user.two_factor_enabled,
            verifiedAt: user.two_factor_verified_at,
            trustedDevices: parseInt(devicesResult.rows[0].count)
        });
    } catch (error) {
        console.error('Get 2FA status error:', error);
        res.status(500).json({ error: 'Failed to get 2FA status' });
    }
});

// Generate 2FA secret
router.post('/api/2fa/setup', requireAuth, async (req, res) => {
    try {
        const secret = speakeasy.generateSecret({
            name: `LegalForms (${req.user.email})`,
            issuer: 'LegalForms'
        });

        // Store secret temporarily (not verified yet)
        await db.query(
            'UPDATE users SET two_factor_secret = $1 WHERE id = $2',
            [secret.base32, req.user.id]
        );

        // Generate QR code
        const qrCode = await QRCode.toDataURL(secret.otpauth_url);

        // Log security event
        await logSecurityEvent(req.user.id, '2fa_setup_initiated', { ip: req.ip });

        res.json({
            success: true,
            secret: secret.base32,
            qrCode
        });
    } catch (error) {
        console.error('2FA setup error:', error);
        res.status(500).json({ error: 'Failed to setup 2FA' });
    }
});

// Verify and enable 2FA
router.post('/api/2fa/verify', requireAuth, async (req, res) => {
    try {
        const { token } = req.body;

        // Get user's secret
        const result = await db.query(
            'SELECT two_factor_secret FROM users WHERE id = $1',
            [req.user.id]
        );

        if (!result.rows[0].two_factor_secret) {
            return res.status(400).json({ error: 'Please setup 2FA first' });
        }

        // Verify token
        const verified = speakeasy.totp.verify({
            secret: result.rows[0].two_factor_secret,
            encoding: 'base32',
            token: token,
            window: 2
        });

        if (!verified) {
            await logSecurityEvent(req.user.id, '2fa_verify_failed', { ip: req.ip });
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        // Generate backup codes
        const backupCodes = generateBackupCodes();

        // Enable 2FA
        await db.query(`
            UPDATE users SET
                two_factor_enabled = true,
                two_factor_verified_at = CURRENT_TIMESTAMP,
                two_factor_backup_codes = $1
            WHERE id = $2
        `, [JSON.stringify(backupCodes), req.user.id]);

        await logSecurityEvent(req.user.id, '2fa_enabled', { ip: req.ip });

        res.json({
            success: true,
            backupCodes
        });
    } catch (error) {
        console.error('2FA verify error:', error);
        res.status(500).json({ error: 'Failed to verify 2FA' });
    }
});

// Disable 2FA
router.post('/api/2fa/disable', requireAuth, async (req, res) => {
    try {
        const { password, token } = req.body;

        // Verify password
        const bcrypt = require('bcryptjs');
        const userResult = await db.query(
            'SELECT password_hash, two_factor_secret FROM users WHERE id = $1',
            [req.user.id]
        );

        const validPassword = await bcrypt.compare(password, userResult.rows[0].password_hash);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid password' });
        }

        // Verify 2FA token
        const verified = speakeasy.totp.verify({
            secret: userResult.rows[0].two_factor_secret,
            encoding: 'base32',
            token: token,
            window: 2
        });

        if (!verified) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        // Disable 2FA
        await db.query(`
            UPDATE users SET
                two_factor_enabled = false,
                two_factor_secret = NULL,
                two_factor_backup_codes = NULL,
                two_factor_verified_at = NULL
            WHERE id = $1
        `, [req.user.id]);

        // Remove trusted devices
        await db.query('DELETE FROM trusted_devices WHERE user_id = $1', [req.user.id]);

        await logSecurityEvent(req.user.id, '2fa_disabled', { ip: req.ip });

        res.json({ success: true });
    } catch (error) {
        console.error('2FA disable error:', error);
        res.status(500).json({ error: 'Failed to disable 2FA' });
    }
});

// Regenerate backup codes
router.post('/api/2fa/backup-codes/regenerate', requireAuth, async (req, res) => {
    try {
        const { token } = req.body;

        // Verify 2FA token
        const userResult = await db.query(
            'SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = $1',
            [req.user.id]
        );

        if (!userResult.rows[0].two_factor_enabled) {
            return res.status(400).json({ error: '2FA is not enabled' });
        }

        const verified = speakeasy.totp.verify({
            secret: userResult.rows[0].two_factor_secret,
            encoding: 'base32',
            token: token,
            window: 2
        });

        if (!verified) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        const backupCodes = generateBackupCodes();

        await db.query(
            'UPDATE users SET two_factor_backup_codes = $1 WHERE id = $2',
            [JSON.stringify(backupCodes), req.user.id]
        );

        await logSecurityEvent(req.user.id, 'backup_codes_regenerated', { ip: req.ip });

        res.json({ success: true, backupCodes });
    } catch (error) {
        console.error('Regenerate backup codes error:', error);
        res.status(500).json({ error: 'Failed to regenerate backup codes' });
    }
});

// Alias: Generate backup codes (for frontend compatibility - no token required)
router.post('/api/2fa/backup-codes', requireAuth, async (req, res) => {
    try {
        const userResult = await db.query(
            'SELECT two_factor_enabled FROM users WHERE id = $1',
            [req.user.id]
        );

        if (!userResult.rows[0].two_factor_enabled) {
            return res.status(400).json({ error: '2FA is not enabled' });
        }

        const backupCodes = generateBackupCodes();

        await db.query(
            'UPDATE users SET two_factor_backup_codes = $1 WHERE id = $2',
            [JSON.stringify(backupCodes), req.user.id]
        );

        await logSecurityEvent(req.user.id, 'backup_codes_regenerated', { ip: req.ip });

        res.json({ success: true, backupCodes });
    } catch (error) {
        console.error('Generate backup codes error:', error);
        res.status(500).json({ error: 'Failed to generate backup codes' });
    }
});

// =====================================================
// VERIFICATION ROUTES (During Login)
// =====================================================

// Verify 2FA during login
router.post('/api/2fa/login-verify', async (req, res) => {
    try {
        const { userId, token, trustDevice } = req.body;

        const userResult = await db.query(
            'SELECT two_factor_secret, two_factor_backup_codes FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid request' });
        }

        const user = userResult.rows[0];
        let verified = false;
        let usedBackupCode = false;

        // Try TOTP first
        verified = speakeasy.totp.verify({
            secret: user.two_factor_secret,
            encoding: 'base32',
            token: token,
            window: 2
        });

        // Try backup codes if TOTP failed
        if (!verified && user.two_factor_backup_codes) {
            let backupCodes = user.two_factor_backup_codes;
            if (typeof backupCodes === 'string') {
                backupCodes = JSON.parse(backupCodes);
            }
            const codeIndex = backupCodes.findIndex(c => c.code === token && !c.used);

            if (codeIndex !== -1) {
                verified = true;
                usedBackupCode = true;

                // Mark backup code as used
                backupCodes[codeIndex].used = true;
                backupCodes[codeIndex].usedAt = new Date().toISOString();

                await db.query(
                    'UPDATE users SET two_factor_backup_codes = $1 WHERE id = $2',
                    [JSON.stringify(backupCodes), userId]
                );
            }
        }

        // Record attempt
        await db.query(`
            INSERT INTO two_factor_attempts (user_id, attempt_type, success, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5)
        `, [userId, usedBackupCode ? 'backup_code' : 'totp', verified, req.ip, req.get('user-agent')]);

        if (!verified) {
            await logSecurityEvent(userId, '2fa_login_failed', { ip: req.ip });
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        // Trust device if requested
        let deviceToken = null;
        if (trustDevice) {
            deviceToken = crypto.randomBytes(32).toString('hex');
            await db.query(`
                INSERT INTO trusted_devices
                (user_id, device_token, device_name, device_type, browser, os, ip_address, expires_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                userId,
                deviceToken,
                req.body.deviceName || 'Unknown Device',
                req.body.deviceType || 'desktop',
                req.body.browser || 'Unknown',
                req.body.os || 'Unknown',
                req.ip,
                new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
            ]);
        }

        await logSecurityEvent(userId, '2fa_login_success', { ip: req.ip, trusted: trustDevice });

        res.json({
            success: true,
            deviceToken,
            usedBackupCode
        });
    } catch (error) {
        console.error('2FA login verify error:', error);
        res.status(500).json({ error: 'Verification failed' });
    }
});

// Check if device is trusted
router.post('/api/2fa/check-device', async (req, res) => {
    try {
        const { userId, deviceToken } = req.body;

        if (!deviceToken) {
            return res.json({ trusted: false });
        }

        const result = await db.query(`
            SELECT id FROM trusted_devices
            WHERE user_id = $1 AND device_token = $2 AND expires_at > NOW() AND is_active = true
        `, [userId, deviceToken]);

        if (result.rows.length > 0) {
            // Update last used
            await db.query(
                'UPDATE trusted_devices SET last_used_at = CURRENT_TIMESTAMP WHERE device_token = $1',
                [deviceToken]
            );
        }

        res.json({ trusted: result.rows.length > 0 });
    } catch (error) {
        console.error('Check device error:', error);
        res.json({ trusted: false });
    }
});

// =====================================================
// TRUSTED DEVICES MANAGEMENT
// =====================================================

// Get trusted devices
router.get('/api/2fa/trusted-devices', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT id, device_name, device_type, browser, os, ip_address, last_used_at, created_at
            FROM trusted_devices
            WHERE user_id = $1 AND expires_at > NOW()
            ORDER BY last_used_at DESC
        `, [req.user.id]);

        res.json({ success: true, devices: result.rows });
    } catch (error) {
        console.error('Get trusted devices error:', error);
        res.status(500).json({ error: 'Failed to get devices' });
    }
});

// Remove trusted device
router.delete('/api/2fa/trusted-devices/:id', requireAuth, async (req, res) => {
    try {
        await db.query(
            'DELETE FROM trusted_devices WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        await logSecurityEvent(req.user.id, 'device_removed', { device_id: req.params.id });

        res.json({ success: true });
    } catch (error) {
        console.error('Remove device error:', error);
        res.status(500).json({ error: 'Failed to remove device' });
    }
});

// Alias: Remove trusted device (for frontend compatibility)
router.delete('/api/2fa/devices/:id', requireAuth, async (req, res) => {
    try {
        await db.query(
            'DELETE FROM trusted_devices WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        await logSecurityEvent(req.user.id, 'device_removed', { device_id: req.params.id });

        res.json({ success: true });
    } catch (error) {
        console.error('Remove device error:', error);
        res.status(500).json({ error: 'Failed to remove device' });
    }
});

// Remove all trusted devices
router.delete('/api/2fa/trusted-devices', requireAuth, async (req, res) => {
    try {
        await db.query('DELETE FROM trusted_devices WHERE user_id = $1', [req.user.id]);

        await logSecurityEvent(req.user.id, 'all_devices_removed', { ip: req.ip });

        res.json({ success: true });
    } catch (error) {
        console.error('Remove all devices error:', error);
        res.status(500).json({ error: 'Failed to remove devices' });
    }
});

// =====================================================
// SECURITY AUDIT
// =====================================================

// Get security audit log
router.get('/api/security/audit', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT * FROM security_audit_log
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 50
        `, [req.user.id]);

        res.json({ success: true, events: result.rows });
    } catch (error) {
        console.error('Get audit log error:', error);
        res.status(500).json({ error: 'Failed to get audit log' });
    }
});

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function generateBackupCodes() {
    const codes = [];
    for (let i = 0; i < 10; i++) {
        codes.push({
            code: crypto.randomBytes(4).toString('hex').toUpperCase(),
            used: false
        });
    }
    return codes;
}

async function logSecurityEvent(userId, eventType, details) {
    try {
        await db.query(`
            INSERT INTO security_audit_log (user_id, event_type, severity, details, ip_address)
            VALUES ($1, $2, $3, $4, $5)
        `, [
            userId,
            eventType,
            ['2fa_login_failed', 'all_devices_removed'].includes(eventType) ? 'warning' : 'info',
            JSON.stringify(details),
            details.ip
        ]);
    } catch (error) {
        console.error('Log security event error:', error);
    }
}

module.exports = router;

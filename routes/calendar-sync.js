/**
 * Calendar Sync Routes
 * Handles Google Calendar and Outlook calendar synchronization
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { google } = require('googleapis');
const crypto = require('crypto');

// OAuth2 Configuration
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/calendar-sync/google/callback'
);

// =====================================================
// PAGE ROUTES
// =====================================================

// Calendar sync dashboard
router.get('/calendar-sync', requireAuth, async (req, res) => {
    try {
        const connectionsResult = await db.query(`
            SELECT * FROM calendar_connections
            WHERE (user_id = $1 OR user_id IS NULL)
            ORDER BY created_at DESC
        `, [req.user.id]);

        const logsResult = await db.query(`
            SELECT csl.*, cc.provider, cc.provider_email
            FROM calendar_sync_log csl
            JOIN calendar_connections cc ON csl.connection_id = cc.id
            WHERE (cc.user_id = $1 OR cc.user_id IS NULL)
            ORDER BY csl.started_at DESC
            LIMIT 10
        `, [req.user.id]);

        res.render('calendar-sync/dashboard', {
            title: 'Calendar Sync',
            connections: connectionsResult.rows,
            syncLogs: logsResult.rows,
            req
        });
    } catch (error) {
        console.error('Calendar sync dashboard error:', error);
        res.status(500).json({ error: 'Something went wrong!' });
    }
});

// Connect Google Calendar
router.get('/calendar-sync/google', requireAuth, async (req, res) => {
    try {
        res.render('calendar-sync/google', {
            title: 'Connect Google Calendar',
            googleClientId: process.env.GOOGLE_CLIENT_ID,
            req
        });
    } catch (error) {
        console.error('Google calendar page error:', error);
        res.status(500).json({ error: 'Something went wrong!' });
    }
});

// Connect Outlook Calendar
router.get('/calendar-sync/outlook', requireAuth, async (req, res) => {
    try {
        res.render('calendar-sync/outlook', {
            title: 'Connect Outlook Calendar',
            req
        });
    } catch (error) {
        console.error('Outlook calendar page error:', error);
        res.status(500).json({ error: 'Something went wrong!' });
    }
});

// Calendar sync settings
router.get('/calendar-sync/settings', requireAuth, async (req, res) => {
    try {
        const connections = await db.query(`
            SELECT * FROM calendar_connections
            WHERE (user_id = $1 OR user_id IS NULL)
        `, [req.user.id]);

        res.render('calendar-sync/settings', {
            title: 'Sync Settings',
            connections: connections.rows,
            req
        });
    } catch (error) {
        console.error('Calendar sync settings error:', error);
        res.status(500).json({ error: 'Something went wrong!' });
    }
});

// Calendar sync history
router.get('/calendar-sync/history', requireAuth, async (req, res) => {
    try {
        const logsResult = await db.query(`
            SELECT csl.*, cc.provider, cc.provider_email
            FROM calendar_sync_log csl
            JOIN calendar_connections cc ON csl.connection_id = cc.id
            WHERE (cc.user_id = $1 OR cc.user_id IS NULL)
            ORDER BY csl.started_at DESC
        `, [req.user.id]);

        res.render('calendar-sync/history', {
            title: 'Sync History',
            logs: logsResult.rows,
            req
        });
    } catch (error) {
        console.error('Calendar sync history error:', error);
        res.status(500).json({ error: 'Something went wrong!' });
    }
});

// Calendar sync settings page (legacy)
router.get('/settings/calendar-sync', requireAuth, async (req, res) => {
    try {
        const connectionsResult = await db.query(`
            SELECT * FROM calendar_connections
            WHERE (user_id = $1 OR user_id IS NULL)
            ORDER BY created_at DESC
        `, [req.user.id]);

        // Get recent sync logs
        const logsResult = await db.query(`
            SELECT csl.*, cc.provider, cc.provider_email
            FROM calendar_sync_log csl
            JOIN calendar_connections cc ON csl.connection_id = cc.id
            WHERE (cc.user_id = $1 OR cc.user_id IS NULL)
            ORDER BY csl.started_at DESC
            LIMIT 20
        `, [req.user.id]);

        res.render('settings/calendar-sync', {
            title: 'Calendar Sync Settings',
            connections: connectionsResult.rows,
            syncLogs: logsResult.rows,
            googleClientId: process.env.GOOGLE_CLIENT_ID,
            req
        });
    } catch (error) {
        console.error('Calendar sync settings error:', error);
        res.status(500).render('error', { message: 'Error loading settings' });
    }
});

// =====================================================
// GOOGLE CALENDAR OAUTH
// =====================================================

// Initiate Google OAuth
router.get('/api/calendar-sync/google/auth', requireAuth, (req, res) => {
    const scopes = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/userinfo.email'
    ];

    // Store user ID in state for callback
    const state = crypto.randomBytes(16).toString('hex');
    req.session.calendarSyncState = { state, userId: req.user.id };

    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        state,
        prompt: 'consent'
    });

    res.redirect(url);
});

// Google OAuth callback
router.get('/api/calendar-sync/google/callback', async (req, res) => {
    try {
        const { code, state } = req.query;

        // Verify state
        if (!req.session.calendarSyncState || req.session.calendarSyncState.state !== state) {
            return res.redirect('/settings/calendar-sync?error=invalid_state');
        }

        const userId = req.session.calendarSyncState.userId;
        delete req.session.calendarSyncState;

        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Get user info
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();

        // Get primary calendar
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        const calendarList = await calendar.calendarList.list();
        const primaryCalendar = calendarList.data.items.find(c => c.primary) || calendarList.data.items[0];

        // Save connection
        await db.query(`
            INSERT INTO calendar_connections
            (user_id, provider, provider_account_id, provider_email, access_token, refresh_token, token_expires_at, calendar_id, sync_status)
            VALUES ($1, 'google', $2, $3, $4, $5, $6, $7, 'active')
            ON CONFLICT (user_id, provider) DO UPDATE SET
                provider_account_id = EXCLUDED.provider_account_id,
                provider_email = EXCLUDED.provider_email,
                access_token = EXCLUDED.access_token,
                refresh_token = COALESCE(EXCLUDED.refresh_token, calendar_connections.refresh_token),
                token_expires_at = EXCLUDED.token_expires_at,
                calendar_id = EXCLUDED.calendar_id,
                sync_status = 'active',
                updated_at = CURRENT_TIMESTAMP
        `, [
            userId,
            userInfo.data.id,
            userInfo.data.email,
            tokens.access_token,
            tokens.refresh_token,
            new Date(tokens.expiry_date),
            primaryCalendar.id
        ]);

        res.redirect('/settings/calendar-sync?success=connected');
    } catch (error) {
        console.error('Google OAuth callback error:', error);
        res.redirect('/settings/calendar-sync?error=auth_failed');
    }
});

// =====================================================
// SYNC OPERATIONS
// =====================================================

// Trigger manual sync
router.post('/api/calendar-sync/:connectionId/sync', requireAuth, async (req, res) => {
    try {
        const connectionResult = await db.query(`
            SELECT * FROM calendar_connections WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
        `, [req.params.connectionId, req.user.id]);

        if (connectionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Connection not found' });
        }

        const connection = connectionResult.rows[0];

        // Create sync log
        const logResult = await db.query(`
            INSERT INTO calendar_sync_log (connection_id, sync_type, status)
            VALUES ($1, 'manual', 'running')
            RETURNING id
        `, [connection.id]);

        const syncLogId = logResult.rows[0].id;

        // Perform sync based on provider
        let result;
        if (connection.provider === 'google') {
            result = await syncGoogleCalendar(connection, req.user.id);
        } else if (connection.provider === 'outlook') {
            result = await syncOutlookCalendar(connection, req.user.id);
        }

        // Update sync log
        await db.query(`
            UPDATE calendar_sync_log SET
                events_created = $1,
                events_updated = $2,
                events_deleted = $3,
                status = 'completed',
                completed_at = CURRENT_TIMESTAMP
            WHERE id = $4
        `, [result.created, result.updated, result.deleted, syncLogId]);

        // Update connection last sync
        await db.query(`
            UPDATE calendar_connections SET last_sync_at = CURRENT_TIMESTAMP, sync_status = 'active'
            WHERE id = $1
        `, [connection.id]);

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Sync error:', error);

        // Update sync log with error
        if (req.params.connectionId) {
            await db.query(`
                UPDATE calendar_sync_log SET status = 'failed', errors = $1, completed_at = CURRENT_TIMESTAMP
                WHERE connection_id = $2 AND status = 'running'
            `, [JSON.stringify([error.message]), req.params.connectionId]);
        }

        res.status(500).json({ error: 'Sync failed: ' + error.message });
    }
});

// Google Calendar sync function
async function syncGoogleCalendar(connection, userId) {
    // Refresh token if needed
    oauth2Client.setCredentials({
        access_token: connection.access_token,
        refresh_token: connection.refresh_token
    });

    if (new Date(connection.token_expires_at) < new Date()) {
        const { credentials } = await oauth2Client.refreshAccessToken();
        await db.query(`
            UPDATE calendar_connections SET access_token = $1, token_expires_at = $2
            WHERE id = $3
        `, [credentials.access_token, new Date(credentials.expiry_date), connection.id]);
        oauth2Client.setCredentials(credentials);
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    let created = 0, updated = 0, deleted = 0;

    // Get local events to sync to Google
    if (connection.sync_direction === 'to_provider' || connection.sync_direction === 'both') {
        const localEvents = await db.query(`
            SELECT ce.*, csm.provider_event_id
            FROM calendar_events ce
            LEFT JOIN calendar_sync_mapping csm ON ce.id = csm.local_event_id AND csm.connection_id = $1
            WHERE (ce.user_id = $2 OR ce.user_id IS NULL) AND ce.start_time >= NOW() - INTERVAL '30 days'
        `, [connection.id, userId]);

        for (const event of localEvents.rows) {
            const googleEvent = {
                summary: event.title,
                description: event.description,
                location: event.location,
                start: {
                    dateTime: event.all_day ? undefined : new Date(event.start_time).toISOString(),
                    date: event.all_day ? new Date(event.start_time).toISOString().split('T')[0] : undefined
                },
                end: {
                    dateTime: event.all_day ? undefined : new Date(event.end_time || event.start_time).toISOString(),
                    date: event.all_day ? new Date(event.end_time || event.start_time).toISOString().split('T')[0] : undefined
                }
            };

            try {
                if (event.provider_event_id) {
                    // Update existing
                    await calendar.events.update({
                        calendarId: connection.calendar_id,
                        eventId: event.provider_event_id,
                        resource: googleEvent
                    });
                    updated++;
                } else {
                    // Create new
                    const result = await calendar.events.insert({
                        calendarId: connection.calendar_id,
                        resource: googleEvent
                    });

                    await db.query(`
                        INSERT INTO calendar_sync_mapping (connection_id, local_event_id, provider_event_id)
                        VALUES ($1, $2, $3)
                    `, [connection.id, event.id, result.data.id]);
                    created++;
                }
            } catch (err) {
                console.error('Error syncing event:', err.message);
            }
        }
    }

    // Get Google events to sync locally
    if (connection.sync_direction === 'from_provider' || connection.sync_direction === 'both') {
        const googleEvents = await calendar.events.list({
            calendarId: connection.calendar_id,
            timeMin: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            maxResults: 100,
            singleEvents: true
        });

        for (const gEvent of googleEvents.data.items || []) {
            // Check if already mapped
            const mappingResult = await db.query(`
                SELECT * FROM calendar_sync_mapping
                WHERE connection_id = $1 AND provider_event_id = $2
            `, [connection.id, gEvent.id]);

            if (mappingResult.rows.length === 0) {
                // Create local event
                const startTime = gEvent.start.dateTime || gEvent.start.date;
                const endTime = gEvent.end.dateTime || gEvent.end.date;

                const localResult = await db.query(`
                    INSERT INTO calendar_events
                    (user_id, title, description, location, start_time, end_time, all_day, event_type)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, 'meeting')
                    RETURNING id
                `, [
                    userId,
                    gEvent.summary || 'Untitled Event',
                    gEvent.description,
                    gEvent.location,
                    startTime,
                    endTime,
                    !gEvent.start.dateTime
                ]);

                await db.query(`
                    INSERT INTO calendar_sync_mapping (connection_id, local_event_id, provider_event_id)
                    VALUES ($1, $2, $3)
                `, [connection.id, localResult.rows[0].id, gEvent.id]);
                created++;
            }
        }
    }

    return { created, updated, deleted };
}

// Outlook Calendar sync (placeholder)
async function syncOutlookCalendar(connection, userId) {
    // Microsoft Graph API implementation would go here
    // Similar to Google Calendar sync
    return { created: 0, updated: 0, deleted: 0, message: 'Outlook sync not yet implemented' };
}

// =====================================================
// MANAGEMENT ROUTES
// =====================================================

// Disconnect calendar
router.delete('/api/calendar-sync/:connectionId', requireAuth, async (req, res) => {
    try {
        // Delete mappings first
        await db.query(`
            DELETE FROM calendar_sync_mapping WHERE connection_id = $1
        `, [req.params.connectionId]);

        // Delete logs
        await db.query(`
            DELETE FROM calendar_sync_log WHERE connection_id = $1
        `, [req.params.connectionId]);

        // Delete connection
        await db.query(`
            DELETE FROM calendar_connections WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
        `, [req.params.connectionId, req.user.id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Disconnect calendar error:', error);
        res.status(500).json({ error: 'Failed to disconnect calendar' });
    }
});

// Update sync settings
router.put('/api/calendar-sync/:connectionId', requireAuth, async (req, res) => {
    try {
        const { sync_direction, sync_status } = req.body;

        await db.query(`
            UPDATE calendar_connections SET sync_direction = $1, sync_status = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3 AND (user_id = $4 OR user_id IS NULL)
        `, [sync_direction, sync_status, req.params.connectionId, req.user.id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Update sync settings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Get sync status
router.get('/api/calendar-sync/:connectionId/status', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT cc.*,
                   (SELECT COUNT(*) FROM calendar_sync_mapping WHERE connection_id = cc.id) as synced_events
            FROM calendar_connections cc
            WHERE cc.id = $1 AND (cc.user_id = $2 OR cc.user_id IS NULL)
        `, [req.params.connectionId, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Connection not found' });
        }

        res.json({ success: true, connection: result.rows[0] });
    } catch (error) {
        console.error('Get sync status error:', error);
        res.status(500).json({ error: 'Failed to get status' });
    }
});

module.exports = router;

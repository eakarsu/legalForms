/**
 * Communications Routes
 * Handles messages and notifications
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// =====================================================
// PAGE ROUTES
// =====================================================

// Messages inbox page
router.get('/messages', requireAuth, async (req, res) => {
    try {
        const { type, is_read } = req.query;

        let query = `
            SELECT m.*,
                   cl.first_name as client_first_name, cl.last_name as client_last_name, cl.company_name,
                   c.title as case_title,
                   u.first_name as sender_first_name, u.last_name as sender_last_name
            FROM messages m
            LEFT JOIN clients cl ON m.client_id = cl.id
            LEFT JOIN cases c ON m.case_id = c.id
            LEFT JOIN users u ON m.user_id = u.id
            WHERE (m.user_id = $1 OR m.user_id IS NULL) OR m.recipient_id = $1
        `;
        const params = [req.user.id];
        let paramIndex = 2;

        if (type && type !== 'all') {
            query += ` AND m.message_type = $${paramIndex}`;
            params.push(type);
            paramIndex++;
        }

        if (is_read !== undefined && is_read !== 'all') {
            query += ` AND m.is_read = $${paramIndex}`;
            params.push(is_read === 'true');
            paramIndex++;
        }

        query += ' ORDER BY m.created_at DESC';

        const messagesResult = await db.query(query, params);

        // Get unread count
        const unreadResult = await db.query(
            'SELECT COUNT(*) FROM messages WHERE (user_id = $1 OR recipient_id = $1) AND is_read = false',
            [req.user.id]
        );

        // Get clients for compose dropdown
        const clientsResult = await db.query(
            'SELECT id, first_name, last_name, company_name, client_type FROM clients WHERE (user_id = $1 OR user_id IS NULL) AND status = \'active\' ORDER BY company_name, last_name',
            [req.user.id]
        );

        // Get cases for compose dropdown
        const casesResult = await db.query(
            'SELECT id, title, case_number FROM cases WHERE (user_id = $1 OR user_id IS NULL) AND status != \'archived\' ORDER BY title',
            [req.user.id]
        );

        res.render('communications/messages', {
            title: 'Messages',
            messages: messagesResult.rows,
            unreadCount: parseInt(unreadResult.rows[0].count),
            clients: clientsResult.rows,
            cases: casesResult.rows,
            filters: { type, is_read },
            req
        });
    } catch (error) {
        console.error('Error loading messages:', error);
        res.status(500).render('error', { message: 'Error loading messages' });
    }
});

// Notifications page
router.get('/notifications', requireAuth, async (req, res) => {
    try {
        const { type, is_read } = req.query;

        let query = 'SELECT * FROM notifications WHERE (user_id = $1 OR user_id IS NULL)';
        const params = [req.user.id];
        let paramIndex = 2;

        if (type && type !== 'all') {
            query += ` AND notification_type = $${paramIndex}`;
            params.push(type);
            paramIndex++;
        }

        if (is_read !== undefined && is_read !== 'all') {
            query += ` AND is_read = $${paramIndex}`;
            params.push(is_read === 'true');
            paramIndex++;
        }

        query += ' ORDER BY created_at DESC';

        const notificationsResult = await db.query(query, params);

        // Get unread count
        const unreadResult = await db.query(
            'SELECT COUNT(*) FROM notifications WHERE (user_id = $1 OR user_id IS NULL) AND is_read = false',
            [req.user.id]
        );

        res.render('communications/notifications', {
            title: 'Notifications',
            notifications: notificationsResult.rows,
            unreadCount: parseInt(unreadResult.rows[0].count),
            filters: { type, is_read },
            req
        });
    } catch (error) {
        console.error('Error loading notifications:', error);
        res.status(500).render('error', { message: 'Error loading notifications' });
    }
});

// =====================================================
// MESSAGES API
// =====================================================

// List messages
router.get('/api/messages', requireAuth, async (req, res) => {
    try {
        const { type, client_id, case_id, is_read, limit = 50 } = req.query;

        let query = `
            SELECT m.*, cl.first_name as client_first_name, cl.last_name as client_last_name,
                   cl.company_name, c.title as case_title
            FROM messages m
            LEFT JOIN clients cl ON m.client_id = cl.id
            LEFT JOIN cases c ON m.case_id = c.id
            WHERE (m.user_id = $1 OR m.user_id IS NULL) OR m.recipient_id = $1
        `;
        const params = [req.user.id];
        let paramIndex = 2;

        if (type && type !== 'all') {
            query += ` AND m.message_type = $${paramIndex}`;
            params.push(type);
            paramIndex++;
        }

        if (client_id) {
            query += ` AND m.client_id = $${paramIndex}`;
            params.push(client_id);
            paramIndex++;
        }

        if (case_id) {
            query += ` AND m.case_id = $${paramIndex}`;
            params.push(case_id);
            paramIndex++;
        }

        if (is_read !== undefined) {
            query += ` AND m.is_read = $${paramIndex}`;
            params.push(is_read === 'true');
            paramIndex++;
        }

        query += ` ORDER BY m.created_at DESC LIMIT $${paramIndex}`;
        params.push(limit);

        const result = await db.query(query, params);

        res.json({
            success: true,
            messages: result.rows
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Get single message
router.get('/api/messages/:id', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT m.*, cl.first_name as client_first_name, cl.last_name as client_last_name,
                   cl.company_name, c.title as case_title
            FROM messages m
            LEFT JOIN clients cl ON m.client_id = cl.id
            LEFT JOIN cases c ON m.case_id = c.id
            WHERE m.id = $1 AND (m.user_id = $2 OR m.recipient_id = $2)
        `, [req.params.id, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Mark as read
        await db.query(
            'UPDATE messages SET is_read = true WHERE id = $1',
            [req.params.id]
        );

        // Get thread (parent and replies)
        const threadResult = await db.query(`
            SELECT * FROM messages
            WHERE parent_id = $1 OR id = $1
            ORDER BY created_at ASC
        `, [result.rows[0].parent_id || req.params.id]);

        res.json({
            success: true,
            message: result.rows[0],
            thread: threadResult.rows
        });
    } catch (error) {
        console.error('Error fetching message:', error);
        res.status(500).json({ error: 'Failed to fetch message' });
    }
});

// Send message
router.post('/api/messages', requireAuth, async (req, res) => {
    try {
        const { subject, content, message_type, client_id, case_id, recipient_id, parent_id } = req.body;

        const result = await db.query(`
            INSERT INTO messages (user_id, subject, content, message_type, client_id, case_id, recipient_id, parent_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [
            req.user.id, subject, content, message_type || 'internal',
            client_id || null, case_id || null, recipient_id || null, parent_id || null
        ]);

        // Create notification for recipient
        if (recipient_id) {
            await db.query(`
                INSERT INTO notifications (user_id, title, message, notification_type, reference_type, reference_id)
                VALUES ($1, $2, $3, 'message', 'message', $4)
            `, [recipient_id, `New message: ${subject}`, content.substring(0, 100), result.rows[0].id]);
        }

        res.status(201).json({
            success: true,
            message: result.rows[0]
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Mark message as read
router.put('/api/messages/:id/read', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            UPDATE messages SET is_read = true
            WHERE id = $1 AND (user_id = $2 OR recipient_id = $2)
            RETURNING *
        `, [req.params.id, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }

        res.json({
            success: true,
            message: result.rows[0]
        });
    } catch (error) {
        console.error('Error marking message as read:', error);
        res.status(500).json({ error: 'Failed to update message' });
    }
});

// Delete message
router.delete('/api/messages/:id', requireAuth, async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM messages WHERE id = $1 AND (user_id = $2 OR user_id IS NULL) RETURNING *',
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }

        res.json({
            success: true,
            message: 'Message deleted'
        });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

// =====================================================
// NOTIFICATIONS API
// =====================================================

// List notifications
router.get('/api/notifications', requireAuth, async (req, res) => {
    try {
        const { type, is_read, limit = 50 } = req.query;

        let query = 'SELECT * FROM notifications WHERE (user_id = $1 OR user_id IS NULL)';
        const params = [req.user.id];
        let paramIndex = 2;

        if (type && type !== 'all') {
            query += ` AND notification_type = $${paramIndex}`;
            params.push(type);
            paramIndex++;
        }

        if (is_read !== undefined) {
            query += ` AND is_read = $${paramIndex}`;
            params.push(is_read === 'true');
            paramIndex++;
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
        params.push(limit);

        const result = await db.query(query, params);

        // Get unread count
        const unreadResult = await db.query(
            'SELECT COUNT(*) FROM notifications WHERE (user_id = $1 OR user_id IS NULL) AND is_read = false',
            [req.user.id]
        );

        res.json({
            success: true,
            notifications: result.rows,
            unreadCount: parseInt(unreadResult.rows[0].count)
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Mark notification as read
router.put('/api/notifications/:id/read', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            UPDATE notifications SET is_read = true
            WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
            RETURNING *
        `, [req.params.id, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({
            success: true,
            notification: result.rows[0]
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to update notification' });
    }
});

// Mark all notifications as read
router.put('/api/notifications/read-all', requireAuth, async (req, res) => {
    try {
        await db.query(
            'UPDATE notifications SET is_read = true WHERE (user_id = $1 OR user_id IS NULL) AND is_read = false',
            [req.user.id]
        );

        res.json({
            success: true,
            message: 'All notifications marked as read'
        });
    } catch (error) {
        console.error('Error marking notifications as read:', error);
        res.status(500).json({ error: 'Failed to update notifications' });
    }
});

// Get single notification
router.get('/api/notifications/:id', requireAuth, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM notifications WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({ notification: result.rows[0] });
    } catch (error) {
        console.error('Error fetching notification:', error);
        res.status(500).json({ error: 'Failed to fetch notification' });
    }
});

// Delete notification
router.delete('/api/notifications/:id', requireAuth, async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM notifications WHERE id = $1 AND (user_id = $2 OR user_id IS NULL) RETURNING *',
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({
            success: true,
            message: 'Notification deleted'
        });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
});

// Create notification (internal use)
router.post('/api/notifications', requireAuth, async (req, res) => {
    try {
        const { user_id, title, message, notification_type, reference_type, reference_id } = req.body;

        const result = await db.query(`
            INSERT INTO notifications (user_id, title, message, notification_type, reference_type, reference_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [user_id || req.user.id, title, message, notification_type || 'system', reference_type, reference_id]);

        res.status(201).json({
            success: true,
            notification: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({ error: 'Failed to create notification' });
    }
});

module.exports = router;

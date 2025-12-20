/**
 * Collaboration Routes
 * Handles user roles, document versions, comments, and activity log
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// Helper function to log activity
async function logActivity(userId, action, entityType, entityId, details, ipAddress) {
    try {
        await db.query(`
            INSERT INTO activity_log (user_id, action, entity_type, entity_id, details, ip_address)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [userId, action, entityType, entityId, JSON.stringify(details), ipAddress]);
    } catch (error) {
        console.error('Error logging activity:', error);
    }
}

// =====================================================
// PAGE ROUTES
// =====================================================

// Team management page
router.get('/team', requireAuth, async (req, res) => {
    try {
        // Get team members (users with roles in same organization - for now, just show roles)
        const rolesResult = await db.query('SELECT * FROM roles ORDER BY name');

        // Get user's roles
        const userRolesResult = await db.query(`
            SELECT ur.*, r.name as role_name, r.description as role_description, r.permissions
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = $1
        `, [req.user.id]);

        res.render('collaboration/team', {
            title: 'Team Management',
            roles: rolesResult.rows,
            userRoles: userRolesResult.rows,
            req
        });
    } catch (error) {
        console.error('Error loading team page:', error);
        res.status(500).render('error', { message: 'Error loading team page' });
    }
});

// Activity log page
router.get('/activity', requireAuth, async (req, res) => {
    try {
        const { entity_type, action, date_from, date_to } = req.query;

        let query = `
            SELECT al.*, u.first_name, u.last_name, u.email
            FROM activity_log al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.user_id = $1
        `;
        const params = [req.user.id];
        let paramIndex = 2;

        if (entity_type && entity_type !== 'all') {
            query += ` AND al.entity_type = $${paramIndex}`;
            params.push(entity_type);
            paramIndex++;
        }

        if (action && action !== 'all') {
            query += ` AND al.action = $${paramIndex}`;
            params.push(action);
            paramIndex++;
        }

        if (date_from) {
            query += ` AND al.created_at >= $${paramIndex}`;
            params.push(date_from);
            paramIndex++;
        }

        if (date_to) {
            query += ` AND al.created_at <= $${paramIndex}`;
            params.push(date_to);
            paramIndex++;
        }

        query += ' ORDER BY al.created_at DESC LIMIT 100';

        const activityResult = await db.query(query, params);

        // Get distinct entity types for filter
        const entityTypesResult = await db.query(
            'SELECT DISTINCT entity_type FROM activity_log WHERE user_id = $1 ORDER BY entity_type',
            [req.user.id]
        );

        // Get distinct actions for filter
        const actionsResult = await db.query(
            'SELECT DISTINCT action FROM activity_log WHERE user_id = $1 ORDER BY action',
            [req.user.id]
        );

        res.render('collaboration/activity', {
            title: 'Activity Log',
            activities: activityResult.rows,
            entityTypes: entityTypesResult.rows.map(r => r.entity_type),
            actions: actionsResult.rows.map(r => r.action),
            filters: { entity_type, action, date_from, date_to },
            req
        });
    } catch (error) {
        console.error('Error loading activity log:', error);
        res.status(500).render('error', { message: 'Error loading activity log' });
    }
});

// =====================================================
// ROLES API
// =====================================================

// List roles
router.get('/api/roles', requireAuth, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM roles ORDER BY name');
        res.json({
            success: true,
            roles: result.rows
        });
    } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({ error: 'Failed to fetch roles' });
    }
});

// Get user's roles
router.get('/api/users/:id/roles', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT ur.*, r.name, r.description, r.permissions
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = $1
        `, [req.params.id]);

        res.json({
            success: true,
            roles: result.rows
        });
    } catch (error) {
        console.error('Error fetching user roles:', error);
        res.status(500).json({ error: 'Failed to fetch user roles' });
    }
});

// Assign role to user
router.post('/api/users/:id/roles', requireAuth, async (req, res) => {
    try {
        const { role_id } = req.body;

        // Check if user has admin role
        const adminCheck = await db.query(`
            SELECT ur.id FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = $1 AND r.name = 'admin'
        `, [req.user.id]);

        if (adminCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const result = await db.query(`
            INSERT INTO user_roles (user_id, role_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, role_id) DO NOTHING
            RETURNING *
        `, [req.params.id, role_id]);

        await logActivity(req.user.id, 'assigned_role', 'user', req.params.id, { role_id }, req.ip);

        res.status(201).json({
            success: true,
            userRole: result.rows[0]
        });
    } catch (error) {
        console.error('Error assigning role:', error);
        res.status(500).json({ error: 'Failed to assign role' });
    }
});

// Remove role from user
router.delete('/api/users/:userId/roles/:roleId', requireAuth, async (req, res) => {
    try {
        // Check if user has admin role
        const adminCheck = await db.query(`
            SELECT ur.id FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = $1 AND r.name = 'admin'
        `, [req.user.id]);

        if (adminCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        await db.query(
            'DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2',
            [req.params.userId, req.params.roleId]
        );

        await logActivity(req.user.id, 'removed_role', 'user', req.params.userId, { role_id: req.params.roleId }, req.ip);

        res.json({
            success: true,
            message: 'Role removed'
        });
    } catch (error) {
        console.error('Error removing role:', error);
        res.status(500).json({ error: 'Failed to remove role' });
    }
});

// Update user role (used by team.ejs)
router.put('/api/users/:id/role', requireAuth, async (req, res) => {
    try {
        const { role_id } = req.body;

        // Check if user has admin role
        const adminCheck = await db.query(`
            SELECT ur.id FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = $1 AND r.name = 'admin'
        `, [req.user.id]);

        if (adminCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Remove existing roles and add new one
        await db.query('DELETE FROM user_roles WHERE user_id = $1', [req.params.id]);
        await db.query(
            'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [req.params.id, role_id]
        );

        await logActivity(req.user.id, 'updated_role', 'user', req.params.id, { role_id }, req.ip);

        res.json({ success: true, message: 'Role updated' });
    } catch (error) {
        console.error('Error updating role:', error);
        res.status(500).json({ error: 'Failed to update role' });
    }
});

// Remove user from team (used by team.ejs)
router.delete('/api/users/:id', requireAuth, async (req, res) => {
    try {
        // Check if user has admin role
        const adminCheck = await db.query(`
            SELECT ur.id FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = $1 AND r.name = 'admin'
        `, [req.user.id]);

        if (adminCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Don't allow self-deletion
        if (req.params.id === req.user.id) {
            return res.status(400).json({ error: 'Cannot remove yourself' });
        }

        // Remove user roles
        await db.query('DELETE FROM user_roles WHERE user_id = $1', [req.params.id]);

        // Optionally deactivate user instead of deleting
        await db.query('UPDATE users SET is_active = false WHERE id = $1', [req.params.id]);

        await logActivity(req.user.id, 'removed_user', 'user', req.params.id, {}, req.ip);

        res.json({ success: true, message: 'User removed from team' });
    } catch (error) {
        console.error('Error removing user:', error);
        res.status(500).json({ error: 'Failed to remove user' });
    }
});

// =====================================================
// DOCUMENT VERSIONS API
// =====================================================

// Get document versions
router.get('/api/documents/:id/versions', requireAuth, async (req, res) => {
    try {
        // Verify document ownership
        const docCheck = await db.query(
            'SELECT id FROM document_history WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (docCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const result = await db.query(`
            SELECT dv.*, u.first_name, u.last_name
            FROM document_versions dv
            LEFT JOIN users u ON dv.created_by = u.id
            WHERE dv.document_id = $1
            ORDER BY dv.version_number DESC
        `, [req.params.id]);

        res.json({
            success: true,
            versions: result.rows
        });
    } catch (error) {
        console.error('Error fetching document versions:', error);
        res.status(500).json({ error: 'Failed to fetch versions' });
    }
});

// Create document version
router.post('/api/documents/:id/versions', requireAuth, async (req, res) => {
    try {
        const { content, file_path, change_summary } = req.body;

        // Verify document ownership
        const docCheck = await db.query(
            'SELECT id FROM document_history WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (docCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Get next version number
        const versionResult = await db.query(
            'SELECT COALESCE(MAX(version_number), 0) + 1 as next_version FROM document_versions WHERE document_id = $1',
            [req.params.id]
        );

        const versionNumber = versionResult.rows[0].next_version;

        const result = await db.query(`
            INSERT INTO document_versions (document_id, version_number, content, file_path, created_by, change_summary)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [req.params.id, versionNumber, content, file_path, req.user.id, change_summary]);

        await logActivity(req.user.id, 'created_version', 'document', req.params.id, { version: versionNumber }, req.ip);

        res.status(201).json({
            success: true,
            version: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating version:', error);
        res.status(500).json({ error: 'Failed to create version' });
    }
});

// =====================================================
// DOCUMENT COMMENTS API
// =====================================================

// Get document comments
router.get('/api/documents/:id/comments', requireAuth, async (req, res) => {
    try {
        // Verify document ownership
        const docCheck = await db.query(
            'SELECT id FROM document_history WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (docCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const result = await db.query(`
            SELECT dc.*, u.first_name, u.last_name
            FROM document_comments dc
            LEFT JOIN users u ON dc.user_id = u.id
            WHERE dc.document_id = $1
            ORDER BY dc.created_at ASC
        `, [req.params.id]);

        res.json({
            success: true,
            comments: result.rows
        });
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

// Add comment to document
router.post('/api/documents/:id/comments', requireAuth, async (req, res) => {
    try {
        const { content, parent_id } = req.body;

        // Verify document ownership
        const docCheck = await db.query(
            'SELECT id FROM document_history WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (docCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const result = await db.query(`
            INSERT INTO document_comments (document_id, user_id, content, parent_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [req.params.id, req.user.id, content, parent_id || null]);

        await logActivity(req.user.id, 'added_comment', 'document', req.params.id, { comment_id: result.rows[0].id }, req.ip);

        res.status(201).json({
            success: true,
            comment: result.rows[0]
        });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// Update comment
router.put('/api/documents/:docId/comments/:commentId', requireAuth, async (req, res) => {
    try {
        const { content } = req.body;

        const result = await db.query(`
            UPDATE document_comments SET content = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND user_id = $3
            RETURNING *
        `, [content, req.params.commentId, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        res.json({
            success: true,
            comment: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating comment:', error);
        res.status(500).json({ error: 'Failed to update comment' });
    }
});

// Delete comment
router.delete('/api/documents/:docId/comments/:commentId', requireAuth, async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM document_comments WHERE id = $1 AND user_id = $2 RETURNING *',
            [req.params.commentId, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        res.json({
            success: true,
            message: 'Comment deleted'
        });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

// =====================================================
// ACTIVITY LOG API
// =====================================================

// Get activity log
router.get('/api/activity', requireAuth, async (req, res) => {
    try {
        const { entity_type, action, limit = 50 } = req.query;

        let query = `
            SELECT al.*, u.first_name, u.last_name
            FROM activity_log al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.user_id = $1
        `;
        const params = [req.user.id];
        let paramIndex = 2;

        if (entity_type && entity_type !== 'all') {
            query += ` AND al.entity_type = $${paramIndex}`;
            params.push(entity_type);
            paramIndex++;
        }

        if (action && action !== 'all') {
            query += ` AND al.action = $${paramIndex}`;
            params.push(action);
            paramIndex++;
        }

        query += ` ORDER BY al.created_at DESC LIMIT $${paramIndex}`;
        params.push(limit);

        const result = await db.query(query, params);

        res.json({
            success: true,
            activities: result.rows
        });
    } catch (error) {
        console.error('Error fetching activity log:', error);
        res.status(500).json({ error: 'Failed to fetch activity log' });
    }
});

// Export logActivity for use in other routes
router.logActivity = logActivity;

module.exports = router;

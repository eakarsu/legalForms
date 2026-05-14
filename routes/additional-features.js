/**
 * Additional Features Routes
 * Handles: E-Signatures, OCR, Discovery, Evidence, Service of Process,
 * Workflows, Call Log, User Settings, Team, Integrations, Subscription
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth');

// =====================================================
// E-SIGNATURES
// =====================================================

// Get e-signature documents
router.get('/api/esignature/documents', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT es.*
            FROM esignature_requests es
            WHERE es.user_id = $1
            ORDER BY es.created_at DESC
            LIMIT 50
        `, [req.user.id]);

        res.json({
            success: true,
            documents: result.rows
        });
    } catch (error) {
        console.error('E-signature documents error:', error);
        res.status(500).json({ error: 'Failed to get e-signature documents' });
    }
});

// =====================================================
// OCR SCANNER
// =====================================================

// Get OCR scanned documents
router.get('/api/ocr/documents', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT od.*
            FROM ocr_documents od
            WHERE od.user_id = $1
            ORDER BY od.created_at DESC
            LIMIT 50
        `, [req.user.id]);

        res.json({
            success: true,
            documents: result.rows
        });
    } catch (error) {
        console.error('OCR documents error:', error);
        res.status(500).json({ error: 'Failed to get OCR documents' });
    }
});

// =====================================================
// DISCOVERY
// =====================================================

// Get discovery items
router.get('/api/discovery', requireAuth, async (req, res) => {
    try {
        const { case_id, type } = req.query;

        let query = `
            SELECT di.*, cs.title as case_title, cs.case_number
            FROM discovery_items di
            LEFT JOIN cases cs ON di.case_id = cs.id
            WHERE di.user_id = $1
        `;
        const params = [req.user.id];

        if (case_id) {
            query += ` AND di.case_id = $${params.length + 1}`;
            params.push(case_id);
        }
        if (type) {
            query += ` AND di.discovery_type = $${params.length + 1}`;
            params.push(type);
        }

        query += ' ORDER BY di.due_date ASC, di.created_at DESC LIMIT 100';

        const result = await db.query(query, params);

        res.json({
            success: true,
            discovery: result.rows
        });
    } catch (error) {
        console.error('Discovery error:', error);
        res.status(500).json({ error: 'Failed to get discovery items' });
    }
});

// =====================================================
// EVIDENCE
// =====================================================

// Get evidence items
router.get('/api/evidence', requireAuth, async (req, res) => {
    try {
        const { case_id, type } = req.query;

        let query = `
            SELECT ev.*
            FROM evidence_items ev
            WHERE ev.user_id = $1
        `;
        const params = [req.user.id];

        if (case_id) {
            query += ` AND ev.case_id = $${params.length + 1}`;
            params.push(case_id);
        }
        if (type) {
            query += ` AND ev.evidence_type = $${params.length + 1}`;
            params.push(type);
        }

        query += ' ORDER BY ev.exhibit_number, ev.created_at DESC LIMIT 100';

        const result = await db.query(query, params);

        res.json({
            success: true,
            evidence: result.rows
        });
    } catch (error) {
        console.error('Evidence error:', error);
        res.status(500).json({ error: 'Failed to get evidence items' });
    }
});

// =====================================================
// SERVICE OF PROCESS
// =====================================================

// Get service of process records
router.get('/api/service-of-process', requireAuth, async (req, res) => {
    try {
        const { case_id, status } = req.query;

        let query = `
            SELECT sop.*, cs.title as case_title, cs.case_number,
                   c.first_name, c.last_name
            FROM service_of_process sop
            LEFT JOIN cases cs ON sop.case_id = cs.id
            LEFT JOIN clients c ON sop.served_party_id = c.id
            WHERE sop.user_id = $1
        `;
        const params = [req.user.id];

        if (case_id) {
            query += ` AND sop.case_id = $${params.length + 1}`;
            params.push(case_id);
        }
        if (status) {
            query += ` AND sop.status = $${params.length + 1}`;
            params.push(status);
        }

        query += ' ORDER BY sop.service_date DESC, sop.created_at DESC LIMIT 100';

        const result = await db.query(query, params);

        res.json({
            success: true,
            serviceRecords: result.rows
        });
    } catch (error) {
        console.error('Service of process error:', error);
        res.status(500).json({ error: 'Failed to get service records' });
    }
});

// =====================================================
// WORKFLOWS
// =====================================================

// Get workflows
router.get('/api/workflows', requireAuth, async (req, res) => {
    try {
        const { status, type } = req.query;

        let query = `
            SELECT w.*,
                   (SELECT COUNT(*) FROM workflow_steps WHERE workflow_id = w.id) as step_count,
                   (SELECT COUNT(*) FROM workflow_steps WHERE workflow_id = w.id AND status = 'completed') as completed_steps
            FROM workflows w
            WHERE w.user_id = $1
        `;
        const params = [req.user.id];

        if (status) {
            query += ` AND w.status = $${params.length + 1}`;
            params.push(status);
        }
        if (type) {
            query += ` AND w.workflow_type = $${params.length + 1}`;
            params.push(type);
        }

        query += ' ORDER BY w.created_at DESC LIMIT 50';

        const result = await db.query(query, params);

        res.json({
            success: true,
            workflows: result.rows
        });
    } catch (error) {
        console.error('Workflows error:', error);
        res.status(500).json({ error: 'Failed to get workflows' });
    }
});

// =====================================================
// CALL LOG
// =====================================================

// Get call log
router.get('/api/calls', requireAuth, async (req, res) => {
    try {
        const { client_id, case_id, type } = req.query;

        let query = `
            SELECT cl.*, c.first_name, c.last_name, c.phone, cs.title as case_title
            FROM call_log cl
            LEFT JOIN clients c ON cl.client_id = c.id
            LEFT JOIN cases cs ON cl.case_id = cs.id
            WHERE cl.user_id = $1
        `;
        const params = [req.user.id];

        if (client_id) {
            query += ` AND cl.client_id = $${params.length + 1}`;
            params.push(client_id);
        }
        if (case_id) {
            query += ` AND cl.case_id = $${params.length + 1}`;
            params.push(case_id);
        }
        if (type) {
            query += ` AND cl.call_type = $${params.length + 1}`;
            params.push(type);
        }

        query += ' ORDER BY cl.call_date DESC, cl.call_time DESC LIMIT 100';

        const result = await db.query(query, params);

        res.json({
            success: true,
            calls: result.rows
        });
    } catch (error) {
        console.error('Call log error:', error);
        res.status(500).json({ error: 'Failed to get call log' });
    }
});

// =====================================================
// USER SETTINGS
// =====================================================

// Get current user settings
router.get('/api/users/me', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT id, email, first_name, last_name, phone, bar_number,
                   practice_areas, firm_name, firm_address,
                   notification_preferences, created_at
            FROM users
            WHERE id = $1
        `, [req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            success: true,
            user: result.rows[0]
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user settings' });
    }
});

// =====================================================
// TEAM
// =====================================================

// Get team members
router.get('/api/team', requireAuth, requireRole('admin', 'attorney'), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT tm.*, u.email, u.first_name, u.last_name
            FROM team_members tm
            LEFT JOIN users u ON tm.member_user_id = u.id
            WHERE tm.owner_user_id = $1
            ORDER BY tm.created_at DESC
        `, [req.user.id]);

        res.json({
            success: true,
            team: result.rows
        });
    } catch (error) {
        console.error('Get team error:', error);
        res.status(500).json({ error: 'Failed to get team' });
    }
});

// =====================================================
// INTEGRATIONS
// =====================================================

// Get integrations
router.get('/api/integrations', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT * FROM user_integrations
            WHERE user_id = $1
            ORDER BY integration_name
        `, [req.user.id]);

        // Available integrations
        const available = [
            { name: 'Google Calendar', type: 'calendar', connected: false },
            { name: 'Microsoft Outlook', type: 'calendar', connected: false },
            { name: 'Dropbox', type: 'storage', connected: false },
            { name: 'Google Drive', type: 'storage', connected: false },
            { name: 'QuickBooks', type: 'accounting', connected: false },
            { name: 'Stripe', type: 'payments', connected: false },
            { name: 'DocuSign', type: 'esignature', connected: false }
        ];

        // Mark connected integrations
        result.rows.forEach(integration => {
            const found = available.find(a => a.name === integration.integration_name);
            if (found) {
                found.connected = integration.is_active;
                found.connectedAt = integration.connected_at;
            }
        });

        res.json({
            success: true,
            integrations: available,
            connected: result.rows
        });
    } catch (error) {
        console.error('Get integrations error:', error);
        res.status(500).json({ error: 'Failed to get integrations' });
    }
});

// =====================================================
// SUBSCRIPTION
// =====================================================

// Get subscription info
router.get('/api/subscription', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT * FROM subscriptions
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 1
        `, [req.user.id]);

        const subscription = result.rows[0] || {
            plan: 'free',
            status: 'active',
            features: ['Basic document generation', 'Up to 10 clients', 'Email support']
        };

        const plans = [
            {
                id: 'free',
                name: 'Free',
                price: 0,
                features: ['Basic document generation', 'Up to 10 clients', 'Email support']
            },
            {
                id: 'professional',
                name: 'Professional',
                price: 49,
                features: ['Unlimited documents', 'Unlimited clients', 'AI drafting', 'Priority support']
            },
            {
                id: 'enterprise',
                name: 'Enterprise',
                price: 149,
                features: ['Everything in Professional', 'Team collaboration', 'API access', 'Dedicated support']
            }
        ];

        res.json({
            success: true,
            subscription: subscription,
            availablePlans: plans
        });
    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({ error: 'Failed to get subscription' });
    }
});

// =====================================================
// DOCUMENT GENERATION
// =====================================================

// Get document generation options/recent generated documents
router.get('/api/documents/generate', requireAuth, async (req, res) => {
    try {
        // Get available templates
        const templatesResult = await db.query(`
            SELECT id, name, category, description, created_at
            FROM templates
            WHERE user_id = $1 AND is_active = true
            ORDER BY category, name
            LIMIT 50
        `, [req.user.id]);

        // Get recent generated documents
        const recentResult = await db.query(`
            SELECT id, title, category, created_at
            FROM documents
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 10
        `, [req.user.id]);

        res.json({
            success: true,
            templates: templatesResult.rows || [],
            recentDocuments: recentResult.rows || [],
            documentTypes: [
                { type: 'contract', label: 'Contracts' },
                { type: 'pleading', label: 'Pleadings' },
                { type: 'letter', label: 'Letters' },
                { type: 'motion', label: 'Motions' },
                { type: 'agreement', label: 'Agreements' }
            ]
        });
    } catch (error) {
        console.error('Document generation error:', error);
        res.status(500).json({ error: 'Failed to get document options' });
    }
});

module.exports = router;

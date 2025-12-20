/**
 * Client Management Routes
 * Handles CRUD operations for clients and client contacts
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Validation rules for clients
const clientValidation = [
    body('client_type').isIn(['individual', 'business']),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().trim()
];

// =====================================================
// PAGE ROUTES
// =====================================================

// Clients list page
router.get('/clients', requireAuth, async (req, res) => {
    try {
        const { status, type, search } = req.query;

        let query = `
            SELECT c.*,
                   COUNT(DISTINCT cs.id) as case_count,
                   COALESCE(SUM(i.total), 0) as total_billed
            FROM clients c
            LEFT JOIN cases cs ON c.id = cs.client_id
            LEFT JOIN invoices i ON c.id = i.client_id
            WHERE c.user_id = $1
        `;
        const params = [req.user.id];
        let paramIndex = 2;

        if (status && status !== 'all') {
            query += ` AND c.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (type && type !== 'all') {
            query += ` AND c.client_type = $${paramIndex}`;
            params.push(type);
            paramIndex++;
        }

        if (search) {
            query += ` AND (
                c.first_name ILIKE $${paramIndex} OR
                c.last_name ILIKE $${paramIndex} OR
                c.company_name ILIKE $${paramIndex} OR
                c.email ILIKE $${paramIndex}
            )`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ` GROUP BY c.id ORDER BY c.created_at DESC`;

        const result = await db.query(query, params);

        res.render('clients/index', {
            title: 'Clients',
            clients: result.rows,
            filters: { status, type, search },
            req
        });
    } catch (error) {
        console.error('Error fetching clients:', error);
        res.status(500).render('error', { message: 'Error loading clients' });
    }
});

// New client form
router.get('/clients/new', requireAuth, (req, res) => {
    res.render('clients/form', {
        title: 'Add New Client',
        client: null,
        errors: [],
        req
    });
});

// Client analytics - MUST be before :id route
router.get('/clients/analytics', requireAuth, async (req, res) => {
    try {
        // Overall stats
        const statsResult = await db.query(`
            SELECT
                COUNT(*) as total_clients,
                COUNT(*) FILTER (WHERE status = 'active') as active_clients,
                COUNT(*) FILTER (WHERE status = 'inactive') as inactive_clients,
                COUNT(*) FILTER (WHERE status = 'archived') as archived_clients,
                COUNT(*) FILTER (WHERE client_type = 'individual') as individuals,
                COUNT(*) FILTER (WHERE client_type = 'business') as businesses,
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_this_month,
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as new_this_week
            FROM clients
            WHERE user_id = $1
        `, [req.user.id]);

        // Revenue by client (top 10)
        const revenueResult = await db.query(`
            SELECT
                c.id, c.first_name, c.last_name, c.company_name, c.client_type,
                COALESCE(SUM(i.total), 0) as total_revenue,
                COUNT(DISTINCT cs.id) as case_count
            FROM clients c
            LEFT JOIN invoices i ON c.id = i.client_id
            LEFT JOIN cases cs ON c.id = cs.client_id
            WHERE c.user_id = $1
            GROUP BY c.id
            ORDER BY total_revenue DESC
            LIMIT 10
        `, [req.user.id]);

        // Client acquisition over time (last 6 months)
        const acquisitionResult = await db.query(`
            SELECT
                TO_CHAR(created_at, 'YYYY-MM') as month,
                COUNT(*) as count
            FROM clients
            WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '6 months'
            GROUP BY TO_CHAR(created_at, 'YYYY-MM')
            ORDER BY month
        `, [req.user.id]);

        // Clients by state
        const stateResult = await db.query(`
            SELECT state, COUNT(*) as count
            FROM clients
            WHERE user_id = $1 AND state IS NOT NULL AND state != ''
            GROUP BY state
            ORDER BY count DESC
            LIMIT 10
        `, [req.user.id]);

        res.render('clients/analytics', {
            title: 'Client Analytics',
            stats: statsResult.rows[0],
            topClients: revenueResult.rows,
            acquisition: acquisitionResult.rows,
            byState: stateResult.rows,
            req
        });
    } catch (error) {
        console.error('Client analytics error:', error);
        res.status(500).render('error', { message: 'Error loading analytics' });
    }
});

// Edit client form
router.get('/clients/:id/edit', requireAuth, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM clients WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).render('error', { message: 'Client not found' });
        }

        res.render('clients/form', {
            title: 'Edit Client',
            client: result.rows[0],
            errors: [],
            req
        });
    } catch (error) {
        console.error('Error fetching client:', error);
        res.status(500).render('error', { message: 'Error loading client' });
    }
});

// Client detail page
router.get('/clients/:id', requireAuth, async (req, res) => {
    try {
        // Get client details
        const clientResult = await db.query(
            'SELECT * FROM clients WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (clientResult.rows.length === 0) {
            return res.status(404).render('error', { message: 'Client not found' });
        }

        const client = clientResult.rows[0];

        // Get client contacts
        const contactsResult = await db.query(
            'SELECT * FROM client_contacts WHERE client_id = $1 ORDER BY is_primary DESC, name',
            [req.params.id]
        );

        // Get client cases
        const casesResult = await db.query(
            'SELECT * FROM cases WHERE client_id = $1 ORDER BY created_at DESC',
            [req.params.id]
        );

        // Get recent invoices
        const invoicesResult = await db.query(
            'SELECT * FROM invoices WHERE client_id = $1 ORDER BY created_at DESC LIMIT 5',
            [req.params.id]
        );

        // Get billing summary
        const billingResult = await db.query(`
            SELECT
                COALESCE(SUM(total), 0) as total_billed,
                COALESCE(SUM(amount_paid), 0) as total_paid,
                COALESCE(SUM(total - amount_paid), 0) as outstanding
            FROM invoices WHERE client_id = $1
        `, [req.params.id]);

        res.render('clients/detail', {
            title: client.client_type === 'business' ? client.company_name : `${client.first_name} ${client.last_name}`,
            client,
            contacts: contactsResult.rows,
            cases: casesResult.rows,
            invoices: invoicesResult.rows,
            billing: billingResult.rows[0],
            req
        });
    } catch (error) {
        console.error('Error fetching client details:', error);
        res.status(500).render('error', { message: 'Error loading client details' });
    }
});

// =====================================================
// API ROUTES
// =====================================================

// List all clients (API)
router.get('/api/clients', requireAuth, async (req, res) => {
    try {
        const { status, type, search, limit = 50, offset = 0 } = req.query;

        let query = 'SELECT * FROM clients WHERE user_id = $1';
        const params = [req.user.id];
        let paramIndex = 2;

        if (status && status !== 'all') {
            query += ` AND status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (type && type !== 'all') {
            query += ` AND client_type = $${paramIndex}`;
            params.push(type);
            paramIndex++;
        }

        if (search) {
            query += ` AND (first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR company_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await db.query(query, params);

        res.json({
            success: true,
            clients: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching clients:', error);
        res.status(500).json({ error: 'Failed to fetch clients' });
    }
});

// Get single client (API)
router.get('/api/clients/:id', requireAuth, async (req, res) => {
    try {
        const clientResult = await db.query(
            'SELECT * FROM clients WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (clientResult.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const contactsResult = await db.query(
            'SELECT * FROM client_contacts WHERE client_id = $1',
            [req.params.id]
        );

        res.json({
            success: true,
            client: clientResult.rows[0],
            contacts: contactsResult.rows
        });
    } catch (error) {
        console.error('Error fetching client:', error);
        res.status(500).json({ error: 'Failed to fetch client' });
    }
});

// Create client (API)
router.post('/api/clients', requireAuth, clientValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            client_type, first_name, last_name, company_name,
            email, phone, address, city, state, zip, notes, tags
        } = req.body;

        const result = await db.query(`
            INSERT INTO clients (
                user_id, client_type, first_name, last_name, company_name,
                email, phone, address, city, state, zip, notes, tags
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        `, [
            req.user.id, client_type, first_name, last_name, company_name,
            email, phone, address, city, state, zip, notes,
            JSON.stringify(tags || [])
        ]);

        res.status(201).json({
            success: true,
            client: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating client:', error);
        res.status(500).json({ error: 'Failed to create client' });
    }
});

// Create client (Form submission)
router.post('/clients', requireAuth, clientValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('clients/form', {
                title: 'Add New Client',
                client: req.body,
                errors: errors.array(),
                req
            });
        }

        const {
            client_type, first_name, last_name, company_name,
            email, phone, address, city, state, zip, notes
        } = req.body;

        await db.query(`
            INSERT INTO clients (
                user_id, client_type, first_name, last_name, company_name,
                email, phone, address, city, state, zip, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
            req.user.id, client_type, first_name, last_name, company_name,
            email, phone, address, city, state, zip, notes
        ]);

        res.redirect('/clients');
    } catch (error) {
        console.error('Error creating client:', error);
        res.render('clients/form', {
            title: 'Add New Client',
            client: req.body,
            errors: [{ msg: 'Failed to create client' }],
            req
        });
    }
});

// Update client (API)
router.put('/api/clients/:id', requireAuth, clientValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            client_type, first_name, last_name, company_name,
            email, phone, address, city, state, zip, notes, tags, status
        } = req.body;

        const result = await db.query(`
            UPDATE clients SET
                client_type = $1, first_name = $2, last_name = $3, company_name = $4,
                email = $5, phone = $6, address = $7, city = $8, state = $9,
                zip = $10, notes = $11, tags = $12, status = $13, updated_at = CURRENT_TIMESTAMP
            WHERE id = $14 AND user_id = $15
            RETURNING *
        `, [
            client_type, first_name, last_name, company_name,
            email, phone, address, city, state, zip, notes,
            JSON.stringify(tags || []), status || 'active',
            req.params.id, req.user.id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        res.json({
            success: true,
            client: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating client:', error);
        res.status(500).json({ error: 'Failed to update client' });
    }
});

// Update client (Form submission)
router.post('/clients/:id', requireAuth, clientValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('clients/form', {
                title: 'Edit Client',
                client: { ...req.body, id: req.params.id },
                errors: errors.array(),
                req
            });
        }

        const {
            client_type, first_name, last_name, company_name,
            email, phone, address, city, state, zip, notes, status
        } = req.body;

        await db.query(`
            UPDATE clients SET
                client_type = $1, first_name = $2, last_name = $3, company_name = $4,
                email = $5, phone = $6, address = $7, city = $8, state = $9,
                zip = $10, notes = $11, status = $12, updated_at = CURRENT_TIMESTAMP
            WHERE id = $13 AND user_id = $14
        `, [
            client_type, first_name, last_name, company_name,
            email, phone, address, city, state, zip, notes, status || 'active',
            req.params.id, req.user.id
        ]);

        res.redirect(`/clients/${req.params.id}`);
    } catch (error) {
        console.error('Error updating client:', error);
        res.render('clients/form', {
            title: 'Edit Client',
            client: { ...req.body, id: req.params.id },
            errors: [{ msg: 'Failed to update client' }],
            req
        });
    }
});

// Delete client (API)
router.delete('/api/clients/:id', requireAuth, async (req, res) => {
    try {
        // Verify client ownership first
        const clientCheck = await db.query(
            'SELECT id FROM clients WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (clientCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        // Delete related data first (foreign key constraints)
        await db.query('DELETE FROM client_contacts WHERE client_id = $1', [req.params.id]);
        await db.query('DELETE FROM client_trust_ledgers WHERE client_id = $1', [req.params.id]);

        // Delete cases related to this client and their dependencies
        const clientCases = await db.query('SELECT id FROM cases WHERE client_id = $1', [req.params.id]);
        for (const c of clientCases.rows) {
            await db.query('DELETE FROM case_notes WHERE case_id = $1', [c.id]);
            await db.query('DELETE FROM case_documents WHERE case_id = $1', [c.id]);
            await db.query('DELETE FROM time_entries WHERE case_id = $1', [c.id]);
            await db.query('DELETE FROM deadlines WHERE case_id = $1', [c.id]);
            await db.query('DELETE FROM calendar_events WHERE case_id = $1', [c.id]);
        }
        await db.query('DELETE FROM cases WHERE client_id = $1', [req.params.id]);

        // Delete invoices and related data
        const clientInvoices = await db.query('SELECT id FROM invoices WHERE client_id = $1', [req.params.id]);
        for (const inv of clientInvoices.rows) {
            await db.query('DELETE FROM invoice_items WHERE invoice_id = $1', [inv.id]);
            await db.query('DELETE FROM payments WHERE invoice_id = $1', [inv.id]);
        }
        await db.query('DELETE FROM invoices WHERE client_id = $1', [req.params.id]);

        // Now delete the client
        await db.query('DELETE FROM clients WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);

        res.json({
            success: true,
            message: 'Client deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting client:', error);
        res.status(500).json({ error: 'Failed to delete client: ' + error.message });
    }
});

// =====================================================
// CLIENT CONTACTS ROUTES
// =====================================================

// Add contact to client
router.post('/api/clients/:id/contacts', requireAuth, async (req, res) => {
    try {
        const { name, role, email, phone, is_primary } = req.body;

        // Verify client ownership
        const clientCheck = await db.query(
            'SELECT id FROM clients WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (clientCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        // If setting as primary, unset other primary contacts
        if (is_primary) {
            await db.query(
                'UPDATE client_contacts SET is_primary = false WHERE client_id = $1',
                [req.params.id]
            );
        }

        const result = await db.query(`
            INSERT INTO client_contacts (client_id, name, role, email, phone, is_primary)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [req.params.id, name, role, email, phone, is_primary || false]);

        res.status(201).json({
            success: true,
            contact: result.rows[0]
        });
    } catch (error) {
        console.error('Error adding contact:', error);
        res.status(500).json({ error: 'Failed to add contact' });
    }
});

// Update contact
router.put('/api/clients/:clientId/contacts/:contactId', requireAuth, async (req, res) => {
    try {
        const { name, role, email, phone, is_primary } = req.body;

        // Verify client ownership
        const clientCheck = await db.query(
            'SELECT id FROM clients WHERE id = $1 AND user_id = $2',
            [req.params.clientId, req.user.id]
        );

        if (clientCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        if (is_primary) {
            await db.query(
                'UPDATE client_contacts SET is_primary = false WHERE client_id = $1',
                [req.params.clientId]
            );
        }

        const result = await db.query(`
            UPDATE client_contacts SET
                name = $1, role = $2, email = $3, phone = $4, is_primary = $5
            WHERE id = $6 AND client_id = $7
            RETURNING *
        `, [name, role, email, phone, is_primary || false, req.params.contactId, req.params.clientId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Contact not found' });
        }

        res.json({
            success: true,
            contact: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating contact:', error);
        res.status(500).json({ error: 'Failed to update contact' });
    }
});

// Delete contact
router.delete('/api/clients/:clientId/contacts/:contactId', requireAuth, async (req, res) => {
    try {
        // Verify client ownership
        const clientCheck = await db.query(
            'SELECT id FROM clients WHERE id = $1 AND user_id = $2',
            [req.params.clientId, req.user.id]
        );

        if (clientCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        await db.query(
            'DELETE FROM client_contacts WHERE id = $1 AND client_id = $2',
            [req.params.contactId, req.params.clientId]
        );

        res.json({
            success: true,
            message: 'Contact deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting contact:', error);
        res.status(500).json({ error: 'Failed to delete contact' });
    }
});

module.exports = router;

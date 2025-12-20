/**
 * Case/Matter Management Routes
 * Handles CRUD operations for cases, case notes, and case documents
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Validation rules
const caseValidation = [
    body('title').trim().isLength({ min: 1 }).withMessage('Title is required'),
    body('case_type').optional().trim(),
    body('billing_rate').optional().isNumeric()
];

// =====================================================
// PAGE ROUTES
// =====================================================

// Cases list/dashboard page
router.get('/cases', requireAuth, async (req, res) => {
    try {
        const { status, type, client_id, search, view = 'list' } = req.query;

        let query = `
            SELECT c.*,
                   cl.first_name as client_first_name,
                   cl.last_name as client_last_name,
                   cl.company_name as client_company,
                   cl.client_type,
                   COUNT(DISTINCT cn.id) as note_count,
                   COUNT(DISTINCT te.id) as time_entry_count,
                   COALESCE(SUM(te.duration_minutes), 0) as total_minutes
            FROM cases c
            LEFT JOIN clients cl ON c.client_id = cl.id
            LEFT JOIN case_notes cn ON c.id = cn.case_id
            LEFT JOIN time_entries te ON c.id = te.case_id
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
            query += ` AND c.case_type = $${paramIndex}`;
            params.push(type);
            paramIndex++;
        }

        if (client_id) {
            query += ` AND c.client_id = $${paramIndex}`;
            params.push(client_id);
            paramIndex++;
        }

        if (search) {
            query += ` AND (c.title ILIKE $${paramIndex} OR c.case_number ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ` GROUP BY c.id, cl.id ORDER BY c.created_at DESC`;

        const casesResult = await db.query(query, params);

        // Get clients for dropdown filter
        const clientsResult = await db.query(
            'SELECT id, first_name, last_name, company_name, client_type FROM clients WHERE user_id = $1 ORDER BY company_name, last_name',
            [req.user.id]
        );

        // Get case statistics
        const statsResult = await db.query(`
            SELECT
                COUNT(*) FILTER (WHERE status = 'open') as open_count,
                COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
                COUNT(*) FILTER (WHERE status = 'closed') as closed_count,
                COUNT(*) as total_count
            FROM cases WHERE user_id = $1
        `, [req.user.id]);

        res.render('cases/index', {
            title: 'Cases',
            cases: casesResult.rows,
            clients: clientsResult.rows,
            stats: statsResult.rows[0],
            filters: { status, type, client_id, search, view },
            req
        });
    } catch (error) {
        console.error('Error fetching cases:', error);
        res.status(500).render('error', { message: 'Error loading cases' });
    }
});

// New case form
router.get('/cases/new', requireAuth, async (req, res) => {
    try {
        const clientsResult = await db.query(
            'SELECT id, first_name, last_name, company_name, client_type FROM clients WHERE user_id = $1 AND status = \'active\' ORDER BY company_name, last_name',
            [req.user.id]
        );

        res.render('cases/form', {
            title: 'New Case',
            caseData: null,
            clients: clientsResult.rows,
            errors: [],
            req
        });
    } catch (error) {
        console.error('Error loading new case form:', error);
        res.status(500).render('error', { message: 'Error loading form' });
    }
});

// Edit case form
router.get('/cases/:id/edit', requireAuth, async (req, res) => {
    try {
        const caseResult = await db.query(
            'SELECT * FROM cases WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (caseResult.rows.length === 0) {
            return res.status(404).render('error', { message: 'Case not found' });
        }

        const clientsResult = await db.query(
            'SELECT id, first_name, last_name, company_name, client_type FROM clients WHERE user_id = $1 ORDER BY company_name, last_name',
            [req.user.id]
        );

        res.render('cases/form', {
            title: 'Edit Case',
            caseData: caseResult.rows[0],
            clients: clientsResult.rows,
            errors: [],
            req
        });
    } catch (error) {
        console.error('Error loading case edit form:', error);
        res.status(500).render('error', { message: 'Error loading form' });
    }
});

// Case detail page
router.get('/cases/:id', requireAuth, async (req, res) => {
    try {
        // Get case details
        const caseResult = await db.query(`
            SELECT c.*,
                   cl.first_name as client_first_name,
                   cl.last_name as client_last_name,
                   cl.company_name as client_company,
                   cl.client_type,
                   cl.email as client_email,
                   cl.phone as client_phone
            FROM cases c
            LEFT JOIN clients cl ON c.client_id = cl.id
            WHERE c.id = $1 AND c.user_id = $2
        `, [req.params.id, req.user.id]);

        if (caseResult.rows.length === 0) {
            return res.status(404).render('error', { message: 'Case not found' });
        }

        const caseData = caseResult.rows[0];

        // Get case notes
        const notesResult = await db.query(`
            SELECT cn.*, u.first_name, u.last_name
            FROM case_notes cn
            LEFT JOIN users u ON cn.user_id = u.id
            WHERE cn.case_id = $1
            ORDER BY cn.created_at DESC
        `, [req.params.id]);

        // Get linked documents
        const documentsResult = await db.query(`
            SELECT dh.*, cd.added_at
            FROM case_documents cd
            JOIN document_history dh ON cd.document_id = dh.id
            WHERE cd.case_id = $1
            ORDER BY cd.added_at DESC
        `, [req.params.id]);

        // Get time entries
        const timeResult = await db.query(`
            SELECT * FROM time_entries
            WHERE case_id = $1
            ORDER BY date DESC
            LIMIT 10
        `, [req.params.id]);

        // Get deadlines
        const deadlinesResult = await db.query(`
            SELECT * FROM deadlines
            WHERE case_id = $1
            ORDER BY due_date ASC
        `, [req.params.id]);

        // Get upcoming events
        const eventsResult = await db.query(`
            SELECT * FROM calendar_events
            WHERE case_id = $1 AND start_time >= NOW()
            ORDER BY start_time ASC
            LIMIT 5
        `, [req.params.id]);

        // Calculate billing summary
        const billingResult = await db.query(`
            SELECT
                COALESCE(SUM(duration_minutes), 0) as total_minutes,
                COALESCE(SUM(amount), 0) as total_amount,
                COALESCE(SUM(CASE WHEN is_billed = false THEN amount ELSE 0 END), 0) as unbilled_amount
            FROM time_entries WHERE case_id = $1
        `, [req.params.id]);

        res.render('cases/detail', {
            title: caseData.title,
            caseData: caseData,
            notes: notesResult.rows,
            documents: documentsResult.rows,
            timeEntries: timeResult.rows,
            deadlines: deadlinesResult.rows,
            events: eventsResult.rows,
            billing: billingResult.rows[0],
            req
        });
    } catch (error) {
        console.error('Error fetching case details:', error);
        res.status(500).render('error', { message: 'Error loading case details' });
    }
});

// =====================================================
// API ROUTES
// =====================================================

// List cases (API)
router.get('/api/cases', requireAuth, async (req, res) => {
    try {
        const { status, type, client_id, search, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT c.*, cl.first_name as client_first_name, cl.last_name as client_last_name,
                   cl.company_name as client_company, cl.client_type
            FROM cases c
            LEFT JOIN clients cl ON c.client_id = cl.id
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
            query += ` AND c.case_type = $${paramIndex}`;
            params.push(type);
            paramIndex++;
        }

        if (client_id) {
            query += ` AND c.client_id = $${paramIndex}`;
            params.push(client_id);
            paramIndex++;
        }

        if (search) {
            query += ` AND (c.title ILIKE $${paramIndex} OR c.case_number ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ` ORDER BY c.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await db.query(query, params);

        res.json({
            success: true,
            cases: result.rows
        });
    } catch (error) {
        console.error('Error fetching cases:', error);
        res.status(500).json({ error: 'Failed to fetch cases' });
    }
});

// Get single case (API)
router.get('/api/cases/:id', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT c.*, cl.first_name as client_first_name, cl.last_name as client_last_name,
                   cl.company_name as client_company
            FROM cases c
            LEFT JOIN clients cl ON c.client_id = cl.id
            WHERE c.id = $1 AND c.user_id = $2
        `, [req.params.id, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        res.json({
            success: true,
            case: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching case:', error);
        res.status(500).json({ error: 'Failed to fetch case' });
    }
});

// Create case (API)
router.post('/api/cases', requireAuth, caseValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            client_id, title, description, case_type, status, priority,
            court_name, court_case_number, judge_name, opposing_party, opposing_counsel,
            date_opened, statute_of_limitations, billing_type, billing_rate, retainer_amount, notes
        } = req.body;

        // Generate case number
        const countResult = await db.query(
            'SELECT COUNT(*) FROM cases WHERE user_id = $1',
            [req.user.id]
        );
        const caseNumber = `CASE-${new Date().getFullYear()}-${String(parseInt(countResult.rows[0].count) + 1).padStart(4, '0')}`;

        const result = await db.query(`
            INSERT INTO cases (
                user_id, client_id, case_number, title, description, case_type, status, priority,
                court_name, court_case_number, judge_name, opposing_party, opposing_counsel,
                date_opened, statute_of_limitations, billing_type, billing_rate, retainer_amount, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            RETURNING *
        `, [
            req.user.id, client_id || null, caseNumber, title, description,
            case_type || 'general', status || 'open', priority || 'medium',
            court_name, court_case_number, judge_name, opposing_party, opposing_counsel,
            date_opened || new Date(), statute_of_limitations,
            billing_type || 'hourly', billing_rate, retainer_amount, notes
        ]);

        res.status(201).json({
            success: true,
            case: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating case:', error);
        res.status(500).json({ error: 'Failed to create case' });
    }
});

// Create case (Form submission)
router.post('/cases', requireAuth, caseValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const clientsResult = await db.query(
                'SELECT id, first_name, last_name, company_name, client_type FROM clients WHERE user_id = $1',
                [req.user.id]
            );
            return res.render('cases/form', {
                title: 'New Case',
                caseData: req.body,
                clients: clientsResult.rows,
                errors: errors.array(),
                req
            });
        }

        const {
            client_id, title, description, case_type, status, priority,
            court_name, court_case_number, judge_name, opposing_party, opposing_counsel,
            date_opened, statute_of_limitations, billing_type, billing_rate, retainer_amount, notes
        } = req.body;

        // Generate case number
        const countResult = await db.query(
            'SELECT COUNT(*) FROM cases WHERE user_id = $1',
            [req.user.id]
        );
        const caseNumber = `CASE-${new Date().getFullYear()}-${String(parseInt(countResult.rows[0].count) + 1).padStart(4, '0')}`;

        const result = await db.query(`
            INSERT INTO cases (
                user_id, client_id, case_number, title, description, case_type, status, priority,
                court_name, court_case_number, judge_name, opposing_party, opposing_counsel,
                date_opened, statute_of_limitations, billing_type, billing_rate, retainer_amount, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            RETURNING id
        `, [
            req.user.id, client_id || null, caseNumber, title, description,
            case_type || 'general', status || 'open', priority || 'medium',
            court_name, court_case_number, judge_name, opposing_party, opposing_counsel,
            date_opened || new Date(), statute_of_limitations || null,
            billing_type || 'hourly', billing_rate || null, retainer_amount || null, notes
        ]);

        res.redirect(`/cases/${result.rows[0].id}`);
    } catch (error) {
        console.error('Error creating case:', error);
        const clientsResult = await db.query(
            'SELECT id, first_name, last_name, company_name, client_type FROM clients WHERE user_id = $1',
            [req.user.id]
        );
        res.render('cases/form', {
            title: 'New Case',
            caseData: req.body,
            clients: clientsResult.rows,
            errors: [{ msg: 'Failed to create case' }],
            req
        });
    }
});

// Update case (API)
router.put('/api/cases/:id', requireAuth, caseValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            client_id, title, description, case_type, status, priority,
            court_name, court_case_number, judge_name, opposing_party, opposing_counsel,
            date_opened, date_closed, statute_of_limitations, billing_type, billing_rate, retainer_amount, notes
        } = req.body;

        const result = await db.query(`
            UPDATE cases SET
                client_id = $1, title = $2, description = $3, case_type = $4, status = $5, priority = $6,
                court_name = $7, court_case_number = $8, judge_name = $9, opposing_party = $10, opposing_counsel = $11,
                date_opened = $12, date_closed = $13, statute_of_limitations = $14,
                billing_type = $15, billing_rate = $16, retainer_amount = $17, notes = $18,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $19 AND user_id = $20
            RETURNING *
        `, [
            client_id, title, description, case_type, status, priority,
            court_name, court_case_number, judge_name, opposing_party, opposing_counsel,
            date_opened, date_closed, statute_of_limitations,
            billing_type, billing_rate, retainer_amount, notes,
            req.params.id, req.user.id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        res.json({
            success: true,
            case: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating case:', error);
        res.status(500).json({ error: 'Failed to update case' });
    }
});

// Update case (Form submission)
router.post('/cases/:id', requireAuth, caseValidation, async (req, res) => {
    try {
        const {
            client_id, title, description, case_type, status, priority,
            court_name, court_case_number, judge_name, opposing_party, opposing_counsel,
            date_opened, date_closed, statute_of_limitations, billing_type, billing_rate, retainer_amount, notes
        } = req.body;

        await db.query(`
            UPDATE cases SET
                client_id = $1, title = $2, description = $3, case_type = $4, status = $5, priority = $6,
                court_name = $7, court_case_number = $8, judge_name = $9, opposing_party = $10, opposing_counsel = $11,
                date_opened = $12, date_closed = $13, statute_of_limitations = $14,
                billing_type = $15, billing_rate = $16, retainer_amount = $17, notes = $18,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $19 AND user_id = $20
        `, [
            client_id || null, title, description, case_type, status, priority,
            court_name, court_case_number, judge_name, opposing_party, opposing_counsel,
            date_opened || null, date_closed || null, statute_of_limitations || null,
            billing_type, billing_rate || null, retainer_amount || null, notes,
            req.params.id, req.user.id
        ]);

        res.redirect(`/cases/${req.params.id}`);
    } catch (error) {
        console.error('Error updating case:', error);
        res.redirect(`/cases/${req.params.id}/edit`);
    }
});

// Delete case (API)
router.delete('/api/cases/:id', requireAuth, async (req, res) => {
    try {
        // Verify case ownership first
        const caseCheck = await db.query(
            'SELECT id FROM cases WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (caseCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        // Delete related data first (foreign key constraints)
        await db.query('DELETE FROM case_notes WHERE case_id = $1', [req.params.id]);
        await db.query('DELETE FROM case_documents WHERE case_id = $1', [req.params.id]);
        await db.query('DELETE FROM time_entries WHERE case_id = $1', [req.params.id]);
        await db.query('DELETE FROM deadlines WHERE case_id = $1', [req.params.id]);
        await db.query('DELETE FROM calendar_events WHERE case_id = $1', [req.params.id]);

        // Now delete the case
        await db.query('DELETE FROM cases WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);

        res.json({
            success: true,
            message: 'Case deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting case:', error);
        res.status(500).json({ error: 'Failed to delete case: ' + error.message });
    }
});

// =====================================================
// CASE NOTES ROUTES
// =====================================================

// Add note to case
router.post('/api/cases/:id/notes', requireAuth, async (req, res) => {
    try {
        const { content, note_type, is_billable } = req.body;

        // Verify case ownership
        const caseCheck = await db.query(
            'SELECT id FROM cases WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (caseCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        const result = await db.query(`
            INSERT INTO case_notes (case_id, user_id, content, note_type, is_billable)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [req.params.id, req.user.id, content, note_type || 'general', is_billable || false]);

        res.status(201).json({
            success: true,
            note: result.rows[0]
        });
    } catch (error) {
        console.error('Error adding note:', error);
        res.status(500).json({ error: 'Failed to add note' });
    }
});

// =====================================================
// CASE DOCUMENTS ROUTES
// =====================================================

// Link document to case
router.post('/api/cases/:id/documents', requireAuth, async (req, res) => {
    try {
        const { document_id } = req.body;

        // Verify case ownership
        const caseCheck = await db.query(
            'SELECT id FROM cases WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (caseCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        const result = await db.query(`
            INSERT INTO case_documents (case_id, document_id)
            VALUES ($1, $2)
            ON CONFLICT (case_id, document_id) DO NOTHING
            RETURNING *
        `, [req.params.id, document_id]);

        res.status(201).json({
            success: true,
            linked: result.rows.length > 0
        });
    } catch (error) {
        console.error('Error linking document:', error);
        res.status(500).json({ error: 'Failed to link document' });
    }
});

// Unlink document from case
router.delete('/api/cases/:caseId/documents/:docId', requireAuth, async (req, res) => {
    try {
        // Verify case ownership
        const caseCheck = await db.query(
            'SELECT id FROM cases WHERE id = $1 AND user_id = $2',
            [req.params.caseId, req.user.id]
        );

        if (caseCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        await db.query(
            'DELETE FROM case_documents WHERE case_id = $1 AND document_id = $2',
            [req.params.caseId, req.params.docId]
        );

        res.json({
            success: true,
            message: 'Document unlinked successfully'
        });
    } catch (error) {
        console.error('Error unlinking document:', error);
        res.status(500).json({ error: 'Failed to unlink document' });
    }
});

module.exports = router;

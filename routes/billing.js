/**
 * Time Tracking & Billing Routes
 * Handles time entries, invoices, payments, and expenses
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// =====================================================
// PAGE ROUTES
// =====================================================

// Billing dashboard
router.get('/billing', requireAuth, async (req, res) => {
    try {
        // Get billing summary
        const summaryResult = await db.query(`
            SELECT
                COALESCE(SUM(CASE WHEN is_billed = false AND is_billable = true THEN amount ELSE 0 END), 0) as unbilled_amount,
                COALESCE(SUM(CASE WHEN is_billed = false AND is_billable = true THEN duration_minutes ELSE 0 END), 0) as unbilled_minutes
            FROM time_entries WHERE user_id = $1
        `, [req.user.id]);

        // Get invoice summary
        const invoiceResult = await db.query(`
            SELECT
                COALESCE(SUM(CASE WHEN status = 'sent' THEN total - amount_paid ELSE 0 END), 0) as outstanding,
                COALESCE(SUM(CASE WHEN status = 'overdue' THEN total - amount_paid ELSE 0 END), 0) as overdue,
                COALESCE(SUM(CASE WHEN status = 'paid' AND paid_date >= DATE_TRUNC('month', CURRENT_DATE) THEN amount_paid ELSE 0 END), 0) as collected_this_month
            FROM invoices WHERE user_id = $1
        `, [req.user.id]);

        // Get recent time entries
        const recentTimeResult = await db.query(`
            SELECT te.*, c.title as case_title, cl.first_name, cl.last_name, cl.company_name
            FROM time_entries te
            LEFT JOIN cases c ON te.case_id = c.id
            LEFT JOIN clients cl ON te.client_id = cl.id
            WHERE te.user_id = $1
            ORDER BY te.date DESC, te.created_at DESC
            LIMIT 10
        `, [req.user.id]);

        // Get recent invoices
        const recentInvoicesResult = await db.query(`
            SELECT i.*, cl.first_name, cl.last_name, cl.company_name
            FROM invoices i
            LEFT JOIN clients cl ON i.client_id = cl.id
            WHERE i.user_id = $1
            ORDER BY i.created_at DESC
            LIMIT 10
        `, [req.user.id]);

        res.render('billing/dashboard', {
            title: 'Billing Dashboard',
            summary: summaryResult.rows[0],
            invoiceSummary: invoiceResult.rows[0],
            recentTime: recentTimeResult.rows,
            recentInvoices: recentInvoicesResult.rows,
            req
        });
    } catch (error) {
        console.error('Error loading billing dashboard:', error);
        res.status(500).render('error', { message: 'Error loading billing dashboard' });
    }
});

// Time tracking page
router.get('/billing/time', requireAuth, async (req, res) => {
    try {
        const { case_id, client_id, date_from, date_to, is_billed } = req.query;

        let query = `
            SELECT te.*, c.title as case_title, c.case_number,
                   cl.first_name, cl.last_name, cl.company_name, cl.client_type
            FROM time_entries te
            LEFT JOIN cases c ON te.case_id = c.id
            LEFT JOIN clients cl ON te.client_id = cl.id
            WHERE te.user_id = $1
        `;
        const params = [req.user.id];
        let paramIndex = 2;

        if (case_id) {
            query += ` AND te.case_id = $${paramIndex}`;
            params.push(case_id);
            paramIndex++;
        }

        if (client_id) {
            query += ` AND te.client_id = $${paramIndex}`;
            params.push(client_id);
            paramIndex++;
        }

        if (date_from) {
            query += ` AND te.date >= $${paramIndex}`;
            params.push(date_from);
            paramIndex++;
        }

        if (date_to) {
            query += ` AND te.date <= $${paramIndex}`;
            params.push(date_to);
            paramIndex++;
        }

        if (is_billed !== undefined && is_billed !== 'all') {
            query += ` AND te.is_billed = $${paramIndex}`;
            params.push(is_billed === 'true');
            paramIndex++;
        }

        query += ' ORDER BY te.date DESC, te.created_at DESC';

        const timeResult = await db.query(query, params);

        // Get cases and clients for dropdowns
        const casesResult = await db.query(
            'SELECT id, title, case_number FROM cases WHERE user_id = $1 AND status != \'archived\' ORDER BY title',
            [req.user.id]
        );

        const clientsResult = await db.query(
            'SELECT id, first_name, last_name, company_name, client_type FROM clients WHERE user_id = $1 AND status = \'active\' ORDER BY company_name, last_name',
            [req.user.id]
        );

        res.render('billing/time', {
            title: 'Time Tracking',
            timeEntries: timeResult.rows,
            cases: casesResult.rows,
            clients: clientsResult.rows,
            filters: { case_id, client_id, date_from, date_to, is_billed },
            req
        });
    } catch (error) {
        console.error('Error loading time tracking:', error);
        res.status(500).render('error', { message: 'Error loading time tracking' });
    }
});

// Invoices list page
router.get('/billing/invoices', requireAuth, async (req, res) => {
    try {
        const { status, client_id } = req.query;

        let query = `
            SELECT i.*, cl.first_name, cl.last_name, cl.company_name, cl.client_type,
                   c.title as case_title
            FROM invoices i
            LEFT JOIN clients cl ON i.client_id = cl.id
            LEFT JOIN cases c ON i.case_id = c.id
            WHERE i.user_id = $1
        `;
        const params = [req.user.id];
        let paramIndex = 2;

        if (status && status !== 'all') {
            query += ` AND i.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (client_id) {
            query += ` AND i.client_id = $${paramIndex}`;
            params.push(client_id);
            paramIndex++;
        }

        query += ' ORDER BY i.created_at DESC';

        const invoicesResult = await db.query(query, params);

        // Get clients for dropdown
        const clientsResult = await db.query(
            'SELECT id, first_name, last_name, company_name, client_type FROM clients WHERE user_id = $1 ORDER BY company_name, last_name',
            [req.user.id]
        );

        // Get invoice stats
        const statsResult = await db.query(`
            SELECT
                COUNT(*) FILTER (WHERE status = 'draft') as draft_count,
                COUNT(*) FILTER (WHERE status = 'sent') as sent_count,
                COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
                COUNT(*) FILTER (WHERE status = 'overdue') as overdue_count
            FROM invoices WHERE user_id = $1
        `, [req.user.id]);

        res.render('billing/invoices', {
            title: 'Invoices',
            invoices: invoicesResult.rows,
            clients: clientsResult.rows,
            stats: statsResult.rows[0],
            filters: { status, client_id },
            req
        });
    } catch (error) {
        console.error('Error loading invoices:', error);
        res.status(500).render('error', { message: 'Error loading invoices' });
    }
});

// Invoice detail page
router.get('/billing/invoices/:id', requireAuth, async (req, res) => {
    try {
        // Get invoice
        const invoiceResult = await db.query(`
            SELECT i.*, cl.first_name, cl.last_name, cl.company_name, cl.client_type,
                   cl.email as client_email, cl.address as client_address,
                   cl.city as client_city, cl.state as client_state, cl.zip as client_zip,
                   c.title as case_title, c.case_number
            FROM invoices i
            LEFT JOIN clients cl ON i.client_id = cl.id
            LEFT JOIN cases c ON i.case_id = c.id
            WHERE i.id = $1 AND i.user_id = $2
        `, [req.params.id, req.user.id]);

        if (invoiceResult.rows.length === 0) {
            return res.status(404).render('error', { message: 'Invoice not found' });
        }

        // Get invoice items
        const itemsResult = await db.query(`
            SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY created_at
        `, [req.params.id]);

        // Get payments
        const paymentsResult = await db.query(`
            SELECT * FROM payments WHERE invoice_id = $1 ORDER BY payment_date DESC
        `, [req.params.id]);

        res.render('billing/invoice-detail', {
            title: `Invoice ${invoiceResult.rows[0].invoice_number}`,
            invoice: invoiceResult.rows[0],
            items: itemsResult.rows,
            payments: paymentsResult.rows,
            req
        });
    } catch (error) {
        console.error('Error loading invoice:', error);
        res.status(500).render('error', { message: 'Error loading invoice' });
    }
});

// Expenses page
router.get('/billing/expenses', requireAuth, async (req, res) => {
    try {
        const { case_id, category, is_billed } = req.query;

        let query = `
            SELECT e.*, c.title as case_title, cl.first_name, cl.last_name, cl.company_name
            FROM expenses e
            LEFT JOIN cases c ON e.case_id = c.id
            LEFT JOIN clients cl ON e.client_id = cl.id
            WHERE e.user_id = $1
        `;
        const params = [req.user.id];
        let paramIndex = 2;

        if (case_id) {
            query += ` AND e.case_id = $${paramIndex}`;
            params.push(case_id);
            paramIndex++;
        }

        if (category && category !== 'all') {
            query += ` AND e.category = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }

        if (is_billed !== undefined && is_billed !== 'all') {
            query += ` AND e.is_billed = $${paramIndex}`;
            params.push(is_billed === 'true');
        }

        query += ' ORDER BY e.expense_date DESC';

        const expensesResult = await db.query(query, params);

        const casesResult = await db.query(
            'SELECT id, title, case_number FROM cases WHERE user_id = $1 AND status != \'archived\' ORDER BY title',
            [req.user.id]
        );

        res.render('billing/expenses', {
            title: 'Expenses',
            expenses: expensesResult.rows,
            cases: casesResult.rows,
            filters: { case_id, category, is_billed },
            req
        });
    } catch (error) {
        console.error('Error loading expenses:', error);
        res.status(500).render('error', { message: 'Error loading expenses' });
    }
});

// =====================================================
// TIME ENTRIES API
// =====================================================

// List time entries
router.get('/api/time-entries', requireAuth, async (req, res) => {
    try {
        const { case_id, client_id, date_from, date_to, is_billed, limit = 100 } = req.query;

        let query = `
            SELECT te.*, c.title as case_title, cl.first_name, cl.last_name, cl.company_name
            FROM time_entries te
            LEFT JOIN cases c ON te.case_id = c.id
            LEFT JOIN clients cl ON te.client_id = cl.id
            WHERE te.user_id = $1
        `;
        const params = [req.user.id];
        let paramIndex = 2;

        if (case_id) {
            query += ` AND te.case_id = $${paramIndex}`;
            params.push(case_id);
            paramIndex++;
        }

        if (client_id) {
            query += ` AND te.client_id = $${paramIndex}`;
            params.push(client_id);
            paramIndex++;
        }

        if (date_from) {
            query += ` AND te.date >= $${paramIndex}`;
            params.push(date_from);
            paramIndex++;
        }

        if (date_to) {
            query += ` AND te.date <= $${paramIndex}`;
            params.push(date_to);
            paramIndex++;
        }

        if (is_billed !== undefined) {
            query += ` AND te.is_billed = $${paramIndex}`;
            params.push(is_billed === 'true');
            paramIndex++;
        }

        query += ` ORDER BY te.date DESC LIMIT $${paramIndex}`;
        params.push(limit);

        const result = await db.query(query, params);

        res.json({
            success: true,
            timeEntries: result.rows
        });
    } catch (error) {
        console.error('Error fetching time entries:', error);
        res.status(500).json({ error: 'Failed to fetch time entries' });
    }
});

// Create time entry
router.post('/api/time-entries', requireAuth, async (req, res) => {
    try {
        const {
            case_id, client_id, description, duration_minutes,
            hourly_rate, date, is_billable, activity_type
        } = req.body;

        // Calculate amount
        const rate = hourly_rate || 0;
        const amount = (duration_minutes / 60 * rate).toFixed(2);

        // Get client_id from case if not provided
        let finalClientId = client_id;
        if (!finalClientId && case_id) {
            const caseResult = await db.query('SELECT client_id FROM cases WHERE id = $1', [case_id]);
            if (caseResult.rows.length > 0) {
                finalClientId = caseResult.rows[0].client_id;
            }
        }

        const result = await db.query(`
            INSERT INTO time_entries (
                user_id, case_id, client_id, description, duration_minutes,
                hourly_rate, amount, date, is_billable, activity_type
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, [
            req.user.id, case_id || null, finalClientId || null, description, duration_minutes,
            rate, amount, date || new Date(), is_billable !== false, activity_type
        ]);

        res.status(201).json({
            success: true,
            timeEntry: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating time entry:', error);
        res.status(500).json({ error: 'Failed to create time entry' });
    }
});

// Update time entry
router.put('/api/time-entries/:id', requireAuth, async (req, res) => {
    try {
        const {
            case_id, client_id, description, duration_minutes,
            hourly_rate, date, is_billable, activity_type
        } = req.body;

        const rate = hourly_rate || 0;
        const amount = (duration_minutes / 60 * rate).toFixed(2);

        const result = await db.query(`
            UPDATE time_entries SET
                case_id = $1, client_id = $2, description = $3, duration_minutes = $4,
                hourly_rate = $5, amount = $6, date = $7, is_billable = $8, activity_type = $9,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $10 AND user_id = $11
            RETURNING *
        `, [
            case_id, client_id, description, duration_minutes,
            rate, amount, date, is_billable, activity_type,
            req.params.id, req.user.id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Time entry not found' });
        }

        res.json({
            success: true,
            timeEntry: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating time entry:', error);
        res.status(500).json({ error: 'Failed to update time entry' });
    }
});

// Get single time entry
router.get('/api/time-entries/:id', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT te.*, c.title as case_title, c.case_number,
                   cl.first_name, cl.last_name, cl.company_name
            FROM time_entries te
            LEFT JOIN cases c ON te.case_id = c.id
            LEFT JOIN clients cl ON te.client_id = cl.id
            WHERE te.id = $1 AND te.user_id = $2
        `, [req.params.id, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Time entry not found' });
        }

        res.json({ entry: result.rows[0] });
    } catch (error) {
        console.error('Error fetching time entry:', error);
        res.status(500).json({ error: 'Failed to fetch time entry' });
    }
});

// Delete time entry
router.delete('/api/time-entries/:id', requireAuth, async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM time_entries WHERE id = $1 AND user_id = $2 AND is_billed = false RETURNING *',
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Time entry not found or already billed' });
        }

        res.json({
            success: true,
            message: 'Time entry deleted'
        });
    } catch (error) {
        console.error('Error deleting time entry:', error);
        res.status(500).json({ error: 'Failed to delete time entry' });
    }
});

// =====================================================
// INVOICES API
// =====================================================

// List invoices
router.get('/api/invoices', requireAuth, async (req, res) => {
    try {
        const { status, client_id, limit = 50 } = req.query;

        let query = `
            SELECT i.*, cl.first_name, cl.last_name, cl.company_name
            FROM invoices i
            LEFT JOIN clients cl ON i.client_id = cl.id
            WHERE i.user_id = $1
        `;
        const params = [req.user.id];
        let paramIndex = 2;

        if (status && status !== 'all') {
            query += ` AND i.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (client_id) {
            query += ` AND i.client_id = $${paramIndex}`;
            params.push(client_id);
            paramIndex++;
        }

        query += ` ORDER BY i.created_at DESC LIMIT $${paramIndex}`;
        params.push(limit);

        const result = await db.query(query, params);

        res.json({
            success: true,
            invoices: result.rows
        });
    } catch (error) {
        console.error('Error fetching invoices:', error);
        res.status(500).json({ error: 'Failed to fetch invoices' });
    }
});

// Create invoice
router.post('/api/invoices', requireAuth, async (req, res) => {
    try {
        const { client_id, case_id, due_date, notes, items } = req.body;

        // Generate invoice number
        const countResult = await db.query(
            'SELECT COUNT(*) FROM invoices WHERE user_id = $1',
            [req.user.id]
        );
        const invoiceNumber = `INV-${new Date().getFullYear()}-${String(parseInt(countResult.rows[0].count) + 1).padStart(4, '0')}`;

        // Calculate totals
        let subtotal = 0;
        if (items && items.length > 0) {
            subtotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
        }
        const taxRate = 0;
        const taxAmount = subtotal * taxRate / 100;
        const total = subtotal + taxAmount;

        // Create invoice
        const invoiceResult = await db.query(`
            INSERT INTO invoices (
                user_id, client_id, case_id, invoice_number, status,
                subtotal, tax_rate, tax_amount, total, due_date, notes
            )
            VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, [
            req.user.id, client_id, case_id || null, invoiceNumber,
            subtotal, taxRate, taxAmount, total, due_date, notes
        ]);

        const invoice = invoiceResult.rows[0];

        // Create invoice items
        if (items && items.length > 0) {
            for (const item of items) {
                await db.query(`
                    INSERT INTO invoice_items (invoice_id, time_entry_id, description, quantity, rate, amount, item_type)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [
                    invoice.id, item.time_entry_id || null, item.description,
                    item.quantity, item.rate, item.quantity * item.rate, item.item_type || 'service'
                ]);

                // Mark time entry as billed
                if (item.time_entry_id) {
                    await db.query(
                        'UPDATE time_entries SET is_billed = true, invoice_id = $1 WHERE id = $2',
                        [invoice.id, item.time_entry_id]
                    );
                }
            }
        }

        res.status(201).json({
            success: true,
            invoice
        });
    } catch (error) {
        console.error('Error creating invoice:', error);
        res.status(500).json({ error: 'Failed to create invoice' });
    }
});

// Update invoice
router.put('/api/invoices/:id', requireAuth, async (req, res) => {
    try {
        const { status, due_date, notes } = req.body;

        const result = await db.query(`
            UPDATE invoices SET
                status = COALESCE($1, status),
                due_date = COALESCE($2, due_date),
                notes = COALESCE($3, notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4 AND user_id = $5
            RETURNING *
        `, [status, due_date, notes, req.params.id, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        res.json({
            success: true,
            invoice: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating invoice:', error);
        res.status(500).json({ error: 'Failed to update invoice' });
    }
});

// Delete invoice (only draft or cancelled)
router.delete('/api/invoices/:id', requireAuth, async (req, res) => {
    try {
        // First delete related invoice items and payments
        await db.query('DELETE FROM invoice_items WHERE invoice_id = $1', [req.params.id]);
        await db.query('DELETE FROM payments WHERE invoice_id = $1', [req.params.id]);

        const result = await db.query(
            `DELETE FROM invoices WHERE id = $1 AND user_id = $2 AND status IN ('draft', 'cancelled') RETURNING *`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found or cannot be deleted (only draft/cancelled invoices can be deleted)' });
        }

        res.json({
            success: true,
            message: 'Invoice deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting invoice:', error);
        res.status(500).json({ error: 'Failed to delete invoice' });
    }
});

// Send invoice
router.post('/api/invoices/:id/send', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            UPDATE invoices SET
                status = 'sent',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND user_id = $2 AND status = 'draft'
            RETURNING *
        `, [req.params.id, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found or already sent' });
        }

        // TODO: Send email notification to client

        res.json({
            success: true,
            invoice: result.rows[0],
            message: 'Invoice sent successfully'
        });
    } catch (error) {
        console.error('Error sending invoice:', error);
        res.status(500).json({ error: 'Failed to send invoice' });
    }
});

// Record payment
router.post('/api/invoices/:id/payments', requireAuth, async (req, res) => {
    try {
        const { amount, payment_method, reference_number, payment_date, notes } = req.body;

        // Verify invoice ownership
        const invoiceCheck = await db.query(
            'SELECT * FROM invoices WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (invoiceCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        const invoice = invoiceCheck.rows[0];

        // Create payment
        const paymentResult = await db.query(`
            INSERT INTO payments (invoice_id, amount, payment_method, reference_number, payment_date, notes)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [req.params.id, amount, payment_method, reference_number, payment_date || new Date(), notes]);

        // Update invoice amount paid
        const newAmountPaid = parseFloat(invoice.amount_paid) + parseFloat(amount);
        const newStatus = newAmountPaid >= parseFloat(invoice.total) ? 'paid' : invoice.status;

        await db.query(`
            UPDATE invoices SET
                amount_paid = $1,
                status = $2::varchar,
                paid_date = CASE WHEN $2::varchar = 'paid' THEN CURRENT_DATE ELSE paid_date END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
        `, [newAmountPaid, newStatus, req.params.id]);

        res.status(201).json({
            success: true,
            payment: paymentResult.rows[0],
            invoiceStatus: newStatus
        });
    } catch (error) {
        console.error('Error recording payment:', error);
        res.status(500).json({ error: 'Failed to record payment' });
    }
});

// =====================================================
// EXPENSES API
// =====================================================

// List expenses
router.get('/api/expenses', requireAuth, async (req, res) => {
    try {
        const { case_id, category, is_billed, limit = 100 } = req.query;

        let query = `
            SELECT e.*, c.title as case_title, cl.first_name, cl.last_name, cl.company_name
            FROM expenses e
            LEFT JOIN cases c ON e.case_id = c.id
            LEFT JOIN clients cl ON e.client_id = cl.id
            WHERE e.user_id = $1
        `;
        const params = [req.user.id];
        let paramIndex = 2;

        if (case_id) {
            query += ` AND e.case_id = $${paramIndex}`;
            params.push(case_id);
            paramIndex++;
        }

        if (category && category !== 'all') {
            query += ` AND e.category = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }

        if (is_billed !== undefined) {
            query += ` AND e.is_billed = $${paramIndex}`;
            params.push(is_billed === 'true');
            paramIndex++;
        }

        query += ` ORDER BY e.expense_date DESC LIMIT $${paramIndex}`;
        params.push(limit);

        const result = await db.query(query, params);

        res.json({
            success: true,
            expenses: result.rows
        });
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ error: 'Failed to fetch expenses' });
    }
});

// Create expense
router.post('/api/expenses', requireAuth, async (req, res) => {
    try {
        const {
            case_id, client_id, description, amount, expense_date,
            category, is_billable, vendor
        } = req.body;

        // Get client_id from case if not provided
        let finalClientId = client_id;
        if (!finalClientId && case_id) {
            const caseResult = await db.query('SELECT client_id FROM cases WHERE id = $1', [case_id]);
            if (caseResult.rows.length > 0) {
                finalClientId = caseResult.rows[0].client_id;
            }
        }

        const result = await db.query(`
            INSERT INTO expenses (
                user_id, case_id, client_id, description, amount, expense_date,
                category, is_billable, vendor
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [
            req.user.id, case_id || null, finalClientId || null, description, amount,
            expense_date || new Date(), category, is_billable !== false, vendor
        ]);

        res.status(201).json({
            success: true,
            expense: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating expense:', error);
        res.status(500).json({ error: 'Failed to create expense' });
    }
});

// Update expense
router.put('/api/expenses/:id', requireAuth, async (req, res) => {
    try {
        const {
            case_id, client_id, description, amount, expense_date,
            category, is_billable, vendor
        } = req.body;

        const result = await db.query(`
            UPDATE expenses SET
                case_id = $1, client_id = $2, description = $3, amount = $4,
                expense_date = $5, category = $6, is_billable = $7, vendor = $8
            WHERE id = $9 AND user_id = $10 AND is_billed = false
            RETURNING *
        `, [
            case_id, client_id, description, amount, expense_date,
            category, is_billable, vendor, req.params.id, req.user.id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Expense not found or already billed' });
        }

        res.json({
            success: true,
            expense: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating expense:', error);
        res.status(500).json({ error: 'Failed to update expense' });
    }
});

// Get single expense
router.get('/api/expenses/:id', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT e.*, c.title as case_title, cl.first_name, cl.last_name, cl.company_name
            FROM expenses e
            LEFT JOIN cases c ON e.case_id = c.id
            LEFT JOIN clients cl ON e.client_id = cl.id
            WHERE e.id = $1 AND e.user_id = $2
        `, [req.params.id, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        res.json({ expense: result.rows[0] });
    } catch (error) {
        console.error('Error fetching expense:', error);
        res.status(500).json({ error: 'Failed to fetch expense' });
    }
});

// Delete expense
router.delete('/api/expenses/:id', requireAuth, async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM expenses WHERE id = $1 AND user_id = $2 AND is_billed = false RETURNING *',
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Expense not found or already billed' });
        }

        res.json({
            success: true,
            message: 'Expense deleted'
        });
    } catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({ error: 'Failed to delete expense' });
    }
});

module.exports = router;

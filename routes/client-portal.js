/**
 * Client Portal Routes
 * Handles client-facing portal for viewing cases, documents, invoices
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');

// Middleware to check client portal authentication
const requirePortalAuth = async (req, res, next) => {
    if (!req.session.portalClientId) {
        return res.redirect('/portal/login');
    }

    try {
        const result = await db.query(`
            SELECT cpa.*, c.first_name, c.last_name, c.company_name, c.email as client_email,
                   c.user_id as attorney_user_id
            FROM client_portal_access cpa
            JOIN clients c ON cpa.client_id = c.id
            WHERE cpa.client_id = $1 AND cpa.is_active = true
        `, [req.session.portalClientId]);

        if (result.rows.length === 0) {
            req.session.destroy();
            return res.redirect('/portal/login');
        }

        req.portalClient = result.rows[0];
        next();
    } catch (error) {
        console.error('Portal auth error:', error);
        res.redirect('/portal/login');
    }
};

// Log portal activity
const logActivity = async (clientId, action, details, ipAddress) => {
    try {
        await db.query(`
            INSERT INTO client_portal_activity (client_id, action, details, ip_address)
            VALUES ($1, $2, $3, $4)
        `, [clientId, action, JSON.stringify(details), ipAddress]);
    } catch (error) {
        console.error('Activity log error:', error);
    }
};

// =====================================================
// PUBLIC ROUTES (No Auth Required)
// =====================================================

// Portal login page
router.get('/portal/login', (req, res) => {
    if (req.session.portalClientId) {
        return res.redirect('/portal/dashboard');
    }
    res.render('portal/login', {
        title: 'Client Portal Login',
        error: req.query.error,
        success: req.query.success
    });
});

// Portal login handler
router.post('/portal/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('portal/login', {
            title: 'Client Portal Login',
            error: 'Please enter valid email and password'
        });
    }

    const { email, password } = req.body;

    try {
        const result = await db.query(`
            SELECT cpa.*, c.id as client_id, c.first_name, c.last_name
            FROM client_portal_access cpa
            JOIN clients c ON cpa.client_id = c.id
            WHERE cpa.email = $1 AND cpa.is_active = true
        `, [email]);

        if (result.rows.length === 0) {
            await logActivity(null, 'login_failed', { email, reason: 'not_found' }, req.ip);
            return res.render('portal/login', {
                title: 'Client Portal Login',
                error: 'Invalid email or password'
            });
        }

        const portalAccess = result.rows[0];

        // Check if account is locked
        if (portalAccess.locked_until && new Date(portalAccess.locked_until) > new Date()) {
            return res.render('portal/login', {
                title: 'Client Portal Login',
                error: 'Account temporarily locked. Please try again later.'
            });
        }

        const validPassword = await bcrypt.compare(password, portalAccess.password_hash);

        if (!validPassword) {
            // Increment failed attempts
            const failedAttempts = (portalAccess.failed_login_attempts || 0) + 1;
            const lockUntil = failedAttempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000) : null;

            await db.query(`
                UPDATE client_portal_access
                SET failed_login_attempts = $1, locked_until = $2
                WHERE id = $3
            `, [failedAttempts, lockUntil, portalAccess.id]);

            await logActivity(portalAccess.client_id, 'login_failed', { reason: 'invalid_password' }, req.ip);

            return res.render('portal/login', {
                title: 'Client Portal Login',
                error: 'Invalid email or password'
            });
        }

        // Successful login
        await db.query(`
            UPDATE client_portal_access
            SET last_login = CURRENT_TIMESTAMP, failed_login_attempts = 0, locked_until = NULL
            WHERE id = $1
        `, [portalAccess.id]);

        req.session.portalClientId = portalAccess.client_id;
        req.session.portalAccessId = portalAccess.id;

        await logActivity(portalAccess.client_id, 'login_success', {}, req.ip);

        res.redirect('/portal/dashboard');

    } catch (error) {
        console.error('Portal login error:', error);
        res.render('portal/login', {
            title: 'Client Portal Login',
            error: 'An error occurred. Please try again.'
        });
    }
});

// Portal logout
router.get('/portal/logout', (req, res) => {
    if (req.session.portalClientId) {
        logActivity(req.session.portalClientId, 'logout', {}, req.ip);
    }
    req.session.destroy();
    res.redirect('/portal/login?success=logged_out');
});

// =====================================================
// PROTECTED ROUTES (Portal Auth Required)
// =====================================================

// Portal dashboard
router.get('/portal/dashboard', requirePortalAuth, async (req, res) => {
    try {
        const clientId = req.portalClient.client_id;

        // Get recent cases
        const casesResult = await db.query(`
            SELECT id, case_number, title, status, case_type, date_opened
            FROM cases
            WHERE client_id = $1
            ORDER BY updated_at DESC
            LIMIT 5
        `, [clientId]);

        // Get unpaid invoices
        const invoicesResult = await db.query(`
            SELECT id, invoice_number, total, amount_paid, due_date, status
            FROM invoices
            WHERE client_id = $1 AND status IN ('sent', 'overdue')
            ORDER BY due_date ASC
            LIMIT 5
        `, [clientId]);

        // Get upcoming events
        const eventsResult = await db.query(`
            SELECT id, title, start_time, event_type, location
            FROM calendar_events
            WHERE client_id = $1 AND start_time >= NOW()
            ORDER BY start_time ASC
            LIMIT 5
        `, [clientId]);

        // Get recent documents
        const documentsResult = await db.query(`
            SELECT dh.id, dh.title, dh.document_type, dh.created_at, cda.access_type
            FROM client_document_access cda
            JOIN document_history dh ON cda.document_id = dh.id
            WHERE cda.client_id = $1 AND (cda.expires_at IS NULL OR cda.expires_at > NOW())
            ORDER BY cda.granted_at DESC
            LIMIT 5
        `, [clientId]);

        // Get outstanding balance
        const balanceResult = await db.query(`
            SELECT COALESCE(SUM(total - amount_paid), 0) as outstanding_balance
            FROM invoices
            WHERE client_id = $1 AND status IN ('sent', 'overdue')
        `, [clientId]);

        await logActivity(clientId, 'viewed_dashboard', {}, req.ip);

        res.render('portal/dashboard', {
            title: 'Client Portal Dashboard',
            client: req.portalClient,
            cases: casesResult.rows,
            invoices: invoicesResult.rows,
            events: eventsResult.rows,
            documents: documentsResult.rows,
            outstandingBalance: balanceResult.rows[0].outstanding_balance
        });

    } catch (error) {
        console.error('Portal dashboard error:', error);
        res.status(500).render('error', { message: 'Error loading dashboard' });
    }
});

// View all cases
router.get('/portal/cases', requirePortalAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT id, case_number, title, status, case_type, priority,
                   date_opened, date_closed, court_name, description
            FROM cases
            WHERE client_id = $1
            ORDER BY
                CASE WHEN status = 'open' THEN 1 WHEN status = 'pending' THEN 2 ELSE 3 END,
                updated_at DESC
        `, [req.portalClient.client_id]);

        await logActivity(req.portalClient.client_id, 'viewed_cases_list', {}, req.ip);

        res.render('portal/cases', {
            title: 'My Cases',
            client: req.portalClient,
            cases: result.rows
        });
    } catch (error) {
        console.error('Portal cases error:', error);
        res.status(500).render('error', { message: 'Error loading cases' });
    }
});

// View single case detail
router.get('/portal/cases/:id', requirePortalAuth, async (req, res) => {
    try {
        const caseResult = await db.query(`
            SELECT * FROM cases
            WHERE id = $1 AND client_id = $2
        `, [req.params.id, req.portalClient.client_id]);

        if (caseResult.rows.length === 0) {
            return res.status(404).render('error', { message: 'Case not found' });
        }

        // Get case documents
        const documentsResult = await db.query(`
            SELECT dh.id, dh.title, dh.document_type, dh.created_at, cda.access_type
            FROM case_documents cd
            JOIN document_history dh ON cd.document_id = dh.id
            JOIN client_document_access cda ON dh.id = cda.document_id AND cda.client_id = $2
            WHERE cd.case_id = $1
            ORDER BY dh.created_at DESC
        `, [req.params.id, req.portalClient.client_id]);

        // Get case events
        const eventsResult = await db.query(`
            SELECT id, title, start_time, end_time, event_type, location, status
            FROM calendar_events
            WHERE case_id = $1 AND client_id = $2
            ORDER BY start_time DESC
        `, [req.params.id, req.portalClient.client_id]);

        // Get case deadlines
        const deadlinesResult = await db.query(`
            SELECT id, title, due_date, deadline_type, status, is_critical
            FROM deadlines
            WHERE case_id = $1
            ORDER BY due_date ASC
        `, [req.params.id]);

        await logActivity(req.portalClient.client_id, 'viewed_case_detail', { case_id: req.params.id }, req.ip);

        res.render('portal/case-detail', {
            title: caseResult.rows[0].title,
            client: req.portalClient,
            case: caseResult.rows[0],
            documents: documentsResult.rows,
            events: eventsResult.rows,
            deadlines: deadlinesResult.rows
        });
    } catch (error) {
        console.error('Portal case detail error:', error);
        res.status(500).render('error', { message: 'Error loading case details' });
    }
});

// View all documents
router.get('/portal/documents', requirePortalAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT dh.id, dh.title, dh.document_type, dh.specific_type,
                   dh.created_at, dh.file_format, cda.access_type,
                   c.title as case_title, c.case_number
            FROM client_document_access cda
            JOIN document_history dh ON cda.document_id = dh.id
            LEFT JOIN case_documents cd ON dh.id = cd.document_id
            LEFT JOIN cases c ON cd.case_id = c.id
            WHERE cda.client_id = $1 AND (cda.expires_at IS NULL OR cda.expires_at > NOW())
            ORDER BY dh.created_at DESC
        `, [req.portalClient.client_id]);

        await logActivity(req.portalClient.client_id, 'viewed_documents_list', {}, req.ip);

        res.render('portal/documents', {
            title: 'My Documents',
            client: req.portalClient,
            documents: result.rows
        });
    } catch (error) {
        console.error('Portal documents error:', error);
        res.status(500).render('error', { message: 'Error loading documents' });
    }
});

// Download document
router.get('/portal/documents/:id/download', requirePortalAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT dh.*, cda.access_type
            FROM client_document_access cda
            JOIN document_history dh ON cda.document_id = dh.id
            WHERE dh.id = $1 AND cda.client_id = $2 AND cda.access_type = 'download'
            AND (cda.expires_at IS NULL OR cda.expires_at > NOW())
        `, [req.params.id, req.portalClient.client_id]);

        if (result.rows.length === 0) {
            return res.status(403).render('error', { message: 'Document not found or access denied' });
        }

        const doc = result.rows[0];

        // Update download count
        await db.query('UPDATE document_history SET download_count = download_count + 1 WHERE id = $1', [doc.id]);

        await logActivity(req.portalClient.client_id, 'downloaded_document', { document_id: req.params.id }, req.ip);

        // If file_path exists, send the file
        if (doc.file_path) {
            return res.download(doc.file_path, `${doc.title}.${doc.file_format}`);
        }

        // Otherwise, generate PDF from content
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${doc.title}.pdf"`);
        res.send(doc.content);

    } catch (error) {
        console.error('Portal document download error:', error);
        res.status(500).render('error', { message: 'Error downloading document' });
    }
});

// View all invoices
router.get('/portal/invoices', requirePortalAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT i.*, c.title as case_title, c.case_number,
                   (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = i.id) as item_count
            FROM invoices i
            LEFT JOIN cases c ON i.case_id = c.id
            WHERE i.client_id = $1
            ORDER BY i.created_at DESC
        `, [req.portalClient.client_id]);

        // Get total outstanding
        const totalResult = await db.query(`
            SELECT
                COALESCE(SUM(CASE WHEN status IN ('sent', 'overdue') THEN total - amount_paid ELSE 0 END), 0) as outstanding,
                COALESCE(SUM(amount_paid), 0) as total_paid
            FROM invoices
            WHERE client_id = $1
        `, [req.portalClient.client_id]);

        await logActivity(req.portalClient.client_id, 'viewed_invoices_list', {}, req.ip);

        res.render('portal/invoices', {
            title: 'My Invoices',
            client: req.portalClient,
            invoices: result.rows,
            totals: totalResult.rows[0]
        });
    } catch (error) {
        console.error('Portal invoices error:', error);
        res.status(500).render('error', { message: 'Error loading invoices' });
    }
});

// View single invoice
router.get('/portal/invoices/:id', requirePortalAuth, async (req, res) => {
    try {
        const invoiceResult = await db.query(`
            SELECT i.*, c.title as case_title, c.case_number,
                   u.first_name as attorney_first_name, u.last_name as attorney_last_name,
                   u.email as attorney_email
            FROM invoices i
            LEFT JOIN cases c ON i.case_id = c.id
            LEFT JOIN users u ON i.user_id = u.id
            WHERE i.id = $1 AND i.client_id = $2
        `, [req.params.id, req.portalClient.client_id]);

        if (invoiceResult.rows.length === 0) {
            return res.status(404).render('error', { message: 'Invoice not found' });
        }

        // Get invoice items
        const itemsResult = await db.query(`
            SELECT * FROM invoice_items
            WHERE invoice_id = $1
            ORDER BY created_at ASC
        `, [req.params.id]);

        // Get payments
        const paymentsResult = await db.query(`
            SELECT * FROM payments
            WHERE invoice_id = $1
            ORDER BY payment_date DESC
        `, [req.params.id]);

        // Check for payment link
        const paymentLinkResult = await db.query(`
            SELECT token FROM payment_links
            WHERE invoice_id = $1 AND is_active = true AND (expires_at IS NULL OR expires_at > NOW())
            LIMIT 1
        `, [req.params.id]);

        await logActivity(req.portalClient.client_id, 'viewed_invoice_detail', { invoice_id: req.params.id }, req.ip);

        res.render('portal/invoice-detail', {
            title: `Invoice ${invoiceResult.rows[0].invoice_number}`,
            client: req.portalClient,
            invoice: invoiceResult.rows[0],
            items: itemsResult.rows,
            payments: paymentsResult.rows,
            paymentLink: paymentLinkResult.rows[0]?.token
        });
    } catch (error) {
        console.error('Portal invoice detail error:', error);
        res.status(500).render('error', { message: 'Error loading invoice' });
    }
});

// View calendar/events
router.get('/portal/calendar', requirePortalAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT ce.*, c.title as case_title, c.case_number
            FROM calendar_events ce
            LEFT JOIN cases c ON ce.case_id = c.id
            WHERE ce.client_id = $1
            ORDER BY ce.start_time ASC
        `, [req.portalClient.client_id]);

        await logActivity(req.portalClient.client_id, 'viewed_calendar', {}, req.ip);

        res.render('portal/calendar', {
            title: 'My Calendar',
            client: req.portalClient,
            events: result.rows
        });
    } catch (error) {
        console.error('Portal calendar error:', error);
        res.status(500).render('error', { message: 'Error loading calendar' });
    }
});

// Messages page
router.get('/portal/messages', requirePortalAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT m.*,
                   u.first_name as sender_first_name, u.last_name as sender_last_name
            FROM messages m
            LEFT JOIN users u ON m.user_id = u.id
            WHERE m.client_id = $1 AND m.message_type = 'client'
            ORDER BY m.created_at DESC
        `, [req.portalClient.client_id]);

        await logActivity(req.portalClient.client_id, 'viewed_messages', {}, req.ip);

        res.render('portal/messages', {
            title: 'Messages',
            client: req.portalClient,
            messages: result.rows
        });
    } catch (error) {
        console.error('Portal messages error:', error);
        res.status(500).render('error', { message: 'Error loading messages' });
    }
});

// Send message
router.post('/portal/messages', requirePortalAuth, [
    body('subject').trim().notEmpty(),
    body('content').trim().notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: 'Subject and message are required' });
    }

    try {
        const { subject, content, case_id } = req.body;

        await db.query(`
            INSERT INTO messages (user_id, client_id, case_id, subject, content, message_type)
            VALUES ($1, $2, $3, $4, $5, 'client')
        `, [req.portalClient.attorney_user_id, req.portalClient.client_id, case_id || null, subject, content]);

        // Create notification for attorney
        await db.query(`
            INSERT INTO notifications (user_id, title, message, notification_type, reference_type, reference_id)
            VALUES ($1, $2, $3, 'message', 'client', $4)
        `, [
            req.portalClient.attorney_user_id,
            'New Client Portal Message',
            `${req.portalClient.first_name} ${req.portalClient.last_name} sent you a message: ${subject}`,
            req.portalClient.client_id
        ]);

        await logActivity(req.portalClient.client_id, 'sent_message', { subject }, req.ip);

        res.json({ success: true });
    } catch (error) {
        console.error('Portal send message error:', error);
        res.status(500).json({ success: false, error: 'Failed to send message' });
    }
});

// Profile page
router.get('/portal/profile', requirePortalAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT c.*, cpa.email as portal_email, cpa.notification_preferences,
                   cpa.two_factor_enabled, cpa.last_login
            FROM clients c
            JOIN client_portal_access cpa ON c.id = cpa.client_id
            WHERE c.id = $1
        `, [req.portalClient.client_id]);

        res.render('portal/profile', {
            title: 'My Profile',
            client: req.portalClient,
            profile: result.rows[0]
        });
    } catch (error) {
        console.error('Portal profile error:', error);
        res.status(500).render('error', { message: 'Error loading profile' });
    }
});

// Update profile
router.post('/portal/profile', requirePortalAuth, async (req, res) => {
    try {
        const { phone, address, city, state, zip, notification_preferences } = req.body;

        await db.query(`
            UPDATE clients
            SET phone = $1, address = $2, city = $3, state = $4, zip = $5, updated_at = CURRENT_TIMESTAMP
            WHERE id = $6
        `, [phone, address, city, state, zip, req.portalClient.client_id]);

        if (notification_preferences) {
            await db.query(`
                UPDATE client_portal_access
                SET notification_preferences = $1
                WHERE client_id = $2
            `, [JSON.stringify(notification_preferences), req.portalClient.client_id]);
        }

        await logActivity(req.portalClient.client_id, 'updated_profile', {}, req.ip);

        res.redirect('/portal/profile?success=updated');
    } catch (error) {
        console.error('Portal update profile error:', error);
        res.status(500).render('error', { message: 'Error updating profile' });
    }
});

// Change password
router.post('/portal/change-password', requirePortalAuth, [
    body('current_password').notEmpty(),
    body('new_password').isLength({ min: 8 }),
    body('confirm_password').custom((value, { req }) => value === req.body.new_password)
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: 'Password must be at least 8 characters and match confirmation' });
    }

    try {
        const { current_password, new_password } = req.body;

        const result = await db.query(
            'SELECT password_hash FROM client_portal_access WHERE client_id = $1',
            [req.portalClient.client_id]
        );

        const validPassword = await bcrypt.compare(current_password, result.rows[0].password_hash);
        if (!validPassword) {
            return res.status(400).json({ success: false, error: 'Current password is incorrect' });
        }

        const newHash = await bcrypt.hash(new_password, 10);
        await db.query(
            'UPDATE client_portal_access SET password_hash = $1 WHERE client_id = $2',
            [newHash, req.portalClient.client_id]
        );

        await logActivity(req.portalClient.client_id, 'changed_password', {}, req.ip);

        res.json({ success: true });
    } catch (error) {
        console.error('Portal change password error:', error);
        res.status(500).json({ success: false, error: 'Failed to change password' });
    }
});

// =====================================================
// API ROUTES FOR ADMIN (Attorney side)
// =====================================================

const { requireAuth } = require('../middleware/auth');

// Grant client portal access
router.post('/api/clients/:id/portal-access', requireAuth, async (req, res) => {
    try {
        const { email, password } = req.body;

        // Verify client belongs to user
        const clientResult = await db.query(
            'SELECT id FROM clients WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (clientResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Client not found' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const portalToken = crypto.randomBytes(32).toString('hex');

        await db.query(`
            INSERT INTO client_portal_access (client_id, email, password_hash, portal_token, token_expires)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (client_id) DO UPDATE SET
                email = EXCLUDED.email,
                password_hash = EXCLUDED.password_hash,
                portal_token = EXCLUDED.portal_token,
                token_expires = EXCLUDED.token_expires,
                is_active = true
        `, [req.params.id, email, passwordHash, portalToken, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]);

        res.json({ success: true, portalToken });
    } catch (error) {
        console.error('Grant portal access error:', error);
        res.status(500).json({ success: false, error: 'Failed to grant portal access' });
    }
});

// Revoke client portal access
router.delete('/api/clients/:id/portal-access', requireAuth, async (req, res) => {
    try {
        await db.query(`
            UPDATE client_portal_access SET is_active = false WHERE client_id = $1
        `, [req.params.id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Revoke portal access error:', error);
        res.status(500).json({ success: false, error: 'Failed to revoke portal access' });
    }
});

// Grant document access to client
router.post('/api/documents/:id/client-access', requireAuth, async (req, res) => {
    try {
        const { client_id, access_type, expires_at } = req.body;

        await db.query(`
            INSERT INTO client_document_access (client_id, document_id, granted_by, access_type, expires_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (client_id, document_id) DO UPDATE SET
                access_type = EXCLUDED.access_type,
                expires_at = EXCLUDED.expires_at
        `, [client_id, req.params.id, req.user.id, access_type || 'view', expires_at || null]);

        res.json({ success: true });
    } catch (error) {
        console.error('Grant document access error:', error);
        res.status(500).json({ success: false, error: 'Failed to grant document access' });
    }
});

// Get client portal activity
router.get('/api/clients/:id/portal-activity', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT * FROM client_portal_activity
            WHERE client_id = $1
            ORDER BY created_at DESC
            LIMIT 50
        `, [req.params.id]);

        res.json({ success: true, activities: result.rows });
    } catch (error) {
        console.error('Get portal activity error:', error);
        res.status(500).json({ success: false, error: 'Failed to get activity' });
    }
});

module.exports = router;

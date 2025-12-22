/**
 * Lead Intake Forms Routes
 * Handles lead capture forms, lead management, and conversion
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const crypto = require('crypto');

// =====================================================
// PUBLIC ROUTES (Intake Forms)
// =====================================================

// Public intake form
router.get('/intake/:slug', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT ift.*, u.first_name as attorney_first_name, u.last_name as attorney_last_name
            FROM intake_form_templates ift
            JOIN users u ON ift.user_id = u.id
            WHERE ift.slug = $1 AND ift.is_active = true AND ift.is_public = true
        `, [req.params.slug]);

        if (result.rows.length === 0) {
            return res.status(404).render('intake/not-found', { title: 'Form Not Found' });
        }

        const form = result.rows[0];

        // Handle fields whether it's already parsed or a string
        let fields = form.fields || [];
        if (typeof fields === 'string') {
            fields = JSON.parse(fields);
        }

        res.render('intake/form', {
            title: form.name,
            form,
            fields: fields
        });
    } catch (error) {
        console.error('Intake form error:', error);
        res.status(500).render('error', { message: 'Error loading form' });
    }
});

// Submit intake form
router.post('/intake/:slug/submit', async (req, res) => {
    try {
        const formResult = await db.query(`
            SELECT * FROM intake_form_templates WHERE slug = $1 AND is_active = true
        `, [req.params.slug]);

        if (formResult.rows.length === 0) {
            return res.status(404).json({ error: 'Form not found' });
        }

        const form = formResult.rows[0];
        const formData = req.body;

        // Extract standard fields
        const { first_name, last_name, email, phone, company, description } = formData;

        // Get UTM parameters
        const utm_source = req.query.utm_source || req.body.utm_source;
        const utm_medium = req.query.utm_medium || req.body.utm_medium;
        const utm_campaign = req.query.utm_campaign || req.body.utm_campaign;

        // Calculate lead score
        const score = await calculateLeadScore(form.user_id, formData, form.practice_area);

        // Create lead
        const leadResult = await db.query(`
            INSERT INTO leads
            (user_id, form_id, first_name, last_name, email, phone, company, practice_area,
             case_description, form_data, source, utm_source, utm_medium, utm_campaign,
             ip_address, status, priority)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'new', $16)
            RETURNING *
        `, [
            form.user_id,
            form.id,
            first_name,
            last_name,
            email,
            phone,
            company,
            form.practice_area,
            description,
            JSON.stringify(formData),
            'website',
            utm_source,
            utm_medium,
            utm_campaign,
            req.ip,
            score > 50 ? 'high' : 'medium'
        ]);

        // Update form submission count
        await db.query(
            'UPDATE intake_form_templates SET submission_count = submission_count + 1 WHERE id = $1',
            [form.id]
        );

        // Create notification for attorney
        await db.query(`
            INSERT INTO notifications (user_id, title, message, notification_type, reference_type, reference_id)
            VALUES ($1, $2, $3, 'message', 'lead', $4)
        `, [
            form.user_id,
            'New Lead Received',
            `New ${form.practice_area || ''} lead: ${first_name} ${last_name} (${email})`,
            leadResult.rows[0].id
        ]);

        // Log activity
        await db.query(`
            INSERT INTO lead_activities (lead_id, activity_type, description)
            VALUES ($1, 'note', 'Lead submitted via intake form')
        `, [leadResult.rows[0].id]);

        res.json({ success: true, message: 'Thank you for your submission!' });
    } catch (error) {
        console.error('Form submission error:', error);
        res.status(500).json({ error: 'Failed to submit form' });
    }
});

// Thank you page
router.get('/intake/:slug/thank-you', async (req, res) => {
    res.render('intake/thank-you', {
        title: 'Thank You'
    });
});

// Admin preview route - allows form owner to preview even inactive/private forms
router.get('/leads/forms/:id/preview', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT ift.*, u.first_name as attorney_first_name, u.last_name as attorney_last_name
            FROM intake_form_templates ift
            JOIN users u ON ift.user_id = u.id
            WHERE ift.id = $1 AND (ift.user_id = $2 OR ift.user_id IS NULL)
        `, [req.params.id, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).render('intake/not-found', { title: 'Form Not Found' });
        }

        const form = result.rows[0];

        // Handle fields whether it's already parsed or a string
        let fields = form.fields || [];
        if (typeof fields === 'string') {
            fields = JSON.parse(fields);
        }

        res.render('intake/form', {
            title: form.name + ' (Preview)',
            form,
            fields: fields,
            isPreview: true
        });
    } catch (error) {
        console.error('Admin preview error:', error);
        res.status(500).render('error', { message: 'Error loading form preview' });
    }
});

// =====================================================
// AUTHENTICATED ROUTES (Lead Management)
// =====================================================

// Leads dashboard
router.get('/leads', requireAuth, async (req, res) => {
    try {
        const { status, practice_area, source } = req.query;

        let query = `
            SELECT l.*, ift.name as form_name,
                   (SELECT COUNT(*) FROM lead_activities WHERE lead_id = l.id) as activity_count
            FROM leads l
            LEFT JOIN intake_form_templates ift ON l.form_id = ift.id
            WHERE (l.user_id = $1 OR l.user_id IS NULL)
        `;
        const params = [req.user.id];
        let paramIndex = 2;

        if (status && status !== 'all') {
            query += ` AND l.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (practice_area && practice_area !== 'all') {
            query += ` AND l.practice_area = $${paramIndex}`;
            params.push(practice_area);
            paramIndex++;
        }

        if (source && source !== 'all') {
            query += ` AND l.source = $${paramIndex}`;
            params.push(source);
            paramIndex++;
        }

        query += ' ORDER BY l.created_at DESC';

        const leadsResult = await db.query(query, params);

        // Stats
        const statsResult = await db.query(`
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'new') as new_count,
                COUNT(*) FILTER (WHERE status = 'contacted') as contacted_count,
                COUNT(*) FILTER (WHERE status = 'qualified') as qualified_count,
                COUNT(*) FILTER (WHERE status = 'converted') as converted_count,
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as this_week
            FROM leads
            WHERE (user_id = $1 OR user_id IS NULL)
        `, [req.user.id]);

        res.render('leads/dashboard', {
            title: 'Leads',
            leads: leadsResult.rows,
            stats: statsResult.rows[0],
            filters: { status, practice_area, source },
            req
        });
    } catch (error) {
        console.error('Leads dashboard error:', error);
        res.status(500).render('error', { message: 'Error loading leads' });
    }
});

// Intake forms management - MUST be before :id route
router.get('/leads/forms', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT * FROM intake_form_templates
            WHERE (user_id = $1 OR user_id IS NULL)
            ORDER BY created_at DESC
        `, [req.user.id]);

        res.render('leads/forms', {
            title: 'Intake Forms',
            forms: result.rows,
            req
        });
    } catch (error) {
        console.error('Intake forms error:', error);
        res.status(500).render('error', { message: 'Error loading forms' });
    }
});

// Lead analytics - MUST be before :id route
router.get('/leads/analytics', requireAuth, async (req, res) => {
    try {
        // Basic stats
        const stats = await db.query(`
            SELECT
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as this_month,
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as this_week,
                COUNT(*) FILTER (WHERE status = 'converted') as converted,
                COUNT(*) as total
            FROM leads WHERE (user_id = $1 OR user_id IS NULL)
        `, [req.user.id]);

        // Leads by status
        const byStatus = await db.query(`
            SELECT status, COUNT(*) as count
            FROM leads WHERE (user_id = $1 OR user_id IS NULL)
            GROUP BY status ORDER BY count DESC
        `, [req.user.id]);

        // Leads by source
        const bySource = await db.query(`
            SELECT COALESCE(source, 'direct') as source, COUNT(*) as count
            FROM leads WHERE (user_id = $1 OR user_id IS NULL)
            GROUP BY source ORDER BY count DESC
        `, [req.user.id]);

        // Leads by practice area
        const byPracticeArea = await db.query(`
            SELECT COALESCE(practice_area, 'other') as practice_area, COUNT(*) as count
            FROM leads WHERE (user_id = $1 OR user_id IS NULL)
            GROUP BY practice_area ORDER BY count DESC
        `, [req.user.id]);

        // Leads trend (last 6 months)
        const trend = await db.query(`
            SELECT
                TO_CHAR(created_at, 'Mon YYYY') as month,
                COUNT(*) as count
            FROM leads
            WHERE (user_id = $1 OR user_id IS NULL) AND created_at >= NOW() - INTERVAL '6 months'
            GROUP BY TO_CHAR(created_at, 'Mon YYYY'), DATE_TRUNC('month', created_at)
            ORDER BY DATE_TRUNC('month', created_at)
        `, [req.user.id]);

        // Conversion rate
        const conversionRate = stats.rows[0].total > 0
            ? ((stats.rows[0].converted / stats.rows[0].total) * 100).toFixed(1)
            : 0;

        res.render('leads/analytics', {
            title: 'Lead Analytics',
            stats: stats.rows[0] || {},
            byStatus: byStatus.rows,
            bySource: bySource.rows,
            byPracticeArea: byPracticeArea.rows,
            trend: trend.rows,
            conversionRate,
            req
        });
    } catch (error) {
        console.error('Lead analytics error:', error);
        res.status(500).render('error', { message: 'Error loading analytics' });
    }
});

// New intake form - MUST be before :id route
router.get('/leads/forms/new', requireAuth, async (req, res) => {
    try {
        res.render('leads/form-builder', {
            title: 'Create Intake Form',
            form: null,
            req
        });
    } catch (error) {
        console.error('New form error:', error);
        res.status(500).render('error', { message: 'Error loading form builder' });
    }
});

// Form edit page
router.get('/leads/forms/:id/edit', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT * FROM intake_form_templates
            WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
        `, [req.params.id, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).render('error', { message: 'Form not found' });
        }

        const form = result.rows[0];
        const fields = form.fields ? (typeof form.fields === 'string' ? JSON.parse(form.fields) : form.fields) : [];

        res.render('leads/form-edit', {
            title: 'Edit Form: ' + form.name,
            form: form,
            fields: fields,
            req
        });
    } catch (error) {
        console.error('Form edit page error:', error);
        res.status(500).render('error', { message: 'Error loading form editor' });
    }
});

// Form detail page
router.get('/leads/forms/:id', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT * FROM intake_form_templates
            WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
        `, [req.params.id, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).render('error', { message: 'Form not found' });
        }

        const form = result.rows[0];

        // Get submissions for this form
        const submissionsResult = await db.query(`
            SELECT l.*,
                   CASE WHEN l.status = 'converted' THEN true ELSE false END as is_converted
            FROM leads l
            WHERE l.form_id = $1 AND (l.user_id = $2 OR l.user_id IS NULL)
            ORDER BY l.created_at DESC
            LIMIT 20
        `, [req.params.id, req.user.id]);

        res.render('leads/form-detail', {
            title: form.name,
            form: form,
            fields: form.fields ? (typeof form.fields === 'string' ? JSON.parse(form.fields) : form.fields) : [],
            submissions: submissionsResult.rows,
            req
        });
    } catch (error) {
        console.error('Form detail error:', error);
        res.status(500).render('error', { message: 'Error loading form details' });
    }
});

// Lead detail page - MUST be AFTER all static routes
router.get('/leads/:id', requireAuth, async (req, res) => {
    try {
        const leadResult = await db.query(`
            SELECT l.*, ift.name as form_name
            FROM leads l
            LEFT JOIN intake_form_templates ift ON l.form_id = ift.id
            WHERE l.id = $1 AND (l.user_id = $2 OR l.user_id IS NULL)
        `, [req.params.id, req.user.id]);

        if (leadResult.rows.length === 0) {
            return res.status(404).render('error', { message: 'Lead not found' });
        }

        // Get activities
        const activitiesResult = await db.query(`
            SELECT la.*, u.first_name, u.last_name
            FROM lead_activities la
            LEFT JOIN users u ON la.user_id = u.id
            WHERE la.lead_id = $1
            ORDER BY la.created_at DESC
        `, [req.params.id]);

        res.render('leads/detail', {
            title: `Lead: ${leadResult.rows[0].first_name} ${leadResult.rows[0].last_name}`,
            lead: leadResult.rows[0],
            activities: activitiesResult.rows,
            req
        });
    } catch (error) {
        console.error('Lead detail error:', error);
        res.status(500).render('error', { message: 'Error loading lead' });
    }
});

// =====================================================
// API ROUTES
// =====================================================

// Create lead manually
router.post('/api/leads', requireAuth, async (req, res) => {
    try {
        const { first_name, last_name, email, phone, source, practice_area, message } = req.body;

        if (!first_name || !last_name || !email) {
            return res.status(400).json({ error: 'First name, last name, and email are required' });
        }

        const result = await db.query(`
            INSERT INTO leads (user_id, first_name, last_name, email, phone, source, practice_area, notes, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'new')
            RETURNING *
        `, [req.user.id, first_name, last_name, email, phone, source || 'manual', practice_area, message]);

        // Log activity
        await db.query(`
            INSERT INTO lead_activities (lead_id, user_id, activity_type, description)
            VALUES ($1, $2, 'created', 'Lead created manually')
        `, [result.rows[0].id, req.user.id]);

        res.status(201).json({ success: true, lead: result.rows[0] });
    } catch (error) {
        console.error('Create lead error:', error);
        res.status(500).json({ error: 'Failed to create lead' });
    }
});

// Update lead (general)
router.put('/api/leads/:id', requireAuth, async (req, res) => {
    try {
        const { status, first_name, last_name, email, phone, notes } = req.body;

        const result = await db.query(`
            UPDATE leads SET
                status = COALESCE($1, status),
                first_name = COALESCE($2, first_name),
                last_name = COALESCE($3, last_name),
                email = COALESCE($4, email),
                phone = COALESCE($5, phone),
                notes = COALESCE($6, notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $7 AND user_id = $8
            RETURNING *
        `, [status, first_name, last_name, email, phone, notes, req.params.id, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        if (status) {
            await db.query(`
                INSERT INTO lead_activities (lead_id, user_id, activity_type, description)
                VALUES ($1, $2, 'status_change', $3)
            `, [req.params.id, req.user.id, `Status changed to ${status}`]);
        }

        res.json({ success: true, lead: result.rows[0] });
    } catch (error) {
        console.error('Update lead error:', error);
        res.status(500).json({ error: 'Failed to update lead' });
    }
});

// Update lead status
router.put('/api/leads/:id/status', requireAuth, async (req, res) => {
    try {
        const { status } = req.body;

        const result = await db.query(`
            UPDATE leads SET status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND (user_id = $3 OR user_id IS NULL)
            RETURNING *
        `, [status, req.params.id, req.user.id]);

        // Log activity
        await db.query(`
            INSERT INTO lead_activities (lead_id, user_id, activity_type, description)
            VALUES ($1, $2, 'status_change', $3)
        `, [req.params.id, req.user.id, `Status changed to ${status}`]);

        res.json({ success: true, lead: result.rows[0] });
    } catch (error) {
        console.error('Update lead status error:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// Add lead activity
router.post('/api/leads/:id/activities', requireAuth, async (req, res) => {
    try {
        const { activity_type, description, outcome, next_action, next_action_date } = req.body;

        const result = await db.query(`
            INSERT INTO lead_activities
            (lead_id, user_id, activity_type, description, outcome, next_action, next_action_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [req.params.id, req.user.id, activity_type, description, outcome, next_action, next_action_date]);

        // Update lead follow_up_date if next_action_date provided
        if (next_action_date) {
            await db.query(
                'UPDATE leads SET follow_up_date = $1 WHERE id = $2',
                [next_action_date, req.params.id]
            );
        }

        res.json({ success: true, activity: result.rows[0] });
    } catch (error) {
        console.error('Add activity error:', error);
        res.status(500).json({ error: 'Failed to add activity' });
    }
});

// Convert lead to client
router.post('/api/leads/:id/convert', requireAuth, async (req, res) => {
    try {
        const leadResult = await db.query(
            'SELECT * FROM leads WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
            [req.params.id, req.user.id]
        );

        if (leadResult.rows.length === 0) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        const lead = leadResult.rows[0];

        // Create client
        const clientResult = await db.query(`
            INSERT INTO clients
            (user_id, client_type, first_name, last_name, email, phone, company_name, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [
            req.user.id,
            lead.company ? 'business' : 'individual',
            lead.first_name,
            lead.last_name,
            lead.email,
            lead.phone,
            lead.company,
            `Converted from lead. Original inquiry: ${lead.case_description || ''}`
        ]);

        // Update lead
        await db.query(`
            UPDATE leads SET status = 'converted', converted_to_client_id = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [clientResult.rows[0].id, req.params.id]);

        // Log activity
        await db.query(`
            INSERT INTO lead_activities (lead_id, user_id, activity_type, description)
            VALUES ($1, $2, 'status_change', 'Lead converted to client')
        `, [req.params.id, req.user.id]);

        res.json({ success: true, client: clientResult.rows[0] });
    } catch (error) {
        console.error('Convert lead error:', error);
        res.status(500).json({ error: 'Failed to convert lead' });
    }
});

// Create intake form template
router.post('/api/leads/forms', requireAuth, async (req, res) => {
    try {
        const { name, description, practice_area, fields, settings, is_public } = req.body;

        // Generate slug
        const slug = name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')
            + '-' + crypto.randomBytes(4).toString('hex');

        // Default fields if not provided
        const defaultFields = [
            { id: 'name', type: 'text', label: 'Full Name', required: true },
            { id: 'email', type: 'email', label: 'Email Address', required: true },
            { id: 'phone', type: 'tel', label: 'Phone Number', required: false },
            { id: 'message', type: 'textarea', label: 'How can we help?', required: true }
        ];

        const result = await db.query(`
            INSERT INTO intake_form_templates
            (user_id, name, description, practice_area, fields, settings, is_public, slug)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [
            req.user.id, name, description, practice_area,
            JSON.stringify(fields || defaultFields), JSON.stringify(settings || {}),
            is_public !== false, slug
        ]);

        res.json({ success: true, form: result.rows[0] });
    } catch (error) {
        console.error('Create form error:', error);
        res.status(500).json({ error: 'Failed to create form' });
    }
});

// Update intake form template
router.put('/api/leads/forms/:id', requireAuth, async (req, res) => {
    try {
        const { name, description, practice_area, fields, settings, is_active, is_public } = req.body;

        const result = await db.query(`
            UPDATE intake_form_templates SET
                name = COALESCE($1, name),
                description = COALESCE($2, description),
                practice_area = COALESCE($3, practice_area),
                fields = COALESCE($4, fields),
                settings = COALESCE($5, settings),
                is_active = COALESCE($6, is_active),
                is_public = COALESCE($7, is_public),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $8 AND user_id = $9
            RETURNING *
        `, [
            name, description, practice_area,
            fields ? JSON.stringify(fields) : null,
            settings ? JSON.stringify(settings) : null,
            is_active, is_public,
            req.params.id, req.user.id
        ]);

        res.json({ success: true, form: result.rows[0] });
    } catch (error) {
        console.error('Update form error:', error);
        res.status(500).json({ error: 'Failed to update form' });
    }
});

// Delete intake form
router.delete('/api/leads/forms/:id', requireAuth, async (req, res) => {
    try {
        await db.query(
            'DELETE FROM intake_form_templates WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
            [req.params.id, req.user.id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Delete form error:', error);
        res.status(500).json({ error: 'Failed to delete form' });
    }
});

// Delete lead
router.delete('/api/leads/:id', requireAuth, async (req, res) => {
    try {
        await db.query('DELETE FROM lead_activities WHERE lead_id = $1', [req.params.id]);
        await db.query('DELETE FROM leads WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)', [req.params.id, req.user.id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete lead error:', error);
        res.status(500).json({ error: 'Failed to delete lead' });
    }
});

// =====================================================
// HELPER FUNCTIONS
// =====================================================

async function calculateLeadScore(userId, formData, practiceArea) {
    let score = 50; // Base score

    try {
        // Get scoring rules
        const rulesResult = await db.query(
            'SELECT * FROM lead_scoring_rules WHERE (user_id = $1 OR user_id IS NULL) AND is_active = true',
            [userId]
        );

        for (const rule of rulesResult.rows) {
            const fieldValue = formData[rule.condition_field];
            let matches = false;

            switch (rule.condition_operator) {
                case 'equals':
                    matches = fieldValue === rule.condition_value;
                    break;
                case 'contains':
                    matches = fieldValue && fieldValue.toLowerCase().includes(rule.condition_value.toLowerCase());
                    break;
                case 'not_empty':
                    matches = !!fieldValue;
                    break;
            }

            if (matches) {
                score += rule.score_adjustment;
            }
        }

        // Practice area bonus
        if (practiceArea === 'personal_injury') score += 15;
        if (practiceArea === 'corporate') score += 20;

        // Cap score
        return Math.min(100, Math.max(0, score));
    } catch (error) {
        console.error('Lead scoring error:', error);
        return 50;
    }
}

module.exports = router;

/**
 * AI Billing Optimization Routes
 * Suggests billable items from case notes and identifies unbilled time
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const axios = require('axios');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// =====================================================
// PAGE ROUTES
// =====================================================

// AI Billing Suggestions Dashboard
router.get('/billing/ai-suggestions', requireAuth, async (req, res) => {
    try {
        const suggestionsResult = await db.query(`
            SELECT abs.*, c.title as case_title
            FROM ai_billing_suggestions abs
            LEFT JOIN cases c ON abs.case_id = c.id
            WHERE (abs.user_id = $1 OR abs.user_id IS NULL)
            ORDER BY abs.created_at DESC
            LIMIT 50
        `, [req.user.id]);

        const statsResult = await db.query(`
            SELECT
                COUNT(*) as total_suggestions,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
                COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_count,
                COALESCE(SUM(CASE WHEN status = 'accepted' THEN suggested_amount END), 0) as accepted_value
            FROM ai_billing_suggestions
            WHERE (user_id = $1 OR user_id IS NULL)
        `, [req.user.id]);

        const casesResult = await db.query(`
            SELECT id, case_number, title FROM cases
            WHERE (user_id = $1 OR user_id IS NULL) AND status != 'closed'
            ORDER BY created_at DESC
        `, [req.user.id]);

        res.render('billing/ai-suggestions', {
            title: 'AI Billing Suggestions',
            suggestions: suggestionsResult.rows,
            stats: statsResult.rows[0],
            cases: casesResult.rows,
            active: 'billing'
        });
    } catch (error) {
        console.error('AI billing dashboard error:', error);
        res.status(500).render('error', { message: 'Error loading AI billing' });
    }
});

// =====================================================
// API ROUTES
// =====================================================

// Scan case notes for billable items
router.post('/api/ai-billing/scan-notes', requireAuth, async (req, res) => {
    try {
        const { days, sample_notes } = req.body;
        // Handle empty string case_id as null
        const case_id = req.body.case_id && req.body.case_id.trim() ? req.body.case_id : null;

        let notesText = '';
        let hourlyRate = 300;
        let caseData = null;

        // If sample_notes provided, use those (for demo)
        if (sample_notes && sample_notes.trim()) {
            notesText = sample_notes;
        } else if (case_id) {
            // Get case info and hourly rate
            const caseResult = await db.query(`
                SELECT c.*, cl.first_name, cl.last_name
                FROM cases c
                LEFT JOIN clients cl ON c.client_id = cl.id
                WHERE c.id = $1 AND (c.user_id = $2 OR c.user_id IS NULL)
            `, [case_id, req.user.id]);

            if (caseResult.rows.length === 0) {
                return res.status(404).json({ error: 'Case not found' });
            }

            caseData = caseResult.rows[0];
            hourlyRate = caseData.hourly_rate || 300;

            // Get case notes
            const daysAgo = parseInt(days) || 30;
            const notesResult = await db.query(`
                SELECT * FROM case_notes
                WHERE case_id = $1 AND created_at >= NOW() - INTERVAL '${daysAgo} days'
                ORDER BY created_at DESC
            `, [case_id]);

            if (notesResult.rows.length === 0) {
                return res.json({ success: true, suggestionsCount: 0, message: 'No case notes found in this period' });
            }

            notesText = notesResult.rows.map(n =>
                `[${new Date(n.created_at).toLocaleDateString()}] ${n.title || 'Note'}: ${n.content}`
            ).join('\n\n');
        } else {
            // Get recent notes from all cases
            const daysAgo = parseInt(days) || 30;
            const notesResult = await db.query(`
                SELECT cn.*, c.title as case_title
                FROM case_notes cn
                JOIN cases c ON cn.case_id = c.id
                WHERE (c.user_id = $1 OR c.user_id IS NULL) AND cn.created_at >= NOW() - INTERVAL '${daysAgo} days'
                ORDER BY cn.created_at DESC
                LIMIT 50
            `, [req.user.id]);

            if (notesResult.rows.length === 0) {
                return res.json({ success: true, suggestionsCount: 0, message: 'No case notes found in this period' });
            }

            notesText = notesResult.rows.map(n =>
                `[${n.case_title}] [${new Date(n.created_at).toLocaleDateString()}] ${n.title || 'Note'}: ${n.content}`
            ).join('\n\n');
        }

        const startTime = Date.now();

        const systemPrompt = `You are a legal billing assistant. Analyze case notes and identify billable activities.`;

        const userPrompt = `Analyze the following case notes and identify billable activities.

Attorney hourly rate: $${hourlyRate}

Case Notes:
${notesText.substring(0, 10000)}

For each billable activity, provide:
1. Clear, professional billing description
2. Activity type (research, drafting, court, meeting, call, review, travel, filing)
3. Estimated time in minutes
4. Calculated amount at the hourly rate

Respond in JSON format:
{
  "billable_items": [
    {
      "description": "Professional billing description",
      "activity_type": "research|drafting|court|meeting|call|review|travel|filing",
      "estimated_minutes": 30,
      "estimated_amount": 150.00,
      "confidence": 0.85,
      "source_date": "2024-01-15"
    }
  ],
  "summary": "Brief summary of billing analysis"
}`;

        const response = await axios.post(OPENROUTER_API_URL, {
            model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            max_tokens: 2000,
            temperature: 0.2
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.BASE_URL || 'http://localhost:3000',
                'X-Title': 'LegalForms AI Billing',
                'Content-Type': 'application/json'
            }
        });

        const processingTime = Date.now() - startTime;
        const content = response.data.choices[0].message.content;
        const usage = response.data.usage || {};

        let billingData;
        try {
            const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
            billingData = JSON.parse(jsonStr);
        } catch (e) {
            billingData = { billable_items: [], summary: content };
        }

        // Save suggestions
        const savedSuggestions = [];
        for (const item of (billingData.billable_items || [])) {
            const result = await db.query(`
                INSERT INTO ai_billing_suggestions
                (case_id, user_id, suggestion_type, source_type, suggestion_data, suggested_description,
                 suggested_duration_minutes, suggested_amount, suggested_category, confidence_score, model_used, tokens_used)
                VALUES ($1, $2, 'billable_item', 'case_note', $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `, [
                case_id,
                req.user.id,
                JSON.stringify(item),
                item.description,
                item.estimated_minutes,
                item.estimated_amount,
                item.activity_type,
                item.confidence || 0.8,
                response.data.model,
                usage.total_tokens || 0
            ]);
            savedSuggestions.push(result.rows[0]);
        }

        // Log usage
        await db.query(`
            INSERT INTO ai_usage_log
            (user_id, feature, model, input_tokens, output_tokens, total_tokens, response_time_ms, success)
            VALUES ($1, 'billing_scan', $2, $3, $4, $5, $6, true)
        `, [
            req.user.id,
            response.data.model,
            usage.prompt_tokens || 0,
            usage.completion_tokens || 0,
            usage.total_tokens || 0,
            processingTime
        ]);

        res.json({
            success: true,
            suggestions: savedSuggestions,
            suggestionsCount: savedSuggestions.length,
            summary: billingData.summary
        });

    } catch (error) {
        console.error('Scan notes error:', error);
        res.status(500).json({ error: 'Failed to scan notes: ' + error.message });
    }
});

// Accept suggestion
router.post('/api/ai-billing/suggestions/:id/accept', requireAuth, async (req, res) => {
    try {
        const suggestionResult = await db.query(
            'SELECT * FROM ai_billing_suggestions WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
            [req.params.id, req.user.id]
        );

        if (suggestionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Suggestion not found' });
        }

        const suggestion = suggestionResult.rows[0];

        // Create time entry (but don't auto-add to invoice)
        const hourlyRate = suggestion.suggested_duration_minutes > 0
            ? (suggestion.suggested_amount / (suggestion.suggested_duration_minutes / 60)).toFixed(2)
            : 300;
        const timeEntryResult = await db.query(`
            INSERT INTO time_entries
            (user_id, case_id, description, duration_minutes, hourly_rate, amount, date, is_billable, is_billed)
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, true, false)
            RETURNING *
        `, [
            req.user.id,
            suggestion.case_id,
            suggestion.suggested_description,
            suggestion.suggested_duration_minutes,
            hourlyRate,
            suggestion.suggested_amount,
        ]);

        // Update suggestion status
        await db.query(`
            UPDATE ai_billing_suggestions
            SET status = 'accepted', applied_time_entry_id = $1
            WHERE id = $2
        `, [timeEntryResult.rows[0].id, req.params.id]);

        res.json({
            success: true,
            timeEntry: timeEntryResult.rows[0],
            message: 'Time entry created (unbilled)'
        });

    } catch (error) {
        console.error('Accept suggestion error:', error);
        res.status(500).json({ error: 'Failed to accept suggestion' });
    }
});

// Reject suggestion
router.post('/api/ai-billing/suggestions/:id/reject', requireAuth, async (req, res) => {
    try {
        await db.query(`
            UPDATE ai_billing_suggestions
            SET status = 'rejected'
            WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
        `, [req.params.id, req.user.id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Reject suggestion error:', error);
        res.status(500).json({ error: 'Failed to reject suggestion' });
    }
});

// Get pending suggestions
router.get('/api/ai-billing/suggestions', requireAuth, async (req, res) => {
    try {
        const { status, case_id } = req.query;

        let query = `
            SELECT abs.*, c.title as case_title
            FROM ai_billing_suggestions abs
            LEFT JOIN cases c ON abs.case_id = c.id
            WHERE (abs.user_id = $1 OR abs.user_id IS NULL)
        `;
        const params = [req.user.id];

        if (status) {
            query += ` AND abs.status = $${params.length + 1}`;
            params.push(status);
        }

        if (case_id) {
            query += ` AND abs.case_id = $${params.length + 1}`;
            params.push(case_id);
        }

        query += ' ORDER BY abs.created_at DESC';

        const result = await db.query(query, params);

        res.json({ success: true, suggestions: result.rows });
    } catch (error) {
        console.error('Get suggestions error:', error);
        res.status(500).json({ error: 'Failed to get suggestions' });
    }
});

module.exports = router;

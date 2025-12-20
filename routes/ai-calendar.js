/**
 * AI Calendar Assistant Routes
 * Extracts deadlines from documents and calculates statute of limitations
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

// AI Calendar Assistant Page
router.get('/calendar/ai-assistant', requireAuth, async (req, res) => {
    try {
        const suggestionsResult = await db.query(`
            SELECT acs.*, c.title as case_title
            FROM ai_calendar_suggestions acs
            LEFT JOIN cases c ON acs.case_id = c.id
            WHERE acs.user_id = $1
            ORDER BY acs.created_at DESC
            LIMIT 30
        `, [req.user.id]);

        const statsResult = await db.query(`
            SELECT
                COUNT(*) as total_suggestions,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
                COUNT(CASE WHEN is_critical = true THEN 1 END) as critical_count
            FROM ai_calendar_suggestions
            WHERE user_id = $1
        `, [req.user.id]);

        const solResult = await db.query(`
            SELECT DISTINCT jurisdiction, case_type
            FROM statute_of_limitations
            ORDER BY jurisdiction, case_type
        `);

        res.render('calendar/ai-assistant', {
            title: 'AI Calendar Assistant',
            suggestions: suggestionsResult.rows,
            stats: statsResult.rows[0],
            jurisdictions: [...new Set(solResult.rows.map(r => r.jurisdiction))],
            req
        });
    } catch (error) {
        console.error('AI calendar error:', error);
        res.status(500).render('error', { message: 'Error loading AI calendar' });
    }
});

// =====================================================
// API ROUTES
// =====================================================

// Extract deadlines from document
router.post('/api/ai-calendar/extract-deadlines', requireAuth, async (req, res) => {
    try {
        const { case_id, document_text, document_type, jurisdiction } = req.body;

        if (!document_text || document_text.length < 50) {
            return res.status(400).json({ error: 'Document text too short' });
        }

        const startTime = Date.now();

        const systemPrompt = `You are a legal calendar assistant. Extract all deadlines and important dates from legal documents.`;

        const userPrompt = `Extract deadlines from this ${document_type || 'legal document'}:

Jurisdiction: ${jurisdiction || 'Not specified'}

Document:
${document_text.substring(0, 10000)}

Identify:
1. Filing deadlines
2. Response deadlines
3. Discovery deadlines
4. Hearing/trial dates
5. Statute of limitations dates
6. Contractual deadlines

Respond in JSON:
{
  "deadlines": [
    {
      "title": "Clear description",
      "date": "YYYY-MM-DD",
      "deadline_type": "filing|response|discovery|hearing|sol|contractual",
      "is_critical": true|false,
      "legal_basis": "Rule or statute reference",
      "warning_days": 7,
      "confidence": 0.0-1.0
    }
  ],
  "reminders": [
    {
      "title": "Reminder description",
      "days_before": 7,
      "related_deadline": "deadline title"
    }
  ]
}`;

        const response = await axios.post(OPENROUTER_API_URL, {
            model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            max_tokens: 2000,
            temperature: 0.1
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.BASE_URL || 'http://localhost:3000',
                'X-Title': 'LegalForms AI Calendar',
                'Content-Type': 'application/json'
            }
        });

        const processingTime = Date.now() - startTime;
        const content = response.data.choices[0].message.content;
        const usage = response.data.usage || {};

        let calendarData;
        try {
            const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
            calendarData = JSON.parse(jsonStr);
        } catch (e) {
            calendarData = { deadlines: [], reminders: [] };
        }

        // Save suggestions
        const savedSuggestions = [];
        for (const deadline of (calendarData.deadlines || [])) {
            const result = await db.query(`
                INSERT INTO ai_calendar_suggestions
                (user_id, case_id, suggestion_type, source_type, extracted_data,
                 suggested_title, suggested_date, suggested_deadline_type, warning_days,
                 is_critical, jurisdiction, legal_basis, confidence_score, model_used, tokens_used)
                VALUES ($1, $2, $3, 'document', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                RETURNING *
            `, [
                req.user.id,
                case_id || null,
                'deadline',
                JSON.stringify(deadline),
                deadline.title,
                deadline.date,
                deadline.deadline_type,
                deadline.warning_days || 7,
                deadline.is_critical || false,
                jurisdiction || null,
                deadline.legal_basis || null,
                deadline.confidence || 0.8,
                response.data.model,
                usage.total_tokens || 0
            ]);
            savedSuggestions.push(result.rows[0]);
        }

        // Log usage
        await db.query(`
            INSERT INTO ai_usage_log
            (user_id, feature, model, input_tokens, output_tokens, total_tokens, response_time_ms, success)
            VALUES ($1, 'calendar_extract', $2, $3, $4, $5, $6, true)
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
            reminders: calendarData.reminders || []
        });

    } catch (error) {
        console.error('Extract deadlines error:', error);
        res.status(500).json({ error: 'Failed to extract deadlines: ' + error.message });
    }
});

// Calculate statute of limitations
router.post('/api/ai-calendar/calculate-sol', requireAuth, async (req, res) => {
    try {
        const { case_id, jurisdiction, case_type, cause_of_action, incident_date, discovery_date } = req.body;

        if (!jurisdiction || !case_type || !incident_date) {
            return res.status(400).json({ error: 'Jurisdiction, case type, and incident date are required' });
        }

        // Look up SOL in database
        const solResult = await db.query(`
            SELECT * FROM statute_of_limitations
            WHERE jurisdiction = $1 AND case_type = $2
            AND ($3 IS NULL OR cause_of_action = $3)
            ORDER BY cause_of_action
            LIMIT 5
        `, [jurisdiction, case_type, cause_of_action || null]);

        if (solResult.rows.length === 0) {
            return res.json({
                success: true,
                found: false,
                message: 'No statute of limitations data found for this jurisdiction and case type'
            });
        }

        const sol = solResult.rows[0];
        const incidentDateObj = new Date(incident_date);
        let effectiveStartDate = incidentDateObj;

        // Apply discovery rule if applicable
        if (sol.discovery_rule && discovery_date) {
            const discoveryDateObj = new Date(discovery_date);
            if (discoveryDateObj > incidentDateObj) {
                effectiveStartDate = discoveryDateObj;
            }
        }

        // Calculate deadline
        const deadlineDate = new Date(effectiveStartDate);
        deadlineDate.setDate(deadlineDate.getDate() + sol.limitation_period_days);

        // Calculate days remaining
        const today = new Date();
        const daysRemaining = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));

        // Create suggestion
        const suggestionResult = await db.query(`
            INSERT INTO ai_calendar_suggestions
            (user_id, case_id, suggestion_type, source_type, extracted_data,
             suggested_title, suggested_date, suggested_deadline_type, warning_days,
             is_critical, jurisdiction, legal_basis, confidence_score)
            VALUES ($1, $2, 'sol_reminder', 'calculation', $3, $4, $5, 'sol', 30, $6, $7, $8, 1.0)
            RETURNING *
        `, [
            req.user.id,
            case_id || null,
            JSON.stringify({
                incident_date,
                discovery_date,
                limitation_period_days: sol.limitation_period_days,
                discovery_rule_applied: sol.discovery_rule && discovery_date
            }),
            `Statute of Limitations: ${sol.cause_of_action}`,
            deadlineDate.toISOString().split('T')[0],
            daysRemaining < 90,
            jurisdiction,
            sol.statutory_reference || `${jurisdiction} ${case_type} - ${sol.limitation_period_text}`
        ]);

        res.json({
            success: true,
            found: true,
            sol: {
                jurisdiction,
                caseType: case_type,
                causeOfAction: sol.cause_of_action,
                periodDays: sol.limitation_period_days,
                periodText: sol.limitation_period_text,
                discoveryRule: sol.discovery_rule,
                statutoryReference: sol.statutory_reference
            },
            calculation: {
                incidentDate: incident_date,
                discoveryDate: discovery_date || null,
                effectiveStartDate: effectiveStartDate.toISOString().split('T')[0],
                deadlineDate: deadlineDate.toISOString().split('T')[0],
                daysRemaining,
                isCritical: daysRemaining < 90
            },
            suggestion: suggestionResult.rows[0]
        });

    } catch (error) {
        console.error('Calculate SOL error:', error);
        res.status(500).json({ error: 'Failed to calculate statute of limitations' });
    }
});

// Accept calendar suggestion
router.post('/api/ai-calendar/suggestions/:id/accept', requireAuth, async (req, res) => {
    try {
        const suggestionResult = await db.query(
            'SELECT * FROM ai_calendar_suggestions WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (suggestionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Suggestion not found' });
        }

        const suggestion = suggestionResult.rows[0];

        // Create calendar event or deadline
        if (suggestion.suggested_deadline_type === 'hearing' || suggestion.suggested_deadline_type === 'trial') {
            // Create calendar event
            const eventResult = await db.query(`
                INSERT INTO calendar_events
                (user_id, case_id, title, event_date, event_type, all_day)
                VALUES ($1, $2, $3, $4, $5, true)
                RETURNING *
            `, [
                req.user.id,
                suggestion.case_id,
                suggestion.suggested_title,
                suggestion.suggested_date,
                suggestion.suggested_deadline_type
            ]);

            await db.query(`
                UPDATE ai_calendar_suggestions
                SET status = 'accepted', applied_event_id = $1
                WHERE id = $2
            `, [eventResult.rows[0].id, req.params.id]);

            res.json({ success: true, event: eventResult.rows[0] });
        } else {
            // Create deadline
            const deadlineResult = await db.query(`
                INSERT INTO deadlines
                (user_id, case_id, title, deadline_date, deadline_type, warning_days, is_critical)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `, [
                req.user.id,
                suggestion.case_id,
                suggestion.suggested_title,
                suggestion.suggested_date,
                suggestion.suggested_deadline_type,
                suggestion.warning_days || 7,
                suggestion.is_critical || false
            ]);

            await db.query(`
                UPDATE ai_calendar_suggestions
                SET status = 'accepted', applied_deadline_id = $1
                WHERE id = $2
            `, [deadlineResult.rows[0].id, req.params.id]);

            res.json({ success: true, deadline: deadlineResult.rows[0] });
        }

    } catch (error) {
        console.error('Accept suggestion error:', error);
        res.status(500).json({ error: 'Failed to accept suggestion' });
    }
});

// Reject suggestion
router.post('/api/ai-calendar/suggestions/:id/reject', requireAuth, async (req, res) => {
    try {
        await db.query(`
            UPDATE ai_calendar_suggestions
            SET status = 'rejected'
            WHERE id = $1 AND user_id = $2
        `, [req.params.id, req.user.id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Reject suggestion error:', error);
        res.status(500).json({ error: 'Failed to reject suggestion' });
    }
});

// Get SOL database
router.get('/api/ai-calendar/sol-database', requireAuth, async (req, res) => {
    try {
        const { jurisdiction, case_type } = req.query;

        let query = 'SELECT * FROM statute_of_limitations WHERE 1=1';
        const params = [];

        if (jurisdiction) {
            params.push(jurisdiction);
            query += ` AND jurisdiction = $${params.length}`;
        }

        if (case_type) {
            params.push(case_type);
            query += ` AND case_type = $${params.length}`;
        }

        query += ' ORDER BY jurisdiction, case_type, cause_of_action';

        const result = await db.query(query, params);

        res.json({ success: true, statutes: result.rows });
    } catch (error) {
        console.error('Get SOL database error:', error);
        res.status(500).json({ error: 'Failed to get SOL data' });
    }
});

// Get pending suggestions
router.get('/api/ai-calendar/suggestions', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT acs.*, c.title as case_title
            FROM ai_calendar_suggestions acs
            LEFT JOIN cases c ON acs.case_id = c.id
            WHERE acs.user_id = $1 AND acs.status = 'pending'
            ORDER BY acs.is_critical DESC, acs.suggested_date ASC
        `, [req.user.id]);

        res.json({ success: true, suggestions: result.rows });
    } catch (error) {
        console.error('Get suggestions error:', error);
        res.status(500).json({ error: 'Failed to get suggestions' });
    }
});

module.exports = router;

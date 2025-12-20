const express = require('express');
const router = express.Router();
const db = require('../database/db');
const axios = require('axios');
const { requireAuth } = require('../middleware/auth');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// AI Communications Dashboard
router.get('/ai-drafts', requireAuth, async (req, res) => {
    try {
        const drafts = await db.query(`
            SELECT md.*, c.name as client_name
            FROM ai_message_drafts md
            LEFT JOIN clients c ON md.client_id = c.id
            WHERE md.user_id = $1
            ORDER BY md.created_at DESC
            LIMIT 30
        `, [req.session.user.id]);

        const stats = await db.query(`
            SELECT
                COUNT(*) as total_drafts,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_count
            FROM ai_message_drafts WHERE user_id = $1
        `, [req.session.user.id]);

        const clients = await db.query(`
            SELECT id, name, email FROM clients
            WHERE user_id = $1 ORDER BY name
        `, [req.session.user.id]);

        res.render('communications/ai-drafts', {
            drafts: drafts.rows,
            stats: stats.rows[0] || {},
            clients: clients.rows,
            active: 'messages'
        });
    } catch (error) {
        console.error('AI drafts error:', error);
        res.render('error', { message: 'Failed to load AI drafts' });
    }
});

// API: Generate Email Draft
router.post('/api/ai-communications/draft-email', requireAuth, async (req, res) => {
    const startTime = Date.now();
    try {
        const { client_id, subject, context, tone = 'professional', draft_type = 'email' } = req.body;

        if (!context) {
            return res.status(400).json({ success: false, error: 'Context is required' });
        }

        // Get client info if provided
        let clientInfo = null;
        if (client_id) {
            const client = await db.query(`
                SELECT name, email FROM clients WHERE id = $1 AND user_id = $2
            `, [client_id, req.session.user.id]);
            if (client.rows.length > 0) {
                clientInfo = client.rows[0];
            }
        }

        const toneGuide = {
            professional: 'Use a formal, professional tone appropriate for legal correspondence.',
            friendly: 'Use a warm but professional tone that builds rapport.',
            empathetic: 'Use a compassionate, understanding tone while maintaining professionalism.',
            urgent: 'Convey urgency and importance while remaining professional.',
            formal: 'Use highly formal legal language appropriate for official communications.'
        };

        const systemPrompt = `You are an experienced legal communications specialist. Draft professional legal correspondence.

${toneGuide[tone] || toneGuide.professional}

Guidelines:
- Be clear, concise, and professional
- Avoid legal jargon unless necessary
- Ensure the message is complete and actionable
- Include appropriate greetings and closings
- Maintain attorney-client privilege considerations

Respond with JSON:
{
    "subject_line": "Email subject line",
    "body": "Full email body with proper formatting",
    "key_points": ["list of key points covered"],
    "follow_up_actions": ["suggested follow-up actions"]
}`;

        const userPrompt = `Draft a ${draft_type} with the following details:

${clientInfo ? `Recipient: ${clientInfo.name}` : ''}
${subject ? `Subject/Topic: ${subject}` : ''}
Tone: ${tone}

Context/Instructions:
${context}

Please draft an appropriate ${draft_type}.`;

        const response = await axios.post(OPENROUTER_API_URL, {
            model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            max_tokens: 2000,
            temperature: 0.4
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.BASE_URL || 'http://localhost:3000',
                'X-Title': 'LegalForms AI - Communications',
                'Content-Type': 'application/json'
            }
        });

        const aiContent = response.data.choices[0].message.content;
        let draftResult;

        try {
            const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
            draftResult = JSON.parse(jsonMatch[0]);
        } catch (e) {
            draftResult = {
                subject_line: subject || 'Legal Correspondence',
                body: aiContent,
                key_points: [],
                follow_up_actions: []
            };
        }

        // Save draft
        const savedDraft = await db.query(`
            INSERT INTO ai_message_drafts
            (user_id, client_id, draft_type, original_content, ai_draft, subject_line,
             tone, key_points, follow_up_actions, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
            RETURNING *
        `, [
            req.session.user.id,
            client_id || null,
            draft_type,
            context,
            draftResult.body,
            draftResult.subject_line,
            tone,
            JSON.stringify(draftResult.key_points || []),
            JSON.stringify(draftResult.follow_up_actions || [])
        ]);

        // Log AI usage
        const responseTime = Date.now() - startTime;
        const usage = response.data.usage || {};
        await db.query(`
            INSERT INTO ai_usage_log
            (user_id, feature, model, input_tokens, output_tokens, total_tokens,
             cost_estimate, response_time_ms, success)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
            req.session.user.id,
            'ai_communications',
            response.data.model || 'anthropic/claude-sonnet-4',
            usage.prompt_tokens || 0,
            usage.completion_tokens || 0,
            usage.total_tokens || 0,
            (usage.total_tokens || 0) * 0.000003,
            responseTime,
            true
        ]);

        res.json({
            success: true,
            draft: savedDraft.rows[0],
            result: draftResult
        });

    } catch (error) {
        console.error('Draft email error:', error);
        res.status(500).json({ success: false, error: 'Failed to generate draft' });
    }
});

// API: Classify Message
router.post('/api/ai-communications/classify', requireAuth, async (req, res) => {
    const startTime = Date.now();
    try {
        const { message_content, message_id } = req.body;

        if (!message_content) {
            return res.status(400).json({ success: false, error: 'Message content is required' });
        }

        const systemPrompt = `You are a legal message classifier. Analyze the incoming message and classify it.

Respond with JSON:
{
    "category": "inquiry|update|urgent|complaint|document_request|scheduling|payment|general",
    "confidence": 0.0-1.0,
    "sentiment": "positive|neutral|negative",
    "urgency_level": "low|medium|high|critical",
    "suggested_action": "Brief description of recommended next step",
    "key_topics": ["list of main topics"],
    "requires_response": true/false,
    "suggested_response_time": "immediate|same_day|within_week|no_rush"
}`;

        const response = await axios.post(OPENROUTER_API_URL, {
            model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Classify this message:\n\n${message_content}` }
            ],
            max_tokens: 500,
            temperature: 0.1
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.BASE_URL || 'http://localhost:3000',
                'X-Title': 'LegalForms AI - Message Classification',
                'Content-Type': 'application/json'
            }
        });

        const aiContent = response.data.choices[0].message.content;
        let classification;

        try {
            const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
            classification = JSON.parse(jsonMatch[0]);
        } catch (e) {
            classification = {
                category: 'general',
                confidence: 0.5,
                sentiment: 'neutral',
                urgency_level: 'medium',
                suggested_action: 'Review and respond as appropriate'
            };
        }

        // Save classification if message_id provided
        if (message_id) {
            await db.query(`
                INSERT INTO message_classifications
                (message_id, category, confidence, sentiment, urgency_level, suggested_action, key_topics)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (message_id) DO UPDATE SET
                    category = EXCLUDED.category,
                    confidence = EXCLUDED.confidence,
                    sentiment = EXCLUDED.sentiment,
                    urgency_level = EXCLUDED.urgency_level,
                    suggested_action = EXCLUDED.suggested_action
            `, [
                message_id,
                classification.category,
                classification.confidence,
                classification.sentiment,
                classification.urgency_level,
                classification.suggested_action,
                JSON.stringify(classification.key_topics || [])
            ]);
        }

        // Log AI usage
        const responseTime = Date.now() - startTime;
        const usage = response.data.usage || {};
        await db.query(`
            INSERT INTO ai_usage_log
            (user_id, feature, model, input_tokens, output_tokens, total_tokens,
             cost_estimate, response_time_ms, success)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
            req.session.user.id,
            'message_classification',
            response.data.model || 'anthropic/claude-sonnet-4',
            usage.prompt_tokens || 0,
            usage.completion_tokens || 0,
            usage.total_tokens || 0,
            (usage.total_tokens || 0) * 0.000003,
            responseTime,
            true
        ]);

        res.json({ success: true, classification });

    } catch (error) {
        console.error('Message classification error:', error);
        res.status(500).json({ success: false, error: 'Failed to classify message' });
    }
});

// API: Edit Draft
router.put('/api/ai-communications/draft/:id', requireAuth, async (req, res) => {
    try {
        const { body, subject_line } = req.body;

        await db.query(`
            UPDATE ai_message_drafts
            SET ai_draft = $1, subject_line = $2, updated_at = NOW()
            WHERE id = $3 AND user_id = $4
        `, [body, subject_line, req.params.id, req.session.user.id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Edit draft error:', error);
        res.status(500).json({ success: false, error: 'Failed to update draft' });
    }
});

// API: Mark Draft as Sent
router.post('/api/ai-communications/draft/:id/send', requireAuth, async (req, res) => {
    try {
        await db.query(`
            UPDATE ai_message_drafts
            SET status = 'sent', sent_at = NOW()
            WHERE id = $1 AND user_id = $2
        `, [req.params.id, req.session.user.id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Mark sent error:', error);
        res.status(500).json({ success: false, error: 'Failed to mark as sent' });
    }
});

// API: Delete Draft
router.delete('/api/ai-communications/draft/:id', requireAuth, async (req, res) => {
    try {
        await db.query(`
            DELETE FROM ai_message_drafts WHERE id = $1 AND user_id = $2
        `, [req.params.id, req.session.user.id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete draft error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete draft' });
    }
});

module.exports = router;

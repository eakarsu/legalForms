/**
 * Portal AI Chatbot Routes
 * Client-facing AI assistant with safety restrictions
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const axios = require('axios');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Portal authentication middleware
const requirePortalAuth = async (req, res, next) => {
    try {
        if (!req.session.portalClientId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const clientResult = await db.query(
            'SELECT * FROM clients WHERE id = $1',
            [req.session.portalClientId]
        );

        if (clientResult.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid session' });
        }

        req.portalClient = clientResult.rows[0];
        next();
    } catch (error) {
        console.error('Portal auth error:', error);
        res.status(500).json({ error: 'Authentication error' });
    }
};

// Shareable case fields (non-privileged)
const SHAREABLE_FIELDS = ['status', 'case_type', 'date_opened', 'next_hearing_date'];

// =====================================================
// PAGE ROUTES (Portal)
// =====================================================

// Chat interface page
router.get('/portal/ai/chat', requirePortalAuth, async (req, res) => {
    try {
        // Get client's cases
        const casesResult = await db.query(
            'SELECT id, case_number, title, status FROM cases WHERE client_id = $1',
            [req.portalClient.id]
        );

        // Get recent chat messages
        const messagesResult = await db.query(`
            SELECT pcm.* FROM portal_chat_messages pcm
            JOIN portal_chat_sessions pcs ON pcm.session_id = pcs.id
            WHERE pcs.client_id = $1
            ORDER BY pcm.created_at DESC
            LIMIT 50
        `, [req.portalClient.id]);

        res.render('portal/ai-chat', {
            title: 'AI Assistant',
            client: req.portalClient,
            cases: casesResult.rows,
            messages: messagesResult.rows.reverse(),
            req
        });
    } catch (error) {
        console.error('Chat page error:', error);
        res.status(500).render('error', { message: 'Error loading chat' });
    }
});

// =====================================================
// API ROUTES
// =====================================================

// Send message and get AI response
router.post('/portal/api/ai/chat', requirePortalAuth, async (req, res) => {
    try {
        const { message, case_id } = req.body;

        if (!message || message.trim().length < 2) {
            return res.status(400).json({ error: 'Message too short' });
        }

        // Get or create session
        let sessionResult = await db.query(`
            SELECT * FROM portal_chat_sessions
            WHERE client_id = $1 AND status = 'active'
            ORDER BY created_at DESC LIMIT 1
        `, [req.portalClient.id]);

        let session;
        if (sessionResult.rows.length === 0) {
            sessionResult = await db.query(`
                INSERT INTO portal_chat_sessions (client_id, case_id, status)
                VALUES ($1, $2, 'active')
                RETURNING *
            `, [req.portalClient.id, case_id || null]);
        }
        session = sessionResult.rows[0];

        // Save client message
        await db.query(`
            INSERT INTO portal_chat_messages (session_id, sender_type, sender_id, content)
            VALUES ($1, 'client', $2, $3)
        `, [session.id, req.portalClient.id, message]);

        // Get case context (if case selected)
        let caseContext = '';
        if (case_id) {
            const caseResult = await db.query(
                'SELECT case_number, title, case_type, status FROM cases WHERE id = $1 AND client_id = $2',
                [case_id, req.portalClient.id]
            );
            if (caseResult.rows.length > 0) {
                const c = caseResult.rows[0];
                caseContext = `\nCurrent Case: ${c.title} (${c.case_number}) - Status: ${c.status}`;
            }
        }

        // Get knowledge base
        const kbResult = await db.query(`
            SELECT question, answer FROM portal_ai_knowledge_base
            WHERE is_active = true
            ORDER BY priority DESC
            LIMIT 10
        `);

        const kbContext = kbResult.rows.length > 0
            ? `\n\nFAQ Knowledge:\n${kbResult.rows.map(k => `Q: ${k.question}\nA: ${k.answer}`).join('\n\n')}`
            : '';

        const startTime = Date.now();

        // Build system prompt with restrictions
        const systemPrompt = `You are a professional legal assistant helping clients of a law firm access information about their cases.

CLIENT: ${req.portalClient.first_name} ${req.portalClient.last_name}
${caseContext}

YOUR CAPABILITIES:
1. Answer questions about case status
2. Explain billing and invoices
3. Provide general process information
4. Help navigate the portal
5. Schedule callbacks when needed

CRITICAL RESTRICTIONS:
- NEVER provide legal advice
- NEVER predict case outcomes
- NEVER discuss privileged information or strategy
- NEVER share info about other clients
- If uncertain, offer to escalate to the attorney

${kbContext}

Keep responses concise (2-3 paragraphs max). Be professional yet approachable.
For complex questions, say: "I'd recommend discussing this with your attorney. Would you like me to request a callback?"`;

        const response = await axios.post(OPENROUTER_API_URL, {
            model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message }
            ],
            max_tokens: 500,
            temperature: 0.4
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.BASE_URL || 'http://localhost:3000',
                'X-Title': 'LegalForms Portal Chat',
                'Content-Type': 'application/json'
            }
        });

        const processingTime = Date.now() - startTime;
        const aiMessage = response.data.choices[0].message.content;
        const usage = response.data.usage || {};

        // Save AI response
        await db.query(`
            INSERT INTO portal_chat_messages (session_id, sender_type, content, ai_confidence, metadata)
            VALUES ($1, 'ai', $2, $3, $4)
        `, [
            session.id,
            aiMessage,
            0.9,
            JSON.stringify({ model: response.data.model, tokens: usage.total_tokens })
        ]);

        // Log usage (use attorney's user_id from the case)
        const caseOwner = case_id ? await db.query('SELECT user_id FROM cases WHERE id = $1', [case_id]) : null;
        const userId = caseOwner?.rows[0]?.user_id || null;

        if (userId) {
            await db.query(`
                INSERT INTO ai_usage_log
                (user_id, feature, model, input_tokens, output_tokens, total_tokens, response_time_ms, success)
                VALUES ($1, 'portal_chatbot', $2, $3, $4, $5, $6, true)
            `, [
                userId,
                response.data.model,
                usage.prompt_tokens || 0,
                usage.completion_tokens || 0,
                usage.total_tokens || 0,
                processingTime
            ]);
        }

        res.json({
            success: true,
            message: aiMessage,
            sessionId: session.id
        });

    } catch (error) {
        console.error('Portal chat error:', error);
        res.status(500).json({ error: 'Failed to process message' });
    }
});

// Request escalation to attorney
router.post('/portal/api/ai/chat/escalate', requirePortalAuth, async (req, res) => {
    try {
        const { session_id, reason, message_id } = req.body;

        // Get session
        const sessionResult = await db.query(
            'SELECT * FROM portal_chat_sessions WHERE id = $1 AND client_id = $2',
            [session_id, req.portalClient.id]
        );

        if (sessionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Find attorney (from linked case)
        const session = sessionResult.rows[0];
        let attorneyId = null;

        if (session.case_id) {
            const caseResult = await db.query('SELECT user_id FROM cases WHERE id = $1', [session.case_id]);
            attorneyId = caseResult.rows[0]?.user_id;
        }

        if (!attorneyId) {
            // Fall back to finding any attorney linked to client
            const clientCaseResult = await db.query(
                'SELECT user_id FROM cases WHERE client_id = $1 LIMIT 1',
                [req.portalClient.id]
            );
            attorneyId = clientCaseResult.rows[0]?.user_id;
        }

        if (!attorneyId) {
            return res.status(400).json({ error: 'No attorney found to escalate to' });
        }

        // Create escalation
        await db.query(`
            INSERT INTO portal_chat_escalations
            (session_id, client_id, attorney_id, message_id, reason, priority, status)
            VALUES ($1, $2, $3, $4, $5, 'normal', 'pending')
        `, [session_id, req.portalClient.id, attorneyId, message_id || null, reason || 'Client requested assistance']);

        // Update session
        await db.query(`
            UPDATE portal_chat_sessions
            SET status = 'escalated', escalated_at = CURRENT_TIMESTAMP, escalated_to = $1, escalation_reason = $2
            WHERE id = $3
        `, [attorneyId, reason, session_id]);

        res.json({
            success: true,
            message: 'Your request has been sent to your attorney. They will respond shortly.'
        });

    } catch (error) {
        console.error('Escalation error:', error);
        res.status(500).json({ error: 'Failed to escalate' });
    }
});

// Get chat history
router.get('/portal/api/ai/chat/history', requirePortalAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT pcm.* FROM portal_chat_messages pcm
            JOIN portal_chat_sessions pcs ON pcm.session_id = pcs.id
            WHERE pcs.client_id = $1
            ORDER BY pcm.created_at DESC
            LIMIT 100
        `, [req.portalClient.id]);

        res.json({ success: true, messages: result.rows.reverse() });
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ error: 'Failed to get history' });
    }
});

module.exports = router;

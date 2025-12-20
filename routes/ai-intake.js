const express = require('express');
const router = express.Router();
const db = require('../database/db');
const axios = require('axios');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Public AI Intake Form
router.get('/ai/:token', async (req, res) => {
    try {
        const form = await db.query(`
            SELECT * FROM intake_forms WHERE public_link = $1 AND is_active = true
        `, [req.params.token]);

        if (form.rows.length === 0) {
            return res.render('intake/not-found');
        }

        // Create or get session
        let session = await db.query(`
            SELECT * FROM ai_intake_sessions
            WHERE form_id = $1 AND session_token = $2
        `, [form.rows[0].id, req.sessionID]);

        if (session.rows.length === 0) {
            session = await db.query(`
                INSERT INTO ai_intake_sessions
                (form_id, session_token, conversation_state, collected_data)
                VALUES ($1, $2, 'introduction', '{}')
                RETURNING *
            `, [form.rows[0].id, req.sessionID]);
        }

        res.render('intake/ai-form', {
            form: form.rows[0],
            session: session.rows[0],
            layout: false
        });
    } catch (error) {
        console.error('AI intake error:', error);
        res.render('error', { message: 'Failed to load intake form' });
    }
});

// API: Chat with AI Intake
router.post('/api/ai-intake/chat', async (req, res) => {
    const startTime = Date.now();
    try {
        const { session_id, message } = req.body;

        // Get session
        const session = await db.query(`
            SELECT ais.*, if.title as form_title, if.user_id,
                   if.practice_areas, if.required_fields
            FROM ai_intake_sessions ais
            JOIN intake_forms if ON ais.form_id = if.id
            WHERE ais.id = $1
        `, [session_id]);

        if (session.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Session not found' });
        }

        const sessionData = session.rows[0];
        const collectedData = sessionData.collected_data || {};
        const requiredFields = sessionData.required_fields || ['name', 'email', 'phone', 'issue'];

        // Build conversation history
        const history = await db.query(`
            SELECT question_text, response, sender
            FROM ai_intake_questions
            WHERE session_id = $1
            ORDER BY created_at
        `, [session_id]);

        const conversationHistory = history.rows.flatMap(h => [
            { role: 'assistant', content: h.question_text },
            { role: 'user', content: h.response }
        ]).filter(m => m.content);

        const systemPrompt = `You are a friendly and professional legal intake assistant for a law firm.
Your job is to gather information from potential clients in a conversational way.

Form: ${sessionData.form_title}
Practice Areas: ${JSON.stringify(sessionData.practice_areas || ['General'])}

Required information to collect:
- Name
- Email
- Phone number
- Brief description of their legal issue
- How they heard about the firm (optional)

Already collected: ${JSON.stringify(collectedData)}

Guidelines:
1. Be warm, professional, and empathetic
2. Ask one question at a time
3. Acknowledge their responses before asking the next question
4. If they share concerning legal details, reassure them that an attorney will review
5. Never provide legal advice - only gather information
6. If they seem distressed, be especially compassionate
7. When you have all required info, thank them and let them know someone will be in touch

Respond with JSON:
{
    "message": "Your conversational response",
    "extracted_data": {"field": "value"} or null,
    "is_complete": true/false,
    "lead_score": 0-100 based on quality of lead,
    "qualification_notes": "Notes about the lead quality"
}`;

        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory,
            { role: 'user', content: message }
        ];

        const response = await axios.post(OPENROUTER_API_URL, {
            model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
            messages: messages,
            max_tokens: 500,
            temperature: 0.7
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.BASE_URL || 'http://localhost:3000',
                'X-Title': 'LegalForms AI - Intake',
                'Content-Type': 'application/json'
            }
        });

        const aiContent = response.data.choices[0].message.content;
        let aiResponse;

        try {
            const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
            aiResponse = JSON.parse(jsonMatch[0]);
        } catch (e) {
            aiResponse = {
                message: aiContent,
                extracted_data: null,
                is_complete: false
            };
        }

        // Save the exchange
        await db.query(`
            INSERT INTO ai_intake_questions
            (session_id, question_text, response, sender)
            VALUES ($1, $2, $3, 'user')
        `, [session_id, aiResponse.message, message]);

        // Update collected data
        if (aiResponse.extracted_data) {
            const newData = { ...collectedData, ...aiResponse.extracted_data };
            await db.query(`
                UPDATE ai_intake_sessions
                SET collected_data = $1,
                    lead_score = COALESCE($2, lead_score),
                    qualification_status = CASE WHEN $3 THEN 'qualified' ELSE qualification_status END
                WHERE id = $4
            `, [
                JSON.stringify(newData),
                aiResponse.lead_score,
                aiResponse.is_complete,
                session_id
            ]);
        }

        // If complete, create lead
        if (aiResponse.is_complete) {
            const finalData = { ...collectedData, ...aiResponse.extracted_data };

            // Check if lead already created
            const existingLead = await db.query(`
                SELECT id FROM leads WHERE intake_session_id = $1
            `, [session_id]);

            if (existingLead.rows.length === 0 && finalData.email) {
                await db.query(`
                    INSERT INTO leads
                    (user_id, name, email, phone, source, description, intake_session_id, ai_score)
                    VALUES ($1, $2, $3, $4, 'ai_intake', $5, $6, $7)
                `, [
                    sessionData.user_id,
                    finalData.name || 'Unknown',
                    finalData.email,
                    finalData.phone || null,
                    finalData.issue || finalData.description || '',
                    session_id,
                    aiResponse.lead_score || 50
                ]);
            }

            await db.query(`
                UPDATE ai_intake_sessions SET is_completed = true WHERE id = $1
            `, [session_id]);
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
            sessionData.user_id,
            'ai_intake',
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
            message: aiResponse.message,
            is_complete: aiResponse.is_complete
        });

    } catch (error) {
        console.error('AI intake chat error:', error);
        res.status(500).json({ success: false, error: 'Failed to process message' });
    }
});

// API: Get AI Intro Message
router.get('/api/ai-intake/intro/:session_id', async (req, res) => {
    try {
        const session = await db.query(`
            SELECT ais.*, if.title, if.description
            FROM ai_intake_sessions ais
            JOIN intake_forms if ON ais.form_id = if.id
            WHERE ais.id = $1
        `, [req.params.session_id]);

        if (session.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Session not found' });
        }

        const form = session.rows[0];

        const introMessage = `Hello! Welcome to ${form.title}. I'm here to help gather some initial information about your legal needs. This conversation is confidential.

To get started, could you please tell me your name?`;

        // Save intro
        await db.query(`
            INSERT INTO ai_intake_questions
            (session_id, question_text, sender)
            VALUES ($1, $2, 'assistant')
        `, [req.params.session_id, introMessage]);

        res.json({
            success: true,
            message: introMessage
        });

    } catch (error) {
        console.error('AI intro error:', error);
        res.status(500).json({ success: false, error: 'Failed to get intro' });
    }
});

module.exports = router;

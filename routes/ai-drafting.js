/**
 * AI Document Drafting Routes
 * Uses OpenRouter API for AI-powered document generation
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const axios = require('axios');

// OpenRouter configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// =====================================================
// PAGE ROUTES
// =====================================================

// AI Drafting dashboard
router.get('/ai-drafting', requireAuth, async (req, res) => {
    try {
        // Get templates
        const templatesResult = await db.query(`
            SELECT * FROM ai_draft_templates
            WHERE (user_id = $1 OR user_id IS NULL) OR is_public = true
            ORDER BY usage_count DESC
            LIMIT 20
        `, [req.user.id]);

        // Get recent sessions
        const sessionsResult = await db.query(`
            SELECT ads.*, adt.name as template_name, c.first_name, c.last_name
            FROM ai_draft_sessions ads
            LEFT JOIN ai_draft_templates adt ON ads.template_id = adt.id
            LEFT JOIN clients c ON ads.client_id = c.id
            WHERE (ads.user_id = $1 OR ads.user_id IS NULL)
            ORDER BY ads.updated_at DESC
            LIMIT 10
        `, [req.user.id]);

        // Usage stats
        const statsResult = await db.query(`
            SELECT
                COUNT(*) as total_drafts,
                COALESCE(SUM(total_tokens), 0) as total_tokens,
                COALESCE(SUM(cost_estimate), 0) as total_cost
            FROM ai_usage_log
            WHERE (user_id = $1 OR user_id IS NULL) AND feature = 'document_draft'
            AND created_at >= NOW() - INTERVAL '30 days'
        `, [req.user.id]);

        res.render('ai-drafting/dashboard', {
            title: 'AI Document Drafting',
            templates: templatesResult.rows,
            sessions: sessionsResult.rows,
            stats: statsResult.rows[0],
            req
        });
    } catch (error) {
        console.error('AI drafting dashboard error:', error);
        res.status(500).render('error', { message: 'Error loading AI drafting' });
    }
});

// New draft page
router.get('/ai-drafting/new', requireAuth, async (req, res) => {
    try {
        const templatesResult = await db.query(`
            SELECT * FROM ai_draft_templates
            WHERE (user_id = $1 OR user_id IS NULL) OR is_public = true
            ORDER BY category, name
        `, [req.user.id]);

        const clientsResult = await db.query(
            'SELECT id, first_name, last_name, company_name FROM clients WHERE (user_id = $1 OR user_id IS NULL) ORDER BY last_name',
            [req.user.id]
        );

        const casesResult = await db.query(
            'SELECT id, case_number, title FROM cases WHERE (user_id = $1 OR user_id IS NULL) ORDER BY created_at DESC',
            [req.user.id]
        );

        res.render('ai-drafting/new', {
            title: 'Create AI Draft',
            templates: templatesResult.rows,
            clients: clientsResult.rows,
            cases: casesResult.rows,
            templateId: req.query.template,
            req
        });
    } catch (error) {
        console.error('New AI draft error:', error);
        res.status(500).render('error', { message: 'Error loading form' });
    }
});

// Templates list
router.get('/ai-drafting/templates', requireAuth, async (req, res) => {
    try {
        const templatesResult = await db.query(`
            SELECT * FROM ai_draft_templates
            WHERE (user_id = $1 OR user_id IS NULL) OR is_public = true
            ORDER BY category, name
        `, [req.user.id]);

        res.render('ai-drafting/templates', {
            title: 'AI Drafting Templates',
            templates: templatesResult.rows,
            req
        });
    } catch (error) {
        console.error('Templates list error:', error);
        res.status(500).render('error', { message: 'Error loading templates' });
    }
});

// Sessions list
router.get('/ai-drafting/sessions', requireAuth, async (req, res) => {
    try {
        const sessionsResult = await db.query(`
            SELECT ads.*, adt.name as template_name, c.first_name, c.last_name, cs.title as case_title
            FROM ai_draft_sessions ads
            LEFT JOIN ai_draft_templates adt ON ads.template_id = adt.id
            LEFT JOIN clients c ON ads.client_id = c.id
            LEFT JOIN cases cs ON ads.case_id = cs.id
            WHERE (ads.user_id = $1 OR ads.user_id IS NULL)
            ORDER BY ads.updated_at DESC
        `, [req.user.id]);

        res.render('ai-drafting/sessions', {
            title: 'AI Drafting Sessions',
            sessions: sessionsResult.rows,
            req
        });
    } catch (error) {
        console.error('Sessions list error:', error);
        res.status(500).render('error', { message: 'Error loading sessions' });
    }
});

// View draft session
router.get('/ai-drafting/sessions/:id', requireAuth, async (req, res) => {
    try {
        const sessionResult = await db.query(`
            SELECT ads.*, adt.name as template_name, c.first_name, c.last_name, cs.title as case_title
            FROM ai_draft_sessions ads
            LEFT JOIN ai_draft_templates adt ON ads.template_id = adt.id
            LEFT JOIN clients c ON ads.client_id = c.id
            LEFT JOIN cases cs ON ads.case_id = cs.id
            WHERE ads.id = $1 AND (ads.user_id = $2 OR ads.user_id IS NULL)
        `, [req.params.id, req.user.id]);

        if (sessionResult.rows.length === 0) {
            return res.status(404).render('error', { message: 'Session not found' });
        }

        const versionsResult = await db.query(`
            SELECT * FROM ai_draft_versions
            WHERE session_id = $1
            ORDER BY version_number DESC
        `, [req.params.id]);

        res.render('ai-drafting/session', {
            title: sessionResult.rows[0].title || 'AI Draft Session',
            session: sessionResult.rows[0],
            versions: versionsResult.rows,
            req
        });
    } catch (error) {
        console.error('View session error:', error);
        res.status(500).render('error', { message: 'Error loading session' });
    }
});

// =====================================================
// API ROUTES
// =====================================================

// Generate AI draft
router.post('/api/ai-drafting/generate', requireAuth, async (req, res) => {
    console.log('AI Generate - Request received');

    try {
        const { template_id, client_id, case_id, title, input_data, custom_prompt, prompt, style, length, context, include_citations, review_mode } = req.body;

        console.log('AI Generate - Params:', { template_id, title, hasPrompt: !!prompt, style, length });

        // Get template if specified (accept both 'prompt' and 'custom_prompt' from frontend)
        let promptTemplate = custom_prompt || prompt;
        let templateName = 'Custom';

        if (template_id) {
            const templateResult = await db.query(
                'SELECT * FROM ai_draft_templates WHERE id = $1',
                [template_id]
            );

            if (templateResult.rows.length > 0) {
                promptTemplate = templateResult.rows[0].prompt_template;
                templateName = templateResult.rows[0].name;

                // Update usage count
                await db.query(
                    'UPDATE ai_draft_templates SET usage_count = usage_count + 1 WHERE id = $1',
                    [template_id]
                );
            }
        }

        // Build the prompt with style options
        let finalPrompt = promptTemplate || '';
        if (input_data) {
            Object.entries(input_data).forEach(([key, value]) => {
                finalPrompt = finalPrompt.replace(new RegExp(`{{${key}}}`, 'g'), value);
            });
        }

        // Add user-provided context
        if (context) {
            finalPrompt += `\n\nAdditional Context:\n${context}`;
        }

        // Add style instructions
        const styleInstructions = {
            formal: 'Use formal, professional legal language.',
            persuasive: 'Use persuasive language to advocate effectively.',
            neutral: 'Use neutral, objective language.',
            firm: 'Use firm, assertive language.'
        };
        if (style && styleInstructions[style]) {
            finalPrompt += `\n\nStyle: ${styleInstructions[style]}`;
        }

        // Add length instructions
        const lengthInstructions = {
            concise: 'Keep the document brief and to the point.',
            standard: 'Use standard document length.',
            detailed: 'Provide comprehensive, detailed content.'
        };
        if (length && lengthInstructions[length]) {
            finalPrompt += `\nLength: ${lengthInstructions[length]}`;
        }

        if (include_citations) {
            finalPrompt += '\nInclude relevant legal citations where appropriate.';
        }

        if (review_mode) {
            finalPrompt += '\nMark any sections that need attorney review with [REVIEW] markers.';
        }

        // Get client/case context if provided
        let entityContext = '';
        if (client_id) {
            const clientResult = await db.query('SELECT * FROM clients WHERE id = $1', [client_id]);
            if (clientResult.rows.length > 0) {
                const client = clientResult.rows[0];
                entityContext += `\nClient: ${client.first_name} ${client.last_name}`;
                if (client.company_name) entityContext += ` (${client.company_name})`;
            }
        }

        if (case_id) {
            const caseResult = await db.query('SELECT * FROM cases WHERE id = $1', [case_id]);
            if (caseResult.rows.length > 0) {
                const caseData = caseResult.rows[0];
                entityContext += `\nCase: ${caseData.title}`;
                if (caseData.case_type) entityContext += ` (${caseData.case_type})`;
            }
        }

        // Create session
        const sessionResult = await db.query(`
            INSERT INTO ai_draft_sessions (user_id, template_id, client_id, case_id, title, input_data, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'generating')
            RETURNING *
        `, [req.user.id, template_id || null, client_id || null, case_id || null, title || templateName, JSON.stringify(input_data)]);

        const session = sessionResult.rows[0];

        // Call OpenRouter API
        const startTime = Date.now();

        const systemPrompt = `You are a legal document drafting assistant. Generate professional legal documents based on the provided context and requirements.
Be thorough, precise, and follow proper legal document formatting. Include all necessary clauses and provisions.
${entityContext}`;

        const modelToUse = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4';
        console.log('AI Generate - Calling OpenRouter with model:', modelToUse);
        console.log('AI Generate - Prompt length:', finalPrompt?.length || 0);

        const response = await axios.post(OPENROUTER_API_URL, {
            model: modelToUse,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: finalPrompt }
            ],
            max_tokens: 4000,
            temperature: 0.3
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.BASE_URL || 'http://localhost:3000',
                'X-Title': 'LegalForms AI Drafting',
                'Content-Type': 'application/json'
            }
        });

        console.log('AI Generate - OpenRouter response received');

        const generationTime = Date.now() - startTime;
        const aiResponse = response.data;
        const content = aiResponse.choices[0].message.content;
        const usage = aiResponse.usage || {};

        // Get current version count
        const versionCount = await db.query(
            'SELECT COUNT(*) as count FROM ai_draft_versions WHERE session_id = $1',
            [session.id]
        );

        // Save draft version
        await db.query(`
            INSERT INTO ai_draft_versions
            (session_id, version_number, content, prompt_used, model_used, tokens_used, generation_time_ms)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            session.id,
            parseInt(versionCount.rows[0].count) + 1,
            content,
            finalPrompt,
            aiResponse.model || process.env.OPENROUTER_MODEL,
            usage.total_tokens || 0,
            generationTime
        ]);

        // Update session status
        await db.query(
            'UPDATE ai_draft_sessions SET status = $1 WHERE id = $2',
            ['completed', session.id]
        );

        // Log usage
        const inputTokens = usage.prompt_tokens || 0;
        const outputTokens = usage.completion_tokens || 0;
        const costEstimate = (inputTokens * 0.00001) + (outputTokens * 0.00003);

        await db.query(`
            INSERT INTO ai_usage_log
            (user_id, feature, model, input_tokens, output_tokens, total_tokens, cost_estimate, response_time_ms, success)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
        `, [
            req.user.id,
            'document_draft',
            aiResponse.model || process.env.OPENROUTER_MODEL,
            inputTokens,
            outputTokens,
            inputTokens + outputTokens,
            costEstimate,
            generationTime
        ]);

        res.json({
            success: true,
            session: session,
            sessionId: session.id,
            content,
            model: aiResponse.model,
            tokens: usage.total_tokens,
            generationTime
        });

    } catch (error) {
        console.error('AI generation error:', error);
        console.error('Error details:', {
            message: error.message,
            response: error.response?.data,
            stack: error.stack
        });

        // Log failed attempt
        try {
            await db.query(`
                INSERT INTO ai_usage_log (user_id, feature, model, success, error_message)
                VALUES ($1, 'document_draft', $2, false, $3)
            `, [req.user.id, process.env.OPENROUTER_MODEL || 'unknown', error.message]);
        } catch (logError) {
            console.error('Failed to log error:', logError);
        }

        res.status(500).json({ error: 'Failed to generate document: ' + error.message });
    }
});

// Regenerate/revise draft
router.post('/api/ai-drafting/sessions/:id/revise', requireAuth, async (req, res) => {
    try {
        const { revision_instructions } = req.body;

        // Get session and latest version
        const sessionResult = await db.query(`
            SELECT * FROM ai_draft_sessions WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
        `, [req.params.id, req.user.id]);

        if (sessionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const latestVersion = await db.query(`
            SELECT * FROM ai_draft_versions WHERE session_id = $1 ORDER BY version_number DESC LIMIT 1
        `, [req.params.id]);

        if (latestVersion.rows.length === 0) {
            return res.status(400).json({ error: 'No previous version found' });
        }

        const previousContent = latestVersion.rows[0].content;
        const startTime = Date.now();

        // Call OpenRouter for revision
        const response = await axios.post(OPENROUTER_API_URL, {
            model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-opus',
            messages: [
                {
                    role: 'system',
                    content: 'You are a legal document editor. Revise the following document based on the user\'s instructions while maintaining legal accuracy and professionalism.'
                },
                {
                    role: 'user',
                    content: `Original Document:\n${previousContent}\n\nRevision Instructions:\n${revision_instructions}`
                }
            ],
            max_tokens: 4000,
            temperature: 0.3
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.BASE_URL || 'http://localhost:3000',
                'X-Title': 'LegalForms AI Drafting',
                'Content-Type': 'application/json'
            }
        });

        const generationTime = Date.now() - startTime;
        const content = response.data.choices[0].message.content;
        const usage = response.data.usage || {};

        // Save new version
        await db.query(`
            INSERT INTO ai_draft_versions
            (session_id, version_number, content, prompt_used, model_used, tokens_used, generation_time_ms)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            req.params.id,
            parseInt(latestVersion.rows[0].version_number) + 1,
            content,
            `Revision: ${revision_instructions}`,
            response.data.model,
            usage.total_tokens || 0,
            generationTime
        ]);

        // Log usage
        await db.query(`
            INSERT INTO ai_usage_log
            (user_id, feature, model, input_tokens, output_tokens, total_tokens, response_time_ms, success)
            VALUES ($1, 'document_draft', $2, $3, $4, $5, $6, true)
        `, [
            req.user.id,
            response.data.model,
            usage.prompt_tokens || 0,
            usage.completion_tokens || 0,
            usage.total_tokens || 0,
            generationTime
        ]);

        res.json({ success: true, content });

    } catch (error) {
        console.error('AI revision error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to revise document' });
    }
});

// Provide feedback on draft
router.post('/api/ai-drafting/versions/:id/feedback', requireAuth, async (req, res) => {
    try {
        const { feedback, feedback_notes } = req.body;

        await db.query(`
            UPDATE ai_draft_versions SET feedback = $1, feedback_notes = $2
            WHERE id = $3
        `, [feedback, feedback_notes, req.params.id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Feedback error:', error);
        res.status(500).json({ error: 'Failed to save feedback' });
    }
});

// Create template from draft
router.post('/api/ai-drafting/templates', requireAuth, async (req, res) => {
    try {
        const { name, description, category, document_type, prompt_template, variables, is_public } = req.body;

        const result = await db.query(`
            INSERT INTO ai_draft_templates
            (user_id, name, description, category, document_type, prompt_template, variables, is_public)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [req.user.id, name, description, category, document_type, prompt_template, JSON.stringify(variables || []), is_public || false]);

        res.json({ success: true, template: result.rows[0] });
    } catch (error) {
        console.error('Create template error:', error);
        res.status(500).json({ error: 'Failed to create template' });
    }
});

// Get AI usage statistics
router.get('/api/ai-drafting/usage', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                DATE_TRUNC('day', created_at) as date,
                COUNT(*) as requests,
                COALESCE(SUM(total_tokens), 0) as tokens,
                COALESCE(SUM(cost_estimate), 0) as cost
            FROM ai_usage_log
            WHERE (user_id = $1 OR user_id IS NULL) AND created_at >= NOW() - INTERVAL '30 days'
            GROUP BY DATE_TRUNC('day', created_at)
            ORDER BY date DESC
        `, [req.user.id]);

        res.json({ success: true, usage: result.rows });
    } catch (error) {
        console.error('Get usage error:', error);
        res.status(500).json({ error: 'Failed to get usage' });
    }
});

// Save session content
router.post('/api/ai-drafting/sessions/:id/save', requireAuth, async (req, res) => {
    try {
        const { content, title } = req.body;

        // Check session ownership
        const sessionResult = await db.query(
            'SELECT * FROM ai_draft_sessions WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
            [req.params.id, req.user.id]
        );

        if (sessionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Update session
        await db.query(`
            UPDATE ai_draft_sessions SET status = 'saved', title = COALESCE($1, title), updated_at = NOW()
            WHERE id = $2
        `, [title, req.params.id]);

        // If content provided, save as new version
        if (content) {
            const versionCount = await db.query(
                'SELECT COUNT(*) as count FROM ai_draft_versions WHERE session_id = $1',
                [req.params.id]
            );

            await db.query(`
                INSERT INTO ai_draft_versions (session_id, version_number, content, prompt_used)
                VALUES ($1, $2, $3, 'Manual save')
            `, [req.params.id, parseInt(versionCount.rows[0].count) + 1, content]);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Save session error:', error);
        res.status(500).json({ error: 'Failed to save session' });
    }
});

// Regenerate session (alias for revise without instructions)
router.post('/api/ai-drafting/sessions/:id/regenerate', requireAuth, async (req, res) => {
    try {
        const sessionResult = await db.query(`
            SELECT * FROM ai_draft_sessions WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
        `, [req.params.id, req.user.id]);

        if (sessionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const latestVersion = await db.query(`
            SELECT * FROM ai_draft_versions WHERE session_id = $1 ORDER BY version_number DESC LIMIT 1
        `, [req.params.id]);

        const previousContent = latestVersion.rows.length > 0 ? latestVersion.rows[0].content : '';
        const startTime = Date.now();

        const response = await axios.post(OPENROUTER_API_URL, {
            model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-opus',
            messages: [
                {
                    role: 'system',
                    content: 'You are a legal document drafting assistant. Regenerate an improved version of this document while maintaining its core purpose and structure.'
                },
                {
                    role: 'user',
                    content: `Please regenerate this document with improvements:\n\n${previousContent}`
                }
            ],
            max_tokens: 4000,
            temperature: 0.4
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.BASE_URL || 'http://localhost:3000',
                'X-Title': 'LegalForms AI Drafting',
                'Content-Type': 'application/json'
            }
        });

        const generationTime = Date.now() - startTime;
        const content = response.data.choices[0].message.content;
        const usage = response.data.usage || {};

        await db.query(`
            INSERT INTO ai_draft_versions
            (session_id, version_number, content, prompt_used, model_used, tokens_used, generation_time_ms)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            req.params.id,
            (latestVersion.rows.length > 0 ? parseInt(latestVersion.rows[0].version_number) : 0) + 1,
            content,
            'Regenerate',
            response.data.model,
            usage.total_tokens || 0,
            generationTime
        ]);

        res.json({ success: true, content });
    } catch (error) {
        console.error('AI regenerate error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to regenerate document' });
    }
});

// Refine session (alias for revise)
router.post('/api/ai-drafting/sessions/:id/refine', requireAuth, async (req, res) => {
    req.body.revision_instructions = req.body.revision_instructions || req.body.instructions || 'Refine and improve this document';

    // Forward to the revise route handler
    const { revision_instructions } = req.body;

    try {
        const sessionResult = await db.query(`
            SELECT * FROM ai_draft_sessions WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
        `, [req.params.id, req.user.id]);

        if (sessionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const latestVersion = await db.query(`
            SELECT * FROM ai_draft_versions WHERE session_id = $1 ORDER BY version_number DESC LIMIT 1
        `, [req.params.id]);

        if (latestVersion.rows.length === 0) {
            return res.status(400).json({ error: 'No previous version found' });
        }

        const previousContent = latestVersion.rows[0].content;
        const startTime = Date.now();

        const response = await axios.post(OPENROUTER_API_URL, {
            model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-opus',
            messages: [
                {
                    role: 'system',
                    content: 'You are a legal document editor. Refine the following document based on the user\'s instructions while maintaining legal accuracy and professionalism.'
                },
                {
                    role: 'user',
                    content: `Original Document:\n${previousContent}\n\nRefinement Instructions:\n${revision_instructions}`
                }
            ],
            max_tokens: 4000,
            temperature: 0.3
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.BASE_URL || 'http://localhost:3000',
                'X-Title': 'LegalForms AI Drafting',
                'Content-Type': 'application/json'
            }
        });

        const generationTime = Date.now() - startTime;
        const content = response.data.choices[0].message.content;
        const usage = response.data.usage || {};

        await db.query(`
            INSERT INTO ai_draft_versions
            (session_id, version_number, content, prompt_used, model_used, tokens_used, generation_time_ms)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            req.params.id,
            parseInt(latestVersion.rows[0].version_number) + 1,
            content,
            `Refine: ${revision_instructions}`,
            response.data.model,
            usage.total_tokens || 0,
            generationTime
        ]);

        res.json({ success: true, content });
    } catch (error) {
        console.error('AI refine error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to refine document' });
    }
});

// Get specific version
router.get('/api/ai-drafting/versions/:id', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT v.*, s.user_id
            FROM ai_draft_versions v
            JOIN ai_draft_sessions s ON v.session_id = s.id
            WHERE v.id = $1 AND (s.user_id = $2 OR s.user_id IS NULL)
        `, [req.params.id, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Version not found' });
        }

        res.json({ success: true, version: result.rows[0] });
    } catch (error) {
        console.error('Get version error:', error);
        res.status(500).json({ error: 'Failed to get version' });
    }
});

module.exports = router;

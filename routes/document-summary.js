/**
 * AI Document Summarization Routes
 * Generates summaries and key points from legal documents
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

// Document Summary Dashboard
router.get('/document-summary', requireAuth, async (req, res) => {
    try {
        const summariesResult = await db.query(`
            SELECT ds.*, c.first_name, c.last_name, cs.title as case_title
            FROM document_summaries ds
            LEFT JOIN clients c ON ds.client_id = c.id
            LEFT JOIN cases cs ON ds.case_id = cs.id
            WHERE ds.user_id = $1
            ORDER BY ds.created_at DESC
            LIMIT 20
        `, [req.user.id]);

        const statsResult = await db.query(`
            SELECT
                COUNT(*) as total_summaries,
                COALESCE(SUM(word_count), 0) as total_words,
                COUNT(CASE WHEN case_note_id IS NOT NULL THEN 1 END) as notes_created
            FROM document_summaries
            WHERE user_id = $1
        `, [req.user.id]);

        res.render('document-summary/dashboard', {
            title: 'Document Summaries',
            summaries: summariesResult.rows,
            stats: statsResult.rows[0],
            req
        });
    } catch (error) {
        console.error('Document summary dashboard error:', error);
        res.status(500).render('error', { message: 'Error loading summaries' });
    }
});

// New Summary Page
router.get('/document-summary/new', requireAuth, async (req, res) => {
    try {
        const clientsResult = await db.query(
            'SELECT id, first_name, last_name, company_name FROM clients WHERE user_id = $1 ORDER BY last_name',
            [req.user.id]
        );

        const casesResult = await db.query(
            'SELECT id, case_number, title FROM cases WHERE user_id = $1 ORDER BY created_at DESC',
            [req.user.id]
        );

        // Support pre-population from query params (e.g., from OCR page)
        const prefill = {
            source_name: req.query.name || '',
            source_type: req.query.type || '',
            original_text: req.query.text || '',
            case_id: req.query.case_id || '',
            client_id: req.query.client_id || ''
        };

        res.render('document-summary/new', {
            title: 'New Document Summary',
            clients: clientsResult.rows,
            cases: casesResult.rows,
            prefill,
            active: 'documents'
        });
    } catch (error) {
        console.error('New summary error:', error);
        res.status(500).render('error', { message: 'Error loading form' });
    }
});

// View Summary Detail
router.get('/document-summary/:id', requireAuth, async (req, res) => {
    try {
        const summaryResult = await db.query(`
            SELECT ds.*, c.first_name, c.last_name, cs.title as case_title
            FROM document_summaries ds
            LEFT JOIN clients c ON ds.client_id = c.id
            LEFT JOIN cases cs ON ds.case_id = cs.id
            WHERE ds.id = $1 AND ds.user_id = $2
        `, [req.params.id, req.user.id]);

        if (summaryResult.rows.length === 0) {
            return res.status(404).render('error', { message: 'Summary not found' });
        }

        const keyPointsResult = await db.query(`
            SELECT * FROM summary_key_points
            WHERE summary_id = $1
            ORDER BY point_number
        `, [req.params.id]);

        res.render('document-summary/detail', {
            title: 'Document Summary',
            summary: summaryResult.rows[0],
            keyPoints: keyPointsResult.rows,
            req
        });
    } catch (error) {
        console.error('View summary error:', error);
        res.status(500).render('error', { message: 'Error loading summary' });
    }
});

// =====================================================
// API ROUTES
// =====================================================

// Generate summary
router.post('/api/document-summary/summarize', requireAuth, async (req, res) => {
    try {
        const { client_id, case_id, source_name, source_type, original_text, summary_length, target_audience } = req.body;

        if (!original_text || original_text.trim().length < 50) {
            return res.status(400).json({ error: 'Document text is too short for summarization' });
        }

        const wordCount = original_text.split(/\s+/).length;

        // Create summary record
        const summaryResult = await db.query(`
            INSERT INTO document_summaries
            (user_id, client_id, case_id, source_name, source_type, original_text, word_count, summary_length, target_audience, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'processing')
            RETURNING *
        `, [
            req.user.id,
            client_id || null,
            case_id || null,
            source_name || 'Untitled Document',
            source_type || 'general',
            original_text,
            wordCount,
            summary_length || 'medium',
            target_audience || 'attorney'
        ]);

        const summary = summaryResult.rows[0];
        const startTime = Date.now();

        // Build AI prompt
        const lengthGuide = {
            brief: '2-3 sentences',
            medium: '1-2 paragraphs',
            detailed: '3-4 paragraphs'
        };

        const audienceGuide = {
            attorney: 'Use legal terminology appropriate for attorneys. Be precise and include relevant legal citations or references.',
            client: 'Use plain language that a non-lawyer client can understand. Avoid legal jargon.',
            court: 'Use formal legal language appropriate for court filings. Be objective and factual.'
        };

        const systemPrompt = `You are a legal document summarization assistant. Create clear, accurate summaries that capture essential information for legal professionals. Maintain factual accuracy and preserve important details.`;

        const userPrompt = `Summarize the following ${source_type || 'document'} for ${target_audience || 'an attorney'}.

${audienceGuide[target_audience] || audienceGuide.attorney}

Create:
1. EXECUTIVE SUMMARY (2-3 sentences capturing the essence)
2. DETAILED SUMMARY (${lengthGuide[summary_length] || lengthGuide.medium})
3. KEY POINTS (5-10 critical facts/findings as a numbered list)

For each key point, identify:
- Category: fact, issue, holding, date, obligation, or party
- Importance: normal, high, or critical

DOCUMENT:
${original_text.substring(0, 12000)}

Respond in JSON format:
{
  "executive_summary": "string",
  "detailed_summary": "string",
  "key_points": [
    {
      "number": 1,
      "category": "string",
      "content": "string",
      "importance": "normal|high|critical",
      "source_excerpt": "relevant quote from document if applicable"
    }
  ]
}`;

        // Call OpenRouter API
        const response = await axios.post(OPENROUTER_API_URL, {
            model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            max_tokens: 3000,
            temperature: 0.2
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.BASE_URL || 'http://localhost:3000',
                'X-Title': 'LegalForms Document Summary',
                'Content-Type': 'application/json'
            }
        });

        const processingTime = Date.now() - startTime;
        const aiResponse = response.data;
        const content = aiResponse.choices[0].message.content;
        const usage = aiResponse.usage || {};

        // Parse AI response
        let summaryData;
        try {
            const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
            summaryData = JSON.parse(jsonStr);
        } catch (parseError) {
            console.error('Failed to parse AI response:', parseError);
            summaryData = {
                executive_summary: content.substring(0, 500),
                detailed_summary: content,
                key_points: []
            };
        }

        // Update summary record
        await db.query(`
            UPDATE document_summaries
            SET executive_summary = $1, detailed_summary = $2, key_points = $3,
                status = 'completed', model_used = $4, tokens_used = $5, processing_time_ms = $6,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $7
        `, [
            summaryData.executive_summary || '',
            summaryData.detailed_summary || '',
            JSON.stringify(summaryData.key_points || []),
            aiResponse.model || process.env.OPENROUTER_MODEL,
            usage.total_tokens || 0,
            processingTime,
            summary.id
        ]);

        // Insert key points
        if (summaryData.key_points && summaryData.key_points.length > 0) {
            for (const point of summaryData.key_points) {
                await db.query(`
                    INSERT INTO summary_key_points
                    (summary_id, point_number, category, content, importance, source_excerpt)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                    summary.id,
                    point.number || 0,
                    point.category || 'fact',
                    point.content,
                    point.importance || 'normal',
                    point.source_excerpt || null
                ]);
            }
        }

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
            'document_summary',
            aiResponse.model || process.env.OPENROUTER_MODEL,
            inputTokens,
            outputTokens,
            inputTokens + outputTokens,
            costEstimate,
            processingTime
        ]);

        res.json({
            success: true,
            summaryId: summary.id,
            executiveSummary: summaryData.executive_summary,
            keyPointCount: summaryData.key_points?.length || 0
        });

    } catch (error) {
        console.error('Document summary error:', error);

        try {
            await db.query(`
                INSERT INTO ai_usage_log (user_id, feature, model, success, error_message)
                VALUES ($1, 'document_summary', $2, false, $3)
            `, [req.user.id, process.env.OPENROUTER_MODEL || 'unknown', error.message]);
        } catch (logError) {
            console.error('Failed to log error:', logError);
        }

        res.status(500).json({ error: 'Failed to summarize document: ' + error.message });
    }
});

// Regenerate summary with different options
router.post('/api/document-summary/:id/regenerate', requireAuth, async (req, res) => {
    try {
        const { summary_length, target_audience } = req.body;

        const summaryResult = await db.query(
            'SELECT * FROM document_summaries WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (summaryResult.rows.length === 0) {
            return res.status(404).json({ error: 'Summary not found' });
        }

        const original = summaryResult.rows[0];

        // Delete old key points
        await db.query('DELETE FROM summary_key_points WHERE summary_id = $1', [req.params.id]);

        // Regenerate with new options
        req.body.original_text = original.original_text;
        req.body.source_name = original.source_name;
        req.body.source_type = original.source_type;
        req.body.client_id = original.client_id;
        req.body.case_id = original.case_id;
        req.body.summary_length = summary_length || original.summary_length;
        req.body.target_audience = target_audience || original.target_audience;

        // Delete old summary
        await db.query('DELETE FROM document_summaries WHERE id = $1', [req.params.id]);

        // Call the summarize endpoint logic
        return router.handle(req, res, () => {});
    } catch (error) {
        console.error('Regenerate summary error:', error);
        res.status(500).json({ error: 'Failed to regenerate summary' });
    }
});

// Create case note from summary
router.post('/api/document-summary/:id/create-note', requireAuth, async (req, res) => {
    try {
        const summaryResult = await db.query(
            'SELECT * FROM document_summaries WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (summaryResult.rows.length === 0) {
            return res.status(404).json({ error: 'Summary not found' });
        }

        const summary = summaryResult.rows[0];

        if (!summary.case_id) {
            return res.status(400).json({ error: 'No case associated with this summary. Please link a case first.' });
        }

        // Get key points
        const keyPointsResult = await db.query(
            'SELECT * FROM summary_key_points WHERE summary_id = $1 ORDER BY point_number',
            [req.params.id]
        );

        // Build note content
        let noteContent = `## Document Summary: ${summary.source_name}\n\n`;
        noteContent += `### Executive Summary\n${summary.executive_summary}\n\n`;
        noteContent += `### Key Points\n`;

        keyPointsResult.rows.forEach((point, index) => {
            const importance = point.importance === 'critical' ? ' [CRITICAL]' : point.importance === 'high' ? ' [IMPORTANT]' : '';
            noteContent += `${index + 1}. ${point.content}${importance}\n`;
        });

        noteContent += `\n---\n*Auto-generated from AI document summary on ${new Date().toLocaleDateString()}*`;

        // Create case note
        const noteResult = await db.query(`
            INSERT INTO case_notes (case_id, user_id, title, content, note_type, created_at)
            VALUES ($1, $2, $3, $4, 'summary', CURRENT_TIMESTAMP)
            RETURNING *
        `, [
            summary.case_id,
            req.user.id,
            `Summary: ${summary.source_name}`,
            noteContent
        ]);

        // Update summary with note reference
        await db.query(
            'UPDATE document_summaries SET case_note_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [noteResult.rows[0].id, req.params.id]
        );

        res.json({
            success: true,
            noteId: noteResult.rows[0].id,
            message: 'Case note created successfully'
        });

    } catch (error) {
        console.error('Create note error:', error);
        res.status(500).json({ error: 'Failed to create case note' });
    }
});

// Get key points
router.get('/api/document-summary/:id/key-points', requireAuth, async (req, res) => {
    try {
        const summaryCheck = await db.query(
            'SELECT id FROM document_summaries WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (summaryCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Summary not found' });
        }

        const result = await db.query(
            'SELECT * FROM summary_key_points WHERE summary_id = $1 ORDER BY point_number',
            [req.params.id]
        );

        res.json({ success: true, keyPoints: result.rows });
    } catch (error) {
        console.error('Get key points error:', error);
        res.status(500).json({ error: 'Failed to get key points' });
    }
});

// Delete summary
router.delete('/api/document-summary/:id', requireAuth, async (req, res) => {
    try {
        await db.query('DELETE FROM summary_key_points WHERE summary_id = $1', [req.params.id]);

        const result = await db.query(
            'DELETE FROM document_summaries WHERE id = $1 AND user_id = $2 RETURNING id',
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Summary not found' });
        }

        res.json({ success: true, message: 'Summary deleted' });
    } catch (error) {
        console.error('Delete summary error:', error);
        res.status(500).json({ error: 'Failed to delete summary' });
    }
});

// Get all summaries
router.get('/api/document-summary', requireAuth, async (req, res) => {
    try {
        const { source_type, case_id, client_id } = req.query;

        let query = `
            SELECT ds.*, c.first_name, c.last_name, cs.title as case_title
            FROM document_summaries ds
            LEFT JOIN clients c ON ds.client_id = c.id
            LEFT JOIN cases cs ON ds.case_id = cs.id
            WHERE ds.user_id = $1
        `;
        const params = [req.user.id];
        let paramIndex = 2;

        if (source_type) {
            query += ` AND ds.source_type = $${paramIndex}`;
            params.push(source_type);
            paramIndex++;
        }

        if (case_id) {
            query += ` AND ds.case_id = $${paramIndex}`;
            params.push(case_id);
            paramIndex++;
        }

        if (client_id) {
            query += ` AND ds.client_id = $${paramIndex}`;
            params.push(client_id);
            paramIndex++;
        }

        query += ' ORDER BY ds.created_at DESC';

        const result = await db.query(query, params);

        res.json({ success: true, summaries: result.rows });
    } catch (error) {
        console.error('Get summaries error:', error);
        res.status(500).json({ error: 'Failed to get summaries' });
    }
});

module.exports = router;

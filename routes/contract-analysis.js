/**
 * AI Contract Analysis Routes
 * Analyzes contracts for risks, clauses, and key terms
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// OpenRouter configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/contracts');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.txt', '.pdf', '.doc', '.docx'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// =====================================================
// PAGE ROUTES
// =====================================================

// Contract Analysis Dashboard
router.get('/contract-analysis', requireAuth, async (req, res) => {
    try {
        // Get recent analyses
        const analysesResult = await db.query(`
            SELECT ca.*, c.first_name, c.last_name, cs.title as case_title
            FROM contract_analysis ca
            LEFT JOIN clients c ON ca.client_id = c.id
            LEFT JOIN cases cs ON ca.case_id = cs.id
            WHERE ca.user_id = $1
            ORDER BY ca.created_at DESC
            LIMIT 20
        `, [req.user.id]);

        // Get stats
        const statsResult = await db.query(`
            SELECT
                COUNT(*) as total_analyses,
                COUNT(CASE WHEN risk_level = 'high' OR risk_level = 'critical' THEN 1 END) as high_risk_count,
                COUNT(CASE WHEN status = 'pending' OR status = 'analyzing' THEN 1 END) as pending_count,
                AVG(overall_risk_score) as avg_risk_score
            FROM contract_analysis
            WHERE user_id = $1
        `, [req.user.id]);

        res.render('contract-analysis/dashboard', {
            title: 'Contract Analysis',
            analyses: analysesResult.rows,
            stats: statsResult.rows[0],
            req
        });
    } catch (error) {
        console.error('Contract analysis dashboard error:', error);
        res.status(500).render('error', { message: 'Error loading contract analysis' });
    }
});

// New Analysis Page
router.get('/contract-analysis/new', requireAuth, async (req, res) => {
    try {
        const clientsResult = await db.query(
            'SELECT id, first_name, last_name, company_name FROM clients WHERE user_id = $1 ORDER BY last_name',
            [req.user.id]
        );

        const casesResult = await db.query(
            'SELECT id, case_number, title FROM cases WHERE user_id = $1 ORDER BY created_at DESC',
            [req.user.id]
        );

        res.render('contract-analysis/new', {
            title: 'New Contract Analysis',
            clients: clientsResult.rows,
            cases: casesResult.rows,
            req
        });
    } catch (error) {
        console.error('New contract analysis error:', error);
        res.status(500).render('error', { message: 'Error loading form' });
    }
});

// View Analysis Detail
router.get('/contract-analysis/:id', requireAuth, async (req, res) => {
    try {
        const analysisResult = await db.query(`
            SELECT ca.*, c.first_name, c.last_name, cs.title as case_title
            FROM contract_analysis ca
            LEFT JOIN clients c ON ca.client_id = c.id
            LEFT JOIN cases cs ON ca.case_id = cs.id
            WHERE ca.id = $1 AND ca.user_id = $2
        `, [req.params.id, req.user.id]);

        if (analysisResult.rows.length === 0) {
            return res.status(404).render('error', { message: 'Analysis not found' });
        }

        const clausesResult = await db.query(`
            SELECT * FROM contract_clauses
            WHERE analysis_id = $1
            ORDER BY risk_score DESC NULLS LAST
        `, [req.params.id]);

        const termsResult = await db.query(`
            SELECT * FROM contract_key_terms
            WHERE analysis_id = $1
            ORDER BY term_type, created_at
        `, [req.params.id]);

        res.render('contract-analysis/detail', {
            title: 'Contract Analysis',
            analysis: analysisResult.rows[0],
            clauses: clausesResult.rows,
            terms: termsResult.rows,
            req
        });
    } catch (error) {
        console.error('View analysis error:', error);
        res.status(500).render('error', { message: 'Error loading analysis' });
    }
});

// =====================================================
// API ROUTES
// =====================================================

// Start contract analysis
router.post('/api/contract-analysis/analyze', requireAuth, async (req, res) => {
    try {
        const { client_id, case_id, document_name, document_type, document_text, ocr_job_id } = req.body;

        if (!document_text || document_text.trim().length < 100) {
            return res.status(400).json({ error: 'Contract text is too short for analysis' });
        }

        // Create analysis record
        const analysisResult = await db.query(`
            INSERT INTO contract_analysis
            (user_id, client_id, case_id, document_name, document_type, document_text, ocr_job_id, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'analyzing')
            RETURNING *
        `, [
            req.user.id,
            client_id || null,
            case_id || null,
            document_name || 'Untitled Contract',
            document_type || 'general',
            document_text,
            ocr_job_id || null
        ]);

        const analysis = analysisResult.rows[0];
        const startTime = Date.now();

        // Build AI prompt
        const systemPrompt = `You are a legal contract analysis assistant. Your role is to:
1. Identify and extract key contractual clauses
2. Assess risk levels for each clause
3. Extract key terms (parties, dates, amounts, obligations)
4. Provide clear explanations that attorneys can review

IMPORTANT: Your analysis is for attorney review only. Never make final legal determinations.
All findings must be verified by a licensed attorney before action.`;

        const userPrompt = `Analyze the following ${document_type || 'contract'} and provide a comprehensive analysis.

CONTRACT TEXT:
${document_text.substring(0, 15000)}

Provide your analysis in the following JSON format:
{
  "clauses": [
    {
      "clause_type": "string (e.g., indemnification, limitation_liability, termination, non_compete, arbitration, confidentiality)",
      "clause_text": "exact text from contract",
      "risk_level": "low|medium|high|critical",
      "risk_score": 0-100,
      "risk_explanation": "why this is risky",
      "recommendation": "suggested action or negotiation point"
    }
  ],
  "key_terms": [
    {
      "term_type": "party|date|amount|duration|jurisdiction|governing_law|obligation",
      "term_label": "descriptive label",
      "term_value": "extracted value",
      "normalized_value": "standardized format if applicable"
    }
  ],
  "overall_risk_score": 0-100,
  "risk_level": "low|medium|high|critical",
  "analysis_summary": "2-3 paragraph summary of the contract and main concerns"
}

Be thorough but focus on the most significant clauses and terms.`;

        // Call OpenRouter API
        const response = await axios.post(OPENROUTER_API_URL, {
            model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            max_tokens: 4000,
            temperature: 0.2
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.BASE_URL || 'http://localhost:3000',
                'X-Title': 'LegalForms Contract Analysis',
                'Content-Type': 'application/json'
            }
        });

        const processingTime = Date.now() - startTime;
        const aiResponse = response.data;
        const content = aiResponse.choices[0].message.content;
        const usage = aiResponse.usage || {};

        // Parse AI response
        let analysisData;
        try {
            // Extract JSON from response (handle markdown code blocks)
            const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
            analysisData = JSON.parse(jsonStr);
        } catch (parseError) {
            console.error('Failed to parse AI response:', parseError);
            analysisData = {
                clauses: [],
                key_terms: [],
                overall_risk_score: 50,
                risk_level: 'medium',
                analysis_summary: content
            };
        }

        // Update analysis record
        await db.query(`
            UPDATE contract_analysis
            SET overall_risk_score = $1, risk_level = $2, analysis_summary = $3,
                status = 'completed', model_used = $4, tokens_used = $5, processing_time_ms = $6,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $7
        `, [
            analysisData.overall_risk_score || 50,
            analysisData.risk_level || 'medium',
            analysisData.analysis_summary || '',
            aiResponse.model || process.env.OPENROUTER_MODEL,
            usage.total_tokens || 0,
            processingTime,
            analysis.id
        ]);

        // Insert clauses
        if (analysisData.clauses && analysisData.clauses.length > 0) {
            for (const clause of analysisData.clauses) {
                await db.query(`
                    INSERT INTO contract_clauses
                    (analysis_id, clause_type, clause_text, risk_level, risk_score, risk_explanation, recommendation)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [
                    analysis.id,
                    clause.clause_type,
                    clause.clause_text,
                    clause.risk_level,
                    clause.risk_score,
                    clause.risk_explanation,
                    clause.recommendation
                ]);
            }
        }

        // Insert key terms
        if (analysisData.key_terms && analysisData.key_terms.length > 0) {
            for (const term of analysisData.key_terms) {
                await db.query(`
                    INSERT INTO contract_key_terms
                    (analysis_id, term_type, term_label, term_value, normalized_value, confidence)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                    analysis.id,
                    term.term_type,
                    term.term_label,
                    term.term_value,
                    term.normalized_value || null,
                    term.confidence || 0.8
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
            'contract_analysis',
            aiResponse.model || process.env.OPENROUTER_MODEL,
            inputTokens,
            outputTokens,
            inputTokens + outputTokens,
            costEstimate,
            processingTime
        ]);

        res.json({
            success: true,
            analysisId: analysis.id,
            riskScore: analysisData.overall_risk_score,
            riskLevel: analysisData.risk_level,
            clauseCount: analysisData.clauses?.length || 0,
            termCount: analysisData.key_terms?.length || 0
        });

    } catch (error) {
        console.error('Contract analysis error:', error);

        // Log failed attempt
        try {
            await db.query(`
                INSERT INTO ai_usage_log (user_id, feature, model, success, error_message)
                VALUES ($1, 'contract_analysis', $2, false, $3)
            `, [req.user.id, process.env.OPENROUTER_MODEL || 'unknown', error.message]);
        } catch (logError) {
            console.error('Failed to log error:', logError);
        }

        res.status(500).json({ error: 'Failed to analyze contract: ' + error.message });
    }
});

// Get analysis status
router.get('/api/contract-analysis/:id/status', requireAuth, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, status, overall_risk_score, risk_level FROM contract_analysis WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Analysis not found' });
        }

        res.json({ success: true, analysis: result.rows[0] });
    } catch (error) {
        console.error('Get analysis status error:', error);
        res.status(500).json({ error: 'Failed to get status' });
    }
});

// Get clauses for analysis
router.get('/api/contract-analysis/:id/clauses', requireAuth, async (req, res) => {
    try {
        // Verify ownership
        const analysisCheck = await db.query(
            'SELECT id FROM contract_analysis WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (analysisCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Analysis not found' });
        }

        const result = await db.query(
            'SELECT * FROM contract_clauses WHERE analysis_id = $1 ORDER BY risk_score DESC NULLS LAST',
            [req.params.id]
        );

        res.json({ success: true, clauses: result.rows });
    } catch (error) {
        console.error('Get clauses error:', error);
        res.status(500).json({ error: 'Failed to get clauses' });
    }
});

// Get key terms for analysis
router.get('/api/contract-analysis/:id/terms', requireAuth, async (req, res) => {
    try {
        // Verify ownership
        const analysisCheck = await db.query(
            'SELECT id FROM contract_analysis WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (analysisCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Analysis not found' });
        }

        const result = await db.query(
            'SELECT * FROM contract_key_terms WHERE analysis_id = $1 ORDER BY term_type, created_at',
            [req.params.id]
        );

        res.json({ success: true, terms: result.rows });
    } catch (error) {
        console.error('Get terms error:', error);
        res.status(500).json({ error: 'Failed to get terms' });
    }
});

// Submit review
router.post('/api/contract-analysis/:id/review', requireAuth, async (req, res) => {
    try {
        const { review_notes } = req.body;

        const result = await db.query(`
            UPDATE contract_analysis
            SET status = 'reviewed', reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP, review_notes = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3 AND user_id = $4
            RETURNING *
        `, [req.user.id, review_notes, req.params.id, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Analysis not found' });
        }

        res.json({ success: true, analysis: result.rows[0] });
    } catch (error) {
        console.error('Submit review error:', error);
        res.status(500).json({ error: 'Failed to submit review' });
    }
});

// Flag clause for review
router.post('/api/contract-analysis/:id/flag-clause', requireAuth, async (req, res) => {
    try {
        const { clause_id, attorney_notes } = req.body;

        // Verify ownership
        const analysisCheck = await db.query(
            'SELECT id FROM contract_analysis WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (analysisCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Analysis not found' });
        }

        await db.query(`
            UPDATE contract_clauses
            SET is_flagged = true, attorney_notes = $1
            WHERE id = $2 AND analysis_id = $3
        `, [attorney_notes, clause_id, req.params.id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Flag clause error:', error);
        res.status(500).json({ error: 'Failed to flag clause' });
    }
});

// Delete analysis
router.delete('/api/contract-analysis/:id', requireAuth, async (req, res) => {
    try {
        // Delete related data first (foreign key constraints)
        await db.query('DELETE FROM contract_clauses WHERE analysis_id = $1', [req.params.id]);
        await db.query('DELETE FROM contract_key_terms WHERE analysis_id = $1', [req.params.id]);

        const result = await db.query(
            'DELETE FROM contract_analysis WHERE id = $1 AND user_id = $2 RETURNING id',
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Analysis not found' });
        }

        res.json({ success: true, message: 'Analysis deleted' });
    } catch (error) {
        console.error('Delete analysis error:', error);
        res.status(500).json({ error: 'Failed to delete analysis' });
    }
});

// Get all analyses
router.get('/api/contract-analysis', requireAuth, async (req, res) => {
    try {
        const { status, risk_level, client_id, case_id } = req.query;

        let query = `
            SELECT ca.*, c.first_name, c.last_name, cs.title as case_title
            FROM contract_analysis ca
            LEFT JOIN clients c ON ca.client_id = c.id
            LEFT JOIN cases cs ON ca.case_id = cs.id
            WHERE ca.user_id = $1
        `;
        const params = [req.user.id];
        let paramIndex = 2;

        if (status) {
            query += ` AND ca.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (risk_level) {
            query += ` AND ca.risk_level = $${paramIndex}`;
            params.push(risk_level);
            paramIndex++;
        }

        if (client_id) {
            query += ` AND ca.client_id = $${paramIndex}`;
            params.push(client_id);
            paramIndex++;
        }

        if (case_id) {
            query += ` AND ca.case_id = $${paramIndex}`;
            params.push(case_id);
            paramIndex++;
        }

        query += ' ORDER BY ca.created_at DESC';

        const result = await db.query(query, params);

        res.json({ success: true, analyses: result.rows });
    } catch (error) {
        console.error('Get analyses error:', error);
        res.status(500).json({ error: 'Failed to get analyses' });
    }
});

module.exports = router;

/**
 * AI Case Predictions Routes
 * Provides case outcome predictions with required disclaimers
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const axios = require('axios');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Standard disclaimer
const PREDICTION_DISCLAIMER = `IMPORTANT DISCLAIMER: This AI analysis is for informational purposes only and does not constitute legal advice. Past outcomes do not guarantee future results. Case outcomes depend on many factors including jurisdiction, judge, jury, specific facts, and quality of legal representation. Always exercise independent professional judgment and consult relevant case law and statutes.`;

// =====================================================
// PAGE ROUTES
// =====================================================

// Case predictions page
router.get('/cases/:caseId/predictions', requireAuth, async (req, res) => {
    try {
        const caseResult = await db.query(
            'SELECT * FROM cases WHERE id = $1 AND user_id = $2',
            [req.params.caseId, req.user.id]
        );

        if (caseResult.rows.length === 0) {
            return res.status(404).render('error', { message: 'Case not found' });
        }

        const predictionsResult = await db.query(`
            SELECT * FROM ai_case_predictions
            WHERE case_id = $1 AND user_id = $2
            ORDER BY created_at DESC
        `, [req.params.caseId, req.user.id]);

        res.render('cases/predictions', {
            title: 'Case Predictions',
            caseData: caseResult.rows[0],
            predictions: predictionsResult.rows,
            disclaimer: PREDICTION_DISCLAIMER,
            req
        });
    } catch (error) {
        console.error('Predictions page error:', error);
        res.status(500).render('error', { message: 'Error loading predictions' });
    }
});

// =====================================================
// API ROUTES
// =====================================================

// Generate prediction
router.post('/api/ai-predictions/analyze', requireAuth, async (req, res) => {
    try {
        const { case_id, prediction_type, input_factors, disclaimer_acknowledged } = req.body;

        if (!disclaimer_acknowledged) {
            return res.status(400).json({
                error: 'Disclaimer acknowledgment required',
                disclaimer: PREDICTION_DISCLAIMER
            });
        }

        // Get case details
        const caseResult = await db.query(`
            SELECT c.*, cl.first_name, cl.last_name
            FROM cases c
            LEFT JOIN clients cl ON c.client_id = cl.id
            WHERE c.id = $1 AND c.user_id = $2
        `, [case_id, req.user.id]);

        if (caseResult.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        const caseData = caseResult.rows[0];
        const startTime = Date.now();

        const systemPrompt = `You are a legal analytics assistant providing case outcome analysis.

CRITICAL: Always include this disclaimer in your response:
"${PREDICTION_DISCLAIMER}"

Your analysis is probabilistic and based on general patterns. Never guarantee outcomes.`;

        const userPrompt = `Analyze this case for outcome prediction:

Case Type: ${caseData.case_type || 'General'}
Status: ${caseData.status}
Description: ${caseData.description || 'Not provided'}
${input_factors ? `Additional Factors: ${JSON.stringify(input_factors)}` : ''}

Provide analysis in JSON format:
{
  "disclaimer": "Full disclaimer text",
  "likelihood_assessment": {
    "favorable": 0.0-1.0,
    "unfavorable": 0.0-1.0,
    "settlement_likely": 0.0-1.0
  },
  "strengths": ["list of case strengths"],
  "weaknesses": ["list of case weaknesses"],
  "risk_factors": [
    {
      "factor": "description",
      "severity": "low|medium|high",
      "mitigation": "suggested approach"
    }
  ],
  "strategic_recommendations": ["list of strategic suggestions"],
  "summary": "2-3 paragraph analysis summary"
}`;

        const response = await axios.post(OPENROUTER_API_URL, {
            model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            max_tokens: 2000,
            temperature: 0.3
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.BASE_URL || 'http://localhost:3000',
                'X-Title': 'LegalForms AI Predictions',
                'Content-Type': 'application/json'
            }
        });

        const processingTime = Date.now() - startTime;
        const content = response.data.choices[0].message.content;
        const usage = response.data.usage || {};

        let predictionData;
        try {
            const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
            predictionData = JSON.parse(jsonStr);
        } catch (e) {
            predictionData = {
                likelihood_assessment: { favorable: 0.5, unfavorable: 0.3, settlement_likely: 0.5 },
                strengths: [],
                weaknesses: [],
                risk_factors: [],
                strategic_recommendations: [],
                summary: content
            };
        }

        // Save prediction
        const predictionResult = await db.query(`
            INSERT INTO ai_case_predictions
            (case_id, user_id, prediction_type, input_factors, prediction_result,
             likelihood_assessment, risk_factors, strengths, weaknesses, recommended_strategy,
             disclaimer_acknowledged, model_used, tokens_used, processing_time_ms)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11, $12, $13)
            RETURNING *
        `, [
            case_id,
            req.user.id,
            prediction_type || 'outcome',
            JSON.stringify(input_factors || {}),
            JSON.stringify(predictionData),
            JSON.stringify(predictionData.likelihood_assessment || {}),
            JSON.stringify(predictionData.risk_factors || []),
            JSON.stringify(predictionData.strengths || []),
            JSON.stringify(predictionData.weaknesses || []),
            predictionData.strategic_recommendations?.join('\n') || '',
            response.data.model,
            usage.total_tokens || 0,
            processingTime
        ]);

        // Log usage
        await db.query(`
            INSERT INTO ai_usage_log
            (user_id, feature, model, input_tokens, output_tokens, total_tokens, response_time_ms, success)
            VALUES ($1, 'case_prediction', $2, $3, $4, $5, $6, true)
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
            predictionId: predictionResult.rows[0].id,
            prediction: predictionData,
            disclaimer: PREDICTION_DISCLAIMER
        });

    } catch (error) {
        console.error('AI prediction error:', error);
        res.status(500).json({ error: 'Failed to generate prediction: ' + error.message });
    }
});

// Get predictions for case
router.get('/api/ai-predictions/case/:caseId', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT * FROM ai_case_predictions
            WHERE case_id = $1 AND user_id = $2
            ORDER BY created_at DESC
        `, [req.params.caseId, req.user.id]);

        res.json({
            success: true,
            predictions: result.rows,
            disclaimer: PREDICTION_DISCLAIMER
        });
    } catch (error) {
        console.error('Get predictions error:', error);
        res.status(500).json({ error: 'Failed to get predictions' });
    }
});

module.exports = router;

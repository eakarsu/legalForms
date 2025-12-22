/**
 * AI-Enhanced Conflict Detection Routes
 * Uses AI for fuzzy matching and corporate relationship detection
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

// AI Conflicts Dashboard
router.get('/ai-conflicts/dashboard', requireAuth, async (req, res) => {
    try {
        const analysesResult = await db.query(`
            SELECT aca.*
            FROM ai_conflict_analyses aca
            WHERE (aca.user_id = $1 OR aca.user_id IS NULL)
            ORDER BY aca.created_at DESC
            LIMIT 20
        `, [req.user.id]);

        const statsResult = await db.query(`
            SELECT
                COUNT(*) as total_analyses,
                COUNT(CASE WHEN reviewed = false THEN 1 END) as pending_review,
                COUNT(CASE WHEN potential_conflicts IS NOT NULL AND jsonb_array_length(potential_conflicts) > 0 THEN 1 END) as conflicts_found
            FROM ai_conflict_analyses
            WHERE (user_id = $1 OR user_id IS NULL)
        `, [req.user.id]);

        res.render('ai/conflicts-dashboard', {
            title: 'AI Conflict Analysis',
            analyses: analysesResult.rows,
            stats: statsResult.rows[0],
            active: 'conflicts'
        });
    } catch (error) {
        console.error('AI conflicts dashboard error:', error);
        res.status(500).render('error', { message: 'Error loading AI conflicts' });
    }
});

// =====================================================
// API ROUTES
// =====================================================

// Run AI conflict analysis
router.post('/api/ai-conflicts/analyze', requireAuth, async (req, res) => {
    try {
        const { conflict_check_id, party_names, analysis_type } = req.body;

        if (!party_names || party_names.length === 0) {
            return res.status(400).json({ error: 'No party names provided' });
        }

        // Get existing parties for comparison
        const existingPartiesResult = await db.query(`
            SELECT DISTINCT name, party_type, relationship
            FROM conflict_parties
            WHERE (user_id = $1 OR user_id IS NULL)
            ORDER BY name
        `, [req.user.id]);

        const startTime = Date.now();

        const systemPrompt = `You are a legal conflict checking assistant. Analyze names for potential conflicts considering:
1. Common misspellings and typos
2. Phonetic similarities (soundex variations)
3. Nickname variations (Robert/Bob, William/Bill)
4. Name order differences
5. Corporate suffixes (Inc, LLC, Corp, Ltd)
6. Parent/subsidiary relationships`;

        const userPrompt = `Analyze these names for potential conflicts:

NEW PARTIES TO CHECK:
${party_names.join('\n')}

EXISTING PARTIES DATABASE:
${existingPartiesResult.rows.map(p => `${p.name} (${p.party_type}, ${p.relationship || 'party'})`).join('\n')}

Identify:
1. Fuzzy name matches (spelling, phonetic, nicknames)
2. Potential corporate relationships
3. Exact matches

Respond in JSON:
{
  "fuzzy_matches": [
    {
      "input_name": "string",
      "matched_name": "string",
      "match_type": "phonetic|nickname|spelling|corporate",
      "confidence": 0.0-1.0,
      "explanation": "string"
    }
  ],
  "corporate_relationships": [
    {
      "entity1": "string",
      "entity2": "string",
      "relationship_type": "parent|subsidiary|affiliate|dba",
      "confidence": 0.0-1.0
    }
  ],
  "potential_conflicts": [
    {
      "new_party": "string",
      "existing_party": "string",
      "conflict_type": "direct|related|corporate",
      "severity": "low|medium|high",
      "explanation": "string"
    }
  ],
  "clear_parties": ["names with no conflicts found"]
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
                'X-Title': 'LegalForms AI Conflicts',
                'Content-Type': 'application/json'
            }
        });

        const processingTime = Date.now() - startTime;
        const content = response.data.choices[0].message.content;
        const usage = response.data.usage || {};

        let analysisData;
        try {
            const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
            analysisData = JSON.parse(jsonStr);
        } catch (e) {
            analysisData = {
                fuzzy_matches: [],
                corporate_relationships: [],
                potential_conflicts: [],
                clear_parties: party_names
            };
        }

        // Save analysis
        const analysisResult = await db.query(`
            INSERT INTO ai_conflict_analyses
            (conflict_check_id, user_id, analysis_type, input_data, ai_response,
             potential_conflicts, corporate_relationships, fuzzy_matches,
             model_used, tokens_used, processing_time_ms)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `, [
            conflict_check_id || null,
            req.user.id,
            analysis_type || 'comprehensive',
            JSON.stringify({ party_names }),
            JSON.stringify(analysisData),
            JSON.stringify(analysisData.potential_conflicts || []),
            JSON.stringify(analysisData.corporate_relationships || []),
            JSON.stringify(analysisData.fuzzy_matches || []),
            response.data.model,
            usage.total_tokens || 0,
            processingTime
        ]);

        // Log usage
        await db.query(`
            INSERT INTO ai_usage_log
            (user_id, feature, model, input_tokens, output_tokens, total_tokens, response_time_ms, success)
            VALUES ($1, 'conflict_analysis', $2, $3, $4, $5, $6, true)
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
            analysisId: analysisResult.rows[0].id,
            conflicts: analysisData.potential_conflicts || [],
            fuzzyMatches: analysisData.fuzzy_matches || [],
            corporateRelationships: analysisData.corporate_relationships || [],
            clearParties: analysisData.clear_parties || []
        });

    } catch (error) {
        console.error('AI conflict analysis error:', error);
        res.status(500).json({ error: 'Failed to analyze conflicts: ' + error.message });
    }
});

// Mark analysis as reviewed
router.post('/api/ai-conflicts/:id/review', requireAuth, async (req, res) => {
    try {
        await db.query(`
            UPDATE ai_conflict_analyses
            SET reviewed = true, reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND (user_id = $3 OR user_id IS NULL)
        `, [req.user.id, req.params.id, req.user.id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Review conflict error:', error);
        res.status(500).json({ error: 'Failed to mark as reviewed' });
    }
});

// Get analysis history
router.get('/api/ai-conflicts/history', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT * FROM ai_conflict_analyses
            WHERE (user_id = $1 OR user_id IS NULL)
            ORDER BY created_at DESC
            LIMIT 50
        `, [req.user.id]);

        res.json({ success: true, analyses: result.rows });
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ error: 'Failed to get history' });
    }
});

module.exports = router;

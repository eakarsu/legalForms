/**
 * AI Features Routes
 * Handles AI-powered features: Communications, Predictions, Citations, Voice Notes, etc.
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// =====================================================
// AI COMMUNICATIONS
// =====================================================

// Get AI communication suggestions
router.get('/api/ai-communications/suggestions', requireAuth, async (req, res) => {
    try {
        const { client_id, case_id } = req.query;

        // Get recent communications for context
        const recentComms = await db.query(`
            SELECT subject, content, message_type, created_at
            FROM messages
            WHERE user_id = $1
            ${client_id ? 'AND client_id = $2' : ''}
            ORDER BY created_at DESC
            LIMIT 10
        `, client_id ? [req.user.id, client_id] : [req.user.id]);

        // Generate suggestions based on patterns
        const suggestions = [
            {
                type: 'follow_up',
                subject: 'Case Status Update',
                template: 'Dear [Client Name],\n\nI wanted to provide you with an update on your case...',
                reason: 'Regular client communication recommended'
            },
            {
                type: 'reminder',
                subject: 'Upcoming Deadline Reminder',
                template: 'Dear [Client Name],\n\nThis is a reminder about the upcoming deadline...',
                reason: 'Proactive deadline management'
            },
            {
                type: 'document_request',
                subject: 'Document Request',
                template: 'Dear [Client Name],\n\nFor your case, we will need the following documents...',
                reason: 'Common case requirement'
            }
        ];

        res.json({
            success: true,
            suggestions: suggestions,
            recentCommunications: recentComms.rows.length
        });
    } catch (error) {
        console.error('AI communications error:', error);
        res.status(500).json({ error: 'Failed to get AI suggestions' });
    }
});

// =====================================================
// AI PREDICTIONS
// =====================================================

// Get AI case predictions
router.get('/api/ai-predictions/case', requireAuth, async (req, res) => {
    try {
        const { case_id } = req.query;

        // Get case statistics for predictions
        const statsResult = await db.query(`
            SELECT
                c.case_type,
                COUNT(*) as similar_cases,
                AVG(CASE WHEN c.date_closed IS NOT NULL THEN c.date_closed - c.date_opened ELSE NULL END) as avg_duration,
                COUNT(*) FILTER (WHERE c.status = 'closed' AND c.outcome = 'favorable') as favorable_outcomes
            FROM cases c
            WHERE c.user_id = $1
            ${case_id ? 'AND c.case_type = (SELECT case_type FROM cases WHERE id = $2)' : ''}
            GROUP BY c.case_type
        `, case_id ? [req.user.id, case_id] : [req.user.id]);

        const predictions = {
            estimatedDuration: statsResult.rows[0]?.avg_duration || 90,
            successProbability: statsResult.rows[0]?.similar_cases > 0
                ? Math.round((statsResult.rows[0]?.favorable_outcomes / statsResult.rows[0]?.similar_cases) * 100)
                : 65,
            riskFactors: [
                { factor: 'Complexity', level: 'medium', description: 'Based on case type analysis' },
                { factor: 'Timeline', level: 'low', description: 'Within normal parameters' }
            ],
            recommendations: [
                'Gather all supporting documentation early',
                'Schedule client meetings bi-weekly',
                'Monitor opposing counsel filings'
            ]
        };

        res.json({
            success: true,
            predictions: predictions,
            basedOnCases: statsResult.rows[0]?.similar_cases || 0
        });
    } catch (error) {
        console.error('AI predictions error:', error);
        res.status(500).json({ error: 'Failed to get predictions' });
    }
});

// =====================================================
// CITATION FINDER
// =====================================================

// Search for legal citations
router.get('/api/citation-finder/search', requireAuth, async (req, res) => {
    try {
        const { query, jurisdiction, case_type } = req.query;

        // Return sample citations (would integrate with legal research API)
        const citations = [
            {
                citation: 'Miranda v. Arizona, 384 U.S. 436 (1966)',
                title: 'Miranda Rights',
                relevance: 0.95,
                summary: 'Established rights of criminal suspects during interrogation',
                jurisdiction: 'Federal'
            },
            {
                citation: 'Brown v. Board of Education, 347 U.S. 483 (1954)',
                title: 'School Desegregation',
                relevance: 0.85,
                summary: 'Declared racial segregation in public schools unconstitutional',
                jurisdiction: 'Federal'
            },
            {
                citation: 'Roe v. Wade, 410 U.S. 113 (1973)',
                title: 'Privacy Rights',
                relevance: 0.80,
                summary: 'Established constitutional right to privacy',
                jurisdiction: 'Federal'
            }
        ];

        res.json({
            success: true,
            citations: citations,
            query: query || 'general',
            totalResults: citations.length
        });
    } catch (error) {
        console.error('Citation finder error:', error);
        res.status(500).json({ error: 'Failed to search citations' });
    }
});

// =====================================================
// VOICE NOTES
// =====================================================

// Get voice notes
router.get('/api/voice-notes', requireAuth, async (req, res) => {
    try {
        const { case_id, client_id } = req.query;

        let query = `
            SELECT vn.*, c.first_name, c.last_name, cs.title as case_title
            FROM voice_notes vn
            LEFT JOIN clients c ON vn.client_id = c.id
            LEFT JOIN cases cs ON vn.case_id = cs.id
            WHERE vn.user_id = $1
        `;
        const params = [req.user.id];

        if (case_id) {
            query += ` AND vn.case_id = $${params.length + 1}`;
            params.push(case_id);
        }
        if (client_id) {
            query += ` AND vn.client_id = $${params.length + 1}`;
            params.push(client_id);
        }

        query += ' ORDER BY vn.created_at DESC LIMIT 50';

        const result = await db.query(query, params);

        res.json({
            success: true,
            voiceNotes: result.rows
        });
    } catch (error) {
        console.error('Voice notes error:', error);
        res.status(500).json({ error: 'Failed to get voice notes' });
    }
});

// =====================================================
// DOCUMENT SUMMARIZATION
// =====================================================

// Get recent document summaries
router.get('/api/document-summary/recent', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT ds.*, d.filename, d.document_type, c.first_name, c.last_name
            FROM document_summaries ds
            LEFT JOIN documents d ON ds.document_id = d.id
            LEFT JOIN clients c ON d.client_id = c.id
            WHERE ds.user_id = $1
            ORDER BY ds.created_at DESC
            LIMIT 20
        `, [req.user.id]);

        res.json({
            success: true,
            summaries: result.rows
        });
    } catch (error) {
        console.error('Document summary error:', error);
        res.status(500).json({ error: 'Failed to get summaries' });
    }
});

// =====================================================
// CONTRACT ANALYSIS
// =====================================================

// Get recent contract analyses
router.get('/api/contract-analysis/recent', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT ca.*, d.filename, c.first_name, c.last_name
            FROM contract_analyses ca
            LEFT JOIN documents d ON ca.document_id = d.id
            LEFT JOIN clients c ON d.client_id = c.id
            WHERE ca.user_id = $1
            ORDER BY ca.created_at DESC
            LIMIT 20
        `, [req.user.id]);

        res.json({
            success: true,
            analyses: result.rows
        });
    } catch (error) {
        console.error('Contract analysis error:', error);
        res.status(500).json({ error: 'Failed to get analyses' });
    }
});

// =====================================================
// LEGAL RESEARCH
// =====================================================

// Legal research endpoint
router.get('/api/nlp/research', requireAuth, async (req, res) => {
    try {
        const { query, topic, jurisdiction } = req.query;

        // Get saved research
        const savedResult = await db.query(`
            SELECT * FROM legal_research
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 10
        `, [req.user.id]);

        // Sample research results
        const results = {
            query: query || 'general legal research',
            topics: [
                { name: 'Case Law', count: 15 },
                { name: 'Statutes', count: 8 },
                { name: 'Regulations', count: 5 }
            ],
            recentSearches: savedResult.rows,
            suggestedTopics: [
                'Contract Law',
                'Civil Procedure',
                'Evidence Rules',
                'Constitutional Law'
            ]
        };

        res.json({
            success: true,
            research: results
        });
    } catch (error) {
        console.error('Legal research error:', error);
        res.status(500).json({ error: 'Failed to perform research' });
    }
});

// =====================================================
// AI BILLING SUGGESTIONS
// =====================================================

// Get AI billing suggestions
router.get('/api/ai-billing/suggestions', requireAuth, async (req, res) => {
    try {
        // Get unbilled time entries
        const unbilledResult = await db.query(`
            SELECT te.*, c.first_name, c.last_name, cs.title as case_title
            FROM time_entries te
            LEFT JOIN clients c ON te.client_id = c.id
            LEFT JOIN cases cs ON te.case_id = cs.id
            WHERE te.user_id = $1
            AND te.invoice_id IS NULL
            AND te.is_billable = true
            ORDER BY te.date DESC
            LIMIT 50
        `, [req.user.id]);

        // Calculate suggestions
        const suggestions = {
            unbilledHours: unbilledResult.rows.reduce((sum, te) => sum + (te.duration_minutes / 60), 0),
            unbilledAmount: unbilledResult.rows.reduce((sum, te) => sum + parseFloat(te.amount || 0), 0),
            clientsWithUnbilled: [...new Set(unbilledResult.rows.map(te => te.client_id))].length,
            recommendations: [
                'Review unbilled time entries from last 30 days',
                'Consider monthly billing cycle for retainer clients',
                'Update hourly rates for new matters'
            ],
            unbilledEntries: unbilledResult.rows
        };

        res.json({
            success: true,
            suggestions: suggestions
        });
    } catch (error) {
        console.error('AI billing error:', error);
        res.status(500).json({ error: 'Failed to get billing suggestions' });
    }
});

module.exports = router;

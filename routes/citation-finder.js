const express = require('express');
const router = express.Router();
const db = require('../config/database');
const axios = require('axios');
const { requireAuth } = require('../middleware/auth');
const { validateCitationSearch } = require('../middleware/validation');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Citation Finder Dashboard
router.get('/citation-finder', requireAuth, async (req, res) => {
    try {
        const searches = await db.query(`
            SELECT cs.*,
                   (SELECT COUNT(*) FROM legal_citations lc WHERE lc.search_id = cs.id) as citation_count
            FROM citation_searches cs
            WHERE cs.user_id = $1
            ORDER BY cs.created_at DESC
            LIMIT 20
        `, [req.user.id]);

        const stats = await db.query(`
            SELECT
                COUNT(*) as total_searches,
                (SELECT COUNT(*) FROM legal_citations lc
                 JOIN citation_searches cs ON lc.search_id = cs.id
                 WHERE cs.user_id = $1) as total_citations,
                (SELECT COUNT(*) FROM citation_searches
                 WHERE user_id = $1 AND created_at > NOW() - INTERVAL '7 days') as recent_searches
            FROM citation_searches WHERE user_id = $1
        `, [req.user.id]);

        res.render('citation-finder/dashboard', {
            searches: searches.rows,
            stats: stats.rows[0] || {},
            active: 'documents'
        });
    } catch (error) {
        console.error('Citation finder dashboard error:', error);
        res.render('error', { message: 'Failed to load citation finder' });
    }
});

// New Search Page
router.get('/citation-finder/search', requireAuth, async (req, res) => {
    try {
        const cases = await db.query(`
            SELECT id, case_number, title FROM cases
            WHERE user_id = $1 AND status != 'closed'
            ORDER BY created_at DESC
        `, [req.user.id]);

        res.render('citation-finder/search', {
            cases: cases.rows,
            jurisdictions: ['Federal', 'California', 'New York', 'Texas', 'Florida', 'Illinois', 'Pennsylvania', 'Ohio', 'Georgia', 'Michigan'],
            practiceAreas: ['Civil Rights', 'Contract Law', 'Criminal Law', 'Employment Law', 'Family Law', 'Intellectual Property', 'Personal Injury', 'Real Estate', 'Tax Law', 'Tort Law'],
            active: 'documents'
        });
    } catch (error) {
        console.error('Citation search page error:', error);
        res.render('error', { message: 'Failed to load search page' });
    }
});

// Search Results Page
router.get('/citation-finder/results/:id', requireAuth, async (req, res) => {
    try {
        const search = await db.query(`
            SELECT * FROM citation_searches WHERE id = $1 AND user_id = $2
        `, [req.params.id, req.user.id]);

        if (search.rows.length === 0) {
            return res.render('error', { message: 'Search not found' });
        }

        const citations = await db.query(`
            SELECT * FROM legal_citations
            WHERE search_id = $1
            ORDER BY relevance_score DESC
        `, [req.params.id]);

        res.render('citation-finder/results', {
            search: search.rows[0],
            citations: citations.rows,
            active: 'documents'
        });
    } catch (error) {
        console.error('Citation results error:', error);
        res.render('error', { message: 'Failed to load results' });
    }
});

// API: Get persisted citations for the current user (GET — mobile/client friendly)
//
// Returns the user's past citation searches with their saved citations.
// Optional filters: ?search_id=UUID (get citations for one search)
//                   ?jurisdiction=Federal&practice_area=Contract+Law
//                   ?q=search term (fuzzy filter on legal_issue)
router.get('/api/citation-finder/search', requireAuth, async (req, res) => {
    try {
        const { search_id, jurisdiction, practice_area, q, limit = 20 } = req.query;

        // If a specific search is requested, return its saved citations
        if (search_id) {
            const searchResult = await db.query(
                'SELECT * FROM citation_searches WHERE id = $1 AND user_id = $2',
                [search_id, req.user.id]
            );

            if (searchResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Citation search not found' });
            }

            const citationsResult = await db.query(`
                SELECT * FROM legal_citations
                WHERE search_id = $1
                ORDER BY relevance_score DESC
            `, [search_id]);

            return res.json({
                success: true,
                search: searchResult.rows[0],
                citations: citationsResult.rows
            });
        }

        // Otherwise return recent searches with optional filters
        let searchQuery = `
            SELECT cs.*,
                   (SELECT COUNT(*) FROM legal_citations lc WHERE lc.search_id = cs.id) as citation_count
            FROM citation_searches cs
            WHERE cs.user_id = $1
        `;
        const params = [req.user.id];

        if (jurisdiction) {
            params.push(jurisdiction);
            searchQuery += ` AND cs.jurisdiction = $${params.length}`;
        }
        if (practice_area) {
            params.push(practice_area);
            searchQuery += ` AND cs.practice_area = $${params.length}`;
        }
        if (q) {
            params.push(`%${q}%`);
            searchQuery += ` AND cs.legal_issue ILIKE $${params.length}`;
        }

        const safeLimit = Math.min(parseInt(limit, 10) || 20, 100);
        params.push(safeLimit);
        searchQuery += ` ORDER BY cs.created_at DESC LIMIT $${params.length}`;

        const recentResult = await db.query(searchQuery, params);

        // Also fetch the citations for the most recent search for convenience
        let latestCitations = [];
        if (recentResult.rows.length > 0) {
            const latestSearch = recentResult.rows[0];
            const latestCitResult = await db.query(`
                SELECT * FROM legal_citations
                WHERE search_id = $1
                ORDER BY relevance_score DESC
                LIMIT 10
            `, [latestSearch.id]);
            latestCitations = latestCitResult.rows;
        }

        res.json({
            success: true,
            recentSearches: recentResult.rows,
            citations: latestCitations,
            query: q || ''
        });
    } catch (error) {
        console.error('Citation search GET error:', error);
        res.status(500).json({ error: 'Failed to retrieve citations' });
    }
});

// API: Find Citations
router.post('/api/citation-finder/search', requireAuth, ...validateCitationSearch, async (req, res) => {
    const startTime = Date.now();
    try {
        const { legal_issue, jurisdiction, practice_area, case_id, search_type = 'general' } = req.body;

        if (!legal_issue) {
            return res.status(400).json({ success: false, error: 'Legal issue is required' });
        }

        // Create search record
        const searchResult = await db.query(`
            INSERT INTO citation_searches
            (user_id, case_id, search_type, legal_issue, jurisdiction, practice_area, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'processing')
            RETURNING *
        `, [req.user.id, case_id || null, search_type, legal_issue, jurisdiction, practice_area]);

        const searchId = searchResult.rows[0].id;

        // Build AI prompt for citation research
        const systemPrompt = `You are a legal research assistant specializing in finding relevant case law, statutes, and legal citations.
Your task is to identify relevant legal authorities for the given legal issue.

IMPORTANT: Provide REAL, ACCURATE legal citations. Do not fabricate or guess at citations.
If you're uncertain about a specific citation, indicate the uncertainty.

For each citation, provide:
1. citation_type: "case_law", "statute", "regulation", or "secondary_source"
2. citation_text: The full citation in proper legal format
3. case_name: For cases, the full case name
4. court: The court that decided the case
5. year: The year of the decision/enactment
6. relevance_score: 0.0 to 1.0 indicating relevance to the legal issue
7. key_holding: A brief summary of the relevant holding or provision
8. how_to_use: Suggestions for how this authority could support an argument

Respond in JSON format:
{
    "citations": [
        {
            "citation_type": "case_law",
            "citation_text": "...",
            "case_name": "...",
            "court": "...",
            "year": "...",
            "relevance_score": 0.0,
            "key_holding": "...",
            "how_to_use": "..."
        }
    ],
    "research_summary": "Brief overview of the legal landscape on this issue",
    "additional_search_suggestions": ["suggested follow-up searches"]
}`;

        const userPrompt = `Find relevant legal citations for the following:

Legal Issue: ${legal_issue}
${jurisdiction ? `Jurisdiction: ${jurisdiction}` : ''}
${practice_area ? `Practice Area: ${practice_area}` : ''}
Search Type: ${search_type}

Please provide the most relevant and authoritative citations for this legal issue.`;

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
                'X-Title': 'LegalForms AI - Citation Finder',
                'Content-Type': 'application/json'
            }
        });

        const aiContent = response.data.choices[0].message.content;
        let analysisResult;

        try {
            const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
            analysisResult = JSON.parse(jsonMatch[0]);
        } catch (e) {
            analysisResult = {
                citations: [],
                research_summary: aiContent,
                additional_search_suggestions: []
            };
        }

        // Save citations
        for (const citation of (analysisResult.citations || [])) {
            // Convert relevance_score to integer 0-100
            let relevanceScore = citation.relevance_score || 50;
            if (relevanceScore <= 1) {
                // If it's a decimal (0.0-1.0), convert to 0-100
                relevanceScore = Math.round(relevanceScore * 100);
            } else {
                relevanceScore = Math.round(relevanceScore);
            }
            // Ensure it's within bounds
            relevanceScore = Math.max(0, Math.min(100, relevanceScore));

            await db.query(`
                INSERT INTO legal_citations
                (search_id, citation_type, citation_text, case_name, court, year,
                 relevance_score, key_holding, how_to_use)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                searchId,
                citation.citation_type,
                citation.citation_text,
                citation.case_name || null,
                citation.court || null,
                citation.year || null,
                relevanceScore,
                citation.key_holding || null,
                citation.how_to_use || null
            ]);
        }

        // Update search record
        await db.query(`
            UPDATE citation_searches
            SET status = 'completed',
                research_summary = $2,
                additional_suggestions = $3
            WHERE id = $1
        `, [
            searchId,
            analysisResult.research_summary,
            JSON.stringify(analysisResult.additional_search_suggestions || [])
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
            req.user.id,
            'citation_finder',
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
            searchId: searchId,
            citationCount: (analysisResult.citations || []).length,
            summary: analysisResult.research_summary
        });

    } catch (error) {
        console.error('Citation search error:', error);
        res.status(500).json({ success: false, error: 'Failed to search for citations' });
    }
});

// API: Get Citation Details
router.get('/api/citation-finder/citation/:id', requireAuth, async (req, res) => {
    try {
        const citation = await db.query(`
            SELECT lc.*, cs.legal_issue, cs.jurisdiction
            FROM legal_citations lc
            JOIN citation_searches cs ON lc.search_id = cs.id
            WHERE lc.id = $1 AND cs.user_id = $2
        `, [req.params.id, req.user.id]);

        if (citation.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Citation not found' });
        }

        res.json({ success: true, citation: citation.rows[0] });
    } catch (error) {
        console.error('Get citation error:', error);
        res.status(500).json({ success: false, error: 'Failed to get citation' });
    }
});

// API: Save Citation to Case
router.post('/api/citation-finder/citation/:id/save-to-case', requireAuth, async (req, res) => {
    try {
        const { case_id } = req.body;

        const citation = await db.query(`
            SELECT lc.*, cs.user_id
            FROM legal_citations lc
            JOIN citation_searches cs ON lc.search_id = cs.id
            WHERE lc.id = $1 AND cs.user_id = $2
        `, [req.params.id, req.user.id]);

        if (citation.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Citation not found' });
        }

        // Save citation as case note
        await db.query(`
            INSERT INTO case_notes (case_id, user_id, content, note_type)
            VALUES ($1, $2, $3, 'research')
        `, [
            case_id,
            req.user.id,
            `**Citation:** ${citation.rows[0].citation_text}\n\n**Holding:** ${citation.rows[0].key_holding || 'N/A'}\n\n**Usage:** ${citation.rows[0].how_to_use || 'N/A'}`
        ]);

        // Update citation with case link
        await db.query(`
            UPDATE legal_citations SET saved_to_case_id = $1 WHERE id = $2
        `, [case_id, req.params.id]);

        res.json({ success: true, message: 'Citation saved to case' });
    } catch (error) {
        console.error('Save citation error:', error);
        res.status(500).json({ success: false, error: 'Failed to save citation' });
    }
});

// API: Delete Search
router.delete('/api/citation-finder/search/:id', requireAuth, async (req, res) => {
    try {
        await db.query(`
            DELETE FROM legal_citations WHERE search_id = $1
        `, [req.params.id]);

        await db.query(`
            DELETE FROM citation_searches WHERE id = $1 AND user_id = $2
        `, [req.params.id, req.user.id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete search error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete search' });
    }
});

// =============================================
// GET /api/citation-finder/document/:documentId/citations
//
// Returns all persisted citations linked to a specific document.
// Citations are linked via legal_citations.document_id (set when a
// citation is saved to a document) or via the citation_searches.case_id
// when the search was run in the context of a document's case.
// =============================================
router.get('/api/citation-finder/document/:documentId/citations', requireAuth, async (req, res) => {
    try {
        const { documentId } = req.params;

        // Direct document link (citations explicitly saved to this document)
        const directResult = await db.query(`
            SELECT lc.*, cs.legal_issue, cs.jurisdiction, cs.practice_area, cs.created_at as search_date
            FROM legal_citations lc
            JOIN citation_searches cs ON lc.search_id = cs.id
            WHERE lc.document_id = $1 AND cs.user_id = $2
            ORDER BY lc.relevance_score DESC
        `, [documentId, req.user.id]);

        res.json({
            success: true,
            documentId,
            citations: directResult.rows,
            count: directResult.rows.length
        });
    } catch (error) {
        console.error('Get document citations error:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve document citations' });
    }
});

// =============================================
// POST /api/citation-finder/citation/:id/save-to-document
//
// Links a saved citation to a specific document for future retrieval.
// =============================================
router.post('/api/citation-finder/citation/:id/save-to-document', requireAuth, async (req, res) => {
    try {
        const { document_id } = req.body;

        if (!document_id) {
            return res.status(400).json({ success: false, error: 'document_id is required' });
        }

        // Verify citation belongs to this user
        const citation = await db.query(`
            SELECT lc.id FROM legal_citations lc
            JOIN citation_searches cs ON lc.search_id = cs.id
            WHERE lc.id = $1 AND cs.user_id = $2
        `, [req.params.id, req.user.id]);

        if (citation.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Citation not found' });
        }

        // Verify document belongs to this user
        const doc = await db.query(
            'SELECT id FROM document_history WHERE id = $1 AND user_id = $2',
            [document_id, req.user.id]
        );

        if (doc.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        await db.query(
            'UPDATE legal_citations SET document_id = $1 WHERE id = $2',
            [document_id, req.params.id]
        );

        res.json({ success: true, message: 'Citation linked to document' });
    } catch (error) {
        console.error('Save citation to document error:', error);
        res.status(500).json({ success: false, error: 'Failed to link citation to document' });
    }
});

module.exports = router;

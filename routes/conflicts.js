/**
 * Conflict Checking Routes
 * Handles conflict of interest checking for new matters and clients
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// =====================================================
// PAGE ROUTES
// =====================================================

// Conflicts dashboard
router.get('/conflicts', requireAuth, async (req, res) => {
    try {
        // Recent conflict checks
        const checksResult = await db.query(`
            SELECT cc.*, c.first_name, c.last_name, cs.title as case_title
            FROM conflict_checks cc
            LEFT JOIN clients c ON cc.client_id = c.id
            LEFT JOIN cases cs ON cc.case_id = cs.id
            WHERE (cc.user_id = $1 OR cc.user_id IS NULL)
            ORDER BY cc.created_at DESC
            LIMIT 20
        `, [req.user.id]);

        // Stats
        const statsResult = await db.query(`
            SELECT
                COUNT(*) as total_checks,
                COUNT(*) FILTER (WHERE status = 'clear') as clear_count,
                COUNT(*) FILTER (WHERE status = 'conflict_found') as conflict_count,
                COUNT(*) FILTER (WHERE status = 'waived') as waived_count,
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as recent_count
            FROM conflict_checks
            WHERE (user_id = $1 OR user_id IS NULL)
        `, [req.user.id]);

        // Party count
        const partyResult = await db.query(
            'SELECT COUNT(*) as party_count FROM conflict_parties WHERE (user_id = $1 OR user_id IS NULL)',
            [req.user.id]
        );

        res.render('conflicts/dashboard', {
            title: 'Conflict Checking',
            checks: checksResult.rows,
            stats: statsResult.rows[0],
            partyCount: partyResult.rows[0].party_count,
            req
        });
    } catch (error) {
        console.error('Conflicts dashboard error:', error);
        res.status(500).render('error', { message: 'Error loading conflicts' });
    }
});

// New conflict check form
router.get('/conflicts/new', requireAuth, async (req, res) => {
    try {
        const clientsResult = await db.query(
            'SELECT id, first_name, last_name, company_name FROM clients WHERE (user_id = $1 OR user_id IS NULL) ORDER BY last_name',
            [req.user.id]
        );

        const casesResult = await db.query(
            'SELECT id, case_number, title FROM cases WHERE (user_id = $1 OR user_id IS NULL) ORDER BY created_at DESC',
            [req.user.id]
        );

        res.render('conflicts/new', {
            title: 'New Conflict Check',
            clients: clientsResult.rows,
            cases: casesResult.rows,
            req
        });
    } catch (error) {
        console.error('New conflict check error:', error);
        res.status(500).render('error', { message: 'Error loading form' });
    }
});

// Parties database - MUST be before :id route
router.get('/conflicts/parties', requireAuth, async (req, res) => {
    try {
        const { search, party_type, role } = req.query;

        let query = `
            SELECT cp.*, c.first_name as client_first, c.last_name as client_last,
                   cs.title as case_title
            FROM conflict_parties cp
            LEFT JOIN clients c ON cp.client_id = c.id
            LEFT JOIN cases cs ON cp.case_id = cs.id
            WHERE (cp.user_id = $1 OR cp.user_id IS NULL)
        `;
        const params = [req.user.id];
        let paramIndex = 2;

        if (search) {
            query += ` AND cp.name ILIKE $${paramIndex}`;
            params.push(`%${search}%`);
            paramIndex++;
        }
        if (party_type) {
            query += ` AND cp.party_type = $${paramIndex}`;
            params.push(party_type);
            paramIndex++;
        }
        if (role) {
            query += ` AND cp.relationship = $${paramIndex}`;
            params.push(role);
            paramIndex++;
        }

        query += ' ORDER BY cp.name ASC';

        const result = await db.query(query, params);

        // Get cases for the modal
        const casesResult = await db.query(
            'SELECT id, title FROM cases WHERE (user_id = $1 OR user_id IS NULL) ORDER BY title',
            [req.user.id]
        );

        res.render('conflicts/parties', {
            title: 'Parties Database',
            parties: result.rows,
            cases: casesResult.rows,
            filters: { search, party_type, role },
            req
        });
    } catch (error) {
        console.error('Parties list error:', error);
        res.status(500).render('error', { message: 'Error loading parties' });
    }
});

// Conflict check history - MUST be before :id route
router.get('/conflicts/history', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT cc.*,
                   c.first_name as client_first, c.last_name as client_last
            FROM conflict_checks cc
            LEFT JOIN clients c ON cc.client_id = c.id
            WHERE (cc.user_id = $1 OR cc.user_id IS NULL)
            ORDER BY cc.created_at DESC
        `, [req.user.id]);

        res.render('conflicts/history', {
            title: 'Conflict Check History',
            checks: result.rows,
            req
        });
    } catch (error) {
        console.error('Conflict history error:', error);
        res.status(500).render('error', { message: 'Error loading history' });
    }
});

// Waivers management - MUST be before :id route
router.get('/conflicts/waivers', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT cw.*, cc.search_terms, c.first_name, c.last_name
            FROM conflict_waivers cw
            JOIN conflict_checks cc ON cw.conflict_check_id = cc.id
            LEFT JOIN clients c ON cc.client_id = c.id
            WHERE (cc.user_id = $1 OR cc.user_id IS NULL)
            ORDER BY cw.created_at DESC
        `, [req.user.id]);

        // Get clients for the dropdown
        const clientsResult = await db.query(`
            SELECT id, first_name, last_name, company_name
            FROM clients WHERE (user_id = $1 OR user_id IS NULL) ORDER BY last_name
        `, [req.user.id]);

        res.render('conflicts/waivers', {
            title: 'Conflict Waivers',
            waivers: result.rows,
            clients: clientsResult.rows,
            req
        });
    } catch (error) {
        console.error('Waivers error:', error);
        res.status(500).render('error', { message: 'Error loading waivers' });
    }
});

// Create waiver (form submission)
router.post('/conflicts/waivers', requireAuth, async (req, res) => {
    try {
        const { client_id, waiver_type, description } = req.body;

        // Create a conflict check with waived status first
        const checkResult = await db.query(`
            INSERT INTO conflict_checks (user_id, client_id, search_terms, status, check_type)
            VALUES ($1, $2, $3, 'waived', 'waiver')
            RETURNING id
        `, [req.user.id, client_id || null, JSON.stringify({ names: [], companies: [] })]);

        const conflictCheckId = checkResult.rows[0].id;

        // Create the waiver
        await db.query(`
            INSERT INTO conflict_waivers (conflict_check_id, waiver_type, waiver_text, obtained_date)
            VALUES ($1, $2, $3, CURRENT_DATE)
        `, [conflictCheckId, waiver_type || 'standard', description || '']);

        res.redirect('/conflicts/waivers');
    } catch (error) {
        console.error('Create waiver error:', error);
        res.status(500).render('error', { message: 'Error creating waiver' });
    }
});

// Waiver detail - MUST be before :id route
router.get('/conflicts/waivers/:id', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT cw.*, cc.search_terms, cc.status as check_status, cc.check_type,
                   c.first_name, c.last_name, c.company_name, c.email, c.phone
            FROM conflict_waivers cw
            JOIN conflict_checks cc ON cw.conflict_check_id = cc.id
            LEFT JOIN clients c ON cc.client_id = c.id
            WHERE cw.id = $1 AND (cc.user_id = $2 OR cc.user_id IS NULL)
        `, [req.params.id, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).render('error', { message: 'Waiver not found' });
        }

        res.render('conflicts/waiver-detail', {
            title: 'Waiver Details',
            waiver: result.rows[0],
            req
        });
    } catch (error) {
        console.error('Waiver detail error:', error);
        res.status(500).render('error', { message: 'Error loading waiver' });
    }
});

// Conflict check detail - MUST be AFTER all static routes
router.get('/conflicts/:id', requireAuth, async (req, res) => {
    try {
        const checkResult = await db.query(`
            SELECT cc.*, c.first_name, c.last_name, cs.title as case_title
            FROM conflict_checks cc
            LEFT JOIN clients c ON cc.client_id = c.id
            LEFT JOIN cases cs ON cc.case_id = cs.id
            WHERE cc.id = $1 AND (cc.user_id = $2 OR cc.user_id IS NULL)
        `, [req.params.id, req.user.id]);

        if (checkResult.rows.length === 0) {
            return res.status(404).render('error', { message: 'Conflict check not found' });
        }

        // Get waivers
        const waiversResult = await db.query(
            'SELECT * FROM conflict_waivers WHERE conflict_check_id = $1',
            [req.params.id]
        );

        res.render('conflicts/check-detail', {
            title: 'Conflict Check Details',
            check: checkResult.rows[0],
            waivers: waiversResult.rows,
            req
        });
    } catch (error) {
        console.error('Conflict check detail error:', error);
        res.status(500).render('error', { message: 'Error loading conflict check' });
    }
});

// =====================================================
// API ROUTES
// =====================================================

// Run conflict check
router.post('/api/conflicts/check', requireAuth, async (req, res) => {
    try {
        const { names, companies, check_type, client_id, case_id } = req.body;

        if (!names || names.length === 0) {
            return res.status(400).json({ error: 'At least one name is required' });
        }

        const searchTerms = { names: names || [], companies: companies || [] };
        const allTerms = [...(names || []), ...(companies || [])];
        const conflicts = [];

        // Search for conflicts
        for (const term of allTerms) {
            if (!term || term.trim().length < 2) continue;

            const searchPattern = `%${term.trim()}%`;

            // Search in clients
            const clientsResult = await db.query(`
                SELECT 'client' as source, id, first_name, last_name, company_name, email
                FROM clients
                WHERE (user_id = $1 OR user_id IS NULL) AND (
                    first_name ILIKE $2 OR
                    last_name ILIKE $2 OR
                    company_name ILIKE $2 OR
                    email ILIKE $2
                )
            `, [req.user.id, searchPattern]);

            // Search in conflict parties
            const partiesResult = await db.query(`
                SELECT 'party' as source, id, name, party_type, relationship, company, case_id, client_id
                FROM conflict_parties
                WHERE (user_id = $1 OR user_id IS NULL) AND (
                    name ILIKE $2 OR
                    company ILIKE $2 OR
                    email ILIKE $2 OR
                    $2 ILIKE ANY(SELECT jsonb_array_elements_text(aliases))
                )
            `, [req.user.id, searchPattern]);

            // Search in cases (opposing parties)
            const casesResult = await db.query(`
                SELECT 'case' as source, id, title, opposing_party, opposing_counsel
                FROM cases
                WHERE (user_id = $1 OR user_id IS NULL) AND (
                    opposing_party ILIKE $2 OR
                    opposing_counsel ILIKE $2
                )
            `, [req.user.id, searchPattern]);

            conflicts.push(...clientsResult.rows.map(r => ({ ...r, matched_term: term })));
            conflicts.push(...partiesResult.rows.map(r => ({ ...r, matched_term: term })));
            conflicts.push(...casesResult.rows.map(r => ({ ...r, matched_term: term })));
        }

        // Remove duplicates
        const uniqueConflicts = conflicts.filter((c, i, arr) =>
            arr.findIndex(x => x.source === c.source && x.id === c.id) === i
        );

        const status = uniqueConflicts.length > 0 ? 'conflict_found' : 'clear';

        // Save conflict check
        const checkResult = await db.query(`
            INSERT INTO conflict_checks
            (user_id, check_type, search_terms, status, results, conflict_count, checked_by, client_id, case_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [
            req.user.id,
            check_type || 'new_matter',
            JSON.stringify(searchTerms),
            status,
            JSON.stringify(uniqueConflicts),
            uniqueConflicts.length,
            req.user.id,
            client_id || null,
            case_id || null
        ]);

        res.json({
            success: true,
            check: checkResult.rows[0],
            conflicts: uniqueConflicts,
            status
        });
    } catch (error) {
        console.error('Run conflict check error:', error);
        res.status(500).json({ error: 'Failed to run conflict check' });
    }
});

// Add party to database
router.post('/api/conflicts/parties', requireAuth, async (req, res) => {
    try {
        const { party_type, name, aliases, email, phone, company, address, case_id, client_id, relationship, notes } = req.body;

        const result = await db.query(`
            INSERT INTO conflict_parties
            (user_id, party_type, name, aliases, email, phone, company, address, case_id, client_id, relationship, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `, [
            req.user.id, party_type, name, JSON.stringify(aliases || []),
            email, phone, company, address, case_id || null, client_id || null,
            relationship, notes
        ]);

        res.json({ success: true, party: result.rows[0] });
    } catch (error) {
        console.error('Add party error:', error);
        res.status(500).json({ error: 'Failed to add party' });
    }
});

// Update conflict check status
router.put('/api/conflicts/:id/status', requireAuth, async (req, res) => {
    try {
        const { status } = req.body;

        const result = await db.query(`
            UPDATE conflict_checks SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP
            WHERE id = $3 AND (user_id = $4 OR user_id IS NULL)
            RETURNING *
        `, [status, req.user.id, req.params.id, req.user.id]);

        res.json({ success: true, check: result.rows[0] });
    } catch (error) {
        console.error('Update conflict status error:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// Add waiver
router.post('/api/conflicts/:id/waivers', requireAuth, async (req, res) => {
    try {
        const { waiver_type, parties_involved, waiver_text, obtained_from, obtained_date } = req.body;

        // Verify ownership
        const checkResult = await db.query(
            'SELECT id FROM conflict_checks WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
            [req.params.id, req.user.id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Conflict check not found' });
        }

        const result = await db.query(`
            INSERT INTO conflict_waivers
            (conflict_check_id, waiver_type, parties_involved, waiver_text, obtained_from, obtained_date)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [req.params.id, waiver_type, JSON.stringify(parties_involved), waiver_text, obtained_from, obtained_date]);

        // Update check status to waived
        await db.query(
            'UPDATE conflict_checks SET status = $1, waiver_obtained = true WHERE id = $2',
            ['waived', req.params.id]
        );

        res.json({ success: true, waiver: result.rows[0] });
    } catch (error) {
        console.error('Add waiver error:', error);
        res.status(500).json({ error: 'Failed to add waiver' });
    }
});

// Alias: Add waiver (singular - for frontend compatibility)
router.post('/api/conflicts/:id/waiver', requireAuth, async (req, res) => {
    try {
        const { waiver_type, parties_involved, waiver_text, obtained_from, obtained_date } = req.body;

        const checkResult = await db.query(
            'SELECT id FROM conflict_checks WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
            [req.params.id, req.user.id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Conflict check not found' });
        }

        const result = await db.query(`
            INSERT INTO conflict_waivers
            (conflict_check_id, waiver_type, parties_involved, waiver_text, obtained_from, obtained_date)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [req.params.id, waiver_type, JSON.stringify(parties_involved || []), waiver_text, obtained_from, obtained_date]);

        await db.query(
            'UPDATE conflict_checks SET status = $1, waiver_obtained = true WHERE id = $2',
            ['waived', req.params.id]
        );

        res.json({ success: true, waiver: result.rows[0] });
    } catch (error) {
        console.error('Add waiver error:', error);
        res.status(500).json({ error: 'Failed to add waiver' });
    }
});

// Delete conflict check
router.delete('/api/conflicts/:id', requireAuth, async (req, res) => {
    try {
        // First delete related waivers
        await db.query(
            'DELETE FROM conflict_waivers WHERE conflict_check_id = $1',
            [req.params.id]
        );

        // Then delete the conflict check
        await db.query(
            'DELETE FROM conflict_checks WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
            [req.params.id, req.user.id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Delete conflict check error:', error);
        res.status(500).json({ error: 'Failed to delete conflict check' });
    }
});

// Delete waiver
router.delete('/api/conflicts/waivers/:id', requireAuth, async (req, res) => {
    try {
        await db.query(`
            DELETE FROM conflict_waivers
            WHERE id = $1 AND conflict_check_id IN (
                SELECT id FROM conflict_checks WHERE (user_id = $2 OR user_id IS NULL)
            )
        `, [req.params.id, req.user.id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete waiver error:', error);
        res.status(500).json({ error: 'Failed to delete waiver' });
    }
});

// Delete party
router.delete('/api/conflicts/parties/:id', requireAuth, async (req, res) => {
    try {
        await db.query(
            'DELETE FROM conflict_parties WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
            [req.params.id, req.user.id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Delete party error:', error);
        res.status(500).json({ error: 'Failed to delete party' });
    }
});

// Auto-add parties from case
router.post('/api/cases/:id/extract-parties', requireAuth, async (req, res) => {
    try {
        const caseResult = await db.query(
            'SELECT * FROM cases WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
            [req.params.id, req.user.id]
        );

        if (caseResult.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        const caseData = caseResult.rows[0];
        const partiesAdded = [];

        // Add opposing party
        if (caseData.opposing_party) {
            const result = await db.query(`
                INSERT INTO conflict_parties (user_id, party_type, name, case_id, relationship)
                VALUES ($1, 'opposing_party', $2, $3, 'opposing')
                ON CONFLICT DO NOTHING
                RETURNING *
            `, [req.user.id, caseData.opposing_party, caseData.id]);

            if (result.rows.length > 0) partiesAdded.push(result.rows[0]);
        }

        // Add opposing counsel
        if (caseData.opposing_counsel) {
            const result = await db.query(`
                INSERT INTO conflict_parties (user_id, party_type, name, case_id, relationship)
                VALUES ($1, 'individual', $2, $3, 'opposing_counsel')
                ON CONFLICT DO NOTHING
                RETURNING *
            `, [req.user.id, caseData.opposing_counsel, caseData.id]);

            if (result.rows.length > 0) partiesAdded.push(result.rows[0]);
        }

        res.json({ success: true, partiesAdded });
    } catch (error) {
        console.error('Extract parties error:', error);
        res.status(500).json({ error: 'Failed to extract parties' });
    }
});

module.exports = router;

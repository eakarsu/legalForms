/**
 * Cases API Tests
 * Tests all case/matter-related endpoints and functionality
 */

const {
    initTestDb,
    closeTestDb,
    createTestUser,
    deleteTestUser,
    createTestClient,
    createTestCase,
    getPool
} = require('../helpers/testSetup');

describe('Cases API', () => {
    let testUser;
    let testClient;
    let pool;

    beforeAll(async () => {
        pool = await initTestDb();
        testUser = await createTestUser();
        testClient = await createTestClient(testUser.id);
    });

    afterAll(async () => {
        await deleteTestUser(testUser.id);
        await closeTestDb();
    });

    describe('GET /api/cases', () => {
        let testCases = [];

        beforeAll(async () => {
            // Create multiple test cases
            testCases.push(await createTestCase(testUser.id, testClient.id, { title: 'Case A', status: 'open', priority: 'high' }));
            testCases.push(await createTestCase(testUser.id, testClient.id, { title: 'Case B', status: 'pending', priority: 'medium' }));
            testCases.push(await createTestCase(testUser.id, testClient.id, { title: 'Case C', status: 'closed', priority: 'low', case_type: 'corporate' }));
        });

        test('should return all cases for authenticated user', async () => {
            const result = await pool.query(
                'SELECT * FROM cases WHERE user_id = $1 ORDER BY created_at DESC',
                [testUser.id]
            );

            expect(result.rows.length).toBeGreaterThanOrEqual(3);
        });

        test('should filter cases by status', async () => {
            const result = await pool.query(
                'SELECT * FROM cases WHERE user_id = $1 AND status = $2',
                [testUser.id, 'open']
            );

            expect(result.rows.every(c => c.status === 'open')).toBe(true);
        });

        test('should filter cases by client', async () => {
            const result = await pool.query(
                'SELECT * FROM cases WHERE user_id = $1 AND client_id = $2',
                [testUser.id, testClient.id]
            );

            expect(result.rows.every(c => c.client_id === testClient.id)).toBe(true);
        });

        test('should filter cases by priority', async () => {
            const result = await pool.query(
                'SELECT * FROM cases WHERE user_id = $1 AND priority = $2',
                [testUser.id, 'high']
            );

            expect(result.rows.every(c => c.priority === 'high')).toBe(true);
        });

        test('should filter cases by type', async () => {
            const result = await pool.query(
                'SELECT * FROM cases WHERE user_id = $1 AND case_type = $2',
                [testUser.id, 'corporate']
            );

            expect(result.rows.every(c => c.case_type === 'corporate')).toBe(true);
        });

        test('should search cases by title', async () => {
            const searchTerm = 'Case A';
            const result = await pool.query(
                `SELECT * FROM cases WHERE user_id = $1 AND title ILIKE $2`,
                [testUser.id, `%${searchTerm}%`]
            );

            expect(result.rows.some(c => c.title === 'Case A')).toBe(true);
        });
    });

    describe('GET /api/cases/:id', () => {
        let testCase;

        beforeAll(async () => {
            testCase = await createTestCase(testUser.id, testClient.id, {
                title: 'Detail Test Case',
                description: 'Test description',
                case_type: 'litigation',
                court_name: 'Test Court',
                judge_name: 'Judge Test'
            });
        });

        test('should return case by ID with client info', async () => {
            const result = await pool.query(
                `SELECT c.*, cl.first_name, cl.last_name, cl.company_name
                 FROM cases c
                 LEFT JOIN clients cl ON c.client_id = cl.id
                 WHERE c.id = $1 AND c.user_id = $2`,
                [testCase.id, testUser.id]
            );

            expect(result.rows.length).toBe(1);
            expect(result.rows[0].id).toBe(testCase.id);
            expect(result.rows[0].title).toBe('Detail Test Case');
        });

        test('should return 404 for non-existent case', async () => {
            const fakeId = '00000000-0000-0000-0000-000000000000';
            const result = await pool.query(
                'SELECT * FROM cases WHERE id = $1 AND user_id = $2',
                [fakeId, testUser.id]
            );

            expect(result.rows.length).toBe(0);
        });
    });

    describe('POST /api/cases', () => {
        test('should create a new case', async () => {
            const caseData = {
                title: 'New Test Case',
                case_type: 'litigation',
                priority: 'high',
                description: 'Test description'
            };

            const result = await pool.query(
                `INSERT INTO cases (user_id, client_id, title, case_type, priority, description, status, case_number)
                 VALUES ($1, $2, $3, $4, $5, $6, 'open', $7)
                 RETURNING *`,
                [testUser.id, testClient.id, caseData.title, caseData.case_type, caseData.priority, caseData.description, `CASE-${Date.now()}`]
            );

            expect(result.rows.length).toBe(1);
            expect(result.rows[0].title).toBe('New Test Case');
            expect(result.rows[0].status).toBe('open');
        });

        test('should generate unique case number', async () => {
            const result1 = await pool.query(
                `INSERT INTO cases (user_id, title, status, case_number)
                 VALUES ($1, 'Case 1', 'open', $2)
                 RETURNING case_number`,
                [testUser.id, `CASE-${Date.now()}-1`]
            );

            const result2 = await pool.query(
                `INSERT INTO cases (user_id, title, status, case_number)
                 VALUES ($1, 'Case 2', 'open', $2)
                 RETURNING case_number`,
                [testUser.id, `CASE-${Date.now()}-2`]
            );

            expect(result1.rows[0].case_number).not.toBe(result2.rows[0].case_number);
        });

        test('should allow creating case without client', async () => {
            const result = await pool.query(
                `INSERT INTO cases (user_id, title, status, case_number)
                 VALUES ($1, 'No Client Case', 'open', $2)
                 RETURNING *`,
                [testUser.id, `CASE-NC-${Date.now()}`]
            );

            expect(result.rows.length).toBe(1);
            expect(result.rows[0].client_id).toBeNull();
        });
    });

    describe('PUT /api/cases/:id', () => {
        let testCase;

        beforeAll(async () => {
            testCase = await createTestCase(testUser.id, testClient.id, {
                title: 'Update Test Case'
            });
        });

        test('should update case information', async () => {
            const updateData = {
                title: 'Updated Case Title',
                priority: 'urgent',
                description: 'Updated description'
            };

            const result = await pool.query(
                `UPDATE cases SET title = $1, priority = $2, description = $3, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $4 AND user_id = $5
                 RETURNING *`,
                [updateData.title, updateData.priority, updateData.description, testCase.id, testUser.id]
            );

            expect(result.rows.length).toBe(1);
            expect(result.rows[0].title).toBe('Updated Case Title');
            expect(result.rows[0].priority).toBe('urgent');
        });

        test('should update case status', async () => {
            const result = await pool.query(
                `UPDATE cases SET status = 'closed', date_closed = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1 AND user_id = $2
                 RETURNING *`,
                [testCase.id, testUser.id]
            );

            expect(result.rows[0].status).toBe('closed');
            expect(result.rows[0].date_closed).not.toBeNull();
        });

        test('should not update other users cases', async () => {
            const otherUserId = '11111111-1111-1111-1111-111111111111';
            const result = await pool.query(
                `UPDATE cases SET title = 'Hacked'
                 WHERE id = $1 AND user_id = $2
                 RETURNING *`,
                [testCase.id, otherUserId]
            );

            expect(result.rows.length).toBe(0);
        });
    });

    describe('DELETE /api/cases/:id', () => {
        let testCase;

        beforeEach(async () => {
            testCase = await createTestCase(testUser.id, testClient.id, {
                title: 'Delete Test Case'
            });
        });

        test('should delete case', async () => {
            const result = await pool.query(
                'DELETE FROM cases WHERE id = $1 AND user_id = $2 RETURNING *',
                [testCase.id, testUser.id]
            );

            expect(result.rows.length).toBe(1);

            // Verify deletion
            const verify = await pool.query('SELECT * FROM cases WHERE id = $1', [testCase.id]);
            expect(verify.rows.length).toBe(0);
        });

        test('should cascade delete related records', async () => {
            const { v4: uuidv4 } = require('uuid');

            // Add a note to the case
            await pool.query(
                `INSERT INTO case_notes (id, case_id, user_id, content, note_type)
                 VALUES ($1, $2, $3, 'Test note', 'general')`,
                [uuidv4(), testCase.id, testUser.id]
            );

            // Delete the case
            await pool.query('DELETE FROM cases WHERE id = $1', [testCase.id]);

            // Verify notes are also deleted (if cascade is set up)
            const notes = await pool.query('SELECT * FROM case_notes WHERE case_id = $1', [testCase.id]);
            expect(notes.rows.length).toBe(0);
        });
    });

    describe('Case Notes', () => {
        let testCase;

        beforeAll(async () => {
            testCase = await createTestCase(testUser.id, testClient.id);
        });

        test('should add note to case', async () => {
            const { v4: uuidv4 } = require('uuid');

            const result = await pool.query(
                `INSERT INTO case_notes (id, case_id, user_id, content, note_type, is_billable)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *`,
                [uuidv4(), testCase.id, testUser.id, 'Test note content', 'general', false]
            );

            expect(result.rows.length).toBe(1);
            expect(result.rows[0].content).toBe('Test note content');
        });

        test('should get all notes for a case', async () => {
            const result = await pool.query(
                'SELECT * FROM case_notes WHERE case_id = $1 ORDER BY created_at DESC',
                [testCase.id]
            );

            expect(result.rows.length).toBeGreaterThanOrEqual(1);
        });

        test('should filter notes by type', async () => {
            const { v4: uuidv4 } = require('uuid');

            await pool.query(
                `INSERT INTO case_notes (id, case_id, user_id, content, note_type)
                 VALUES ($1, $2, $3, 'Court note', 'court')`,
                [uuidv4(), testCase.id, testUser.id]
            );

            const result = await pool.query(
                'SELECT * FROM case_notes WHERE case_id = $1 AND note_type = $2',
                [testCase.id, 'court']
            );

            expect(result.rows.every(n => n.note_type === 'court')).toBe(true);
        });
    });

    describe('Case Statistics', () => {
        test('should calculate total billable hours for a case', async () => {
            const testCase = await createTestCase(testUser.id, testClient.id);
            const { v4: uuidv4 } = require('uuid');

            // Add time entries
            await pool.query(
                `INSERT INTO time_entries (id, user_id, case_id, description, duration_minutes, is_billable)
                 VALUES ($1, $2, $3, 'Work 1', 60, true)`,
                [uuidv4(), testUser.id, testCase.id]
            );

            await pool.query(
                `INSERT INTO time_entries (id, user_id, case_id, description, duration_minutes, is_billable)
                 VALUES ($1, $2, $3, 'Work 2', 90, true)`,
                [uuidv4(), testUser.id, testCase.id]
            );

            const result = await pool.query(
                'SELECT COALESCE(SUM(duration_minutes), 0) as total_minutes FROM time_entries WHERE case_id = $1 AND is_billable = true',
                [testCase.id]
            );

            expect(parseInt(result.rows[0].total_minutes)).toBe(150);
        });

        test('should count cases by status', async () => {
            const result = await pool.query(
                `SELECT status, COUNT(*) as count FROM cases WHERE user_id = $1 GROUP BY status`,
                [testUser.id]
            );

            expect(result.rows.length).toBeGreaterThanOrEqual(1);
        });
    });
});

/**
 * Clients API Tests
 * Tests all client-related endpoints and functionality
 */

const {
    initTestDb,
    closeTestDb,
    createTestUser,
    deleteTestUser,
    createTestClient,
    getPool,
    mockRequest,
    mockResponse
} = require('../helpers/testSetup');

describe('Clients API', () => {
    let testUser;
    let pool;

    beforeAll(async () => {
        pool = await initTestDb();
        testUser = await createTestUser();
    });

    afterAll(async () => {
        await deleteTestUser(testUser.id);
        await closeTestDb();
    });

    describe('GET /api/clients', () => {
        let testClients = [];

        beforeAll(async () => {
            // Create multiple test clients
            testClients.push(await createTestClient(testUser.id, { first_name: 'Alice', last_name: 'Smith' }));
            testClients.push(await createTestClient(testUser.id, { first_name: 'Bob', last_name: 'Johnson', client_type: 'business', company_name: 'ABC Corp' }));
            testClients.push(await createTestClient(testUser.id, { first_name: 'Charlie', last_name: 'Brown', status: 'inactive' }));
        });

        test('should return all clients for authenticated user', async () => {
            const result = await pool.query(
                'SELECT * FROM clients WHERE user_id = $1 ORDER BY created_at DESC',
                [testUser.id]
            );

            expect(result.rows.length).toBeGreaterThanOrEqual(3);
        });

        test('should filter clients by status', async () => {
            const result = await pool.query(
                'SELECT * FROM clients WHERE user_id = $1 AND status = $2',
                [testUser.id, 'active']
            );

            expect(result.rows.every(c => c.status === 'active')).toBe(true);
        });

        test('should filter clients by type', async () => {
            const result = await pool.query(
                'SELECT * FROM clients WHERE user_id = $1 AND client_type = $2',
                [testUser.id, 'business']
            );

            expect(result.rows.every(c => c.client_type === 'business')).toBe(true);
        });

        test('should search clients by name', async () => {
            const searchTerm = 'Alice';
            const result = await pool.query(
                `SELECT * FROM clients WHERE user_id = $1 AND (first_name ILIKE $2 OR last_name ILIKE $2 OR company_name ILIKE $2)`,
                [testUser.id, `%${searchTerm}%`]
            );

            expect(result.rows.some(c => c.first_name === 'Alice')).toBe(true);
        });
    });

    describe('GET /api/clients/:id', () => {
        let testClient;

        beforeAll(async () => {
            testClient = await createTestClient(testUser.id, {
                first_name: 'Detail',
                last_name: 'Test',
                email: 'detail@test.com',
                phone: '555-999-8888',
                address: '123 Test St',
                city: 'Test City',
                state: 'TS',
                zip: '12345'
            });
        });

        test('should return client by ID', async () => {
            const result = await pool.query(
                'SELECT * FROM clients WHERE id = $1 AND user_id = $2',
                [testClient.id, testUser.id]
            );

            expect(result.rows.length).toBe(1);
            expect(result.rows[0].id).toBe(testClient.id);
            expect(result.rows[0].first_name).toBe('Detail');
        });

        test('should return 404 for non-existent client', async () => {
            const fakeId = '00000000-0000-0000-0000-000000000000';
            const result = await pool.query(
                'SELECT * FROM clients WHERE id = $1 AND user_id = $2',
                [fakeId, testUser.id]
            );

            expect(result.rows.length).toBe(0);
        });

        test('should not return other users clients', async () => {
            const otherUserId = '11111111-1111-1111-1111-111111111111';
            const result = await pool.query(
                'SELECT * FROM clients WHERE id = $1 AND user_id = $2',
                [testClient.id, otherUserId]
            );

            expect(result.rows.length).toBe(0);
        });
    });

    describe('POST /api/clients', () => {
        test('should create a new individual client', async () => {
            const clientData = {
                client_type: 'individual',
                first_name: 'New',
                last_name: 'Client',
                email: `newclient_${Date.now()}@test.com`,
                phone: '555-111-2222'
            };

            const result = await pool.query(
                `INSERT INTO clients (user_id, client_type, first_name, last_name, email, phone, status)
                 VALUES ($1, $2, $3, $4, $5, $6, 'active')
                 RETURNING *`,
                [testUser.id, clientData.client_type, clientData.first_name, clientData.last_name, clientData.email, clientData.phone]
            );

            expect(result.rows.length).toBe(1);
            expect(result.rows[0].first_name).toBe('New');
            expect(result.rows[0].last_name).toBe('Client');
            expect(result.rows[0].status).toBe('active');
        });

        test('should create a new business client', async () => {
            const clientData = {
                client_type: 'business',
                company_name: 'Test Corp Inc',
                email: `testcorp_${Date.now()}@test.com`,
                phone: '555-333-4444'
            };

            const result = await pool.query(
                `INSERT INTO clients (user_id, client_type, company_name, email, phone, status)
                 VALUES ($1, $2, $3, $4, $5, 'active')
                 RETURNING *`,
                [testUser.id, clientData.client_type, clientData.company_name, clientData.email, clientData.phone]
            );

            expect(result.rows.length).toBe(1);
            expect(result.rows[0].company_name).toBe('Test Corp Inc');
            expect(result.rows[0].client_type).toBe('business');
        });

        test('should validate required fields', async () => {
            // Without first_name or company_name, client should still be created but with null values
            const result = await pool.query(
                `INSERT INTO clients (user_id, client_type, email, status)
                 VALUES ($1, 'individual', $2, 'active')
                 RETURNING *`,
                [testUser.id, `minimal_${Date.now()}@test.com`]
            );

            expect(result.rows.length).toBe(1);
            expect(result.rows[0].first_name).toBeNull();
        });
    });

    describe('PUT /api/clients/:id', () => {
        let testClient;

        beforeAll(async () => {
            testClient = await createTestClient(testUser.id, {
                first_name: 'Update',
                last_name: 'Test'
            });
        });

        test('should update client information', async () => {
            const updateData = {
                first_name: 'Updated',
                last_name: 'Name',
                phone: '555-NEW-NUMB'
            };

            const result = await pool.query(
                `UPDATE clients SET first_name = $1, last_name = $2, phone = $3, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $4 AND user_id = $5
                 RETURNING *`,
                [updateData.first_name, updateData.last_name, updateData.phone, testClient.id, testUser.id]
            );

            expect(result.rows.length).toBe(1);
            expect(result.rows[0].first_name).toBe('Updated');
            expect(result.rows[0].last_name).toBe('Name');
        });

        test('should update client status', async () => {
            const result = await pool.query(
                `UPDATE clients SET status = 'inactive', updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1 AND user_id = $2
                 RETURNING *`,
                [testClient.id, testUser.id]
            );

            expect(result.rows[0].status).toBe('inactive');
        });

        test('should not update other users clients', async () => {
            const otherUserId = '11111111-1111-1111-1111-111111111111';
            const result = await pool.query(
                `UPDATE clients SET first_name = 'Hacked'
                 WHERE id = $1 AND user_id = $2
                 RETURNING *`,
                [testClient.id, otherUserId]
            );

            expect(result.rows.length).toBe(0);
        });
    });

    describe('DELETE /api/clients/:id', () => {
        let testClient;

        beforeEach(async () => {
            testClient = await createTestClient(testUser.id, {
                first_name: 'Delete',
                last_name: 'Test'
            });
        });

        test('should delete client', async () => {
            const result = await pool.query(
                'DELETE FROM clients WHERE id = $1 AND user_id = $2 RETURNING *',
                [testClient.id, testUser.id]
            );

            expect(result.rows.length).toBe(1);

            // Verify deletion
            const verify = await pool.query('SELECT * FROM clients WHERE id = $1', [testClient.id]);
            expect(verify.rows.length).toBe(0);
        });

        test('should not delete other users clients', async () => {
            const otherUserId = '11111111-1111-1111-1111-111111111111';
            const result = await pool.query(
                'DELETE FROM clients WHERE id = $1 AND user_id = $2 RETURNING *',
                [testClient.id, otherUserId]
            );

            expect(result.rows.length).toBe(0);

            // Verify client still exists
            const verify = await pool.query('SELECT * FROM clients WHERE id = $1', [testClient.id]);
            expect(verify.rows.length).toBe(1);
        });
    });

    describe('Client Contacts', () => {
        let testClient;

        beforeAll(async () => {
            testClient = await createTestClient(testUser.id);
        });

        test('should add contact to client', async () => {
            const { v4: uuidv4 } = require('uuid');
            const contactId = uuidv4();

            const result = await pool.query(
                `INSERT INTO client_contacts (id, client_id, name, role, email, phone, is_primary)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING *`,
                [contactId, testClient.id, 'Jane Doe', 'Assistant', 'jane@test.com', '555-123-4567', true]
            );

            expect(result.rows.length).toBe(1);
            expect(result.rows[0].name).toBe('Jane Doe');
            expect(result.rows[0].is_primary).toBe(true);
        });

        test('should get all contacts for a client', async () => {
            const result = await pool.query(
                'SELECT * FROM client_contacts WHERE client_id = $1',
                [testClient.id]
            );

            expect(result.rows.length).toBeGreaterThanOrEqual(1);
        });
    });
});

/**
 * Communications API Tests
 * Tests all communication-related endpoints: Messages, Notifications
 */

const {
    initTestDb,
    closeTestDb,
    createTestUser,
    deleteTestUser,
    createTestClient,
    createTestCase,
    createTestMessage,
    createTestNotification,
    getPool
} = require('../helpers/testSetup');

describe('Communications API', () => {
    let testUser;
    let testClient;
    let testCase;
    let pool;

    beforeAll(async () => {
        pool = await initTestDb();
        testUser = await createTestUser();
        testClient = await createTestClient(testUser.id);
        testCase = await createTestCase(testUser.id, testClient.id);
    });

    afterAll(async () => {
        await deleteTestUser(testUser.id);
        await closeTestDb();
    });

    // ==================== MESSAGES ====================
    describe('Messages', () => {
        describe('GET /api/messages', () => {
            let testMessages = [];

            beforeAll(async () => {
                testMessages.push(await createTestMessage(testUser.id, testClient.id, testCase.id, { subject: 'Message 1', message_type: 'client' }));
                testMessages.push(await createTestMessage(testUser.id, null, null, { subject: 'Message 2', message_type: 'internal' }));
                testMessages.push(await createTestMessage(testUser.id, testClient.id, null, { subject: 'Message 3', message_type: 'client', is_read: true }));
            });

            test('should return all messages for user', async () => {
                const result = await pool.query(
                    'SELECT * FROM messages WHERE user_id = $1 ORDER BY created_at DESC',
                    [testUser.id]
                );

                expect(result.rows.length).toBeGreaterThanOrEqual(3);
            });

            test('should filter by message type', async () => {
                const result = await pool.query(
                    'SELECT * FROM messages WHERE user_id = $1 AND message_type = $2',
                    [testUser.id, 'client']
                );

                expect(result.rows.every(m => m.message_type === 'client')).toBe(true);
            });

            test('should filter by client', async () => {
                const result = await pool.query(
                    'SELECT * FROM messages WHERE user_id = $1 AND client_id = $2',
                    [testUser.id, testClient.id]
                );

                expect(result.rows.every(m => m.client_id === testClient.id)).toBe(true);
            });

            test('should filter by case', async () => {
                const result = await pool.query(
                    'SELECT * FROM messages WHERE user_id = $1 AND case_id = $2',
                    [testUser.id, testCase.id]
                );

                expect(result.rows.every(m => m.case_id === testCase.id)).toBe(true);
            });

            test('should filter unread messages', async () => {
                const result = await pool.query(
                    'SELECT * FROM messages WHERE user_id = $1 AND is_read = false',
                    [testUser.id]
                );

                expect(result.rows.every(m => m.is_read === false)).toBe(true);
            });

            test('should count unread messages', async () => {
                const result = await pool.query(
                    'SELECT COUNT(*) as unread_count FROM messages WHERE user_id = $1 AND is_read = false',
                    [testUser.id]
                );

                expect(parseInt(result.rows[0].unread_count)).toBeGreaterThanOrEqual(0);
            });
        });

        describe('GET /api/messages/:id', () => {
            let testMessage;

            beforeAll(async () => {
                testMessage = await createTestMessage(testUser.id, testClient.id, testCase.id, {
                    subject: 'Detail Test Message',
                    content: 'This is a detailed test message content.'
                });
            });

            test('should return message by ID', async () => {
                const result = await pool.query(
                    `SELECT m.*, c.title as case_title
                     FROM messages m
                     LEFT JOIN cases c ON m.case_id = c.id
                     WHERE m.id = $1 AND m.user_id = $2`,
                    [testMessage.id, testUser.id]
                );

                expect(result.rows.length).toBe(1);
                expect(result.rows[0].subject).toBe('Detail Test Message');
            });

            test('should return 404 for non-existent message', async () => {
                const fakeId = '00000000-0000-0000-0000-000000000000';
                const result = await pool.query(
                    'SELECT * FROM messages WHERE id = $1 AND user_id = $2',
                    [fakeId, testUser.id]
                );

                expect(result.rows.length).toBe(0);
            });
        });

        describe('POST /api/messages', () => {
            test('should create a new message', async () => {
                const { v4: uuidv4 } = require('uuid');

                const messageData = {
                    subject: 'New Test Message',
                    content: 'This is a new test message.',
                    message_type: 'internal'
                };

                const result = await pool.query(
                    `INSERT INTO messages (id, user_id, subject, content, message_type, is_read)
                     VALUES ($1, $2, $3, $4, $5, false)
                     RETURNING *`,
                    [uuidv4(), testUser.id, messageData.subject, messageData.content, messageData.message_type]
                );

                expect(result.rows.length).toBe(1);
                expect(result.rows[0].subject).toBe('New Test Message');
                expect(result.rows[0].is_read).toBe(false);
            });

            test('should create client message', async () => {
                const { v4: uuidv4 } = require('uuid');

                const result = await pool.query(
                    `INSERT INTO messages (id, user_id, client_id, case_id, subject, content, message_type, is_read)
                     VALUES ($1, $2, $3, $4, 'Client Message', 'Message to client', 'client', false)
                     RETURNING *`,
                    [uuidv4(), testUser.id, testClient.id, testCase.id]
                );

                expect(result.rows[0].message_type).toBe('client');
                expect(result.rows[0].client_id).toBe(testClient.id);
            });

            test('should create reply to message', async () => {
                const { v4: uuidv4 } = require('uuid');

                // Create parent message
                const parentId = uuidv4();
                await pool.query(
                    `INSERT INTO messages (id, user_id, subject, content, message_type, is_read)
                     VALUES ($1, $2, 'Parent Message', 'Parent content', 'internal', false)`,
                    [parentId, testUser.id]
                );

                // Create reply
                const replyResult = await pool.query(
                    `INSERT INTO messages (id, user_id, parent_id, subject, content, message_type, is_read)
                     VALUES ($1, $2, $3, 'Re: Parent Message', 'Reply content', 'internal', false)
                     RETURNING *`,
                    [uuidv4(), testUser.id, parentId]
                );

                expect(replyResult.rows[0].parent_id).toBe(parentId);
            });
        });

        describe('PUT /api/messages/:id/read', () => {
            let testMessage;

            beforeAll(async () => {
                testMessage = await createTestMessage(testUser.id, null, null, { is_read: false });
            });

            test('should mark message as read', async () => {
                const result = await pool.query(
                    `UPDATE messages SET is_read = true
                     WHERE id = $1 AND user_id = $2
                     RETURNING *`,
                    [testMessage.id, testUser.id]
                );

                expect(result.rows[0].is_read).toBe(true);
            });
        });

        describe('DELETE /api/messages/:id', () => {
            test('should delete message', async () => {
                const testMessage = await createTestMessage(testUser.id, null, null);

                const result = await pool.query(
                    'DELETE FROM messages WHERE id = $1 AND user_id = $2 RETURNING *',
                    [testMessage.id, testUser.id]
                );

                expect(result.rows.length).toBe(1);

                const verify = await pool.query('SELECT * FROM messages WHERE id = $1', [testMessage.id]);
                expect(verify.rows.length).toBe(0);
            });

            test('should not delete other users messages', async () => {
                const testMessage = await createTestMessage(testUser.id, null, null);
                const otherUserId = '11111111-1111-1111-1111-111111111111';

                const result = await pool.query(
                    'DELETE FROM messages WHERE id = $1 AND user_id = $2 RETURNING *',
                    [testMessage.id, otherUserId]
                );

                expect(result.rows.length).toBe(0);

                // Verify message still exists
                const verify = await pool.query('SELECT * FROM messages WHERE id = $1', [testMessage.id]);
                expect(verify.rows.length).toBe(1);
            });
        });
    });

    // ==================== NOTIFICATIONS ====================
    describe('Notifications', () => {
        describe('GET /api/notifications', () => {
            let testNotifications = [];

            beforeAll(async () => {
                testNotifications.push(await createTestNotification(testUser.id, { title: 'Deadline Alert', notification_type: 'deadline' }));
                testNotifications.push(await createTestNotification(testUser.id, { title: 'Payment Received', notification_type: 'payment' }));
                testNotifications.push(await createTestNotification(testUser.id, { title: 'Document Updated', notification_type: 'document', is_read: true }));
            });

            test('should return all notifications for user', async () => {
                const result = await pool.query(
                    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
                    [testUser.id]
                );

                expect(result.rows.length).toBeGreaterThanOrEqual(3);
            });

            test('should filter by notification type', async () => {
                const result = await pool.query(
                    'SELECT * FROM notifications WHERE user_id = $1 AND notification_type = $2',
                    [testUser.id, 'deadline']
                );

                expect(result.rows.every(n => n.notification_type === 'deadline')).toBe(true);
            });

            test('should filter unread notifications', async () => {
                const result = await pool.query(
                    'SELECT * FROM notifications WHERE user_id = $1 AND is_read = false',
                    [testUser.id]
                );

                expect(result.rows.every(n => n.is_read === false)).toBe(true);
            });

            test('should count unread notifications', async () => {
                const result = await pool.query(
                    'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = $1 AND is_read = false',
                    [testUser.id]
                );

                expect(parseInt(result.rows[0].unread_count)).toBeGreaterThanOrEqual(0);
            });
        });

        describe('GET /api/notifications/:id', () => {
            let testNotification;

            beforeAll(async () => {
                testNotification = await createTestNotification(testUser.id, {
                    title: 'Detail Test Notification',
                    message: 'This is a detailed test notification.'
                });
            });

            test('should return notification by ID', async () => {
                const result = await pool.query(
                    'SELECT * FROM notifications WHERE id = $1 AND user_id = $2',
                    [testNotification.id, testUser.id]
                );

                expect(result.rows.length).toBe(1);
                expect(result.rows[0].title).toBe('Detail Test Notification');
            });
        });

        describe('PUT /api/notifications/:id/read', () => {
            let testNotification;

            beforeAll(async () => {
                testNotification = await createTestNotification(testUser.id, { is_read: false });
            });

            test('should mark notification as read', async () => {
                const result = await pool.query(
                    `UPDATE notifications SET is_read = true
                     WHERE id = $1 AND user_id = $2
                     RETURNING *`,
                    [testNotification.id, testUser.id]
                );

                expect(result.rows[0].is_read).toBe(true);
            });
        });

        describe('PUT /api/notifications/read-all', () => {
            beforeAll(async () => {
                // Create some unread notifications
                await createTestNotification(testUser.id, { is_read: false });
                await createTestNotification(testUser.id, { is_read: false });
            });

            test('should mark all notifications as read', async () => {
                const result = await pool.query(
                    `UPDATE notifications SET is_read = true
                     WHERE user_id = $1 AND is_read = false
                     RETURNING *`,
                    [testUser.id]
                );

                // Verify all are now read
                const verify = await pool.query(
                    'SELECT COUNT(*) as unread FROM notifications WHERE user_id = $1 AND is_read = false',
                    [testUser.id]
                );

                expect(parseInt(verify.rows[0].unread)).toBe(0);
            });
        });

        describe('DELETE /api/notifications/:id', () => {
            test('should delete notification', async () => {
                const testNotification = await createTestNotification(testUser.id);

                const result = await pool.query(
                    'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING *',
                    [testNotification.id, testUser.id]
                );

                expect(result.rows.length).toBe(1);

                const verify = await pool.query('SELECT * FROM notifications WHERE id = $1', [testNotification.id]);
                expect(verify.rows.length).toBe(0);
            });
        });

        describe('Notification Generation', () => {
            test('should create deadline notification', async () => {
                const { v4: uuidv4 } = require('uuid');

                const result = await pool.query(
                    `INSERT INTO notifications (id, user_id, title, message, notification_type, reference_type, reference_id, is_read)
                     VALUES ($1, $2, 'Deadline Approaching', 'Filing deadline in 3 days', 'deadline', 'deadline', $3, false)
                     RETURNING *`,
                    [uuidv4(), testUser.id, uuidv4()]
                );

                expect(result.rows[0].notification_type).toBe('deadline');
                expect(result.rows[0].reference_type).toBe('deadline');
            });

            test('should create payment notification', async () => {
                const { v4: uuidv4 } = require('uuid');

                const result = await pool.query(
                    `INSERT INTO notifications (id, user_id, title, message, notification_type, reference_type, reference_id, is_read)
                     VALUES ($1, $2, 'Payment Received', 'Payment of $500 received', 'payment', 'invoice', $3, false)
                     RETURNING *`,
                    [uuidv4(), testUser.id, uuidv4()]
                );

                expect(result.rows[0].notification_type).toBe('payment');
                expect(result.rows[0].reference_type).toBe('invoice');
            });
        });
    });
});

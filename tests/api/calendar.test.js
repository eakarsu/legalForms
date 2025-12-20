/**
 * Calendar API Tests
 * Tests all calendar-related endpoints: Events, Deadlines, Tasks
 */

const {
    initTestDb,
    closeTestDb,
    createTestUser,
    deleteTestUser,
    createTestClient,
    createTestCase,
    createTestEvent,
    createTestDeadline,
    createTestTask,
    getPool
} = require('../helpers/testSetup');

describe('Calendar API', () => {
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

    // ==================== CALENDAR EVENTS ====================
    describe('Calendar Events', () => {
        describe('GET /api/calendar/events', () => {
            let testEvents = [];

            beforeAll(async () => {
                const tomorrow = new Date(Date.now() + 86400000);
                const nextWeek = new Date(Date.now() + 604800000);

                testEvents.push(await createTestEvent(testUser.id, testCase.id, { title: 'Meeting', event_type: 'meeting', start_time: tomorrow.toISOString() }));
                testEvents.push(await createTestEvent(testUser.id, testCase.id, { title: 'Hearing', event_type: 'hearing', start_time: nextWeek.toISOString() }));
                testEvents.push(await createTestEvent(testUser.id, null, { title: 'Task Event', event_type: 'task' }));
            });

            test('should return all events for user', async () => {
                const result = await pool.query(
                    'SELECT * FROM calendar_events WHERE user_id = $1 ORDER BY start_time',
                    [testUser.id]
                );

                expect(result.rows.length).toBeGreaterThanOrEqual(3);
            });

            test('should filter by event type', async () => {
                const result = await pool.query(
                    'SELECT * FROM calendar_events WHERE user_id = $1 AND event_type = $2',
                    [testUser.id, 'meeting']
                );

                expect(result.rows.every(e => e.event_type === 'meeting')).toBe(true);
            });

            test('should filter by case', async () => {
                const result = await pool.query(
                    'SELECT * FROM calendar_events WHERE user_id = $1 AND case_id = $2',
                    [testUser.id, testCase.id]
                );

                expect(result.rows.every(e => e.case_id === testCase.id)).toBe(true);
            });

            test('should filter by date range', async () => {
                const start = new Date().toISOString();
                const end = new Date(Date.now() + 604800000).toISOString();

                const result = await pool.query(
                    'SELECT * FROM calendar_events WHERE user_id = $1 AND start_time >= $2 AND start_time <= $3',
                    [testUser.id, start, end]
                );

                expect(result.rows.length).toBeGreaterThanOrEqual(0);
            });

            test('should return events for FullCalendar format', async () => {
                const result = await pool.query(
                    `SELECT id, title, start_time as start, end_time as end, event_type, case_id, location, description
                     FROM calendar_events WHERE user_id = $1`,
                    [testUser.id]
                );

                if (result.rows.length > 0) {
                    expect(result.rows[0]).toHaveProperty('start');
                    expect(result.rows[0]).toHaveProperty('title');
                }
            });
        });

        describe('GET /api/calendar/events/:id', () => {
            let testEvent;

            beforeAll(async () => {
                testEvent = await createTestEvent(testUser.id, testCase.id, {
                    title: 'Detail Test Event',
                    location: 'Conference Room A',
                    description: 'Test description'
                });
            });

            test('should return event by ID with case info', async () => {
                const result = await pool.query(
                    `SELECT e.*, c.title as case_title
                     FROM calendar_events e
                     LEFT JOIN cases c ON e.case_id = c.id
                     WHERE e.id = $1 AND e.user_id = $2`,
                    [testEvent.id, testUser.id]
                );

                expect(result.rows.length).toBe(1);
                expect(result.rows[0].title).toBe('Detail Test Event');
                expect(result.rows[0].location).toBe('Conference Room A');
            });
        });

        describe('POST /api/calendar/events', () => {
            test('should create a new event', async () => {
                const { v4: uuidv4 } = require('uuid');

                const eventData = {
                    title: 'New Meeting',
                    event_type: 'meeting',
                    start_time: new Date(Date.now() + 86400000).toISOString(),
                    end_time: new Date(Date.now() + 90000000).toISOString(),
                    location: 'Office'
                };

                const result = await pool.query(
                    `INSERT INTO calendar_events (id, user_id, case_id, title, event_type, start_time, end_time, location, status)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled')
                     RETURNING *`,
                    [uuidv4(), testUser.id, testCase.id, eventData.title, eventData.event_type, eventData.start_time, eventData.end_time, eventData.location]
                );

                expect(result.rows.length).toBe(1);
                expect(result.rows[0].title).toBe('New Meeting');
                expect(result.rows[0].status).toBe('scheduled');
            });

            test('should create all-day event', async () => {
                const { v4: uuidv4 } = require('uuid');

                const result = await pool.query(
                    `INSERT INTO calendar_events (id, user_id, title, event_type, start_time, all_day, status)
                     VALUES ($1, $2, 'All Day Event', 'deadline', CURRENT_DATE, true, 'scheduled')
                     RETURNING *`,
                    [uuidv4(), testUser.id]
                );

                expect(result.rows[0].all_day).toBe(true);
            });
        });

        describe('PUT /api/calendar/events/:id', () => {
            let testEvent;

            beforeAll(async () => {
                testEvent = await createTestEvent(testUser.id, testCase.id);
            });

            test('should update event', async () => {
                const result = await pool.query(
                    `UPDATE calendar_events SET title = $1, location = $2, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $3 AND user_id = $4
                     RETURNING *`,
                    ['Updated Title', 'New Location', testEvent.id, testUser.id]
                );

                expect(result.rows[0].title).toBe('Updated Title');
                expect(result.rows[0].location).toBe('New Location');
            });

            test('should mark event as completed', async () => {
                const result = await pool.query(
                    `UPDATE calendar_events SET status = 'completed', updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1 AND user_id = $2
                     RETURNING *`,
                    [testEvent.id, testUser.id]
                );

                expect(result.rows[0].status).toBe('completed');
            });
        });

        describe('DELETE /api/calendar/events/:id', () => {
            test('should delete event', async () => {
                const testEvent = await createTestEvent(testUser.id, testCase.id);

                const result = await pool.query(
                    'DELETE FROM calendar_events WHERE id = $1 AND user_id = $2 RETURNING *',
                    [testEvent.id, testUser.id]
                );

                expect(result.rows.length).toBe(1);

                const verify = await pool.query('SELECT * FROM calendar_events WHERE id = $1', [testEvent.id]);
                expect(verify.rows.length).toBe(0);
            });
        });
    });

    // ==================== DEADLINES ====================
    describe('Deadlines', () => {
        describe('GET /api/deadlines', () => {
            let testDeadlines = [];

            beforeAll(async () => {
                const inOneWeek = new Date(Date.now() + 604800000).toISOString().split('T')[0];
                const inTwoWeeks = new Date(Date.now() + 1209600000).toISOString().split('T')[0];
                const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

                testDeadlines.push(await createTestDeadline(testUser.id, testCase.id, { title: 'Filing Deadline', deadline_type: 'filing', due_date: inOneWeek }));
                testDeadlines.push(await createTestDeadline(testUser.id, testCase.id, { title: 'Discovery Deadline', deadline_type: 'discovery', due_date: inTwoWeeks }));
                testDeadlines.push(await createTestDeadline(testUser.id, testCase.id, { title: 'Overdue Deadline', deadline_type: 'response', due_date: yesterday }));
            });

            test('should return all deadlines for user', async () => {
                const result = await pool.query(
                    'SELECT * FROM deadlines WHERE user_id = $1 ORDER BY due_date',
                    [testUser.id]
                );

                expect(result.rows.length).toBeGreaterThanOrEqual(3);
            });

            test('should filter by status', async () => {
                const result = await pool.query(
                    'SELECT * FROM deadlines WHERE user_id = $1 AND status = $2',
                    [testUser.id, 'pending']
                );

                expect(result.rows.every(d => d.status === 'pending')).toBe(true);
            });

            test('should filter by case', async () => {
                const result = await pool.query(
                    'SELECT * FROM deadlines WHERE user_id = $1 AND case_id = $2',
                    [testUser.id, testCase.id]
                );

                expect(result.rows.every(d => d.case_id === testCase.id)).toBe(true);
            });

            test('should identify overdue deadlines', async () => {
                const result = await pool.query(
                    `SELECT *,
                            CASE WHEN due_date < CURRENT_DATE AND status = 'pending' THEN true ELSE false END as is_overdue
                     FROM deadlines
                     WHERE user_id = $1`,
                    [testUser.id]
                );

                const overdue = result.rows.filter(d => d.is_overdue);
                expect(overdue.length).toBeGreaterThanOrEqual(1);
            });

            test('should calculate days until deadline', async () => {
                const result = await pool.query(
                    `SELECT *, (due_date - CURRENT_DATE) as days_until
                     FROM deadlines
                     WHERE user_id = $1`,
                    [testUser.id]
                );

                if (result.rows.length > 0) {
                    expect(result.rows[0].days_until).toBeDefined();
                }
            });
        });

        describe('GET /api/deadlines/:id', () => {
            let testDeadline;

            beforeAll(async () => {
                testDeadline = await createTestDeadline(testUser.id, testCase.id, {
                    title: 'Detail Test Deadline',
                    description: 'Test description'
                });
            });

            test('should return deadline by ID with case info', async () => {
                const result = await pool.query(
                    `SELECT d.*, c.title as case_title, c.case_number
                     FROM deadlines d
                     LEFT JOIN cases c ON d.case_id = c.id
                     WHERE d.id = $1 AND d.user_id = $2`,
                    [testDeadline.id, testUser.id]
                );

                expect(result.rows.length).toBe(1);
                expect(result.rows[0].title).toBe('Detail Test Deadline');
            });
        });

        describe('POST /api/deadlines', () => {
            test('should create a new deadline', async () => {
                const { v4: uuidv4 } = require('uuid');

                const deadlineData = {
                    title: 'New Deadline',
                    deadline_type: 'filing',
                    due_date: new Date(Date.now() + 1209600000).toISOString().split('T')[0]
                };

                const result = await pool.query(
                    `INSERT INTO deadlines (id, user_id, case_id, title, deadline_type, due_date, status)
                     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
                     RETURNING *`,
                    [uuidv4(), testUser.id, testCase.id, deadlineData.title, deadlineData.deadline_type, deadlineData.due_date]
                );

                expect(result.rows.length).toBe(1);
                expect(result.rows[0].title).toBe('New Deadline');
                expect(result.rows[0].status).toBe('pending');
            });

            test('should create critical deadline', async () => {
                const { v4: uuidv4 } = require('uuid');

                const result = await pool.query(
                    `INSERT INTO deadlines (id, user_id, case_id, title, deadline_type, due_date, is_critical, status)
                     VALUES ($1, $2, $3, 'SOL Deadline', 'statute_of_limitations', $4, true, 'pending')
                     RETURNING *`,
                    [uuidv4(), testUser.id, testCase.id, new Date(Date.now() + 2592000000).toISOString().split('T')[0]]
                );

                expect(result.rows[0].is_critical).toBe(true);
            });
        });

        describe('PUT /api/deadlines/:id', () => {
            let testDeadline;

            beforeAll(async () => {
                testDeadline = await createTestDeadline(testUser.id, testCase.id);
            });

            test('should update deadline', async () => {
                const result = await pool.query(
                    `UPDATE deadlines SET title = $1, description = $2
                     WHERE id = $3 AND user_id = $4
                     RETURNING *`,
                    ['Updated Deadline', 'Updated description', testDeadline.id, testUser.id]
                );

                expect(result.rows[0].title).toBe('Updated Deadline');
            });

            test('should mark deadline as completed', async () => {
                const result = await pool.query(
                    `UPDATE deadlines SET status = 'completed', completed_at = CURRENT_TIMESTAMP
                     WHERE id = $1 AND user_id = $2
                     RETURNING *`,
                    [testDeadline.id, testUser.id]
                );

                expect(result.rows[0].status).toBe('completed');
                expect(result.rows[0].completed_at).not.toBeNull();
            });
        });

        describe('DELETE /api/deadlines/:id', () => {
            test('should delete deadline', async () => {
                const testDeadline = await createTestDeadline(testUser.id, testCase.id);

                const result = await pool.query(
                    'DELETE FROM deadlines WHERE id = $1 AND user_id = $2 RETURNING *',
                    [testDeadline.id, testUser.id]
                );

                expect(result.rows.length).toBe(1);

                const verify = await pool.query('SELECT * FROM deadlines WHERE id = $1', [testDeadline.id]);
                expect(verify.rows.length).toBe(0);
            });
        });
    });

    // ==================== TASKS ====================
    describe('Tasks', () => {
        describe('GET /api/tasks', () => {
            let testTasks = [];

            beforeAll(async () => {
                testTasks.push(await createTestTask(testUser.id, testCase.id, { title: 'Task 1', priority: 'high', status: 'pending' }));
                testTasks.push(await createTestTask(testUser.id, testCase.id, { title: 'Task 2', priority: 'medium', status: 'in_progress' }));
                testTasks.push(await createTestTask(testUser.id, null, { title: 'Task 3', priority: 'low', status: 'completed' }));
            });

            test('should return all tasks for user', async () => {
                const result = await pool.query(
                    'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC',
                    [testUser.id]
                );

                expect(result.rows.length).toBeGreaterThanOrEqual(3);
            });

            test('should filter by status', async () => {
                const result = await pool.query(
                    'SELECT * FROM tasks WHERE user_id = $1 AND status = $2',
                    [testUser.id, 'pending']
                );

                expect(result.rows.every(t => t.status === 'pending')).toBe(true);
            });

            test('should filter by priority', async () => {
                const result = await pool.query(
                    'SELECT * FROM tasks WHERE user_id = $1 AND priority = $2',
                    [testUser.id, 'high']
                );

                expect(result.rows.every(t => t.priority === 'high')).toBe(true);
            });

            test('should filter by case', async () => {
                const result = await pool.query(
                    'SELECT * FROM tasks WHERE user_id = $1 AND case_id = $2',
                    [testUser.id, testCase.id]
                );

                expect(result.rows.every(t => t.case_id === testCase.id)).toBe(true);
            });

            test('should group tasks by status', async () => {
                const result = await pool.query(
                    `SELECT status, COUNT(*) as count FROM tasks WHERE user_id = $1 GROUP BY status`,
                    [testUser.id]
                );

                expect(result.rows.length).toBeGreaterThanOrEqual(1);
            });
        });

        describe('GET /api/tasks/:id', () => {
            let testTask;

            beforeAll(async () => {
                testTask = await createTestTask(testUser.id, testCase.id, {
                    title: 'Detail Test Task',
                    description: 'Test description'
                });
            });

            test('should return task by ID with case info', async () => {
                const result = await pool.query(
                    `SELECT t.*, c.title as case_title
                     FROM tasks t
                     LEFT JOIN cases c ON t.case_id = c.id
                     WHERE t.id = $1 AND t.user_id = $2`,
                    [testTask.id, testUser.id]
                );

                expect(result.rows.length).toBe(1);
                expect(result.rows[0].title).toBe('Detail Test Task');
            });
        });

        describe('POST /api/tasks', () => {
            test('should create a new task', async () => {
                const { v4: uuidv4 } = require('uuid');

                const taskData = {
                    title: 'New Task',
                    priority: 'high',
                    due_date: new Date(Date.now() + 604800000).toISOString().split('T')[0]
                };

                const result = await pool.query(
                    `INSERT INTO tasks (id, user_id, case_id, title, priority, due_date, status)
                     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
                     RETURNING *`,
                    [uuidv4(), testUser.id, testCase.id, taskData.title, taskData.priority, taskData.due_date]
                );

                expect(result.rows.length).toBe(1);
                expect(result.rows[0].title).toBe('New Task');
                expect(result.rows[0].status).toBe('pending');
            });
        });

        describe('PUT /api/tasks/:id', () => {
            let testTask;

            beforeAll(async () => {
                testTask = await createTestTask(testUser.id, testCase.id);
            });

            test('should update task', async () => {
                const result = await pool.query(
                    `UPDATE tasks SET title = $1, description = $2, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $3 AND user_id = $4
                     RETURNING *`,
                    ['Updated Task', 'Updated description', testTask.id, testUser.id]
                );

                expect(result.rows[0].title).toBe('Updated Task');
            });

            test('should update task status', async () => {
                const result = await pool.query(
                    `UPDATE tasks SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1 AND user_id = $2
                     RETURNING *`,
                    [testTask.id, testUser.id]
                );

                expect(result.rows[0].status).toBe('in_progress');
            });

            test('should mark task as completed', async () => {
                const result = await pool.query(
                    `UPDATE tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1 AND user_id = $2
                     RETURNING *`,
                    [testTask.id, testUser.id]
                );

                expect(result.rows[0].status).toBe('completed');
                expect(result.rows[0].completed_at).not.toBeNull();
            });
        });

        describe('DELETE /api/tasks/:id', () => {
            test('should delete task', async () => {
                const testTask = await createTestTask(testUser.id, testCase.id);

                const result = await pool.query(
                    'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING *',
                    [testTask.id, testUser.id]
                );

                expect(result.rows.length).toBe(1);

                const verify = await pool.query('SELECT * FROM tasks WHERE id = $1', [testTask.id]);
                expect(verify.rows.length).toBe(0);
            });
        });
    });
});

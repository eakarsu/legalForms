/**
 * Test Setup and Helper Functions
 * Provides common utilities for all tests
 */

require('dotenv').config();
const { Pool } = require('pg');

// Test database configuration
const testDbConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'legalforms',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || ''
    };

let pool;

/**
 * Initialize test database connection
 */
async function initTestDb() {
    pool = new Pool(testDbConfig);
    return pool;
}

/**
 * Get database pool
 */
function getPool() {
    return pool;
}

/**
 * Close database connection
 */
async function closeTestDb() {
    if (pool) {
        await pool.end();
    }
}

/**
 * Clean up test data
 */
async function cleanupTestData(userId) {
    if (!pool || !userId) return;

    try {
        // Delete in order respecting foreign keys
        await pool.query('DELETE FROM payments WHERE invoice_id IN (SELECT id FROM invoices WHERE user_id = $1)', [userId]);
        await pool.query('DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE user_id = $1)', [userId]);
        await pool.query('DELETE FROM invoices WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM time_entries WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM expenses WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM case_notes WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM case_documents WHERE case_id IN (SELECT id FROM cases WHERE user_id = $1)', [userId]);
        await pool.query('DELETE FROM deadlines WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM tasks WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM calendar_events WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM messages WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM cases WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM client_contacts WHERE client_id IN (SELECT id FROM clients WHERE user_id = $1)', [userId]);
        await pool.query('DELETE FROM clients WHERE user_id = $1', [userId]);
    } catch (error) {
        console.error('Cleanup error:', error.message);
    }
}

/**
 * Create a test user
 */
async function createTestUser() {
    const bcrypt = require('bcrypt');
    const { v4: uuidv4 } = require('uuid');

    const userId = uuidv4();
    const email = `test_${Date.now()}@test.com`;
    const passwordHash = await bcrypt.hash('testpassword123', 10);

    await pool.query(
        'INSERT INTO users (id, email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4, $5)',
        [userId, email, passwordHash, 'Test', 'User']
    );

    return { id: userId, email, password: 'testpassword123' };
}

/**
 * Delete test user
 */
async function deleteTestUser(userId) {
    if (!pool || !userId) return;
    await cleanupTestData(userId);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
}

/**
 * Create test client
 */
async function createTestClient(userId, overrides = {}) {
    const { v4: uuidv4 } = require('uuid');

    const client = {
        id: uuidv4(),
        user_id: userId,
        client_type: 'individual',
        first_name: 'John',
        last_name: 'Doe',
        email: `client_${Date.now()}@test.com`,
        phone: '555-123-4567',
        status: 'active',
        ...overrides
    };

    await pool.query(
        `INSERT INTO clients (id, user_id, client_type, first_name, last_name, email, phone, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [client.id, client.user_id, client.client_type, client.first_name, client.last_name, client.email, client.phone, client.status]
    );

    return client;
}

/**
 * Create test case
 */
async function createTestCase(userId, clientId, overrides = {}) {
    const { v4: uuidv4 } = require('uuid');

    const testCase = {
        id: uuidv4(),
        user_id: userId,
        client_id: clientId,
        case_number: `CASE-${Date.now()}`,
        title: 'Test Case',
        case_type: 'litigation',
        status: 'open',
        priority: 'medium',
        ...overrides
    };

    await pool.query(
        `INSERT INTO cases (id, user_id, client_id, case_number, title, case_type, status, priority)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [testCase.id, testCase.user_id, testCase.client_id, testCase.case_number, testCase.title, testCase.case_type, testCase.status, testCase.priority]
    );

    return testCase;
}

/**
 * Create test time entry
 */
async function createTestTimeEntry(userId, caseId, clientId, overrides = {}) {
    const { v4: uuidv4 } = require('uuid');

    const entry = {
        id: uuidv4(),
        user_id: userId,
        case_id: caseId,
        client_id: clientId,
        description: 'Test time entry',
        duration_minutes: 60,
        hourly_rate: 250,
        amount: 250,
        date: new Date().toISOString().split('T')[0],
        is_billable: true,
        is_billed: false,
        activity_type: 'research',
        ...overrides
    };

    await pool.query(
        `INSERT INTO time_entries (id, user_id, case_id, client_id, description, duration_minutes, hourly_rate, amount, date, is_billable, is_billed, activity_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [entry.id, entry.user_id, entry.case_id, entry.client_id, entry.description, entry.duration_minutes, entry.hourly_rate, entry.amount, entry.date, entry.is_billable, entry.is_billed, entry.activity_type]
    );

    return entry;
}

/**
 * Create test invoice
 */
async function createTestInvoice(userId, clientId, caseId = null, overrides = {}) {
    const { v4: uuidv4 } = require('uuid');

    const invoice = {
        id: uuidv4(),
        user_id: userId,
        client_id: clientId,
        case_id: caseId,
        invoice_number: `INV-${Date.now()}`,
        status: 'draft',
        subtotal: 500,
        tax_rate: 0,
        tax_amount: 0,
        total: 500,
        amount_paid: 0,
        ...overrides
    };

    await pool.query(
        `INSERT INTO invoices (id, user_id, client_id, case_id, invoice_number, status, subtotal, tax_rate, tax_amount, total, amount_paid)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [invoice.id, invoice.user_id, invoice.client_id, invoice.case_id, invoice.invoice_number, invoice.status, invoice.subtotal, invoice.tax_rate, invoice.tax_amount, invoice.total, invoice.amount_paid]
    );

    return invoice;
}

/**
 * Create test expense
 */
async function createTestExpense(userId, caseId, clientId, overrides = {}) {
    const { v4: uuidv4 } = require('uuid');

    const expense = {
        id: uuidv4(),
        user_id: userId,
        case_id: caseId,
        client_id: clientId,
        description: 'Test expense',
        amount: 100,
        expense_date: new Date().toISOString().split('T')[0],
        category: 'filing_fee',
        is_billable: true,
        is_billed: false,
        ...overrides
    };

    await pool.query(
        `INSERT INTO expenses (id, user_id, case_id, client_id, description, amount, expense_date, category, is_billable, is_billed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [expense.id, expense.user_id, expense.case_id, expense.client_id, expense.description, expense.amount, expense.expense_date, expense.category, expense.is_billable, expense.is_billed]
    );

    return expense;
}

/**
 * Create test calendar event
 */
async function createTestEvent(userId, caseId = null, overrides = {}) {
    const { v4: uuidv4 } = require('uuid');

    const event = {
        id: uuidv4(),
        user_id: userId,
        case_id: caseId,
        title: 'Test Event',
        event_type: 'meeting',
        location: null,
        description: null,
        start_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        end_time: new Date(Date.now() + 90000000).toISOString(),
        status: 'scheduled',
        ...overrides
    };

    await pool.query(
        `INSERT INTO calendar_events (id, user_id, case_id, title, event_type, location, description, start_time, end_time, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [event.id, event.user_id, event.case_id, event.title, event.event_type, event.location, event.description, event.start_time, event.end_time, event.status]
    );

    return event;
}

/**
 * Create test deadline
 */
async function createTestDeadline(userId, caseId, overrides = {}) {
    const { v4: uuidv4 } = require('uuid');

    const deadline = {
        id: uuidv4(),
        user_id: userId,
        case_id: caseId,
        title: 'Test Deadline',
        deadline_type: 'filing',
        due_date: new Date(Date.now() + 604800000).toISOString().split('T')[0], // 1 week from now
        status: 'pending',
        ...overrides
    };

    await pool.query(
        `INSERT INTO deadlines (id, user_id, case_id, title, deadline_type, due_date, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [deadline.id, deadline.user_id, deadline.case_id, deadline.title, deadline.deadline_type, deadline.due_date, deadline.status]
    );

    return deadline;
}

/**
 * Create test task
 */
async function createTestTask(userId, caseId = null, overrides = {}) {
    const { v4: uuidv4 } = require('uuid');

    const task = {
        id: uuidv4(),
        user_id: userId,
        case_id: caseId,
        title: 'Test Task',
        priority: 'medium',
        status: 'pending',
        ...overrides
    };

    await pool.query(
        `INSERT INTO tasks (id, user_id, case_id, title, priority, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [task.id, task.user_id, task.case_id, task.title, task.priority, task.status]
    );

    return task;
}

/**
 * Create test message
 */
async function createTestMessage(userId, clientId = null, caseId = null, overrides = {}) {
    const { v4: uuidv4 } = require('uuid');

    const message = {
        id: uuidv4(),
        user_id: userId,
        client_id: clientId,
        case_id: caseId,
        subject: 'Test Message',
        content: 'This is a test message content.',
        message_type: 'internal',
        is_read: false,
        ...overrides
    };

    await pool.query(
        `INSERT INTO messages (id, user_id, client_id, case_id, subject, content, message_type, is_read)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [message.id, message.user_id, message.client_id, message.case_id, message.subject, message.content, message.message_type, message.is_read]
    );

    return message;
}

/**
 * Create test notification
 */
async function createTestNotification(userId, overrides = {}) {
    const { v4: uuidv4 } = require('uuid');

    const notification = {
        id: uuidv4(),
        user_id: userId,
        title: 'Test Notification',
        message: 'This is a test notification.',
        notification_type: 'system',
        is_read: false,
        ...overrides
    };

    await pool.query(
        `INSERT INTO notifications (id, user_id, title, message, notification_type, is_read)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [notification.id, notification.user_id, notification.title, notification.message, notification.notification_type, notification.is_read]
    );

    return notification;
}

/**
 * Mock request object for testing route handlers
 */
function mockRequest(overrides = {}) {
    return {
        body: {},
        params: {},
        query: {},
        user: null,
        session: {},
        ...overrides
    };
}

/**
 * Mock response object for testing route handlers
 */
function mockResponse() {
    const res = {
        statusCode: 200,
        data: null,
        redirectUrl: null
    };

    res.status = jest.fn((code) => {
        res.statusCode = code;
        return res;
    });

    res.json = jest.fn((data) => {
        res.data = data;
        return res;
    });

    res.send = jest.fn((data) => {
        res.data = data;
        return res;
    });

    res.redirect = jest.fn((url) => {
        res.redirectUrl = url;
        return res;
    });

    res.render = jest.fn((view, data) => {
        res.view = view;
        res.viewData = data;
        return res;
    });

    return res;
}

module.exports = {
    initTestDb,
    getPool,
    closeTestDb,
    cleanupTestData,
    createTestUser,
    deleteTestUser,
    createTestClient,
    createTestCase,
    createTestTimeEntry,
    createTestInvoice,
    createTestExpense,
    createTestEvent,
    createTestDeadline,
    createTestTask,
    createTestMessage,
    createTestNotification,
    mockRequest,
    mockResponse
};

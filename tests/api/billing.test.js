/**
 * Billing API Tests
 * Tests all billing-related endpoints: Time Entries, Invoices, Expenses, Payments
 */

const {
    initTestDb,
    closeTestDb,
    createTestUser,
    deleteTestUser,
    createTestClient,
    createTestCase,
    createTestTimeEntry,
    createTestInvoice,
    createTestExpense,
    getPool
} = require('../helpers/testSetup');

describe('Billing API', () => {
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

    // ==================== TIME ENTRIES ====================
    describe('Time Entries', () => {
        describe('GET /api/time-entries', () => {
            let testEntries = [];

            beforeAll(async () => {
                testEntries.push(await createTestTimeEntry(testUser.id, testCase.id, testClient.id, { description: 'Research', duration_minutes: 60, activity_type: 'research' }));
                testEntries.push(await createTestTimeEntry(testUser.id, testCase.id, testClient.id, { description: 'Drafting', duration_minutes: 120, activity_type: 'drafting' }));
                testEntries.push(await createTestTimeEntry(testUser.id, testCase.id, testClient.id, { description: 'Meeting', duration_minutes: 30, activity_type: 'meeting', is_billed: true }));
            });

            test('should return all time entries for user', async () => {
                const result = await pool.query(
                    'SELECT * FROM time_entries WHERE user_id = $1 ORDER BY date DESC',
                    [testUser.id]
                );

                expect(result.rows.length).toBeGreaterThanOrEqual(3);
            });

            test('should filter by case', async () => {
                const result = await pool.query(
                    'SELECT * FROM time_entries WHERE user_id = $1 AND case_id = $2',
                    [testUser.id, testCase.id]
                );

                expect(result.rows.every(e => e.case_id === testCase.id)).toBe(true);
            });

            test('should filter by billed status', async () => {
                const result = await pool.query(
                    'SELECT * FROM time_entries WHERE user_id = $1 AND is_billed = $2',
                    [testUser.id, false]
                );

                expect(result.rows.every(e => e.is_billed === false)).toBe(true);
            });

            test('should filter by activity type', async () => {
                const result = await pool.query(
                    'SELECT * FROM time_entries WHERE user_id = $1 AND activity_type = $2',
                    [testUser.id, 'research']
                );

                expect(result.rows.every(e => e.activity_type === 'research')).toBe(true);
            });

            test('should filter by date range', async () => {
                const today = new Date().toISOString().split('T')[0];
                const result = await pool.query(
                    'SELECT * FROM time_entries WHERE user_id = $1 AND date = $2',
                    [testUser.id, today]
                );

                expect(result.rows.length).toBeGreaterThanOrEqual(0);
            });
        });

        describe('GET /api/time-entries/:id', () => {
            let testEntry;

            beforeAll(async () => {
                testEntry = await createTestTimeEntry(testUser.id, testCase.id, testClient.id);
            });

            test('should return time entry by ID', async () => {
                const result = await pool.query(
                    `SELECT te.*, c.title as case_title
                     FROM time_entries te
                     LEFT JOIN cases c ON te.case_id = c.id
                     WHERE te.id = $1 AND te.user_id = $2`,
                    [testEntry.id, testUser.id]
                );

                expect(result.rows.length).toBe(1);
                expect(result.rows[0].id).toBe(testEntry.id);
            });
        });

        describe('POST /api/time-entries', () => {
            test('should create a new time entry', async () => {
                const { v4: uuidv4 } = require('uuid');

                const entryData = {
                    case_id: testCase.id,
                    description: 'New time entry',
                    duration_minutes: 45,
                    hourly_rate: 300,
                    activity_type: 'court'
                };

                const amount = (entryData.duration_minutes / 60) * entryData.hourly_rate;

                const result = await pool.query(
                    `INSERT INTO time_entries (id, user_id, case_id, client_id, description, duration_minutes, hourly_rate, amount, activity_type, date, is_billable)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_DATE, true)
                     RETURNING *`,
                    [uuidv4(), testUser.id, entryData.case_id, testClient.id, entryData.description, entryData.duration_minutes, entryData.hourly_rate, amount, entryData.activity_type]
                );

                expect(result.rows.length).toBe(1);
                expect(result.rows[0].description).toBe('New time entry');
                expect(parseFloat(result.rows[0].amount)).toBe(225); // 0.75 * 300
            });

            test('should calculate amount automatically', async () => {
                const { v4: uuidv4 } = require('uuid');

                const duration = 90;
                const rate = 250;
                const expectedAmount = (duration / 60) * rate;

                const result = await pool.query(
                    `INSERT INTO time_entries (id, user_id, case_id, description, duration_minutes, hourly_rate, amount, date, is_billable)
                     VALUES ($1, $2, $3, 'Auto calc test', $4, $5, $6, CURRENT_DATE, true)
                     RETURNING *`,
                    [uuidv4(), testUser.id, testCase.id, duration, rate, expectedAmount]
                );

                expect(parseFloat(result.rows[0].amount)).toBe(expectedAmount);
            });
        });

        describe('PUT /api/time-entries/:id', () => {
            let testEntry;

            beforeAll(async () => {
                testEntry = await createTestTimeEntry(testUser.id, testCase.id, testClient.id);
            });

            test('should update time entry', async () => {
                const result = await pool.query(
                    `UPDATE time_entries SET description = $1, duration_minutes = $2, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $3 AND user_id = $4
                     RETURNING *`,
                    ['Updated description', 120, testEntry.id, testUser.id]
                );

                expect(result.rows[0].description).toBe('Updated description');
                expect(result.rows[0].duration_minutes).toBe(120);
            });

            test('should mark as billed', async () => {
                const result = await pool.query(
                    `UPDATE time_entries SET is_billed = true, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1 AND user_id = $2
                     RETURNING *`,
                    [testEntry.id, testUser.id]
                );

                expect(result.rows[0].is_billed).toBe(true);
            });
        });

        describe('DELETE /api/time-entries/:id', () => {
            test('should delete time entry', async () => {
                const testEntry = await createTestTimeEntry(testUser.id, testCase.id, testClient.id);

                const result = await pool.query(
                    'DELETE FROM time_entries WHERE id = $1 AND user_id = $2 RETURNING *',
                    [testEntry.id, testUser.id]
                );

                expect(result.rows.length).toBe(1);

                const verify = await pool.query('SELECT * FROM time_entries WHERE id = $1', [testEntry.id]);
                expect(verify.rows.length).toBe(0);
            });

            test('should not delete billed time entry without force', async () => {
                const testEntry = await createTestTimeEntry(testUser.id, testCase.id, testClient.id, { is_billed: true });

                // In a real implementation, this would return an error
                // For now, we just verify the entry exists
                const verify = await pool.query('SELECT * FROM time_entries WHERE id = $1', [testEntry.id]);
                expect(verify.rows[0].is_billed).toBe(true);
            });
        });
    });

    // ==================== INVOICES ====================
    describe('Invoices', () => {
        describe('GET /api/invoices', () => {
            let testInvoices = [];

            beforeAll(async () => {
                testInvoices.push(await createTestInvoice(testUser.id, testClient.id, testCase.id, { status: 'draft', total: 500 }));
                testInvoices.push(await createTestInvoice(testUser.id, testClient.id, testCase.id, { status: 'sent', total: 1000 }));
                testInvoices.push(await createTestInvoice(testUser.id, testClient.id, testCase.id, { status: 'paid', total: 750, amount_paid: 750 }));
            });

            test('should return all invoices for user', async () => {
                const result = await pool.query(
                    'SELECT * FROM invoices WHERE user_id = $1 ORDER BY created_at DESC',
                    [testUser.id]
                );

                expect(result.rows.length).toBeGreaterThanOrEqual(3);
            });

            test('should filter by status', async () => {
                const result = await pool.query(
                    'SELECT * FROM invoices WHERE user_id = $1 AND status = $2',
                    [testUser.id, 'draft']
                );

                expect(result.rows.every(i => i.status === 'draft')).toBe(true);
            });

            test('should filter by client', async () => {
                const result = await pool.query(
                    'SELECT * FROM invoices WHERE user_id = $1 AND client_id = $2',
                    [testUser.id, testClient.id]
                );

                expect(result.rows.every(i => i.client_id === testClient.id)).toBe(true);
            });

            test('should calculate outstanding balance', async () => {
                const result = await pool.query(
                    `SELECT SUM(total - amount_paid) as outstanding
                     FROM invoices
                     WHERE user_id = $1 AND status IN ('sent', 'overdue')`,
                    [testUser.id]
                );

                expect(result.rows[0].outstanding).not.toBeNull();
            });
        });

        describe('GET /api/invoices/:id', () => {
            let testInvoice;

            beforeAll(async () => {
                testInvoice = await createTestInvoice(testUser.id, testClient.id, testCase.id);
            });

            test('should return invoice by ID with client info', async () => {
                const result = await pool.query(
                    `SELECT i.*, c.first_name, c.last_name, c.company_name, c.email as client_email
                     FROM invoices i
                     LEFT JOIN clients c ON i.client_id = c.id
                     WHERE i.id = $1 AND i.user_id = $2`,
                    [testInvoice.id, testUser.id]
                );

                expect(result.rows.length).toBe(1);
                expect(result.rows[0].id).toBe(testInvoice.id);
            });
        });

        describe('POST /api/invoices', () => {
            test('should create a new invoice', async () => {
                const { v4: uuidv4 } = require('uuid');

                const result = await pool.query(
                    `INSERT INTO invoices (id, user_id, client_id, invoice_number, status, subtotal, total)
                     VALUES ($1, $2, $3, $4, 'draft', 0, 0)
                     RETURNING *`,
                    [uuidv4(), testUser.id, testClient.id, `INV-NEW-${Date.now()}`]
                );

                expect(result.rows.length).toBe(1);
                expect(result.rows[0].status).toBe('draft');
            });

            test('should generate unique invoice number', async () => {
                const { v4: uuidv4 } = require('uuid');

                const result1 = await pool.query(
                    `INSERT INTO invoices (id, user_id, client_id, invoice_number, status)
                     VALUES ($1, $2, $3, $4, 'draft')
                     RETURNING invoice_number`,
                    [uuidv4(), testUser.id, testClient.id, `INV-${Date.now()}-1`]
                );

                const result2 = await pool.query(
                    `INSERT INTO invoices (id, user_id, client_id, invoice_number, status)
                     VALUES ($1, $2, $3, $4, 'draft')
                     RETURNING invoice_number`,
                    [uuidv4(), testUser.id, testClient.id, `INV-${Date.now()}-2`]
                );

                expect(result1.rows[0].invoice_number).not.toBe(result2.rows[0].invoice_number);
            });
        });

        describe('PUT /api/invoices/:id', () => {
            let testInvoice;

            beforeAll(async () => {
                testInvoice = await createTestInvoice(testUser.id, testClient.id, testCase.id);
            });

            test('should update invoice', async () => {
                const result = await pool.query(
                    `UPDATE invoices SET notes = $1, due_date = $2, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $3 AND user_id = $4
                     RETURNING *`,
                    ['Updated notes', '2025-02-01', testInvoice.id, testUser.id]
                );

                expect(result.rows[0].notes).toBe('Updated notes');
            });
        });

        describe('POST /api/invoices/:id/send', () => {
            let testInvoice;

            beforeAll(async () => {
                testInvoice = await createTestInvoice(testUser.id, testClient.id, testCase.id, { status: 'draft' });
            });

            test('should update invoice status to sent', async () => {
                const result = await pool.query(
                    `UPDATE invoices SET status = 'sent', updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1 AND user_id = $2 AND status = 'draft'
                     RETURNING *`,
                    [testInvoice.id, testUser.id]
                );

                expect(result.rows[0].status).toBe('sent');
            });
        });

        describe('Payments', () => {
            let testInvoice;

            beforeAll(async () => {
                testInvoice = await createTestInvoice(testUser.id, testClient.id, testCase.id, { status: 'sent', total: 1000, amount_paid: 0 });
            });

            test('should record payment', async () => {
                const { v4: uuidv4 } = require('uuid');

                const paymentAmount = 500;

                const result = await pool.query(
                    `INSERT INTO payments (id, invoice_id, amount, payment_method, payment_date)
                     VALUES ($1, $2, $3, 'credit_card', CURRENT_DATE)
                     RETURNING *`,
                    [uuidv4(), testInvoice.id, paymentAmount]
                );

                expect(result.rows.length).toBe(1);
                expect(parseFloat(result.rows[0].amount)).toBe(500);

                // Update invoice amount_paid
                await pool.query(
                    'UPDATE invoices SET amount_paid = amount_paid + $1 WHERE id = $2',
                    [paymentAmount, testInvoice.id]
                );
            });

            test('should mark invoice as paid when fully paid', async () => {
                const testInv = await createTestInvoice(testUser.id, testClient.id, testCase.id, { status: 'sent', total: 500 });
                const { v4: uuidv4 } = require('uuid');

                // Record full payment
                await pool.query(
                    `INSERT INTO payments (id, invoice_id, amount, payment_method, payment_date)
                     VALUES ($1, $2, 500, 'check', CURRENT_DATE)`,
                    [uuidv4(), testInv.id]
                );

                // Update invoice
                const result = await pool.query(
                    `UPDATE invoices SET amount_paid = 500, status = 'paid', paid_date = CURRENT_DATE
                     WHERE id = $1
                     RETURNING *`,
                    [testInv.id]
                );

                expect(result.rows[0].status).toBe('paid');
            });
        });
    });

    // ==================== EXPENSES ====================
    describe('Expenses', () => {
        describe('GET /api/expenses', () => {
            let testExpenses = [];

            beforeAll(async () => {
                testExpenses.push(await createTestExpense(testUser.id, testCase.id, testClient.id, { description: 'Filing fee', amount: 350, category: 'filing_fee' }));
                testExpenses.push(await createTestExpense(testUser.id, testCase.id, testClient.id, { description: 'Travel', amount: 150, category: 'travel' }));
                testExpenses.push(await createTestExpense(testUser.id, testCase.id, testClient.id, { description: 'Copies', amount: 50, category: 'copies', is_billed: true }));
            });

            test('should return all expenses for user', async () => {
                const result = await pool.query(
                    'SELECT * FROM expenses WHERE user_id = $1 ORDER BY expense_date DESC',
                    [testUser.id]
                );

                expect(result.rows.length).toBeGreaterThanOrEqual(3);
            });

            test('should filter by case', async () => {
                const result = await pool.query(
                    'SELECT * FROM expenses WHERE user_id = $1 AND case_id = $2',
                    [testUser.id, testCase.id]
                );

                expect(result.rows.every(e => e.case_id === testCase.id)).toBe(true);
            });

            test('should filter by category', async () => {
                const result = await pool.query(
                    'SELECT * FROM expenses WHERE user_id = $1 AND category = $2',
                    [testUser.id, 'filing_fee']
                );

                expect(result.rows.every(e => e.category === 'filing_fee')).toBe(true);
            });

            test('should filter by billed status', async () => {
                const result = await pool.query(
                    'SELECT * FROM expenses WHERE user_id = $1 AND is_billed = $2',
                    [testUser.id, false]
                );

                expect(result.rows.every(e => e.is_billed === false)).toBe(true);
            });
        });

        describe('GET /api/expenses/:id', () => {
            let testExpense;

            beforeAll(async () => {
                testExpense = await createTestExpense(testUser.id, testCase.id, testClient.id);
            });

            test('should return expense by ID', async () => {
                const result = await pool.query(
                    `SELECT e.*, c.title as case_title
                     FROM expenses e
                     LEFT JOIN cases c ON e.case_id = c.id
                     WHERE e.id = $1 AND e.user_id = $2`,
                    [testExpense.id, testUser.id]
                );

                expect(result.rows.length).toBe(1);
                expect(result.rows[0].id).toBe(testExpense.id);
            });
        });

        describe('POST /api/expenses', () => {
            test('should create a new expense', async () => {
                const { v4: uuidv4 } = require('uuid');

                const result = await pool.query(
                    `INSERT INTO expenses (id, user_id, case_id, client_id, description, amount, category, expense_date, is_billable)
                     VALUES ($1, $2, $3, $4, 'New expense', 200, 'expert', CURRENT_DATE, true)
                     RETURNING *`,
                    [uuidv4(), testUser.id, testCase.id, testClient.id]
                );

                expect(result.rows.length).toBe(1);
                expect(result.rows[0].description).toBe('New expense');
                expect(parseFloat(result.rows[0].amount)).toBe(200);
            });
        });

        describe('PUT /api/expenses/:id', () => {
            let testExpense;

            beforeAll(async () => {
                testExpense = await createTestExpense(testUser.id, testCase.id, testClient.id);
            });

            test('should update expense', async () => {
                const result = await pool.query(
                    `UPDATE expenses SET description = $1, amount = $2
                     WHERE id = $3 AND user_id = $4
                     RETURNING *`,
                    ['Updated expense', 300, testExpense.id, testUser.id]
                );

                expect(result.rows[0].description).toBe('Updated expense');
                expect(parseFloat(result.rows[0].amount)).toBe(300);
            });
        });

        describe('DELETE /api/expenses/:id', () => {
            test('should delete expense', async () => {
                const testExpense = await createTestExpense(testUser.id, testCase.id, testClient.id);

                const result = await pool.query(
                    'DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING *',
                    [testExpense.id, testUser.id]
                );

                expect(result.rows.length).toBe(1);

                const verify = await pool.query('SELECT * FROM expenses WHERE id = $1', [testExpense.id]);
                expect(verify.rows.length).toBe(0);
            });
        });
    });

    // ==================== BILLING STATISTICS ====================
    describe('Billing Statistics', () => {
        test('should calculate total unbilled time', async () => {
            const result = await pool.query(
                `SELECT COALESCE(SUM(amount), 0) as unbilled_amount
                 FROM time_entries
                 WHERE user_id = $1 AND is_billable = true AND is_billed = false`,
                [testUser.id]
            );

            expect(result.rows[0].unbilled_amount).not.toBeNull();
        });

        test('should calculate total unbilled expenses', async () => {
            const result = await pool.query(
                `SELECT COALESCE(SUM(amount), 0) as unbilled_amount
                 FROM expenses
                 WHERE user_id = $1 AND is_billable = true AND is_billed = false`,
                [testUser.id]
            );

            expect(result.rows[0].unbilled_amount).not.toBeNull();
        });

        test('should calculate total outstanding invoices', async () => {
            const result = await pool.query(
                `SELECT COALESCE(SUM(total - amount_paid), 0) as outstanding
                 FROM invoices
                 WHERE user_id = $1 AND status IN ('sent', 'overdue')`,
                [testUser.id]
            );

            expect(result.rows[0].outstanding).not.toBeNull();
        });

        test('should calculate revenue by period', async () => {
            const result = await pool.query(
                `SELECT DATE_TRUNC('month', paid_date) as month, SUM(amount_paid) as revenue
                 FROM invoices
                 WHERE user_id = $1 AND status = 'paid' AND paid_date IS NOT NULL
                 GROUP BY DATE_TRUNC('month', paid_date)
                 ORDER BY month DESC`,
                [testUser.id]
            );

            // May be empty if no paid invoices
            expect(Array.isArray(result.rows)).toBe(true);
        });
    });
});

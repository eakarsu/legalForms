/**
 * Playwright Global Setup
 * Creates test user and saves authentication state
 */

const { chromium } = require('@playwright/test');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const TEST_USER = {
    email: 'playwright_test@example.com',
    password: 'TestPassword123!',
    firstName: 'Playwright',
    lastName: 'Tester'
};

// Seed test data for the test user
async function seedTestData(pool, userId) {
    try {
        // Check if test data already exists
        const clientCheck = await pool.query(
            'SELECT COUNT(*) as count FROM clients WHERE user_id = $1',
            [userId]
        );

        if (parseInt(clientCheck.rows[0].count) > 0) {
            console.log('✅ Test data already exists');
            return;
        }

        console.log('📝 Creating test seed data...');

        // Create test clients
        const clientResult = await pool.query(`
            INSERT INTO clients (user_id, first_name, last_name, email, phone, company_name, client_type, status)
            VALUES
                ($1, 'Test', 'Client', 'testclient@example.com', '555-111-1111', 'Test Company', 'individual', 'active'),
                ($1, 'Business', 'Corp', 'business@example.com', '555-222-2222', 'Business Corp LLC', 'business', 'active')
            RETURNING id
        `, [userId]);

        const clientId = clientResult.rows[0].id;

        // Create test cases
        const caseResult = await pool.query(`
            INSERT INTO cases (user_id, client_id, title, case_number, case_type, status, description)
            VALUES
                ($1, $2, 'Test Case 1', 'TEST-001', 'litigation', 'active', 'Test case for E2E testing'),
                ($1, $2, 'Test Case 2', 'TEST-002', 'contract', 'active', 'Another test case')
            RETURNING id
        `, [userId, clientId]);

        const caseId = caseResult.rows[0].id;

        // Create test invoices
        await pool.query(`
            INSERT INTO invoices (user_id, client_id, case_id, invoice_number, status, total, amount_paid, due_date)
            VALUES
                ($1, $2, $3, 'INV-TEST-001', 'draft', 1000.00, 0, CURRENT_DATE + 30),
                ($1, $2, $3, 'INV-TEST-002', 'sent', 2500.00, 500.00, CURRENT_DATE + 15),
                ($1, $2, $3, 'INV-TEST-003', 'paid', 1500.00, 1500.00, CURRENT_DATE - 10)
        `, [userId, clientId, caseId]);

        // Create test time entries
        await pool.query(`
            INSERT INTO time_entries (user_id, case_id, description, duration_minutes, hourly_rate, date, activity_type, is_billable)
            VALUES
                ($1, $2, 'Initial case review', 60, 250, CURRENT_DATE - 5, 'review', true),
                ($1, $2, 'Client meeting', 90, 250, CURRENT_DATE - 3, 'meeting', true),
                ($1, $2, 'Document drafting', 120, 250, CURRENT_DATE - 1, 'drafting', true)
        `, [userId, caseId]);

        // Create test expenses
        await pool.query(`
            INSERT INTO expenses (user_id, case_id, description, amount, expense_date, category, is_billable)
            VALUES
                ($1, $2, 'Court filing fee', 350.00, CURRENT_DATE - 7, 'filing_fee', true),
                ($1, $2, 'Copy charges', 45.00, CURRENT_DATE - 4, 'copies', true),
                ($1, $2, 'Expert consultation', 500.00, CURRENT_DATE - 2, 'expert', true)
        `, [userId, caseId]);

        // Create test leads
        await pool.query(`
            INSERT INTO leads (user_id, first_name, last_name, email, phone, source, status)
            VALUES
                ($1, 'Potential', 'Lead', 'lead1@example.com', '555-333-3333', 'website', 'new'),
                ($1, 'Another', 'Prospect', 'lead2@example.com', '555-444-4444', 'referral', 'contacted')
        `, [userId]);

        // Create AI drafting templates
        await pool.query(`
            INSERT INTO ai_draft_templates (user_id, name, description, category, document_type, prompt_template, is_public, usage_count)
            VALUES
                ($1, 'Demand Letter', 'Standard demand letter template', 'letter', 'demand_letter', 'Write a professional demand letter...', true, 5),
                ($1, 'Contract Agreement', 'Basic contract template', 'contract', 'agreement', 'Draft a contract agreement for...', true, 3)
        `, [userId]);

        // Create AI drafting sessions
        const templateResult = await pool.query(`SELECT id FROM ai_draft_templates WHERE user_id = $1 LIMIT 1`, [userId]);
        const templateId = templateResult.rows.length > 0 ? templateResult.rows[0].id : null;

        await pool.query(`
            INSERT INTO ai_draft_sessions (user_id, template_id, client_id, case_id, title, status)
            VALUES
                ($1, $2, $3, $4, 'Draft Demand Letter', 'completed'),
                ($1, $2, $3, $4, 'Contract Draft v1', 'completed')
        `, [userId, templateId, clientId, caseId]);

        // Create trust accounts
        await pool.query(`
            INSERT INTO trust_accounts (user_id, account_name, account_number_last4, bank_name, account_type, current_balance)
            VALUES
                ($1, 'Client Trust Account', '0001', 'First National Bank', 'iolta', 25000.00),
                ($1, 'Operating Trust', '0002', 'Bank of Commerce', 'client_trust', 10000.00)
        `, [userId]);

        // Create client trust ledgers
        const trustResult = await pool.query(`SELECT id FROM trust_accounts WHERE user_id = $1 LIMIT 1`, [userId]);
        const trustId = trustResult.rows.length > 0 ? trustResult.rows[0].id : null;

        if (trustId) {
            await pool.query(`
                INSERT INTO client_trust_ledgers (trust_account_id, client_id, case_id, current_balance)
                VALUES
                    ($1, $2, $3, 5000.00)
            `, [trustId, clientId, caseId]);
        }

        // Create conflict checks
        await pool.query(`
            INSERT INTO conflict_checks (user_id, matter_type, matter_description, status, result)
            VALUES
                ($1, 'new_client', 'Conflict check for new client intake', 'completed', 'clear'),
                ($1, 'new_matter', 'Conflict check for contract dispute', 'completed', 'potential_conflict')
        `, [userId]);

        // Create conflict parties
        await pool.query(`
            INSERT INTO conflict_parties (user_id, name, party_type, email, phone, company_name)
            VALUES
                ($1, 'John Smith', 'individual', 'jsmith@example.com', '555-555-0001', NULL),
                ($1, 'ABC Corp', 'business', 'contact@abccorp.com', '555-555-0002', 'ABC Corporation')
        `, [userId]);

        // Create conflict waivers
        const conflictResult = await pool.query(`SELECT id FROM conflict_checks WHERE user_id = $1 LIMIT 1`, [userId]);
        const conflictId = conflictResult.rows.length > 0 ? conflictResult.rows[0].id : null;

        if (conflictId) {
            await pool.query(`
                INSERT INTO conflict_waivers (user_id, conflict_check_id, client_id, waiver_type, status, description)
                VALUES
                    ($1, $2, $3, 'informed_consent', 'pending', 'Client informed of potential conflict')
            `, [userId, conflictId, clientId]);
        }

        // Create calendar events
        await pool.query(`
            INSERT INTO calendar_events (user_id, title, start_time, end_time, event_type, case_id)
            VALUES
                ($1, 'Client Meeting', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day' + INTERVAL '1 hour', 'meeting', $2),
                ($1, 'Court Hearing', NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days' + INTERVAL '2 hours', 'court_date', $2),
                ($1, 'Filing Deadline', NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days', 'deadline', $2)
        `, [userId, caseId]);

        // Create OCR scans
        await pool.query(`
            INSERT INTO ocr_scans (user_id, original_filename, extracted_text, status, file_size)
            VALUES
                ($1, 'contract_scan.pdf', 'This is sample extracted text from a scanned document...', 'completed', 1024000),
                ($1, 'invoice_scan.jpg', 'Invoice #12345 - Amount Due: $500.00', 'completed', 512000)
        `, [userId]);

        // Create payments/payment links
        await pool.query(`
            INSERT INTO payment_links (user_id, client_id, invoice_id, amount, status, link_code, expires_at)
            VALUES
                ($1, $2, NULL, 500.00, 'active', 'PAYLINK001', NOW() + INTERVAL '30 days')
        `, [userId, clientId]);

        // Create team tasks
        await pool.query(`
            INSERT INTO tasks (user_id, title, description, status, priority, due_date, case_id)
            VALUES
                ($1, 'Review Contract', 'Review and annotate the contract draft', 'in_progress', 'high', CURRENT_DATE + 3, $2),
                ($1, 'File Motion', 'Prepare and file the motion to dismiss', 'pending', 'urgent', CURRENT_DATE + 7, $2),
                ($1, 'Client Follow-up', 'Call client to discuss case status', 'completed', 'medium', CURRENT_DATE - 1, $2)
        `, [userId, caseId]);

        console.log('✅ Test seed data created');

    } catch (error) {
        console.error('⚠️ Error creating seed data (may already exist):', error.message);
    }
}

async function globalSetup(config) {
    console.log('🔧 Setting up Playwright E2E tests...');

    // Database config
    const dbConfig = process.env.DATABASE_URL
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

    const pool = new Pool(dbConfig);

    try {
        // Check if test user exists
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [TEST_USER.email]
        );

        let userId;
        if (existingUser.rows.length === 0) {
            console.log('📝 Creating test user...');
            const passwordHash = await bcrypt.hash(TEST_USER.password, 10);
            const userResult = await pool.query(
                `INSERT INTO users (email, password_hash, first_name, last_name)
                 VALUES ($1, $2, $3, $4) RETURNING id`,
                [TEST_USER.email, passwordHash, TEST_USER.firstName, TEST_USER.lastName]
            );
            userId = userResult.rows[0].id;
            console.log('✅ Test user created');
        } else {
            userId = existingUser.rows[0].id;
            console.log('✅ Test user already exists');
        }

        // Create seed data for test user if not already present
        await seedTestData(pool, userId);

        // Launch browser and authenticate
        console.log('🔐 Authenticating...');
        const browser = await chromium.launch();
        const context = await browser.newContext();
        const page = await context.newPage();

        // Wait for server to be ready
        const baseURL = config.projects[0].use.baseURL || 'http://localhost:3000';
        let serverReady = false;
        let attempts = 0;

        while (!serverReady && attempts < 30) {
            try {
                await page.goto(baseURL + '/login', { timeout: 5000 });
                serverReady = true;
            } catch (e) {
                attempts++;
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        if (!serverReady) {
            throw new Error('Server did not start in time');
        }

        // Login
        await page.fill('input[name="email"]', TEST_USER.email);
        await page.fill('input[name="password"]', TEST_USER.password);
        await page.click('button[type="submit"]');

        // Wait for login to complete
        await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 });

        // Save authentication state
        await context.storageState({ path: 'tests/e2e/.auth/user.json' });
        console.log('✅ Authentication state saved');

        await browser.close();
        console.log('✅ Playwright setup complete\n');

    } catch (error) {
        console.error('❌ Setup error:', error.message);
        // Don't throw - allow tests to run with their own login attempts
    } finally {
        await pool.end();
    }
}

module.exports = globalSetup;

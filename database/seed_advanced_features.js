/**
 * Seed file for Advanced Features
 * Creates 15+ sample records for each new feature
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'legalforms',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT || 5432
});

async function seed() {
    const client = await pool.connect();

    try {
        console.log('Starting advanced features seed...\n');

        // Get existing user and client IDs
        const usersResult = await client.query('SELECT id FROM users LIMIT 5');
        const clientsResult = await client.query('SELECT id FROM clients LIMIT 15');
        const casesResult = await client.query('SELECT id FROM cases LIMIT 15');
        const invoicesResult = await client.query('SELECT id FROM invoices LIMIT 15');
        const documentsResult = await client.query('SELECT id FROM document_history LIMIT 15');
        const eventsResult = await client.query('SELECT id FROM calendar_events LIMIT 15');

        const userIds = usersResult.rows.map(r => r.id);
        const clientIds = clientsResult.rows.map(r => r.id);
        const caseIds = casesResult.rows.map(r => r.id);
        const invoiceIds = invoicesResult.rows.map(r => r.id);
        const documentIds = documentsResult.rows.map(r => r.id);
        const eventIds = eventsResult.rows.map(r => r.id);

        if (userIds.length === 0) {
            console.log('No users found. Please run main seed first.');
            return;
        }

        const userId = userIds[0];

        // Create all required tables if they don't exist (fallback for failed migrations)
        console.log('Ensuring required tables exist...');

        const createTableQueries = [
            // Stripe/Payments
            `CREATE TABLE IF NOT EXISTS stripe_customers (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
                stripe_customer_id VARCHAR(255) UNIQUE NOT NULL,
                default_payment_method VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(client_id)
            )`,
            `CREATE TABLE IF NOT EXISTS payment_methods (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
                stripe_payment_method_id VARCHAR(255) UNIQUE NOT NULL,
                type VARCHAR(50) NOT NULL,
                last_four VARCHAR(4),
                brand VARCHAR(50),
                exp_month INTEGER,
                exp_year INTEGER,
                is_default BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS online_payments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
                client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
                stripe_payment_intent_id VARCHAR(255),
                stripe_charge_id VARCHAR(255),
                amount DECIMAL(10,2) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                fee_amount DECIMAL(10,2) DEFAULT 0,
                net_amount DECIMAL(10,2),
                receipt_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS payment_links (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
                token VARCHAR(255) UNIQUE NOT NULL,
                amount DECIMAL(10,2),
                is_active BOOLEAN DEFAULT true,
                expires_at TIMESTAMP,
                viewed_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            // Trust Accounting
            `CREATE TABLE IF NOT EXISTS trust_accounts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                account_name VARCHAR(200) NOT NULL,
                bank_name VARCHAR(200),
                account_number_last4 VARCHAR(4),
                routing_number_last4 VARCHAR(4),
                account_type VARCHAR(50) DEFAULT 'iolta',
                current_balance DECIMAL(12,2) DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS client_trust_ledgers (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                trust_account_id UUID REFERENCES trust_accounts(id) ON DELETE CASCADE,
                client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
                case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
                current_balance DECIMAL(12,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS trust_transactions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                trust_account_id UUID REFERENCES trust_accounts(id) ON DELETE CASCADE,
                client_trust_ledger_id UUID REFERENCES client_trust_ledgers(id) ON DELETE CASCADE,
                transaction_type VARCHAR(50) NOT NULL,
                amount DECIMAL(12,2) NOT NULL,
                balance_after DECIMAL(12,2),
                description TEXT,
                reference_number VARCHAR(100),
                payee VARCHAR(200),
                transaction_date DATE,
                created_by UUID REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS trust_reconciliations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                trust_account_id UUID REFERENCES trust_accounts(id) ON DELETE CASCADE,
                statement_date DATE,
                statement_balance DECIMAL(12,2),
                book_balance DECIMAL(12,2),
                adjusted_balance DECIMAL(12,2),
                is_balanced BOOLEAN DEFAULT false,
                reconciled_by UUID REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            // Conflict Checking
            `CREATE TABLE IF NOT EXISTS conflict_parties (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                party_type VARCHAR(50),
                name VARCHAR(200) NOT NULL,
                email VARCHAR(255),
                phone VARCHAR(50),
                company VARCHAR(200),
                case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
                client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
                relationship VARCHAR(100),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS conflict_checks (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                check_type VARCHAR(50),
                search_terms TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                conflict_count INTEGER DEFAULT 0,
                checked_by UUID REFERENCES users(id) ON DELETE SET NULL,
                case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
                client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS conflict_waivers (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                conflict_check_id UUID REFERENCES conflict_checks(id) ON DELETE CASCADE,
                waiver_type VARCHAR(50),
                parties_involved TEXT,
                waiver_text TEXT,
                obtained_from VARCHAR(200),
                obtained_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            // Two-Factor Auth
            `CREATE TABLE IF NOT EXISTS two_factor_attempts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                attempt_type VARCHAR(50),
                success BOOLEAN DEFAULT false,
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS trusted_devices (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                device_token VARCHAR(255) UNIQUE NOT NULL,
                device_name VARCHAR(200),
                device_type VARCHAR(50),
                browser VARCHAR(100),
                os VARCHAR(100),
                ip_address VARCHAR(45),
                expires_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS security_audit_log (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                event_type VARCHAR(100) NOT NULL,
                severity VARCHAR(20) DEFAULT 'info',
                details JSONB,
                ip_address VARCHAR(45),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            // AI Drafting
            `CREATE TABLE IF NOT EXISTS ai_draft_templates (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(200) NOT NULL,
                description TEXT,
                category VARCHAR(100),
                document_type VARCHAR(100),
                prompt_template TEXT,
                variables JSONB DEFAULT '[]',
                is_public BOOLEAN DEFAULT false,
                usage_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS ai_draft_sessions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                template_id UUID REFERENCES ai_draft_templates(id) ON DELETE SET NULL,
                case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
                client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
                title VARCHAR(200),
                input_data JSONB,
                status VARCHAR(50) DEFAULT 'draft',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS ai_draft_versions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                session_id UUID REFERENCES ai_draft_sessions(id) ON DELETE CASCADE,
                version_number INTEGER DEFAULT 1,
                content TEXT,
                prompt_used TEXT,
                model_used VARCHAR(100),
                tokens_used INTEGER,
                generation_time_ms INTEGER,
                feedback VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS ai_usage_log (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                feature VARCHAR(100),
                model VARCHAR(100),
                input_tokens INTEGER,
                output_tokens INTEGER,
                total_tokens INTEGER,
                cost_estimate DECIMAL(10,6),
                response_time_ms INTEGER,
                success BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            // Calendar Sync
            `CREATE TABLE IF NOT EXISTS calendar_connections (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                provider VARCHAR(50) NOT NULL,
                provider_account_id VARCHAR(255),
                provider_email VARCHAR(255),
                calendar_id VARCHAR(255),
                sync_direction VARCHAR(20) DEFAULT 'both',
                sync_status VARCHAR(50) DEFAULT 'active',
                last_sync_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS calendar_sync_mapping (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                connection_id UUID REFERENCES calendar_connections(id) ON DELETE CASCADE,
                local_event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE,
                provider_event_id VARCHAR(255),
                provider_etag VARCHAR(255),
                sync_status VARCHAR(50) DEFAULT 'synced',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS calendar_sync_log (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                connection_id UUID REFERENCES calendar_connections(id) ON DELETE CASCADE,
                sync_type VARCHAR(50),
                events_created INTEGER DEFAULT 0,
                events_updated INTEGER DEFAULT 0,
                events_deleted INTEGER DEFAULT 0,
                status VARCHAR(50),
                started_at TIMESTAMP,
                completed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            // Lead Intake
            `CREATE TABLE IF NOT EXISTS intake_form_templates (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(200) NOT NULL,
                description TEXT,
                practice_area VARCHAR(100),
                fields JSONB NOT NULL DEFAULT '[]',
                is_active BOOLEAN DEFAULT true,
                slug VARCHAR(100) UNIQUE,
                submission_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS lead_scoring_rules (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(200),
                condition_field VARCHAR(100),
                condition_operator VARCHAR(50),
                condition_value TEXT,
                score_adjustment INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            // PWA/Push
            `CREATE TABLE IF NOT EXISTS push_subscriptions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                endpoint TEXT NOT NULL,
                p256dh_key TEXT,
                auth_key TEXT,
                device_type VARCHAR(50),
                device_name VARCHAR(200),
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS push_notifications (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                subscription_id UUID REFERENCES push_subscriptions(id) ON DELETE CASCADE,
                title VARCHAR(200),
                body TEXT,
                url TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                sent_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS offline_sync_queue (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                action VARCHAR(50),
                entity_type VARCHAR(100),
                entity_id UUID,
                payload JSONB,
                status VARCHAR(50) DEFAULT 'pending',
                device_id VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            // OCR
            `CREATE TABLE IF NOT EXISTS ocr_jobs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                document_id UUID REFERENCES document_history(id) ON DELETE SET NULL,
                original_file_path TEXT,
                file_name VARCHAR(255),
                file_type VARCHAR(50),
                file_size INTEGER,
                status VARCHAR(50) DEFAULT 'pending',
                page_count INTEGER DEFAULT 0,
                pages_processed INTEGER DEFAULT 0,
                language VARCHAR(10) DEFAULT 'en',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS ocr_pages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                job_id UUID REFERENCES ocr_jobs(id) ON DELETE CASCADE,
                page_number INTEGER,
                raw_text TEXT,
                confidence_score DECIMAL(5,2),
                word_count INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS ocr_entities (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                job_id UUID REFERENCES ocr_jobs(id) ON DELETE CASCADE,
                page_id UUID REFERENCES ocr_pages(id) ON DELETE CASCADE,
                entity_type VARCHAR(50),
                value TEXT,
                normalized_value TEXT,
                confidence DECIMAL(5,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS ocr_search_index (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                job_id UUID REFERENCES ocr_jobs(id) ON DELETE CASCADE,
                document_id UUID REFERENCES document_history(id) ON DELETE CASCADE,
                full_text TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        for (const query of createTableQueries) {
            try {
                await client.query(query);
            } catch (e) {
                // Ignore errors - table might already exist with different structure
            }
        }
        console.log('  Tables verified\n');

        // =====================================================
        // FEATURE 1: CLIENT PORTAL SEED DATA (15+ items)
        // =====================================================
        console.log('Seeding Client Portal data...');

        // Add portal_token column if it doesn't exist (fallback if migration failed)
        await client.query(`
            ALTER TABLE client_portal_access
            ADD COLUMN IF NOT EXISTS portal_token VARCHAR(255)
        `).catch(() => {});

        // Create client_portal_sessions table if it doesn't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS client_portal_sessions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                portal_access_id UUID REFERENCES client_portal_access(id) ON DELETE CASCADE,
                session_token VARCHAR(255) UNIQUE NOT NULL,
                ip_address VARCHAR(45),
                user_agent TEXT,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `).catch(() => {});

        // Client portal access
        for (let i = 0; i < Math.min(15, clientIds.length); i++) {
            const passwordHash = await bcrypt.hash('ClientPortal123!', 10);
            await client.query(`
                INSERT INTO client_portal_access (client_id, email, password_hash, is_active, portal_token)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                clientIds[i],
                `client${i + 1}@example.com`,
                passwordHash,
                true,
                crypto.randomBytes(32).toString('hex')
            ]);
        }

        // Client portal sessions
        const portalAccessResult = await client.query('SELECT id, client_id FROM client_portal_access LIMIT 15');
        for (const access of portalAccessResult.rows) {
            await client.query(`
                INSERT INTO client_portal_sessions (portal_access_id, session_token, ip_address, user_agent, expires_at)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                access.id,
                crypto.randomBytes(32).toString('hex'),
                `192.168.1.${Math.floor(Math.random() * 255)}`,
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
                new Date(Date.now() + 24 * 60 * 60 * 1000)
            ]);
        }

        // Client document access
        for (let i = 0; i < Math.min(15, clientIds.length, documentIds.length); i++) {
            await client.query(`
                INSERT INTO client_document_access (client_id, document_id, granted_by, access_type)
                VALUES ($1, $2, $3, $4)
            `, [clientIds[i], documentIds[i % documentIds.length], userId, i % 2 === 0 ? 'view' : 'download']);
        }

        // Create client_portal_activity table if it doesn't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS client_portal_activity (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
                action VARCHAR(100) NOT NULL,
                details JSONB,
                ip_address VARCHAR(45),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `).catch(() => {});

        // Client portal activity
        const portalActivities = [
            'Logged in to portal',
            'Viewed case details',
            'Downloaded document',
            'Viewed invoice',
            'Updated contact information',
            'Viewed calendar events',
            'Sent message to attorney',
            'Reviewed billing statement',
            'Uploaded document',
            'Changed password',
            'Viewed task list',
            'Acknowledged deadline',
            'Paid invoice online',
            'Requested appointment',
            'Viewed case timeline'
        ];

        for (let i = 0; i < 15; i++) {
            await client.query(`
                INSERT INTO client_portal_activity (client_id, action, details, ip_address)
                VALUES ($1, $2, $3, $4)
            `, [
                clientIds[i % clientIds.length],
                portalActivities[i],
                JSON.stringify({ timestamp: new Date().toISOString(), success: true }),
                `192.168.1.${Math.floor(Math.random() * 255)}`
            ]);
        }

        console.log('  - Created 15 client portal records');

        // =====================================================
        // FEATURE 2: ONLINE PAYMENTS SEED DATA (15+ items)
        // =====================================================
        console.log('Seeding Online Payments data...');

        // Stripe customers
        for (let i = 0; i < Math.min(15, clientIds.length); i++) {
            await client.query(`
                INSERT INTO stripe_customers (client_id, stripe_customer_id, default_payment_method)
                VALUES ($1, $2, $3)
            `, [
                clientIds[i],
                `cus_${crypto.randomBytes(14).toString('hex')}`,
                i % 3 === 0 ? `pm_${crypto.randomBytes(14).toString('hex')}` : null
            ]);
        }

        // Payment methods
        const cardBrands = ['visa', 'mastercard', 'amex', 'discover'];
        const stripeCustomersResult = await client.query('SELECT id, client_id FROM stripe_customers LIMIT 15');

        for (let i = 0; i < 15; i++) {
            const custRow = stripeCustomersResult.rows[i % stripeCustomersResult.rows.length];
            await client.query(`
                INSERT INTO payment_methods (client_id, stripe_payment_method_id, type, last_four, brand, exp_month, exp_year, is_default)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                custRow.client_id,
                `pm_${crypto.randomBytes(14).toString('hex')}`,
                'card',
                String(1000 + Math.floor(Math.random() * 9000)),
                cardBrands[i % cardBrands.length],
                Math.floor(Math.random() * 12) + 1,
                2025 + Math.floor(Math.random() * 5),
                i === 0
            ]);
        }

        // Online payments
        const paymentStatuses = ['succeeded', 'succeeded', 'succeeded', 'pending', 'failed'];
        for (let i = 0; i < 15; i++) {
            const amount = (Math.floor(Math.random() * 5000) + 500);
            const fee = Math.round(amount * 0.029 + 30) / 100;
            await client.query(`
                INSERT INTO online_payments (invoice_id, client_id, stripe_payment_intent_id, stripe_charge_id, amount, status, fee_amount, net_amount, receipt_url)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                invoiceIds[i % invoiceIds.length],
                clientIds[i % clientIds.length],
                `pi_${crypto.randomBytes(14).toString('hex')}`,
                `ch_${crypto.randomBytes(14).toString('hex')}`,
                amount,
                paymentStatuses[i % paymentStatuses.length],
                fee,
                amount - fee,
                `https://pay.stripe.com/receipts/${crypto.randomBytes(16).toString('hex')}`
            ]);
        }

        // Payment links
        for (let i = 0; i < 15; i++) {
            await client.query(`
                INSERT INTO payment_links (invoice_id, token, amount, is_active, expires_at, viewed_count)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                invoiceIds[i % invoiceIds.length],
                crypto.randomBytes(32).toString('hex'),
                Math.floor(Math.random() * 5000) + 500,
                i < 12,
                new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000),
                Math.floor(Math.random() * 10)
            ]);
        }

        console.log('  - Created 15 online payment records');

        // =====================================================
        // FEATURE 3: TRUST/IOLTA ACCOUNTING SEED DATA (15+ items)
        // =====================================================
        console.log('Seeding Trust/IOLTA Accounting data...');

        // Trust accounts
        const bankNames = ['First National Bank', 'Wells Fargo', 'Chase', 'Bank of America', 'US Bank'];
        const trustAccountIds = [];

        for (let i = 0; i < 5; i++) {
            const result = await client.query(`
                INSERT INTO trust_accounts (user_id, account_name, bank_name, account_number_last4, routing_number_last4, account_type, current_balance, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id
            `, [
                userId,
                `Trust Account ${i + 1}`,
                bankNames[i],
                String(1000 + Math.floor(Math.random() * 9000)),
                String(1000 + Math.floor(Math.random() * 9000)),
                i === 0 ? 'iolta' : (i === 1 ? 'client_trust' : 'operating'),
                Math.floor(Math.random() * 100000) + 10000,
                true
            ]);
            trustAccountIds.push(result.rows[0].id);
        }

        // Client trust ledgers
        const ledgerIds = [];
        for (let i = 0; i < 15; i++) {
            const result = await client.query(`
                INSERT INTO client_trust_ledgers (trust_account_id, client_id, case_id, current_balance)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `, [
                trustAccountIds[i % trustAccountIds.length],
                clientIds[i % clientIds.length],
                caseIds[i % caseIds.length],
                Math.floor(Math.random() * 20000) + 1000
            ]);
            ledgerIds.push(result.rows[0].id);
        }

        // Trust transactions
        const transactionTypes = ['deposit', 'withdrawal', 'transfer', 'fee', 'deposit', 'withdrawal'];
        const payees = ['Court Filing Fee', 'Expert Witness', 'Client Refund', 'Investigation Services', 'Mediation Fee'];

        for (let i = 0; i < 15; i++) {
            const amount = Math.floor(Math.random() * 5000) + 100;
            await client.query(`
                INSERT INTO trust_transactions (trust_account_id, client_trust_ledger_id, transaction_type, amount, balance_after, description, reference_number, payee, transaction_date, created_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [
                trustAccountIds[i % trustAccountIds.length],
                ledgerIds[i % ledgerIds.length],
                transactionTypes[i % transactionTypes.length],
                amount,
                Math.floor(Math.random() * 50000) + 5000,
                `Transaction ${i + 1} - ${transactionTypes[i % transactionTypes.length]}`,
                `REF-${Date.now()}-${i}`,
                payees[i % payees.length],
                new Date(Date.now() - i * 2 * 24 * 60 * 60 * 1000),
                userId
            ]);
        }

        // Trust reconciliations
        for (let i = 0; i < 15; i++) {
            const balance = Math.floor(Math.random() * 100000) + 10000;
            await client.query(`
                INSERT INTO trust_reconciliations (trust_account_id, statement_date, statement_balance, book_balance, adjusted_balance, is_balanced, reconciled_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                trustAccountIds[i % trustAccountIds.length],
                new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000),
                balance,
                balance + (i % 3 === 0 ? Math.floor(Math.random() * 100) : 0),
                balance,
                i % 3 !== 0,
                userId
            ]);
        }

        console.log('  - Created 15 trust account records');

        // =====================================================
        // FEATURE 4: CONFLICT CHECKING SEED DATA (15+ items)
        // =====================================================
        console.log('Seeding Conflict Checking data...');

        // Conflict parties
        const partyTypes = ['individual', 'business', 'opposing_party', 'witness', 'related_party'];
        const relationships = ['client', 'opposing', 'co-counsel', 'witness', 'expert'];
        const partyNames = [
            'John Smith', 'ABC Corporation', 'Jane Doe', 'XYZ Industries', 'Robert Johnson',
            'Tech Solutions Inc', 'Mary Williams', 'Global Enterprises', 'David Brown', 'Legal Services LLC',
            'Sarah Davis', 'First National Corp', 'Michael Wilson', 'Metro Holdings', 'Jennifer Taylor'
        ];

        for (let i = 0; i < 15; i++) {
            await client.query(`
                INSERT INTO conflict_parties (user_id, party_type, name, email, phone, company, case_id, client_id, relationship, notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [
                userId,
                partyTypes[i % partyTypes.length],
                partyNames[i],
                `party${i + 1}@example.com`,
                `555-${String(1000 + i).padStart(4, '0')}`,
                i % 2 === 0 ? partyNames[i] : null,
                caseIds[i % caseIds.length],
                i % 3 === 0 ? clientIds[i % clientIds.length] : null,
                relationships[i % relationships.length],
                `Party added for conflict tracking - ${new Date().toLocaleDateString()}`
            ]);
        }

        // Conflict checks
        const checkStatuses = ['clear', 'conflict_found', 'waived', 'clear', 'pending'];
        const conflictCheckIds = [];

        for (let i = 0; i < 15; i++) {
            const result = await client.query(`
                INSERT INTO conflict_checks (user_id, check_type, search_terms, status, conflict_count, checked_by, case_id, client_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id
            `, [
                userId,
                i % 3 === 0 ? 'new_client' : 'new_matter',
                JSON.stringify({ names: [partyNames[i]], companies: [partyNames[(i + 1) % 15]] }),
                checkStatuses[i % checkStatuses.length],
                checkStatuses[i % checkStatuses.length] === 'conflict_found' ? Math.floor(Math.random() * 3) + 1 : 0,
                userId,
                caseIds[i % caseIds.length],
                clientIds[i % clientIds.length]
            ]);
            conflictCheckIds.push(result.rows[0].id);
        }

        // Conflict waivers
        for (let i = 0; i < 15; i++) {
            if (i % 3 === 0) {
                await client.query(`
                    INSERT INTO conflict_waivers (conflict_check_id, waiver_type, parties_involved, waiver_text, obtained_from, obtained_date)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                    conflictCheckIds[i % conflictCheckIds.length],
                    i % 2 === 0 ? 'informed_consent' : 'advance_waiver',
                    JSON.stringify([partyNames[i], partyNames[(i + 1) % 15]]),
                    'Client has been fully informed of the potential conflict and consents to continued representation.',
                    partyNames[i],
                    new Date(Date.now() - i * 5 * 24 * 60 * 60 * 1000)
                ]);
            }
        }

        console.log('  - Created 15 conflict check records');

        // =====================================================
        // FEATURE 5: TWO-FACTOR AUTHENTICATION SEED DATA (15+ items)
        // =====================================================
        console.log('Seeding Two-Factor Authentication data...');

        // Add 2FA columns to users if they don't exist
        try {
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false`);
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255)`);
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_backup_codes JSONB`);
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_verified_at TIMESTAMP`);
        } catch (e) { /* columns might already exist */ }

        // Update users with 2FA (for demo purposes) - skip first user (demo user) so login works
        for (let i = 1; i < Math.min(15, userIds.length); i++) {
            const backupCodes = Array.from({ length: 10 }, () =>
                crypto.randomBytes(4).toString('hex').toUpperCase()
            );
            await client.query(`
                UPDATE users SET
                    two_factor_enabled = $1,
                    two_factor_secret = $2,
                    two_factor_backup_codes = $3,
                    two_factor_verified_at = $4
                WHERE id = $5
            `, [
                i < 4,
                i < 4 ? crypto.randomBytes(20).toString('hex').toUpperCase() : null,
                JSON.stringify(backupCodes),
                i < 4 ? new Date() : null,
                userIds[i % userIds.length]
            ]);
        }

        // 2FA attempts
        for (let i = 0; i < 15; i++) {
            await client.query(`
                INSERT INTO two_factor_attempts (user_id, attempt_type, success, ip_address, user_agent)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                userIds[i % userIds.length],
                i % 3 === 0 ? 'backup_code' : 'totp',
                i % 4 !== 0,
                `192.168.1.${Math.floor(Math.random() * 255)}`,
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
            ]);
        }

        // Trusted devices
        const deviceTypes = ['desktop', 'mobile', 'tablet'];
        const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];
        const oses = ['Windows 11', 'macOS Sonoma', 'iOS 17', 'Android 14', 'Ubuntu 22.04'];

        for (let i = 0; i < 15; i++) {
            await client.query(`
                INSERT INTO trusted_devices (user_id, device_token, device_name, device_type, browser, os, ip_address, expires_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                userIds[i % userIds.length],
                crypto.randomBytes(32).toString('hex'),
                `${browsers[i % browsers.length]} on ${oses[i % oses.length]}`,
                deviceTypes[i % deviceTypes.length],
                browsers[i % browsers.length],
                oses[i % oses.length],
                `192.168.1.${Math.floor(Math.random() * 255)}`,
                new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            ]);
        }

        // Security audit log
        const securityEvents = [
            'login_success', 'login_failed', '2fa_enabled', '2fa_disabled', 'password_changed',
            'password_reset_requested', 'device_trusted', 'session_expired', 'account_locked',
            'backup_codes_regenerated', 'api_key_created', 'permission_changed', 'logout',
            'suspicious_activity', 'email_changed'
        ];

        for (let i = 0; i < 15; i++) {
            await client.query(`
                INSERT INTO security_audit_log (user_id, event_type, severity, details, ip_address)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                userIds[i % userIds.length],
                securityEvents[i],
                i === 8 || i === 13 ? 'warning' : 'info',
                JSON.stringify({ timestamp: new Date().toISOString(), source: 'web' }),
                `192.168.1.${Math.floor(Math.random() * 255)}`
            ]);
        }

        console.log('  - Created 15 2FA records');

        // =====================================================
        // FEATURE 6: AI DOCUMENT DRAFTING SEED DATA (15+ items)
        // =====================================================
        console.log('Seeding AI Document Drafting data...');

        // AI draft templates
        const templateCategories = ['contract', 'letter', 'motion', 'brief', 'memo'];
        const templateData = [
            { name: 'Client Engagement Letter', category: 'letter', type: 'engagement_letter' },
            { name: 'Motion to Dismiss', category: 'motion', type: 'motion_dismiss' },
            { name: 'Discovery Request', category: 'motion', type: 'discovery' },
            { name: 'Settlement Agreement', category: 'contract', type: 'settlement' },
            { name: 'Demand Letter', category: 'letter', type: 'demand_letter' },
            { name: 'Case Summary Brief', category: 'brief', type: 'case_summary' },
            { name: 'Legal Memorandum', category: 'memo', type: 'legal_memo' },
            { name: 'Retainer Agreement', category: 'contract', type: 'retainer' },
            { name: 'Motion for Summary Judgment', category: 'motion', type: 'summary_judgment' },
            { name: 'Non-Disclosure Agreement', category: 'contract', type: 'nda' },
            { name: 'Cease and Desist', category: 'letter', type: 'cease_desist' },
            { name: 'Appellate Brief', category: 'brief', type: 'appellate' },
            { name: 'Client Status Update', category: 'letter', type: 'status_update' },
            { name: 'Mediation Brief', category: 'brief', type: 'mediation' },
            { name: 'Employment Contract', category: 'contract', type: 'employment' }
        ];

        const aiTemplateIds = [];
        for (let i = 0; i < 15; i++) {
            const result = await client.query(`
                INSERT INTO ai_draft_templates (user_id, name, description, category, document_type, prompt_template, variables, is_public, usage_count)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING id
            `, [
                userId,
                templateData[i].name,
                `AI-powered template for generating ${templateData[i].name.toLowerCase()}`,
                templateData[i].category,
                templateData[i].type,
                `Generate a professional ${templateData[i].name.toLowerCase()} for {{client_name}} regarding {{matter_description}}. Include standard legal provisions and customize based on: {{specific_requirements}}.`,
                JSON.stringify(['client_name', 'matter_description', 'specific_requirements']),
                i < 10,
                Math.floor(Math.random() * 100)
            ]);
            aiTemplateIds.push(result.rows[0].id);
        }

        // AI draft sessions
        const sessionStatuses = ['completed', 'completed', 'draft', 'completed', 'generating'];
        const aiSessionIds = [];

        for (let i = 0; i < 15; i++) {
            const result = await client.query(`
                INSERT INTO ai_draft_sessions (user_id, template_id, case_id, client_id, title, input_data, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
            `, [
                userId,
                aiTemplateIds[i % aiTemplateIds.length],
                caseIds[i % caseIds.length],
                clientIds[i % clientIds.length],
                `Draft: ${templateData[i % templateData.length].name} - ${new Date().toLocaleDateString()}`,
                JSON.stringify({
                    client_name: partyNames[i % partyNames.length],
                    matter_description: 'Contract dispute regarding service delivery',
                    specific_requirements: 'Include arbitration clause'
                }),
                sessionStatuses[i % sessionStatuses.length]
            ]);
            aiSessionIds.push(result.rows[0].id);
        }

        // AI draft versions
        for (let i = 0; i < 15; i++) {
            await client.query(`
                INSERT INTO ai_draft_versions (session_id, version_number, content, prompt_used, model_used, tokens_used, generation_time_ms, feedback)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                aiSessionIds[i % aiSessionIds.length],
                Math.floor(i / 5) + 1,
                `[AI Generated Content for ${templateData[i % templateData.length].name}]\n\nThis is a professionally drafted document prepared for the client. The content has been tailored based on the provided context and requirements.\n\n[Document content would appear here...]`,
                `Generate ${templateData[i % templateData.length].name}`,
                'openrouter/anthropic/claude-3-opus',
                Math.floor(Math.random() * 3000) + 500,
                Math.floor(Math.random() * 5000) + 1000,
                i % 3 === 0 ? 'thumbs_up' : (i % 5 === 0 ? 'thumbs_down' : null)
            ]);
        }

        // AI usage log
        const aiFeatures = ['document_draft', 'summarize', 'analyze', 'chat', 'review'];
        for (let i = 0; i < 15; i++) {
            const inputTokens = Math.floor(Math.random() * 2000) + 100;
            const outputTokens = Math.floor(Math.random() * 3000) + 200;
            await client.query(`
                INSERT INTO ai_usage_log (user_id, feature, model, input_tokens, output_tokens, total_tokens, cost_estimate, response_time_ms, success)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                userId,
                aiFeatures[i % aiFeatures.length],
                'openrouter/anthropic/claude-3-opus',
                inputTokens,
                outputTokens,
                inputTokens + outputTokens,
                (inputTokens * 0.00001 + outputTokens * 0.00003),
                Math.floor(Math.random() * 5000) + 500,
                i % 10 !== 0
            ]);
        }

        console.log('  - Created 15 AI drafting records');

        // =====================================================
        // FEATURE 7: CALENDAR SYNC SEED DATA (15+ items)
        // =====================================================
        console.log('Seeding Calendar Sync data...');

        // Calendar connections
        const providers = ['google', 'outlook', 'apple'];
        const calendarConnectionIds = [];

        for (let i = 0; i < 5; i++) {
            const result = await client.query(`
                INSERT INTO calendar_connections (user_id, provider, provider_account_id, provider_email, calendar_id, sync_direction, sync_status, last_sync_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id
            `, [
                userId,
                providers[i % providers.length],
                `account_${crypto.randomBytes(8).toString('hex')}`,
                `user${i + 1}@${providers[i % providers.length]}.com`,
                `calendar_${crypto.randomBytes(8).toString('hex')}`,
                i % 3 === 0 ? 'to_provider' : (i % 3 === 1 ? 'from_provider' : 'both'),
                i === 4 ? 'error' : 'active',
                new Date(Date.now() - Math.floor(Math.random() * 24 * 60 * 60 * 1000))
            ]);
            calendarConnectionIds.push(result.rows[0].id);
        }

        // Calendar sync mappings
        for (let i = 0; i < Math.min(15, eventIds.length); i++) {
            await client.query(`
                INSERT INTO calendar_sync_mapping (connection_id, local_event_id, provider_event_id, provider_etag, sync_status)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                calendarConnectionIds[i % calendarConnectionIds.length],
                eventIds[i],
                `event_${crypto.randomBytes(16).toString('hex')}`,
                `etag_${crypto.randomBytes(8).toString('hex')}`,
                i % 5 === 0 ? 'pending' : 'synced'
            ]);
        }

        // Calendar sync log
        for (let i = 0; i < 15; i++) {
            await client.query(`
                INSERT INTO calendar_sync_log (connection_id, sync_type, events_created, events_updated, events_deleted, status, started_at, completed_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                calendarConnectionIds[i % calendarConnectionIds.length],
                i % 3 === 0 ? 'full' : 'incremental',
                Math.floor(Math.random() * 10),
                Math.floor(Math.random() * 20),
                Math.floor(Math.random() * 5),
                i % 10 === 0 ? 'failed' : 'completed',
                new Date(Date.now() - i * 60 * 60 * 1000),
                new Date(Date.now() - i * 60 * 60 * 1000 + 30000)
            ]);
        }

        console.log('  - Created 15 calendar sync records');

        // =====================================================
        // FEATURE 8: LEAD INTAKE FORMS SEED DATA (15+ items)
        // =====================================================
        console.log('Seeding Lead Intake Forms data...');

        // Intake form templates
        const practiceAreas = ['personal_injury', 'family', 'criminal', 'corporate', 'estate', 'employment', 'real_estate'];
        const formTemplateIds = [];

        const formNames = [
            'Personal Injury Intake', 'Family Law Consultation', 'Criminal Defense Inquiry',
            'Business Formation', 'Estate Planning', 'Employment Dispute', 'Real Estate Transaction',
            'Medical Malpractice', 'Divorce Consultation', 'DUI Defense', 'Contract Review',
            'Will and Trust', 'Wrongful Termination', 'Property Dispute', 'General Consultation'
        ];

        for (let i = 0; i < 15; i++) {
            const slug = `intake-${formNames[i].toLowerCase().replace(/\s+/g, '-')}-${i}`;
            const result = await client.query(`
                INSERT INTO intake_form_templates (user_id, name, description, practice_area, fields, is_active, slug, submission_count)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id
            `, [
                userId,
                formNames[i],
                `Intake form for ${formNames[i].toLowerCase()} inquiries`,
                practiceAreas[i % practiceAreas.length],
                JSON.stringify([
                    { name: 'first_name', type: 'text', label: 'First Name', required: true },
                    { name: 'last_name', type: 'text', label: 'Last Name', required: true },
                    { name: 'email', type: 'email', label: 'Email', required: true },
                    { name: 'phone', type: 'tel', label: 'Phone', required: true },
                    { name: 'description', type: 'textarea', label: 'Describe Your Situation', required: true }
                ]),
                i < 12,
                slug,
                Math.floor(Math.random() * 100)
            ]);
            formTemplateIds.push(result.rows[0].id);
        }

        // Leads
        const leadStatuses = ['new', 'contacted', 'qualified', 'converted', 'lost'];
        const leadSources = ['website', 'referral', 'advertisement', 'social_media', 'google'];
        const leadIds = [];

        for (let i = 0; i < 15; i++) {
            const result = await client.query(`
                INSERT INTO leads (user_id, form_id, first_name, last_name, email, phone, practice_area, case_description, source, status, priority, follow_up_date)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING id
            `, [
                userId,
                formTemplateIds[i % formTemplateIds.length],
                partyNames[i].split(' ')[0],
                partyNames[i].split(' ')[1] || 'Smith',
                `lead${i + 1}@example.com`,
                `555-${String(2000 + i).padStart(4, '0')}`,
                practiceAreas[i % practiceAreas.length],
                `Potential ${practiceAreas[i % practiceAreas.length].replace('_', ' ')} case - needs consultation`,
                leadSources[i % leadSources.length],
                leadStatuses[i % leadStatuses.length],
                i % 3 === 0 ? 'high' : 'medium',
                new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000)
            ]);
            leadIds.push(result.rows[0].id);
        }

        // Lead activities
        const activityTypes = ['call', 'email', 'meeting', 'note', 'status_change'];

        for (let i = 0; i < 15; i++) {
            await client.query(`
                INSERT INTO lead_activities (lead_id, user_id, activity_type, description, outcome, next_action, next_action_date)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                leadIds[i % leadIds.length],
                userId,
                activityTypes[i % activityTypes.length],
                `${activityTypes[i % activityTypes.length]} with lead - discussed case details`,
                i % 2 === 0 ? 'Positive - interested in services' : 'Follow up needed',
                'Schedule consultation',
                new Date(Date.now() + (i + 1) * 2 * 24 * 60 * 60 * 1000)
            ]);
        }

        // Lead scoring rules
        const scoringConditions = [
            { field: 'practice_area', operator: 'equals', value: 'personal_injury', score: 20 },
            { field: 'source', operator: 'equals', value: 'referral', score: 15 },
            { field: 'priority', operator: 'equals', value: 'high', score: 25 },
            { field: 'has_phone', operator: 'equals', value: 'true', score: 10 },
            { field: 'practice_area', operator: 'equals', value: 'corporate', score: 30 }
        ];

        for (let i = 0; i < 15; i++) {
            const condition = scoringConditions[i % scoringConditions.length];
            await client.query(`
                INSERT INTO lead_scoring_rules (user_id, name, condition_field, condition_operator, condition_value, score_adjustment, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                userId,
                `Scoring Rule ${i + 1}: ${condition.field}`,
                condition.field,
                condition.operator,
                condition.value,
                condition.score,
                i < 12
            ]);
        }

        console.log('  - Created 15 lead intake records');

        // =====================================================
        // FEATURE 9: PWA / MOBILE SUPPORT SEED DATA (15+ items)
        // =====================================================
        console.log('Seeding PWA/Mobile Support data...');

        // Push subscriptions
        const pushSubscriptionIds = [];

        for (let i = 0; i < 15; i++) {
            const result = await client.query(`
                INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key, device_type, device_name, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
            `, [
                userIds[i % userIds.length],
                `https://fcm.googleapis.com/fcm/send/${crypto.randomBytes(32).toString('hex')}`,
                crypto.randomBytes(65).toString('base64'),
                crypto.randomBytes(16).toString('base64'),
                deviceTypes[i % deviceTypes.length],
                `${browsers[i % browsers.length]} on ${oses[i % oses.length]}`,
                i < 12
            ]);
            pushSubscriptionIds.push(result.rows[0].id);
        }

        // Push notifications
        const notificationTitles = [
            'Deadline Reminder', 'New Message', 'Invoice Paid', 'Court Date Tomorrow',
            'Task Assigned', 'Document Signed', 'Client Portal Activity', 'New Lead',
            'Calendar Update', 'Case Status Changed', 'Payment Received', 'Conflict Alert',
            'Deadline Approaching', 'Meeting in 1 hour', 'Weekly Summary'
        ];

        for (let i = 0; i < 15; i++) {
            await client.query(`
                INSERT INTO push_notifications (user_id, subscription_id, title, body, url, status, sent_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                userIds[i % userIds.length],
                pushSubscriptionIds[i % pushSubscriptionIds.length],
                notificationTitles[i],
                `This is a notification about: ${notificationTitles[i].toLowerCase()}`,
                '/dashboard',
                i % 5 === 0 ? 'clicked' : (i % 3 === 0 ? 'sent' : 'pending'),
                i % 3 !== 2 ? new Date(Date.now() - i * 60 * 60 * 1000) : null
            ]);
        }

        // Offline sync queue
        const entityTypes = ['time_entry', 'task', 'note', 'expense', 'event'];
        const syncActions = ['create', 'update', 'delete'];

        for (let i = 0; i < 15; i++) {
            await client.query(`
                INSERT INTO offline_sync_queue (user_id, action, entity_type, entity_id, payload, status, device_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                userIds[i % userIds.length],
                syncActions[i % syncActions.length],
                entityTypes[i % entityTypes.length],
                crypto.randomUUID(),
                JSON.stringify({ data: 'Sample offline data', timestamp: new Date().toISOString() }),
                i < 10 ? 'synced' : 'pending',
                `device_${crypto.randomBytes(8).toString('hex')}`
            ]);
        }

        console.log('  - Created 15 PWA/mobile records');

        // =====================================================
        // FEATURE 10: DOCUMENT OCR SEED DATA (15+ items)
        // =====================================================
        console.log('Seeding Document OCR data...');

        // OCR jobs
        const fileTypes = ['pdf', 'png', 'jpg', 'tiff'];
        const ocrStatuses = ['completed', 'completed', 'processing', 'completed', 'failed'];
        const ocrJobIds = [];

        for (let i = 0; i < 15; i++) {
            const pageCount = Math.floor(Math.random() * 20) + 1;
            const result = await client.query(`
                INSERT INTO ocr_jobs (user_id, document_id, original_file_path, file_name, file_type, file_size, status, page_count, pages_processed, language)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING id
            `, [
                userId,
                documentIds[i % documentIds.length],
                `/uploads/ocr/document_${i + 1}.${fileTypes[i % fileTypes.length]}`,
                `Scanned Document ${i + 1}.${fileTypes[i % fileTypes.length]}`,
                fileTypes[i % fileTypes.length],
                Math.floor(Math.random() * 5000000) + 100000,
                ocrStatuses[i % ocrStatuses.length],
                pageCount,
                ocrStatuses[i % ocrStatuses.length] === 'completed' ? pageCount : Math.floor(pageCount / 2),
                'eng'
            ]);
            ocrJobIds.push(result.rows[0].id);
        }

        // OCR pages
        const ocrPageIds = [];
        for (let i = 0; i < 15; i++) {
            const result = await client.query(`
                INSERT INTO ocr_pages (job_id, page_number, raw_text, confidence_score, word_count)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id
            `, [
                ocrJobIds[i % ocrJobIds.length],
                (i % 5) + 1,
                `This is the extracted text from page ${(i % 5) + 1} of the scanned document. It contains legal content including party names, dates, and monetary amounts.`,
                85 + Math.random() * 15,
                Math.floor(Math.random() * 500) + 100
            ]);
            ocrPageIds.push(result.rows[0].id);
        }

        // OCR entities
        const entityTypesOcr = ['person', 'organization', 'date', 'money', 'address', 'phone', 'email'];
        const entityValues = [
            { type: 'person', value: 'John Smith', normalized: 'SMITH, JOHN' },
            { type: 'organization', value: 'ABC Corporation', normalized: 'ABC CORPORATION' },
            { type: 'date', value: 'January 15, 2024', normalized: '2024-01-15' },
            { type: 'money', value: '$50,000.00', normalized: '50000.00' },
            { type: 'address', value: '123 Main St, City, ST 12345', normalized: '123 MAIN ST, CITY, ST 12345' },
            { type: 'phone', value: '(555) 123-4567', normalized: '+15551234567' },
            { type: 'email', value: 'contact@example.com', normalized: 'contact@example.com' }
        ];

        for (let i = 0; i < 15; i++) {
            const entity = entityValues[i % entityValues.length];
            await client.query(`
                INSERT INTO ocr_entities (job_id, page_id, entity_type, value, normalized_value, confidence)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                ocrJobIds[i % ocrJobIds.length],
                ocrPageIds[i % ocrPageIds.length],
                entity.type,
                entity.value,
                entity.normalized,
                80 + Math.random() * 20
            ]);
        }

        // OCR search index
        for (let i = 0; i < 15; i++) {
            await client.query(`
                INSERT INTO ocr_search_index (job_id, document_id, full_text)
                VALUES ($1, $2, $3)
            `, [
                ocrJobIds[i % ocrJobIds.length],
                documentIds[i % documentIds.length],
                `Full text content from OCR job ${i + 1}. Contains extracted text from all pages including party names, legal terms, dates, and financial information.`
            ]);
        }

        console.log('  - Created 15 OCR records');

        console.log('\n===========================================');
        console.log('Advanced features seed completed successfully!');
        console.log('===========================================\n');

    } catch (error) {
        console.error('Seed error:', error);
        console.log('\nNote: Some advanced feature tables may not exist yet.');
        console.log('The main application will still work. Run migrations to enable all features.');
    } finally {
        client.release();
        await pool.end();
    }
}

seed().catch(console.error);

/**
 * Seed Shared Data Script for Legal Practice Management System
 * Creates data with user_id = NULL so all users can see it
 * Includes ALL tables for complete demo data
 *
 * Usage: node database/seed-shared.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432
});

// Helper to generate random date within range
function randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Helper to format date for SQL
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

// Helper to format datetime for SQL
function formatDateTime(date) {
    return date.toISOString().replace('T', ' ').substring(0, 19);
}

// Get random item from array
function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// Generate random amount
function randomAmount(min, max) {
    return (Math.random() * (max - min) + min).toFixed(2);
}

async function seedSharedDatabase() {
    const client = await pool.connect();

    try {
        console.log('Starting COMPLETE SHARED database seed (user_id = NULL)...\n');

        // =====================================================
        // ENSURE ALL REQUIRED TABLES AND COLUMNS EXIST
        // =====================================================
        console.log('Ensuring required tables and columns exist...');

        // Add missing columns to users table
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255)`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255)`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50)`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(30)`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255)`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS microsoft_id VARCHAR(255)`);

        // Subscriptions table
        await client.query(`
            CREATE TABLE IF NOT EXISTS subscriptions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                stripe_subscription_id VARCHAR(255),
                stripe_price_id VARCHAR(255),
                plan VARCHAR(50),
                status VARCHAR(30) DEFAULT 'active',
                current_period_start TIMESTAMP,
                current_period_end TIMESTAMP,
                cancel_at_period_end BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Payments table
        await client.query(`
            CREATE TABLE IF NOT EXISTS payments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                invoice_id UUID,
                stripe_payment_intent_id VARCHAR(255),
                amount DECIMAL(10,2),
                description TEXT,
                status VARCHAR(30) DEFAULT 'pending',
                payment_method VARCHAR(50),
                reference_number VARCHAR(100),
                payment_date DATE,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Leads table
        await client.query(`
            CREATE TABLE IF NOT EXISTS leads (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                form_id UUID,
                first_name VARCHAR(100),
                last_name VARCHAR(100),
                email VARCHAR(255),
                phone VARCHAR(50),
                company VARCHAR(200),
                practice_area VARCHAR(100),
                case_description TEXT,
                form_data JSONB,
                source VARCHAR(100),
                utm_source VARCHAR(100),
                utm_medium VARCHAR(100),
                utm_campaign VARCHAR(100),
                ip_address VARCHAR(45),
                status VARCHAR(30) DEFAULT 'new',
                assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
                converted_to_client_id UUID,
                notes TEXT,
                priority VARCHAR(20) DEFAULT 'medium',
                follow_up_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Messages table
        await client.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                client_id UUID,
                case_id UUID,
                subject VARCHAR(255),
                content TEXT,
                message_type VARCHAR(30) DEFAULT 'internal',
                is_read BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Deadlines table
        await client.query(`
            CREATE TABLE IF NOT EXISTS deadlines (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                case_id UUID,
                title VARCHAR(255),
                description TEXT,
                deadline_type VARCHAR(50),
                due_date DATE,
                warning_days INTEGER DEFAULT 7,
                is_critical BOOLEAN DEFAULT false,
                status VARCHAR(30) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Expenses table
        await client.query(`
            CREATE TABLE IF NOT EXISTS expenses (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                case_id UUID,
                client_id UUID,
                description TEXT,
                amount DECIMAL(10,2),
                expense_date DATE,
                category VARCHAR(50),
                is_billable BOOLEAN DEFAULT true,
                is_billed BOOLEAN DEFAULT false,
                vendor VARCHAR(255),
                receipt_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Conflict parties table (stores all parties to check against)
        await client.query(`
            CREATE TABLE IF NOT EXISTS conflict_parties (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                party_type VARCHAR(50) NOT NULL,
                name VARCHAR(300) NOT NULL,
                aliases JSONB DEFAULT '[]',
                email VARCHAR(255),
                phone VARCHAR(50),
                company VARCHAR(200),
                address TEXT,
                identifiers JSONB DEFAULT '{}',
                case_id UUID,
                client_id UUID,
                relationship VARCHAR(100),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Conflict checks table (stores conflict check records)
        await client.query(`
            CREATE TABLE IF NOT EXISTS conflict_checks (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                check_type VARCHAR(50) DEFAULT 'new_matter',
                search_terms JSONB NOT NULL,
                status VARCHAR(30) DEFAULT 'pending',
                results JSONB,
                conflict_count INTEGER DEFAULT 0,
                checked_by UUID,
                reviewed_by UUID,
                reviewed_at TIMESTAMP,
                waiver_obtained BOOLEAN DEFAULT false,
                waiver_notes TEXT,
                case_id UUID,
                client_id UUID,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Trust accounts table (IOLTA)
        await client.query(`
            CREATE TABLE IF NOT EXISTS trust_accounts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                account_name VARCHAR(200) NOT NULL,
                bank_name VARCHAR(200) NOT NULL,
                account_number_last4 VARCHAR(4),
                routing_number_last4 VARCHAR(4),
                account_type VARCHAR(50) DEFAULT 'iolta',
                current_balance DECIMAL(12,2) DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Client trust ledgers table (per-client trust balances)
        await client.query(`
            CREATE TABLE IF NOT EXISTS client_trust_ledgers (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                trust_account_id UUID REFERENCES trust_accounts(id) ON DELETE CASCADE,
                client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
                case_id UUID,
                current_balance DECIMAL(12,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(trust_account_id, client_id, case_id)
            )
        `);

        // Trust transactions table
        await client.query(`
            CREATE TABLE IF NOT EXISTS trust_transactions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                trust_account_id UUID REFERENCES trust_accounts(id) ON DELETE CASCADE,
                client_trust_ledger_id UUID REFERENCES client_trust_ledgers(id) ON DELETE CASCADE,
                transaction_type VARCHAR(50) NOT NULL,
                amount DECIMAL(12,2) NOT NULL,
                balance_after DECIMAL(12,2) NOT NULL,
                description TEXT NOT NULL,
                reference_number VARCHAR(100),
                check_number VARCHAR(50),
                payee VARCHAR(200),
                invoice_id UUID,
                reconciled BOOLEAN DEFAULT false,
                reconciled_at TIMESTAMP,
                reconciled_by UUID,
                created_by UUID,
                transaction_date DATE DEFAULT CURRENT_DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Documents table
        await client.query(`
            CREATE TABLE IF NOT EXISTS documents (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                case_id UUID,
                client_id UUID,
                title VARCHAR(255),
                description TEXT,
                file_name VARCHAR(255),
                file_path TEXT,
                file_type VARCHAR(100),
                file_size INTEGER,
                category VARCHAR(50),
                status VARCHAR(30) DEFAULT 'draft',
                version INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Document history table
        await client.query(`
            CREATE TABLE IF NOT EXISTS document_history (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                case_id UUID,
                client_id UUID,
                title VARCHAR(255),
                description TEXT,
                file_name VARCHAR(255),
                file_path TEXT,
                file_type VARCHAR(100),
                file_size INTEGER,
                category VARCHAR(50),
                document_type VARCHAR(100),
                specific_type VARCHAR(100),
                status VARCHAR(30) DEFAULT 'draft',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Calendar sync table (old)
        await client.query(`
            CREATE TABLE IF NOT EXISTS calendar_syncs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                provider VARCHAR(50),
                external_calendar_id VARCHAR(255),
                access_token TEXT,
                refresh_token TEXT,
                token_expires_at TIMESTAMP,
                sync_enabled BOOLEAN DEFAULT true,
                last_sync_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Calendar connections table (used by routes)
        await client.query(`
            CREATE TABLE IF NOT EXISTS calendar_connections (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                provider VARCHAR(50) NOT NULL,
                provider_account_id VARCHAR(255),
                provider_email VARCHAR(255),
                access_token TEXT,
                refresh_token TEXT,
                token_expires_at TIMESTAMP,
                calendar_id VARCHAR(255),
                sync_direction VARCHAR(20) DEFAULT 'both',
                last_sync_at TIMESTAMP,
                sync_status VARCHAR(30) DEFAULT 'active',
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Calendar sync log table
        await client.query(`
            CREATE TABLE IF NOT EXISTS calendar_sync_log (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                connection_id UUID,
                sync_type VARCHAR(30),
                events_created INTEGER DEFAULT 0,
                events_updated INTEGER DEFAULT 0,
                events_deleted INTEGER DEFAULT 0,
                errors JSONB,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                status VARCHAR(30) DEFAULT 'completed'
            )
        `);

        // Conflict waivers table
        await client.query(`
            CREATE TABLE IF NOT EXISTS conflict_waivers (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                conflict_check_id UUID,
                waiver_type VARCHAR(50),
                parties_involved JSONB,
                waiver_text TEXT,
                obtained_from VARCHAR(200),
                obtained_date DATE,
                document_path VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Online payments table (Stripe payments)
        await client.query(`
            CREATE TABLE IF NOT EXISTS online_payments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                invoice_id UUID,
                client_id UUID,
                stripe_payment_intent_id VARCHAR(255),
                stripe_charge_id VARCHAR(255),
                amount DECIMAL(10,2) NOT NULL,
                currency VARCHAR(3) DEFAULT 'usd',
                status VARCHAR(50) DEFAULT 'succeeded',
                payment_method_id UUID,
                fee_amount DECIMAL(10,2) DEFAULT 0,
                net_amount DECIMAL(10,2),
                failure_reason TEXT,
                receipt_url VARCHAR(500),
                metadata JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Payment links table
        await client.query(`
            CREATE TABLE IF NOT EXISTS payment_links (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                invoice_id UUID,
                token VARCHAR(100) UNIQUE NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                is_active BOOLEAN DEFAULT true,
                expires_at TIMESTAMP,
                viewed_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Document summaries table (used by document-summary route)
        await client.query(`
            CREATE TABLE IF NOT EXISTS document_summaries (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID,
                case_id UUID,
                client_id UUID,
                title VARCHAR(300),
                original_text TEXT,
                summary TEXT,
                key_points JSONB,
                document_type VARCHAR(100),
                word_count INTEGER,
                case_note_id UUID,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // OCR jobs table (used by /ocr route)
        await client.query(`
            CREATE TABLE IF NOT EXISTS ocr_jobs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID,
                document_id UUID,
                original_file_path VARCHAR(500) NOT NULL,
                file_name VARCHAR(255),
                file_type VARCHAR(50),
                file_size INTEGER,
                status VARCHAR(30) DEFAULT 'completed',
                progress INTEGER DEFAULT 100,
                page_count INTEGER,
                pages_processed INTEGER,
                language VARCHAR(10) DEFAULT 'eng',
                processing_started_at TIMESTAMP,
                processing_completed_at TIMESTAMP,
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // OCR pages table
        await client.query(`
            CREATE TABLE IF NOT EXISTS ocr_pages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                job_id UUID,
                page_number INTEGER NOT NULL,
                raw_text TEXT,
                confidence_score DECIMAL(5,2),
                word_count INTEGER,
                bounding_boxes JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Client document access table (for client portal)
        await client.query(`
            CREATE TABLE IF NOT EXISTS client_document_access (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                client_id UUID,
                document_id UUID,
                granted_by UUID,
                access_type VARCHAR(20) DEFAULT 'view',
                granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP
            )
        `);

        // Case documents table (links documents to cases)
        await client.query(`
            CREATE TABLE IF NOT EXISTS case_documents (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                case_id UUID,
                document_id UUID,
                added_by UUID,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // AI Draft Templates table
        await client.query(`
            CREATE TABLE IF NOT EXISTS ai_draft_templates (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID,
                name VARCHAR(200) NOT NULL,
                description TEXT,
                category VARCHAR(100),
                document_type VARCHAR(100),
                prompt_template TEXT NOT NULL,
                variables JSONB DEFAULT '[]',
                example_output TEXT,
                is_public BOOLEAN DEFAULT false,
                usage_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // AI Draft Sessions table
        await client.query(`
            CREATE TABLE IF NOT EXISTS ai_draft_sessions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID,
                template_id UUID,
                case_id UUID,
                client_id UUID,
                title VARCHAR(300),
                input_data JSONB,
                status VARCHAR(30) DEFAULT 'completed',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // AI Draft Versions table
        await client.query(`
            CREATE TABLE IF NOT EXISTS ai_draft_versions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                session_id UUID,
                version_number INTEGER NOT NULL,
                content TEXT NOT NULL,
                prompt_used TEXT,
                model_used VARCHAR(100),
                tokens_used INTEGER,
                generation_time_ms INTEGER,
                feedback VARCHAR(50),
                feedback_notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Contract Analysis table
        await client.query(`
            CREATE TABLE IF NOT EXISTS contract_analysis (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID,
                case_id UUID,
                client_id UUID,
                title VARCHAR(300),
                file_name VARCHAR(255),
                file_path TEXT,
                contract_type VARCHAR(100),
                status VARCHAR(30) DEFAULT 'completed',
                overall_risk_score DECIMAL(5,2),
                risk_level VARCHAR(20),
                key_terms JSONB,
                risk_factors JSONB,
                recommendations JSONB,
                summary TEXT,
                parties JSONB,
                dates JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Citation Searches table
        await client.query(`
            CREATE TABLE IF NOT EXISTS citation_searches (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID,
                case_id UUID,
                query TEXT NOT NULL,
                jurisdiction VARCHAR(100),
                practice_area VARCHAR(100),
                date_range VARCHAR(50),
                results JSONB,
                result_count INTEGER DEFAULT 0,
                status VARCHAR(30) DEFAULT 'completed',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('  All tables verified/created\n');

        const now = new Date();
        const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
        const threeMonthsFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
        const priorities = ['low', 'medium', 'high', 'urgent'];

        // =====================================================
        // SEED CLIENTS (20 clients)
        // =====================================================
        console.log('Seeding clients (shared)...');

        const individualClients = [
            { first_name: 'Michael', last_name: 'Johnson', email: 'mjohnson@email.com', phone: '555-234-5678', city: 'Los Angeles', state: 'CA' },
            { first_name: 'Sarah', last_name: 'Williams', email: 'swilliams@email.com', phone: '555-345-6789', city: 'San Francisco', state: 'CA' },
            { first_name: 'Robert', last_name: 'Brown', email: 'rbrown@email.com', phone: '555-456-7890', city: 'San Diego', state: 'CA' },
            { first_name: 'Jennifer', last_name: 'Davis', email: 'jdavis@email.com', phone: '555-567-8901', city: 'Sacramento', state: 'CA' },
            { first_name: 'David', last_name: 'Miller', email: 'dmiller@email.com', phone: '555-678-9012', city: 'Oakland', state: 'CA' },
            { first_name: 'Emily', last_name: 'Wilson', email: 'ewilson@email.com', phone: '555-789-0123', city: 'San Jose', state: 'CA' },
            { first_name: 'James', last_name: 'Taylor', email: 'jtaylor@email.com', phone: '555-890-1234', city: 'Fresno', state: 'CA' },
            { first_name: 'Amanda', last_name: 'Anderson', email: 'aanderson@email.com', phone: '555-901-2345', city: 'Long Beach', state: 'CA' },
            { first_name: 'Christopher', last_name: 'Thomas', email: 'cthomas@email.com', phone: '555-012-3456', city: 'Bakersfield', state: 'CA' },
            { first_name: 'Jessica', last_name: 'Martinez', email: 'jmartinez@email.com', phone: '555-123-4568', city: 'Anaheim', state: 'CA' },
            { first_name: 'Daniel', last_name: 'Garcia', email: 'dgarcia@email.com', phone: '555-234-5679', city: 'Santa Ana', state: 'CA' },
            { first_name: 'Ashley', last_name: 'Robinson', email: 'arobinson@email.com', phone: '555-345-6780', city: 'Riverside', state: 'CA' },
            { first_name: 'Matthew', last_name: 'Clark', email: 'mclark@email.com', phone: '555-456-7891', city: 'Stockton', state: 'CA' },
            { first_name: 'Stephanie', last_name: 'Lewis', email: 'slewis@email.com', phone: '555-567-8902', city: 'Irvine', state: 'CA' },
            { first_name: 'Andrew', last_name: 'Lee', email: 'alee@email.com', phone: '555-678-9013', city: 'Chula Vista', state: 'CA' }
        ];

        const businessClients = [
            { company_name: 'TechStart Solutions Inc.', email: 'legal@techstart.com', phone: '555-111-2222', city: 'Palo Alto', state: 'CA' },
            { company_name: 'Green Valley Properties LLC', email: 'info@greenvalley.com', phone: '555-222-3333', city: 'Beverly Hills', state: 'CA' },
            { company_name: 'Pacific Coast Restaurants Group', email: 'admin@pcrestaurants.com', phone: '555-333-4444', city: 'Santa Monica', state: 'CA' },
            { company_name: 'Sunrise Healthcare Partners', email: 'contact@sunrisehealth.com', phone: '555-444-5555', city: 'Pasadena', state: 'CA' },
            { company_name: 'Golden State Manufacturing Co.', email: 'legal@gsmfg.com', phone: '555-555-6666', city: 'Torrance', state: 'CA' }
        ];

        const clientIds = [];

        for (const c of individualClients) {
            const result = await client.query(`
                INSERT INTO clients (user_id, client_type, first_name, last_name, email, phone, address, city, state, zip, status)
                VALUES (NULL, 'individual', $1, $2, $3, $4, $5, $6, $7, '90001', 'active')
                RETURNING id
            `, [c.first_name, c.last_name, c.email, c.phone, `${Math.floor(Math.random() * 9999) + 100} Main Street`, c.city, c.state]);
            clientIds.push(result.rows[0].id);
        }

        for (const c of businessClients) {
            const result = await client.query(`
                INSERT INTO clients (user_id, client_type, company_name, email, phone, address, city, state, zip, status)
                VALUES (NULL, 'business', $1, $2, $3, $4, $5, $6, '90001', 'active')
                RETURNING id
            `, [c.company_name, c.email, c.phone, `${Math.floor(Math.random() * 9999) + 100} Business Blvd`, c.city, c.state]);
            clientIds.push(result.rows[0].id);
        }

        console.log(`  Created ${clientIds.length} shared clients`);

        // =====================================================
        // SEED CASES (20 cases)
        // =====================================================
        console.log('\nSeeding cases (shared)...');

        const caseTypes = ['litigation', 'corporate', 'family', 'estate', 'real_estate', 'employment', 'criminal'];
        const caseStatuses = ['open', 'pending', 'closed'];
        const billingTypes = ['hourly', 'flat', 'contingency'];

        const caseTitles = [
            'Smith v. ABC Corporation - Employment Discrimination',
            'Estate of Margaret Thompson - Probate Administration',
            'Johnson Family Trust Amendment',
            'Pacific Properties LLC Formation',
            'Martinez Divorce Proceedings',
            'Tech Innovations Patent Dispute',
            'Green Valley HOA Dispute',
            'Williams Personal Injury Claim',
            'Corporate Merger - TechStart & DataCo',
            'Child Custody Modification - Davis',
            'Commercial Lease Negotiation - Restaurant Group',
            'Wrongful Termination - Anderson v. Corp',
            'Real Estate Purchase - 123 Oak Street',
            'Business Partnership Dissolution',
            'DUI Defense - State v. Miller',
            'Trademark Registration - Sunrise Healthcare',
            'Contract Dispute - Manufacturing Agreement',
            'Slip and Fall - Garcia v. Mall Corp',
            'Immigration Visa Application - Lee Family',
            'Insurance Bad Faith Claim'
        ];

        const caseIds = [];

        for (let i = 0; i < 20; i++) {
            const dateOpened = randomDate(sixMonthsAgo, now);
            const status = randomItem(caseStatuses);
            const result = await client.query(`
                INSERT INTO cases (
                    user_id, client_id, case_number, title, description, case_type, status, priority,
                    court_name, court_case_number, judge_name, opposing_party, opposing_counsel,
                    date_opened, date_closed, statute_of_limitations, billing_type, billing_rate, notes
                )
                VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
                RETURNING id
            `, [
                clientIds[i % clientIds.length],
                `CASE-2024-${String(i + 1).padStart(4, '0')}`,
                caseTitles[i],
                `Case description for ${caseTitles[i]}. This matter involves various legal issues requiring attention.`,
                randomItem(caseTypes),
                status,
                randomItem(priorities),
                i % 3 === 0 ? 'Superior Court of California' : null,
                i % 3 === 0 ? `CV-${2024}-${Math.floor(Math.random() * 99999)}` : null,
                i % 3 === 0 ? `Hon. ${randomItem(['Smith', 'Johnson', 'Williams', 'Brown', 'Davis'])}` : null,
                i % 2 === 0 ? `Opposing Party ${i + 1}` : null,
                i % 2 === 0 ? `Law Firm ${i + 1} LLP` : null,
                formatDate(dateOpened),
                status === 'closed' ? formatDate(new Date()) : null,
                i % 4 === 0 ? formatDate(randomDate(now, oneYearFromNow)) : null,
                randomItem(billingTypes),
                randomAmount(150, 500),
                'Case notes and important information.'
            ]);
            caseIds.push(result.rows[0].id);
        }

        console.log(`  Created ${caseIds.length} shared cases`);

        // =====================================================
        // SEED TIME ENTRIES (25 entries)
        // =====================================================
        console.log('\nSeeding time entries (shared)...');

        const activityTypes = ['research', 'drafting', 'court', 'meeting', 'call', 'travel', 'review', 'filing'];
        const timeDescriptions = [
            'Legal research on relevant case law',
            'Draft motion for summary judgment',
            'Court appearance for status conference',
            'Client meeting to discuss case strategy',
            'Phone call with opposing counsel',
            'Travel to courthouse',
            'Review discovery documents',
            'File documents with court clerk',
            'Prepare deposition outline',
            'Review and respond to emails',
            'Draft settlement agreement',
            'Attend mediation session',
            'Prepare witness list',
            'Review contract terms',
            'Client intake meeting'
        ];

        for (let i = 0; i < 25; i++) {
            const duration = Math.floor(Math.random() * 480) + 15;
            const rate = parseFloat(randomAmount(150, 450));
            const amount = (duration / 60 * rate).toFixed(2);
            const entryDate = randomDate(sixMonthsAgo, now);

            await client.query(`
                INSERT INTO time_entries (
                    user_id, case_id, client_id, description, duration_minutes, hourly_rate,
                    amount, date, is_billable, is_billed, activity_type
                )
                VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [
                caseIds[i % caseIds.length],
                clientIds[i % clientIds.length],
                randomItem(timeDescriptions),
                duration,
                rate,
                amount,
                formatDate(entryDate),
                Math.random() > 0.1,
                Math.random() > 0.7,
                randomItem(activityTypes)
            ]);
        }

        console.log('  Created 25 shared time entries');

        // =====================================================
        // SEED EXPENSES (20 expenses)
        // =====================================================
        console.log('\nSeeding expenses (shared)...');

        // Add missing columns to expenses table
        await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS user_id UUID`);
        await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS case_id UUID`);
        await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS client_id UUID`);
        await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS description TEXT`);
        await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2)`);
        await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_date DATE`);
        await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category VARCHAR(50)`);
        await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_billable BOOLEAN DEFAULT true`);
        await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vendor VARCHAR(255)`);

        const expenseCategories = ['filing_fee', 'travel', 'copies', 'expert', 'postage', 'court_reporter', 'other'];
        const expenseDescriptions = [
            'Court filing fee',
            'Travel to client meeting',
            'Document copying charges',
            'Expert witness consultation',
            'Certified mail postage',
            'Deposition transcript',
            'Parking at courthouse',
            'Process server fees',
            'Background check service',
            'Research database subscription',
            'Courier service',
            'Notary fees',
            'Document translation',
            'Medical records request',
            'Conference room rental'
        ];

        for (let i = 0; i < 20; i++) {
            await client.query(`
                INSERT INTO expenses (
                    user_id, case_id, client_id, description, amount, expense_date,
                    category, is_billable, vendor
                )
                VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                caseIds[i % caseIds.length],
                clientIds[i % clientIds.length],
                expenseDescriptions[i % expenseDescriptions.length],
                randomAmount(25, 2500),
                formatDate(randomDate(sixMonthsAgo, now)),
                randomItem(expenseCategories),
                Math.random() > 0.2,
                `Vendor ${i + 1}`
            ]);
        }

        console.log('  Created 20 shared expenses');

        // =====================================================
        // SEED INVOICES (15 invoices)
        // =====================================================
        console.log('\nSeeding invoices (shared)...');

        const invoiceStatuses = ['draft', 'sent', 'paid', 'overdue'];
        const invoiceIds = [];

        for (let i = 0; i < 15; i++) {
            const subtotal = parseFloat(randomAmount(500, 15000));
            const taxRate = 0;
            const taxAmount = subtotal * taxRate / 100;
            const total = subtotal + taxAmount;
            const status = randomItem(invoiceStatuses);
            const amountPaid = status === 'paid' ? total : (status === 'sent' ? 0 : parseFloat(randomAmount(0, total)));
            const createdDate = randomDate(sixMonthsAgo, now);
            const dueDate = new Date(createdDate.getTime() + 30 * 24 * 60 * 60 * 1000);

            const result = await client.query(`
                INSERT INTO invoices (
                    user_id, client_id, case_id, invoice_number, status,
                    subtotal, tax_rate, tax_amount, total, amount_paid,
                    due_date, paid_date, notes
                )
                VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING id
            `, [
                clientIds[i % clientIds.length],
                caseIds[i % caseIds.length],
                `INV-2024-${String(i + 1).padStart(4, '0')}`,
                status,
                subtotal,
                taxRate,
                taxAmount,
                total,
                amountPaid,
                formatDate(dueDate),
                status === 'paid' ? formatDate(randomDate(createdDate, now)) : null,
                'Thank you for your business.'
            ]);
            invoiceIds.push(result.rows[0].id);
        }

        console.log(`  Created ${invoiceIds.length} shared invoices`);

        // =====================================================
        // SEED PAYMENTS (15 payments)
        // =====================================================
        console.log('\nSeeding payments (shared)...');

        const paymentMethods = ['credit_card', 'check', 'wire', 'cash', 'ach'];

        // Add missing columns to payments table if they don't exist
        await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS user_id UUID`);
        await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'completed'`);
        await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT`);
        await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100)`);
        await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_date DATE`);

        for (let i = 0; i < 15; i++) {
            await client.query(`
                INSERT INTO payments (
                    invoice_id, amount, payment_method, reference_number, payment_date, status, notes
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                invoiceIds[i % invoiceIds.length],
                randomAmount(500, 5000),
                randomItem(paymentMethods),
                `REF-${Math.floor(Math.random() * 1000000)}`,
                formatDate(randomDate(sixMonthsAgo, now)),
                'completed',
                'Payment received with thanks.'
            ]);
        }

        console.log('  Created 15 shared payments');

        // =====================================================
        // SEED CALENDAR EVENTS (20 events)
        // =====================================================
        console.log('\nSeeding calendar events (shared)...');

        const eventTypes = ['hearing', 'deadline', 'meeting', 'task', 'reminder', 'deposition', 'mediation'];
        const eventColors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#43e97b'];
        const eventTitles = [
            'Motion Hearing', 'Client Meeting', 'Deposition of Plaintiff', 'Settlement Conference',
            'Discovery Deadline', 'Trial Preparation Meeting', 'Mediation Session', 'Status Conference',
            'Document Review Deadline', 'Expert Witness Meeting', 'Pretrial Conference', 'Filing Deadline',
            'Client Phone Call', 'Team Strategy Meeting', 'Court Appearance', 'Contract Signing',
            'Closing Meeting', 'Initial Consultation', 'Arbitration Hearing', 'Appeals Deadline'
        ];

        for (let i = 0; i < 20; i++) {
            const startTime = randomDate(now, threeMonthsFromNow);
            const endTime = new Date(startTime.getTime() + (Math.random() * 3 + 1) * 60 * 60 * 1000);

            await client.query(`
                INSERT INTO calendar_events (
                    user_id, case_id, client_id, title, description, event_type,
                    location, start_time, end_time, all_day, reminder_minutes, status, color
                )
                VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `, [
                caseIds[i % caseIds.length],
                clientIds[i % clientIds.length],
                eventTitles[i],
                `Details for ${eventTitles[i]}. Please prepare all necessary documents.`,
                randomItem(eventTypes),
                i % 2 === 0 ? 'Conference Room A' : 'Courthouse Room 302',
                formatDateTime(startTime),
                formatDateTime(endTime),
                false,
                randomItem([15, 30, 60, 120, 1440]),
                'scheduled',
                randomItem(eventColors)
            ]);
        }

        console.log('  Created 20 shared calendar events');

        // =====================================================
        // SEED DEADLINES (15 deadlines)
        // =====================================================
        console.log('\nSeeding deadlines (shared)...');

        // Add missing columns to deadlines table
        await client.query(`ALTER TABLE deadlines ADD COLUMN IF NOT EXISTS user_id UUID`);
        await client.query(`ALTER TABLE deadlines ADD COLUMN IF NOT EXISTS case_id UUID`);
        await client.query(`ALTER TABLE deadlines ADD COLUMN IF NOT EXISTS title VARCHAR(255)`);
        await client.query(`ALTER TABLE deadlines ADD COLUMN IF NOT EXISTS description TEXT`);
        await client.query(`ALTER TABLE deadlines ADD COLUMN IF NOT EXISTS deadline_type VARCHAR(50)`);
        await client.query(`ALTER TABLE deadlines ADD COLUMN IF NOT EXISTS due_date DATE`);
        await client.query(`ALTER TABLE deadlines ADD COLUMN IF NOT EXISTS warning_days INTEGER DEFAULT 7`);
        await client.query(`ALTER TABLE deadlines ADD COLUMN IF NOT EXISTS is_critical BOOLEAN DEFAULT false`);
        await client.query(`ALTER TABLE deadlines ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'pending'`);

        const deadlineTypes = ['statute_of_limitations', 'filing', 'discovery', 'response', 'appeal', 'motion'];
        const deadlineTitles = [
            'Statute of Limitations - Personal Injury',
            'Discovery Response Deadline',
            'Motion to Dismiss Due',
            'Expert Disclosure Deadline',
            'Appeal Filing Deadline',
            'Answer to Complaint Due',
            'Interrogatory Responses Due',
            'Document Production Deadline',
            'Pretrial Brief Due',
            'Settlement Demand Response',
            'Arbitration Demand Deadline',
            'EEOC Filing Deadline',
            'Contract Option Exercise',
            'Insurance Claim Deadline',
            'Mediation Brief Due'
        ];

        for (let i = 0; i < 15; i++) {
            const dueDate = randomDate(now, oneYearFromNow);
            await client.query(`
                INSERT INTO deadlines (
                    user_id, case_id, title, description, deadline_type,
                    due_date, warning_days, is_critical, status
                )
                VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                caseIds[i % caseIds.length],
                deadlineTitles[i],
                `Critical deadline: ${deadlineTitles[i]}. Mark calendar and set reminders.`,
                randomItem(deadlineTypes),
                formatDate(dueDate),
                randomItem([7, 14, 30, 60]),
                Math.random() > 0.6,
                'pending'
            ]);
        }

        console.log('  Created 15 shared deadlines');

        // =====================================================
        // SEED TASKS (20 tasks)
        // =====================================================
        console.log('\nSeeding tasks (shared)...');

        const taskTitles = [
            'Review and sign retainer agreement', 'Prepare discovery requests', 'Schedule client meeting',
            'File motion with court', 'Research case law precedents', 'Draft settlement proposal',
            'Organize case documents', 'Prepare witness list', 'Review opposing counsel motion',
            'Update case timeline', 'Coordinate expert witness', 'Prepare trial exhibits',
            'Send client status update', 'Review billing entries', 'Complete conflict check',
            'Draft correspondence to court', 'Prepare closing documents', 'Schedule depositions',
            'Review contract amendments', 'Finalize settlement agreement'
        ];
        const taskStatuses = ['pending', 'in_progress', 'completed'];

        for (let i = 0; i < 20; i++) {
            const status = randomItem(taskStatuses);
            await client.query(`
                INSERT INTO tasks (
                    user_id, case_id, assigned_to, title, description,
                    priority, due_date, status, completed_at
                )
                VALUES (NULL, $1, NULL, $2, $3, $4, $5, $6, $7)
            `, [
                caseIds[i % caseIds.length],
                taskTitles[i],
                `Task details: ${taskTitles[i]}. Complete as soon as possible.`,
                randomItem(priorities),
                formatDate(randomDate(now, threeMonthsFromNow)),
                status,
                status === 'completed' ? formatDateTime(new Date()) : null
            ]);
        }

        console.log('  Created 20 shared tasks');

        // =====================================================
        // SEED CONFLICT PARTIES (20 parties)
        // =====================================================
        console.log('\nSeeding conflict parties (shared)...');

        const partyTypes = ['individual', 'business', 'opposing_party', 'witness', 'related_party'];
        const relationships = ['client', 'opposing', 'co-counsel', 'witness', 'expert'];
        const partyNames = [
            'ABC Corporation', 'John Doe', 'XYZ LLC', 'Jane Smith', 'Acme Industries',
            'Global Tech Inc.', 'Robert Johnson', 'Smith & Associates', 'Pacific Holdings LLC',
            'Mary Williams', 'Tech Startup Inc.', 'David Brown', 'Legal Services Corp.',
            'Emily Davis', 'First National Bank', 'Michael Wilson', 'Healthcare Partners LLC',
            'Sarah Thompson', 'Construction Co. Inc.', 'James Anderson'
        ];

        for (let i = 0; i < 20; i++) {
            await client.query(`
                INSERT INTO conflict_parties (
                    user_id, party_type, name, email, phone, company,
                    case_id, client_id, relationship, notes
                )
                VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                randomItem(partyTypes),
                partyNames[i],
                `${partyNames[i].toLowerCase().replace(/[^a-z]/g, '')}@email.com`,
                `555-${String(100 + i).padStart(3, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
                i % 2 === 0 ? partyNames[i] : null,
                caseIds[i % caseIds.length],
                clientIds[i % clientIds.length],
                randomItem(relationships),
                'Party added for conflict checking purposes.'
            ]);
        }

        console.log('  Created 20 shared conflict parties');

        // =====================================================
        // SEED CONFLICT CHECKS (15 checks)
        // =====================================================
        console.log('\nSeeding conflict checks (shared)...');

        const checkTypes = ['new_matter', 'new_client', 'periodic'];
        const conflictStatuses = ['pending', 'clear', 'conflict_found', 'waived'];

        for (let i = 0; i < 15; i++) {
            const searchTerms = [
                partyNames[i % partyNames.length],
                partyNames[(i + 1) % partyNames.length]
            ];
            const status = randomItem(conflictStatuses);
            const conflictCount = status === 'conflict_found' ? Math.floor(Math.random() * 3) + 1 : 0;

            await client.query(`
                INSERT INTO conflict_checks (
                    user_id, check_type, search_terms, status, results,
                    conflict_count, waiver_obtained, waiver_notes, case_id, client_id
                )
                VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                randomItem(checkTypes),
                JSON.stringify(searchTerms),
                status,
                JSON.stringify({ matches: conflictCount > 0 ? searchTerms.slice(0, conflictCount) : [] }),
                conflictCount,
                status === 'waived',
                status === 'waived' ? 'Client provided written waiver of conflict' : null,
                caseIds[i % caseIds.length],
                clientIds[i % clientIds.length]
            ]);
        }

        console.log('  Created 15 shared conflict checks');

        // =====================================================
        // SEED TRUST ACCOUNTS (10 accounts) - Using actual schema
        // =====================================================
        console.log('\nSeeding trust accounts (shared)...');

        const trustAccountIds = [];
        const bankNames = ['First National Bank', 'City Trust Bank', 'Pacific Federal', 'State Credit Union'];

        for (let i = 0; i < 10; i++) {
            const balance = parseFloat(randomAmount(1000, 50000));
            const result = await client.query(`
                INSERT INTO trust_accounts (
                    user_id, account_name, bank_name, account_number_last4, account_type, current_balance, is_active
                )
                VALUES (NULL, $1, $2, $3, $4, $5, $6)
                RETURNING id
            `, [
                `IOLTA Account ${i + 1}`,
                randomItem(bankNames),
                String(1000 + i).slice(-4),
                'iolta',
                balance,
                true
            ]);
            trustAccountIds.push({ id: result.rows[0].id, balance });
        }

        console.log(`  Created ${trustAccountIds.length} shared trust accounts`);

        // =====================================================
        // SEED CLIENT TRUST LEDGERS (one per client/account combo)
        // =====================================================
        console.log('\nSeeding client trust ledgers (shared)...');

        const clientTrustLedgerIds = [];

        for (let i = 0; i < 15; i++) {
            const balance = parseFloat(randomAmount(500, 25000));
            const result = await client.query(`
                INSERT INTO client_trust_ledgers (
                    trust_account_id, client_id, case_id, current_balance
                )
                VALUES ($1, $2, $3, $4)
                ON CONFLICT DO NOTHING
                RETURNING id
            `, [
                trustAccountIds[i % trustAccountIds.length].id,
                clientIds[i % clientIds.length],
                caseIds[i % caseIds.length],
                balance
            ]);
            if (result.rows.length > 0) {
                clientTrustLedgerIds.push({ id: result.rows[0].id, balance });
            }
        }

        console.log(`  Created ${clientTrustLedgerIds.length} shared client trust ledgers`);

        // =====================================================
        // SEED TRUST TRANSACTIONS (20 transactions) - Using actual schema
        // =====================================================
        console.log('\nSeeding trust transactions (shared)...');

        const transactionTypes = ['deposit', 'withdrawal', 'transfer', 'fee'];

        for (let i = 0; i < 20 && clientTrustLedgerIds.length > 0; i++) {
            const ledger = clientTrustLedgerIds[i % clientTrustLedgerIds.length];
            const account = trustAccountIds[i % trustAccountIds.length];
            const type = randomItem(transactionTypes);
            const amount = parseFloat(randomAmount(100, 5000));

            await client.query(`
                INSERT INTO trust_transactions (
                    trust_account_id, client_trust_ledger_id, transaction_type, amount,
                    balance_after, description, reference_number, transaction_date
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                account.id,
                ledger.id,
                type,
                amount,
                ledger.balance + (type === 'deposit' ? amount : -amount),
                `${type.charAt(0).toUpperCase() + type.slice(1)} - ${randomItem(['Retainer', 'Settlement', 'Expenses', 'Court fees'])}`,
                `TXN-${Math.floor(Math.random() * 1000000)}`,
                formatDate(randomDate(sixMonthsAgo, now))
            ]);
        }

        console.log('  Created 20 shared trust transactions');

        // =====================================================
        // SEED DOCUMENTS (20 documents)
        // =====================================================
        console.log('\nSeeding documents (shared)...');

        // Add missing columns to documents table
        await client.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS user_id UUID`);
        await client.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS case_id UUID`);
        await client.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS client_id UUID`);
        await client.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS title VARCHAR(255)`);
        await client.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS description TEXT`);
        await client.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_name VARCHAR(255)`);
        await client.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_path TEXT`);
        await client.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_type VARCHAR(100)`);
        await client.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size INTEGER`);
        await client.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS category VARCHAR(50)`);
        await client.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'draft'`);
        await client.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1`);

        const documentCategories = ['pleading', 'correspondence', 'discovery', 'contract', 'evidence', 'research'];
        const documentTitles = [
            'Complaint', 'Answer to Complaint', 'Motion for Summary Judgment', 'Discovery Request',
            'Interrogatories', 'Deposition Transcript', 'Settlement Agreement', 'Retainer Agreement',
            'Client Intake Form', 'Power of Attorney', 'Will and Testament', 'Trust Document',
            'Lease Agreement', 'Employment Contract', 'Non-Disclosure Agreement', 'Demand Letter',
            'Court Order', 'Judgment', 'Appeal Brief', 'Expert Report'
        ];

        for (let i = 0; i < 20; i++) {
            await client.query(`
                INSERT INTO documents (
                    user_id, case_id, client_id, title, description,
                    file_name, file_path, file_type, file_size, category, status, version
                )
                VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `, [
                caseIds[i % caseIds.length],
                clientIds[i % clientIds.length],
                documentTitles[i],
                `${documentTitles[i]} for case ${caseIds[i % caseIds.length].substring(0, 8)}`,
                `${documentTitles[i].toLowerCase().replace(/ /g, '_')}.pdf`,
                `/uploads/documents/${documentTitles[i].toLowerCase().replace(/ /g, '_')}.pdf`,
                'application/pdf',
                Math.floor(Math.random() * 5000000) + 10000,
                randomItem(documentCategories),
                randomItem(['draft', 'final', 'filed']),
                Math.floor(Math.random() * 3) + 1
            ]);
        }

        console.log('  Created 20 shared documents');

        // =====================================================
        // SEED LEADS (25 leads)
        // =====================================================
        console.log('\nSeeding leads (shared)...');

        // Add missing columns to leads table
        await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS user_id UUID`);
        await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_name VARCHAR(100)`);
        await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_name VARCHAR(100)`);
        await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS email VARCHAR(255)`);
        await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone VARCHAR(50)`);
        await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS company VARCHAR(200)`);
        await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS practice_area VARCHAR(100)`);
        await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS case_description TEXT`);
        await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS source VARCHAR(100)`);
        await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'new'`);
        await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium'`);

        const leadSources = ['website', 'referral', 'google', 'social_media', 'directory'];
        const leadStatuses = ['new', 'contacted', 'qualified', 'proposal', 'converted', 'lost'];
        const practiceAreas = ['personal_injury', 'family', 'criminal', 'corporate', 'estate', 'real_estate', 'employment'];
        const leadPriorities = ['low', 'medium', 'high'];

        const leadNames = [
            { first: 'Alex', last: 'Thompson' }, { first: 'Maria', last: 'Garcia' },
            { first: 'John', last: 'Smith' }, { first: 'Susan', last: 'Chen' },
            { first: 'Michael', last: 'Brown' }, { first: 'Lisa', last: 'Johnson' },
            { first: 'David', last: 'Wilson' }, { first: 'Emily', last: 'Davis' },
            { first: 'Robert', last: 'Martinez' }, { first: 'Jennifer', last: 'Anderson' },
            { first: 'William', last: 'Taylor' }, { first: 'Sarah', last: 'Thomas' },
            { first: 'James', last: 'Jackson' }, { first: 'Amanda', last: 'White' },
            { first: 'Christopher', last: 'Harris' }, { first: 'Jessica', last: 'Martin' },
            { first: 'Daniel', last: 'Thompson' }, { first: 'Ashley', last: 'Garcia' },
            { first: 'Matthew', last: 'Martinez' }, { first: 'Stephanie', last: 'Robinson' },
            { first: 'Andrew', last: 'Clark' }, { first: 'Nicole', last: 'Rodriguez' },
            { first: 'Joshua', last: 'Lewis' }, { first: 'Rachel', last: 'Lee' },
            { first: 'Kevin', last: 'Walker' }
        ];

        const caseDescriptions = [
            'Need help with a car accident claim',
            'Looking for representation in a divorce case',
            'Need assistance with business formation',
            'Seeking help with estate planning',
            'Need representation for a DUI charge'
        ];

        for (let i = 0; i < 25; i++) {
            const lead = leadNames[i];
            await client.query(`
                INSERT INTO leads (
                    user_id, first_name, last_name, email, phone, company,
                    practice_area, case_description, source, status, priority, created_at
                )
                VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `, [
                lead.first,
                lead.last,
                `${lead.first.toLowerCase()}.${lead.last.toLowerCase()}@email.com`,
                `555-${String(100 + i).padStart(3, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
                i % 3 === 0 ? `${lead.last} Enterprises` : null,
                randomItem(practiceAreas),
                randomItem(caseDescriptions),
                randomItem(leadSources),
                randomItem(leadStatuses),
                randomItem(leadPriorities),
                formatDateTime(randomDate(sixMonthsAgo, now))
            ]);
        }

        console.log('  Created 25 shared leads');

        // =====================================================
        // SEED MESSAGES (15 messages)
        // =====================================================
        console.log('\nSeeding messages (shared)...');

        // Add missing columns to messages table
        await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS user_id UUID`);
        await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS client_id UUID`);
        await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS case_id UUID`);
        await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS subject VARCHAR(255)`);
        await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS content TEXT`);
        await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(30) DEFAULT 'internal'`);
        await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false`);

        const messageSubjects = [
            'Case Status Update', 'Document Review Required', 'Meeting Reminder',
            'Settlement Offer Received', 'Court Date Confirmation', 'Invoice Questions',
            'New Document Uploaded', 'Deadline Approaching', 'Client Communication',
            'Discovery Response', 'Motion Filed', 'Hearing Results',
            'Contract Review', 'Billing Inquiry', 'Case Assessment'
        ];

        for (let i = 0; i < 15; i++) {
            await client.query(`
                INSERT INTO messages (
                    user_id, client_id, case_id, subject, content,
                    message_type, is_read
                )
                VALUES (NULL, $1, $2, $3, $4, $5, $6)
            `, [
                clientIds[i % clientIds.length],
                caseIds[i % caseIds.length],
                messageSubjects[i],
                `Message content for "${messageSubjects[i]}". This is an important communication regarding your legal matter.`,
                randomItem(['internal', 'client', 'system']),
                Math.random() > 0.3
            ]);
        }

        console.log('  Created 15 shared messages');

        // =====================================================
        // SEED CONFLICT WAIVERS (10 waivers)
        // =====================================================
        console.log('\nSeeding conflict waivers (shared)...');

        // First get the conflict check IDs we created
        const conflictCheckResult = await client.query(
            'SELECT id FROM conflict_checks WHERE user_id IS NULL ORDER BY created_at DESC LIMIT 10'
        );
        const conflictCheckIds = conflictCheckResult.rows.map(r => r.id);

        const waiverTypes = ['informed_consent', 'advance_waiver', 'prospective_waiver'];

        for (let i = 0; i < Math.min(10, conflictCheckIds.length); i++) {
            await client.query(`
                INSERT INTO conflict_waivers (
                    conflict_check_id, waiver_type, parties_involved, waiver_text,
                    obtained_from, obtained_date
                )
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                conflictCheckIds[i],
                randomItem(waiverTypes),
                JSON.stringify([partyNames[i % partyNames.length], partyNames[(i + 1) % partyNames.length]]),
                'Client acknowledges and consents to the potential conflict of interest as described. Client waives any objection to representation and confirms informed consent.',
                partyNames[i % partyNames.length],
                formatDate(randomDate(sixMonthsAgo, now))
            ]);
        }

        console.log('  Created 10 shared conflict waivers');

        // =====================================================
        // SEED CALENDAR CONNECTIONS (5 connections)
        // =====================================================
        console.log('\nSeeding calendar connections (shared)...');

        const providers = ['google', 'outlook', 'apple'];
        const syncStatuses = ['active', 'paused', 'syncing'];

        const calendarConnectionIds = [];
        for (let i = 0; i < 5; i++) {
            const result = await client.query(`
                INSERT INTO calendar_connections (
                    user_id, provider, provider_email, calendar_id,
                    sync_direction, last_sync_at, sync_status
                )
                VALUES (NULL, $1, $2, $3, $4, $5, $6)
                RETURNING id
            `, [
                randomItem(providers),
                `user${i + 1}@example.com`,
                `calendar_${i + 1}`,
                'both',
                formatDateTime(randomDate(sixMonthsAgo, now)),
                randomItem(syncStatuses)
            ]);
            calendarConnectionIds.push(result.rows[0].id);
        }

        console.log('  Created 5 shared calendar connections');

        // =====================================================
        // SEED CALENDAR SYNC LOG (15 entries)
        // =====================================================
        console.log('\nSeeding calendar sync log (shared)...');

        const syncTypes = ['full', 'incremental', 'manual'];

        for (let i = 0; i < 15; i++) {
            const startedAt = randomDate(sixMonthsAgo, now);
            const completedAt = new Date(startedAt.getTime() + Math.random() * 60000);
            await client.query(`
                INSERT INTO calendar_sync_log (
                    connection_id, sync_type, events_created, events_updated,
                    events_deleted, started_at, completed_at, status
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                calendarConnectionIds[i % calendarConnectionIds.length],
                randomItem(syncTypes),
                Math.floor(Math.random() * 10),
                Math.floor(Math.random() * 5),
                Math.floor(Math.random() * 2),
                formatDateTime(startedAt),
                formatDateTime(completedAt),
                'completed'
            ]);
        }

        console.log('  Created 15 shared calendar sync logs');

        // =====================================================
        // SEED ONLINE PAYMENTS (15 payments)
        // =====================================================
        console.log('\nSeeding online payments (shared)...');

        const paymentStatuses = ['succeeded', 'pending', 'processing'];

        for (let i = 0; i < 15; i++) {
            const amount = parseFloat(randomAmount(100, 5000));
            const feeAmount = (amount * 0.029 + 0.30).toFixed(2);
            const netAmount = (amount - parseFloat(feeAmount)).toFixed(2);

            await client.query(`
                INSERT INTO online_payments (
                    invoice_id, client_id, stripe_payment_intent_id, stripe_charge_id,
                    amount, currency, status, fee_amount, net_amount, receipt_url
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [
                invoiceIds[i % invoiceIds.length],
                clientIds[i % clientIds.length],
                `pi_${Math.random().toString(36).substring(2, 15)}`,
                `ch_${Math.random().toString(36).substring(2, 15)}`,
                amount,
                'usd',
                randomItem(paymentStatuses),
                feeAmount,
                netAmount,
                `https://pay.stripe.com/receipts/${Math.random().toString(36).substring(2, 10)}`
            ]);
        }

        console.log('  Created 15 shared online payments');

        // =====================================================
        // SEED PAYMENT LINKS (10 links)
        // =====================================================
        console.log('\nSeeding payment links (shared)...');

        const crypto = require('crypto');
        for (let i = 0; i < 10; i++) {
            const invoiceAmount = parseFloat(randomAmount(500, 5000));
            const expiresAt = new Date(now.getTime() + (30 + i) * 24 * 60 * 60 * 1000);

            await client.query(`
                INSERT INTO payment_links (
                    invoice_id, token, amount, is_active, expires_at, viewed_count
                )
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                invoiceIds[i % invoiceIds.length],
                crypto.randomBytes(32).toString('hex'),
                invoiceAmount,
                i < 7, // 7 active, 3 inactive
                formatDateTime(expiresAt),
                Math.floor(Math.random() * 10)
            ]);
        }

        console.log('  Created 10 shared payment links');

        // =====================================================
        // SEED DOCUMENT SUMMARIES (15 summaries)
        // =====================================================
        console.log('\nSeeding document summaries (shared)...');

        // Add missing columns to document_summaries table
        await client.query(`ALTER TABLE document_summaries ADD COLUMN IF NOT EXISTS user_id UUID`);
        await client.query(`ALTER TABLE document_summaries ADD COLUMN IF NOT EXISTS case_id UUID`);
        await client.query(`ALTER TABLE document_summaries ADD COLUMN IF NOT EXISTS client_id UUID`);
        await client.query(`ALTER TABLE document_summaries ADD COLUMN IF NOT EXISTS title VARCHAR(300)`);
        await client.query(`ALTER TABLE document_summaries ADD COLUMN IF NOT EXISTS original_text TEXT`);
        await client.query(`ALTER TABLE document_summaries ADD COLUMN IF NOT EXISTS summary TEXT`);
        await client.query(`ALTER TABLE document_summaries ADD COLUMN IF NOT EXISTS key_points JSONB`);
        await client.query(`ALTER TABLE document_summaries ADD COLUMN IF NOT EXISTS document_type VARCHAR(100)`);
        await client.query(`ALTER TABLE document_summaries ADD COLUMN IF NOT EXISTS word_count INTEGER`);

        const documentTypes = ['contract', 'motion', 'brief', 'letter', 'agreement', 'memo'];
        const summaryTitles = [
            'Employment Contract Summary', 'Motion for Summary Judgment Analysis',
            'Settlement Agreement Overview', 'Lease Agreement Key Points',
            'NDA Summary', 'Partnership Agreement Analysis', 'Complaint Summary',
            'Discovery Response Analysis', 'Deposition Summary', 'Expert Report Key Points',
            'Insurance Policy Review', 'Will and Testament Summary', 'Trust Document Analysis',
            'Retainer Agreement Overview', 'Court Order Summary'
        ];

        for (let i = 0; i < 15; i++) {
            await client.query(`
                INSERT INTO document_summaries (
                    user_id, case_id, client_id, title, original_text,
                    summary, key_points, document_type, word_count
                )
                VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                caseIds[i % caseIds.length],
                clientIds[i % clientIds.length],
                summaryTitles[i],
                'This is the original document text that was analyzed and summarized by the AI system. The document contains important legal provisions and terms that have been extracted and summarized below.',
                'This document outlines key legal terms and conditions. The main provisions include obligations of all parties, timeline requirements, and dispute resolution mechanisms. Important dates and deadlines are clearly specified throughout.',
                JSON.stringify([
                    'Key provision regarding party obligations',
                    'Timeline and deadline requirements',
                    'Financial terms and payment schedules',
                    'Dispute resolution and arbitration clauses',
                    'Termination and renewal conditions'
                ]),
                randomItem(documentTypes),
                Math.floor(Math.random() * 5000) + 500
            ]);
        }

        console.log('  Created 15 shared document summaries');

        // =====================================================
        // SEED DOCUMENT HISTORY (20 entries)
        // =====================================================
        console.log('\nSeeding document history (shared)...');

        // Add missing columns to document_history table
        await client.query(`ALTER TABLE document_history ADD COLUMN IF NOT EXISTS user_id UUID`);
        await client.query(`ALTER TABLE document_history ADD COLUMN IF NOT EXISTS case_id UUID`);
        await client.query(`ALTER TABLE document_history ADD COLUMN IF NOT EXISTS client_id UUID`);
        await client.query(`ALTER TABLE document_history ADD COLUMN IF NOT EXISTS title VARCHAR(255)`);
        await client.query(`ALTER TABLE document_history ADD COLUMN IF NOT EXISTS description TEXT`);
        await client.query(`ALTER TABLE document_history ADD COLUMN IF NOT EXISTS file_name VARCHAR(255)`);
        await client.query(`ALTER TABLE document_history ADD COLUMN IF NOT EXISTS file_path TEXT`);
        await client.query(`ALTER TABLE document_history ADD COLUMN IF NOT EXISTS file_type VARCHAR(100)`);
        await client.query(`ALTER TABLE document_history ADD COLUMN IF NOT EXISTS file_size INTEGER`);
        await client.query(`ALTER TABLE document_history ADD COLUMN IF NOT EXISTS category VARCHAR(50)`);
        await client.query(`ALTER TABLE document_history ADD COLUMN IF NOT EXISTS document_type VARCHAR(100)`);
        await client.query(`ALTER TABLE document_history ADD COLUMN IF NOT EXISTS specific_type VARCHAR(100)`);
        await client.query(`ALTER TABLE document_history ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'draft'`);
        await client.query(`ALTER TABLE document_history ADD COLUMN IF NOT EXISTS content TEXT`);

        const docCategories = ['pleading', 'correspondence', 'discovery', 'contract', 'evidence', 'research'];
        const docStatuses = ['draft', 'review', 'final', 'filed'];
        const docTypeMap = {
            'business_formation': ['llc_articles', 'llc_operating_agreement', 'corporate_bylaws', 'partnership_agreement'],
            'real_estate': ['purchase_agreement', 'lease_agreement', 'deed', 'title_search'],
            'family_law': ['divorce_petition', 'custody_agreement', 'prenuptial_agreement'],
            'estate_planning': ['last_will', 'living_trust', 'power_of_attorney', 'healthcare_directive'],
            'employment': ['employment_contract', 'nda', 'non_compete', 'offer_letter'],
            'litigation': ['complaint', 'answer', 'motion', 'discovery_request']
        };
        const docTypesArr = Object.keys(docTypeMap);

        for (let i = 0; i < 20; i++) {
            const docType = docTypesArr[i % docTypesArr.length];
            const specificTypes = docTypeMap[docType];
            const specificType = specificTypes[i % specificTypes.length];

            await client.query(`
                INSERT INTO document_history (
                    user_id, case_id, client_id, title, description,
                    file_name, file_path, file_type, file_size, category,
                    document_type, specific_type, status, content
                )
                VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            `, [
                caseIds[i % caseIds.length],
                clientIds[i % clientIds.length],
                documentTitles[i % documentTitles.length],
                `${documentTitles[i % documentTitles.length]} - Version ${Math.floor(Math.random() * 3) + 1}`,
                `${documentTitles[i % documentTitles.length].toLowerCase().replace(/ /g, '_')}_v${i + 1}.pdf`,
                `/uploads/documents/${documentTitles[i % documentTitles.length].toLowerCase().replace(/ /g, '_')}_v${i + 1}.pdf`,
                'application/pdf',
                Math.floor(Math.random() * 5000000) + 10000,
                randomItem(docCategories),
                docType,
                specificType,
                randomItem(docStatuses),
                `This is the content of ${documentTitles[i % documentTitles.length]}. Document generated for legal practice management.`
            ]);
        }

        console.log('  Created 20 shared document history entries');

        // Get document history IDs for linking
        const docHistoryResult = await client.query(
            'SELECT id FROM document_history WHERE user_id IS NULL ORDER BY created_at DESC LIMIT 20'
        );
        const docHistoryIds = docHistoryResult.rows.map(r => r.id);

        // =====================================================
        // SEED OCR JOBS (15 jobs)
        // =====================================================
        console.log('\nSeeding OCR jobs (shared)...');

        // Add missing columns to ocr_jobs table
        await client.query(`ALTER TABLE ocr_jobs ADD COLUMN IF NOT EXISTS user_id UUID`);
        await client.query(`ALTER TABLE ocr_jobs ADD COLUMN IF NOT EXISTS document_id UUID`);
        await client.query(`ALTER TABLE ocr_jobs ADD COLUMN IF NOT EXISTS original_file_path VARCHAR(500)`);
        await client.query(`ALTER TABLE ocr_jobs ADD COLUMN IF NOT EXISTS file_name VARCHAR(255)`);
        await client.query(`ALTER TABLE ocr_jobs ADD COLUMN IF NOT EXISTS file_type VARCHAR(50)`);
        await client.query(`ALTER TABLE ocr_jobs ADD COLUMN IF NOT EXISTS file_size INTEGER`);
        await client.query(`ALTER TABLE ocr_jobs ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'completed'`);
        await client.query(`ALTER TABLE ocr_jobs ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 100`);
        await client.query(`ALTER TABLE ocr_jobs ADD COLUMN IF NOT EXISTS page_count INTEGER`);
        await client.query(`ALTER TABLE ocr_jobs ADD COLUMN IF NOT EXISTS pages_processed INTEGER`);
        await client.query(`ALTER TABLE ocr_jobs ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'eng'`);
        await client.query(`ALTER TABLE ocr_jobs ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP`);
        await client.query(`ALTER TABLE ocr_jobs ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMP`);

        const ocrStatuses = ['completed', 'completed', 'completed', 'processing', 'pending'];
        const fileTypes = ['pdf', 'png', 'jpg', 'tiff'];
        const ocrJobIds = [];

        for (let i = 0; i < 15; i++) {
            const status = randomItem(ocrStatuses);
            const pageCount = Math.floor(Math.random() * 20) + 1;
            const pagesProcessed = status === 'completed' ? pageCount : Math.floor(pageCount * Math.random());
            const progress = status === 'completed' ? 100 : Math.floor((pagesProcessed / pageCount) * 100);

            const result = await client.query(`
                INSERT INTO ocr_jobs (
                    user_id, document_id, original_file_path, file_name, file_type,
                    file_size, status, progress, page_count, pages_processed,
                    language, processing_started_at, processing_completed_at
                )
                VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING id
            `, [
                docHistoryIds.length > 0 ? docHistoryIds[i % docHistoryIds.length] : null,
                `/uploads/ocr/document_${i + 1}.pdf`,
                `Scanned_Document_${i + 1}.pdf`,
                randomItem(fileTypes),
                Math.floor(Math.random() * 10000000) + 100000,
                status,
                progress,
                pageCount,
                pagesProcessed,
                'eng',
                formatDateTime(randomDate(sixMonthsAgo, now)),
                status === 'completed' ? formatDateTime(new Date()) : null
            ]);
            ocrJobIds.push(result.rows[0].id);
        }

        console.log('  Created 15 shared OCR jobs');

        // =====================================================
        // SEED OCR PAGES (for completed jobs)
        // =====================================================
        console.log('\nSeeding OCR pages (shared)...');

        let ocrPagesCount = 0;
        for (let i = 0; i < Math.min(10, ocrJobIds.length); i++) {
            const numPages = Math.floor(Math.random() * 5) + 1;
            for (let p = 1; p <= numPages; p++) {
                await client.query(`
                    INSERT INTO ocr_pages (
                        job_id, page_number, raw_text, confidence_score, word_count
                    )
                    VALUES ($1, $2, $3, $4, $5)
                `, [
                    ocrJobIds[i],
                    p,
                    `This is the extracted text from page ${p} of document ${i + 1}. The OCR system has processed this content and extracted the text with high accuracy. Legal terms, dates, and names have been preserved.`,
                    (Math.random() * 10 + 90).toFixed(2),
                    Math.floor(Math.random() * 500) + 100
                ]);
                ocrPagesCount++;
            }
        }

        console.log(`  Created ${ocrPagesCount} shared OCR pages`);

        // =====================================================
        // SEED CASE DOCUMENTS (link documents to cases)
        // =====================================================
        console.log('\nSeeding case documents (shared)...');

        for (let i = 0; i < Math.min(15, docHistoryIds.length); i++) {
            await client.query(`
                INSERT INTO case_documents (case_id, document_id)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
            `, [
                caseIds[i % caseIds.length],
                docHistoryIds[i]
            ]);
        }

        console.log('  Created 15 shared case documents');

        // =====================================================
        // SEED CLIENT DOCUMENT ACCESS (for portal)
        // =====================================================
        console.log('\nSeeding client document access (shared)...');

        for (let i = 0; i < Math.min(15, docHistoryIds.length); i++) {
            await client.query(`
                INSERT INTO client_document_access (client_id, document_id, access_type)
                VALUES ($1, $2, $3)
                ON CONFLICT DO NOTHING
            `, [
                clientIds[i % clientIds.length],
                docHistoryIds[i],
                i % 3 === 0 ? 'download' : 'view'
            ]);
        }

        console.log('  Created 15 shared client document access records');

        // =====================================================
        // SEED AI DRAFT TEMPLATES (10 templates)
        // =====================================================
        console.log('\nSeeding AI draft templates (shared)...');

        // Add missing columns to ai_draft_templates table
        await client.query(`ALTER TABLE ai_draft_templates ADD COLUMN IF NOT EXISTS user_id UUID`);
        await client.query(`ALTER TABLE ai_draft_templates ADD COLUMN IF NOT EXISTS name VARCHAR(200)`);
        await client.query(`ALTER TABLE ai_draft_templates ADD COLUMN IF NOT EXISTS description TEXT`);
        await client.query(`ALTER TABLE ai_draft_templates ADD COLUMN IF NOT EXISTS category VARCHAR(100)`);
        await client.query(`ALTER TABLE ai_draft_templates ADD COLUMN IF NOT EXISTS document_type VARCHAR(100)`);
        await client.query(`ALTER TABLE ai_draft_templates ADD COLUMN IF NOT EXISTS prompt_template TEXT`);
        await client.query(`ALTER TABLE ai_draft_templates ADD COLUMN IF NOT EXISTS variables JSONB DEFAULT '[]'`);
        await client.query(`ALTER TABLE ai_draft_templates ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false`);
        await client.query(`ALTER TABLE ai_draft_templates ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0`);

        const draftTemplates = [
            { name: 'Legal Demand Letter', category: 'litigation', docType: 'letter', desc: 'Professional demand letter for legal claims' },
            { name: 'Contract Summary', category: 'contracts', docType: 'summary', desc: 'Summarize key terms of any contract' },
            { name: 'Motion to Dismiss', category: 'litigation', docType: 'motion', desc: 'Standard motion to dismiss template' },
            { name: 'Settlement Agreement', category: 'litigation', docType: 'agreement', desc: 'Draft settlement agreement terms' },
            { name: 'NDA Agreement', category: 'contracts', docType: 'agreement', desc: 'Non-disclosure agreement template' },
            { name: 'Employment Offer Letter', category: 'employment', docType: 'letter', desc: 'Job offer letter with standard terms' },
            { name: 'Cease and Desist', category: 'ip', docType: 'letter', desc: 'Cease and desist letter for IP violations' },
            { name: 'Lease Agreement', category: 'real_estate', docType: 'agreement', desc: 'Commercial or residential lease' },
            { name: 'Power of Attorney', category: 'estate', docType: 'legal_doc', desc: 'General or limited power of attorney' },
            { name: 'Corporate Bylaws', category: 'corporate', docType: 'legal_doc', desc: 'Standard corporate bylaws template' }
        ];

        const templateIds = [];
        for (const tmpl of draftTemplates) {
            const result = await client.query(`
                INSERT INTO ai_draft_templates (
                    user_id, name, description, category, document_type,
                    prompt_template, variables, is_public, usage_count
                )
                VALUES (NULL, $1, $2, $3, $4, $5, $6, true, $7)
                RETURNING id
            `, [
                tmpl.name,
                tmpl.desc,
                tmpl.category,
                tmpl.docType,
                `Generate a professional ${tmpl.name} based on the following information: {{input}}`,
                JSON.stringify(['client_name', 'date', 'subject', 'details']),
                Math.floor(Math.random() * 50) + 5
            ]);
            templateIds.push(result.rows[0].id);
        }

        console.log('  Created 10 shared AI draft templates');

        // =====================================================
        // SEED AI DRAFT SESSIONS (15 sessions)
        // =====================================================
        console.log('\nSeeding AI draft sessions (shared)...');

        // Add missing columns to ai_draft_sessions table
        await client.query(`ALTER TABLE ai_draft_sessions ADD COLUMN IF NOT EXISTS user_id UUID`);
        await client.query(`ALTER TABLE ai_draft_sessions ADD COLUMN IF NOT EXISTS template_id UUID`);
        await client.query(`ALTER TABLE ai_draft_sessions ADD COLUMN IF NOT EXISTS case_id UUID`);
        await client.query(`ALTER TABLE ai_draft_sessions ADD COLUMN IF NOT EXISTS client_id UUID`);
        await client.query(`ALTER TABLE ai_draft_sessions ADD COLUMN IF NOT EXISTS title VARCHAR(300)`);
        await client.query(`ALTER TABLE ai_draft_sessions ADD COLUMN IF NOT EXISTS input_data JSONB`);
        await client.query(`ALTER TABLE ai_draft_sessions ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'completed'`);

        const sessionTitles = [
            'Demand Letter for Smith v. ABC Corp',
            'NDA for Tech Partnership',
            'Settlement Terms - Johnson Case',
            'Employment Offer - Senior Developer',
            'Lease Agreement - 123 Main St',
            'Motion to Dismiss - Williams Matter',
            'Corporate Bylaws - NewCo Inc',
            'Power of Attorney - Estate Planning',
            'Cease and Desist - Trademark',
            'Contract Summary - Vendor Agreement',
            'Demand Letter - Breach of Contract',
            'Settlement Agreement - Personal Injury',
            'NDA - Consulting Engagement',
            'Employment Termination Letter',
            'Lease Modification Agreement'
        ];

        const sessionIds = [];
        for (let i = 0; i < 15; i++) {
            const result = await client.query(`
                INSERT INTO ai_draft_sessions (
                    user_id, template_id, case_id, client_id, title, input_data, status
                )
                VALUES (NULL, $1, $2, $3, $4, $5, 'completed')
                RETURNING id
            `, [
                templateIds[i % templateIds.length],
                caseIds[i % caseIds.length],
                clientIds[i % clientIds.length],
                sessionTitles[i],
                JSON.stringify({ client_name: 'Client ' + (i + 1), subject: sessionTitles[i] })
            ]);
            sessionIds.push(result.rows[0].id);
        }

        console.log('  Created 15 shared AI draft sessions');

        // =====================================================
        // SEED AI DRAFT VERSIONS (for each session)
        // =====================================================
        console.log('\nSeeding AI draft versions (shared)...');

        // Add missing columns to ai_draft_versions table
        await client.query(`ALTER TABLE ai_draft_versions ADD COLUMN IF NOT EXISTS session_id UUID`);
        await client.query(`ALTER TABLE ai_draft_versions ADD COLUMN IF NOT EXISTS version_number INTEGER`);
        await client.query(`ALTER TABLE ai_draft_versions ADD COLUMN IF NOT EXISTS content TEXT`);
        await client.query(`ALTER TABLE ai_draft_versions ADD COLUMN IF NOT EXISTS prompt_used TEXT`);
        await client.query(`ALTER TABLE ai_draft_versions ADD COLUMN IF NOT EXISTS model_used VARCHAR(100)`);
        await client.query(`ALTER TABLE ai_draft_versions ADD COLUMN IF NOT EXISTS tokens_used INTEGER`);
        await client.query(`ALTER TABLE ai_draft_versions ADD COLUMN IF NOT EXISTS generation_time_ms INTEGER`);

        let versionCount = 0;
        for (let i = 0; i < sessionIds.length; i++) {
            const numVersions = Math.floor(Math.random() * 3) + 1;
            for (let v = 1; v <= numVersions; v++) {
                await client.query(`
                    INSERT INTO ai_draft_versions (
                        session_id, version_number, content, prompt_used,
                        model_used, tokens_used, generation_time_ms
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [
                    sessionIds[i],
                    v,
                    `This is version ${v} of the drafted document for "${sessionTitles[i]}". The document includes all necessary legal provisions, terms, and conditions as specified in the input parameters. This draft was generated by AI and should be reviewed by legal counsel before use.`,
                    'Generate a professional legal document based on the provided information.',
                    'claude-3-sonnet',
                    Math.floor(Math.random() * 2000) + 500,
                    Math.floor(Math.random() * 5000) + 1000
                ]);
                versionCount++;
            }
        }

        console.log(`  Created ${versionCount} shared AI draft versions`);

        // =====================================================
        // SEED CONTRACT ANALYSIS (15 analyses)
        // =====================================================
        console.log('\nSeeding contract analyses (shared)...');

        // Add missing columns to contract_analysis table
        await client.query(`ALTER TABLE contract_analysis ADD COLUMN IF NOT EXISTS user_id UUID`);
        await client.query(`ALTER TABLE contract_analysis ADD COLUMN IF NOT EXISTS case_id UUID`);
        await client.query(`ALTER TABLE contract_analysis ADD COLUMN IF NOT EXISTS client_id UUID`);
        await client.query(`ALTER TABLE contract_analysis ADD COLUMN IF NOT EXISTS title VARCHAR(300)`);
        await client.query(`ALTER TABLE contract_analysis ADD COLUMN IF NOT EXISTS file_name VARCHAR(255)`);
        await client.query(`ALTER TABLE contract_analysis ADD COLUMN IF NOT EXISTS file_path TEXT`);
        await client.query(`ALTER TABLE contract_analysis ADD COLUMN IF NOT EXISTS contract_type VARCHAR(100)`);
        await client.query(`ALTER TABLE contract_analysis ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'completed'`);
        await client.query(`ALTER TABLE contract_analysis ADD COLUMN IF NOT EXISTS overall_risk_score DECIMAL(5,2)`);
        await client.query(`ALTER TABLE contract_analysis ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20)`);
        await client.query(`ALTER TABLE contract_analysis ADD COLUMN IF NOT EXISTS key_terms JSONB`);
        await client.query(`ALTER TABLE contract_analysis ADD COLUMN IF NOT EXISTS risk_factors JSONB`);
        await client.query(`ALTER TABLE contract_analysis ADD COLUMN IF NOT EXISTS recommendations JSONB`);
        await client.query(`ALTER TABLE contract_analysis ADD COLUMN IF NOT EXISTS summary TEXT`);
        await client.query(`ALTER TABLE contract_analysis ADD COLUMN IF NOT EXISTS parties JSONB`);

        const contractTypes = ['employment', 'vendor', 'lease', 'nda', 'partnership', 'licensing', 'service'];
        const riskLevels = ['low', 'medium', 'high'];

        for (let i = 0; i < 15; i++) {
            const riskScore = Math.floor(Math.random() * 80 + 10);
            const riskLevel = riskScore > 60 ? 'high' : riskScore > 30 ? 'medium' : 'low';

            await client.query(`
                INSERT INTO contract_analysis (
                    user_id, case_id, client_id, title, file_name, file_path,
                    contract_type, status, overall_risk_score, risk_level,
                    key_terms, risk_factors, recommendations, summary, parties
                )
                VALUES (NULL, $1, $2, $3, $4, $5, $6, 'completed', $7, $8, $9, $10, $11, $12, $13)
            `, [
                caseIds[i % caseIds.length],
                clientIds[i % clientIds.length],
                `Contract Analysis - ${randomItem(contractTypes)} agreement ${i + 1}`,
                `contract_${i + 1}.pdf`,
                `/uploads/contracts/contract_${i + 1}.pdf`,
                randomItem(contractTypes),
                riskScore,
                riskLevel,
                JSON.stringify(['Payment Terms: Net 30', 'Term: 12 months', 'Auto-renewal clause', 'Liability cap: $100,000']),
                JSON.stringify(['Broad indemnification clause', 'Unfavorable termination terms', 'Missing force majeure']),
                JSON.stringify(['Negotiate liability cap', 'Add force majeure clause', 'Clarify payment terms']),
                'This contract contains standard terms with some areas requiring attention. Key risk factors have been identified and recommendations provided.',
                JSON.stringify([{ name: 'Party A', role: 'Client' }, { name: 'Party B', role: 'Vendor' }])
            ]);
        }

        console.log('  Created 15 shared contract analyses');

        // =====================================================
        // SEED CITATION SEARCHES (15 searches)
        // =====================================================
        console.log('\nSeeding citation searches (shared)...');

        // Add missing columns to citation_searches table
        await client.query(`ALTER TABLE citation_searches ADD COLUMN IF NOT EXISTS user_id UUID`);
        await client.query(`ALTER TABLE citation_searches ADD COLUMN IF NOT EXISTS case_id UUID`);
        await client.query(`ALTER TABLE citation_searches ADD COLUMN IF NOT EXISTS legal_issue TEXT`);
        await client.query(`ALTER TABLE citation_searches ADD COLUMN IF NOT EXISTS search_type VARCHAR(50) DEFAULT 'general'`);
        await client.query(`ALTER TABLE citation_searches ADD COLUMN IF NOT EXISTS jurisdiction VARCHAR(100)`);
        await client.query(`ALTER TABLE citation_searches ADD COLUMN IF NOT EXISTS practice_area VARCHAR(100)`);
        await client.query(`ALTER TABLE citation_searches ADD COLUMN IF NOT EXISTS results JSONB`);
        await client.query(`ALTER TABLE citation_searches ADD COLUMN IF NOT EXISTS result_count INTEGER DEFAULT 0`);
        await client.query(`ALTER TABLE citation_searches ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'completed'`);

        const citationQueries = [
            'breach of contract damages California',
            'employment discrimination case law',
            'personal injury negligence standards',
            'landlord tenant rights California',
            'intellectual property fair use',
            'corporate liability piercing veil',
            'divorce asset division community property',
            'criminal defense Miranda rights',
            'medical malpractice standard of care',
            'real estate disclosure requirements',
            'contract formation consideration',
            'workers compensation benefits',
            'immigration visa requirements',
            'bankruptcy Chapter 7 exemptions',
            'estate planning trust creation'
        ];

        const jurisdictions = ['California', 'New York', 'Texas', 'Florida', 'Federal'];

        const searchTypes = ['general', 'case_law', 'statutory', 'regulatory'];

        for (let i = 0; i < 15; i++) {
            await client.query(`
                INSERT INTO citation_searches (
                    user_id, case_id, legal_issue, search_type, jurisdiction, practice_area, status
                )
                VALUES (NULL, $1, $2, $3, $4, $5, 'completed')
            `, [
                caseIds[i % caseIds.length],
                citationQueries[i],
                randomItem(searchTypes),
                randomItem(jurisdictions),
                randomItem(practiceAreas)
            ]);
        }

        console.log('  Created 15 shared citation searches');

        console.log('\n========================================');
        console.log('COMPLETE SHARED Database seeding done!');
        console.log('========================================');
        console.log('\nAll data created with user_id = NULL');
        console.log('All users will see this data automatically.');
        console.log('\nSummary:');
        console.log('  - 20 Clients');
        console.log('  - 20 Cases');
        console.log('  - 25 Time Entries');
        console.log('  - 20 Expenses');
        console.log('  - 15 Invoices');
        console.log('  - 15 Payments');
        console.log('  - 20 Calendar Events');
        console.log('  - 15 Deadlines');
        console.log('  - 20 Tasks');
        console.log('  - 20 Conflict Parties');
        console.log('  - 15 Conflict Checks');
        console.log('  - 10 Conflict Waivers');
        console.log('  - 10 Trust Accounts');
        console.log('  - 15 Client Trust Ledgers');
        console.log('  - 20 Trust Transactions');
        console.log('  - 20 Documents');
        console.log('  - 20 Document History');
        console.log('  - 15 Document Summaries');
        console.log('  - 15 OCR Jobs');
        console.log('  - 15 Case Documents');
        console.log('  - 15 Client Document Access');
        console.log('  - 10 AI Draft Templates');
        console.log('  - 15 AI Draft Sessions');
        console.log('  - 15 Contract Analyses');
        console.log('  - 15 Citation Searches');
        console.log('  - 5 Calendar Connections');
        console.log('  - 15 Calendar Sync Logs');
        console.log('  - 15 Online Payments');
        console.log('  - 10 Payment Links');
        console.log('  - 25 Leads');
        console.log('  - 15 Messages');

    } catch (error) {
        console.error('Error seeding database:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the seed
seedSharedDatabase().catch(console.error);

/**
 * Seed Shared Data Script for Legal Practice Management System
 * Creates data with user_id = NULL so all users can see it
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
        console.log('Starting SHARED database seed (user_id = NULL)...\n');

        const now = new Date();
        const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
        const threeMonthsFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

        // =====================================================
        // SEED CLIENTS (15 individuals + 5 businesses = 20)
        // =====================================================
        console.log('\nSeeding clients (shared)...');

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
        const priorities = ['low', 'medium', 'high', 'urgent'];
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
        // SEED CALENDAR EVENTS (20 events)
        // =====================================================
        console.log('\nSeeding calendar events (shared)...');

        const eventTypes = ['hearing', 'deadline', 'meeting', 'task', 'reminder', 'deposition', 'mediation'];
        const eventColors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#43e97b'];
        const eventTitles = [
            'Motion Hearing',
            'Client Meeting',
            'Deposition of Plaintiff',
            'Settlement Conference',
            'Discovery Deadline',
            'Trial Preparation Meeting',
            'Mediation Session',
            'Status Conference',
            'Document Review Deadline',
            'Expert Witness Meeting',
            'Pretrial Conference',
            'Filing Deadline',
            'Client Phone Call',
            'Team Strategy Meeting',
            'Court Appearance',
            'Contract Signing',
            'Closing Meeting',
            'Initial Consultation',
            'Arbitration Hearing',
            'Appeals Deadline'
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
        // SEED TASKS (20 tasks)
        // =====================================================
        console.log('\nSeeding tasks (shared)...');

        const taskTitles = [
            'Review and sign retainer agreement',
            'Prepare discovery requests',
            'Schedule client meeting',
            'File motion with court',
            'Research case law precedents',
            'Draft settlement proposal',
            'Organize case documents',
            'Prepare witness list',
            'Review opposing counsel motion',
            'Update case timeline',
            'Coordinate expert witness',
            'Prepare trial exhibits',
            'Send client status update',
            'Review billing entries',
            'Complete conflict check',
            'Draft correspondence to court',
            'Prepare closing documents',
            'Schedule depositions',
            'Review contract amendments',
            'Finalize settlement agreement'
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
        // SEED LEADS (25 leads)
        // =====================================================
        console.log('\nSeeding leads (shared)...');

        const leadSources = ['website', 'referral', 'google', 'social_media', 'directory'];
        const leadStatuses = ['new', 'contacted', 'qualified', 'proposal', 'converted', 'lost'];
        const practiceAreas = ['personal_injury', 'family', 'criminal', 'corporate', 'estate', 'real_estate', 'employment'];
        const leadPriorities = ['low', 'medium', 'high'];

        const leadNames = [
            { first: 'Alex', last: 'Thompson', company: null },
            { first: 'Maria', last: 'Garcia', company: 'Garcia Enterprises' },
            { first: 'John', last: 'Smith', company: null },
            { first: 'Susan', last: 'Chen', company: 'Chen Tech Solutions' },
            { first: 'Michael', last: 'Brown', company: null },
            { first: 'Lisa', last: 'Johnson', company: null },
            { first: 'David', last: 'Wilson', company: 'Wilson & Associates' },
            { first: 'Emily', last: 'Davis', company: null },
            { first: 'Robert', last: 'Martinez', company: 'Martinez Construction' },
            { first: 'Jennifer', last: 'Anderson', company: null },
            { first: 'William', last: 'Taylor', company: null },
            { first: 'Sarah', last: 'Thomas', company: 'Thomas Consulting' },
            { first: 'James', last: 'Jackson', company: null },
            { first: 'Amanda', last: 'White', company: null },
            { first: 'Christopher', last: 'Harris', company: 'Harris Industries' },
            { first: 'Jessica', last: 'Martin', company: null },
            { first: 'Daniel', last: 'Thompson', company: null },
            { first: 'Ashley', last: 'Garcia', company: 'AG Properties' },
            { first: 'Matthew', last: 'Martinez', company: null },
            { first: 'Stephanie', last: 'Robinson', company: null },
            { first: 'Andrew', last: 'Clark', company: 'Clark Law Group' },
            { first: 'Nicole', last: 'Rodriguez', company: null },
            { first: 'Joshua', last: 'Lewis', company: null },
            { first: 'Rachel', last: 'Lee', company: 'Lee Ventures' },
            { first: 'Kevin', last: 'Walker', company: null }
        ];

        const caseDescriptions = [
            'Need help with a car accident claim from last month',
            'Looking for representation in a divorce case',
            'Need assistance with business formation and contracts',
            'Seeking help with estate planning and will preparation',
            'Need representation for a DUI charge'
        ];

        for (let i = 0; i < 25; i++) {
            const lead = leadNames[i];
            const createdDate = randomDate(sixMonthsAgo, now);

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
                lead.company,
                randomItem(practiceAreas),
                randomItem(caseDescriptions),
                randomItem(leadSources),
                randomItem(leadStatuses),
                randomItem(leadPriorities),
                formatDateTime(createdDate)
            ]);
        }

        console.log('  Created 25 shared leads');

        // =====================================================
        // SEED MESSAGES (15 messages)
        // =====================================================
        console.log('\nSeeding messages (shared)...');

        const messageSubjects = [
            'Case Status Update',
            'Document Review Required',
            'Meeting Reminder',
            'Settlement Offer Received',
            'Court Date Confirmation',
            'Invoice Questions',
            'New Document Uploaded',
            'Deadline Approaching',
            'Client Communication',
            'Discovery Response',
            'Motion Filed',
            'Hearing Results',
            'Contract Review',
            'Billing Inquiry',
            'Case Assessment'
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

        console.log('\n========================================');
        console.log('SHARED Database seeding completed!');
        console.log('========================================');
        console.log('\nAll data created with user_id = NULL');
        console.log('All users will see this data automatically.');
        console.log('\nSummary:');
        console.log('  - 20 Clients (shared)');
        console.log('  - 20 Cases (shared)');
        console.log('  - 25 Time Entries (shared)');
        console.log('  - 15 Invoices (shared)');
        console.log('  - 20 Calendar Events (shared)');
        console.log('  - 20 Tasks (shared)');
        console.log('  - 25 Leads (shared)');
        console.log('  - 15 Messages (shared)');

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

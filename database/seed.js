/**
 * Seed Data Script for Legal Practice Management System
 * Generates 15+ sample items for each entity
 *
 * Usage: node database/seed.js
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

async function seedDatabase() {
    const client = await pool.connect();

    try {
        console.log('Starting database seed...\n');

        // First, run the migration
        const fs = require('fs');
        const migrationPath = __dirname + '/migrations/002_practice_management.sql';
        if (fs.existsSync(migrationPath)) {
            console.log('Running migration...');
            const migration = fs.readFileSync(migrationPath, 'utf8');
            await client.query(migration);
            console.log('Migration completed.\n');
        }

        // Get or create a demo user
        let userId;
        const userCheck = await client.query("SELECT id FROM users WHERE email = 'demo@legalforms.ai'");

        if (userCheck.rows.length === 0) {
            const bcrypt = require('bcrypt');
            const hashedPassword = await bcrypt.hash('Demo123!', 12);
            const userResult = await client.query(`
                INSERT INTO users (email, password_hash, first_name, last_name, phone, email_verified)
                VALUES ('demo@legalforms.ai', $1, 'John', 'Attorney', '555-123-4567', true)
                RETURNING id
            `, [hashedPassword]);
            userId = userResult.rows[0].id;
            console.log('Created demo user: demo@legalforms.ai / Demo123!');
        } else {
            userId = userCheck.rows[0].id;
            console.log('Using existing demo user.');
        }

        // Assign admin role to demo user
        const adminRole = await client.query("SELECT id FROM roles WHERE name = 'admin'");
        if (adminRole.rows.length > 0) {
            await client.query(`
                INSERT INTO user_roles (user_id, role_id)
                VALUES ($1, $2)
                ON CONFLICT (user_id, role_id) DO NOTHING
            `, [userId, adminRole.rows[0].id]);
        }

        // =====================================================
        // SEED CLIENTS (15 individuals + 5 businesses = 20)
        // =====================================================
        console.log('\nSeeding clients...');

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
                VALUES ($1, 'individual', $2, $3, $4, $5, $6, $7, $8, '90001', 'active')
                RETURNING id
            `, [userId, c.first_name, c.last_name, c.email, c.phone, `${Math.floor(Math.random() * 9999) + 100} Main Street`, c.city, c.state]);
            clientIds.push(result.rows[0].id);
        }

        for (const c of businessClients) {
            const result = await client.query(`
                INSERT INTO clients (user_id, client_type, company_name, email, phone, address, city, state, zip, status)
                VALUES ($1, 'business', $2, $3, $4, $5, $6, $7, '90001', 'active')
                RETURNING id
            `, [userId, c.company_name, c.email, c.phone, `${Math.floor(Math.random() * 9999) + 100} Business Blvd`, c.city, c.state]);
            clientIds.push(result.rows[0].id);
        }

        console.log(`  Created ${clientIds.length} clients`);

        // Seed client contacts
        const contactRoles = ['CEO', 'CFO', 'General Counsel', 'Office Manager', 'Spouse', 'Business Partner'];
        for (let i = 0; i < 15; i++) {
            await client.query(`
                INSERT INTO client_contacts (client_id, name, role, email, phone, is_primary)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                clientIds[i % clientIds.length],
                `Contact ${i + 1}`,
                randomItem(contactRoles),
                `contact${i + 1}@email.com`,
                `555-${String(i).padStart(3, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
                i < 5
            ]);
        }
        console.log('  Created 15 client contacts');

        // =====================================================
        // SEED CASES (20 cases)
        // =====================================================
        console.log('\nSeeding cases...');

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
        const now = new Date();
        const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

        for (let i = 0; i < 20; i++) {
            const dateOpened = randomDate(sixMonthsAgo, now);
            const status = randomItem(caseStatuses);
            const result = await client.query(`
                INSERT INTO cases (
                    user_id, client_id, case_number, title, description, case_type, status, priority,
                    court_name, court_case_number, judge_name, opposing_party, opposing_counsel,
                    date_opened, date_closed, statute_of_limitations, billing_type, billing_rate, notes
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
                RETURNING id
            `, [
                userId,
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

        console.log(`  Created ${caseIds.length} cases`);

        // Seed case notes
        const noteTypes = ['general', 'court', 'client', 'internal'];
        for (let i = 0; i < 20; i++) {
            await client.query(`
                INSERT INTO case_notes (case_id, user_id, note_type, content, is_billable)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                caseIds[i % caseIds.length],
                userId,
                randomItem(noteTypes),
                `Case note ${i + 1}: Important update regarding the matter. Client communication completed and next steps outlined.`,
                Math.random() > 0.5
            ]);
        }
        console.log('  Created 20 case notes');

        // =====================================================
        // SEED TIME ENTRIES (25 entries)
        // =====================================================
        console.log('\nSeeding time entries...');

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

        const timeEntryIds = [];
        for (let i = 0; i < 25; i++) {
            const duration = Math.floor(Math.random() * 480) + 15; // 15 min to 8 hours
            const rate = parseFloat(randomAmount(150, 450));
            const amount = (duration / 60 * rate).toFixed(2);
            const entryDate = randomDate(sixMonthsAgo, now);

            const result = await client.query(`
                INSERT INTO time_entries (
                    user_id, case_id, client_id, description, duration_minutes, hourly_rate,
                    amount, date, is_billable, is_billed, activity_type
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING id
            `, [
                userId,
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
            timeEntryIds.push(result.rows[0].id);
        }

        console.log(`  Created ${timeEntryIds.length} time entries`);

        // =====================================================
        // SEED EXPENSES (15 expenses)
        // =====================================================
        console.log('\nSeeding expenses...');

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

        for (let i = 0; i < 15; i++) {
            await client.query(`
                INSERT INTO expenses (
                    user_id, case_id, client_id, description, amount, expense_date,
                    category, is_billable, vendor
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                userId,
                caseIds[i % caseIds.length],
                clientIds[i % clientIds.length],
                expenseDescriptions[i],
                randomAmount(25, 2500),
                formatDate(randomDate(sixMonthsAgo, now)),
                randomItem(expenseCategories),
                Math.random() > 0.2,
                `Vendor ${i + 1}`
            ]);
        }

        console.log('  Created 15 expenses');

        // =====================================================
        // SEED INVOICES (15 invoices)
        // =====================================================
        console.log('\nSeeding invoices...');

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
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING id
            `, [
                userId,
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

        console.log(`  Created ${invoiceIds.length} invoices`);

        // Seed invoice items
        for (let i = 0; i < 20; i++) {
            const quantity = parseFloat(randomAmount(0.5, 10));
            const rate = parseFloat(randomAmount(150, 450));
            await client.query(`
                INSERT INTO invoice_items (invoice_id, description, quantity, rate, amount, item_type)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                invoiceIds[i % invoiceIds.length],
                `Legal services - ${randomItem(activityTypes)}`,
                quantity,
                rate,
                (quantity * rate).toFixed(2),
                Math.random() > 0.8 ? 'expense' : 'service'
            ]);
        }
        console.log('  Created 20 invoice items');

        // =====================================================
        // SEED PAYMENTS (15 payments)
        // =====================================================
        console.log('\nSeeding payments...');

        const paymentMethods = ['credit_card', 'check', 'wire', 'cash', 'ach'];

        for (let i = 0; i < 15; i++) {
            await client.query(`
                INSERT INTO payments (invoice_id, amount, payment_method, reference_number, payment_date, notes)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                invoiceIds[i % invoiceIds.length],
                randomAmount(500, 5000),
                randomItem(paymentMethods),
                `REF-${Math.floor(Math.random() * 1000000)}`,
                formatDate(randomDate(sixMonthsAgo, now)),
                'Payment received with thanks.'
            ]);
        }

        console.log('  Created 15 payments');

        // =====================================================
        // SEED CALENDAR EVENTS (20 events)
        // =====================================================
        console.log('\nSeeding calendar events...');

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

        const threeMonthsFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

        for (let i = 0; i < 20; i++) {
            const startTime = randomDate(now, threeMonthsFromNow);
            const endTime = new Date(startTime.getTime() + (Math.random() * 3 + 1) * 60 * 60 * 1000);

            await client.query(`
                INSERT INTO calendar_events (
                    user_id, case_id, client_id, title, description, event_type,
                    location, start_time, end_time, all_day, reminder_minutes, status, color
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            `, [
                userId,
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

        console.log('  Created 20 calendar events');

        // =====================================================
        // SEED DEADLINES (15 deadlines)
        // =====================================================
        console.log('\nSeeding deadlines...');

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
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                userId,
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

        console.log('  Created 15 deadlines');

        // =====================================================
        // SEED TASKS (20 tasks)
        // =====================================================
        console.log('\nSeeding tasks...');

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
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                userId,
                caseIds[i % caseIds.length],
                userId,
                taskTitles[i],
                `Task details: ${taskTitles[i]}. Complete as soon as possible.`,
                randomItem(priorities),
                formatDate(randomDate(now, threeMonthsFromNow)),
                status,
                status === 'completed' ? formatDateTime(new Date()) : null
            ]);
        }

        console.log('  Created 20 tasks');

        // =====================================================
        // SEED MESSAGES (15 messages)
        // =====================================================
        console.log('\nSeeding messages...');

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
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                userId,
                clientIds[i % clientIds.length],
                caseIds[i % caseIds.length],
                messageSubjects[i],
                `Message content for "${messageSubjects[i]}". This is an important communication regarding your legal matter. Please review and respond at your earliest convenience.`,
                randomItem(['internal', 'client', 'system']),
                Math.random() > 0.3
            ]);
        }

        console.log('  Created 15 messages');

        // =====================================================
        // SEED NOTIFICATIONS (20 notifications)
        // =====================================================
        console.log('\nSeeding notifications...');

        const notificationTypes = ['deadline', 'payment', 'document', 'message', 'system', 'case_update'];
        const notificationTitles = [
            'Deadline Approaching: Discovery Response',
            'Payment Received',
            'New Document Uploaded',
            'New Message from Client',
            'System Maintenance Scheduled',
            'Case Status Updated',
            'Invoice Overdue',
            'Meeting in 1 Hour',
            'Document Signed',
            'New Case Assigned',
            'Court Date Reminder',
            'Task Completed',
            'Client Portal Activity',
            'Billing Entry Added',
            'Calendar Event Updated',
            'Document Review Required',
            'Settlement Offer',
            'Deposition Scheduled',
            'Expert Report Received',
            'Trial Date Set'
        ];

        for (let i = 0; i < 20; i++) {
            await client.query(`
                INSERT INTO notifications (
                    user_id, title, message, notification_type,
                    reference_type, reference_id, is_read
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                userId,
                notificationTitles[i],
                `Notification details: ${notificationTitles[i]}. Click to view more information.`,
                randomItem(notificationTypes),
                randomItem(['case', 'invoice', 'document', 'event']),
                caseIds[i % caseIds.length],
                Math.random() > 0.5
            ]);
        }

        console.log('  Created 20 notifications');

        // =====================================================
        // SEED ACTIVITY LOG (20 entries)
        // =====================================================
        console.log('\nSeeding activity log...');

        const actions = [
            'created_case', 'updated_case', 'created_client', 'updated_client',
            'created_document', 'uploaded_document', 'created_invoice', 'sent_invoice',
            'recorded_payment', 'created_time_entry', 'created_task', 'completed_task',
            'created_event', 'sent_message', 'logged_in', 'updated_settings'
        ];
        const entityTypes = ['case', 'client', 'document', 'invoice', 'time_entry', 'task', 'event', 'message'];

        for (let i = 0; i < 20; i++) {
            await client.query(`
                INSERT INTO activity_log (user_id, action, entity_type, entity_id, details, ip_address)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                userId,
                randomItem(actions),
                randomItem(entityTypes),
                caseIds[i % caseIds.length],
                JSON.stringify({ description: `Activity ${i + 1}`, timestamp: new Date().toISOString() }),
                '192.168.1.' + (i + 1)
            ]);
        }

        console.log('  Created 20 activity log entries');

        // =====================================================
        // SEED SAVED REPORTS (15 reports)
        // =====================================================
        console.log('\nSeeding saved reports...');

        const reportTypes = ['revenue', 'productivity', 'cases', 'clients', 'aging'];
        const reportNames = [
            'Monthly Revenue Summary',
            'Attorney Productivity Report',
            'Open Cases by Type',
            'Client Acquisition Report',
            'AR Aging Summary',
            'Quarterly Billing Report',
            'Time Entry Analysis',
            'Case Status Overview',
            'Top Clients by Revenue',
            'Unbilled Time Report',
            'Matter Profitability',
            'Collection Rate Analysis',
            'New Matters Report',
            'Closed Cases Summary',
            'Outstanding Invoices'
        ];

        for (let i = 0; i < 15; i++) {
            await client.query(`
                INSERT INTO reports (user_id, name, report_type, filters, is_favorite)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                userId,
                reportNames[i],
                randomItem(reportTypes),
                JSON.stringify({
                    dateRange: 'last_30_days',
                    groupBy: randomItem(['client', 'case', 'attorney', 'month']),
                    sortBy: randomItem(['amount', 'date', 'name'])
                }),
                i < 5
            ]);
        }

        console.log('  Created 15 saved reports');

        // =====================================================
        // SEED LEADS (25 leads)
        // =====================================================
        console.log('\nSeeding leads...');

        // Create leads table if it doesn't exist (fallback if migration failed)
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
                converted_to_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
                notes TEXT,
                priority VARCHAR(20) DEFAULT 'medium',
                follow_up_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        // Add form_id column if it doesn't exist (table might have been created without it)
        await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS form_id UUID`).catch(() => {});

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
            'Need representation for a DUI charge',
            'Looking for help with a slip and fall injury case',
            'Need assistance with commercial real estate transaction',
            'Seeking help with employment discrimination issue',
            'Need help with child custody modification',
            'Looking for representation in a contract dispute',
            'Need assistance with trademark registration',
            'Seeking help with wrongful termination case',
            'Need help settling a personal injury claim',
            'Looking for assistance with business acquisition',
            'Need representation in a criminal defense matter'
        ];

        const leadIds = [];
        for (let i = 0; i < 25; i++) {
            const lead = leadNames[i];
            const createdDate = randomDate(sixMonthsAgo, now);
            const status = randomItem(leadStatuses);

            const result = await client.query(`
                INSERT INTO leads (
                    user_id, first_name, last_name, email, phone, company,
                    practice_area, case_description, source, status, priority,
                    utm_source, utm_medium, utm_campaign, created_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                RETURNING id
            `, [
                userId,
                lead.first,
                lead.last,
                `${lead.first.toLowerCase()}.${lead.last.toLowerCase()}@email.com`,
                `555-${String(100 + i).padStart(3, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
                lead.company,
                randomItem(practiceAreas),
                randomItem(caseDescriptions),
                randomItem(leadSources),
                status,
                randomItem(leadPriorities),
                i % 3 === 0 ? 'google' : null,
                i % 3 === 0 ? 'cpc' : null,
                i % 3 === 0 ? 'legal_services' : null,
                formatDateTime(createdDate)
            ]);
            leadIds.push(result.rows[0].id);
        }

        console.log(`  Created ${leadIds.length} leads`);

        // Create lead_activities table if it doesn't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS lead_activities (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
                user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                activity_type VARCHAR(50),
                description TEXT,
                outcome VARCHAR(50),
                next_action TEXT,
                next_action_date TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        // Add missing columns if table already exists
        await client.query(`ALTER TABLE lead_activities ADD COLUMN IF NOT EXISTS next_action TEXT`).catch(() => {});
        await client.query(`ALTER TABLE lead_activities ADD COLUMN IF NOT EXISTS next_action_date TIMESTAMP`).catch(() => {});

        // Seed lead activities
        const leadActivityTypes = ['call', 'email', 'meeting', 'note', 'status_change'];
        for (let i = 0; i < 30; i++) {
            await client.query(`
                INSERT INTO lead_activities (lead_id, user_id, activity_type, description, outcome)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                leadIds[i % leadIds.length],
                userId,
                randomItem(leadActivityTypes),
                `Activity ${i + 1}: ${randomItem(['Initial contact made', 'Follow-up call scheduled', 'Sent information packet', 'Consultation completed', 'Proposal sent'])}`,
                randomItem(['positive', 'neutral', 'negative', null])
            ]);
        }
        console.log('  Created 30 lead activities');

        // =====================================================
        // SEED DOCUMENT VERSIONS (15 versions)
        // =====================================================
        console.log('\nSeeding document versions...');

        // Get some document IDs if they exist
        const docs = await client.query('SELECT id FROM document_history LIMIT 15');

        if (docs.rows.length > 0) {
            for (let i = 0; i < Math.min(15, docs.rows.length); i++) {
                await client.query(`
                    INSERT INTO document_versions (document_id, version_number, content, created_by, change_summary)
                    VALUES ($1, $2, $3, $4, $5)
                `, [
                    docs.rows[i].id,
                    i + 1,
                    'Document content for version ' + (i + 1),
                    userId,
                    `Version ${i + 1}: ${randomItem(['Initial draft', 'Added clauses', 'Client revisions', 'Final version', 'Minor corrections'])}`
                ]);
            }
            console.log(`  Created ${Math.min(15, docs.rows.length)} document versions`);
        } else {
            console.log('  No documents found to version');
        }

        // =====================================================
        // SEED DOCUMENT COMMENTS (15 comments)
        // =====================================================
        console.log('\nSeeding document comments...');

        if (docs.rows.length > 0) {
            const commentTexts = [
                'Please review section 3.2',
                'Updated per client instructions',
                'Needs attorney approval',
                'Added indemnification clause',
                'Removed confidentiality section per client request',
                'Grammar corrections applied',
                'Legal citation added',
                'Formatting updated',
                'Signature block added',
                'Exhibit references updated',
                'Definition section expanded',
                'Terms modified per negotiation',
                'Final review complete',
                'Ready for execution',
                'Minor typo corrections'
            ];

            for (let i = 0; i < Math.min(15, docs.rows.length); i++) {
                await client.query(`
                    INSERT INTO document_comments (document_id, user_id, content)
                    VALUES ($1, $2, $3)
                `, [
                    docs.rows[i % docs.rows.length].id,
                    userId,
                    commentTexts[i]
                ]);
            }
            console.log(`  Created ${Math.min(15, docs.rows.length)} document comments`);
        } else {
            console.log('  No documents found to comment on');
        }

        console.log('\n========================================');
        console.log('Database seeding completed successfully!');
        console.log('========================================');
        console.log('\nDemo User Credentials:');
        console.log('  Email: demo@legalforms.ai');
        console.log('  Password: Demo123!');
        console.log('\nSummary:');
        console.log('  - 20 Clients (15 individuals + 5 businesses)');
        console.log('  - 15 Client Contacts');
        console.log('  - 20 Cases');
        console.log('  - 20 Case Notes');
        console.log('  - 25 Time Entries');
        console.log('  - 15 Expenses');
        console.log('  - 15 Invoices');
        console.log('  - 20 Invoice Items');
        console.log('  - 15 Payments');
        console.log('  - 20 Calendar Events');
        console.log('  - 15 Deadlines');
        console.log('  - 20 Tasks');
        console.log('  - 15 Messages');
        console.log('  - 20 Notifications');
        console.log('  - 20 Activity Log Entries');
        console.log('  - 15 Saved Reports');
        console.log('  - Document Versions & Comments');

    } catch (error) {
        console.error('Error seeding database:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the seed
seedDatabase().catch(console.error);

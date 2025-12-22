/**
 * Seeds demo data for a new user by copying from the demo user
 */
const db = require('../config/database');

async function seedDemoDataForUser(userId) {
    try {
        console.log(`Seeding demo data for user: ${userId}`);

        // Get demo user ID
        const demoUserResult = await db.query(
            "SELECT id FROM users WHERE email = 'demo@legalforms.ai'"
        );

        if (demoUserResult.rows.length === 0) {
            console.log('Demo user not found, skipping demo data seed');
            return;
        }

        const demoUserId = demoUserResult.rows[0].id;

        // Check if user already has data
        const existingClients = await db.query(
            'SELECT COUNT(*) FROM clients WHERE user_id = $1',
            [userId]
        );

        if (parseInt(existingClients.rows[0].count) > 0) {
            console.log('User already has data, skipping demo data seed');
            return;
        }

        // Copy clients
        const clientMapping = {};
        const demoClients = await db.query(
            'SELECT * FROM clients WHERE user_id = $1',
            [demoUserId]
        );

        for (const c of demoClients.rows) {
            const result = await db.query(`
                INSERT INTO clients (user_id, client_type, first_name, last_name, company_name, email, phone, address, city, state, zip, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING id
            `, [userId, c.client_type, c.first_name, c.last_name, c.company_name, c.email, c.phone, c.address, c.city, c.state, c.zip, c.status]);
            clientMapping[c.id] = result.rows[0].id;
        }
        console.log(`  Copied ${Object.keys(clientMapping).length} clients`);

        // Copy cases
        const caseMapping = {};
        const demoCases = await db.query(
            'SELECT * FROM cases WHERE user_id = $1',
            [demoUserId]
        );

        for (const c of demoCases.rows) {
            const newClientId = clientMapping[c.client_id] || null;
            const result = await db.query(`
                INSERT INTO cases (user_id, client_id, case_number, title, description, case_type, status, priority,
                    court_name, court_case_number, judge_name, opposing_party, opposing_counsel,
                    date_opened, date_closed, statute_of_limitations, billing_type, billing_rate, notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
                RETURNING id
            `, [userId, newClientId, c.case_number, c.title, c.description, c.case_type, c.status, c.priority,
                c.court_name, c.court_case_number, c.judge_name, c.opposing_party, c.opposing_counsel,
                c.date_opened, c.date_closed, c.statute_of_limitations, c.billing_type, c.billing_rate, c.notes]);
            caseMapping[c.id] = result.rows[0].id;
        }
        console.log(`  Copied ${Object.keys(caseMapping).length} cases`);

        // Copy time entries
        const demoTimeEntries = await db.query(
            'SELECT * FROM time_entries WHERE user_id = $1',
            [demoUserId]
        );

        for (const t of demoTimeEntries.rows) {
            const newCaseId = caseMapping[t.case_id] || null;
            const newClientId = clientMapping[t.client_id] || null;
            await db.query(`
                INSERT INTO time_entries (user_id, case_id, client_id, description, duration_minutes, hourly_rate, amount, date, is_billable, is_billed, activity_type)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `, [userId, newCaseId, newClientId, t.description, t.duration_minutes, t.hourly_rate, t.amount, t.date, t.is_billable, t.is_billed, t.activity_type]);
        }
        console.log(`  Copied ${demoTimeEntries.rows.length} time entries`);

        // Copy invoices
        const invoiceMapping = {};
        const demoInvoices = await db.query(
            'SELECT * FROM invoices WHERE user_id = $1',
            [demoUserId]
        );

        for (const inv of demoInvoices.rows) {
            const newClientId = clientMapping[inv.client_id] || null;
            const newCaseId = caseMapping[inv.case_id] || null;
            const result = await db.query(`
                INSERT INTO invoices (user_id, client_id, case_id, invoice_number, status, subtotal, tax_rate, tax_amount, total, amount_paid, due_date, paid_date, notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING id
            `, [userId, newClientId, newCaseId, inv.invoice_number, inv.status, inv.subtotal, inv.tax_rate, inv.tax_amount, inv.total, inv.amount_paid, inv.due_date, inv.paid_date, inv.notes]);
            invoiceMapping[inv.id] = result.rows[0].id;
        }
        console.log(`  Copied ${Object.keys(invoiceMapping).length} invoices`);

        // Copy calendar events
        const demoEvents = await db.query(
            'SELECT * FROM calendar_events WHERE user_id = $1',
            [demoUserId]
        );

        for (const e of demoEvents.rows) {
            const newCaseId = caseMapping[e.case_id] || null;
            const newClientId = clientMapping[e.client_id] || null;
            await db.query(`
                INSERT INTO calendar_events (user_id, case_id, client_id, title, description, event_type, location, start_time, end_time, all_day, reminder_minutes, status, color)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            `, [userId, newCaseId, newClientId, e.title, e.description, e.event_type, e.location, e.start_time, e.end_time, e.all_day, e.reminder_minutes, e.status, e.color]);
        }
        console.log(`  Copied ${demoEvents.rows.length} calendar events`);

        // Copy tasks
        const demoTasks = await db.query(
            'SELECT * FROM tasks WHERE user_id = $1',
            [demoUserId]
        );

        for (const t of demoTasks.rows) {
            const newCaseId = caseMapping[t.case_id] || null;
            await db.query(`
                INSERT INTO tasks (user_id, case_id, assigned_to, title, description, priority, due_date, status, completed_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [userId, newCaseId, userId, t.title, t.description, t.priority, t.due_date, t.status, t.completed_at]);
        }
        console.log(`  Copied ${demoTasks.rows.length} tasks`);

        // Copy leads
        const demoLeads = await db.query(
            'SELECT * FROM leads WHERE user_id = $1',
            [demoUserId]
        );

        for (const l of demoLeads.rows) {
            await db.query(`
                INSERT INTO leads (user_id, first_name, last_name, email, phone, company, practice_area, case_description, source, status, priority)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `, [userId, l.first_name, l.last_name, l.email, l.phone, l.company, l.practice_area, l.case_description, l.source, l.status, l.priority]);
        }
        console.log(`  Copied ${demoLeads.rows.length} leads`);

        console.log(`Demo data seeding complete for user: ${userId}`);
        return true;

    } catch (error) {
        console.error('Error seeding demo data for user:', error);
        return false;
    }
}

module.exports = { seedDemoDataForUser };

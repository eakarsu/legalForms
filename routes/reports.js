/**
 * Reports & Analytics Routes
 * Handles revenue, productivity, case, and client reports
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// =====================================================
// PAGE ROUTES
// =====================================================

// Reports dashboard
router.get('/reports', requireAuth, async (req, res) => {
    try {
        // Get key metrics
        const metricsResult = await db.query(`
            SELECT
                (SELECT COALESCE(SUM(amount_paid), 0) FROM invoices WHERE user_id = $1 AND status = 'paid' AND paid_date >= DATE_TRUNC('year', CURRENT_DATE)) as totalRevenue,
                (SELECT COALESCE(SUM(duration_minutes) / 60.0, 0) FROM time_entries WHERE user_id = $1 AND date >= DATE_TRUNC('year', CURRENT_DATE)) as totalHours,
                (SELECT COUNT(*) FROM cases WHERE user_id = $1 AND status = 'open') as activeCases,
                (SELECT COALESCE(SUM(total - amount_paid), 0) FROM invoices WHERE user_id = $1 AND status IN ('sent', 'overdue')) as outstandingAR
        `, [req.user.id]);

        // Get saved reports
        const savedReportsResult = await db.query(
            'SELECT * FROM reports WHERE user_id = $1 ORDER BY is_favorite DESC, created_at DESC LIMIT 10',
            [req.user.id]
        );

        res.render('reports/dashboard', {
            title: 'Reports',
            metrics: metricsResult.rows[0] || { totalRevenue: 0, totalHours: 0, activeCases: 0, outstandingAR: 0 },
            savedReports: savedReportsResult.rows,
            req
        });
    } catch (error) {
        console.error('Error loading reports dashboard:', error);
        res.status(500).render('error', { message: 'Error loading reports' });
    }
});

// Revenue report page
router.get('/reports/revenue', requireAuth, async (req, res) => {
    try {
        const { start_date, end_date, group_by = 'month' } = req.query;

        let dateFilter = '';
        const params = [req.user.id];

        if (start_date && end_date) {
            dateFilter = 'AND i.created_at >= $2 AND i.created_at <= $3';
            params.push(start_date, end_date);
        }

        // Summary totals
        const summaryResult = await db.query(`
            SELECT
                COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.amount_paid ELSE 0 END), 0) as totalRevenue,
                COALESCE(SUM(i.total), 0) as totalBilled,
                COALESCE(SUM(CASE WHEN i.status IN ('sent', 'overdue') THEN i.total - i.amount_paid ELSE 0 END), 0) as totalOutstanding
            FROM invoices i
            WHERE i.user_id = $1 ${dateFilter}
        `, params);

        // Data grouped by month/client/case
        let dataQuery;
        if (group_by === 'client') {
            dataQuery = `
                SELECT
                    COALESCE(cl.company_name, cl.first_name || ' ' || cl.last_name) as label,
                    COALESCE(SUM(i.total), 0) as billed,
                    COALESCE(SUM(i.amount_paid), 0) as collected,
                    COALESCE(SUM(i.total - i.amount_paid), 0) as outstanding
                FROM invoices i
                LEFT JOIN clients cl ON i.client_id = cl.id
                WHERE i.user_id = $1 ${dateFilter}
                GROUP BY cl.id, cl.company_name, cl.first_name, cl.last_name
                HAVING SUM(i.total) > 0
                ORDER BY billed DESC
            `;
        } else if (group_by === 'case') {
            dataQuery = `
                SELECT
                    COALESCE(c.title, 'No Case') as label,
                    COALESCE(SUM(i.total), 0) as billed,
                    COALESCE(SUM(i.amount_paid), 0) as collected,
                    COALESCE(SUM(i.total - i.amount_paid), 0) as outstanding
                FROM invoices i
                LEFT JOIN cases c ON i.case_id = c.id
                WHERE i.user_id = $1 ${dateFilter}
                GROUP BY c.id, c.title
                HAVING SUM(i.total) > 0
                ORDER BY billed DESC
            `;
        } else {
            dataQuery = `
                SELECT
                    TO_CHAR(DATE_TRUNC('month', i.created_at), 'Mon YYYY') as label,
                    COALESCE(SUM(i.total), 0) as billed,
                    COALESCE(SUM(i.amount_paid), 0) as collected,
                    COALESCE(SUM(i.total - i.amount_paid), 0) as outstanding
                FROM invoices i
                WHERE i.user_id = $1 ${dateFilter}
                GROUP BY DATE_TRUNC('month', i.created_at)
                ORDER BY DATE_TRUNC('month', i.created_at) DESC
                LIMIT 12
            `;
        }

        const dataResult = await db.query(dataQuery, params);

        res.render('reports/revenue', {
            title: 'Revenue Report',
            summary: summaryResult.rows[0] || { totalRevenue: 0, totalBilled: 0, totalOutstanding: 0 },
            data: dataResult.rows,
            filters: { start_date, end_date, group_by },
            req
        });
    } catch (error) {
        console.error('Error loading revenue report:', error);
        res.status(500).render('error', { message: 'Error loading report' });
    }
});

// Productivity report page
router.get('/reports/productivity', requireAuth, async (req, res) => {
    try {
        const { start_date, end_date, view_by = 'attorney' } = req.query;

        let dateFilter = "AND te.date >= DATE_TRUNC('month', CURRENT_DATE)";
        const params = [req.user.id];

        if (start_date && end_date) {
            dateFilter = 'AND te.date >= $2 AND te.date <= $3';
            params.push(start_date, end_date);
        }

        // Summary stats
        const summaryResult = await db.query(`
            SELECT
                COALESCE(SUM(te.duration_minutes) / 60.0, 0) as totalHours,
                COALESCE(SUM(CASE WHEN te.is_billable THEN te.duration_minutes ELSE 0 END) / 60.0, 0) as billableHours,
                CASE WHEN SUM(te.duration_minutes) > 0
                    THEN ROUND(SUM(CASE WHEN te.is_billable THEN te.duration_minutes ELSE 0 END) * 100.0 / SUM(te.duration_minutes))
                    ELSE 0 END as utilizationRate,
                COALESCE(SUM(te.amount), 0) as billableValue
            FROM time_entries te
            WHERE te.user_id = $1 ${dateFilter}
        `, params);

        // Data by activity type or attorney
        let dataQuery;
        if (view_by === 'activity') {
            dataQuery = `
                SELECT
                    COALESCE(te.activity_type, 'Other') as label,
                    COALESCE(SUM(te.duration_minutes) / 60.0, 0) as totalHours,
                    COALESCE(SUM(CASE WHEN te.is_billable THEN te.duration_minutes ELSE 0 END) / 60.0, 0) as billableHours,
                    COALESCE(SUM(CASE WHEN NOT te.is_billable THEN te.duration_minutes ELSE 0 END) / 60.0, 0) as nonBillableHours,
                    COALESCE(SUM(te.amount), 0) as value
                FROM time_entries te
                WHERE te.user_id = $1 ${dateFilter}
                GROUP BY te.activity_type
                ORDER BY totalHours DESC
            `;
        } else {
            dataQuery = `
                SELECT
                    'You' as label,
                    COALESCE(SUM(te.duration_minutes) / 60.0, 0) as totalHours,
                    COALESCE(SUM(CASE WHEN te.is_billable THEN te.duration_minutes ELSE 0 END) / 60.0, 0) as billableHours,
                    COALESCE(SUM(CASE WHEN NOT te.is_billable THEN te.duration_minutes ELSE 0 END) / 60.0, 0) as nonBillableHours,
                    COALESCE(SUM(te.amount), 0) as value
                FROM time_entries te
                WHERE te.user_id = $1 ${dateFilter}
            `;
        }

        const dataResult = await db.query(dataQuery, params);

        // Activity breakdown for pie chart
        const activityResult = await db.query(`
            SELECT
                COALESCE(te.activity_type, 'Other') as type,
                COALESCE(SUM(te.duration_minutes) / 60.0, 0) as hours
            FROM time_entries te
            WHERE te.user_id = $1 ${dateFilter}
            GROUP BY te.activity_type
            ORDER BY hours DESC
        `, params);

        res.render('reports/productivity', {
            title: 'Productivity Report',
            summary: summaryResult.rows[0] || { totalHours: 0, billableHours: 0, utilizationRate: 0, billableValue: 0 },
            data: dataResult.rows,
            activityBreakdown: activityResult.rows,
            filters: { start_date, end_date, view_by },
            req
        });
    } catch (error) {
        console.error('Error loading productivity report:', error);
        res.status(500).render('error', { message: 'Error loading report' });
    }
});

// Cases report page
router.get('/reports/cases', requireAuth, async (req, res) => {
    try {
        // Summary stats
        const summaryResult = await db.query(`
            SELECT
                COUNT(*) FILTER (WHERE status = 'open') as open,
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COUNT(*) FILTER (WHERE status = 'closed') as closed,
                COUNT(*) FILTER (WHERE status = 'archived') as archived,
                COUNT(*) as total,
                COALESCE(AVG(CASE WHEN date_closed IS NOT NULL THEN date_closed - date_opened END), 0) as avgDays,
                COALESCE(AVG(retainer_amount), 0) as avgValue
            FROM cases
            WHERE user_id = $1
        `, [req.user.id]);

        // Cases by type
        const byTypeResult = await db.query(`
            SELECT
                COALESCE(case_type, 'Unspecified') as case_type,
                COUNT(*) as count,
                COUNT(*) FILTER (WHERE status = 'open') as open,
                COUNT(*) FILTER (WHERE status = 'closed') as closed,
                COALESCE(AVG(CASE WHEN date_closed IS NOT NULL THEN date_closed - date_opened END), 0) as avgDays,
                COALESCE(SUM(retainer_amount), 0) as totalValue
            FROM cases
            WHERE user_id = $1
            GROUP BY case_type
            ORDER BY count DESC
        `, [req.user.id]);

        // Recently closed cases
        const recentClosedResult = await db.query(`
            SELECT
                c.id, c.title, c.case_type, c.date_opened, c.date_closed,
                COALESCE(cl.company_name, cl.first_name || ' ' || cl.last_name) as client_name,
                CASE WHEN c.date_closed IS NOT NULL THEN c.date_closed - c.date_opened ELSE NULL END as duration,
                COALESCE(SUM(te.amount), 0) as total_billed
            FROM cases c
            LEFT JOIN clients cl ON c.client_id = cl.id
            LEFT JOIN time_entries te ON c.id = te.case_id
            WHERE c.user_id = $1 AND c.status = 'closed'
            GROUP BY c.id, cl.company_name, cl.first_name, cl.last_name
            ORDER BY c.date_closed DESC
            LIMIT 10
        `, [req.user.id]);

        res.render('reports/cases', {
            title: 'Case Analytics',
            summary: summaryResult.rows[0] || { open: 0, pending: 0, closed: 0, archived: 0, total: 0, avgDays: 0, avgValue: 0 },
            byType: byTypeResult.rows,
            recentClosed: recentClosedResult.rows,
            req
        });
    } catch (error) {
        console.error('Error loading cases report:', error);
        res.status(500).render('error', { message: 'Error loading report' });
    }
});

// Clients report page
router.get('/reports/clients', requireAuth, async (req, res) => {
    try {
        // Summary stats
        const summaryResult = await db.query(`
            SELECT
                COUNT(*) as totalClients,
                COUNT(*) FILTER (WHERE status = 'active') as activeClients,
                COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)) as newThisMonth,
                COALESCE((SELECT AVG(client_total) FROM (
                    SELECT COALESCE(SUM(te.amount), 0) as client_total
                    FROM clients c
                    LEFT JOIN time_entries te ON c.id = te.client_id
                    WHERE c.user_id = $1
                    GROUP BY c.id
                    HAVING SUM(te.amount) > 0
                ) sub), 0) as avgRevenue
            FROM clients
            WHERE user_id = $1
        `, [req.user.id]);

        // Clients by type
        const byTypeResult = await db.query(`
            SELECT client_type, COUNT(*) as count
            FROM clients
            WHERE user_id = $1
            GROUP BY client_type
            ORDER BY count DESC
        `, [req.user.id]);

        // Top clients by revenue
        const topClientsResult = await db.query(`
            SELECT
                c.id,
                c.first_name, c.last_name, c.company_name,
                c.client_type,
                COUNT(DISTINCT cs.id) as case_count,
                COALESCE(SUM(te.duration_minutes) / 60.0, 0) as total_hours,
                COALESCE(SUM(te.amount), 0) as total_revenue,
                COALESCE(SUM(CASE WHEN i.status IN ('sent', 'overdue') THEN i.total - i.amount_paid ELSE 0 END), 0) as outstanding
            FROM clients c
            LEFT JOIN cases cs ON c.id = cs.client_id
            LEFT JOIN time_entries te ON c.id = te.client_id
            LEFT JOIN invoices i ON c.id = i.client_id
            WHERE c.user_id = $1
            GROUP BY c.id
            ORDER BY total_revenue DESC
            LIMIT 10
        `, [req.user.id]);

        // Recent clients
        const recentClientsResult = await db.query(`
            SELECT id, first_name, last_name, company_name, client_type, email, status, created_at
            FROM clients
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 10
        `, [req.user.id]);

        // Client acquisition trend
        const acquisitionResult = await db.query(`
            SELECT
                TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') as month,
                COUNT(*) as count
            FROM clients
            WHERE user_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '12 months'
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY DATE_TRUNC('month', created_at)
        `, [req.user.id]);

        res.render('reports/clients', {
            title: 'Client Analytics',
            summary: summaryResult.rows[0] || { totalClients: 0, activeClients: 0, newThisMonth: 0, avgRevenue: 0 },
            byType: byTypeResult.rows,
            topClients: topClientsResult.rows,
            recentClients: recentClientsResult.rows,
            acquisition: acquisitionResult.rows,
            req
        });
    } catch (error) {
        console.error('Error loading clients report:', error);
        res.status(500).render('error', { message: 'Error loading report' });
    }
});

// Revenue CSV export
router.get('/reports/revenue/export-csv', requireAuth, async (req, res) => {
    console.log('CSV Export requested: Revenue - Starting...');
    try {
        const { start_date, end_date, group_by = 'month' } = req.query;

        let dateFilter = '';
        const params = [req.user.id];

        if (start_date && end_date) {
            dateFilter = 'AND i.created_at >= $2 AND i.created_at <= $3';
            params.push(start_date, end_date);
        }

        // Summary totals
        const summaryResult = await db.query(`
            SELECT
                COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.amount_paid ELSE 0 END), 0) as totalRevenue,
                COALESCE(SUM(i.total), 0) as totalBilled,
                COALESCE(SUM(CASE WHEN i.status IN ('sent', 'overdue') THEN i.total - i.amount_paid ELSE 0 END), 0) as totalOutstanding
            FROM invoices i
            WHERE i.user_id = $1 ${dateFilter}
        `, params);

        // Data grouped by month/client/case
        let dataQuery;
        if (group_by === 'client') {
            dataQuery = `
                SELECT
                    COALESCE(cl.company_name, cl.first_name || ' ' || cl.last_name) as label,
                    COALESCE(SUM(i.total), 0) as billed,
                    COALESCE(SUM(i.amount_paid), 0) as collected,
                    COALESCE(SUM(i.total - i.amount_paid), 0) as outstanding
                FROM invoices i
                LEFT JOIN clients cl ON i.client_id = cl.id
                WHERE i.user_id = $1 ${dateFilter}
                GROUP BY cl.id, cl.company_name, cl.first_name, cl.last_name
                HAVING SUM(i.total) > 0
                ORDER BY billed DESC
            `;
        } else if (group_by === 'case') {
            dataQuery = `
                SELECT
                    COALESCE(c.title, 'No Case') as label,
                    COALESCE(SUM(i.total), 0) as billed,
                    COALESCE(SUM(i.amount_paid), 0) as collected,
                    COALESCE(SUM(i.total - i.amount_paid), 0) as outstanding
                FROM invoices i
                LEFT JOIN cases c ON i.case_id = c.id
                WHERE i.user_id = $1 ${dateFilter}
                GROUP BY c.id, c.title
                HAVING SUM(i.total) > 0
                ORDER BY billed DESC
            `;
        } else {
            dataQuery = `
                SELECT
                    TO_CHAR(DATE_TRUNC('month', i.created_at), 'Mon YYYY') as label,
                    COALESCE(SUM(i.total), 0) as billed,
                    COALESCE(SUM(i.amount_paid), 0) as collected,
                    COALESCE(SUM(i.total - i.amount_paid), 0) as outstanding
                FROM invoices i
                WHERE i.user_id = $1 ${dateFilter}
                GROUP BY DATE_TRUNC('month', i.created_at)
                ORDER BY DATE_TRUNC('month', i.created_at) DESC
                LIMIT 12
            `;
        }

        const dataResult = await db.query(dataQuery, params);
        const summary = summaryResult.rows[0] || { totalRevenue: 0, totalBilled: 0, totalOutstanding: 0 };
        const data = dataResult.rows;

        let csv = 'Revenue Report\n';
        csv += 'Generated: ' + new Date().toLocaleString() + '\n\n';

        csv += 'Summary\n';
        csv += 'Total Revenue,Total Billed,Outstanding\n';
        csv += `$${summary.totalRevenue || 0},$${summary.totalBilled || 0},$${summary.totalOutstanding || 0}\n\n`;

        const labelHeader = group_by === 'month' ? 'Month' : group_by === 'client' ? 'Client' : 'Case';
        csv += 'Revenue Details\n';
        csv += `${labelHeader},Billed,Collected,Outstanding,Collection Rate\n`;
        data.forEach(row => {
            const rate = row.billed > 0 ? Math.round((row.collected / row.billed) * 100) : 0;
            csv += `"${(row.label || '').replace(/"/g, '""')}",$${row.billed || 0},$${row.collected || 0},$${row.outstanding || 0},${rate}%\n`;
        });

        console.log('CSV Export: Setting headers and sending file...');
        // Force download with octet-stream
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'attachment; filename="revenue-report.csv"');
        res.setHeader('Content-Length', Buffer.byteLength(csv, 'utf8'));
        res.setHeader('X-Download-Options', 'noopen'); // Override helmet
        console.log('CSV Export: Sending CSV with length:', csv.length);
        res.end(csv);
        console.log('CSV Export: Complete!');
    } catch (error) {
        console.error('Error exporting revenue CSV:', error);
        res.status(500).send('Error exporting CSV');
    }
});

// Productivity CSV export
router.get('/reports/productivity/export-csv', requireAuth, async (req, res) => {
    try {
        const { start_date, end_date, view_by = 'attorney' } = req.query;

        let dateFilter = "AND te.date >= DATE_TRUNC('month', CURRENT_DATE)";
        const params = [req.user.id];

        if (start_date && end_date) {
            dateFilter = 'AND te.date >= $2 AND te.date <= $3';
            params.push(start_date, end_date);
        }

        // Summary stats
        const summaryResult = await db.query(`
            SELECT
                COALESCE(SUM(te.duration_minutes) / 60.0, 0) as totalHours,
                COALESCE(SUM(CASE WHEN te.is_billable THEN te.duration_minutes ELSE 0 END) / 60.0, 0) as billableHours,
                CASE WHEN SUM(te.duration_minutes) > 0
                    THEN ROUND(SUM(CASE WHEN te.is_billable THEN te.duration_minutes ELSE 0 END) * 100.0 / SUM(te.duration_minutes))
                    ELSE 0 END as utilizationRate,
                COALESCE(SUM(te.amount), 0) as billableValue
            FROM time_entries te
            WHERE te.user_id = $1 ${dateFilter}
        `, params);

        // Data by activity type or attorney
        let dataQuery;
        if (view_by === 'activity') {
            dataQuery = `
                SELECT
                    COALESCE(te.activity_type, 'Other') as label,
                    COALESCE(SUM(te.duration_minutes) / 60.0, 0) as totalHours,
                    COALESCE(SUM(CASE WHEN te.is_billable THEN te.duration_minutes ELSE 0 END) / 60.0, 0) as billableHours,
                    COALESCE(SUM(CASE WHEN NOT te.is_billable THEN te.duration_minutes ELSE 0 END) / 60.0, 0) as nonBillableHours,
                    COALESCE(SUM(te.amount), 0) as value
                FROM time_entries te
                WHERE te.user_id = $1 ${dateFilter}
                GROUP BY te.activity_type
                ORDER BY totalHours DESC
            `;
        } else {
            dataQuery = `
                SELECT
                    'You' as label,
                    COALESCE(SUM(te.duration_minutes) / 60.0, 0) as totalHours,
                    COALESCE(SUM(CASE WHEN te.is_billable THEN te.duration_minutes ELSE 0 END) / 60.0, 0) as billableHours,
                    COALESCE(SUM(CASE WHEN NOT te.is_billable THEN te.duration_minutes ELSE 0 END) / 60.0, 0) as nonBillableHours,
                    COALESCE(SUM(te.amount), 0) as value
                FROM time_entries te
                WHERE te.user_id = $1 ${dateFilter}
            `;
        }

        const dataResult = await db.query(dataQuery, params);
        const summary = summaryResult.rows[0] || { totalHours: 0, billableHours: 0, utilizationRate: 0, billableValue: 0 };
        const data = dataResult.rows;

        let csv = 'Productivity Report\n';
        csv += 'Generated: ' + new Date().toLocaleString() + '\n\n';

        csv += 'Summary\n';
        csv += 'Total Hours,Billable Hours,Utilization Rate,Billable Value\n';
        csv += `${summary.totalHours || 0},${summary.billableHours || 0},${summary.utilizationRate || 0}%,$${summary.billableValue || 0}\n\n`;

        const labelHeader = view_by === 'attorney' ? 'Attorney' : 'Activity Type';
        csv += 'Detailed Breakdown\n';
        csv += `${labelHeader},Total Hours,Billable Hours,Non-Billable,Billable %,Value\n`;
        data.forEach(row => {
            const rate = row.totalhours > 0 ? Math.round((row.billablehours / row.totalhours) * 100) : 0;
            csv += `"${(row.label || '').replace(/"/g, '""')}",${row.totalhours || 0},${row.billablehours || 0},${row.nonbillablehours || 0},${rate}%,$${row.value || 0}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=productivity-report.csv');
        res.send(csv);
    } catch (error) {
        console.error('Error exporting productivity CSV:', error);
        res.status(500).send('Error exporting CSV');
    }
});

// Cases CSV export
router.get('/reports/cases/export-csv', requireAuth, async (req, res) => {
    // Disable compression for this response
    res.removeHeader('Content-Encoding');
    res.set('Cache-Control', 'no-store');
    try {
        // Summary stats
        const summaryResult = await db.query(`
            SELECT
                COUNT(*) FILTER (WHERE status = 'open') as open,
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COUNT(*) FILTER (WHERE status = 'closed') as closed,
                COUNT(*) FILTER (WHERE status = 'archived') as archived,
                COUNT(*) as total,
                COALESCE(AVG(CASE WHEN date_closed IS NOT NULL THEN date_closed - date_opened END), 0) as avgDays,
                COALESCE(AVG(retainer_amount), 0) as avgValue
            FROM cases
            WHERE user_id = $1
        `, [req.user.id]);

        // Cases by type
        const byTypeResult = await db.query(`
            SELECT
                COALESCE(case_type, 'Unspecified') as case_type,
                COUNT(*) as count,
                COUNT(*) FILTER (WHERE status = 'open') as open,
                COUNT(*) FILTER (WHERE status = 'closed') as closed,
                COALESCE(AVG(CASE WHEN date_closed IS NOT NULL THEN date_closed - date_opened END), 0) as avgDays,
                COALESCE(SUM(retainer_amount), 0) as totalValue
            FROM cases
            WHERE user_id = $1
            GROUP BY case_type
            ORDER BY count DESC
        `, [req.user.id]);

        // Recently closed cases
        const recentClosedResult = await db.query(`
            SELECT
                c.id, c.title, c.case_type, c.date_opened, c.date_closed,
                COALESCE(cl.company_name, cl.first_name || ' ' || cl.last_name) as client_name,
                CASE WHEN c.date_closed IS NOT NULL THEN c.date_closed - c.date_opened ELSE NULL END as duration,
                COALESCE(SUM(te.amount), 0) as total_billed
            FROM cases c
            LEFT JOIN clients cl ON c.client_id = cl.id
            LEFT JOIN time_entries te ON c.id = te.case_id
            WHERE c.user_id = $1 AND c.status = 'closed'
            GROUP BY c.id, cl.company_name, cl.first_name, cl.last_name
            ORDER BY c.date_closed DESC
            LIMIT 10
        `, [req.user.id]);

        const summary = summaryResult.rows[0] || { open: 0, pending: 0, closed: 0, total: 0, avgdays: 0, avgvalue: 0 };
        const byType = byTypeResult.rows;
        const recentClosed = recentClosedResult.rows;

        let csv = 'Case Analytics Report\n';
        csv += 'Generated: ' + new Date().toLocaleString() + '\n\n';

        csv += 'Summary\n';
        csv += 'Open,Pending,Closed,Total,Avg Days Open,Avg Value\n';
        csv += `${summary.open || 0},${summary.pending || 0},${summary.closed || 0},${summary.total || 0},${summary.avgdays || 0},$${summary.avgvalue || 0}\n\n`;

        csv += 'Cases by Type\n';
        csv += 'Case Type,Count,Open,Closed,Avg Duration (Days),Total Value\n';
        byType.forEach(row => {
            csv += `"${(row.case_type || 'Unspecified').replace(/"/g, '""')}",${row.count},${row.open || 0},${row.closed || 0},${row.avgdays || 0},$${row.totalvalue || 0}\n`;
        });

        csv += '\nRecently Closed Cases\n';
        csv += 'Case Title,Client,Type,Date Opened,Date Closed,Duration (Days),Total Billed\n';
        recentClosed.forEach(c => {
            csv += `"${(c.title || '').replace(/"/g, '""')}","${(c.client_name || '').replace(/"/g, '""')}","${c.case_type || ''}","${c.date_opened ? new Date(c.date_opened).toLocaleDateString() : ''}","${c.date_closed ? new Date(c.date_closed).toLocaleDateString() : ''}",${c.duration || 0},$${c.total_billed || 0}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=case-analytics.csv');
        res.send(csv);
    } catch (error) {
        console.error('Error exporting cases CSV:', error);
        res.status(500).send('Error exporting CSV');
    }
});

// Clients CSV export
router.get('/reports/clients/export-csv', requireAuth, async (req, res) => {
    try {
        // Top clients by revenue
        const topClientsResult = await db.query(`
            SELECT
                c.first_name, c.last_name, c.company_name,
                c.client_type,
                COUNT(DISTINCT cs.id) as case_count,
                COALESCE(SUM(te.duration_minutes) / 60.0, 0) as total_hours,
                COALESCE(SUM(te.amount), 0) as total_revenue,
                COALESCE(SUM(CASE WHEN i.status IN ('sent', 'overdue') THEN i.total - i.amount_paid ELSE 0 END), 0) as outstanding
            FROM clients c
            LEFT JOIN cases cs ON c.id = cs.client_id
            LEFT JOIN time_entries te ON c.id = te.client_id
            LEFT JOIN invoices i ON c.id = i.client_id
            WHERE c.user_id = $1
            GROUP BY c.id, c.first_name, c.last_name, c.company_name, c.client_type
            ORDER BY total_revenue DESC
        `, [req.user.id]);

        // Recent clients
        const recentClientsResult = await db.query(`
            SELECT first_name, last_name, company_name, client_type, email, status, created_at
            FROM clients
            WHERE user_id = $1
            ORDER BY created_at DESC
        `, [req.user.id]);

        let csv = 'Client Analytics Report\n';
        csv += 'Generated: ' + new Date().toLocaleString() + '\n\n';

        csv += 'Top Clients by Revenue\n';
        csv += 'Client Name,Type,Cases,Hours,Revenue,Outstanding\n';
        topClientsResult.rows.forEach(c => {
            const name = c.company_name || (c.first_name + ' ' + c.last_name);
            csv += `"${name.replace(/"/g, '""')}","${c.client_type}",${c.case_count || 0},${parseFloat(c.total_hours || 0).toFixed(1)},$${c.total_revenue || 0},$${c.outstanding || 0}\n`;
        });

        csv += '\nRecent Clients\n';
        csv += 'Client Name,Type,Email,Status,Added\n';
        recentClientsResult.rows.forEach(c => {
            const name = c.company_name || (c.first_name + ' ' + c.last_name);
            csv += `"${name.replace(/"/g, '""')}","${c.client_type}","${c.email || ''}","${c.status}","${new Date(c.created_at).toLocaleDateString()}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=client-analytics.csv');
        res.send(csv);
    } catch (error) {
        console.error('Error exporting clients CSV:', error);
        res.status(500).send('Error exporting CSV');
    }
});

// =====================================================
// REPORTS API
// =====================================================

// Revenue report data
router.get('/api/reports/revenue', requireAuth, async (req, res) => {
    try {
        const { period = 'month', group_by = 'client', date_from, date_to } = req.query;

        let dateFilter = '';
        const params = [req.user.id];
        let paramIndex = 2;

        // Set date range based on period
        if (date_from && date_to) {
            dateFilter = ` AND te.date >= $${paramIndex} AND te.date <= $${paramIndex + 1}`;
            params.push(date_from, date_to);
            paramIndex += 2;
        } else {
            switch (period) {
                case 'week':
                    dateFilter = " AND te.date >= DATE_TRUNC('week', CURRENT_DATE)";
                    break;
                case 'month':
                    dateFilter = " AND te.date >= DATE_TRUNC('month', CURRENT_DATE)";
                    break;
                case 'quarter':
                    dateFilter = " AND te.date >= DATE_TRUNC('quarter', CURRENT_DATE)";
                    break;
                case 'year':
                    dateFilter = " AND te.date >= DATE_TRUNC('year', CURRENT_DATE)";
                    break;
            }
        }

        let query;
        if (group_by === 'client') {
            query = `
                SELECT
                    cl.id,
                    COALESCE(cl.company_name, cl.first_name || ' ' || cl.last_name) as name,
                    COALESCE(SUM(te.amount), 0) as total_amount,
                    COALESCE(SUM(te.duration_minutes), 0) as total_minutes,
                    COUNT(te.id) as entry_count
                FROM clients cl
                LEFT JOIN time_entries te ON cl.id = te.client_id AND te.user_id = $1 ${dateFilter}
                WHERE cl.user_id = $1
                GROUP BY cl.id
                HAVING SUM(te.amount) > 0
                ORDER BY total_amount DESC
            `;
        } else if (group_by === 'case') {
            query = `
                SELECT
                    c.id,
                    c.title as name,
                    c.case_number,
                    COALESCE(SUM(te.amount), 0) as total_amount,
                    COALESCE(SUM(te.duration_minutes), 0) as total_minutes,
                    COUNT(te.id) as entry_count
                FROM cases c
                LEFT JOIN time_entries te ON c.id = te.case_id AND te.user_id = $1 ${dateFilter}
                WHERE c.user_id = $1
                GROUP BY c.id
                HAVING SUM(te.amount) > 0
                ORDER BY total_amount DESC
            `;
        } else if (group_by === 'month') {
            query = `
                SELECT
                    DATE_TRUNC('month', te.date) as month,
                    COALESCE(SUM(te.amount), 0) as total_amount,
                    COALESCE(SUM(te.duration_minutes), 0) as total_minutes,
                    COUNT(te.id) as entry_count
                FROM time_entries te
                WHERE te.user_id = $1 ${dateFilter}
                GROUP BY DATE_TRUNC('month', te.date)
                ORDER BY month DESC
            `;
        } else {
            query = `
                SELECT
                    te.activity_type as name,
                    COALESCE(SUM(te.amount), 0) as total_amount,
                    COALESCE(SUM(te.duration_minutes), 0) as total_minutes,
                    COUNT(te.id) as entry_count
                FROM time_entries te
                WHERE te.user_id = $1 ${dateFilter}
                GROUP BY te.activity_type
                ORDER BY total_amount DESC
            `;
        }

        const result = await db.query(query, params);

        // Get totals
        const totalsResult = await db.query(`
            SELECT
                COALESCE(SUM(amount), 0) as total_revenue,
                COALESCE(SUM(duration_minutes), 0) as total_minutes,
                COUNT(*) as total_entries
            FROM time_entries
            WHERE user_id = $1 ${dateFilter}
        `, params);

        res.json({
            success: true,
            data: result.rows,
            totals: totalsResult.rows[0],
            period,
            group_by
        });
    } catch (error) {
        console.error('Error generating revenue report:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// Productivity report data
router.get('/api/reports/productivity', requireAuth, async (req, res) => {
    try {
        const { period = 'month' } = req.query;

        let dateFilter = '';
        switch (period) {
            case 'week':
                dateFilter = "AND date >= DATE_TRUNC('week', CURRENT_DATE)";
                break;
            case 'month':
                dateFilter = "AND date >= DATE_TRUNC('month', CURRENT_DATE)";
                break;
            case 'quarter':
                dateFilter = "AND date >= DATE_TRUNC('quarter', CURRENT_DATE)";
                break;
            case 'year':
                dateFilter = "AND date >= DATE_TRUNC('year', CURRENT_DATE)";
                break;
        }

        // Hours by activity type
        const byActivityResult = await db.query(`
            SELECT
                COALESCE(activity_type, 'Other') as activity_type,
                SUM(duration_minutes) as total_minutes,
                COUNT(*) as entry_count
            FROM time_entries
            WHERE user_id = $1 ${dateFilter}
            GROUP BY activity_type
            ORDER BY total_minutes DESC
        `, [req.user.id]);

        // Hours by day
        const byDayResult = await db.query(`
            SELECT
                date,
                SUM(duration_minutes) as total_minutes,
                SUM(CASE WHEN is_billable THEN duration_minutes ELSE 0 END) as billable_minutes,
                COUNT(*) as entry_count
            FROM time_entries
            WHERE user_id = $1 ${dateFilter}
            GROUP BY date
            ORDER BY date DESC
            LIMIT 30
        `, [req.user.id]);

        // Summary stats
        const summaryResult = await db.query(`
            SELECT
                COALESCE(SUM(duration_minutes), 0) as total_minutes,
                COALESCE(SUM(CASE WHEN is_billable THEN duration_minutes ELSE 0 END), 0) as billable_minutes,
                COALESCE(SUM(amount), 0) as total_amount,
                COALESCE(AVG(hourly_rate), 0) as avg_rate,
                COUNT(DISTINCT date) as days_worked
            FROM time_entries
            WHERE user_id = $1 ${dateFilter}
        `, [req.user.id]);

        res.json({
            success: true,
            byActivity: byActivityResult.rows,
            byDay: byDayResult.rows,
            summary: summaryResult.rows[0],
            period
        });
    } catch (error) {
        console.error('Error generating productivity report:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// Cases report data
router.get('/api/reports/cases', requireAuth, async (req, res) => {
    try {
        // Cases by status
        const byStatusResult = await db.query(`
            SELECT status, COUNT(*) as count
            FROM cases WHERE user_id = $1
            GROUP BY status
        `, [req.user.id]);

        // Cases by type
        const byTypeResult = await db.query(`
            SELECT case_type, COUNT(*) as count
            FROM cases WHERE user_id = $1
            GROUP BY case_type
        `, [req.user.id]);

        // Cases by priority
        const byPriorityResult = await db.query(`
            SELECT priority, COUNT(*) as count
            FROM cases WHERE user_id = $1
            GROUP BY priority
        `, [req.user.id]);

        // Cases opened over time
        const openedOverTimeResult = await db.query(`
            SELECT
                DATE_TRUNC('month', date_opened) as month,
                COUNT(*) as opened_count
            FROM cases
            WHERE user_id = $1 AND date_opened >= CURRENT_DATE - INTERVAL '12 months'
            GROUP BY DATE_TRUNC('month', date_opened)
            ORDER BY month
        `, [req.user.id]);

        // Cases closed over time
        const closedOverTimeResult = await db.query(`
            SELECT
                DATE_TRUNC('month', date_closed) as month,
                COUNT(*) as closed_count
            FROM cases
            WHERE user_id = $1 AND date_closed >= CURRENT_DATE - INTERVAL '12 months'
            GROUP BY DATE_TRUNC('month', date_closed)
            ORDER BY month
        `, [req.user.id]);

        // Case revenue
        const caseRevenueResult = await db.query(`
            SELECT
                c.id,
                c.title,
                c.case_number,
                c.status,
                COALESCE(SUM(te.amount), 0) as total_revenue,
                COALESCE(SUM(te.duration_minutes), 0) as total_minutes
            FROM cases c
            LEFT JOIN time_entries te ON c.id = te.case_id
            WHERE c.user_id = $1
            GROUP BY c.id
            ORDER BY total_revenue DESC
            LIMIT 10
        `, [req.user.id]);

        res.json({
            success: true,
            byStatus: byStatusResult.rows,
            byType: byTypeResult.rows,
            byPriority: byPriorityResult.rows,
            openedOverTime: openedOverTimeResult.rows,
            closedOverTime: closedOverTimeResult.rows,
            topCasesByRevenue: caseRevenueResult.rows
        });
    } catch (error) {
        console.error('Error generating cases report:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// Clients report data
router.get('/api/reports/clients', requireAuth, async (req, res) => {
    try {
        // Clients by type
        const byTypeResult = await db.query(`
            SELECT client_type, COUNT(*) as count
            FROM clients WHERE user_id = $1
            GROUP BY client_type
        `, [req.user.id]);

        // Clients by status
        const byStatusResult = await db.query(`
            SELECT status, COUNT(*) as count
            FROM clients WHERE user_id = $1
            GROUP BY status
        `, [req.user.id]);

        // Client acquisition over time
        const acquisitionResult = await db.query(`
            SELECT
                DATE_TRUNC('month', created_at) as month,
                COUNT(*) as new_clients
            FROM clients
            WHERE user_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '12 months'
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY month
        `, [req.user.id]);

        // Top clients by revenue
        const topClientsResult = await db.query(`
            SELECT
                c.id,
                COALESCE(c.company_name, c.first_name || ' ' || c.last_name) as name,
                c.client_type,
                COALESCE(SUM(te.amount), 0) as total_revenue,
                COUNT(DISTINCT cs.id) as case_count
            FROM clients c
            LEFT JOIN time_entries te ON c.id = te.client_id
            LEFT JOIN cases cs ON c.id = cs.client_id
            WHERE c.user_id = $1
            GROUP BY c.id
            ORDER BY total_revenue DESC
            LIMIT 10
        `, [req.user.id]);

        // Client retention (clients with cases in last 6 months)
        const retentionResult = await db.query(`
            SELECT
                COUNT(DISTINCT c.id) as active_clients
            FROM clients c
            JOIN cases cs ON c.id = cs.client_id
            WHERE c.user_id = $1 AND cs.created_at >= CURRENT_DATE - INTERVAL '6 months'
        `, [req.user.id]);

        res.json({
            success: true,
            byType: byTypeResult.rows,
            byStatus: byStatusResult.rows,
            acquisition: acquisitionResult.rows,
            topClients: topClientsResult.rows,
            retention: retentionResult.rows[0]
        });
    } catch (error) {
        console.error('Error generating clients report:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// AR Aging report
router.get('/api/reports/aging', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                i.id,
                i.invoice_number,
                COALESCE(cl.company_name, cl.first_name || ' ' || cl.last_name) as client_name,
                i.total,
                i.amount_paid,
                i.total - i.amount_paid as balance,
                i.due_date,
                CURRENT_DATE - i.due_date as days_overdue,
                CASE
                    WHEN CURRENT_DATE - i.due_date <= 0 THEN 'current'
                    WHEN CURRENT_DATE - i.due_date <= 30 THEN '1-30'
                    WHEN CURRENT_DATE - i.due_date <= 60 THEN '31-60'
                    WHEN CURRENT_DATE - i.due_date <= 90 THEN '61-90'
                    ELSE '90+'
                END as aging_bucket
            FROM invoices i
            LEFT JOIN clients cl ON i.client_id = cl.id
            WHERE i.user_id = $1 AND i.status IN ('sent', 'overdue') AND i.total > i.amount_paid
            ORDER BY days_overdue DESC
        `, [req.user.id]);

        // Summary by bucket
        const summaryResult = await db.query(`
            SELECT
                CASE
                    WHEN CURRENT_DATE - due_date <= 0 THEN 'current'
                    WHEN CURRENT_DATE - due_date <= 30 THEN '1-30'
                    WHEN CURRENT_DATE - due_date <= 60 THEN '31-60'
                    WHEN CURRENT_DATE - due_date <= 90 THEN '61-90'
                    ELSE '90+'
                END as bucket,
                COUNT(*) as invoice_count,
                SUM(total - amount_paid) as total_balance
            FROM invoices
            WHERE user_id = $1 AND status IN ('sent', 'overdue') AND total > amount_paid
            GROUP BY bucket
            ORDER BY
                CASE bucket
                    WHEN 'current' THEN 1
                    WHEN '1-30' THEN 2
                    WHEN '31-60' THEN 3
                    WHEN '61-90' THEN 4
                    ELSE 5
                END
        `, [req.user.id]);

        res.json({
            success: true,
            invoices: result.rows,
            summary: summaryResult.rows
        });
    } catch (error) {
        console.error('Error generating aging report:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// =====================================================
// SAVED REPORTS API
// =====================================================

// List saved reports
router.get('/api/reports/saved', requireAuth, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM reports WHERE user_id = $1 ORDER BY is_favorite DESC, created_at DESC',
            [req.user.id]
        );

        res.json({
            success: true,
            reports: result.rows
        });
    } catch (error) {
        console.error('Error fetching saved reports:', error);
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
});

// Save report
router.post('/api/reports/saved', requireAuth, async (req, res) => {
    try {
        const { name, report_type, filters, is_favorite } = req.body;

        const result = await db.query(`
            INSERT INTO reports (user_id, name, report_type, filters, is_favorite)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [req.user.id, name, report_type, JSON.stringify(filters), is_favorite || false]);

        res.status(201).json({
            success: true,
            report: result.rows[0]
        });
    } catch (error) {
        console.error('Error saving report:', error);
        res.status(500).json({ error: 'Failed to save report' });
    }
});

// Update saved report
router.put('/api/reports/saved/:id', requireAuth, async (req, res) => {
    try {
        const { name, filters, is_favorite } = req.body;

        const result = await db.query(`
            UPDATE reports SET
                name = COALESCE($1, name),
                filters = COALESCE($2, filters),
                is_favorite = COALESCE($3, is_favorite)
            WHERE id = $4 AND user_id = $5
            RETURNING *
        `, [name, filters ? JSON.stringify(filters) : null, is_favorite, req.params.id, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Report not found' });
        }

        res.json({
            success: true,
            report: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating report:', error);
        res.status(500).json({ error: 'Failed to update report' });
    }
});

// Delete saved report
router.delete('/api/reports/saved/:id', requireAuth, async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM reports WHERE id = $1 AND user_id = $2 RETURNING *',
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Report not found' });
        }

        res.json({
            success: true,
            message: 'Report deleted'
        });
    } catch (error) {
        console.error('Error deleting report:', error);
        res.status(500).json({ error: 'Failed to delete report' });
    }
});

module.exports = router;

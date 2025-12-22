/**
 * Calendar & Deadlines Routes
 * Handles calendar events, deadlines, and tasks
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// =====================================================
// PAGE ROUTES
// =====================================================

// Calendar page
router.get('/calendar', requireAuth, async (req, res) => {
    try {
        // Get cases for dropdown
        const casesResult = await db.query(
            'SELECT id, title, case_number FROM cases WHERE (user_id = $1 OR user_id IS NULL) AND status != \'archived\' ORDER BY title',
            [req.user.id]
        );

        // Get clients for dropdown
        const clientsResult = await db.query(
            'SELECT id, first_name, last_name, company_name, client_type FROM clients WHERE (user_id = $1 OR user_id IS NULL) AND status = \'active\' ORDER BY company_name, last_name',
            [req.user.id]
        );

        res.render('calendar/index', {
            title: 'Calendar',
            cases: casesResult.rows,
            clients: clientsResult.rows,
            req
        });
    } catch (error) {
        console.error('Error loading calendar:', error);
        res.status(500).render('error', { message: 'Error loading calendar' });
    }
});

// Deadlines page
router.get('/deadlines', requireAuth, async (req, res) => {
    try {
        const { status, case_id } = req.query;

        let query = `
            SELECT d.*, c.title as case_title, c.case_number,
                   cl.first_name, cl.last_name, cl.company_name
            FROM deadlines d
            LEFT JOIN cases c ON d.case_id = c.id
            LEFT JOIN clients cl ON c.client_id = cl.id
            WHERE (d.user_id = $1 OR d.user_id IS NULL)
        `;
        const params = [req.user.id];
        let paramIndex = 2;

        if (status && status !== 'all') {
            query += ` AND d.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (case_id) {
            query += ` AND d.case_id = $${paramIndex}`;
            params.push(case_id);
            paramIndex++;
        }

        query += ' ORDER BY d.due_date ASC';

        const deadlinesResult = await db.query(query, params);

        // Get cases for dropdown
        const casesResult = await db.query(
            'SELECT id, title, case_number FROM cases WHERE (user_id = $1 OR user_id IS NULL) AND status != \'archived\' ORDER BY title',
            [req.user.id]
        );

        // Calculate urgency for each deadline
        const today = new Date();
        const deadlines = deadlinesResult.rows.map(d => {
            const dueDate = new Date(d.due_date);
            const daysUntil = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
            let urgency = 'normal';
            if (daysUntil < 0) urgency = 'overdue';
            else if (daysUntil <= 7) urgency = 'urgent';
            else if (daysUntil <= d.warning_days) urgency = 'warning';
            return { ...d, daysUntil, urgency };
        });

        res.render('calendar/deadlines', {
            title: 'Deadlines',
            deadlines,
            cases: casesResult.rows,
            filters: { status, case_id },
            req
        });
    } catch (error) {
        console.error('Error loading deadlines:', error);
        res.status(500).render('error', { message: 'Error loading deadlines' });
    }
});

// Helper function for rendering tasks page
async function renderTasksPage(req, res) {
    try {
        const { status, priority, case_id } = req.query;

        let query = `
            SELECT t.*, c.title as case_title, c.case_number,
                   u.first_name as assigned_first_name, u.last_name as assigned_last_name
            FROM tasks t
            LEFT JOIN cases c ON t.case_id = c.id
            LEFT JOIN users u ON t.assigned_to = u.id
            WHERE (t.user_id = $1 OR t.user_id IS NULL)
        `;
        const params = [req.user.id];
        let paramIndex = 2;

        if (status && status !== 'all') {
            query += ` AND t.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (priority && priority !== 'all') {
            query += ` AND t.priority = $${paramIndex}`;
            params.push(priority);
            paramIndex++;
        }

        if (case_id) {
            query += ` AND t.case_id = $${paramIndex}`;
            params.push(case_id);
            paramIndex++;
        }

        query += ' ORDER BY CASE t.priority WHEN \'urgent\' THEN 1 WHEN \'high\' THEN 2 WHEN \'medium\' THEN 3 ELSE 4 END, t.due_date ASC NULLS LAST';

        const tasksResult = await db.query(query, params);

        const casesResult = await db.query(
            'SELECT id, title, case_number FROM cases WHERE (user_id = $1 OR user_id IS NULL) AND status != \'archived\' ORDER BY title',
            [req.user.id]
        );

        const statsResult = await db.query(`
            SELECT
                COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
                COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
                COUNT(*) FILTER (WHERE status = 'completed') as completed_count
            FROM tasks WHERE (user_id = $1 OR user_id IS NULL)
        `, [req.user.id]);

        res.render('calendar/tasks', {
            title: 'Tasks',
            tasks: tasksResult.rows,
            cases: casesResult.rows,
            stats: statsResult.rows[0],
            filters: { status, priority, case_id },
            req
        });
    } catch (error) {
        console.error('Error loading tasks:', error);
        res.status(500).render('error', { message: 'Error loading tasks' });
    }
}

// Calendar/Tasks route (alias for /tasks)
router.get('/calendar/tasks', requireAuth, renderTasksPage);

// Tasks page (uses helper function)
router.get('/tasks', requireAuth, renderTasksPage);

// =====================================================
// CALENDAR EVENTS API
// =====================================================

// Get events for calendar (supports FullCalendar format)
router.get('/api/calendar/events', requireAuth, async (req, res) => {
    try {
        const { start, end, case_id, event_type } = req.query;

        let query = `
            SELECT e.*, c.title as case_title, cl.first_name, cl.last_name, cl.company_name
            FROM calendar_events e
            LEFT JOIN cases c ON e.case_id = c.id
            LEFT JOIN clients cl ON e.client_id = cl.id
            WHERE (e.user_id = $1 OR e.user_id IS NULL)
        `;
        const params = [req.user.id];
        let paramIndex = 2;

        if (start) {
            query += ` AND e.start_time >= $${paramIndex}`;
            params.push(start);
            paramIndex++;
        }

        if (end) {
            query += ` AND e.start_time <= $${paramIndex}`;
            params.push(end);
            paramIndex++;
        }

        if (case_id) {
            query += ` AND e.case_id = $${paramIndex}`;
            params.push(case_id);
            paramIndex++;
        }

        if (event_type && event_type !== 'all') {
            query += ` AND e.event_type = $${paramIndex}`;
            params.push(event_type);
            paramIndex++;
        }

        query += ' ORDER BY e.start_time ASC';

        const result = await db.query(query, params);

        // Format for FullCalendar
        const events = result.rows.map(e => ({
            id: e.id,
            title: e.title,
            start: e.start_time,
            end: e.end_time,
            allDay: e.all_day,
            color: e.color,
            extendedProps: {
                description: e.description,
                event_type: e.event_type,
                location: e.location,
                case_id: e.case_id,
                case_title: e.case_title,
                client_id: e.client_id,
                status: e.status
            }
        }));

        res.json(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// Create event
router.post('/api/calendar/events', requireAuth, async (req, res) => {
    try {
        const {
            title, description, event_type, location, start_time, end_time,
            all_day, case_id, client_id, reminder_minutes, color
        } = req.body;

        const result = await db.query(`
            INSERT INTO calendar_events (
                user_id, title, description, event_type, location, start_time, end_time,
                all_day, case_id, client_id, reminder_minutes, color
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `, [
            req.user.id, title, description, event_type || 'meeting', location,
            start_time, end_time, all_day || false, case_id || null, client_id || null,
            reminder_minutes || 60, color || '#667eea'
        ]);

        res.status(201).json({
            success: true,
            event: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ error: 'Failed to create event' });
    }
});

// Get single event
router.get('/api/calendar/events/:id', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT e.*, c.title as case_title
            FROM calendar_events e
            LEFT JOIN cases c ON e.case_id = c.id
            WHERE e.id = $1 AND (e.user_id = $2 OR e.user_id IS NULL)
        `, [req.params.id, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        res.json({ event: result.rows[0] });
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({ error: 'Failed to fetch event' });
    }
});

// Update event
router.put('/api/calendar/events/:id', requireAuth, async (req, res) => {
    try {
        const {
            title, description, event_type, location, start_time, end_time,
            all_day, case_id, client_id, reminder_minutes, status, color
        } = req.body;

        const result = await db.query(`
            UPDATE calendar_events SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                event_type = COALESCE($3, event_type),
                location = $4,
                start_time = COALESCE($5, start_time),
                end_time = $6,
                all_day = COALESCE($7, all_day),
                case_id = $8,
                client_id = $9,
                reminder_minutes = COALESCE($10, reminder_minutes),
                status = COALESCE($11, status),
                color = COALESCE($12, color),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $13 AND user_id = $14
            RETURNING *
        `, [
            title, description, event_type, location, start_time, end_time,
            all_day, case_id, client_id, reminder_minutes, status, color,
            req.params.id, req.user.id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        res.json({
            success: true,
            event: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ error: 'Failed to update event' });
    }
});

// Delete event
router.delete('/api/calendar/events/:id', requireAuth, async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM calendar_events WHERE id = $1 AND (user_id = $2 OR user_id IS NULL) RETURNING *',
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        res.json({
            success: true,
            message: 'Event deleted'
        });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ error: 'Failed to delete event' });
    }
});

// =====================================================
// DEADLINES API
// =====================================================

// List deadlines
router.get('/api/deadlines', requireAuth, async (req, res) => {
    try {
        const { status, case_id, upcoming_days } = req.query;

        let query = `
            SELECT d.*, c.title as case_title, c.case_number
            FROM deadlines d
            LEFT JOIN cases c ON d.case_id = c.id
            WHERE (d.user_id = $1 OR d.user_id IS NULL)
        `;
        const params = [req.user.id];
        let paramIndex = 2;

        if (status && status !== 'all') {
            query += ` AND d.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (case_id) {
            query += ` AND d.case_id = $${paramIndex}`;
            params.push(case_id);
            paramIndex++;
        }

        if (upcoming_days) {
            query += ` AND d.due_date <= CURRENT_DATE + INTERVAL '${parseInt(upcoming_days)} days'`;
        }

        query += ' ORDER BY d.due_date ASC';

        const result = await db.query(query, params);

        res.json({
            success: true,
            deadlines: result.rows
        });
    } catch (error) {
        console.error('Error fetching deadlines:', error);
        res.status(500).json({ error: 'Failed to fetch deadlines' });
    }
});

// Create deadline
router.post('/api/deadlines', requireAuth, async (req, res) => {
    try {
        const {
            case_id, title, description, deadline_type, due_date,
            warning_days, is_critical
        } = req.body;

        // Verify case ownership
        if (case_id) {
            const caseCheck = await db.query(
                'SELECT id FROM cases WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
                [case_id, req.user.id]
            );
            if (caseCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Case not found' });
            }
        }

        const result = await db.query(`
            INSERT INTO deadlines (
                user_id, case_id, title, description, deadline_type,
                due_date, warning_days, is_critical
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [
            req.user.id, case_id, title, description,
            deadline_type || 'filing', due_date, warning_days || 30, is_critical || false
        ]);

        res.status(201).json({
            success: true,
            deadline: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating deadline:', error);
        res.status(500).json({ error: 'Failed to create deadline' });
    }
});

// Update deadline
router.put('/api/deadlines/:id', requireAuth, async (req, res) => {
    try {
        const {
            title, description, deadline_type, due_date,
            warning_days, is_critical, status, case_id
        } = req.body;

        const result = await db.query(`
            UPDATE deadlines SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                deadline_type = COALESCE($3, deadline_type),
                due_date = COALESCE($4, due_date),
                warning_days = COALESCE($5, warning_days),
                is_critical = COALESCE($6, is_critical),
                status = COALESCE($7, status),
                case_id = COALESCE($8, case_id),
                completed_at = CASE WHEN $7 = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END
            WHERE id = $9 AND user_id = $10
            RETURNING *
        `, [
            title, description, deadline_type, due_date,
            warning_days, is_critical, status, case_id,
            req.params.id, req.user.id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Deadline not found' });
        }

        res.json({
            success: true,
            deadline: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating deadline:', error);
        res.status(500).json({ error: 'Failed to update deadline' });
    }
});

// Get single deadline
router.get('/api/deadlines/:id', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT d.*, c.title as case_title, c.case_number
            FROM deadlines d
            LEFT JOIN cases c ON d.case_id = c.id
            WHERE d.id = $1 AND (d.user_id = $2 OR d.user_id IS NULL)
        `, [req.params.id, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Deadline not found' });
        }

        res.json({ deadline: result.rows[0] });
    } catch (error) {
        console.error('Error fetching deadline:', error);
        res.status(500).json({ error: 'Failed to fetch deadline' });
    }
});

// Delete deadline
router.delete('/api/deadlines/:id', requireAuth, async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM deadlines WHERE id = $1 AND (user_id = $2 OR user_id IS NULL) RETURNING *',
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Deadline not found' });
        }

        res.json({
            success: true,
            message: 'Deadline deleted'
        });
    } catch (error) {
        console.error('Error deleting deadline:', error);
        res.status(500).json({ error: 'Failed to delete deadline' });
    }
});

// =====================================================
// TASKS API
// =====================================================

// List tasks
router.get('/api/tasks', requireAuth, async (req, res) => {
    try {
        const { status, priority, case_id } = req.query;

        let query = `
            SELECT t.*, c.title as case_title
            FROM tasks t
            LEFT JOIN cases c ON t.case_id = c.id
            WHERE (t.user_id = $1 OR t.user_id IS NULL)
        `;
        const params = [req.user.id];
        let paramIndex = 2;

        if (status && status !== 'all') {
            query += ` AND t.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (priority && priority !== 'all') {
            query += ` AND t.priority = $${paramIndex}`;
            params.push(priority);
            paramIndex++;
        }

        if (case_id) {
            query += ` AND t.case_id = $${paramIndex}`;
            params.push(case_id);
            paramIndex++;
        }

        query += ' ORDER BY CASE t.priority WHEN \'urgent\' THEN 1 WHEN \'high\' THEN 2 WHEN \'medium\' THEN 3 ELSE 4 END, t.due_date ASC NULLS LAST';

        const result = await db.query(query, params);

        res.json({
            success: true,
            tasks: result.rows
        });
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

// Create task
router.post('/api/tasks', requireAuth, async (req, res) => {
    try {
        const {
            case_id, title, description, priority, due_date, assigned_to
        } = req.body;

        const result = await db.query(`
            INSERT INTO tasks (user_id, case_id, title, description, priority, due_date, assigned_to)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [
            req.user.id, case_id || null, title, description,
            priority || 'medium', due_date || null, assigned_to || req.user.id
        ]);

        res.status(201).json({
            success: true,
            task: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ error: 'Failed to create task' });
    }
});

// Update task
router.put('/api/tasks/:id', requireAuth, async (req, res) => {
    try {
        const { title, description, priority, due_date, status, assigned_to, case_id } = req.body;

        const result = await db.query(`
            UPDATE tasks SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                priority = COALESCE($3, priority),
                due_date = $4,
                status = COALESCE($5, status),
                assigned_to = $6,
                case_id = COALESCE($7, case_id),
                completed_at = CASE WHEN $5 = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $8 AND user_id = $9
            RETURNING *
        `, [
            title, description, priority, due_date, status, assigned_to, case_id,
            req.params.id, req.user.id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json({
            success: true,
            task: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
});

// Get single task
router.get('/api/tasks/:id', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT t.*, c.title as case_title, c.case_number
            FROM tasks t
            LEFT JOIN cases c ON t.case_id = c.id
            WHERE t.id = $1 AND (t.user_id = $2 OR t.user_id IS NULL)
        `, [req.params.id, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json({ task: result.rows[0] });
    } catch (error) {
        console.error('Error fetching task:', error);
        res.status(500).json({ error: 'Failed to fetch task' });
    }
});

// Delete task
router.delete('/api/tasks/:id', requireAuth, async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM tasks WHERE id = $1 AND (user_id = $2 OR user_id IS NULL) RETURNING *',
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json({
            success: true,
            message: 'Task deleted'
        });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: 'Failed to delete task' });
    }
});

module.exports = router;

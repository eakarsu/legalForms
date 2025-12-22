/**
 * Trust/IOLTA Accounting Routes
 * Handles trust account management, transactions, and reconciliation
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// =====================================================
// PAGE ROUTES
// =====================================================

// Trust accounts dashboard
router.get('/trust', requireAuth, async (req, res) => {
    try {
        // Get trust accounts
        const accountsResult = await db.query(`
            SELECT ta.*,
                   (SELECT COUNT(*) FROM client_trust_ledgers WHERE trust_account_id = ta.id) as ledger_count,
                   (SELECT COALESCE(SUM(current_balance), 0) FROM client_trust_ledgers WHERE trust_account_id = ta.id) as total_client_balance
            FROM trust_accounts ta
            WHERE (ta.user_id = $1 OR ta.user_id IS NULL)
            ORDER BY ta.created_at DESC
        `, [req.user.id]);

        // Get recent transactions
        const transactionsResult = await db.query(`
            SELECT tt.*, ta.account_name, c.first_name, c.last_name
            FROM trust_transactions tt
            JOIN trust_accounts ta ON tt.trust_account_id = ta.id
            JOIN client_trust_ledgers ctl ON tt.client_trust_ledger_id = ctl.id
            JOIN clients c ON ctl.client_id = c.id
            WHERE (ta.user_id = $1 OR ta.user_id IS NULL)
            ORDER BY tt.created_at DESC
            LIMIT 20
        `, [req.user.id]);

        // Summary stats
        const statsResult = await db.query(`
            SELECT
                COALESCE(SUM(ctl.current_balance), 0) as total_trust_balance,
                COUNT(DISTINCT ta.id) as account_count,
                COUNT(DISTINCT ctl.client_id) as client_count
            FROM trust_accounts ta
            LEFT JOIN client_trust_ledgers ctl ON ta.id = ctl.trust_account_id
            WHERE (ta.user_id = $1 OR ta.user_id IS NULL) AND ta.is_active = true
        `, [req.user.id]);

        res.render('trust/dashboard', {
            title: 'Trust Accounting',
            accounts: accountsResult.rows,
            transactions: transactionsResult.rows,
            stats: statsResult.rows[0],
            req
        });
    } catch (error) {
        console.error('Trust dashboard error:', error);
        res.status(500).render('error', { message: 'Error loading trust accounts' });
    }
});

// Trust accounts list - MUST be before :id route
router.get('/trust/accounts', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT ta.*, COUNT(ctl.id) as ledger_count
            FROM trust_accounts ta
            LEFT JOIN client_trust_ledgers ctl ON ta.id = ctl.trust_account_id
            WHERE (ta.user_id = $1 OR ta.user_id IS NULL)
            GROUP BY ta.id
            ORDER BY ta.created_at DESC
        `, [req.user.id]);

        res.render('trust/accounts', {
            title: 'Trust Accounts',
            accounts: result.rows,
            req
        });
    } catch (error) {
        console.error('Trust accounts error:', error);
        res.status(500).render('error', { message: 'Error loading accounts' });
    }
});

// Create trust account (form submission)
router.post('/trust/accounts', requireAuth, async (req, res) => {
    try {
        const { account_name, bank_name, account_number, account_type } = req.body;

        const result = await db.query(`
            INSERT INTO trust_accounts (user_id, account_name, bank_name, account_number, account_type)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [req.user.id, account_name, bank_name, account_number, account_type || 'iolta']);

        res.redirect('/trust/' + result.rows[0].id);
    } catch (error) {
        console.error('Create trust account error:', error);
        res.status(500).render('error', { message: 'Error creating trust account' });
    }
});

// Client ledgers - MUST be before :id route
router.get('/trust/ledgers', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT ctl.*, c.first_name, c.last_name, c.company_name, ta.account_name
            FROM client_trust_ledgers ctl
            JOIN trust_accounts ta ON ctl.trust_account_id = ta.id
            LEFT JOIN clients c ON ctl.client_id = c.id
            WHERE (ta.user_id = $1 OR ta.user_id IS NULL)
            ORDER BY ctl.created_at DESC
        `, [req.user.id]);

        res.render('trust/ledgers', {
            title: 'Client Ledgers',
            ledgers: result.rows,
            req
        });
    } catch (error) {
        console.error('Client ledgers error:', error);
        res.status(500).render('error', { message: 'Error loading ledgers' });
    }
});

// Trust transactions - MUST be before :id route
router.get('/trust/transactions', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT tt.*, ctl.id as ledger_id, c.first_name, c.last_name, ta.account_name
            FROM trust_transactions tt
            JOIN client_trust_ledgers ctl ON tt.client_trust_ledger_id = ctl.id
            JOIN trust_accounts ta ON ctl.trust_account_id = ta.id
            LEFT JOIN clients c ON ctl.client_id = c.id
            WHERE (ta.user_id = $1 OR ta.user_id IS NULL)
            ORDER BY tt.transaction_date DESC
        `, [req.user.id]);

        res.render('trust/transactions', {
            title: 'Trust Transactions',
            transactions: result.rows,
            req
        });
    } catch (error) {
        console.error('Trust transactions error:', error);
        res.status(500).render('error', { message: 'Error loading transactions' });
    }
});

// Trust reconciliation - MUST be before :id route
router.get('/trust/reconciliation', requireAuth, async (req, res) => {
    try {
        const accounts = await db.query(`
            SELECT ta.*,
                   (SELECT SUM(CASE WHEN tt.transaction_type = 'deposit' THEN tt.amount ELSE -tt.amount END)
                    FROM trust_transactions tt
                    JOIN client_trust_ledgers ctl ON tt.client_trust_ledger_id = ctl.id
                    WHERE ctl.trust_account_id = ta.id) as calculated_balance
            FROM trust_accounts ta
            WHERE (ta.user_id = $1 OR ta.user_id IS NULL)
        `, [req.user.id]);

        res.render('trust/reconciliation', {
            title: 'Trust Reconciliation',
            accounts: accounts.rows,
            req
        });
    } catch (error) {
        console.error('Trust reconciliation error:', error);
        res.status(500).render('error', { message: 'Error loading reconciliation' });
    }
});

// Ledger detail page - MUST be BEFORE /trust/:id to avoid being caught by it
router.get('/trust/:accountId/ledger/:ledgerId', requireAuth, async (req, res) => {
    try {
        const { accountId, ledgerId } = req.params;

        // Get ledger with client info
        const ledgerResult = await db.query(`
            SELECT ctl.*, c.first_name, c.last_name, c.email, c.phone,
                   cs.title as case_title, cs.case_number,
                   ta.account_name
            FROM client_trust_ledgers ctl
            JOIN clients c ON ctl.client_id = c.id
            JOIN trust_accounts ta ON ctl.trust_account_id = ta.id
            LEFT JOIN cases cs ON ctl.case_id = cs.id
            WHERE ctl.id = $1 AND ctl.trust_account_id = $2 AND (ta.user_id = $3 OR ta.user_id IS NULL)
        `, [ledgerId, accountId, req.user.id]);

        if (ledgerResult.rows.length === 0) {
            return res.status(404).render('error', { message: 'Ledger not found' });
        }

        // Get ledger transactions
        const transactionsResult = await db.query(`
            SELECT * FROM trust_transactions
            WHERE client_trust_ledger_id = $1
            ORDER BY transaction_date DESC, created_at DESC
        `, [ledgerId]);

        res.render('trust/ledger-detail', {
            title: ledgerResult.rows[0].first_name + ' ' + ledgerResult.rows[0].last_name + ' - Trust Ledger',
            ledger: ledgerResult.rows[0],
            transactions: transactionsResult.rows,
            accountId: accountId,
            req
        });
    } catch (error) {
        console.error('Ledger detail error:', error);
        res.status(500).render('error', { message: 'Error loading ledger' });
    }
});

// Trust account detail - MUST be AFTER all static routes
router.get('/trust/:id', requireAuth, async (req, res) => {
    try {
        const accountResult = await db.query(`
            SELECT * FROM trust_accounts WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
        `, [req.params.id, req.user.id]);

        if (accountResult.rows.length === 0) {
            return res.status(404).render('error', { message: 'Trust account not found' });
        }

        // Get client ledgers
        const ledgersResult = await db.query(`
            SELECT ctl.*, c.first_name, c.last_name, c.company_name, cs.title as case_title
            FROM client_trust_ledgers ctl
            JOIN clients c ON ctl.client_id = c.id
            LEFT JOIN cases cs ON ctl.case_id = cs.id
            WHERE ctl.trust_account_id = $1
            ORDER BY ctl.current_balance DESC
        `, [req.params.id]);

        // Get transactions
        const transactionsResult = await db.query(`
            SELECT tt.*, c.first_name, c.last_name
            FROM trust_transactions tt
            JOIN client_trust_ledgers ctl ON tt.client_trust_ledger_id = ctl.id
            JOIN clients c ON ctl.client_id = c.id
            WHERE tt.trust_account_id = $1
            ORDER BY tt.transaction_date DESC, tt.created_at DESC
            LIMIT 50
        `, [req.params.id]);

        // Get clients for new ledger modal
        const clientsResult = await db.query(
            'SELECT id, first_name, last_name, company_name FROM clients WHERE (user_id = $1 OR user_id IS NULL) ORDER BY last_name',
            [req.user.id]
        );

        // Get cases for new ledger modal
        const casesResult = await db.query(
            'SELECT id, case_number, title FROM cases WHERE (user_id = $1 OR user_id IS NULL) ORDER BY created_at DESC',
            [req.user.id]
        );

        res.render('trust/account-detail', {
            title: accountResult.rows[0].account_name,
            account: accountResult.rows[0],
            ledgers: ledgersResult.rows,
            transactions: transactionsResult.rows,
            clients: clientsResult.rows,
            cases: casesResult.rows,
            req
        });
    } catch (error) {
        console.error('Trust account detail error:', error);
        res.status(500).render('error', { message: 'Error loading trust account' });
    }
});

// Reconciliation page
router.get('/trust/:id/reconcile', requireAuth, async (req, res) => {
    try {
        const accountResult = await db.query(`
            SELECT * FROM trust_accounts WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
        `, [req.params.id, req.user.id]);

        if (accountResult.rows.length === 0) {
            return res.status(404).render('error', { message: 'Trust account not found' });
        }

        // Get unreconciled transactions
        const unreconciledResult = await db.query(`
            SELECT tt.*, c.first_name, c.last_name
            FROM trust_transactions tt
            JOIN client_trust_ledgers ctl ON tt.client_trust_ledger_id = ctl.id
            JOIN clients c ON ctl.client_id = c.id
            WHERE tt.trust_account_id = $1 AND tt.reconciled = false
            ORDER BY tt.transaction_date ASC
        `, [req.params.id]);

        // Get recent reconciliations
        const reconciliationsResult = await db.query(`
            SELECT * FROM trust_reconciliations
            WHERE trust_account_id = $1
            ORDER BY statement_date DESC
            LIMIT 12
        `, [req.params.id]);

        res.render('trust/reconcile', {
            title: 'Reconcile - ' + accountResult.rows[0].account_name,
            account: accountResult.rows[0],
            unreconciled: unreconciledResult.rows,
            reconciliations: reconciliationsResult.rows,
            req
        });
    } catch (error) {
        console.error('Trust reconciliation error:', error);
        res.status(500).render('error', { message: 'Error loading reconciliation' });
    }
});

// =====================================================
// API ROUTES
// =====================================================

// Create trust account
router.post('/api/trust/accounts', requireAuth, async (req, res) => {
    try {
        const { account_name, bank_name, account_number_last4, routing_number_last4, account_type } = req.body;

        const result = await db.query(`
            INSERT INTO trust_accounts (user_id, account_name, bank_name, account_number_last4, routing_number_last4, account_type)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [req.user.id, account_name, bank_name, account_number_last4, routing_number_last4, account_type || 'iolta']);

        res.json({ success: true, account: result.rows[0] });
    } catch (error) {
        console.error('Create trust account error:', error);
        res.status(500).json({ error: 'Failed to create trust account' });
    }
});

// Create client ledger
router.post('/api/trust/accounts/:id/ledgers', requireAuth, async (req, res) => {
    try {
        const { client_id, case_id } = req.body;

        // Verify account ownership
        const accountResult = await db.query(
            'SELECT id FROM trust_accounts WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
            [req.params.id, req.user.id]
        );

        if (accountResult.rows.length === 0) {
            return res.status(404).json({ error: 'Trust account not found' });
        }

        const result = await db.query(`
            INSERT INTO client_trust_ledgers (trust_account_id, client_id, case_id)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [req.params.id, client_id, case_id || null]);

        res.json({ success: true, ledger: result.rows[0] });
    } catch (error) {
        console.error('Create client ledger error:', error);
        res.status(500).json({ error: 'Failed to create client ledger' });
    }
});

// Record transaction for specific account (used by account-detail.ejs)
router.post('/api/trust/:id/transactions', requireAuth, async (req, res) => {
    try {
        const trust_account_id = req.params.id;
        const {
            ledger_id, transaction_type, amount, description,
            reference_number, check_number, payee, transaction_date
        } = req.body;

        // Verify ownership
        const accountResult = await db.query(
            'SELECT ta.id, ta.current_balance FROM trust_accounts ta WHERE ta.id = $1 AND (ta.user_id = $2 OR ta.user_id IS NULL)',
            [trust_account_id, req.user.id]
        );

        if (accountResult.rows.length === 0) {
            return res.status(404).json({ error: 'Trust account not found' });
        }

        // Get ledger balance
        const ledgerResult = await db.query(
            'SELECT current_balance FROM client_trust_ledgers WHERE id = $1 AND trust_account_id = $2',
            [ledger_id, trust_account_id]
        );

        if (ledgerResult.rows.length === 0) {
            return res.status(404).json({ error: 'Client ledger not found' });
        }

        const transactionAmount = parseFloat(amount);
        const currentLedgerBalance = parseFloat(ledgerResult.rows[0].current_balance || 0);
        const currentAccountBalance = parseFloat(accountResult.rows[0].current_balance || 0);

        // Calculate new balances
        let newLedgerBalance, newAccountBalance;
        if (transaction_type === 'deposit' || transaction_type === 'interest') {
            newLedgerBalance = currentLedgerBalance + transactionAmount;
            newAccountBalance = currentAccountBalance + transactionAmount;
        } else {
            newLedgerBalance = currentLedgerBalance - transactionAmount;
            newAccountBalance = currentAccountBalance - transactionAmount;
        }

        // Check for insufficient funds on withdrawal
        if ((transaction_type === 'withdrawal' || transaction_type === 'disbursement') && newLedgerBalance < 0) {
            return res.status(400).json({ error: 'Insufficient funds in client ledger' });
        }

        // Start transaction
        const client = await db.connect();
        try {
            await client.query('BEGIN');

            // Insert transaction
            const transResult = await client.query(`
                INSERT INTO trust_transactions
                (trust_account_id, client_trust_ledger_id, transaction_type, amount, balance_after,
                 description, reference_number, check_number, payee, transaction_date, created_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *
            `, [
                trust_account_id, ledger_id, transaction_type, transactionAmount,
                newLedgerBalance, description, reference_number || null, check_number || null, payee || null,
                transaction_date || new Date(), req.user.id
            ]);

            // Update ledger balance
            await client.query(
                'UPDATE client_trust_ledgers SET current_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [newLedgerBalance, ledger_id]
            );

            // Update account balance
            await client.query(
                'UPDATE trust_accounts SET current_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [newAccountBalance, trust_account_id]
            );

            await client.query('COMMIT');

            res.json({ success: true, transaction: transResult.rows[0] });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Record transaction error:', error);
        res.status(500).json({ error: 'Failed to record transaction' });
    }
});

// Create client ledger for specific account (used by account-detail.ejs)
router.post('/api/trust/:id/ledgers', requireAuth, async (req, res) => {
    try {
        const { client_id, case_id } = req.body;
        const trust_account_id = req.params.id;

        // Verify ownership
        const accountResult = await db.query(
            'SELECT id FROM trust_accounts WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
            [trust_account_id, req.user.id]
        );

        if (accountResult.rows.length === 0) {
            return res.status(404).json({ error: 'Trust account not found' });
        }

        // Check if ledger already exists
        const existingLedger = await db.query(
            'SELECT id FROM client_trust_ledgers WHERE trust_account_id = $1 AND client_id = $2',
            [trust_account_id, client_id]
        );

        if (existingLedger.rows.length > 0) {
            return res.status(400).json({ error: 'Ledger already exists for this client' });
        }

        const result = await db.query(`
            INSERT INTO client_trust_ledgers (trust_account_id, client_id, case_id)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [trust_account_id, client_id, case_id || null]);

        res.json({ success: true, ledger: result.rows[0] });
    } catch (error) {
        console.error('Create client ledger error:', error);
        res.status(500).json({ error: 'Failed to create client ledger' });
    }
});

// Reconcile selected transactions (used by reconcile.ejs)
router.post('/api/trust/:id/reconcile', requireAuth, async (req, res) => {
    try {
        const { transaction_ids } = req.body;
        const trust_account_id = req.params.id;

        // Verify ownership
        const accountResult = await db.query(
            'SELECT id FROM trust_accounts WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
            [trust_account_id, req.user.id]
        );

        if (accountResult.rows.length === 0) {
            return res.status(404).json({ error: 'Trust account not found' });
        }

        if (!transaction_ids || transaction_ids.length === 0) {
            return res.status(400).json({ error: 'No transactions selected' });
        }

        // Mark transactions as reconciled
        await db.query(`
            UPDATE trust_transactions
            SET reconciled = true, reconciled_at = CURRENT_TIMESTAMP, reconciled_by = $3
            WHERE id = ANY($1) AND trust_account_id = $2
        `, [transaction_ids, trust_account_id, req.user.id]);

        res.json({ success: true, message: 'Transactions reconciled' });
    } catch (error) {
        console.error('Reconcile transactions error:', error);
        res.status(500).json({ error: 'Failed to reconcile transactions' });
    }
});

// Create reconciliation record (used by reconcile.ejs)
router.post('/api/trust/:id/reconciliations', requireAuth, async (req, res) => {
    try {
        const { statement_date, statement_balance, notes } = req.body;
        const trust_account_id = req.params.id;

        // Verify ownership
        const accountResult = await db.query(
            'SELECT id, current_balance FROM trust_accounts WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
            [trust_account_id, req.user.id]
        );

        if (accountResult.rows.length === 0) {
            return res.status(404).json({ error: 'Trust account not found' });
        }

        const bookBalance = parseFloat(accountResult.rows[0].current_balance || 0);
        const statementBal = parseFloat(statement_balance || 0);
        const isBalanced = Math.abs(bookBalance - statementBal) < 0.01;

        const result = await db.query(`
            INSERT INTO trust_reconciliations
            (trust_account_id, statement_date, statement_balance, book_balance, is_balanced, notes, reconciled_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [trust_account_id, statement_date, statementBal, bookBalance, isBalanced, notes || null, req.user.id]);

        res.json({ success: true, reconciliation: result.rows[0] });
    } catch (error) {
        console.error('Create reconciliation error:', error);
        res.status(500).json({ error: 'Failed to create reconciliation' });
    }
});

// Record transaction (legacy route)
router.post('/api/trust/transactions', requireAuth, async (req, res) => {
    try {
        const {
            trust_account_id, client_trust_ledger_id, transaction_type,
            amount, description, reference_number, check_number, payee, transaction_date
        } = req.body;

        // Verify ownership
        const accountResult = await db.query(
            'SELECT ta.id, ta.current_balance FROM trust_accounts ta WHERE ta.id = $1 AND (ta.user_id = $2 OR ta.user_id IS NULL)',
            [trust_account_id, req.user.id]
        );

        if (accountResult.rows.length === 0) {
            return res.status(404).json({ error: 'Trust account not found' });
        }

        // Get ledger balance
        const ledgerResult = await db.query(
            'SELECT current_balance FROM client_trust_ledgers WHERE id = $1',
            [client_trust_ledger_id]
        );

        if (ledgerResult.rows.length === 0) {
            return res.status(404).json({ error: 'Client ledger not found' });
        }

        const transactionAmount = parseFloat(amount);
        const currentLedgerBalance = parseFloat(ledgerResult.rows[0].current_balance);
        const currentAccountBalance = parseFloat(accountResult.rows[0].current_balance);

        // Calculate new balances
        let newLedgerBalance, newAccountBalance;
        if (transaction_type === 'deposit' || transaction_type === 'interest') {
            newLedgerBalance = currentLedgerBalance + transactionAmount;
            newAccountBalance = currentAccountBalance + transactionAmount;
        } else {
            newLedgerBalance = currentLedgerBalance - transactionAmount;
            newAccountBalance = currentAccountBalance - transactionAmount;
        }

        // Check for insufficient funds
        if (newLedgerBalance < 0) {
            return res.status(400).json({ error: 'Insufficient funds in client ledger' });
        }

        // Start transaction
        const client = await db.connect();
        try {
            await client.query('BEGIN');

            // Insert transaction
            const transResult = await client.query(`
                INSERT INTO trust_transactions
                (trust_account_id, client_trust_ledger_id, transaction_type, amount, balance_after,
                 description, reference_number, check_number, payee, transaction_date, created_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *
            `, [
                trust_account_id, client_trust_ledger_id, transaction_type, transactionAmount,
                newLedgerBalance, description, reference_number, check_number, payee,
                transaction_date || new Date(), req.user.id
            ]);

            // Update ledger balance
            await client.query(
                'UPDATE client_trust_ledgers SET current_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [newLedgerBalance, client_trust_ledger_id]
            );

            // Update account balance
            await client.query(
                'UPDATE trust_accounts SET current_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [newAccountBalance, trust_account_id]
            );

            await client.query('COMMIT');

            res.json({ success: true, transaction: transResult.rows[0] });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Record transaction error:', error);
        res.status(500).json({ error: 'Failed to record transaction' });
    }
});

// Reconcile transactions
router.post('/api/trust/accounts/:id/reconcile', requireAuth, async (req, res) => {
    try {
        const { statement_date, statement_balance, transaction_ids, notes } = req.body;

        // Verify ownership
        const accountResult = await db.query(
            'SELECT * FROM trust_accounts WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
            [req.params.id, req.user.id]
        );

        if (accountResult.rows.length === 0) {
            return res.status(404).json({ error: 'Trust account not found' });
        }

        const bookBalance = parseFloat(accountResult.rows[0].current_balance);
        const statementBal = parseFloat(statement_balance);
        const isBalanced = Math.abs(bookBalance - statementBal) < 0.01;

        const client = await db.connect();
        try {
            await client.query('BEGIN');

            // Mark transactions as reconciled
            if (transaction_ids && transaction_ids.length > 0) {
                await client.query(`
                    UPDATE trust_transactions
                    SET reconciled = true, reconciled_at = CURRENT_TIMESTAMP, reconciled_by = $1
                    WHERE id = ANY($2::uuid[])
                `, [req.user.id, transaction_ids]);
            }

            // Create reconciliation record
            const reconcResult = await client.query(`
                INSERT INTO trust_reconciliations
                (trust_account_id, statement_date, statement_balance, book_balance, adjusted_balance, is_balanced, notes, reconciled_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `, [req.params.id, statement_date, statementBal, bookBalance, statementBal, isBalanced, notes, req.user.id]);

            await client.query('COMMIT');

            res.json({ success: true, reconciliation: reconcResult.rows[0], isBalanced });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Reconciliation error:', error);
        res.status(500).json({ error: 'Failed to reconcile' });
    }
});

// Get client trust balance
router.get('/api/clients/:id/trust-balance', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT ctl.*, ta.account_name, cs.title as case_title
            FROM client_trust_ledgers ctl
            JOIN trust_accounts ta ON ctl.trust_account_id = ta.id
            LEFT JOIN cases cs ON ctl.case_id = cs.id
            WHERE ctl.client_id = $1 AND (ta.user_id = $2 OR ta.user_id IS NULL)
        `, [req.params.id, req.user.id]);

        const total = result.rows.reduce((sum, l) => sum + parseFloat(l.current_balance), 0);

        res.json({ success: true, ledgers: result.rows, totalBalance: total });
    } catch (error) {
        console.error('Get client trust balance error:', error);
        res.status(500).json({ error: 'Failed to get trust balance' });
    }
});

// Delete trust account
router.delete('/api/trust/accounts/:id', requireAuth, async (req, res) => {
    try {
        // Verify ownership and check for balance
        const accountResult = await db.query(
            'SELECT * FROM trust_accounts WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
            [req.params.id, req.user.id]
        );

        if (accountResult.rows.length === 0) {
            return res.status(404).json({ error: 'Trust account not found' });
        }

        const account = accountResult.rows[0];
        if (parseFloat(account.current_balance) !== 0) {
            return res.status(400).json({ error: 'Cannot delete account with non-zero balance' });
        }

        const client = await db.connect();
        try {
            await client.query('BEGIN');

            // Delete transactions
            await client.query(`
                DELETE FROM trust_transactions
                WHERE client_trust_ledger_id IN (
                    SELECT id FROM client_trust_ledgers WHERE trust_account_id = $1
                )
            `, [req.params.id]);

            // Delete ledgers
            await client.query(
                'DELETE FROM client_trust_ledgers WHERE trust_account_id = $1',
                [req.params.id]
            );

            // Delete reconciliations
            await client.query(
                'DELETE FROM trust_reconciliations WHERE trust_account_id = $1',
                [req.params.id]
            );

            // Delete account
            await client.query(
                'DELETE FROM trust_accounts WHERE id = $1',
                [req.params.id]
            );

            await client.query('COMMIT');
            res.json({ success: true });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Delete trust account error:', error);
        res.status(500).json({ error: 'Failed to delete trust account' });
    }
});

// Delete trust transaction
router.delete('/api/trust/transactions/:id', requireAuth, async (req, res) => {
    try {
        // Get transaction details
        const txResult = await db.query(`
            SELECT tt.*, ta.user_id, ctl.current_balance as ledger_balance, ta.current_balance as account_balance
            FROM trust_transactions tt
            JOIN client_trust_ledgers ctl ON tt.client_trust_ledger_id = ctl.id
            JOIN trust_accounts ta ON tt.trust_account_id = ta.id
            WHERE tt.id = $1
        `, [req.params.id]);

        if (txResult.rows.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const tx = txResult.rows[0];
        if (tx.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const client = await db.connect();
        try {
            await client.query('BEGIN');

            // Reverse the transaction amounts
            const reversalAmount = tx.transaction_type === 'deposit'
                ? -parseFloat(tx.amount)
                : parseFloat(tx.amount);

            // Update ledger balance
            await client.query(
                'UPDATE client_trust_ledgers SET current_balance = current_balance + $1 WHERE id = $2',
                [reversalAmount, tx.client_trust_ledger_id]
            );

            // Update account balance
            await client.query(
                'UPDATE trust_accounts SET current_balance = current_balance + $1 WHERE id = $2',
                [reversalAmount, tx.trust_account_id]
            );

            // Delete transaction
            await client.query('DELETE FROM trust_transactions WHERE id = $1', [req.params.id]);

            await client.query('COMMIT');
            res.json({ success: true });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Delete trust transaction error:', error);
        res.status(500).json({ error: 'Failed to delete transaction' });
    }
});

// Delete client ledger
router.delete('/api/trust/:accountId/ledgers/:ledgerId', requireAuth, async (req, res) => {
    try {
        const { accountId, ledgerId } = req.params;

        // Verify ownership
        const accountResult = await db.query(
            'SELECT id FROM trust_accounts WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
            [accountId, req.user.id]
        );

        if (accountResult.rows.length === 0) {
            return res.status(404).json({ error: 'Trust account not found' });
        }

        // Get ledger to check balance and get transaction totals
        const ledgerResult = await db.query(
            'SELECT * FROM client_trust_ledgers WHERE id = $1 AND trust_account_id = $2',
            [ledgerId, accountId]
        );

        if (ledgerResult.rows.length === 0) {
            return res.status(404).json({ error: 'Ledger not found' });
        }

        const ledger = ledgerResult.rows[0];

        // Check if ledger has non-zero balance
        if (parseFloat(ledger.current_balance || 0) !== 0) {
            return res.status(400).json({ error: 'Cannot delete ledger with non-zero balance. Please transfer or withdraw funds first.' });
        }

        const client = await db.connect();
        try {
            await client.query('BEGIN');

            // Delete all transactions for this ledger
            await client.query(
                'DELETE FROM trust_transactions WHERE client_trust_ledger_id = $1',
                [ledgerId]
            );

            // Delete the ledger
            await client.query(
                'DELETE FROM client_trust_ledgers WHERE id = $1',
                [ledgerId]
            );

            await client.query('COMMIT');
            res.json({ success: true });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Delete client ledger error:', error);
        res.status(500).json({ error: 'Failed to delete ledger' });
    }
});

module.exports = router;

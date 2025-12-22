/**
 * Online Payments Routes (Stripe Integration)
 * Handles payment processing, payment links, and payment management
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const crypto = require('crypto');

// Initialize Stripe (will use env variable)
let stripe;
try {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
} catch (e) {
    console.log('Stripe not configured - payments will be in demo mode');
}

// =====================================================
// PUBLIC PAYMENT ROUTES
// =====================================================

// Public payment page (accessed via payment link)
router.get('/pay/:token', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT pl.*, i.invoice_number, i.total, i.amount_paid, i.client_id, i.due_date,
                   c.first_name, c.last_name, c.email, c.company_name,
                   u.first_name as attorney_first_name, u.last_name as attorney_last_name
            FROM payment_links pl
            JOIN invoices i ON pl.invoice_id = i.id
            JOIN clients c ON i.client_id = c.id
            JOIN users u ON i.user_id = u.id
            WHERE pl.token = $1 AND pl.is_active = true
            AND (pl.expires_at IS NULL OR pl.expires_at > NOW())
        `, [req.params.token]);

        if (result.rows.length === 0) {
            return res.status(404).render('payments/expired', {
                title: 'Payment Link Expired'
            });
        }

        const paymentLink = result.rows[0];
        const balanceDue = parseFloat(paymentLink.total) - parseFloat(paymentLink.amount_paid);

        // Update view count
        await db.query('UPDATE payment_links SET viewed_count = viewed_count + 1 WHERE token = $1', [req.params.token]);

        res.render('payments/pay', {
            title: 'Pay Invoice',
            paymentLink,
            balanceDue,
            stripePublicKey: process.env.STRIPE_PUBLIC_KEY
        });
    } catch (error) {
        console.error('Payment page error:', error);
        res.status(500).render('error', { message: 'Error loading payment page' });
    }
});

// Create payment intent
router.post('/pay/:token/create-intent', async (req, res) => {
    try {
        const { amount } = req.body;

        const linkResult = await db.query(`
            SELECT pl.*, i.id as invoice_id, i.client_id, c.email
            FROM payment_links pl
            JOIN invoices i ON pl.invoice_id = i.id
            JOIN clients c ON i.client_id = c.id
            WHERE pl.token = $1 AND pl.is_active = true
        `, [req.params.token]);

        if (linkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Payment link not found' });
        }

        const link = linkResult.rows[0];

        if (!stripe) {
            // Demo mode - simulate payment
            return res.json({
                clientSecret: 'demo_' + crypto.randomBytes(16).toString('hex'),
                demoMode: true
            });
        }

        // Get or create Stripe customer
        let stripeCustomerId;
        const customerResult = await db.query(
            'SELECT stripe_customer_id FROM stripe_customers WHERE client_id = $1',
            [link.client_id]
        );

        if (customerResult.rows.length > 0) {
            stripeCustomerId = customerResult.rows[0].stripe_customer_id;
        } else {
            const customer = await stripe.customers.create({
                email: link.email,
                metadata: { client_id: link.client_id }
            });
            stripeCustomerId = customer.id;

            await db.query(`
                INSERT INTO stripe_customers (client_id, stripe_customer_id)
                VALUES ($1, $2)
            `, [link.client_id, stripeCustomerId]);
        }

        // Create payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(parseFloat(amount) * 100), // Convert to cents
            currency: 'usd',
            customer: stripeCustomerId,
            metadata: {
                invoice_id: link.invoice_id,
                client_id: link.client_id,
                payment_link_token: req.params.token
            },
            automatic_payment_methods: { enabled: true }
        });

        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        console.error('Create payment intent error:', error);
        res.status(500).json({ error: 'Failed to create payment' });
    }
});

// Process demo payment
router.post('/pay/:token/demo-process', async (req, res) => {
    try {
        const { amount } = req.body;

        const linkResult = await db.query(`
            SELECT pl.*, i.id as invoice_id, i.client_id, i.total, i.amount_paid
            FROM payment_links pl
            JOIN invoices i ON pl.invoice_id = i.id
            WHERE pl.token = $1 AND pl.is_active = true
        `, [req.params.token]);

        if (linkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Payment link not found' });
        }

        const link = linkResult.rows[0];
        const paymentAmount = parseFloat(amount);

        // Record the payment
        await db.query(`
            INSERT INTO online_payments (invoice_id, client_id, stripe_payment_intent_id, amount, status, fee_amount, net_amount)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            link.invoice_id,
            link.client_id,
            'demo_' + crypto.randomBytes(16).toString('hex'),
            paymentAmount,
            'succeeded',
            Math.round(paymentAmount * 0.029 * 100) / 100 + 0.30,
            paymentAmount - (Math.round(paymentAmount * 0.029 * 100) / 100 + 0.30)
        ]);

        // Update invoice
        const newAmountPaid = parseFloat(link.amount_paid) + paymentAmount;
        const newStatus = newAmountPaid >= parseFloat(link.total) ? 'paid' : 'sent';

        await db.query(`
            UPDATE invoices SET amount_paid = $1, status = $2, paid_date = CASE WHEN $2 = 'paid' THEN CURRENT_DATE ELSE paid_date END
            WHERE id = $3
        `, [newAmountPaid, newStatus, link.invoice_id]);

        // Record in payments table
        await db.query(`
            INSERT INTO payments (invoice_id, amount, payment_method, reference_number, payment_date)
            VALUES ($1, $2, $3, $4, CURRENT_DATE)
        `, [link.invoice_id, paymentAmount, 'credit_card', 'DEMO-' + Date.now()]);

        // Deactivate payment link if fully paid
        if (newStatus === 'paid') {
            await db.query('UPDATE payment_links SET is_active = false WHERE token = $1', [req.params.token]);
        }

        res.json({ success: true, status: newStatus });
    } catch (error) {
        console.error('Demo payment error:', error);
        res.status(500).json({ error: 'Payment processing failed' });
    }
});

// Payment success page
router.get('/pay/:token/success', async (req, res) => {
    res.render('payments/success', {
        title: 'Payment Successful'
    });
});

// =====================================================
// AUTHENTICATED ROUTES (Attorney/Admin)
// =====================================================

// Payments dashboard
router.get('/payments', requireAuth, async (req, res) => {
    try {
        // Recent online payments
        const paymentsResult = await db.query(`
            SELECT op.*, i.invoice_number, c.first_name, c.last_name, c.company_name
            FROM online_payments op
            JOIN invoices i ON op.invoice_id = i.id
            JOIN clients c ON op.client_id = c.id
            WHERE (i.user_id = $1 OR i.user_id IS NULL)
            ORDER BY op.created_at DESC
            LIMIT 20
        `, [req.user.id]);

        // Payment stats
        const statsResult = await db.query(`
            SELECT
                COUNT(*) FILTER (WHERE op.status = 'succeeded') as successful_count,
                COALESCE(SUM(op.amount) FILTER (WHERE op.status = 'succeeded'), 0) as total_collected,
                COALESCE(SUM(op.fee_amount) FILTER (WHERE op.status = 'succeeded'), 0) as total_fees,
                COUNT(*) FILTER (WHERE op.status = 'failed') as failed_count
            FROM online_payments op
            JOIN invoices i ON op.invoice_id = i.id
            WHERE (i.user_id = $1 OR i.user_id IS NULL) AND op.created_at >= NOW() - INTERVAL '30 days'
        `, [req.user.id]);

        // Active payment links
        const linksResult = await db.query(`
            SELECT pl.*, i.invoice_number, c.first_name, c.last_name
            FROM payment_links pl
            JOIN invoices i ON pl.invoice_id = i.id
            JOIN clients c ON i.client_id = c.id
            WHERE (i.user_id = $1 OR i.user_id IS NULL) AND pl.is_active = true
            ORDER BY pl.created_at DESC
        `, [req.user.id]);

        res.render('payments/dashboard', {
            title: 'Payments',
            payments: paymentsResult.rows,
            stats: statsResult.rows[0],
            paymentLinks: linksResult.rows,
            req
        });
    } catch (error) {
        console.error('Payments dashboard error:', error);
        res.status(500).render('error', { message: 'Error loading payments' });
    }
});

// Payment links list
router.get('/payments/links', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT pl.*, i.invoice_number, c.first_name, c.last_name, c.company_name
            FROM payment_links pl
            JOIN invoices i ON pl.invoice_id = i.id
            JOIN clients c ON i.client_id = c.id
            WHERE (i.user_id = $1 OR i.user_id IS NULL)
            ORDER BY pl.created_at DESC
        `, [req.user.id]);

        res.render('payments/links', {
            title: 'Payment Links',
            links: result.rows,
            req
        });
    } catch (error) {
        console.error('Payment links error:', error);
        res.status(500).json({ error: 'Something went wrong!' });
    }
});

// Create new payment link page
router.get('/payments/links/new', requireAuth, async (req, res) => {
    try {
        const invoices = await db.query(`
            SELECT i.*, c.first_name, c.last_name, c.company_name
            FROM invoices i
            JOIN clients c ON i.client_id = c.id
            WHERE (i.user_id = $1 OR i.user_id IS NULL) AND i.status != 'paid'
            ORDER BY i.created_at DESC
        `, [req.user.id]);

        res.render('payments/link-new', {
            title: 'Create Payment Link',
            invoices: invoices.rows,
            req
        });
    } catch (error) {
        console.error('New payment link error:', error);
        res.status(500).json({ error: 'Something went wrong!' });
    }
});

// Payment transactions
router.get('/payments/transactions', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT op.*, i.invoice_number, c.first_name, c.last_name, c.company_name
            FROM online_payments op
            JOIN invoices i ON op.invoice_id = i.id
            JOIN clients c ON op.client_id = c.id
            WHERE (i.user_id = $1 OR i.user_id IS NULL)
            ORDER BY op.created_at DESC
        `, [req.user.id]);

        res.render('payments/transactions', {
            title: 'Payment Transactions',
            transactions: result.rows,
            req
        });
    } catch (error) {
        console.error('Payment transactions error:', error);
        res.status(500).json({ error: 'Something went wrong!' });
    }
});

// Payment settings
router.get('/payments/settings', requireAuth, async (req, res) => {
    try {
        res.render('payments/settings', {
            title: 'Payment Settings',
            stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
            req
        });
    } catch (error) {
        console.error('Payment settings error:', error);
        res.status(500).json({ error: 'Something went wrong!' });
    }
});

// Create payment link for invoice
router.post('/api/invoices/:id/payment-link', requireAuth, async (req, res) => {
    try {
        // Verify invoice belongs to user
        const invoiceResult = await db.query(
            'SELECT * FROM invoices WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
            [req.params.id, req.user.id]
        );

        if (invoiceResult.rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        const invoice = invoiceResult.rows[0];
        const balanceDue = parseFloat(invoice.total) - parseFloat(invoice.amount_paid);

        if (balanceDue <= 0) {
            return res.status(400).json({ error: 'Invoice is already paid' });
        }

        // Deactivate existing payment links
        await db.query(
            'UPDATE payment_links SET is_active = false WHERE invoice_id = $1',
            [req.params.id]
        );

        // Create new payment link
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = req.body.expires_days
            ? new Date(Date.now() + req.body.expires_days * 24 * 60 * 60 * 1000)
            : null;

        const result = await db.query(`
            INSERT INTO payment_links (invoice_id, token, amount, expires_at)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [req.params.id, token, balanceDue, expiresAt]);

        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
        const paymentUrl = `${baseUrl}/pay/${token}`;

        res.json({
            success: true,
            paymentLink: result.rows[0],
            paymentUrl
        });
    } catch (error) {
        console.error('Create payment link error:', error);
        res.status(500).json({ error: 'Failed to create payment link' });
    }
});

// Deactivate payment link
router.delete('/api/payment-links/:id', requireAuth, async (req, res) => {
    try {
        await db.query(`
            UPDATE payment_links SET is_active = false
            WHERE id = $1 AND invoice_id IN (SELECT id FROM invoices WHERE (user_id = $2 OR user_id IS NULL))
        `, [req.params.id, req.user.id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Deactivate payment link error:', error);
        res.status(500).json({ error: 'Failed to deactivate payment link' });
    }
});

// Toggle payment link (used by links.ejs)
router.post('/api/payments/links/:id/toggle', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            UPDATE payment_links
            SET is_active = NOT is_active
            WHERE id = $1 AND invoice_id IN (SELECT id FROM invoices WHERE (user_id = $2 OR user_id IS NULL))
            RETURNING *
        `, [req.params.id, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Payment link not found' });
        }

        res.json({ success: true, link: result.rows[0] });
    } catch (error) {
        console.error('Toggle payment link error:', error);
        res.status(500).json({ error: 'Failed to toggle payment link' });
    }
});

// Delete payment link (used by links.ejs)
router.delete('/api/payments/links/:id', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            DELETE FROM payment_links
            WHERE id = $1 AND invoice_id IN (SELECT id FROM invoices WHERE (user_id = $2 OR user_id IS NULL))
            RETURNING id
        `, [req.params.id, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Payment link not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Delete payment link error:', error);
        res.status(500).json({ error: 'Failed to delete payment link' });
    }
});

// Get payment methods for client
router.get('/api/clients/:id/payment-methods', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT pm.* FROM payment_methods pm
            JOIN clients c ON pm.client_id = c.id
            WHERE c.id = $1 AND (c.user_id = $2 OR c.user_id IS NULL)
            ORDER BY pm.is_default DESC, pm.created_at DESC
        `, [req.params.id, req.user.id]);

        res.json({ success: true, paymentMethods: result.rows });
    } catch (error) {
        console.error('Get payment methods error:', error);
        res.status(500).json({ error: 'Failed to get payment methods' });
    }
});

// Stripe webhook handler
router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    if (!stripe) {
        return res.status(200).send('Stripe not configured');
    }

    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            await handleSuccessfulPayment(paymentIntent);
            break;
        case 'payment_intent.payment_failed':
            const failedIntent = event.data.object;
            await handleFailedPayment(failedIntent);
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
});

async function handleSuccessfulPayment(paymentIntent) {
    try {
        const { invoice_id, client_id, payment_link_token } = paymentIntent.metadata;
        const amount = paymentIntent.amount / 100; // Convert from cents
        const fee = Math.round(amount * 0.029 * 100) / 100 + 0.30;

        // Record online payment
        await db.query(`
            INSERT INTO online_payments (invoice_id, client_id, stripe_payment_intent_id, stripe_charge_id, amount, status, fee_amount, net_amount)
            VALUES ($1, $2, $3, $4, $5, 'succeeded', $6, $7)
        `, [invoice_id, client_id, paymentIntent.id, paymentIntent.latest_charge, amount, fee, amount - fee]);

        // Update invoice
        const invoiceResult = await db.query('SELECT total, amount_paid FROM invoices WHERE id = $1', [invoice_id]);
        if (invoiceResult.rows.length > 0) {
            const invoice = invoiceResult.rows[0];
            const newAmountPaid = parseFloat(invoice.amount_paid) + amount;
            const newStatus = newAmountPaid >= parseFloat(invoice.total) ? 'paid' : 'sent';

            await db.query(`
                UPDATE invoices SET amount_paid = $1, status = $2, paid_date = CASE WHEN $2 = 'paid' THEN CURRENT_DATE ELSE paid_date END
                WHERE id = $3
            `, [newAmountPaid, newStatus, invoice_id]);

            // Record in payments table
            await db.query(`
                INSERT INTO payments (invoice_id, amount, payment_method, reference_number, payment_date)
                VALUES ($1, $2, 'credit_card', $3, CURRENT_DATE)
            `, [invoice_id, amount, paymentIntent.id]);

            // Deactivate payment link if fully paid
            if (newStatus === 'paid' && payment_link_token) {
                await db.query('UPDATE payment_links SET is_active = false WHERE token = $1', [payment_link_token]);
            }
        }

        // Create notification for attorney
        const invResult = await db.query('SELECT user_id, invoice_number FROM invoices WHERE id = $1', [invoice_id]);
        if (invResult.rows.length > 0) {
            await db.query(`
                INSERT INTO notifications (user_id, title, message, notification_type, reference_type, reference_id)
                VALUES ($1, $2, $3, 'payment', 'invoice', $4)
            `, [
                invResult.rows[0].user_id,
                'Payment Received',
                `Payment of $${amount.toFixed(2)} received for Invoice #${invResult.rows[0].invoice_number}`,
                invoice_id
            ]);
        }
    } catch (error) {
        console.error('Handle successful payment error:', error);
    }
}

async function handleFailedPayment(paymentIntent) {
    try {
        const { invoice_id, client_id } = paymentIntent.metadata;
        const amount = paymentIntent.amount / 100;

        await db.query(`
            INSERT INTO online_payments (invoice_id, client_id, stripe_payment_intent_id, amount, status, failure_reason)
            VALUES ($1, $2, $3, $4, 'failed', $5)
        `, [invoice_id, client_id, paymentIntent.id, amount, paymentIntent.last_payment_error?.message || 'Unknown error']);
    } catch (error) {
        console.error('Handle failed payment error:', error);
    }
}

module.exports = router;

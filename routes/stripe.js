/**
 * Stripe Payment Routes
 * Handles payment processing, card management, and subscriptions
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const {
    getOrCreateCustomer,
    createSetupIntent,
    createPaymentIntent,
    listPaymentMethods,
    detachPaymentMethod,
    setDefaultPaymentMethod,
    createSubscription,
    cancelSubscription,
    createRefund,
    retrievePaymentIntent,
    getOrCreateSubscriptionProducts
} = require('../config/stripe');

// =====================================================
// PAGE ROUTES
// =====================================================

// Billing/Payment Methods Page
router.get('/payment-methods', requireAuth, async (req, res) => {
    try {
        // Get fresh user data from database (session may be stale)
        const userResult = await db.query(
            'SELECT stripe_customer_id FROM users WHERE id = $1',
            [req.user.id]
        );
        const stripeCustomerId = userResult.rows[0]?.stripe_customer_id;

        // Get user's Stripe customer and payment methods
        let paymentMethods = [];
        let subscription = null;

        if (stripeCustomerId) {
            try {
                paymentMethods = await listPaymentMethods(stripeCustomerId);
            } catch (err) {
                console.log('Error fetching payment methods:', err.message);
            }
        }

        // Get subscription info
        const subResult = await db.query(
            'SELECT * FROM subscriptions WHERE (user_id = $1 OR user_id IS NULL) AND status = $2 ORDER BY created_at DESC LIMIT 1',
            [req.user.id, 'active']
        );
        subscription = subResult.rows[0];

        // Get payment history (Stripe payments are tracked separately)
        // For now, return empty array since payments table uses invoice_id, not user_id
        const payments = [];

        res.render('billing/index', {
            title: 'Billing & Payments',
            user: req.user,
            paymentMethods,
            subscription,
            payments,
            stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
            req
        });
    } catch (error) {
        console.error('Billing page error:', error);
        res.status(500).render('error', { message: 'Error loading billing page' });
    }
});

// Subscription Plans Page
router.get('/subscription', requireAuth, async (req, res) => {
    try {
        const plans = [
            {
                name: 'Free',
                price: 0,
                features: ['5 cases per month', 'Basic document generation', 'Email support'],
                recommended: false
            },
            {
                name: 'Professional',
                price: 49,
                features: ['Unlimited cases', 'All document types', 'AI-powered drafting', 'Priority support', 'Client portal'],
                recommended: true
            },
            {
                name: 'Enterprise',
                price: 149,
                features: ['Everything in Professional', 'API access', 'Custom integrations', 'Dedicated account manager', 'SLA guarantee'],
                recommended: false
            }
        ];

        // Get current subscription
        const subResult = await db.query(
            'SELECT * FROM subscriptions WHERE (user_id = $1 OR user_id IS NULL) AND status = $2 ORDER BY created_at DESC LIMIT 1',
            [req.user.id, 'active']
        );

        res.render('billing/subscription', {
            title: 'Subscription Plans',
            user: req.user,
            plans,
            currentSubscription: subResult.rows[0],
            stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
            req
        });
    } catch (error) {
        console.error('Subscription page error:', error);
        res.status(500).render('error', { message: 'Error loading subscription page' });
    }
});

// =====================================================
// API ROUTES
// =====================================================

// Create Setup Intent (for saving card without payment)
router.post('/api/stripe/setup-intent', requireAuth, async (req, res) => {
    try {
        const customer = await getOrCreateCustomer(
            db,
            req.user.id,
            req.user.email,
            `${req.user.first_name} ${req.user.last_name}`
        );

        const setupIntent = await createSetupIntent(customer.id);

        res.json({
            success: true,
            clientSecret: setupIntent.client_secret
        });
    } catch (error) {
        console.error('Setup intent error:', error);
        res.status(500).json({ error: 'Failed to create setup intent' });
    }
});

// List Payment Methods
router.get('/api/stripe/payment-methods', requireAuth, async (req, res) => {
    try {
        if (!req.user.stripe_customer_id) {
            return res.json({ success: true, paymentMethods: [] });
        }

        const paymentMethods = await listPaymentMethods(req.user.stripe_customer_id);

        res.json({
            success: true,
            paymentMethods: paymentMethods.map(pm => ({
                id: pm.id,
                brand: pm.card.brand,
                last4: pm.card.last4,
                expMonth: pm.card.exp_month,
                expYear: pm.card.exp_year
            }))
        });
    } catch (error) {
        console.error('List payment methods error:', error);
        res.status(500).json({ error: 'Failed to list payment methods' });
    }
});

// Delete Payment Method
router.delete('/api/stripe/payment-methods/:id', requireAuth, async (req, res) => {
    try {
        await detachPaymentMethod(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete payment method error:', error);
        res.status(500).json({ error: 'Failed to delete payment method' });
    }
});

// Set Default Payment Method
router.post('/api/stripe/payment-methods/:id/default', requireAuth, async (req, res) => {
    try {
        if (!req.user.stripe_customer_id) {
            return res.status(400).json({ error: 'No customer found' });
        }

        await setDefaultPaymentMethod(req.user.stripe_customer_id, req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Set default payment method error:', error);
        res.status(500).json({ error: 'Failed to set default payment method' });
    }
});

// Create Payment Intent (for one-time payment)
router.post('/api/stripe/payment-intent', requireAuth, async (req, res) => {
    try {
        const { amount, description, invoiceId } = req.body;

        const customer = await getOrCreateCustomer(
            db,
            req.user.id,
            req.user.email,
            `${req.user.first_name} ${req.user.last_name}`
        );

        const paymentIntent = await createPaymentIntent({
            amount,
            customerId: customer.id,
            description,
            metadata: {
                userId: req.user.id,
                invoiceId: invoiceId || ''
            }
        });

        // Record payment in database
        await db.query(`
            INSERT INTO payments (user_id, invoice_id, stripe_payment_intent_id, amount, description, status)
            VALUES ($1, $2, $3, $4, $5, 'pending')
        `, [req.user.id, invoiceId || null, paymentIntent.id, amount, description]);

        res.json({
            success: true,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });
    } catch (error) {
        console.error('Payment intent error:', error);
        res.status(500).json({ error: 'Failed to create payment intent' });
    }
});

// Confirm Payment
router.post('/api/stripe/confirm-payment', requireAuth, async (req, res) => {
    try {
        const { paymentIntentId } = req.body;

        const paymentIntent = await retrievePaymentIntent(paymentIntentId);

        // Update payment status in database
        await db.query(
            'UPDATE payments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE stripe_payment_intent_id = $2',
            [paymentIntent.status === 'succeeded' ? 'completed' : paymentIntent.status, paymentIntentId]
        );

        res.json({
            success: true,
            status: paymentIntent.status
        });
    } catch (error) {
        console.error('Confirm payment error:', error);
        res.status(500).json({ error: 'Failed to confirm payment' });
    }
});

// Subscribe to Plan
router.post('/api/stripe/subscribe', requireAuth, async (req, res) => {
    try {
        const { plan, paymentMethodId } = req.body;

        // Get subscription products/prices
        const products = await getOrCreateSubscriptionProducts();
        const selectedPlan = products.find(p => p.plan.toLowerCase() === plan.toLowerCase());

        if (!selectedPlan || !selectedPlan.priceId) {
            return res.status(400).json({ error: 'Invalid plan selected' });
        }

        const customer = await getOrCreateCustomer(
            db,
            req.user.id,
            req.user.email,
            `${req.user.first_name} ${req.user.last_name}`
        );

        // Attach payment method if provided
        if (paymentMethodId) {
            await setDefaultPaymentMethod(customer.id, paymentMethodId);
        }

        // Cancel any existing active subscriptions first
        await db.query(
            "UPDATE subscriptions SET status = 'cancelled' WHERE (user_id = $1 OR user_id IS NULL) AND status = 'active'",
            [req.user.id]
        );

        const subscription = await createSubscription(
            customer.id,
            selectedPlan.priceId,
            { userId: req.user.id, plan }
        );

        // Determine status - if payment succeeded immediately, mark as active
        const status = (subscription.status === 'active' || subscription.latest_invoice?.payment_intent?.status === 'succeeded')
            ? 'active'
            : subscription.status;

        // Save subscription to database
        await db.query(`
            INSERT INTO subscriptions (user_id, stripe_subscription_id, stripe_price_id, plan, status, current_period_start, current_period_end)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            req.user.id,
            subscription.id,
            selectedPlan.priceId,
            plan,
            status,
            new Date(subscription.current_period_start * 1000),
            new Date(subscription.current_period_end * 1000)
        ]);

        // Update user subscription info
        await db.query(
            'UPDATE users SET subscription_plan = $1, subscription_status = $2, stripe_subscription_id = $3 WHERE id = $4',
            [plan, status, subscription.id, req.user.id]
        );

        res.json({
            success: true,
            subscription: {
                id: subscription.id,
                status: subscription.status,
                clientSecret: subscription.latest_invoice?.payment_intent?.client_secret
            }
        });
    } catch (error) {
        console.error('Subscribe error:', error);
        res.status(500).json({ error: 'Failed to create subscription: ' + error.message });
    }
});

// Activate Subscription (called after payment confirms)
router.post('/api/stripe/activate-subscription', requireAuth, async (req, res) => {
    try {
        const { subscriptionId } = req.body;

        // Update subscription status to active
        await db.query(
            "UPDATE subscriptions SET status = 'active' WHERE stripe_subscription_id = $1 AND (user_id = $2 OR user_id IS NULL)",
            [subscriptionId, req.user.id]
        );

        // Update user subscription status
        await db.query(
            "UPDATE users SET subscription_status = 'active' WHERE id = $1",
            [req.user.id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Activate subscription error:', error);
        res.status(500).json({ error: 'Failed to activate subscription' });
    }
});

// Cancel Subscription
router.post('/api/stripe/cancel-subscription', requireAuth, async (req, res) => {
    try {
        const { immediately } = req.body;

        // Get subscription from database
        const subResult = await db.query(
            "SELECT stripe_subscription_id FROM subscriptions WHERE (user_id = $1 OR user_id IS NULL) AND status = 'active' ORDER BY created_at DESC LIMIT 1",
            [req.user.id]
        );

        if (subResult.rows.length === 0) {
            return res.status(400).json({ error: 'No active subscription found' });
        }

        const stripeSubscriptionId = subResult.rows[0].stripe_subscription_id;
        console.log('Cancelling subscription:', stripeSubscriptionId);

        await cancelSubscription(stripeSubscriptionId, immediately);

        // Update database
        await db.query(
            'UPDATE subscriptions SET status = $1, cancel_at_period_end = $2, updated_at = CURRENT_TIMESTAMP WHERE stripe_subscription_id = $3',
            [immediately ? 'cancelled' : 'active', !immediately, stripeSubscriptionId]
        );

        if (immediately) {
            await db.query(
                'UPDATE users SET subscription_status = $1 WHERE id = $2',
                ['cancelled', req.user.id]
            );
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({ error: 'Failed to cancel subscription: ' + error.message });
    }
});

// Process Refund
router.post('/api/stripe/refund', requireAuth, async (req, res) => {
    try {
        const { paymentIntentId, amount } = req.body;

        const refund = await createRefund(paymentIntentId, amount);

        // Update payment status
        await db.query(
            'UPDATE payments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE stripe_payment_intent_id = $2',
            ['refunded', paymentIntentId]
        );

        res.json({ success: true, refund });
    } catch (error) {
        console.error('Refund error:', error);
        res.status(500).json({ error: 'Failed to process refund' });
    }
});

// Webhook Handler (for Stripe events)
router.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.log('Webhook secret not configured, skipping verification');
        return res.json({ received: true });
    }

    try {
        const { constructWebhookEvent } = require('../config/stripe');
        const event = constructWebhookEvent(req.body, sig, webhookSecret);

        switch (event.type) {
            case 'payment_intent.succeeded':
                const paymentIntent = event.data.object;
                await db.query(
                    'UPDATE payments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE stripe_payment_intent_id = $2',
                    ['completed', paymentIntent.id]
                );
                break;

            case 'payment_intent.payment_failed':
                const failedPayment = event.data.object;
                await db.query(
                    'UPDATE payments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE stripe_payment_intent_id = $2',
                    ['failed', failedPayment.id]
                );
                break;

            case 'customer.subscription.updated':
            case 'customer.subscription.deleted':
                const subscription = event.data.object;
                await db.query(
                    'UPDATE subscriptions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE stripe_subscription_id = $2',
                    [subscription.status, subscription.id]
                );
                break;
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(400).json({ error: 'Webhook error' });
    }
});

module.exports = router;

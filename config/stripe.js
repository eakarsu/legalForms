/**
 * Stripe Payment Configuration
 * Handles payment processing, subscriptions, and card management
 */

const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16'
});

/**
 * Create a Stripe customer
 */
async function createCustomer(email, name, metadata = {}) {
    return await stripe.customers.create({
        email,
        name,
        metadata
    });
}

/**
 * Get or create a Stripe customer for a user
 */
async function getOrCreateCustomer(db, userId, email, name) {
    // Check if user already has a Stripe customer ID
    const result = await db.query(
        'SELECT stripe_customer_id FROM users WHERE id = $1',
        [userId]
    );

    if (result.rows[0]?.stripe_customer_id) {
        try {
            const customer = await stripe.customers.retrieve(result.rows[0].stripe_customer_id);
            if (!customer.deleted) {
                return customer;
            }
        } catch (err) {
            console.log('Stripe customer not found, creating new one');
        }
    }

    // Create new customer
    const customer = await createCustomer(email, name, { userId });

    // Save customer ID to database
    await db.query(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
        [customer.id, userId]
    );

    return customer;
}

/**
 * Create a Setup Intent for saving a card without charging
 */
async function createSetupIntent(customerId) {
    return await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session'
    });
}

/**
 * Create a Payment Intent for charging a customer
 */
async function createPaymentIntent({ amount, customerId, description, metadata = {} }) {
    return await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        customer: customerId,
        description,
        metadata,
        automatic_payment_methods: {
            enabled: true,
            allow_redirects: 'never'
        }
    });
}

/**
 * Charge a customer's saved payment method
 */
async function chargeCustomer({ customerId, paymentMethodId, amount, description, metadata = {} }) {
    return await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: 'usd',
        customer: customerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        description,
        metadata
    });
}

/**
 * List customer's saved payment methods
 */
async function listPaymentMethods(customerId) {
    const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card'
    });
    return paymentMethods.data;
}

/**
 * Attach a payment method to a customer
 */
async function attachPaymentMethod(paymentMethodId, customerId) {
    return await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
    });
}

/**
 * Detach a payment method from a customer
 */
async function detachPaymentMethod(paymentMethodId) {
    return await stripe.paymentMethods.detach(paymentMethodId);
}

/**
 * Set default payment method for a customer
 */
async function setDefaultPaymentMethod(customerId, paymentMethodId) {
    return await stripe.customers.update(customerId, {
        invoice_settings: {
            default_payment_method: paymentMethodId
        }
    });
}

/**
 * Create a subscription for a customer
 */
async function createSubscription(customerId, priceId, metadata = {}) {
    return await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        metadata
    });
}

/**
 * Cancel a subscription
 */
async function cancelSubscription(subscriptionId, immediately = false) {
    if (immediately) {
        return await stripe.subscriptions.cancel(subscriptionId);
    }
    return await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
    });
}

/**
 * Create a refund
 */
async function createRefund(paymentIntentId, amount = null) {
    const params = { payment_intent: paymentIntentId };
    if (amount) {
        params.amount = Math.round(amount * 100);
    }
    return await stripe.refunds.create(params);
}

/**
 * Retrieve a payment intent
 */
async function retrievePaymentIntent(paymentIntentId) {
    return await stripe.paymentIntents.retrieve(paymentIntentId);
}

/**
 * Construct webhook event
 */
function constructWebhookEvent(payload, signature, webhookSecret) {
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * Create or retrieve Stripe products for subscription plans
 */
async function getOrCreateSubscriptionProducts() {
    const plans = [
        { name: 'Free', price: 0, features: ['Basic features', '5 cases/month'] },
        { name: 'Professional', price: 49, features: ['All features', 'Unlimited cases', 'Priority support'] },
        { name: 'Enterprise', price: 149, features: ['All Professional features', 'API access', 'Dedicated support', 'Custom integrations'] }
    ];

    const products = [];

    for (const plan of plans) {
        // Try to find existing product
        const existingProducts = await stripe.products.list({ limit: 100 });
        let product = existingProducts.data.find(p => p.name === `LegalPracticeAI ${plan.name}`);

        if (!product) {
            product = await stripe.products.create({
                name: `LegalPracticeAI ${plan.name}`,
                description: plan.features.join(', '),
                metadata: { plan: plan.name.toLowerCase() }
            });
        }

        // Create or get price
        const existingPrices = await stripe.prices.list({ product: product.id, limit: 10 });
        let price = existingPrices.data.find(p => p.unit_amount === plan.price * 100 && p.recurring?.interval === 'month');

        if (!price && plan.price > 0) {
            price = await stripe.prices.create({
                product: product.id,
                unit_amount: plan.price * 100,
                currency: 'usd',
                recurring: { interval: 'month' }
            });
        }

        products.push({
            plan: plan.name,
            productId: product.id,
            priceId: price?.id,
            amount: plan.price
        });
    }

    return products;
}

module.exports = {
    stripe,
    createCustomer,
    getOrCreateCustomer,
    createSetupIntent,
    createPaymentIntent,
    chargeCustomer,
    listPaymentMethods,
    attachPaymentMethod,
    detachPaymentMethod,
    setDefaultPaymentMethod,
    createSubscription,
    cancelSubscription,
    createRefund,
    retrievePaymentIntent,
    constructWebhookEvent,
    getOrCreateSubscriptionProducts
};

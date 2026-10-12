'use strict';

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createGovernedAuth } = require('./governedAuth');
const { createGovernedDocumentsRouter } = require('../routes/governed-documents');
const { WorkflowError } = require('./governedDocumentWorkflow');
const { GovernedProviderClient } = require('./governedProviders');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

function createGovernedApp({ pool, config, providerClient }) {
    if (!pool || !config) throw new TypeError('Database pool and governed configuration are required');
    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', 1);
    app.use(helmet({
        contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
        crossOriginEmbedderPolicy: false
    }));

    const allowedOrigins = new Set(config.allowedOrigins);
    app.use((req, res, next) => {
        const origin = req.get('origin');
        if (!origin) return next();
        if (!allowedOrigins.has(origin)) {
            return next(new WorkflowError(403, 'ORIGIN_NOT_ALLOWED', 'Origin is not allowed'));
        }
        res.set({
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            Vary: 'Origin'
        });
        if (req.method === 'OPTIONS') return res.status(204).end();
        return next();
    });

    app.use(rateLimit({
        windowMs: 60_000,
        max: 120,
        standardHeaders: true,
        legacyHeaders: false
    }));
    app.use(express.json({ limit: '256kb', strict: true }));

    app.get('/healthz', (_req, res) => res.json({ ok: true }));
    app.get('/api/auth/demo-credentials', (_req, res) => {
        if (process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'Not found' });
        const email = process.env.PROVISION_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '';
        const password = process.env.PROVISION_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '';
        if (!email || !password) return res.status(503).json({ error: 'Demo credentials unavailable' });
        res.set('Cache-Control', 'no-store');
        return res.json({ email, password });
    });
    app.get('/readyz', async (_req, res) => {
        try {
            const result = await pool.query(
                `SELECT EXISTS (
                    SELECT 1 FROM migrations_run WHERE filename = '004_governed_provider_delivery.sql'
                 ) AS migrated`
            );
            if (!result.rows[0].migrated) return res.status(503).json({ ok: false, migration: 'missing' });
            return res.json({ ok: true, migration: '004_governed_provider_delivery.sql' });
        } catch (_) {
            return res.status(503).json({ ok: false, database: 'unavailable' });
        }
    });

    const authenticate = createGovernedAuth(pool, config.jwt);
    app.post('/api/auth/login', async (req, res, next) => {
        try {
            const email = String(req.body?.email || '').trim().toLowerCase();
            const password = String(req.body?.password || '');
            const result = await pool.query('SELECT id, email, password_hash, first_name, last_name FROM users WHERE lower(email)=lower($1)', [email]);
            const user = result.rows[0];
            if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Invalid credentials' });
            const token = jwt.sign({ email: user.email }, config.jwt.secret, { algorithm: 'HS256', subject: String(user.id), issuer: config.jwt.issuer, audience: config.jwt.audience, expiresIn: config.jwt.expiresIn });
            return res.json({ token, user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name } });
        } catch (error) { return next(error); }
    });
    app.get('/api/auth/me', authenticate, (req, res) => res.json(req.user));
    require('./native-ai/routes.cjs')(app,{pool,authenticate});
    const governedProviderClient = providerClient || (config.providers
        ? new GovernedProviderClient(config.providers)
        : null);
    app.use('/api/governed', createGovernedDocumentsRouter({
        pool,
        authenticate,
        allowedSourceHosts: config.allowedSourceHosts,
        minRetentionDays: config.minRetentionDays,
        providerClient: governedProviderClient
    }));

    app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));
    app.use((error, _req, res, _next) => {
        if (error instanceof WorkflowError) {
            return res.status(error.status).json({
                error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) }
            });
        }
        if (error?.type === 'entity.too.large') {
            return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } });
        }
        if (error instanceof SyntaxError && error?.type === 'entity.parse.failed') {
            return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
        }
        console.error('Governed API error:', error);
        return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    });
    return app;
}

module.exports = { createGovernedApp };

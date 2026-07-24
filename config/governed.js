'use strict';

const { jwtConfig } = require('./security');

function csv(value) {
    return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

function providerService(env, name, production) {
    const prefix = `GOVERNED_${name.toUpperCase()}`;
    const url = String(env[`${prefix}_URL`] || '').trim();
    const token = String(env[`${prefix}_TOKEN`] || '').trim();
    if ((!url || !token) && !production) return null;
    if (!url || !token) throw new Error(`${prefix}_URL and ${prefix}_TOKEN must both be configured`);
    let parsed;
    try {
        parsed = new URL(url);
    } catch (_) {
        throw new Error(`${prefix}_URL must be a valid URL`);
    }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash) {
        throw new Error(`${prefix}_URL must be an HTTPS endpoint without credentials or fragments`);
    }
    if (token.length < 32) throw new Error(`${prefix}_TOKEN must contain at least 32 characters`);
    return { url: parsed.toString(), token };
}

function loadGovernedConfig(env = process.env) {
    const production = env.NODE_ENV === 'production';
    const allowedOrigins = csv(env.ALLOWED_ORIGINS || (production ? '' : 'http://localhost:3000'));
    const allowedSourceHosts = csv(env.GOVERNED_SOURCE_HOSTS || (production ? '' : 'templates.example.test'))
        .map(host => host.toLowerCase());
    if (allowedOrigins.length === 0) throw new Error('ALLOWED_ORIGINS must list at least one origin');
    if (allowedSourceHosts.length === 0) throw new Error('GOVERNED_SOURCE_HOSTS must list at least one host');

    for (const origin of allowedOrigins) {
        let parsed;
        try {
            parsed = new URL(origin);
        } catch (_) {
            throw new Error(`Invalid ALLOWED_ORIGINS entry: ${origin}`);
        }
        if (parsed.origin !== origin || (production && parsed.protocol !== 'https:')) {
            throw new Error(`ALLOWED_ORIGINS must contain exact${production ? ' HTTPS' : ''} origins`);
        }
    }
    for (const host of allowedSourceHosts) {
        if (!/^[a-z0-9.-]+$/.test(host) || host.includes('..') || host.startsWith('.') || host.endsWith('.')) {
            throw new Error(`Invalid GOVERNED_SOURCE_HOSTS entry: ${host}`);
        }
    }

    const retention = Number(env.GOVERNED_MIN_RETENTION_DAYS || 30);
    if (!Number.isInteger(retention) || retention < 0 || retention > 36500) {
        throw new Error('GOVERNED_MIN_RETENTION_DAYS must be an integer between 0 and 36500');
    }
    const port = Number(env.PORT || 3000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT is invalid');

    return {
        production,
        host: env.HOST || (production ? '0.0.0.0' : '127.0.0.1'),
        port,
        allowedOrigins,
        allowedSourceHosts,
        minRetentionDays: retention,
        providers: {
            storage: providerService(env, 'storage', production),
            ocr: providerService(env, 'ocr', production),
            esign: providerService(env, 'esign', production),
            filing: providerService(env, 'filing', production)
        },
        jwt: jwtConfig(env)
    };
}

module.exports = { loadGovernedConfig, csv };

const { Pool } = require('pg');
const net = require('net');
require('dotenv').config();

function isLoopbackHost(value) {
    const host = value.toLowerCase().replace(/\.$/, '').replace(/^\[(.*)\]$/, '$1');
    if (host === 'localhost') return true;
    if (net.isIP(host) === 4) return host.split('.')[0] === '127';
    if (net.isIP(host) === 6) return host === '::1';
    return false;
}

function buildDatabaseConfig(env = process.env) {
    const production = env.NODE_ENV === 'production';
    const sslMode = env.DB_SSL_MODE || (production ? 'verify-full' : 'disable');
    if (!['disable', 'verify-full'].includes(sslMode)) {
        throw new Error('DB_SSL_MODE must be disable or verify-full');
    }
    if (production && sslMode !== 'verify-full') {
        throw new Error('Production database connections require DB_SSL_MODE=verify-full');
    }

    const ssl = sslMode === 'verify-full'
        ? {
            rejectUnauthorized: true,
            ...(env.DATABASE_SSL_CA ? { ca: env.DATABASE_SSL_CA.replace(/\\n/g, '\n') } : {})
        }
        : false;

    if (env.DATABASE_URL) {
        let parsed;
        try {
            parsed = new URL(env.DATABASE_URL);
        } catch (_) {
            throw new Error('DATABASE_URL is invalid');
        }
        if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
            throw new Error('DATABASE_URL must use PostgreSQL');
        }
        if (production && isLoopbackHost(parsed.hostname)) {
            throw new Error('Production DATABASE_URL cannot target loopback');
        }
        return { connectionString: env.DATABASE_URL, ssl };
    }

    if (production) throw new Error('DATABASE_URL is required in production');
    return {
        user: env.DB_USER || 'postgres',
        host: env.DB_HOST || 'localhost',
        database: env.DB_NAME || 'legalforms',
        password: env.DB_PASSWORD || 'password',
        port: Number(env.DB_PORT || 5432),
        ssl
    };
}

const pool = new Pool(buildDatabaseConfig());

pool.on('error', (err) => {
    console.error('Database connection error:', err);
});

module.exports = pool;
module.exports.buildDatabaseConfig = buildDatabaseConfig;
module.exports.isLoopbackHost = isLoopbackHost;

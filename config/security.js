'use strict';

const DEVELOPMENT_JWT_SECRET = 'development-only-jwt-secret-change-before-deployment-2026';
const DEVELOPMENT_SESSION_SECRET = 'development-only-session-secret-change-before-deployment-2026';

function secretFromEnvironment(name, developmentFallback, env = process.env) {
    const value = env[name] || (env.NODE_ENV === 'production' ? '' : developmentFallback);
    if (typeof value !== 'string' || value.length < 32) {
        throw new Error(`${name} must be configured with at least 32 characters`);
    }
    return value;
}

function jwtConfig(env = process.env) {
    const expiresIn = env.JWT_EXPIRES_IN || '15m';
    const match = /^(\d+)(s|m)$/.exec(expiresIn);
    const lifetimeSeconds = match
        ? Number(match[1]) * (match[2] === 'm' ? 60 : 1)
        : NaN;
    if (!Number.isInteger(lifetimeSeconds) || lifetimeSeconds < 60 || lifetimeSeconds > 900) {
        throw new Error('JWT_EXPIRES_IN must be between 60 seconds and 15 minutes');
    }
    return {
        secret: secretFromEnvironment('JWT_SECRET', DEVELOPMENT_JWT_SECRET, env),
        issuer: env.JWT_ISSUER || 'legalforms',
        audience: env.JWT_AUDIENCE || 'legalforms-governed-api',
        algorithm: 'HS256',
        expiresIn
    };
}

function sessionSecret(env = process.env) {
    return secretFromEnvironment('SESSION_SECRET', DEVELOPMENT_SESSION_SECRET, env);
}

module.exports = { jwtConfig, sessionSecret, secretFromEnvironment };

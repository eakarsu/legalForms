'use strict';

const jwt = require('jsonwebtoken');
const { WorkflowError } = require('./governedDocumentWorkflow');

function createGovernedAuth(pool, jwtConfiguration) {
    if (!pool || !jwtConfiguration?.secret) throw new TypeError('Database and JWT configuration are required');
    return async function governedAuth(req, _res, next) {
        try {
            const authorization = req.get('authorization');
            if (!authorization || !authorization.startsWith('Bearer ')) {
                throw new WorkflowError(401, 'AUTHENTICATION_REQUIRED', 'A Bearer token is required');
            }
            const token = authorization.slice(7);
            const claims = jwt.verify(token, jwtConfiguration.secret, {
                algorithms: [jwtConfiguration.algorithm || 'HS256'],
                issuer: jwtConfiguration.issuer,
                audience: jwtConfiguration.audience,
                maxAge: jwtConfiguration.expiresIn || '15m'
            });
            if (typeof claims.sub !== 'string') {
                throw new WorkflowError(401, 'INVALID_TOKEN', 'Token subject is missing');
            }
            const result = await pool.query(
                'SELECT id, email, first_name, last_name FROM users WHERE id = $1',
                [claims.sub]
            );
            if (result.rows.length === 0) {
                throw new WorkflowError(401, 'INVALID_TOKEN', 'Token subject is not active');
            }
            req.user = result.rows[0];
            next();
        } catch (error) {
            if (error instanceof WorkflowError) return next(error);
            return next(new WorkflowError(401, 'INVALID_TOKEN', 'Token is invalid or expired'));
        }
    };
}

module.exports = { createGovernedAuth };

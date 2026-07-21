'use strict';

require('dotenv').config();
const { loadGovernedConfig } = require('./config/governed');

const config = loadGovernedConfig();
const pool = require('./config/database');
const { createGovernedApp } = require('./lib/governedApp');

const app = createGovernedApp({ pool, config });
const server = app.listen(config.port, config.host, () => {
    console.log(`Governed LegalForms API listening on http://${config.host}:${config.port}`);
});

async function shutdown(signal) {
    console.log(`${signal} received; draining governed API`);
    server.close(async () => {
        await pool.end();
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;

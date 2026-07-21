#!/usr/bin/env node
'use strict';

const pool = require('../config/database');
const { runPendingMigrations } = require('../lib/migrations');

runPendingMigrations()
    .then(async () => {
        await pool.end();
    })
    .catch(async error => {
        console.error(error.message);
        await pool.end().catch(() => {});
        process.exitCode = 1;
    });

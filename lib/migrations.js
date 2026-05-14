'use strict';

/**
 * Simple file-based migration runner.
 *
 * Tracks applied migrations in a `migrations_run` table.
 * On startup, runs any *.sql files in /migrations/ that have not yet been applied,
 * in alphabetical (filename) order.
 */

const path = require('path');
const fs = require('fs').promises;
const db = require('../config/database');

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

/**
 * Ensure the tracking table exists.
 */
async function ensureTrackingTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS migrations_run (
            id          SERIAL PRIMARY KEY,
            filename    VARCHAR(255) UNIQUE NOT NULL,
            applied_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

/**
 * Return set of already-applied migration filenames.
 */
async function appliedMigrations() {
    const result = await db.query('SELECT filename FROM migrations_run ORDER BY filename');
    return new Set(result.rows.map(r => r.filename));
}

/**
 * Run a single SQL file inside a transaction.
 */
async function runMigration(filename, sql) {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
            'INSERT INTO migrations_run (filename) VALUES ($1)',
            [filename]
        );
        await client.query('COMMIT');
        console.log(`[migrations] Applied: ${filename}`);
    } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`[migrations] Failed on ${filename}: ${err.message}`);
    } finally {
        client.release();
    }
}

/**
 * Main entry point — call this once at application startup.
 */
async function runPendingMigrations() {
    try {
        await ensureTrackingTable();

        // Read all .sql files in migrations dir, sorted alphabetically
        let files;
        try {
            const entries = await fs.readdir(MIGRATIONS_DIR);
            files = entries
                .filter(f => f.endsWith('.sql'))
                .sort();
        } catch (err) {
            console.warn('[migrations] No migrations directory found, skipping.');
            return;
        }

        if (files.length === 0) {
            console.log('[migrations] No migration files found.');
            return;
        }

        const applied = await appliedMigrations();
        const pending = files.filter(f => !applied.has(f));

        if (pending.length === 0) {
            console.log('[migrations] All migrations are up to date.');
            return;
        }

        console.log(`[migrations] Running ${pending.length} pending migration(s)...`);

        for (const filename of pending) {
            const filePath = path.join(MIGRATIONS_DIR, filename);
            const sql = await fs.readFile(filePath, 'utf8');
            await runMigration(filename, sql);
        }

        console.log('[migrations] All pending migrations applied successfully.');
    } catch (err) {
        console.error('[migrations] Migration runner error:', err.message);
        // Re-throw so the startup can decide whether to abort
        throw err;
    }
}

module.exports = { runPendingMigrations };

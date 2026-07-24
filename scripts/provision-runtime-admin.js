'use strict';
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');

async function main() {
    const email = String(process.env.PROVISION_ADMIN_EMAIL || '').trim().toLowerCase();
    const password = String(process.env.PROVISION_ADMIN_PASSWORD || '');
    const name = String(process.env.PROVISION_ADMIN_NAME || 'Runtime Administrator').trim().split(/\s+/);
    if (!email || password.length < 12) throw new Error('Acceptance administrator credentials are required');
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, email_verified)
         VALUES ($1, $2, $3, $4, TRUE)
         ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash,
           first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name, email_verified=TRUE`,
        [email, hash, name[0] || 'Runtime', name.slice(1).join(' ') || 'Administrator']
    );
    console.log(`LegalForms runtime administrator ready: ${email}`);
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());

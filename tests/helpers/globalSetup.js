/**
 * Jest Global Setup
 * Runs once before all test suites
 */

const { Pool } = require('pg');
require('dotenv').config();

module.exports = async () => {
    console.log('\n🚀 Setting up test environment...');

    // Database configuration
    const dbConfig = process.env.DATABASE_URL
        ? {
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        }
        : {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT) || 5432,
            database: process.env.DB_NAME || 'legalforms',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || ''
        };

    // Verify database connection
    const pool = new Pool(dbConfig);

    try {
        const result = await pool.query('SELECT NOW()');
        console.log('✅ Database connection verified');
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        throw error;
    } finally {
        await pool.end();
    }

    console.log('✅ Test environment ready\n');
};

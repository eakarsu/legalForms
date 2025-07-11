const { Pool, Client  } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();


async function createDatabase() {
  // Connect to the default 'postgres' database
  const client = new  Client ({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: process.env.DB_PASSWORD,
    port: 5432,
  });
  await client.connect();
  // Create the new database
  await client.query('CREATE DATABASE legalforms;');
  console.log('Database "legalforms" created!');
  await client.end();
}

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'legalforms',
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
});

async function setupDatabase() {
    try {
        
        await createDatabase();
        const setupSQL = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8');
        await pool.query(setupSQL);
        console.log('Database setup completed successfully!');
    } catch (error) {
        console.error('Database setup failed:', error);
    } finally {
        await pool.end();
    }
}

setupDatabase();


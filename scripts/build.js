#!/usr/bin/env node
/**
 * Build Script
 * Validates JavaScript syntax and EJS templates
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.join(__dirname, '..');
let hasErrors = false;

console.log('========================================');
console.log('Build Script - Validation Check');
console.log('========================================\n');

// 1. Check JavaScript Syntax
console.log('1. Checking JavaScript syntax...\n');

const jsFiles = [
    'server.js',
    'config/database.js',
    'middleware/auth.js',
    'routes/clients.js',
    'routes/cases.js',
    'routes/billing.js',
    'routes/calendar.js',
    'routes/communications.js',
    'routes/collaboration.js',
    'routes/reports.js'
];

jsFiles.forEach(file => {
    const filePath = path.join(projectRoot, file);
    if (fs.existsSync(filePath)) {
        try {
            execSync(`node -c "${filePath}"`, { stdio: 'pipe' });
            console.log(`  ✓ ${file}`);
        } catch (e) {
            console.log(`  ✗ ${file}: ${e.message}`);
            hasErrors = true;
        }
    } else {
        console.log(`  - ${file} (not found)`);
    }
});

// 2. Check EJS Templates
console.log('\n2. Checking EJS templates...\n');

const ejs = require('ejs');

const viewDirs = [
    'views/clients',
    'views/cases',
    'views/billing',
    'views/calendar',
    'views/communications',
    'views/collaboration',
    'views/reports',
    'views/partials',
    'views/auth'
];

viewDirs.forEach(dir => {
    const fullDir = path.join(projectRoot, dir);
    if (fs.existsSync(fullDir)) {
        fs.readdirSync(fullDir).forEach(file => {
            if (file.endsWith('.ejs')) {
                const filePath = path.join(fullDir, file);
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    ejs.compile(content, { client: true, strict: false });
                    console.log(`  ✓ ${dir}/${file}`);
                } catch (e) {
                    console.log(`  ✗ ${dir}/${file}: ${e.message.split('\n')[0]}`);
                    hasErrors = true;
                }
            }
        });
    }
});

// 3. Summary
console.log('\n========================================');
if (hasErrors) {
    console.log('BUILD FAILED - Errors found');
    console.log('========================================\n');
    process.exit(1);
} else {
    console.log('BUILD SUCCESSFUL - All checks passed');
    console.log('========================================\n');
    process.exit(0);
}

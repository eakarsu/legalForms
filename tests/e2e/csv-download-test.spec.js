/**
 * CSV Download Verification Test
 * This test actually downloads CSV files and verifies the content
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('CSV Download Verification', () => {

    test('Revenue CSV should download and have content', async ({ page }) => {
        await page.goto('/reports/revenue');
        await page.waitForLoadState('networkidle');

        // Set up download listener BEFORE clicking
        const downloadPromise = page.waitForEvent('download', { timeout: 15000 });

        // Find and click the CSV link/button
        const csvBtn = page.locator('a:has-text("CSV"), button:has-text("CSV")').first();
        await expect(csvBtn).toBeVisible();
        await csvBtn.click();

        // Wait for download
        const download = await downloadPromise;

        // Verify filename
        const filename = download.suggestedFilename();
        console.log('Downloaded file:', filename);
        expect(filename).toMatch(/\.csv$/);

        // Save and verify content
        const downloadPath = path.join('/tmp', filename);
        await download.saveAs(downloadPath);

        const content = fs.readFileSync(downloadPath, 'utf8');
        console.log('File size:', content.length, 'bytes');
        console.log('Content preview:', content.substring(0, 200));

        expect(content.length).toBeGreaterThan(50);
        expect(content).toContain('Revenue');
    });

    test('Clients CSV should download and have content', async ({ page }) => {
        await page.goto('/reports/clients');
        await page.waitForLoadState('networkidle');

        const downloadPromise = page.waitForEvent('download', { timeout: 15000 });

        const csvBtn = page.locator('button:has-text("CSV")').first();
        await expect(csvBtn).toBeVisible();
        await csvBtn.click();

        const download = await downloadPromise;
        const filename = download.suggestedFilename();
        console.log('Downloaded file:', filename);
        expect(filename).toMatch(/\.csv$/);

        const downloadPath = path.join('/tmp', filename);
        await download.saveAs(downloadPath);

        const content = fs.readFileSync(downloadPath, 'utf8');
        console.log('File size:', content.length, 'bytes');
        expect(content.length).toBeGreaterThan(50);
    });

    test('Productivity CSV should download and have content', async ({ page }) => {
        await page.goto('/reports/productivity');
        await page.waitForLoadState('networkidle');

        const downloadPromise = page.waitForEvent('download', { timeout: 15000 });

        const csvBtn = page.locator('button:has-text("CSV")').first();
        await expect(csvBtn).toBeVisible();
        await csvBtn.click();

        const download = await downloadPromise;
        const filename = download.suggestedFilename();
        console.log('Downloaded file:', filename);
        expect(filename).toMatch(/productivity.*\.csv$/);

        const downloadPath = path.join('/tmp', filename);
        await download.saveAs(downloadPath);

        const content = fs.readFileSync(downloadPath, 'utf8');
        console.log('File size:', content.length, 'bytes');
        expect(content.length).toBeGreaterThan(50);
        expect(content).toContain('Productivity');
    });

    test('Cases CSV should download and have content', async ({ page }) => {
        await page.goto('/reports/cases');
        await page.waitForLoadState('networkidle');

        const downloadPromise = page.waitForEvent('download', { timeout: 15000 });

        const csvBtn = page.locator('button:has-text("CSV")').first();
        await expect(csvBtn).toBeVisible();
        await csvBtn.click();

        const download = await downloadPromise;
        const filename = download.suggestedFilename();
        console.log('Downloaded file:', filename);
        expect(filename).toMatch(/case.*\.csv$/);

        const downloadPath = path.join('/tmp', filename);
        await download.saveAs(downloadPath);

        const content = fs.readFileSync(downloadPath, 'utf8');
        console.log('File size:', content.length, 'bytes');
        expect(content.length).toBeGreaterThan(50);
        expect(content).toContain('Case');
    });
});

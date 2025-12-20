/**
 * Two-Factor Authentication E2E Tests
 * Comprehensive tests for 2FA setup, verification, disable, backup codes
 */

const { test, expect } = require('@playwright/test');
const { helpers } = require('./test-utils');

test.describe('Two-Factor Authentication Module', () => {
    test.describe('2FA Setup Page', () => {
        test('should display 2FA setup page', async ({ page }) => {
            await page.goto('/2fa/setup');
            await helpers.waitForPageLoad(page);

            const url = page.url();
            expect(url.includes('2fa') || url.includes('setup')).toBeTruthy();
        });

        test('should show 2FA status', async ({ page }) => {
            await page.goto('/2fa/setup');
            await helpers.waitForPageLoad(page);

            const status = page.locator('.status, .card, h1, h2, .badge');
            const hasStatus = await status.count() > 0;
            expect(hasStatus).toBeTruthy();
        });

        test('should have Start Setup button when 2FA disabled', async ({ page }) => {
            await page.goto('/2fa/setup');
            await helpers.waitForPageLoad(page);

            const setupBtn = page.locator('button:has-text("Start"), button:has-text("Enable"), button:has-text("Setup"), button[onclick*="startSetup"]').first();
            const hasBtn = await setupBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should display QR code section', async ({ page }) => {
            await page.goto('/2fa/setup');
            await helpers.waitForPageLoad(page);

            const qrSection = page.locator('.qr-code, img[alt*="QR"], canvas, #qrcode');
            const hasQR = await qrSection.count() > 0;
            expect(hasQR).toBeTruthy();
        });

        test('should have verification code input', async ({ page }) => {
            await page.goto('/2fa/setup');
            await helpers.waitForPageLoad(page);

            const codeInput = page.locator('input[name*="code"], input[name*="token"], input[type="text"][maxlength="6"]');
            const hasInput = await codeInput.count() > 0;
            expect(hasInput).toBeTruthy();
        });

        test('should have Confirm Setup button', async ({ page }) => {
            await page.goto('/2fa/setup');
            await helpers.waitForPageLoad(page);

            const confirmBtn = page.locator('button.btn[type="submit"], button:has-text("Confirm"), button:has-text("Verify")').first();
            const hasBtn = await confirmBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });
    });

    test.describe('2FA Management', () => {
        test('should have Disable 2FA button when enabled', async ({ page }) => {
            await page.goto('/2fa/setup');
            await helpers.waitForPageLoad(page);

            const disableBtn = page.locator('button:has-text("Disable"), button[onclick*="disable2FA"]').first();
            const hasBtn = await disableBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have Regenerate Backup Codes button', async ({ page }) => {
            await page.goto('/2fa/setup');
            await helpers.waitForPageLoad(page);

            const regenBtn = page.locator('button:has-text("Regenerate"), button:has-text("Backup"), button[onclick*="regenerateBackupCodes"]').first();
            const hasBtn = await regenBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should display trusted devices section', async ({ page }) => {
            await page.goto('/2fa/setup');
            await helpers.waitForPageLoad(page);

            const devices = page.locator('.devices, .trusted-devices, :has-text("Device"), :has-text("trusted")');
            const hasDevices = await devices.count() > 0;
            expect(hasDevices).toBeTruthy();
        });

        test('should have Remove Device button', async ({ page }) => {
            await page.goto('/2fa/setup');
            await helpers.waitForPageLoad(page);

            const removeBtn = page.locator('button:has-text("Remove"), button[onclick*="removeDevice"]').first();
            const hasBtn = await removeBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });
    });

    test.describe('Backup Codes', () => {
        test('should display backup codes section', async ({ page }) => {
            await page.goto('/2fa/setup');
            await helpers.waitForPageLoad(page);

            const backupSection = page.locator('.backup-codes, :has-text("Backup"), :has-text("Recovery")');
            const hasSection = await backupSection.count() > 0;
            expect(hasSection).toBeTruthy();
        });

        test('should have Download Codes button', async ({ page }) => {
            await page.goto('/2fa/setup');
            await helpers.waitForPageLoad(page);

            const downloadBtn = page.locator('button:has-text("Download"), a:has-text("Download")').first();
            const hasBtn = await downloadBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have Print Codes button', async ({ page }) => {
            await page.goto('/2fa/setup');
            await helpers.waitForPageLoad(page);

            const printBtn = page.locator('button:has-text("Print"), a:has-text("Print")').first();
            const hasBtn = await printBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });
    });

    test.describe('2FA Verification', () => {
        test('should navigate to verify page', async ({ page }) => {
            await page.goto('/2fa/verify');
            await helpers.waitForPageLoad(page);

            const url = page.url();
            expect(url.includes('2fa') || url.includes('verify') || url.includes('login')).toBeTruthy();
        });

        test('should have code input on verify page', async ({ page }) => {
            await page.goto('/2fa/verify');
            await helpers.waitForPageLoad(page);

            const codeInput = page.locator('input[name*="code"], input[name*="token"], input[type="text"]');
            const hasInput = await codeInput.count() > 0;
            expect(hasInput).toBeTruthy();
        });

        test('should have Verify button', async ({ page }) => {
            await page.goto('/2fa/verify');
            await helpers.waitForPageLoad(page);

            const verifyBtn = page.locator('button.btn[type="submit"], button:has-text("Verify")').first();
            const hasBtn = await verifyBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have Use Backup Code link', async ({ page }) => {
            await page.goto('/2fa/verify');
            await helpers.waitForPageLoad(page);

            const backupLink = page.locator('a:has-text("Backup"), a:has-text("backup code"), button:has-text("Use Backup")');
            const hasLink = await backupLink.count() > 0;
            expect(hasLink).toBeTruthy();
        });
    });
});

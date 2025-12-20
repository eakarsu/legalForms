/**
 * Communications E2E Tests - STRICT VERSION
 * Tests will FAIL if UI elements are missing. App code must be fixed.
 */

const { test, expect } = require('@playwright/test');
const { helpers } = require('./test-utils');

test.describe('Communications Module', () => {
    // ==================== MESSAGES ====================
    test.describe('Messages Page', () => {
        test('should navigate to messages page', async ({ page }) => {
            await page.goto('/messages');
            expect(page.url()).toContain('message');
        });

        test('should display page header', async ({ page }) => {
            await page.goto('/messages');
            await helpers.waitForPageLoad(page);

            const header = page.locator('h1, h2, .page-title').first();
            await expect(header).toBeVisible();
        });

        test('should have Compose button', async ({ page }) => {
            await page.goto('/messages');
            await helpers.waitForPageLoad(page);

            const composeBtn = page.locator('[data-bs-target="#composeModal"], button:has-text("Compose"), a:has-text("New Message"), button:has-text("New Message")').first();
            await expect(composeBtn).toBeVisible();
        });

        test('should have messages list or table', async ({ page }) => {
            await page.goto('/messages');
            await helpers.waitForPageLoad(page);

            const messageList = page.locator('table, .message-list, .inbox, .list-group');
            const count = await messageList.count();
            expect(count).toBeGreaterThan(0);
        });
    });

    // ==================== COMPOSE MODAL ====================
    test.describe('Compose Modal', () => {
        test('should open compose modal', async ({ page }) => {
            await page.goto('/messages');
            await helpers.waitForPageLoad(page);

            const composeBtn = page.locator('[data-bs-target="#composeModal"], button:has-text("Compose"), button:has-text("New Message")').first();
            await composeBtn.click();
            await page.waitForTimeout(500);

            const modal = page.locator('.modal.show');
            await expect(modal).toBeVisible();
        });

        test('should have recipient field in compose modal', async ({ page }) => {
            await page.goto('/messages');
            await helpers.waitForPageLoad(page);

            const composeBtn = page.locator('[data-bs-target="#composeModal"], button:has-text("Compose"), button:has-text("New Message")').first();
            await composeBtn.click();
            await page.waitForTimeout(500);

            const recipientInput = page.locator('.modal.show input[name="recipient"], .modal.show select[name="to"], .modal.show input[name="to"]').first();
            await expect(recipientInput).toBeVisible();
        });

        test('should have subject field in compose modal', async ({ page }) => {
            await page.goto('/messages');
            await helpers.waitForPageLoad(page);

            const composeBtn = page.locator('[data-bs-target="#composeModal"], button:has-text("Compose"), button:has-text("New Message")').first();
            await composeBtn.click();
            await page.waitForTimeout(500);

            const subjectInput = page.locator('.modal.show input[name="subject"]');
            await expect(subjectInput).toBeVisible();
        });

        test('should have message body field in compose modal', async ({ page }) => {
            await page.goto('/messages');
            await helpers.waitForPageLoad(page);

            const composeBtn = page.locator('[data-bs-target="#composeModal"], button:has-text("Compose"), button:has-text("New Message")').first();
            await composeBtn.click();
            await page.waitForTimeout(500);

            const bodyInput = page.locator('.modal.show textarea[name="body"], .modal.show textarea[name="message"]').first();
            await expect(bodyInput).toBeVisible();
        });

        test('should have Send button in compose modal', async ({ page }) => {
            await page.goto('/messages');
            await helpers.waitForPageLoad(page);

            const composeBtn = page.locator('[data-bs-target="#composeModal"], button:has-text("Compose"), button:has-text("New Message")').first();
            await composeBtn.click();
            await page.waitForTimeout(500);

            const sendBtn = page.locator('.modal.show button[type="submit"], .modal.show button:has-text("Send")').first();
            await expect(sendBtn).toBeVisible();
        });
    });

    // ==================== NOTIFICATIONS ====================
    test.describe('Notifications Page', () => {
        test('should navigate to notifications page', async ({ page }) => {
            await page.goto('/notifications');
            expect(page.url()).toContain('notification');
        });

        test('should display page header', async ({ page }) => {
            await page.goto('/notifications');
            await helpers.waitForPageLoad(page);

            const header = page.locator('h1, h2, .page-title').first();
            await expect(header).toBeVisible();
        });

        test('should have notifications list', async ({ page }) => {
            await page.goto('/notifications');
            await helpers.waitForPageLoad(page);

            const notificationList = page.locator('table, .notification-list, .list-group, .card');
            const count = await notificationList.count();
            expect(count).toBeGreaterThan(0);
        });

        test('should have Mark All as Read button', async ({ page }) => {
            await page.goto('/notifications');
            await helpers.waitForPageLoad(page);

            const markAllBtn = page.locator('button:has-text("Mark All"), a:has-text("Mark All Read"), button:has-text("Mark All Read")').first();
            await expect(markAllBtn).toBeVisible();
        });
    });
});

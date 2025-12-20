/**
 * Payments E2E Tests
 * Comprehensive tests for payment links, transactions, settings
 */

const { test, expect } = require('@playwright/test');
const { helpers } = require('./test-utils');

test.describe('Payments Module', () => {
    test.describe('Payments Dashboard', () => {
        test('should display payments dashboard', async ({ page }) => {
            await page.goto('/payments');
            await helpers.waitForPageLoad(page);

            expect(page.url()).toContain('payment');
            const header = page.locator('h1, h2').first();
            await expect(header).toBeVisible();
        });

        test('should show payment summary cards', async ({ page }) => {
            await page.goto('/payments');
            await helpers.waitForPageLoad(page);

            const cards = page.locator('.card');
            const count = await cards.count();
            expect(count).toBeGreaterThan(0);
        });

        test('should have Create Payment Link button', async ({ page }) => {
            await page.goto('/payments');
            await helpers.waitForPageLoad(page);

            const createBtn = page.locator('a:has-text("Create"), button:has-text("Create"), a[href*="links/new"]').first();
            const hasBtn = await createBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have View All Transactions link', async ({ page }) => {
            await page.goto('/payments');
            await helpers.waitForPageLoad(page);

            const transLink = page.locator('a:has-text("Transaction"), a[href*="transactions"]').first();
            const hasLink = await transLink.count() > 0;
            expect(hasLink).toBeTruthy();
        });

        test('should have Manage Links link', async ({ page }) => {
            await page.goto('/payments');
            await helpers.waitForPageLoad(page);

            const linksLink = page.locator('a:has-text("Links"), a[href*="/payments/links"]').first();
            const hasLink = await linksLink.count() > 0;
            expect(hasLink).toBeTruthy();
        });
    });

    test.describe('Payment Links', () => {
        test('should navigate to payment links page', async ({ page }) => {
            await page.goto('/payments/links');
            await helpers.waitForPageLoad(page);

            const url = page.url();
            expect(url.includes('payment') || url.includes('link')).toBeTruthy();
        });

        test('should display payment links list', async ({ page }) => {
            await page.goto('/payments/links');
            await helpers.waitForPageLoad(page);

            const table = page.locator('table, .links-list, .card');
            const hasContent = await table.count() > 0;
            expect(hasContent).toBeTruthy();
        });

        test('should have Create Link button', async ({ page }) => {
            await page.goto('/payments/links');
            await helpers.waitForPageLoad(page);

            const createBtn = page.locator('a:has-text("Create"), button:has-text("Create"), a[href*="new"]').first();
            const hasBtn = await createBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should navigate to create link page', async ({ page }) => {
            await page.goto('/payments/links/new');
            await helpers.waitForPageLoad(page);

            const form = page.locator('form, .card');
            const hasForm = await form.count() > 0;
            expect(hasForm).toBeTruthy();
        });

        test('should have link action buttons', async ({ page }) => {
            await page.goto('/payments/links');
            await helpers.waitForPageLoad(page);

            const actionBtns = page.locator('.btn-view, .btn-copy, .btn-delete, button[onclick]');
            const hasActions = await actionBtns.count() > 0;
            expect(hasActions).toBeTruthy();
        });
    });

    test.describe('Transactions', () => {
        test('should navigate to transactions page', async ({ page }) => {
            await page.goto('/payments/transactions');
            await helpers.waitForPageLoad(page);

            const url = page.url();
            expect(url.includes('payment') || url.includes('transaction')).toBeTruthy();
        });

        test('should display transactions list', async ({ page }) => {
            await page.goto('/payments/transactions');
            await helpers.waitForPageLoad(page);

            const table = page.locator('table, .transactions-list, .card');
            const hasContent = await table.count() > 0;
            expect(hasContent).toBeTruthy();
        });

        test('should have filter controls', async ({ page }) => {
            await page.goto('/payments/transactions');
            await helpers.waitForPageLoad(page);

            const filters = page.locator('select, input[type="date"], form');
            const hasFilters = await filters.count() > 0;
            expect(hasFilters).toBeTruthy();
        });

        test('should have view transaction button', async ({ page }) => {
            await page.goto('/payments/transactions');
            await helpers.waitForPageLoad(page);

            const viewBtn = page.locator('.btn-view, a[href*="/payments/"]').first();
            const hasBtn = await viewBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });
    });

    test.describe('Payment Settings', () => {
        test('should navigate to payment settings', async ({ page }) => {
            await page.goto('/payments/settings');
            await helpers.waitForPageLoad(page);

            const url = page.url();
            expect(url.includes('payment') || url.includes('setting')).toBeTruthy();
        });

        test('should display settings form', async ({ page }) => {
            await page.goto('/payments/settings');
            await helpers.waitForPageLoad(page);

            const form = page.locator('form, .settings-card, .card');
            const hasForm = await form.count() > 0;
            expect(hasForm).toBeTruthy();
        });

        test('should have save settings button', async ({ page }) => {
            await page.goto('/payments/settings');
            await helpers.waitForPageLoad(page);

            const saveBtn = page.locator('button.btn[type="submit"], button:has-text("Save")').first();
            const hasBtn = await saveBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });
    });
});

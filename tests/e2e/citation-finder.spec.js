/**
 * Citation Finder E2E Tests
 */

const { test, expect } = require('@playwright/test');
const { helpers } = require('./test-utils');

test.describe('Citation Finder Module', () => {
    test.describe('Citation Finder Dashboard', () => {
        test('should display citation finder dashboard', async ({ page }) => {
            await page.goto('/citation-finder');
            await helpers.waitForPageLoad(page);

            expect(page.url()).toContain('citation-finder');
            const header = page.locator('h1, h2').first();
            await expect(header).toBeVisible();
        });

        test('should have New Search button', async ({ page }) => {
            await page.goto('/citation-finder');
            await helpers.waitForPageLoad(page);

            const newBtn = page.locator('a:has-text("New Search"), a[href*="/search"]').first();
            await expect(newBtn).toBeVisible();
        });
    });

    test.describe('Citation Search', () => {
        test('should display search form', async ({ page }) => {
            await page.goto('/citation-finder/search');
            await helpers.waitForPageLoad(page);

            const form = page.locator('form#searchForm');
            await expect(form).toBeVisible();
        });

        test('should have legal issue textarea', async ({ page }) => {
            await page.goto('/citation-finder/search');
            await helpers.waitForPageLoad(page);

            const textarea = page.locator('textarea[name="legal_issue"]');
            await expect(textarea).toBeVisible();
        });

        test('should have jurisdiction dropdown', async ({ page }) => {
            await page.goto('/citation-finder/search');
            await helpers.waitForPageLoad(page);

            const select = page.locator('select[name="jurisdiction"]');
            await expect(select).toBeVisible();
        });

        test('should have Search button', async ({ page }) => {
            await page.goto('/citation-finder/search');
            await helpers.waitForPageLoad(page);

            const btn = page.locator('button#searchBtn');
            await expect(btn).toBeVisible();
            await expect(btn).toHaveText(/Search/);
        });

        test('should load example when clicking Load Example button', async ({ page }) => {
            await page.goto('/citation-finder/search');
            await helpers.waitForPageLoad(page);

            const loadExampleBtn = page.locator('button#loadExampleBtn');
            await loadExampleBtn.click();

            const textarea = page.locator('textarea[name="legal_issue"]');
            const value = await textarea.inputValue();
            expect(value.length).toBeGreaterThan(0);
        });

        test('should submit search and redirect to results', async ({ page }) => {
            await page.goto('/citation-finder/search');
            await helpers.waitForPageLoad(page);

            // Fill form
            await page.fill('textarea[name="legal_issue"]', 'Test legal issue for e2e testing');
            await page.selectOption('select[name="jurisdiction"]', 'California');
            await page.selectOption('select[name="practice_area"]', 'Contract Law');

            // Click search
            const searchBtn = page.locator('button#searchBtn');
            await searchBtn.click();

            // Wait for redirect or response
            await page.waitForURL(/citation-finder\/results\/|citation-finder\/search/, { timeout: 30000 });
        });
    });
});

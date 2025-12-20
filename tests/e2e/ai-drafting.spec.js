/**
 * AI Drafting E2E Tests
 * Comprehensive tests for AI document drafting, templates, sessions
 */

const { test, expect } = require('@playwright/test');
const { helpers } = require('./test-utils');

test.describe('AI Drafting Module', () => {
    test.describe('AI Drafting Dashboard', () => {
        test('should display AI drafting dashboard', async ({ page }) => {
            await page.goto('/ai-drafting');
            await helpers.waitForPageLoad(page);

            expect(page.url()).toContain('ai-drafting');
            const header = page.locator('h1, h2').first();
            await expect(header).toBeVisible();
        });

        test('should show drafting summary cards', async ({ page }) => {
            await page.goto('/ai-drafting');
            await helpers.waitForPageLoad(page);

            const cards = page.locator('.card');
            const count = await cards.count();
            expect(count).toBeGreaterThan(0);
        });

        test('should have New Draft button', async ({ page }) => {
            await page.goto('/ai-drafting');
            await helpers.waitForPageLoad(page);

            const newBtn = page.locator('a:has-text("New Draft"), a[href*="/new"], button:has-text("New")').first();
            const hasBtn = await newBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should display template cards', async ({ page }) => {
            await page.goto('/ai-drafting');
            await helpers.waitForPageLoad(page);

            const templates = page.locator('.template-card, .card:has-text("Template"), a[href*="template"]');
            const hasTemplates = await templates.count() > 0;
            expect(hasTemplates).toBeTruthy();
        });

        test('should display recent drafts', async ({ page }) => {
            await page.goto('/ai-drafting');
            await helpers.waitForPageLoad(page);

            const drafts = page.locator('.draft-item, a[href*="sessions"], table tbody tr');
            const hasDrafts = await drafts.count() > 0;
            expect(hasDrafts).toBeTruthy();
        });

        test('should have quick start category buttons', async ({ page }) => {
            await page.goto('/ai-drafting');
            await helpers.waitForPageLoad(page);

            const categoryBtns = page.locator('a[href*="category="], button:has-text("Letter"), button:has-text("Contract")');
            const hasCategories = await categoryBtns.count() > 0;
            expect(hasCategories).toBeTruthy();
        });
    });

    test.describe('New Draft', () => {
        test('should navigate to new draft page', async ({ page }) => {
            await page.goto('/ai-drafting/new');
            await helpers.waitForPageLoad(page);

            const url = page.url();
            expect(url.includes('ai-drafting') || url.includes('new')).toBeTruthy();
        });

        test('should display draft form', async ({ page }) => {
            await page.goto('/ai-drafting/new');
            await helpers.waitForPageLoad(page);

            const form = page.locator('form, textarea, .draft-editor');
            const hasForm = await form.count() > 0;
            expect(hasForm).toBeTruthy();
        });

        test('should have document type selector', async ({ page }) => {
            await page.goto('/ai-drafting/new');
            await helpers.waitForPageLoad(page);

            const typeSelect = page.locator('select[name*="type"], .document-type, input[name*="type"]');
            const hasSelector = await typeSelect.count() > 0;
            expect(hasSelector).toBeTruthy();
        });

        test('should have Generate button', async ({ page }) => {
            await page.goto('/ai-drafting/new');
            await helpers.waitForPageLoad(page);

            const generateBtn = page.locator('button:has-text("Generate"), button:has-text("Draft"), button.btn[type="submit"]').first();
            const hasBtn = await generateBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have template selection', async ({ page }) => {
            await page.goto('/ai-drafting/new');
            await helpers.waitForPageLoad(page);

            const templateSelect = page.locator('select[name*="template"], .template-select, input[name*="template"]');
            const hasSelect = await templateSelect.count() > 0;
            expect(hasSelect).toBeTruthy();
        });
    });

    test.describe('Draft Sessions', () => {
        test('should navigate to sessions list', async ({ page }) => {
            await page.goto('/ai-drafting/sessions');
            await helpers.waitForPageLoad(page);

            const url = page.url();
            expect(url.includes('ai-drafting') || url.includes('session')).toBeTruthy();
        });

        test('should display sessions list', async ({ page }) => {
            await page.goto('/ai-drafting/sessions');
            await helpers.waitForPageLoad(page);

            const sessions = page.locator('table, .sessions-list, .card');
            const hasSessions = await sessions.count() > 0;
            expect(hasSessions).toBeTruthy();
        });

        test('should have session action buttons', async ({ page }) => {
            await page.goto('/ai-drafting/sessions');
            await helpers.waitForPageLoad(page);

            const actionBtns = page.locator('.btn-view, .btn-continue, .btn-delete, a[href*="sessions/"]');
            const hasActions = await actionBtns.count() > 0;
            expect(hasActions).toBeTruthy();
        });
    });

    test.describe('Templates', () => {
        test('should navigate to templates page', async ({ page }) => {
            await page.goto('/ai-drafting/templates');
            await helpers.waitForPageLoad(page);

            const url = page.url();
            expect(url.includes('ai-drafting') || url.includes('template')).toBeTruthy();
        });

        test('should display templates list', async ({ page }) => {
            await page.goto('/ai-drafting/templates');
            await helpers.waitForPageLoad(page);

            const templates = page.locator('.template-card, table, .card');
            const hasTemplates = await templates.count() > 0;
            expect(hasTemplates).toBeTruthy();
        });

        test('should have use template buttons', async ({ page }) => {
            await page.goto('/ai-drafting/templates');
            await helpers.waitForPageLoad(page);

            const useBtns = page.locator('a:has-text("Use"), button:has-text("Start"), a[href*="template="]');
            const hasButtons = await useBtns.count() > 0;
            expect(hasButtons).toBeTruthy();
        });
    });
});

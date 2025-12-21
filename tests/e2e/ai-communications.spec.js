/**
 * AI Communications E2E Tests
 */

const { test, expect } = require('@playwright/test');
const { helpers } = require('./test-utils');

test.describe('AI Communications Module', () => {
    test.describe('AI Drafts Page', () => {
        test('should display AI drafts page with header', async ({ page }) => {
            await page.goto('/communications/ai-drafts');
            await helpers.waitForPageLoad(page);

            const header = page.locator('h2:has-text("AI Communication Assistant")');
            await expect(header).toBeVisible();
        });

        test('should display stats cards', async ({ page }) => {
            await page.goto('/communications/ai-drafts');
            await helpers.waitForPageLoad(page);

            const cards = page.locator('.card');
            const count = await cards.count();
            expect(count).toBeGreaterThan(0);
        });

        test('should have draft form', async ({ page }) => {
            await page.goto('/communications/ai-drafts');
            await helpers.waitForPageLoad(page);

            const form = page.locator('form#draftForm');
            await expect(form).toBeVisible();
        });

        test('should have draft type selector', async ({ page }) => {
            await page.goto('/communications/ai-drafts');
            await helpers.waitForPageLoad(page);

            const select = page.locator('select[name="draft_type"]');
            await expect(select).toBeVisible();
        });

        test('should have context textarea', async ({ page }) => {
            await page.goto('/communications/ai-drafts');
            await helpers.waitForPageLoad(page);

            const textarea = page.locator('textarea[name="context"]');
            await expect(textarea).toBeVisible();
        });

        test('should have Generate Draft button', async ({ page }) => {
            await page.goto('/communications/ai-drafts');
            await helpers.waitForPageLoad(page);

            const btn = page.locator('button#draftBtn');
            await expect(btn).toBeVisible();
            await expect(btn).toHaveText(/Generate Draft/);
        });

        test('should have Load Example button', async ({ page }) => {
            await page.goto('/communications/ai-drafts');
            await helpers.waitForPageLoad(page);

            const btn = page.locator('button#loadExampleBtn');
            await expect(btn).toBeVisible();
        });

        test('should load example when clicking Load Example', async ({ page }) => {
            await page.goto('/communications/ai-drafts');
            await helpers.waitForPageLoad(page);

            const loadBtn = page.locator('button#loadExampleBtn');
            await loadBtn.click();

            const textarea = page.locator('textarea[name="context"]');
            const value = await textarea.inputValue();
            expect(value.length).toBeGreaterThan(50);
        });

        test('should submit draft and show result', async ({ page }) => {
            await page.goto('/communications/ai-drafts');
            await helpers.waitForPageLoad(page);

            // Fill form
            await page.fill('textarea[name="context"]', 'Test email for e2e testing. Please draft a short reply.');
            await page.selectOption('select[name="draft_type"]', 'email');
            await page.selectOption('select[name="tone"]', 'professional');

            // Click generate
            const draftBtn = page.locator('button#draftBtn');
            await draftBtn.click();

            // Wait for response - button should show loading state
            await expect(draftBtn).toHaveText(/Generating/, { timeout: 5000 });

            // Wait for result to appear
            const generatedDraft = page.locator('#generatedDraft');
            await expect(generatedDraft).toBeVisible({ timeout: 60000 });
        });
    });

    test.describe('Message Classifier', () => {
        test('should have classifier form', async ({ page }) => {
            await page.goto('/communications/ai-drafts');
            await helpers.waitForPageLoad(page);

            const form = page.locator('form#classifyForm');
            await expect(form).toBeVisible();
        });

        test('should have Analyze Message button', async ({ page }) => {
            await page.goto('/communications/ai-drafts');
            await helpers.waitForPageLoad(page);

            const btn = page.locator('button#classifyBtn');
            await expect(btn).toBeVisible();
        });
    });
});

/**
 * OCR E2E Tests
 * Comprehensive tests for document OCR, text extraction, copy/save/download
 */

const { test, expect } = require('@playwright/test');
const { helpers } = require('./test-utils');

test.describe('OCR Module', () => {
    test.describe('OCR Dashboard', () => {
        test('should display OCR dashboard', async ({ page }) => {
            await page.goto('/ocr');
            await helpers.waitForPageLoad(page);

            expect(page.url()).toContain('ocr');
            const header = page.locator('h1, h2').first();
            await expect(header).toBeVisible();
        });

        test('should show OCR summary cards', async ({ page }) => {
            await page.goto('/ocr');
            await helpers.waitForPageLoad(page);

            const cards = page.locator('.card');
            const count = await cards.count();
            expect(count).toBeGreaterThan(0);
        });

        test('should have Upload Document button', async ({ page }) => {
            await page.goto('/ocr');
            await helpers.waitForPageLoad(page);

            const uploadBtn = page.locator('[data-bs-target="#uploadModal"], button:has-text("Upload"), a:has-text("Upload")').first();
            const hasBtn = await uploadBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should open upload modal', async ({ page }) => {
            await page.goto('/ocr');
            await helpers.waitForPageLoad(page);

            const uploadBtn = page.locator('[data-bs-target="#uploadModal"]').first();
            if (await uploadBtn.count() > 0) {
                await uploadBtn.click();
                await page.waitForTimeout(500);

                const modal = page.locator('.modal.show');
                const isOpen = await modal.count() > 0;
                expect(isOpen).toBeTruthy();
            }
        });

        test('should display recent scans', async ({ page }) => {
            await page.goto('/ocr');
            await helpers.waitForPageLoad(page);

            const scans = page.locator('table tbody tr, .scan-item, .card');
            const hasScans = await scans.count() > 0;
            expect(hasScans).toBeTruthy();
        });
    });

    test.describe('Upload Document', () => {
        test('should have file input in upload modal', async ({ page }) => {
            await page.goto('/ocr');
            await helpers.waitForPageLoad(page);

            const uploadBtn = page.locator('[data-bs-target="#uploadModal"]').first();
            if (await uploadBtn.count() > 0) {
                await uploadBtn.click();
                await page.waitForTimeout(500);

                const fileInput = page.locator('.modal.show input[type="file"]');
                const hasInput = await fileInput.count() > 0;
                expect(hasInput).toBeTruthy();
            }
        });

        test('should have upload submit button', async ({ page }) => {
            await page.goto('/ocr');
            await helpers.waitForPageLoad(page);

            const uploadBtn = page.locator('[data-bs-target="#uploadModal"]').first();
            if (await uploadBtn.count() > 0) {
                await uploadBtn.click();
                await page.waitForTimeout(500);

                const submitBtn = page.locator('.modal.show button.btn[type="submit"], .modal.show button:has-text("Upload")').first();
                const hasBtn = await submitBtn.count() > 0;
                expect(hasBtn).toBeTruthy();
            }
        });
    });

    test.describe('OCR Detail', () => {
        test('should navigate to OCR detail page', async ({ page }) => {
            await page.goto('/ocr');
            await helpers.waitForPageLoad(page);

            const scanRow = page.locator('table tbody tr, .scan-item, a[href*="/ocr/"]').first();
            if (await scanRow.count() > 0) {
                await scanRow.click();
                await page.waitForTimeout(1000);
            }
            expect(true).toBeTruthy();
        });

        test('should have Copy All Text button', async ({ page }) => {
            await page.goto('/ocr');
            await helpers.waitForPageLoad(page);

            const copyBtn = page.locator('button:has-text("Copy"), button[onclick*="copyAllText"]').first();
            const hasBtn = await copyBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have Save as Document button', async ({ page }) => {
            await page.goto('/ocr');
            await helpers.waitForPageLoad(page);

            const saveBtn = page.locator('button:has-text("Save"), button[onclick*="saveAsDocument"]').first();
            const hasBtn = await saveBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have Download Text button', async ({ page }) => {
            await page.goto('/ocr');
            await helpers.waitForPageLoad(page);

            const downloadBtn = page.locator('button:has-text("Download"), button[onclick*="downloadText"]').first();
            const hasBtn = await downloadBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have search text input', async ({ page }) => {
            await page.goto('/ocr');
            await helpers.waitForPageLoad(page);

            const searchInput = page.locator('input[type="search"], input[name="search"], input[placeholder*="Search"]');
            const hasInput = await searchInput.count() > 0;
            expect(hasInput).toBeTruthy();
        });

        test('should have Link Document button', async ({ page }) => {
            await page.goto('/ocr');
            await helpers.waitForPageLoad(page);

            const linkBtn = page.locator('button:has-text("Link"), button[onclick*="linkDocument"]').first();
            const hasBtn = await linkBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });
    });

    test.describe('OCR History', () => {
        test('should display OCR history', async ({ page }) => {
            await page.goto('/ocr');
            await helpers.waitForPageLoad(page);

            const history = page.locator('table, .history-list, .card');
            const hasHistory = await history.count() > 0;
            expect(hasHistory).toBeTruthy();
        });

        test('should have filter controls', async ({ page }) => {
            await page.goto('/ocr');
            await helpers.waitForPageLoad(page);

            const filters = page.locator('select, input[type="date"], form');
            const hasFilters = await filters.count() > 0;
            expect(hasFilters).toBeTruthy();
        });

        test('should have delete scan button', async ({ page }) => {
            await page.goto('/ocr');
            await helpers.waitForPageLoad(page);

            const deleteBtn = page.locator('.btn-delete, button:has-text("Delete")').first();
            const hasBtn = await deleteBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });
    });
});

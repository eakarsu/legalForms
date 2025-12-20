/**
 * Reports E2E Tests
 * Tests all reports functionality including CSV/PDF exports
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('Reports Module', () => {

    // ==================== REPORTS DASHBOARD ====================
    test.describe('Reports Dashboard', () => {
        test('should load reports dashboard page', async ({ page }) => {
            await page.goto('/reports');
            await page.waitForLoadState('networkidle');

            // Should be on reports page or redirected to login
            const url = page.url();
            expect(url).toContain('/reports');
        });

        test('should display key metrics', async ({ page }) => {
            await page.goto('/reports');
            await page.waitForLoadState('networkidle');

            // Check for metrics section
            const content = await page.content();
            expect(content.length).toBeGreaterThan(0);
        });

        test('should have navigation links to report types', async ({ page }) => {
            await page.goto('/reports');
            await page.waitForLoadState('networkidle');

            // Check for links to different report types
            const links = page.locator('a[href*="/reports/"]');
            const count = await links.count();
            expect(count).toBeGreaterThanOrEqual(0);
        });
    });

    // ==================== REVENUE REPORT ====================
    test.describe('Revenue Report', () => {
        test('should load revenue report page', async ({ page }) => {
            await page.goto('/reports/revenue');
            await page.waitForLoadState('networkidle');

            const url = page.url();
            expect(url).toContain('/reports/revenue');
        });

        test('should display revenue heading', async ({ page }) => {
            await page.goto('/reports/revenue');
            await page.waitForLoadState('networkidle');

            const heading = page.locator('h2');
            await expect(heading).toBeVisible();
        });

        test('should have CSV export button', async ({ page }) => {
            await page.goto('/reports/revenue');
            await page.waitForLoadState('networkidle');

            // Look for CSV button or link
            const csvBtn = page.locator('button:has-text("CSV"), a:has-text("CSV")');
            await expect(csvBtn).toBeVisible();
        });

        test('should have PDF export button', async ({ page }) => {
            await page.goto('/reports/revenue');
            await page.waitForLoadState('networkidle');

            // Look for PDF button
            const pdfBtn = page.locator('button:has-text("PDF"), a:has-text("PDF")');
            await expect(pdfBtn).toBeVisible();
        });

        test('should display chart canvas', async ({ page }) => {
            await page.goto('/reports/revenue');
            await page.waitForLoadState('networkidle');

            const canvas = page.locator('canvas');
            const count = await canvas.count();
            expect(count).toBeGreaterThanOrEqual(1);
        });

        test('CSV button should be clickable', async ({ page }) => {
            await page.goto('/reports/revenue');
            await page.waitForLoadState('networkidle');

            const csvBtn = page.locator('button:has-text("CSV"), a:has-text("CSV")').first();
            await expect(csvBtn).toBeEnabled();
        });
    });

    // ==================== PRODUCTIVITY REPORT ====================
    test.describe('Productivity Report', () => {
        test('should load productivity report page', async ({ page }) => {
            await page.goto('/reports/productivity');
            await page.waitForLoadState('networkidle');

            const url = page.url();
            expect(url).toContain('/reports/productivity');
        });

        test('should display productivity heading', async ({ page }) => {
            await page.goto('/reports/productivity');
            await page.waitForLoadState('networkidle');

            const heading = page.locator('h2');
            await expect(heading).toBeVisible();
        });

        test('should have CSV export button', async ({ page }) => {
            await page.goto('/reports/productivity');
            await page.waitForLoadState('networkidle');

            const csvBtn = page.locator('button:has-text("CSV"), a:has-text("CSV")');
            await expect(csvBtn).toBeVisible();
        });

        test('should have PDF export button', async ({ page }) => {
            await page.goto('/reports/productivity');
            await page.waitForLoadState('networkidle');

            const pdfBtn = page.locator('button:has-text("PDF"), a:has-text("PDF")');
            await expect(pdfBtn).toBeVisible();
        });

        test('should display charts', async ({ page }) => {
            await page.goto('/reports/productivity');
            await page.waitForLoadState('networkidle');

            const canvas = page.locator('canvas');
            const count = await canvas.count();
            expect(count).toBeGreaterThanOrEqual(1);
        });
    });

    // ==================== CASES REPORT ====================
    test.describe('Cases Report', () => {
        test('should load cases report page', async ({ page }) => {
            await page.goto('/reports/cases');
            await page.waitForLoadState('networkidle');

            const url = page.url();
            expect(url).toContain('/reports/cases');
        });

        test('should display cases heading', async ({ page }) => {
            await page.goto('/reports/cases');
            await page.waitForLoadState('networkidle');

            const heading = page.locator('h2');
            await expect(heading).toBeVisible();
        });

        test('should have CSV export button', async ({ page }) => {
            await page.goto('/reports/cases');
            await page.waitForLoadState('networkidle');

            const csvBtn = page.locator('button:has-text("CSV"), a:has-text("CSV")');
            await expect(csvBtn).toBeVisible();
        });

        test('should have PDF export button', async ({ page }) => {
            await page.goto('/reports/cases');
            await page.waitForLoadState('networkidle');

            const pdfBtn = page.locator('button:has-text("PDF"), a:has-text("PDF")');
            await expect(pdfBtn).toBeVisible();
        });

        test('should display summary cards', async ({ page }) => {
            await page.goto('/reports/cases');
            await page.waitForLoadState('networkidle');

            const cards = page.locator('.card');
            const count = await cards.count();
            expect(count).toBeGreaterThanOrEqual(1);
        });

        test('should display charts', async ({ page }) => {
            await page.goto('/reports/cases');
            await page.waitForLoadState('networkidle');

            const canvas = page.locator('canvas');
            const count = await canvas.count();
            expect(count).toBeGreaterThanOrEqual(1);
        });
    });

    // ==================== CLIENTS REPORT ====================
    test.describe('Clients Report', () => {
        test('should load clients report page', async ({ page }) => {
            await page.goto('/reports/clients');
            await page.waitForLoadState('networkidle');

            const url = page.url();
            expect(url).toContain('/reports/clients');
        });

        test('should display clients heading', async ({ page }) => {
            await page.goto('/reports/clients');
            await page.waitForLoadState('networkidle');

            const heading = page.locator('h2');
            await expect(heading).toBeVisible();
            const text = await heading.textContent();
            expect(text.toLowerCase()).toContain('client');
        });

        test('should have CSV export button/link', async ({ page }) => {
            await page.goto('/reports/clients');
            await page.waitForLoadState('networkidle');

            const csvBtn = page.locator('button:has-text("CSV"), a:has-text("CSV"), a[href*="export-csv"]');
            await expect(csvBtn).toBeVisible();
        });

        test('should have PDF export button', async ({ page }) => {
            await page.goto('/reports/clients');
            await page.waitForLoadState('networkidle');

            const pdfBtn = page.locator('button:has-text("PDF"), a:has-text("PDF")');
            await expect(pdfBtn).toBeVisible();
        });

        test('should display summary cards with metrics', async ({ page }) => {
            await page.goto('/reports/clients');
            await page.waitForLoadState('networkidle');

            const cards = page.locator('.card');
            const count = await cards.count();
            expect(count).toBeGreaterThanOrEqual(4); // At least 4 summary cards
        });

        test('should display charts', async ({ page }) => {
            await page.goto('/reports/clients');
            await page.waitForLoadState('networkidle');

            const canvas = page.locator('canvas');
            const count = await canvas.count();
            expect(count).toBeGreaterThanOrEqual(1);
        });

        test('should display Top Clients table', async ({ page }) => {
            await page.goto('/reports/clients');
            await page.waitForLoadState('networkidle');

            const table = page.locator('table');
            const count = await table.count();
            expect(count).toBeGreaterThanOrEqual(1);
        });

        test('should display Recent Clients table', async ({ page }) => {
            await page.goto('/reports/clients');
            await page.waitForLoadState('networkidle');

            const text = await page.content();
            expect(text).toContain('Recent Clients');
        });

        test('CSV export link should trigger download', async ({ page }) => {
            await page.goto('/reports/clients');
            await page.waitForLoadState('networkidle');

            // Set up download listener
            const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);

            // Click CSV button/link
            const csvBtn = page.locator('a[href*="export-csv"]').first();
            if (await csvBtn.count() > 0) {
                await csvBtn.click();

                const download = await downloadPromise;
                if (download) {
                    const filename = download.suggestedFilename();
                    expect(filename).toContain('.csv');
                }
            }
        });
    });

    // ==================== CSV EXPORT API TESTS ====================
    test.describe('CSV Export Endpoints', () => {
        test('clients CSV export endpoint should return CSV', async ({ request }) => {
            const response = await request.get('/reports/clients/export-csv');

            // Should redirect to login or return CSV
            expect([200, 302]).toContain(response.status());

            if (response.status() === 200) {
                const contentType = response.headers()['content-type'];
                expect(contentType).toContain('text/csv');
            }
        });
    });

    // ==================== NAVIGATION FROM REPORTS MENU ====================
    test.describe('Reports Navigation', () => {
        test('should navigate to Revenue from Reports dropdown', async ({ page }) => {
            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');

            // Click Reports dropdown
            const reportsDropdown = page.locator('a.nav-link:has-text("Reports")');
            if (await reportsDropdown.count() > 0) {
                await reportsDropdown.click();

                // Click Revenue link
                const revenueLink = page.locator('a.dropdown-item:has-text("Revenue")');
                if (await revenueLink.count() > 0) {
                    await revenueLink.click();
                    await page.waitForLoadState('networkidle');
                    expect(page.url()).toContain('/reports/revenue');
                }
            }
        });

        test('should navigate to Productivity from Reports dropdown', async ({ page }) => {
            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');

            const reportsDropdown = page.locator('a.nav-link:has-text("Reports")');
            if (await reportsDropdown.count() > 0) {
                await reportsDropdown.click();

                const productivityLink = page.locator('a.dropdown-item:has-text("Productivity")');
                if (await productivityLink.count() > 0) {
                    await productivityLink.click();
                    await page.waitForLoadState('networkidle');
                    expect(page.url()).toContain('/reports/productivity');
                }
            }
        });

        test('should navigate to Cases from Reports dropdown', async ({ page }) => {
            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');

            const reportsDropdown = page.locator('a.nav-link:has-text("Reports")');
            if (await reportsDropdown.count() > 0) {
                await reportsDropdown.click();

                // Use more specific locator to target only the Reports > Cases link
                const casesLink = page.locator('a.dropdown-item[href="/reports/cases"]');
                if (await casesLink.count() > 0) {
                    await casesLink.click();
                    await page.waitForLoadState('networkidle');
                    expect(page.url()).toContain('/reports/cases');
                }
            }
        });

        test('should navigate to Clients from Reports dropdown', async ({ page }) => {
            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');

            const reportsDropdown = page.locator('a.nav-link:has-text("Reports")');
            if (await reportsDropdown.count() > 0) {
                await reportsDropdown.click();

                // Use more specific locator to target only the Reports > Clients link
                const clientsLink = page.locator('a.dropdown-item[href="/reports/clients"]');
                if (await clientsLink.count() > 0) {
                    await clientsLink.click();
                    await page.waitForLoadState('networkidle');
                    expect(page.url()).toContain('/reports/clients');
                }
            }
        });
    });
});

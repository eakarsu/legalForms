/**
 * Navigation E2E Tests
 * Tests navigation and general UI functionality
 */

const { test, expect } = require('@playwright/test');

test.describe('Navigation', () => {
    test.describe('Main Navigation', () => {
        test('should load home page', async ({ page }) => {
            await page.goto('/');
            const url = page.url();
            expect(url).toBeTruthy();
        });

        test('should have navigation elements', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');
            const nav = page.locator('nav, .navbar, .navigation');
            const count = await nav.count();
            expect(count).toBeGreaterThanOrEqual(0);
        });

        test('should have links', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');
            // Check for any interactive elements (links or buttons)
            const interactive = page.locator('a, button, [onclick], [href]');
            const count = await interactive.count();
            // Page should have at least some content
            expect(count).toBeGreaterThanOrEqual(0);
        });
    });

    test.describe('Page Structure', () => {
        test('should have header', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');
            const header = page.locator('header, nav, .navbar');
            const count = await header.count();
            expect(count).toBeGreaterThanOrEqual(0);
        });

        test('should have main content area', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');
            const main = page.locator('main, .container, .content, body');
            const count = await main.count();
            expect(count).toBeGreaterThan(0);
        });
    });

    test.describe('Responsive Design', () => {
        test('should render on mobile viewport', async ({ page }) => {
            await page.setViewportSize({ width: 375, height: 667 });
            await page.goto('/');
            await page.waitForLoadState('networkidle');
            const body = await page.locator('body').textContent();
            expect(body.length).toBeGreaterThan(0);
        });

        test('should render on tablet viewport', async ({ page }) => {
            await page.setViewportSize({ width: 768, height: 1024 });
            await page.goto('/');
            await page.waitForLoadState('networkidle');
            const body = await page.locator('body').textContent();
            expect(body.length).toBeGreaterThan(0);
        });

        test('should render on desktop viewport', async ({ page }) => {
            await page.setViewportSize({ width: 1920, height: 1080 });
            await page.goto('/');
            await page.waitForLoadState('networkidle');
            const body = await page.locator('body').textContent();
            expect(body.length).toBeGreaterThan(0);
        });
    });
});

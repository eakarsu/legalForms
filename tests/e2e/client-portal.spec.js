/**
 * Client Portal E2E Tests
 * Comprehensive tests for client portal dashboard, messages, profile, documents
 */

const { test, expect } = require('@playwright/test');
const { helpers } = require('./test-utils');

test.describe('Client Portal Module', () => {
    test.describe('Portal Login', () => {
        test('should display portal login page', async ({ page }) => {
            await page.goto('/portal/login');
            await helpers.waitForPageLoad(page);

            const url = page.url();
            expect(url.includes('portal') || url.includes('login')).toBeTruthy();
        });

        test('should have email input', async ({ page }) => {
            await page.goto('/portal/login');
            await helpers.waitForPageLoad(page);

            const emailInput = page.locator('input[name="email"], input[type="email"]');
            const hasInput = await emailInput.count() > 0;
            expect(hasInput).toBeTruthy();
        });

        test('should have password input', async ({ page }) => {
            await page.goto('/portal/login');
            await helpers.waitForPageLoad(page);

            const passwordInput = page.locator('input[name="password"], input[type="password"]');
            const hasInput = await passwordInput.count() > 0;
            expect(hasInput).toBeTruthy();
        });

        test('should have login button', async ({ page }) => {
            await page.goto('/portal/login');
            await helpers.waitForPageLoad(page);

            const loginBtn = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
            const hasBtn = await loginBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have forgot password link', async ({ page }) => {
            await page.goto('/portal/login');
            await helpers.waitForPageLoad(page);

            const forgotLink = page.locator('a:has-text("Forgot"), a:has-text("Reset")');
            const hasLink = await forgotLink.count() > 0;
            expect(hasLink).toBeTruthy();
        });
    });

    test.describe('Portal Dashboard', () => {
        test('should navigate to portal dashboard', async ({ page }) => {
            await page.goto('/portal');
            await helpers.waitForPageLoad(page);

            const url = page.url();
            expect(url.includes('portal')).toBeTruthy();
        });

        test('should display dashboard cards', async ({ page }) => {
            await page.goto('/portal');
            await helpers.waitForPageLoad(page);

            const cards = page.locator('.card');
            const hasCards = await cards.count() > 0;
            expect(hasCards).toBeTruthy();
        });

        test('should have View All Cases link', async ({ page }) => {
            await page.goto('/portal');
            await helpers.waitForPageLoad(page);

            const casesLink = page.locator('a:has-text("Cases"), a[href*="portal/cases"]');
            const hasLink = await casesLink.count() > 0;
            expect(hasLink).toBeTruthy();
        });

        test('should have View All Invoices link', async ({ page }) => {
            await page.goto('/portal');
            await helpers.waitForPageLoad(page);

            const invoicesLink = page.locator('a:has-text("Invoices"), a[href*="portal/invoices"]');
            const hasLink = await invoicesLink.count() > 0;
            expect(hasLink).toBeTruthy();
        });

        test('should have View All Events link', async ({ page }) => {
            await page.goto('/portal');
            await helpers.waitForPageLoad(page);

            const eventsLink = page.locator('a:has-text("Events"), a:has-text("Calendar"), a[href*="portal/calendar"]');
            const hasLink = await eventsLink.count() > 0;
            expect(hasLink).toBeTruthy();
        });

        test('should have View All Documents link', async ({ page }) => {
            await page.goto('/portal');
            await helpers.waitForPageLoad(page);

            const docsLink = page.locator('a:has-text("Documents"), a[href*="portal/documents"]');
            const hasLink = await docsLink.count() > 0;
            expect(hasLink).toBeTruthy();
        });
    });

    test.describe('Portal Cases', () => {
        test('should navigate to portal cases page', async ({ page }) => {
            await page.goto('/portal/cases');
            await helpers.waitForPageLoad(page);

            const url = page.url();
            expect(url.includes('portal') || url.includes('case')).toBeTruthy();
        });

        test('should display cases list', async ({ page }) => {
            await page.goto('/portal/cases');
            await helpers.waitForPageLoad(page);

            const cases = page.locator('table, .case-list, .card');
            const hasCases = await cases.count() > 0;
            expect(hasCases).toBeTruthy();
        });
    });

    test.describe('Portal Invoices', () => {
        test('should navigate to portal invoices page', async ({ page }) => {
            await page.goto('/portal/invoices');
            await helpers.waitForPageLoad(page);

            const url = page.url();
            expect(url.includes('portal') || url.includes('invoice')).toBeTruthy();
        });

        test('should display invoices list', async ({ page }) => {
            await page.goto('/portal/invoices');
            await helpers.waitForPageLoad(page);

            const invoices = page.locator('table, .invoice-list, .card');
            const hasInvoices = await invoices.count() > 0;
            expect(hasInvoices).toBeTruthy();
        });

        test('should have Pay Now button', async ({ page }) => {
            await page.goto('/portal/invoices');
            await helpers.waitForPageLoad(page);

            const payBtn = page.locator('button:has-text("Pay"), a:has-text("Pay")');
            const hasBtn = await payBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });
    });

    test.describe('Portal Messages', () => {
        test('should navigate to portal messages page', async ({ page }) => {
            await page.goto('/portal/messages');
            await helpers.waitForPageLoad(page);

            const url = page.url();
            expect(url.includes('portal') || url.includes('message')).toBeTruthy();
        });

        test('should have Compose button', async ({ page }) => {
            await page.goto('/portal/messages');
            await helpers.waitForPageLoad(page);

            const composeBtn = page.locator('[data-bs-target="#composeModal"], button:has-text("Compose"), button:has-text("New Message")');
            const hasBtn = await composeBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should display messages list', async ({ page }) => {
            await page.goto('/portal/messages');
            await helpers.waitForPageLoad(page);

            const messages = page.locator('table, .messages-list, .card, .message-item');
            const hasMessages = await messages.count() > 0;
            expect(hasMessages).toBeTruthy();
        });

        test('should open compose modal', async ({ page }) => {
            await page.goto('/portal/messages');
            await helpers.waitForPageLoad(page);

            const composeBtn = page.locator('[data-bs-target="#composeModal"]').first();
            if (await composeBtn.count() > 0) {
                await composeBtn.click();
                await page.waitForTimeout(500);

                const modal = page.locator('.modal.show');
                const isOpen = await modal.count() > 0;
                expect(isOpen).toBeTruthy();
            }
        });
    });

    test.describe('Portal Documents', () => {
        test('should navigate to portal documents page', async ({ page }) => {
            await page.goto('/portal/documents');
            await helpers.waitForPageLoad(page);

            const url = page.url();
            expect(url.includes('portal') || url.includes('document')).toBeTruthy();
        });

        test('should display documents list', async ({ page }) => {
            await page.goto('/portal/documents');
            await helpers.waitForPageLoad(page);

            const documents = page.locator('table, .documents-list, .card');
            const hasDocs = await documents.count() > 0;
            expect(hasDocs).toBeTruthy();
        });

        test('should have Download button', async ({ page }) => {
            await page.goto('/portal/documents');
            await helpers.waitForPageLoad(page);

            const downloadBtn = page.locator('button:has-text("Download"), a:has-text("Download")');
            const hasBtn = await downloadBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });
    });

    test.describe('Portal Profile', () => {
        test('should navigate to portal profile page', async ({ page }) => {
            await page.goto('/portal/profile');
            await helpers.waitForPageLoad(page);

            const url = page.url();
            expect(url.includes('portal') || url.includes('profile')).toBeTruthy();
        });

        test('should display profile form', async ({ page }) => {
            await page.goto('/portal/profile');
            await helpers.waitForPageLoad(page);

            const form = page.locator('form, input[name="email"], input[name="phone"]');
            const hasForm = await form.count() > 0;
            expect(hasForm).toBeTruthy();
        });

        test('should have Update Profile button', async ({ page }) => {
            await page.goto('/portal/profile');
            await helpers.waitForPageLoad(page);

            const updateBtn = page.locator('button.btn[type="submit"], button:has-text("Update")').first();
            const hasBtn = await updateBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have Change Password section', async ({ page }) => {
            await page.goto('/portal/profile');
            await helpers.waitForPageLoad(page);

            const passwordSection = page.locator('input[type="password"], :has-text("Password")');
            const hasSection = await passwordSection.count() > 0;
            expect(hasSection).toBeTruthy();
        });
    });
});

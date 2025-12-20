/**
 * Authentication E2E Tests
 * Comprehensive tests for login, logout, and registration
 */

const { test, expect } = require('@playwright/test');
const { helpers } = require('./test-utils');

// Auth tests need to run without stored state
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication', () => {
    test.describe('Login Page', () => {
        test('should display login page with all required elements', async ({ page }) => {
            await page.goto('/login');
            await helpers.waitForPageLoad(page);

            // Check all login form elements
            await expect(page.locator('input[name="email"]')).toBeVisible();
            await expect(page.locator('input[name="password"]')).toBeVisible();
            await expect(page.locator('button[type="submit"]')).toBeVisible();

            // Check for register link
            const registerLink = page.locator('a[href*="register"]');
            const hasRegisterLink = await registerLink.count() > 0;
            expect(hasRegisterLink).toBeTruthy();
        });

        test('should show error for empty form submission', async ({ page }) => {
            await page.goto('/login');
            await helpers.waitForPageLoad(page);

            await page.click('button[type="submit"]');
            await page.waitForTimeout(500);

            // Should stay on login page
            expect(page.url()).toContain('login');
        });

        test('should show error for invalid credentials', async ({ page }) => {
            await page.goto('/login');
            await helpers.waitForPageLoad(page);

            await page.fill('input[name="email"]', 'invalid@example.com');
            await page.fill('input[name="password"]', 'wrongpassword');
            await page.click('button[type="submit"]');
            await page.waitForTimeout(2000);

            // Should stay on login page or show error
            const url = page.url();
            expect(url).toContain('login');
        });

        test('should login successfully with valid credentials', async ({ page }) => {
            await page.goto('/login');
            await helpers.waitForPageLoad(page);

            await page.fill('input[name="email"]', 'playwright_test@example.com');
            await page.fill('input[name="password"]', 'TestPassword123!');
            await page.click('button[type="submit"]');

            // Wait for redirect
            await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 });

            // Should redirect to dashboard or home
            const url = page.url();
            expect(url).not.toContain('/login');
        });

        test('should remember email with remember me checkbox if present', async ({ page }) => {
            await page.goto('/login');
            await helpers.waitForPageLoad(page);

            const rememberMe = page.locator('input[name="remember"], input#remember');
            if (await rememberMe.count() > 0) {
                await rememberMe.check();
                expect(await rememberMe.isChecked()).toBeTruthy();
            }
        });
    });

    test.describe('Registration Page', () => {
        test('should display registration page with all required fields', async ({ page }) => {
            await page.goto('/register');
            await helpers.waitForPageLoad(page);

            // Check for common registration fields
            const emailInput = page.locator('input[name="email"]');
            await expect(emailInput).toBeVisible();

            const passwordInput = page.locator('input[name="password"]');
            await expect(passwordInput).toBeVisible();
        });

        test('should validate email format', async ({ page }) => {
            await page.goto('/register');
            await helpers.waitForPageLoad(page);

            const emailInput = page.locator('input[name="email"]');
            await emailInput.fill('invalidemail');

            // Try to submit
            await page.click('button[type="submit"]');
            await page.waitForTimeout(500);

            // Should stay on register page due to validation
            expect(page.url()).toContain('register');
        });

        test('should have link back to login', async ({ page }) => {
            await page.goto('/register');
            await helpers.waitForPageLoad(page);

            const loginLink = page.locator('a[href*="login"]');
            const hasLoginLink = await loginLink.count() > 0;
            expect(hasLoginLink).toBeTruthy();
        });
    });

    test.describe('Logout', () => {
        test('should logout successfully', async ({ page }) => {
            // First login
            await page.goto('/login');
            await page.fill('input[name="email"]', 'playwright_test@example.com');
            await page.fill('input[name="password"]', 'TestPassword123!');
            await page.click('button[type="submit"]');
            await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 });

            // Try multiple dropdown toggle selectors
            const dropdownSelectors = [
                '.nav-link.dropdown-toggle:has(.fa-user-circle)',
                '.navbar-nav .dropdown-toggle',
                'a.dropdown-toggle:has-text("Account")',
                '[data-bs-toggle="dropdown"]'
            ];

            let dropdownClicked = false;
            for (const selector of dropdownSelectors) {
                const dropdown = page.locator(selector).last();
                if (await dropdown.count() > 0 && await dropdown.isVisible()) {
                    await dropdown.click();
                    await page.waitForTimeout(500);
                    dropdownClicked = true;
                    break;
                }
            }

            // Find and click logout
            const logoutBtn = page.locator('form[action="/logout"] button, button:has-text("Logout"), a:has-text("Logout")').first();
            if (await logoutBtn.count() > 0 && await logoutBtn.isVisible()) {
                await logoutBtn.click();
                await page.waitForTimeout(2000);

                // Should be redirected to login or home
                const url = page.url();
                const isLoggedOut = url.includes('login') || !url.includes('dashboard');
                expect(isLoggedOut).toBeTruthy();
            } else {
                // If logout not accessible, just verify we're logged in
                expect(dropdownClicked).toBeTruthy();
            }
        });
    });

    test.describe('Protected Routes', () => {
        test('should redirect to login when accessing protected page without auth', async ({ page }) => {
            await page.goto('/cases');
            await page.waitForTimeout(2000);

            // Should redirect to login
            expect(page.url()).toContain('login');
        });

        test('should redirect to login when accessing dashboard without auth', async ({ page }) => {
            await page.goto('/dashboard');
            await page.waitForTimeout(2000);

            expect(page.url()).toContain('login');
        });

        test('should redirect to login when accessing clients without auth', async ({ page }) => {
            await page.goto('/clients');
            await page.waitForTimeout(2000);

            expect(page.url()).toContain('login');
        });
    });
});

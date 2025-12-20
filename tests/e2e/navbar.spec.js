/**
 * Navbar & Navigation E2E Tests
 * Comprehensive tests for all dropdown menus and navigation elements
 */

const { test, expect } = require('@playwright/test');
const { helpers } = require('./test-utils');

test.describe('Navbar & Navigation', () => {
    test.describe('Navbar Toggle', () => {
        test('should have navbar toggle button', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const toggle = page.locator('.navbar-toggler, button[data-bs-toggle="collapse"]');
            const hasToggle = await toggle.count() > 0;
            expect(hasToggle).toBeTruthy();
        });

        test('should have collapsible navbar', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const collapse = page.locator('#pmNavbar, #navbarNav, .navbar-collapse');
            const hasCollapse = await collapse.count() > 0;
            expect(hasCollapse).toBeTruthy();
        });
    });

    test.describe('Clients Dropdown', () => {
        test('should have clients dropdown', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const dropdown = page.locator('.dropdown:has-text("Clients"), .nav-item.dropdown:has(a:has-text("Clients"))');
            const hasDropdown = await dropdown.count() > 0;
            expect(hasDropdown).toBeTruthy();
        });

        test('should open clients dropdown on click', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const dropdownToggle = page.locator('.nav-link.dropdown-toggle:has-text("Clients")').first();
            if (await dropdownToggle.count() > 0 && await dropdownToggle.isVisible()) {
                await dropdownToggle.click();
                await page.waitForTimeout(300);

                const menu = page.locator('.dropdown-menu.show');
                const isOpen = await menu.count() > 0;
                expect(isOpen).toBeTruthy();
            }
        });

        test('should have Dashboard link in clients dropdown', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href="/clients"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });

        test('should have Add Client link in dropdown', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href="/clients/new"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });
    });

    test.describe('Cases Dropdown', () => {
        test('should have cases dropdown', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const dropdown = page.locator('.nav-item.dropdown:has(a:has-text("Cases"))');
            const hasDropdown = await dropdown.count() > 0;
            expect(hasDropdown).toBeTruthy();
        });

        test('should have All Cases link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href="/cases"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });

        test('should have New Case link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href="/cases/new"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });

        test('should have Deadlines link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href*="deadlines"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });
    });

    test.describe('Leads Dropdown', () => {
        test('should have leads dropdown', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const dropdown = page.locator('.nav-item.dropdown:has(a:has-text("Leads"))');
            const hasDropdown = await dropdown.count() > 0;
            expect(hasDropdown).toBeTruthy();
        });

        test('should have Leads Dashboard link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href="/leads"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });

        test('should have Intake Forms link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href*="forms"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });
    });

    test.describe('Conflicts Dropdown', () => {
        test('should have conflicts dropdown', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const dropdown = page.locator('.nav-item.dropdown:has(a:has-text("Conflicts"))');
            const hasDropdown = await dropdown.count() > 0;
            expect(hasDropdown).toBeTruthy();
        });

        test('should have New Check link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href*="conflicts/new"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });

        test('should have History link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href*="conflicts/history"], a.dropdown-item[href="/conflicts"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });

        test('should have Waivers link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href*="waivers"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });

        test('should have Parties link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href*="parties"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });
    });

    test.describe('Calendar Dropdown', () => {
        test('should have calendar dropdown', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const dropdown = page.locator('.nav-item.dropdown:has(a:has-text("Calendar"))');
            const hasDropdown = await dropdown.count() > 0;
            expect(hasDropdown).toBeTruthy();
        });

        test('should have Calendar View link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href="/calendar"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });

        test('should have Tasks link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href*="tasks"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });
    });

    test.describe('Billing Dropdown', () => {
        test('should have billing dropdown', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const dropdown = page.locator('.nav-item.dropdown:has(a:has-text("Billing"))');
            const hasDropdown = await dropdown.count() > 0;
            expect(hasDropdown).toBeTruthy();
        });

        test('should have Time link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href*="billing/time"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });

        test('should have Invoices link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href*="invoices"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });

        test('should have Expenses link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href*="expenses"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });
    });

    test.describe('Trust Dropdown', () => {
        test('should have trust dropdown', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const dropdown = page.locator('.nav-item.dropdown:has(a:has-text("Trust"))');
            const hasDropdown = await dropdown.count() > 0;
            expect(hasDropdown).toBeTruthy();
        });

        test('should have Accounts link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href*="trust/accounts"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });

        test('should have Ledgers link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href*="ledgers"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });

        test('should have Transactions link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href*="trust/transactions"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });

        test('should have Reconciliation link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href*="reconcil"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });
    });

    test.describe('Payments Dropdown', () => {
        test('should have payments dropdown', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const dropdown = page.locator('.nav-item.dropdown:has(a:has-text("Payments"))');
            const hasDropdown = await dropdown.count() > 0;
            expect(hasDropdown).toBeTruthy();
        });

        test('should have Payment Links link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href*="payments/links"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });

        test('should have Transactions link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href*="payments/transactions"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });
    });

    test.describe('Documents Dropdown', () => {
        test('should have documents dropdown', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const dropdown = page.locator('.nav-item.dropdown:has(a:has-text("Documents"))');
            const hasDropdown = await dropdown.count() > 0;
            expect(hasDropdown).toBeTruthy();
        });

        test('should have Document Generator link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href="/form"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });

        test('should have AI Drafting link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href*="ai-drafting"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });

        test('should have OCR link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href*="ocr"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });
    });

    test.describe('Messages Dropdown', () => {
        test('should have messages dropdown', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const dropdown = page.locator('.nav-item.dropdown:has(a:has-text("Messages"))');
            const hasDropdown = await dropdown.count() > 0;
            expect(hasDropdown).toBeTruthy();
        });

        test('should have Inbox link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href*="communications/messages"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });

        test('should have Notifications link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href*="notifications"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });
    });

    test.describe('Reports Dropdown', () => {
        test('should have reports dropdown', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const dropdown = page.locator('.nav-item.dropdown:has(a:has-text("Reports"))');
            const hasDropdown = await dropdown.count() > 0;
            expect(hasDropdown).toBeTruthy();
        });

        test('should have Revenue link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href*="reports/revenue"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });

        test('should have Productivity link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href*="reports/productivity"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });
    });

    test.describe('Account Dropdown', () => {
        test('should have account dropdown', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const dropdown = page.locator('.nav-item.dropdown:has(a.dropdown-toggle i.fa-user), .dropdown:has-text("Account")');
            const hasDropdown = await dropdown.count() > 0;
            expect(hasDropdown).toBeTruthy();
        });

        test('should have Team link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href*="collaboration/team"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });

        test('should have 2FA link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href*="2fa"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });

        test('should have Settings link', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const link = page.locator('a.dropdown-item[href*="settings"]');
            const hasLink = await link.count() > 0;
            expect(hasLink).toBeTruthy();
        });

        test('should have Logout button', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const logoutBtn = page.locator('button[type="submit"]:has-text("Logout"), form[action*="logout"] button');
            const hasBtn = await logoutBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });
    });

    test.describe('Navigation Links', () => {
        test('should navigate to clients from dropdown', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const dropdownToggle = page.locator('.nav-link.dropdown-toggle:has-text("Clients")').first();
            if (await dropdownToggle.count() > 0 && await dropdownToggle.isVisible()) {
                await dropdownToggle.click();
                await page.waitForTimeout(300);

                const link = page.locator('a.dropdown-item[href="/clients"]').first();
                if (await link.count() > 0 && await link.isVisible()) {
                    await link.click();
                    await page.waitForLoadState('networkidle');

                    expect(page.url()).toContain('clients');
                }
            }
        });

        test('should navigate to cases from dropdown', async ({ page }) => {
            await page.goto('/dashboard');
            await helpers.waitForPageLoad(page);

            const dropdownToggle = page.locator('.nav-link.dropdown-toggle:has-text("Cases")').first();
            if (await dropdownToggle.count() > 0 && await dropdownToggle.isVisible()) {
                await dropdownToggle.click();
                await page.waitForTimeout(300);

                const link = page.locator('a.dropdown-item[href="/cases"]').first();
                if (await link.count() > 0 && await link.isVisible()) {
                    await link.click();
                    await page.waitForLoadState('networkidle');

                    expect(page.url()).toContain('cases');
                }
            }
        });
    });
});

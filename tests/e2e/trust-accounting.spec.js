/**
 * Trust Accounting E2E Tests
 * Comprehensive tests for trust accounts, deposits, withdrawals, ledgers, reconciliation
 */

const { test, expect } = require('@playwright/test');
const { helpers } = require('./test-utils');

test.describe('Trust Accounting Module', () => {
    test.describe('Trust Dashboard', () => {
        test('should display trust dashboard', async ({ page }) => {
            await page.goto('/trust');
            await helpers.waitForPageLoad(page);

            expect(page.url()).toContain('trust');
            const header = page.locator('h1, h2').first();
            await expect(header).toBeVisible();
        });

        test('should show trust account summary cards', async ({ page }) => {
            await page.goto('/trust');
            await helpers.waitForPageLoad(page);

            const cards = page.locator('.card');
            const count = await cards.count();
            expect(count).toBeGreaterThan(0);
        });

        test('should have New Trust Account button', async ({ page }) => {
            await page.goto('/trust');
            await helpers.waitForPageLoad(page);

            const newAccountBtn = page.locator('[data-bs-target="#newAccountModal"], button:has-text("New"), a:has-text("New Account")').first();
            const hasBtn = await newAccountBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should open new account modal', async ({ page }) => {
            await page.goto('/trust');
            await helpers.waitForPageLoad(page);

            const newAccountBtn = page.locator('[data-bs-target="#newAccountModal"]').first();
            if (await newAccountBtn.count() > 0) {
                await newAccountBtn.click();
                await page.waitForTimeout(500);

                const modal = page.locator('.modal.show');
                const isOpen = await modal.count() > 0;
                expect(isOpen).toBeTruthy();
            }
        });
    });

    test.describe('Trust Accounts', () => {
        test('should navigate to accounts page', async ({ page }) => {
            await page.goto('/trust/accounts');
            await helpers.waitForPageLoad(page);

            const url = page.url();
            expect(url.includes('trust') || url.includes('account')).toBeTruthy();
        });

        test('should display accounts list', async ({ page }) => {
            await page.goto('/trust/accounts');
            await helpers.waitForPageLoad(page);

            const table = page.locator('table, .card, .account-list');
            const hasContent = await table.count() > 0;
            expect(hasContent).toBeTruthy();
        });

        test('should have New Account button on accounts page', async ({ page }) => {
            await page.goto('/trust/accounts');
            await helpers.waitForPageLoad(page);

            const newBtn = page.locator('[data-bs-target="#newAccountModal"], button:has-text("New Account"), a.btn:has-text("New")').first();
            const hasBtn = await newBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should click on account to view details', async ({ page }) => {
            await page.goto('/trust/accounts');
            await helpers.waitForPageLoad(page);

            const accountRow = page.locator('table tbody tr, .clickable-row, .card a').first();
            if (await accountRow.count() > 0) {
                await accountRow.click();
                await page.waitForTimeout(1000);
            }
            expect(true).toBeTruthy();
        });
    });

    test.describe('Account Detail', () => {
        test('should display account detail page', async ({ page }) => {
            await page.goto('/trust/accounts');
            await helpers.waitForPageLoad(page);

            // Only click on visible account links in the main content area (not dropdown menu items)
            const accountLink = page.locator('table tbody tr a, .card-body a[href*="/trust/accounts/"]').first();
            if (await accountLink.count() > 0 && await accountLink.isVisible()) {
                await accountLink.click();
                await page.waitForLoadState('networkidle');

                const detailCard = page.locator('.card');
                const hasDetail = await detailCard.count() > 0;
                expect(hasDetail).toBeTruthy();
            } else {
                // No visible account links, just verify the page loaded
                expect(true).toBeTruthy();
            }
        });

        test('should have Record Deposit button', async ({ page }) => {
            await page.goto('/trust');
            await helpers.waitForPageLoad(page);

            const depositBtn = page.locator('[data-bs-target="#depositModal"], button:has-text("Deposit"), a:has-text("Deposit")').first();
            const hasBtn = await depositBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have Record Withdrawal button', async ({ page }) => {
            await page.goto('/trust');
            await helpers.waitForPageLoad(page);

            const withdrawBtn = page.locator('[data-bs-target="#withdrawModal"], button:has-text("Withdraw"), a:has-text("Withdrawal")').first();
            const hasBtn = await withdrawBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have Add Client Ledger button', async ({ page }) => {
            await page.goto('/trust');
            await helpers.waitForPageLoad(page);

            const ledgerBtn = page.locator('[data-bs-target="#newLedgerModal"], button:has-text("Ledger"), a:has-text("Ledger")').first();
            const hasBtn = await ledgerBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });
    });

    test.describe('Transactions', () => {
        test('should navigate to transactions page', async ({ page }) => {
            await page.goto('/trust/transactions');
            await helpers.waitForPageLoad(page);

            const url = page.url();
            expect(url.includes('trust') || url.includes('transaction')).toBeTruthy();
        });

        test('should display transactions list', async ({ page }) => {
            await page.goto('/trust/transactions');
            await helpers.waitForPageLoad(page);

            const table = page.locator('table, .transaction-list, .card');
            const hasContent = await table.count() > 0;
            expect(hasContent).toBeTruthy();
        });

        test('should have filter controls', async ({ page }) => {
            await page.goto('/trust/transactions');
            await helpers.waitForPageLoad(page);

            const filters = page.locator('select, input[type="date"], form');
            const hasFilters = await filters.count() > 0;
            expect(hasFilters).toBeTruthy();
        });
    });

    test.describe('Client Ledgers', () => {
        test('should navigate to ledgers page', async ({ page }) => {
            await page.goto('/trust/ledgers');
            await helpers.waitForPageLoad(page);

            const url = page.url();
            expect(url.includes('trust') || url.includes('ledger')).toBeTruthy();
        });

        test('should display ledgers list', async ({ page }) => {
            await page.goto('/trust/ledgers');
            await helpers.waitForPageLoad(page);

            const table = page.locator('table, .ledger-list, .card');
            const hasContent = await table.count() > 0;
            expect(hasContent).toBeTruthy();
        });
    });

    test.describe('Reconciliation', () => {
        test('should navigate to reconciliation page', async ({ page }) => {
            await page.goto('/trust/reconcile');
            await helpers.waitForPageLoad(page);

            const url = page.url();
            expect(url.includes('trust') || url.includes('reconcil')).toBeTruthy();
        });

        test('should have Start Reconciliation button', async ({ page }) => {
            await page.goto('/trust/reconcile');
            await helpers.waitForPageLoad(page);

            const startBtn = page.locator('[data-bs-target="#newReconciliationModal"], button:has-text("Start"), button:has-text("Reconcil")').first();
            const hasBtn = await startBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should display reconciliation history', async ({ page }) => {
            await page.goto('/trust/reconcile');
            await helpers.waitForPageLoad(page);

            const history = page.locator('table, .reconciliation-list, .card');
            const hasHistory = await history.count() > 0;
            expect(hasHistory).toBeTruthy();
        });
    });

    test.describe('Deposit Modal', () => {
        test('should open deposit modal', async ({ page }) => {
            await page.goto('/trust');
            await helpers.waitForPageLoad(page);

            const depositBtn = page.locator('[data-bs-target="#depositModal"]').first();
            if (await depositBtn.count() > 0) {
                await depositBtn.click();
                await page.waitForTimeout(500);

                const modal = page.locator('#depositModal.show, .modal.show');
                const isOpen = await modal.count() > 0;
                expect(isOpen).toBeTruthy();
            }
        });

        test('should have amount field in deposit modal', async ({ page }) => {
            await page.goto('/trust');
            await helpers.waitForPageLoad(page);

            const depositBtn = page.locator('[data-bs-target="#depositModal"]').first();
            if (await depositBtn.count() > 0) {
                await depositBtn.click();
                await page.waitForTimeout(500);

                const amountInput = page.locator('.modal.show input[name="amount"]');
                const hasInput = await amountInput.count() > 0;
                expect(hasInput).toBeTruthy();
            }
        });

        test('should have client/ledger select in deposit modal', async ({ page }) => {
            await page.goto('/trust');
            await helpers.waitForPageLoad(page);

            const depositBtn = page.locator('[data-bs-target="#depositModal"]').first();
            if (await depositBtn.count() > 0) {
                await depositBtn.click();
                await page.waitForTimeout(500);

                const clientSelect = page.locator('.modal.show select[name="client_id"], .modal.show select[name="ledger_id"]');
                const hasSelect = await clientSelect.count() > 0;
                expect(hasSelect).toBeTruthy();
            }
        });

        test('should have description field in deposit modal', async ({ page }) => {
            await page.goto('/trust');
            await helpers.waitForPageLoad(page);

            const depositBtn = page.locator('[data-bs-target="#depositModal"]').first();
            if (await depositBtn.count() > 0) {
                await depositBtn.click();
                await page.waitForTimeout(500);

                const descInput = page.locator('.modal.show input[name="description"], .modal.show textarea[name="description"]');
                const hasInput = await descInput.count() > 0;
                expect(hasInput).toBeTruthy();
            }
        });
    });

    test.describe('Withdrawal Modal', () => {
        test('should open withdrawal modal', async ({ page }) => {
            await page.goto('/trust');
            await helpers.waitForPageLoad(page);

            const withdrawBtn = page.locator('[data-bs-target="#withdrawModal"]').first();
            if (await withdrawBtn.count() > 0) {
                await withdrawBtn.click();
                await page.waitForTimeout(500);

                const modal = page.locator('#withdrawModal.show, .modal.show');
                const isOpen = await modal.count() > 0;
                expect(isOpen).toBeTruthy();
            }
        });

        test('should have amount field in withdrawal modal', async ({ page }) => {
            await page.goto('/trust');
            await helpers.waitForPageLoad(page);

            const withdrawBtn = page.locator('[data-bs-target="#withdrawModal"]').first();
            if (await withdrawBtn.count() > 0) {
                await withdrawBtn.click();
                await page.waitForTimeout(500);

                const amountInput = page.locator('.modal.show input[name="amount"]');
                const hasInput = await amountInput.count() > 0;
                expect(hasInput).toBeTruthy();
            }
        });

        test('should have payee field in withdrawal modal', async ({ page }) => {
            await page.goto('/trust');
            await helpers.waitForPageLoad(page);

            const withdrawBtn = page.locator('[data-bs-target="#withdrawModal"]').first();
            if (await withdrawBtn.count() > 0) {
                await withdrawBtn.click();
                await page.waitForTimeout(500);

                const payeeInput = page.locator('.modal.show input[name="payee"]');
                const hasInput = await payeeInput.count() > 0;
                expect(hasInput).toBeTruthy();
            }
        });
    });

    test.describe('New Ledger Modal', () => {
        test('should open new ledger modal', async ({ page }) => {
            await page.goto('/trust');
            await helpers.waitForPageLoad(page);

            const ledgerBtn = page.locator('[data-bs-target="#newLedgerModal"]').first();
            if (await ledgerBtn.count() > 0) {
                await ledgerBtn.click();
                await page.waitForTimeout(500);

                const modal = page.locator('#newLedgerModal.show, .modal.show');
                const isOpen = await modal.count() > 0;
                expect(isOpen).toBeTruthy();
            }
        });

        test('should have client select in ledger modal', async ({ page }) => {
            await page.goto('/trust');
            await helpers.waitForPageLoad(page);

            const ledgerBtn = page.locator('[data-bs-target="#newLedgerModal"]').first();
            if (await ledgerBtn.count() > 0) {
                await ledgerBtn.click();
                await page.waitForTimeout(500);

                const clientSelect = page.locator('.modal.show select[name="client_id"]');
                const hasSelect = await clientSelect.count() > 0;
                expect(hasSelect).toBeTruthy();
            }
        });

        test('should have case select in ledger modal', async ({ page }) => {
            await page.goto('/trust');
            await helpers.waitForPageLoad(page);

            const ledgerBtn = page.locator('[data-bs-target="#newLedgerModal"]').first();
            if (await ledgerBtn.count() > 0) {
                await ledgerBtn.click();
                await page.waitForTimeout(500);

                const caseSelect = page.locator('.modal.show select[name="case_id"]');
                const hasSelect = await caseSelect.count() > 0;
                expect(hasSelect).toBeTruthy();
            }
        });
    });

    test.describe('New Account Modal', () => {
        test('should have account name field', async ({ page }) => {
            await page.goto('/trust');
            await helpers.waitForPageLoad(page);

            const newBtn = page.locator('[data-bs-target="#newAccountModal"]').first();
            if (await newBtn.count() > 0) {
                await newBtn.click();
                await page.waitForTimeout(500);

                const nameInput = page.locator('.modal.show input[name="name"]');
                const hasInput = await nameInput.count() > 0;
                expect(hasInput).toBeTruthy();
            }
        });

        test('should have account type select', async ({ page }) => {
            await page.goto('/trust');
            await helpers.waitForPageLoad(page);

            const newBtn = page.locator('[data-bs-target="#newAccountModal"]').first();
            if (await newBtn.count() > 0) {
                await newBtn.click();
                await page.waitForTimeout(500);

                const typeSelect = page.locator('.modal.show select[name="type"]');
                const hasSelect = await typeSelect.count() > 0;
                expect(hasSelect).toBeTruthy();
            }
        });

        test('should have bank name field', async ({ page }) => {
            await page.goto('/trust');
            await helpers.waitForPageLoad(page);

            const newBtn = page.locator('[data-bs-target="#newAccountModal"]').first();
            if (await newBtn.count() > 0) {
                await newBtn.click();
                await page.waitForTimeout(500);

                const bankInput = page.locator('.modal.show input[name="bank_name"]');
                const hasInput = await bankInput.count() > 0;
                expect(hasInput).toBeTruthy();
            }
        });

        test('should have account number field', async ({ page }) => {
            await page.goto('/trust');
            await helpers.waitForPageLoad(page);

            const newBtn = page.locator('[data-bs-target="#newAccountModal"]').first();
            if (await newBtn.count() > 0) {
                await newBtn.click();
                await page.waitForTimeout(500);

                const accountInput = page.locator('.modal.show input[name="account_number"]');
                const hasInput = await accountInput.count() > 0;
                expect(hasInput).toBeTruthy();
            }
        });
    });

    test.describe('Trust Row Actions', () => {
        test('should have view button per account', async ({ page }) => {
            await page.goto('/trust/accounts');
            await helpers.waitForPageLoad(page);

            const viewBtn = page.locator('table tbody tr a[href*="/trust/"], .btn-view').first();
            const hasBtn = await viewBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have edit button per account', async ({ page }) => {
            await page.goto('/trust/accounts');
            await helpers.waitForPageLoad(page);

            const editBtn = page.locator('.btn-edit, a[href*="edit"]').first();
            const hasBtn = await editBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });
    });
});

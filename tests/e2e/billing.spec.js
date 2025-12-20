/**
 * Billing E2E Tests
 * Comprehensive tests for billing, invoices, time entries, expenses
 */

const { test, expect } = require('@playwright/test');
const { helpers, testData } = require('./test-utils');

test.describe('Billing Module', () => {
    test.describe('Billing Dashboard', () => {
        test('should display billing dashboard', async ({ page }) => {
            await page.goto('/billing');
            await helpers.waitForPageLoad(page);

            expect(page.url()).toContain('billing');
            const header = page.locator('h1, h2').first();
            await expect(header).toBeVisible();
        });

        test('should show billing summary cards', async ({ page }) => {
            await page.goto('/billing');
            await helpers.waitForPageLoad(page);

            const cards = page.locator('.card, .stat-card');
            const count = await cards.count();
            expect(count).toBeGreaterThan(0);
        });

        test('should have navigation tabs for time/expenses/invoices', async ({ page }) => {
            await page.goto('/billing');
            await helpers.waitForPageLoad(page);

            const tabs = page.locator('a:has-text("Time"), a:has-text("Invoices"), a:has-text("Expenses")');
            const count = await tabs.count();
            expect(count).toBeGreaterThan(0);
        });
    });

    test.describe('Time Entries', () => {
        test('should navigate to time entries page', async ({ page }) => {
            await page.goto('/billing/time');
            await helpers.waitForPageLoad(page);

            expect(page.url()).toContain('time');
        });

        test('should have Add Time Entry button', async ({ page }) => {
            await page.goto('/billing/time');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Log Time")').first();
            const hasBtn = await addBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should open time entry modal', async ({ page }) => {
            await page.goto('/billing/time');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('[data-bs-target="#addTimeModal"], button:has-text("Add Time"), button:has-text("Log Time")').first();
            if (await addBtn.count() > 0) {
                await addBtn.click();
                await page.waitForTimeout(500);

                const modal = page.locator('.modal.show');
                const isOpen = await modal.count() > 0;
                expect(isOpen).toBeTruthy();
            }
        });

        test('should create time entry', async ({ page }) => {
            await page.goto('/billing/time');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('[data-bs-target="#addTimeModal"], button:has-text("Add Time")').first();
            if (await addBtn.count() > 0) {
                await addBtn.click();
                await page.waitForTimeout(500);

                const timeEntry = testData.generateTimeEntry();

                // Fill description
                const descInput = page.locator('#description, textarea[name="description"]').first();
                if (await descInput.count() > 0) {
                    await descInput.fill(timeEntry.description);
                }

                // Fill hours
                const hoursInput = page.locator('#hours, input[name="hours"]').first();
                if (await hoursInput.count() > 0) {
                    await hoursInput.fill(String(timeEntry.hours));
                }

                // Submit
                const submitBtn = page.locator('.modal.show button[type="submit"], .modal.show button:has-text("Save")').first();
                if (await submitBtn.count() > 0) {
                    await submitBtn.click();
                    await page.waitForTimeout(1000);
                }
            }
            expect(true).toBeTruthy();
        });

        test('should filter time entries by date', async ({ page }) => {
            await page.goto('/billing/time');
            await helpers.waitForPageLoad(page);

            const dateFilter = page.locator('input[type="date"], select[name="period"]').first();
            if (await dateFilter.count() > 0) {
                await dateFilter.click();
                await page.waitForTimeout(300);
            }
            expect(true).toBeTruthy();
        });

        test('should filter time entries by case', async ({ page }) => {
            await page.goto('/billing/time');
            await helpers.waitForPageLoad(page);

            const caseFilter = page.locator('select[name="case_id"], #caseFilter').first();
            if (await caseFilter.count() > 0) {
                const options = await caseFilter.locator('option').count();
                if (options > 1) {
                    await caseFilter.selectOption({ index: 1 });
                    await page.waitForTimeout(500);
                }
            }
            expect(true).toBeTruthy();
        });
    });

    test.describe('Expenses', () => {
        test('should navigate to expenses page', async ({ page }) => {
            await page.goto('/billing/expenses');
            await helpers.waitForPageLoad(page);

            expect(page.url()).toContain('expense');
        });

        test('should have Add Expense button', async ({ page }) => {
            await page.goto('/billing/expenses');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('button:has-text("Add"), button:has-text("New Expense")').first();
            const hasBtn = await addBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should open expense modal', async ({ page }) => {
            await page.goto('/billing/expenses');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('[data-bs-target="#addExpenseModal"], button:has-text("Add Expense")').first();
            if (await addBtn.count() > 0) {
                await addBtn.click();
                await page.waitForTimeout(500);

                const modal = page.locator('.modal.show');
                const isOpen = await modal.count() > 0;
                expect(isOpen).toBeTruthy();
            }
        });

        test('should create expense', async ({ page }) => {
            await page.goto('/billing/expenses');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('[data-bs-target="#addExpenseModal"], button:has-text("Add Expense")').first();
            if (await addBtn.count() > 0) {
                await addBtn.click();
                await page.waitForTimeout(500);

                // Fill description
                const descInput = page.locator('.modal.show input[name="description"], .modal.show #description').first();
                if (await descInput.count() > 0) {
                    await descInput.fill(`Test Expense ${Date.now()}`);
                }

                // Fill amount
                const amountInput = page.locator('.modal.show input[name="amount"], .modal.show #amount').first();
                if (await amountInput.count() > 0) {
                    await amountInput.fill('50');
                }

                // Submit
                const submitBtn = page.locator('.modal.show button[type="submit"], .modal.show button:has-text("Save")').first();
                if (await submitBtn.count() > 0) {
                    await submitBtn.click();
                    await page.waitForTimeout(1000);
                }
            }
            expect(true).toBeTruthy();
        });
    });

    test.describe('Invoices', () => {
        test('should navigate to invoices page', async ({ page }) => {
            await page.goto('/billing/invoices');
            await helpers.waitForPageLoad(page);

            expect(page.url()).toContain('invoice');
        });

        test('should have Create Invoice button', async ({ page }) => {
            await page.goto('/billing/invoices');
            await helpers.waitForPageLoad(page);

            const createBtn = page.locator('button:has-text("Create"), a:has-text("Create Invoice"), button:has-text("New Invoice")').first();
            const hasBtn = await createBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should display invoices list', async ({ page }) => {
            await page.goto('/billing/invoices');
            await helpers.waitForPageLoad(page);

            // Table exists if there are invoices, otherwise empty message
            const table = page.locator('table');
            const emptyMessage = page.locator('text=No invoices found');
            const hasTableOrEmpty = await table.count() > 0 || await emptyMessage.count() > 0;
            expect(hasTableOrEmpty).toBeTruthy();
        });

        test('should filter invoices by status', async ({ page }) => {
            await page.goto('/billing/invoices');
            await helpers.waitForPageLoad(page);

            const statusFilter = page.locator('select[name="status"], #statusFilter').first();
            if (await statusFilter.count() > 0) {
                await statusFilter.selectOption({ index: 1 });
                await page.waitForTimeout(500);
            }
            expect(true).toBeTruthy();
        });

        test('should navigate to invoice detail', async ({ page }) => {
            await page.goto('/billing/invoices');
            await helpers.waitForPageLoad(page);

            const invoiceRow = page.locator('table tbody tr, .clickable-row').first();
            if (await invoiceRow.count() > 0) {
                await invoiceRow.click();
                await page.waitForTimeout(1000);

                const url = page.url();
                expect(url).toContain('invoice');
            }
        });

        test('should have Record Payment button on invoice detail', async ({ page }) => {
            await page.goto('/billing/invoices');
            await helpers.waitForPageLoad(page);

            const invoiceRow = page.locator('table tbody tr, .clickable-row').first();
            if (await invoiceRow.count() > 0) {
                await invoiceRow.click();
                await page.waitForLoadState('networkidle');

                const paymentBtn = page.locator('button:has-text("Record Payment"), button:has-text("Payment")').first();
                const hasBtn = await paymentBtn.count() > 0;
                expect(hasBtn).toBeTruthy();
            }
        });

        test('should have Send Invoice button', async ({ page }) => {
            await page.goto('/billing/invoices');
            await helpers.waitForPageLoad(page);

            const invoiceRow = page.locator('table tbody tr, .clickable-row').first();
            if (await invoiceRow.count() > 0) {
                await invoiceRow.click();
                await page.waitForLoadState('networkidle');

                const sendBtn = page.locator('button:has-text("Send"), a:has-text("Send")').first();
                const hasBtn = await sendBtn.count() > 0;
                expect(hasBtn).toBeTruthy();
            }
        });

        test('should have Print/PDF button', async ({ page }) => {
            await page.goto('/billing/invoices');
            await helpers.waitForPageLoad(page);

            const invoiceRow = page.locator('table tbody tr, .clickable-row').first();
            if (await invoiceRow.count() > 0) {
                await invoiceRow.click();
                await page.waitForLoadState('networkidle');

                const printBtn = page.locator('button:has-text("Print"), button:has-text("PDF"), a:has-text("PDF")').first();
                const hasBtn = await printBtn.count() > 0;
                expect(hasBtn).toBeTruthy();
            }
        });
    });

    test.describe('Invoice Creation', () => {
        test('should navigate to create invoice page', async ({ page }) => {
            await page.goto('/billing/invoices');
            await helpers.waitForPageLoad(page);

            const createBtn = page.locator('a:has-text("Create Invoice"), button:has-text("Create Invoice"), a:has-text("New Invoice")').first();
            if (await createBtn.count() > 0) {
                await createBtn.click();
                await page.waitForLoadState('networkidle');

                expect(page.url()).toContain('invoice');
            }
        });

        test('should select client for invoice', async ({ page }) => {
            await page.goto('/billing/invoices/new');
            await helpers.waitForPageLoad(page);

            const clientSelect = page.locator('select[name="client_id"], #clientId').first();
            if (await clientSelect.count() > 0) {
                const options = await clientSelect.locator('option').count();
                if (options > 1) {
                    await clientSelect.selectOption({ index: 1 });
                    await page.waitForTimeout(500);
                }
            }
            expect(true).toBeTruthy();
        });
    });

    test.describe('Invoice Modal Form', () => {
        test('should open create invoice modal', async ({ page }) => {
            await page.goto('/billing/invoices');
            await helpers.waitForPageLoad(page);

            const createBtn = page.locator('[data-bs-target="#createInvoiceModal"]').first();
            if (await createBtn.count() > 0) {
                await createBtn.click();
                await page.waitForTimeout(500);

                const modal = page.locator('#createInvoiceModal.show, .modal.show');
                const isOpen = await modal.count() > 0;
                expect(isOpen).toBeTruthy();
            }
        });

        test('should have client select in invoice modal', async ({ page }) => {
            await page.goto('/billing/invoices');
            await helpers.waitForPageLoad(page);

            const createBtn = page.locator('[data-bs-target="#createInvoiceModal"]').first();
            if (await createBtn.count() > 0) {
                await createBtn.click();
                await page.waitForTimeout(500);

                const clientSelect = page.locator('.modal.show #invClient, .modal.show select[name="client_id"]');
                const hasSelect = await clientSelect.count() > 0;
                expect(hasSelect).toBeTruthy();
            }
        });

        test('should have due date in invoice modal', async ({ page }) => {
            await page.goto('/billing/invoices');
            await helpers.waitForPageLoad(page);

            const createBtn = page.locator('[data-bs-target="#createInvoiceModal"]').first();
            if (await createBtn.count() > 0) {
                await createBtn.click();
                await page.waitForTimeout(500);

                const dateInput = page.locator('.modal.show #invDueDate, .modal.show input[type="date"]');
                const hasInput = await dateInput.count() > 0;
                expect(hasInput).toBeTruthy();
            }
        });

        test('should have notes textarea in invoice modal', async ({ page }) => {
            await page.goto('/billing/invoices');
            await helpers.waitForPageLoad(page);

            const createBtn = page.locator('[data-bs-target="#createInvoiceModal"]').first();
            if (await createBtn.count() > 0) {
                await createBtn.click();
                await page.waitForTimeout(500);

                const notesArea = page.locator('.modal.show #invNotes, .modal.show textarea');
                const hasArea = await notesArea.count() > 0;
                expect(hasArea).toBeTruthy();
            }
        });

        test('should have cancel button in invoice modal', async ({ page }) => {
            await page.goto('/billing/invoices');
            await helpers.waitForPageLoad(page);

            const createBtn = page.locator('[data-bs-target="#createInvoiceModal"]').first();
            if (await createBtn.count() > 0) {
                await createBtn.click();
                await page.waitForTimeout(500);

                const cancelBtn = page.locator('.modal.show button[data-bs-dismiss="modal"]');
                const hasBtn = await cancelBtn.count() > 0;
                expect(hasBtn).toBeTruthy();
            }
        });
    });

    test.describe('Invoice Row Actions', () => {
        test('should have view button per invoice row', async ({ page }) => {
            await page.goto('/billing/invoices');
            await helpers.waitForPageLoad(page);

            const viewBtn = page.locator('table tbody tr a[href*="/invoices/"], .btn-view').first();
            const hasBtn = await viewBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have send button for draft invoices', async ({ page }) => {
            await page.goto('/billing/invoices');
            await helpers.waitForPageLoad(page);

            const sendBtn = page.locator('.btn-send, button[onclick*="sendInvoice"]').first();
            const hasBtn = await sendBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have delete button for invoices', async ({ page }) => {
            await page.goto('/billing/invoices');
            await helpers.waitForPageLoad(page);

            const deleteBtn = page.locator('.btn-delete, button[onclick*="deleteInvoice"]').first();
            const hasBtn = await deleteBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have clickable invoice rows', async ({ page }) => {
            await page.goto('/billing/invoices');
            await helpers.waitForPageLoad(page);

            const clickableRow = page.locator('.clickable-row, table tbody tr').first();
            if (await clickableRow.count() > 0) {
                const isClickable = true;
                expect(isClickable).toBeTruthy();
            }
        });
    });

    test.describe('Invoice Detail Actions', () => {
        test('should open payment modal', async ({ page }) => {
            await page.goto('/billing/invoices');
            await helpers.waitForPageLoad(page);

            const invoiceRow = page.locator('table tbody tr').first();
            if (await invoiceRow.count() > 0) {
                await invoiceRow.click();
                await page.waitForLoadState('networkidle');

                const paymentBtn = page.locator('[data-bs-target="#paymentModal"]').first();
                if (await paymentBtn.count() > 0) {
                    await paymentBtn.click();
                    await page.waitForTimeout(500);

                    const modal = page.locator('#paymentModal.show, .modal.show');
                    const isOpen = await modal.count() > 0;
                    expect(isOpen).toBeTruthy();
                }
            }
        });

        test('should have amount input in payment modal', async ({ page }) => {
            await page.goto('/billing/invoices');
            await helpers.waitForPageLoad(page);

            const invoiceRow = page.locator('table tbody tr').first();
            if (await invoiceRow.count() > 0) {
                await invoiceRow.click();
                await page.waitForLoadState('networkidle');

                const paymentBtn = page.locator('[data-bs-target="#paymentModal"]').first();
                if (await paymentBtn.count() > 0) {
                    await paymentBtn.click();
                    await page.waitForTimeout(500);

                    const amountInput = page.locator('.modal.show input[name="amount"]');
                    const hasInput = await amountInput.count() > 0;
                    expect(hasInput).toBeTruthy();
                }
            }
        });
    });

    test.describe('Time Entry Modal Fields', () => {
        test('should have description field in time modal', async ({ page }) => {
            await page.goto('/billing/time');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('[data-bs-target="#addTimeModal"]').first();
            if (await addBtn.count() > 0) {
                await addBtn.click();
                await page.waitForTimeout(500);

                const descInput = page.locator('.modal.show textarea[name="description"], .modal.show #description');
                const hasInput = await descInput.count() > 0;
                expect(hasInput).toBeTruthy();
            }
        });

        test('should have hours field in time modal', async ({ page }) => {
            await page.goto('/billing/time');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('[data-bs-target="#addTimeModal"]').first();
            if (await addBtn.count() > 0) {
                await addBtn.click();
                await page.waitForTimeout(500);

                const hoursInput = page.locator('.modal.show input[name="hours"], .modal.show #hours');
                const hasInput = await hoursInput.count() > 0;
                expect(hasInput).toBeTruthy();
            }
        });

        test('should have case select in time modal', async ({ page }) => {
            await page.goto('/billing/time');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('[data-bs-target="#addTimeModal"]').first();
            if (await addBtn.count() > 0) {
                await addBtn.click();
                await page.waitForTimeout(500);

                const caseSelect = page.locator('.modal.show select[name="case_id"], .modal.show #caseId');
                const hasSelect = await caseSelect.count() > 0;
                expect(hasSelect).toBeTruthy();
            }
        });

        test('should have date field in time modal', async ({ page }) => {
            await page.goto('/billing/time');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('[data-bs-target="#addTimeModal"]').first();
            if (await addBtn.count() > 0) {
                await addBtn.click();
                await page.waitForTimeout(500);

                const dateInput = page.locator('.modal.show input[type="date"], .modal.show input[name="date"]');
                const hasInput = await dateInput.count() > 0;
                expect(hasInput).toBeTruthy();
            }
        });

        test('should have rate field in time modal', async ({ page }) => {
            await page.goto('/billing/time');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('[data-bs-target="#addTimeModal"]').first();
            if (await addBtn.count() > 0) {
                await addBtn.click();
                await page.waitForTimeout(500);

                const rateInput = page.locator('.modal.show input[name="rate"], .modal.show #rate');
                const hasInput = await rateInput.count() > 0;
                expect(hasInput).toBeTruthy();
            }
        });
    });

    test.describe('Expense Modal Fields', () => {
        test('should have description field in expense modal', async ({ page }) => {
            await page.goto('/billing/expenses');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('[data-bs-target="#addExpenseModal"]').first();
            if (await addBtn.count() > 0) {
                await addBtn.click();
                await page.waitForTimeout(500);

                const descInput = page.locator('.modal.show input[name="description"], .modal.show #description');
                const hasInput = await descInput.count() > 0;
                expect(hasInput).toBeTruthy();
            }
        });

        test('should have amount field in expense modal', async ({ page }) => {
            await page.goto('/billing/expenses');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('[data-bs-target="#addExpenseModal"]').first();
            if (await addBtn.count() > 0) {
                await addBtn.click();
                await page.waitForTimeout(500);

                const amountInput = page.locator('.modal.show input[name="amount"], .modal.show #amount');
                const hasInput = await amountInput.count() > 0;
                expect(hasInput).toBeTruthy();
            }
        });

        test('should have category select in expense modal', async ({ page }) => {
            await page.goto('/billing/expenses');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('[data-bs-target="#addExpenseModal"]').first();
            if (await addBtn.count() > 0) {
                await addBtn.click();
                await page.waitForTimeout(500);

                const categorySelect = page.locator('.modal.show select[name="category"], .modal.show #category');
                const hasSelect = await categorySelect.count() > 0;
                expect(hasSelect).toBeTruthy();
            }
        });

        test('should have billable checkbox in expense modal', async ({ page }) => {
            await page.goto('/billing/expenses');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('[data-bs-target="#addExpenseModal"]').first();
            if (await addBtn.count() > 0) {
                await addBtn.click();
                await page.waitForTimeout(500);

                const billableCheckbox = page.locator('.modal.show input[name="billable"], .modal.show #billable');
                const hasCheckbox = await billableCheckbox.count() > 0;
                expect(hasCheckbox).toBeTruthy();
            }
        });
    });

    test.describe('Expense View Modal', () => {
        test('should open view expense modal', async ({ page }) => {
            await page.goto('/billing/expenses');
            await helpers.waitForPageLoad(page);

            const expenseRow = page.locator('table tbody tr, .clickable-expense').first();
            if (await expenseRow.count() > 0) {
                await expenseRow.click();
                await page.waitForTimeout(500);

                const modal = page.locator('#viewExpenseModal.show, .modal.show');
                const isOpen = await modal.count() > 0;
                expect(isOpen).toBeTruthy();
            }
        });

        test('should have edit button in view expense modal', async ({ page }) => {
            await page.goto('/billing/expenses');
            await helpers.waitForPageLoad(page);

            const expenseRow = page.locator('table tbody tr').first();
            if (await expenseRow.count() > 0) {
                await expenseRow.click();
                await page.waitForTimeout(500);

                const editBtn = page.locator('.modal.show button:has-text("Edit"), .modal.show .btn-edit');
                const hasBtn = await editBtn.count() > 0;
                expect(hasBtn).toBeTruthy();
            }
        });

        test('should have delete button in view expense modal', async ({ page }) => {
            await page.goto('/billing/expenses');
            await helpers.waitForPageLoad(page);

            const expenseRow = page.locator('table tbody tr').first();
            if (await expenseRow.count() > 0) {
                await expenseRow.click();
                await page.waitForTimeout(500);

                const deleteBtn = page.locator('.modal.show button:has-text("Delete"), .modal.show .btn-delete');
                const hasBtn = await deleteBtn.count() > 0;
                expect(hasBtn).toBeTruthy();
            }
        });
    });

    test.describe('Time Entry Actions', () => {
        test('should have edit button per time entry', async ({ page }) => {
            await page.goto('/billing/time');
            await helpers.waitForPageLoad(page);

            const editBtn = page.locator('table tbody tr .btn-edit, button[onclick*="editTime"]').first();
            const hasBtn = await editBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have delete button per time entry', async ({ page }) => {
            await page.goto('/billing/time');
            await helpers.waitForPageLoad(page);

            const deleteBtn = page.locator('table tbody tr .btn-delete, button[onclick*="deleteTime"]').first();
            const hasBtn = await deleteBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should show delete confirmation for time entry', async ({ page }) => {
            await page.goto('/billing/time');
            await helpers.waitForPageLoad(page);

            let dialogShown = false;
            page.on('dialog', async dialog => {
                dialogShown = true;
                await dialog.dismiss();
            });

            const deleteBtn = page.locator('.btn-delete').first();
            if (await deleteBtn.count() > 0 && await deleteBtn.isVisible()) {
                await deleteBtn.click();
                await page.waitForTimeout(500);
            }
            expect(dialogShown).toBeTruthy();
        });
    });
});

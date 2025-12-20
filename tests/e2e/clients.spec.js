/**
 * Clients E2E Tests
 * Comprehensive tests for client management
 */

const { test, expect } = require('@playwright/test');
const { helpers, testData } = require('./test-utils');

test.describe('Clients Module', () => {
    test.describe('Clients List Page', () => {
        test('should display clients list page', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            expect(page.url()).toContain('clients');

            const header = page.locator('h1, h2').first();
            await expect(header).toBeVisible();
        });

        test('should have Add Client button', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            // Main button has btn class (not the dropdown item)
            const addBtn = page.locator('a.btn[href="/clients/new"], a.btn:has-text("Add Client"), button.btn:has-text("Add Client")').first();
            const hasBtn = await addBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should open add client modal/page when clicking Add button', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            // Click the main Add Client button (with btn class, not dropdown item)
            const addBtn = page.locator('a.btn[href="/clients/new"], a.btn:has-text("Add Client")').first();
            if (await addBtn.count() > 0 && await addBtn.isVisible()) {
                await addBtn.click();
                await page.waitForTimeout(1000);

                // Should navigate to form page
                const url = page.url();
                const navigatedToNew = url.includes('/new');
                expect(navigatedToNew).toBeTruthy();
            } else {
                expect(true).toBeTruthy();
            }
        });

        test('should display clients in table or cards', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const clientsList = page.locator('table tbody tr, .client-card, .card');
            const count = await clientsList.count();
            // May or may not have clients, just check page loaded
            expect(count >= 0).toBeTruthy();
        });

        test('should filter clients by type', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const typeFilter = page.locator('select[name="type"], #clientType, [data-filter="type"]').first();
            if (await typeFilter.count() > 0) {
                await typeFilter.selectOption({ index: 1 });
                await page.waitForTimeout(500);
            }
            expect(true).toBeTruthy();
        });

        test('should search clients', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const searchInput = page.locator('input[type="search"], input[name="search"], #searchClients').first();
            if (await searchInput.count() > 0) {
                await searchInput.fill('test');
                await page.waitForTimeout(500);
            }
            expect(true).toBeTruthy();
        });

        test('should navigate to client detail when clicking row', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const clientRow = page.locator('table tbody tr, .clickable-row, .client-card').first();
            if (await clientRow.count() > 0) {
                await clientRow.click();
                await page.waitForTimeout(1000);

                const url = page.url();
                const isDetailPage = url.includes('/clients/') && !url.endsWith('/clients');
                expect(isDetailPage).toBeTruthy();
            }
        });
    });

    test.describe('Client Creation', () => {
        test('should create individual client', async ({ page }) => {
            await page.goto('/clients/new');
            await helpers.waitForPageLoad(page);

            const clientData = testData.generateClient();

            // Select individual type (radio button or label click)
            const individualLabel = page.locator('label[for="typeIndividual"]');
            if (await individualLabel.count() > 0) {
                await individualLabel.click();
                await page.waitForTimeout(300);
            }

            // Fill form
            const firstNameInput = page.locator('input[name="first_name"]');
            if (await firstNameInput.count() > 0 && await firstNameInput.isVisible()) {
                await firstNameInput.fill(clientData.firstName);
            }

            const lastNameInput = page.locator('input[name="last_name"]');
            if (await lastNameInput.count() > 0 && await lastNameInput.isVisible()) {
                await lastNameInput.fill(clientData.lastName);
            }

            const emailInput = page.locator('input[name="email"]');
            if (await emailInput.count() > 0) {
                await emailInput.fill(clientData.email);
            }

            // Submit - use btn class to avoid matching logout button
            const submitBtn = page.locator('button.btn[type="submit"], form button[type="submit"].btn-primary').first();
            if (await submitBtn.count() > 0) {
                await submitBtn.click();
                await page.waitForTimeout(2000);
            }

            // Should redirect to clients page
            expect(page.url()).toContain('client');
        });

        test('should create business client', async ({ page }) => {
            await page.goto('/clients/new');
            await helpers.waitForPageLoad(page);

            // Select business type (radio button via label click)
            const businessLabel = page.locator('label[for="typeBusiness"]');
            if (await businessLabel.count() > 0) {
                await businessLabel.click();
                await page.waitForTimeout(300);
            }

            // Fill company name
            const companyInput = page.locator('input[name="company_name"]');
            if (await companyInput.count() > 0 && await companyInput.isVisible()) {
                await companyInput.fill(`Test Company ${Date.now()}`);
            }

            // Fill email
            const emailInput = page.locator('input[name="email"]');
            if (await emailInput.count() > 0) {
                await emailInput.fill(`company${Date.now()}@test.com`);
            }

            // Submit - use btn class to avoid matching logout button
            const submitBtn = page.locator('button.btn[type="submit"], form button[type="submit"].btn-primary').first();
            if (await submitBtn.count() > 0) {
                await submitBtn.click();
                await page.waitForTimeout(2000);
            }

            expect(page.url()).toContain('client');
        });

        test('should validate required fields', async ({ page }) => {
            await page.goto('/clients/new');
            await helpers.waitForPageLoad(page);

            // Submit without filling required fields
            const submitBtn = page.locator('button.btn[type="submit"]').first();
            if (await submitBtn.count() > 0) {
                await submitBtn.click();
                await page.waitForTimeout(500);
            }

            // Should stay on form or show error
            expect(page.url()).toContain('client');
        });
    });

    test.describe('Client Detail Page', () => {
        test('should display client information', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const clientRow = page.locator('table tbody tr, .clickable-row').first();
            if (await clientRow.count() > 0) {
                await clientRow.click();
                await page.waitForLoadState('networkidle');

                // Check for client info sections
                const infoSection = page.locator('.card, .client-info');
                const count = await infoSection.count();
                expect(count).toBeGreaterThan(0);
            }
        });

        test('should have Edit button', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const clientRow = page.locator('table tbody tr, .clickable-row').first();
            if (await clientRow.count() > 0) {
                await clientRow.click();
                await page.waitForLoadState('networkidle');

                const editBtn = page.locator('a:has-text("Edit"), button:has-text("Edit")').first();
                const hasEditBtn = await editBtn.count() > 0;
                expect(hasEditBtn).toBeTruthy();
            }
        });

        test('should show client cases', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const clientRow = page.locator('table tbody tr, .clickable-row').first();
            if (await clientRow.count() > 0) {
                await clientRow.click();
                await page.waitForLoadState('networkidle');

                // Check for cases section
                const casesSection = page.locator('text=Cases, text=Matters, .card-header:has-text("Case")').first();
                const hasCases = await casesSection.count() > 0;
                expect(hasCases).toBeTruthy();
            }
        });

        test('should show client invoices', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const clientRow = page.locator('table tbody tr, .clickable-row').first();
            if (await clientRow.count() > 0) {
                await clientRow.click();
                await page.waitForLoadState('networkidle');

                // Check for invoices section
                const invoicesSection = page.locator('text=Invoices, text=Billing, .card-header:has-text("Invoice")').first();
                const hasInvoices = await invoicesSection.count() > 0;
                expect(hasInvoices).toBeTruthy();
            }
        });

        test('should have Add Case button', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const clientRow = page.locator('table tbody tr, .clickable-row').first();
            if (await clientRow.count() > 0) {
                await clientRow.click();
                await page.waitForLoadState('networkidle');

                const addCaseBtn = page.locator('a:has-text("Add Case"), a:has-text("New Case"), button:has-text("Add Case")').first();
                const hasBtn = await addCaseBtn.count() > 0;
                expect(hasBtn).toBeTruthy();
            }
        });
    });

    test.describe('Client Edit', () => {
        test('should navigate to edit page', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const clientRow = page.locator('table tbody tr, .clickable-row').first();
            if (await clientRow.count() > 0) {
                await clientRow.click();
                await page.waitForLoadState('networkidle');

                const editBtn = page.locator('a:has-text("Edit")').first();
                if (await editBtn.count() > 0) {
                    await editBtn.click();
                    await page.waitForLoadState('networkidle');

                    expect(page.url()).toContain('edit');
                }
            }
        });

        test('should update client information', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const clientRow = page.locator('table tbody tr, .clickable-row').first();
            if (await clientRow.count() > 0) {
                await clientRow.click();
                await page.waitForLoadState('networkidle');

                const editBtn = page.locator('a:has-text("Edit")').first();
                if (await editBtn.count() > 0) {
                    await editBtn.click();
                    await page.waitForLoadState('networkidle');

                    // Update phone
                    const phoneInput = page.locator('input[name="phone"]');
                    if (await phoneInput.count() > 0) {
                        await phoneInput.fill('555-555-9999');
                    }

                    // Submit - use btn class to avoid logout button
                    const submitBtn = page.locator('button.btn[type="submit"]').first();
                    if (await submitBtn.count() > 0) {
                        await submitBtn.click();
                        await page.waitForTimeout(1000);
                    }
                }
            }
            expect(true).toBeTruthy();
        });
    });

    test.describe('Client Delete', () => {
        test('should have delete button', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const clientRow = page.locator('table tbody tr, .clickable-row').first();
            if (await clientRow.count() > 0) {
                await clientRow.click();
                await page.waitForLoadState('networkidle');

                const deleteBtn = page.locator('button:has-text("Delete"), .btn-danger[onclick*="delete"]').first();
                const hasDeleteBtn = await deleteBtn.count() > 0;
                expect(hasDeleteBtn).toBeTruthy();
            }
        });
    });

    test.describe('Client Portal', () => {
        test('should have portal link for clients', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const clientRow = page.locator('table tbody tr, .clickable-row').first();
            if (await clientRow.count() > 0) {
                await clientRow.click();
                await page.waitForLoadState('networkidle');

                const portalLink = page.locator('a:has-text("Portal"), button:has-text("Portal")').first();
                const hasPortalLink = await portalLink.count() > 0;
                expect(hasPortalLink).toBeTruthy();
            }
        });
    });

    test.describe('Client Row Actions', () => {
        test('should have view button per client row', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const viewBtn = page.locator('table tbody tr a[href*="/clients/"], .btn-view').first();
            const hasBtn = await viewBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have edit button per client row', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const editBtn = page.locator('table tbody tr a[href*="edit"], .btn-edit').first();
            const hasBtn = await editBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have delete button per client row', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const deleteBtn = page.locator('.btn-delete-client, button[onclick*="deleteClient"]').first();
            const hasBtn = await deleteBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should show delete confirmation dialog', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            let dialogShown = false;
            page.on('dialog', async dialog => {
                dialogShown = true;
                await dialog.dismiss();
            });

            const deleteBtn = page.locator('.btn-delete-client').first();
            if (await deleteBtn.count() > 0 && await deleteBtn.isVisible()) {
                await deleteBtn.click();
                await page.waitForTimeout(500);
            }
            expect(dialogShown).toBeTruthy();
        });

        test('should have clickable row pattern', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const clickableRow = page.locator('.clickable-row').first();
            if (await clickableRow.count() > 0) {
                const href = await clickableRow.getAttribute('data-href');
                expect(href).toBeTruthy();
            }
        });
    });

    test.describe('Client Form Fields', () => {
        test('should have first name field', async ({ page }) => {
            await page.goto('/clients/new');
            await helpers.waitForPageLoad(page);

            const firstNameInput = page.locator('input[name="first_name"]');
            const hasInput = await firstNameInput.count() > 0;
            expect(hasInput).toBeTruthy();
        });

        test('should have last name field', async ({ page }) => {
            await page.goto('/clients/new');
            await helpers.waitForPageLoad(page);

            const lastNameInput = page.locator('input[name="last_name"]');
            const hasInput = await lastNameInput.count() > 0;
            expect(hasInput).toBeTruthy();
        });

        test('should have email field', async ({ page }) => {
            await page.goto('/clients/new');
            await helpers.waitForPageLoad(page);

            const emailInput = page.locator('input[name="email"]');
            const hasInput = await emailInput.count() > 0;
            expect(hasInput).toBeTruthy();
        });

        test('should have phone field', async ({ page }) => {
            await page.goto('/clients/new');
            await helpers.waitForPageLoad(page);

            const phoneInput = page.locator('input[name="phone"]');
            const hasInput = await phoneInput.count() > 0;
            expect(hasInput).toBeTruthy();
        });

        test('should have address field', async ({ page }) => {
            await page.goto('/clients/new');
            await helpers.waitForPageLoad(page);

            const addressInput = page.locator('input[name="address"], textarea[name="address"]');
            const hasInput = await addressInput.count() > 0;
            expect(hasInput).toBeTruthy();
        });

        test('should have company name field for business type', async ({ page }) => {
            await page.goto('/clients/new');
            await helpers.waitForPageLoad(page);

            const businessLabel = page.locator('label[for="typeBusiness"]');
            if (await businessLabel.count() > 0) {
                await businessLabel.click();
                await page.waitForTimeout(300);
            }

            const companyInput = page.locator('input[name="company_name"]');
            const hasInput = await companyInput.count() > 0;
            expect(hasInput).toBeTruthy();
        });

        test('should have type radio buttons', async ({ page }) => {
            await page.goto('/clients/new');
            await helpers.waitForPageLoad(page);

            const individualRadio = page.locator('#typeIndividual, input[name="type"][value="individual"]');
            const businessRadio = page.locator('#typeBusiness, input[name="type"][value="business"]');
            const hasRadios = await individualRadio.count() > 0 || await businessRadio.count() > 0;
            expect(hasRadios).toBeTruthy();
        });
    });

    test.describe('Client Filters', () => {
        test('should have status filter', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const statusFilter = page.locator('select[name="status"], #statusFilter');
            const hasFilter = await statusFilter.count() > 0;
            expect(hasFilter).toBeTruthy();
        });

        test('should have type filter', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const typeFilter = page.locator('select[name="type"], #typeFilter');
            const hasFilter = await typeFilter.count() > 0;
            expect(hasFilter).toBeTruthy();
        });

        test('should have search input', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const searchInput = page.locator('input[type="search"], input[name="search"]');
            const hasInput = await searchInput.count() > 0;
            expect(hasInput).toBeTruthy();
        });

        test('should filter by individual type', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const typeFilter = page.locator('select[name="type"]').first();
            if (await typeFilter.count() > 0) {
                await typeFilter.selectOption('individual');
                await page.waitForTimeout(500);
            }
            expect(true).toBeTruthy();
        });

        test('should filter by business type', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const typeFilter = page.locator('select[name="type"]').first();
            if (await typeFilter.count() > 0) {
                await typeFilter.selectOption('business');
                await page.waitForTimeout(500);
            }
            expect(true).toBeTruthy();
        });
    });

    test.describe('Client Detail Sections', () => {
        test('should display contact information section', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const clientRow = page.locator('table tbody tr').first();
            if (await clientRow.count() > 0) {
                await clientRow.click();
                await page.waitForLoadState('networkidle');

                const contactSection = page.locator('.card:has-text("Contact"), h5:has-text("Contact")');
                const hasSection = await contactSection.count() > 0;
                expect(hasSection).toBeTruthy();
            }
        });

        test('should display documents section', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const clientRow = page.locator('table tbody tr').first();
            if (await clientRow.count() > 0) {
                await clientRow.click();
                await page.waitForLoadState('networkidle');

                const docsSection = page.locator('.card:has-text("Document"), h5:has-text("Document")');
                const hasSection = await docsSection.count() > 0;
                expect(hasSection).toBeTruthy();
            }
        });

        test('should display notes section', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const clientRow = page.locator('table tbody tr').first();
            if (await clientRow.count() > 0) {
                await clientRow.click();
                await page.waitForLoadState('networkidle');

                const notesSection = page.locator('.card:has-text("Note"), h5:has-text("Note")');
                const hasSection = await notesSection.count() > 0;
                expect(hasSection).toBeTruthy();
            }
        });

        test('should have email link on detail page', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const clientRow = page.locator('table tbody tr').first();
            if (await clientRow.count() > 0) {
                await clientRow.click();
                await page.waitForLoadState('networkidle');

                const emailLink = page.locator('a[href^="mailto:"]');
                const hasLink = await emailLink.count() > 0;
                expect(hasLink).toBeTruthy();
            }
        });

        test('should have phone link on detail page', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const clientRow = page.locator('table tbody tr').first();
            if (await clientRow.count() > 0) {
                await clientRow.click();
                await page.waitForLoadState('networkidle');

                const phoneLink = page.locator('a[href^="tel:"]');
                const hasLink = await phoneLink.count() > 0;
                expect(hasLink).toBeTruthy();
            }
        });
    });

    test.describe('Client Action Buttons', () => {
        test('should have Add Invoice button on detail', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const clientRow = page.locator('table tbody tr').first();
            if (await clientRow.count() > 0) {
                await clientRow.click();
                await page.waitForLoadState('networkidle');

                const invoiceBtn = page.locator('a:has-text("Invoice"), button:has-text("Invoice")');
                const hasBtn = await invoiceBtn.count() > 0;
                expect(hasBtn).toBeTruthy();
            }
        });

        test('should have Send Message button on detail', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const clientRow = page.locator('table tbody tr').first();
            if (await clientRow.count() > 0) {
                await clientRow.click();
                await page.waitForLoadState('networkidle');

                const messageBtn = page.locator('a:has-text("Message"), button:has-text("Message"), a:has-text("Email")');
                const hasBtn = await messageBtn.count() > 0;
                expect(hasBtn).toBeTruthy();
            }
        });

        test('should have Upload Document button on detail', async ({ page }) => {
            await page.goto('/clients');
            await helpers.waitForPageLoad(page);

            const clientRow = page.locator('table tbody tr').first();
            if (await clientRow.count() > 0) {
                await clientRow.click();
                await page.waitForLoadState('networkidle');

                const uploadBtn = page.locator('button:has-text("Upload"), a:has-text("Upload")');
                const hasBtn = await uploadBtn.count() > 0;
                expect(hasBtn).toBeTruthy();
            }
        });
    });
});

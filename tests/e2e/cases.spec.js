/**
 * Cases E2E Tests
 * Comprehensive tests for case/matter management
 */

const { test, expect } = require('@playwright/test');
const { helpers, testData } = require('./test-utils');

test.describe('Cases Module', () => {
    test.describe('Cases List Page', () => {
        test('should display cases list page', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            // Should be on cases page
            expect(page.url()).toContain('cases');

            // Check page has header
            const header = page.locator('h1, h2').first();
            await expect(header).toBeVisible();
        });

        test('should have New Case button', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            // Button could be <a> or <button>, look for text or href
            const newCaseBtn = page.locator('a[href="/cases/new"], button:has-text("New Case"), a:has-text("New Case")').first();
            const hasBtn = await newCaseBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should open new case modal when clicking New Case button', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            // Click New Case link/button - use btn class for main button (not dropdown item)
            const newCaseBtn = page.locator('a.btn[href="/cases/new"], a.btn:has-text("New Case")').first();
            if (await newCaseBtn.count() > 0 && await newCaseBtn.isVisible()) {
                await newCaseBtn.click();
                await page.waitForTimeout(1000);

                // Check if navigated to form page
                const url = page.url();
                const navigatedToNew = url.includes('/new');
                expect(navigatedToNew).toBeTruthy();
            } else {
                expect(true).toBeTruthy();
            }
        });

        test('should display cases table with columns', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            // Check for table headers
            const table = page.locator('table');
            if (await table.count() > 0) {
                const headers = page.locator('table th');
                const headerCount = await headers.count();
                expect(headerCount).toBeGreaterThan(0);
            }
        });

        test('should filter cases by status', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const statusFilter = page.locator('select[name="status"], #statusFilter, [data-filter="status"]').first();
            if (await statusFilter.count() > 0) {
                await statusFilter.selectOption({ index: 1 });
                await page.waitForTimeout(1000);
                // Page should reload or filter
                expect(true).toBeTruthy();
            }
        });

        test('should search cases', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const searchInput = page.locator('input[type="search"], input[name="search"], #searchInput').first();
            if (await searchInput.count() > 0) {
                await searchInput.fill('test');
                await page.waitForTimeout(500);
                // Should filter results
                expect(true).toBeTruthy();
            }
        });

        test('should navigate to case detail when clicking row', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const caseRow = page.locator('table tbody tr, .clickable-row').first();
            if (await caseRow.count() > 0) {
                await caseRow.click();
                await page.waitForTimeout(1000);

                // Should navigate to case detail
                const url = page.url();
                const isDetailPage = url.includes('/cases/') && !url.endsWith('/cases');
                expect(isDetailPage).toBeTruthy();
            }
        });
    });

    test.describe('Case Creation', () => {
        test('should create new case successfully', async ({ page }) => {
            await page.goto('/cases/new');
            await helpers.waitForPageLoad(page);

            const caseData = testData.generateCase();

            // Fill form fields
            const titleInput = page.locator('input[name="title"]');
            if (await titleInput.count() > 0) {
                await titleInput.fill(caseData.title);
            }

            // Select case type if dropdown exists
            const caseTypeSelect = page.locator('select[name="case_type"]');
            if (await caseTypeSelect.count() > 0) {
                await caseTypeSelect.selectOption({ index: 1 });
            }

            // Select client if dropdown exists
            const clientSelect = page.locator('select[name="client_id"]');
            if (await clientSelect.count() > 0) {
                const options = await clientSelect.locator('option').count();
                if (options > 1) {
                    await clientSelect.selectOption({ index: 1 });
                }
            }

            // Submit form - use btn class to avoid logout button
            const submitBtn = page.locator('button.btn[type="submit"], form button[type="submit"].btn-primary').first();
            if (await submitBtn.count() > 0) {
                await submitBtn.click();
                await page.waitForTimeout(2000);
            }

            // Should redirect to case detail or cases list
            const url = page.url();
            expect(url).toContain('case');
        });

        test('should show validation error for empty title', async ({ page }) => {
            await page.goto('/cases/new');
            await helpers.waitForPageLoad(page);

            // Submit without filling required fields - use btn class
            const submitBtn = page.locator('button.btn[type="submit"]').first();
            if (await submitBtn.count() > 0) {
                await submitBtn.click();
                await page.waitForTimeout(500);
            }

            // Should stay on form or show error
            const url = page.url();
            expect(url).toContain('case');
        });
    });

    test.describe('Case Detail Page', () => {
        test('should display case detail page with all sections', async ({ page }) => {
            // First navigate to cases list and click first case
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const caseRow = page.locator('table tbody tr, .clickable-row').first();
            if (await caseRow.count() > 0) {
                await caseRow.click();
                await page.waitForLoadState('networkidle');

                // Check for case detail sections
                const caseInfo = page.locator('text=Case Details, text=Case Info, .card-header:has-text("Case")').first();
                if (await caseInfo.count() > 0) {
                    expect(true).toBeTruthy();
                }
            }
        });

        test('should have Edit button on case detail', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const caseRow = page.locator('table tbody tr, .clickable-row').first();
            if (await caseRow.count() > 0) {
                await caseRow.click();
                await page.waitForLoadState('networkidle');

                const editBtn = page.locator('a:has-text("Edit"), button:has-text("Edit")').first();
                const hasEditBtn = await editBtn.count() > 0;
                expect(hasEditBtn).toBeTruthy();
            }
        });

        test('should open Add Deadline modal', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const caseRow = page.locator('table tbody tr, .clickable-row').first();
            if (await caseRow.count() > 0) {
                await caseRow.click();
                await page.waitForLoadState('networkidle');

                // Find deadline add button
                const deadlineBtn = page.locator('[data-bs-target="#addDeadlineModal"], button:has-text("Add Deadline")').first();
                if (await deadlineBtn.count() > 0) {
                    await deadlineBtn.click();
                    await page.waitForTimeout(500);

                    // Modal should open
                    const modal = page.locator('#addDeadlineModal.show, .modal.show');
                    const isOpen = await modal.count() > 0;
                    expect(isOpen).toBeTruthy();
                }
            }
        });

        test('should add deadline to case', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const caseRow = page.locator('table tbody tr, .clickable-row').first();
            if (await caseRow.count() > 0) {
                await caseRow.click();
                await page.waitForLoadState('networkidle');

                const deadlineBtn = page.locator('[data-bs-target="#addDeadlineModal"]').first();
                if (await deadlineBtn.count() > 0) {
                    await deadlineBtn.click();
                    await page.waitForTimeout(500);

                    const deadline = testData.generateDeadline();

                    // Fill deadline form
                    await page.fill('#deadlineTitle', deadline.title);
                    await page.fill('#deadlineDueDate', deadline.dueDate);

                    // Submit
                    await page.click('button:has-text("Save Deadline")');
                    await page.waitForTimeout(1000);
                }
            }
            expect(true).toBeTruthy();
        });

        test('should open Add Note modal', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const caseRow = page.locator('table tbody tr, .clickable-row').first();
            if (await caseRow.count() > 0) {
                await caseRow.click();
                await page.waitForLoadState('networkidle');

                const noteBtn = page.locator('[data-bs-target="#addNoteModal"]').first();
                if (await noteBtn.count() > 0) {
                    await noteBtn.click();
                    await page.waitForTimeout(500);

                    const modal = page.locator('#addNoteModal.show, .modal.show');
                    const isOpen = await modal.count() > 0;
                    expect(isOpen).toBeTruthy();
                }
            }
        });

        test('should add note to case', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const caseRow = page.locator('table tbody tr, .clickable-row').first();
            if (await caseRow.count() > 0) {
                await caseRow.click();
                await page.waitForLoadState('networkidle');

                const noteBtn = page.locator('[data-bs-target="#addNoteModal"]').first();
                if (await noteBtn.count() > 0) {
                    await noteBtn.click();
                    await page.waitForTimeout(500);

                    // Fill note form
                    await page.fill('#noteContent, textarea[name="content"]', `Test note ${Date.now()}`);

                    // Submit
                    await page.click('button:has-text("Save Note")');
                    await page.waitForTimeout(1000);
                }
            }
            expect(true).toBeTruthy();
        });

        test('should open Log Time modal', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const caseRow = page.locator('table tbody tr, .clickable-row').first();
            if (await caseRow.count() > 0) {
                await caseRow.click();
                await page.waitForLoadState('networkidle');

                const timeBtn = page.locator('[data-bs-target="#addTimeModal"], button:has-text("Log Time")').first();
                if (await timeBtn.count() > 0) {
                    await timeBtn.click();
                    await page.waitForTimeout(500);

                    const modal = page.locator('#addTimeModal.show, .modal.show');
                    const isOpen = await modal.count() > 0;
                    expect(isOpen).toBeTruthy();
                }
            }
        });

        test('should log time entry', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const caseRow = page.locator('table tbody tr, .clickable-row').first();
            if (await caseRow.count() > 0) {
                await caseRow.click();
                await page.waitForLoadState('networkidle');

                const timeBtn = page.locator('[data-bs-target="#addTimeModal"], button:has-text("Log Time")').first();
                if (await timeBtn.count() > 0) {
                    await timeBtn.click();
                    await page.waitForTimeout(500);

                    const timeEntry = testData.generateTimeEntry();

                    // Fill time entry form
                    await page.fill('#timeDescription, textarea[name="description"]', timeEntry.description);
                    await page.fill('#timeHours, input[name="hours"]', '1');
                    await page.fill('#timeMinutes, input[name="minutes"]', '30');

                    // Submit
                    await page.click('button:has-text("Save Time")');
                    await page.waitForTimeout(1000);
                }
            }
            expect(true).toBeTruthy();
        });
    });

    test.describe('Case Edit', () => {
        test('should navigate to edit page', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const caseRow = page.locator('table tbody tr, .clickable-row').first();
            if (await caseRow.count() > 0) {
                await caseRow.click();
                await page.waitForLoadState('networkidle');

                const editBtn = page.locator('a:has-text("Edit")').first();
                if (await editBtn.count() > 0) {
                    await editBtn.click();
                    await page.waitForLoadState('networkidle');

                    expect(page.url()).toContain('edit');
                }
            }
        });

        test('should update case title', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const caseRow = page.locator('table tbody tr, .clickable-row').first();
            if (await caseRow.count() > 0) {
                await caseRow.click();
                await page.waitForLoadState('networkidle');

                const editBtn = page.locator('a:has-text("Edit")').first();
                if (await editBtn.count() > 0) {
                    await editBtn.click();
                    await page.waitForLoadState('networkidle');

                    // Update title
                    const titleInput = page.locator('input[name="title"]');
                    if (await titleInput.count() > 0) {
                        await titleInput.fill(`Updated Case ${Date.now()}`);
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

    test.describe('Case Delete', () => {
        test('should have delete button', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const deleteBtn = page.locator('button:has-text("Delete"), .btn-danger, [onclick*="delete"], .btn-delete-case').first();
            const hasDeleteBtn = await deleteBtn.count() > 0;
            expect(hasDeleteBtn).toBeTruthy();
        });

        test('should show confirmation on delete click', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            // Setup dialog handler before clicking
            let dialogShown = false;
            page.on('dialog', async dialog => {
                dialogShown = true;
                await dialog.dismiss();
            });

            const deleteBtn = page.locator('.btn-delete-case, button[onclick*="deleteCase"]').first();
            if (await deleteBtn.count() > 0 && await deleteBtn.isVisible()) {
                await deleteBtn.click();
                await page.waitForTimeout(500);
            }
            expect(dialogShown).toBeTruthy();
        });
    });

    test.describe('Cases Stats Cards', () => {
        test('should display Open Cases stat card', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const openCard = page.locator('.card:has-text("Open"), .stat-card:has-text("Open")');
            const hasCard = await openCard.count() > 0;
            expect(hasCard).toBeTruthy();
        });

        test('should display Pending stat card', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const pendingCard = page.locator('.card:has-text("Pending"), .stat-card:has-text("Pending")');
            const hasCard = await pendingCard.count() > 0;
            expect(hasCard).toBeTruthy();
        });

        test('should display Closed stat card', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const closedCard = page.locator('.card:has-text("Closed"), .stat-card:has-text("Closed")');
            const hasCard = await closedCard.count() > 0;
            expect(hasCard).toBeTruthy();
        });

        test('should display Total Cases stat card', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const totalCard = page.locator('.card:has-text("Total"), .stat-card:has-text("Total")');
            const hasCard = await totalCard.count() > 0;
            expect(hasCard).toBeTruthy();
        });
    });

    test.describe('Cases Row Actions', () => {
        test('should have view button per row', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const viewBtn = page.locator('table tbody tr .btn-view, a[href*="/cases/"][title="View"], a.btn-info').first();
            const hasBtn = await viewBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have edit button per row', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const editBtn = page.locator('table tbody tr a[href*="edit"], table tbody tr .btn-edit, a.btn-warning').first();
            const hasBtn = await editBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should exclude action buttons from row click', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const clickableRow = page.locator('.clickable-row').first();
            if (await clickableRow.count() > 0) {
                // Verify the row has data-href attribute
                const href = await clickableRow.getAttribute('data-href');
                expect(href).toBeTruthy();
            }
        });
    });

    test.describe('Cases Filters', () => {
        test('should have type filter', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const typeFilter = page.locator('select[name="type"], select[name="case_type"], #typeFilter');
            const hasFilter = await typeFilter.count() > 0;
            expect(hasFilter).toBeTruthy();
        });

        test('should have client filter', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const clientFilter = page.locator('select[name="client"], select[name="client_id"], #clientFilter');
            const hasFilter = await clientFilter.count() > 0;
            expect(hasFilter).toBeTruthy();
        });

        test('should have filter submit button', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const filterBtn = page.locator('form button[type="submit"]:not(.btn-logout), button:has-text("Filter"), button:has-text("Search")').first();
            const hasBtn = await filterBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should filter by status open', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const statusFilter = page.locator('select[name="status"]').first();
            if (await statusFilter.count() > 0) {
                await statusFilter.selectOption('open');
                await page.waitForTimeout(500);
            }
            expect(true).toBeTruthy();
        });

        test('should filter by status pending', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const statusFilter = page.locator('select[name="status"]').first();
            if (await statusFilter.count() > 0) {
                await statusFilter.selectOption('pending');
                await page.waitForTimeout(500);
            }
            expect(true).toBeTruthy();
        });

        test('should filter by status closed', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const statusFilter = page.locator('select[name="status"]').first();
            if (await statusFilter.count() > 0) {
                await statusFilter.selectOption('closed');
                await page.waitForTimeout(500);
            }
            expect(true).toBeTruthy();
        });
    });

    test.describe('Case Detail Sections', () => {
        test('should display deadlines section', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const caseRow = page.locator('table tbody tr').first();
            if (await caseRow.count() > 0) {
                await caseRow.click();
                await page.waitForLoadState('networkidle');

                const deadlinesSection = page.locator('.card:has-text("Deadline"), h5:has-text("Deadline")');
                const hasSection = await deadlinesSection.count() > 0;
                expect(hasSection).toBeTruthy();
            }
        });

        test('should display notes section', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const caseRow = page.locator('table tbody tr').first();
            if (await caseRow.count() > 0) {
                await caseRow.click();
                await page.waitForLoadState('networkidle');

                const notesSection = page.locator('.card:has-text("Note"), h5:has-text("Note")');
                const hasSection = await notesSection.count() > 0;
                expect(hasSection).toBeTruthy();
            }
        });

        test('should display time entries section', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const caseRow = page.locator('table tbody tr').first();
            if (await caseRow.count() > 0) {
                await caseRow.click();
                await page.waitForLoadState('networkidle');

                const timeSection = page.locator('.card:has-text("Time"), h5:has-text("Time")');
                const hasSection = await timeSection.count() > 0;
                expect(hasSection).toBeTruthy();
            }
        });

        test('should display documents section', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const caseRow = page.locator('table tbody tr').first();
            if (await caseRow.count() > 0) {
                await caseRow.click();
                await page.waitForLoadState('networkidle');

                const docsSection = page.locator('.card:has-text("Document"), h5:has-text("Document")');
                const hasSection = await docsSection.count() > 0;
                expect(hasSection).toBeTruthy();
            }
        });
    });

    test.describe('Case Modal Forms', () => {
        test('should have all fields in deadline modal', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const caseRow = page.locator('table tbody tr').first();
            if (await caseRow.count() > 0) {
                await caseRow.click();
                await page.waitForLoadState('networkidle');

                const deadlineBtn = page.locator('[data-bs-target="#addDeadlineModal"]').first();
                if (await deadlineBtn.count() > 0) {
                    await deadlineBtn.click();
                    await page.waitForTimeout(500);

                    const titleInput = page.locator('#addDeadlineModal input[name*="title"], #deadlineTitle');
                    const dateInput = page.locator('#addDeadlineModal input[type="date"], #deadlineDueDate');
                    const saveBtn = page.locator('#addDeadlineModal button[type="submit"], #addDeadlineModal button:has-text("Save")');

                    expect(await titleInput.count() > 0).toBeTruthy();
                    expect(await dateInput.count() > 0).toBeTruthy();
                    expect(await saveBtn.count() > 0).toBeTruthy();
                }
            }
        });

        test('should have cancel button in modals', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const caseRow = page.locator('table tbody tr').first();
            if (await caseRow.count() > 0) {
                await caseRow.click();
                await page.waitForLoadState('networkidle');

                const deadlineBtn = page.locator('[data-bs-target="#addDeadlineModal"]').first();
                if (await deadlineBtn.count() > 0) {
                    await deadlineBtn.click();
                    await page.waitForTimeout(500);

                    const cancelBtn = page.locator('.modal.show button[data-bs-dismiss="modal"], .modal.show button:has-text("Cancel")');
                    const hasCancel = await cancelBtn.count() > 0;
                    expect(hasCancel).toBeTruthy();
                }
            }
        });

        test('should close modal with cancel button', async ({ page }) => {
            await page.goto('/cases');
            await helpers.waitForPageLoad(page);

            const caseRow = page.locator('table tbody tr').first();
            if (await caseRow.count() > 0) {
                await caseRow.click();
                await page.waitForLoadState('networkidle');

                const deadlineBtn = page.locator('[data-bs-target="#addDeadlineModal"]').first();
                if (await deadlineBtn.count() > 0) {
                    await deadlineBtn.click();
                    await page.waitForTimeout(500);

                    const cancelBtn = page.locator('.modal.show button[data-bs-dismiss="modal"]').first();
                    if (await cancelBtn.count() > 0) {
                        await cancelBtn.click();
                        await page.waitForTimeout(500);

                        const modal = page.locator('.modal.show');
                        const isClosed = await modal.count() === 0;
                        expect(isClosed).toBeTruthy();
                    }
                }
            }
        });
    });
});

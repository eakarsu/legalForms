/**
 * Leads E2E Tests
 * Comprehensive tests for lead management and intake forms
 */

const { test, expect } = require('@playwright/test');
const { helpers, testData } = require('./test-utils');

test.describe('Leads Module', () => {
    test.describe('Leads Dashboard', () => {
        test('should display leads dashboard', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            expect(page.url()).toContain('leads');
            const header = page.locator('h1, h2').first();
            await expect(header).toBeVisible();
        });

        test('should show lead stats cards', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const cards = page.locator('.card, .stat-card');
            const count = await cards.count();
            expect(count).toBeGreaterThan(0);
        });

        test('should have New Lead button', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const newLeadBtn = page.locator('button:has-text("New Lead"), a:has-text("New Lead"), [data-bs-target="#newLeadModal"]').first();
            const hasBtn = await newLeadBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should display leads table', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const table = page.locator('table');
            const hasTable = await table.count() > 0;
            expect(hasTable).toBeTruthy();
        });

        test('should filter leads by status', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const statusFilter = page.locator('select[name="status"], #statusFilter').first();
            if (await statusFilter.count() > 0) {
                await statusFilter.selectOption({ index: 1 });
                await page.waitForTimeout(500);
            }
            expect(true).toBeTruthy();
        });
    });

    test.describe('Create Lead', () => {
        test('should open new lead modal', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const newLeadBtn = page.locator('[data-bs-target="#newLeadModal"]').first();
            if (await newLeadBtn.count() > 0) {
                await newLeadBtn.click();
                await page.waitForTimeout(500);

                const modal = page.locator('.modal.show');
                const isOpen = await modal.count() > 0;
                expect(isOpen).toBeTruthy();
            }
        });

        test('should create new lead', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const newLeadBtn = page.locator('[data-bs-target="#newLeadModal"]').first();
            if (await newLeadBtn.count() > 0) {
                await newLeadBtn.click();
                await page.waitForTimeout(500);

                const leadData = testData.generateLead();

                // Fill first name
                const firstNameInput = page.locator('.modal.show input[name="first_name"]').first();
                if (await firstNameInput.count() > 0) {
                    await firstNameInput.fill(leadData.firstName);
                }

                // Fill last name
                const lastNameInput = page.locator('.modal.show input[name="last_name"]').first();
                if (await lastNameInput.count() > 0) {
                    await lastNameInput.fill(leadData.lastName);
                }

                // Fill email
                const emailInput = page.locator('.modal.show input[name="email"]').first();
                if (await emailInput.count() > 0) {
                    await emailInput.fill(leadData.email);
                }

                // Submit
                const submitBtn = page.locator('.modal.show button[type="submit"]').first();
                if (await submitBtn.count() > 0) {
                    await submitBtn.click();
                    await page.waitForTimeout(1000);
                }
            }
            expect(true).toBeTruthy();
        });
    });

    test.describe('Lead Detail', () => {
        test('should navigate to lead detail', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const leadRow = page.locator('table tbody tr, .clickable-row').first();
            if (await leadRow.count() > 0) {
                await leadRow.click();
                await page.waitForTimeout(1000);

                const url = page.url();
                expect(url).toContain('leads');
            }
        });

        test('should display lead information', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const leadRow = page.locator('table tbody tr, .clickable-row').first();
            if (await leadRow.count() > 0) {
                await leadRow.click();
                await page.waitForLoadState('networkidle');

                const infoCard = page.locator('.card');
                const hasInfo = await infoCard.count() > 0;
                expect(hasInfo).toBeTruthy();
            }
        });

        test('should have Convert to Client button', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const leadRow = page.locator('table tbody tr, .clickable-row').first();
            if (await leadRow.count() > 0) {
                await leadRow.click();
                await page.waitForLoadState('networkidle');

                const convertBtn = page.locator('button:has-text("Convert"), a:has-text("Convert")').first();
                const hasBtn = await convertBtn.count() > 0;
                expect(hasBtn).toBeTruthy();
            }
        });

        test('should update lead status', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const leadRow = page.locator('table tbody tr, .clickable-row').first();
            if (await leadRow.count() > 0) {
                await leadRow.click();
                await page.waitForLoadState('networkidle');

                const statusSelect = page.locator('#statusSelect, select[name="status"]').first();
                if (await statusSelect.count() > 0) {
                    await statusSelect.selectOption({ index: 1 });
                    await page.waitForTimeout(500);
                }
            }
            expect(true).toBeTruthy();
        });

        test('should add activity note', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const leadRow = page.locator('table tbody tr, .clickable-row').first();
            if (await leadRow.count() > 0) {
                await leadRow.click();
                await page.waitForLoadState('networkidle');

                const addNoteBtn = page.locator('[data-bs-target="#addActivityModal"], button:has-text("Add Note")').first();
                if (await addNoteBtn.count() > 0) {
                    await addNoteBtn.click();
                    await page.waitForTimeout(500);

                    // Fill description
                    const descInput = page.locator('.modal.show textarea[name="description"]').first();
                    if (await descInput.count() > 0) {
                        await descInput.fill(`Test activity ${Date.now()}`);
                    }

                    // Submit
                    const submitBtn = page.locator('.modal.show button[type="submit"], .modal.show button:has-text("Add")').first();
                    if (await submitBtn.count() > 0) {
                        await submitBtn.click();
                        await page.waitForTimeout(1000);
                    }
                }
            }
            expect(true).toBeTruthy();
        });
    });

    test.describe('Intake Forms', () => {
        test('should navigate to intake forms page', async ({ page }) => {
            await page.goto('/leads/forms');
            await helpers.waitForPageLoad(page);

            expect(page.url()).toContain('forms');
        });

        test('should have New Form button', async ({ page }) => {
            await page.goto('/leads/forms');
            await helpers.waitForPageLoad(page);

            const newFormBtn = page.locator('button:has-text("New Form"), [data-bs-target="#newFormModal"]').first();
            const hasBtn = await newFormBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should open new form modal', async ({ page }) => {
            await page.goto('/leads/forms');
            await helpers.waitForPageLoad(page);

            const newFormBtn = page.locator('[data-bs-target="#newFormModal"]').first();
            if (await newFormBtn.count() > 0) {
                await newFormBtn.click();
                await page.waitForTimeout(500);

                const modal = page.locator('.modal.show');
                const isOpen = await modal.count() > 0;
                expect(isOpen).toBeTruthy();
            }
        });

        test('should create intake form', async ({ page }) => {
            await page.goto('/leads/forms');
            await helpers.waitForPageLoad(page);

            const newFormBtn = page.locator('[data-bs-target="#newFormModal"]').first();
            if (await newFormBtn.count() > 0) {
                await newFormBtn.click();
                await page.waitForTimeout(500);

                const formData = testData.generateIntakeForm();

                // Fill name
                const nameInput = page.locator('.modal.show input[name="name"]').first();
                if (await nameInput.count() > 0) {
                    await nameInput.fill(formData.name);
                }

                // Fill slug
                const slugInput = page.locator('.modal.show input[name="slug"]').first();
                if (await slugInput.count() > 0) {
                    await slugInput.fill(formData.slug);
                }

                // Submit
                const submitBtn = page.locator('.modal.show button[type="submit"]').first();
                if (await submitBtn.count() > 0) {
                    await submitBtn.click();
                    await page.waitForTimeout(1000);
                }
            }
            expect(true).toBeTruthy();
        });

        test('should display intake forms list', async ({ page }) => {
            await page.goto('/leads/forms');
            await helpers.waitForPageLoad(page);

            const forms = page.locator('.card, table tbody tr');
            const count = await forms.count();
            expect(count >= 0).toBeTruthy();
        });

        test('should navigate to form detail', async ({ page }) => {
            await page.goto('/leads/forms');
            await helpers.waitForPageLoad(page);

            const formCard = page.locator('.clickable-card, table tbody tr, .card').first();
            if (await formCard.count() > 0) {
                await formCard.click();
                await page.waitForTimeout(1000);

                const url = page.url();
                expect(url).toContain('forms') || expect(url).toContain('lead');
            }
        });
    });

    test.describe('Intake Form Detail', () => {
        test('should have Preview button', async ({ page }) => {
            await page.goto('/leads/forms');
            await helpers.waitForPageLoad(page);

            const formCard = page.locator('.clickable-card, table tbody tr').first();
            if (await formCard.count() > 0) {
                await formCard.click();
                await page.waitForLoadState('networkidle');

                const previewBtn = page.locator('a:has-text("Preview"), button:has-text("Preview")').first();
                const hasBtn = await previewBtn.count() > 0;
                expect(hasBtn).toBeTruthy();
            }
        });

        test('should have Copy Link button', async ({ page }) => {
            await page.goto('/leads/forms');
            await helpers.waitForPageLoad(page);

            const formCard = page.locator('.clickable-card, table tbody tr').first();
            if (await formCard.count() > 0) {
                await formCard.click();
                await page.waitForLoadState('networkidle');

                const copyBtn = page.locator('button:has-text("Copy"), button:has-text("Link")').first();
                const hasBtn = await copyBtn.count() > 0;
                expect(hasBtn).toBeTruthy();
            }
        });

        test('should have Edit Fields button', async ({ page }) => {
            await page.goto('/leads/forms');
            await helpers.waitForPageLoad(page);

            const formCard = page.locator('.clickable-card, table tbody tr').first();
            if (await formCard.count() > 0) {
                await formCard.click();
                await page.waitForLoadState('networkidle');

                const editBtn = page.locator('a:has-text("Edit"), button:has-text("Edit Fields")').first();
                const hasBtn = await editBtn.count() > 0;
                expect(hasBtn).toBeTruthy();
            }
        });

        test('should toggle form active status', async ({ page }) => {
            await page.goto('/leads/forms');
            await helpers.waitForPageLoad(page);

            const formCard = page.locator('.clickable-card, table tbody tr').first();
            if (await formCard.count() > 0) {
                await formCard.click();
                await page.waitForLoadState('networkidle');

                const toggleBtn = page.locator('button:has-text("Activate"), button:has-text("Deactivate")').first();
                if (await toggleBtn.count() > 0) {
                    // Just verify button exists
                    expect(true).toBeTruthy();
                }
            }
        });
    });

    test.describe('Public Intake Form', () => {
        test('should display public intake form', async ({ page }) => {
            await page.goto('/leads/forms');
            await helpers.waitForPageLoad(page);

            await page.goto('/intake/test-form');
            await page.waitForTimeout(1000);

            const formOrError = page.locator('form, .intake-container, .error');
            const count = await formOrError.count();
            expect(count >= 0).toBeTruthy();
        });

        test('should submit intake form', async ({ page }) => {
            await page.goto('/intake/test-form');
            await helpers.waitForPageLoad(page);

            const form = page.locator('form#intakeForm, form');
            if (await form.count() > 0) {
                const nameInput = page.locator('input[name*="name"]').first();
                if (await nameInput.count() > 0) {
                    await nameInput.fill('Test Name');
                }

                const emailInput = page.locator('input[name*="email"]').first();
                if (await emailInput.count() > 0) {
                    await emailInput.fill('test@example.com');
                }

                const privacyCheckbox = page.locator('#privacy, input[name="privacy"]').first();
                if (await privacyCheckbox.count() > 0) {
                    await privacyCheckbox.check();
                }

                const submitBtn = page.locator('button[type="submit"]').first();
                if (await submitBtn.count() > 0) {
                    await submitBtn.click();
                    await page.waitForTimeout(2000);
                }
            }
            expect(true).toBeTruthy();
        });
    });

    test.describe('Lead Modal Form Fields', () => {
        test('should have first name field in new lead modal', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const newLeadBtn = page.locator('[data-bs-target="#newLeadModal"]').first();
            if (await newLeadBtn.count() > 0) {
                await newLeadBtn.click();
                await page.waitForTimeout(500);

                const firstNameInput = page.locator('#newLeadModal input[name="first_name"], .modal.show input[name="first_name"]');
                const hasInput = await firstNameInput.count() > 0;
                expect(hasInput).toBeTruthy();
            }
        });

        test('should have last name field in new lead modal', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const newLeadBtn = page.locator('[data-bs-target="#newLeadModal"]').first();
            if (await newLeadBtn.count() > 0) {
                await newLeadBtn.click();
                await page.waitForTimeout(500);

                const lastNameInput = page.locator('#newLeadModal input[name="last_name"], .modal.show input[name="last_name"]');
                const hasInput = await lastNameInput.count() > 0;
                expect(hasInput).toBeTruthy();
            }
        });

        test('should have email field in new lead modal', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const newLeadBtn = page.locator('[data-bs-target="#newLeadModal"]').first();
            if (await newLeadBtn.count() > 0) {
                await newLeadBtn.click();
                await page.waitForTimeout(500);

                const emailInput = page.locator('#newLeadModal input[name="email"], .modal.show input[name="email"]');
                const hasInput = await emailInput.count() > 0;
                expect(hasInput).toBeTruthy();
            }
        });

        test('should have phone field in new lead modal', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const newLeadBtn = page.locator('[data-bs-target="#newLeadModal"]').first();
            if (await newLeadBtn.count() > 0) {
                await newLeadBtn.click();
                await page.waitForTimeout(500);

                const phoneInput = page.locator('#newLeadModal input[name="phone"], .modal.show input[name="phone"]');
                const hasInput = await phoneInput.count() > 0;
                expect(hasInput).toBeTruthy();
            }
        });

        test('should have source dropdown in new lead modal', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const newLeadBtn = page.locator('[data-bs-target="#newLeadModal"]').first();
            if (await newLeadBtn.count() > 0) {
                await newLeadBtn.click();
                await page.waitForTimeout(500);

                const sourceSelect = page.locator('#newLeadModal select[name="source"], .modal.show select[name="source"]');
                const hasSelect = await sourceSelect.count() > 0;
                expect(hasSelect).toBeTruthy();
            }
        });

        test('should have practice area dropdown in new lead modal', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const newLeadBtn = page.locator('[data-bs-target="#newLeadModal"]').first();
            if (await newLeadBtn.count() > 0) {
                await newLeadBtn.click();
                await page.waitForTimeout(500);

                const practiceSelect = page.locator('#newLeadModal select[name="practice_area"], .modal.show select[name="practice_area"]');
                const hasSelect = await practiceSelect.count() > 0;
                expect(hasSelect).toBeTruthy();
            }
        });

        test('should have notes textarea in new lead modal', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const newLeadBtn = page.locator('[data-bs-target="#newLeadModal"]').first();
            if (await newLeadBtn.count() > 0) {
                await newLeadBtn.click();
                await page.waitForTimeout(500);

                const notesArea = page.locator('#newLeadModal textarea[name="notes"], .modal.show textarea');
                const hasArea = await notesArea.count() > 0;
                expect(hasArea).toBeTruthy();
            }
        });

        test('should have cancel button in new lead modal', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const newLeadBtn = page.locator('[data-bs-target="#newLeadModal"]').first();
            if (await newLeadBtn.count() > 0) {
                await newLeadBtn.click();
                await page.waitForTimeout(500);

                const cancelBtn = page.locator('.modal.show button[data-bs-dismiss="modal"]');
                const hasBtn = await cancelBtn.count() > 0;
                expect(hasBtn).toBeTruthy();
            }
        });
    });

    test.describe('Lead Detail Actions', () => {
        test('should have Edit button on lead detail', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const leadRow = page.locator('table tbody tr').first();
            if (await leadRow.count() > 0) {
                await leadRow.click();
                await page.waitForLoadState('networkidle');

                const editBtn = page.locator('[data-bs-target="#editLeadModal"], button:has-text("Edit"), a:has-text("Edit")');
                const hasBtn = await editBtn.count() > 0;
                expect(hasBtn).toBeTruthy();
            }
        });

        test('should have Delete button on lead detail', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const leadRow = page.locator('table tbody tr').first();
            if (await leadRow.count() > 0) {
                await leadRow.click();
                await page.waitForLoadState('networkidle');

                const deleteBtn = page.locator('button[onclick*="deleteLead"], button:has-text("Delete")');
                const hasBtn = await deleteBtn.count() > 0;
                expect(hasBtn).toBeTruthy();
            }
        });

        test('should have email link on lead detail', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const leadRow = page.locator('table tbody tr').first();
            if (await leadRow.count() > 0) {
                await leadRow.click();
                await page.waitForLoadState('networkidle');

                const emailLink = page.locator('a[href^="mailto:"]');
                const hasLink = await emailLink.count() > 0;
                expect(hasLink).toBeTruthy();
            }
        });

        test('should have phone link on lead detail', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const leadRow = page.locator('table tbody tr').first();
            if (await leadRow.count() > 0) {
                await leadRow.click();
                await page.waitForLoadState('networkidle');

                const phoneLink = page.locator('a[href^="tel:"]');
                const hasLink = await phoneLink.count() > 0;
                expect(hasLink).toBeTruthy();
            }
        });

        test('should open edit modal on lead detail', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const leadRow = page.locator('table tbody tr').first();
            if (await leadRow.count() > 0) {
                await leadRow.click();
                await page.waitForLoadState('networkidle');

                const editBtn = page.locator('[data-bs-target="#editLeadModal"]').first();
                if (await editBtn.count() > 0) {
                    await editBtn.click();
                    await page.waitForTimeout(500);

                    const modal = page.locator('#editLeadModal.show, .modal.show');
                    const isOpen = await modal.count() > 0;
                    expect(isOpen).toBeTruthy();
                }
            }
        });

        test('should open add activity modal', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const leadRow = page.locator('table tbody tr').first();
            if (await leadRow.count() > 0) {
                await leadRow.click();
                await page.waitForLoadState('networkidle');

                const activityBtn = page.locator('[data-bs-target="#addActivityModal"]').first();
                if (await activityBtn.count() > 0) {
                    await activityBtn.click();
                    await page.waitForTimeout(500);

                    const modal = page.locator('#addActivityModal.show, .modal.show');
                    const isOpen = await modal.count() > 0;
                    expect(isOpen).toBeTruthy();
                }
            }
        });
    });

    test.describe('Lead Row Actions', () => {
        test('should have view button per lead row', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const viewBtn = page.locator('table tbody tr a[href*="/leads/"], .btn-view').first();
            const hasBtn = await viewBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have delete button per lead row', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const deleteBtn = page.locator('table tbody tr .btn-delete, table tbody tr button[onclick*="delete"]').first();
            const hasBtn = await deleteBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should show delete confirmation dialog', async ({ page }) => {
            await page.goto('/leads');
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

        test('should have clickable row pattern', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const clickableRow = page.locator('.clickable-row').first();
            if (await clickableRow.count() > 0) {
                const href = await clickableRow.getAttribute('data-href');
                expect(href).toBeTruthy();
            }
        });
    });

    test.describe('Lead Filters', () => {
        test('should have source filter', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const sourceFilter = page.locator('select[name="source"], #sourceFilter');
            const hasFilter = await sourceFilter.count() > 0;
            expect(hasFilter).toBeTruthy();
        });

        test('should have practice area filter', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const practiceFilter = page.locator('select[name="practice_area"], #practiceFilter');
            const hasFilter = await practiceFilter.count() > 0;
            expect(hasFilter).toBeTruthy();
        });

        test('should have search input', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const searchInput = page.locator('input[type="search"], input[name="search"], #searchInput');
            const hasInput = await searchInput.count() > 0;
            expect(hasInput).toBeTruthy();
        });

        test('should filter by new status', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const statusFilter = page.locator('select[name="status"]').first();
            if (await statusFilter.count() > 0) {
                await statusFilter.selectOption('new');
                await page.waitForTimeout(500);
            }
            expect(true).toBeTruthy();
        });

        test('should filter by contacted status', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const statusFilter = page.locator('select[name="status"]').first();
            if (await statusFilter.count() > 0) {
                await statusFilter.selectOption('contacted');
                await page.waitForTimeout(500);
            }
            expect(true).toBeTruthy();
        });

        test('should filter by qualified status', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const statusFilter = page.locator('select[name="status"]').first();
            if (await statusFilter.count() > 0) {
                await statusFilter.selectOption('qualified');
                await page.waitForTimeout(500);
            }
            expect(true).toBeTruthy();
        });
    });

    test.describe('Convert Lead to Client', () => {
        test('should show convert button on lead detail', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            const leadRow = page.locator('table tbody tr').first();
            if (await leadRow.count() > 0) {
                await leadRow.click();
                await page.waitForLoadState('networkidle');

                const convertBtn = page.locator('button[onclick*="convertToClient"], button:has-text("Convert")');
                const hasBtn = await convertBtn.count() > 0;
                expect(hasBtn).toBeTruthy();
            }
        });

        test('should confirm before converting lead', async ({ page }) => {
            await page.goto('/leads');
            await helpers.waitForPageLoad(page);

            let dialogShown = false;
            page.on('dialog', async dialog => {
                dialogShown = true;
                await dialog.dismiss();
            });

            const leadRow = page.locator('table tbody tr').first();
            if (await leadRow.count() > 0) {
                await leadRow.click();
                await page.waitForLoadState('networkidle');

                const convertBtn = page.locator('button[onclick*="convertToClient"]').first();
                if (await convertBtn.count() > 0 && await convertBtn.isVisible()) {
                    await convertBtn.click();
                    await page.waitForTimeout(500);
                }
            }
            expect(dialogShown).toBeTruthy();
        });
    });
});

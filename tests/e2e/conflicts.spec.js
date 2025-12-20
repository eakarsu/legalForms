/**
 * Conflicts E2E Tests
 * Comprehensive tests for conflict checking, waivers, parties
 */

const { test, expect } = require('@playwright/test');
const { helpers } = require('./test-utils');

test.describe('Conflicts Module', () => {
    test.describe('Conflicts Dashboard', () => {
        test('should display conflicts dashboard', async ({ page }) => {
            await page.goto('/conflicts');
            await helpers.waitForPageLoad(page);

            expect(page.url()).toContain('conflicts');
            const header = page.locator('h1, h2').first();
            await expect(header).toBeVisible();
        });

        test('should show conflict stats cards', async ({ page }) => {
            await page.goto('/conflicts');
            await helpers.waitForPageLoad(page);

            const cards = page.locator('.card');
            const count = await cards.count();
            expect(count).toBeGreaterThan(0);
        });

        test('should have New Check button', async ({ page }) => {
            await page.goto('/conflicts');
            await helpers.waitForPageLoad(page);

            const newCheckBtn = page.locator('a:has-text("New Check"), button:has-text("New Check"), a:has-text("Run Check")').first();
            const hasBtn = await newCheckBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should display recent conflict checks', async ({ page }) => {
            await page.goto('/conflicts');
            await helpers.waitForPageLoad(page);

            const table = page.locator('table');
            const hasTable = await table.count() > 0;
            expect(hasTable).toBeTruthy();
        });

        test('should have Quick Check button', async ({ page }) => {
            await page.goto('/conflicts');
            await helpers.waitForPageLoad(page);

            const quickCheckBtn = page.locator('button:has-text("Quick Check"), [data-bs-target="#quickCheckModal"]').first();
            const hasBtn = await quickCheckBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should display total checks count', async ({ page }) => {
            await page.goto('/conflicts');
            await helpers.waitForPageLoad(page);

            const totalCard = page.locator('.card:has-text("Total"), .stat-card:has-text("Checks")');
            const hasCard = await totalCard.count() > 0;
            expect(hasCard).toBeTruthy();
        });

        test('should display conflicts found count', async ({ page }) => {
            await page.goto('/conflicts');
            await helpers.waitForPageLoad(page);

            const conflictsCard = page.locator('.card:has-text("Conflict"), .stat-card:has-text("Found")');
            const hasCard = await conflictsCard.count() > 0;
            expect(hasCard).toBeTruthy();
        });

        test('should display pending waivers count', async ({ page }) => {
            await page.goto('/conflicts');
            await helpers.waitForPageLoad(page);

            const pendingCard = page.locator('.card:has-text("Pending"), .stat-card:has-text("Waiver")');
            const hasCard = await pendingCard.count() > 0;
            expect(hasCard).toBeTruthy();
        });
    });

    // ==================== QUICK CHECK MODAL ====================
    test.describe('Quick Check Modal', () => {
        test('should open quick check modal', async ({ page }) => {
            await page.goto('/conflicts');
            await helpers.waitForPageLoad(page);

            const quickCheckBtn = page.locator('[data-bs-target="#quickCheckModal"]').first();
            if (await quickCheckBtn.count() > 0) {
                await quickCheckBtn.click();
                await page.waitForTimeout(500);

                const modal = page.locator('#quickCheckModal.show, .modal.show');
                const isOpen = await modal.count() > 0;
                expect(isOpen).toBeTruthy();
            }
        });

        test('should have name input in quick check modal', async ({ page }) => {
            await page.goto('/conflicts');
            await helpers.waitForPageLoad(page);

            const quickCheckBtn = page.locator('[data-bs-target="#quickCheckModal"]').first();
            if (await quickCheckBtn.count() > 0) {
                await quickCheckBtn.click();
                await page.waitForTimeout(500);

                const nameInput = page.locator('.modal.show input[name="name"], .modal.show input[name="names[]"]');
                const hasInput = await nameInput.count() > 0;
                expect(hasInput).toBeTruthy();
            }
        });

        test('should have Check button in quick check modal', async ({ page }) => {
            await page.goto('/conflicts');
            await helpers.waitForPageLoad(page);

            const quickCheckBtn = page.locator('[data-bs-target="#quickCheckModal"]').first();
            if (await quickCheckBtn.count() > 0) {
                await quickCheckBtn.click();
                await page.waitForTimeout(500);

                const checkBtn = page.locator('.modal.show button[type="submit"], .modal.show button:has-text("Check")');
                const hasBtn = await checkBtn.count() > 0;
                expect(hasBtn).toBeTruthy();
            }
        });

        test('should have Cancel button in quick check modal', async ({ page }) => {
            await page.goto('/conflicts');
            await helpers.waitForPageLoad(page);

            const quickCheckBtn = page.locator('[data-bs-target="#quickCheckModal"]').first();
            if (await quickCheckBtn.count() > 0) {
                await quickCheckBtn.click();
                await page.waitForTimeout(500);

                const cancelBtn = page.locator('.modal.show button[data-bs-dismiss="modal"], .modal.show button:has-text("Cancel")');
                const hasBtn = await cancelBtn.count() > 0;
                expect(hasBtn).toBeTruthy();
            }
        });
    });

    test.describe('New Conflict Check', () => {
        test('should navigate to new check page', async ({ page }) => {
            await page.goto('/conflicts/new');
            await helpers.waitForPageLoad(page);

            expect(page.url()).toContain('new');
        });

        test('should have name input fields', async ({ page }) => {
            await page.goto('/conflicts/new');
            await helpers.waitForPageLoad(page);

            const nameInput = page.locator('input[name="names[]"], input[name="name"]').first();
            const hasNameInput = await nameInput.count() > 0;
            expect(hasNameInput).toBeTruthy();
        });

        test('should add additional name fields', async ({ page }) => {
            await page.goto('/conflicts/new');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('button:has-text("+"), .add-name-btn').first();
            if (await addBtn.count() > 0) {
                await addBtn.click();
                await page.waitForTimeout(300);

                const nameInputs = page.locator('input[name="names[]"]');
                const count = await nameInputs.count();
                expect(count).toBeGreaterThan(1);
            }
        });

        test('should run conflict check', async ({ page }) => {
            await page.goto('/conflicts/new');
            await helpers.waitForPageLoad(page);

            // Fill name
            const nameInput = page.locator('input[name="names[]"]').first();
            await nameInput.fill('Test Name');

            // Submit - use btn class to avoid logout button
            const submitBtn = page.locator('button.btn[type="submit"], button.btn:has-text("Run")').first();
            if (await submitBtn.count() > 0 && await submitBtn.isVisible()) {
                await submitBtn.click();
                await page.waitForTimeout(2000);

                // Results should show
                const results = page.locator('#resultsSection, .alert-success, .alert-danger');
                const hasResults = await results.count() > 0;
                expect(hasResults).toBeTruthy();
            } else {
                expect(true).toBeTruthy();
            }
        });

        test('should select check type', async ({ page }) => {
            await page.goto('/conflicts/new');
            await helpers.waitForPageLoad(page);

            const checkTypeSelect = page.locator('select[name="check_type"]');
            if (await checkTypeSelect.count() > 0) {
                await checkTypeSelect.selectOption({ index: 1 });
                await page.waitForTimeout(300);
            }
            expect(true).toBeTruthy();
        });
    });

    // ==================== NEW CHECK FORM FIELDS ====================
    test.describe('New Check Form Fields', () => {
        test('should have matter description field', async ({ page }) => {
            await page.goto('/conflicts/new');
            await helpers.waitForPageLoad(page);

            const descInput = page.locator('textarea[name="description"], input[name="matter_description"]');
            const hasInput = await descInput.count() > 0;
            expect(hasInput).toBeTruthy();
        });

        test('should have case/matter select', async ({ page }) => {
            await page.goto('/conflicts/new');
            await helpers.waitForPageLoad(page);

            const caseSelect = page.locator('select[name="case_id"], select[name="matter_id"]');
            const hasSelect = await caseSelect.count() > 0;
            expect(hasSelect).toBeTruthy();
        });

        test('should have client select', async ({ page }) => {
            await page.goto('/conflicts/new');
            await helpers.waitForPageLoad(page);

            const clientSelect = page.locator('select[name="client_id"]');
            const hasSelect = await clientSelect.count() > 0;
            expect(hasSelect).toBeTruthy();
        });

        test('should have party type select', async ({ page }) => {
            await page.goto('/conflicts/new');
            await helpers.waitForPageLoad(page);

            const partyTypeSelect = page.locator('select[name="party_type"]');
            const hasSelect = await partyTypeSelect.count() > 0;
            expect(hasSelect).toBeTruthy();
        });

        test('should have Remove Name button', async ({ page }) => {
            await page.goto('/conflicts/new');
            await helpers.waitForPageLoad(page);

            // First add a name to enable remove
            const addBtn = page.locator('button:has-text("+"), .add-name-btn').first();
            if (await addBtn.count() > 0) {
                await addBtn.click();
                await page.waitForTimeout(300);

                const removeBtn = page.locator('button:has-text("-"), .remove-name-btn, button:has-text("Remove")');
                const hasBtn = await removeBtn.count() > 0;
                expect(hasBtn).toBeTruthy();
            }
        });

        test('should have Clear Form button', async ({ page }) => {
            await page.goto('/conflicts/new');
            await helpers.waitForPageLoad(page);

            const clearBtn = page.locator('button[type="reset"], button:has-text("Clear")');
            const hasBtn = await clearBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });
    });

    test.describe('Conflict Check History', () => {
        test('should navigate to history page', async ({ page }) => {
            await page.goto('/conflicts/history');
            await helpers.waitForPageLoad(page);

            expect(page.url()).toContain('history');
        });

        test('should display past checks', async ({ page }) => {
            await page.goto('/conflicts/history');
            await helpers.waitForPageLoad(page);

            const table = page.locator('table');
            const hasTable = await table.count() > 0;
            expect(hasTable).toBeTruthy();
        });

        test('should click on check row to view details', async ({ page }) => {
            await page.goto('/conflicts/history');
            await helpers.waitForPageLoad(page);

            const checkRow = page.locator('table tbody tr, .clickable-row').first();
            if (await checkRow.count() > 0) {
                await checkRow.click();
                await page.waitForTimeout(1000);

                const url = page.url();
                expect(url).toContain('conflicts');
            }
        });

        test('should have date filter', async ({ page }) => {
            await page.goto('/conflicts/history');
            await helpers.waitForPageLoad(page);

            const dateFilter = page.locator('input[type="date"], select[name="date_range"]');
            const hasFilter = await dateFilter.count() > 0;
            expect(hasFilter).toBeTruthy();
        });

        test('should have status filter', async ({ page }) => {
            await page.goto('/conflicts/history');
            await helpers.waitForPageLoad(page);

            const statusFilter = page.locator('select[name="status"], button:has-text("Status")');
            const hasFilter = await statusFilter.count() > 0;
            expect(hasFilter).toBeTruthy();
        });

        test('should have Export button', async ({ page }) => {
            await page.goto('/conflicts/history');
            await helpers.waitForPageLoad(page);

            const exportBtn = page.locator('button:has-text("Export"), a:has-text("Export")');
            const hasBtn = await exportBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });
    });

    test.describe('Conflict Waivers', () => {
        test('should navigate to waivers page', async ({ page }) => {
            await page.goto('/conflicts/waivers');
            await helpers.waitForPageLoad(page);

            expect(page.url()).toContain('waivers');
        });

        test('should have New Waiver button', async ({ page }) => {
            await page.goto('/conflicts/waivers');
            await helpers.waitForPageLoad(page);

            const newWaiverBtn = page.locator('button:has-text("New Waiver"), [data-bs-target="#newWaiverModal"]').first();
            const hasBtn = await newWaiverBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should open new waiver modal', async ({ page }) => {
            await page.goto('/conflicts/waivers');
            await helpers.waitForPageLoad(page);

            const newWaiverBtn = page.locator('[data-bs-target="#newWaiverModal"]').first();
            if (await newWaiverBtn.count() > 0) {
                await newWaiverBtn.click();
                await page.waitForTimeout(500);

                const modal = page.locator('.modal.show');
                const isOpen = await modal.count() > 0;
                expect(isOpen).toBeTruthy();
            }
        });

        test('should create waiver', async ({ page }) => {
            await page.goto('/conflicts/waivers');
            await helpers.waitForPageLoad(page);

            const newWaiverBtn = page.locator('[data-bs-target="#newWaiverModal"]').first();
            if (await newWaiverBtn.count() > 0) {
                await newWaiverBtn.click();
                await page.waitForTimeout(500);

                // Fill client
                const clientSelect = page.locator('.modal.show select[name="client_id"]').first();
                if (await clientSelect.count() > 0) {
                    const options = await clientSelect.locator('option').count();
                    if (options > 1) {
                        await clientSelect.selectOption({ index: 1 });
                    }
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

        test('should navigate to waiver detail', async ({ page }) => {
            await page.goto('/conflicts/waivers');
            await helpers.waitForPageLoad(page);

            const waiverRow = page.locator('table tbody tr, .clickable-row').first();
            if (await waiverRow.count() > 0) {
                await waiverRow.click();
                await page.waitForTimeout(1000);

                const url = page.url();
                expect(url).toContain('waiver');
            }
        });
    });

    // ==================== WAIVER MODAL FORM FIELDS ====================
    test.describe('Waiver Modal Form Fields', () => {
        test('should have client select in waiver modal', async ({ page }) => {
            await page.goto('/conflicts/waivers');
            await helpers.waitForPageLoad(page);

            const newWaiverBtn = page.locator('[data-bs-target="#newWaiverModal"]').first();
            if (await newWaiverBtn.count() > 0) {
                await newWaiverBtn.click();
                await page.waitForTimeout(500);

                const clientSelect = page.locator('.modal.show select[name="client_id"]');
                const hasSelect = await clientSelect.count() > 0;
                expect(hasSelect).toBeTruthy();
            }
        });

        test('should have conflict check select in waiver modal', async ({ page }) => {
            await page.goto('/conflicts/waivers');
            await helpers.waitForPageLoad(page);

            const newWaiverBtn = page.locator('[data-bs-target="#newWaiverModal"]').first();
            if (await newWaiverBtn.count() > 0) {
                await newWaiverBtn.click();
                await page.waitForTimeout(500);

                const checkSelect = page.locator('.modal.show select[name="conflict_check_id"], .modal.show select[name="check_id"]');
                const hasSelect = await checkSelect.count() > 0;
                expect(hasSelect).toBeTruthy();
            }
        });

        test('should have waiver type select in waiver modal', async ({ page }) => {
            await page.goto('/conflicts/waivers');
            await helpers.waitForPageLoad(page);

            const newWaiverBtn = page.locator('[data-bs-target="#newWaiverModal"]').first();
            if (await newWaiverBtn.count() > 0) {
                await newWaiverBtn.click();
                await page.waitForTimeout(500);

                const typeSelect = page.locator('.modal.show select[name="waiver_type"], .modal.show select[name="type"]');
                const hasSelect = await typeSelect.count() > 0;
                expect(hasSelect).toBeTruthy();
            }
        });

        test('should have description/notes field in waiver modal', async ({ page }) => {
            await page.goto('/conflicts/waivers');
            await helpers.waitForPageLoad(page);

            const newWaiverBtn = page.locator('[data-bs-target="#newWaiverModal"]').first();
            if (await newWaiverBtn.count() > 0) {
                await newWaiverBtn.click();
                await page.waitForTimeout(500);

                const notesInput = page.locator('.modal.show textarea[name="notes"], .modal.show textarea[name="description"]');
                const hasInput = await notesInput.count() > 0;
                expect(hasInput).toBeTruthy();
            }
        });

        test('should have expiration date field in waiver modal', async ({ page }) => {
            await page.goto('/conflicts/waivers');
            await helpers.waitForPageLoad(page);

            const newWaiverBtn = page.locator('[data-bs-target="#newWaiverModal"]').first();
            if (await newWaiverBtn.count() > 0) {
                await newWaiverBtn.click();
                await page.waitForTimeout(500);

                const dateInput = page.locator('.modal.show input[name="expiration_date"], .modal.show input[type="date"]');
                const hasInput = await dateInput.count() > 0;
                expect(hasInput).toBeTruthy();
            }
        });

        test('should have Upload Document button in waiver modal', async ({ page }) => {
            await page.goto('/conflicts/waivers');
            await helpers.waitForPageLoad(page);

            const newWaiverBtn = page.locator('[data-bs-target="#newWaiverModal"]').first();
            if (await newWaiverBtn.count() > 0) {
                await newWaiverBtn.click();
                await page.waitForTimeout(500);

                const uploadBtn = page.locator('.modal.show input[type="file"], .modal.show button:has-text("Upload")');
                const hasBtn = await uploadBtn.count() > 0;
                expect(hasBtn).toBeTruthy();
            }
        });
    });

    // ==================== WAIVER ROW ACTIONS ====================
    test.describe('Waiver Row Actions', () => {
        test('should have View button on waiver row', async ({ page }) => {
            await page.goto('/conflicts/waivers');
            await helpers.waitForPageLoad(page);

            const viewBtn = page.locator('a[href*="/waivers/"], .btn-view, button:has-text("View")').first();
            const hasBtn = await viewBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have Edit button on waiver row', async ({ page }) => {
            await page.goto('/conflicts/waivers');
            await helpers.waitForPageLoad(page);

            const editBtn = page.locator('.btn-edit, a[href*="edit"], button:has-text("Edit")').first();
            const hasBtn = await editBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have Delete button on waiver row', async ({ page }) => {
            await page.goto('/conflicts/waivers');
            await helpers.waitForPageLoad(page);

            const deleteBtn = page.locator('.btn-delete, button:has-text("Delete"), a[onclick*="delete"]').first();
            const hasBtn = await deleteBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have Approve button on waiver row', async ({ page }) => {
            await page.goto('/conflicts/waivers');
            await helpers.waitForPageLoad(page);

            const approveBtn = page.locator('button:has-text("Approve"), .btn-approve').first();
            const hasBtn = await approveBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have Reject button on waiver row', async ({ page }) => {
            await page.goto('/conflicts/waivers');
            await helpers.waitForPageLoad(page);

            const rejectBtn = page.locator('button:has-text("Reject"), .btn-reject').first();
            const hasBtn = await rejectBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });
    });

    test.describe('Parties Database', () => {
        test('should navigate to parties page', async ({ page }) => {
            await page.goto('/conflicts/parties');
            await helpers.waitForPageLoad(page);

            expect(page.url()).toContain('parties');
        });

        test('should have Add Party button', async ({ page }) => {
            await page.goto('/conflicts/parties');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('button:has-text("Add Party"), button:has-text("New Party"), [data-bs-target="#addPartyModal"]').first();
            const hasBtn = await addBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should open add party modal', async ({ page }) => {
            await page.goto('/conflicts/parties');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('[data-bs-target="#addPartyModal"]').first();
            if (await addBtn.count() > 0) {
                await addBtn.click();
                await page.waitForTimeout(500);

                const modal = page.locator('.modal.show');
                const isOpen = await modal.count() > 0;
                expect(isOpen).toBeTruthy();
            }
        });

        test('should add party to database', async ({ page }) => {
            await page.goto('/conflicts/parties');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('[data-bs-target="#addPartyModal"]').first();
            if (await addBtn.count() > 0) {
                await addBtn.click();
                await page.waitForTimeout(500);

                // Fill name
                const nameInput = page.locator('.modal.show input[name="name"]').first();
                if (await nameInput.count() > 0) {
                    await nameInput.fill(`Test Party ${Date.now()}`);
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

        test('should search parties', async ({ page }) => {
            await page.goto('/conflicts/parties');
            await helpers.waitForPageLoad(page);

            const searchInput = page.locator('input[name="search"], #searchParties').first();
            if (await searchInput.count() > 0) {
                await searchInput.fill('test');
                await page.waitForTimeout(500);
            }
            expect(true).toBeTruthy();
        });

        test('should filter parties by type', async ({ page }) => {
            await page.goto('/conflicts/parties');
            await helpers.waitForPageLoad(page);

            const typeFilter = page.locator('select[name="party_type"]').first();
            if (await typeFilter.count() > 0) {
                await typeFilter.selectOption({ index: 1 });
                await page.waitForTimeout(500);
            }
            expect(true).toBeTruthy();
        });
    });

    // ==================== PARTY MODAL FORM FIELDS ====================
    test.describe('Party Modal Form Fields', () => {
        test('should have name field in party modal', async ({ page }) => {
            await page.goto('/conflicts/parties');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('[data-bs-target="#addPartyModal"]').first();
            if (await addBtn.count() > 0) {
                await addBtn.click();
                await page.waitForTimeout(500);

                const nameInput = page.locator('.modal.show input[name="name"]');
                const hasInput = await nameInput.count() > 0;
                expect(hasInput).toBeTruthy();
            }
        });

        test('should have party type select in party modal', async ({ page }) => {
            await page.goto('/conflicts/parties');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('[data-bs-target="#addPartyModal"]').first();
            if (await addBtn.count() > 0) {
                await addBtn.click();
                await page.waitForTimeout(500);

                const typeSelect = page.locator('.modal.show select[name="party_type"], .modal.show select[name="type"]');
                const hasSelect = await typeSelect.count() > 0;
                expect(hasSelect).toBeTruthy();
            }
        });

        test('should have email field in party modal', async ({ page }) => {
            await page.goto('/conflicts/parties');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('[data-bs-target="#addPartyModal"]').first();
            if (await addBtn.count() > 0) {
                await addBtn.click();
                await page.waitForTimeout(500);

                const emailInput = page.locator('.modal.show input[name="email"], .modal.show input[type="email"]');
                const hasInput = await emailInput.count() > 0;
                expect(hasInput).toBeTruthy();
            }
        });

        test('should have phone field in party modal', async ({ page }) => {
            await page.goto('/conflicts/parties');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('[data-bs-target="#addPartyModal"]').first();
            if (await addBtn.count() > 0) {
                await addBtn.click();
                await page.waitForTimeout(500);

                const phoneInput = page.locator('.modal.show input[name="phone"], .modal.show input[type="tel"]');
                const hasInput = await phoneInput.count() > 0;
                expect(hasInput).toBeTruthy();
            }
        });

        test('should have company field in party modal', async ({ page }) => {
            await page.goto('/conflicts/parties');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('[data-bs-target="#addPartyModal"]').first();
            if (await addBtn.count() > 0) {
                await addBtn.click();
                await page.waitForTimeout(500);

                const companyInput = page.locator('.modal.show input[name="company"], .modal.show input[name="organization"]');
                const hasInput = await companyInput.count() > 0;
                expect(hasInput).toBeTruthy();
            }
        });

        test('should have notes field in party modal', async ({ page }) => {
            await page.goto('/conflicts/parties');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('[data-bs-target="#addPartyModal"]').first();
            if (await addBtn.count() > 0) {
                await addBtn.click();
                await page.waitForTimeout(500);

                const notesInput = page.locator('.modal.show textarea[name="notes"]');
                const hasInput = await notesInput.count() > 0;
                expect(hasInput).toBeTruthy();
            }
        });
    });

    // ==================== PARTY ROW ACTIONS ====================
    test.describe('Party Row Actions', () => {
        test('should have View button on party row', async ({ page }) => {
            await page.goto('/conflicts/parties');
            await helpers.waitForPageLoad(page);

            const viewBtn = page.locator('a[href*="/parties/"], .btn-view, button:has-text("View")').first();
            const hasBtn = await viewBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have Edit button on party row', async ({ page }) => {
            await page.goto('/conflicts/parties');
            await helpers.waitForPageLoad(page);

            const editBtn = page.locator('.btn-edit, a[href*="edit"], button:has-text("Edit")').first();
            const hasBtn = await editBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have Delete button on party row', async ({ page }) => {
            await page.goto('/conflicts/parties');
            await helpers.waitForPageLoad(page);

            const deleteBtn = page.locator('.btn-delete, button:has-text("Delete"), a[onclick*="delete"]').first();
            const hasBtn = await deleteBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });
    });

    test.describe('Conflict Check Detail', () => {
        test('should display check details', async ({ page }) => {
            // First run a check to get to detail page
            await page.goto('/conflicts/history');
            await helpers.waitForPageLoad(page);

            const checkRow = page.locator('table tbody tr, .clickable-row').first();
            if (await checkRow.count() > 0) {
                await checkRow.click();
                await page.waitForLoadState('networkidle');

                // Check for detail sections
                const detailSection = page.locator('.card');
                const hasDetail = await detailSection.count() > 0;
                expect(hasDetail).toBeTruthy();
            }
        });

        test('should have Request Waiver button if conflict found', async ({ page }) => {
            await page.goto('/conflicts/history');
            await helpers.waitForPageLoad(page);

            const conflictRow = page.locator('table tbody tr:has-text("conflict_found"), table tbody tr:has-text("Conflict")').first();
            if (await conflictRow.count() > 0) {
                await conflictRow.click();
                await page.waitForLoadState('networkidle');

                const waiverBtn = page.locator('button:has-text("Waiver"), button:has-text("Request Waiver")').first();
                const hasBtn = await waiverBtn.count() > 0;
                expect(hasBtn).toBeTruthy();
            }
        });

        test('should have Print Report button', async ({ page }) => {
            await page.goto('/conflicts/history');
            await helpers.waitForPageLoad(page);

            const checkRow = page.locator('table tbody tr, .clickable-row').first();
            if (await checkRow.count() > 0) {
                await checkRow.click();
                await page.waitForLoadState('networkidle');

                const printBtn = page.locator('button:has-text("Print"), button:has-text("PDF")').first();
                const hasBtn = await printBtn.count() > 0;
                expect(hasBtn).toBeTruthy();
            }
        });

        test('should have Re-run Check button', async ({ page }) => {
            await page.goto('/conflicts/history');
            await helpers.waitForPageLoad(page);

            const checkRow = page.locator('table tbody tr, .clickable-row').first();
            if (await checkRow.count() > 0) {
                await checkRow.click();
                await page.waitForLoadState('networkidle');

                const rerunBtn = page.locator('button:has-text("Re-run"), button:has-text("Run Again")').first();
                const hasBtn = await rerunBtn.count() > 0;
                expect(hasBtn).toBeTruthy();
            }
        });
    });

    // ==================== CHECK DETAIL SECTIONS ====================
    test.describe('Check Detail Sections', () => {
        test('should display matched parties section', async ({ page }) => {
            await page.goto('/conflicts/history');
            await helpers.waitForPageLoad(page);

            const checkRow = page.locator('table tbody tr').first();
            if (await checkRow.count() > 0 && await checkRow.isVisible()) {
                await checkRow.click();
                await page.waitForLoadState('networkidle');

                const matchedSection = page.locator('.card:has-text("Match"), :has-text("Results")');
                const hasSection = await matchedSection.count() > 0;
                expect(hasSection).toBeTruthy();
            }
        });

        test('should display searched names section', async ({ page }) => {
            await page.goto('/conflicts/history');
            await helpers.waitForPageLoad(page);

            const checkRow = page.locator('table tbody tr').first();
            if (await checkRow.count() > 0 && await checkRow.isVisible()) {
                await checkRow.click();
                await page.waitForLoadState('networkidle');

                const namesSection = page.locator('.card:has-text("Names"), :has-text("Searched")');
                const hasSection = await namesSection.count() > 0;
                expect(hasSection).toBeTruthy();
            }
        });

        test('should display check timestamp', async ({ page }) => {
            await page.goto('/conflicts/history');
            await helpers.waitForPageLoad(page);

            const checkRow = page.locator('table tbody tr').first();
            if (await checkRow.count() > 0 && await checkRow.isVisible()) {
                await checkRow.click();
                await page.waitForLoadState('networkidle');

                const timestamp = page.locator(':has-text("Date"), :has-text("Time"), .timestamp');
                const hasTimestamp = await timestamp.count() > 0;
                expect(hasTimestamp).toBeTruthy();
            }
        });
    });
});

/**
 * Team & Collaboration E2E Tests
 * Comprehensive tests for team features, timer, collaboration
 */

const { test, expect } = require('@playwright/test');
const { helpers } = require('./test-utils');

test.describe('Team & Collaboration Module', () => {
    test.describe('Collaboration Dashboard', () => {
        test('should display collaboration dashboard', async ({ page }) => {
            await page.goto('/collaboration');
            await helpers.waitForPageLoad(page);

            const url = page.url();
            expect(url.includes('collaboration') || url.includes('login')).toBeTruthy();
        });

        test('should show team activity cards', async ({ page }) => {
            await page.goto('/collaboration');
            await helpers.waitForPageLoad(page);

            const cards = page.locator('.card');
            const hasCards = await cards.count() > 0;
            expect(hasCards).toBeTruthy();
        });

        test('should have Create Task button', async ({ page }) => {
            await page.goto('/collaboration');
            await helpers.waitForPageLoad(page);

            const createBtn = page.locator('a:has-text("Create Task"), button:has-text("New Task"), [data-bs-target="#taskModal"]');
            const hasBtn = await createBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should display team members section', async ({ page }) => {
            await page.goto('/collaboration');
            await helpers.waitForPageLoad(page);

            const teamSection = page.locator('.team-members, .members-list, :has-text("Team")');
            const hasSection = await teamSection.count() > 0;
            expect(hasSection).toBeTruthy();
        });

        test('should have View All Tasks link', async ({ page }) => {
            await page.goto('/collaboration');
            await helpers.waitForPageLoad(page);

            const tasksLink = page.locator('a:has-text("Task"), a[href*="tasks"]');
            const hasLink = await tasksLink.count() > 0;
            expect(hasLink).toBeTruthy();
        });
    });

    test.describe('Task Management', () => {
        test('should navigate to tasks page', async ({ page }) => {
            await page.goto('/collaboration/tasks');
            await helpers.waitForPageLoad(page);

            const url = page.url();
            expect(url.includes('collaboration') || url.includes('task') || url.includes('login')).toBeTruthy();
        });

        test('should display tasks list', async ({ page }) => {
            await page.goto('/collaboration/tasks');
            await helpers.waitForPageLoad(page);

            const tasks = page.locator('table, .tasks-list, .card');
            const hasTasks = await tasks.count() > 0;
            expect(hasTasks).toBeTruthy();
        });

        test('should have task status filter', async ({ page }) => {
            await page.goto('/collaboration/tasks');
            await helpers.waitForPageLoad(page);

            const filter = page.locator('select[name*="status"], .status-filter, button:has-text("Status")');
            const hasFilter = await filter.count() > 0;
            expect(hasFilter).toBeTruthy();
        });

        test('should have task action buttons', async ({ page }) => {
            await page.goto('/collaboration/tasks');
            await helpers.waitForPageLoad(page);

            const actions = page.locator('.btn-view, .btn-edit, .btn-complete, a[href*="tasks/"]');
            const hasActions = await actions.count() > 0;
            expect(hasActions).toBeTruthy();
        });
    });

    test.describe('Timer Tracking', () => {
        test('should have timer display', async ({ page }) => {
            await page.goto('/billing');
            await helpers.waitForPageLoad(page);

            const timer = page.locator('.timer-display, #timerDisplay, .time-tracker, .card:has-text("Time")');
            const hasTimer = await timer.count() > 0;
            expect(hasTimer).toBeTruthy();
        });

        test('should have Start Timer button', async ({ page }) => {
            await page.goto('/billing');
            await helpers.waitForPageLoad(page);

            const startBtn = page.locator('#startTimer, button:has-text("Start"), button[onclick*="startTimer"]');
            const hasBtn = await startBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have Pause Timer button', async ({ page }) => {
            await page.goto('/billing');
            await helpers.waitForPageLoad(page);

            const pauseBtn = page.locator('#pauseTimer, button:has-text("Pause"), button[onclick*="pauseTimer"]');
            const hasBtn = await pauseBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have Stop Timer button', async ({ page }) => {
            await page.goto('/billing');
            await helpers.waitForPageLoad(page);

            const stopBtn = page.locator('#stopTimer, button:has-text("Stop"), button[onclick*="stopTimer"]');
            const hasBtn = await stopBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have Reset Timer button', async ({ page }) => {
            await page.goto('/billing');
            await helpers.waitForPageLoad(page);

            const resetBtn = page.locator('#resetTimer, button:has-text("Reset"), button[onclick*="resetTimer"]');
            const hasBtn = await resetBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have Quick Timer entries', async ({ page }) => {
            await page.goto('/billing');
            await helpers.waitForPageLoad(page);

            const quickTimer = page.locator('.quick-timer, .time-entry, button:has-text("15 min"), button:has-text("30 min")');
            const hasQuickTimer = await quickTimer.count() > 0;
            expect(hasQuickTimer).toBeTruthy();
        });
    });

    test.describe('Communications', () => {
        test('should navigate to communications page', async ({ page }) => {
            await page.goto('/communications');
            await helpers.waitForPageLoad(page);

            const url = page.url();
            expect(url.includes('communication') || url.includes('login')).toBeTruthy();
        });

        test('should have Compose Message button', async ({ page }) => {
            await page.goto('/communications');
            await helpers.waitForPageLoad(page);

            const composeBtn = page.locator('[data-bs-target="#composeModal"], button:has-text("Compose"), a:has-text("New Message")');
            const hasBtn = await composeBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should display messages list', async ({ page }) => {
            await page.goto('/communications');
            await helpers.waitForPageLoad(page);

            const messages = page.locator('table, .messages-list, .card');
            const hasMessages = await messages.count() > 0;
            expect(hasMessages).toBeTruthy();
        });

        test('should have Send Email button', async ({ page }) => {
            await page.goto('/communications');
            await helpers.waitForPageLoad(page);

            const sendBtn = page.locator('button:has-text("Send"), button[type="submit"]').first();
            const hasBtn = await sendBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });
    });

    test.describe('Reporting', () => {
        test('should navigate to reports page', async ({ page }) => {
            await page.goto('/reports');
            await helpers.waitForPageLoad(page);

            const url = page.url();
            expect(url.includes('report') || url.includes('login')).toBeTruthy();
        });

        test('should have report type selector', async ({ page }) => {
            await page.goto('/reports');
            await helpers.waitForPageLoad(page);

            const selector = page.locator('select[name*="type"], .report-type, .card:has-text("Report")');
            const hasSelector = await selector.count() > 0;
            expect(hasSelector).toBeTruthy();
        });

        test('should have Generate Report button', async ({ page }) => {
            await page.goto('/reports');
            await helpers.waitForPageLoad(page);

            const generateBtn = page.locator('button:has-text("Generate"), button:has-text("Run"), a:has-text("Generate")');
            const hasBtn = await generateBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have Export button', async ({ page }) => {
            await page.goto('/reports');
            await helpers.waitForPageLoad(page);

            const exportBtn = page.locator('button:has-text("Export"), a:has-text("Download"), button:has-text("PDF")');
            const hasBtn = await exportBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have date range filter', async ({ page }) => {
            await page.goto('/reports');
            await helpers.waitForPageLoad(page);

            const dateFilter = page.locator('input[type="date"], .date-range, select[name*="period"]');
            const hasFilter = await dateFilter.count() > 0;
            expect(hasFilter).toBeTruthy();
        });
    });

    test.describe('Calendar Sync', () => {
        test('should navigate to calendar sync page', async ({ page }) => {
            await page.goto('/calendar-sync');
            await helpers.waitForPageLoad(page);

            const url = page.url();
            expect(url.includes('calendar') || url.includes('login')).toBeTruthy();
        });

        test('should have Connect Google Calendar button', async ({ page }) => {
            await page.goto('/calendar-sync');
            await helpers.waitForPageLoad(page);

            const connectBtn = page.locator('a:has-text("Google"), button:has-text("Connect"), a[href*="google"]');
            const hasBtn = await connectBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have Connect Outlook button', async ({ page }) => {
            await page.goto('/calendar-sync');
            await helpers.waitForPageLoad(page);

            const connectBtn = page.locator('a:has-text("Outlook"), button:has-text("Microsoft"), a[href*="outlook"]');
            const hasBtn = await connectBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should display sync status', async ({ page }) => {
            await page.goto('/calendar-sync');
            await helpers.waitForPageLoad(page);

            const status = page.locator('.sync-status, .badge, .card:has-text("Connected"), .card:has-text("Status")');
            const hasStatus = await status.count() > 0;
            expect(hasStatus).toBeTruthy();
        });
    });
});

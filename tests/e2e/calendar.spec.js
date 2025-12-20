/**
 * Calendar E2E Tests - STRICT VERSION
 * Tests will FAIL if UI elements are missing. App code must be fixed.
 */

const { test, expect } = require('@playwright/test');
const { helpers } = require('./test-utils');

test.describe('Calendar Module', () => {
    test.describe('Calendar Page', () => {
        test('should display calendar page', async ({ page }) => {
            await page.goto('/calendar');
            await helpers.waitForPageLoad(page);

            expect(page.url()).toContain('calendar');
            const header = page.locator('h1, h2, .calendar').first();
            await expect(header).toBeVisible();
        });

        test('should have Add Event button', async ({ page }) => {
            await page.goto('/calendar');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('button:has-text("Add"), button:has-text("New Event"), [data-bs-target*="Modal"]').first();
            await expect(addBtn).toBeVisible();
        });

        test('should display calendar grid or list', async ({ page }) => {
            await page.goto('/calendar');
            await helpers.waitForPageLoad(page);

            const calendar = page.locator('.calendar, .fc, table, .events-list, .card');
            const count = await calendar.count();
            expect(count).toBeGreaterThan(0);
        });
    });

    test.describe('Events', () => {
        test('should open add event modal', async ({ page }) => {
            await page.goto('/calendar');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('[data-bs-target="#addEventModal"], button:has-text("Add Event"), button:has-text("New Event")').first();
            await addBtn.click();
            await page.waitForTimeout(500);

            const modal = page.locator('.modal.show');
            await expect(modal).toBeVisible();
        });

        test('should have title field in event modal', async ({ page }) => {
            await page.goto('/calendar');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('[data-bs-target="#addEventModal"], button:has-text("Add Event"), button:has-text("New Event")').first();
            await addBtn.click();
            await page.waitForTimeout(500);

            const titleInput = page.locator('.modal.show input[name="title"]');
            await expect(titleInput).toBeVisible();
        });

        test('should have date field in event modal', async ({ page }) => {
            await page.goto('/calendar');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('[data-bs-target="#addEventModal"], button:has-text("Add Event"), button:has-text("New Event")').first();
            await addBtn.click();
            await page.waitForTimeout(500);

            const dateInput = page.locator('.modal.show input[name="start_date"], .modal.show input[name="date"], .modal.show input[type="date"]').first();
            await expect(dateInput).toBeVisible();
        });
    });

    test.describe('Tasks', () => {
        test('should navigate to tasks page', async ({ page }) => {
            await page.goto('/calendar/tasks');
            await helpers.waitForPageLoad(page);

            const url = page.url();
            expect(url.includes('task') || url.includes('calendar')).toBeTruthy();
        });

        test('should have Add Task button', async ({ page }) => {
            await page.goto('/calendar/tasks');
            await helpers.waitForPageLoad(page);

            const addBtn = page.locator('button:has-text("Add"), button:has-text("New Task"), [data-bs-target*="Modal"]').first();
            await expect(addBtn).toBeVisible();
        });

        test('should display tasks list', async ({ page }) => {
            await page.goto('/calendar/tasks');
            await helpers.waitForPageLoad(page);

            const tasks = page.locator('table, .task-list, .card, .list-group');
            const count = await tasks.count();
            expect(count).toBeGreaterThan(0);
        });
    });
});

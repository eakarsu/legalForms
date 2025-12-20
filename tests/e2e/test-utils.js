/**
 * Playwright Test Utilities
 * Helper functions for E2E tests
 */

const { expect } = require('@playwright/test');

// Test data generators
const testData = {
    // Generate unique test client
    generateClient: () => ({
        firstName: `Test${Date.now()}`,
        lastName: 'Client',
        email: `test${Date.now()}@example.com`,
        phone: '555-555-5555',
        company: `Test Company ${Date.now()}`
    }),

    // Generate unique test case
    generateCase: () => ({
        title: `Test Case ${Date.now()}`,
        caseNumber: `CASE-TEST-${Date.now()}`,
        caseType: 'litigation',
        description: 'Automated test case'
    }),

    // Generate unique lead
    generateLead: () => ({
        firstName: `Lead${Date.now()}`,
        lastName: 'Test',
        email: `lead${Date.now()}@example.com`,
        phone: '555-555-5556'
    }),

    // Generate intake form
    generateIntakeForm: () => ({
        name: `Test Form ${Date.now()}`,
        slug: `test-form-${Date.now()}`,
        description: 'Automated test form'
    }),

    // Generate deadline
    generateDeadline: () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);
        return {
            title: `Test Deadline ${Date.now()}`,
            dueDate: futureDate.toISOString().split('T')[0],
            type: 'filing'
        };
    },

    // Generate time entry
    generateTimeEntry: () => ({
        description: `Test Time Entry ${Date.now()}`,
        hours: 1,
        minutes: 30,
        rate: 250
    }),

    // Generate invoice
    generateInvoice: () => ({
        amount: 1000,
        description: `Test Invoice ${Date.now()}`
    })
};

// Helper functions
const helpers = {
    // Wait for page to be fully loaded
    async waitForPageLoad(page) {
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
    },

    // Click button and wait for response
    async clickAndWait(page, selector, options = {}) {
        const element = page.locator(selector).first();
        await element.click();
        if (options.waitForNavigation) {
            await page.waitForLoadState('networkidle');
        } else {
            await page.waitForTimeout(500);
        }
    },

    // Fill form field
    async fillField(page, selector, value) {
        const field = page.locator(selector).first();
        await field.fill(value);
    },

    // Select dropdown option
    async selectOption(page, selector, value) {
        const select = page.locator(selector).first();
        await select.selectOption(value);
    },

    // Check if element exists
    async elementExists(page, selector) {
        const count = await page.locator(selector).count();
        return count > 0;
    },

    // Get all visible buttons
    async getButtons(page) {
        return page.locator('button:visible, a.btn:visible');
    },

    // Wait for modal to open
    async waitForModal(page) {
        await page.waitForSelector('.modal.show', { timeout: 5000 });
        await page.waitForTimeout(300);
    },

    // Close modal
    async closeModal(page) {
        const closeBtn = page.locator('.modal.show .btn-close, .modal.show [data-bs-dismiss="modal"]').first();
        if (await closeBtn.count() > 0) {
            await closeBtn.click();
            await page.waitForTimeout(300);
        }
    },

    // Check for toast/alert message
    async checkMessage(page, type = 'success') {
        const alertSelector = `.alert-${type}, .toast`;
        try {
            await page.waitForSelector(alertSelector, { timeout: 3000 });
            return true;
        } catch {
            return false;
        }
    },

    // Navigate with retry
    async navigateWithRetry(page, url, maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
                return true;
            } catch (e) {
                if (i === maxRetries - 1) throw e;
                await page.waitForTimeout(1000);
            }
        }
    },

    // Check page has required elements
    async verifyPageElements(page, elements) {
        for (const selector of elements) {
            const exists = await this.elementExists(page, selector);
            expect(exists).toBeTruthy();
        }
    },

    // Fill and submit form
    async fillAndSubmitForm(page, formData, submitSelector = 'button[type="submit"]') {
        for (const [selector, value] of Object.entries(formData)) {
            const element = page.locator(selector).first();
            const tagName = await element.evaluate(el => el.tagName.toLowerCase());

            if (tagName === 'select') {
                await element.selectOption(value);
            } else if (tagName === 'input') {
                const type = await element.getAttribute('type');
                if (type === 'checkbox') {
                    if (value) await element.check();
                    else await element.uncheck();
                } else {
                    await element.fill(value);
                }
            } else {
                await element.fill(value);
            }
        }

        await page.locator(submitSelector).first().click();
        await page.waitForTimeout(1000);
    },

    // Check table has rows
    async tableHasRows(page, tableSelector = 'table tbody') {
        const rows = await page.locator(`${tableSelector} tr`).count();
        return rows > 0;
    },

    // Click row in table
    async clickTableRow(page, rowIndex = 0) {
        const row = page.locator('table tbody tr, .clickable-row').nth(rowIndex);
        if (await row.count() > 0) {
            await row.click();
            await page.waitForLoadState('networkidle');
        }
    },

    // Delete item with confirmation
    async deleteWithConfirmation(page, deleteSelector) {
        // Handle confirmation dialog
        page.on('dialog', async dialog => {
            await dialog.accept();
        });

        await page.locator(deleteSelector).first().click();
        await page.waitForTimeout(1000);
    }
};

// API helpers for direct testing
const api = {
    // Make authenticated API request
    async makeRequest(page, method, endpoint, data = null) {
        return await page.evaluate(async ({ method, endpoint, data }) => {
            const options = {
                method,
                headers: { 'Content-Type': 'application/json' }
            };
            if (data) options.body = JSON.stringify(data);

            const response = await fetch(endpoint, options);
            return await response.json();
        }, { method, endpoint, data });
    }
};

module.exports = {
    testData,
    helpers,
    api
};

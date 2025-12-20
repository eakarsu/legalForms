/**
 * Document Generator E2E Tests
 * Comprehensive tests for voice input, e-signature, DocuSign integration
 */

const { test, expect } = require('@playwright/test');
const { helpers } = require('./test-utils');

test.describe('Document Generator Module', () => {
    test.describe('Document Generator Page', () => {
        test('should display document generator page', async ({ page }) => {
            await page.goto('/form');
            await helpers.waitForPageLoad(page);

            const header = page.locator('h1, h2, .card-header').first();
            await expect(header).toBeVisible();
        });

        test('should have form type dropdown', async ({ page }) => {
            await page.goto('/form');
            await helpers.waitForPageLoad(page);

            const formTypeSelect = page.locator('#formType, select[name="formType"], select');
            const hasSelect = await formTypeSelect.count() > 0;
            expect(hasSelect).toBeTruthy();
        });

        test('should have Generate Document button', async ({ page }) => {
            await page.goto('/form');
            await helpers.waitForPageLoad(page);

            const generateBtn = page.locator('#generateBtn, button:has-text("Generate"), button.btn-primary').first();
            const hasBtn = await generateBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have Download DOCX button', async ({ page }) => {
            await page.goto('/form');
            await helpers.waitForPageLoad(page);

            const downloadBtn = page.locator('#downloadDocx, button:has-text("Download DOCX")').first();
            const hasBtn = await downloadBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have Download PDF button', async ({ page }) => {
            await page.goto('/form');
            await helpers.waitForPageLoad(page);

            const downloadBtn = page.locator('#downloadPdf, button:has-text("Download PDF")').first();
            const hasBtn = await downloadBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });
    });

    test.describe('Voice Input', () => {
        test('should have voice input button', async ({ page }) => {
            await page.goto('/form');
            await helpers.waitForPageLoad(page);

            const voiceBtn = page.locator('.btn-voice, button[onclick*="startVoice"], button:has-text("Voice"), .voice-input-btn');
            const hasBtn = await voiceBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have microphone icon', async ({ page }) => {
            await page.goto('/form');
            await helpers.waitForPageLoad(page);

            const micIcon = page.locator('.fa-microphone, .bi-mic, svg[class*="mic"], i[class*="microphone"]');
            const hasIcon = await micIcon.count() > 0;
            expect(hasIcon).toBeTruthy();
        });

        test('should have voice input toggle', async ({ page }) => {
            await page.goto('/form');
            await helpers.waitForPageLoad(page);

            const voiceToggle = page.locator('input[type="checkbox"][id*="voice"], .voice-toggle, button[aria-label*="voice"]');
            const hasToggle = await voiceToggle.count() > 0;
            expect(hasToggle).toBeTruthy();
        });
    });

    test.describe('E-Signature', () => {
        test('should have e-signature button', async ({ page }) => {
            await page.goto('/form');
            await helpers.waitForPageLoad(page);

            const signBtn = page.locator('#requestSignatureBtn, button:has-text("Signature"), button:has-text("Sign"), a:has-text("e-Sign")');
            const hasBtn = await signBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have DocuSign integration button', async ({ page }) => {
            await page.goto('/form');
            await helpers.waitForPageLoad(page);

            const docuSignBtn = page.locator('#sendToDocuSign, button:has-text("DocuSign"), a:has-text("DocuSign")');
            const hasBtn = await docuSignBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have signature pad or canvas', async ({ page }) => {
            await page.goto('/form');
            await helpers.waitForPageLoad(page);

            const signPad = page.locator('canvas.signature-pad, .signature-canvas, #signaturePad');
            const hasPad = await signPad.count() > 0;
            expect(hasPad).toBeTruthy();
        });

        test('should have Clear Signature button', async ({ page }) => {
            await page.goto('/form');
            await helpers.waitForPageLoad(page);

            const clearBtn = page.locator('button:has-text("Clear"), button[onclick*="clearSignature"]');
            const hasBtn = await clearBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });
    });

    test.describe('DocuSign Configuration', () => {
        test('should navigate to DocuSign settings', async ({ page }) => {
            await page.goto('/form');
            await helpers.waitForPageLoad(page);

            const settingsLink = page.locator('a[href*="docusign"], a:has-text("DocuSign Settings"), button:has-text("Configure DocuSign")');
            const hasLink = await settingsLink.count() > 0;
            expect(hasLink).toBeTruthy();
        });

        test('should have DocuSign setup modal trigger', async ({ page }) => {
            await page.goto('/form');
            await helpers.waitForPageLoad(page);

            const setupBtn = page.locator('[data-bs-target="#docuSignModal"], button[onclick*="showDocuSignSetup"]');
            const hasBtn = await setupBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });
    });

    test.describe('Form Fields', () => {
        test('should have client name input', async ({ page }) => {
            await page.goto('/form');
            await helpers.waitForPageLoad(page);

            const nameInput = page.locator('input[name*="client"], input[name*="name"], input[id*="clientName"]');
            const hasInput = await nameInput.count() > 0;
            expect(hasInput).toBeTruthy();
        });

        test('should have date input', async ({ page }) => {
            await page.goto('/form');
            await helpers.waitForPageLoad(page);

            const dateInput = page.locator('input[type="date"], input[name*="date"]');
            const hasInput = await dateInput.count() > 0;
            expect(hasInput).toBeTruthy();
        });

        test('should have email input for signer', async ({ page }) => {
            await page.goto('/form');
            await helpers.waitForPageLoad(page);

            const emailInput = page.locator('input[type="email"], input[name*="email"]');
            const hasInput = await emailInput.count() > 0;
            expect(hasInput).toBeTruthy();
        });

        test('should have document preview area', async ({ page }) => {
            await page.goto('/form');
            await helpers.waitForPageLoad(page);

            const preview = page.locator('#documentPreview, .document-preview, .preview-area, #outputArea');
            const hasPreview = await preview.count() > 0;
            expect(hasPreview).toBeTruthy();
        });
    });

    test.describe('Form Actions', () => {
        test('should have Reset Form button', async ({ page }) => {
            await page.goto('/form');
            await helpers.waitForPageLoad(page);

            const resetBtn = page.locator('button[type="reset"], button:has-text("Reset"), button:has-text("Clear Form")');
            const hasBtn = await resetBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have Save Draft button', async ({ page }) => {
            await page.goto('/form');
            await helpers.waitForPageLoad(page);

            const saveBtn = page.locator('button:has-text("Save Draft"), button:has-text("Save"), button[onclick*="saveDraft"]');
            const hasBtn = await saveBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have Print button', async ({ page }) => {
            await page.goto('/form');
            await helpers.waitForPageLoad(page);

            const printBtn = page.locator('button:has-text("Print"), button[onclick*="print"], #printBtn');
            const hasBtn = await printBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });

        test('should have Copy to Clipboard button', async ({ page }) => {
            await page.goto('/form');
            await helpers.waitForPageLoad(page);

            const copyBtn = page.locator('button:has-text("Copy"), button[onclick*="copy"], #copyBtn');
            const hasBtn = await copyBtn.count() > 0;
            expect(hasBtn).toBeTruthy();
        });
    });
});

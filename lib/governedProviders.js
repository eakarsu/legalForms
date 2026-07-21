'use strict';

const { WorkflowError, sha256, stableStringify } = require('./governedDocumentWorkflow');

const OPERATIONS = new Set([
    'STORAGE_VERIFY',
    'OCR_EXTRACT',
    'ESIGN_CREATE',
    'ESIGN_STATUS',
    'FILING_SUBMIT',
    'STORAGE_DELETE'
]);

const SERVICE_BY_OPERATION = {
    STORAGE_VERIFY: 'storage',
    OCR_EXTRACT: 'ocr',
    ESIGN_CREATE: 'esign',
    ESIGN_STATUS: 'esign',
    FILING_SUBMIT: 'filing',
    STORAGE_DELETE: 'storage'
};

const ALLOWED_STATUSES = {
    STORAGE_VERIFY: new Set(['SUCCEEDED', 'FAILED']),
    OCR_EXTRACT: new Set(['SUCCEEDED', 'FAILED']),
    ESIGN_CREATE: new Set(['PENDING', 'COMPLETED', 'FAILED']),
    ESIGN_STATUS: new Set(['PENDING', 'COMPLETED', 'FAILED']),
    FILING_SUBMIT: new Set(['PENDING', 'SUCCEEDED', 'FAILED']),
    STORAGE_DELETE: new Set(['SUCCEEDED', 'FAILED'])
};

function requireProviderText(value, field, maximum = 500) {
    if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > maximum) {
        throw new WorkflowError(502, 'INVALID_PROVIDER_RESPONSE', `${field} is missing or invalid`);
    }
    return value.trim();
}

function requireProviderHash(value, field) {
    if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
        throw new WorkflowError(502, 'INVALID_PROVIDER_RESPONSE', `${field} must be a lowercase SHA-256 digest`);
    }
    return value;
}

function requireProviderTimestamp(value) {
    const parsed = typeof value === 'string' ? new Date(value) : new Date(NaN);
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() > Date.now() + 5 * 60 * 1000) {
        throw new WorkflowError(502, 'INVALID_PROVIDER_RESPONSE', 'occurredAt must be a valid non-future timestamp');
    }
    return parsed.toISOString();
}

function normalizeReceiptUri(value) {
    if (value == null) return null;
    let parsed;
    try {
        parsed = new URL(requireProviderText(value, 'receiptUri', 2000));
    } catch (error) {
        if (error instanceof WorkflowError) throw error;
        throw new WorkflowError(502, 'INVALID_PROVIDER_RESPONSE', 'receiptUri must be an HTTPS or s3 reference');
    }
    if (!['https:', 's3:'].includes(parsed.protocol) || parsed.username || parsed.password || !parsed.hostname || parsed.pathname === '/') {
        throw new WorkflowError(502, 'INVALID_PROVIDER_RESPONSE', 'receiptUri must identify an external evidence object');
    }
    return parsed.toString();
}

function normalizeProviderResult(operation, value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new WorkflowError(502, 'INVALID_PROVIDER_RESPONSE', 'Provider response must be a JSON object');
    }
    const status = String(value.status || '').toUpperCase();
    if (!ALLOWED_STATUSES[operation]?.has(status)) {
        throw new WorkflowError(502, 'INVALID_PROVIDER_RESPONSE', `Invalid ${operation} status`);
    }
    const result = {
        provider: requireProviderText(value.provider, 'provider', 200),
        externalEventId: requireProviderText(value.externalEventId, 'externalEventId', 300),
        status,
        occurredAt: requireProviderTimestamp(value.occurredAt),
        receiptUri: normalizeReceiptUri(value.receiptUri),
        evidenceSha256: requireProviderHash(value.evidenceSha256, 'evidenceSha256'),
        outputSha256: value.outputSha256 == null ? null : requireProviderHash(value.outputSha256, 'outputSha256')
    };
    if (['FILING_SUBMIT', 'STORAGE_DELETE'].includes(operation) && result.status === 'SUCCEEDED' && !result.receiptUri) {
        throw new WorkflowError(502, 'INVALID_PROVIDER_RESPONSE', `${operation} success requires receiptUri`);
    }
    if (operation === 'OCR_EXTRACT' && result.status === 'SUCCEEDED' && !result.outputSha256) {
        throw new WorkflowError(502, 'INVALID_PROVIDER_RESPONSE', 'OCR_EXTRACT success requires outputSha256');
    }
    return result;
}

class GovernedProviderClient {
    constructor(services, options = {}) {
        this.services = services || {};
        this.fetch = options.fetch || globalThis.fetch;
        this.timeoutMs = options.timeoutMs || 10_000;
        this.maxResponseBytes = options.maxResponseBytes || 256 * 1024;
        if (typeof this.fetch !== 'function') throw new TypeError('A fetch implementation is required');
    }

    async execute(operation, payload, idempotencyKey) {
        if (!OPERATIONS.has(operation)) throw new TypeError(`Unsupported provider operation: ${operation}`);
        const serviceName = SERVICE_BY_OPERATION[operation];
        const service = this.services[serviceName];
        if (!service?.url || !service?.token) {
            throw new WorkflowError(503, 'PROVIDER_NOT_CONFIGURED', `${serviceName} provider is not configured`);
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        let response;
        try {
            response = await this.fetch(service.url, {
                method: 'POST',
                redirect: 'error',
                signal: controller.signal,
                headers: {
                    Authorization: `Bearer ${service.token}`,
                    'Content-Type': 'application/json',
                    'Idempotency-Key': idempotencyKey
                },
                body: stableStringify({ operation, payload })
            });
        } catch (error) {
            const code = error?.name === 'AbortError' ? 'PROVIDER_TIMEOUT' : 'PROVIDER_UNAVAILABLE';
            throw new WorkflowError(502, code, `${serviceName} provider request failed`);
        } finally {
            clearTimeout(timer);
        }
        const length = Number(response.headers.get('content-length') || 0);
        if (length > this.maxResponseBytes) {
            throw new WorkflowError(502, 'PROVIDER_RESPONSE_TOO_LARGE', 'Provider response exceeds the evidence limit');
        }
        const text = await response.text();
        if (Buffer.byteLength(text) > this.maxResponseBytes) {
            throw new WorkflowError(502, 'PROVIDER_RESPONSE_TOO_LARGE', 'Provider response exceeds the evidence limit');
        }
        if (!response.ok) {
            throw new WorkflowError(502, 'PROVIDER_REJECTED', `${serviceName} provider returned HTTP ${response.status}`);
        }
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (_) {
            throw new WorkflowError(502, 'INVALID_PROVIDER_RESPONSE', 'Provider response is not valid JSON');
        }
        const result = normalizeProviderResult(operation, parsed);
        if (result.evidenceSha256 !== sha256(stableStringify({ operation, payload, result: {
            provider: result.provider,
            externalEventId: result.externalEventId,
            status: result.status,
            occurredAt: result.occurredAt,
            receiptUri: result.receiptUri,
            outputSha256: result.outputSha256
        } }))) {
            throw new WorkflowError(502, 'PROVIDER_EVIDENCE_MISMATCH', 'Provider evidence digest does not match its signed result envelope');
        }
        return result;
    }
}

module.exports = {
    GovernedProviderClient,
    normalizeProviderResult,
    OPERATIONS,
    SERVICE_BY_OPERATION
};

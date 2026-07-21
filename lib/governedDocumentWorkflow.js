'use strict';

const crypto = require('crypto');

const ZERO_HASH = '0'.repeat(64);
const ACCESS_ROLES = new Set(['AUTHOR', 'LEGAL_REVIEWER', 'RECORDS_MANAGER']);
const DECISIONS = new Set(['APPROVE', 'REJECT']);
const REDACTION_STATES = new Set(['NOT_REQUIRED', 'REDACTED']);
const PROVIDER_OPERATIONS = new Set([
    'STORAGE_VERIFY', 'OCR_EXTRACT', 'ESIGN_CREATE', 'ESIGN_STATUS',
    'FILING_SUBMIT', 'STORAGE_DELETE'
]);

class WorkflowError extends Error {
    constructor(status, code, message, details) {
        super(message);
        this.name = 'WorkflowError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

function canonicalize(value) {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === 'object') {
        return Object.keys(value).sort().reduce((result, key) => {
            result[key] = canonicalize(value[key]);
            return result;
        }, {});
    }
    return value;
}

function stableStringify(value) {
    return JSON.stringify(canonicalize(value));
}

function sha256(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function requireUuid(value, fieldName) {
    if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
        throw new WorkflowError(400, 'INVALID_IDENTIFIER', `${fieldName} must be a UUID`);
    }
    return value.toLowerCase();
}

function requireInteger(value, fieldName, minimum = 0) {
    if (!Number.isInteger(value) || value < minimum) {
        throw new WorkflowError(400, 'INVALID_INTEGER', `${fieldName} must be an integer greater than or equal to ${minimum}`);
    }
    return value;
}

function requireText(value, fieldName, maxLength, { minLength = 1 } = {}) {
    if (typeof value !== 'string') {
        throw new WorkflowError(400, 'INVALID_TEXT', `${fieldName} must be text`);
    }
    const normalized = value.trim();
    if (normalized.length < minLength || normalized.length > maxLength) {
        throw new WorkflowError(400, 'INVALID_TEXT', `${fieldName} must be between ${minLength} and ${maxLength} characters`);
    }
    return normalized;
}

function requireDate(value, fieldName) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new WorkflowError(400, 'INVALID_DATE', `${fieldName} must use YYYY-MM-DD`);
    }
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
        throw new WorkflowError(400, 'INVALID_DATE', `${fieldName} is not a calendar date`);
    }
    return value;
}

function requireTimestamp(value, fieldName) {
    if (typeof value !== 'string') {
        throw new WorkflowError(400, 'INVALID_TIMESTAMP', `${fieldName} must be an ISO-8601 timestamp`);
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new WorkflowError(400, 'INVALID_TIMESTAMP', `${fieldName} must be an ISO-8601 timestamp`);
    }
    return parsed.toISOString();
}

function requireHash(value, fieldName) {
    if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
        throw new WorkflowError(400, 'INVALID_SHA256', `${fieldName} must be a lowercase SHA-256 digest`);
    }
    return value;
}

function requireJurisdiction(value) {
    const normalized = requireText(value, 'jurisdiction', 16).toUpperCase();
    if (!/^[A-Z]{2}(-[A-Z0-9]{2,3})?$/.test(normalized)) {
        throw new WorkflowError(400, 'INVALID_JURISDICTION', 'jurisdiction must look like US or US-NY');
    }
    return normalized;
}

function requireIdempotencyKey(value) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(value)) {
        throw new WorkflowError(400, 'INVALID_IDEMPOTENCY_KEY', 'Idempotency-Key must be 8-128 safe characters');
    }
    return value;
}

function toDateString(value) {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
}

function toTimestamp(value) {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapDocument(row) {
    return {
        id: row.id,
        matterId: row.matter_id,
        title: row.title,
        jurisdiction: row.jurisdiction,
        status: row.status,
        currentVersion: row.current_version,
        retentionUntil: toDateString(row.retention_until),
        legalHold: row.legal_hold,
        legalHoldReason: row.legal_hold_reason,
        disposedAt: row.disposed_at ? toTimestamp(row.disposed_at) : null,
        disposedBy: row.disposed_by,
        createdBy: row.created_by,
        createdAt: toTimestamp(row.created_at),
        updatedAt: toTimestamp(row.updated_at)
    };
}

function mapVersion(row) {
    return {
        id: row.id,
        documentId: row.document_id,
        versionNumber: row.version_number,
        jurisdiction: row.jurisdiction,
        effectiveFrom: toDateString(row.effective_from),
        effectiveTo: row.effective_to ? toDateString(row.effective_to) : null,
        templateAuthority: row.template_authority,
        sourceUri: row.source_uri,
        sourceSha256: row.source_sha256,
        sourceRetrievedAt: toTimestamp(row.source_retrieved_at),
        storageUri: row.storage_uri,
        contentSha256: row.content_sha256,
        redactionStatus: row.redaction_status,
        redactionNote: row.redaction_note,
        createdBy: row.created_by,
        createdAt: toTimestamp(row.created_at)
    };
}

function mapReview(row) {
    return {
        id: row.id,
        documentId: row.document_id,
        versionNumber: row.version_number,
        reviewerId: row.reviewer_id,
        decision: row.decision,
        reviewerJurisdiction: row.reviewer_jurisdiction,
        legalAttestation: row.legal_attestation,
        jurisdictionConfirmed: row.jurisdiction_confirmed,
        notes: row.notes,
        decidedAt: toTimestamp(row.decided_at)
    };
}

function mapAudit(row) {
    return {
        sequence: Number(row.sequence),
        id: row.id,
        matterId: row.matter_id,
        documentId: row.document_id,
        actorId: row.actor_id,
        eventType: row.event_type,
        eventPayload: row.event_payload,
        occurredAt: toTimestamp(row.occurred_at),
        previousHash: row.previous_hash,
        eventHash: row.event_hash
    };
}

function mapProviderEvent(row) {
    return {
        id: row.id,
        sequence: Number(row.sequence),
        documentId: row.document_id,
        versionNumber: row.version_number,
        operation: row.operation,
        provider: row.provider,
        externalEventId: row.external_event_id,
        status: row.status,
        requestSha256: row.request_sha256,
        responseSha256: row.response_sha256,
        receiptUri: row.receipt_uri,
        evidenceSha256: row.evidence_sha256,
        outputSha256: row.output_sha256,
        occurredAt: toTimestamp(row.occurred_at),
        createdBy: row.created_by,
        createdAt: toTimestamp(row.created_at)
    };
}

function mapPostgresError(error) {
    if (error instanceof WorkflowError) return error;
    if (error && error.code === '23505') {
        return new WorkflowError(409, 'CONFLICT', 'The requested state already exists');
    }
    if (error && ['23503', '23514', '22P02'].includes(error.code)) {
        return new WorkflowError(400, 'INVALID_REFERENCE', 'The request violates a governed data constraint');
    }
    if (error && error.code === '55000') {
        return new WorkflowError(409, 'IMMUTABLE_EVIDENCE', error.message);
    }
    return error;
}

class GovernedDocumentWorkflow {
    constructor(pool, options = {}) {
        if (!pool || typeof pool.connect !== 'function') {
            throw new TypeError('A PostgreSQL pool is required');
        }
        this.pool = pool;
        this.allowedSourceHosts = new Set((options.allowedSourceHosts || []).map(host => host.toLowerCase()));
        this.minRetentionDays = Number.isInteger(options.minRetentionDays) ? options.minRetentionDays : 30;
        this.providerClient = options.providerClient || null;
        if (this.allowedSourceHosts.size === 0) {
            throw new Error('At least one governed template source host is required');
        }
    }

    _normalizeProviderParameters(operation, value) {
        const parameters = value == null ? {} : value;
        if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
            throw new WorkflowError(400, 'INVALID_PROVIDER_PARAMETERS', 'parameters must be an object');
        }
        if (operation === 'ESIGN_CREATE') {
            if (!Array.isArray(parameters.signers) || parameters.signers.length < 1 || parameters.signers.length > 20) {
                throw new WorkflowError(400, 'INVALID_SIGNERS', 'ESIGN_CREATE requires between 1 and 20 signers');
            }
            return {
                signers: parameters.signers.map((signer, index) => {
                    const name = requireText(signer?.name, `signers[${index}].name`, 200);
                    const email = requireText(signer?.email, `signers[${index}].email`, 320).toLowerCase();
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                        throw new WorkflowError(400, 'INVALID_SIGNER_EMAIL', `signers[${index}].email is invalid`);
                    }
                    return { name, email };
                })
            };
        }
        if (operation === 'FILING_SUBMIT') {
            return { destination: requireText(parameters.destination, 'parameters.destination', 300) };
        }
        if (operation === 'STORAGE_DELETE') {
            return { reason: requireText(parameters.reason, 'parameters.reason', 500) };
        }
        if (Object.keys(parameters).length > 0) {
            throw new WorkflowError(400, 'UNEXPECTED_PROVIDER_PARAMETERS', `${operation} does not accept parameters`);
        }
        return {};
    }

    _validateProviderResult(operation, value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            throw new WorkflowError(502, 'INVALID_PROVIDER_RESPONSE', 'Provider response must be an object');
        }
        const allowedStatuses = {
            STORAGE_VERIFY: ['SUCCEEDED', 'FAILED'],
            OCR_EXTRACT: ['SUCCEEDED', 'FAILED'],
            ESIGN_CREATE: ['PENDING', 'COMPLETED', 'FAILED'],
            ESIGN_STATUS: ['PENDING', 'COMPLETED', 'FAILED'],
            FILING_SUBMIT: ['PENDING', 'SUCCEEDED', 'FAILED'],
            STORAGE_DELETE: ['SUCCEEDED', 'FAILED']
        };
        const status = String(value.status || '').toUpperCase();
        if (!allowedStatuses[operation].includes(status)) {
            throw new WorkflowError(502, 'INVALID_PROVIDER_RESPONSE', `Invalid ${operation} status`);
        }
        const occurredAt = requireTimestamp(value.occurredAt, 'provider.occurredAt');
        if (new Date(occurredAt).getTime() > Date.now() + 5 * 60 * 1000) {
            throw new WorkflowError(502, 'INVALID_PROVIDER_RESPONSE', 'Provider timestamp cannot be in the future');
        }
        let receiptUri = null;
        if (value.receiptUri != null) receiptUri = this._normalizeStorageUri(value.receiptUri);
        const result = {
            provider: requireText(value.provider, 'provider.provider', 200),
            externalEventId: requireText(value.externalEventId, 'provider.externalEventId', 300),
            status,
            occurredAt,
            receiptUri,
            evidenceSha256: requireHash(value.evidenceSha256, 'provider.evidenceSha256'),
            outputSha256: value.outputSha256 == null ? null : requireHash(value.outputSha256, 'provider.outputSha256')
        };
        if (['FILING_SUBMIT', 'STORAGE_DELETE'].includes(operation) && status === 'SUCCEEDED' && !receiptUri) {
            throw new WorkflowError(502, 'INVALID_PROVIDER_RESPONSE', `${operation} success requires a receiptUri`);
        }
        if (operation === 'OCR_EXTRACT' && status === 'SUCCEEDED' && !result.outputSha256) {
            throw new WorkflowError(502, 'INVALID_PROVIDER_RESPONSE', 'OCR success requires an output digest');
        }
        return result;
    }

    _normalizeSourceUri(value) {
        let parsed;
        try {
            parsed = new URL(requireText(value, 'sourceUri', 2000));
        } catch (error) {
            if (error instanceof WorkflowError) throw error;
            throw new WorkflowError(400, 'INVALID_SOURCE_URI', 'sourceUri must be an HTTPS URL');
        }
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !this.allowedSourceHosts.has(parsed.hostname.toLowerCase())) {
            throw new WorkflowError(422, 'SOURCE_NOT_GOVERNED', 'sourceUri must use an allowed HTTPS template authority host');
        }
        return parsed.toString();
    }

    _normalizeStorageUri(value) {
        let parsed;
        try {
            parsed = new URL(requireText(value, 'storageUri', 2000));
        } catch (error) {
            if (error instanceof WorkflowError) throw error;
            throw new WorkflowError(400, 'INVALID_STORAGE_URI', 'storageUri must be an s3:// or HTTPS reference');
        }
        if (!['s3:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || !parsed.hostname || parsed.pathname === '/') {
            throw new WorkflowError(400, 'INVALID_STORAGE_URI', 'storageUri must identify a concrete object without embedded credentials');
        }
        return parsed.toString();
    }

    _normalizeVersion(input) {
        if (!input || typeof input !== 'object' || Array.isArray(input)) {
            throw new WorkflowError(400, 'INVALID_VERSION', 'version must be an object');
        }
        const effectiveFrom = requireDate(input.effectiveFrom, 'effectiveFrom');
        const effectiveTo = input.effectiveTo == null ? null : requireDate(input.effectiveTo, 'effectiveTo');
        if (effectiveTo && effectiveTo < effectiveFrom) {
            throw new WorkflowError(400, 'INVALID_EFFECTIVE_RANGE', 'effectiveTo cannot precede effectiveFrom');
        }
        const sourceRetrievedAt = requireTimestamp(input.sourceRetrievedAt, 'sourceRetrievedAt');
        if (new Date(sourceRetrievedAt).getTime() > Date.now() + 5 * 60 * 1000) {
            throw new WorkflowError(400, 'FUTURE_SOURCE_EVIDENCE', 'sourceRetrievedAt cannot be in the future');
        }
        const redactionStatus = String(input.redactionStatus || 'NOT_REQUIRED').toUpperCase();
        if (!REDACTION_STATES.has(redactionStatus)) {
            throw new WorkflowError(400, 'INVALID_REDACTION_STATUS', 'redactionStatus must be NOT_REQUIRED or REDACTED');
        }
        const redactionNote = input.redactionNote == null ? null : requireText(input.redactionNote, 'redactionNote', 1000);
        if (redactionStatus === 'REDACTED' && !redactionNote) {
            throw new WorkflowError(400, 'REDACTION_EVIDENCE_REQUIRED', 'redacted versions require a redactionNote');
        }
        if (redactionStatus === 'NOT_REQUIRED' && redactionNote) {
            throw new WorkflowError(400, 'UNEXPECTED_REDACTION_NOTE', 'redactionNote is only valid for REDACTED versions');
        }
        return {
            jurisdiction: requireJurisdiction(input.jurisdiction),
            effectiveFrom,
            effectiveTo,
            templateAuthority: requireText(input.templateAuthority, 'templateAuthority', 300),
            sourceUri: this._normalizeSourceUri(input.sourceUri),
            sourceSha256: requireHash(input.sourceSha256, 'sourceSha256'),
            sourceRetrievedAt,
            storageUri: this._normalizeStorageUri(input.storageUri),
            contentSha256: requireHash(input.contentSha256, 'contentSha256'),
            redactionStatus,
            redactionNote
        };
    }

    async _mutate(actorId, operation, idempotencyKey, request, work) {
        const actor = requireUuid(actorId, 'actorId');
        const key = requireIdempotencyKey(idempotencyKey);
        const requestHash = sha256(stableStringify(request));
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${actor}:${operation}:${key}`]);
            const existing = await client.query(
                `SELECT request_sha256, response_status, response_body
                 FROM governed_document_idempotency
                 WHERE actor_id = $1 AND operation = $2 AND idempotency_key = $3`,
                [actor, operation, key]
            );
            if (existing.rows.length > 0) {
                const replay = existing.rows[0];
                if (replay.request_sha256 !== requestHash) {
                    throw new WorkflowError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency-Key was already used for a different request');
                }
                await client.query('COMMIT');
                return { status: replay.response_status, body: replay.response_body, replayed: true };
            }

            const result = await work(client, actor);
            const status = result.status || 200;
            const body = canonicalize(result.body);
            await client.query(
                `INSERT INTO governed_document_idempotency
                    (actor_id, operation, idempotency_key, request_sha256, response_status, response_body)
                 VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
                [actor, operation, key, requestHash, status, JSON.stringify(body)]
            );
            await client.query('COMMIT');
            return { status, body, replayed: false };
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            throw mapPostgresError(error);
        } finally {
            client.release();
        }
    }

    async _matter(client, matterId, forUpdate = false) {
        const id = requireUuid(matterId, 'matterId');
        const result = await client.query(
            `SELECT id, user_id, title, status FROM cases WHERE id = $1${forUpdate ? ' FOR UPDATE' : ''}`,
            [id]
        );
        if (result.rows.length === 0) {
            throw new WorkflowError(404, 'MATTER_NOT_FOUND', 'Matter not found');
        }
        return result.rows[0];
    }

    async _assertMatterOwner(client, matterId, actorId) {
        const matter = await this._matter(client, matterId);
        if (matter.user_id !== actorId) {
            throw new WorkflowError(403, 'MATTER_OWNER_REQUIRED', 'Only the matter owner can manage access');
        }
        return matter;
    }

    async _assertMatterAccess(client, matterId, actorId, roles, { ownerAllowed = true } = {}) {
        const matter = await this._matter(client, matterId);
        if (ownerAllowed && matter.user_id === actorId) return matter;
        const result = await client.query(
            `SELECT access_role FROM governed_matter_access
             WHERE matter_id = $1 AND user_id = $2 AND access_role = ANY($3::text[]) AND revoked_at IS NULL
             LIMIT 1`,
            [matter.id, actorId, roles]
        );
        if (result.rows.length === 0) {
            throw new WorkflowError(403, 'MATTER_ACCESS_DENIED', 'Active matter permission is required');
        }
        return matter;
    }

    async _document(client, documentId, forUpdate = false) {
        const id = requireUuid(documentId, 'documentId');
        const result = await client.query(
            `SELECT d.*, c.user_id AS matter_owner_id
             FROM governed_documents d JOIN cases c ON c.id = d.matter_id
             WHERE d.id = $1${forUpdate ? ' FOR UPDATE OF d' : ''}`,
            [id]
        );
        if (result.rows.length === 0) {
            throw new WorkflowError(404, 'DOCUMENT_NOT_FOUND', 'Governed document not found');
        }
        return result.rows[0];
    }

    async _appendAudit(client, { matterId, documentId = null, actorId, eventType, payload }) {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`governed-audit:${matterId}`]);
        const previousResult = await client.query(
            `SELECT event_hash FROM governed_document_audit_events
             WHERE matter_id = $1 ORDER BY sequence DESC LIMIT 1`,
            [matterId]
        );
        const previousHash = previousResult.rows[0]?.event_hash || ZERO_HASH;
        const id = crypto.randomUUID();
        const occurredAt = new Date().toISOString();
        const normalizedPayload = canonicalize(payload);
        const hashInput = {
            id,
            matterId,
            documentId,
            actorId,
            eventType,
            eventPayload: normalizedPayload,
            occurredAt,
            previousHash
        };
        const eventHash = sha256(stableStringify(hashInput));
        const inserted = await client.query(
            `INSERT INTO governed_document_audit_events
                (id, matter_id, document_id, actor_id, event_type, event_payload, occurred_at, previous_hash, event_hash)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
             RETURNING *`,
            [id, matterId, documentId, actorId, eventType, JSON.stringify(normalizedPayload), occurredAt, previousHash, eventHash]
        );
        return mapAudit(inserted.rows[0]);
    }

    _verifyAuditRows(rows) {
        let previousHash = ZERO_HASH;
        for (const row of rows) {
            const event = mapAudit(row);
            const expected = sha256(stableStringify({
                id: event.id,
                matterId: event.matterId,
                documentId: event.documentId,
                actorId: event.actorId,
                eventType: event.eventType,
                eventPayload: event.eventPayload,
                occurredAt: event.occurredAt,
                previousHash
            }));
            if (event.previousHash !== previousHash || event.eventHash !== expected) {
                return { valid: false, failedSequence: event.sequence };
            }
            previousHash = event.eventHash;
        }
        return { valid: true, failedSequence: null, eventCount: rows.length, headHash: previousHash };
    }

    async grantAccess(actorId, matterId, input, idempotencyKey) {
        const normalized = {
            matterId: requireUuid(matterId, 'matterId'),
            userId: requireUuid(input?.userId, 'userId'),
            role: String(input?.role || '').toUpperCase()
        };
        if (!ACCESS_ROLES.has(normalized.role)) {
            throw new WorkflowError(400, 'INVALID_ACCESS_ROLE', 'role must be AUTHOR, LEGAL_REVIEWER, or RECORDS_MANAGER');
        }
        return this._mutate(actorId, 'GRANT_MATTER_ACCESS', idempotencyKey, normalized, async (client, actor) => {
            await this._assertMatterOwner(client, normalized.matterId, actor);
            const user = await client.query('SELECT id FROM users WHERE id = $1', [normalized.userId]);
            if (user.rows.length === 0) throw new WorkflowError(404, 'USER_NOT_FOUND', 'User not found');
            const inserted = await client.query(
                `INSERT INTO governed_matter_access (matter_id, user_id, access_role, granted_by)
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [normalized.matterId, normalized.userId, normalized.role, actor]
            );
            const grant = inserted.rows[0];
            await this._appendAudit(client, {
                matterId: normalized.matterId,
                actorId: actor,
                eventType: 'MATTER_ACCESS_GRANTED',
                payload: { grantId: grant.id, userId: normalized.userId, role: normalized.role }
            });
            return {
                status: 201,
                body: {
                    grant: {
                        id: grant.id,
                        matterId: grant.matter_id,
                        userId: grant.user_id,
                        role: grant.access_role,
                        grantedBy: grant.granted_by,
                        grantedAt: toTimestamp(grant.granted_at),
                        revokedAt: null
                    }
                }
            };
        });
    }

    async revokeAccess(actorId, matterId, grantId, input, idempotencyKey) {
        const normalized = {
            matterId: requireUuid(matterId, 'matterId'),
            grantId: requireUuid(grantId, 'grantId'),
            reason: requireText(input?.reason, 'reason', 500)
        };
        return this._mutate(actorId, 'REVOKE_MATTER_ACCESS', idempotencyKey, normalized, async (client, actor) => {
            await this._assertMatterOwner(client, normalized.matterId, actor);
            const updated = await client.query(
                `UPDATE governed_matter_access
                 SET revoked_by = $1, revoked_at = CURRENT_TIMESTAMP
                 WHERE id = $2 AND matter_id = $3 AND revoked_at IS NULL
                 RETURNING *`,
                [actor, normalized.grantId, normalized.matterId]
            );
            if (updated.rows.length === 0) {
                throw new WorkflowError(404, 'ACTIVE_GRANT_NOT_FOUND', 'Active matter grant not found');
            }
            const grant = updated.rows[0];
            await this._appendAudit(client, {
                matterId: normalized.matterId,
                actorId: actor,
                eventType: 'MATTER_ACCESS_REVOKED',
                payload: { grantId: grant.id, userId: grant.user_id, role: grant.access_role, reason: normalized.reason }
            });
            return { status: 200, body: { revoked: true, grantId: grant.id, revokedAt: toTimestamp(grant.revoked_at) } };
        });
    }

    async createDocument(actorId, input, idempotencyKey) {
        const matterId = requireUuid(input?.matterId, 'matterId');
        const jurisdiction = requireJurisdiction(input?.jurisdiction);
        const retentionUntil = requireDate(input?.retentionUntil, 'retentionUntil');
        const minimumRetention = new Date();
        minimumRetention.setUTCHours(0, 0, 0, 0);
        minimumRetention.setUTCDate(minimumRetention.getUTCDate() + this.minRetentionDays);
        if (retentionUntil < minimumRetention.toISOString().slice(0, 10)) {
            throw new WorkflowError(400, 'RETENTION_TOO_SHORT', `retentionUntil must be at least ${this.minRetentionDays} days from today`);
        }
        const version = this._normalizeVersion(input?.version);
        if (version.jurisdiction !== jurisdiction) {
            throw new WorkflowError(400, 'JURISDICTION_MISMATCH', 'Document and version jurisdiction must match');
        }
        const normalized = {
            matterId,
            title: requireText(input?.title, 'title', 300),
            jurisdiction,
            retentionUntil,
            version
        };
        return this._mutate(actorId, 'CREATE_GOVERNED_DOCUMENT', idempotencyKey, normalized, async (client, actor) => {
            await this._assertMatterAccess(client, matterId, actor, ['AUTHOR']);
            const documentResult = await client.query(
                `INSERT INTO governed_documents
                    (matter_id, title, jurisdiction, current_version, retention_until, created_by)
                 VALUES ($1, $2, $3, 1, $4, $5) RETURNING *`,
                [matterId, normalized.title, jurisdiction, retentionUntil, actor]
            );
            const document = documentResult.rows[0];
            const versionResult = await client.query(
                `INSERT INTO governed_document_versions
                    (document_id, version_number, jurisdiction, effective_from, effective_to,
                     template_authority, source_uri, source_sha256, source_retrieved_at,
                     storage_uri, content_sha256, redaction_status, redaction_note, created_by)
                 VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                 RETURNING *`,
                [document.id, version.jurisdiction, version.effectiveFrom, version.effectiveTo,
                    version.templateAuthority, version.sourceUri, version.sourceSha256, version.sourceRetrievedAt,
                    version.storageUri, version.contentSha256, version.redactionStatus, version.redactionNote, actor]
            );
            const mappedVersion = mapVersion(versionResult.rows[0]);
            await this._appendAudit(client, {
                matterId,
                documentId: document.id,
                actorId: actor,
                eventType: 'DOCUMENT_CREATED',
                payload: {
                    title: document.title,
                    jurisdiction,
                    retentionUntil,
                    versionNumber: 1,
                    sourceUri: mappedVersion.sourceUri,
                    sourceSha256: mappedVersion.sourceSha256,
                    contentSha256: mappedVersion.contentSha256,
                    redactionStatus: mappedVersion.redactionStatus
                }
            });
            return { status: 201, body: { document: mapDocument(document), version: mappedVersion } };
        });
    }

    async addVersion(actorId, documentId, input, idempotencyKey) {
        const normalized = {
            documentId: requireUuid(documentId, 'documentId'),
            expectedVersion: requireInteger(input?.expectedVersion, 'expectedVersion', 1),
            version: this._normalizeVersion(input?.version)
        };
        return this._mutate(actorId, 'ADD_GOVERNED_DOCUMENT_VERSION', idempotencyKey, normalized, async (client, actor) => {
            const document = await this._document(client, normalized.documentId, true);
            await this._assertMatterAccess(client, document.matter_id, actor, ['AUTHOR']);
            if (document.current_version !== normalized.expectedVersion) {
                throw new WorkflowError(409, 'VERSION_CONFLICT', 'expectedVersion does not match the current version', {
                    expectedVersion: normalized.expectedVersion,
                    currentVersion: document.current_version
                });
            }
            if (document.status === 'PENDING_REVIEW' || document.status === 'DISPOSED') {
                throw new WorkflowError(409, 'INVALID_DOCUMENT_STATE', 'A new version cannot be added in the current state');
            }
            if (normalized.version.jurisdiction !== document.jurisdiction) {
                throw new WorkflowError(400, 'JURISDICTION_MISMATCH', 'Document and version jurisdiction must match');
            }
            const nextVersion = document.current_version + 1;
            const version = normalized.version;
            const inserted = await client.query(
                `INSERT INTO governed_document_versions
                    (document_id, version_number, jurisdiction, effective_from, effective_to,
                     template_authority, source_uri, source_sha256, source_retrieved_at,
                     storage_uri, content_sha256, redaction_status, redaction_note, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                 RETURNING *`,
                [document.id, nextVersion, version.jurisdiction, version.effectiveFrom, version.effectiveTo,
                    version.templateAuthority, version.sourceUri, version.sourceSha256, version.sourceRetrievedAt,
                    version.storageUri, version.contentSha256, version.redactionStatus, version.redactionNote, actor]
            );
            const updated = await client.query(
                `UPDATE governed_documents SET current_version = $1, status = 'DRAFT'
                 WHERE id = $2 RETURNING *`,
                [nextVersion, document.id]
            );
            const mappedVersion = mapVersion(inserted.rows[0]);
            await this._appendAudit(client, {
                matterId: document.matter_id,
                documentId: document.id,
                actorId: actor,
                eventType: 'DOCUMENT_VERSION_CREATED',
                payload: {
                    versionNumber: nextVersion,
                    previousVersion: document.current_version,
                    sourceUri: mappedVersion.sourceUri,
                    sourceSha256: mappedVersion.sourceSha256,
                    contentSha256: mappedVersion.contentSha256,
                    redactionStatus: mappedVersion.redactionStatus
                }
            });
            return { status: 201, body: { document: mapDocument(updated.rows[0]), version: mappedVersion } };
        });
    }

    async submitForReview(actorId, documentId, input, idempotencyKey) {
        const normalized = {
            documentId: requireUuid(documentId, 'documentId'),
            expectedVersion: requireInteger(input?.expectedVersion, 'expectedVersion', 1)
        };
        return this._mutate(actorId, 'SUBMIT_GOVERNED_DOCUMENT_REVIEW', idempotencyKey, normalized, async (client, actor) => {
            const document = await this._document(client, normalized.documentId, true);
            await this._assertMatterAccess(client, document.matter_id, actor, ['AUTHOR']);
            if (document.current_version !== normalized.expectedVersion) {
                throw new WorkflowError(409, 'VERSION_CONFLICT', 'expectedVersion does not match the current version');
            }
            if (document.status !== 'DRAFT') {
                throw new WorkflowError(409, 'INVALID_DOCUMENT_STATE', 'Only a draft can be submitted for review');
            }
            const versionResult = await client.query(
                `SELECT * FROM governed_document_versions
                 WHERE document_id = $1 AND version_number = $2`,
                [document.id, document.current_version]
            );
            const version = versionResult.rows[0];
            const today = new Date().toISOString().slice(0, 10);
            if (toDateString(version.effective_from) > today || (version.effective_to && toDateString(version.effective_to) < today)) {
                throw new WorkflowError(422, 'VERSION_NOT_EFFECTIVE', 'The current template version is not effective today');
            }
            if (version.jurisdiction !== document.jurisdiction) {
                throw new WorkflowError(422, 'JURISDICTION_MISMATCH', 'The current version does not match the document jurisdiction');
            }
            const updated = await client.query(
                `UPDATE governed_documents SET status = 'PENDING_REVIEW' WHERE id = $1 RETURNING *`,
                [document.id]
            );
            await this._appendAudit(client, {
                matterId: document.matter_id,
                documentId: document.id,
                actorId: actor,
                eventType: 'DOCUMENT_SUBMITTED_FOR_REVIEW',
                payload: { versionNumber: document.current_version, contentSha256: version.content_sha256 }
            });
            return { status: 200, body: { document: mapDocument(updated.rows[0]) } };
        });
    }

    async reviewDocument(actorId, documentId, input, idempotencyKey) {
        const decision = String(input?.decision || '').toUpperCase();
        if (!DECISIONS.has(decision)) {
            throw new WorkflowError(400, 'INVALID_DECISION', 'decision must be APPROVE or REJECT');
        }
        const normalized = {
            documentId: requireUuid(documentId, 'documentId'),
            expectedVersion: requireInteger(input?.expectedVersion, 'expectedVersion', 1),
            decision,
            reviewerJurisdiction: requireJurisdiction(input?.reviewerJurisdiction),
            legalAttestation: input?.legalAttestation === true,
            jurisdictionConfirmed: input?.jurisdictionConfirmed === true,
            notes: input?.notes == null ? null : requireText(input.notes, 'notes', 2000)
        };
        if (!normalized.legalAttestation) {
            throw new WorkflowError(400, 'LEGAL_ATTESTATION_REQUIRED', 'A human legal-review attestation is required');
        }
        if (decision === 'APPROVE' && !normalized.jurisdictionConfirmed) {
            throw new WorkflowError(400, 'JURISDICTION_CONFIRMATION_REQUIRED', 'Approval requires jurisdiction confirmation');
        }
        if (decision === 'REJECT' && !normalized.notes) {
            throw new WorkflowError(400, 'REJECTION_NOTES_REQUIRED', 'Rejection requires notes');
        }
        return this._mutate(actorId, 'REVIEW_GOVERNED_DOCUMENT', idempotencyKey, normalized, async (client, actor) => {
            const document = await this._document(client, normalized.documentId, true);
            await this._assertMatterAccess(client, document.matter_id, actor, ['LEGAL_REVIEWER'], { ownerAllowed: false });
            if (document.current_version !== normalized.expectedVersion) {
                throw new WorkflowError(409, 'VERSION_CONFLICT', 'expectedVersion does not match the current version');
            }
            if (document.status !== 'PENDING_REVIEW') {
                throw new WorkflowError(409, 'INVALID_DOCUMENT_STATE', 'The document is not pending review');
            }
            const versionResult = await client.query(
                `SELECT * FROM governed_document_versions
                 WHERE document_id = $1 AND version_number = $2`,
                [document.id, document.current_version]
            );
            const version = versionResult.rows[0];
            if (version.created_by === actor) {
                throw new WorkflowError(403, 'SELF_REVIEW_FORBIDDEN', 'The version author cannot review their own work');
            }
            const today = new Date().toISOString().slice(0, 10);
            if (toDateString(version.effective_from) > today || (version.effective_to && toDateString(version.effective_to) < today)) {
                throw new WorkflowError(422, 'VERSION_NOT_EFFECTIVE', 'The current template version is not effective today');
            }
            if (normalized.reviewerJurisdiction !== document.jurisdiction) {
                throw new WorkflowError(422, 'REVIEWER_JURISDICTION_MISMATCH', 'Reviewer jurisdiction must match the document');
            }
            const reviewResult = await client.query(
                `INSERT INTO governed_document_review_decisions
                    (document_id, version_number, reviewer_id, decision, reviewer_jurisdiction,
                     legal_attestation, jurisdiction_confirmed, notes)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
                [document.id, document.current_version, actor, decision, normalized.reviewerJurisdiction,
                    normalized.legalAttestation, normalized.jurisdictionConfirmed, normalized.notes]
            );
            const nextStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
            const updated = await client.query(
                'UPDATE governed_documents SET status = $1 WHERE id = $2 RETURNING *',
                [nextStatus, document.id]
            );
            const review = mapReview(reviewResult.rows[0]);
            await this._appendAudit(client, {
                matterId: document.matter_id,
                documentId: document.id,
                actorId: actor,
                eventType: decision === 'APPROVE' ? 'DOCUMENT_APPROVED' : 'DOCUMENT_REJECTED',
                payload: {
                    reviewId: review.id,
                    versionNumber: document.current_version,
                    reviewerJurisdiction: normalized.reviewerJurisdiction,
                    contentSha256: version.content_sha256,
                    notes: normalized.notes
                }
            });
            return { status: 200, body: { document: mapDocument(updated.rows[0]), review } };
        });
    }

    async setLegalHold(actorId, documentId, input, idempotencyKey) {
        if (typeof input?.active !== 'boolean') {
            throw new WorkflowError(400, 'INVALID_LEGAL_HOLD', 'active must be a boolean');
        }
        const normalized = {
            documentId: requireUuid(documentId, 'documentId'),
            expectedVersion: requireInteger(input?.expectedVersion, 'expectedVersion', 1),
            active: input.active,
            reason: requireText(input?.reason, 'reason', 1000)
        };
        return this._mutate(actorId, 'SET_GOVERNED_DOCUMENT_HOLD', idempotencyKey, normalized, async (client, actor) => {
            const document = await this._document(client, normalized.documentId, true);
            await this._assertMatterAccess(client, document.matter_id, actor, ['RECORDS_MANAGER']);
            if (document.current_version !== normalized.expectedVersion) {
                throw new WorkflowError(409, 'VERSION_CONFLICT', 'expectedVersion does not match the current version');
            }
            if (document.status === 'DISPOSED') {
                throw new WorkflowError(409, 'INVALID_DOCUMENT_STATE', 'A disposed document cannot change legal hold state');
            }
            if (document.legal_hold === normalized.active) {
                throw new WorkflowError(409, 'LEGAL_HOLD_UNCHANGED', 'The requested legal hold state is already active');
            }
            const updated = await client.query(
                `UPDATE governed_documents SET legal_hold = $1, legal_hold_reason = $2 WHERE id = $3 RETURNING *`,
                [normalized.active, normalized.active ? normalized.reason : null, document.id]
            );
            await this._appendAudit(client, {
                matterId: document.matter_id,
                documentId: document.id,
                actorId: actor,
                eventType: normalized.active ? 'LEGAL_HOLD_PLACED' : 'LEGAL_HOLD_RELEASED',
                payload: { versionNumber: document.current_version, reason: normalized.reason }
            });
            return { status: 200, body: { document: mapDocument(updated.rows[0]) } };
        });
    }

    async performProviderOperation(actorId, documentId, input, idempotencyKey) {
        const operation = String(input?.operation || '').toUpperCase();
        if (!PROVIDER_OPERATIONS.has(operation)) {
            throw new WorkflowError(400, 'INVALID_PROVIDER_OPERATION', 'Unsupported governed provider operation');
        }
        const normalized = {
            documentId: requireUuid(documentId, 'documentId'),
            expectedVersion: requireInteger(input?.expectedVersion, 'expectedVersion', 1),
            operation,
            parameters: this._normalizeProviderParameters(operation, input?.parameters)
        };
        return this._mutate(actorId, `GOVERNED_PROVIDER_${operation}`, idempotencyKey, normalized, async (client, actor) => {
            if (!this.providerClient || typeof this.providerClient.execute !== 'function') {
                throw new WorkflowError(503, 'PROVIDER_NOT_CONFIGURED', 'Governed provider integrations are not configured');
            }
            const document = await this._document(client, normalized.documentId, true);
            const role = ['FILING_SUBMIT', 'STORAGE_DELETE'].includes(operation)
                ? 'RECORDS_MANAGER'
                : 'AUTHOR';
            await this._assertMatterAccess(client, document.matter_id, actor, [role]);
            if (document.current_version !== normalized.expectedVersion) {
                throw new WorkflowError(409, 'VERSION_CONFLICT', 'expectedVersion does not match the current version');
            }
            if (document.status === 'DISPOSED') {
                throw new WorkflowError(409, 'INVALID_DOCUMENT_STATE', 'Provider operations are forbidden after disposition');
            }
            const versionResult = await client.query(
                `SELECT * FROM governed_document_versions
                 WHERE document_id = $1 AND version_number = $2`,
                [document.id, document.current_version]
            );
            const version = versionResult.rows[0];
            const eventsResult = await client.query(
                `SELECT * FROM governed_document_provider_events
                 WHERE document_id = $1 AND version_number = $2
                 ORDER BY sequence`,
                [document.id, document.current_version]
            );
            const events = eventsResult.rows;
            const latest = candidate => [...events].reverse().find(event => event.operation === candidate);

            if (['ESIGN_CREATE', 'ESIGN_STATUS', 'FILING_SUBMIT', 'STORAGE_DELETE'].includes(operation)
                && document.status !== 'APPROVED') {
                throw new WorkflowError(409, 'DOCUMENT_NOT_APPROVED', `${operation} requires independent legal approval`);
            }
            if (operation === 'OCR_EXTRACT' && latest('STORAGE_VERIFY')?.status !== 'SUCCEEDED') {
                throw new WorkflowError(409, 'STORAGE_VERIFICATION_REQUIRED', 'OCR requires successful storage verification');
            }
            if (operation === 'ESIGN_CREATE') {
                const previousCreate = latest('ESIGN_CREATE');
                const previousStatus = latest('ESIGN_STATUS');
                const retryableFailure = previousCreate?.status === 'FAILED'
                    || (previousStatus?.status === 'FAILED' && previousStatus.sequence > previousCreate.sequence);
                if (previousCreate && !retryableFailure) {
                    throw new WorkflowError(409, 'SIGNATURE_WORKFLOW_ACTIVE', 'A signature workflow is already active or complete');
                }
            }
            if (operation === 'ESIGN_STATUS') {
                const signatureRequest = latest('ESIGN_CREATE');
                const signatureStatus = latest('ESIGN_STATUS');
                if (!signatureRequest) {
                    throw new WorkflowError(409, 'SIGNATURE_REQUEST_REQUIRED', 'No signature request exists for this version');
                }
                if (signatureStatus?.sequence > signatureRequest.sequence
                    && ['FAILED', 'COMPLETED'].includes(signatureStatus.status)) {
                    throw new WorkflowError(
                        409,
                        signatureStatus.status === 'FAILED' ? 'SIGNATURE_RETRY_REQUIRED' : 'SIGNATURE_ALREADY_COMPLETED',
                        signatureStatus.status === 'FAILED'
                            ? 'The failed signature request must be retried before another status poll'
                            : 'The signature request is already complete'
                    );
                }
            }
            if (operation === 'FILING_SUBMIT' && latest('ESIGN_STATUS')?.status !== 'COMPLETED') {
                throw new WorkflowError(409, 'COMPLETED_SIGNATURE_REQUIRED', 'Filing requires a completed signature event');
            }
            if (operation === 'STORAGE_DELETE') {
                if (document.legal_hold) {
                    throw new WorkflowError(409, 'LEGAL_HOLD_ACTIVE', 'Storage deletion is forbidden while legal hold is active');
                }
                const today = new Date().toISOString().slice(0, 10);
                if (toDateString(document.retention_until) > today) {
                    throw new WorkflowError(409, 'RETENTION_ACTIVE', 'Storage deletion is forbidden before retention expiry');
                }
                if (latest('STORAGE_DELETE')?.status === 'SUCCEEDED') {
                    throw new WorkflowError(409, 'STORAGE_ALREADY_DELETED', 'Storage deletion already succeeded');
                }
            }

            const predecessor = operation === 'ESIGN_STATUS'
                ? latest('ESIGN_CREATE')
                : operation === 'FILING_SUBMIT'
                    ? latest('ESIGN_STATUS')
                    : null;
            const providerPayload = canonicalize({
                documentId: document.id,
                matterId: document.matter_id,
                versionNumber: document.current_version,
                jurisdiction: document.jurisdiction,
                storageUri: version.storage_uri,
                contentSha256: version.content_sha256,
                sourceSha256: version.source_sha256,
                predecessorExternalEventId: predecessor?.external_event_id || null,
                parameters: normalized.parameters
            });
            const rawResult = await this.providerClient.execute(operation, providerPayload, idempotencyKey);
            const result = this._validateProviderResult(operation, rawResult);
            const eventId = crypto.randomUUID();
            const inserted = await client.query(
                `INSERT INTO governed_document_provider_events
                    (id, document_id, version_number, operation, provider, external_event_id,
                     status, request_sha256, response_sha256, receipt_uri, evidence_sha256,
                     output_sha256, occurred_at, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                 RETURNING *`,
                [eventId, document.id, document.current_version, operation, result.provider,
                    result.externalEventId, result.status, sha256(stableStringify(providerPayload)),
                    sha256(stableStringify(result)), result.receiptUri, result.evidenceSha256,
                    result.outputSha256, result.occurredAt, actor]
            );
            const event = mapProviderEvent(inserted.rows[0]);
            await this._appendAudit(client, {
                matterId: document.matter_id,
                documentId: document.id,
                actorId: actor,
                eventType: `PROVIDER_${operation}_${result.status}`,
                payload: {
                    providerEventId: event.id,
                    versionNumber: document.current_version,
                    provider: result.provider,
                    externalEventId: result.externalEventId,
                    status: result.status,
                    evidenceSha256: result.evidenceSha256,
                    outputSha256: result.outputSha256,
                    receiptUri: result.receiptUri
                }
            });
            return { status: 201, body: { providerEvent: event } };
        });
    }

    async recordDisposition(actorId, documentId, input, idempotencyKey) {
        const normalized = {
            documentId: requireUuid(documentId, 'documentId'),
            expectedVersion: requireInteger(input?.expectedVersion, 'expectedVersion', 1),
            deletionProviderEventId: requireUuid(input?.deletionProviderEventId, 'deletionProviderEventId')
        };
        return this._mutate(actorId, 'RECORD_GOVERNED_DOCUMENT_DISPOSITION', idempotencyKey, normalized, async (client, actor) => {
            const document = await this._document(client, normalized.documentId, true);
            await this._assertMatterAccess(client, document.matter_id, actor, ['RECORDS_MANAGER']);
            if (document.current_version !== normalized.expectedVersion) {
                throw new WorkflowError(409, 'VERSION_CONFLICT', 'expectedVersion does not match the current version');
            }
            if (document.status !== 'APPROVED') {
                throw new WorkflowError(409, 'INVALID_DOCUMENT_STATE', 'Only an approved document can be disposed');
            }
            if (document.legal_hold) {
                throw new WorkflowError(409, 'LEGAL_HOLD_ACTIVE', 'Disposition is forbidden while legal hold is active');
            }
            const today = new Date().toISOString().slice(0, 10);
            if (toDateString(document.retention_until) > today) {
                throw new WorkflowError(409, 'RETENTION_ACTIVE', 'Disposition is forbidden before retention expiry');
            }
            const [approvalResult, deletionResult] = await Promise.all([
                client.query(
                `SELECT decided_at FROM governed_document_review_decisions
                 WHERE document_id = $1 AND version_number = $2 AND decision = 'APPROVE'`,
                [document.id, document.current_version]
                ),
                client.query(
                    `SELECT * FROM governed_document_provider_events
                     WHERE id = $1 AND document_id = $2 AND version_number = $3
                       AND operation = 'STORAGE_DELETE' AND status = 'SUCCEEDED'`,
                    [normalized.deletionProviderEventId, document.id, document.current_version]
                )
            ]);
            const deletion = deletionResult.rows[0];
            if (approvalResult.rows.length !== 1 || !deletion || !deletion.receipt_uri
                || new Date(deletion.occurred_at) < new Date(approvalResult.rows[0].decided_at)) {
                throw new WorkflowError(422, 'INVALID_DISPOSITION_RECEIPT', 'Deletion receipt must follow the approved review');
            }
            const deletionReceipt = {
                providerEventId: deletion.id,
                provider: deletion.provider,
                externalEventId: deletion.external_event_id,
                receiptUri: deletion.receipt_uri,
                evidenceSha256: deletion.evidence_sha256,
                occurredAt: toTimestamp(deletion.occurred_at)
            };
            const updated = await client.query(
                `UPDATE governed_documents
                 SET status = 'DISPOSED', disposed_at = $1, disposed_by = $2
                 WHERE id = $3 RETURNING *`,
                [deletionReceipt.occurredAt, actor, document.id]
            );
            await this._appendAudit(client, {
                matterId: document.matter_id,
                documentId: document.id,
                actorId: actor,
                eventType: 'DOCUMENT_DISPOSITION_RECORDED',
                payload: { versionNumber: document.current_version, deletionReceipt }
            });
            return { status: 200, body: { document: mapDocument(updated.rows[0]), deletionReceipt } };
        });
    }

    async exportEvidence(actorId, documentId, input, idempotencyKey) {
        const normalized = {
            documentId: requireUuid(documentId, 'documentId'),
            expectedVersion: requireInteger(input?.expectedVersion, 'expectedVersion', 1),
            purpose: requireText(input?.purpose, 'purpose', 500)
        };
        return this._mutate(actorId, 'EXPORT_GOVERNED_DOCUMENT_EVIDENCE', idempotencyKey, normalized, async (client, actor) => {
            const document = await this._document(client, normalized.documentId, true);
            await this._assertMatterAccess(client, document.matter_id, actor, ['RECORDS_MANAGER']);
            if (document.current_version !== normalized.expectedVersion) {
                throw new WorkflowError(409, 'VERSION_CONFLICT', 'expectedVersion does not match the current version');
            }
            if (!['APPROVED', 'DISPOSED'].includes(document.status)) {
                throw new WorkflowError(409, 'DOCUMENT_NOT_APPROVED', 'Evidence can only be exported after approval');
            }
            const exportedAt = new Date().toISOString();
            await this._appendAudit(client, {
                matterId: document.matter_id,
                documentId: document.id,
                actorId: actor,
                eventType: 'EVIDENCE_EXPORTED',
                payload: { versionNumber: document.current_version, purpose: normalized.purpose, exportedAt }
            });
            const [versionsResult, reviewsResult, providersResult, auditResult] = await Promise.all([
                client.query('SELECT * FROM governed_document_versions WHERE document_id = $1 ORDER BY version_number', [document.id]),
                client.query('SELECT * FROM governed_document_review_decisions WHERE document_id = $1 ORDER BY decided_at, id', [document.id]),
                client.query('SELECT * FROM governed_document_provider_events WHERE document_id = $1 ORDER BY sequence', [document.id]),
                client.query('SELECT * FROM governed_document_audit_events WHERE matter_id = $1 ORDER BY sequence', [document.matter_id])
            ]);
            const chain = this._verifyAuditRows(auditResult.rows);
            if (!chain.valid) {
                throw new WorkflowError(500, 'AUDIT_CHAIN_INVALID', 'Audit chain verification failed');
            }
            return {
                status: 200,
                body: {
                    evidenceVersion: 1,
                    exportedAt,
                    purpose: normalized.purpose,
                    document: mapDocument(document),
                    versions: versionsResult.rows.map(mapVersion),
                    reviews: reviewsResult.rows.map(mapReview),
                    providerEvents: providersResult.rows.map(mapProviderEvent),
                    audit: { chain, events: auditResult.rows.map(mapAudit) }
                }
            };
        });
    }

    async getDocument(actorId, documentId) {
        const actor = requireUuid(actorId, 'actorId');
        const client = await this.pool.connect();
        try {
            const document = await this._document(client, documentId);
            await this._assertMatterAccess(
                client,
                document.matter_id,
                actor,
                ['AUTHOR', 'LEGAL_REVIEWER', 'RECORDS_MANAGER']
            );
            const [versions, reviews, providers] = await Promise.all([
                client.query('SELECT * FROM governed_document_versions WHERE document_id = $1 ORDER BY version_number', [document.id]),
                client.query('SELECT * FROM governed_document_review_decisions WHERE document_id = $1 ORDER BY decided_at, id', [document.id]),
                client.query('SELECT * FROM governed_document_provider_events WHERE document_id = $1 ORDER BY sequence', [document.id])
            ]);
            return {
                document: mapDocument(document),
                versions: versions.rows.map(mapVersion),
                reviews: reviews.rows.map(mapReview),
                providerEvents: providers.rows.map(mapProviderEvent)
            };
        } catch (error) {
            throw mapPostgresError(error);
        } finally {
            client.release();
        }
    }

    async verifyMatterAudit(actorId, matterId) {
        const actor = requireUuid(actorId, 'actorId');
        const matter = requireUuid(matterId, 'matterId');
        const client = await this.pool.connect();
        try {
            await this._assertMatterAccess(client, matter, actor, ['RECORDS_MANAGER']);
            const result = await client.query(
                'SELECT * FROM governed_document_audit_events WHERE matter_id = $1 ORDER BY sequence',
                [matter]
            );
            return { ...this._verifyAuditRows(result.rows), events: result.rows.map(mapAudit) };
        } catch (error) {
            throw mapPostgresError(error);
        } finally {
            client.release();
        }
    }
}

module.exports = {
    GovernedDocumentWorkflow,
    WorkflowError,
    stableStringify,
    sha256,
    ZERO_HASH
};

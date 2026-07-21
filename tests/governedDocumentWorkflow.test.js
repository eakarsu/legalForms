'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { runPendingMigrations } = require('../lib/migrations');
const { GovernedDocumentWorkflow, sha256 } = require('../lib/governedDocumentWorkflow');
const { createGovernedApp } = require('../lib/governedApp');
const { loadGovernedConfig } = require('../config/governed');
const { buildDatabaseConfig } = pool;

const sourceHost = 'templates.example.test';
const jwtConfiguration = {
    secret: 'test-only-governed-jwt-secret-0123456789abcdef',
    issuer: 'legalforms-test',
    audience: 'legalforms-governed-test',
    algorithm: 'HS256',
    expiresIn: '15m'
};

function id() {
    return crypto.randomUUID();
}

function isoDate(offsetDays = 0) {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() + offsetDays);
    return date.toISOString().slice(0, 10);
}

function versionEvidence(label, overrides = {}) {
    return {
        jurisdiction: 'US-NY',
        effectiveFrom: isoDate(-30),
        effectiveTo: isoDate(30),
        templateAuthority: 'New York Courts Forms Authority',
        sourceUri: `https://${sourceHost}/forms/${encodeURIComponent(label)}.pdf`,
        sourceSha256: sha256(`source:${label}`),
        sourceRetrievedAt: new Date().toISOString(),
        storageUri: `s3://legalforms-evidence/${encodeURIComponent(label)}.json`,
        contentSha256: sha256(`content:${label}`),
        redactionStatus: 'REDACTED',
        redactionNote: 'Client identifiers removed under the approved redaction policy.',
        ...overrides
    };
}

function tokenFor(userId, overrides = {}) {
    return jwt.sign(
        {},
        jwtConfiguration.secret,
        {
            subject: userId,
            issuer: overrides.issuer || jwtConfiguration.issuer,
            audience: overrides.audience || jwtConfiguration.audience,
            algorithm: 'HS256',
            expiresIn: overrides.expiresIn || '5m'
        }
    );
}

class FakeGovernedProviderClient {
    constructor() {
        this.calls = [];
        this.signatureStatusChecks = 0;
    }

    async execute(operation, payload, idempotencyKey) {
        this.calls.push({ operation, payload, idempotencyKey });
        const sequence = this.calls.length;
        let status = 'SUCCEEDED';
        if (operation === 'ESIGN_CREATE') status = 'PENDING';
        if (operation === 'ESIGN_STATUS') {
            this.signatureStatusChecks += 1;
            status = this.signatureStatusChecks === 1 ? 'FAILED' : 'COMPLETED';
        }
        if (operation === 'FILING_SUBMIT') status = 'SUCCEEDED';
        return {
            provider: `test-${operation.toLowerCase()}`,
            externalEventId: `${operation.toLowerCase()}-${sequence}-${id()}`,
            status,
            occurredAt: new Date().toISOString(),
            receiptUri: ['FILING_SUBMIT', 'STORAGE_DELETE'].includes(operation)
                ? `s3://legalforms-receipts/${operation.toLowerCase()}-${sequence}.json`
                : null,
            evidenceSha256: sha256(`provider-evidence:${operation}:${sequence}:${status}`),
            outputSha256: operation === 'OCR_EXTRACT' ? sha256(`ocr-output:${sequence}`) : null
        };
    }
}

describe('governed matter document workflow', () => {
    const users = {
        owner: id(),
        author: id(),
        reviewer: id(),
        records: id(),
        outsider: id()
    };
    const matterId = id();
    let workflow;
    let documentId;
    let authorGrantId;
    let authorReviewerGrantId;
    let deletionProviderEventId;
    const providerClient = new FakeGovernedProviderClient();

    beforeAll(async () => {
        await runPendingMigrations();
        await runPendingMigrations();
        for (const [role, userId] of Object.entries(users)) {
            await pool.query(
                `INSERT INTO users (id, email, password_hash, first_name, last_name)
                 VALUES ($1, $2, 'not-used-by-governed-api', $3, 'Fixture')`,
                [userId, `${role}-${userId}@example.test`, role]
            );
        }
        await pool.query(
            `INSERT INTO cases (id, user_id, case_number, title, status)
             VALUES ($1, $2, $3, 'Governed Contract Review', 'active')`,
            [matterId, users.owner, `GOV-${matterId}`]
        );
        workflow = new GovernedDocumentWorkflow(pool, {
            allowedSourceHosts: [sourceHost],
            minRetentionDays: 0,
            providerClient
        });
    });

    afterAll(async () => {
        await pool.end();
    });

    test('migration runner detects recorded checksum drift', async () => {
        const current = await pool.query(
            `SELECT checksum FROM migrations_run WHERE filename = '001_init.sql'`
        );
        await pool.query(
            `UPDATE migrations_run SET checksum = $1 WHERE filename = '001_init.sql'`,
            ['0'.repeat(64)]
        );
        await expect(runPendingMigrations()).rejects.toThrow('Checksum mismatch: 001_init.sql');
        await pool.query(
            `UPDATE migrations_run SET checksum = $1 WHERE filename = '001_init.sql'`,
            [current.rows[0].checksum]
        );
        await expect(runPendingMigrations()).resolves.toBeUndefined();
    });

    test('production configuration fails closed for weak secrets, origins, and database TLS', () => {
        const secureEnvironment = {
            NODE_ENV: 'production',
            PORT: '3000',
            JWT_SECRET: 'production-test-secret-0123456789abcdef0123456789',
            ALLOWED_ORIGINS: 'https://legal.example.test',
            GOVERNED_SOURCE_HOSTS: sourceHost,
            GOVERNED_MIN_RETENTION_DAYS: '30',
            GOVERNED_STORAGE_URL: 'https://storage.example.test/governed-events',
            GOVERNED_STORAGE_TOKEN: 'storage-test-token-0123456789abcdef',
            GOVERNED_OCR_URL: 'https://ocr.example.test/governed-events',
            GOVERNED_OCR_TOKEN: 'ocr-test-token-0123456789abcdef0123',
            GOVERNED_ESIGN_URL: 'https://esign.example.test/governed-events',
            GOVERNED_ESIGN_TOKEN: 'esign-test-token-0123456789abcdef01',
            GOVERNED_FILING_URL: 'https://filing.example.test/governed-events',
            GOVERNED_FILING_TOKEN: 'filing-test-token-0123456789abcdef0'
        };
        expect(loadGovernedConfig(secureEnvironment)).toMatchObject({
            production: true,
            allowedOrigins: ['https://legal.example.test'],
            allowedSourceHosts: [sourceHost]
        });
        expect(() => loadGovernedConfig({ ...secureEnvironment, JWT_SECRET: 'short' }))
            .toThrow('JWT_SECRET must be configured with at least 32 characters');
        expect(() => loadGovernedConfig({
            ...secureEnvironment,
            GOVERNED_OCR_TOKEN: ''
        })).toThrow('GOVERNED_OCR_URL and GOVERNED_OCR_TOKEN must both be configured');
        expect(() => loadGovernedConfig({ ...secureEnvironment, ALLOWED_ORIGINS: 'http://legal.example.test' }))
            .toThrow('exact HTTPS origins');
        expect(() => loadGovernedConfig({ ...secureEnvironment, JWT_EXPIRES_IN: '30d' }))
            .toThrow('between 60 seconds and 15 minutes');
        expect(() => buildDatabaseConfig({
            NODE_ENV: 'production',
            DATABASE_URL: 'postgresql://user:password@db.example.test/legalforms',
            DB_SSL_MODE: 'disable'
        })).toThrow('require DB_SSL_MODE=verify-full');
        expect(() => buildDatabaseConfig({
            NODE_ENV: 'production',
            DATABASE_URL: 'postgresql://user:password@127.0.0.2/legalforms',
            DB_SSL_MODE: 'verify-full'
        })).toThrow('cannot target loopback');
        expect(buildDatabaseConfig({
            NODE_ENV: 'production',
            DATABASE_URL: 'postgresql://user:password@db.example.test/legalforms',
            DB_SSL_MODE: 'verify-full'
        })).toMatchObject({ ssl: { rejectUnauthorized: true } });
    });

    test('enforces owner-managed matter grants with idempotent replay and conflict detection', async () => {
        await expect(workflow.grantAccess(
            users.outsider,
            matterId,
            { userId: users.author, role: 'AUTHOR' },
            'grant-outsider-001'
        )).rejects.toMatchObject({ status: 403, code: 'MATTER_OWNER_REQUIRED' });

        const authorGrant = await workflow.grantAccess(
            users.owner,
            matterId,
            { userId: users.author, role: 'AUTHOR' },
            'grant-author-001'
        );
        authorGrantId = authorGrant.body.grant.id;
        expect(authorGrant).toMatchObject({ status: 201, replayed: false });

        const replay = await workflow.grantAccess(
            users.owner,
            matterId,
            { userId: users.author, role: 'AUTHOR' },
            'grant-author-001'
        );
        expect(replay).toMatchObject({ status: 201, replayed: true });
        expect(replay.body.grant.id).toBe(authorGrantId);

        await expect(workflow.grantAccess(
            users.owner,
            matterId,
            { userId: users.reviewer, role: 'LEGAL_REVIEWER' },
            'grant-author-001'
        )).rejects.toMatchObject({ status: 409, code: 'IDEMPOTENCY_CONFLICT' });

        await workflow.grantAccess(
            users.owner,
            matterId,
            { userId: users.reviewer, role: 'LEGAL_REVIEWER' },
            'grant-reviewer-001'
        );
        await workflow.grantAccess(
            users.owner,
            matterId,
            { userId: users.records, role: 'RECORDS_MANAGER' },
            'grant-records-001'
        );
        const authorReviewerGrant = await workflow.grantAccess(
            users.owner,
            matterId,
            { userId: users.author, role: 'LEGAL_REVIEWER' },
            'grant-author-reviewer-001'
        );
        authorReviewerGrantId = authorReviewerGrant.body.grant.id;
    });

    test('creates immutable provenance and rejects ungoverned template sources', async () => {
        await expect(workflow.createDocument(users.author, {
            matterId,
            title: 'Source host rejection',
            jurisdiction: 'US-NY',
            retentionUntil: isoDate(),
            version: versionEvidence('bad-source', { sourceUri: 'https://evil.example.test/template.pdf' })
        }, 'create-bad-source-001')).rejects.toMatchObject({ status: 422, code: 'SOURCE_NOT_GOVERNED' });

        await expect(workflow.createDocument(users.outsider, {
            matterId,
            title: 'Unauthorized document',
            jurisdiction: 'US-NY',
            retentionUntil: isoDate(),
            version: versionEvidence('unauthorized')
        }, 'create-outsider-001')).rejects.toMatchObject({ status: 403, code: 'MATTER_ACCESS_DENIED' });

        const futureDocument = await workflow.createDocument(users.author, {
            matterId,
            title: 'Future authority document',
            jurisdiction: 'US-NY',
            retentionUntil: isoDate(),
            version: versionEvidence('future-authority', {
                effectiveFrom: isoDate(1),
                effectiveTo: isoDate(30)
            })
        }, 'create-future-001');
        await expect(workflow.submitForReview(
            users.author,
            futureDocument.body.document.id,
            { expectedVersion: 1 },
            'submit-future-001'
        )).rejects.toMatchObject({ status: 422, code: 'VERSION_NOT_EFFECTIVE' });

        const request = {
            matterId,
            title: 'Settlement Agreement',
            jurisdiction: 'US-NY',
            retentionUntil: isoDate(),
            version: versionEvidence('settlement-v1')
        };
        const created = await workflow.createDocument(users.author, request, 'create-document-001');
        documentId = created.body.document.id;
        expect(created).toMatchObject({
            status: 201,
            replayed: false,
            body: {
                document: { status: 'DRAFT', currentVersion: 1 },
                version: { redactionStatus: 'REDACTED' }
            }
        });
        expect(created.body.version).not.toHaveProperty('content');

        const replay = await workflow.createDocument(users.author, request, 'create-document-001');
        expect(replay.replayed).toBe(true);
        expect(replay.body.document.id).toBe(documentId);
        await expect(workflow.createDocument(users.author, { ...request, title: 'Changed title' }, 'create-document-001'))
            .rejects.toMatchObject({ status: 409, code: 'IDEMPOTENCY_CONFLICT' });
    });

    test('handles optimistic version conflicts and independent human legal review', async () => {
        await expect(workflow.addVersion(users.author, documentId, {
            expectedVersion: 2,
            version: versionEvidence('settlement-v2-stale')
        }, 'version-stale-001')).rejects.toMatchObject({ status: 409, code: 'VERSION_CONFLICT' });

        const version = await workflow.addVersion(users.author, documentId, {
            expectedVersion: 1,
            version: versionEvidence('settlement-v2')
        }, 'version-create-002');
        expect(version.body.document).toMatchObject({ currentVersion: 2, status: 'DRAFT' });

        await workflow.submitForReview(
            users.author,
            documentId,
            { expectedVersion: 2 },
            'submit-review-002'
        );

        await expect(workflow.reviewDocument(users.author, documentId, {
            expectedVersion: 2,
            decision: 'APPROVE',
            reviewerJurisdiction: 'US-NY',
            legalAttestation: true,
            jurisdictionConfirmed: true
        }, 'self-review-002')).rejects.toMatchObject({ status: 403, code: 'SELF_REVIEW_FORBIDDEN' });

        await expect(workflow.reviewDocument(users.owner, documentId, {
            expectedVersion: 2,
            decision: 'APPROVE',
            reviewerJurisdiction: 'US-NY',
            legalAttestation: true,
            jurisdictionConfirmed: true
        }, 'owner-review-002')).rejects.toMatchObject({ status: 403, code: 'MATTER_ACCESS_DENIED' });

        await expect(workflow.reviewDocument(users.reviewer, documentId, {
            expectedVersion: 2,
            decision: 'APPROVE',
            reviewerJurisdiction: 'US-CA',
            legalAttestation: true,
            jurisdictionConfirmed: true
        }, 'wrong-jurisdiction-002')).rejects.toMatchObject({
            status: 422,
            code: 'REVIEWER_JURISDICTION_MISMATCH'
        });

        const approved = await workflow.reviewDocument(users.reviewer, documentId, {
            expectedVersion: 2,
            decision: 'APPROVE',
            reviewerJurisdiction: 'US-NY',
            legalAttestation: true,
            jurisdictionConfirmed: true,
            notes: 'Reviewed against the current New York authority.'
        }, 'approve-review-002');
        expect(approved.body.document.status).toBe('APPROVED');
        expect(approved.body.review.reviewerId).toBe(users.reviewer);
    });

    test('orchestrates verified storage, OCR, signer failure and retry, and filing evidence', async () => {
        await expect(workflow.performProviderOperation(users.author, documentId, {
            expectedVersion: 2,
            operation: 'OCR_EXTRACT'
        }, 'provider-ocr-before-storage-002')).rejects.toMatchObject({
            status: 409,
            code: 'STORAGE_VERIFICATION_REQUIRED'
        });
        await expect(workflow.performProviderOperation(users.records, documentId, {
            expectedVersion: 2,
            operation: 'FILING_SUBMIT',
            parameters: { destination: 'New York County Clerk' }
        }, 'provider-filing-before-sign-002')).rejects.toMatchObject({
            status: 409,
            code: 'COMPLETED_SIGNATURE_REQUIRED'
        });

        const stored = await workflow.performProviderOperation(users.author, documentId, {
            expectedVersion: 2,
            operation: 'STORAGE_VERIFY'
        }, 'provider-storage-verify-002');
        const callsAfterStorage = providerClient.calls.length;
        const storageReplay = await workflow.performProviderOperation(users.author, documentId, {
            expectedVersion: 2,
            operation: 'STORAGE_VERIFY'
        }, 'provider-storage-verify-002');
        expect(storageReplay).toMatchObject({ replayed: true });
        expect(storageReplay.body.providerEvent.id).toBe(stored.body.providerEvent.id);
        expect(providerClient.calls).toHaveLength(callsAfterStorage);

        const ocr = await workflow.performProviderOperation(users.author, documentId, {
            expectedVersion: 2,
            operation: 'OCR_EXTRACT'
        }, 'provider-ocr-002');
        expect(ocr.body.providerEvent).toMatchObject({ status: 'SUCCEEDED' });
        expect(ocr.body.providerEvent.outputSha256).toMatch(/^[0-9a-f]{64}$/);

        await workflow.performProviderOperation(users.author, documentId, {
            expectedVersion: 2,
            operation: 'ESIGN_CREATE',
            parameters: { signers: [{ name: 'Client Signer', email: 'client@example.test' }] }
        }, 'provider-esign-create-002');
        const failed = await workflow.performProviderOperation(users.author, documentId, {
            expectedVersion: 2,
            operation: 'ESIGN_STATUS'
        }, 'provider-esign-status-failed-002');
        expect(failed.body.providerEvent.status).toBe('FAILED');

        await workflow.performProviderOperation(users.author, documentId, {
            expectedVersion: 2,
            operation: 'ESIGN_CREATE',
            parameters: { signers: [{ name: 'Client Signer', email: 'client@example.test' }] }
        }, 'provider-esign-retry-002');
        const completed = await workflow.performProviderOperation(users.author, documentId, {
            expectedVersion: 2,
            operation: 'ESIGN_STATUS'
        }, 'provider-esign-status-complete-002');
        expect(completed.body.providerEvent.status).toBe('COMPLETED');

        const filing = await workflow.performProviderOperation(users.records, documentId, {
            expectedVersion: 2,
            operation: 'FILING_SUBMIT',
            parameters: { destination: 'New York County Clerk' }
        }, 'provider-filing-002');
        expect(filing.body.providerEvent).toMatchObject({ status: 'SUCCEEDED' });
        expect(filing.body.providerEvent.receiptUri).toMatch(/^s3:/);

        const state = await workflow.getDocument(users.records, documentId);
        expect(state.providerEvents.map(event => `${event.operation}:${event.status}`)).toEqual(expect.arrayContaining([
            'STORAGE_VERIFY:SUCCEEDED',
            'OCR_EXTRACT:SUCCEEDED',
            'ESIGN_STATUS:FAILED',
            'ESIGN_STATUS:COMPLETED',
            'FILING_SUBMIT:SUCCEEDED'
        ]));
    });

    test('exports a verified evidence chain and enforces legal hold before disposition', async () => {
        const exported = await workflow.exportEvidence(users.records, documentId, {
            expectedVersion: 2,
            purpose: 'Client file closure package'
        }, 'export-evidence-002');
        expect(exported.body.audit.chain).toMatchObject({ valid: true });
        expect(exported.body.versions).toHaveLength(2);
        expect(exported.body.reviews).toHaveLength(1);
        expect(JSON.stringify(exported.body)).not.toContain('raw document text');

        const replay = await workflow.exportEvidence(users.records, documentId, {
            expectedVersion: 2,
            purpose: 'Client file closure package'
        }, 'export-evidence-002');
        expect(replay.replayed).toBe(true);
        expect(replay.body.audit.chain.headHash).toBe(exported.body.audit.chain.headHash);

        await workflow.setLegalHold(users.records, documentId, {
            expectedVersion: 2,
            active: true,
            reason: 'Pending discovery preservation notice'
        }, 'hold-place-002');

        await expect(workflow.recordDisposition(users.records, documentId, {
            expectedVersion: 2,
            deletionProviderEventId: id()
        }, 'dispose-blocked-002')).rejects.toMatchObject({ status: 409, code: 'LEGAL_HOLD_ACTIVE' });

        await workflow.setLegalHold(users.records, documentId, {
            expectedVersion: 2,
            active: false,
            reason: 'Preservation notice released by records counsel'
        }, 'hold-release-002');

        const deletion = await workflow.performProviderOperation(users.records, documentId, {
            expectedVersion: 2,
            operation: 'STORAGE_DELETE',
            parameters: { reason: 'Retention expired and legal hold was released' }
        }, 'provider-storage-delete-002');
        deletionProviderEventId = deletion.body.providerEvent.id;
        expect(deletion.body.providerEvent).toMatchObject({ status: 'SUCCEEDED' });

        const disposed = await workflow.recordDisposition(users.records, documentId, {
            expectedVersion: 2,
            deletionProviderEventId
        }, 'dispose-record-002');
        expect(disposed.body.document.status).toBe('DISPOSED');
        expect(disposed.body.deletionReceipt.providerEventId).toBe(deletionProviderEventId);
    });

    test('enforces access revocation and database append-only evidence guards', async () => {
        await workflow.revokeAccess(users.owner, matterId, authorGrantId, {
            reason: 'Author assignment ended'
        }, 'revoke-author-001');
        await workflow.revokeAccess(users.owner, matterId, authorReviewerGrantId, {
            reason: 'Temporary review assignment ended'
        }, 'revoke-author-reviewer-001');

        await expect(workflow.getDocument(users.author, documentId))
            .rejects.toMatchObject({ status: 403, code: 'MATTER_ACCESS_DENIED' });

        const audit = await workflow.verifyMatterAudit(users.records, matterId);
        expect(audit.valid).toBe(true);
        expect(audit.events.map(event => event.eventType)).toEqual(expect.arrayContaining([
            'DOCUMENT_CREATED',
            'DOCUMENT_VERSION_CREATED',
            'DOCUMENT_APPROVED',
            'EVIDENCE_EXPORTED',
            'LEGAL_HOLD_PLACED',
            'LEGAL_HOLD_RELEASED',
            'PROVIDER_ESIGN_STATUS_FAILED',
            'PROVIDER_ESIGN_STATUS_COMPLETED',
            'PROVIDER_STORAGE_DELETE_SUCCEEDED',
            'DOCUMENT_DISPOSITION_RECORDED',
            'MATTER_ACCESS_REVOKED'
        ]));

        await expect(pool.query(
            `UPDATE governed_document_versions SET content_sha256 = $1 WHERE document_id = $2`,
            [sha256('tampered'), documentId]
        )).rejects.toMatchObject({ code: '55000' });
        await expect(pool.query(
            `UPDATE governed_document_review_decisions SET notes = 'tampered' WHERE document_id = $1`,
            [documentId]
        )).rejects.toMatchObject({ code: '55000' });
        await expect(pool.query(
            `DELETE FROM governed_document_audit_events WHERE document_id = $1`,
            [documentId]
        )).rejects.toMatchObject({ code: '55000' });
        await expect(pool.query(
            `DELETE FROM governed_document_idempotency WHERE actor_id = $1`,
            [users.author]
        )).rejects.toMatchObject({ code: '55000' });
        await expect(pool.query(
            `UPDATE governed_document_provider_events SET status = 'FAILED' WHERE document_id = $1`,
            [documentId]
        )).rejects.toMatchObject({ code: '55000' });
        await expect(pool.query(
            `UPDATE governed_documents SET retention_until = retention_until - 1 WHERE id = $1`,
            [documentId]
        )).rejects.toMatchObject({ code: '55000' });
    });

    test('dedicated API fails closed for authentication and cross-origin requests', async () => {
        const app = createGovernedApp({
            pool,
            providerClient,
            config: {
                allowedOrigins: ['https://legal.example.test'],
                allowedSourceHosts: [sourceHost],
                minRetentionDays: 0,
                jwt: jwtConfiguration
            }
        });
        const server = await new Promise(resolve => {
            const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
        });
        const address = server.address();
        const base = `http://127.0.0.1:${address.port}`;
        try {
            const health = await fetch(`${base}/healthz`);
            expect(health.status).toBe(200);
            const ready = await fetch(`${base}/readyz`);
            expect(ready.status).toBe(200);

            const unauthenticated = await fetch(`${base}/api/governed/documents/${documentId}`);
            expect(unauthenticated.status).toBe(401);

            const disallowedOrigin = await fetch(`${base}/api/governed/documents/${documentId}`, {
                method: 'OPTIONS',
                headers: { Origin: 'https://evil.example.test' }
            });
            expect(disallowedOrigin.status).toBe(403);

            const allowedOrigin = await fetch(`${base}/api/governed/documents/${documentId}`, {
                method: 'OPTIONS',
                headers: { Origin: 'https://legal.example.test' }
            });
            expect(allowedOrigin.status).toBe(204);
            expect(allowedOrigin.headers.get('access-control-allow-origin')).toBe('https://legal.example.test');

            const invalidAudience = await fetch(`${base}/api/governed/documents/${documentId}`, {
                headers: { Authorization: `Bearer ${tokenFor(users.records, { audience: 'wrong-audience' })}` }
            });
            expect(invalidAudience.status).toBe(401);

            const authorized = await fetch(`${base}/api/governed/documents/${documentId}`, {
                headers: { Authorization: `Bearer ${tokenFor(users.records)}` }
            });
            expect(authorized.status).toBe(200);
            const body = await authorized.json();
            expect(body.document).toMatchObject({ id: documentId, status: 'DISPOSED' });

            const providerRoute = await fetch(`${base}/api/governed/documents/${documentId}/provider-operations`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${tokenFor(users.records)}`,
                    'Content-Type': 'application/json',
                    'Idempotency-Key': 'api-provider-disposed-001'
                },
                body: JSON.stringify({
                    expectedVersion: 2,
                    operation: 'FILING_SUBMIT',
                    parameters: { destination: 'New York County Clerk' }
                })
            });
            expect(providerRoute.status).toBe(409);
            await expect(providerRoute.json()).resolves.toMatchObject({
                error: { code: 'INVALID_DOCUMENT_STATE' }
            });

            const missing = await fetch(`${base}/legacy/generate`);
            expect(missing.status).toBe(404);
        } finally {
            await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        }
    });
});

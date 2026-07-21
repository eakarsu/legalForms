-- Governed, matter-scoped document review workflow.
-- This migration intentionally stores document evidence and provenance, not raw
-- document bytes. The referenced storage provider remains the system of record.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS governed_matter_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matter_id UUID NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    access_role TEXT NOT NULL CHECK (access_role IN ('AUTHOR', 'LEGAL_REVIEWER', 'RECORDS_MANAGER')),
    granted_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_by UUID REFERENCES users(id) ON DELETE RESTRICT,
    revoked_at TIMESTAMPTZ,
    CONSTRAINT governed_matter_access_revocation_pair CHECK (
        (revoked_at IS NULL AND revoked_by IS NULL)
        OR (revoked_at IS NOT NULL AND revoked_by IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_governed_matter_access_active
    ON governed_matter_access (matter_id, user_id, access_role)
    WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_governed_matter_access_lookup
    ON governed_matter_access (matter_id, user_id, access_role, revoked_at);

CREATE TABLE IF NOT EXISTS governed_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matter_id UUID NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 300),
    jurisdiction TEXT NOT NULL CHECK (jurisdiction ~ '^[A-Z]{2}(-[A-Z0-9]{2,3})?$'),
    status TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'DISPOSED')),
    current_version INTEGER NOT NULL CHECK (current_version > 0),
    retention_until DATE NOT NULL,
    legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
    legal_hold_reason TEXT,
    disposed_at TIMESTAMPTZ,
    disposed_by UUID REFERENCES users(id) ON DELETE RESTRICT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT governed_documents_hold_reason CHECK (
        (legal_hold AND length(btrim(legal_hold_reason)) > 0)
        OR (NOT legal_hold AND legal_hold_reason IS NULL)
    ),
    CONSTRAINT governed_documents_disposition_pair CHECK (
        (status = 'DISPOSED' AND disposed_at IS NOT NULL AND disposed_by IS NOT NULL)
        OR (status <> 'DISPOSED' AND disposed_at IS NULL AND disposed_by IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_governed_documents_matter
    ON governed_documents (matter_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS governed_document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES governed_documents(id) ON DELETE RESTRICT,
    version_number INTEGER NOT NULL CHECK (version_number > 0),
    jurisdiction TEXT NOT NULL CHECK (jurisdiction ~ '^[A-Z]{2}(-[A-Z0-9]{2,3})?$'),
    effective_from DATE NOT NULL,
    effective_to DATE,
    template_authority TEXT NOT NULL CHECK (length(btrim(template_authority)) BETWEEN 1 AND 300),
    source_uri TEXT NOT NULL CHECK (source_uri ~ '^https://'),
    source_sha256 CHAR(64) NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
    source_retrieved_at TIMESTAMPTZ NOT NULL,
    storage_uri TEXT NOT NULL CHECK (storage_uri ~ '^(https|s3)://'),
    content_sha256 CHAR(64) NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
    redaction_status TEXT NOT NULL DEFAULT 'NOT_REQUIRED'
        CHECK (redaction_status IN ('NOT_REQUIRED', 'REDACTED')),
    redaction_note TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT governed_document_versions_dates CHECK (
        effective_to IS NULL OR effective_to >= effective_from
    ),
    CONSTRAINT governed_document_versions_redaction CHECK (
        (redaction_status = 'NOT_REQUIRED' AND redaction_note IS NULL)
        OR (redaction_status = 'REDACTED' AND length(btrim(redaction_note)) > 0)
    ),
    UNIQUE (document_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_governed_document_versions_document
    ON governed_document_versions (document_id, version_number DESC);

CREATE TABLE IF NOT EXISTS governed_document_review_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    version_number INTEGER NOT NULL,
    reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    decision TEXT NOT NULL CHECK (decision IN ('APPROVE', 'REJECT')),
    reviewer_jurisdiction TEXT NOT NULL
        CHECK (reviewer_jurisdiction ~ '^[A-Z]{2}(-[A-Z0-9]{2,3})?$'),
    legal_attestation BOOLEAN NOT NULL CHECK (legal_attestation),
    jurisdiction_confirmed BOOLEAN NOT NULL,
    notes TEXT,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id, version_number)
        REFERENCES governed_document_versions(document_id, version_number) ON DELETE RESTRICT,
    CONSTRAINT governed_review_rejection_notes CHECK (
        decision <> 'REJECT' OR length(btrim(notes)) > 0
    ),
    CONSTRAINT governed_review_approval_jurisdiction CHECK (
        decision <> 'APPROVE' OR jurisdiction_confirmed
    ),
    UNIQUE (document_id, version_number, reviewer_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_governed_document_version_approval
    ON governed_document_review_decisions (document_id, version_number)
    WHERE decision = 'APPROVE';

CREATE TABLE IF NOT EXISTS governed_document_idempotency (
    actor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    operation TEXT NOT NULL CHECK (length(operation) BETWEEN 1 AND 100),
    idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 128),
    request_sha256 CHAR(64) NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
    response_status INTEGER NOT NULL CHECK (response_status BETWEEN 200 AND 299),
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (actor_id, operation, idempotency_key)
);

CREATE TABLE IF NOT EXISTS governed_document_audit_events (
    sequence BIGSERIAL PRIMARY KEY,
    id UUID NOT NULL UNIQUE,
    matter_id UUID NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
    document_id UUID REFERENCES governed_documents(id) ON DELETE RESTRICT,
    actor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    event_type TEXT NOT NULL CHECK (length(event_type) BETWEEN 1 AND 100),
    event_payload JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    previous_hash CHAR(64) NOT NULL CHECK (previous_hash ~ '^[0-9a-f]{64}$'),
    event_hash CHAR(64) NOT NULL CHECK (event_hash ~ '^[0-9a-f]{64}$'),
    UNIQUE (matter_id, event_hash)
);

CREATE INDEX IF NOT EXISTS idx_governed_document_audit_matter
    ON governed_document_audit_events (matter_id, sequence);
CREATE INDEX IF NOT EXISTS idx_governed_document_audit_document
    ON governed_document_audit_events (document_id, sequence);

CREATE OR REPLACE FUNCTION governed_reject_immutable_change()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS governed_versions_append_only ON governed_document_versions;
CREATE TRIGGER governed_versions_append_only
    BEFORE UPDATE OR DELETE ON governed_document_versions
    FOR EACH ROW EXECUTE FUNCTION governed_reject_immutable_change();

DROP TRIGGER IF EXISTS governed_reviews_append_only ON governed_document_review_decisions;
CREATE TRIGGER governed_reviews_append_only
    BEFORE UPDATE OR DELETE ON governed_document_review_decisions
    FOR EACH ROW EXECUTE FUNCTION governed_reject_immutable_change();

DROP TRIGGER IF EXISTS governed_idempotency_append_only ON governed_document_idempotency;
CREATE TRIGGER governed_idempotency_append_only
    BEFORE UPDATE OR DELETE ON governed_document_idempotency
    FOR EACH ROW EXECUTE FUNCTION governed_reject_immutable_change();

DROP TRIGGER IF EXISTS governed_audit_append_only ON governed_document_audit_events;
CREATE TRIGGER governed_audit_append_only
    BEFORE UPDATE OR DELETE ON governed_document_audit_events
    FOR EACH ROW EXECUTE FUNCTION governed_reject_immutable_change();

CREATE OR REPLACE FUNCTION governed_guard_access_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'governed matter access cannot be deleted' USING ERRCODE = '55000';
    END IF;

    IF OLD.revoked_at IS NOT NULL
       OR NEW.id IS DISTINCT FROM OLD.id
       OR NEW.matter_id IS DISTINCT FROM OLD.matter_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.access_role IS DISTINCT FROM OLD.access_role
       OR NEW.granted_by IS DISTINCT FROM OLD.granted_by
       OR NEW.granted_at IS DISTINCT FROM OLD.granted_at
       OR NEW.revoked_at IS NULL
       OR NEW.revoked_by IS NULL THEN
        RAISE EXCEPTION 'only a one-way access revocation is allowed' USING ERRCODE = '55000';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS governed_access_guard ON governed_matter_access;
CREATE TRIGGER governed_access_guard
    BEFORE UPDATE OR DELETE ON governed_matter_access
    FOR EACH ROW EXECUTE FUNCTION governed_guard_access_change();

CREATE OR REPLACE FUNCTION governed_guard_document_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'governed documents cannot be deleted' USING ERRCODE = '55000';
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.matter_id IS DISTINCT FROM OLD.matter_id
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.jurisdiction IS DISTINCT FROM OLD.jurisdiction
       OR NEW.retention_until IS DISTINCT FROM OLD.retention_until
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'governed document identity is immutable' USING ERRCODE = '55000';
    END IF;

    IF NEW.current_version < OLD.current_version
       OR NEW.current_version > OLD.current_version + 1 THEN
        RAISE EXCEPTION 'document versions must advance exactly once' USING ERRCODE = '55000';
    END IF;

    IF NEW.current_version = OLD.current_version + 1 THEN
        IF OLD.status IN ('PENDING_REVIEW', 'DISPOSED') OR NEW.status <> 'DRAFT' THEN
            RAISE EXCEPTION 'a new version cannot be created from this state' USING ERRCODE = '55000';
        END IF;
    ELSIF NEW.status IS DISTINCT FROM OLD.status AND NOT (
        (OLD.status = 'DRAFT' AND NEW.status = 'PENDING_REVIEW')
        OR (OLD.status = 'PENDING_REVIEW' AND NEW.status IN ('APPROVED', 'REJECTED'))
        OR (OLD.status = 'APPROVED' AND NEW.status = 'DISPOSED')
    ) THEN
        RAISE EXCEPTION 'invalid governed document state transition' USING ERRCODE = '55000';
    END IF;

    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS governed_document_guard ON governed_documents;
CREATE TRIGGER governed_document_guard
    BEFORE UPDATE OR DELETE ON governed_documents
    FOR EACH ROW EXECUTE FUNCTION governed_guard_document_change();

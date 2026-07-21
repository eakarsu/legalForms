-- Append-only external provider evidence for storage, OCR, e-signature, filing,
-- and verified deletion. Raw document contents are never stored here.

CREATE TABLE IF NOT EXISTS governed_document_provider_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence BIGSERIAL NOT NULL UNIQUE,
    document_id UUID NOT NULL,
    version_number INTEGER NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN (
        'STORAGE_VERIFY', 'OCR_EXTRACT', 'ESIGN_CREATE', 'ESIGN_STATUS',
        'FILING_SUBMIT', 'STORAGE_DELETE'
    )),
    provider TEXT NOT NULL CHECK (length(btrim(provider)) BETWEEN 1 AND 200),
    external_event_id TEXT NOT NULL CHECK (length(btrim(external_event_id)) BETWEEN 1 AND 300),
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'SUCCEEDED', 'FAILED')),
    request_sha256 CHAR(64) NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
    response_sha256 CHAR(64) NOT NULL CHECK (response_sha256 ~ '^[0-9a-f]{64}$'),
    receipt_uri TEXT CHECK (receipt_uri ~ '^(https|s3)://'),
    evidence_sha256 CHAR(64) NOT NULL CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$'),
    output_sha256 CHAR(64) CHECK (output_sha256 ~ '^[0-9a-f]{64}$'),
    occurred_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id, version_number)
        REFERENCES governed_document_versions(document_id, version_number) ON DELETE RESTRICT,
    UNIQUE (provider, external_event_id, operation)
);

CREATE INDEX IF NOT EXISTS idx_governed_provider_events_document
    ON governed_document_provider_events (document_id, version_number, operation, sequence DESC);

DROP TRIGGER IF EXISTS governed_provider_events_append_only ON governed_document_provider_events;
CREATE TRIGGER governed_provider_events_append_only
    BEFORE UPDATE OR DELETE ON governed_document_provider_events
    FOR EACH ROW EXECUTE FUNCTION governed_reject_immutable_change();

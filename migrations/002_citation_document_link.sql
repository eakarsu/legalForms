-- Migration 002: Add document_id link to legal_citations
-- Allows citations to be directly linked to document_history records
-- for persistent retrieval per document.

ALTER TABLE legal_citations
    ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES document_history(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_legal_citations_document_id ON legal_citations(document_id);

-- Also add signing_url column to esignature_requests if not present
-- (used by the embedded signing flow added in the DocuSign stub fix)
ALTER TABLE esignature_requests
    ADD COLUMN IF NOT EXISTS signing_url TEXT;

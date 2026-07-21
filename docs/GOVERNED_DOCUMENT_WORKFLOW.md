# Governed matter document workflow

This is the bounded production workflow implemented by the project:

1. The matter owner grants `AUTHOR`, `LEGAL_REVIEWER`, or `RECORDS_MANAGER` access to a specific matter.
2. An author creates a document version using an allowlisted authoritative HTTPS template source and an external encrypted-storage URI. The API records source/content SHA-256 evidence, jurisdiction, effective dates, retrieval time, and redaction status; it never receives raw document bytes.
3. The author submits the current effective version for review using optimistic `expectedVersion` control.
4. A separately granted human legal reviewer attests to the review and confirms the matching jurisdiction. Authors cannot review their own versions.
5. The workflow verifies storage, records OCR output digests, handles e-signature failure/status/retry, and submits a completed signed version to the configured filing gateway. Every call is idempotent and produces an append-only provider event without storing raw document bytes.
6. A records manager exports a hash-chained evidence manifest, places/releases legal holds, and can request storage deletion only after retention expires. Disposition accepts only the resulting successful stored deletion event; caller-supplied receipts are not trusted.

All mutation endpoints require `Idempotency-Key` (8–128 safe characters). Reusing a key with the same request returns the stored response and creates no new event. Reusing it with a different request returns `409 IDEMPOTENCY_CONFLICT`.

## Endpoints

- `POST /api/governed/matters/:matterId/access`
- `POST /api/governed/matters/:matterId/access/:grantId/revoke`
- `GET /api/governed/matters/:matterId/audit`
- `POST /api/governed/documents`
- `GET /api/governed/documents/:documentId`
- `POST /api/governed/documents/:documentId/versions`
- `POST /api/governed/documents/:documentId/submit-review`
- `POST /api/governed/documents/:documentId/reviews`
- `POST /api/governed/documents/:documentId/legal-hold`
- `POST /api/governed/documents/:documentId/provider-operations`
- `POST /api/governed/documents/:documentId/evidence-export`
- `POST /api/governed/documents/:documentId/disposition`

Bearer tokens must be short lived, use `HS256`, and contain a `sub` matching an active database user plus the configured issuer and audience. Authorization is reloaded from the database; token claims do not grant matter roles.

## External contracts and launch gates

`provider-operations` accepts `STORAGE_VERIFY`, `OCR_EXTRACT`, `ESIGN_CREATE`, `ESIGN_STATUS`, `FILING_SUBMIT`, and `STORAGE_DELETE`. OCR requires verified storage; e-signature and filing require independent approval; filing requires a completed signature event; failed signatures may be retried; and storage deletion is blocked by active retention or legal hold. The configured gateways must use HTTPS, bearer credentials of at least 32 characters, bounded JSON responses, and the receipt/digest contract implemented in `lib/governedProviders.js`.

The workflow does not claim to provide legal advice or authoritative templates. Launch requires organization-approved template authorities and jurisdictions, approved storage/OCR/e-signature/filing providers, legal/compliance approval, identity provisioning/deprovisioning, retention schedules, backup/restore and failover exercises, provider outage/reconciliation drills, ingress/WAF monitoring, accessibility review, load/concurrency testing, and named operational owners.

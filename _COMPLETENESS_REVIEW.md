# Completeness Review: legalForms

**Review date:** 2026-07-18

## Assessment basis

Static inspection of project-owned source and configuration only; no dependency installation, build, database migration, external-service call, or runtime launch was performed. The scan considered 651 project files (190 source files), 2 manifest(s), 34 test-like file(s), and 0 CI workflow(s), excluding dependency/generated directories.

## Classification

**Functional but incomplete**

This is a substantive but unfinished legal/document workflow application, not just an empty scaffold. Inspection found 190 source files across `prompts/`, `views/`, `ios/`, `routes/` using Next.js, React, Express, Swift/iOS; however, the checked-in workflow and delivery controls do not yet demonstrate a complete, production-operable product.

## Why it is not complete

- Mock, demo, sample, fixture, or placeholder behavior remains in executable/product paths.
- No checked-in CI workflow proves builds, tests, migrations, and security checks on every change.

## Needed features

1. Add matter-scoped permissions, document provenance, version history, privileged-access controls, and immutable audit events.
2. Integrate OCR, e-signature, filing/storage, retention/legal-hold, and authoritative template sources.
3. Require human legal review and jurisdiction/effective-date validation for generated clauses, forms, or recommendations.
4. Test redaction, conflicting versions, signer failure, access revocation, export, and retention workflows end to end.
5. Add risk-based unit, integration, and end-to-end tests in CI, including migration and failure-path coverage.

## Risks or launch blockers

- Credential/configuration exposure: environment files are present in the repository tree and must be checked against Git history and rotated if real.
- Weak/fallback secret patterns can permit forged sessions or accidental insecure deployments.
- TLS certificate verification is disabled in inspected code.
- Automation contains destructive process, filesystem, or database operations; do not run it on a shared machine without review.

## Evidence inspected

- `README.md`
- `config/database.js:10`
- `server.js:227`
- `server.js`
- `tests/api/billing.test.js`
- `package.json`

## Recommended next action

Choose one real legal/document workflow journey, define acceptance criteria and external contracts, then close its persistence, permission, integration, failure, and test gaps before expanding features.

## Implementation progress (2026-07-20)

**Bounded workflow status: implemented and verified. The broader legacy suite remains functional but incomplete and is not the supported production surface.**

The supported `governed-server.js` journey now covers matter-owner grants and one-way revocation for `AUTHOR`, `LEGAL_REVIEWER`, and `RECORDS_MANAGER`; allowlisted authoritative HTTPS template provenance; external evidence-storage references and SHA-256 source/content evidence without raw document bodies; immutable numbered versions with optimistic conflict control; redaction evidence; effective-date and jurisdiction enforcement; independent human legal-review attestation with self-review denial; legal holds; retention-gated verified deletion and disposition; idempotent mutation replay/conflict handling; and hash-chained evidence/audit export. The typed provider path now verifies storage, records OCR output digests, creates and polls e-signature requests, preserves failed signer evidence and permits a controlled retry, submits completed signatures for filing, and accepts disposition only from a successful append-only deletion provider event. Migrations `003_governed_document_review.sql` and `004_governed_provider_delivery.sql` supply the constrained persistence model, append-only database guards, indexes, provider evidence, and state-transition controls. The migration runner records checksums, rejects drift, and is safe to rerun.

The default application/container boundary now exposes only this governed API plus liveness/readiness. Production configuration fails closed on weak JWT/session secrets, token lifetimes over 15 minutes, non-HTTPS origins, missing template-source hosts, loopback production databases, or database TLS without certificate verification. The Docker image uses a minimal independently locked dependency graph, a non-root user, no bundled database, and a separate migration command; Compose renders a read-only/capability-dropped local topology. Previously destructive start scripts no longer kill processes, install dependencies, seed data, or mutate the database except in explicit migration mode. CI now applies migrations twice, runs the governed integration/API suite and build, audits the minimal runtime, builds the image, and scans the current source for secrets. Security, provider-contract, workflow, deployment, backup/restore, monitoring, and incident guidance is checked in.

Verification used a fresh disposable PostgreSQL 17 cluster: migrations `001` through `004` applied, a second pass reported all current, checksum drift failed closed, and all 9 governed tests passed. Coverage includes configuration failure, owner/grant boundaries, idempotent replay and mismatched-key conflict, ungoverned source rejection, redaction evidence, future-effective template rejection, optimistic version conflict, independent approval and self-review denial, jurisdiction mismatch, provider prerequisite enforcement, storage replay without duplicate calls, OCR digest evidence, failed signer status and retry, completed-signature filing, verified storage deletion, evidence export and audit-chain verification, legal hold/release, retention disposition, access revocation, database append-only rejection, authentication, CORS, readiness, and retired-route behavior. The JavaScript/EJS build, production-runtime audit (`0` vulnerabilities), current-source Gitleaks scan, Compose rendering, workflow YAML parse, shell syntax, diff checks, live entry-point smoke, and an assembled minimal-runtime smoke all passed. The live API returned readiness/health `200`, legacy route `404`, unauthenticated governed access `401`, and disallowed-origin preflight `403`.

Credential history is not resolved: tracked Aider histories/caches and three legacy iOS scripts containing credential-shaped material were removed from the current tree, and the current-source scan is clean, but Gitleaks still reports 48 findings across 102 Git commits and `.env` appears in two historical commits. All possibly exposed OpenRouter, DocuSign, JWT, database, and private-key credentials require owner-led rotation and Git-history remediation before launch. The broad legacy root dependency graph also reports 39 production findings (8 low, 12 moderate, 17 high, 2 critical) and must not be deployed; it is excluded from the minimal governed image. Local image construction could not run because the configured Docker/Colima daemon is stopped, so the checked-in CI image gate remains required.

Launch still requires organization-approved authoritative template hosts and jurisdiction/effective-date policy; approved production storage, OCR, e-signature, and filing gateways implementing the checked-in evidence contract; legal/compliance and records approval; identity lifecycle integration; calibrated retention schedules; representative load/concurrency testing; backup/restore, provider outage/reconciliation, and failover exercises; accessibility/security review; monitoring and incident drills; and named operational owners. No implementation here provides legal advice or authorizes unsupervised use of generated legal material.

## Runtime verification (2026-07-20)

- The governed entry point now honors the caller-assigned bind host as well as `PORT`; disposable startup returned liveness/readiness `200` on its unique loopback port.
- The supported API intentionally has no password-login issuer. Its bearer-token authentication, active-user reload, issuer/audience checks, unauthorized rejection, and primary governed workflow are covered by the nine-test acceptance suite recorded above. Starting the excluded legacy server merely to obtain a form login would violate the reviewed production boundary.

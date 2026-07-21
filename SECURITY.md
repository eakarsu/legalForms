# Security policy

The supported production surface is `governed-server.js`. It exposes only health/readiness and the matter-scoped governed document API. `server.js` is retained as an explicitly unsupported legacy/demo surface and is not copied into the production image.

## Required deployment controls

- Use a unique `JWT_SECRET` of at least 32 characters, short-lived `HS256` tokens with the configured issuer/audience, and an external identity lifecycle that disables departed users.
- Use `NODE_ENV=production`, an external `DATABASE_URL`, and `DB_SSL_MODE=verify-full`. Supply `DATABASE_SSL_CA` when the database certificate is not rooted in the system trust store.
- Set exact HTTPS `ALLOWED_ORIGINS` and an explicit `GOVERNED_SOURCE_HOSTS` allowlist. Wildcards are not accepted.
- Configure separate HTTPS storage, OCR, e-signature, and filing gateways with independently rotatable tokens. Gateways must honor idempotency keys, cap response sizes, and return digest-bound evidence; never put provider credentials in URLs or logs.
- Run `node scripts/migrate.js` as a separate deployment job before starting the API. Migration checksums are verified on every run.
- Keep the API container read-only, non-root, without Linux capabilities, and place it behind authenticated TLS ingress.
- Store document bytes in an approved encrypted evidence vault. This service stores immutable hashes and storage references, not raw legal-document content.

## Incident response

Preserve the evidence export and database audit chain, place affected matters on legal hold, revoke matter grants, rotate authentication secrets, and retain database and ingress logs under the organization’s incident policy. Do not delete or update governed versions, review decisions, idempotency records, or audit events; database triggers reject those mutations.

Report a suspected vulnerability privately to the repository owner. Do not include client data, credentials, document bodies, or live evidence links in an issue.

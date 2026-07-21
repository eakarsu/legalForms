# Governed API operations

## Deployment sequence

1. Configure production variables from `.env.example` in a secret manager; do not deploy a `.env` file.
2. Run `node scripts/migrate.js` as a one-shot job. A second run must report all migrations current. A checksum mismatch is a hard failure requiring investigation, never an edit to migration history.
3. Start `node governed-server.js` as the non-root application user.
4. Require `GET /readyz` to return `200` with `004_governed_provider_delivery.sql` before routing traffic. `GET /healthz` only proves the process is alive.
5. Verify authentication failure, CORS denial, an idempotent replay, and evidence-chain verification in the deployed environment.

`compose.yml` is a local validation topology and intentionally uses plaintext database transport only on its private Compose network with `NODE_ENV=development`. Production must use a separately operated TLS-verifying PostgreSQL service.

## Backup, recovery, and monitoring

- Back up PostgreSQL with point-in-time recovery and retain the external evidence vault independently. Restore both into an isolated environment and verify every matter audit chain.
- Alert on readiness failures, authentication spikes, `409` version/idempotency conflicts, provider timeouts/rejections/`FAILED` events, stalled `PENDING` signatures or filings, `500 AUDIT_CHAIN_INVALID`, migration checksum failures, grant/revocation activity, legal-hold changes, evidence exports, and dispositions.
- Never repair governed evidence in place. Preserve the incident state and add a compensating operational record under an approved runbook.

## Safe local commands

```sh
npm ci
npm run migrate
npm run test:governed
./start.sh --api
```

`./start.sh` does not kill processes, seed data, install packages, or modify the database beyond the explicit `--migrate` mode. The legacy server is available only through `./start.sh --legacy` and is not supported for production.

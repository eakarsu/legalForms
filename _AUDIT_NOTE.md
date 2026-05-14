# Audit Apply Notes — legalForms

Source: `_AUDIT/reports/batch_10.md` § Template-clones #24 legalForms

## Original audit recommendations

> 34 route files with many AI-suggestive names (ai-billing, ai-calendar, ai-communications, ai-conflicts, ai-drafting, ai-intake, ai-predictions, ai-features, portal-ai) **but zero AI endpoints**. Routes likely exist as stubs.

Reality check: the routes are not stubs. `routes/ai-drafting.js` alone has 14 endpoints including `POST /api/ai-drafting/generate`, `POST /api/ai-drafting/sessions/:id/revise`, `POST /api/ai-drafting/sessions/:id/regenerate`, `POST /api/ai-drafting/sessions/:id/refine`, all wired against the OpenRouter chat completions API. Other `ai-*` routers follow the same pattern. The audit's "0 AI endpoints" count appears to come from a route-discovery heuristic that missed nested `/api/ai-*/...` paths.

### Audit's "What's missing" wishlist
- ai-billing → cost prediction / invoice analysis (the `routes/ai-billing.js` file already exists)
- ai-calendar → auto-schedule with conflict avoidance (file exists)
- ai-communications → draft emails (file exists)
- ai-conflicts → detect legal issue risk (file exists)
- ai-drafting → generate documents (verified: 14 endpoints already)
- ai-intake → parse intake forms (file exists)
- ai-predictions → flag case outcome likelihood (file exists)

The audit recommends building features that already have route files. Without auditing each file's endpoint coverage in detail, blindly adding more endpoints is likely to duplicate work.

## Implemented this pass

**None.**

Reason: the safe mechanical step is **audit reconciliation**, not new endpoint addition. Each `ai-*` route file appears to already wire OpenRouter for its claimed feature. Adding a 4th drafting endpoint to a router that already has 14 would be net-negative. The `_AUDIT_NOTE.md` records the discrepancy for the next reconciliation pass.

## Backlog (not implemented)

### Audit reconciliation (recommended next pass)
- Re-audit each `routes/ai-*.js` file and update batch_10's "0 AI endpoints" claim to the actual count.

### Genuinely missing (per this pass's spot-check, not exhaustive)
- Citation-finder semantic search backend — file exists; needs verification of OpenRouter wiring.
- OCR endpoint — `routes/ocr.js` exists; verify if AI is actually used.
- Voice-notes transcription — `routes/voice-notes.js` exists; verify ASR wiring.

### Needs creds / external deps
- E-signature provider (file exists but vendor selection not verified).
- Court calendar sync (state-by-state).

### Needs schema work
- Trust accounting reconciliation surfaces — present in CRUD form; any AI add would need clear policy guardrails.

## Categorisation

- MECHANICAL: skipped pending audit reconciliation; otherwise risk of duplicate endpoints.
- NEEDS-AUDIT-RECONCILIATION: recount endpoints in each `ai-*.js` and update batch_10 report.
- NEEDS-CREDS: e-signature, court calendar.
- NEEDS-PRODUCT-DECISION: trust-accounting AI guardrails.

## Apply pass 3 (frontend)

LEFT-AS-IS. legalForms is a server-side rendered Express + EJS app, not a SPA, so the JWT-from-localStorage SPA pattern does not apply (the app already supports both Bearer JWT and Express session in `middleware/auth.js`). EJS views already exist for the AI features served by the `ai-*` routers: `views/ai-drafting/{dashboard,new,session,sessions,templates}.ejs`, `views/ai/conflicts-dashboard.ejs`, `views/billing/ai-suggestions.ejs`, `views/calendar/ai-assistant.ejs`, `views/features/ai-drafting.ejs`, `views/features/ai-efficiency.ejs`, plus per-feature dirs (`citation-finder/`, `contract-analysis/`, `document-summary/`, `ocr/`, `voice/`, `intake/`, `conflicts/`, `communications/`). No frontend gap detected; the open task remains the audit-reconciliation pass already noted above.

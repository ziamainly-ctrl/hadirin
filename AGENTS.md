# AGENTS.md — Hadirin

Instructions for every AI coding agent (Claude Code, Cursor, Copilot, others) working in this repository. This file is an **architectural contract**. Do not deviate from it without explicit approval from the human maintainer.

Read in this order: this file → [TRD.md](TRD.md) (how) → [ERD.md](ERD.md) (schema, value sets, seed) → [PRD.md](PRD.md) (what and why). Read code only when the docs do not answer the question.

## Project scope

Hadirin is attendance-only SaaS for Indonesian SMEs: GPS + selfie check-in/out, live dashboard, a one-level approval inbox (correction, leave, sick, permit), monthly recap export, and Midtrans subscription billing. It re-implements the attendance **concepts** of `growt/digispace-ydsf-v2` from scratch. Never copy code from that repo. Payroll, tax, BPJS, performance, loans and business trips are out of scope (PRD §4.6). Push back on requests that drift there.

## Hard rules

- **Rendering:** Next.js App Router with SSR. Not a SPA. Server Components by default; `"use client"` only for interactive leaves. `.html`/`.jsx` mockups are references only.
- **Hosting:** one Vercel project for UI + API, region `sin1`.
- **Database:** Neon Postgres via `@neondatabase/serverless` with **raw parameterized SQL** (`$1, $2…`). No ORM at runtime.
- **API structure:** one model = one folder `app/api/{model}/route.ts` (+ `[id]/route.ts` and action sub-routes).
- **Query separation (mandatory):** all SQL lives in `lib/queries/{model}.ts`. No SQL strings in `route.ts`, `page.tsx`, server actions or components.
- **Drizzle:** only `drizzle-kit generate/migrate` and the idempotent seed. Never import `drizzle-orm` outside `db/` and `scripts/`.
- **Keys:** `BIGSERIAL`/`BIGINT`. Never UUID.
- **Enumerations:** `VARCHAR` + the documented value set in ERD §1.1 and `lib/constants/`. Never native Postgres `ENUM`.
- **Files:** Vercel Blob only. The DB stores URLs. Never base64 or bytea. Selfies and attachments are personal data: private store, `addRandomSuffix: true`, served through `/api/files/[...path]` with a role + tenant check.
- **Cache / ratelimit / idempotency:** Upstash Redis with the key catalogue in TRD §10.
- **Payments:** Midtrans Snap. Webhooks are signature-verified and idempotent.
- **Dependencies:** the fixed list in TRD §3. Ask before adding anything.
- **Reuse:** anything rendered twice goes to `components/ui/` or `components/shared/`. Use the existing component; never hand-roll a clone.

## Domain rules (security-critical)

1. **Tenant from session only.** `org_id` comes from `requireSession()`, never from body, query or params. Every tenant query starts with `WHERE org_id = $1`.
2. **Authorize on the server.** Every route handler checks role (and plan feature where relevant). UI hiding is cosmetic.
3. **Never trust client identity fields.** If a handler accepts a `user_id`, it must re-verify that user belongs to the session org and that the caller may act on them.
4. **Server time is truth.** Check-in/out timestamps come from `now()` in SQL. Client clocks are display-only.
5. **Server computes geofence.** The client sends raw lat/lng/accuracy. The server computes the distance and the outside flag.
6. **Idempotent writes.** Check-in uses `ON CONFLICT (user_id, work_date) DO NOTHING`. Approvals update only `WHERE status = 'PENDING'`. Webhooks dedupe in Redis.
7. **Cross-tenant ids → 404.**
8. **`password_hash` never leaves `lib/queries/users.ts`** except through the login function.
9. **Only tracked users clock in.** `shift_id IS NULL` means not tracked: no check-in, no ABSENT rows.
10. **History is a snapshot.** Attendance rows copy `shift_id`, `scheduled_in`, `scheduled_out`. Editing a shift never rewrites past logs.

Rules 1–3 exist because `digispace-ydsf-v2` enforced permissions only in its Vue frontend and trusted a client-supplied employee id.

## Data classes

Before adding a table or column, classify it (ERD §1): **static** (code constant), **platform CMS**, **tenant master data**, or **transactional**. Static values belong in `lib/constants/`, not in a table. CMS data is cached in Redis and busted on write. Transactional rows are written by the system and never edited through a CMS screen.

## Working conventions

- Language: code, comments, docs and commit messages in English. UI copy in Bahasa Indonesia.
- Validation: a zod schema per input in `lib/validators/{model}.ts`. Length caps match the column sizes.
- Errors: `{ error: { code, message, fields? } }` with the status codes in TRD §6.
- `updated_at = now()` in every UPDATE (there is no trigger).
- Money is integer rupiah (`BIGINT`). Format with `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })`.
- Time: store `TIMESTAMPTZ`. Compute work dates in the org timezone (`organizations.timezone`, default `Asia/Jakarta`).
- Pure business rules (`lib/attendance-rules.ts`, `lib/geo.ts`) have unit tests that use the seed rows in ERD §4 as fixtures.
- Schema change = update `db/schema.ts` + generated migration + ERD §3 (and §1.1 for new value sets) + seed if needed, **in the same change**.
- Behavior or contract change = update PRD/TRD in the same change.

## Pre-commit checklist

- [ ] No SQL in `route.ts`, `page.tsx`, actions or components. All of it is in `lib/queries/{model}.ts`.
- [ ] All SQL uses placeholders. No string interpolation of values. Dynamic `ORDER BY` comes from a whitelist.
- [ ] No `drizzle-orm` import in runtime code.
- [ ] New keys are `BIGSERIAL`/`BIGINT`. New status columns are `VARCHAR` with a documented value set.
- [ ] Every new tenant query filters by the session `org_id`. Every new route handler calls `requireSession` with explicit roles.
- [ ] New uploads go to Vercel Blob through `/api/uploads`.
- [ ] New pages are Server Components unless interactivity requires otherwise. Public pages export `metadata`.
- [ ] Repeated UI is in `components/ui` or `components/shared`.
- [ ] Cache keys added/busted per TRD §10.
- [ ] ERD/TRD/PRD updated if schema, contract or behavior changed.
- [ ] `npm run lint`, `npm run test`, `npm run build` pass.

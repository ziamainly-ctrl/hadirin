# CLAUDE.md — Hadirin

Guidance for Claude Code in this repository.

**Read [AGENTS.md](AGENTS.md) first.** It is the binding contract: hard rules, security-critical domain rules, and the pre-commit checklist. Then use [TRD.md](TRD.md) for architecture, [ERD.md](ERD.md) for schema/value sets/seed, and [PRD.md](PRD.md) for scope.

## What this is

Attendance-only SaaS (Next.js 16 App Router SSR + Neon raw SQL + Upstash + Vercel Blob + Midtrans) for Indonesian SMEs. Hackathon MVP. It re-implements the attendance concepts of `growt/digispace-ydsf-v2`. Do not copy code from there.

## Commands

Run from this folder (`growt/hadirin`), not the monorepo root.

```bash
npm run dev
npm run build
npm run lint
npm run test
npm run db:generate     # drizzle-kit generate
npm run db:migrate      # uses DATABASE_URL_UNPOOLED
npm run db:seed         # idempotent
npm run db:reset-demo   # demo only
```

## Non-negotiables (summary of AGENTS.md)

- SQL only in `lib/queries/{model}.ts`, parameterized. No ORM at runtime. Drizzle is migrations + seed only.
- `org_id` comes from the session. Authorization happens in every route handler, never only in the UI.
- Server clock and server-side geofence for check-in/out.
- `BIGSERIAL`, `VARCHAR` value sets, Blob URLs (no binaries in the DB).
- Fixed dependency list (TRD §3). Ask before adding packages.
- Reuse `components/ui` and `components/shared`.

## Scope guard

Out of scope for the hackathon: payroll, tax, BPJS, overtime pay, performance, loans, business trips, face recognition, native apps, multi-level approvals, rotating shifts. If a request needs one of these, say so and ask before building.

## Docs upkeep

A schema, API contract or behavior change updates ERD/TRD/PRD in the same change. Seed edits must stay idempotent. Re-check `late_minutes`/`work_minutes` against the rules in ERD §3.2.

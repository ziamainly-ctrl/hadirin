# TRD — Hadirin

> Technical reference. Product scope: [PRD.md](PRD.md). Schema and seed: [ERD.md](ERD.md). Agent contract: [AGENTS.md](AGENTS.md).
> Last updated: 2026-10-07

---

## 1. Hard rules

| # | Rule |
|---|---|
| R1 | **Next.js App Router with SSR.** Not a SPA. Server Components by default; `"use client"` only for interactive leaves (camera, map pick, forms, charts, drag and drop). Standalone `.html`/`.jsx` files are visual references only. |
| R2 | **One Vercel project** serves UI and API. Functions pinned to region `sin1` (next to Neon `ap-southeast-1`). |
| R3 | **Neon Postgres serverless** through `@neondatabase/serverless`, **raw parameterized SQL** only (`$1, $2…`). |
| R4 | **API shape:** one model = one folder, `app/api/{model}/route.ts` (+ `[id]/route.ts`, + action sub-routes such as `attendance/check-in/route.ts`). |
| R5 | **Query separation:** every SQL string lives in `lib/queries/{model}.ts`. Route handlers, Server Components and server actions call those functions. No SQL in `route.ts`, `page.tsx` or any component. |
| R6 | **Drizzle is migration + seed only** (`drizzle-kit generate/migrate`, idempotent seed). Never imported in runtime code. |
| R7 | **Vercel Blob** for every file (selfies, attachments, logos, large exports). The database stores URLs only. |
| R8 | **Upstash Redis** for cache, rate limits and idempotency keys. |
| R9 | **Midtrans Snap** for subscription payments. |
| R10 | **Fixed dependencies** (see §3). Adding a library needs maintainer approval. |
| R11 | **Reuse components.** Anything rendered twice goes to `components/ui` or `components/shared`. |
| R12 | **Authorization is server-side.** Every route handler checks role + tenant. Hiding a button is not authorization. |

## 2. Architecture

```
 Browser (SSR pages + small client islands)
   │  /            landing, pricing        (static + ISR, SEO)
   │  /m/*         employee PWA            (SSR, mobile-first)
   │  /app/*       admin panel             (SSR + client tables/charts)
   │  /platform/*  platform CMS            (SSR)
   ▼
 proxy.ts  ── session cookie check, route-group gating (Next 16 replacement for middleware.ts)
   ▼
 app/api/{model}/route.ts  ── zod validation → requireSession(role) → lib/queries/* → response
   │                 │                    │
   ▼                 ▼                    ▼
 Neon Postgres    Upstash Redis       Vercel Blob
 (pooled URL)     cache / ratelimit   selfies, attachments, exports
   │
   └─ Midtrans Snap (checkout) ◄── webhook /api/payments/midtrans/notification
   └─ SMTP (email) / WhatsApp gateway (P1) via lib/notify
 Vercel Cron ── /api/cron/close-day (daily) · /api/cron/billing (daily)
```

## 3. Stack and dependencies

| Area | Package | Notes |
|---|---|---|
| Framework | `next@16`, `react@19`, `typescript@5` | App Router, `proxy.ts`, `after()` for post-response work |
| Styling | `tailwindcss@4` | Design tokens in §14 |
| DB driver | `@neondatabase/serverless` | `neon()` HTTP for single queries and fixed batches (`sql.transaction([...])`); `Pool` (WebSocket) for interactive transactions that branch on a result |
| Migrations | `drizzle-kit`, `drizzle-orm` (schema file only) | Never imported outside `db/` and `scripts/` |
| Cache | `@upstash/redis`, `@upstash/ratelimit` | REST client, edge-safe |
| Files | `@vercel/blob` | Client uploads via `handleUpload` |
| Payments | `midtrans-client` or plain `fetch` to Snap API | Server key server-side only |
| Auth | `jose` (JWT), `bcryptjs` | httpOnly cookie |
| Validation | `zod` | Every request body and query string |
| Client data | `@tanstack/react-query`, `zustand` | Polling the dashboard, small UI state |
| Charts | `recharts` | Dashboard + recap |
| Excel | `xlsx` **from the SheetJS CDN** (`npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`) | Recap export, employee import. The npm registry copy (0.18.5) is vulnerable to CVE-2023-30533 and CVE-2024-22363 when reading uploaded files |
| PDF | `jspdf`, `jspdf-autotable` | Recap PDF |
| Drag and drop | `@dnd-kit/core`, `@dnd-kit/sortable` | Reorder plans / payment methods in CMS; P2 roster board |
| Rich text | `@tiptap/react`, `@tiptap/starter-kit` | Email template editor |
| Email | `nodemailer` | SMTP; swap for a provider later |
| Icons | `lucide-react` | |

## 4. Folder structure

```
hadirin/
├─ app/
│  ├─ (marketing)/            page.tsx (landing), pricing/page.tsx, layout.tsx
│  ├─ (auth)/                 login/page.tsx, register/page.tsx
│  ├─ m/                      employee PWA: page.tsx (today), history/, requests/, requests/new/, profile/
│  ├─ app/                    admin: page.tsx (dashboard), attendance/, requests/, employees/, branches/,
│  │                          shifts/, holidays/, reports/, settings/{organization,notifications,billing}/
│  ├─ platform/               organizations/, plans/, payment-methods/, templates/, holidays/
│  ├─ api/                    see §6
│  ├─ manifest.ts             PWA manifest
│  ├─ robots.ts, sitemap.ts   SEO
│  └─ layout.tsx
├─ components/
│  ├─ ui/                     Button, Input, Select, Dialog, Badge, Card, Table, Pagination, Skeleton, Toast
│  └─ shared/                 StatusBadge, AttendanceTable, RequestCard, SelfieCamera, GeoPermissionGate,
│                             StatTile, DateRangeFilter, BranchFilter, ExportButton, EmptyState, Sidebar
├─ lib/
│  ├─ db.ts                   neon client (single instance)
│  ├─ queries/                one file per model: users.ts, branches.ts, shifts.ts, attendance.ts,
│  │                          attendance-requests.ts, holidays.ts, organizations.ts, plans.ts,
│  │                          payment-methods.ts, invoices.ts, payment-logs.ts,
│  │                          notification-templates.ts, notification-logs.ts, reports.ts
│  ├─ auth.ts                 hash/verify, sign/verify JWT, requireSession(roles)
│  ├─ redis.ts                client, cache helpers, key builders, ratelimiters
│  ├─ geo.ts                  haversine, nearestBranch
│  ├─ attendance-rules.ts     workDate, lateMinutes, workMinutes (pure functions, unit-tested)
│  ├─ midtrans.ts             createSnap, verifySignature
│  ├─ notify.ts               render template, send email/WA, write notification_logs
│  ├─ export/                 xlsx.ts, pdf.ts
│  ├─ validators/             zod schemas per model
│  └─ constants/              roles.ts, statuses.ts, events.ts (static value sets from ERD §1.1)
├─ db/
│  ├─ schema.ts               Drizzle schema (migration source only)
│  └─ seed.sql                Seed from ERD §4
├─ drizzle/                   generated + custom migrations
├─ scripts/                   db-migrate.ts, db-seed.ts, db-reset-demo.ts
├─ proxy.ts
├─ vercel.json
├─ PRD.md · ERD.md · TRD.md · AGENTS.md · CLAUDE.md
```

## 5. Data access pattern

**Bigint-as-string (critical, read before touching `lib/db.ts`).** `@neondatabase/serverless` returns every `bigint`/`int8` column as a JS **string**, unconditionally — confirmed against a real Neon database (`SELECT 42::bigint` comes back as `"42"`, not `42`; `int4`/`integer` is unaffected). Every BIGSERIAL id and FK in this schema is a bigint (ERD.md: "no UUID"), and every query file's TypeScript interface declares these fields as `number` — so without a fix, the declared and actual runtime types diverge on literally every row, everywhere. This is not a theoretical gap: it is exactly what broke login/registration end-to-end during real-environment smoke testing — `setSessionCookie({ org: organization.id, ... })` signed `org` as the string `"6"`, the JWT round-tripped it as a JSON string, and `lib/session.ts`'s `typeof payload.org === 'number'` check rejected every token, so nobody could log in despite every other part of the flow succeeding (201 Created, row genuinely inserted). `lib/db.ts` fixes this at the one place every query shares — see below — so no query file needs to know about it.

```ts
// lib/db.ts
import ws from 'ws';
import { neon, neonConfig, Pool } from '@neondatabase/serverless';
neonConfig.webSocketConstructor = ws; // Node has no stable global WebSocket until v22

function coerceNumericStrings<T>(value: T): T { /* walks arrays/plain objects (never Date),
  turns a string matching /^-?\d+$/ back into a number when it's a safe integer — see the
  function's own comment in lib/db.ts for why this is safe for this specific schema */ }

export const rawSql = neon(process.env.DATABASE_URL!); // only for sql.transaction() batches — see below
export const sql = {
  query: async (text: string, params: unknown[] = []) =>
    coerceNumericStrings(await rawSql.query(text, params as never[])),
};

export interface TxClient { query(text: string, params?: unknown[]): Promise<{ rows: any[] }>; }
export async function withTx<T>(fn: (c: TxClient) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  const txClient: TxClient = {
    query: async (text, params = []) => ({ rows: coerceNumericStrings((await client.query(text, params as never[])).rows) }),
  };
  try {
    await client.query('BEGIN');
    const out = await fn(txClient);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

// lib/queries/attendance.ts — unchanged by any of the above; every query file keeps
// calling sql.query(...) / client.query(...) exactly as before and casting the result.
export async function insertCheckIn(p: CheckInRow) {
  const rows = await sql.query(
    `INSERT INTO attendance_logs (org_id, user_id, shift_id, work_date, scheduled_in, scheduled_out,
       check_in_at, check_in_branch_id, check_in_lat, check_in_lng, check_in_accuracy_m,
       check_in_distance_m, check_in_photo_url, check_in_is_outside, status, late_minutes, source)
     VALUES ($1,$2,$3,$4,$5,$6, now(), $7,$8,$9,$10,$11,$12,$13,$14,$15,'APP')
     ON CONFLICT (user_id, work_date) DO NOTHING
     RETURNING *`,
    [p.orgId, p.userId, p.shiftId, p.workDate, p.scheduledIn, p.scheduledOut, p.branchId,
     p.lat, p.lng, p.accuracy, p.distance, p.photoUrl, p.isOutside, p.status, p.lateMinutes],
  );
  return rows[0] ?? null; // null = already checked in → caller returns the existing row
}
```

Rules:
- Function names are verbs on the model: `listUsers`, `getUserById`, `insertCheckIn`, `approveRequest`.
- Every tenant query takes `orgId` as its first parameter and filters `WHERE org_id = $1`.
- Fixed multi-statement batches that discard their result (`reorderPlans`/`reorderPaymentMethods`) use `rawSql.transaction([...rawSql.query(...)])` — the **raw**, uncoerced export, because `.transaction()`'s array elements must be the driver's own lazy query-builder objects, not something already `await`ed. Writes that must read a result and then decide (registration, request approval, invoice settlement) use `withTx(async (client) => …)` from `lib/db.ts`: a `Pool` client created inside the request with `BEGIN … COMMIT`, released in `finally`, exposing a `TxClient` (`{ query(text, params) }`) rather than the full driver `PoolClient` — every `*Tx` function only ever needs `.query()`.
- Select explicit columns in list queries. `SELECT *` is allowed only for single-row returns.
- Pagination: keyset (`WHERE (work_date, id) < ($2, $3) ORDER BY work_date DESC, id DESC LIMIT $4`) for logs; offset is fine for small master tables.
- `updated_at = now()` is set in every UPDATE statement (there is no trigger).
- The server clock (`now()` in SQL) is the source of truth for check-in/out time.

## 6. API surface

All responses are JSON `{ data }` or `{ error: { code, message, fields? } }`. Status codes: 200/201, 400 validation, 401 no session, 403 wrong role or plan feature, 404 not found **in this org**, 409 conflict, 422 business rule, 429 rate limited.

| Route | Methods | Roles | Notes |
|---|---|---|---|
| `/api/auth/login` | POST | public | Rate limited per IP + email |
| `/api/auth/logout` | POST | any | Clears cookie |
| `/api/auth/register` | POST | public | Creates org (STARTER TRIAL 14 d) + OWNER in one transaction |
| `/api/me` | GET | any | Profile, org, plan features, today's log |
| `/api/organizations` | GET, PATCH | OWNER, ADMIN | Own org only |
| `/api/branches`, `/[id]` | GET, POST, PATCH, DELETE | read: all; write: OWNER, ADMIN | Enforces `plans.max_branches`. DELETE of a branch/shift that has history only sets `is_active = false` |
| `/api/shifts`, `/[id]` | GET, POST, PATCH, DELETE | same | |
| `/api/users`, `/[id]` | GET, POST, PATCH | OWNER, ADMIN (MANAGER read own team) | Enforces seats (`plans.max_employees`). POST generates a temporary password, returns it **once**, sets `must_change_password`. Users are never deleted, only `INACTIVE`. Never returns `password_hash` |
| `/api/users/[id]/reset-password` | POST | OWNER, ADMIN | New temporary password, returned once |
| `/api/auth/change-password` | POST | any | Required before anything else while `must_change_password` is true |
| `/api/users/import` | POST | OWNER, ADMIN | XLSX (P1) |
| `/api/attendance` | GET | ADMIN+ all; MANAGER team; EMPLOYEE self | Filters: date range, branch, status, user |
| `/api/attendance/check-in` | POST | any active user | §7 |
| `/api/attendance/check-out` | POST | any active user | §7 |
| `/api/attendance/today` | GET | OWNER, ADMIN (whole org), MANAGER (direct reports only) | Dashboard counts + lists, Redis 20 s per org (manager view filtered after cache) |
| `/api/attendance-requests`, `/[id]` | GET, POST, PATCH | submit: self; review: MANAGER (own reports), ADMIN, OWNER | PATCH actions: `approve`, `reject`, `cancel` |
| `/api/reports/monthly` | GET | OWNER, ADMIN | `?month=2026-10&branchId=` |
| `/api/reports/monthly/export` | GET | OWNER, ADMIN | `?format=xlsx|pdf`; PDF requires `features.export_pdf` |
| `/api/holidays`, `/[id]` | GET, POST, DELETE | write: OWNER, ADMIN (org rows only) | |
| `/api/notification-templates` | GET, PATCH | OWNER, ADMIN | Needs `features.template_override`. PATCH is an upsert keyed by `(eventTrigger, channel)` (`uq_notif_tpl_scope`), not a numeric id — no `/[id]` route |
| `/api/uploads` | POST | any | Receives the file body directly, `put()`s it to Blob server-side with `access:'private'` (§15) |
| `/api/files/[...path]` | GET | per file owner rules | Streams private blobs (selfies, attachments) after a role + tenant check |
| `/api/billing/invoices` | GET | OWNER | |
| `/api/billing/checkout` | POST | OWNER | Creates/reuses PENDING invoice → Snap token |
| `/api/payments/midtrans/notification` | POST | Midtrans | Signature-verified webhook (§9) |
| `/api/platform/{plans,payment-methods,notification-templates,holidays,organizations}` | CRUD | platform admin | Separate session kind |
| `/api/cron/close-day` | GET | Vercel Cron | `Authorization: Bearer $CRON_SECRET` |
| `/api/cron/billing` | GET | Vercel Cron | same |

## 7. Check-in / check-out flow

```
Employee /m                        Server                                   Stores
───────────                        ──────                                   ──────
1. GeoPermissionGate: navigator.geolocation
   (enableHighAccuracy, timeout 10 s)
   accuracy > 100 m → stop, show hint
2. SelfieCamera: getUserMedia(front) → canvas
   → JPEG 640px q0.7 (≈60–150 KB)
3. fetch POST (multipart body) ─────────► /api/uploads
                                        - requireSession()
                                        - image/jpeg|webp, ≤ 2 MB, content-type sniffed
                                        - server calls put() with access:'private',
                                          addRandomSuffix:true, path
                                          attendance/{org}/{date}/{user}-{in|out}.jpg ──► Blob
4. POST /api/attendance/check-in  ─────► a. requireSession, user ACTIVE
   { lat, lng, accuracy, photoUrl }     b. ratelimit 5/min per user           Redis
                                        c. zod; photoUrl host = our Blob store
                                        d. load user+shift+branches (cache)   Redis → Neon
                                        e. workDate in org tz (cross-day rule)
                                        f. user has no shift → 422 "not tracked"
                                           holiday / off day → allowed, PRESENT, no late
                                        g. nearestBranch over all active org branches
                                           outside & STRICT → 422 {distance}
                                        h. status + late_minutes
                                        i. INSERT … ON CONFLICT DO NOTHING    Neon
                                           (null → return existing row, 200)
                                        j. del cache dash:{org}:{date}        Redis
                                        k. after(): LATE → notify manager     Neon + WA/email
5. Result screen (on time / late / outside)
```

Selfie is required for both check-in and check-out when `organizations.selfie_required` is true. Check-out repeats steps 1–4 with `UPDATE … SET check_out_* … WHERE user_id=$ AND work_date=$ AND check_out_at IS NULL`, then computes `work_minutes` and `early_leave_minutes`. Zero rows updated → 409 "already checked out" or 422 "not checked in".

**Haversine (`lib/geo.ts`)**, same formula as Digispace `calculateDistance()`:

```ts
const R = 6371000;
export function distanceM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}
```

Pure rule functions in `lib/attendance-rules.ts` (`workDate`, `lateMinutes`, `workMinutes`) must be unit-tested against the seed rows in ERD §4.

## 8. Request approval

`PATCH /api/attendance-requests/[id] { action: 'approve' | 'reject', note? }` inside one `withTx` transaction:

1. `UPDATE attendance_requests SET status=…, reviewed_by=$me, reviewed_at=now() WHERE id=$1 AND org_id=$2 AND status='PENDING' RETURNING *`. Zero rows → 409 (already reviewed).
2. Reviewer check: OWNER/ADMIN any; MANAGER only when `users.manager_id = $me` for the requester; never the requester themself.
3. On approve:
   - CORRECTION → upsert `(user_id, work_date)` with requested times, recompute status/late/work, `source='REQUEST'`, `request_id`.
   - LEAVE/SICK/PERMIT → `INSERT … SELECT` over `generate_series(date_from, date_to)` filtered by the shift's `work_days` and holidays, `ON CONFLICT (user_id, work_date) DO UPDATE SET status=EXCLUDED.status, request_id=EXCLUDED.request_id, source='REQUEST'`.
4. Invalidate dashboard cache, then `after()` → REQUEST_REVIEWED notification.

Bulk approve loops the same function per id and returns per-id results.

Notification recipients: the requester's `manager_id`. If it is NULL, every ACTIVE OWNER and ADMIN of the org. The same fallback applies to LATE_CHECK_IN.

## 9. Billing (Midtrans Snap)

1. The billing page lists active `payment_methods` (our own picker, like the reference schema) with each method's fee. The fee must be known **before** the Snap token is created, because `gross_amount` is fixed at that point.
2. `POST /api/billing/checkout { paymentMethodId }`: reuse the org's PENDING invoice for the next period or create one (`invoice_code = INV-YYYYMM-NNNN`, `amount = plan.price_monthly`). Compute `admin_fee = admin_fee_flat + ceil(amount × admin_fee_pct / 100)` and `total_amount`. Start a new attempt: `midtrans_order_id = {invoice_code}-{n}` (Midtrans order ids must be unique per transaction, so changing the method never reuses one). Call Snap `POST /snap/v1/transactions` with that `order_id`, `gross_amount = total_amount`, `enabled_payments = [method.code]`. Store `snap_token`, `snap_redirect_url`. Log REQUEST in `payment_logs`.
3. Client opens Snap (`snap.js` popup) or the redirect URL.
4. Webhook `POST /api/payments/midtrans/notification` (invoice looked up by `midtrans_order_id`):
   - Verify `signature_key == sha512(order_id + status_code + gross_amount + SERVER_KEY)`. Mismatch → 401 and log.
   - Idempotency: `SET idem:midtrans:{order_id}:{transaction_status} NX EX 86400`. Already set → 200 no-op.
   - Optionally re-confirm with the Midtrans status API before mutating.
   - `settlement`, or `capture` with `fraud_status=accept` → invoice PAID, `paid_at`, `midtrans_transaction_id` (method and fee were already fixed at checkout). Org → ACTIVE, `plan_expires_at = period_end 23:59:59` in org tz. Send INVOICE_PAID.
   - `expire`/`cancel`/`deny` → EXPIRED/FAILED. `pending` → no change.
   - Always log WEBHOOK in `payment_logs` and return 200 quickly.
5. Cron `/api/cron/billing` (daily ~01:00 WIB):
   - Renewal invoice 7 days before `plan_expires_at` (+ INVOICE_CREATED). Expire stale PENDING invoices.
   - ACTIVE → PAST_DUE at `plan_expires_at`.
   - TRIAL past `trial_ends_at`, or PAST_DUE for 3 days → **downgrade**: if ACTIVE seats ≤ FREE `max_employees` and branches ≤ FREE `max_branches` → `plan_id = FREE`, `status = ACTIVE`, `plan_expires_at = NULL`. Otherwise → `SUSPENDED`.
   - SUSPENDED orgs can log in, deactivate users and pay; check-in returns 403. Data is never deleted.

Sandbox and production keys come from env. Never send the server key to the client.

## 10. Caching (Upstash Redis)

| Key | Content | TTL | Invalidated by |
|---|---|---|---|
| `org:{id}:ctx` | org row + plan features | 600 s | org / plan / billing update |
| `org:{id}:master` | active branches + shifts | 600 s | any branch/shift write |
| `user:{id}:ctx` | user status, role, shift_id, branch_id, manager_id | 60 s | user update |
| `dash:{org}:{date}` | today's dashboard payload | 20 s | check-in/out, approval |
| `plans:public` | pricing page data | 3600 s | platform plan write |
| `paymethods:active` | active methods | 3600 s | platform write |
| `tpl:{org}:{event}:{channel}` | resolved template (org override → global) | 3600 s | template write |
| `rl:login:{ip}` | ratelimit | 10 per 10 min | — |
| `rl:checkin:{user}` | ratelimit | 5 per min | — |
| `rl:register:{ip}` | ratelimit | 5 per 10 min | — |
| `idem:midtrans:{order}:{status}` | webhook dedupe | 24 h | — |

Cache helpers live in `lib/redis.ts` (`cached(key, ttl, loader)`, `bust(...keys)`). SSR pages use Next tag revalidation for marketing/pricing. In Next 16 the call is `revalidateTag(tag, 'max')` (the second `cacheLife` argument is required). Never cache per-user responses in shared Next caches.

## 11. Auth and tenant isolation

- Login identifier is email **or** phone (normalized to E.164, `08…` → `+628…`), because many field staff have no email. While `must_change_password` is true, every route except change-password and logout returns 403 `PASSWORD_CHANGE_REQUIRED`.
- Login: `bcryptjs.compare`. JWT (HS256, `jose`) in cookie `hadirin_session`: `httpOnly`, `Secure`, `SameSite=Lax`, 7-day expiry. Payload `{ sub, org, role, kind: 'user' | 'platform' }`.
- `proxy.ts` only gates route groups (`/m`, `/app` → user session; `/platform` → platform session) and redirects to `/login`. It is not the authorization layer.
- `requireSession(roles?)` in every route handler re-verifies the JWT, reloads `user:{id}:ctx` (cached 60 s) and rejects INACTIVE users or SUSPENDED orgs where relevant.
- **Tenant id always comes from the session.** Request bodies never carry `org_id`, and `user_id` is accepted only where an admin acts on another user. Then it is re-checked: `WHERE id = $2 AND org_id = $1`.
- Cross-tenant ids return 404, not 403, so they don't leak existence.
- `password_hash` never leaves `lib/queries/users.ts` except in the login function.

Both rules exist because of two defects found in `digispace-ydsf-v2`: permissions enforced only in the frontend, and a shared request base class that trusted a client-supplied employee id.

## 12. Cron (vercel.json)

```json
{
  "regions": ["sin1"],
  "crons": [
    { "path": "/api/cron/close-day", "schedule": "30 17 * * *" },
    { "path": "/api/cron/billing",   "schedule": "0 18 * * *" }
  ]
}
```

Times are UTC (00:30 and 01:00 WIB). On Hobby, crons run at most once a day and only within the scheduled hour (a 17:30 UTC job can fire up to 18:29). Both jobs tolerate that. Each job is idempotent (`ON CONFLICT DO NOTHING`) and processes orgs in batches of 50 to stay under the function time limit.

**close-day** for yesterday in each org's timezone: insert ABSENT/HOLIDAY rows for tracked users only, then queue MISSING_CHECK_OUT for open logs (check-in without check-out). Open logs keep `work_minutes` NULL until corrected. Implemented as one target date ("yesterday") applied uniformly to every shift in the org, including cross-day ones — there are no cross-day shifts in the seed data yet, and `insertAbsencesForOrgAndDate` operates on one date per call, so a cross-day shift's extra day-of-buffer would need per-shift-type date selection within the same org. Revisit if cross-day shifts see real use.

## 13. Exports

- XLSX (`xlsx`): sheet 1 "Rekap" (one row per employee: code, name, branch, present, late, late minutes, late A/B/C, absent, leave, sick, permit, worked hours), sheet 2 "Detail" (one row per log).
- PDF (`jspdf` + `jspdf-autotable`): landscape A4, org logo, period, the same recap table.
- Generated in a route handler from `lib/queries/reports.ts` (one aggregate query on `idx_att_org_date_cover`).
- Files ≤ 4 MB are streamed directly with `Content-Disposition`. Larger files are `put()` to Blob (private path, short-lived) and the URL is returned, because Vercel function responses are capped at 4.5 MB.

## 14. Frontend, design system and performance

**Design tokens** (Tailwind `@theme`):

| Token | Value | Use |
|---|---|---|
| `--color-primary` | `#0E7C66` | Buttons, active nav, check-in CTA |
| `--color-primary-fg` | `#FFFFFF` | |
| `--color-bg` / `--color-surface` | `#F7F8FA` / `#FFFFFF` | |
| `--color-text` / `--color-muted` | `#0F172A` / `#64748B` | |
| Status PRESENT / LATE / ABSENT | `#16A34A` / `#D97706` / `#DC2626` | `StatusBadge` only |
| Status LEAVE / SICK / PERMIT / HOLIDAY | `#2563EB` / `#7C3AED` / `#0891B2` / `#64748B` | |
| Font | Plus Jakarta Sans via `next/font/google` | All text |
| Radius | 12 px cards, 10 px inputs, full for the check-in button | |

**Layout:** admin uses a collapsible sidebar (icon-only on desktop, drawer on mobile). The employee `/m` is single-column with a bottom tab bar (Hari ini, Riwayat, Pengajuan, Profil) and one large primary action.

**Performance:**
- Marketing pages: static + ISR, `next/image`, no client JS above the fold except the nav toggle. Target Lighthouse ≥ 90 on mobile.
- `metadata` per route, `sitemap.ts`, `robots.ts`, JSON-LD `SoftwareApplication` on `/` and `/pricing`. `/m`, `/app`, `/platform` are `noindex`.
- Admin pages stream with `<Suspense>` + skeletons. Tables are server-paginated (25/page) and virtualized above 200 rows.
- Dashboard polls `/api/attendance/today` every 30 s with React Query (`refetchIntervalInBackground: false`).
- Selfie compression happens on the client before upload. Upload and the check-in call happen in sequence with clear progress.
- Charts and the Tiptap editor load with `next/dynamic`, so they stay out of first-load JS.

## 15. Security checklist

- Parameterized SQL only. Dynamic `ORDER BY` only from a whitelist map.
- zod on every input, with string length caps matching the column sizes.
- Blob upload: content-type whitelist, size cap, path built server-side, `addRandomSuffix: true`. `photoUrl` must match our Blob host + expected prefix.
- **Personal data (UU PDP, Law 27/2022).** Selfies and attachments (sick notes are health data) go to a **private** Blob store and are served only through `/api/files/[...path]` after a role + tenant check. Confirmed during scaffold (2026-10-07): `@vercel/blob`'s client-token upload flow (`handleUpload`) cannot mint a private-access token as of `@vercel/blob@2.8.1` (open upstream bug, `vercel/storage#1079` — `onBeforeGenerateToken` has no `access` field, so client uploads are forced to `public`). So uploads go through `/api/uploads`, a route handler that receives the file body directly and calls `put(path, body, { access: 'private', addRandomSuffix: true })` server-side — never the client-token flow. Reads go through `/api/files/[...path]`, which does an authenticated server-side `fetch` to the `*.private.blob.vercel-storage.com` URL with `Authorization: Bearer ${BLOB_READ_WRITE_TOKEN}` and streams the bytes back after the role + tenant check — no signed/presigned URLs needed since our server always mediates. Show a consent notice on first check-in. P2: retention job that deletes selfies after 12 months. Re-check this upstream limitation before any later Blob upgrade; if `access` becomes supported in `onBeforeGenerateToken`, the client-token flow becomes an option again but is not required.
- `xlsx` comes from the SheetJS CDN build (see §3), never the npm registry copy.
- Rate limits on login, register, check-in and upload.
- Webhook signature + idempotency. Cron secret.
- Secrets only in Vercel env. `NEXT_PUBLIC_*` holds only the Midtrans client key and the app URL.
- Security headers in `next.config.ts`: CSP (allow Midtrans Snap and Blob hosts), `Permissions-Policy: camera=(self), geolocation=(self)`.

## 16. Environment variables

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Neon **pooled** connection string (runtime) |
| `DATABASE_URL_UNPOOLED` | Direct connection for `drizzle-kit migrate` |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Redis |
| `JWT_SECRET` | Session signing (≥ 32 random bytes) |
| `MIDTRANS_SERVER_KEY`, `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION` | Payments |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Email |
| `WA_GATEWAY_URL`, `WA_GATEWAY_TOKEN` | WhatsApp (P1, optional) |
| `CRON_SECRET` | Cron auth |
| `NEXT_PUBLIC_APP_URL` | Absolute links in notifications |
| `DEMO_PASSWORD` | Seed only |

## 17. Scripts and workflow

```bash
npm run dev            # next dev
npm run build          # next build
npm run lint
npm run test           # vitest: lib/attendance-rules, lib/geo, lib/midtrans signature
npm run db:generate    # drizzle-kit generate (from db/schema.ts)
npm run db:migrate     # tsx scripts/db-migrate.ts (uses DATABASE_URL_UNPOOLED)
npm run db:seed        # tsx scripts/db-seed.ts (runs db/seed.sql, idempotent)
npm run db:reset-demo  # truncate transactional tables + reseed (demo only, refuses in production)
```

Deploy: push → Vercel preview per branch, `main` → production. Neon branch per preview is optional (Vercel–Neon integration).

## 18. Testing

| Layer | What | Tool |
|---|---|---|
| Unit | `distanceM`, `workDate` (incl. cross-day), `lateMinutes` (tolerance edge), `workMinutes`, Midtrans signature | Vitest |
| Query | Each `lib/queries/*` function against a fresh DB with the seed (PGlite or a Neon branch) | Vitest |
| API | Role matrix + tenant isolation: org 2 owner calling every org 1 id → 404 | Vitest + route handler calls |
| E2E (smoke) | Login → check-in with mocked geolocation/camera → dashboard count → approve → export | Playwright (P1) |

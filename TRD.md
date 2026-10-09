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
│  ├─ manifest.ts             PWA manifest (icons: /icon.svg + /icons/[name] PNGs)
│  ├─ icon.svg, apple-icon.tsx, opengraph-image.tsx, favicon.ico/route.ts, icons/[name]/route.tsx
│  │                          brand icons, all drawn from lib/brand/mascot.ts
│  ├─ robots.ts, sitemap.ts   SEO
│  └─ layout.tsx
├─ components/
│  ├─ ui/                     Button, ButtonLink, IconButton, Input, Select, Textarea, Checkbox, Radio, Dialog,
│  │                          Badge, Card, Table, Pagination, Skeleton, Toast
│  └─ shared/                 StatusBadge, AttendanceTable, RequestCard, SelfieCamera, GeoPermissionGate,
│                             StatTile, DateRangeFilter, BranchFilter, ExportButton, EmptyState, Sidebar, Logo, Mascot
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
│  ├─ brand/                  mascot.ts (the one drawing), assets.ts, ico.ts
│  ├─ validators/             zod schemas per model
│  └─ constants/              roles.ts, statuses.ts, events.ts (static value sets from ERD §1.1)
├─ db/
│  ├─ schema.ts               Drizzle schema (migration source only)
│  └─ seed.sql                Seed from ERD §4
├─ drizzle/                   generated + custom migrations
├─ scripts/                   db-migrate.ts, db-seed.ts, db-reset-demo.ts, gen-brand-assets.ts
├─ proxy.ts
├─ vercel.json
├─ PRD.md · ERD.md · TRD.md · AGENTS.md · CLAUDE.md
```

## 5. Data access pattern

**Bigint-as-string (critical, read before touching `lib/db.ts`).** `@neondatabase/serverless` returns every `bigint`/`int8` column as a JS **string**, unconditionally — confirmed against a real Neon database (`SELECT 42::bigint` comes back as `"42"`, not `42`; `int4`/`integer` is unaffected). Every BIGSERIAL id and FK in this schema is a bigint (ERD.md: "no UUID"), and every query file's TypeScript interface declares these fields as `number` — so without a fix, the declared and actual runtime types diverge on literally every row, everywhere. This is not a theoretical gap: it is exactly what broke login/registration end-to-end during real-environment smoke testing — `setSessionCookie({ org: organization.id, ... })` signed `org` as the string `"6"`, the JWT round-tripped it as a JSON string, and `lib/session.ts`'s `typeof payload.org === 'number'` check rejected every token, so nobody could log in despite every other part of the flow succeeding (201 Created, row genuinely inserted). `lib/db.ts` fixes this at the one place every query shares — see below — so no query file needs to know about it. The fix parses **by Postgres column type** (`lib/db-types.ts`): only `int8` (and `int8[]`) becomes a number; `varchar`/`text`/`numeric` keep their exact text, and `DATE` stays the plain `"YYYY-MM-DD"` text instead of a JS `Date` at the server's local midnight. The first version walked every result and turned any all-digit *string* into a number regardless of column — which silently turned the phone `"081234567890"` into `81234567890`, the employee code `"007"` into `7`, and a Saturday-only shift's `work_days` `"6"` into the number `6` (crashing every page that splits it). Never reintroduce value-based coercion.

```ts
// lib/db.ts
import ws from 'ws';
import { neon, neonConfig, Pool } from '@neondatabase/serverless';
neonConfig.webSocketConstructor = ws; // Node has no stable global WebSocket until v22

import { dbTypes } from './db-types'; // oid 20 (int8) -> safe-integer number, oid 1082 (DATE) -> 'YYYY-MM-DD' text,
                                        // every other type -> the driver's default parser

export const rawSql = neon(process.env.DATABASE_URL!); // only for sql.transaction() batches — see below
export const sql = {
  query: async (text: string, params: unknown[] = []) =>
    rawSql.query(text, params as never[], { types: dbTypes }),
};

export interface TxClient { query(text: string, params?: unknown[]): Promise<{ rows: any[] }>; }
export async function withTx<T>(fn: (c: TxClient) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, types: dbTypes });
  const client = await pool.connect();
  const txClient: TxClient = {
    query: async (text, params = []) => ({ rows: (await client.query(text, params as never[])).rows }),
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
- Fixed multi-statement batches that discard their result (`reorderPlans`/`reorderPaymentMethods`) use `rawSql.transaction([...rawSql.query(...)])` — the **raw** export, without the type parsers,, because `.transaction()`'s array elements must be the driver's own lazy query-builder objects, not something already `await`ed. Writes that must read a result and then decide (registration, request approval, invoice settlement) use `withTx(async (client) => …)` from `lib/db.ts`: a `Pool` client created inside the request with `BEGIN … COMMIT`, released in `finally`, exposing a `TxClient` (`{ query(text, params) }`) rather than the full driver `PoolClient` — every `*Tx` function only ever needs `.query()`.
- Select explicit columns in list queries. `SELECT *` is allowed only for single-row returns.
- Pagination: keyset (`WHERE (work_date, id) < ($2, $3) ORDER BY work_date DESC, id DESC LIMIT $4`) for logs; offset is fine for small master tables.
- `updated_at = now()` is set in every UPDATE statement (there is no trigger).
- The server clock (`now()` in SQL) is the source of truth for check-in/out time.

## 6. API surface

All responses are JSON `{ data }` or `{ error: { code, message, fields? } }`. Status codes: 200/201, 400 validation, 401 no session, 403 wrong role or plan feature, 404 not found **in this org**, 409 conflict, 422 business rule, 429 rate limited.

The UI shows `error.message` in toasts and `error.fields[name]` under form fields, so those strings are user-facing copy. A 400's `fields` text is Indonesian: `lib/validators/locale-id.ts` replaces Zod's default messages ("Wajib diisi.", "Minimal 8 karakter.") and is loaded by `lib/api-response.ts`; a message written on a schema wins over it. A Postgres unique violation (SQLSTATE 23505) is answered as `409 DUPLICATE` with the field to fix (`uq_users_email` → `email`, `uq_users_org_code` → `employeeCode`, `uq_branches_org_name` / `uq_shifts_org_name` → `name`, `uq_holidays_scope_date` → `holidayDate`), never a 500. The attendance, upload, user-guard and duplicate messages are Indonesian; other 404/409/422 messages thrown from route handlers and queries are still English; translating them is a follow-up.

| Route | Methods | Roles | Notes |
|---|---|---|---|
| `/api/auth/login` | POST | public | Rate limited per IP + email |
| `/api/auth/logout` | POST | any | Clears cookie |
| `/api/auth/register` | POST | public | Creates org (STARTER TRIAL 14 d) + OWNER in one transaction |
| `/api/me` | GET | any | Profile, org, plan features, today's log |
| `/api/organizations` | GET, PATCH | OWNER, ADMIN | Own org only |
| `/api/branches`, `/[id]` | GET, POST, PATCH, DELETE | read: all; write: OWNER, ADMIN | Enforces `plans.max_branches`. DELETE of a branch/shift that has history only sets `is_active = false` |
| `/api/shifts`, `/[id]` | GET, POST, PATCH, DELETE | same | |
| `/api/users`, `/[id]` | GET, POST, PATCH | OWNER, ADMIN (MANAGER read own team) | Enforces seats (`plans.max_employees`). POST generates a temporary password, returns it **once**, sets `must_change_password`. Users are never deleted, only `INACTIVE`. Never returns `password_hash`. The branch, shift and manager named in a body must belong to the session org (else 404). Who may change whom is `lib/user-guards.ts`: only an OWNER creates/promotes an OWNER or ADMIN or changes an OWNER's role/status (403 `FORBIDDEN`), and the last active OWNER can be neither demoted nor deactivated (422 `LAST_OWNER`). Self-edit of `shiftId`/`branchId` stays allowed: the check-in setup wizard uses it. A write that changes who is scheduled busts `dash:{org}:{today}` |
| `/api/users/[id]/reset-password` | POST | OWNER, ADMIN | New temporary password, returned once. An ADMIN cannot reset an OWNER's password (that would be taking over the owner's account) |
| `/api/auth/change-password` | POST | any | Required before anything else while `must_change_password` is true |
| `/api/users/import` | POST | OWNER, ADMIN | XLSX (P1) |
| `/api/attendance` | GET | ADMIN+ all; MANAGER team; EMPLOYEE self | Filters: date range, branch, status, user |
| `/api/attendance/check-in` | POST | any active user | §7 |
| `/api/attendance/check-out` | POST | any active user | §7 |
| `/api/attendance/precheck` | POST | any active user | Advisory, before the selfie: the nearest branch, the distance, inside/outside, whether the punch would be accepted and why not (`block`). The punch routes recompute everything; the client's answer is never trusted. 30 per min per user (`rl:precheck`) |
| `/api/attendance/today` | GET | OWNER, ADMIN (whole org), MANAGER (direct reports only) | Dashboard counts + lists, Redis 20 s per org (manager view filtered after cache) |
| `/api/attendance-requests`, `/[id]` | GET, POST, PATCH | submit: self; review: MANAGER (own reports), ADMIN, OWNER | PATCH actions: `approve`, `reject`, `cancel` |
| `/api/reports/monthly` | GET | OWNER, ADMIN | `?month=2026-10&branchId=` |
| `/api/reports/monthly/export` | GET | OWNER, ADMIN | `?format=xlsx|pdf`; PDF requires `features.export_pdf` |
| `/api/holidays`, `/[id]` | GET, POST, DELETE | write: OWNER, ADMIN (org rows only) | |
| `/api/notification-templates` | GET, PATCH | OWNER, ADMIN | Needs `features.template_override`. PATCH is an upsert keyed by `(eventTrigger, channel)` (`uq_notif_tpl_scope`), not a numeric id — no `/[id]` route |
| `/api/uploads` | POST | any active user | Receives the file body directly, `put()`s it to Blob server-side with `access:'private'` (§15). The type is sniffed from the first bytes (JPEG/PNG/WEBP, `lib/image-sniff.ts`), never taken from the client's `Content-Type`; 2 MB cap; 20 per min per user (`rl:upload`); 403 `ORG_SUSPENDED` for a suspended org |
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
| `dash:{org}:{date}` | today's dashboard payload (one unfiltered key; a MANAGER's view is cut from it after the hit) | 20 s | check-in/out, approval, a user's shift/branch/status change, a branch or shift write (`lib/dashboard-cache.ts`) |
| `plans:public` | pricing page data | 3600 s | platform plan write |
| `paymethods:active` | active methods | 3600 s | platform write |
| `tpl:{org}:{event}:{channel}` | resolved template (org override → global) | 3600 s | template write |
| `rl:login:{ip}` | ratelimit | 10 per 10 min | — |
| `rl:checkin:{user}` | ratelimit, consumed only after every gate has passed | 5 per min | — |
| `rl:precheck:{user}` | ratelimit | 30 per min | — |
| `rl:upload:{user}` | ratelimit | 20 per min | — |
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

**Design tokens** (Tailwind `@theme` in `app/globals.css`; the palette is a neutral oklch scale, chroma 0, on the Radix Colors step roles: 2 card, 3 to 5 control fills, 6 to 8 borders, 11 low-contrast text). Components use these tokens only, so a theme change is a change in one file. Light mode is a **gray** theme, not a white one (the product owner's call after trying the white version): no surface in light is near-white, and every pair below is measured, not eyeballed (see "Contrast"):

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-primary` / `-fg` | `oklch(0.205 0 0)` / `oklch(0.985 0 0)` | `oklch(0.922 0 0)` / `oklch(0.205 0 0)` | Filled buttons, selected chips, check-in CTA |
| `--color-secondary` / `-fg` | `oklch(0.89 0 0)` / `oklch(0.205 0 0)` | `oklch(0.269 0 0)` / `oklch(0.985 0 0)` | Secondary buttons, the active nav pill |
| `--color-accent` | `oklch(0.9 0 0)` | `oklch(0.269 0 0)` | Hover fill, neutral badges, table header fill (opaque) |
| `--color-bg` / `--color-surface` | `oklch(0.9 0 0)` / `oklch(0.95 0 0)` | `oklch(0.145 0 0)` / `oklch(0.205 0 0)` | Flat fallbacks and the base for contrast maths. Backgrounds paint the **gradients** below instead |
| `--color-text` / `--color-muted` | `oklch(0.145 0 0)` / `oklch(0.45 0 0)` | `oklch(0.985 0 0)` / `oklch(0.708 0 0)` | Text. Light muted is 0.45, not shadcn's 0.556: muted text sits straight on the page gradient (bottom `oklch(0.85)`), where 0.556 would be about 3.0:1 and 0.5 (the white-theme value) was 3.98:1 on the previous, lighter canvas; 0.45 is 4.7:1 there, 5.5:1 on the table header and 4.55:1 on a hovered secondary button |
| `--color-border` / `--color-input` | `oklch(0.8 0 0)` ×2 | `oklch(1 0 0 / 10%)` / `oklch(1 0 0 / 15%)` | Card and divider borders; outline-button borders (their label identifies them) |
| `--color-field` | `oklch(0.53 0 0)` | `oklch(1 0 0 / 40%)` | Boundary of a control with no fill of its own: text input, select, textarea, checkbox, radio. WCAG 1.4.11 asks 3:1 against the surface (W3C's passing example is `#767676` on white); `--color-input` is about 1.3:1. 0.53 is 4.3:1 at the bottom of the card gradient and 3.3:1 at the bottom of the page gradient; 40% white is 6:1 and up on the dark surface |
| `--color-ring` | `oklch(0.5 0 0)` | `oklch(0.62 0 0)` | Focus indicator colour, at least 3.8:1 against every light gradient stop and 3.9:1 in dark (the shadcn 0.708 was 2.6:1 before the 50% alpha the ring utility adds) |
| `--color-destructive` | `oklch(0.46 0.2 27)` | `oklch(0.704 0.191 22.216)` | Error text, `Button variant="danger"` text and border. Error text is 12 to 14px and often sits straight on the page canvas: 4.8:1 at the bottom of the page gradient, 6.2:1 on a card (shadcn's 0.577 is about 3.1:1 there) |
| `--color-success` / `-warning` / `-info` | `#15803d` / `#b45309` / `#2563eb` | `#22c55e` / `#f59e0b` / `#3b82f6` | **Small icons and dots only** (`Badge` dot, toast icon), 3:1 on every gradient stop. Never a background |
| `--color-success-text` / `--color-warning-text` | `oklch(0.42 0.11 163)` / `oklch(0.44 0.125 48)` | `oklch(0.765 0.177 163.223)` / `oklch(0.828 0.189 84.429)` | The same two hues as **text** (a late time, "outside the area", a positive delta): 4.9:1 and 5.2:1 on the worst light stop, 7:1 and up in dark. Use `text-success-text` / `text-warning-text`, not `text-amber-700`. Tailwind's `amber-700`, `amber-600` and `emerald-600` are re-pointed to the same values in `@theme` (they measured 3.2:1, 2.0:1 and 2.3:1 on gray), so call sites written before the tokens are already readable |
| Status PRESENT / LATE / ABSENT | `#15803d` / `#b45309` / `#b91c1c` | `#22c55e` / `#f59e0b` / `#ef4444` | The dot of `StatusBadge` (3:1 on the worst light stop) |
| Status LEAVE / SICK / PERMIT / HOLIDAY / OFF | `#2563eb` / `#7c3aed` / `#0e7490` / `#475569` / `#5b6b82` | `#3b82f6` / `#a78bfa` / `#22d3ee` / `#94a3b8` / `#cbd5e1` | |
| Font | Plus Jakarta Sans via `next/font/google` | | All text |
| Radius | 12 px cards, 10 px inputs/buttons | | |

The dark primary/secondary pairs are the exact values chosen by the product owner; the light values are their gray-theme counterparts (a dark primary on a light-gray secondary). Never write `border-black/10 dark:border-white/10`-style pairs: use `border-border`, `bg-accent`, `text-muted` and the rest of the tokens, which already switch with `.dark`.

**Neutral gradients, colour only as an accent.** The product owner's rule: every background is a neutral gray (a soft light-gray gradient in light, never white; black to dark gray in dark); no green, blue, amber or red panel anywhere. Light stops: page `oklch(0.945) → oklch(0.85)`, surface `oklch(0.972) → oklch(0.928)`, secondary `oklch(0.915) → oklch(0.865)`, primary `oklch(0.38) → oklch(0.16)`; dark stops: page `oklch(0.225) → 0.15 → 0.085`, surface `0.285 → 0.225`, secondary `0.36 → 0.28`, primary `0.99 → 0.84`. Semantic colour is allowed only on small text, an icon or a dot (a status dot, destructive text, a toast icon). `--gradient-page` paints `<body>` (fixed, no-repeat); `--gradient-surface`, `--gradient-primary` and `--gradient-secondary` back the `.bg-surface`, `.bg-primary` and `.bg-secondary` utilities in `app/globals.css`, so cards, the sidebar, dialogs, table frames, filled buttons and the active nav pill pick them up with no per-component class. Translucent variants (`bg-surface/90`) and checked controls stay flat. Do not wrap content in a flat `bg-bg`: it hides the page gradient. Three rules keep it legible: (0) in light, a card (`0.972 → 0.928`) lifts off the page behind it by 1.08:1 at the top and 1.28:1 at the bottom, and its `--color-border` (`0.8`) is a further 1.5:1 line, so no panel needs a shadow to be seen; (1) in dark, the page top (`oklch(0.225)`) is below the surface top (`oklch(0.285)`), which is below the secondary top (`oklch(0.36)`), so a card is always lighter than the canvas behind it (at 0.27 against 0.265 a card was invisible); (2) a gradient is a `background-image` and paints over any `hover:bg-*` colour, so filled buttons hover through `--gradient-primary-hover` / `--gradient-secondary-hover`, and one global rule drops the image from a `.bg-surface` that carries a `hover:bg-*` class while hovered. A sticky table header needs an opaque fill (`bg-accent`), never a gradient (a gradient on a small sticky box is painted at its own size and shows as a band).

**Focus.** Every link, button, field, summary and `tabindex` element gets a 2px `--color-ring` outline (2px offset; 0 on form fields) on top of the 3px halo the components draw. The rule is unlayered and has zero specificity in `app/globals.css`, so a component's `focus-visible:outline-none` cannot remove it. A scroll container clips its children's rings: `Page.Body` bleeds 4px sideways and the layout's scroll wrapper carries `lg:p-1` to give the ring that room.

**Contrast (measured).** WCAG 2.x relative luminance on the oklch values read straight out of `app/globals.css`, at both ends of each gradient (the gradients are monotonic grays, so the ends bound everything between). Pairs: text, muted text and error text against the page gradient, the card gradient and the accent fill; non-text pairs against all of those. Worst case per pair, light / dark:

| Pair | Needs | Light (worst stop) | Dark (worst stop) |
|---|---|---|---|
| `text` | 7:1 | 12.5:1 (page bottom) | 13.8:1 (card top) |
| `muted` | 4.5:1 | 4.7:1 (page bottom) | 5.5:1 (card top) |
| `destructive` text | 4.5:1 | 4.8:1 (page bottom) | 5.0:1 (card top) |
| `success-text` / `warning-text` | 4.5:1 | 4.9:1 / 5.2:1 (page bottom) | 7.4:1 / 8.4:1 (card top) |
| `primary-fg` on the primary gradient and its hover | 4.5:1 | 6.8:1 (hover top) | 9.0:1 (hover bottom) |
| `secondary-fg` on the secondary gradient and its hover | 4.5:1 | 11.0:1 | 8.5:1 |
| `field` border | 3:1 | 3.3:1 (page bottom) | 6.3:1 |
| `ring` (focus) | 3:1 | 3.8:1 (page bottom) | 3.9:1 |
| status dots, `success`/`warning`/`info` icons | 3:1 | 3.2:1 (page bottom) | 3.8:1 |

Re-measure after any change to a token or a gradient stop; the usual casualty is muted text at the bottom of the page gradient (a darker canvas needs a darker `muted`).

**Motion.** One system, in the "Motion" section of `app/globals.css` plus `components/shared/motion/`. Rules: (1) a UI transition is 120 to 240ms (`--motion-fast` 120, `--motion-base` 180, `--motion-slow` 240; a stagger step is 40ms and the index caps at 6, so a whole grid is settled inside 480ms), eased with `--motion-ease` (ease-out-quint) or, for small elements only, `--motion-spring` (a hair of overshoot); (2) only `transform` and `opacity` move (`clip-path` for the chart wipe and the theme reveal): no layout properties, so there is no layout shift; (3) nothing delays content: the server HTML is visible at once, route enter plays only after a client navigation, never on the first paint of a hard load; (4) nothing blocks input: no overlay, no pointer capture, no exit animation that holds the old page; (5) every animation uses `backwards` fill, so after it ends the element is back to its own styles (a `hover:` transform on the same element still works); (6) **reduced motion** is one block at the end of the section (`@media (prefers-reduced-motion: reduce)`): every animation and transition collapses to a single frame (0.01ms, not 0, so `animationend` still fires) with no delay, so a staggered list is never left invisible and state changes are still instantly visible; the `animate-spin` loader is exempt (essential feedback: a frozen spinner reads as a hang, WCAG 2.3.3). JS animations check `matchMedia` themselves (`PageTransition` does not play, `CountUp` renders its final value, `ThemeToggle` flips the class).

- **Route enter.** `PageTransition` wraps the page in a `template.tsx` (`app/(marketing)`, `app/(auth)`, `app/app`, `app/m`, `app/platform/(authenticated)`), which Next remounts per navigation. It plays a 180ms fade + 8px rise with the Web Animations API, only after a client navigation (a module flag skips the first hydration, so LCP is untouched), and it also keys on the pathname so a move deeper inside one section replays it; search-parameter changes (filters, pages) never do. While it runs, `:has(> [data-route-entering])` makes the shell's scroll region `overflow: clip` on desktop, so the 8px rise cannot flash a scrollbar. Each template passes the shell's sizing through (`lg:h-full` or `flex min-h-0 flex-1 flex-col`) because the wrapper sits between the layout and the page. There is no exit animation (the App Router unmounts the old page in the same commit) and no View Transition for routes: a view transition freezes the page behind a snapshot for its whole duration, which is exactly the blocking this system avoids. View Transitions are used once, for the theme switch (`ThemeToggle`: the new theme grows out of the button as a circle in 360ms; without the API it just flips).
- **Navigation feedback.** `NavigationProgress` is mounted once in `app/layout.tsx`. It starts on an internal link click (document listener), on a back/forward, and on **any** Next navigation request: it wraps `fetch` and treats a request with `RSC: 1` and without the prefetch and server-action headers, to a URL other than the current one, as a navigation. That is what covers `router.push`/`replace` with no click (login → dashboard, logout → home, a filter that changes the URL); `router.refresh()` and `AutoRefresh` (same URL) are ignored. It ends when the pathname/search changed **and** no `[aria-busy="true"]` skeleton is on the page (every `loading.tsx` and `TableSkeleton` marks its frame). Timeline: nothing for the first 120ms (a cached or prefetched page never flashes anything), then a 3px top bar that trickles toward 90% and completes in 160ms; at 500ms the non-blocking **"Memuat…"** `LoadingPill` (spinner, `animate-pop-in`) joins it and a polite live region says "Memuat halaman…"; once shown the pill stays at least 350ms, and it is skipped if the page landed while its timer ran; a hard stop at 15s. Both live in a manual popover (top layer), so they show above an open dialog, and are `pointer-events: none`. NN/g's limits drive the numbers: 0.1s is instant, 1s keeps the flow of thought, 10s keeps attention.
- **Loading state.** `Skeleton` = the `.skeleton` utility: a placeholder block with a soft highlight sweeping left to right (`::after`, transform only, 1.3s), still under reduced motion, `aria-hidden`; the page that shows it says "Memuat…" itself (`TableSkeleton` has a `role="status"` line).
- **Micro-interactions.** `Button` presses to 97% and lifts its shadow on hover; `IconButton`, `Checkbox` and `Radio` press to 90%; `Card interactive` (a tile that is a link or button) uses `.hover-lift` (2px up, stronger border, hover-capable pointers only); the checkbox tick draws itself (`.check-mark`, pathLength dash) and the radio ring grows with the spring; fields ease their border and focus halo, and the 2px focus outline closes in from 5px (`focus-ring-in`, 140ms); a field error rises in (`animate-rise-sm`); `Toast` enters in 180ms and leaves in 140ms before it is removed; `Dialog` and the mobile drawer enter **and exit** with CSS only (`@starting-style` plus `transition-behavior: allow-discrete` on `display` and `overlay`; the drawer slides, the dialog fades and rises); `ThemeToggle` turns the sun and moon; the `Logo` mascot blinks every 6s and tilts when its link is hovered (`Mascot animated`, `.mascot-eye` / `.mascot-svg`, CSS only; the generated icon files stay still).
- **Building blocks for pages** (also usable from a Server Component, no JS): `animate-rise`, `animate-rise-sm`, `animate-fade-in`, `animate-pop-in` (Tailwind `animate-*`, so `motion-reduce:` and `hover:` variants work); `<Reveal index={i}>` or `.reveal` with `style="--i: 2"`, and `.stagger` on a parent (children stagger by `:nth-child`); `<CountUp value options prefix suffix>` (rAF, ease-out cubic, ~600ms, `Intl` formatting; the final value is always what the HTML says, a fresh client mount counts up from 0, a changed `value` counts from the old number to the new one); chart utilities `.draw-in` (a `<path pathLength="1">` draws left to right), `.arc-in` (a donut `<circle>` with `style="--circ: <circumference>"` sweeps in), `.grow-x` / `.grow-y` (bars grow, `--i` staggers), `.wipe-in` (an area fill reveals left to right). Use them for the 4 to 12 things that make up the first screen, not for every row of a long list.

**How the motion system was checked** (headless Chrome over CDP against the dev server, `Network.emulateNetworkConditions` for the slow runs, `Emulation.setEmulatedMedia` for reduced motion): client navigations in `/app`, `/m`, `/platform` and the public pages replay the 180ms enter at 60fps with no long task and no layout shift (the parent scroll region reads `overflow: clip` for exactly that time, so no scrollbar flashes at 1024x600); with 1.2s of added latency the bar shows at about 130ms, the pill at about 510ms, both disappear when the page's skeleton is replaced by the page, and the same holds for login → dashboard (`router.push` after the POST) and logout → home (`router.replace`); a page that lands inside 120ms shows neither; hard loads of every public page measure CLS 0 and clean console in both themes; toasts take 180ms in and 140ms out, dialogs 180ms both ways, the drawer 240ms, the theme switch finishes in 390ms; a settled page runs only the logo blink and the live-dot pulse (3 animations on `/app`); under `prefers-reduced-motion: reduce` the route enter, count-up, dialog and theme transitions are replaced by the final state while the bar and pill still appear. A new page that fires `router.push` itself needs nothing: the fetch wrapper sees the navigation. A new `loading.tsx` must mark its frame `aria-busy="true"` (use `TableSkeleton` or `Page aria-busy`), or the bar completes as soon as the URL changes.

**Touch targets.** Anything tappable is at least 40px on a coarse pointer (`pointer-coarse:`), 44px for icon buttons through an invisible hit area. References: WCAG 2.5.8 AA is 24px, Apple HIG 44pt, Material 48dp; 40px is the compromise that keeps dense rows readable. `Button size="sm"`, `Pagination` arrows, filter chips, sidebar and logout rows, and `Checkbox` rows (`pointer-coarse:min-h-11`) follow it.

**Components** (reuse, don't re-style): `Button` variants are `primary` (filled), `secondary` (filled, quieter), `outline` (bordered), `ghost`, `danger` (outline with red text and border, never a red fill), `danger-ghost`. A link that must look like a button is `ButtonLink` (never a `<Link>` wrapping a `<Button>`). Icon-only controls are `IconButton`; checkboxes and radios are `Checkbox` / `Radio`. `Badge tone="success|warning|danger|info|neutral"` is a neutral chip (`bg-accent` + border) with a 6px coloured dot; a status never gets a tinted fill. `Toast` has four variants and one look: a neutral card with only the icon coloured (errors and warnings stay 8s, the rest 5s). `Dialog` is a native `<dialog>`: it centers itself (`m-auto`, because the Tailwind reset zeroes the browser's margin), caps its height at the viewport, has sizes `sm`/`md`/`lg`/`xl`, tightens its header, body and footer padding below 640px of window height, and splits into `Dialog.Body` (scrolls) and `Dialog.Footer` (pinned, buttons stack full-width on phones). A one-time reveal (a generated password) passes `dismissible={false}`. The mobile nav drawer in `Sidebar` is also a modal `<dialog>` (focus trap, inert page, Escape, scroll lock).

**Page frame and scrolling.** On desktop (viewport at least 1024px wide and 560px tall) every page is exactly one viewport tall and the window never scrolls: `html`/`body` are `height: 100%; overflow: hidden`, and each shell (`app/(marketing)/layout.tsx`, `app/app/layout.tsx`, `app/platform/(authenticated)/layout.tsx`, `app/m/layout.tsx`) is one `h-dvh` column with an inner `overflow-y-auto` region as a safety net. Below `lg` (or on a very short window) pages scroll normally. `/app`, `/m` and `/platform` pages are built on `components/shared/Page`: `Page.Header` (title, description, actions), optional `Page.Toolbar` (filters, fixed) and `Page.Body` (`flex-1 min-h-0 overflow-y-auto` from `lg`). A `Table` placed directly in `Page.Body` renders inside `ui/TableFrame`, a card with its own scroll box: when the rows do not fit, the card shrinks to the space left and the rows scroll under a pinned header row (`th` is `sticky top-0` with an opaque fill), so the page header and filters never move; wide tables scroll sideways in the same box, with a soft shadow on the edge that has more. The scroll box becomes a keyboard tab stop (`role="region"`, named by the table's `aria-label`, default "Tabel data") only while it can scroll; give each `Table` an `aria-label`. Rule for callers: any wrapper around a `Table` must be a flex column with `min-h-0` so the frame can shrink. Short pages (forms, dashboard tiles) must fit with no scroll at 1024x600, 1280x720, 1366x768, 1440x900, 1920x1080 and 2200x1100; only genuinely long data may scroll, and only inside its own region. `components/shared/TableSkeleton` is the loading state of a list page (`loading.tsx`): the real Page frame and title with placeholder rows, so the page does not jump when the data arrives.

**Desktop fit (zero scroll).** The product owner's rule: on desktop (>= 1024px wide and >= 560px tall, `FIT_DESKTOP_QUERY` in `components/shared/useFitPager.ts`) neither the window nor any region of the page chrome shows a scrollbar, at any height from 560 to 1400 (verified at 1024x560, 1024x600, 1280x720, 1366x768, 1440x900, 1920x1080, 2200x1100). A page therefore has to FIT by design instead of hiding a scrollbar; below that size (phones, tablets, a landscape tablet 1024x500) pages scroll normally. Dialogs (a modal's own body) and `<textarea>` are exempt. The tools, all in `app/globals.css` ("Desktop fit tiers", unlayered so they beat the mobile spacing utilities):
- **Density tokens.** `--fit-gap`, `--fit-pad`, `--fit-cell-y` step down at heights <= 860px and <= 700px (16/20/12px -> 12/16/8px -> 8/12/6px). Use `fit-gap`, `fit-pad`, `fit-cell-y`, `fit-rows` (a `<dl>` of rows, half the cell token per side) and `fit-gap-y` instead of fixed spacing on anything that sits in a desktop page. `Page`, `Table` and `EmptyState` (`--fit-empty-y`: 48 / 32 / 20px, its icon disc goes below 660px) already do; `StatTile hideSubOnShort` drops a tile's sub-line at <= 760px. `fit-slim-head` / `fit-slim-foot` shrink the marketing and auth header (64 -> 48px) and the footer below 620px of height.
- **Drop low-value text.** `fit-hide-short` (<= 760px of height: page descriptions, helper copy, legends) and `fit-hide-tiny` (<= 660px: marketing intro lines, auth subtitles). Never on a control or on the only text that explains an error.
- **Sidebar rail** (`components/shared/Sidebar.tsx`, pure CSS from the item count `--sb-n` and section count `--sb-g`, so the first server paint already fits and no JS measures anything). The logo header and the "Keluar" row are pinned (56px each, 44px at <= 860px of height); the 19 owner/admin items, the 12 manager items and platform's 5 share what is left: rows flex between 40px and a 28px floor, section headings take only the slack above 32px rows, shrink to a hairline divider and then disappear; below 630px of height the 19-item menu becomes two columns (three labels switch to their `shortLabel`: Check-in, Log Notif., Riwayat; the full label is the tooltip). The collapsed icon rail packs 22px rows and drops its logo mark. Every destination stays one click away at every height: nothing is ever hidden behind "Keluar" and the rail never gets a scrollbar (a safety net applies only below 560px). The touch drawer (below lg) is a separate surface and scrolls.
- **`FitPager`** (`components/shared/FitPager.tsx` + `useFitPager.ts`): paginates rows, cards, grid cells and list items that the server already rendered into pages that exactly fit the measured box (the same idea as AG Grid's `paginationAutoPageSize`). It reveals every item for an instant, computes greedy page breaks from the real rendered boxes (so wrapped rows and multi-column grids are right; the room is the content box, minus a pinned header and padding), and hides the items outside the current page with `hidden`. It re-measures on resize (window, sidebar), when children change (router.refresh, filters, polling) and when web fonts load; a re-measure keeps the first visible item on screen, a new URL goes back to page 1. The footer reads "13-24 dari 36 data", prev / "2 / 3" / next, with PageUp / PageDown and arrow keys. `ui/TableFrame` (so every `<Table>`) is built on it with `listSelector: 'tbody'`; `<FitPager as="ul" ...>` does cards, grids and feeds (`footerClassName=""` inside a bordered card), `<BarList fit>` the bars. A page that is one server chunk of a longer list (`?page=`, 25-100 rows) passes `serverPager` and the footer becomes ONE pager over all rows: next on the last screen loads the next chunk, previous on the first screen loads the previous chunk and lands on its last screen; the plain `<Pagination>` under it is then `fit-hide-desktop` (it stays for a phone).
- **Column fit.** A table that is wider than its card never scrolls sideways on desktop: give the secondary header cells `<Table.HeadCell priority={n}>` (1 to 4) and the frame hides whole columns (header and every cell under it, highest number first) until the table fits. It is evaluated with all rows revealed, so the same columns show on every page; the footer says "· 2 kolom disembunyikan". A header without a priority is never hidden.
- **Rule for a new desktop page.** Build it on `Page`. A table goes in `Page.Body` as a `<Table>`. Cards, grids and feeds go in a `FitPager` inside a `min-h-0 flex-1` column. Forms use two columns, `fit-gap` and `fit-hide-short` on helper text; a chart takes `min-h-0 flex-1`. Check it with the QA harness (`shoot.mjs --fit`: window = 0 and no inner scroller at every height above), and with long data, not only the seed.

**Theme and errors.** Dark mode is a `.dark` class on `<html>`, set before first paint by the inline script in `app/layout.tsx` (a saved choice wins, then the OS setting) and toggled by `ThemeToggle`. After a Server Component error Next answers with a bare `<html id="__next_error__">` shell and the browser renders the tree itself, where that script never runs, so `components/shared/ThemeSync` re-applies the class in a layout effect (a dark-mode user no longer sees the error page in light). Error boundaries: `app/error.tsx` covers the whole screen; `app/platform/(authenticated)/error.tsx` (and any segment-level `error.tsx`) renders inside its layout so the sidebar stays and the retry happens in place.

**Brand:** the mascot is one original hand-drawn SVG (`lib/brand/mascot.ts`: anime-style, green check hair clip, attendance lanyard). It has **no background**: a transparent canvas with a light outline (an `feMorphology` ring) that keeps the dark hair readable on a dark page, so it sits directly on the page and never in a tile. `Logo` = mascot + "Hadirin" wordmark (mascot `2em`, so a font size scales both); `Mascot` is the inline SVG. `app/icon.svg` and `public/icon.svg` are generated by `npm run brand:generate` (a test fails if they drift); the Apple touch icon, `/favicon.ico`, the PWA PNGs (`/icons/192`, `/icons/512`, `/icons/maskable-512`) and the share image are rendered from the same drawing with `next/og`. Only the places an OS fills transparency with black (the Apple touch icon, the maskable PWA icon) ask for `background: 'neutral'`, a white-to-gray square.

**Marketing header:** logo, then five links: Fitur (`/fitur`), Harga (`/pricing`), Tentang Kami (`/about`), Check-in (`/check-in`) and Bantuan (`/bantuan`); the current one is a secondary pill. Then theme toggle, **Sign in** (outline) and **Sign up** (filled); signed-in visitors see **Buka Dashboard** instead. Below `lg` the links and both buttons move into a hamburger panel. The home page (`/`) is the hero only; each menu entry is its own page, built from `PageSection` (a `max-w-6xl` column that centers its content vertically and uses `vh`-aware gaps) and `PageHead` (title block, calls to action opposite it on desktop) in `app/(marketing)/marketing-page.tsx`. `/check-in` requires a session: signed out it redirects to `/login?next=%2Fcheck-in` and back after login; signed in it renders the same `TodayView` as `/m`, inside the marketing shell. `SelfieCamera` sizes its preview from three host variables: `--today-chrome` (the height the host uses around the viewfinder in the narrow column), `--today-chrome-wide` (the same once the card is wide enough for two columns) and `--vf-min` (the floor). `/m` sets `33rem` / `19rem`; `/check-in` sets `lg:[--today-chrome-wide:19rem] lg:[--vf-min:8rem]` and fits 1024x600 with no slack, so if the card header or the Page header changes height, re-tune `19rem`. Logout returns `/app` and `/m` users to `/`; platform admins to `/platform/login`. `/sitemap.xml` lists `/`, `/pricing`, `/fitur`, `/about` and `/bantuan` (not `/check-in`, which is `noindex`).

**Layout:** admin uses a collapsible sidebar (icon-only on desktop, a drawer on mobile, full height, brand aligned with the nav icons). The employee `/m` is single-column with a bottom tab bar (Hari ini, Riwayat, Pengajuan, Profil) and one large primary action.

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
npm run brand:generate  # rewrite app/icon.svg + public/icon.svg from lib/brand/mascot.ts
```

Deploy: push → Vercel preview per branch, `main` → production. Neon branch per preview is optional (Vercel–Neon integration).

## 18. Testing

| Layer | What | Tool |
|---|---|---|
| Unit | `distanceM`, `workDate` (incl. cross-day), `lateMinutes` (tolerance edge), `workMinutes`, Midtrans signature | Vitest |
| Unit | Brand icons in sync with `lib/brand/mascot.ts`; `.ico` container layout | Vitest |
| Query | Each `lib/queries/*` function against a fresh DB with the seed (PGlite or a Neon branch) | Vitest |
| API | Role matrix + tenant isolation: org 2 owner calling every org 1 id → 404 | Vitest + route handler calls |
| E2E (smoke) | Login → check-in with mocked geolocation/camera → dashboard count → approve → export | Playwright (P1) |

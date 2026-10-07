# PRD — Hadirin

> Attendance-only mini-SaaS for Indonesian SMEs. GPS + selfie check-in, live dashboard, one-tap approvals, monthly recap export.
> Status: hackathon MVP · Owner: zia · Last updated: 2026-10-07

Related: [ERD.md](ERD.md) (schema + seed) · [TRD.md](TRD.md) (architecture) · [AGENTS.md](AGENTS.md) (agent contract)

---

## 1. Problem

Small Indonesian businesses (clinics, retail outlets, warehouses, schools, foundations) with 10–200 staff still run attendance on paper, WhatsApp selfies, or fingerprint machines that only work at one door. Owners cannot answer three daily questions without calling someone:

1. Who is in right now, and where?
2. Who was late or absent this month?
3. Which leave or correction requests are waiting for me?

Full HRIS suites solve this, but they bundle payroll, tax, BPJS and performance. They are priced and sized for HR departments, and onboarding takes weeks. The SME owner only wants attendance that works on staff phones today.

## 2. Product thesis

**Do one thing well.** The products that win this category are narrow. OneTap sells only check-in + export (free up to 20 people, paid from US$49.99/month billed yearly). TimeKompas and SEAtS sell selfie and geofence check-in. Hadirin takes the attendance core that Digispace (`growt/digispace-ydsf-v2`) has proven in production for YDSF, removes everything else, and packages it as self-serve SaaS:

- Setup in 5 minutes: register → add a branch (one tap on "use my location") → add a shift → invite staff.
- Staff need nothing installed. The check-in screen is a mobile web page (installable PWA).
- Priced in rupiah, per company, with a free tier.

### Concept lineage (what we keep from Digispace, what we drop)

| Digispace v2 concept | Hadirin |
|---|---|
| `attendance_today` + `attendance` (live/history split) | One `attendance_logs` table, one row per user per day |
| Haversine `calculateDistance()` vs `branch` radius | Same formula, server-side, against the org's branches |
| `attendance_setting` type 0/1/2 + `attendance_location` + `attendance_assign` | One org-level `geofence_mode` (STRICT / FLAG) + `branches` |
| `time_shift` + rotating `time_pattern` | One fixed shift per employee (weekday mask) |
| Late category A/B/C | `late_minutes` + LATE status (category is derived in reports) |
| Correction / time-off / overtime / flexi requests, multi-level approvals | One `attendance_requests` table (CORRECTION, LEAVE, SICK, PERMIT), one approval level |
| Payroll, BPJS, tax, OKR, Qordul Hassan, business trip, mutabaah, form builder | **Out of scope** |
| Permissions enforced only in the Vue frontend | **Every API route enforces role and tenant on the server** |

## 3. Target users and personas

| Persona | Who | Main job | Surface |
|---|---|---|---|
| **Owner** | Clinic director, shop owner | Sees the dashboard, pays the subscription | Admin web |
| **Admin (HR)** | Office admin, HR staff | Manages employees, branches, shifts, exports the recap | Admin web |
| **Manager** | Head nurse, warehouse lead | Approves team requests, gets late alerts | Admin web + WhatsApp/email |
| **Employee** | Nurse, cashier, warehouse staff | Checks in and out, submits requests, views own history | Mobile web (PWA) `/m` |
| **Platform admin** | Hadirin team | Manages plans, payment methods, global templates, national holidays | `/platform` |

Initial market: Indonesian SMEs with 10–200 employees across 1–10 sites. Default timezone `Asia/Jakarta`. UI language Bahasa Indonesia. Docs and code in English.

## 4. Scope

Priority: **P0** = must ship for the hackathon demo · **P1** = ship if time allows · **P2** = after the hackathon.

### 4.1 Employee app (`/m`)

| # | Feature | Priority |
|---|---|---|
| E1 | Login with email **or** phone + password; first login forces a password change | P0 |
| E2 | Today card: shift, branch, check-in/out status, live clock (server time) | P0 |
| E3 | Check-in: GPS + mandatory selfie → server validates radius → result screen (On time / Late X min / Outside area) | P0 |
| E4 | Check-out with the same flow; shows worked hours | P0 |
| E5 | History: last 30 days, status chips, monthly summary | P0 |
| E6 | Submit request: CORRECTION / LEAVE / SICK (with photo attachment) / PERMIT; cancel while PENDING | P0 |
| E7 | Install as PWA (manifest + icon) | P1 |
| E8 | Offline queue for check-in | P2 |

### 4.2 Admin panel (`/app`)

| # | Feature | Priority |
|---|---|---|
| A1 | Live dashboard for today: checked in / late / not yet in / outside area / missing check-out, per branch, auto-refresh | P0 |
| A2 | Approval inbox: all PENDING requests, approve/reject with note, bulk approve | P0 |
| A3 | Employees CRUD (role, branch, shift, manager, status) + plan seat limit. Creating an employee shows a one-time temporary password to hand over; admin can reset it | P0 |
| A4 | Branches CRUD with "use my current location" + radius | P0 |
| A5 | Shifts CRUD (time in/out, break, late tolerance, work days) | P0 |
| A6 | Attendance log table with filters (date range, branch, status, employee), selfie preview | P0 |
| A7 | Monthly recap: per-employee totals + charts; export **XLSX** | P0 |
| A8 | Monthly recap export **PDF** (paid plans) | P1 |
| A9 | Organization settings: name, logo, timezone, geofence mode, selfie required | P0 |
| A10 | Holidays: national (read-only) + company-specific | P1 |
| A11 | Notification templates: override text for WhatsApp/email per event (rich text editor) | P1 |
| A12 | Billing: current plan, invoices, pay via Midtrans Snap | P1 |
| A13 | Bulk import employees from XLSX | P1 |
| A14 | Shift roster board (drag employees between shifts) | P2 |

### 4.3 Platform (`/platform`)

| # | Feature | Priority |
|---|---|---|
| P1 | Organizations list (plan, status, seats used) | P1 |
| P2 | Plans CMS (price, seat limit, feature flags, sort order) | P1 |
| P3 | Payment methods CMS (enable/disable, fees, drag to reorder) | P1 |
| P4 | Global notification templates CMS | P1 |
| P5 | National holidays CMS | P1 |

### 4.4 Public site (SSR, SEO)

| # | Feature | Priority |
|---|---|---|
| S1 | Landing page (hero, 3 features, how it works, FAQ) with metadata, OpenGraph, JSON-LD `SoftwareApplication` | P0 |
| S2 | Pricing page rendered from the `plans` table | P0 |
| S3 | Self-serve registration → creates org on 14-day TRIAL of STARTER | P0 |

### 4.5 System

| # | Feature | Priority |
|---|---|---|
| Y1 | Nightly close-day job: mark ABSENT, apply holidays/OFF days, send missing check-out reminders | P0 |
| Y2 | Late check-in alert to the manager (WhatsApp or email) | P1 |
| Y3 | Request submitted / reviewed notifications | P1 |
| Y4 | Billing job: renewal invoice 7 days before expiry, expire unpaid invoices, PAST_DUE → SUSPENDED after 3-day grace | P1 |

### 4.6 Out of scope

Payroll, tax, BPJS, overtime pay, performance/OKR, loans, business trips, face recognition, fingerprint/RFID hardware sync, multi-level approval chains, rotating shift patterns, native mobile app.

## 5. User stories and acceptance criteria (P0)

**US-01 Check-in.** As an employee, I check in from my phone so my presence is recorded with proof.
- Location permission denied → clear instruction screen, no request sent.
- GPS accuracy worse than 100 m → "Signal too weak, move outdoors", no request sent.
- The selfie is captured in-app (front camera), compressed to ≤ 200 KB, uploaded to Blob before the check-in call.
- The server uses **its own clock** for `check_in_at`. The client time is never trusted.
- Only tracked users (with a shift) can check in. Owners who don't clock in have no shift.
- Holidays and off days don't block check-in (clinics and shops work then); such a check-in is PRESENT with no late minutes.
- Nearest active branch of the org within radius → record PRESENT or LATE. `late_minutes = check_in − shift.time_in` when it exceeds `late_tolerance_minutes`.
- Outside every radius: STRICT org → rejected with distance to nearest branch; FLAG org → accepted with `check_in_is_outside = true`, highlighted on the dashboard.
- A second check-in on the same work date returns the existing record (idempotent). It never creates a duplicate.
- p95 API latency ≤ 600 ms from Indonesia (excluding the photo upload).

**US-02 Check-out.** Allowed only after check-in on the same work date. Computes `work_minutes = (out − in) − break_minutes` and `early_leave_minutes` when leaving before `time_out`.

**US-03 Live dashboard.** As an owner, I open `/app` and see today's counts within 2 s. Counts refresh every 30 s without a full reload. Clicking a count opens the filtered list. Numbers match the attendance table for the same filter.

**US-04 Approve requests.** As a manager, I see PENDING requests from my reports (admins/owners see all). Approve/reject takes one click plus an optional note. Approving:
- CORRECTION → upserts that day's log with the requested times, `source = REQUEST`, recalculates late/work minutes.
- LEAVE / SICK / PERMIT → upserts one log per scheduled work day in the range with that status.
- The requester is notified (P1). A reviewed request cannot be reviewed again.

**US-05 Monthly recap.** As an admin, I pick a month and branch and see per-employee totals: present, late, total late minutes, absent, leave, sick, permit, worked hours. Export to XLSX in ≤ 5 s for 200 employees.

**US-06 Tenant isolation.** A user of org A can never read or change data from org B, even with a hand-crafted request. The org always comes from the session, never from the request body or query string.

**US-07 Register.** A visitor registers with company name, own name, email and password. An org is created on STARTER TRIAL (14 days), the visitor becomes OWNER, and lands in an onboarding checklist (branch → shift → invite). When the trial ends unpaid, the org drops to Gratis if it fits that plan's limits; otherwise it is SUSPENDED (login and pay still work, check-in is blocked, no data is lost).

## 6. Business model

| Plan | Price / month | Employees | Branches | Extras |
|---|---|---|---|---|
| Gratis | Rp 0 | 10 | 1 | XLSX export |
| Starter | Rp 99.000 | 50 | 3 | + PDF export, late alerts by email |
| Business | Rp 299.000 | 200 | 10 | + WhatsApp alerts, template overrides |

Payment through Midtrans Snap (QRIS, e-wallets, bank VA). Plans and payment methods are CMS data, so prices change without a deploy. Pitch line: *"Absensi GPS + selfie untuk UMKM, siap dalam 5 menit, mulai gratis."*

## 7. Success metrics

| Metric | Hackathon target | Post-launch target |
|---|---|---|
| Time from register to first check-in | ≤ 5 min (demo) | median ≤ 15 min |
| Check-in API p95 | ≤ 600 ms | ≤ 400 ms |
| Lighthouse (landing, mobile) | Performance ≥ 90, SEO ≥ 95 | same |
| Daily active check-in rate | — | ≥ 85% of active employees |
| Trial → paid conversion | — | ≥ 8% |

## 8. Hackathon plan (assumes 48 h; scale proportionally)

| Hours | Deliverable |
|---|---|
| 0–4 | Scaffold, Drizzle migration, seed, auth (login/logout, session, `proxy.ts`) |
| 4–14 | Employee `/m`: today card, selfie + GPS check-in/out, Blob upload, geofence |
| 14–22 | Admin dashboard (live counts), employees / branches / shifts CRUD |
| 22–30 | Requests (employee submit + admin approval inbox) |
| 30–36 | Attendance table, monthly recap, XLSX export, close-day cron |
| 36–42 | Landing + pricing SSR, registration, Midtrans sandbox checkout (P1) |
| 42–48 | Polish, demo seed reset script, pitch rehearsal |

### Demo script (3 minutes)

1. Landing → pricing (SSR, instant) → register "Klinik Demo".
2. Onboarding: add branch with "use my location", radius 100 m, shift 08:00–17:00.
3. On a phone, open `/m` as an employee → selfie → check-in → "Tepat waktu".
4. On the laptop, the dashboard count updates. Show a flagged "outside area" check-in from the seed data.
5. Employee submits a SICK request with a photo → manager approves → recap updates.
6. Export the monthly XLSX. Show the billing page with the QRIS sandbox.

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| GPS spoofing (mock location apps) | Mandatory selfie, accuracy threshold, server timestamps, outside-area flag; P2: impossible-travel detection |
| Camera/geo permission friction on iOS Safari | HTTPS only (Vercel), explicit permission explainer screen, `<input capture>` fallback |
| Neon cold start on the first request | Pooled connection string, Vercel region `sin1` next to Neon `ap-southeast-1`, Redis cache for master data |
| Vercel Hobby cron runs once per day | Close-day job is designed as a daily batch; hourly only on Pro |
| Scope creep toward a full HRIS | Section 4.6 is a hard boundary for the hackathon |
| Selfies and sick notes are personal/health data (UU PDP) | Private Blob store served through an authorized route, consent notice, retention policy (TRD §15) |
| Laptop GPS is Wi-Fi based and often > 100 m accuracy | Demo check-in on a phone outdoors or near a window; threshold is a constant that can be raised for the demo |
| Malicious XLSX on employee import | SheetJS from its CDN build, not the vulnerable npm copy |

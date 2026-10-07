// Drizzle schema — migration + idempotent seed source ONLY (AGENTS.md, TRD §3/§6).
// Never import this file outside db/ and scripts/. Runtime code uses lib/db.ts raw SQL.
//
// Partial indexes, expression (lower()/COALESCE) unique indexes, the INCLUDE covering
// index, and all multi-column/column CHECK constraints are NOT expressed here — drizzle-kit
// cannot diff them reliably. They live in drizzle/0001_custom_constraints.sql (ERD.md §3
// is the source of truth for both). See AGENTS.md "Schema change" rule before editing.

import {
  bigint,
  bigserial,
  boolean,
  foreignKey,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  index,
  varchar,
  date,
} from 'drizzle-orm/pg-core';

// ---------- PLATFORM ----------

export const plans = pgTable('plans', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  name: varchar('name', { length: 60 }).notNull(),
  priceMonthly: bigint('price_monthly', { mode: 'number' }).notNull().default(0),
  maxEmployees: integer('max_employees').notNull(),
  maxBranches: integer('max_branches').notNull(),
  features: jsonb('features').notNull().default({}),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const platformAdmins = pgTable('platform_admins', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 150 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('SUPERADMIN'),
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const paymentMethods = pgTable('payment_methods', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  name: varchar('name', { length: 80 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  logoUrl: varchar('logo_url', { length: 500 }),
  adminFeeFlat: bigint('admin_fee_flat', { mode: 'number' }).notNull().default(0),
  adminFeePct: numeric('admin_fee_pct', { precision: 5, scale: 2 }).notNull().default('0.00'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------- TENANT ----------

export const organizations = pgTable(
  'organizations',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    planId: bigint('plan_id', { mode: 'number' })
      .notNull()
      .references(() => plans.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 120 }).notNull(),
    slug: varchar('slug', { length: 60 }).notNull().unique(),
    timezone: varchar('timezone', { length: 40 }).notNull().default('Asia/Jakarta'),
    status: varchar('status', { length: 20 }).notNull().default('TRIAL'),
    geofenceMode: varchar('geofence_mode', { length: 10 }).notNull().default('STRICT'),
    selfieRequired: boolean('selfie_required').notNull().default(true),
    logoUrl: varchar('logo_url', { length: 500 }),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    planExpiresAt: timestamp('plan_expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_organizations_plan').on(t.planId)],
);

export const branches = pgTable(
  'branches',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    orgId: bigint('org_id', { mode: 'number' })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    address: varchar('address', { length: 255 }),
    latitude: numeric('latitude', { precision: 9, scale: 6 }).notNull(),
    longitude: numeric('longitude', { precision: 9, scale: 6 }).notNull(),
    radiusM: integer('radius_m').notNull().default(100),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('uq_branches_org_name').on(t.orgId, t.name)],
);

export const shifts = pgTable(
  'shifts',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    orgId: bigint('org_id', { mode: 'number' })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 60 }).notNull(),
    timeIn: time('time_in').notNull(),
    timeOut: time('time_out').notNull(),
    breakMinutes: integer('break_minutes').notNull().default(60),
    lateToleranceMinutes: integer('late_tolerance_minutes').notNull().default(0),
    workDays: varchar('work_days', { length: 20 }).notNull().default('1,2,3,4,5'),
    isCrossDay: boolean('is_cross_day').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('uq_shifts_org_name').on(t.orgId, t.name), index('idx_shifts_org').on(t.orgId)],
);

export const users = pgTable(
  'users',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    orgId: bigint('org_id', { mode: 'number' })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    branchId: bigint('branch_id', { mode: 'number' }).references(() => branches.id, { onDelete: 'set null' }),
    shiftId: bigint('shift_id', { mode: 'number' }).references(() => shifts.id, { onDelete: 'set null' }),
    // Self-FK: declared via a raw migration reference too, but drizzle supports self-reference thunks.
    managerId: bigint('manager_id', { mode: 'number' }),
    employeeCode: varchar('employee_code', { length: 30 }),
    name: varchar('name', { length: 100 }).notNull(),
    email: varchar('email', { length: 150 }),
    phone: varchar('phone', { length: 20 }),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    mustChangePassword: boolean('must_change_password').notNull().default(false),
    role: varchar('role', { length: 20 }).notNull().default('EMPLOYEE'),
    position: varchar('position', { length: 80 }),
    avatarUrl: varchar('avatar_url', { length: 500 }),
    status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
    joinedAt: date('joined_at'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_users_org_status_role').on(t.orgId, t.status, t.role),
    index('idx_users_branch').on(t.branchId),
    index('idx_users_shift').on(t.shiftId),
    index('idx_users_manager').on(t.managerId),
    foreignKey({ columns: [t.managerId], foreignColumns: [t.id], name: 'users_manager_id_fkey' }).onDelete(
      'set null',
    ),
  ],
);

export const holidays = pgTable(
  'holidays',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    orgId: bigint('org_id', { mode: 'number' }).references(() => organizations.id, { onDelete: 'cascade' }),
    holidayDate: date('holiday_date').notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    isCollectiveLeave: boolean('is_collective_leave').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_holidays_date').on(t.holidayDate)],
);

// ---------- ATTENDANCE (hot path) ----------

export const attendanceRequests = pgTable(
  'attendance_requests',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    orgId: bigint('org_id', { mode: 'number' })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 20 }).notNull(),
    dateFrom: date('date_from').notNull(),
    dateTo: date('date_to').notNull(),
    requestedCheckIn: time('requested_check_in'),
    requestedCheckOut: time('requested_check_out'),
    reason: varchar('reason', { length: 500 }).notNull(),
    attachmentUrl: varchar('attachment_url', { length: 500 }),
    status: varchar('status', { length: 20 }).notNull().default('PENDING'),
    reviewedBy: bigint('reviewed_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewNote: varchar('review_note', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_requests_org_status').on(t.orgId, t.status, t.dateFrom),
    index('idx_requests_user').on(t.userId, t.createdAt),
    index('idx_requests_reviewed_by').on(t.reviewedBy),
  ],
);

export const attendanceLogs = pgTable(
  'attendance_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    orgId: bigint('org_id', { mode: 'number' })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    shiftId: bigint('shift_id', { mode: 'number' }).references(() => shifts.id, { onDelete: 'set null' }),
    requestId: bigint('request_id', { mode: 'number' }).references(() => attendanceRequests.id, {
      onDelete: 'set null',
    }),
    workDate: date('work_date').notNull(),
    scheduledIn: time('scheduled_in'),
    scheduledOut: time('scheduled_out'),
    checkInAt: timestamp('check_in_at', { withTimezone: true }),
    checkInBranchId: bigint('check_in_branch_id', { mode: 'number' }).references(() => branches.id, {
      onDelete: 'set null',
    }),
    checkInLat: numeric('check_in_lat', { precision: 9, scale: 6 }),
    checkInLng: numeric('check_in_lng', { precision: 9, scale: 6 }),
    checkInAccuracyM: integer('check_in_accuracy_m'),
    checkInDistanceM: integer('check_in_distance_m'),
    checkInPhotoUrl: varchar('check_in_photo_url', { length: 500 }),
    checkInIsOutside: boolean('check_in_is_outside').notNull().default(false),
    checkOutAt: timestamp('check_out_at', { withTimezone: true }),
    checkOutBranchId: bigint('check_out_branch_id', { mode: 'number' }).references(() => branches.id, {
      onDelete: 'set null',
    }),
    checkOutLat: numeric('check_out_lat', { precision: 9, scale: 6 }),
    checkOutLng: numeric('check_out_lng', { precision: 9, scale: 6 }),
    checkOutAccuracyM: integer('check_out_accuracy_m'),
    checkOutDistanceM: integer('check_out_distance_m'),
    checkOutPhotoUrl: varchar('check_out_photo_url', { length: 500 }),
    checkOutIsOutside: boolean('check_out_is_outside').notNull().default(false),
    status: varchar('status', { length: 20 }).notNull().default('PRESENT'),
    lateMinutes: integer('late_minutes').notNull().default(0),
    earlyLeaveMinutes: integer('early_leave_minutes').notNull().default(0),
    workMinutes: integer('work_minutes'),
    note: varchar('note', { length: 255 }),
    source: varchar('source', { length: 20 }).notNull().default('APP'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_attendance_user_date').on(t.userId, t.workDate),
    index('idx_att_shift').on(t.shiftId),
    index('idx_att_in_branch').on(t.checkInBranchId),
    index('idx_att_out_branch').on(t.checkOutBranchId),
  ],
);

// ---------- BILLING ----------

export const invoices = pgTable(
  'invoices',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    orgId: bigint('org_id', { mode: 'number' })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    planId: bigint('plan_id', { mode: 'number' })
      .notNull()
      .references(() => plans.id, { onDelete: 'restrict' }),
    paymentMethodId: bigint('payment_method_id', { mode: 'number' }).references(() => paymentMethods.id, {
      onDelete: 'set null',
    }),
    invoiceCode: varchar('invoice_code', { length: 40 }).notNull().unique(),
    midtransOrderId: varchar('midtrans_order_id', { length: 50 }).unique(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    employeeCount: integer('employee_count').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    adminFee: bigint('admin_fee', { mode: 'number' }).notNull().default(0),
    totalAmount: bigint('total_amount', { mode: 'number' }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('PENDING'),
    snapToken: varchar('snap_token', { length: 100 }),
    snapRedirectUrl: varchar('snap_redirect_url', { length: 500 }),
    midtransTransactionId: varchar('midtrans_transaction_id', { length: 64 }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_invoices_org').on(t.orgId, t.createdAt),
    index('idx_invoices_plan').on(t.planId),
    index('idx_invoices_method').on(t.paymentMethodId),
  ],
);

export const paymentLogs = pgTable(
  'payment_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    invoiceId: bigint('invoice_id', { mode: 'number' })
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    direction: varchar('direction', { length: 10 }).notNull(),
    endpoint: varchar('endpoint', { length: 255 }),
    requestPayload: jsonb('request_payload'),
    responsePayload: jsonb('response_payload'),
    httpStatus: integer('http_status'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_payment_logs_invoice').on(t.invoiceId, t.createdAt)],
);

// ---------- NOTIFICATIONS ----------

export const notificationTemplates = pgTable('notification_templates', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  orgId: bigint('org_id', { mode: 'number' }).references(() => organizations.id, { onDelete: 'cascade' }),
  eventTrigger: varchar('event_trigger', { length: 40 }).notNull(),
  channel: varchar('channel', { length: 20 }).notNull(),
  subject: varchar('subject', { length: 200 }),
  body: text('body').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notificationLogs = pgTable(
  'notification_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    orgId: bigint('org_id', { mode: 'number' })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    templateId: bigint('template_id', { mode: 'number' }).references(() => notificationTemplates.id, {
      onDelete: 'set null',
    }),
    userId: bigint('user_id', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
    attendanceLogId: bigint('attendance_log_id', { mode: 'number' }).references(() => attendanceLogs.id, {
      onDelete: 'set null',
    }),
    attendanceRequestId: bigint('attendance_request_id', { mode: 'number' }).references(
      () => attendanceRequests.id,
      { onDelete: 'set null' },
    ),
    invoiceId: bigint('invoice_id', { mode: 'number' }).references(() => invoices.id, { onDelete: 'set null' }),
    channel: varchar('channel', { length: 20 }).notNull(),
    recipient: varchar('recipient', { length: 150 }).notNull(),
    requestPayload: jsonb('request_payload'),
    responsePayload: jsonb('response_payload'),
    status: varchar('status', { length: 20 }).notNull().default('QUEUED'),
    error: varchar('error', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_notif_logs_org').on(t.orgId, t.createdAt),
    index('idx_notif_logs_template').on(t.templateId),
    index('idx_notif_logs_user').on(t.userId),
  ],
);

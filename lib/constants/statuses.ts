// Static value sets (ERD.md §1.1). Keep in sync with drizzle/0001_custom_constraints.sql
// CHECK constraints are on ranges/relations, not these sets — the DB does not enforce
// membership in these arrays, so every write path must validate against them.

export const USER_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const ORG_STATUSES = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED'] as const;
export type OrgStatus = (typeof ORG_STATUSES)[number];

export const GEOFENCE_MODES = ['STRICT', 'FLAG'] as const;
export type GeofenceMode = (typeof GEOFENCE_MODES)[number];

export const ATTENDANCE_STATUSES = [
  'PRESENT',
  'LATE',
  'ABSENT',
  'LEAVE',
  'SICK',
  'PERMIT',
  'HOLIDAY',
  'OFF',
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_SOURCES = ['APP', 'REQUEST', 'SYSTEM'] as const;
export type AttendanceSource = (typeof ATTENDANCE_SOURCES)[number];

export const REQUEST_TYPES = ['CORRECTION', 'LEAVE', 'SICK', 'PERMIT'] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const PAYMENT_METHOD_TYPES = ['QRIS', 'EWALLET', 'VA', 'CARD'] as const;
export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number];

/** Midtrans `enabled_payments` codes (docs.midtrans.com/docs/snap-advanced-feature). */
export const PAYMENT_METHOD_CODES = [
  'other_qris',
  'gopay',
  'shopeepay',
  'bca_va',
  'bni_va',
  'bri_va',
  'echannel',
  'permata_va',
  'credit_card',
] as const;
export type PaymentMethodCode = (typeof PAYMENT_METHOD_CODES)[number];

export const INVOICE_STATUSES = ['PENDING', 'PAID', 'EXPIRED', 'FAILED', 'REFUNDED'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_LOG_DIRECTIONS = ['REQUEST', 'WEBHOOK'] as const;
export type PaymentLogDirection = (typeof PAYMENT_LOG_DIRECTIONS)[number];

export const NOTIFICATION_CHANNELS = ['EMAIL', 'WHATSAPP'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_LOG_STATUSES = ['QUEUED', 'SENT', 'FAILED'] as const;
export type NotificationLogStatus = (typeof NOTIFICATION_LOG_STATUSES)[number];

/** `shifts.work_days`: comma list of ISO weekdays, 1=Mon … 7=Sun (ERD.md §1.1). */
export function workDaysSetFromString(workDays: string): Set<number> {
  return new Set(
    workDays
      .split(',')
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7),
  );
}

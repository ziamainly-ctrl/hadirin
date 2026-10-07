// Static value set (ERD.md §1.1).

export const NOTIFICATION_EVENT_TRIGGERS = [
  'LATE_CHECK_IN',
  'MISSING_CHECK_OUT',
  'REQUEST_SUBMITTED',
  'REQUEST_REVIEWED',
  'INVOICE_CREATED',
  'INVOICE_PAID',
] as const;
export type NotificationEventTrigger = (typeof NOTIFICATION_EVENT_TRIGGERS)[number];

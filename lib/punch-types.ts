// Wire types shared by POST /api/attendance/precheck and the "Hari ini" screen. Types only, so a
// client component can import them without pulling the route (and its server modules) along.

import type { GeofenceMode } from './constants/statuses';
import type { DayKind } from './punch';

export type PrecheckAction =
  | 'check-in'
  | 'check-out'
  | 'done'
  | 'recorded'
  | 'expired'
  | 'not-tracked'
  | 'no-branch'
  | 'suspended';

export type PrecheckBlock =
  | 'NOT_TRACKED'
  | 'NO_BRANCHES'
  | 'ORG_SUSPENDED'
  | 'ALREADY_DONE'
  | 'ALREADY_RECORDED'
  | 'CHECKOUT_WINDOW_CLOSED'
  | 'ACCURACY_TOO_LOW'
  | 'OUTSIDE_GEOFENCE';

export interface PrecheckBranch {
  id: number;
  name: string;
  distanceM: number;
  radiusM: number;
  isInside: boolean;
}

export interface PrecheckResult {
  action: PrecheckAction;
  /** True when a punch from this position would be accepted (the server still re-checks it). */
  canSubmit: boolean;
  block: PrecheckBlock | null;
  geofenceMode: GeofenceMode;
  selfieRequired: boolean;
  branch: PrecheckBranch | null;
  accuracyM: number;
  accuracyClass: 'good' | 'weak' | 'too-low';
  /** FLAG mode + outside: accepted, but the row is marked "Di Luar Area". */
  willFlagOutside: boolean;
  dayKind: DayKind;
  holidayName: string | null;
  serverNow: string;
}

// Shapes passed from the calendar page (server) to its client leaves. Plain data only.

export type HolidayScope = 'NATIONAL' | 'COMPANY';

export interface HolidayEntry {
  /** holidays.id. */
  id: number;
  date: string; // YYYY-MM-DD
  name: string;
  scope: HolidayScope;
  isCollectiveLeave: boolean;
}

export interface DayDialogRow {
  logId: number;
  name: string;
  status: import('@/lib/constants/statuses').AttendanceStatus;
  /** Already formatted in the organization's time zone ("07.58", or "—"). */
  checkIn: string;
  checkOut: string;
  branchName: string | null;
  /** "Terlambat 24 mnt" / "Pulang awal 30 mnt" / null. */
  note: string | null;
  isOutside: boolean;
}

/** The kind of a holiday in words: "Libur nasional", "Cuti bersama", "Libur perusahaan" or "Cuti bersama perusahaan". */
export function holidayKindLabel(holiday: Pick<HolidayEntry, 'scope' | 'isCollectiveLeave'>): string {
  if (holiday.scope === 'COMPANY') return holiday.isCollectiveLeave ? 'Cuti bersama perusahaan' : 'Libur perusahaan';
  return holiday.isCollectiveLeave ? 'Cuti bersama' : 'Libur nasional';
}

import type { SidebarItem } from '@/components/shared/Sidebar';
import { ORG_WIDE_ROLES, type UserRole } from './roles';

// The /app sidebar, as data (app/app/layout.tsx picks the list for the signed-in role). It lives
// here, not in the layout, so the menu is unit-testable (tests/admin-nav.test.ts) and a new page
// is one line in one place. Order matters: the sidebar renders it top to bottom and a heading
// appears whenever `section` changes (components/shared/Sidebar.tsx).
//
// Icons are string keys (see Sidebar.tsx: a Server Component cannot pass a component function
// to a Client Component). A page that is not in this list is not reachable from the menu.

/** Section headings, in the order they appear. "Tinjauan" (not "Persetujuan"): a heading that
 * repeats the single item under it ("Persetujuan / Persetujuan") reads as a stutter. */
const S = {
  main: 'Utama',
  attendance: 'Absensi',
  review: 'Tinjauan',
  analytics: 'Analitik',
  org: 'Organisasi',
  system: 'Sistem',
  account: 'Akun',
} as const;

/** OWNER and ADMIN: the whole org. 19 items. */
export const OWNER_ADMIN_ITEMS: SidebarItem[] = [
  { section: S.main, href: '/app', label: 'Dashboard', icon: 'LayoutDashboard' },
  { section: S.main, href: '/app/live', label: 'Live', icon: 'Radio' },
  { section: S.main, href: '/app/check-in', label: 'Check-in Saya', shortLabel: 'Check-in', icon: 'Fingerprint' },

  { section: S.attendance, href: '/app/attendance', label: 'Absensi', icon: 'ListChecks' },
  { section: S.attendance, href: '/app/terlambat', label: 'Terlambat', icon: 'ClockAlert' },
  { section: S.attendance, href: '/app/luar-area', label: 'Di Luar Area', icon: 'MapPinOff' },
  { section: S.attendance, href: '/app/selfie', label: 'Galeri Selfie', icon: 'Images' },
  { section: S.attendance, href: '/app/kalender', label: 'Kalender', icon: 'CalendarDays' },

  { section: S.review, href: '/app/requests', label: 'Persetujuan', icon: 'CalendarCheck' },

  { section: S.analytics, href: '/app/reports', label: 'Laporan', icon: 'FileBarChart' },
  { section: S.analytics, href: '/app/statistik', label: 'Statistik', icon: 'ChartNoAxesCombined' },
  { section: S.analytics, href: '/app/peringkat', label: 'Peringkat', icon: 'Trophy' },

  { section: S.org, href: '/app/employees', label: 'Karyawan', icon: 'Users' },
  { section: S.org, href: '/app/branches', label: 'Cabang', icon: 'MapPin' },
  { section: S.org, href: '/app/shifts', label: 'Shift', icon: 'Clock' },

  { section: S.system, href: '/app/log-notifikasi', label: 'Log Notifikasi', shortLabel: 'Log Notif.', icon: 'ScrollText' },
  { section: S.system, href: '/app/settings', label: 'Pengaturan', icon: 'Settings' },

  { section: S.account, href: '/app/riwayat', label: 'Riwayat Saya', shortLabel: 'Riwayat', icon: 'History' },
  { section: S.account, href: '/app/akun', label: 'Akun Saya', icon: 'CircleUser' },
];

/** Hrefs a MANAGER does not get: org-wide reports, the org's master data, settings and the
 * notification log. Everything else in the owner/admin menu is shared, team-scoped on the page. */
const MANAGER_HIDDEN_HREFS: ReadonlySet<string> = new Set([
  '/app/reports',
  '/app/statistik',
  '/app/employees',
  '/app/branches',
  '/app/shifts',
  '/app/log-notifikasi',
  '/app/settings',
]);

/** MANAGER: the 12 team-facing items (Dashboard, Live, Check-in Saya, the five attendance views,
 * Persetujuan, Peringkat, Riwayat Saya, Akun Saya). Derived from the owner/admin list so the two
 * can never drift apart in order or label. */
export const MANAGER_ITEMS: SidebarItem[] = OWNER_ADMIN_ITEMS.filter((item) => !MANAGER_HIDDEN_HREFS.has(item.href));

/** The menu for a role. EMPLOYEE never reaches /app (app/app/layout.tsx sends them to /m); if
 * one ever did, they would get the smallest list rather than the org-wide one. */
export function navItemsForRole(role: UserRole): SidebarItem[] {
  return ORG_WIDE_ROLES.includes(role) ? OWNER_ADMIN_ITEMS : MANAGER_ITEMS;
}

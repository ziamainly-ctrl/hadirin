import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { ToastProvider } from '@/components/ui/Toast';
import Sidebar from '@/components/shared/Sidebar';
import type { SidebarItem } from '@/components/shared/Sidebar';
import { ORG_WIDE_ROLES } from '@/lib/constants/roles';

const OWNER_ADMIN_ITEMS: SidebarItem[] = [
  { href: '/app', label: 'Dashboard', icon: 'LayoutDashboard' },
  { href: '/app/requests', label: 'Persetujuan', icon: 'CalendarCheck' },
  { href: '/app/employees', label: 'Karyawan', icon: 'Users' },
  { href: '/app/branches', label: 'Cabang', icon: 'MapPin' },
  { href: '/app/shifts', label: 'Shift', icon: 'Clock' },
  { href: '/app/attendance', label: 'Absensi', icon: 'ListChecks' },
  { href: '/app/reports', label: 'Laporan', icon: 'FileBarChart' },
  { href: '/app/settings', label: 'Pengaturan', icon: 'Settings' },
];

const MANAGER_ITEMS: SidebarItem[] = [
  { href: '/app', label: 'Dashboard', icon: 'LayoutDashboard' },
  { href: '/app/requests', label: 'Persetujuan', icon: 'CalendarCheck' },
  { href: '/app/attendance', label: 'Absensi', icon: 'ListChecks' },
];

// Server Component: reads the session directly (TRD.md §5), no self-fetch. Uses
// requireSession() (not requireActiveSession()) and redirects explicitly instead of
// throwing, so a stale /app tab sends a must-change-password user to the right place
// instead of an error page (proxy.ts only checked that a session cookie exists at all).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { role, context } = await requireSession();
  if (context.mustChangePassword) redirect('/change-password');

  const items = ORG_WIDE_ROLES.includes(role) ? OWNER_ADMIN_ITEMS : MANAGER_ITEMS;

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-bg">
        <Sidebar items={items} logout={{ url: '/api/auth/logout', redirectTo: '/login' }} />
        <main className="flex-1 overflow-x-hidden p-4 pt-16 lg:p-6 lg:pt-6">{children}</main>
      </div>
    </ToastProvider>
  );
}

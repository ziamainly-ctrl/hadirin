import { requirePlatformSession } from '@/lib/auth';
import { ToastProvider } from '@/components/ui/Toast';
import Sidebar from '@/components/shared/Sidebar';
import type { SidebarItem } from '@/components/shared/Sidebar';
import Logo from '@/components/shared/Logo';

// /platform/login lives outside this (authenticated) group (no Sidebar, no session
// check) specifically so proxy.ts's gate on /platform/* can't redirect it to itself.
// Every page actually under this group gets the real, DB-backed check here.
const ITEMS: SidebarItem[] = [
  { href: '/platform/organizations', label: 'Organisasi', icon: 'Building2' },
  { href: '/platform/plans', label: 'Paket', icon: 'Package' },
  { href: '/platform/payment-methods', label: 'Metode Bayar', icon: 'CreditCard' },
  { href: '/platform/notification-templates', label: 'Template Notifikasi', icon: 'MessageSquare' },
  { href: '/platform/holidays', label: 'Hari Libur Nasional', icon: 'CalendarDays' },
];

export default async function PlatformAuthenticatedLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformSession();

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-bg">
        <Sidebar
          items={ITEMS}
          header={<Logo suffix="Platform" />}
          logout={{ url: '/api/platform/auth/logout', redirectTo: '/platform/login' }}
        />
        <main className="flex-1 overflow-x-hidden p-4 pt-16 lg:p-6 lg:pt-6">{children}</main>
      </div>
    </ToastProvider>
  );
}

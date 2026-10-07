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
      <div className="flex min-h-dvh lg:h-dvh lg:overflow-hidden">
        <Sidebar
          items={ITEMS}
          header={<Logo suffix="Platform" />}
          logout={{ url: '/api/platform/auth/logout', redirectTo: '/platform/login' }}
        />
        {/* pt-18 clears Sidebar's fixed 56px mobile top bar plus the usual 16px gutter.
            min-w-0 lets a wide table scroll inside its own card instead of widening the page; the
            inner max-w (same as app/app/layout.tsx) stops tables stretching edge to edge on a
            2000px+ monitor. On desktop the shell is one viewport tall and every page is a
            components/shared/Page (fixed header, body that scrolls itself); the wrapper's
            overflow-y-auto below is only the safety net for anything taller. Its lg:p-1 (taken out
            of main's padding, so the gutter is still 24px) is room for Page.Body's 4px bleed and the
            3px focus ring of a control that sits flush with the page edge: overflow-y-auto also
            clips on x. */}
        <main className="min-w-0 flex-1 overflow-x-hidden p-4 pt-18 lg:h-dvh lg:p-5">
          <div className="mx-auto w-full max-w-[1600px] lg:h-full lg:overflow-y-auto lg:p-1">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}

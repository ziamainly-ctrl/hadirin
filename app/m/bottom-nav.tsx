'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, History, ClipboardList, User } from 'lucide-react';

// TRD.md §14: "single-column with a bottom tab bar (Hari ini, Riwayat, Pengajuan, Profil)".
// Specific to /m, so it lives here rather than in components/shared.
const TABS = [
  { href: '/m', label: 'Hari ini', icon: Home },
  { href: '/m/history', label: 'Riwayat', icon: History },
  { href: '/m/requests', label: 'Pengajuan', icon: ClipboardList },
  { href: '/m/profile', label: 'Profil', icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md border-t border-border bg-surface">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium ${
              active ? 'text-primary' : 'text-muted'
            }`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

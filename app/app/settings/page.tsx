import type { Metadata } from 'next';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Building2, CreditCard, Bell, ChevronRight } from 'lucide-react';
import Card from '@/components/ui/Card';
import { requireSession } from '@/lib/auth';

export const metadata: Metadata = { title: 'Pengaturan' };

interface SettingsLink {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

const LINKS: SettingsLink[] = [
  {
    href: '/app/settings/organization',
    title: 'Organisasi',
    description: 'Nama, zona waktu, dan aturan geofence/selfie.',
    icon: Building2,
  },
  {
    // Enforced OWNER-only on the sub-page itself (requireSession(['OWNER'])) —
    // TRD.md §6 marks billing routes OWNER-only. Still linked here for ADMIN too:
    // hiding a card is cosmetic only and never a substitute for that server-side
    // check (AGENTS.md domain rule #2).
    href: '/app/settings/billing',
    title: 'Billing',
    description: 'Riwayat tagihan dan metode pembayaran.',
    icon: CreditCard,
  },
  {
    href: '/app/settings/notifications',
    title: 'Notifikasi',
    description: 'Template notifikasi email dan WhatsApp.',
    icon: Bell,
  },
];

// Server Component hub (TRD.md §5): nothing to load, just role-gated navigation
// into the three settings sub-pages.
export default async function SettingsPage() {
  await requireSession(['OWNER', 'ADMIN']);

  return (
    <div>
      <h1 className="text-xl font-semibold text-text">Pengaturan</h1>
      <p className="mt-1 text-sm text-muted">Kelola organisasi, billing, dan notifikasi.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href} className="block">
              <Card className="h-full transition hover:shadow-sm">
                <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
                <h2 className="mt-3 text-sm font-semibold text-text">{link.title}</h2>
                <p className="mt-1 text-sm text-muted">{link.description}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Kelola
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

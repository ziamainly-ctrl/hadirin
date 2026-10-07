import type { Metadata } from 'next';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Building2, CreditCard, Bell, ChevronRight } from 'lucide-react';
import Card from '@/components/ui/Card';
import Page from '@/components/shared/Page';
import { requireSession } from '@/lib/auth';
import type { UserRole } from '@/lib/constants/roles';

export const metadata: Metadata = { title: 'Pengaturan' };

interface SettingsLink {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  roles: UserRole[];
}

const LINKS: SettingsLink[] = [
  {
    href: '/app/settings/organization',
    title: 'Organisasi',
    description: 'Nama, zona waktu, aturan lokasi, dan selfie saat absen.',
    icon: Building2,
    roles: ['OWNER', 'ADMIN'],
  },
  {
    // The sub-page enforces OWNER-only itself (requireSession(['OWNER']), TRD.md §6).
    // Hiding the card from ADMIN is cosmetic — it only spares them a link that can
    // never open — and never a substitute for that check (AGENTS.md domain rule #2).
    href: '/app/settings/billing',
    title: 'Tagihan',
    description: 'Riwayat tagihan dan pembayaran paket langganan.',
    icon: CreditCard,
    roles: ['OWNER'],
  },
  {
    href: '/app/settings/notifications',
    title: 'Notifikasi',
    description: 'Isi pesan email dan WhatsApp yang dikirim ke tim Anda.',
    icon: Bell,
    roles: ['OWNER', 'ADMIN'],
  },
];

// Server Component hub (TRD.md §5): nothing to load, just role-gated navigation
// into the settings sub-pages.
export default async function SettingsPage() {
  const { role } = await requireSession(['OWNER', 'ADMIN']);
  const links = LINKS.filter((link) => link.roles.includes(role));

  return (
    <Page>
      <Page.Header title="Pengaturan" description="Kelola organisasi, tagihan, dan notifikasi." />

      <Page.Body>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group block rounded-card focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <Card className="flex h-full flex-col transition-colors group-hover:bg-accent/50">
                  <span className="flex h-10 w-10 items-center justify-center rounded-input bg-accent text-text">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 className="mt-3 text-sm font-semibold text-text">{link.title}</h2>
                  <p className="mt-1 flex-1 text-sm text-muted">{link.description}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-text">
                    Kelola
                    <ChevronRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </Card>
              </Link>
            );
          })}
        </div>
      </Page.Body>
    </Page>
  );
}

import type { Metadata } from 'next';
import { Building2 } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import type { BadgeTone } from '@/components/ui/Badge';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/shared/EmptyState';
import Page from '@/components/shared/Page';
import { listOrganizationsForPlatform } from '@/lib/queries/organizations';
import type { PlatformOrganizationRow } from '@/lib/queries/organizations';
import type { OrgStatus } from '@/lib/constants/statuses';

export const metadata: Metadata = { title: 'Organisasi' };

const STATUS_LABELS: Record<OrgStatus, string> = {
  TRIAL: 'Percobaan',
  ACTIVE: 'Aktif',
  PAST_DUE: 'Jatuh Tempo',
  SUSPENDED: 'Ditangguhkan',
};

// Neutral chip + a small colored dot (Badge tone): the owner wants no tinted panels.
const STATUS_BADGE_TONES: Record<OrgStatus, BadgeTone> = {
  TRIAL: 'info',
  ACTIVE: 'success',
  PAST_DUE: 'warning',
  SUSPENDED: 'danger',
};

// Pure calendar display for a TIMESTAMPTZ column — day-level precision is enough here,
// and this list spans orgs in different timezones, so no single org timezone applies.
const DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

// Date only: the Status badge right next to it already says "Percobaan", so repeating
// "Percobaan s/d" here made the widest column in the table say the same thing twice.
function formatExpiry(org: PlatformOrganizationRow): string {
  const date = org.status === 'TRIAL' ? org.trialEndsAt : org.planExpiresAt;
  return date ? DATE_FORMATTER.format(new Date(date)) : '—';
}

/**
 * Server Component: calls listOrganizationsForPlatform() directly (TRD.md §5) — the same
 * call GET /api/platform/organizations makes. Platform data has no org scoping to apply
 * here, and the layout above this page already gates the whole /platform/(authenticated)
 * group with requirePlatformSession(), so this page makes no auth call of its own.
 * Read-only per PRD.md P1 ("Organizations list: plan, status, seats used") — no edit
 * action on this page.
 */
export default async function OrganizationsPage() {
  const organizations = await listOrganizationsForPlatform();

  return (
    <Page>
      <Page.Header title="Organisasi" description="Daftar seluruh organisasi yang terdaftar di Hadirin." />

      <Page.Body>
        {organizations.length === 0 ? (
          <EmptyState icon={Building2} message="Belum ada organisasi yang terdaftar." />
        ) : (
          <Table aria-label="Daftar organisasi">
            <Table.Head>
              <Table.Row>
                <Table.HeadCell>Organisasi</Table.HeadCell>
                <Table.HeadCell>Paket</Table.HeadCell>
                <Table.HeadCell>Status</Table.HeadCell>
                <Table.HeadCell priority={1} className="text-right">Kursi Terpakai</Table.HeadCell>
                <Table.HeadCell priority={2}>Berlaku Sampai</Table.HeadCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {organizations.map((org) => (
                <Table.Row key={org.id}>
                  {/* Slug as a muted second line under the name rather than its own column:
                      one column fewer lets the whole table fit a 768px tablet without the
                      last column scrolling out of view (NN/g "Mobile Tables": cut columns,
                      stack secondary data under the primary one). */}
                  <Table.Cell>
                    <span className="block font-medium text-text">{org.name}</span>
                    <span className="mt-0.5 block text-xs text-muted">{org.slug}</span>
                  </Table.Cell>
                  <Table.Cell>{org.planName}</Table.Cell>
                  <Table.Cell>
                    <Badge tone={STATUS_BADGE_TONES[org.status]}>{STATUS_LABELS[org.status]}</Badge>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    {org.seatsUsed} / {org.maxEmployees}
                  </Table.Cell>
                  <Table.Cell className="text-muted">{formatExpiry(org)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Page.Body>
    </Page>
  );
}

import { Building2 } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/shared/EmptyState';
import { listOrganizationsForPlatform } from '@/lib/queries/organizations';
import type { PlatformOrganizationRow } from '@/lib/queries/organizations';
import type { OrgStatus } from '@/lib/constants/statuses';

const STATUS_LABELS: Record<OrgStatus, string> = {
  TRIAL: 'Percobaan',
  ACTIVE: 'Aktif',
  PAST_DUE: 'Jatuh Tempo',
  SUSPENDED: 'Ditangguhkan',
};

const STATUS_BADGE_CLASSES: Record<OrgStatus, string> = {
  TRIAL: 'bg-sky-100 text-sky-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  PAST_DUE: 'bg-amber-100 text-amber-700',
  SUSPENDED: 'bg-red-100 text-red-700',
};

// Pure calendar display for a TIMESTAMPTZ column — day-level precision is enough here,
// and this list spans orgs in different timezones, so no single org timezone applies.
const DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

function formatExpiry(org: PlatformOrganizationRow): string {
  if (org.status === 'TRIAL') {
    return org.trialEndsAt ? `Percobaan s/d ${DATE_FORMATTER.format(new Date(org.trialEndsAt))}` : '—';
  }
  return org.planExpiresAt ? DATE_FORMATTER.format(new Date(org.planExpiresAt)) : '—';
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
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-text">Organisasi</h1>
        <p className="text-sm text-muted">Daftar seluruh organisasi yang terdaftar di Hadirin.</p>
      </div>

      {organizations.length === 0 ? (
        <EmptyState icon={Building2} message="Belum ada organisasi yang terdaftar." />
      ) : (
        <Table>
          <Table.Head>
            <Table.Row>
              <Table.HeadCell>Nama</Table.HeadCell>
              <Table.HeadCell>Slug</Table.HeadCell>
              <Table.HeadCell>Paket</Table.HeadCell>
              <Table.HeadCell>Status</Table.HeadCell>
              <Table.HeadCell>Kursi Terpakai</Table.HeadCell>
              <Table.HeadCell>Berakhir</Table.HeadCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {organizations.map((org) => (
              <Table.Row key={org.id}>
                <Table.Cell className="font-medium text-text">{org.name}</Table.Cell>
                <Table.Cell className="text-muted">{org.slug}</Table.Cell>
                <Table.Cell>{org.planName}</Table.Cell>
                <Table.Cell>
                  <Badge className={STATUS_BADGE_CLASSES[org.status]}>{STATUS_LABELS[org.status]}</Badge>
                </Table.Cell>
                <Table.Cell>
                  {org.seatsUsed} / {org.maxEmployees}
                </Table.Cell>
                <Table.Cell className="text-muted">{formatExpiry(org)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </div>
  );
}

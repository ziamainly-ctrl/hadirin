import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth';
import { getUserByIdInOrg } from '@/lib/queries/users';
import { getBranchByIdInOrg } from '@/lib/queries/branches';
import { getShiftByIdInOrg } from '@/lib/queries/shifts';
import type { UserRole } from '@/lib/constants/roles';
import Card from '@/components/ui/Card';
import Page from '@/components/shared/Page';
import LogoutButton from './logout-button';

export const metadata: Metadata = { title: 'Profil' };

const ROLE_LABELS: Record<UserRole, string> = {
  OWNER: 'Pemilik',
  ADMIN: 'Admin',
  MANAGER: 'Manajer',
  EMPLOYEE: 'Karyawan',
};

/** "Dewi Lestari" → "DL"; one name → its first letter. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 first:pt-0 last:border-0 last:pb-0 [@media(min-width:1024px)_and_(max-height:860px)]:py-2 [@media(min-width:1024px)_and_(max-height:860px)]:first:pt-0 [@media(min-width:1024px)_and_(max-height:860px)]:last:pb-0">
      <dt className="shrink-0 text-sm text-muted">{label}</dt>
      {/* break-words: a long email must wrap inside the card, never push it past 360px. */}
      <dd className="min-w-0 break-words text-right text-sm font-medium text-text">{value}</dd>
    </div>
  );
}

// Server Component: reads the session directly and calls lib/queries directly
// (TRD.md §5) — getBranchByIdInOrg/getShiftByIdInOrg only when the user has one set
// (users.shift_id IS NULL means untracked, AGENTS.md domain rule #9).
export default async function ProfilePage() {
  const { orgId, userId } = await requireSession();
  const user = await getUserByIdInOrg(orgId, userId);
  const [branch, shift] = await Promise.all([
    user.branchId ? getBranchByIdInOrg(orgId, user.branchId) : null,
    user.shiftId ? getShiftByIdInOrg(orgId, user.shiftId) : null,
  ]);

  return (
    <Page>
      <Page.Header title="Profil" />

      <Page.Body>
        <Card className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary text-base font-semibold text-secondary-fg"
          >
            {initials(user.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-text">{user.name}</p>
            <p className="truncate text-sm text-muted">
              {[user.position, ROLE_LABELS[user.role]].filter(Boolean).join(' · ')}
            </p>
          </div>
        </Card>

        <section aria-labelledby="profile-data-heading" className="flex flex-col gap-2">
          <h2 id="profile-data-heading" className="text-sm font-semibold text-text">
            Data karyawan
          </h2>
          <Card>
            <dl>
              <ProfileRow label="Email" value={user.email ?? '—'} />
              <ProfileRow label="Telepon" value={user.phone ?? '—'} />
              <ProfileRow label="Kode Karyawan" value={user.employeeCode ?? '—'} />
              <ProfileRow label="Cabang" value={branch?.name ?? '—'} />
              <ProfileRow label="Shift" value={shift?.name ?? '—'} />
            </dl>
          </Card>
          <p className="text-sm text-muted">Data salah? Hubungi admin perusahaan Anda untuk memperbaikinya.</p>
        </section>

        <LogoutButton />
      </Page.Body>
    </Page>
  );
}

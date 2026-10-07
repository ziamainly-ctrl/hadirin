import { requireSession } from '@/lib/auth';
import { getUserByIdInOrg } from '@/lib/queries/users';
import { getBranchByIdInOrg } from '@/lib/queries/branches';
import { getShiftByIdInOrg } from '@/lib/queries/shifts';
import type { UserRole } from '@/lib/constants/roles';
import Card from '@/components/ui/Card';
import LogoutButton from './logout-button';

const ROLE_LABELS: Record<UserRole, string> = {
  OWNER: 'Pemilik',
  ADMIN: 'Admin',
  MANAGER: 'Manajer',
  EMPLOYEE: 'Karyawan',
};

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-black/5 py-2.5 last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-right text-sm font-medium text-text">{value}</span>
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
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text">Profil</h1>

      <Card>
        <ProfileRow label="Nama" value={user.name} />
        <ProfileRow label="Email" value={user.email ?? '—'} />
        <ProfileRow label="Telepon" value={user.phone ?? '—'} />
        <ProfileRow label="Peran" value={ROLE_LABELS[user.role]} />
        <ProfileRow label="Kode Karyawan" value={user.employeeCode ?? '—'} />
        <ProfileRow label="Posisi" value={user.position ?? '—'} />
        <ProfileRow label="Cabang" value={branch?.name ?? '—'} />
        <ProfileRow label="Shift" value={shift?.name ?? '—'} />
      </Card>

      <LogoutButton />
    </div>
  );
}

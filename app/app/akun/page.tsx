import type { Metadata } from 'next';
import { ExternalLink } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { ORG_WIDE_ROLES } from '@/lib/constants/roles';
import { getUserByIdInOrg } from '@/lib/queries/users';
import { getBranchByIdInOrg } from '@/lib/queries/branches';
import { getShiftByIdInOrg } from '@/lib/queries/shifts';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { calendarDateToUtc, formatScheduleTime } from '@/app/m/format';
import { toCalendarDate } from '@/app/app/attendance/format';
import { RoleBadge } from '@/app/app/employees/user-status-badge';
import LogoutButton from '@/app/m/profile/logout-button';
import Card from '@/components/ui/Card';
import ButtonLink from '@/components/ui/ButtonLink';
import Page from '@/components/shared/Page';
import ThemeToggle from '@/components/shared/ThemeToggle';
import ChangePasswordForm from '@/components/shared/ChangePasswordForm';
import { initials } from '@/lib/initials';

export const metadata: Metadata = { title: 'Akun Saya' };

const JOINED_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2 first:pt-0 last:border-0 last:pb-0">
      <dt className="shrink-0 text-sm text-muted">{label}</dt>
      {/* break-words: a long email must wrap inside the card, never push it past 360px. */}
      <dd className="min-w-0 break-words text-right text-sm font-medium text-text">{value}</dd>
    </div>
  );
}

function PreferenceRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2 first:pt-0 last:border-0 last:pb-0 lg:flex-1 lg:border-0 lg:py-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text">{label}</p>
        {hint ? <p className="fit-hide-short text-xs text-muted">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

/**
 * "Akun Saya": who I am, change my password, theme, help, sign out. Server Component reading the
 * session and lib/queries directly (TRD.md §5); the profile is READ-ONLY here (an owner or admin
 * edits people on /app/employees, anyone else asks their admin), which is also why this page can
 * never be used to change a role, shift or branch. The user comes from the session only
 * (AGENTS.md domain rules #1 and #3). password_hash is not part of the user query (rule #8).
 * An org that is SUSPENDED can still open this page: it needs no check-in.
 */
export default async function AkunPage() {
  const { orgId, userId, role } = await requireSession(['OWNER', 'ADMIN', 'MANAGER']);
  const user = await getUserByIdInOrg(orgId, userId);
  const [org, branch, shift] = await Promise.all([
    getOrganizationPlanContext(orgId),
    user.branchId ? getBranchByIdInOrg(orgId, user.branchId) : null,
    user.shiftId ? getShiftByIdInOrg(orgId, user.shiftId) : null,
  ]);
  const canEditProfile = ORG_WIDE_ROLES.includes(role);

  return (
    <Page>
      <Page.Header title="Akun Saya" description="Profil, keamanan, dan preferensi akun Anda." />

      <Page.Body>
        {/* Desktop (zero scroll): profile | password side by side, and the preferences as one
            slim row under both. Below lg it is the original single column in the original order
            (profile, preferences, password): `order` only reorders on desktop. */}
        <div className="grid gap-4 fit-gap lg:grid-cols-2 lg:items-start">
          <Card className="fit-pad">
            <div className="mb-4 flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary text-base font-semibold text-secondary-fg"
              >
                {initials(user.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-text">{user.name}</p>
                <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
                  {user.position ? <span className="truncate">{user.position}</span> : null}
                  <RoleBadge role={user.role} />
                </p>
              </div>
            </div>
            <dl className="fit-rows">
              <ProfileRow label="Email" value={user.email ?? '—'} />
              <ProfileRow label="Telepon" value={user.phone ?? '—'} />
              <ProfileRow label="Kode Karyawan" value={user.employeeCode ?? '—'} />
              <ProfileRow label="Organisasi" value={org?.name ?? '—'} />
              <ProfileRow label="Cabang" value={branch?.name ?? '—'} />
              <ProfileRow
                label="Shift"
                value={shift ? `${shift.name} · ${formatScheduleTime(shift.timeIn)}–${formatScheduleTime(shift.timeOut)}` : 'Belum dijadwalkan'}
              />
              <ProfileRow
                label="Bergabung"
                value={user.joinedAt ? JOINED_FORMATTER.format(calendarDateToUtc(toCalendarDate(user.joinedAt))) : '—'}
              />
            </dl>
            <div className="mt-4 border-t border-border pt-3">
              {canEditProfile ? (
                <ButtonLink href={`/app/employees/${user.id}`} variant="outline" size="sm">
                  Ubah di Karyawan
                </ButtonLink>
              ) : (
                <p className="text-sm text-muted">Data salah? Hubungi admin perusahaan Anda untuk memperbaikinya.</p>
              )}
            </div>
          </Card>

          <Card className="fit-pad order-3 lg:order-2">
            <h2 className="mb-1 text-sm font-semibold text-text">Ubah kata sandi</h2>
            <p className="fit-hide-short mb-4 text-sm text-muted">Gunakan kata sandi yang unik dan tidak dipakai di layanan lain.</p>
            <ChangePasswordForm />
          </Card>

          <Card className="fit-pad order-2 lg:order-3 lg:col-span-2">
            <div className="lg:flex lg:items-center lg:gap-8">
              <h2 className="mb-3 text-sm font-semibold text-text lg:mb-0 lg:shrink-0">Preferensi</h2>
              <div className="lg:flex lg:flex-1 lg:items-center lg:gap-8">
                <PreferenceRow label="Tema" hint="Terang atau gelap">
                  <ThemeToggle />
                </PreferenceRow>
                <PreferenceRow label="Bantuan" hint="Panduan memakai Hadirin">
                  <ButtonLink href="/bantuan" target="_blank" rel="noopener noreferrer" variant="outline" size="sm">
                    Buka
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </ButtonLink>
                </PreferenceRow>
              </div>
              <div className="mt-4 lg:mt-0 lg:w-44 lg:shrink-0">
                <LogoutButton />
              </div>
            </div>
          </Card>
        </div>
      </Page.Body>
    </Page>
  );
}

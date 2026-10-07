import type { Metadata } from 'next';
import { MapPin } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { ORG_WIDE_ROLES } from '@/lib/constants/roles';
import { listBranches } from '@/lib/queries/branches';
import type { BranchSummary } from '@/lib/queries/branches';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/shared/EmptyState';
import Page from '@/components/shared/Page';
import BranchFormDialog from './branch-form-dialog';
import DeleteBranchButton from './delete-branch-button';

export const metadata: Metadata = { title: 'Cabang' };

// Aktif/Nonaktif is the shared Badge (neutral chip + a colored dot, no tinted fill: product-owner
// rule); the word stays the primary cue so the dot is never the only signal.
function ActiveBadge({ isActive }: { isActive: boolean }) {
  return <Badge tone={isActive ? 'success' : 'neutral'}>{isActive ? 'Aktif' : 'Nonaktif'}</Badge>;
}

const RADIUS_FORMATTER = new Intl.NumberFormat('id-ID');

function formatRadius(branch: BranchSummary): string {
  return `${RADIUS_FORMATTER.format(branch.radiusM)} m`;
}

/**
 * Server Component: reads orgId from the session and calls
 * lib/queries/branches directly (TRD.md §5) — no self-fetch over
 * /api/branches. Reading the list is open to any active role (TRD.md §6:
 * "read: all; write: OWNER, ADMIN"), so this calls requireSession() with no
 * role filter; the write controls are only rendered for OWNER/ADMIN (cosmetic —
 * the API routes enforce it server-side). Same shape as app/app/shifts/page.tsx.
 */
export default async function BranchesPage() {
  const { orgId, role } = await requireSession();
  const canEdit = ORG_WIDE_ROLES.includes(role);
  const branches = await listBranches(orgId);

  return (
    <Page>
      <Page.Header
        title="Cabang"
        description="Kelola lokasi dan radius absensi GPS tiap cabang."
        actions={canEdit ? <BranchFormDialog /> : null}
      />

      <Page.Body>
        {branches.length === 0 ? (
          <EmptyState
            icon={MapPin}
            className="lg:flex-1 lg:justify-center"
            message="Belum ada cabang. Tambahkan cabang agar karyawan bisa absen di lokasinya."
          />
        ) : (
          <>
            {/* Phones and small tablets: a card per branch, with the actions in reach
                instead of scrolled off the right edge of a table. */}
            <ul className="flex flex-col gap-2 md:hidden">
              {branches.map((branch) => (
                <li key={branch.id} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 break-words font-medium text-text">{branch.name}</span>
                      <ActiveBadge isActive={branch.isActive} />
                    </div>
                    {branch.address ? <p className="break-words text-sm text-muted">{branch.address}</p> : null}
                    <p className="text-sm text-muted">
                      Radius absen <span className="tabular-nums text-text">{formatRadius(branch)}</span>
                    </p>
                  </div>
                  {canEdit ? (
                    <div className="flex gap-2 border-t border-border pt-3">
                      <BranchFormDialog branch={branch} size="md" />
                      <DeleteBranchButton branchId={branch.id} branchName={branch.name} size="md" />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>

            <div className="hidden md:contents">
              <Table aria-label="Daftar cabang">
                <Table.Head>
                  <Table.Row>
                    <Table.HeadCell>Cabang</Table.HeadCell>
                    <Table.HeadCell className="text-right">Radius</Table.HeadCell>
                    <Table.HeadCell>Status</Table.HeadCell>
                    {canEdit ? <Table.HeadCell className="text-right">Aksi</Table.HeadCell> : null}
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {branches.map((branch) => (
                    <Table.Row key={branch.id}>
                      {/* Address sits under the name instead of in its own column: as a
                          separate wrapping column it still needed ~220px, which pushed the
                          Edit/Hapus actions off the right edge on tablets. */}
                      <Table.Cell wrap className="min-w-48">
                        <span className="block font-medium text-text">{branch.name}</span>
                        {branch.address ? <span className="mt-0.5 block text-muted">{branch.address}</span> : null}
                      </Table.Cell>
                      <Table.Cell className="text-right">{formatRadius(branch)}</Table.Cell>
                      <Table.Cell>
                        <ActiveBadge isActive={branch.isActive} />
                      </Table.Cell>
                      {canEdit ? (
                        <Table.Cell className="text-right">
                          <div className="flex justify-end gap-1">
                            <BranchFormDialog branch={branch} />
                            <DeleteBranchButton branchId={branch.id} branchName={branch.name} />
                          </div>
                        </Table.Cell>
                      ) : null}
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          </>
        )}
      </Page.Body>
    </Page>
  );
}

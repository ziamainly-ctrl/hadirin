import { MapPin } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { listBranches } from '@/lib/queries/branches';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/shared/EmptyState';
import BranchFormDialog from './branch-form-dialog';
import DeleteBranchButton from './delete-branch-button';

/**
 * Server Component: reads orgId from the session and calls
 * lib/queries/branches directly (TRD.md §5) — no self-fetch over
 * /api/branches. Reading the list is open to any active role (TRD.md §6:
 * "read: all; write: OWNER, ADMIN"), so this calls requireSession() with no
 * role filter; the write controls below only work through the API routes,
 * which enforce OWNER/ADMIN server-side. Same shape as
 * app/app/shifts/page.tsx.
 */
export default async function BranchesPage() {
  const { orgId } = await requireSession();
  const branches = await listBranches(orgId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text">Cabang</h1>
          <p className="text-sm text-muted">Kelola lokasi dan radius absensi GPS tiap cabang.</p>
        </div>
        <BranchFormDialog />
      </div>

      {branches.length === 0 ? (
        <EmptyState icon={MapPin} message="Belum ada cabang." />
      ) : (
        <Table>
          <Table.Head>
            <Table.Row>
              <Table.HeadCell>Nama</Table.HeadCell>
              <Table.HeadCell>Alamat</Table.HeadCell>
              <Table.HeadCell>Radius</Table.HeadCell>
              <Table.HeadCell>Status</Table.HeadCell>
              <Table.HeadCell className="text-right">Aksi</Table.HeadCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {branches.map((branch) => (
              <Table.Row key={branch.id}>
                <Table.Cell className="font-medium text-text">{branch.name}</Table.Cell>
                <Table.Cell className="text-muted">{branch.address ?? '—'}</Table.Cell>
                <Table.Cell className="text-muted">{branch.radiusM} m</Table.Cell>
                <Table.Cell>
                  <Badge className={branch.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-black/5 text-muted'}>
                    {branch.isActive ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </Table.Cell>
                <Table.Cell className="text-right">
                  <div className="flex justify-end gap-2">
                    <BranchFormDialog branch={branch} />
                    <DeleteBranchButton branchId={branch.id} branchName={branch.name} />
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </div>
  );
}

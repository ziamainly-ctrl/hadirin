'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { USER_ROLES } from '@/lib/constants/roles';
import type { UserRole } from '@/lib/constants/roles';
import type { UserSummary } from '@/lib/queries/users';
import { ROLE_LABELS } from './employee-labels';
import TemporaryPasswordNotice from './temporary-password-notice';

export interface EmployeeFormBranchOption {
  id: number;
  name: string;
  isActive: boolean;
}

export interface EmployeeFormShiftOption {
  id: number;
  name: string;
  isActive: boolean;
}

export interface EmployeeFormDialogProps {
  branches: EmployeeFormBranchOption[];
  shifts: EmployeeFormShiftOption[];
  /** Present → PATCHes /api/users/[id] (edit). Absent → POSTs /api/users (create). */
  existingUser?: UserSummary;
  /** The signed-in role. An ADMIN may assign MANAGER or EMPLOYEE only (lib/user-guards.ts), so the other roles
   * are not offered; the server refuses them anyway. */
  actorRole?: UserRole;
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = USER_ROLES.map((value) => ({ value, label: ROLE_LABELS[value] }));

interface FormState {
  name: string;
  role: UserRole;
  email: string;
  phone: string;
  branchId: string;
  shiftId: string;
  employeeCode: string;
  position: string;
  joinedAt: string;
}

function toFormState(existingUser?: UserSummary): FormState {
  return {
    name: existingUser?.name ?? '',
    role: existingUser?.role ?? 'EMPLOYEE',
    email: existingUser?.email ?? '',
    phone: existingUser?.phone ?? '',
    branchId: existingUser?.branchId != null ? String(existingUser.branchId) : '',
    shiftId: existingUser?.shiftId != null ? String(existingUser.shiftId) : '',
    employeeCode: existingUser?.employeeCode ?? '',
    position: existingUser?.position ?? '',
    joinedAt: existingUser?.joinedAt ?? '',
  };
}

function roleOptionsFor(actorRole: UserRole | undefined, current: UserRole | undefined) {
  if (actorRole !== 'ADMIN') return ROLE_OPTIONS;
  return ROLE_OPTIONS.filter((option) => option.value === 'MANAGER' || option.value === 'EMPLOYEE' || option.value === current);
}

/** '' from a blank text input should persist as NULL, not an empty string. */
function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Self-contained trigger + modal: renders its own "Tambah Karyawan" / "Edit" Button
 * (there is no separate trigger component in this feature) and the Dialog it opens.
 * TRD.md §6 / §14: fields mirror createUserSchema/updateUserSchema (lib/validators/users.ts).
 */
export default function EmployeeFormDialog({ branches, shifts, existingUser, actorRole }: EmployeeFormDialogProps) {
  const isEdit = Boolean(existingUser);
  const router = useRouter();
  const { show } = useToast();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => toFormState(existingUser));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // TRD.md §6: POST returns a one-time temporaryPassword. Non-null here means the
  // create succeeded and we're showing it — see the guarded onClose below.
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  function openDialog() {
    setForm(toFormState(existingUser));
    setFieldErrors({});
    setTemporaryPassword(null);
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    setTemporaryPassword(null);
    setFieldErrors({});
  }

  function handleAcknowledgeTemporaryPassword() {
    closeDialog();
    router.refresh();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        role: form.role,
        email: blankToNull(form.email),
        phone: blankToNull(form.phone),
        branchId: form.branchId ? Number(form.branchId) : null,
        shiftId: form.shiftId ? Number(form.shiftId) : null,
        employeeCode: blankToNull(form.employeeCode),
        position: blankToNull(form.position),
        joinedAt: form.joinedAt ? form.joinedAt : null,
      };

      const res = existingUser
        ? await fetch(`/api/users/${existingUser.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      const json = await res.json();

      if (!res.ok) {
        if (json.error?.fields) setFieldErrors(json.error.fields);
        // The server's SEAT_LIMIT_REACHED text is English ("This plan allows up to N employees."),
        // which does not belong in an Indonesian toast.
        show(
          json.error?.code === 'SEAT_LIMIT_REACHED'
            ? 'Jumlah karyawan sudah mencapai batas paket Anda. Naikkan paket untuk menambah karyawan lagi.'
            : (json.error?.message ?? 'Gagal menyimpan data karyawan.'),
          'error',
        );
        return;
      }

      if (existingUser) {
        show('Data karyawan berhasil diperbarui.', 'success');
        closeDialog();
        router.refresh();
      } else {
        setTemporaryPassword(json.data.temporaryPassword as string);
        show('Karyawan berhasil ditambahkan.', 'success');
      }
    } catch {
      show('Tidak bisa terhubung ke server. Coba lagi.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Button type="button" variant={isEdit ? 'secondary' : 'primary'} onClick={openDialog}>
        {isEdit ? <Pencil className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
        {isEdit ? 'Edit' : 'Tambah Karyawan'}
      </Button>

      <Dialog
        open={open}
        // While the one-time password banner is showing, Escape / backdrop / the X
        // button must not be able to dismiss it — only the explicit "Selesai" button
        // (handleAcknowledgeTemporaryPassword) may close the dialog at that point.
        onClose={temporaryPassword ? handleAcknowledgeTemporaryPassword : closeDialog}
        dismissible={!temporaryPassword}
        title={temporaryPassword ? 'Karyawan Ditambahkan' : isEdit ? 'Edit Karyawan' : 'Tambah Karyawan'}
        size="lg"
      >
        {temporaryPassword ? (
          <>
            <Dialog.Body>
              <TemporaryPasswordNotice password={temporaryPassword} employeeName={form.name.trim()} />
            </Dialog.Body>
            <Dialog.Footer>
              <Button type="button" onClick={handleAcknowledgeTemporaryPassword}>
                Selesai
              </Button>
            </Dialog.Footer>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <Dialog.Body className="flex flex-col gap-3">
              <Input
                label="Nama"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                error={fieldErrors.name}
                maxLength={100}
                required
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Peran"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                  options={roleOptionsFor(actorRole, existingUser?.role)}
                  disabled={actorRole === 'ADMIN' && existingUser?.role === 'OWNER'}
                  error={fieldErrors.role}
                />
                <Select
                  label="Cabang"
                  value={form.branchId}
                  onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
                  error={fieldErrors.branchId}
                >
                  <option value="">Tanpa Cabang</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={String(branch.id)}>
                      {branch.name}
                      {branch.isActive ? '' : ' (Nonaktif)'}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  error={fieldErrors.email}
                  maxLength={150}
                />
                <Input
                  label="Telepon"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  error={fieldErrors.phone}
                  maxLength={20}
                />
                {/* One line under both fields instead of a hint wrapped into the narrow
                    Email column: it is a rule about the pair, and it saves a row of height
                    in the dialog on short laptop screens. */}
                {!isEdit ? (
                  <p className="-mt-1 text-sm text-muted sm:col-span-2">
                    Isi email atau telepon (minimal salah satu) untuk masuk.
                  </p>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Shift"
                  value={form.shiftId}
                  onChange={(e) => setForm((f) => ({ ...f, shiftId: e.target.value }))}
                  error={fieldErrors.shiftId}
                  // Only while "Tanpa Shift" is picked: under a real shift the sentence contradicted
                  // the field it sat beneath.
                  hint={form.shiftId === '' ? 'Tanpa shift, karyawan tidak perlu absen.' : undefined}
                >
                  <option value="">Tanpa Shift</option>
                  {shifts.map((shift) => (
                    <option key={shift.id} value={String(shift.id)}>
                      {shift.name}
                      {shift.isActive ? '' : ' (Nonaktif)'}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Kode Karyawan"
                  value={form.employeeCode}
                  onChange={(e) => setForm((f) => ({ ...f, employeeCode: e.target.value }))}
                  error={fieldErrors.employeeCode}
                  maxLength={30}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Posisi"
                  value={form.position}
                  onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                  error={fieldErrors.position}
                  maxLength={80}
                />
                <Input
                  label="Tanggal Bergabung"
                  type="date"
                  value={form.joinedAt}
                  onChange={(e) => setForm((f) => ({ ...f, joinedAt: e.target.value }))}
                  error={fieldErrors.joinedAt}
                />
              </div>
            </Dialog.Body>
            <Dialog.Footer>
              <Button type="button" variant="ghost" onClick={closeDialog}>
                Batal
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                {isEdit ? 'Simpan' : 'Tambah Karyawan'}
              </Button>
            </Dialog.Footer>
          </form>
        )}
      </Dialog>
    </>
  );
}

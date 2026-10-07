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
import type { UserRole } from '@/lib/constants/roles';
import type { UserSummary } from '@/lib/queries/users';

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
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'OWNER', label: 'Pemilik' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MANAGER', label: 'Manajer' },
  { value: 'EMPLOYEE', label: 'Karyawan' },
];

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
export default function EmployeeFormDialog({ branches, shifts, existingUser }: EmployeeFormDialogProps) {
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
        show(json.error?.message ?? 'Gagal menyimpan data karyawan.', 'error');
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
      <Button type="button" variant={isEdit ? 'secondary' : 'primary'} onClick={openDialog} className="gap-2">
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
        title={isEdit ? 'Edit Karyawan' : 'Tambah Karyawan'}
        size="lg"
      >
        {temporaryPassword ? (
          <>
            <Dialog.Body>
              <div className="rounded-input border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-300">
                <p className="font-medium">Kata sandi sementara:</p>
                <p className="mt-1 select-all break-all font-mono text-base">{temporaryPassword}</p>
                <p className="mt-2 text-amber-700 dark:text-amber-300">
                  Catat kata sandi ini sekarang. Kata sandi ini tidak akan ditampilkan lagi setelah dialog ini ditutup.
                </p>
              </div>
            </Dialog.Body>
            <Dialog.Footer>
              <Button type="button" onClick={handleAcknowledgeTemporaryPassword}>
                Selesai
              </Button>
            </Dialog.Footer>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <Dialog.Body className="flex flex-col gap-4">
              <Input
                label="Nama"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                error={fieldErrors.name}
                maxLength={100}
                required
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Peran"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                  options={ROLE_OPTIONS}
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
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  error={fieldErrors.email}
                  maxLength={150}
                  hint={!isEdit ? 'Isi email atau nomor telepon.' : undefined}
                />
                <Input
                  label="Telepon"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  error={fieldErrors.phone}
                  maxLength={20}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Shift"
                  value={form.shiftId}
                  onChange={(e) => setForm((f) => ({ ...f, shiftId: e.target.value }))}
                  error={fieldErrors.shiftId}
                  hint="Tanpa shift berarti karyawan ini tidak absen."
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
              <div className="grid gap-4 sm:grid-cols-2">
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
                {isEdit ? 'Simpan' : 'Tambah'}
              </Button>
            </Dialog.Footer>
          </form>
        )}
      </Dialog>
    </>
  );
}

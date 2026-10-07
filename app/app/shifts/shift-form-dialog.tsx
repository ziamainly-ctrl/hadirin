'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import type { ShiftSummary } from '@/lib/queries/shifts';

export interface ShiftFormDialogProps {
  /** Present → PATCHes /api/shifts/[id] (edit). Absent → POSTs /api/shifts (create). */
  shift?: ShiftSummary;
}

interface Weekday {
  iso: number;
  label: string;
}

// ISO weekday, 1=Mon…7=Sun (ERD.md §1.1: "shifts.work_days").
const WEEKDAYS: Weekday[] = [
  { iso: 1, label: 'Senin' },
  { iso: 2, label: 'Selasa' },
  { iso: 3, label: 'Rabu' },
  { iso: 4, label: 'Kamis' },
  { iso: 5, label: 'Jumat' },
  { iso: 6, label: 'Sabtu' },
  { iso: 7, label: 'Minggu' },
];

const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5];
const DEFAULT_TIME_IN = '08:00';
const DEFAULT_TIME_OUT = '17:00';
const DEFAULT_BREAK_MINUTES = '60';
const DEFAULT_LATE_TOLERANCE_MINUTES = '0';

/**
 * shifts.time_in/time_out may come back as "HH:MM:SS" (Postgres TIME) — an
 * <input type="time"> without a seconds-enabled step only ever shows/accepts
 * "HH:MM", so this strips any seconds before the value reaches the input.
 */
function toHHMM(value: string): string {
  return value.slice(0, 5);
}

function parseWorkDays(value: string): Set<number> {
  return new Set(value.split(',').map(Number));
}

function buildWorkDays(days: Set<number>): string {
  return Array.from(days)
    .sort((a, b) => a - b)
    .join(',');
}

interface ShiftFormState {
  name: string;
  timeIn: string;
  timeOut: string;
  breakMinutes: string;
  lateToleranceMinutes: string;
  isCrossDay: boolean;
}

function toFormState(shift?: ShiftSummary): ShiftFormState {
  return {
    name: shift?.name ?? '',
    timeIn: shift ? toHHMM(shift.timeIn) : DEFAULT_TIME_IN,
    timeOut: shift ? toHHMM(shift.timeOut) : DEFAULT_TIME_OUT,
    breakMinutes: shift ? String(shift.breakMinutes) : DEFAULT_BREAK_MINUTES,
    lateToleranceMinutes: shift ? String(shift.lateToleranceMinutes) : DEFAULT_LATE_TOLERANCE_MINUTES,
    isCrossDay: shift?.isCrossDay ?? false,
  };
}

/**
 * Self-contained trigger + modal, same shape as employees/employee-form-dialog.tsx
 * and ../branches/branch-form-dialog.tsx. Fields mirror upsertShiftSchema
 * (lib/validators/shifts.ts) — workDays is built/parsed here from the seven
 * checkboxes below and never shown to the admin as its raw comma string.
 */
export default function ShiftFormDialog({ shift }: ShiftFormDialogProps) {
  const isEdit = Boolean(shift);
  const router = useRouter();
  const { show } = useToast();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ShiftFormState>(() => toFormState(shift));
  const [workDays, setWorkDays] = useState<Set<number>>(
    shift ? parseWorkDays(shift.workDays) : new Set(DEFAULT_WORK_DAYS),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // The validator's regex requires at least one weekday (lib/validators/shifts.ts);
  // checked here so unchecking every box is caught immediately, not only after a
  // failed submit.
  const workDaysError = workDays.size === 0 ? 'Pilih minimal satu hari kerja.' : fieldErrors.workDays;

  function openDialog() {
    setForm(toFormState(shift));
    setWorkDays(shift ? parseWorkDays(shift.workDays) : new Set(DEFAULT_WORK_DAYS));
    setFieldErrors({});
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
  }

  function toggleDay(iso: number) {
    setWorkDays((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (workDaysError) return;
    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const payload = {
        name: form.name,
        timeIn: form.timeIn,
        timeOut: form.timeOut,
        breakMinutes: Number(form.breakMinutes),
        lateToleranceMinutes: Number(form.lateToleranceMinutes),
        workDays: buildWorkDays(workDays),
        isCrossDay: form.isCrossDay,
      };
      const res = isEdit
        ? await fetch(`/api/shifts/${shift?.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      const json = await res.json();

      if (!res.ok) {
        setFieldErrors(json.error?.fields ?? {});
        show(json.error?.message ?? 'Gagal menyimpan data shift.', 'error');
        return;
      }

      show(isEdit ? 'Shift berhasil diperbarui.' : 'Shift berhasil ditambahkan.', 'success');
      closeDialog();
      router.refresh();
    } catch {
      show('Tidak bisa terhubung ke server. Coba lagi.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={isEdit ? 'secondary' : 'primary'}
        size={isEdit ? 'sm' : 'md'}
        onClick={openDialog}
        className="gap-1.5"
      >
        {isEdit ? <Pencil className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
        {isEdit ? 'Edit' : 'Tambah Shift'}
      </Button>

      <Dialog open={open} onClose={closeDialog} title={isEdit ? 'Edit Shift' : 'Tambah Shift'}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Nama Shift"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            error={fieldErrors.name}
            maxLength={60}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Jam Masuk"
              type="time"
              value={form.timeIn}
              onChange={(e) => setForm((f) => ({ ...f, timeIn: e.target.value }))}
              error={fieldErrors.timeIn}
              required
            />
            <Input
              label="Jam Keluar"
              type="time"
              value={form.timeOut}
              onChange={(e) => setForm((f) => ({ ...f, timeOut: e.target.value }))}
              error={fieldErrors.timeOut}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Istirahat (menit)"
              type="number"
              min={0}
              value={form.breakMinutes}
              onChange={(e) => setForm((f) => ({ ...f, breakMinutes: e.target.value }))}
              error={fieldErrors.breakMinutes}
              required
            />
            <Input
              label="Toleransi Terlambat (menit)"
              type="number"
              min={0}
              value={form.lateToleranceMinutes}
              onChange={(e) => setForm((f) => ({ ...f, lateToleranceMinutes: e.target.value }))}
              error={fieldErrors.lateToleranceMinutes}
              required
            />
          </div>

          <fieldset className="flex flex-col gap-1.5 border-0 p-0">
            <legend className="mb-0 p-0 text-sm font-medium text-text">Hari Kerja</legend>
            <div className="flex flex-wrap gap-3">
              {WEEKDAYS.map((day) => (
                <label key={day.iso} className="flex items-center gap-1.5 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={workDays.has(day.iso)}
                    onChange={() => toggleDay(day.iso)}
                    className="h-4 w-4 rounded border-black/20 accent-primary"
                  />
                  {day.label}
                </label>
              ))}
            </div>
            {workDaysError ? <p className="text-sm text-red-600">{workDaysError}</p> : null}
          </fieldset>

          <label className="flex items-start gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={form.isCrossDay}
              onChange={(e) => setForm((f) => ({ ...f, isCrossDay: e.target.checked }))}
              className="mt-0.5 h-4 w-4 rounded border-black/20 accent-primary"
            />
            <span>
              Shift lintas hari
              <span className="block text-xs text-muted">Aktifkan jika jam keluar melewati tengah malam.</span>
            </span>
          </label>

          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closeDialog}>
              Batal
            </Button>
            <Button type="submit" isLoading={isSubmitting} disabled={Boolean(workDaysError)}>
              {isEdit ? 'Simpan' : 'Tambah'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

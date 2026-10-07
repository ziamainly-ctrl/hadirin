'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Crosshair, Pencil, Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import type { BranchSummary } from '@/lib/queries/branches';

export interface BranchFormDialogProps {
  /** Present → PATCHes /api/branches/[id] (edit). Absent → POSTs /api/branches (create). */
  branch?: BranchSummary;
}

// radius_m's own CHECK constraint (ERD.md §3, drizzle/0001_custom_constraints.sql) —
// mirrored here so the error shows immediately, not only after a failed submit.
const RADIUS_MIN_M = 10;
const RADIUS_MAX_M = 5000;
const DEFAULT_RADIUS_M = 100;

interface BranchFormState {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  radiusM: string;
}

function toFormState(branch?: BranchSummary): BranchFormState {
  return {
    name: branch?.name ?? '',
    address: branch?.address ?? '',
    latitude: branch ? String(branch.latitude) : '',
    longitude: branch ? String(branch.longitude) : '',
    radiusM: branch ? String(branch.radiusM) : String(DEFAULT_RADIUS_M),
  };
}

/**
 * Self-contained trigger + modal, same shape as employees/employee-form-dialog.tsx:
 * renders its own "Tambah Cabang" / "Edit" Button and the Dialog it opens. Fields
 * mirror upsertBranchSchema (lib/validators/branches.ts).
 */
export default function BranchFormDialog({ branch }: BranchFormDialogProps) {
  const isEdit = Boolean(branch);
  const router = useRouter();
  const { show } = useToast();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BranchFormState>(() => toFormState(branch));
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const radiusValue = Number(form.radiusM);
  const radiusRangeError =
    form.radiusM !== '' && Number.isFinite(radiusValue) && (radiusValue < RADIUS_MIN_M || radiusValue > RADIUS_MAX_M)
      ? `Radius harus antara ${RADIUS_MIN_M} dan ${RADIUS_MAX_M} meter.`
      : undefined;
  const radiusError = radiusRangeError ?? fieldErrors.radiusM;

  function openDialog() {
    setForm(toFormState(branch));
    setFieldErrors({});
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
  }

  // PRD.md A4 "use my current location": a one-shot imperative read triggered by this
  // button's click, not the declarative on-mount GeoPermissionGate — that component
  // is built for the employee check-in flow (PRD.md US-01), a different interaction
  // shape (auto-fetch + render-prop status, no click trigger).
  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      show('Geolokasi tidak didukung di perangkat ini.', 'error');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((f) => ({
          ...f,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        show(
          error.code === error.PERMISSION_DENIED
            ? 'Izin lokasi ditolak. Isi koordinat secara manual.'
            : 'Tidak bisa mengambil lokasi. Isi koordinat secara manual.',
          'error',
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (radiusError) return;
    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const payload = {
        name: form.name,
        address: form.address,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        radiusM: Number(form.radiusM),
      };
      const res = isEdit
        ? await fetch(`/api/branches/${branch?.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/branches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      const json = await res.json();

      if (!res.ok) {
        setFieldErrors(json.error?.fields ?? {});
        // SEAT_LIMIT_REACHED's message ("This plan allows up to N branches.") is
        // already specific, not generic, so it surfaces here like any other error
        // instead of being swallowed into the fallback below.
        show(json.error?.message ?? 'Gagal menyimpan data cabang.', 'error');
        return;
      }

      show(isEdit ? 'Cabang berhasil diperbarui.' : 'Cabang berhasil ditambahkan.', 'success');
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
        {isEdit ? 'Edit' : 'Tambah Cabang'}
      </Button>

      <Dialog open={open} onClose={closeDialog} title={isEdit ? 'Edit Cabang' : 'Tambah Cabang'}>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <Dialog.Body className="flex flex-col gap-4">
            <Input
              label="Nama Cabang"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              error={fieldErrors.name}
              maxLength={100}
              required
            />
            <Input
              label="Alamat"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              error={fieldErrors.address}
              maxLength={255}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Latitude"
                type="number"
                step="any"
                min={-90}
                max={90}
                value={form.latitude}
                onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                error={fieldErrors.latitude}
                required
              />
              <Input
                label="Longitude"
                type="number"
                step="any"
                min={-180}
                max={180}
                value={form.longitude}
                onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                error={fieldErrors.longitude}
                required
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleUseMyLocation}
              isLoading={isLocating}
              className="gap-1.5 self-start"
            >
              <Crosshair className="h-4 w-4" aria-hidden="true" />
              Gunakan Lokasi Saya
            </Button>
            <Input
              label="Radius (meter)"
              type="number"
              min={RADIUS_MIN_M}
              max={RADIUS_MAX_M}
              value={form.radiusM}
              onChange={(e) => setForm((f) => ({ ...f, radiusM: e.target.value }))}
              error={radiusError}
              hint={radiusError ? undefined : `Antara ${RADIUS_MIN_M} dan ${RADIUS_MAX_M} meter.`}
              required
            />
          </Dialog.Body>
          <Dialog.Footer>
            <Button type="button" variant="ghost" onClick={closeDialog}>
              Batal
            </Button>
            <Button type="submit" isLoading={isSubmitting} disabled={Boolean(radiusError)}>
              {isEdit ? 'Simpan' : 'Tambah'}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog>
    </>
  );
}

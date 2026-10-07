'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Checkbox from '@/components/ui/Checkbox';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import type { GeofenceMode } from '@/lib/constants/statuses';

export interface OrganizationFormValues {
  name: string;
  timezone: string;
  geofenceMode: GeofenceMode;
  selfieRequired: boolean;
  logoUrl: string | null;
}

export interface OrganizationFormProps {
  initialValues: OrganizationFormValues;
}

const GEOFENCE_OPTIONS: { value: GeofenceMode; label: string }[] = [
  { value: 'STRICT', label: 'Ketat' },
  { value: 'FLAG', label: 'Longgar' },
];

// Explains the selected mode under the field — kept out of the option labels so they
// stay short enough not to be clipped inside a native <select> on a phone.
const GEOFENCE_HINTS: Record<GeofenceMode, string> = {
  STRICT: 'Absen dari luar radius cabang ditolak.',
  FLAG: 'Absen dari luar radius tetap diterima, tetapi ditandai untuk Anda tinjau.',
};

// Indonesia's three zones cover every customer this product targets (PRD: Indonesian
// SMEs). The column still stores the IANA name the server computes work dates with, so
// an org created elsewhere with another zone keeps it as an extra option below.
const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: 'Asia/Jakarta', label: 'WIB (Asia/Jakarta)' },
  { value: 'Asia/Makassar', label: 'WITA (Asia/Makassar)' },
  { value: 'Asia/Jayapura', label: 'WIT (Asia/Jayapura)' },
];

// Client leaf: writes via our own /api/organizations route (TRD.md §5 — a Server
// Component never fetches its own /api/* route, but a client leaf that writes data
// always does), then router.refresh() so the Server Component page re-reads
// getOrganizationPlanContext() with fresh data — there is no client cache to
// invalidate manually.
export default function OrganizationForm({ initialValues }: OrganizationFormProps) {
  const router = useRouter();
  const { show } = useToast();
  const [values, setValues] = useState(initialValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const timezoneOptions = TIMEZONE_OPTIONS.some((option) => option.value === initialValues.timezone)
    ? TIMEZONE_OPTIONS
    : [...TIMEZONE_OPTIONS, { value: initialValues.timezone, label: initialValues.timezone }];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setFieldErrors({});
    try {
      const res = await fetch('/api/organizations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) {
        setFieldErrors(json.error?.fields ?? {});
        show(json.error?.message ?? 'Gagal menyimpan pengaturan organisasi.', 'error');
        return;
      }
      show('Pengaturan organisasi disimpan.', 'success');
      router.refresh();
    } catch {
      show('Tidak bisa terhubung ke server. Coba lagi.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Two columns from sm up so the whole form (and the plan strip under it) fits one short
          laptop screen without scrolling; every hint is one line at this width. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Nama Organisasi"
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          error={fieldErrors.name}
          maxLength={120}
          required
        />
        <Select
          label="Zona Waktu"
          value={values.timezone}
          onChange={(e) => setValues((v) => ({ ...v, timezone: e.target.value }))}
          options={timezoneOptions}
          error={fieldErrors.timezone}
          hint="Dasar tanggal kerja dan jam absen karyawan."
        />
        <Select
          label="Aturan Lokasi Absen"
          value={values.geofenceMode}
          onChange={(e) => setValues((v) => ({ ...v, geofenceMode: e.target.value as GeofenceMode }))}
          options={GEOFENCE_OPTIONS}
          error={fieldErrors.geofenceMode}
          hint={GEOFENCE_HINTS[values.geofenceMode]}
        />
        <Input
          label="URL Logo (opsional)"
          type="url"
          inputMode="url"
          placeholder="https://contoh.com/logo.png"
          value={values.logoUrl ?? ''}
          onChange={(e) => setValues((v) => ({ ...v, logoUrl: e.target.value || null }))}
          error={fieldErrors.logoUrl}
          maxLength={500}
        />
        <Checkbox
          className="sm:col-span-2 pointer-coarse:min-h-11 pointer-coarse:items-center"
          label="Wajibkan selfie saat check-in dan check-out"
          description="Karyawan harus mengambil foto sebelum absennya tersimpan."
          checked={values.selfieRequired}
          onChange={(e) => setValues((v) => ({ ...v, selfieRequired: e.target.checked }))}
        />
      </div>
      <div className="flex border-t border-border pt-4">
        <Button type="submit" isLoading={isSubmitting} className="w-full sm:w-auto">
          Simpan Perubahan
        </Button>
      </div>
    </form>
  );
}

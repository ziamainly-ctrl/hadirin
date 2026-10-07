'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
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
  { value: 'STRICT', label: 'Ketat (tolak di luar radius)' },
  { value: 'FLAG', label: 'Longgar (tandai, tetap diterima)' },
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
      <Input
        label="Nama Organisasi"
        value={values.name}
        onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
        error={fieldErrors.name}
        maxLength={120}
        required
      />
      <Input
        label="Zona Waktu"
        value={values.timezone}
        onChange={(e) => setValues((v) => ({ ...v, timezone: e.target.value }))}
        error={fieldErrors.timezone}
        hint="Contoh: Asia/Jakarta"
        maxLength={40}
        required
      />
      <Select
        label="Mode Geofence"
        value={values.geofenceMode}
        onChange={(e) => setValues((v) => ({ ...v, geofenceMode: e.target.value as GeofenceMode }))}
        options={GEOFENCE_OPTIONS}
        error={fieldErrors.geofenceMode}
      />
      <label className="flex items-center gap-2 text-sm text-text">
        <input
          type="checkbox"
          checked={values.selfieRequired}
          onChange={(e) => setValues((v) => ({ ...v, selfieRequired: e.target.checked }))}
          className="h-4 w-4 rounded border-black/20 dark:border-white/20 accent-primary"
        />
        Wajibkan selfie saat check-in/out
      </label>
      <Input
        label="URL Logo"
        type="url"
        value={values.logoUrl ?? ''}
        onChange={(e) => setValues((v) => ({ ...v, logoUrl: e.target.value || null }))}
        error={fieldErrors.logoUrl}
        hint="Opsional"
        maxLength={500}
      />
      <Button type="submit" isLoading={isSubmitting} className="mt-2 self-start">
        Simpan
      </Button>
    </form>
  );
}

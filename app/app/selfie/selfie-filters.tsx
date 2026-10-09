'use client';

import Select from '@/components/ui/Select';
import { useUrlFilters } from '@/components/shared/useUrlFilters';

/** URL keys of the two selects below, so PeriodFilters' "Hapus Filter" clears them too. */
export const SELFIE_FILTER_KEYS = ['punch', 'flag'] as const;

/**
 * The gallery's own filters, rendered inside PeriodFilters after the branch select: which punch
 * (masuk / keluar) and which flag (terlambat / di luar area). Values live in the URL (`punch`, `flag`)
 * so the Server Component page re-runs; an unknown value falls back to "Semua" on the server.
 */
export default function SelfieFilters() {
  const url = useUrlFilters();
  return (
    <>
      <Select
        label="Jenis Foto"
        value={url.get('punch')}
        onChange={(e) => url.set('punch', e.target.value)}
        className="w-full sm:min-w-36"
      >
        <option value="">Masuk & Keluar</option>
        <option value="in">Check-in saja</option>
        <option value="out">Check-out saja</option>
      </Select>
      <Select
        label="Tampilkan"
        value={url.get('flag')}
        onChange={(e) => url.set('flag', e.target.value)}
        className="w-full sm:min-w-36"
      >
        <option value="">Semua Foto</option>
        <option value="late">Terlambat</option>
        <option value="outside">Di Luar Area</option>
      </Select>
    </>
  );
}

'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Button from '@/components/ui/Button';
import Checkbox from '@/components/ui/Checkbox';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

export interface HolidayFormProps {
  /** Fixed date (the day dialog). Omit to show a date field. */
  date?: string;
  defaultDate?: string;
  onCreated: (holidayDate: string) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

interface ApiErrorBody {
  error?: { message?: string; fields?: Record<string, string> };
}

/**
 * Creates a COMPANY holiday through POST /api/holidays (OWNER/ADMIN; the route re-checks the role
 * and takes the org from the session, TRD.md §6). Used by the "Tambah Libur" dialog and by the day
 * dialog. National holidays are platform data and cannot be created here.
 */
export default function HolidayForm({ date, defaultDate, onCreated, onCancel, submitLabel = 'Simpan Libur' }: HolidayFormProps) {
  const { show } = useToast();
  const [holidayDate, setHolidayDate] = useState(date ?? defaultDate ?? '');
  const [name, setName] = useState('');
  const [collective, setCollective] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    const nextErrors: Record<string, string> = {};
    if (!holidayDate) nextErrors.holidayDate = 'Pilih tanggal libur.';
    if (!trimmed) nextErrors.name = 'Isi nama hari libur.';
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setIsSaving(true);
    try {
      const res = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ holidayDate, name: trimmed, isCollectiveLeave: collective }),
      });
      if (res.ok) {
        show('Hari libur perusahaan disimpan.', 'success');
        onCreated(holidayDate);
        return;
      }
      const json = (await res.json().catch(() => ({}))) as ApiErrorBody;
      if (res.status === 409) {
        setErrors({ holidayDate: json.error?.fields?.holidayDate ?? json.error?.message ?? 'Tanggal ini sudah ada di daftar libur.' });
      } else if (res.status === 400 && json.error?.fields) {
        setErrors(json.error.fields);
      } else if (res.status === 401) {
        show('Sesi Anda berakhir. Masuk lagi untuk melanjutkan.', 'error');
      } else if (res.status === 403) {
        show('Hanya pemilik atau admin yang dapat mengatur hari libur.', 'error');
      } else {
        show(json.error?.message ?? 'Gagal menyimpan hari libur. Coba lagi.', 'error');
      }
    } catch {
      show('Tidak bisa terhubung ke server. Periksa koneksi Anda lalu coba lagi.', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
      {date === undefined ? (
        <Input
          type="date"
          label="Tanggal"
          value={holidayDate}
          onChange={(e) => setHolidayDate(e.target.value)}
          error={errors.holidayDate}
          required
        />
      ) : errors.holidayDate ? (
        <p role="alert" className="text-sm text-destructive">
          {errors.holidayDate}
        </p>
      ) : null}
      <Input
        label="Nama hari libur"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={120}
        placeholder="Contoh: Ulang tahun perusahaan"
        error={errors.name}
        autoComplete="off"
        required
      />
      <Checkbox
        label="Cuti bersama"
        description="Hanya penanda di kalender. Karyawan yang tetap bekerja pada hari ini tetap bisa check-in."
        checked={collective}
        onChange={(e) => setCollective(e.target.checked)}
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving}>
            Batal
          </Button>
        ) : null}
        <Button type="submit" isLoading={isSaving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

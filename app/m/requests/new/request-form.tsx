'use client';

import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import type { RequestType } from '@/lib/constants/statuses';

const TYPE_OPTIONS: { value: RequestType; label: string }[] = [
  { value: 'CORRECTION', label: 'Koreksi Absen' },
  { value: 'LEAVE', label: 'Cuti' },
  { value: 'SICK', label: 'Sakit' },
  { value: 'PERMIT', label: 'Izin' },
];

type FieldKey = 'type' | 'dateFrom' | 'dateTo' | 'requestedCheckIn' | 'requestedCheckOut' | 'reason' | 'attachmentUrl' | '_root';
type FieldErrors = Partial<Record<FieldKey, string>>;

/**
 * Submit form for attendance_requests (PRD.md E6). Client component: owns useState for
 * every field plus the upload/submit fetch calls — imported into the Server Component
 * shell at app/m/requests/new/page.tsx.
 */
export default function RequestForm() {
  const router = useRouter();
  const { show } = useToast();

  const [type, setType] = useState<RequestType>('CORRECTION');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [requestedCheckIn, setRequestedCheckIn] = useState('');
  const [requestedCheckOut, setRequestedCheckOut] = useState('');
  const [reason, setReason] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  // ck_requests_correction_single_day: CORRECTION is always a single day.
  const isCorrection = type === 'CORRECTION';
  const showAttachment = type === 'SICK' || type === 'PERMIT';

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', 'request-attachment');
      const res = await fetch('/api/uploads', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) {
        show(json.error?.message ?? 'Gagal mengunggah lampiran.', 'error');
        e.target.value = '';
        return;
      }
      setAttachmentUrl(json.data.url as string);
      setAttachmentName(file.name);
      show('Lampiran berhasil diunggah.', 'success');
    } catch {
      show('Tidak bisa terhubung ke server. Coba lagi.', 'error');
      e.target.value = '';
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/attendance-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          dateFrom,
          dateTo: isCorrection ? dateFrom : dateTo,
          ...(isCorrection && requestedCheckIn ? { requestedCheckIn } : {}),
          ...(isCorrection && requestedCheckOut ? { requestedCheckOut } : {}),
          reason,
          ...(attachmentUrl ? { attachmentUrl } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const message = json.error?.message ?? 'Gagal mengirim pengajuan.';
        setErrors(json.error?.fields ? { ...json.error.fields } : { _root: message });
        show(message, 'error');
        return;
      }
      show('Pengajuan berhasil dikirim.', 'success');
      router.push('/m/requests');
    } catch {
      setErrors({ _root: 'Tidak bisa terhubung ke server. Coba lagi.' });
      show('Tidak bisa terhubung ke server. Coba lagi.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Select
        label="Jenis Pengajuan"
        value={type}
        onChange={(e) => setType(e.target.value as RequestType)}
        options={TYPE_OPTIONS}
        error={errors.type}
        required
      />

      <Input
        label={isCorrection ? 'Tanggal' : 'Dari Tanggal'}
        type="date"
        value={dateFrom}
        onChange={(e) => setDateFrom(e.target.value)}
        error={errors.dateFrom}
        required
      />

      {!isCorrection ? (
        <Input
          label="Sampai Tanggal"
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          error={errors.dateTo}
          required
        />
      ) : null}

      {isCorrection ? (
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Jam Masuk (opsional)"
            type="time"
            value={requestedCheckIn}
            onChange={(e) => setRequestedCheckIn(e.target.value)}
            error={errors.requestedCheckIn}
          />
          <Input
            label="Jam Keluar (opsional)"
            type="time"
            value={requestedCheckOut}
            onChange={(e) => setRequestedCheckOut(e.target.value)}
            error={errors.requestedCheckOut}
          />
        </div>
      ) : null}

      <Textarea
        label="Alasan"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        error={errors.reason}
        required
      />

      {showAttachment ? (
        <Input
          label="Lampiran Foto (opsional)"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          disabled={isUploading}
          error={errors.attachmentUrl}
          hint={attachmentName ? `Terunggah: ${attachmentName}` : 'JPEG, PNG, atau WEBP, maks 2 MB.'}
        />
      ) : null}

      {errors._root ? <p className="text-sm text-red-600 dark:text-red-400">{errors._root}</p> : null}

      <Button type="submit" isLoading={isSubmitting} disabled={isUploading} className="w-full">
        Kirim Pengajuan
      </Button>
    </form>
  );
}

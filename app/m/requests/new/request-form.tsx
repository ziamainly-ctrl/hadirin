'use client';

import { useId, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, X } from 'lucide-react';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import { useToast } from '@/components/ui/Toast';
import type { RequestType } from '@/lib/constants/statuses';

// Same words as RequestCard's TYPE_LABELS, so what you pick here is what the list shows.
const TYPE_OPTIONS: { value: RequestType; label: string }[] = [
  { value: 'CORRECTION', label: 'Koreksi Absensi' },
  { value: 'LEAVE', label: 'Cuti' },
  { value: 'SICK', label: 'Sakit' },
  { value: 'PERMIT', label: 'Izin' },
];

// One line under the type picker saying when to use it, and an example reason to match.
const TYPE_HINTS: Record<RequestType, string> = {
  CORRECTION: 'Untuk lupa absen atau jam absen yang salah.',
  LEAVE: 'Cuti satu hari atau beberapa hari.',
  SICK: 'Sakit. Lampirkan surat dokter bila ada.',
  PERMIT: 'Keperluan pribadi atau keluarga.',
};
const REASON_PLACEHOLDERS: Record<RequestType, string> = {
  CORRECTION: 'Contoh: Lupa absen keluar karena rapat di luar kantor sampai sore.',
  LEAVE: 'Contoh: Cuti tahunan untuk acara keluarga di luar kota.',
  SICK: 'Contoh: Demam, disarankan istirahat 2 hari oleh dokter.',
  PERMIT: 'Contoh: Mengurus dokumen kependudukan di kantor kecamatan.',
};

// lib/validators/attendance-requests.ts caps reason at 500 characters (the column size).
const REASON_MAX = 500;

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentId = useId();

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

  function clearAttachment() {
    setAttachmentUrl(null);
    setAttachmentName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
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

  const attachmentMessage = errors.attachmentUrl ?? 'JPEG, PNG, atau WEBP, maks. 2 MB.';

  // The form is its own @container: in the 448px phone column it is one stack; in the wide
  // column of a short desktop window (>= 36rem) the fields sit two to a row, so the whole form
  // is about half as tall and still fits above the tab bar.
  return (
    <form onSubmit={handleSubmit} className="@container flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-x-3 gap-y-3.5 @xl:grid-cols-4">
        <Select
          label="Jenis Pengajuan"
          value={type}
          onChange={(e) => setType(e.target.value as RequestType)}
          options={TYPE_OPTIONS}
          error={errors.type}
          hint={TYPE_HINTS[type]}
          wrapperClassName="col-span-2"
          required
        />

        {isCorrection ? (
          <Input
            label="Tanggal"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            error={errors.dateFrom}
            wrapperClassName="col-span-2"
            required
          />
        ) : (
          <>
            <Input
              label="Dari Tanggal"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              error={errors.dateFrom}
              wrapperClassName="min-w-0"
              required
            />
            <Input
              label="Sampai Tanggal"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              error={errors.dateTo}
              wrapperClassName="min-w-0"
              required
            />
          </>
        )}

        {isCorrection ? (
          <>
            <Input
              label="Jam Masuk"
              type="time"
              value={requestedCheckIn}
              onChange={(e) => setRequestedCheckIn(e.target.value)}
              error={errors.requestedCheckIn}
              wrapperClassName="min-w-0 @xl:col-span-2"
            />
            <Input
              label="Jam Keluar"
              type="time"
              value={requestedCheckOut}
              onChange={(e) => setRequestedCheckOut(e.target.value)}
              error={errors.requestedCheckOut}
              wrapperClassName="min-w-0 @xl:col-span-2"
            />
            <p className="col-span-2 -mt-2 text-sm text-muted @xl:col-span-4">
              Opsional. Kosongkan jam yang sudah benar.
            </p>
          </>
        ) : null}

        <Textarea
          label="Alasan"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={REASON_PLACEHOLDERS[type]}
          maxLength={REASON_MAX}
          error={errors.reason}
          hint={`${reason.length}/${REASON_MAX} karakter`}
          rows={3}
          className="@xl:h-16"
          wrapperClassName="col-span-2 @xl:col-span-4"
          required
        />

        {showAttachment ? (
          // The native file input's own button and "No file chosen" text are in the
          // browser's language (English on most phones), so it is hidden and driven by a
          // Bahasa button; the hidden input stays the one that actually holds the file.
          <div className="col-span-2 flex flex-col gap-1.5 @xl:col-span-4">
            <span id={`${attachmentId}-label`} className="text-sm font-medium text-text">
              Lampiran Foto <span className="font-normal text-muted">(opsional)</span>
            </span>
            <div className="flex min-h-10 items-center gap-3">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                isLoading={isUploading}
                aria-labelledby={`${attachmentId}-label ${attachmentId}-button`}
                aria-describedby={`${attachmentId}-message`}
                className="shrink-0"
              >
                {isUploading ? null : <ImagePlus className="h-4 w-4" aria-hidden="true" />}
                <span id={`${attachmentId}-button`}>
                  {isUploading ? 'Mengunggah...' : attachmentName ? 'Ganti Foto' : 'Pilih Foto'}
                </span>
              </Button>
              {attachmentName && !isUploading ? (
                <div className="flex min-w-0 flex-1 items-center gap-1">
                  <span className="min-w-0 truncate text-sm text-text" title={attachmentName}>
                    {attachmentName}
                  </span>
                  <IconButton label="Hapus lampiran" size="lg" onClick={clearAttachment}>
                    <X className="h-4 w-4" aria-hidden="true" />
                  </IconButton>
                </div>
              ) : !isUploading ? (
                <span className="text-sm text-muted">Belum ada foto</span>
              ) : null}
            </div>
            <p id={`${attachmentId}-message`} className={`text-sm ${errors.attachmentUrl ? 'text-destructive' : 'text-muted'}`}>
              {attachmentMessage}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>
        ) : null}
      </div>

      {errors._root ? (
        <p role="alert" className="text-sm text-destructive">
          {errors._root}
        </p>
      ) : null}

      <Button type="submit" size="lg" isLoading={isSubmitting} disabled={isUploading} className="w-full">
        Kirim Pengajuan
      </Button>
    </form>
  );
}

'use client';

import { useState } from 'react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

// Password rules mirror the API's passwordSchema (lib/validators/common.ts): 8 to 72 characters.
const MIN_LENGTH = 8;
const MAX_LENGTH = 72;

// The route answers in English; every failure a person can act on is worded here by code.
const ERROR_COPY: Record<string, string> = {
  INVALID_CURRENT_PASSWORD: 'Kata sandi saat ini salah. Periksa lagi, lalu coba kembali.',
  RATE_LIMITED: 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.',
};

interface FieldErrors {
  current?: string;
  next?: string;
  confirm?: string;
}

/**
 * Self-service password change for a signed-in person (/app/akun), over the existing
 * POST /api/auth/change-password. The API takes only the current and the new password; the
 * "ulangi" field exists on the client so a typo in a password nobody can see is not saved as the
 * only way back into the account. On success the form clears and a toast confirms; the session
 * stays valid (the JWT does not embed the password), so there is nothing to redirect to.
 */
export default function ChangePasswordForm() {
  const { show } = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const found: FieldErrors = {};
    if (next.length < MIN_LENGTH) found.next = `Kata sandi baru minimal ${MIN_LENGTH} karakter.`;
    else if (next === current) found.next = 'Kata sandi baru harus berbeda dari kata sandi saat ini.';
    if (confirm !== next) found.confirm = 'Kata sandi tidak sama. Ketik ulang kata sandi baru Anda.';
    setErrors(found);
    if (found.next || found.confirm) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const json = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
      if (!res.ok) {
        const code = json?.error?.code ?? '';
        if (code === 'INVALID_CURRENT_PASSWORD') {
          setErrors({ current: ERROR_COPY.INVALID_CURRENT_PASSWORD });
        } else {
          setFormError(ERROR_COPY[code] ?? 'Gagal mengubah kata sandi. Coba lagi sebentar lagi.');
        }
        return;
      }
      setCurrent('');
      setNext('');
      setConfirm('');
      setErrors({});
      show('Kata sandi berhasil diubah.', 'success');
    } catch {
      setFormError('Tidak bisa terhubung ke server. Periksa koneksi Anda lalu coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 fit-gap">
      <Input
        label="Kata Sandi Saat Ini"
        type="password"
        value={current}
        onChange={(e) => {
          setCurrent(e.target.value);
          setErrors((prev) => ({ ...prev, current: undefined }));
        }}
        autoComplete="current-password"
        error={errors.current}
        maxLength={MAX_LENGTH}
        required
      />
      <Input
        label="Kata Sandi Baru"
        type="password"
        value={next}
        onChange={(e) => {
          setNext(e.target.value);
          setErrors((prev) => ({ ...prev, next: undefined }));
        }}
        autoComplete="new-password"
        hint={`Minimal ${MIN_LENGTH} karakter.`}
        error={errors.next}
        maxLength={MAX_LENGTH}
        required
      />
      <Input
        label="Ulangi Kata Sandi Baru"
        type="password"
        value={confirm}
        onChange={(e) => {
          setConfirm(e.target.value);
          setErrors((prev) => ({ ...prev, confirm: undefined }));
        }}
        autoComplete="new-password"
        error={errors.confirm}
        maxLength={MAX_LENGTH}
        required
      />
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <Button type="submit" isLoading={isSubmitting} disabled={!current || !next || !confirm} className="w-full sm:w-auto sm:self-start">
        Simpan Kata Sandi
      </Button>
    </form>
  );
}

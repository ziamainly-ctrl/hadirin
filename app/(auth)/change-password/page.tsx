'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { AUTH_FORM_CLASS, AuthHeading } from '../auth-ui';

const ADMIN_ROLES = new Set(['OWNER', 'ADMIN', 'MANAGER']);

// The route answers in English; the one failure a person can fix here is worded by code.
const ERROR_COPY: Record<string, string> = {
  INVALID_CURRENT_PASSWORD:
    'Kata sandi sementara tidak cocok. Periksa lagi, atau minta admin perusahaan Anda membuatkan yang baru.',
};

// Reachable even while must_change_password is true (TRD.md §11) — this is a first-login
// (admin-issued temporary password) flow, not a "forgot password" flow.
export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Client-side only: the API takes just the new password, the repeat field exists so a
    // typo in a password nobody can see isn't saved as the only way back into the account.
    if (newPassword !== confirmPassword) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(ERROR_COPY[json.error?.code] ?? json.error?.message ?? 'Gagal mengubah kata sandi.');
        return;
      }
      const me = await fetch('/api/me').then((r) => r.json());
      router.push(ADMIN_ROLES.has(me.data?.user?.role) ? '/app' : '/m');
    } catch {
      setError('Tidak bisa terhubung ke server. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={AUTH_FORM_CLASS}>
      <AuthHeading
        title="Buat Kata Sandi Baru"
        description="Ini login pertama Anda. Ganti kata sandi sementara dari admin dengan kata sandi milik Anda sendiri."
      />
      <Input
        label="Kata Sandi Sementara"
        type="password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        autoComplete="current-password"
        required
      />
      <Input
        label="Kata Sandi Baru"
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        autoComplete="new-password"
        hint="Minimal 8 karakter."
        minLength={8}
        maxLength={72}
        required
      />
      <Input
        label="Ulangi Kata Sandi Baru"
        type="password"
        value={confirmPassword}
        onChange={(e) => {
          setConfirmPassword(e.target.value);
          setMismatch(false);
        }}
        autoComplete="new-password"
        error={mismatch ? 'Kata sandi tidak sama. Ketik ulang kata sandi baru Anda.' : undefined}
        maxLength={72}
        required
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" isLoading={isLoading} className="mt-2 w-full">
        Simpan & Lanjutkan
      </Button>
    </form>
  );
}

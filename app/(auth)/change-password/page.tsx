'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

const ADMIN_ROLES = new Set(['OWNER', 'ADMIN', 'MANAGER']);

// Reachable even while must_change_password is true (TRD.md §11) — this is a first-login
// (admin-issued temporary password) flow, not a "forgot password" flow.
export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? 'Gagal mengubah kata sandi.');
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text">Buat Kata Sandi Baru</h1>
      <p className="text-sm text-muted">Ini login pertama kamu. Silakan ganti kata sandi sementara.</p>
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
        minLength={8}
        required
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" isLoading={isLoading} className="mt-2 w-full">
        Simpan & Lanjutkan
      </Button>
    </form>
  );
}

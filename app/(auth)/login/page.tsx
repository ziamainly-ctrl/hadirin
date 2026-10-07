'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

const ADMIN_ROLES = new Set(['OWNER', 'ADMIN', 'MANAGER']);

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? 'Gagal masuk. Coba lagi.');
        return;
      }
      const { role, mustChangePassword } = json.data.user;
      if (mustChangePassword) {
        router.push('/change-password');
      } else {
        router.push(ADMIN_ROLES.has(role) ? '/app' : '/m');
      }
    } catch {
      setError('Tidak bisa terhubung ke server. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text">Masuk</h1>
      <Input
        label="Email atau No. HP"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        autoComplete="username"
        required
      />
      <Input
        label="Kata Sandi"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
      />
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <Button type="submit" isLoading={isLoading} className="mt-2 w-full">
        Masuk
      </Button>
      <p className="text-center text-sm text-muted">
        Belum punya akun?{' '}
        <Link href="/register" className="font-medium text-primary">
          Daftar gratis
        </Link>
      </p>
    </form>
  );
}

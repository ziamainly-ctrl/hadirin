'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

// PRD.md US-07 / S3 — registers an org on STARTER TRIAL and logs the owner straight in.
export default function RegisterPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, name, email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        const fieldError = json.error?.fields ? Object.values(json.error.fields)[0] : null;
        setError((fieldError as string | undefined) ?? json.error?.message ?? 'Gagal mendaftar. Coba lagi.');
        return;
      }
      router.push('/app');
    } catch {
      setError('Tidak bisa terhubung ke server. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text">Mulai Gratis</h1>
      <Input label="Nama Perusahaan" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
      <Input label="Nama Anda" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
      />
      <Input
        label="Kata Sandi"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        minLength={8}
        required
      />
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <Button type="submit" isLoading={isLoading} className="mt-2 w-full">
        Daftar
      </Button>
      <p className="text-center text-sm text-muted">
        Sudah punya akun?{' '}
        <Link href="/login" className="font-medium text-primary">
          Masuk
        </Link>
      </p>
    </form>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

// Outside app/platform/(authenticated)/ on purpose (see that layout's comment) — this
// page supplies its own minimal centered-card shell rather than reusing app/(auth)'s
// layout, since route groups only wrap pages physically nested inside them.
export default function PlatformLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/platform/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? 'Gagal masuk.');
        return;
      }
      router.push('/platform/organizations');
    } catch {
      setError('Tidak bisa terhubung ke server. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-12">
      <span className="mb-6 text-xl font-bold text-primary">Hadirin Platform</span>
      <form onSubmit={handleSubmit} className="w-full max-w-sm flex-col gap-4 rounded-card bg-surface p-6 shadow-sm">
        <h1 className="mb-4 text-lg font-semibold text-text">Masuk Admin Platform</h1>
        <div className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" isLoading={isLoading} className="w-full">
            Masuk
          </Button>
        </div>
      </form>
    </div>
  );
}

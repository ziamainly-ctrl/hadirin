'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Logo from '@/components/shared/Logo';
import ThemeToggle from '@/components/shared/ThemeToggle';

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
    // Same shell as app/(auth)/layout.tsx (theme toggle top-right, bordered card p-6 sm:p-8,
    // text-xl title), so the two sign-in screens read as one product; the "Platform" suffix
    // under the wordmark is what tells them apart. No tinted band behind it: the page
    // gradient (app/globals.css) is the background, and the shell is centered in one
    // viewport (py-8, not py-16, so a 560px-tall window still fits card + logo).
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-8">
      {/* Positioned by a wrapper: IconButton sets its own `relative` for its touch area. */}
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Logo suffix="Platform" className="relative mb-6 text-xl" />
      <form
        onSubmit={handleSubmit}
        className="relative flex w-full max-w-sm flex-col gap-4 rounded-card border border-border bg-surface p-6 shadow-sm sm:p-8"
      >
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight text-text">Masuk Admin Platform</h1>
          <p className="text-sm text-muted">Khusus tim Hadirin untuk mengelola paket, pembayaran, dan data global.</p>
        </div>
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
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" isLoading={isLoading} className="mt-2 w-full">
          Masuk
        </Button>
      </form>
    </main>
  );
}

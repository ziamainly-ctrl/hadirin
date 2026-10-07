'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { AUTH_FORM_CLASS, AuthHeading, AuthSwitch } from '../auth-ui';

const ADMIN_ROLES = new Set(['OWNER', 'ADMIN', 'MANAGER']);

/** Where ?next may send someone after logging in: /check-in for anyone, the shell their own
 * role lives in otherwise. Anything else (another origin, a protocol-relative "//host", a
 * page of the other role) is dropped and the normal role home is used, so the parameter can't
 * be turned into an open redirect or a dead-end 403. */
function safeNext(raw: string | null, isAdmin: boolean): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;
  const path = raw.split(/[?#]/)[0] ?? '';
  if (path === '/check-in') return raw;
  const home = isAdmin ? '/app' : '/m';
  return path === home || path.startsWith(`${home}/`) ? raw : null;
}

// The login route answers in English (it is also an API); the form words its two expected
// failures itself, keyed by error code, each with a way forward (NN/g error-message
// guidelines: say what happened and how to recover, without blaming). The wait matches
// rl:login's 10 tries per 10 minutes (TRD.md §10). Anything else falls back to the
// server's own message.
const ERROR_COPY: Record<string, string> = {
  INVALID_CREDENTIALS: 'Email/No. HP atau kata sandi tidak cocok.',
  RATE_LIMITED: 'Terlalu banyak percobaan masuk. Tunggu sekitar 10 menit, lalu coba lagi.',
};

// The recovery step for a wrong password, shown in muted text under the red line so the
// error itself stays one short sentence. Worded for employees (an admin can reset their
// password from /app/employees); there is no self-service reset, so it promises none.
const RECOVERY_HINT = 'Lupa kata sandi? Karyawan dapat meminta admin perusahaan untuk mengaturnya ulang.';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setErrorCode(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorCode(json.error?.code ?? null);
        setError(ERROR_COPY[json.error?.code] ?? json.error?.message ?? 'Gagal masuk. Coba lagi.');
        return;
      }
      const { role, mustChangePassword } = json.data.user;
      if (mustChangePassword) {
        router.push('/change-password');
      } else {
        const isAdmin = ADMIN_ROLES.has(role);
        const next = safeNext(new URLSearchParams(window.location.search).get('next'), isAdmin);
        router.push(next ?? (isAdmin ? '/app' : '/m'));
        router.refresh();
      }
    } catch {
      setError('Tidak bisa terhubung ke server. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={AUTH_FORM_CLASS}>
      <AuthHeading title="Masuk" description="Gunakan email atau nomor HP yang terdaftar di Hadirin." />
      <Input
        label="Email atau No. HP"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
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
        <div role="alert" className="text-sm">
          <p className="text-destructive">{error}</p>
          {errorCode === 'INVALID_CREDENTIALS' ? <p className="mt-1 text-muted">{RECOVERY_HINT}</p> : null}
        </div>
      ) : null}
      <Button type="submit" isLoading={isLoading} className="mt-2 w-full">
        Masuk
      </Button>
      <AuthSwitch text="Belum punya akun?" href="/register" label="Daftar gratis" />
    </form>
  );
}

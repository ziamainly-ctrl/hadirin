'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { AUTH_FORM_CLASS, AuthHeading, AuthSwitch } from '../auth-ui';

// The register route's non-field failures come back in English; the form words them
// itself by code (rl:register = 5 signups per 10 minutes per network, TRD.md §10).
const ERROR_COPY: Record<string, string> = {
  RATE_LIMITED: 'Terlalu banyak pendaftaran dari jaringan ini. Tunggu sekitar 10 menit, lalu coba lagi.',
  INTERNAL_ERROR: 'Pendaftaran sedang tidak bisa diproses. Coba lagi beberapa saat lagi.',
};

// The body keys the route validates (bodySchema in app/api/auth/register/route.ts); each is also the
// `name` of its input, which is how a server message finds the field to focus.
const FIELD_NAMES = ['companyName', 'name', 'email', 'password'] as const;
type FieldName = (typeof FIELD_NAMES)[number];

// PRD.md US-07 / S3 — registers an org on STARTER TRIAL and logs the owner straight in.
export default function RegisterPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Per-field messages from a VALIDATION_ERROR (already Indonesian, see lib/validators/locale-id.ts):
  // shown under the field they belong to (NN/g: keep error messages next to the field), and the
  // first one takes focus. `error` stays for the failures that belong to no field.
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Editing a field clears its own message right away, so a corrected value never keeps a stale error.
  function clearField(field: FieldName) {
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setFieldErrors({});
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, name, email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        const fields: Record<string, string> = json.error?.fields ?? {};
        const mine = FIELD_NAMES.filter((field) => fields[field]);
        const [first] = mine;
        if (first) {
          setFieldErrors(Object.fromEntries(mine.map((field) => [field, fields[field]])));
          (form.elements.namedItem(first) as HTMLElement | null)?.focus();
          return;
        }
        setError(ERROR_COPY[json.error?.code] ?? json.error?.message ?? 'Gagal mendaftar. Coba lagi.');
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
    <form onSubmit={handleSubmit} className={AUTH_FORM_CLASS}>
      <AuthHeading title="Mulai Gratis" description="Paket Starter gratis 14 hari, tanpa kartu kredit." />
      {/* maxLength mirrors the server caps (register route + lib/validators/common.ts), so a
          too-long value is stopped while typing instead of coming back as an error. */}
      <Input
        label="Nama Perusahaan"
        name="companyName"
        value={companyName}
        onChange={(e) => {
          setCompanyName(e.target.value);
          clearField('companyName');
        }}
        error={fieldErrors.companyName}
        autoComplete="organization"
        minLength={2}
        maxLength={120}
        required
      />
      <Input
        label="Nama Anda"
        name="name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          clearField('name');
        }}
        error={fieldErrors.name}
        autoComplete="name"
        maxLength={100}
        required
      />
      <Input
        label="Email"
        name="email"
        type="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          clearField('email');
        }}
        error={fieldErrors.email}
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={150}
        required
      />
      <Input
        label="Kata Sandi"
        name="password"
        type="password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          clearField('password');
        }}
        error={fieldErrors.password}
        autoComplete="new-password"
        hint="Minimal 8 karakter."
        minLength={8}
        maxLength={72}
        required
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" isLoading={isLoading} className="mt-2 w-full">
        Daftar
      </Button>
      <AuthSwitch text="Sudah punya akun?" href="/login" label="Masuk" />
    </form>
  );
}

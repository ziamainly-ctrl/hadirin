import Link from 'next/link';
import Logo from '@/components/shared/Logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-bg px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-primary/10 to-transparent"
      />
      <Link href="/" aria-label="Hadirin — beranda" className="relative mb-6 flex items-center">
        <Logo className="text-xl" />
      </Link>
      <div className="relative w-full max-w-sm rounded-card border border-border bg-surface p-6 shadow-sm">
        {children}
      </div>
    </div>
  );
}

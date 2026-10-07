import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-12">
      <Link href="/" className="mb-6 text-xl font-bold text-primary">
        Hadirin
      </Link>
      <div className="w-full max-w-sm rounded-card bg-surface p-6 shadow-sm">{children}</div>
    </div>
  );
}

import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { ToastProvider } from '@/components/ui/Toast';
import ThemeToggle from '@/components/shared/ThemeToggle';
import Logo from '@/components/shared/Logo';
import BottomNav from './bottom-nav';

// Server Component, same must-change-password redirect pattern as app/app/layout.tsx.
export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const { context } = await requireSession();
  if (context.mustChangePassword) redirect('/change-password');

  return (
    <ToastProvider>
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-bg">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface px-4 py-2.5">
          <Logo className="text-sm" />
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-x-hidden px-4 pb-20 pt-4">{children}</main>
        <BottomNav />
      </div>
    </ToastProvider>
  );
}

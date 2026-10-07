import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { ToastProvider } from '@/components/ui/Toast';
import BottomNav from './bottom-nav';

// Server Component, same must-change-password redirect pattern as app/app/layout.tsx.
export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const { context } = await requireSession();
  if (context.mustChangePassword) redirect('/change-password');

  return (
    <ToastProvider>
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-bg">
        <main className="flex-1 overflow-x-hidden px-4 pb-20 pt-4">{children}</main>
        <BottomNav />
      </div>
    </ToastProvider>
  );
}

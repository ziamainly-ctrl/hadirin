'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

export interface LogoutButtonProps {
  /** '/api/auth/logout' for a tenant user, '/api/platform/auth/logout' for a platform admin. */
  logoutUrl: string;
  /** '/login' or '/platform/login' — where to land once the session cookie is cleared. */
  redirectTo: string;
  /** False inside Sidebar's collapsed desktop rail, where only the icon fits. */
  showLabel?: boolean;
}

/**
 * Sidebar footer action for /app and /platform (components/shared/Sidebar.tsx) — neither
 * shell had any way to end a session before this; only app/m/profile had its own
 * same-shaped LogoutButton. Kept as a separate component (not reused directly) since /m's
 * version is a full-width Button on its own page, not a sidebar-footer row.
 */
export default function LogoutButton({ logoutUrl, redirectTo, showLabel = true }: LogoutButtonProps) {
  const router = useRouter();
  const { show } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogout() {
    setIsSubmitting(true);
    try {
      const res = await fetch(logoutUrl, { method: 'POST' });
      if (!res.ok) {
        show('Gagal keluar. Coba lagi.', 'error');
        return;
      }
      router.push(redirectTo);
    } catch {
      show('Tidak bisa terhubung ke server. Coba lagi.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isSubmitting}
      title={!showLabel ? 'Keluar' : undefined}
      className="flex w-full items-center gap-3 rounded-input px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-accent hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
    >
      <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
      {showLabel ? <span className="truncate">{isSubmitting ? 'Keluar...' : 'Keluar'}</span> : null}
    </button>
  );
}

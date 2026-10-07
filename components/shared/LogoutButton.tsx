'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

export interface LogoutButtonProps {
  /** '/api/auth/logout' for a tenant user, '/api/platform/auth/logout' for a platform admin. */
  logoutUrl: string;
  /** '/' (the home page) for a tenant user, '/platform/login' for a platform admin — where to
   * land once the session cookie is cleared. */
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
      router.replace(redirectTo);
      router.refresh();
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
      aria-label={!showLabel ? 'Keluar' : undefined}
      // Same row metrics and focus ring as Sidebar's nav links, so the footer action reads
      // as the last item of that list.
      className="flex w-full items-center gap-3 rounded-input px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-accent hover:text-text focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 lg:py-2 lg:pointer-coarse:py-2.5"
    >
      <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
      {showLabel ? <span className="truncate">{isSubmitting ? 'Keluar...' : 'Keluar'}</span> : null}
    </button>
  );
}

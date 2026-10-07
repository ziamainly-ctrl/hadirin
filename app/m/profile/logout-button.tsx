'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

// Client component: owns the onClick and the /api/auth/logout call. Kept out of
// profile/page.tsx (a Server Component) per the Server/Client split rule. Outline, not a
// filled or danger button: signing out is reversible and is not this page's main action.
export default function LogoutButton() {
  const router = useRouter();
  const { show } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogout() {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (!res.ok) {
        show('Gagal keluar. Coba lagi.', 'error');
        return;
      }
      router.replace('/');
      router.refresh();
    } catch {
      show('Tidak bisa terhubung ke server. Coba lagi.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Button variant="outline" size="lg" onClick={handleLogout} isLoading={isSubmitting} className="w-full">
      {isSubmitting ? null : <LogOut className="h-4 w-4" aria-hidden="true" />}
      Keluar
    </Button>
  );
}

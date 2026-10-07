'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

// Client component: owns the onClick and the /api/auth/logout call. Kept out of
// profile/page.tsx (a Server Component) per the Server/Client split rule.
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
      router.push('/login');
    } catch {
      show('Tidak bisa terhubung ke server. Coba lagi.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Button variant="secondary" onClick={handleLogout} isLoading={isSubmitting} className="w-full">
      Keluar
    </Button>
  );
}

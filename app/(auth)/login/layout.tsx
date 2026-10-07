import type { Metadata } from 'next';

// page.tsx is a client form and can't export metadata itself; without this the tab read the
// site default ("Hadirin — Absensi GPS + Selfie untuk UMKM") on all three auth screens.
export const metadata: Metadata = {
  title: 'Masuk',
  description: 'Masuk ke Hadirin dengan email atau nomor HP yang terdaftar.',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}

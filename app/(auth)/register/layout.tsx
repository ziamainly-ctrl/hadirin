import type { Metadata } from 'next';

// page.tsx is a client form and can't export metadata itself (see ../login/layout.tsx).
export const metadata: Metadata = {
  title: 'Daftar Gratis',
  description: 'Daftarkan perusahaan Anda di Hadirin dan coba paket Starter gratis selama 14 hari.',
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}

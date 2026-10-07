import type { Metadata } from 'next';

// page.tsx is a Client Component and can't export metadata itself; without this the tab
// showed the marketing title ("Hadirin — Absensi GPS + Selfie untuk UMKM").
export const metadata: Metadata = { title: 'Masuk Admin Platform', robots: { index: false, follow: false } };

export default function PlatformLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}

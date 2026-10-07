import type { Metadata } from 'next';

// page.tsx is a client form and can't export metadata itself (see ../login/layout.tsx).
// noindex: a signed-in, first-login step with nothing for a search engine to show.
export const metadata: Metadata = {
  title: 'Buat Kata Sandi Baru',
  robots: { index: false },
};

export default function ChangePasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}

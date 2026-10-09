import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import ThemeSync from '@/components/shared/ThemeSync';
import NavigationProgress from '@/components/shared/motion/NavigationProgress';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Hadirin — Absensi GPS + Selfie untuk UMKM',
    template: '%s · Hadirin',
  },
  description:
    'Absensi karyawan dengan GPS dan selfie, dashboard langsung, persetujuan satu klik. Siap dalam 5 menit, mulai gratis.',
  // Deliberately no `icons` here: setting it replaces the file-convention icons (icon.svg
  // and apple-icon.tsx, both cache-busted by Next) instead of adding to them. /favicon.ico
  // is still served by app/favicon.ico/route.ts for crawlers and browsers that request it
  // by path.
};

// Browser UI color (mobile address bar) per OS scheme; the top of the page gradient in each
// theme (app/globals.css --gradient-page: oklch(0.945) light, oklch(0.225) dark), as hex, so
// the bar melts into the page. An explicit in-app theme choice can't change this static tag.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ededed' },
    { media: '(prefers-color-scheme: dark)', color: '#1c1c1c' },
  ],
};

// Blocking script, first thing in <head>: must run before first paint, so the .dark
// class (from an explicit prior choice, falling back to the OS setting) is already on
// <html> by the time CSS applies — reading localStorage inside a React effect would only
// run after hydration, after the light background already painted once (a white flash).
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('hadirin-theme');if(t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the script above can add class="dark" to this exact
    // element before React hydrates, which would otherwise log a (harmless, expected)
    // server/client markup mismatch warning for this one attribute.
    <html lang="id" className={plusJakartaSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        {/* Re-applies the theme after a server error, when the script above never runs (see ThemeSync). */}
        <ThemeSync />
        {/* Top progress bar + "Memuat…" pill for every navigation, redirects included (see NavigationProgress). */}
        <NavigationProgress />
        {children}
      </body>
    </html>
  );
}

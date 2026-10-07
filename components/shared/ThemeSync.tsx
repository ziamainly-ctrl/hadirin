'use client';

import { useLayoutEffect } from 'react';

/**
 * Re-applies the saved theme (the `.dark` class on <html>) once the client has rendered.
 *
 * app/layout.tsx's inline script already does this before first paint on a normal load. It
 * cannot after a server error: Next answers with a bare `<html id="__next_error__">` shell and
 * the browser then renders the whole tree itself, where React never runs a <script> it renders
 * (it logs "Scripts inside React components are never executed") and resets <html>'s class. A
 * dark-mode user hitting an error saw the error page, and everything after it, in light. A
 * layout effect runs before that first paint, so there is no flash; on a normal load the class
 * is already right and nothing changes.
 *
 * Same decision as the inline script: an explicit saved choice wins, otherwise the OS setting.
 */
export default function ThemeSync() {
  useLayoutEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('hadirin-theme');
    } catch {
      // Storage blocked: fall back to the OS setting below.
    }
    const dark = saved === 'dark' || (saved !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  }, []);
  return null;
}

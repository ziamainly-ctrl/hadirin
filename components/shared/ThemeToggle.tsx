'use client';

import { Moon, Sun } from 'lucide-react';

export interface ThemeToggleProps {
  className?: string;
}

/**
 * Toggles the `.dark` class app/layout.tsx's inline script sets on <html> before first
 * paint, and persists the explicit choice to localStorage (read back by that same
 * script on the next load). Which icon shows is pure CSS (`dark:` variants on the two
 * icons, not a JS state read) — both render always, so server and client markup match
 * exactly and there is nothing to resolve after hydration.
 */
export default function ThemeToggle({ className }: ThemeToggleProps) {
  function toggle() {
    const isDark = document.documentElement.classList.toggle('dark');
    try {
      localStorage.setItem('hadirin-theme', isDark ? 'dark' : 'light');
    } catch {
      // Private browsing / storage blocked: the toggle still works for this load,
      // it just won't be remembered next time.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Ganti tema terang/gelap"
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${className ?? ''}`}
    >
      <Sun className="hidden h-5 w-5 dark:block" aria-hidden="true" />
      <Moon className="block h-5 w-5 dark:hidden" aria-hidden="true" />
    </button>
  );
}

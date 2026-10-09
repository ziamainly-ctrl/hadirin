'use client';

import type { MouseEvent } from 'react';
import { Moon, Sun } from 'lucide-react';
import IconButton from '@/components/ui/IconButton';

export interface ThemeToggleProps {
  className?: string;
}

const REVEAL_MS = 360;

/**
 * Toggles the `.dark` class app/layout.tsx's inline script sets on <html> before first
 * paint, and persists the explicit choice to localStorage (read back by that same
 * script on the next load). Which icon shows is pure CSS (`dark:` variants on the two
 * icons, not a JS state read) — both render always, so server and client markup match
 * exactly and there is nothing to resolve after hydration. The two icons sit on top of each
 * other and swap with a turn and a scale (the sun rises, the moon sets) instead of popping.
 *
 * Where the browser has the View Transitions API, the new theme grows out of the button as a
 * circle over the old one (360ms; the stacking rules live under `::view-transition-*` in
 * app/globals.css). That is the one place a view transition is used on purpose: it freezes the
 * page behind a snapshot for its duration, which is the effect here and would be a delay for a
 * route change. Without the API, or under prefers-reduced-motion, the class just flips.
 */
export default function ThemeToggle({ className }: ThemeToggleProps) {
  function toggle(event: MouseEvent<HTMLButtonElement>) {
    const root = document.documentElement;
    const nextDark = !root.classList.contains('dark');
    const commit = () => {
      root.classList.toggle('dark', nextDark);
      try {
        localStorage.setItem('hadirin-theme', nextDark ? 'dark' : 'light');
      } catch {
        // Private browsing / storage blocked: the toggle still works for this load,
        // it just won't be remembered next time.
      }
    };

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof document.startViewTransition !== 'function') {
      commit();
      return;
    }

    const box = event.currentTarget.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const transition = document.startViewTransition(commit);
    transition.ready
      .then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: REVEAL_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
        );
      })
      .catch(() => {
        // The transition was skipped (another one started, the tab was hidden): the class is already set.
      });
  }

  return (
    <IconButton label="Ganti tema terang/gelap" onClick={toggle} className={className}>
      <span className="relative block h-5 w-5">
        <Sun
          className="absolute inset-0 h-5 w-5 rotate-[-90deg] scale-50 opacity-0 transition-[transform,opacity] duration-300 [transition-timing-function:var(--motion-spring)] dark:rotate-0 dark:scale-100 dark:opacity-100"
          aria-hidden="true"
        />
        <Moon
          className="absolute inset-0 h-5 w-5 rotate-0 scale-100 opacity-100 transition-[transform,opacity] duration-300 [transition-timing-function:var(--motion-spring)] dark:rotate-90 dark:scale-50 dark:opacity-0"
          aria-hidden="true"
        />
      </span>
    </IconButton>
  );
}

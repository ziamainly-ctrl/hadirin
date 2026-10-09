'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

export interface PageTransitionProps {
  children: ReactNode;
  /** Layout classes for the wrapper. It sits between a shell's layout and its page, so it must
   * pass the shell's sizing on: `lg:h-full` where the parent is a block with a definite height,
   * `flex min-h-0 flex-1 flex-col` where the parent is a flex column. */
  className?: string;
}

// false during the first hydration of a hard load, true from then on. Every PageTransition that
// mounts after that is a client navigation, and that is the only time anything animates: the
// first paint of a page is never delayed (LCP), and a plain reload is not a "page change".
let booted = false;

const ENTER_MS = 180;
const ENTER_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

function play(el: HTMLElement) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // A page that also has a deeper PageTransition (and has already started it: children run their
  // layout effects first) lets that one do the work, so two nested fades never multiply.
  if (el.querySelector('[data-route-entering]')) return;
  // While the 8px rise runs, the nearest scroll container must not notice it: a transformed child
  // that pokes 8px past the bottom edge would flash a scrollbar for 180ms. app/globals.css clips
  // the direct parent of an entering wrapper for the duration (`:has(> [data-route-entering])`).
  el.setAttribute('data-route-entering', '');
  const animation = el.animate(
    [
      { opacity: 0, transform: 'translateY(8px)' },
      { opacity: 1, transform: 'none' },
    ],
    { duration: ENTER_MS, easing: ENTER_EASING },
  );
  const done = () => el.removeAttribute('data-route-entering');
  animation.addEventListener('finish', done);
  animation.addEventListener('cancel', done);
}

/**
 * Route enter animation: the new page fades in and rises 8px in 180ms. Rendered by a `template.tsx`
 * (app/app/template.tsx and its siblings), which Next remounts whenever its child segment changes,
 * so a sidebar link between two sections plays it; a navigation deeper inside one section (a list
 * to its detail page) keeps the same instance, so it also replays when the pathname changes.
 * Search-parameter changes (filters, pages) never remount a template and never replay it.
 *
 * Why Web Animations and not a CSS class: the class would be in the server HTML and run on the
 * first paint of every hard load, delaying the content people came for. This runs only on the
 * client, only after a navigation, and not at all under prefers-reduced-motion (the page simply
 * swaps, which is the same state). There is no exit animation: the App Router unmounts the old
 * page in the same commit as the new one mounts, so an exit has nothing to run on, and holding the
 * old page back to fake one would only delay the new content.
 *
 * (React's <ViewTransition> works in this Next version, but a view transition freezes the page
 * behind a screenshot for its whole duration, which is exactly the "blocks interaction" this
 * avoids. It is used once, for the theme switch, where a frozen 350ms is the effect.)
 */
export default function PageTransition({ children, className }: PageTransitionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const first = lastPath.current === null;
    const changed = lastPath.current !== pathname;
    lastPath.current = pathname;
    if (first ? !booted : !changed) return;
    play(el);
  }, [pathname]);

  useEffect(() => {
    booted = true;
  }, []);

  return (
    <div ref={ref} data-route-content="" className={className}>
      {children}
    </div>
  );
}

'use client';

import { useCallback, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './checkin.css';

const subscribeNever = () => () => {};

/**
 * The selfie screen on a phone: a full-screen modal <dialog> (top layer, focus trap, Escape, inert
 * page behind it, like ui/Dialog) so the viewfinder gets the whole screen instead of what is left
 * between the app header and the tab bar. It is a native dialog rather than a position:fixed box
 * because the card is inside an `@container`, and container-type applies layout containment, which
 * makes a fixed descendant position against the container, not the window.
 */
export default function CameraSheet({ label, onCancel, children }: { label: string; onCancel?: () => void; children: ReactNode }) {
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);

  const ref = useCallback((el: HTMLDialogElement | null) => {
    if (el && !el.open) el.showModal();
  }, []);

  if (!mounted) return null;
  return createPortal(
    <dialog
      ref={ref}
      aria-label={label}
      className="ci-sheet"
      onCancel={(event) => {
        // Escape / the Android back gesture: leave the camera, not just the dialog (the parent's
        // state decides whether the sheet is still there).
        event.preventDefault();
        onCancel?.();
      }}
    >
      <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        {children}
      </div>
    </dialog>,
    document.body,
  );
}

'use client';

import { useId } from 'react';
import { mascotInner } from '@/lib/brand/mascot';
import type { MascotFraming } from '@/lib/brand/mascot';

export interface MascotProps {
  className?: string;
  /** 'tight' (default) is the logo crop; 'full' adds shoulders and lanyard for larger spots. */
  framing?: MascotFraming;
  /** Accessible name. Omit when the mark sits next to the "Hadirin" wordmark (decorative). */
  title?: string;
}

/**
 * Inline SVG of the Hadirin mascot (lib/brand/mascot.ts is the one drawing). Inline rather
 * than an <img> so it costs no request and can't flash in late. 'use client' only for
 * useId(): every instance needs its own gradient ids, because a copy rendered inside a
 * hidden (display:none) parent — the collapsed sidebar, the mobile drawer — can lose
 * gradients it shares by id with a visible copy.
 */
export default function Mascot({ className, framing = 'tight', title }: MascotProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={className}
      dangerouslySetInnerHTML={{ __html: mascotInner({ idPrefix: `m${uid}`, framing }) }}
    />
  );
}

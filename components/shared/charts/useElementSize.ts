'use client';

import { useEffect, useRef, useState } from 'react';

export interface ElementSize {
  width: number;
  height: number;
}

/**
 * Pixel size of an element, kept in sync by a ResizeObserver. The hand-rolled SVG charts draw at
 * the real pixel size instead of scaling a fixed viewBox, so axis text stays 11 to 12px on a 360px
 * phone and on a 2200px monitor alike. Size is 0 x 0 until the first measurement (the server
 * render and the first client render): charts draw nothing then, and the wrapper's own CSS size
 * keeps the layout from jumping.
 */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}

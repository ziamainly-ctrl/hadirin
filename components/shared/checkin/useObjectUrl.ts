'use client';

import { useEffect, useState } from 'react';

/**
 * A `blob:` URL for a Blob that lives exactly as long as the component shows it, then is freed.
 *
 * The URL is made in an effect, never during render and never stored for a later effect to revoke:
 * React's development StrictMode mounts, cleans up and mounts every effect once, and a URL created
 * outside the effect would be revoked by that first cleanup and then used by the second mount (a
 * broken image). Here each mount makes its own URL and its own cleanup frees it.
 */
export function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return;
    const next = URL.createObjectURL(blob);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the object URL is an external resource that only exists once the effect has made it
    setUrl(next);
    return () => {
      URL.revokeObjectURL(next);
      setUrl(null);
    };
  }, [blob]);
  return blob ? url : null;
}

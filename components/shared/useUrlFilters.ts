'use client';

import { useCallback, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Filters that live in the URL, for the Server Component pages that re-run on every change
 * (app/app/terlambat, luar-area, selfie). Same pattern as app/app/attendance/filters.tsx, factored
 * out so the three pages do not each copy it: read from useSearchParams(), write with router.push,
 * and drop `page` on any change so a new filter never lands on a page that no longer exists.
 *
 * `pending` is true while the server renders the next result, so a filter bar can dim itself
 * (aria-busy) instead of looking frozen.
 */
export function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const get = useCallback((key: string) => searchParams.get(key) ?? '', [searchParams]);

  const push = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      params.delete('page');
      const query = params.toString();
      startTransition(() => router.push(query ? `${pathname}?${query}` : pathname));
    },
    [pathname, router, searchParams],
  );

  /** Set one key, or remove it when the value is empty. */
  const set = useCallback(
    (key: string, value: string) =>
      push((params) => {
        if (value) params.set(key, value);
        else params.delete(key);
      }),
    [push],
  );

  /** Set several keys in one navigation (a preset sets dateFrom and dateTo together). */
  const setMany = useCallback(
    (entries: Record<string, string>) =>
      push((params) => {
        for (const [key, value] of Object.entries(entries)) {
          if (value) params.set(key, value);
          else params.delete(key);
        }
      }),
    [push],
  );

  /** Remove the given keys (other params, such as the active tab, are kept). */
  const reset = useCallback(
    (keys: readonly string[]) =>
      push((params) => {
        for (const key of keys) params.delete(key);
      }),
    [push],
  );

  const has = useCallback((keys: readonly string[]) => keys.some((key) => searchParams.has(key)), [searchParams]);

  return { get, set, setMany, reset, has, pending };
}

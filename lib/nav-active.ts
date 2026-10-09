// "Which nav item is the current page?" for components/shared/Sidebar.tsx, as a pure function.
//
// The root item (/app) is a string prefix of every other href (/app/employees, /app/check-in,
// ...), so a per-item "exact match OR starts with href + '/'" check lights BOTH the root item and
// the real page at once (caught live: Dashboard and Karyawan together on /app/employees). The
// rule is "the longest matching href wins", computed once so every item agrees on the winner.

export function resolveActiveHref(items: readonly { href: string }[], path: string): string | null {
  return items.reduce<string | null>((best, item) => {
    const matches = path === item.href || path.startsWith(`${item.href}/`);
    if (!matches) return best;
    return best === null || item.href.length > best.length ? item.href : best;
  }, null);
}

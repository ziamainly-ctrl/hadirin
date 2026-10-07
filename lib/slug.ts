// Pure string helper — no 'server-only' import, unit-testable directly.

/** Lowercase, ASCII, dash-separated, truncated to fit organizations.slug VARCHAR(60). */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Pure phone normalization — no 'server-only' import, unit-testable directly.

/** "08…" → "+628…"; "+62…" kept; anything else that isn't a plausible ID number → null. */
export function normalizePhone(input: string): string | null {
  const trimmed = input.replace(/[\s-]/g, '');
  if (/^\+62\d{8,13}$/.test(trimmed)) return trimmed;
  if (/^08\d{7,12}$/.test(trimmed)) return `+62${trimmed.slice(1)}`;
  if (/^62\d{8,13}$/.test(trimmed)) return `+${trimmed}`;
  return null;
}

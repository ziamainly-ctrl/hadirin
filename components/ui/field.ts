/**
 * Shared look of Input, Select and Textarea so the three can't drift apart. Border color
 * comes from `fieldBorderClass` because the error state swaps it; the dark fill is a faint
 * lift off the card (shadcn's dark:bg-input/30) rather than the card color itself, so an
 * empty field is still visibly a field on a dark surface.
 */
export const FIELD_CLASSES =
  'rounded-input border bg-transparent px-3 text-sm text-text shadow-xs transition-colors placeholder:text-muted focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30';

export function fieldBorderClass(error?: string): string {
  return error ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30' : 'border-input';
}

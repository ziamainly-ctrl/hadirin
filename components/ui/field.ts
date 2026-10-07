/**
 * Shared look of Input, Select and Textarea so the three can't drift apart. Border color comes
 * from `fieldBorderClass` because the error state swaps it; its default is the `field` token
 * (app/globals.css), the one boundary strong enough for WCAG 1.4.11's 3:1 on the card gradient.
 * The dark fill is a faint lift off the card (shadcn's dark:bg-input/30) rather than the card
 * color itself, so an empty field is still visibly a field on a dark surface.
 *
 * text-base below md, text-sm from md (the shadcn input does the same): iOS Safari zooms
 * the whole page into any focused field whose text is under 16px, and stays zoomed after
 * the keyboard closes — every filter and form on a phone did that at 14px.
 */
export const FIELD_CLASSES =
  'rounded-input border bg-transparent px-3 text-base text-text md:text-sm shadow-xs transition-colors placeholder:text-muted focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30';

export function fieldBorderClass(error?: string): string {
  return error ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30' : 'border-field';
}

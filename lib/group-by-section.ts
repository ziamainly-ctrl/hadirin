// Pure helper for the sidebar (components/shared/Sidebar.tsx): splits a flat nav list into
// consecutive runs that share a `section`. Kept out of the 'use client' component so the
// grouping rule is unit-testable (tests/group-by-section.test.ts).

export interface SectionGroup<T> {
  /** undefined for items that carry no section (they render without a heading). */
  section?: string;
  items: T[];
}

/**
 * Groups CONSECUTIVE items with the same `section`, keeping the original order. A section that
 * reappears later starts a new group (the nav order is the source of truth, never reshuffled),
 * and items without a section form their own heading-less group.
 */
export function groupBySection<T extends { section?: string }>(items: readonly T[]): SectionGroup<T>[] {
  const groups: SectionGroup<T>[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.section === item.section) {
      last.items.push(item);
    } else {
      groups.push({ section: item.section, items: [item] });
    }
  }
  return groups;
}

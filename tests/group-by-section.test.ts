import { describe, expect, it } from 'vitest';
import { groupBySection } from '@/lib/group-by-section';

describe('groupBySection', () => {
  it('returns no groups for an empty list', () => {
    expect(groupBySection([])).toEqual([]);
  });

  it('keeps the original order and groups consecutive items of one section', () => {
    const groups = groupBySection([
      { id: 1, section: 'Utama' },
      { id: 2, section: 'Utama' },
      { id: 3, section: 'Absensi' },
    ]);
    expect(groups.map((g) => [g.section, g.items.map((i) => i.id)])).toEqual([
      ['Utama', [1, 2]],
      ['Absensi', [3]],
    ]);
  });

  it('puts everything in one group when all items share a section', () => {
    const groups = groupBySection([{ section: 'Akun' }, { section: 'Akun' }, { section: 'Akun' }]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.items).toHaveLength(3);
  });

  it('gives items without a section a heading-less group of their own', () => {
    const groups = groupBySection([{ id: 1 }, { id: 2 }, { id: 3, section: 'Sistem' }, { id: 4 }]);
    expect(groups.map((g) => g.section)).toEqual([undefined, 'Sistem', undefined]);
    expect(groups[0]?.items.map((i) => i.id)).toEqual([1, 2]);
  });

  it('starts a new group when a section reappears later instead of reshuffling the list', () => {
    const groups = groupBySection([
      { id: 1, section: 'A' },
      { id: 2, section: 'B' },
      { id: 3, section: 'A' },
    ]);
    expect(groups.map((g) => g.section)).toEqual(['A', 'B', 'A']);
  });

  it('does not mutate its input', () => {
    const input = [{ id: 1, section: 'A' }, { id: 2, section: 'A' }];
    const copy = structuredClone(input);
    groupBySection(input);
    expect(input).toEqual(copy);
  });
});

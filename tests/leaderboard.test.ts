import { describe, it, expect } from 'vitest';
import { computeStreaks, parseStatuses, podium, rankEmployees } from '../lib/insights/leaderboard';

const src = (userId: number, name: string, statuses: string) => ({ userId, name, branchName: null, statuses });

describe('lib/insights/leaderboard', () => {
  it('parseStatuses tolerates empty input', () => {
    expect(parseStatuses('')).toEqual([]);
    expect(parseStatuses(null)).toEqual([]);
    expect(parseStatuses('PRESENT, LATE')).toEqual(['PRESENT', 'LATE']);
  });

  it('computeStreaks: late and absent reset the run, excused days are skipped', () => {
    expect(computeStreaks(['PRESENT', 'PRESENT', 'LATE', 'PRESENT'])).toEqual({ current: 1, best: 2 });
    expect(computeStreaks(['PRESENT', 'LEAVE', 'HOLIDAY', 'PRESENT'])).toEqual({ current: 2, best: 2 });
    expect(computeStreaks(['PRESENT', 'PRESENT', 'ABSENT'])).toEqual({ current: 0, best: 2 });
    expect(computeStreaks([])).toEqual({ current: 0, best: 0 });
  });

  it('ranks by on-time share, then fewer absences, then fewer late days', () => {
    const board = rankEmployees([
      src(1, 'Ayu', 'PRESENT,PRESENT,PRESENT,PRESENT'),
      src(2, 'Budi', 'PRESENT,PRESENT,PRESENT,LATE'),
      src(3, 'Citra', 'PRESENT,PRESENT,LATE,LATE'),
      src(4, 'Dewi', 'PRESENT,PRESENT,PRESENT,ABSENT'),
    ]);
    expect(board.ranked.map((e) => e.name)).toEqual(['Ayu', 'Budi', 'Dewi', 'Citra']);
    // Budi and Dewi are both 75% on time; Budi was late once, Dewi missed a day: Budi ranks first.
  });

  it('ties share a rank (competition ranking)', () => {
    const board = rankEmployees([
      src(1, 'Ayu', 'PRESENT,PRESENT,PRESENT'),
      src(2, 'Budi', 'PRESENT,PRESENT,PRESENT'),
      src(3, 'Citra', 'PRESENT,PRESENT,LATE'),
    ]);
    expect(board.ranked.map((e) => [e.name, e.rank])).toEqual([
      ['Ayu', 1],
      ['Budi', 1],
      ['Citra', 3],
    ]);
  });

  it('excused days are not counted against anyone', () => {
    const board = rankEmployees([src(1, 'Ayu', 'PRESENT,PRESENT,PRESENT,SICK,LEAVE,HOLIDAY')]);
    const ayu = board.ranked[0]!;
    expect(ayu.obligated).toBe(3);
    expect(ayu.excused).toBe(3);
    expect(ayu.onTimePct).toBe(100);
  });

  it('people with too few counted days are listed but unranked; minDays shrinks in a young month', () => {
    const board = rankEmployees([
      src(1, 'Ayu', 'PRESENT,PRESENT,PRESENT,PRESENT'),
      src(2, 'Budi', 'PRESENT'),
      src(3, 'Citra', ''),
    ]);
    expect(board.minDays).toBe(3);
    expect(board.ranked.map((e) => e.name)).toEqual(['Ayu']);
    expect(board.unranked.map((e) => e.name)).toEqual(['Budi', 'Citra']);

    const young = rankEmployees([src(1, 'Ayu', 'PRESENT'), src(2, 'Budi', 'LATE'), src(3, 'Citra', '')]);
    expect(young.minDays).toBe(1);
    expect(young.ranked.map((e) => e.name)).toEqual(['Ayu', 'Budi']);
    expect(young.unranked.map((e) => e.name)).toEqual(['Citra']);
  });

  it('nobody has counted days: everyone is unranked, nothing throws', () => {
    const board = rankEmployees([src(1, 'Ayu', ''), src(2, 'Budi', 'SICK')]);
    expect(board.ranked).toEqual([]);
    expect(board.unranked).toHaveLength(2);
    expect(podium(board)).toEqual([]);
  });

  it('podium returns at most three ranked people', () => {
    const board = rankEmployees([
      src(1, 'A', 'PRESENT,PRESENT,PRESENT'),
      src(2, 'B', 'PRESENT,PRESENT,PRESENT'),
      src(3, 'C', 'PRESENT,PRESENT,PRESENT'),
      src(4, 'D', 'PRESENT,PRESENT,PRESENT'),
    ]);
    expect(podium(board)).toHaveLength(3);
  });

  it('seed fixture: Monday and Tuesday of the ERD seed week', () => {
    // Org 1, 2026-10-05 and 10-06: Dewi was late on the 6th; Ayu was on time both days.
    const board = rankEmployees([src(6, 'Ayu Rahmawati', 'PRESENT,PRESENT'), src(3, 'Dewi Lestari', 'PRESENT,LATE')]);
    expect(board.ranked.map((e) => [e.name, e.onTimePct, e.streak])).toEqual([
      ['Ayu Rahmawati', 100, 2],
      ['Dewi Lestari', 50, 0],
    ]);
  });
});

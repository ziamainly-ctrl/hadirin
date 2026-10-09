// URL builder for /app/statistik, shared by the period chips (server) and the branch picker (client).

export const PERIOD_OPTIONS = [7, 30, 90] as const;
export type StatistikDays = (typeof PERIOD_OPTIONS)[number];
export const DEFAULT_DAYS: StatistikDays = 30;

export function parseDays(raw: string | undefined): StatistikDays {
  const n = Number(raw);
  return (PERIOD_OPTIONS as readonly number[]).includes(n) ? (n as StatistikDays) : DEFAULT_DAYS;
}

export function statistikHref(state: { days?: number; branchId?: number | string }): string {
  const params = new URLSearchParams();
  if (state.days !== undefined && state.days !== DEFAULT_DAYS) params.set('days', String(state.days));
  if (state.branchId !== undefined && state.branchId !== '') params.set('branchId', String(state.branchId));
  const query = params.toString();
  return query ? `/app/statistik?${query}` : '/app/statistik';
}

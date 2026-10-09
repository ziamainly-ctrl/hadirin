// URL of the calendar page for a month / branch / opened day. Pure, used by the server page, the
// grid links and the client filters, so every link agrees on the parameter names.

export interface CalendarUrlState {
  month?: string;
  branchId?: number | string;
  day?: string;
}

export function calendarHref(state: CalendarUrlState): string {
  const params = new URLSearchParams();
  if (state.month) params.set('month', state.month);
  if (state.branchId !== undefined && state.branchId !== '') params.set('branchId', String(state.branchId));
  if (state.day) params.set('day', state.day);
  const query = params.toString();
  return query ? `/app/kalender?${query}` : '/app/kalender';
}

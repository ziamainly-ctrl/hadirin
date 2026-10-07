import 'server-only';

export class CronAuthError extends Error {}

/** TRD.md §6/§12 — `Authorization: Bearer $CRON_SECRET`, checked by both cron routes. */
export function requireCronSecret(request: Request): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error('CRON_SECRET is not set. See .env.example.');
  const header = request.headers.get('authorization');
  if (header !== `Bearer ${secret}`) {
    throw new CronAuthError('Invalid cron secret');
  }
}

/** Splits an array into fixed-size batches (TRD.md §12: "processes orgs in batches of 50"). */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

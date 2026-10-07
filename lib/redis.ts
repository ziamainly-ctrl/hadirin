import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set. See .env.example.');
}

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

/** Read-through cache (TRD.md §10). `loader` runs only on a miss. */
export async function cached<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
  const hit = await redis.get<T>(key);
  if (hit !== null && hit !== undefined) return hit;
  const value = await loader();
  if (value !== null && value !== undefined) {
    await redis.set(key, value, { ex: ttlSeconds });
  }
  return value;
}

/** Deletes one or more cache keys. No-op on an empty list. */
export async function bust(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await redis.del(...keys);
}

// ---------- Cache key builders (TRD.md §10) ----------
export const cacheKeys = {
  orgCtx: (orgId: number) => `org:${orgId}:ctx`,
  orgMaster: (orgId: number) => `org:${orgId}:master`,
  userCtx: (userId: number) => `user:${userId}:ctx`,
  platformAdminCtx: (adminId: number) => `platform-admin:${adminId}:ctx`,
  dashboard: (orgId: number, date: string) => `dash:${orgId}:${date}`,
  plansPublic: () => 'plans:public',
  paymentMethodsActive: () => 'paymethods:active',
  template: (orgId: number | null, event: string, channel: string) => `tpl:${orgId ?? 0}:${event}:${channel}`,
};

// ---------- Rate limiters (TRD.md §10) ----------
export const loginRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '10 m'),
  prefix: 'rl:login',
});

export const checkinRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  prefix: 'rl:checkin',
});

/** Open self-serve signup (PRD.md S3) — not in the original TRD.md §10 table, added
 * alongside the register route for the same abuse-prevention reason as rl:login. */
export const registerRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '10 m'),
  prefix: 'rl:register',
});

/** Webhook/cron idempotency guard. True the first time a key is claimed, false on a repeat. */
export async function claimIdempotencyKey(key: string, ttlSeconds: number): Promise<boolean> {
  const result = await redis.set(key, '1', { nx: true, ex: ttlSeconds });
  return result === 'OK';
}

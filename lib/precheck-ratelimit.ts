import { Ratelimit } from '@upstash/ratelimit';
import { redis } from './redis';

/** POST /api/attendance/precheck: 30 per minute per user (TRD.md §10, `rl:precheck:{user}`). The
 * screen asks when the position moves or every 30 s, so a normal session stays far under it. */
export const precheckRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 m'),
  prefix: 'rl:precheck',
});

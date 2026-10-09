import { Ratelimit } from '@upstash/ratelimit';
import { redis } from './redis';

/** POST /api/uploads: 20 per minute per user (TRD.md §10, `rl:upload:{user}`). A punch uploads one selfie, so a
 * person never gets near it; it only stops a client from filling the private Blob store in a loop. */
export const uploadRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'),
  prefix: 'rl:upload',
});

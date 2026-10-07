import ws from 'ws';
import { neon, neonConfig, Pool, type PoolClient } from '@neondatabase/serverless';

// Node has no stable global WebSocket until v22; TRD.md §16 pins Node 20.9+ as the
// minimum, so Pool (used by withTx below) needs the `ws` polyfill to open its
// WebSocket-based connection at all in this runtime (scripts/db-{migrate,seed,reset-demo}.ts
// need the same polyfill for the same reason — keep this in sync with those).
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. See .env.example.');
}

/** HTTP driver for single queries and fixed sql.transaction([...]) batches. TRD.md §5. */
export const sql = neon(process.env.DATABASE_URL);

/**
 * Pool-backed transaction for writes that read a result and then branch on it
 * (registration, request approval, invoice settlement). TRD.md §5.
 */
export async function withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

/** Thrown by query functions when a tenant-scoped row is not found for the given org. */
export class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

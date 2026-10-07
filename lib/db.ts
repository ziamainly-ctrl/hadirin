import ws from 'ws';
import { neon, neonConfig, Pool } from '@neondatabase/serverless';
import { coerceNumericStrings } from './coerce-numeric';

// Node has no stable global WebSocket until v22; TRD.md §16 pins Node 20.9+ as the
// minimum, so Pool (used by withTx below) needs the `ws` polyfill to open its
// WebSocket-based connection at all in this runtime (scripts/db-{migrate,seed,reset-demo}.ts
// need the same polyfill for the same reason — keep this in sync with those).
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. See .env.example.');
}

// See lib/coerce-numeric.ts for why every query result goes through coerceNumericStrings
// (bigint-as-string from @neondatabase/serverless) — kept in its own pure module so it's
// unit-testable (tests/coerce-numeric.test.ts) without this file's DATABASE_URL guard.

/** Unwrapped HTTP driver — only for building `rawSql.transaction([...])` batches
 * (lib/queries/plans.ts, payment-methods.ts reorder functions), whose array elements
 * must be this driver's own lazy query-builder objects, not a coercing wrapper's.
 * Those two call sites discard the transaction's resolved rows anyway (`Promise<void>`),
 * so they don't need coercion. Every other query goes through `sql` below. */
export const rawSql = neon(process.env.DATABASE_URL);

/**
 * HTTP driver for single queries (TRD.md §5), auto-coercing bigint-as-string results.
 * Returns `any[]`, like the driver it wraps — every one of the 14 query files already
 * immediately re-casts the result to its own named row interface (`as Foo[]`), the
 * established convention throughout this codebase (TRD.md §5 "Data access pattern").
 * `Record<string, unknown>` looks safer but isn't: TypeScript's `as` rejects a cast from
 * an index-signature type to a concrete interface as insufficiently overlapping, which
 * would force every one of those ~30 call sites onto `as unknown as Foo[]` instead —
 * more invasive than the thing it's guarding against.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- see comment above */
export const sql = {
  query: async (text: string, params: unknown[] = []): Promise<any[]> => {
    const result = await rawSql.query(text, params as never[]);
    return coerceNumericStrings(result);
  },
};

/** Narrow interface withTx() callbacks need — just enough of PoolClient to run
 * parameterized queries inside the transaction, with the same coercion as `sql` above. */
export interface TxClient {
  query(text: string, params?: unknown[]): Promise<{ rows: any[] }>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Pool-backed transaction for writes that read a result and then branch on it
 * (registration, request approval, invoice settlement). TRD.md §5.
 */
export async function withTx<T>(fn: (client: TxClient) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  const txClient: TxClient = {
    query: async (text, params = []) => {
      const result = await client.query(text, params as never[]);
      return { rows: coerceNumericStrings(result.rows) };
    },
  };
  try {
    await client.query('BEGIN');
    const out = await fn(txClient);
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

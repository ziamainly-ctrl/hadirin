// Applies drizzle/*.sql in order against DATABASE_URL_UNPOOLED (TRD.md §17).
import 'dotenv/config';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import ws from 'ws';
import { neonConfig, Pool } from '@neondatabase/serverless';

neonConfig.webSocketConstructor = ws;

async function main() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED (or DATABASE_URL) is not set.');

  const dir = join(process.cwd(), 'drizzle');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    for (const file of files) {
      const { rows } = await client.query('SELECT 1 FROM _migrations WHERE name = $1', [file]);
      if (rows.length > 0) {
        console.log(`skip  ${file} (already applied)`);
        continue;
      }
      const raw = readFileSync(join(dir, file), 'utf8');
      const statements = raw
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter(Boolean);
      console.log(`apply ${file} (${statements.length} statement(s))`);
      await client.query('BEGIN');
      try {
        for (const statement of statements) {
          await client.query(statement);
        }
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }
    console.log('Migrations up to date.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

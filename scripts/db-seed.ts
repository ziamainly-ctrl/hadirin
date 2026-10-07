// Runs db/seed.sql, substituting {{DEMO_PASSWORD_HASH}} with bcrypt(DEMO_PASSWORD).
// Idempotent — every INSERT in db/seed.sql uses ON CONFLICT DO NOTHING (ERD.md §4).
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import ws from 'ws';
import { neonConfig, Pool } from '@neondatabase/serverless';

neonConfig.webSocketConstructor = ws;
import bcrypt from 'bcryptjs';

async function main() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED (or DATABASE_URL) is not set.');

  const demoPassword = process.env.DEMO_PASSWORD ?? 'Hadirin2026!';
  const hash = await bcrypt.hash(demoPassword, 12);

  const raw = readFileSync(join(process.cwd(), 'db', 'seed.sql'), 'utf8');
  // Plain literal substitution — bcrypt hashes contain "$" separators, but split/join
  // (unlike String.replace with a string pattern) never treats "$" specially.
  const sql = raw.split('{{DEMO_PASSWORD_HASH}}').join(hash);

  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log(`Seed applied. Demo password: ${demoPassword}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

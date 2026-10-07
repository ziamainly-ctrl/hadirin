// Truncates transactional tables (ERD.md §1) and reseeds. Demo convenience only.
import 'dotenv/config';
import ws from 'ws';
import { neonConfig, Pool } from '@neondatabase/serverless';

neonConfig.webSocketConstructor = ws;
import { execFileSync } from 'child_process';

const TRANSACTIONAL_TABLES = [
  'notification_logs',
  'payment_logs',
  'invoices',
  'attendance_logs',
  'attendance_requests',
] as const;

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('db:reset-demo refuses to run with NODE_ENV=production.');
  }
  const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED (or DATABASE_URL) is not set.');

  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    console.log(`Truncating: ${TRANSACTIONAL_TABLES.join(', ')}`);
    // No CASCADE: every FK among these 5 tables is ON DELETE SET NULL and all referencing
    // tables are already in this list, so a plain multi-table TRUNCATE is enough and
    // can't reach outside this set (e.g. it won't ever touch `users`).
    await client.query(`TRUNCATE TABLE ${TRANSACTIONAL_TABLES.join(', ')} RESTART IDENTITY`);
  } finally {
    client.release();
    await pool.end();
  }

  console.log('Reseeding...');
  execFileSync('npx', ['tsx', 'scripts/db-seed.ts'], { stdio: 'inherit' });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// Pure password helpers — no 'server-only'/next/headers import, so they're unit-testable
// directly (vitest can't resolve the 'server-only' sentinel Next.js provides at build time).

import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/** Readable one-time password shown to an admin exactly once (TRD.md §6). */
export function generateTemporaryPassword(length = 10): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += TEMP_PASSWORD_ALPHABET[randomInt(TEMP_PASSWORD_ALPHABET.length)];
  }
  return out;
}

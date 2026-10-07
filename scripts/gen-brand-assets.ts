/**
 * Regenerates the static brand files that can't import lib/brand/mascot.ts at runtime:
 *   app/icon.svg     the browser-tab favicon (Next's file convention serves it)
 *   public/icon.svg  the same drawing at a stable literal URL, for the PWA manifest
 * Run `npm run brand:generate` after editing lib/brand/mascot.ts. tests/brand-assets.test.ts
 * fails when either file is out of date, so a stale icon can't ship unnoticed.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { faviconSvg } from '../lib/brand/assets';

const svg = faviconSvg();
for (const target of ['app/icon.svg', 'public/icon.svg']) {
  writeFileSync(join(process.cwd(), target), svg);
  console.log(`wrote ${target} (${svg.length} bytes)`);
}

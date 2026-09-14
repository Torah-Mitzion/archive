/* Type-checks every edge function with Deno itself — the runtime's own checker.
 *
 *   node scripts/check-functions.mjs
 *
 * `supabase functions deploy --use-api` bundles without type-checking, and a
 * call to a function that no longer exists sails through to production. It
 * did: drainBacklog() was deleted in a rewrite, the call to it stayed, and
 * every photograph's re-screening threw into a console.error nobody could
 * read. `deno check` would have refused to compile it. Run this before every
 * deploy; smoke.mjs runs it first. */
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'supabase/functions';
let failed = 0;
for (const dir of readdirSync(ROOT)) {
  if (dir.startsWith('_') || !statSync(join(ROOT, dir)).isDirectory()) continue;
  if (!existsSync(join(ROOT, dir, 'index.ts'))) continue;
  const r = spawnSync('npx', ['--yes', 'deno', 'check', `${dir}/index.ts`],
    { cwd: ROOT, shell: true, encoding: 'utf8' });
  const out = (r.stdout + r.stderr).replace(/\x1b\[[0-9;]*m/g, '');
  if (r.status === 0) { console.log(`ok   ${dir}`); continue; }
  failed++;
  console.log(`FAIL ${dir}`);
  for (const line of out.split('\n')) if (/TS\d+ \[ERROR\]|at file:/.test(line)) console.log('     ' + line.trim());
}
process.exit(failed ? 1 : 0);

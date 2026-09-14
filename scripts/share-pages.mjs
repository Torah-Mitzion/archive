/* Writes docs/p/<id>.html for every published photograph — the page a
   messenger reads when a link to that photograph is shared, with the
   photograph as its preview image and a redirect to the year page. The
   edge functions write these themselves when a GITHUB_TOKEN is configured;
   this catches up on everything else. Fetches each page from the deployed
   tmz-share function so there is exactly one template.

     node scripts/share-pages.mjs        # writes missing/changed pages, then commit + push */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const line of readFileSync(join(ROOT, '.env.supabase'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const U = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const rows = await (await fetch(`${U}/rest/v1/tmz_photo?select=id&status=eq.approved&public_path=not.is.null&year=not.is.null&community_id=not.is.null`,
  { headers: { apikey: K, Authorization: `Bearer ${K}` } })).json();
mkdirSync(join(ROOT, 'docs/p'), { recursive: true });
let written = 0;
for (const { id } of rows) {
  const res = await fetch(`${U}/functions/v1/tmz-share?p=${id}`, { redirect: 'manual' });
  if (res.status !== 200) { console.log('skip', id, res.status); continue; }
  const html = await res.text();
  const path = join(ROOT, 'docs/p', `${id}.html`);
  if (existsSync(path) && readFileSync(path, 'utf8') === html) continue;
  writeFileSync(path, html); written++;
  await fetch(`${U}/rest/v1/tmz_photo?id=eq.${id}`, { method: 'PATCH',
    headers: { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ share_page_at: new Date().toISOString() }) });
}
console.log(`${rows.length} published, ${written} page(s) written`);

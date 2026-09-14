/* Removes a community that holds nothing: no tenures, no photographs. Refuses
   otherwise, because a community with a roster or a photograph is a page
   people may have been sent to.

     node scripts/remove-community.mjs <slug> [<slug>…] */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
function loadEnv(p) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnv(join(ROOT, '.env.supabase'));
const REST = `${process.env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1`;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function pg(path, init = {}) {
  const res = await fetch(`${REST}${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'count=exact' }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} → ${res.status} ${text}`);
  return { body: text ? JSON.parse(text) : null, count: +(res.headers.get('content-range') || '').split('/')[1] };
}

for (const slug of process.argv.slice(2)) {
  const { body } = await pg(`/tmz_community?select=id&slug=eq.${slug}`);
  if (!body.length) { console.log(`${slug}: not found`); continue; }
  const id = body[0].id;
  const tenures = (await pg(`/tmz_tenure?select=id&community_id=eq.${id}&limit=1`)).count;
  const photos = (await pg(`/tmz_photo?select=id&community_id=eq.${id}&limit=1`)).count;
  if (tenures || photos) { console.log(`${slug}: holds ${tenures} tenures, ${photos} photographs — left alone`); continue; }
  await pg(`/tmz_community?id=eq.${id}`, { method: 'DELETE' });
  console.log(`${slug}: removed`);
}

/* Gives every person a name in all six site languages.
 *
 * The register carries Hebrew, and names-first/last.json carry the English
 * transliteration. French, German and Spanish readers see the same Latin
 * spelling (that is how these names are written in those countries' Jewish
 * communities), so those get the English form. Russian gets a Cyrillic
 * transliteration by rule from the English — good enough to read, and the
 * back office's translation view is where a native speaker corrects one.
 *
 *   node scripts/fill-person-translations.mjs           # dry run
 *   node scripts/fill-person-translations.mjs --write   # only fills what is missing
 *   node scripts/fill-person-translations.mjs --write --overwrite-ru */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--write'), OVER_RU = process.argv.includes('--overwrite-ru');
function loadEnv(p) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnv(join(ROOT, '.env.supabase'));
const REST = `${process.env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1`, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
async function pg(path, init = {}) {
  const res = await fetch(`${REST}${path}`, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(init.prefer ? { Prefer: init.prefer } : {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} → ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

/* Latin → Cyrillic, tuned for Hebrew names as they are written in English.
   Longest match first; a capital in the source capitalises the output. */
const RULES = [
  ['shch', 'щ'], ['tsch', 'ч'], ['sch', 'ш'], ['tch', 'ч'],
  ['sh', 'ш'], ['ch', 'х'], ['kh', 'х'], ['zh', 'ж'], ['tz', 'ц'], ['ts', 'ц'], ['th', 'т'], ['ph', 'ф'], ['ck', 'к'],
  ['ya', 'я'], ['yu', 'ю'], ['yo', 'йо'], ['ye', 'е'], ['yi', 'и'],
  ['ai', 'ай'], ['ei', 'ей'], ['oi', 'ой'], ['ui', 'уй'], ['ou', 'у'], ['oo', 'у'], ['ee', 'и'], ['ie', 'ие'], ['ia', 'иа'],
  ['a', 'а'], ['b', 'б'], ['c', 'к'], ['d', 'д'], ['e', 'е'], ['f', 'ф'], ['g', 'г'], ['h', 'х'], ['i', 'и'], ['j', 'дж'],
  ['k', 'к'], ['l', 'л'], ['m', 'м'], ['n', 'н'], ['o', 'о'], ['p', 'п'], ['q', 'к'], ['r', 'р'], ['s', 'с'], ['t', 'т'],
  ['u', 'у'], ['v', 'в'], ['w', 'в'], ['x', 'кс'], ['y', 'й'], ['z', 'з']
];
export function toCyrillic(name) {
  let out = '';
  const s = name;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (!/[a-z]/i.test(ch)) { out += ch; i++; continue; }
    const lower = s.slice(i).toLowerCase();
    let hit = null;
    for (const [lat, cyr] of RULES) if (lower.startsWith(lat)) { hit = [lat, cyr]; break; }
    const [lat, cyr] = hit;
    // a trailing silent h (Noah, Sarah) stays as х only when it follows a consonant
    const atEnd = i + lat.length === s.length || /[^a-z]/i.test(s[i + lat.length] ?? ' ');
    let piece = cyr;
    if (lat === 'h' && atEnd && /[aeiou]/i.test(s[i - 1] ?? '')) piece = '';
    if (/[A-Z]/.test(ch) && piece) piece = piece[0].toUpperCase() + piece.slice(1);
    out += piece; i += lat.length;
  }
  return out.replace(/z"l|hy"d/g, m => m === 'z"l' ? 'з"л' : 'хй"д');
}

const rows = [];
for (let off = 0; ; off += 1000) {   // PostgREST caps a page at 1,000
  const page = await pg(`/tmz_person?select=id,tmz_person_tr(lang,display_name)&order=id&offset=${off}&limit=1000`);
  rows.push(...page); if (page.length < 1000) break;
}
const inserts = [];
for (const p of rows) {
  const have = Object.fromEntries((p.tmz_person_tr || []).map(t => [t.lang, t.display_name]));
  const en = have.en; if (!en) continue;
  for (const l of ['fr', 'de', 'es']) if (!have[l]) inserts.push({ person_id: p.id, lang: l, display_name: en });
  if (!have.ru || OVER_RU) inserts.push({ person_id: p.id, lang: 'ru', display_name: toCyrillic(en) });
}
console.log(`${rows.length} people, ${inserts.length} translations to write`);
console.log('sample:', inserts.filter(x => x.lang === 'ru').slice(0, 8).map(x => x.display_name).join(' | '));
if (!WRITE) process.exit(0);
for (let i = 0; i < inserts.length; i += 500) {
  await pg('/tmz_person_tr?on_conflict=person_id,lang', { method: 'POST', prefer: 'resolution=merge-duplicates', body: JSON.stringify(inserts.slice(i, i + 500)) });
}
console.log('done');

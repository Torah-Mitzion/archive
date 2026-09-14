/* Loads the organisation's shlichim register (scripts/shlichim.tsv, exported
   from their spreadsheet) as THE roster: every existing person and tenure is
   deleted first, and what the file says is what the archive says.

   The file has five columns — last name, first name, Hebrew years, main
   community, kind of shaliach — and no more. Everything else here is
   derived, and says so:

   - Years: Hebrew year → the Gregorian year the academic year began
     (תשס"ז = 5767 → 2006, shown on the site as 2006–07). A run of
     consecutive years is one tenure; a gap splits it.
   - Roles: ראש כולל / ראש משלחת → rosh_kollel; בחור, אברך, קמפוסים,
     משפחה תומ"צ → shaliach; מדרשת ציון → shlicha (from Midreshet Zion);
     ראשת מדרשה / ראש בית מדרש → staff. "א. ראש כולל" is the Rosh Kollel's wife.
   - Couples: the file lists a wife on her own row under her husband's kind.
     Two rows in one community, same surname, overlapping years, one man and
     one woman → she is recorded as his spouse, in his household. Gender comes
     from scripts/names-first.json, which also carries the transliterations;
     names it cannot sex are paired only when the partner's sex settles it.
   - English names are transliterations (names-first.json, names-last.json),
     written as the 'en' translation; Hebrew is the 'he' translation.
   - Communities not yet in the archive are created from
     scripts/communities-file.json; a community's span is the first and last
     year anyone served there (open if that reaches the current year).

   Run with  node scripts/import-shlichim.mjs          (dry run: prints what it would do)
             node scripts/import-shlichim.mjs --write  (does it) */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--write');
const CURRENT_YEAR = 2026;

function loadEnv(p) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnv(join(ROOT, '.env.supabase'));
const URL_BASE = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const REST = `${URL_BASE.replace(/\/$/, '')}/rest/v1`;

async function pg(path, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${REST}${path}`, {
    method,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

/* ---- the file ------------------------------------------------------------ */

const FIRST = JSON.parse(readFileSync(join(ROOT, 'scripts/names-first.json'), 'utf8'));
const LAST = JSON.parse(readFileSync(join(ROOT, 'scripts/names-last.json'), 'utf8'));
const COMM = JSON.parse(readFileSync(join(ROOT, 'scripts/communities-file.json'), 'utf8'));

const clean = s => s.replace(/[‎‏‪-‮]/g, '').trim();
const lines = readFileSync(join(ROOT, 'scripts/shlichim.tsv'), 'utf8').split('\n').slice(1).filter(l => l.trim());
const rows = lines.map((l, i) => {
  const [last, first, years, community, kind] = l.split('\t').map(x => clean(x ?? ''));
  return { line: i + 2, last, first, years, community, kind };
});

/* Hebrew year letters → number; 5760 → 1999. Only the tens/units matter
   after תש (5700). */
const HE = { 'א':1,'ב':2,'ג':3,'ד':4,'ה':5,'ו':6,'ז':7,'ח':8,'ט':9,'י':10,'כ':20,'ל':30,'מ':40,'נ':50,'ס':60,'ע':70,'פ':80,'צ':90,'ק':100,'ר':200,'ש':300,'ת':400 };
function hebrewYear(s) {
  const letters = s.replace(/["'׳״\s]/g, '');
  let n = 0;
  for (const ch of letters) { if (!(ch in HE)) return null; n += HE[ch]; }
  return 5000 + n - 3761;     // תשס"ז: 400+300+60+7 = 767 → 5767 → 2006
}
function yearsOf(s) {
  const ys = s.split(/[;,]/).map(x => x.trim()).filter(Boolean).map(hebrewYear);
  if (ys.some(y => y == null)) throw new Error(`unreadable year in "${s}"`);
  return [...new Set(ys)].sort((a, b) => a - b);
}
/* [2007, 2008, 2009, 2012] → [[2007, 2009], [2012, 2012]] */
function runs(ys) {
  const out = [];
  for (const y of ys) {
    const r = out[out.length - 1];
    if (r && y === r[1] + 1) r[1] = y; else out.push([y, y]);
  }
  return out;
}

const KIND = {
  'ראש כולל': 'rosh_kollel', 'ראש משלחת': 'rosh_kollel',
  'בחור': 'shaliach', 'אברך': 'shaliach', 'קמפוסים': 'shaliach', 'משפחה תומ"צ': 'shaliach',
  'מדרשת ציון': 'shlicha',
  'ראשת מדרשה': 'staff', 'ראש בית מדרש': 'staff',
  'א. ראש כולל': 'spouse'
};
/* Kinds where the file lists a wife under her husband's title. */
const PAIRABLE = new Set(['ראש כולל', 'ראש משלחת', 'אברך', 'קמפוסים', 'משפחה תומ"צ', 'ראש בית מדרש', 'א. ראש כולל', 'ראשת מדרשה']);

/* ---- resolve names and places ------------------------------------------- */

function communitiesOf(name) {
  const a = COMM.aliases[name];
  if (a === 'skip') return [];
  if (a) return Array.isArray(a) ? a : [a];
  const created = Object.entries(COMM.create).find(([, c]) => c.he === name);
  if (created) return [created[0]];
  throw new Error(`no community mapping for "${name}"`);
}

const problems = [];
const entries = [];   // one per (row, community)
for (const r of rows) {
  if (!r.first || !r.last) { problems.push(`line ${r.line}: empty name`); continue; }
  if (!(r.kind in KIND)) { problems.push(`line ${r.line}: unknown kind "${r.kind}"`); continue; }
  const f = FIRST[r.first], l = LAST[r.last];
  if (!f) { problems.push(`line ${r.line}: no transliteration for first name "${r.first}"`); continue; }
  if (!l) { problems.push(`line ${r.line}: no transliteration for surname "${r.last}"`); continue; }
  let years;
  try { years = r.years ? yearsOf(r.years) : []; } catch (e) { problems.push(`line ${r.line}: ${e.message}`); continue; }
  if (!years.length) { problems.push(`line ${r.line}: ${r.first} ${r.last} (${r.community}) has no years — skipped`); continue; }
  let comms;
  try { comms = communitiesOf(r.community); } catch (e) { problems.push(`line ${r.line}: ${e.message}`); continue; }
  if (!comms.length) { problems.push(`line ${r.line}: ${r.first} ${r.last} listed under "${r.community}" — no place on the map, skipped`); continue; }
  for (const slug of comms) {
    entries.push({ ...r, en: `${f[0]} ${l}`, he: `${r.first} ${r.last}`, sex: f[1], years, slug, role: KIND[r.kind] });
  }
}

/* ---- couples --------------------------------------------------------------- */

const overlap = (a, b) => a.some(y => b.includes(y));
const byCommSurname = new Map();
for (const e of entries) {
  const k = `${e.slug}|${e.last}`;
  if (!byCommSurname.has(k)) byCommSurname.set(k, []);
  byCommSurname.get(k).push(e);
}
for (const group of byCommSurname.values()) {
  if (group.length < 2) continue;
  for (const e of group) {
    if (e.partner || !PAIRABLE.has(e.kind)) continue;
    const mate = group.find(o => o !== e && !o.partner && PAIRABLE.has(o.kind) && overlap(e.years, o.years)
      && ((e.sex === 'm' && o.sex !== 'm') || (e.sex === 'f' && o.sex !== 'f') || (e.sex === 'u' && o.sex !== 'u')));
    if (!mate) continue;
    // settle who is who: the man is the head of household in this register
    let man = e, woman = mate;
    if (e.sex === 'f' || (e.sex === 'u' && mate.sex === 'm')) { man = mate; woman = e; }
    if (man.sex === 'u') man.sex = 'm';
    if (woman.sex === 'u') woman.sex = 'f';
    man.partner = woman; woman.partner = man;
    woman.householdOf = man;
    // her own title stands when it is a title; a husband's title becomes "spouse"
    if (!['ראשת מדרשה'].includes(woman.kind)) woman.role = 'spouse';
    if (man.kind === 'א. ראש כולל') man.role = 'rosh_kollel';
  }
}
// an unpaired "wife of the Rosh Kollel" is still a shlicha in her own right
for (const e of entries) {
  if (e.role === 'spouse' && !e.householdOf) e.role = 'shlicha';
  if (e.role === 'shaliach' && e.sex === 'f') e.role = 'shlicha';
}

/* ---- people ------------------------------------------------------------------ */

const slugify = s => s.toLowerCase().replace(/z"l|hy"d/g, '').replace(/\(.*?\)/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const people = new Map();   // he full name → { slug, en, he }
const usedSlugs = new Set();
for (const e of entries) {
  if (people.has(e.he)) { e.person = people.get(e.he); continue; }
  let slug = slugify(e.en), n = 2;
  while (usedSlugs.has(slug)) slug = `${slugify(e.en)}-${n++}`;
  usedSlugs.add(slug);
  const p = { slug, en: e.en, he: e.he };
  people.set(e.he, p);
  e.person = p;
}

/* ---- communities --------------------------------------------------------------- */

const span = new Map();
for (const e of entries) {
  const s = span.get(e.slug) || { first: 9999, last: 0 };
  s.first = Math.min(s.first, e.years[0]); s.last = Math.max(s.last, e.years[e.years.length - 1]);
  span.set(e.slug, s);
}

/* ---- report ------------------------------------------------------------------- */

const tenures = entries.flatMap(e => runs(e.years).map(([a, b]) => ({ e, start: a, end: b })));
const couples = entries.filter(e => e.householdOf).length;
console.log(`${rows.length} rows → ${entries.length} entries, ${people.size} people, ${tenures.length} tenures, ${couples} spouses paired, ${span.size} communities`);
for (const p of problems) console.log('  ! ' + p);
const missingCreate = [...span.keys()].filter(s => COMM.create[s] == null && !Object.values(COMM.aliases).flat().includes(s));
if (missingCreate.length) { console.error('unmapped slugs', missingCreate); process.exit(1); }
if (process.env.PEEK) { for (const e of entries.filter(e => e.slug === process.env.PEEK)) console.log(e.years[0]+"-"+e.years.at(-1), e.role.padEnd(12), e.kind.padEnd(12), e.sex, e.en, e.householdOf ? "← " + e.householdOf.en : ""); }
if (!WRITE) { console.log('(dry run — add --write)'); process.exit(0); }

/* ---- write ---------------------------------------------------------------------- */

console.log('clearing tenures, people, photo-person links…');
await pg('/tmz_photo_person?person_id=not.is.null', { method: 'DELETE' });
await pg('/tmz_tenure?id=not.is.null', { method: 'DELETE' });
await pg('/tmz_person?id=not.is.null', { method: 'DELETE' });

console.log('communities…');
const existing = await pg('/tmz_community?select=id,slug,founded_year,closed_year');
const commId = new Map(existing.map(c => [c.slug, c.id]));
for (const [slug, s] of span) {
  const closed = s.last >= CURRENT_YEAR - 1 ? null : s.last;
  if (commId.has(slug)) {
    await pg(`/tmz_community?slug=eq.${slug}`, { method: 'PATCH', body: { founded_year: s.first, closed_year: closed } });
  } else {
    const c = COMM.create[slug];
    const [row] = await pg('/tmz_community', {
      method: 'POST', prefer: 'return=representation',
      body: [{ slug, region_id: c.region, lat: c.lat, lon: c.lon, founded_year: s.first, closed_year: closed }]
    });
    commId.set(slug, row.id);
    await pg('/tmz_community_tr?on_conflict=community_id,lang', {
      method: 'POST', prefer: 'resolution=merge-duplicates',
      body: [{ community_id: row.id, lang: 'en', name: c.en }, { community_id: row.id, lang: 'he', name: c.he }]
    });
  }
}
// the register calls it New York, and so does everyone
const ny = commId.get('manhattan');
if (ny) await pg('/tmz_community_tr?on_conflict=community_id,lang', {
  method: 'POST', prefer: 'resolution=merge-duplicates',
  body: [{ community_id: ny, lang: 'en', name: 'New York' }, { community_id: ny, lang: 'he', name: 'ניו יורק' }]
});

console.log('people…');
const personRows = [...people.values()].map(p => ({ slug: p.slug }));
const personIds = new Map();
for (let i = 0; i < personRows.length; i += 200) {
  const out = await pg('/tmz_person', { method: 'POST', prefer: 'return=representation', body: personRows.slice(i, i + 200) });
  for (const r of out) personIds.set(r.slug, r.id);
}
const trRows = [...people.values()].flatMap(p => [
  { person_id: personIds.get(p.slug), lang: 'en', display_name: p.en },
  { person_id: personIds.get(p.slug), lang: 'he', display_name: p.he }
]);
for (let i = 0; i < trRows.length; i += 400) await pg('/tmz_person_tr', { method: 'POST', body: trRows.slice(i, i + 400) });

console.log('tenures…');
const midreshet = (await pg('/tmz_institution_tr?select=institution_id&name=eq.Midreshet%20Zion&limit=1'))?.[0]?.institution_id ?? null;
const tenureId = new Map();   // entry → id of its FIRST tenure (households hang off it)
const heads = tenures.filter(t => !t.e.householdOf), kin = tenures.filter(t => t.e.householdOf);
const mk = t => ({
  person_id: personIds.get(t.e.person.slug), community_id: commId.get(t.e.slug),
  role: t.e.role, start_year: t.start, end_year: t.end,
  institution_id: t.e.kind === 'מדרשת ציון' ? midreshet : null,
  household_of: t.e.householdOf ? (tenureId.get(t.e.householdOf) ?? null) : null
});
for (let i = 0; i < heads.length; i += 300) {
  const chunk = heads.slice(i, i + 300);
  const out = await pg('/tmz_tenure', { method: 'POST', prefer: 'return=representation', body: chunk.map(mk) });
  chunk.forEach((t, j) => { if (!tenureId.has(t.e)) tenureId.set(t.e, out[j].id); });
}
for (let i = 0; i < kin.length; i += 300) await pg('/tmz_tenure', { method: 'POST', body: kin.slice(i, i + 300).map(mk) });

console.log('done.');

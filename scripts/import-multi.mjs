/* Adds the second (and third) postings of people who served more than once.
   scripts/shlichim-multi.tsv is the organisation's list of exactly those
   people, one row per posting: surname, first name, gender, kind, community,
   Hebrew years. Their phone numbers and e-mails were in the spreadsheet and
   are deliberately not here - the register is public.

   The main register carried one "main community" per person and filed every
   span under it, so a man who served in Munich and then Berlin came out as
   two Berlin tenures. This file is the truth for the people in it: their
   tenures are replaced wholesale with its rows. Spouses recorded against
   the old tenures (and not in this file) are re-attached to the new tenure
   in the same community and years, or kept as shlichot on their own. A
   woman listed here under a husband's title is his spouse when he has the
   same posting; otherwise she stands as a shlicha, as in the main import.

     node scripts/import-multi.mjs          # dry run
     node scripts/import-multi.mjs --write */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--write');
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

/* The same readings as import-shlichim.mjs. */
const HE = { 'א':1,'ב':2,'ג':3,'ד':4,'ה':5,'ו':6,'ז':7,'ח':8,'ט':9,'י':10,'כ':20,'ל':30,'מ':40,'נ':50,'ס':60,'ע':70,'פ':80,'צ':90,'ק':100,'ר':200,'ש':300,'ת':400 };
const hebrewYear = s => { let n = 0; for (const ch of s.replace(/["'׳״\s]/g, '')) { if (!(ch in HE)) return null; n += HE[ch]; } return 5000 + n - 3761; };
const yearsOf = s => [...new Set(s.split(/[;,]/).map(x => x.trim()).filter(Boolean).map(hebrewYear))].sort((a, b) => a - b);
const runs = ys => ys.reduce((out, y) => { const r = out[out.length - 1]; if (r && y === r[1] + 1) r[1] = y; else out.push([y, y]); return out; }, []);
const KIND = { 'ראש כולל': 'rosh_kollel', 'ראש משלחת': 'rosh_kollel', 'בחור': 'shaliach', 'אברך': 'shaliach', 'קמפוסים': 'shaliach',
               'משפחה תומ"צ': 'shaliach', 'מדרשת ציון': 'shlicha', 'ראשת מדרשה': 'staff', 'ראש בית מדרש': 'staff', 'א. ראש כולל': 'spouse' };
const COMM = JSON.parse(readFileSync(join(ROOT, 'scripts/communities-file.json'), 'utf8'));
const slugOf = name => {
  const a = COMM.aliases[name]; if (a && a !== 'skip') return Array.isArray(a) ? a[0] : a;
  const c = Object.entries(COMM.create).find(([, v]) => v.he === name); return c ? c[0] : null;
};
const clean = s => (s ?? '').replace(/[‎‏‪-‮]/g, '').trim();

const rows = readFileSync(join(ROOT, 'scripts/shlichim-multi.tsv'), 'utf8').split('\n').filter(l => l.trim()).map(l => {
  const [last, first, gender, kind, comm, years] = l.split('\t').map(clean);
  return { last, first, sex: gender === 'נקבה' ? 'f' : 'm', kind, comm, years };
});

const comms = await pg('/tmz_community?select=id,slug');
const commId = new Map(comms.map(c => [c.slug, c.id]));
const people = await (async () => { const out = []; for (let off = 0; ; off += 1000) { const p = await pg(`/tmz_person?select=id,tmz_person_tr(lang,display_name)&order=id&offset=${off}&limit=1000`); out.push(...p); if (p.length < 1000) break; } return out; })();
const byHe = new Map(people.map(p => [p.tmz_person_tr.find(t => t.lang === 'he')?.display_name, p.id]));

const adds = [], problems = [];
/* Men first, so a wife whose husband is also new in this file finds him. */
rows.sort((a, b) => (a.sex === 'f') - (b.sex === 'f'));

/* Everyone in this file: their current tenures go, and whoever hung off
   them (spouses, children not in this file) is remembered for re-attaching. */
const pids = [...new Set(rows.map(r => byHe.get(`${r.first} ${r.last}`)).filter(Boolean))];
const dependents = [];
for (const pid of pids) {
  const old = await pg(`/tmz_tenure?select=id&person_id=eq.${pid}`);
  if (!old.length) continue;
  const deps = await pg(`/tmz_tenure?select=person_id,community_id,role,start_year,end_year,institution_id,household_of&household_of=in.(${old.map(t => t.id).join(',')})`);
  for (const d of deps) if (!pids.includes(d.person_id)) dependents.push({ ...d, head: pid });
}
console.log(`${pids.length} people in the file, ${dependents.length} spouse/child rows to re-attach`);
if (WRITE) for (const pid of pids) await pg(`/tmz_tenure?person_id=eq.${pid}`, { method: 'DELETE' });

for (const r of rows) {
  const pid = byHe.get(`${r.first} ${r.last}`);
  if (!pid) { problems.push(`no such person in the register: ${r.first} ${r.last}`); continue; }
  const slug = slugOf(r.comm); if (!slug || !commId.has(slug)) { problems.push(`no community for "${r.comm}" (${r.first} ${r.last})`); continue; }
  const ys = yearsOf(r.years); if (!ys.length || ys.some(y => y == null)) { problems.push(`unreadable years "${r.years}" (${r.first} ${r.last})`); continue; }
  for (const [a, b] of runs(ys)) {
    let role = KIND[r.kind] ?? 'shaliach';
    let household_of = null;
    if (r.sex === 'f' && ['rosh_kollel', 'shaliach', 'spouse'].includes(role)) {
      /* her husband: same surname, same community, overlapping years */
      const mates = await pg(`/tmz_tenure?select=id,person_id,role,start_year,end_year,tmz_person(tmz_person_tr(lang,display_name))` +
        `&community_id=eq.${commId.get(slug)}&start_year=lte.${b}&or=(end_year.gte.${a},end_year.is.null)&role=in.(rosh_kollel,shaliach,staff)`);
      const mate = adds.find(t => t._last === r.last && t.community_id === commId.get(slug) && t.person_id !== pid && t.start_year <= b && t.end_year >= a && t.role !== 'spouse')
        ?? mates.find(t => (t.tmz_person?.tmz_person_tr ?? []).some(x => x.lang === 'he' && x.display_name.endsWith(' ' + r.last)) && t.person_id !== pid && !pids.includes(t.person_id));
      if (mate) { role = 'spouse'; household_of = mate.id ?? mate; }   // a pending husband is linked after he is written
      else role = 'shlicha';   // a woman with no husband on the roster stands as a shlicha, whatever the title
    }
    adds.push({ person_id: pid, community_id: commId.get(slug), role, start_year: a, end_year: b, household_of, institution_id: null,
                _who: `${r.first} ${r.last}`, _last: r.last, _where: `${slug} ${a}–${b} ${role}` });
  }
}
console.log(`${rows.length} rows → ${adds.length} tenures to add`);
for (const p of problems) console.log('  !', p);
for (const a of adds) console.log('  +', a._who, '·', a._where, a.household_of ? '(spouse)' : '');
if (!WRITE) process.exit(0);
/* Heads first (returning ids), then the wives pointing at them. */
const heads = adds.filter(t => typeof t.household_of !== 'object' || t.household_of === null);
const wives = adds.filter(t => t.household_of && typeof t.household_of === 'object');
const strip = ({ _who, _where, _last, ...t }) => t;
const written = heads.length ? await pg('/tmz_tenure', { method: 'POST', prefer: 'return=representation', body: JSON.stringify(heads.map(strip)) }) : [];
heads.forEach((h, i) => { h.id = written[i].id; });
if (wives.length) await pg('/tmz_tenure', { method: 'POST', body: JSON.stringify(wives.map(w => strip({ ...w, household_of: w.household_of.id }))) });
/* The spouses and children the old rows carried: back onto the new tenure
   in the same community and years, or on their own. */
let reattached = 0, alone = 0;
for (const d of dependents) {
  const t = heads.find(h => h.person_id === d.head && h.community_id === d.community_id && h.start_year <= (d.end_year ?? d.start_year) && h.end_year >= d.start_year);
  const { head, household_of, ...row } = d;
  await pg('/tmz_tenure', { method: 'POST', body: JSON.stringify([{ ...row, household_of: t ? t.id : null, role: t ? row.role : (row.role === 'spouse' ? 'shlicha' : row.role) }]) });
  t ? reattached++ : alone++;
}
console.log('written', heads.length, 'heads,', wives.length, 'spouses;', reattached, 're-attached,', alone, 'now on their own');

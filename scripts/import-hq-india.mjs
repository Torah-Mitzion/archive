/* The Jerusalem office and Lev Yehodi in India, from the organisation's own
 * two spreadsheets (scripts/hq-jerusalem.tsv, scripts/lev-yehodi-india.tsv).
 *
 *   node scripts/import-hq-india.mjs           # say what it would do
 *   node scripts/import-hq-india.mjs --write
 *
 * Neither list is a kollel roster, which is why neither goes through
 * import-shlichim.mjs: the office has jobs rather than shlichut years, and the
 * India list is families with a single year each.
 *
 * What is derived, and says so:
 *
 * - Years. The office writes them a dozen ways — 2003.0, 2007-2009,
 *   "2010 - 2014", "2012- היום, 1996-2006", 2014-15, "2014-נוכחי". Every
 *   four-digit number in the cell is taken; the smallest starts and the
 *   largest ends, and a word meaning "today" means it has not ended. A cell
 *   with no number at all leaves the tenure with NO start year, which the
 *   community page shows as its own tile rather than inventing a date for a
 *   real person.
 *
 * - Roles at the office, from the תפקיד column: מנכ"ל → ceo,
 *   מנהלת משרד → office_manager, שליחות → shlichut, כספים and מנהל כספים →
 *   finance, בת שירות → bat_sherut, מטה → staff. Two cells hold a note to
 *   themselves rather than a job — "ללמוד" and "לא היתה בבנ״ע?" — and the
 *   organisation asked for those to be recorded as מטה; so is a blank.
 *
 * - לב יהודי in the office's role column is not a job at the office. Those
 *   two are given their tenure in India, where that is what they did.
 *
 * - India: the sheet's own header is "שם השליח/ה", so each person is recorded
 *   as shaliach or shlicha by the gender in names-first.json. A name the
 *   dictionary cannot sex is recorded as a shaliach and listed in the report,
 *   because getting that wrong about a real woman is worth a line of output.
 *
 * - Names: Hebrew exactly as the sheet writes it; English transliterated token
 *   by token from names-first.json and names-last.json. A token neither knows
 *   is transliterated by rule and listed at the end, for a person to correct
 *   in the back office's translation view. The other four languages come from
 *   fill-person-translations.mjs afterwards.
 *
 * Idempotent: a person is matched by their Hebrew name, a tenure by person +
 * community + role + start year, so running it twice changes nothing.
 */
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
const BASE = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) { console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed.'); process.exit(1); }

async function pg(path, init = {}) {
  const res = await fetch(`${BASE}/rest/v1${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json',
               ...(init.prefer ? { Prefer: init.prefer } : {}) }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} → ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const tsv = f => readFileSync(join(ROOT, 'scripts', f), 'utf8')
  .split('\n').slice(1).filter(l => l.trim()).map(l => l.split('\t').map(c => c.trim()));

const FIRST = JSON.parse(readFileSync(join(ROOT, 'scripts/names-first.json'), 'utf8'));
const LAST = JSON.parse(readFileSync(join(ROOT, 'scripts/names-last.json'), 'utf8'));

/* ---- names ---------------------------------------------------------------- */

/* Titles and honorifics the sheets carry inside the name cell. They are part of
   how the organisation writes the person, so they stay — translated, not
   dropped, and not mistaken for a first name. */
const TITLES = { 'הרב': 'Rabbi', 'הרבנית': 'Rabbanit', 'ד"ר': 'Dr', "ד''ר": 'Dr' };
const MEMORIAL = /^(ז"ל|ז''ל|ז״ל|zl)$/i;

/* A last resort for a token nothing knows. Deliberately plain: it produces
   something readable and obviously approximate, and every one it touches is
   named in the report so a person can replace it. */
const LETTERS = {
  'א': '', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ו': 'v', 'ז': 'z', 'ח': 'ch',
  'ט': 't', 'י': 'y', 'כ': 'k', 'ך': 'kh', 'ל': 'l', 'מ': 'm', 'ם': 'm', 'נ': 'n',
  'ן': 'n', 'ס': 's', 'ע': '', 'פ': 'p', 'ף': 'f', 'צ': 'tz', 'ץ': 'tz', 'ק': 'k',
  'ר': 'r', 'ש': 'sh', 'ת': 't', "'": '', '"': '', '״': '', '׳': ''
};
const byRule = w => {
  const s = [...w].map(c => LETTERS[c] ?? c).join('');
  return s ? s[0].toUpperCase() + s.slice(1) : w;
};

const unknown = new Set();
function latin(word) {
  if (TITLES[word]) return TITLES[word];
  if (MEMORIAL.test(word)) return 'z"l';
  if (FIRST[word]) return FIRST[word][0];
  if (LAST[word]) return LAST[word];
  unknown.add(word);
  return byRule(word);
}
/* Longest match first, so "כליל החורש" and "כהן חדד" are one name rather than
   two words that happen to sit together. */
function translate(hebrew) {
  const words = hebrew.split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < words.length;) {
    let hit = null;
    for (let n = Math.min(3, words.length - i); n >= 1; n--) {
      const join = words.slice(i, i + n).join(' ');
      if (TITLES[join] || FIRST[join] || LAST[join] || MEMORIAL.test(join)) { hit = [join, n]; break; }
    }
    if (hit) { out.push(latin(hit[0])); i += hit[1]; }
    else { out.push(latin(words[i])); i += 1; }
  }
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

const genderOf = hebrew => {
  for (const w of hebrew.split(/\s+/)) if (FIRST[w] && FIRST[w][1]) return FIRST[w][1];
  return null;
};

/* ---- years ---------------------------------------------------------------- */

const ONGOING = /היום|נוכחי|present/;

/* One cell can hold more than one span. "2012- היום, 1996-2006" is a man who
   ran the office, left, and came back — reading it as 1996 to today would put
   him in the chair for six years he was not in it, which is a false thing to
   say about a real person on a public page. Each comma-separated part becomes
   its own tenure. */
function spans(raw) {
  const whole = String(raw || '').trim();
  const parts = whole.split(',').map(s => s.trim()).filter(Boolean);
  const out = [];
  for (const s of parts) {
    const nums = [...s.matchAll(/\b(?:19|20)\d{2}\b/g)].map(m => +m[0]);
    if (!nums.length) continue;
    const start = Math.min(...nums);
    if (ONGOING.test(s)) { out.push({ start, end: null }); continue; }
    const short = s.match(/(?:19|20)\d{2}\s*[-–]\s*(\d{2})\b/);
    out.push({ start, end: nums.length > 1 ? Math.max(...nums) : (short ? 2000 + +short[1] : start) });
  }
  /* No number anywhere: one tenure, with no year. */
  return out.length ? out.sort((a, b) => a.start - b.start) : [{ start: null, end: null }];
}

/* ---- roles ---------------------------------------------------------------- */

const OFFICE_ROLE = {
  'מנכ"ל': 'ceo', 'מנכ״ל': 'ceo',
  'מנהלת משרד': 'office_manager', 'מנהלת משרד?': 'office_manager',
  'שליחות': 'shlichut',
  'כספים': 'finance', 'מנהל כספים': 'finance',
  'בת שירות': 'bat_sherut',
  'מטה': 'staff'
};
const IN_INDIA = /לב יהודי/;

/* ---- the run -------------------------------------------------------------- */

const rows = [];
const notes = [];

for (const [name, yearCell, roleCell] of tsv('hq-jerusalem.tsv')) {
  if (!name) continue;
  const runs = spans(yearCell);
  if (runs.length > 1) {
    notes.push(`${name}: "${yearCell}" is ${runs.length} separate spells — recorded as ${runs.length} tenures`);
  }
  if (IN_INDIA.test(roleCell || '')) {
    for (const { start, end } of runs) {
      rows.push({ he: name, community: 'Lev Yehodi - India', role: 'shaliach_family', start, end });
    }
    notes.push(`${name}: "לב יהודי" is not a job at the office — recorded in India instead`);
    continue;
  }
  const role = OFFICE_ROLE[roleCell] || 'staff';
  if (!OFFICE_ROLE[roleCell]) {
    notes.push(`${name}: role ${roleCell ? `"${roleCell}"` : '(blank)'} is not a job title — recorded as מטה`);
  }
  for (const { start, end } of runs) rows.push({ he: name, community: 'jerusalem', role, start, end });
}

for (const [last, first, yearCell] of tsv('lev-yehodi-india.tsv')) {
  if (!last && !first) continue;
  if (last && !first) { notes.push(`"${last}": a surname with no first name — left out`); continue; }
  const runs = spans(yearCell);
  /* "יהודה ושהם" and "יהונתן ושרה" are two people in one cell. */
  for (const part of first.split(/\s+ו(?=[א-ת])/).map(s => s.trim()).filter(Boolean)) {
    const he = last ? `${part} ${last}` : part;
    const g = genderOf(part);
    if (!g) notes.push(`${he}: the dictionary does not record this name's gender — recorded as a shaliach`);
    for (const { start, end } of runs) {
      rows.push({ he, community: 'Lev Yehodi - India', role: g === 'f' ? 'shlicha' : 'shaliach', start, end });
    }
  }
}

for (const r of rows) r.en = translate(r.he);

/* Two checks that only report. Both of them are about getting a real person's
   record wrong in a way that is cheap to fix by hand and expensive to guess
   at: a name's gender decides whether the page calls her a shlicha or him a
   shaliach, and two spellings of one surname make one person into two. */
const couples = new Map();
for (const r of rows) {
  if (r.community !== 'Lev Yehodi - India' || r.start === null) continue;
  const surname = r.he.split(/\s+/).slice(1).join(' ');
  if (!surname) continue;
  const key = `${surname}|${r.start}`;
  (couples.get(key) || couples.set(key, []).get(key)).push(r);
}
for (const [key, pair] of couples) {
  if (pair.length !== 2) continue;
  if (pair[0].role !== pair[1].role) continue;
  /* shaliach_family is the one role that says nothing about who holds it, so
     two people sharing it is the expected answer rather than a suspicious one. */
  if (pair[0].role === 'shaliach_family') continue;
  notes.push(`${pair.map(r => r.he).join(' and ')} (${key.split('|')[1]}): a pair recorded as the same ` +
             `role, which a husband and wife would not be — check their names' gender`);
}

const surnames = [...new Set(rows.filter(r => r.community === 'Lev Yehodi - India')
  .map(r => r.he.split(/\s+/).slice(1).join(' ')).filter(Boolean))];
for (let i = 0; i < surnames.length; i++) {
  for (let j = i + 1; j < surnames.length; j++) {
    const [a, b] = [surnames[i], surnames[j]];
    if (Math.abs(a.length - b.length) !== 1) continue;
    const [long, short] = a.length > b.length ? [a, b] : [b, a];
    if (![...short].every((c, k) => c === long[k]) && !long.endsWith(short)) {
      /* one insertion anywhere */
      let d = 0, k = 0;
      for (const c of long) { if (c === short[k]) k++; else d++; }
      if (d !== 1 || k !== short.length) continue;
    }
    notes.push(`"${a}" and "${b}" differ by one letter — one of them may be a typo, ` +
               `and two spellings make one family into two`);
  }
}

console.log(`${rows.length} tenures to make`);
const by = k => rows.reduce((m, r) => (m[r[k]] = (m[r[k]] || 0) + 1, m), {});
console.log('  by community:', JSON.stringify(by('community')));
console.log('  by role     :', JSON.stringify(by('role')));
console.log('  with no year:', rows.filter(r => r.start === null).length);
if (unknown.size) {
  console.log(`\n${unknown.size} name parts transliterated by rule — correct these in the back office:`);
  console.log('  ' + [...unknown].join(', '));
}
if (notes.length) {
  console.log(`\n${notes.length} judgement calls:`);
  for (const n of notes) console.log('  ' + n);
}
if (process.argv.includes('--list')) {
  console.log('\nevery row as it will be written:');
  for (const r of rows) {
    const span = r.start === null ? 'no year' : `${r.start}${r.end === null ? '–' : r.end === r.start ? '' : '–' + r.end}`;
    console.log(`  ${r.community === 'jerusalem' ? 'JLM' : 'IND'}  ${r.role.padEnd(15)} ${span.padEnd(10)} ${r.he.padEnd(22)} ${r.en}`);
  }
}
if (!WRITE) { console.log('\nDry run. Pass --write to apply.'); process.exit(0); }

/* ---- writing -------------------------------------------------------------- */

const comms = await pg('/tmz_community?select=id,slug');
const idOf = slug => (comms.find(c => c.slug === slug) || {}).id;
for (const slug of new Set(rows.map(r => r.community))) {
  if (!idOf(slug)) throw new Error(`no community with slug ${slug}`);
}

/* Matched on the Hebrew name, which is what both sheets are written in. */
const existing = await pg('/tmz_person_tr?select=person_id,display_name&lang=eq.he&limit=5000');
const personByHe = new Map(existing.map(r => [r.display_name, r.person_id]));

let madePeople = 0, madeTenures = 0, skipped = 0;
for (const r of rows) {
  let pid = personByHe.get(r.he);
  if (!pid) {
    const [p] = await pg('/tmz_person', { method: 'POST', prefer: 'return=representation',
      body: JSON.stringify([{ slug: null }]) });
    pid = p.id;
    await pg('/tmz_person_tr', { method: 'POST', prefer: 'return=minimal',
      body: JSON.stringify([{ person_id: pid, lang: 'he', display_name: r.he },
                            { person_id: pid, lang: 'en', display_name: r.en }]) });
    personByHe.set(r.he, pid);
    madePeople++;
  }
  const cid = idOf(r.community);
  const q = `/tmz_tenure?select=id&person_id=eq.${pid}&community_id=eq.${cid}&role=eq.${r.role}` +
            (r.start === null ? '&start_year=is.null' : `&start_year=eq.${r.start}`);
  if ((await pg(q)).length) { skipped++; continue; }
  await pg('/tmz_tenure', { method: 'POST', prefer: 'return=minimal',
    body: JSON.stringify([{ person_id: pid, community_id: cid, role: r.role,
                            start_year: r.start, end_year: r.end }]) });
  madeTenures++;
}
console.log(`\nwrote ${madePeople} people and ${madeTenures} tenures; ${skipped} tenures were already there`);

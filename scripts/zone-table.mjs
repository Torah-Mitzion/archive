/* Regenerates the tmz_tz seed in supabase/migrations/20260924010001_visits.sql
 * from the system's IANA time zone tables.
 *
 *   node scripts/zone-table.mjs <out.sql>
 *
 * The site's only geography is the browser's own time zone, which needs no IP
 * lookup and no third party. This turns 547 zone names into (zone, country,
 * reference city) rows. Re-run it when the tzdata package moves — a zone that
 * is not in the table shows up in the back office as its raw name rather than
 * a country, which is a visible gap rather than a silent one.
 *
 * Reads zone1970.tab (current zones), zone.tab (a few the former dropped) and
 * the link list in tzdata.zi (retired spellings a browser may still report).
 */
import fs from 'node:fs';
const rows = new Map();
const cityOf = z => { const p = z.split('/'); return p[p.length - 1].replace(/_/g, ' '); };
for (const f of ['/usr/share/zoneinfo/zone1970.tab', '/usr/share/zoneinfo/zone.tab']) {
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!line || line[0] === '#') continue;
    const c = line.split('\t');
    const cc = (c[0] || '').split(',')[0].trim(), zone = (c[2] || '').trim();
    if (!/^[A-Z]{2}$/.test(cc) || !zone.includes('/')) continue;
    if (!rows.has(zone)) rows.set(zone, [cc, cityOf(zone)]);
  }
}
/* A retired spelling takes its target's row whole, city included: US/Eastern is
   New York, Asia/Calcutta is Kolkata. Naming a link after its own last segment
   would invent places called "Eastern". */
for (const line of fs.readFileSync('/usr/share/zoneinfo/tzdata.zi', 'utf8').split('\n')) {
  const m = line.match(/^L\s+(\S+)\s+(\S+)/);
  if (!m) continue;
  const [, target, alias] = m;
  if (rows.has(alias) || !rows.has(target)) continue;
  rows.set(alias, rows.get(target).slice());
}
for (const z of ['UTC', 'Etc/UTC', 'Etc/GMT', 'GMT', 'Etc/Greenwich']) rows.set(z, [null, 'UTC']);
const list = [...rows].sort((a, b) => a[0].localeCompare(b[0]));
const q = s => s === null ? 'null' : `'${String(s).replace(/'/g, "''")}'`;
const sql = list.map(([z, [cc, c]]) => `  (${q(z)}, ${q(cc)}, ${q(c)})`).join(',\n');
fs.writeFileSync(process.argv[2], sql);
console.log('zones:', list.length, '| sql bytes:', sql.length);
for (const z of ['US/Eastern', 'Asia/Calcutta', 'Europe/Kiev', 'Asia/Jerusalem', 'Australia/Perth'])
  console.log(' ', z, JSON.stringify(rows.get(z)));

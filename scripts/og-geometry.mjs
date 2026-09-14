/* The landing map's geometry — the same land.js and map.js the browser runs,
   evaluated here — written out as points for scripts/og-image.py to draw.
   Usage: node scripts/og-geometry.mjs > /tmp/og.json */
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

const W = 1200, H = 630;
const land = readFileSync(join(ROOT, 'docs/land.js'), 'utf8');
const map = readFileSync(join(ROOT, 'docs/map.js'), 'utf8');
const geo = new Function(land + '\n' + map + `
  const proj = projection(${W}, ${H});
  const step = Math.max(7, ${W} / 190);
  const dots = [];
  for (let y = 0; y <= ${H}; y += step) { const lat = proj.iy(y);
    for (let x = 0; x <= ${W}; x += step) if (inLand(proj.ix(x), lat)) dots.push([+x.toFixed(1), +y.toFixed(1)]); }
  return { proj, dots, jx: proj.fx(JERUSALEM.lon), jy: proj.fy(JERUSALEM.lat) };
`)();

const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/tmz_community?select=lon,lat,closed_year`, {
  headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } });
const comms = await res.json();
const points = comms.map(c => ({ x: +geo.proj.fx(c.lon).toFixed(1), y: +geo.proj.fy(c.lat).toFixed(1), open: !c.closed_year }));
process.stdout.write(JSON.stringify({ W, H, dots: geo.dots, jx: geo.jx, jy: geo.jy, points }));

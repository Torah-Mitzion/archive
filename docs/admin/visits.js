/* Visits: what the album's readers actually did.
 *
 * Everything on this page comes from one RPC, tmz_visits(days, zone), and every
 * bucket is cut in the reader's own time zone — the organisation is three hours
 * ahead of the server, and cutting days in UTC would move every evening's
 * traffic into the next morning.
 *
 * The charts are drawn here rather than by a library: the back office has no
 * build step, so a charting dependency would mean a CDN script on a page that
 * holds the archive's private data. Every form here is one of four — a hero
 * number, an area over time, a ranked bar, or a heat cell — and none of them
 * needs more than an SVG path and a scale.
 *
 * Colour does one job. Magnitude is the console's gold, stepped as a one-hue
 * sequential ramp (--seq-1..7, validated for lightness monotonicity, step gaps
 * and contrast against the card surface). Identity is never colour: a country,
 * a device, a language is named in text beside its bar, so nothing on this page
 * depends on telling two hues apart.
 */
import { sb } from './sb.js';
import { $, esc, LANG_NAMES } from './ui.js';

const PUBLIC_BUCKET = `${window.TMZ_SUPABASE_URL}/storage/v1/object/public/tmz-photo-public`;

/* ---- formatting ----------------------------------------------------------- */

const n0 = v => (v == null ? '—' : Number(v).toLocaleString('en-US'));
const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '—');

/* Durations as a person says them. Anything under a minute stays in seconds:
   "0m 41s" is a worse answer than "41s". */
function dur(secs) {
  if (secs == null) return '—';
  const s = Math.round(secs);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

const REGION = (() => { try { return new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) { return null; } })();
function countryName(cc) {
  if (!cc || !/^[A-Z]{2}$/.test(cc)) return 'Unknown';
  try { return (REGION && REGION.of(cc)) || cc; } catch (e) { return cc; }
}
/* A flag is decoration beside a name that is already there, never the label
   itself — a platform that has no flag emoji must still leave a readable row. */
function flag(cc) {
  if (!cc || !/^[A-Z]{2}$/.test(cc)) return '';
  return String.fromCodePoint(...[...cc].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}

const ROUTE_NAMES = {
  map: 'The map', communities: 'Communities index', community: 'A community',
  year: 'A single year', shlichim: 'Shlichim register', about: 'About',
  contribute: 'Add a photograph'
};

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* ---- the pieces ----------------------------------------------------------- */

const tile = (k, v, sub, cls = '') => `
  <div class="stat-tile">
    <span class="k">${esc(k)}</span>
    <span class="v ${cls}">${v}</span>
    ${sub ? `<span class="sub">${esc(sub)}</span>` : ''}
  </div>`;

/* One measure over time. Two measures of different size get two of these side
   by side rather than two scales on one frame — a second y-axis makes the
   crossing point look like a fact when it is an artefact of the scaling. */
function area(rows, key, label) {
  const W = 560, H = 150, P = { t: 10, r: 6, b: 20, l: 34 };
  const n = rows.length;
  if (!n) return `<p class="dim">Nothing yet.</p>`;
  const max = Math.max(1, ...rows.map(r => r[key]));
  const x = i => P.l + (n === 1 ? 0 : (i * (W - P.l - P.r)) / (n - 1));
  const y = v => P.t + (1 - v / max) * (H - P.t - P.b);

  const pts = rows.map((r, i) => `${x(i).toFixed(1)},${y(r[key]).toFixed(1)}`);
  const line = `M${pts.join(' L')}`;
  const fill = `${line} L${x(n - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;

  /* Four gridlines, recessive, and the only numbers on the y-axis. Labelling
     every point would bury the shape the chart exists to show. */
  const ticks = [0, 0.5, 1].map(f => {
    const v = Math.round(max * f);
    return `<line x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}" class="vz-grid"></line>
            <text x="${P.l - 6}" y="${y(v) + 4}" class="vz-ytick">${n0(v)}</text>`;
  }).join('');

  const first = rows[0].d, last = rows[n - 1].d;
  const cells = rows.map((r, i) =>
    `<rect x="${(x(i) - (W - P.l - P.r) / (2 * Math.max(1, n - 1))).toFixed(1)}" y="${P.t}"
       width="${Math.max(3, (W - P.l - P.r) / Math.max(1, n - 1)).toFixed(1)}" height="${H - P.t - P.b}"
       class="vz-hit" data-i="${i}" data-d="${esc(r.d)}" data-v="${r[key]}"></rect>`).join('');

  return `
  <figure class="vz" data-label="${esc(label)}">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
         aria-label="${esc(label)} per day, ${esc(first)} to ${esc(last)}">
      ${ticks}
      <path d="${fill}" class="vz-fill"></path>
      <path d="${line}" class="vz-line"></path>
      <line class="vz-cross" x1="0" x2="0" y1="${P.t}" y2="${H - P.t - P.b + P.t}"></line>
      <circle class="vz-dot" r="4"></circle>
      ${cells}
    </svg>
    <figcaption><span>${esc(first)}</span><span>${esc(last)}</span></figcaption>
    <div class="vz-tip" hidden></div>
  </figure>`;
}

/* A ranked list. The bar carries the magnitude, the text carries the identity,
   and the number is on the row rather than inside the bar so a short bar is
   still readable. */
function bars(rows, opts = {}) {
  if (!rows || !rows.length) return `<p class="dim">Nothing yet.</p>`;
  const max = Math.max(1, ...rows.map(r => r.n));
  const total = rows.reduce((a, r) => a + r.n, 0);
  return `<ul class="vz-bars">${rows.slice(0, opts.limit || 12).map(r => `
    <li>
      <span class="lbl">${r.icon ? `<i class="ic">${r.icon}</i>` : ''}${esc(r.label)}</span>
      <span class="track"><i style="inline-size:${Math.max(2, (r.n / max) * 100).toFixed(1)}%"></i></span>
      <span class="num">${n0(r.n)}${opts.share ? `<em>${pct(r.n, total)}</em>` : ''}</span>
    </li>`).join('')}</ul>`;
}

/* Two parts of one whole: gold for the part in question, a neutral for the
   remainder, both labelled in place. A share bar is not a categorical palette
   — nothing here asks the reader to tell two hues apart. */
function split(aLabel, a, bLabel, b) {
  const t = a + b;
  if (!t) return `<p class="dim">Nothing yet.</p>`;
  return `<div class="vz-split">
    <div class="bar"><i class="a" style="inline-size:${((a / t) * 100).toFixed(1)}%"></i><i class="b"></i></div>
    <div class="keys">
      <span><i class="sw a"></i>${esc(aLabel)} <b>${n0(a)}</b> <em>${pct(a, t)}</em></span>
      <span><i class="sw b"></i>${esc(bLabel)} <b>${n0(b)}</b> <em>${pct(b, t)}</em></span>
    </div>
  </div>`;
}

/* When they come. Seven rows by twenty-four columns of one sequential hue: an
   empty hour is the surface with a hairline, not the palest step, so "nobody"
   and "one person" never look the same. */
function heat(cells) {
  const grid = new Map(cells.map(c => [`${c.dow}:${c.h}`, c.n]));
  const max = Math.max(1, ...cells.map(c => c.n));
  const step = v => (v ? Math.min(7, 1 + Math.floor(((v - 1) / max) * 6.99)) : 0);
  const rows = DOW.map((name, i) => {
    const dow = i + 1;                                  // isodow: Monday is 1
    const tds = Array.from({ length: 24 }, (_, h) => {
      const v = grid.get(`${dow}:${h}`) || 0;
      return `<span class="hc s${step(v)}" data-tip="${esc(name)} ${String(h).padStart(2, '0')}:00 — ${n0(v)} page views"></span>`;
    }).join('');
    return `<div class="hrow"><span class="hlbl">${name}</span><span class="hcells">${tds}</span></div>`;
  }).join('');
  const scale = [1, 2, 3, 4, 5, 6, 7].map(s => `<i class="hc s${s}"></i>`).join('');
  return `<div class="vz-heat">
    <div class="hhead"><span class="hlbl"></span><span class="hcells">
      ${Array.from({ length: 24 }, (_, h) => `<span class="htick">${h % 6 === 0 ? h : ''}</span>`).join('')}
    </span></div>
    ${rows}
    <div class="hkey"><span>none</span><i class="hc s0"></i>${scale}<span>${n0(max)}</span></div>
  </div>`;
}

/* Panels come in thirds, halves and full widths, and the page is laid out so
   every row fills: a pair of panels in a three-across grid leaves a hole where
   a reader looks for a third thing that is not there. */
const panel = (title, note, body, width) => `
  <section class="vz-panel${width ? ' ' + width : ''}">
    <div class="vz-head"><h2>${esc(title)}</h2>${note ? `<span class="dim">${esc(note)}</span>` : ''}</div>
    ${body}
  </section>`;

/* A chart the reader cannot hover — printed, screen-read, colour-blind — still
   has to give up its numbers, so every plotted form ships the table too. */
const table = (head, rows) => `
  <details class="vz-table"><summary>Numbers</summary>
    <table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>
  </details>`;

/* ---- the view ------------------------------------------------------------- */

const RANGES = [[7, '7 days'], [30, '30 days'], [90, '90 days'], [365, '12 months']];
let days = 30;

export async function visits() {
  const zone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return 'UTC'; } })();
  const d = await sb.rpc('tmz_visits', { days, zone });

  const t = d.totals || {};
  const byDay = d.by_day || [];

  const rangeBtns = RANGES.map(([n, label]) =>
    `<button class="btn ${n === days ? 'solid' : 'ghost'} sm" data-days="${n}">${label}</button>`).join('');

  $('#page').innerHTML = `
    <div class="page-head">
      <div><h1>Visits</h1>
        <p>The last ${days} days, in ${esc(zone)}. No addresses, no cookies, no third party —
           the album counts itself.</p></div>
      <div class="vz-range">${rangeBtns}</div>
    </div>

    <div class="stat-grid vz-kpi">
      ${tile('Visitors', n0(t.visitors), 'distinct browsers')}
      ${tile('Visits', n0(t.sessions), 'one per tab')}
      ${tile('Pages read', n0(t.views), t.sessions ? `${(t.views / t.sessions).toFixed(1)} per visit` : '')}
      ${tile('Photographs opened', n0(t.photos), 'full screen', 'gold')}
      ${tile('Time per visit', dur(t.median_secs), `median · mean ${dur(t.mean_secs)}`)}
      ${tile('Left on the first page', pct(t.bounced, t.sessions), `${n0(t.bounced)} of ${n0(t.sessions)}`)}
      ${tile('Clicks', n0(t.clicks), 'named controls only')}
      ${tile('Reading now', n0(t.live), 'last 30 minutes', t.live ? 'gold' : '')}
    </div>

    <div class="vz-grid">
      ${panel('Visits per day', 'one per tab', area(byDay, 'sessions', 'Visits') +
        table(['Day', 'Visits'], byDay.map(r => [esc(r.d), n0(r.sessions)])), 'half')}
      ${panel('Pages read per day', 'every route drawn', area(byDay, 'views', 'Pages read') +
        table(['Day', 'Pages'], byDay.map(r => [esc(r.d), n0(r.views)])), 'half')}

      ${panel('When they come', `page views by hour, ${esc(zone)}`, heat(d.heat || []), 'wide')}

      ${panel('Countries', 'from the browser’s time zone', bars((d.countries || []).map(c => ({
        label: countryName(c.cc), icon: flag(c.cc), n: c.n })), { share: true }))}
      ${panel('Time zones', 'the zone’s own city, not the visitor’s', bars((d.cities || []).map(c => ({
        label: c.city, icon: flag(c.cc), n: c.n }))))}

      ${panel('What they read on', '', bars((d.devices || []).map(x => ({
        label: x.k === 'phone' ? 'Phone' : x.k === 'tablet' ? 'Tablet' : x.k === 'desktop' ? 'Computer' : 'Unknown',
        n: x.n })), { share: true }))}
      ${panel('Language', 'the one they chose on the site', bars((d.langs || []).map(x => ({
        label: LANG_NAMES[x.k] || 'Unknown', n: x.n })), { share: true }))}

      ${panel('Known before', 'a visitor whose browser we had already seen', split(
        'Returning', t.returning || 0, 'First time', Math.max(0, (t.visitors || 0) - (t.returning || 0))))}
      ${panel('How far they went', 'pages in one visit', bars((d.depth || []).map(x => ({
        label: x.k === '1' ? '1 page' : `${x.k} pages`, n: x.n })), { share: true }))}

      ${panel('Every page', 'how often each was drawn, and how long it held them',
        pagesTable(d.routes || []), 'wide')}

      ${panel('Communities looked at', '', bars((d.communities || []).map(c => ({
        label: c.name || c.slug, n: c.n })), { limit: 14 }), 'half')}
      ${panel('Years looked at', '', bars((d.years || []).slice().sort((a, b) => b.n - a.n).map(x => ({
        label: String(x.yr), n: x.n })), { limit: 14 }), 'half')}

      ${panel('Most-opened photographs', 'counted when it filled the screen', photoWall(d.photos || []), 'wide')}

      ${panel('Where they came from', 'the referring host, never the page', bars((d.refs || []).map(x => ({
        label: x.k === '(direct)' ? 'Typed or bookmarked' : x.k, n: x.n })), { share: true }), 'half')}
      ${panel('What they pressed', '', bars((d.clicks || []).map(x => ({ label: x.k, n: x.n })), { limit: 14 }), 'half')}
    </div>

    <p class="dim vz-foot">
      Visits from headless browsers — our own tests — are recorded and excluded here.
      Rows older than fourteen months are purged nightly.
    </p>`;

  wire();
}

function pagesTable(routes) {
  if (!routes.length) return `<p class="dim">Nothing yet.</p>`;
  const max = Math.max(1, ...routes.map(r => r.views));
  return `<table class="vz-pages"><thead><tr>
      <th>Page</th><th>Times drawn</th><th>Visits</th><th>Median time</th><th></th>
    </tr></thead><tbody>
    ${routes.map(r => `<tr>
      <td>${esc(ROUTE_NAMES[r.k] || r.k)}</td>
      <td class="num">${n0(r.views)}</td>
      <td class="num">${n0(r.sessions)}</td>
      <td class="num">${dur(r.secs)}</td>
      <td class="spark"><span class="track"><i style="inline-size:${((r.views / max) * 100).toFixed(1)}%"></i></span></td>
    </tr>`).join('')}
  </tbody></table>`;
}

function photoWall(photos) {
  if (!photos.length) return `<p class="dim">Nothing opened yet.</p>`;
  return `<div class="vz-wall">${photos.map(p => `
    <figure>
      ${p.path ? `<img src="${esc(PUBLIC_BUCKET)}/thumb/${esc(p.path)}" alt="" loading="lazy">`
               : `<span class="gone">gone</span>`}
      <figcaption><b>${n0(p.n)}</b>${p.slug ? `<span>${esc(p.slug)}${p.yr ? ` · ${p.yr}` : ''}</span>` : ''}</figcaption>
    </figure>`).join('')}</div>`;
}

/* ---- interaction ---------------------------------------------------------- */

/* An SVG chart on a screen is interactive whether or not it was designed to be,
   so the hover layer is part of the chart rather than a nicety: the hit targets
   are full-height columns, wider than the mark, and the readout follows the
   pointer instead of asking anyone to aim at a two-pixel line. */
function wire() {
  document.querySelectorAll('#page [data-days]').forEach(b => {
    b.onclick = () => { days = +b.dataset.days; visits(); };
  });

  document.querySelectorAll('#page .vz').forEach(fig => {
    const svg = fig.querySelector('svg'), tip = fig.querySelector('.vz-tip');
    const cross = fig.querySelector('.vz-cross'), dot = fig.querySelector('.vz-dot');
    const label = fig.dataset.label;

    fig.addEventListener('pointermove', ev => {
      const hit = ev.target.closest('.vz-hit');
      if (!hit) return;
      const cells = [...svg.querySelectorAll('.vz-hit')];
      const i = +hit.dataset.i;
      const line = svg.querySelector('.vz-line');
      const len = line.getTotalLength();
      const at = cells.length > 1 ? line.getPointAtLength((len * i) / (cells.length - 1)) : line.getPointAtLength(0);
      cross.setAttribute('x1', at.x); cross.setAttribute('x2', at.x);
      dot.setAttribute('cx', at.x); dot.setAttribute('cy', at.y);
      /* A class, not the hidden attribute: `hidden` is an HTMLElement property
         and these two are SVG, so assigning it would set a field nobody reads
         and leave the mark invisible. */
      svg.classList.add('live');
      tip.hidden = false;
      tip.innerHTML = `<b>${esc(hit.dataset.d)}</b><span>${n0(hit.dataset.v)} ${esc(label.toLowerCase())}</span>`;
      const box = fig.getBoundingClientRect();
      tip.style.insetInlineStart = `${Math.min(Math.max(ev.clientX - box.left - 55, 0), box.width - 110)}px`;
    });
    fig.addEventListener('pointerleave', () => {
      svg.classList.remove('live');
      tip.hidden = true;
    });
  });

  /* The heat cells carry their reading in a title-like bubble of our own, so it
     appears at once rather than after the browser's half-second delay. */
  const hot = document.querySelector('#page .vz-heat');
  if (hot) {
    let bubble = null;
    hot.addEventListener('pointermove', ev => {
      const c = ev.target.closest('.hc[data-tip]');
      if (!c) { if (bubble) { bubble.remove(); bubble = null; } return; }
      if (!bubble) { bubble = document.createElement('div'); bubble.className = 'vz-tip'; hot.append(bubble); }
      bubble.textContent = c.dataset.tip;
      const box = hot.getBoundingClientRect();
      bubble.style.insetInlineStart = `${Math.min(Math.max(ev.clientX - box.left - 70, 0), box.width - 150)}px`;
      bubble.style.insetBlockStart = `${ev.clientY - box.top - 38}px`;
    });
    hot.addEventListener('pointerleave', () => { if (bubble) { bubble.remove(); bubble = null; } });
  }
}

/* What the album's photographs cost in bandwidth, sent to WhatsApp.
 *
 *   SUPABASE_ACCESS_TOKEN=… HEYY_API_TOKEN=… HEYY_CHANNEL_ID=… \
 *   node scripts/egress-report.mjs +972…            # send
 *   node scripts/egress-report.mjs --dry            # print it instead
 *
 * Egress is the first thing this archive will run out of — 5 GB a month on
 * the free tier — and the dashboard only shows a monthly total, after the
 * fact. The request logs hold every response with its size and whether the
 * CDN served it, so an hour of it can be read and read again.
 *
 * Log retention on the free tier is one day, so a month-to-date figure is not
 * available here: what this reports is the last hour and the last day, and
 * what those imply if they kept up.
 *
 * BROKEN, and not by anything in this file. Supabase retired the
 * analytics/endpoints/logs.all endpoint this script reads on 23 September 2026
 * — it now answers only with a pointer to its replacement — and the
 * replacement, analytics/endpoints/logs, returns "Backend error!" for every
 * query on this project, `SELECT 1` included. There is no request log left to
 * read here, so this cannot be repaired from this side; it would need the new
 * endpoint to start answering, or a paid plan.
 *
 * What replaced it, for the question this was actually asked to answer: the
 * album counts its own readers now (supabase/migrations/…_visits.sql, and the
 * Visits tab in the back office). That counts people rather than bytes, so it
 * is not the same reading — but bandwidth on this site is page views times
 * image size, and the back office now shows the first of those.
 */
const REF = process.env.SUPABASE_PROJECT_REF || 'difiipnhpujbwhpyownr';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const TO = process.argv.find(a => a.startsWith('+')) || process.env.REPORT_TO;
const DRY = process.argv.includes('--dry') || !process.env.HEYY_API_TOKEN;

const SQL = `select h.cf_cache_status as cache, count(*) as requests,
  sum(cast(h.content_length as int64)) as bytes
from edge_logs t
cross join unnest(t.metadata) as m
cross join unnest(m.request) as r
cross join unnest(m.response) as resp
cross join unnest(resp.headers) as h
where r.path like '/storage/v1/object/public/%'
group by 1`;

async function window_(hours) {
  const end = new Date(), start = new Date(end - hours * 3600 * 1000);
  const u = new URL(`https://api.supabase.com/v1/projects/${REF}/analytics/endpoints/logs.all`);
  u.searchParams.set('sql', SQL);
  u.searchParams.set('iso_timestamp_start', start.toISOString().replace(/\.\d+Z$/, 'Z'));
  u.searchParams.set('iso_timestamp_end', end.toISOString().replace(/\.\d+Z$/, 'Z'));
  const res = await fetch(u, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!res.ok) throw new Error(`analytics ${res.status} ${(await res.text()).slice(0, 200)}`);
  const rows = (await res.json()).result || [];
  const pick = w => rows.filter(r => (r.cache || '') === w)
                        .reduce((a, r) => ({ b: a.b + (r.bytes || 0), n: a.n + (r.requests || 0) }), { b: 0, n: 0 });
  const miss = pick('MISS'), hit = pick('HIT');
  const other = rows.filter(r => !['MISS', 'HIT'].includes(r.cache || ''))
                    .reduce((a, r) => a + (r.bytes || 0), 0);
  return { billed: miss.b + other, cached: hit.b, requests: miss.n + hit.n };
}

const mb = b => `${(b / 1e6).toFixed(1)} MB`;
const hour = await window_(1);
const day = await window_(24);
const monthly = day.billed * 30;          // if the last day kept up
const share = Math.round((monthly / 5e9) * 100);

const now = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' });
const text =
`📊 תעבורת תמונות · ${now}

בשעה האחרונה: ${mb(hour.billed)} (${hour.requests} בקשות)
ביממה: ${mb(day.billed)} מחויב + ${mb(day.cached)} ממטמון

בקצב הזה: ${(monthly / 1e9).toFixed(2)} GB לחודש — ${share}% מתוך 5 GB`;

if (DRY || !TO) { console.log(text); process.exit(0); }

const BASE = process.env.HEYY_API_BASE || 'https://api.heyy.io';
const res = await fetch(`${BASE}/v3/messages/send`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.HEYY_API_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chat: { channelId: process.env.HEYY_CHANNEL_ID, phoneNumber: TO.startsWith('+') ? TO : `+${TO}` },
    body: text
  })
});
console.log(text);
if (!res.ok) { console.error('send failed', res.status, (await res.text()).slice(0, 300)); process.exit(1); }
console.log('\nsent to', TO);

/* What visitors do in the album, counted by the album itself.
 *
 * GitHub Pages keeps no logs we can read and Supabase's request logs are gone
 * within a day, so nothing about who comes here is knowable unless the site
 * says so out loud. This is that, kept to the smallest thing that answers the
 * back office's questions.
 *
 * What it does NOT send: no IP (the server never looks at one either), no
 * cookie, no fingerprint, no URL beyond the route the site's own router
 * defines, no referrer beyond its host. The two identifiers are random strings
 * this browser invents for itself — one per tab, one per browser — and someone
 * who clears their storage becomes a new visitor, which is the true answer
 * rather than a convenient one.
 *
 * Geography is the browser's own time zone. It is offered without being asked,
 * it needs no lookup service, and it is honest about its resolution: a visitor
 * in Haifa reports Asia/Jerusalem, so the back office reads it as a country and
 * says plainly that the city is the zone's, not theirs.
 *
 * Events are buffered and posted in small batches, and the last batch leaves by
 * sendBeacon on the way out, so a visitor never waits on this and a closing tab
 * does not lose its reading. Anything that throws here is swallowed: a counter
 * must never be the reason a photograph did not appear.
 */
(function () {
  'use strict';

  const URL_ = window.TMZ_SUPABASE_URL || 'https://difiipnhpujbwhpyownr.supabase.co';
  const KEY = window.TMZ_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpZmlpcG5ocHVqYndocHlvd25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTkxOTAsImV4cCI6MjEwNDM3NTE5MH0.N40pUirH7MLqJGwPmIRQghS-nWeXnKa5XEJgSQFsJFQ';
  const ENDPOINT = `${URL_}/rest/v1/rpc/tmz_visit_log`;

  const FLUSH_MS = 6000;     // a batch every few seconds, never per click
  const MAX_BATCH = 40;      // the server's own ceiling

  /* ---- who, for as long as they keep their own storage -------------------- */

  const rid = () => {
    const a = new Uint8Array(16);
    (crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => a[i] = Math.random() * 256);
    return [...a].map(b => b.toString(36)).join('').slice(0, 22);
  };

  /* A store that is blocked, full or absent must not stop the page. When it is,
     the id lives for this page load only and the visit counts once. */
  function keep(store, key) {
    try {
      const had = store.getItem(key);
      if (had) return had;
      const made = rid();
      store.setItem(key, made);
      return made;
    } catch (e) { return rid(); }
  }

  let who, sess;
  try {
    who = keep(localStorage, 'tmz.who');
    sess = keep(sessionStorage, 'tmz.sess');
  } catch (e) { who = sess = rid(); }

  /* ---- what kind of visit ------------------------------------------------- */

  const device = () => {
    const w = Math.min(screen.width || innerWidth, screen.height || innerHeight);
    const touch = matchMedia('(pointer: coarse)').matches;
    if (!touch) return 'desktop';
    return w >= 600 ? 'tablet' : 'phone';
  };

  const zone = () => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (e) { return null; }
  };

  /* The host, never the path: where someone came from is worth knowing, what
     they were reading before they came is not ours. A referrer from this same
     site is our own navigation and not a referrer at all. */
  const refHost = () => {
    try {
      if (!document.referrer) return null;
      const h = new URL(document.referrer).hostname;
      return h && h !== location.hostname ? h : null;
    } catch (e) { return null; }
  };

  /* Our own Playwright runs set navigator.webdriver, and so does every other
     headless browser. Marked, not dropped: the back office hides them, and if
     the flag ever becomes wrong the rows are still there to look at. */
  const bot = navigator.webdriver === true;

  const base = { s: sess, w: who, b: bot ? 'true' : undefined };

  /* ---- the queue ---------------------------------------------------------- */

  let queue = [], timer = null;

  function post(rows, beacon) {
    if (!rows.length) return;
    const body = JSON.stringify({ batch: rows });
    try {
      if (beacon && navigator.sendBeacon) {
        /* sendBeacon cannot set headers, so the key rides the query string —
           PostgREST accepts ?apikey=, and text/plain keeps it a simple request
           that needs no preflight a closing tab would never wait for. */
        const ok = navigator.sendBeacon(`${ENDPOINT}?apikey=${encodeURIComponent(KEY)}`,
          new Blob([body], { type: 'text/plain' }));
        if (ok) return;
      }
      fetch(ENDPOINT, {
        method: 'POST', keepalive: true,
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body
      }).catch(() => {});
    } catch (e) { /* counting is never worth an error on screen */ }
  }

  function flush(beacon) {
    clearTimeout(timer); timer = null;
    if (!queue.length) return;
    const rows = queue.splice(0, MAX_BATCH);
    post(rows, beacon);
    if (queue.length) schedule();
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(() => flush(false), FLUSH_MS);
  }

  function send(e) {
    if (document.body && document.body.dataset.notrack === '1') return;
    const row = { ...base };
    for (const [k, v] of Object.entries(e)) if (v !== null && v !== undefined && v !== '') row[k] = String(v);
    queue.push(row);
    if (queue.length >= MAX_BATCH) flush(false); else schedule();
  }

  /* ---- engaged time ------------------------------------------------------- */

  /* Time with the tab actually in front, not time since the page opened. A
     visitor who leaves the album in a background tab all afternoon did not
     spend the afternoon reading it, and counting it that way would make every
     average a lie. */
  let route = null, since = 0, banked = 0;

  const clock = () => (document.visibilityState === 'hidden' ? banked : banked + (Date.now() - since));

  function leaveRoute() {
    if (!route) return;
    const secs = Math.round(clock() / 1000);
    if (secs > 0) send({ k: 'leave', r: route.r, c: route.c, y: route.y, t: secs });
    route = null;
  }

  function enterRoute(d) {
    leaveRoute();
    route = { r: d.route, c: d.community || null, y: d.year || null };
    banked = 0; since = Date.now();
    send({
      k: 'view', r: route.r, c: route.c, y: route.y,
      g: d.lang, z: zone(), d: device(), f: refHost()
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { banked += Date.now() - since; flush(true); }
    else since = Date.now();
  });

  /* pagehide fires where unload is unreliable — a phone switching apps, Safari
     putting the page in its back/forward cache. Both paths end at the same
     beacon, and a double send is two rows the reader would have had anyway. */
  addEventListener('pagehide', () => { leaveRoute(); flush(true); });
  addEventListener('beforeunload', () => { leaveRoute(); flush(true); });

  /* ---- what the site tells us -------------------------------------------- */

  document.addEventListener('tmz:view', e => enterRoute(e.detail || {}));
  document.addEventListener('tmz:photo', e => {
    const d = e.detail || {};
    if (d.id) send({ k: 'photo', p: d.id, r: route && route.r, c: route && route.c, y: route && route.y });
  });

  /* Clicks, named by what they are rather than where they are: a label the back
     office can read in a list, and nothing that identifies the person who
     pressed it. Anything unnamed is not recorded at all. */
  const NAMED = [
    ['.hero-cta', 'hero: add a photograph'],
    ['.zoom-out', 'map: zoom out'],
    ['.about-ask', 'about: ask'],
    ['.lang-opt', 'language'],
    ['.theme-btn', 'theme'],
    ['#u_send', 'upload: send'],
    ['.cta-wa, a[href^="https://wa.me/"]', 'whatsapp'],
    ['.lb-share', 'photograph: share'],
    ['.ytile', 'year tile'],
    ['.gal-it', 'gallery photograph'],
    ['.ry', 'year rail'],
    ['[href^="#/contribute"]', 'add a photograph'],
    ['.btn-gold', 'gold button'],
    ['[data-nav]', 'nav'],
  ];

  document.addEventListener('click', ev => {
    try {
      for (const [sel, label] of NAMED) {
        const hit = ev.target.closest(sel);
        if (!hit) continue;
        const extra = hit.dataset && hit.dataset.nav ? `nav: ${hit.dataset.nav}`
          : hit.dataset && hit.dataset.lang ? `language: ${hit.dataset.lang}` : label;
        send({ k: 'click', l: extra, r: route && route.r });
        return;
      }
    } catch (e) { /* never a broken click */ }
  }, { capture: true });

  window.TMZVisits = { flush: () => flush(false) };
})();

/* Router, shell and the three views. Hash routing so GitHub Pages needs no
   rewrite rules: #/ , #/c/<community> , #/c/<community>/<year> , #/contribute */

const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"]/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m]));

const view = { zoom: 'world', custom: null, sel: null, history: [] };

/* ---- theme ----------------------------------------------------------------
   Dark is the design and the default; light is a choice, remembered in this
   browser. index.html reads the same key and sets the attribute before the
   first paint, so a reader who chose light never sees the dark ground flash
   past on the way in. Everything else is CSS: no view redraws to change it. */
const THEME_KEY = 'tmz.theme';
const theme = () => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
/* The icon and the label name where the button goes, not where it is: an
   icon-only control that shows its own state reads backwards to half of
   the people who meet it. */
const themeLabel = () => t(theme() === 'light' ? 'theme.toDark' : 'theme.toLight');

function setTheme(next) {
  if (next === 'light') document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
  try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* private window */ }
}

/* Everything the map draws now comes from the database. Loaded once per
   language change and held here; the geometry in map.js is passed this list
   rather than reading a global. */
const STATE = { communities: [], regions: [], loaded: false, error: null };
const findCommunity = id => STATE.communities.find(c => c.id === id);

/* The years a kollel ran, and all that is said about it. A community that
   closed is not announced as closed anywhere on the site — the span ends, and
   the reader can see that for themselves; one that is still open runs to
   today. Keep it inside dir="ltr" so the years stay in reading order. */
const yearSpan = c => `${c.f}\u2013${c.c || t('yr.present')}`;

/* Every view change remembers where it came from, so zooming out walks back the
   way you came in instead of dumping you at the world. The scale it was left at
   is remembered with it — see zoomOut. */
function setView(next) {
  view.history.push({ zoom: view.zoom, custom: view.custom, s: laid.s });
  Object.assign(view, next);
}
/* The way back never goes closer in. Now that the map can be pinched, the way
   you came can run deeper than where you are: fly to a region from a pinched-in
   view and the step behind you is that pinch. A button with a minus in it that
   zoomed IN would be a lie, so a step that is not further out is dropped and
   the walk continues; when nothing is left, the world. */
function zoomOut() {
  while (view.history.length) {
    const prev = view.history.pop();
    if ((prev.s ?? 1) < laid.s - 0.01) { view.zoom = prev.zoom; view.custom = prev.custom; return; }
  }
  view.zoom = 'world'; view.custom = null;
}
let resizeTimer = null;

/* ---- shell --------------------------------------------------------------- */

function shell() {
  const langs = LANGS.map(l =>
    `<button class="lang-opt${l.id === LANG ? ' on' : ''}" data-lang="${l.id}">
       <span class="code">${l.label}</span><span class="nm">${esc(l.name)}</span></button>`).join('');

  return `
  <header class="mast">
    <a class="brand" href="#/">
      <img src="tmz-mark.png" alt="Torah MiTzion" width="41" height="38">
      <span class="rule"></span>
      <span class="brand-txt">
        <span class="he">תורה מציון</span>
        <span class="en">${LANG === 'he' ? esc(t('brand.thirty')) : 'Torah MiTzion'}</span>
      </span>
    </a>
    <nav class="nav">
      <a href="#/" data-nav="map">${esc(t('nav.map'))}</a>
      <a href="#/communities" data-nav="communities">${esc(t('nav.communities'))}</a>
      <a href="#/shlichim" data-nav="shlichim">${esc(t('nav.shlichim'))}</a>
      <a href="#/about" data-nav="about">${esc(t('nav.about'))}</a>
      <div class="langpick">
        <button class="lang-btn" id="langBtn" aria-haspopup="true" aria-expanded="false">
          ${LANGS.find(l => l.id === LANG).label}
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 4l3 3 3-3"/></svg>
        </button>
        <div class="lang-menu" id="langMenu" hidden>${langs}</div>
      </div>
      <button class="theme-btn" id="themeBtn" type="button" title="${esc(themeLabel())}" aria-label="${esc(themeLabel())}">
        <svg class="ico-sun" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2"/><path d="M12 2.4v2.3M12 19.3v2.3M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.4 12h2.3M19.3 12h2.3M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/></svg>
        <svg class="ico-moon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M20.5 14.2A8.6 8.6 0 0 1 9.8 3.5a8.6 8.6 0 1 0 10.7 10.7z"/></svg>
      </button>
      <div class="addpick">
        <button class="btn-gold" id="addBtn" aria-haspopup="true" aria-expanded="false">${esc(t('cta.add'))}
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 4l3 3 3-3"/></svg></button>
        <div class="add-menu" id="addMenu" hidden>
          <a href="#/contribute">${esc(t('add.site'))}</a>
          <a href="https://wa.me/${WHATSAPP_NUMBER.replace(/[^0-9]/g, '')}" target="_blank" rel="noopener">${esc(t('add.wa'))}</a>
        </div>
      </div>
    </nav>
  </header>`;
}

/* The disclaimer belongs to the demo data, not to the site. Leaving it up now
   that the archive holds the real communities would tell every visitor that
   the Rosh Kollel they are reading about is invented. */
function provenance() {
  return t(window.TMZApi && window.TMZApi.DEMO ? 'foot.mock' : 'foot.source');
}

/* Who built the WhatsApp agent and this site. One line, the same everywhere
   it appears, so the map's side panel and the page footers cannot drift. */
function credit() {
  return `<span class="credit">
    <img class="credit-logo" src="hagai-logo.png" alt="Hag.Ai" width="26" height="26">
    <span>${esc(t('foot.built'))} <strong>Hag.Ai</strong>
      &middot; <a dir="ltr" href="https://wa.me/972586879347">058-6879347</a>
      &middot; <a dir="ltr" href="mailto:hagaihq@gmail.com">hagaihq@gmail.com</a></span>
  </span>`;
}

function footer() {
  return `<footer class="foot">
    <span>${esc(provenance())}</span>
    ${credit()}
  </footer>`;
}

function wireShell() {
  const here = parseRoute().name;
  document.querySelectorAll('.nav [data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === here));
  const ab = $('#addBtn'), am = $('#addMenu');
  if (ab) {
    ab.onclick = e => { e.stopPropagation(); const open = !am.hidden; am.hidden = open; ab.setAttribute('aria-expanded', String(!open)); };
    document.addEventListener('click', () => { if (am) am.hidden = true; }, { once: true });
  }
  const tb = $('#themeBtn');
  if (tb) tb.onclick = () => {
    setTheme(theme() === 'light' ? 'dark' : 'light');
    tb.title = themeLabel();
    tb.setAttribute('aria-label', themeLabel());
  };
  const btn = $('#langBtn'), menu = $('#langMenu');
  if (btn) {
    btn.onclick = e => {
      e.stopPropagation();
      const open = !menu.hidden;
      menu.hidden = open;
      btn.setAttribute('aria-expanded', String(!open));
    };
    document.addEventListener('click', () => { if (menu) menu.hidden = true; }, { once: true });
    menu.querySelectorAll('[data-lang]').forEach(b => {
      b.onclick = () => { setLang(b.dataset.lang); reloadForLanguage(); };
    });
  }
}

/* ---- map view ------------------------------------------------------------ */

function mapView() {
  return `
  <div class="map-wrap">
    <aside class="gal" id="gal" aria-live="polite"></aside>
    <div class="stage" id="stage" dir="ltr">
      <div class="ambient" id="ambient"></div>
      <div class="zion-glow" id="zionGlow"></div>
      <svg class="map-svg" id="mapSvg"></svg>
      <div class="markers" id="markers"></div>
      <!-- The way back out. It was a line of grey words in the row at the foot
           of the map, and nobody found it; it is now a glass with a minus in
           it, over the map, where a hand that has just pinched the map is
           already looking. The words stay as its label, for a screen reader
           and for the tooltip. -->
      <button class="zoom-out" id="zoomOut" type="button" hidden
              aria-label="${esc(t('fly.out'))}" title="${esc(t('fly.out'))}">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="10.2" cy="10.2" r="6.7"/><path d="M6.8 10.2h6.8"/><path d="M15.1 15.1 20.6 20.6"/>
        </svg>
      </button>
    </div>

    <div class="hero" id="hero">
      <div class="hero-l">
        <div class="thirty"><span class="n">30</span><span class="t">${esc(t('u.years'))}<br><span dir="ltr">1996&ndash;2026</span></span></div>
        <span class="vrule"></span>
        <div class="hero-copy">
          <p class="verse">${VERSE}</p>
          <p class="lede">${esc(t('hero.line'))}</p>
          <a class="hero-cta" href="#/contribute">${esc(t('hero.cta'))}</a>
        </div>
      </div>
      <div class="hero-stats" id="heroStats"></div>
    </div>

    <div class="regions" id="regions" dir="ltr"></div>
  </div>`;
}

/* The one row of words under the map: where to fly, and what the dots mean.
   It sits on the ocean, below every continent, which is the one place a
   panel never covered anything. */
function drawRegions(views) {
  const rows = ['world', ...STATE.regions.map(r => r.id)].filter(k => views[k]).map(k =>
    `<button class="rgn${view.zoom === k ? ' on' : ''}" data-view="${k}">${esc(t(views[k].key))}</button>`).join('');
  $('#regions').innerHTML = `${rows}
    <span class="legend-mini"><span class="s open"></span><span class="s alum"></span>${esc(t('legend.short'))}</span>`;
  $('#regions').querySelectorAll('[data-view]').forEach(b => {
    b.onclick = () => { setView({ zoom: b.dataset.view, custom: null }); drawMap(); };
  });
}

/* ---- the gallery beside the map ------------------------------------------ */

/* The map used to end in a strip of six random thumbnails, and nobody could
   tell that the dots led to photographs. The gallery that replaced it sits
   beside the map and shows whatever the pointer is over: hover a community
   and its photographs appear, click and they stay, leave and the newest
   photographs in the whole album come back. On a touch screen there is no
   hover; a tap pins, and the gallery sits under the map. */
const gal = { hover: null, seq: 0, timer: null };
const canHover = () => window.matchMedia('(hover: hover)').matches;

function galleryHover(id) {
  if (!canHover()) return;
  clearTimeout(gal.timer);
  /* a short grace on leaving, so crossing from a dot to its label does not
     flick the gallery back and forth */
  gal.timer = setTimeout(() => {
    if (gal.hover === id) return;
    gal.hover = id;
    drawGallery();
  }, id ? 80 : 240);
}

function galleryItem(p, showCommunity) {
  const what = showCommunity ? p.community_name : (p.event_name || p.occasion_text || p.people_text || '');
  return `<a class="gal-it" href="#/c/${esc(p.community)}/${p.year}/${esc(p.id)}"
     title="${esc(p.community_name)} · ${p.year}${p.event_name ? ' · ' + esc(p.event_name) : ''}">
    <img src="${esc(TMZApi.thumbUrl(p.path) || p.url)}" srcset="${esc(TMZApi.photoSrcset(p.path))}"
         sizes="(max-width: 900px) 46vw, 210px"
         alt="${esc(p.event_name || p.community_name || '')}" loading="lazy">
    <span class="gal-cap"><b>${p.year}</b>${esc(what || '')}</span></a>`;
}

async function drawGallery() {
  const box = $('#gal');
  if (!box) return;
  const id = gal.hover || view.sel;
  const c = id ? findCommunity(id) : null;
  const my = ++gal.seq;
  const albumTotal = STATE.communities.reduce((a, x) => a + (x.total || 0), 0);

  /* The heading goes up at once, so the switch feels instant even while the
     pictures are on their way. */
  const head = c ? `
    <div class="gal-head">
      <span class="eyebrow">${esc(t('region.' + c.rg))}</span>
      <div class="gal-top">
        <a class="gal-name" href="#/c/${esc(c.id)}">${esc(tf(c.name))}</a>
        ${view.sel === c.id ? `<button class="gal-unpin" id="galUnpin" aria-label="${esc(t('gal.back'))}" title="${esc(t('gal.back'))}">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 5l10 10M15 5L5 15"/></svg></button>` : ''}
      </div>
      <span class="gal-meta"><span dir="ltr">${esc(yearSpan(c))}</span> &middot; ${num(c.total || 0)} ${esc(t('u.photographs')).toLowerCase()}</span>
    </div>` : `
    <div class="gal-head">
      <span class="eyebrow">${esc(t('teaser.title'))}</span>
      <div class="gal-top"><span class="gal-name">${esc(t('gal.latest'))}</span></div>
      <span class="gal-meta">${num(STATE.communities.length)} ${esc(t('u.communities')).toLowerCase()} &middot; ${num(albumTotal)} ${esc(t('u.photographs')).toLowerCase()}</span>
    </div>`;
  const skeleton = Array.from({ length: 9 }, () => '<span class="gal-it skel"></span>').join('');
  box.innerHTML = `${head}<div class="gal-grid" id="galGrid">${skeleton}</div><div class="gal-foot" id="galFoot"></div>`;
  const unpin = box.querySelector('#galUnpin');
  if (unpin) unpin.onclick = () => { view.sel = null; gal.hover = null; drawGallery(); drawMap(); };

  let g = { photos: [], total: 0 };
  try { g = await TMZApi.loadGallery(c ? c.id : null, 9, LANG); } catch (e) { console.error('gallery', e); }
  if (my !== gal.seq) return;   // the pointer has moved on; a later call owns the panel
  const grid = $('#galGrid'), foot = $('#galFoot');
  if (!grid || !foot) return;

  if (g.photos.length) {
    grid.innerHTML = g.photos.slice(0, 9).map(p => galleryItem(p, !c)).join('');
  } else if (c && !g.live && c.total > 0) {
    /* Before tmz_gallery is deployed the fallback is a random handful, which
       may hold none of this community's photographs. It has some; say how
       many and offer the page, rather than announce an emptiness that is
       not there. */
    grid.className = 'gal-empty quiet';
    grid.innerHTML = `<p>${num(c.total)} ${esc(t('u.photographs')).toLowerCase()}</p>
      <a class="btn-gold sm" href="#/c/${esc(c.id)}">${esc(t('gal.open').replace('{name}', tf(c.name)))}</a>`;
  } else {
    /* Two kinds of empty, both an invitation: this community has nothing
       yet, or the whole album is still waiting for its first photograph. */
    grid.className = 'gal-empty';
    grid.innerHTML = c
      ? `<p>${esc(t('gal.none').replace('{name}', tf(c.name)))}</p><a class="btn-gold sm" href="#/contribute">${esc(t('yr.emptyAsk'))}</a>`
      : `<p>${esc(t('banner.empty'))}</p><a class="btn-gold sm" href="#/contribute">${esc(t('cta.send'))}</a>`;
  }
  foot.innerHTML = `
    <div class="gal-row">
      ${c && g.photos.length ? `<a class="btn-gold sm" href="#/c/${esc(c.id)}">${esc(t('gal.open').replace('{name}', tf(c.name)))}</a>` : ''}
      <span class="gal-hint">${esc(canHover() ? t('gal.hint') : t('gal.hintTouch'))}</span>
    </div>
    <div class="gal-credit">${credit()}</div>`;
}

/* The stage can still measure zero on the frame right after innerHTML — fonts
   and the banner are yet to settle. Giving up silently there left the map
   blank with no error to find, so wait for a real size instead of racing
   layout. */
function drawMap(attempt = 0) {
  const stage = $('#stage');
  if (!stage) return;
  const W = stage.clientWidth, H = stage.clientHeight;
  if (W < 40 || H < 40) {
    if (attempt < 30) requestAnimationFrame(() => drawMap(attempt + 1));
    return;
  }

  const proj = projection(W, H);
  const views = buildViews(proj, W, H, STATE.communities, STATE.regions.map(r => r.id));
  /* Fill the chrome BEFORE measuring it: an empty panel measures a few pixels
     tall, and labels then get placed exactly where it is about to appear. */
  drawRegions(views);
  drawStats();
  const v = view.zoom === 'custom' && view.custom ? view.custom : (views[view.zoom] || views.world);
  const s = v.s, tx = W / 2 - s * v.cx, ty = H / 2 - s * v.cy;
  const zoomed = s > 1.01;

  const jx = proj.fx(JERUSALEM.lon), jy = proj.fy(JERUSALEM.lat);
  const step = Math.max(7, W / 190);

  /* One path per community, so an arc can light up under the pointer and
     be clicked like the dot it leads to; a wide invisible twin gives the
     pointer something to hit. The selected community's arc is drawn last,
     on top. */
  let arcs = '', hits = '';
  const pts = STATE.communities.map(c => {
    const mx = proj.fx(c.lon), my = proj.fy(c.lat);
    const seg = arc(jx, jy, mx, my);
    const sel = c.id === view.sel;
    const path = `<path class="arc${sel ? ' sel' : ''}" data-arc="${esc(c.id)}" d="${seg}" stroke-width="${((sel ? 1.5 : 0.8) / s).toFixed(3)}"/>`;
    if (sel) arcs += path; else arcs = path + arcs;
    hits += `<path class="arc-hit" data-arc="${esc(c.id)}" d="${seg}" stroke-width="${(14 / s).toFixed(3)}"/>`;
    return { c, mx, my, x: mx * s + tx, y: my * s + ty };
  });

  $('#mapSvg').setAttribute('viewBox', `0 0 ${W} ${H}`);
  $('#mapSvg').innerHTML = `
    <g style="transform: translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${s.toFixed(4)})">
      <path class="map-land" d="${stipple(proj, W, H, s, tx, ty, step)}" stroke-width="${(2.15 / s).toFixed(3)}"/>
      ${arcs}${hits}
    </g>`;

  const zg = $('#zionGlow');
  zg.style.left = (jx * s + tx) + 'px';
  zg.style.top = (jy * s + ty) + 'px';
  zg.style.opacity = zoomed ? 0.3 : 1;
  $('#ambient').style.opacity = zoomed ? 0.75 : 0;

  /* The way out shows only when there is something to come out of. */
  const zo = $('#zoomOut');
  if (zo) zo.hidden = !zoomed;
  /* At the world the map is exactly the size of its box and cannot be dragged
     anywhere, so a finger dragged across it belongs to the page and scrolls
     it. Zoomed in there is somewhere to go, and the map takes the drag. Two
     fingers are the map's either way — see wireMapZoom. */
  stage.style.touchAction = zoomed ? 'none' : 'pan-y';
  stage.classList.toggle('pannable', zoomed);
  /* What a gesture moves, so it need not redraw: a redraw re-samples the land
     and re-places every label, which is 10-16ms on a desktop — a dropped frame
     at 60Hz, and worse on a telephone. */
  Object.assign(laid, { s, tx, ty, W, H, jx, jy });

  /* the chrome a label must not slide underneath, measured from the real DOM */
  const sr = stage.getBoundingClientRect();
  /* .hero is a full-width flex row with a gap in the middle; blocking it whole
     walls off the entire top strip and starves Europe of labels. Measure the two
     halves it actually occupies. */
  /* The floating AI button sits over the Pacific corner, right where Sydney is. */
  const blocked = ['.hero-l', '.hero-stats', '#regions', '.chat', '#zoomOut'].map(sel => {
    const e = $(sel); if (!e || e.hidden) return null;
    const r = e.getBoundingClientRect();
    return [r.left - sr.left - 6, r.top - sr.top - 6, r.right - sr.left + 6, r.bottom - sr.top + 6];
  }).filter(Boolean);

  /* Jerusalem's own label is drawn by hand below the star; nothing may sit on it. */
  blocked.push([jx * s + tx - 60, jy * s + ty + 22, jx * s + tx + 60, jy * s + ty + 44]);
  const groups = clusterPoints(pts, view.sel);
  const markers = groups.map(g => ({
    x: g[0].x, y: g[0].y, mx: g[0].mx, my: g[0].my, count: g.length, members: g,
    c: g[0].c, name: tf(g[0].c.name), sel: g[0].c.id === view.sel
  }));
  /* At world view only what is alive gets a name: open communities, the
     selected one, and the clusters' counts. Alumni are a hollow dot until
     you fly closer — half the text, none of the meaning lost. */
  const named = markers;   // every dot may have a name; the placer drops what would collide
  placeLabels(named, blocked, W, H, isRTL());

  $('#markers').innerHTML =
    `<div class="jeru" data-mx="${jx}" data-my="${jy}" style="left:${jx * s + tx}px; top:${jy * s + ty}px">
       <svg viewBox="0 0 44 44" width="44" height="44">
         <circle class="jeru-ring" cx="22" cy="22" r="18" stroke-width=".6"/>
         <path class="jeru-star" d="M22 5 L24.6 19.4 L39 22 L24.6 24.6 L22 39 L19.4 24.6 L5 22 L19.4 19.4 Z"/>
       </svg><span>${LANG === 'he' ? 'ירושלים' : LANG === 'ru' ? 'Иерусалим' : 'Jerusalem'}</span>
     </div>` +
    markers.map((m, i) => {
      if (m.count > 1) {
        return `<div class="mk" data-members="${esc(m.members.map(p => p.c.id).join(','))}" data-mx="${m.mx}" data-my="${m.my}" style="left:${m.x}px; top:${m.y}px">
                  <button class="clus" data-cluster="${i}">${m.count}</button></div>`;
      }
      const cls = m.sel ? 'is-sel' : (m.c.c ? 'is-alumni' : 'is-active');
      /* Every name is a door to its community, not only the chosen one's.
         Reaching for the word is what people try first, and going by the dot
         asks for two clicks to get there: one to choose it, another to enter.
         A real anchor rather than a span with a handler, so it takes the
         keyboard, the middle button and open-in-new-tab for nothing. */
      const lab = m.label
        ? `<a class="lbl" href="#/c/${esc(m.c.id)}" data-lbl="${esc(m.c.id)}" title="${esc(t('cta.fly'))}" style="left:${m.label[0]}px; top:${m.label[1]}px; transform:${
            m.label[2] === 'e' ? 'translate(-100%,-50%)' : m.label[2] === 'm' ? 'translate(-50%,-50%)' : 'translateY(-50%)'
          }">${esc(m.name)}</a>` : '';
      return `<div class="mk ${cls}" data-id="${esc(m.c.id)}" data-name="${esc(m.name)}" data-mx="${m.mx}" data-my="${m.my}" style="left:${m.x}px; top:${m.y}px">
                <button class="hit" data-pick="${m.c.id}" aria-label="${esc(m.name)}"></button>
                <span class="dot"></span>${lab}</div>`;
    }).join('');

  /* An arc under the pointer lights up with its city; a click on it does
     what a click on the dot does. */
  const pick = id => {
    if (view.sel === id) { location.hash = `#/c/${id}`; return; }
    view.sel = id; drawGallery(); drawMap();
    /* On a touch screen the gallery sits under the map, maybe below the fold;
       a tap that changed nothing in view would look like a tap that failed. */
    const g = $('#gal');
    if (!canHover() && g && g.getBoundingClientRect().top > window.innerHeight * 0.6) g.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const hot = (id, on) => {
    galleryHover(on ? id : null);
    $('#mapSvg').querySelectorAll(`.arc[data-arc="${CSS.escape(id)}"]`).forEach(a => a.classList.toggle('hot', on));
    /* The dot itself, or the cluster it is folded into — the name still shows. */
    const mk = $('#markers').querySelector(`.mk[data-id="${CSS.escape(id)}"]`)
      ?? [...$('#markers').querySelectorAll('.mk[data-members]')].find(m => m.dataset.members.split(',').includes(id));
    if (!mk) return;
    mk.classList.toggle('hot', on);
    const name = mk.dataset.name ?? tf(findCommunity(id)?.name);
    if (on && !mk.querySelector('.lbl')) {
      mk.insertAdjacentHTML('beforeend', `<span class="lbl tmp" style="left:${mk.dataset.members ? 18 : 13}px; top:0; transform:translateY(-50%)">${esc(name)}</span>`);
    } else if (!on) mk.querySelector('.lbl.tmp')?.remove();
  };
  $('#mapSvg').querySelectorAll('.arc-hit').forEach(h => {
    h.onmouseenter = () => hot(h.dataset.arc, true);
    h.onmouseleave = () => hot(h.dataset.arc, false);
    h.onclick = () => pick(h.dataset.arc);
  });

  $('#markers').querySelectorAll('[data-pick]').forEach(b => {
    b.onclick = () => pick(b.dataset.pick);
    b.onmouseenter = () => hot(b.dataset.pick, true);
    b.onmouseleave = () => hot(b.dataset.pick, false);
  });
  /* The name answers the pointer exactly as its dot does, so reading a label
     brings up that community's photographs without having to find the dot. */
  $('#markers').querySelectorAll('[data-lbl]').forEach(a => {
    a.onmouseenter = () => hot(a.dataset.lbl, true);
    a.onmouseleave = () => hot(a.dataset.lbl, false);
  });
  $('#markers').querySelectorAll('[data-cluster]').forEach(b => {
    b.onclick = () => {
      setView({ custom: fitCluster(markers[+b.dataset.cluster].members, W, H), zoom: 'custom' });
      drawMap();
    };
  });
}

/* ---- zoom by hand ---------------------------------------------------------
   Flying to a named region is how this map was navigated, and on a telephone
   that is not enough: the thing on the screen is a map, and a map is pinched.
   Two fingers scale it and carry it; a mouse does the same with the wheel and
   a drag.

   A gesture moves what drawMap already laid down and redraws once, when the
   hands come off. A redraw re-samples the land and re-places every label —
   measured at 10-16ms on a desktop, which is a dropped frame at 60Hz and
   worse on a telephone, so it cannot happen sixty times a second. */

const MAX_S = 16;
/* What is on the screen now, in the geometry drawMap works in. */
const laid = { s: 1, tx: 0, ty: 0, W: 0, H: 0, jx: 0, jy: 0 };
const grip = { pts: new Map(), from: null, pinch: null, drag: null, moved: false, wheel: null };

/* The world is exactly the size of its box at scale 1, so the window onto it
   is kept inside it. At scale 1 that pins the centre to the middle, which is
   why the world view cannot be dragged off its own edge.

   `was` is where the window is now. A view fitted to a region may already hang
   over the world's edge — Oceania does, by a sixth of the stage, because its
   communities sit on the bottom line of the map — and being yanked back the
   instant a finger touches it would be a jolt out of nowhere. So a window that
   is already outside is never pushed further out, and never pulled in either:
   zooming out tightens the fence on its own, because the window grows, and
   the view is drawn back a frame at a time. */
function fence(s, cx, cy, W, H, was) {
  const lim = (v, lo, hi, prev) => {
    if (prev != null) { lo = Math.min(lo, prev); hi = Math.max(hi, prev); }
    return Math.min(Math.max(v, lo), hi);
  };
  return { s, cx: lim(cx, W / (2 * s), W - W / (2 * s), was?.cx),
              cy: lim(cy, H / (2 * s), H - H / (2 * s), was?.cy) };
}

/* Move what is drawn, without drawing it again. Every marker carries the
   coordinates it was placed from, so this is one multiplication each. */
function placeLive(v) {
  const s = v.s, tx = laid.W / 2 - s * v.cx, ty = laid.H / 2 - s * v.cy;
  laid.s = s; laid.tx = tx; laid.ty = ty;
  const g = $('#mapSvg')?.firstElementChild;
  if (g) g.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${s.toFixed(4)})`;
  $('#markers').querySelectorAll('[data-mx]').forEach(el => {
    el.style.left = (+el.dataset.mx * s + tx).toFixed(1) + 'px';
    el.style.top = (+el.dataset.my * s + ty).toFixed(1) + 'px';
  });
  const zg = $('#zionGlow');
  if (zg) { zg.style.left = (laid.jx * s + tx).toFixed(1) + 'px'; zg.style.top = (laid.jy * s + ty).toFixed(1) + 'px'; }
  const zo = $('#zoomOut');
  if (zo) zo.hidden = s <= 1.01;
}

/* Scale about a point on the stage, keeping whatever is under that point under
   it. Holding the scale still and moving the point is a pan; the same line
   does both, which is what two fingers do at once anyway. */
function zoomAbout(s, px, py, wx, wy) {
  s = Math.min(MAX_S, Math.max(1, s));
  /* Where the window is at this instant, whatever named view put it there. */
  const was = { cx: (laid.W / 2 - laid.tx) / laid.s, cy: (laid.H / 2 - laid.ty) / laid.s };
  const tx = px - wx * s, ty = py - wy * s;
  view.custom = fence(s, (laid.W / 2 - tx) / s, (laid.H / 2 - ty) / s, laid.W, laid.H, was);
  view.zoom = 'custom';
  placeLive(view.custom);
}

function gripOn() {
  if (grip.from) return;
  grip.from = { zoom: view.zoom, custom: view.custom, s: laid.s };
  $('.map-wrap')?.classList.add('gesturing');
}

function gripOff() {
  if (!grip.from) return;
  const was = grip.from, wrap = $('.map-wrap');
  grip.from = null;
  if (!view.custom || view.custom.s <= 1.01) {
    /* Back at the world it IS the world view: the way out goes away, and the
       way back is not a stack of undone pinches. */
    view.zoom = 'world'; view.custom = null; view.history.length = 0;
  } else if (was.zoom !== 'custom') {
    /* One step back per excursion, not per pinch. A pinch that starts from a
       view the fingers already made is refining it, not setting out again. */
    view.history.push(was);
  }
  drawMap();
  requestAnimationFrame(() => wrap?.classList.remove('gesturing'));
}

/* Where a pointer is on the map, and what lies under it. Read fresh every
   time: the stage is a new element after every render, and the page can
   scroll under it between one event and the next. */
const stageAt = e => {
  const st = $('#stage'); if (!st) return null;
  const r = st.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
};
const underneath = p => ({ x: (p.x - laid.tx) / laid.s, y: (p.y - laid.ty) / laid.s });

function gripMove(e) {
  if (!grip.pts.has(e.pointerId)) return;
  const p = stageAt(e); if (!p) return;
  grip.pts.set(e.pointerId, p);
  if (grip.pinch && grip.pts.size >= 2) {
    const [a, b] = [...grip.pts.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    zoomAbout(grip.pinch.s * (d / grip.pinch.d), (a.x + b.x) / 2, (a.y + b.y) / 2,
              grip.pinch.w.x, grip.pinch.w.y);
  } else if (grip.drag) {
    if (!grip.moved) {
      if (Math.hypot(p.x - grip.drag.p.x, p.y - grip.drag.p.y) < 6) return;
      grip.moved = true; gripOn();
    }
    zoomAbout(laid.s, p.x, p.y, grip.drag.w.x, grip.drag.w.y);
  }
}

function gripRelease(e) {
  if (!grip.pts.delete(e.pointerId)) return;
  if (grip.pinch && grip.pts.size === 1) {
    /* One finger lifted out of a pinch: the other goes on carrying the map
       rather than ending the gesture under it. */
    grip.pinch = null;
    const p = [...grip.pts.values()][0];
    grip.drag = { p, w: underneath(p) };
  }
  if (grip.pts.size) return;
  grip.pinch = null; grip.drag = null;
  gripOff();
  /* After the click this release is about to produce, not before it. */
  setTimeout(() => { grip.moved = false; }, 0);
}

/* The moves and the releases are on the window, not the stage: a finger that
   leaves the map mid-pinch must still be followed, and pointer capture is not
   the way — it retargets the click that follows, which would put every dot out
   of reach. They are wired once for the page; the stage's own are wired per
   render, because the stage is a new element every time. */
let gripWired = false;

function wireMapZoom() {
  const stage = $('#stage');
  if (!stage) return;

  stage.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!laid.W) return;                 // nothing drawn yet
    const p = stageAt(e); if (!p) return;
    grip.pts.set(e.pointerId, p);
    if (grip.pts.size === 2) {
      const [a, b] = [...grip.pts.values()];
      grip.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: laid.s,
                     w: underneath({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }) };
      grip.drag = null;
      grip.moved = true;                 // two fingers are never a tap
      gripOn();
    } else if (grip.pts.size === 1 && laid.s > 1.01) {
      /* A drag on a map that has somewhere to go. It is not a drag until it
         has moved, so a tap on a dot is still a tap. */
      grip.drag = { p, w: underneath(p) };
      grip.moved = false;
    }
  });

  /* A drag that happened to start on a dot chose no community. */
  stage.addEventListener('click', e => {
    if (!grip.moved) return;
    e.preventDefault(); e.stopPropagation();
  }, true);

  /* Two fingers belong to the map even where one finger belongs to the page.
     touch-action is settled when the FIRST finger lands, so at the world view
     — where it is pan-y, so that a thumb still scrolls the page — the second
     finger has to say for itself that this one is a pinch. */
  stage.addEventListener('touchmove', e => {
    if (e.touches.length > 1 && e.cancelable) e.preventDefault();
  }, { passive: false });

  stage.addEventListener('wheel', e => {
    /* On a desktop the map fills the screen and the page behind it does not
       scroll, so the wheel is the map's. On a telephone-width layout the page
       does scroll, and only a trackpad pinch — which arrives here as a wheel
       with ctrlKey — may take it. */
    if (window.matchMedia('(max-width: 900px)').matches && !e.ctrlKey) return;
    if (!laid.W) return;
    e.preventDefault();
    const p = stageAt(e); if (!p) return;
    const w = underneath(p);
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? laid.H : 1);
    gripOn();
    zoomAbout(laid.s * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0022)), p.x, p.y, w.x, w.y);
    clearTimeout(grip.wheel);
    grip.wheel = setTimeout(gripOff, 220);
  }, { passive: false });

  const zo = $('#zoomOut');
  if (zo) zo.onclick = () => { zoomOut(); drawMap(); };

  if (gripWired) return;
  gripWired = true;
  window.addEventListener('pointermove', gripMove);
  window.addEventListener('pointerup', gripRelease);
  window.addEventListener('pointercancel', gripRelease);
}

function drawStats() {
  const open = STATE.communities.filter(c => !c.c).length;
  const photos = STATE.communities.reduce((a, c) => a + (c.total || 0), 0);
  $('#heroStats').innerHTML = [
    [STATE.communities.length, t('u.communities'), ''],
    [open, t('u.open'), ''],
    [photos, t('u.photographs'), 'gold']
  ].map(([n, lab, cl]) =>
    `<div class="stat"><span class="v ${cl}">${num(n)}</span><span class="k">${esc(lab)}</span></div>`
  ).join('');
}

/* ---- community / year view ----------------------------------------------- */

function photoArt(p) {
  const [a, b, c2, band] = p.art;
  return `<svg viewBox="0 0 240 176" preserveAspectRatio="xMidYMid slice">
    <rect width="240" height="176" fill="#101B2E"/>
    <rect y="${band}" width="240" height="176" fill="#16243C"/>
    <circle cx="${a % 190 + 25}" cy="96" r="16" fill="#1E3050"/>
    <circle cx="${b % 190 + 25}" cy="104" r="20" fill="#22375C"/>
    <circle cx="${c2 % 190 + 25}" cy="92" r="14" fill="#1B2B48"/></svg>`;
}

/* One photograph in a grid, in the markup the viewer reads back: the id for
   the share link, .ev / .names / .mt for its caption. `lead` opens the small
   line — the year, on a page that spans years. */
function photoFigure(p, i, lead = '') {
  const title = p.event_name || p.occasion_text || '';
  const mt = [lead, p.taken_on ? `<span dir="ltr">${esc(p.taken_on)}</span>` : '',
              p.event_name && p.occasion_text ? esc(p.occasion_text) : ''].filter(Boolean).join(' &middot; ');
  return `
    <figure class="photo" data-photo="${i}" data-photo-id="${esc(p.id)}" role="button" tabindex="0" aria-label="${esc(t('lb.open'))}">
      <img src="${esc(TMZApi.thumbUrl(p.path) || p.url)}" srcset="${esc(TMZApi.photoSrcset(p.path))}"
           sizes="(max-width: 900px) 46vw, 170px"
           alt="${esc(title)}" loading="lazy">
      <figcaption><span class="ev">${esc(title)}</span>
        ${p.people_text ? `<span class="names" dir="auto">${esc(p.people_text)}</span>` : ''}
        <span class="mt">${mt}</span>
      </figcaption></figure>`;
}

/* No portraits are held yet, so a grey silhouette would only be a placeholder
   pretending to be a photograph. The first letter of the name, set in the
   serif, says who without pretending to show them. */
function initial(name, portrait) {
  if (portrait) return `<img class="ini ini-img" src="${esc(TMZApi.photoUrl(portrait))}" alt="${esc(name || '')}" loading="lazy">`;
  const ch = String(name || '').trim().replace(/^(הרב|רב|Rabbi|Rav|Рав)\s+/i, '').charAt(0);
  return `<span class="ini" aria-hidden="true">${esc(ch || '·')}</span>`;
}

/* The community's own page: who led it, and every year as a tile — a
   photograph where there is one, an invitation where there is not. The bar
   chart this replaced said the same in numbers, and a visitor who had just
   come from the map for the pictures found none on it. */
async function overviewView(c) {
  const h = TMZApi.historyFrom(c);
  let ov = { roshei: [], people: 0 };
  let g = { photos: [], covers: [], total: 0, live: false };
  const [o, gg] = await Promise.allSettled([TMZApi.loadOverview(c.id, LANG), TMZApi.loadGallery(c.id, 24, LANG)]);
  if (o.status === 'fulfilled') ov = o.value; else console.error('overview', o.reason);
  if (gg.status === 'fulfilled') g = gg.value; else console.error('gallery', gg.reason);
  const filled = h.rows.length - h.holes;
  const cover = Object.fromEntries(g.covers.map(k => [String(k.year), k]));
  const tiles = h.rows.map(o => o.n ? `
    <a class="ytile has" href="#/c/${esc(c.id)}/${o.year}" title="${o.year} · ${o.n}">
      ${cover[o.year] ? `<img src="${esc(TMZApi.thumbUrl(cover[o.year].path) || cover[o.year].url)}"
           srcset="${esc(TMZApi.photoSrcset(cover[o.year].path))}" sizes="(max-width: 900px) 46vw, 170px"
           alt="" loading="lazy">` : ''}
      <span class="ytile-cap"><b>${o.year}</b><i>${num(o.n)}</i></span></a>` : `
    <a class="ytile none" href="#/c/${esc(c.id)}/${o.year}" title="${o.year}">
      <em>${o.year}</em><b>+</b><i>${esc(t('ov.wereYou'))}</i></a>`).join('');
  const shown = g.photos.length;
  const wall = shown ? `
    <section class="ov-wall">
      <div class="sec-head"><span>${esc(t('ov.wall'))}</span>
        <span class="dim">${g.live ? `${num(g.total)} &middot; ${esc(t('ov.latestFirst'))}` : ''}</span></div>
      <div class="photos">${g.photos.map((p, i) => photoFigure(p, i, `<span dir="ltr">${p.year}</span>`)).join('')}</div>
      ${g.live && g.total > shown ? `<p class="dim ov-showing">${esc(t('ov.showing')).replace('{shown}', num(shown)).replace('{total}', num(g.total))}</p>` : ''}
    </section>` : '';
  return `
  <div class="cv ov">
    <div class="crumb"><a href="#/">&larr; ${esc(t('cta.back'))}</a></div>
    <div class="ov-head">
      <div>
        <span class="eyebrow">${esc(t('region.' + c.rg))}</span>
        <h1>${esc(tf(c.name))}</h1>
        <p class="dim"><span dir="ltr">${esc(yearSpan(c))}</span> &middot; ${num(h.rows.length)} ${esc(t('u.years')).toLowerCase()}
          &middot; ${num(ov.people)} ${esc(t('ov.people'))} &middot; ${num(h.total)} ${esc(t('u.photographs')).toLowerCase()}</p>
      </div>
    </div>
    <section class="ov-years">
      <div class="sec-head"><span>${esc(t('ov.byYear'))} &middot; ${esc(t('ov.pick'))}</span>
        <span class="dim">${num(filled)} ${esc(t('ov.filled'))} &middot; <span class="warn">${num(h.holes)} ${esc(t('ov.holes'))}</span></span></div>
      <div class="ytiles" dir="ltr">${tiles}</div>
    </section>
    ${wall}
    ${ov.roshei.length ? `
    <section class="ov-roshei">
      <div class="sec-head"><span>${esc(t('ov.roshei'))}</span></div>
      <div class="cohort">${ov.roshei.map(r => `
        <a class="card" href="#/c/${esc(c.id)}/${r.from}">${initial(r.name, r.portrait)}<span class="card-txt">
          <span class="pn">${esc(r.name)}</span>
          <span class="pr" dir="ltr">${r.from}&ndash;${r.to || ''}</span></span></a>`).join('')}
      </div>
    </section>` : ''}
  </div>`;
}

async function communityView(id, year) {
  const c = findCommunity(id);
  if (!c) { location.hash = '#/'; return ''; }
  if (!year) return overviewView(c);

  const h = TMZApi.historyFrom(c);
  const yr = year >= h.first && year <= h.last ? year : h.first;

  let data;
  try {
    data = await TMZApi.loadYear(c.id, yr, LANG);
  } catch (e) {
    return `<div class="cv"><div class="empty-year">
      <h3>${esc(t('err.load'))}</h3><p>${esc(e.message)}</p></div></div>`;
  }

  const { rosh, household, cohort, photos } = data;

  const rail = h.rows.map(o => {
    const d = Math.abs(o.year - yr);
    return `<button class="ry${o.year === yr ? ' on' : ''}${o.n === 0 ? ' none' : ''}" data-year="${o.year}"
      style="--ry:${Math.max(12, 26 - d * 2.2).toFixed(1)}px; opacity:${Math.max(0.3, 1 - d * 0.09).toFixed(2)}">${o.year}</button>`;
  }).join('');

  const peopleNamed = photos.reduce((a, p) => a + (p.people || 0), 0);

  const roshBlock = rosh ? `
    <section class="rosh-band">
      <div class="rosh-main">
        <div class="pf big">${initial(rosh.person, rosh.portrait)}</div>
        <div class="rosh-txt">
          <span class="eyebrow gold">${esc(t('yr.rosh'))}</span>
          <h3>${esc(rosh.person || '')}</h3>
          <p class="dim">${esc(tf(c.name))}
            <span dir="ltr">${rosh.from}&ndash;${rosh.to || ''}</span></p>
        </div>
      </div>
      ${household.length ? `
      <div class="vsep"></div>
      <div class="house">
        <span class="eyebrow">${esc(t('yr.household'))}</span>
        <div class="people">${household.map(p => `
          <div class="card">${initial(p.person, p.portrait)}<span class="card-txt">
            <span class="pn">${esc(p.person || '')}</span>
            <span class="pr">${esc(p.role === 'spouse' ? t('yr.spouse') : t('yr.child'))}</span></span></div>`).join('')}
        </div>
      </div>` : ''}
    </section>` : '';

  const cohortBlock = cohort.length ? `
    <section class="sec">
      <div class="sec-head"><span>${esc(t('yr.cohort'))} <span dir="ltr">${yr}</span></span>
        <span class="dim">${num(cohort.length)}</span></div>
      <div class="cohort">${cohort.map(p => `
        <div class="card">${initial(p.person, p.portrait)}<span class="card-txt">
          <span class="pn">${esc(p.person || '')}</span>
          <span class="pr">${esc(p.institution
            || (p.role === 'child' ? t('yr.child') : p.role === 'spouse' ? t('yr.spouse') : t('nav.shlichim')))}</span></span></div>`).join('')}
      </div>
    </section>` : '';

  /* Two different kinds of empty, and conflating them would be a lie. Holding
     no photographs but knowing the roster makes "we know who was here" true,
     and it is the strongest thing we can say. Knowing neither does not, and
     the copy has to admit that instead. */
  const photoBlock = photos.length === 0 ? `
    <section class="empty-year">
      <h3>${esc(t('yr.emptyBig')).replace('{year}', yr)}</h3>
      <p>${esc(rosh || cohort.length ? t('yr.emptySub') : t('yr.emptyNothing'))}</p>
      <a class="btn-gold" href="#/contribute">${esc(t('yr.emptyAsk'))}</a>
    </section>` : `
    <section class="sec">
      <div class="sec-head"><span>${esc(t('yr.photos'))}</span>
        <span class="dim">${num(photos.length)} ${esc(t('band.held'))}</span></div>
      <div class="photos">${photos.map((p, i) => photoFigure(p, i)).join('')}</div>
    </section>`;

  /* On a maximized desktop the page is two columns under the rail — the
     people on one side, the photographs on the other, each scrolling on its
     own — so nothing is ever below the fold. Everywhere else the wrappers
     are plain blocks and the page reads top to bottom as before. */
  return `
  <div class="cv year">
    <div class="yhead">
      <div class="yhead-l">
        <a class="crumb-link" href="#/c/${esc(c.id)}">&larr; ${esc(tf(c.name))}</a>
        <h1><span dir="ltr">${yr}&ndash;${String(yr + 1).slice(2)}</span></h1>
        <span class="yhead-meta">${num((rosh ? 1 : 0) + household.length + cohort.length)} ${esc(t('u.shlichim')).toLowerCase()}
          &middot; ${num(photos.length)} ${esc(t('u.photographs')).toLowerCase()}</span>
      </div>
      <a class="btn-gold sm" href="#/contribute">${esc(t('cta.addYear'))}</a>
    </div>
    <div class="rail" id="rail">${rail}</div>

    <div class="yr-cols">
      <div class="yr-right">${photoBlock}</div>
      <div class="yr-left">${roshBlock}${cohortBlock}</div>
    </div>
  </div>`;
}

/* The organisation's WhatsApp number, once there is one. Until then this stays
   empty and the offer is not shown at all — the page used to print the literal
   string "[WHATSAPP NUMBER]" to every visitor, which is worse than saying
   nothing: it invites someone to message a number that does not exist. Set it
   here when the channel is connected and the line appears by itself. */
const WHATSAPP_NUMBER = '+972 76-530-0609';

/* ---- contribute ---------------------------------------------------------- */

function contributeView() {
  const opts = STATE.communities.slice().sort((a, b) => tf(a.name).localeCompare(tf(b.name)))
    .map(c => `<option value="${esc(c.id)}">${esc(tf(c.name))}</option>`).join('');
  return `
  <div class="cn">
    <div class="cn-head">
      <span class="eyebrow gold">${esc(t('cta.add'))}</span>
      <h1>${esc(t('con.title'))}</h1>
      <p class="lede">${esc(t('con.lede'))}</p>
    </div>

    <div id="upResult"></div>

    <div class="cn-cols">
    <label class="drop" id="drop">
      <input type="file" id="file" accept="image/jpeg,image/png,image/webp,image/heic" hidden>
      <div id="dropIdle">
        <svg class="drop-ico" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-5 5-2-2-6 5"/></svg>
        <span>${esc(t('con.drop'))}</span>
        <span class="btn-gold sm">${esc(t('cta.choose'))}</span>
      </div>
      <div id="dropPreview" hidden></div>
    </label>

    <div class="cn-form">
    <div class="fields">
      <label><span>${esc(t('con.f1'))}</span>
        <select id="u_comm"><option value="">—</option>${opts}</select></label>
      <label><span>${esc(t('con.f2'))}</span>
        <input id="u_year" type="number" min="1996" max="2026" placeholder="2007"></label>
      <label><span>${esc(t('con.f3'))} <em>${esc(t('con.opt'))}</em></span>
        <input id="u_people" placeholder="&mdash;"></label>
      <label><span>${esc(t('con.f4'))} <em>${esc(t('con.opt'))}</em></span>
        <input id="u_event" placeholder="&mdash;"></label>
      <label><span>${esc(t('con.yourName'))}</span>
        <input id="u_name" placeholder="&mdash;"></label>
      <label><span>${esc(t('con.yourEmail'))} <em>${esc(t('con.opt'))}</em></span>
        <input id="u_email" type="email" placeholder="&mdash;"></label>
    </div>

    <label class="consent">
      <input type="checkbox" id="u_consent">
      <span>${esc(t('con.consent'))}</span>
    </label>

    <p class="screened">
      <svg class="screened-ico" width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V5z"/><path d="M7.5 10l1.8 1.8L13 8"/></svg>
      ${esc(t('con.screened'))}</p>

    <button class="btn-gold big" id="u_send" disabled>${esc(t('cta.send'))}</button>
    ${WHATSAPP_NUMBER ? `<p class="wa">${esc(t('con.wa'))} &mdash;
      <a dir="ltr" href="https://wa.me/${WHATSAPP_NUMBER.replace(/[^0-9]/g, '')}">${esc(WHATSAPP_NUMBER)}</a></p>` : ''}
    </div>
    </div>
  </div>`;
}

/* Wiring lives apart from the markup so the view stays a pure string and the
   handlers can be re-attached after every render. */
function wireContribute() {
  const fileInput = $('#file'), drop = $('#drop'), send = $('#u_send');
  const consent = $('#u_consent'), result = $('#upResult');
  let ready = null;

  /* Community and year are required here: unlike WhatsApp there is no
     conversation afterwards to ask for them, and a photograph without them
     has no page to appear on. */
  const comm = $('#u_comm'), year = $('#u_year');
  const placed = () => Boolean(comm.value) && /^(199\d|20[0-2]\d)$/.test(year.value.trim());
  const refresh = () => { send.disabled = !(ready && consent.checked && placed()); };
  consent.onchange = refresh;
  comm.onchange = refresh;
  year.oninput = refresh;

  async function take(file) {
    if (!file) return;
    result.innerHTML = '';
    $('#dropIdle').hidden = true;
    const prev = $('#dropPreview');
    prev.hidden = false;
    prev.innerHTML = `<p class="dim">${esc(t('con.reading'))}</p>`;
    try {
      ready = await TMZUpload.prepare(file);
      prev.innerHTML = `
        <img src="${ready.preview}" alt="" style="max-height:200px; border-radius:3px; display:block; margin:0 auto 12px">
        <p class="dim" style="text-align:center; font-size:12px">
          ${esc(file.name)} · <span dir="ltr">${ready.width}×${ready.height}</span>
          · <span dir="ltr">${Math.round(ready.bytes / 1024)} KB</span>
          ${ready.resized ? ' · ' + esc(t('con.resized')) : ''}
        </p>
        <p style="text-align:center"><span class="btn-gold sm">${esc(t('con.replace'))}</span></p>`;
    } catch (e) {
      ready = null;
      prev.innerHTML = `<p class="warn" style="text-align:center">${esc(e.message)}</p>`;
    }
    refresh();
  }

  fileInput.onchange = () => take(fileInput.files[0]);
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.classList.remove('over');
    take(e.dataTransfer.files[0]);
  });

  send.onclick = async () => {
    if (!ready) return;
    send.disabled = true;
    send.textContent = t('con.sending');
    try {
      const out = await TMZUpload.submit({
        file: ready.base64, mime: ready.mime, phash: ready.phash,
        community_slug: $('#u_comm').value || null,
        year: $('#u_year').value ? parseInt($('#u_year').value, 10) : null,
        people: $('#u_people').value.trim() || null,
        event_note: $('#u_event').value.trim() || null,
        contributor_name: $('#u_name').value.trim() || null,
        contributor_email: $('#u_email').value.trim() || null,
        consented: true
      });
      const kind = out.duplicate ? 'dup' : out.accepted ? 'ok' : 'no';
      result.innerHTML = `<div class="up-result ${kind}">
        <strong>${esc(out.message)}</strong>
        ${out.description ? `<p class="dim">${esc(out.description)}</p>` : ''}
        ${(out.reasons || []).length ? `<p class="dim">${esc(out.reasons.join(' · '))}</p>` : ''}
      </div>`;
      if (out.accepted && !out.duplicate) {
        ready = null;
        $('#dropIdle').hidden = false;
        $('#dropPreview').hidden = true;
        fileInput.value = '';
      }
    } catch (e) {
      result.innerHTML = `<div class="up-result no"><strong>${esc(e.message)}</strong></div>`;
    }
    send.textContent = t('cta.send');
    refresh();
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
}

/* Every photograph on a year page opens full-screen, where it can be zoomed
   and panned; the arrows walk the same year's photographs in order. */
function wireLightbox(root) {
  const figs = [...root.querySelectorAll('[data-photo]')];
  if (!figs.length || !window.TMZLightbox) return;
  // The share link is the server's unfurl page for the photograph, not the
  // site's hash URL — that page carries the picture as its preview image.
  const items = figs.map(f => ({
    id: f.dataset.photoId || '',
    url: f.querySelector('img').src,
    title: (f.querySelector('.ev') || {}).textContent || '',
    names: ((f.querySelector('.names') || {}).textContent || '').trim(),
    sub: [(f.querySelector('.names') || {}).textContent, (f.querySelector('.mt') || {}).textContent]
      .map(x => (x || '').trim()).filter(Boolean).join(' · '),
    shareUrl: f.dataset.photoId
      ? `https://30.torahmitzion.org/p/${encodeURIComponent(f.dataset.photoId)}.html`
      : location.href
  }));
  figs.forEach((f, i) => {
    f.onclick = () => TMZLightbox.open(items, i);
    f.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); TMZLightbox.open(items, i); } };
  });
}

/* ---- communities, shlichim, about ------------------------------------------ */

function communitiesView() {
  const regions = ['na', 'la', 'eu', 'oc'].filter(r => STATE.communities.some(c => c.rg === r));
  const block = rg => {
    const rows = STATE.communities.filter(c => c.rg === rg)
      .sort((a, b) => a.f - b.f || tf(a.name).localeCompare(tf(b.name)));
    return `<section class="idx-region">
      <h2 class="eyebrow gold">${esc(t('region.' + rg))} <span class="dim">${num(rows.length)}</span></h2>
      <div class="idx-list">${rows.map(c => `
        <a class="idx-row" href="#/c/${esc(c.id)}">
          <span class="idx-name">${esc(tf(c.name))}</span>
          <span class="idx-span" dir="ltr">${esc(yearSpan(c))}</span>
          <span class="idx-n">${c.total ? num(c.total) : '<span class="warn">0</span>'}</span>
        </a>`).join('')}</div>
    </section>`;
  };
  return `<div class="cv idx communities">
    <span class="eyebrow gold">${esc(t('nav.communities'))}</span>
    <h1>${esc(t('idx.title'))}</h1>
    <p class="lede">${esc(t('idx.sub'))}</p>
    <div class="idx-grid">${regions.map(block).join('')}</div>
  </div>`;
}

function shlichimView() {
  return `<div class="cv idx shlichim">
    <span class="eyebrow gold">${esc(t('nav.shlichim'))}</span>
    <h1>${esc(t('sh.title'))}</h1>
    <p class="lede">${esc(t('sh.sub'))}</p>
    <form class="sh-form" id="shForm">
      <input id="shQ" type="search" autocomplete="off" placeholder="${esc(t('sh.placeholder'))}" aria-label="${esc(t('sh.title'))}">
      <select id="shC" aria-label="${esc(t('con.f1'))}"><option value="">${esc(t('sh.any'))}</option>${
        STATE.communities.slice().sort((a, b) => tf(a.name).localeCompare(tf(b.name)))
          .map(c => `<option value="${esc(c.id)}">${esc(tf(c.name))}</option>`).join('')}</select>
    </form>
    <div id="shOut" class="sh-out"><p class="dim">${esc(t('sh.hint'))}</p></div>
  </div>`;
}

function wireShlichim() {
  const q = $('#shQ'), out = $('#shOut'), sel = $('#shC');
  let timer = null, seq = 0;
  const run = async () => {
    const term = q.value.trim();
    if (term.length < 2) { out.innerHTML = `<p class="dim">${esc(t('sh.hint'))}</p>`; return; }
    const my = ++seq;
    let rows;
    try { rows = await TMZApi.searchPeople(term, LANG, sel.value || null); }
    catch (e) { if (my === seq) out.innerHTML = `<p class="warn">${esc(t('err.load'))}</p>`; return; }
    if (my !== seq) return;
    let photos = [];
    try { photos = await TMZApi.searchPhotoPeople(term, LANG); } catch { /* people alone, then */ }
    if (my !== seq) return;
    if (!rows.length && !photos.length) { out.innerHTML = `<p class="dim">${esc(t('sh.none'))}</p>`; return; }
    const photoBlock = photos.length ? `
      <h2 class="eyebrow gold sh-h2">${esc(t('sh.inPhotos'))} <span class="dim">${num(photos.length)}</span></h2>
      <div class="sh-photos">${photos.map(p => `
        <a class="sh-photo" href="#/c/${esc(p.community)}/${p.year}/${esc(p.id)}">
          <img src="${esc(TMZApi.thumbUrl(p.path))}" srcset="${esc(TMZApi.photoSrcset(p.path))}"
               sizes="(max-width: 900px) 46vw, 200px" alt="" loading="lazy">
          <span class="sh-photo-txt"><b dir="auto">${esc(p.people || '')}</b>
            <span>${esc(p.community_name)} · <span dir="ltr">${p.year}</span>${p.occasion ? ' · ' + esc(p.occasion) : ''}</span></span>
        </a>`).join('')}</div>` : '';
    out.innerHTML = (rows.length ? `<p class="dim sh-count">${num(rows.length)} ${esc(t('sh.results'))}${rows.length >= 100 ? ' · ' + esc(t('sh.narrow')) : ''}</p>` : '') + rows.map(p => `
      <div class="sh-person">
        ${initial(p.name, p.portrait)}
        <div class="sh-body">
          <span class="sh-name">${esc(p.name)}</span>
          <div class="sh-tenures">${(p.tenures || []).map(x => `
            <a class="chat-link" href="#/c/${esc(x.community)}/${x.from}">
              <b>${esc(x.community_name)}</b>
              <span dir="ltr">${x.from}${x.to && x.to !== x.from ? '–' + x.to : ''}</span>
              <em>${esc(t('role.' + x.role))}</em></a>`).join('')}</div>
        </div>
      </div>`).join('') + photoBlock;
  };
  q.oninput = () => { clearTimeout(timer); timer = setTimeout(run, 250); };
  sel.onchange = run;
  $('#shForm').onsubmit = e => { e.preventDefault(); clearTimeout(timer); run(); };
  q.focus();
}

function aboutView() {
  return `<div class="cv idx about">
    <span class="eyebrow gold">${esc(t('nav.about'))}</span>
    <h1>${esc(t('ab.title'))}</h1>
    <p class="verse">${VERSE}</p>
    <p>${esc(t('ab.p1'))}</p>
    <p>${esc(t('ab.p2'))}</p>
    <p class="about-ask">${esc(t('ab.p3'))}</p>
    <p>${esc(t('ab.p4'))}</p>
    <p>${esc(t('ab.p5'))}</p>
    <p class="about-cta"><a class="btn-gold" href="#/contribute">${esc(t('cta.send'))}</a>
      ${WHATSAPP_NUMBER ? `<a class="btn-ghost" dir="ltr" href="https://wa.me/${WHATSAPP_NUMBER.replace(/[^0-9]/g, '')}">WhatsApp ${esc(WHATSAPP_NUMBER)}</a>` : ''}</p>
  </div>`;
}

/* ---- router -------------------------------------------------------------- */

function parseRoute() {
  const h = (location.hash || '#/').replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  if (parts[0] === 'c' && parts[1]) return { name: 'community', id: parts[1], year: parts[2] ? +parts[2] : null, photo: parts[3] || null };
  if (parts[0] === 'contribute') return { name: 'contribute' };
  if (parts[0] === 'communities') return { name: 'communities' };
  if (parts[0] === 'shlichim') return { name: 'shlichim' };
  if (parts[0] === 'about') return { name: 'about' };
  return { name: 'map' };
}

/* The community list has to be in hand before any view can draw, and it is
   language-dependent, so it reloads when the language does. */
async function loadState() {
  try {
    const d = await TMZApi.loadMap(LANG);
    STATE.communities = d.communities;
    STATE.regions = d.regions.length
      ? d.regions
      : [...new Set(d.communities.map(c => c.rg))].map(id => ({ id, name: null }));
    STATE.error = null;
  } catch (e) {
    STATE.communities = [];
    STATE.regions = [];
    STATE.error = e.message;
  }
  STATE.loaded = true;
  /* Nothing is selected on arrival: the gallery opens on the whole album and
     the map on the whole world, and the visitor's first hover or tap picks. */
  if (!findCommunity(view.sel)) view.sel = null;
}

function banner() {
  if (STATE.error) {
    return `<div class="site-banner err">${esc(t('err.load'))} &mdash; ${esc(STATE.error)}</div>`;
  }
  if (TMZApi.DEMO) {
    return `<div class="site-banner demo">${esc(t('banner.demo'))}
      <a href="${location.pathname}${location.hash}">${esc(t('banner.demoOff'))}</a></div>`;
  }
  const photos = STATE.communities.reduce((a, c) => a + (c.total || 0), 0);
  if (STATE.loaded && photos === 0) {
    return `<div class="site-banner">${esc(t('banner.empty'))}
      <a href="#/contribute">${esc(t('cta.send'))} &rarr;</a></div>`;
  }
  return '';
}

async function render() {
  const r = parseRoute();
  const root = $('#app');
  document.body.dataset.route = r.name;

  if (!STATE.loaded) {
    root.innerHTML = `<div class="site-loading">${esc(t('u.loading'))}</div>`;
    await loadState();
  }

  if (r.name === 'map') {
    /* A hover that was live when the page went away never got its leave
       event; it must not outlive the page. The pinned selection does. */
    clearTimeout(gal.timer); gal.hover = null;
    root.innerHTML = shell() + banner() + mapView();
    wireShell();
    wireMapZoom();
    drawStats();
    requestAnimationFrame(() => drawMap());
    drawGallery();
  } else if (r.name === 'community') {
    root.innerHTML = shell() + banner() +
      `<div class="site-loading">${esc(t('u.loading'))}</div>` + footer();
    wireShell();
    // the year screen needs a second round trip, so the shell goes up first
    const body = await communityView(r.id, r.year);
    root.innerHTML = shell() + banner() + body + footer();
    wireShell();
    root.querySelectorAll('[data-year]').forEach(b => {
      b.onclick = () => { location.hash = `#/c/${r.id}/${b.dataset.year}`; };
    });
    const on = root.querySelector('.ry.on');
    if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
    wireLightbox(root);
    /* A link straight to one photograph — the one the WhatsApp agent sends
       the moment it goes up — opens on it. */
    if (r.photo) {
      const fig = root.querySelector(`[data-photo-id="${CSS.escape(r.photo)}"]`);
      if (fig) { fig.scrollIntoView({ block: 'center' }); fig.click(); }
    }
  } else if (r.name === 'communities') {
    root.innerHTML = shell() + banner() + communitiesView() + footer();
    wireShell();
  } else if (r.name === 'shlichim') {
    root.innerHTML = shell() + shlichimView() + footer();
    wireShell();
    wireShlichim();
  } else if (r.name === 'about') {
    root.innerHTML = shell() + aboutView() + footer();
    wireShell();
  } else {
    root.innerHTML = shell() + contributeView() + footer();
    wireShell();
    wireContribute();
  }
  window.scrollTo(0, 0);
  if (window.TMZChat) TMZChat.relabel();
}

/* Switching language changes the resolved names, so the payload is refetched
   rather than translated in place. */
async function reloadForLanguage() {
  STATE.loaded = false;
  await render();
}

window.addEventListener('hashchange', render);
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (parseRoute().name === 'map') drawMap(); }, 180);
});

initLang();
render();

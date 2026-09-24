/* Full-screen viewer for the photographs.
 *
 * Wheel or pinch zooms about the pointer, drag pans once zoomed, double-tap
 * toggles between fit and 2.5×, arrows and swipes walk the set, Esc closes.
 * It lives outside #app so a route change cannot tear it down mid-look.
 *
 * The stage holds a strip of three pictures — the one before, the one being
 * looked at, and the one after — so a drag carries the neighbour in with the
 * finger rather than cutting to it on release. Every move between pictures
 * goes through slideTo(), buttons and arrow keys included, so all three feel
 * like the same gesture. The strip is transformed for the walk and the middle
 * picture for the zoom, which keeps the two from fighting over one transform.
 * Since the set wraps, the neighbours always exist. */

(function () {
  const MIN = 1, MAX = 8;
  /* How far a drag must travel before it counts as a walk rather than a
     wobble, as a share of the stage. */
  const SWIPE_AT = w => w * 0.30;
  const SLIDE_MS = 280;
  /* Which way the set runs. In a right-to-left interface the next picture
     lies to the left, so the drag that reaches for it is a drag to the
     right — the same mirroring the arrow keys already follow, and the two
     nav buttons now follow with them. Read live rather than cached: the
     language can change under a viewer that is still open. */
  const rtl = () => document.documentElement.dir === 'rtl';
  let items = [], idx = 0;
  let scale = 1, tx = 0, ty = 0;
  const pointers = new Map();
  let lastDist = 0, dragging = false, moved = false, lastTap = 0;
  /* while a one-finger drag is walking the strip: where it began, how far it
     has come, and which axis it committed to */
  let swipe = null, settling = false;
  let root, track, slides, img, cap, counter, shareBtn, pop, popOpen = false;

  function build() {
    root = document.createElement('div');
    root.className = 'lb';
    root.hidden = true;
    root.innerHTML = `
      <button class="lb-x" data-lb="close" aria-label=""></button>
      <button class="lb-nav lb-prev" data-lb="prev" aria-label="">
        <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l-6 6 6 6"/></svg></button>
      <button class="lb-nav lb-next" data-lb="next" aria-label="">
        <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4l6 6-6 6"/></svg></button>
      <div class="lb-stage">
        <div class="lb-track">
          <div class="lb-slide"><img class="lb-img" alt="" draggable="false"></div>
          <div class="lb-slide"><img class="lb-img" alt="" draggable="false"></div>
          <div class="lb-slide"><img class="lb-img" alt="" draggable="false"></div>
        </div>
      </div>
      <div class="lb-foot">
        <div class="lb-cap"></div>
        <div class="lb-meta">
          <div class="lb-row">
            <span class="lb-count"></span>
            <div class="lb-sharewrap">
              <button class="lb-share" type="button" aria-haspopup="true" aria-expanded="false">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
                <span class="lb-share-txt"></span>
              </button>
              <div class="lb-pop" hidden></div>
            </div>
          </div>
          <span class="lb-hint"></span>
        </div>
      </div>`;
    document.body.appendChild(root);
    track = root.querySelector('.lb-track');
    slides = [...root.querySelectorAll('.lb-slide')];
    /* The three slides are never rebuilt, only refilled, so the middle
       picture is one stable node for the zoom to hold on to. */
    img = slides[1].querySelector('img');
    cap = root.querySelector('.lb-cap');
    counter = root.querySelector('.lb-count');
    shareBtn = root.querySelector('.lb-share');
    pop = root.querySelector('.lb-pop');
    shareBtn.onclick = e => { e.stopPropagation(); share(); };
    // a click anywhere outside the popover closes it
    document.addEventListener('click', e => {
      if (popOpen && !root.querySelector('.lb-sharewrap').contains(e.target)) togglePop(false);
    });

    root.querySelectorAll('[data-lb]').forEach(b => {
      b.onclick = e => { e.stopPropagation(); ({ close, prev, next })[b.dataset.lb](); };
    });
    const stage = root.querySelector('.lb-stage');
    /* Closing on a click outside the picture, and only there. The obvious test
       is e.target, and it cannot work here: the drag needs setPointerCapture,
       and a captured pointer retargets its up event to the capturing element,
       so every click inside the stage arrives claiming the stage as its
       target no matter what it landed on. (That is why a double-click never
       zoomed — the first of its two clicks closed the viewer.) Ask the
       geometry instead, which capture does not touch. */
    stage.addEventListener('click', e => {
      if (moved || settling) return;
      const r = img.getBoundingClientRect();
      const onPicture = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!onPicture) close();
    });

    stage.addEventListener('wheel', e => {
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      zoomAt(scale * (e.deltaY < 0 ? 1.18 : 1 / 1.18), e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
    }, { passive: false });

    stage.addEventListener('pointerdown', e => {
      if (settling) return;
      /* Capture keeps a drag alive when the finger leaves the picture, but it
         is allowed to fail — a pointer that has already been released, or a
         browser that will not give it — and an exception here would take the
         whole gesture down with it. The drag works without it as long as the
         finger stays over the stage, which is where it is. */
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* drag on regardless */ }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        dragging = true; moved = false;
        /* Only a picture sitting at its fit size walks the strip. Once it is
           zoomed the same drag is the only way to see the rest of it. */
        swipe = scale <= 1.01 ? { x0: e.clientX, y0: e.clientY, dx: 0, axis: null } : null;
      }
      if (pointers.size === 2) { lastDist = dist(); swipe = null; setTrack(0, true); }
    });
    stage.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      const p = pointers.get(e.pointerId);
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const d = dist();
        if (lastDist) {
          const r = stage.getBoundingClientRect();
          const [a, b] = [...pointers.values()];
          zoomAt(scale * d / lastDist, (a.x + b.x) / 2 - r.left - r.width / 2, (a.y + b.y) / 2 - r.top - r.height / 2);
        }
        lastDist = d;
      } else if (dragging) {
        if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
        if (swipe) {
          /* Commit to an axis once and hold it, so a thumb travelling mostly
             downwards does not drag the strip sideways with it. */
          const totX = e.clientX - swipe.x0, totY = e.clientY - swipe.y0;
          if (!swipe.axis && Math.abs(totX) + Math.abs(totY) > 8) {
            swipe.axis = Math.abs(totX) > Math.abs(totY) ? 'x' : 'y';
          }
          if (swipe.axis === 'x') { swipe.dx = totX; setTrack(totX, false); }
        } else if (scale > 1) { tx += dx; ty += dy; apply(); }
      }
    });
    const up = e => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) lastDist = 0;
      if (pointers.size === 0) {
        dragging = false;
        if (swipe && swipe.axis === 'x') {
          if (Math.abs(swipe.dx) > SWIPE_AT(stageW())) slideTo((swipe.dx < 0) === rtl() ? -1 : 1);
          else setTrack(0, true);   // not far enough: let it fall back
        }
        swipe = null;
        // a second tap within 300ms is a double-tap: fit ↔ 2.5×
        const now = Date.now();
        if (!moved && e.pointerType !== 'mouse') {
          if (now - lastTap < 300) { toggleZoom(); lastTap = 0; } else lastTap = now;
        }
      }
    };
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    stage.addEventListener('dblclick', e => { e.preventDefault(); toggleZoom(); });

    document.addEventListener('keydown', e => {
      if (root.hidden) return;
      if (e.key === 'Escape') popOpen ? togglePop(false) : close();
      else if (e.key === 'ArrowLeft') (document.dir === 'rtl' ? next : prev)();
      else if (e.key === 'ArrowRight') (document.dir === 'rtl' ? prev : next)();
      else if (e.key === '+' || e.key === '=') zoomAt(scale * 1.25, 0, 0);
      else if (e.key === '-') zoomAt(scale / 1.25, 0, 0);
    });
  }

  function dist() {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  const stageW = () => root.querySelector('.lb-stage').clientWidth;

  /* The strip is three stages wide and sits one stage to the left, so the
     middle picture fills the frame; `dx` is how far the finger has carried it
     from there. */
  function setTrack(dx, animate) {
    track.style.transition = animate ? `transform ${SLIDE_MS}ms cubic-bezier(.22,.61,.36,1)` : 'none';
    track.style.transform = `translate3d(${-stageW() + dx}px, 0, 0)`;
  }

  /* One picture along: let the strip finish travelling, then adopt whichever
     picture landed in the frame as the middle one and put the strip back.
     Refusing while one is already settling keeps a held arrow key or a flurry
     of taps from stacking half-finished walks. */
  function slideTo(dir) {
    if (settling || items.length < 2) { setTrack(0, true); return; }
    settling = true;
    togglePop(false);
    /* which way the strip travels to bring that picture into the frame */
    setTrack((rtl() ? dir : -dir) * stageW(), true);
    setTimeout(() => {
      idx = (idx + dir + items.length) % items.length;
      settling = false;
      show();
    }, SLIDE_MS);
  }

  /* Zoom keeping the point under (px,py) — offsets from the stage centre —
     fixed, and never let the picture drift off the screen. */
  function zoomAt(next, px, py) {
    const s = Math.min(MAX, Math.max(MIN, next));
    const k = s / scale;
    tx = px - (px - tx) * k;
    ty = py - (py - ty) * k;
    scale = s;
    if (scale === 1) tx = ty = 0;
    apply();
  }

  function toggleZoom() { zoomAt(scale > 1.05 ? 1 : 2.5, 0, 0); }

  function apply() {
    const r = img.getBoundingClientRect();
    const st = root.querySelector('.lb-stage').getBoundingClientRect();
    // clamp the pan so at least the picture's edge stays on screen
    const w = r.width / (parseFloat(img.dataset.s || 1)) * scale, h = r.height / (parseFloat(img.dataset.s || 1)) * scale;
    const mx = Math.max(0, (w - st.width) / 2), my = Math.max(0, (h - st.height) / 2);
    tx = Math.min(mx, Math.max(-mx, tx));
    ty = Math.min(my, Math.max(-my, ty));
    img.dataset.s = scale;
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    img.style.cursor = scale > 1 ? 'grab' : 'zoom-in';
  }

  function show() {
    const n = items.length;
    const it = items[idx];
    scale = 1; tx = ty = 0;
    /* Fill all three: the two neighbours are what a drag reveals, and after a
       walk they are already in the browser's cache, so the swap paints in the
       same frame the strip snaps back. */
    slides.forEach((sl, k) => {
      /* -1, 0, +1 along the reading direction: in Hebrew the next picture is
         the one on the left, so the strip is filled the other way round and a
         drag rightwards uncovers it. */
      const step = rtl() ? 1 - k : k - 1;
      const nb = items[((idx + step) % n + n) % n];
      const im = sl.querySelector('img');
      if (im.getAttribute('src') !== nb.url) im.src = nb.url;
      im.alt = k === 1 ? (it.title || '') : '';
      im.style.transform = '';
      im.dataset.s = 1;
    });
    setTrack(0, false);
    cap.innerHTML = `<b>${escape(it.title || '')}</b>${it.sub ? `<span>${escape(it.sub)}</span>` : ''}`;
    counter.innerHTML = items.length > 1 ? `<span dir="ltr">${idx + 1} / ${items.length}</span>` : '';
    root.querySelector('.lb-prev').hidden = root.querySelector('.lb-next').hidden = items.length < 2;
    togglePop(false);
    relabel();
    /* Every photograph that reaches the screen, whether it was opened or
       swiped to. The viewer is the only place a photograph is really looked
       at, so it is the only honest place to count one. */
    document.dispatchEvent(new CustomEvent('tmz:photo', { detail: { id: it.id || '' } }));
  }

  const escape = s => String(s).replace(/[&<>"]/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m]));

  function relabel() {
    if (!root || typeof t !== 'function') return;
    root.querySelector('.lb-x').setAttribute('aria-label', t('lb.close'));
    root.querySelector('.lb-prev').setAttribute('aria-label', t('lb.prev'));
    root.querySelector('.lb-next').setAttribute('aria-label', t('lb.next'));
    root.querySelector('.lb-hint').textContent = t('lb.hint');
    root.querySelector('.lb-share-txt').textContent = t('lb.share');
    shareBtn.setAttribute('aria-label', t('lb.share'));
  }

  /* ---- sharing ------------------------------------------------------------
     The link handed out is the share page, which unfurls with the photograph
     itself and sends people on to the site — not the site's own hash URL. */
  function shareData() {
    const it = items[idx] || {};
    return {
      title: it.title || '',
      text: it.names || it.sub || '',
      url: it.shareUrl || location.href
    };
  }

  function share() {
    const d = shareData();
    if (navigator.share) {
      navigator.share({ title: d.title, text: d.text, url: d.url }).catch(() => {});
      return;
    }
    togglePop(!popOpen);
  }

  const ICON = {
    wa: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>',
    tg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg>',
    fb: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.6 1.6-1.6h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v2.3H7.4V14h2.8v8z"/></svg>',
    x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.2 2.5h3.3l-7.2 8.2 8.5 11.3h-6.7l-5.2-6.8-6 6.8H1.6l7.7-8.8L1.2 2.5h6.8l4.7 6.2zm-1.2 17.5h1.8L7 4.4H5.1z"/></svg>',
    copy: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>'
  };

  function togglePop(on) {
    if (!pop) return;
    popOpen = on;
    pop.hidden = !on;
    shareBtn.setAttribute('aria-expanded', String(on));
    if (!on) return;
    const d = shareData();
    const msg = [d.title, d.text].filter(Boolean).join(' · ');
    const enc = encodeURIComponent;
    const links = [
      ['WhatsApp', `https://wa.me/?text=${enc(msg ? msg + '\n' + d.url : d.url)}`, ICON.wa],
      ['Telegram', `https://t.me/share/url?url=${enc(d.url)}&text=${enc(msg)}`, ICON.tg],
      ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${enc(d.url)}`, ICON.fb],
      ['X', `https://twitter.com/intent/tweet?url=${enc(d.url)}&text=${enc(msg)}`, ICON.x]
    ];
    pop.innerHTML = links.map(([name, href, icon]) =>
      `<a href="${escape(href)}" target="_blank" rel="noopener">${icon}<span>${name}</span></a>`).join('') +
      `<button type="button" class="lb-copy">${ICON.copy}<span>${escape(t('lb.copy'))}</span></button>`;
    pop.querySelectorAll('a').forEach(a => { a.onclick = () => togglePop(false); });
    pop.querySelector('.lb-copy').onclick = e => { e.stopPropagation(); copyLink(d.url); };
  }

  async function copyLink(url) {
    const btn = pop.querySelector('.lb-copy');
    let ok = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(url); ok = true; }
    } catch (e) { /* fall through to the old way */ }
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = url; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove();
      } catch (e) { ok = false; }
    }
    if (!ok) { console.error('copy: clipboard unavailable'); return; }
    if (!btn) return;
    btn.classList.add('done');
    btn.querySelector('span').textContent = t('lb.copied');
    setTimeout(() => {
      if (!btn.isConnected) return;
      btn.classList.remove('done');
      btn.querySelector('span').textContent = t('lb.copy');
    }, 2000);
  }

  window.addEventListener('resize', () => {
    if (root && !root.hidden && !settling && !swipe) setTrack(0, false);
  });

  function open(list, i) {
    if (!root) build();
    items = list; idx = i || 0;
    root.hidden = false;
    document.body.classList.add('lb-open');
    show();
  }
  function close() {
    if (!root) return;
    togglePop(false);
    root.hidden = true;
    document.body.classList.remove('lb-open');
    settling = false; swipe = null;
    slides.forEach(sl => { sl.querySelector('img').src = ''; });
  }
  function prev() { slideTo(-1); }
  function next() { slideTo(1); }

  window.TMZLightbox = { open, close, relabel };
})();

/* Full-screen viewer for the year pages' photographs.
 *
 * Wheel or pinch zooms about the pointer, drag pans, double-tap toggles
 * between fit and 2.5×, arrows walk the year, Esc closes. It lives outside
 * #app so a route change cannot tear it down mid-look. */

(function () {
  const MIN = 1, MAX = 8;
  let items = [], idx = 0;
  let scale = 1, tx = 0, ty = 0;
  const pointers = new Map();
  let lastDist = 0, dragging = false, moved = false, lastTap = 0;
  let root, img, cap, counter, shareBtn, pop, popOpen = false;

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
      <div class="lb-stage"><img class="lb-img" alt="" draggable="false"></div>
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
    img = root.querySelector('.lb-img');
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
    stage.addEventListener('click', e => { if (e.target === stage && !moved) close(); });

    stage.addEventListener('wheel', e => {
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      zoomAt(scale * (e.deltaY < 0 ? 1.18 : 1 / 1.18), e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
    }, { passive: false });

    stage.addEventListener('pointerdown', e => {
      stage.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) { dragging = true; moved = false; }
      if (pointers.size === 2) lastDist = dist();
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
      } else if (dragging && scale > 1) {
        if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
        tx += dx; ty += dy; apply();
      }
    });
    const up = e => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) lastDist = 0;
      if (pointers.size === 0) {
        dragging = false;
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
    const it = items[idx];
    scale = 1; tx = ty = 0; img.dataset.s = 1;
    img.style.transform = '';
    img.src = it.url;
    img.alt = it.title || '';
    cap.innerHTML = `<b>${escape(it.title || '')}</b>${it.sub ? `<span>${escape(it.sub)}</span>` : ''}`;
    counter.innerHTML = items.length > 1 ? `<span dir="ltr">${idx + 1} / ${items.length}</span>` : '';
    root.querySelector('.lb-prev').hidden = root.querySelector('.lb-next').hidden = items.length < 2;
    togglePop(false);
    relabel();
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
    img.src = '';
  }
  function prev() { if (items.length > 1) { idx = (idx - 1 + items.length) % items.length; show(); } }
  function next() { if (items.length > 1) { idx = (idx + 1) % items.length; show(); } }

  window.TMZLightbox = { open, close, relabel };
})();

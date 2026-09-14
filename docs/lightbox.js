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
  let root, img, cap, counter;

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
        <div class="lb-meta"><span class="lb-count"></span><span class="lb-hint"></span></div>
      </div>`;
    document.body.appendChild(root);
    img = root.querySelector('.lb-img');
    cap = root.querySelector('.lb-cap');
    counter = root.querySelector('.lb-count');

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
      if (e.key === 'Escape') close();
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
    relabel();
  }

  const escape = s => String(s).replace(/[&<>"]/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m]));

  function relabel() {
    if (!root || typeof t !== 'function') return;
    root.querySelector('.lb-x').setAttribute('aria-label', t('lb.close'));
    root.querySelector('.lb-prev').setAttribute('aria-label', t('lb.prev'));
    root.querySelector('.lb-next').setAttribute('aria-label', t('lb.next'));
    root.querySelector('.lb-hint').textContent = t('lb.hint');
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
    root.hidden = true;
    document.body.classList.remove('lb-open');
    img.src = '';
  }
  function prev() { if (items.length > 1) { idx = (idx - 1 + items.length) % items.length; show(); } }
  function next() { if (items.length > 1) { idx = (idx + 1) % items.length; show(); } }

  window.TMZLightbox = { open, close, relabel };
})();

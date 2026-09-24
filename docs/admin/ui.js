export const $ = sel => document.querySelector(sel);
export const $$ = sel => Array.from(document.querySelectorAll(sel));
export const esc = s => String(s ?? '').replace(/[&<>"]/g, m => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
}[m]));

export const LANGS = ['en', 'he', 'ru', 'fr', 'de', 'es'];
export const LANG_NAMES = {
  en: 'English', he: 'עברית', ru: 'Русский',
  fr: 'Français', de: 'Deutsch', es: 'Español'
};
export const REGIONS = ['na', 'la', 'eu', 'oc'];
export const REGION_NAMES = {
  na: 'North America', la: 'Latin America',
  eu: 'Europe & Asia', oc: 'Africa & Oceania'
};

export function pickName(trArray, want = 'en') {
  if (!trArray || !trArray.length) return null;
  const hit = trArray.find(t => t.lang === want);
  if (hit) return hit.name || hit.display_name;
  const en = trArray.find(t => t.lang === 'en');
  return (en || trArray[0]).name || (en || trArray[0]).display_name;
}

/* Six coloured cells, one per locale, filled when a translation exists.
   Same visual language across every list — the back office is here to
   surface these holes, so they should be impossible to miss. */
export function coverage(trArray) {
  const have = new Set((trArray || []).map(t => t.lang));
  return `<div class="cov" title="Translations">
    ${LANGS.map(l => `<span class="cell ${have.has(l) ? 'on' : ''}" title="${LANG_NAMES[l]}${have.has(l) ? '' : ' — missing'}"></span>`).join('')}
  </div>`;
}

let drawerOpen = false;
export function openDrawer(title, bodyHtml, buttons) {
  closeDrawer();
  const scrim = document.createElement('div');
  scrim.className = 'drawer-scrim';
  scrim.onclick = closeDrawer;
  const el = document.createElement('aside');
  el.className = 'drawer';
  el.innerHTML = `
    <div class="drawer-head">
      <h2>${esc(title)}</h2>
      <button class="btn ghost" id="drawerClose" aria-label="Close">✕</button>
    </div>
    <div class="drawer-body" id="drawerBody">${bodyHtml}</div>
    <div class="drawer-foot" id="drawerFoot"></div>`;
  document.body.append(scrim, el);
  document.body.style.overflow = 'hidden';
  drawerOpen = true;
  el.querySelector('#drawerClose').onclick = closeDrawer;
  const foot = el.querySelector('#drawerFoot');
  for (const b of buttons || []) {
    const btn = document.createElement('button');
    btn.className = 'btn ' + (b.kind || 'ghost');
    btn.textContent = b.label;
    btn.onclick = () => b.onClick(el);
    foot.append(btn);
  }
  return el;
}

export function closeDrawer() {
  if (!drawerOpen) return;
  document.querySelectorAll('.drawer, .drawer-scrim').forEach(el => el.remove());
  document.body.style.overflow = '';
  drawerOpen = false;
}

export function toast(msg, kind = 'success') {
  const el = document.createElement('div');
  el.className = kind;
  el.style.cssText = `position:fixed; bottom:24px; inset-inline-end:24px; z-index:80; max-width:340px;`;
  el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.remove(), 4200);
}

/* A surface that sits ON TOP of a drawer instead of replacing it.
 *
 * openDrawer closes whatever drawer is open before it opens its own, which is
 * right for records — you edit one person, not two. It is wrong for a tool you
 * reach FROM a record: cropping a photograph from inside a person's drawer
 * destroyed that drawer, and closing the crop tool left the curator looking at
 * the list, having lost their place and whatever they had typed.
 *
 * So this is its own layer with its own scrim, and closing it puts the drawer
 * underneath back in front. Page scroll is only released when nothing is left
 * on top of it. */
let modalOpen = false;
export function openModal(title, bodyHtml, buttons) {
  closeModal();
  const scrim = document.createElement('div');
  scrim.className = 'modal-scrim';
  scrim.onclick = closeModal;
  const el = document.createElement('div');
  el.className = 'modal';
  el.innerHTML = `
    <div class="drawer-head">
      <h2>${esc(title)}</h2>
      <button class="btn ghost" id="modalClose" aria-label="Close">✕</button>
    </div>
    <div class="drawer-body" id="modalBody">${bodyHtml}</div>
    <div class="drawer-foot" id="modalFoot"></div>`;
  document.body.append(scrim, el);
  document.body.style.overflow = 'hidden';
  modalOpen = true;
  el.querySelector('#modalClose').onclick = closeModal;
  const foot = el.querySelector('#modalFoot');
  for (const b of buttons || []) {
    const btn = document.createElement('button');
    btn.className = 'btn ' + (b.kind || 'ghost');
    btn.textContent = b.label;
    btn.onclick = () => b.onClick(el);
    foot.append(btn);
  }
  return el;
}

export function closeModal() {
  if (!modalOpen) return;
  document.querySelectorAll('.modal, .modal-scrim').forEach(el => el.remove());
  modalOpen = false;
  /* The drawer beneath is still open and still wants the page held still. */
  if (!document.querySelector('.drawer')) document.body.style.overflow = '';
}

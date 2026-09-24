/* Crop and turn a photograph that is already in the archive. Nothing else —
 * no filters, no levels, no straightening by a degree and a half. A curator
 * fixing a sideways scan or cutting a white margin off a photocopy is the
 * whole job.
 *
 * NOTHING HERE WRITES TO THE MASTER. The full-resolution copy in the private
 * bucket is the thing the archive exists to keep, and it is only ever read.
 * What is saved is the DECISION — a quarter-turn and a rectangle, in fractions
 * — and the copies the site serves are re-rendered from the master each time.
 * Three consequences, all of them the point: a crop can be loosened as easily
 * as it was tightened; two edits in a row do not compound into a quarter of the
 * picture; and no photograph is ever JPEG-compressed on top of a previous
 * compression, however many times it is adjusted.
 *
 * Rotation is applied first, then the crop, which is expressed in fractions of
 * the rotated frame — the frame the person drawing the rectangle was looking
 * at.
 */
import { sb } from './sb.js?v=c5592b0n3s';
import { esc, openModal, closeModal, toast } from './ui.js?v=c5592b0n3s';

/* The same numbers the edge functions use. A copy edited here and a copy
   published by the agent have to come out the same size and weight, or the
   grid would show two different standards side by side. */
const PUBLIC_EDGE = 1600, PUBLIC_QUALITY = 0.8;
const THUMB_EDGE = 700, THUMB_QUALITY = 0.74;
const PORTRAIT_EDGE = 800, PORTRAIT_QUALITY = 0.82;
/* The private master, at the same size and quality the edge functions keep. */
const ARCHIVE_EDGE = 2560, ARCHIVE_QUALITY = 0.88;

const MIN_FRACTION = 0.05;      // a crop may not go below this of either side

/* ---- geometry -------------------------------------------------------------- */

/* The size of the frame once it has been turned. A quarter turn swaps the
   sides; a half turn does not. */
const turned = (w, h, rot) => (rot % 180 === 0 ? { w, h } : { w: h, h: w });

/* Draw the source into a canvas of the rotated, cropped size. One pass: the
   transform does the turning, so there is no intermediate bitmap. */
function render(src, rot, crop, maxEdge, dest) {
  const full = turned(src.naturalWidth || src.width, src.naturalHeight || src.height, rot);
  const cw = Math.max(1, Math.round(full.w * crop.w));
  const ch = Math.max(1, Math.round(full.h * crop.h));
  const scale = Math.min(1, maxEdge / Math.max(cw, ch));
  const outW = Math.max(1, Math.round(cw * scale));
  const outH = Math.max(1, Math.round(ch * scale));

  const c = dest || document.createElement('canvas');
  c.width = outW; c.height = outH;
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.save();
  /* Put the origin where the crop's top-left lands after the turn, then rotate
     the world rather than the picture. */
  g.scale(outW / cw, outH / ch);
  g.translate(-full.w * crop.x, -full.h * crop.y);
  if (rot === 90) { g.translate(full.w, 0); g.rotate(Math.PI / 2); }
  else if (rot === 180) { g.translate(full.w, full.h); g.rotate(Math.PI); }
  else if (rot === 270) { g.translate(0, full.h); g.rotate(-Math.PI / 2); }
  g.drawImage(src, 0, 0);
  g.restore();
  return c;
}

const toBlob = (canvas, quality) => new Promise((res, rej) =>
  canvas.toBlob(b => (b ? res(b) : rej(new Error('the browser could not encode the image'))), 'image/jpeg', quality));

/* An image element that can be read back out of a canvas. A cross-origin
   picture taints the canvas and makes toBlob throw unless the server allows it
   and the element asks — Supabase storage answers with a wildcard, so it does. */
function load(url) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('could not load the photograph'));
    im.src = url;
  });
}

export const WHOLE = { x: 0, y: 0, w: 1, h: 1 };
const clean = e => ({
  rot: [0, 90, 180, 270].includes(e?.rot) ? e.rot : 0,
  crop: e?.crop && [e.crop.x, e.crop.y, e.crop.w, e.crop.h].every(n => typeof n === 'number')
    ? { x: e.crop.x, y: e.crop.y, w: e.crop.w, h: e.crop.h } : { ...WHOLE }
});
const isWhole = c => c.x <= 0.001 && c.y <= 0.001 && c.w >= 0.999 && c.h >= 0.999;

/* ---- the editor ------------------------------------------------------------ */

/* `photo` needs id, storage_path, and whatever of public_path / derived_path /
   edit it has. `kind` is 'photo' for an archive photograph and 'portrait' for a
   person's own picture, which is published to one path and has no thumbnail. */
export async function openImageEditor(photo, { kind = 'photo', portraitPath = null, onSaved } = {}) {
  const el = openModal(kind === 'portrait' ? 'Crop and turn the portrait' : 'Crop and turn', `
    <div class="ie">
      <div class="ie-stage" id="ieStage">
        <p class="dim" id="ieLoading">Loading the full-resolution copy…</p>
      </div>
      <div class="ie-tools">
        <button class="btn" id="ieLeft" title="Turn a quarter to the left">⟲ Left</button>
        <button class="btn" id="ieRight" title="Turn a quarter to the right">⟳ Right</button>
        <span class="ie-sep"></span>
        <button class="btn" id="ieAll">Whole picture</button>
        <span class="ie-size dim" id="ieSize"></span>
      </div>
      <p class="dim ie-note">
        Drag inside the picture to choose what to keep; drag a corner or an edge to adjust it.
        The master is never changed — this saves the crop and the turn, and re-renders
        what the site serves from the original every time.
      </p>
    </div>`, [
    { label: 'Save', kind: 'solid', onClick: save },
    { label: 'Cancel', onClick: closeModal }
  ]);

  const stage = el.querySelector('#ieStage');
  const sizeEl = el.querySelector('#ieSize');

  let img = null;
  let state = clean(photo.edit);
  let saving = false;

  /* The master, not the published copy: every render starts from the best
     bytes we hold, so repeated edits never stack losses. */
  try {
    const path = photo.storage_path || photo.derived_path;
    if (!path) throw new Error('this photograph has no stored master');
    const [url] = await sb.signedUrls('tmz-photo-originals', [path]);
    if (!url) throw new Error('could not sign the master for reading');
    img = await load(url);
  } catch (e) {
    stage.innerHTML = `<p class="warn">${esc(e.message)}</p>`;
    return;
  }

  stage.innerHTML = `
    <div class="ie-frame" id="ieFrame">
      <canvas id="ieCanvas"></canvas>
      <div class="ie-box" id="ieBox">
        ${['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(h => `<i class="h ${h}" data-h="${h}"></i>`).join('')}
      </div>
      <div class="ie-shade" id="ieShade"></div>
    </div>`;

  const frame = el.querySelector('#ieFrame');
  const canvas = el.querySelector('#ieCanvas');
  const box = el.querySelector('#ieBox');
  const shade = el.querySelector('#ieShade');

  /* The canvas shows the WHOLE rotated picture; the rectangle floats over it.
     Drawing the crop into the canvas instead would make the part being cut
     away invisible, and you cannot judge a crop you cannot see. */
  function paint() {
    const full = turned(img.naturalWidth, img.naturalHeight, state.rot);
    const box2 = frame.getBoundingClientRect();
    const view = Math.min(560, box2.width || 560);
    const scale = view / full.w;
    render(img, state.rot, WHOLE, Math.max(full.w, full.h), canvas);
    canvas.style.width = `${view}px`;
    canvas.style.height = `${view * (full.h / full.w)}px`;
    place();
    const kept = { w: Math.round(full.w * state.crop.w), h: Math.round(full.h * state.crop.h) };
    sizeEl.textContent = isWhole(state.crop)
      ? `${full.w}×${full.h}`
      : `${kept.w}×${kept.h} of ${full.w}×${full.h}`;
  }

  function place() {
    const c = state.crop;
    for (const [k, v] of Object.entries({ left: c.x, top: c.y, width: c.w, height: c.h })) {
      box.style[k] = `${v * 100}%`;
    }
    /* Four bands rather than a filled overlay with a hole: a box-shadow big
       enough to cover the stage also covers the drawer when it scrolls. */
    shade.style.setProperty('--x', `${c.x * 100}%`);
    shade.style.setProperty('--y', `${c.y * 100}%`);
    shade.style.setProperty('--r', `${(1 - c.x - c.w) * 100}%`);
    shade.style.setProperty('--b', `${(1 - c.y - c.h) * 100}%`);
  }

  /* Turning re-frames the crop: the rectangle a person drew is on the picture,
     not on the screen, so it has to travel with it. A quarter turn to the
     right sends (x, y) to (1 - y - h, x). */
  function turn(dir) {
    const c = state.crop;
    state.crop = dir > 0
      ? { x: 1 - c.y - c.h, y: c.x, w: c.h, h: c.w }
      : { x: c.y, y: 1 - c.x - c.w, w: c.h, h: c.w };
    state.rot = (state.rot + (dir > 0 ? 90 : 270)) % 360;
    paint();
  }

  el.querySelector('#ieLeft').onclick = () => turn(-1);
  el.querySelector('#ieRight').onclick = () => turn(1);
  el.querySelector('#ieAll').onclick = () => { state.crop = { ...WHOLE }; paint(); };

  /* ---- dragging ---- */
  let drag = null;
  frame.addEventListener('pointerdown', ev => {
    if (saving) return;
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const at = { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height };
    const handle = ev.target.dataset ? ev.target.dataset.h : null;
    drag = { handle: handle || 'move', from: at, start: { ...state.crop } };
    frame.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  });

  frame.addEventListener('pointermove', ev => {
    if (!drag) return;
    const r = canvas.getBoundingClientRect();
    const at = { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height };
    const dx = at.x - drag.from.x, dy = at.y - drag.from.y;
    const s = drag.start;
    let c;
    if (drag.handle === 'move') {
      c = { x: s.x + dx, y: s.y + dy, w: s.w, h: s.h };
      c.x = Math.min(Math.max(0, c.x), 1 - c.w);
      c.y = Math.min(Math.max(0, c.y), 1 - c.h);
    } else {
      let { x, y, w, h } = s;
      /* Each edge moves independently and is stopped by the opposite one, so a
         handle dragged past its partner clamps instead of inverting the box. */
      if (drag.handle.includes('w')) { const nx = Math.min(Math.max(0, x + dx), x + w - MIN_FRACTION); w += x - nx; x = nx; }
      if (drag.handle.includes('e')) { w = Math.min(Math.max(MIN_FRACTION, w + dx), 1 - x); }
      if (drag.handle.includes('n')) { const ny = Math.min(Math.max(0, y + dy), y + h - MIN_FRACTION); h += y - ny; y = ny; }
      if (drag.handle.includes('s')) { h = Math.min(Math.max(MIN_FRACTION, h + dy), 1 - y); }
      c = { x, y, w, h };
    }
    state.crop = c;
    place();
    const full = turned(img.naturalWidth, img.naturalHeight, state.rot);
    sizeEl.textContent = isWhole(c) ? `${full.w}×${full.h}`
      : `${Math.round(full.w * c.w)}×${Math.round(full.h * c.h)} of ${full.w}×${full.h}`;
  });

  const stop = ev => { if (drag) { frame.releasePointerCapture?.(ev.pointerId); drag = null; } };
  frame.addEventListener('pointerup', stop);
  frame.addEventListener('pointercancel', stop);

  paint();
  addEventListener('resize', paint, { passive: true });

  /* ---- saving ---- */

  async function save() {
    if (saving) return;
    saving = true;
    const note = document.createElement('p');
    note.className = 'dim';
    note.textContent = 'Rendering and uploading…';
    stage.append(note);
    try {
      if (kind === 'portrait') {
        const face = render(img, state.rot, state.crop, PORTRAIT_EDGE);
        await sb.storageUpload('tmz-photo-public', portraitPath, await toBlob(face, PORTRAIT_QUALITY));
      } else {
        const big = render(img, state.rot, state.crop, PUBLIC_EDGE);
        const small = render(img, state.rot, state.crop, THUMB_EDGE);
        const [bigBlob, smallBlob] = await Promise.all([
          toBlob(big, PUBLIC_QUALITY), toBlob(small, THUMB_QUALITY)
        ]);

        /* The private derivative and its thumbnail are what a republish copies
           from, so they move with the published pair. Leaving them behind
           would mean the crop silently undid itself the next time anything
           republished the photograph. */
        const dest = (photo.public_path || photo.derived_path || photo.storage_path || '')
          .replace(/^derived\//, '');
        if (photo.derived_path) {
          await sb.storageUpload('tmz-photo-originals', photo.derived_path, bigBlob);
          await sb.storageUpload('tmz-photo-originals', `thumb/${dest}`, smallBlob);
        }
        if (photo.public_path) {
          await sb.storageUpload('tmz-photo-public', photo.public_path, bigBlob);
          await sb.storageUpload('tmz-photo-public', `thumb/${photo.public_path}`, smallBlob);
        }

        await sb.from('tmz_photo').update({
          edit: { ...state, at: new Date().toISOString() },
          width: big.width, height: big.height, bytes: bigBlob.size,
          /* The share page carries the picture's size in its preview tags, so
             a crop makes it wrong until it is written again. */
          ...(photo.public_path ? { share_page_at: null } : {})
        }, { id: `eq.${photo.id}` });
      }
      closeModal();
      toast('Saved. The site shows the new framing within a minute.');
      onSaved?.();
    } catch (e) {
      note.className = 'warn';
      note.textContent = e.message;
      saving = false;
    }
  }
}

/* ---- putting a photograph on the site -------------------------------------- */

/* Publishing used to be a note to the watchdog: mark the row cleared, and two
   minutes later the agent copies the private derivative into the public
   bucket. That works for a photograph that has just arrived and fails for the
   two cases the back office is actually for — one the agent refused, and one
   it published and something later took down. Both have had their derivative
   and thumbnail deleted, so the copy the watchdog makes has nothing to copy
   and the photograph silently stays where it was.
 *
 * So this renders the pair here, from the master, honouring whatever crop and
 * turn the photograph carries. It depends on nothing but the master, and the
 * photograph is on the site by the time the button stops spinning. */
export async function publishFromMaster(photo) {
  if (!photo.storage_path) throw new Error('this photograph has no stored master to publish from');
  const [url] = await sb.signedUrls('tmz-photo-originals', [photo.storage_path]);
  if (!url) throw new Error('could not read the master');
  const img = await load(url);
  const edit = clean(photo.edit);

  const big = render(img, edit.rot, edit.crop, PUBLIC_EDGE);
  const small = render(img, edit.rot, edit.crop, THUMB_EDGE);
  const [bigBlob, smallBlob] = await Promise.all([
    toBlob(big, PUBLIC_QUALITY), toBlob(small, THUMB_QUALITY)
  ]);

  const dest = (photo.derived_path || photo.storage_path).replace(/^derived\//, '');
  /* The grid copy first, exactly as the agent does it: every grid on the site
     asks for thumb/<path>, so a photograph that appeared without one would
     show a broken tile to everybody until the second upload landed. */
  await sb.storageUpload('tmz-photo-public', `thumb/${dest}`, smallBlob);
  await sb.storageUpload('tmz-photo-public', dest, bigBlob);

  return { dest, width: big.width, height: big.height, bytes: bigBlob.size };
}

/* A portrait's equivalent of publishing. It never goes in the gallery — it
   goes beside a person's name — so "put it on the site" means "make this the
   picture of them", and that is the button a portrait should offer. */
export async function useAsPortrait(photo, personId) {
  if (!photo.storage_path) throw new Error('this picture has no stored master');
  const [url] = await sb.signedUrls('tmz-photo-originals', [photo.storage_path]);
  if (!url) throw new Error('could not read the master');
  const img = await load(url);
  const edit = clean(photo.edit);
  const face = render(img, edit.rot, edit.crop, PORTRAIT_EDGE);
  const path = `portraits/${personId}.jpg`;
  await sb.storageUpload('tmz-photo-public', path, await toBlob(face, PORTRAIT_QUALITY));
  await sb.from('tmz_person').update({ portrait_path: path }, { id: `eq.${personId}` });
  return { path, width: face.width, height: face.height };
}

/* ---- replacing a picture outright ------------------------------------------ */

/* A staff member choosing a different file. The bytes are re-encoded from
   decoded pixels here, exactly as the edge functions do, so nothing a file
   carries — EXIF, a comment block, a polyglot payload — survives to reach the
   public bucket. */
export async function renderUpload(file, maxEdge, quality) {
  const url = URL.createObjectURL(file);
  try {
    const im = await load(url);
    const canvas = render(im, 0, WHOLE, maxEdge);
    return { blob: await toBlob(canvas, quality), width: canvas.width, height: canvas.height };
  } finally { URL.revokeObjectURL(url); }
}

export const SIZES = { PUBLIC_EDGE, PUBLIC_QUALITY, THUMB_EDGE, THUMB_QUALITY,
                       PORTRAIT_EDGE, PORTRAIT_QUALITY, ARCHIVE_EDGE, ARCHIVE_QUALITY };

/* ---- a person's pictures --------------------------------------------------- */

const PUBLIC_BUCKET = `${window.TMZ_SUPABASE_URL}/storage/v1/object/public/tmz-photo-public`;

/* Two things hang off a person and neither had anywhere to live: the portrait
   shown beside their name everywhere on the site, and the photographs they
   themselves sent in. The second is a question the archive could already
   answer and never showed — the WhatsApp contact that was matched to this
   person carries the reference every photograph they sent is stamped with. */
export function personPicturesMarkup() {
  return `
    <h3 class="drawer-h3">Portrait</h3>
    <div id="ppPortrait" class="pp-portrait"><p class="dim">Loading…</p></div>
    <h3 class="drawer-h3">Photographs they sent</h3>
    <div id="ppSent"><p class="dim">Loading…</p></div>`;
}

export async function personPictures(el, person, { onChanged } = {}) {
  const portraitEl = el.querySelector('#ppPortrait');
  const sentEl = el.querySelector('#ppSent');
  if (!portraitEl || !sentEl) return;

  let state = null;

  async function load() {
    const [[fresh], portraitRows, contacts] = await Promise.all([
      sb.from('tmz_person', {}).select('id,portrait_path', { filter: { id: `eq.${person.id}` } }),
      sb.from('tmz_photo', {}).select('id,storage_path,derived_path,public_path,edit,created_at',
        { filter: { portrait_of: `eq.${person.id}` }, order: 'created_at.desc', limit: 5 }),
      sb.from('tmz_wa_contact', {}).select('ref', { filter: { person_id: `eq.${person.id}` } }).catch(() => [])
    ]);
    state = { portrait_path: fresh?.portrait_path || null, portraitPhoto: portraitRows[0] || null };

    /* Their uploads are found by the reference every photograph carries, which
       is the WhatsApp number the sender used — so a person nobody has matched
       to a contact shows nothing, and says why rather than looking broken. */
    const refs = (contacts || []).map(c => c.ref).filter(Boolean);
    const sent = refs.length
      ? await sb.from('tmz_photo', {}).select(
          'id,year,status,storage_path,derived_path,public_path,edit,created_at,' +
          'tmz_community(slug)',
          { filter: { submitter_ref: `in.(${refs.map(r => `"${r}"`).join(',')})` },
            order: 'created_at.desc', limit: 120 })
      : [];
    drawPortrait();
    drawSent(sent, refs);
  }

  function drawPortrait() {
    const src = state.portrait_path
      ? `${PUBLIC_BUCKET}/${encodeURI(state.portrait_path)}?v=${Date.now()}`
      : null;
    portraitEl.innerHTML = `
      <div class="pp-face">${src
        ? `<img src="${esc(src)}" alt="">`
        : `<span class="none">no portrait</span>`}</div>
      <div class="pp-acts">
        <button class="btn" id="ppPick">${state.portrait_path ? 'Replace…' : 'Upload…'}</button>
        ${state.portraitPhoto && state.portrait_path
          ? `<button class="btn" id="ppCrop">Crop &amp; turn</button>` : ''}
        ${state.portrait_path ? `<button class="btn del" id="ppClear">Remove</button>` : ''}
        <input type="file" id="ppFile" accept="image/jpeg,image/png,image/webp" hidden>
        <p class="dim" id="ppSay">${state.portrait_path
          ? 'Shown beside this person’s name wherever they appear.'
          : 'None yet. A sender can offer one over WhatsApp, or choose a file here.'}</p>
      </div>`;

    portraitEl.querySelector('#ppPick').onclick = () => portraitEl.querySelector('#ppFile').click();
    portraitEl.querySelector('#ppFile').onchange = e => replace(e.target.files[0]);
    portraitEl.querySelector('#ppCrop')?.addEventListener('click', () =>
      openImageEditor(state.portraitPhoto, {
        kind: 'portrait', portraitPath: state.portrait_path,
        onSaved: () => { load(); onChanged?.(); }
      }));
    portraitEl.querySelector('#ppClear')?.addEventListener('click', clear);
  }

  function drawSent(rows, refs) {
    if (!refs.length) {
      sentEl.innerHTML = `<p class="dim">Nobody has matched a WhatsApp sender to this person,
        so there is nothing to attribute to them. The match is made in the agent's own records.</p>`;
      return;
    }
    if (!rows.length) {
      sentEl.innerHTML = `<p class="dim">Matched to ${refs.length === 1 ? 'a sender' : `${refs.length} senders`},
        but no photographs have come from ${refs.length === 1 ? 'that number' : 'those numbers'}.</p>`;
      return;
    }
    sentEl.innerHTML = `
      <p class="dim" style="margin:0 0 10px">${rows.length} from
        ${refs.length === 1 ? 'their number' : `${refs.length} numbers`}${rows.length === 120 ? ' (most recent 120)' : ''}.</p>
      <div class="pp-wall">${rows.map(r => `
        <figure data-photo="${r.id}">
          ${r.public_path
            ? `<img src="${PUBLIC_BUCKET}/thumb/${encodeURI(r.public_path)}" alt="" loading="lazy">`
            : `<img data-private="${esc(r.derived_path || r.storage_path)}" alt="" loading="lazy">`}
          <figcaption>
            <span class="pill ${esc(r.status)}">${esc(r.status)}</span>
            <span class="dim">${esc((r.tmz_community || {}).slug || '—')}${r.year ? ` · ${r.year}` : ''}</span>
          </figcaption>
          <button class="pp-edit">Crop &amp; turn</button>
        </figure>`).join('')}</div>`;

    sentEl.querySelectorAll('figure').forEach(fig => {
      const row = rows.find(r => r.id === fig.dataset.photo);
      fig.querySelector('.pp-edit').onclick = () =>
        openImageEditor(row, { onSaved: () => { load(); onChanged?.(); } });
    });
    signPrivate(sentEl);
  }

  async function signPrivate(root) {
    const imgs = [...root.querySelectorAll('img[data-private]')];
    if (!imgs.length) return;
    try {
      const urls = await sb.signedUrls('tmz-photo-originals', imgs.map(i => i.dataset.private));
      imgs.forEach((im, i) => { if (urls[i]) im.src = urls[i]; });
    } catch (e) { /* a missing preview is not worth an error on the page */ }
  }

  /* A file chosen by a curator goes through the same treatment a sender's file
     gets: decoded, and re-encoded from the pixels. Whatever the container was
     carrying — EXIF with a home address, a comment block, a second file
     appended to the end — does not survive being redrawn. */
  async function replace(file) {
    if (!file) return;
    const say = portraitEl.querySelector('#ppSay');
    say.textContent = 'Preparing…';
    try {
      const stamp = Date.now();
      const master = await renderUpload(file, ARCHIVE_EDGE, ARCHIVE_QUALITY);
      const face = await renderUpload(file, PORTRAIT_EDGE, PORTRAIT_QUALITY);
      const masterPath = `portraits/${person.id}/${stamp}.jpg`;
      const publicPath = state.portrait_path || `portraits/${person.id}.jpg`;

      await sb.storageUpload('tmz-photo-originals', masterPath, master.blob);
      await sb.storageUpload('tmz-photo-public', publicPath, face.blob);

      /* A row of its own, so the picture has a master to be re-cropped from
         later and an honest record of who put it there. portrait_of keeps it
         out of the gallery, the year pages and the search. */
      const [row] = await sb.from('tmz_photo').insert({
        storage_path: masterPath, portrait_of: person.id,
        source: 'admin', status: 'approved',
        width: master.width, height: master.height, bytes: master.blob.size,
        published_by: 'staff', published_at: new Date().toISOString()
      });
      await sb.from('tmz_person').update({ portrait_path: publicPath }, { id: `eq.${person.id}` });

      state.portrait_path = publicPath;
      state.portraitPhoto = row || null;
      toast('Portrait replaced.');
      await load();
      onChanged?.();
    } catch (e) {
      say.textContent = e.message;
      say.className = 'warn';
    }
  }

  async function clear() {
    if (!confirm('Remove this portrait? The picture itself is kept.')) return;
    try {
      await sb.from('tmz_person').update({ portrait_path: null }, { id: `eq.${person.id}` });
      if (state.portrait_path) await sb.storageRemove('tmz-photo-public', state.portrait_path).catch(() => {});
      toast('Portrait removed.');
      await load();
      onChanged?.();
    } catch (e) { toast(e.message, 'error'); }
  }

  await load();
}

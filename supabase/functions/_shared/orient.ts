/* Getting a photograph the right way up, and cutting the frame off it.
 *
 * Two problems that look like one. A picture can be stored sideways, and a
 * picture can arrive with something around it that is not the picture — the
 * grey bars of a screenshot, the white margin of a photocopy, the black band a
 * phone puts round a screen capture.
 *
 * Both used to end the same way: turned away. A sideways photograph reads as a
 * bad photograph, and a screenshot is refused outright. Neither is a judgement
 * about the picture itself, and in an archive collecting thirty-year-old
 * prints from whoever still has them, refusing something fixable is the
 * expensive mistake.
 *
 * Everything here is deterministic. The model is asked which way is up only
 * after these two have done what they can, because a rotation recorded in the
 * file and a margin that is measurably one flat colour are facts, and facts
 * should not be put to a vote.
 */

export interface Crop { x: number; y: number; w: number; h: number }

/* ---- which way up, according to the file ---------------------------------- */

/* Every phone writes an Exif Orientation tag rather than rotating the pixels,
   and the decoder this project uses ignores it — a portrait photograph decodes
   landscape and is published on its side. This reads the tag so the pixels can
   be turned to match before anything else looks at them.
   The eight values are the Exif standard's; the four that involve a mirror are
   reported as their rotation, since flipping a photograph of real people is a
   worse answer than leaving it unflipped. */
const TURN_FOR: Record<number, number> = { 1: 0, 2: 0, 3: 180, 4: 180, 5: 90, 6: 90, 7: 270, 8: 270 };

export function exifQuarterTurns(b: Uint8Array): number {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return 0;   // JPEG only
  let i = 2;
  while (i + 4 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    if (marker === 0xda || marker === 0xd9) return 0;             // image data: no Exif before it
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2) return 0;
    if (marker === 0xe1 && len >= 14 &&
        b[i + 4] === 0x45 && b[i + 5] === 0x78 && b[i + 6] === 0x69 && b[i + 7] === 0x66) {
      const turns = readOrientation(b, i + 10, len - 8);
      if (turns !== null) return turns;
    }
    i += 2 + len;
  }
  return 0;
}

/* The TIFF header inside the Exif segment: byte order, then a directory of
   12-byte entries. Only tag 0x0112 is wanted and only its first value. */
function readOrientation(b: Uint8Array, tiff: number, room: number): number | null {
  try {
    if (tiff + 8 > b.length) return null;
    const le = b[tiff] === 0x49 && b[tiff + 1] === 0x49;
    const be = b[tiff] === 0x4d && b[tiff + 1] === 0x4d;
    if (!le && !be) return null;
    const u16 = (o: number) => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
    const u32 = (o: number) => le
      ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
      : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

    const ifd = tiff + u32(tiff + 4);
    if (ifd + 2 > b.length || ifd - tiff > room) return null;
    const count = u16(ifd);
    if (count > 512) return null;                                  // a directory that size is not one
    for (let e = 0; e < count; e++) {
      const at = ifd + 2 + e * 12;
      if (at + 12 > b.length) return null;
      if (u16(at) !== 0x0112) continue;
      const value = u16(at + 8);
      return TURN_FOR[value] ?? 0;
    }
    return null;
  } catch { return null; }
}

/* ---- what is the picture, and what is the frame round it ------------------- */

/* Enough of a bitmap to measure a margin, so this can be tested against a
   grid of numbers rather than against a decoder. */
export interface Px {
  w: number;
  h: number;
  /** Red, green and blue at a point, 0-255. */
  at(x: number, y: number): [number, number, number];
}

export interface TrimOpts {
  /** How far two pixels may differ and still count as the same colour. */
  tolerance?: number;
  /** A side must lose at least this fraction before the trim is worth doing. */
  minGain?: number;
  /** The picture may not be cut below this fraction of its area. */
  keepArea?: number;
  /** Extra taken off each trimmed side, to clear the compression fringe. */
  bite?: number;
}

const dist = (a: [number, number, number], b: [number, number, number]) =>
  Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));

/* A line counts as frame when every sample along it is the same colour as the
   others AND as the corner the scan started from. Both halves matter: without
   the first, a photograph of a clear sky loses its sky; without the second, a
   gradient would be eaten one nearly-identical row at a time. */
function flatRun(px: Px, opts: Required<TrimOpts>, axis: 'row' | 'col', from: number, towards: number): number {
  const along = axis === 'row' ? px.w : px.h;
  const across = axis === 'row' ? px.h : px.w;
  const step = Math.max(1, Math.floor(along / 48));
  const read = (i: number, j: number) => axis === 'row' ? px.at(j, i) : px.at(i, j);

  const anchor = read(from, 0);
  let run = 0;
  for (let k = 0; k < across; k++) {
    const i = from + k * towards;
    if (i < 0 || i >= across) break;
    let flat = true;
    for (let j = 0; j < along; j += step) {
      if (dist(read(i, j), anchor) > opts.tolerance) { flat = false; break; }
    }
    if (!flat) break;
    run++;
  }
  return run;
}

/* The rectangle worth keeping, or null when there is nothing to cut or when
   cutting would take too much of the picture with it. Fractions, so the answer
   is the same whatever size the bitmap being measured is. */
export function findMargins(px: Px, o: TrimOpts = {}): Crop | null {
  const opts: Required<TrimOpts> = {
    tolerance: o.tolerance ?? 12,
    minGain: o.minGain ?? 0.015,
    keepArea: o.keepArea ?? 0.4,
    bite: o.bite ?? 0.005
  };
  if (px.w < 16 || px.h < 16) return null;

  /* JPEG does not keep a hard edge hard. Where a white margin meets the
     picture there is a band a pixel or two wide that is neither, and the scan
     stops at it — leaving a thin white line along the edge of the published
     copy, which is exactly the thing this was meant to remove. So a side that
     is trimmed at all is trimmed a little further. Two pixels of a real
     photograph is a price worth paying; a white hairline is not. */
  const bite = (run: number, size: number) =>
    run > 0 ? Math.min(run + Math.max(2, Math.round(size * opts.bite)), Math.floor(size / 2)) : 0;

  const top = bite(flatRun(px, opts, 'row', 0, 1), px.h);
  const bottom = bite(flatRun(px, opts, 'row', px.h - 1, -1), px.h);
  const left = bite(flatRun(px, opts, 'col', 0, 1), px.w);
  const right = bite(flatRun(px, opts, 'col', px.w - 1, -1), px.w);

  /* A picture that is flat all the way across is one colour, not a framed
     photograph, and there is nothing here to rescue. */
  if (top + bottom >= px.h || left + right >= px.w) return null;

  const x = left / px.w, y = top / px.h;
  const w = (px.w - left - right) / px.w, h = (px.h - top - bottom) / px.h;

  const gained = Math.max(x, y, 1 - x - w, 1 - y - h);
  if (gained < opts.minGain) return null;                 // nothing worth cutting
  if (w * h < opts.keepArea) return null;                 // the frame is most of it: not a framed photograph

  return { x, y, w, h };
}

/* Composing two decisions. The rotation is applied first and the rectangle is
   in the rotated frame, so a margin found before the turn has to travel with
   the picture — the same journey the back office's crop box makes. */
export function turnCrop(c: Crop, quarterTurnsRight: number): Crop {
  let out = c;
  for (let i = 0; i < (((quarterTurnsRight / 90) % 4) + 4) % 4; i++) {
    out = { x: 1 - out.y - out.h, y: out.x, w: out.h, h: out.w };
  }
  return out;
}

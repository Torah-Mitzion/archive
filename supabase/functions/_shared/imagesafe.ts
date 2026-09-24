/* Turning a stranger's file into something safe to serve.
 *
 * The archive publishes without a human looking first, which means the bytes a
 * stranger sends must never be the bytes a visitor downloads. Everything here
 * exists to guarantee that: the file is identified by its own contents rather
 * than its claimed type, its dimensions are read before it is decoded, and the
 * image that reaches the public bucket is one we encoded ourselves from raw
 * pixels. A polyglot JPEG carrying HTML, an SVG with a script in it, EXIF with
 * a payload or a home address in it — none of it survives being redrawn.
 */

import { decode, Image } from 'https://deno.land/x/imagescript@1.2.17/mod.ts';
import { exifQuarterTurns, findMargins, type Crop, type Px } from './orient.ts';

/* imagescript counts pixels from one, not from zero, and turns ANTI-clockwise
   for a positive angle. Both are the opposite of what the rest of this project
   assumes — the back office's crop tool records a clockwise turn — and getting
   either wrong is silent: the picture comes out, just wrong. Wrapped here once
   so no caller has to remember. */
const turnClockwise = (img: Image, deg: number) => { if (deg % 360) img.rotate(360 - (deg % 360)); };
const pixels = (img: Image): Px => ({
  w: img.width, h: img.height,
  at: (x, y) => {
    const c = img.getPixelAt(x + 1, y + 1);
    return [(c >> 24) & 255, (c >> 16) & 255, (c >> 8) & 255];
  }
});

/* Roughly a phone photograph at full resolution. Anything larger is either a
   mistake or an attempt, and neither is worth decoding. */
export const MAX_BYTES = 12 * 1024 * 1024;
/* The decoder allocates width x height x 4 bytes before anything else runs, so
   this ceiling is set by what the worker can actually hold, not by what seems
   generous. Measured, not guessed: 4000x3000 (12 MP) completes; 4640x3480 (16
   MP) does not, whatever the code downstream does. So the line sits just above
   the first and below the second. Above it the file is refused with a reason
   the sender can read, which is the whole point — the alternative is the worker
   dying mid-request and the sender hearing nothing at all.

   Both client paths shrink before sending — the contribute page to 2200px, the
   test console to 1600px — and WhatsApp compresses on the way out, so this
   ceiling is a backstop rather than a routine limit.

   It also stops a decompression bomb: a 20000x20000 PNG is 60 KB on the wire
   and 1.6 GB decoded, and this check runs before the decoder does. */
export const MAX_PIXELS = 12_500_000;
/* What the site actually serves. Nobody needs more, and it caps what a
   re-encode can cost. A phone photograph arrives at 3-4 MB and leaves at a
   few hundred KB; an already-small image can come out slightly larger, which
   is the price of not serving anyone else's bytes. */
export const PUBLIC_EDGE = 1600;
export const PUBLIC_QUALITY = 80;
/* The grids show a photograph in a box 151px wide on a desktop and 356px on a
   telephone. Sending the 1600px copy into either was measured at 23x more
   bytes than the screen can show, and bandwidth is the first thing this
   archive will run out of — not disk. 700px covers the telephone at its own
   pixel density and the desktop with room to spare, in about a quarter of the
   bytes. The full copy is still what the viewer opens. */
export const THUMB_EDGE = 700;
export const THUMB_QUALITY = 74;

/* The master kept in the private bucket. Full resolution at quality 92 costs
   3-4 MB a photograph, and three objects per photograph — master, derivative,
   published copy — is what decides how far a storage allowance goes. 2560px at
   88 is still well above anything the site displays and above most scans of an
   old print, and it roughly thirds the bill.

   Raise these on a plan with room; they are the only two numbers that decide
   how many photographs fit. */
export const ARCHIVE_EDGE = 2560;
export const ARCHIVE_QUALITY = 88;

export type Sniffed = 'jpeg' | 'png' | 'webp' | 'gif';

const startsWith = (b: Uint8Array, sig: number[], at = 0) =>
  sig.every((v, i) => b[at + i] === v);

/* The declared MIME type is a claim by the sender. This is the file saying
   what it is. Anything not on this list — SVG above all, which is a document
   that can carry script, not an image — never reaches the decoder. */
export function sniff(b: Uint8Array): Sniffed | null {
  if (b.length < 12) return null;
  if (startsWith(b, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(b, [0x47, 0x49, 0x46, 0x38])) return 'gif';
  if (startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8))
    return 'webp';
  return null;
}

/* Dimensions straight out of the header, so a decompression bomb is refused
   before anything allocates for it. Returns null when the header cannot be
   read, which is itself a reason to refuse the file. */
export function dimensions(b: Uint8Array, kind: Sniffed): { w: number; h: number } | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  try {
    if (kind === 'png') {
      // IHDR is always the first chunk, at a fixed offset.
      return { w: dv.getUint32(16), h: dv.getUint32(20) };
    }
    if (kind === 'gif') {
      return { w: dv.getUint16(6, true), h: dv.getUint16(8, true) };
    }
    if (kind === 'webp') {
      const tag = String.fromCharCode(b[12], b[13], b[14], b[15]);
      if (tag === 'VP8 ') return { w: dv.getUint16(26, true) & 0x3fff, h: dv.getUint16(28, true) & 0x3fff };
      if (tag === 'VP8L') {
        const bits = dv.getUint32(21, true);
        return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
      }
      if (tag === 'VP8X') {
        const rd = (o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + 1;
        return { w: rd(24), h: rd(27) };
      }
      return null;
    }
    // JPEG: walk the segment chain to the frame header. Cheap — it is all
    // length-prefixed, so nothing is parsed but the markers themselves.
    let i = 2;
    while (i < b.length - 9) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const len = dv.getUint16(i + 2);
      // SOF0..SOF15, excluding the DHT/JPG/DAC markers that share the range.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: dv.getUint16(i + 5), w: dv.getUint16(i + 7) };
      }
      if (len < 2) return null;
      i += 2 + len;
    }
    return null;
  } catch { return null; }
}

/* Whether a refusal was about the CONTENT of the file or merely its SIZE.
   They deserve different answers: telling someone their grandmother's
   photograph "did not pass our check" when the only problem was that it was
   large is both wrong and unkind. */
export class UnsafeFile extends Error {
  readonly tooBig: boolean;
  constructor(message: string, tooBig = false) {
    super(message);
    this.tooBig = tooBig;
  }
}

export interface Clean {
  /** Re-encoded JPEG, the only bytes that ever reach the public bucket. */
  publicBytes: Uint8Array;
  /** The re-encoded original-resolution image, for the private archive copy. */
  archiveBytes: Uint8Array;
  width: number;
  height: number;
  kind: Sniffed;
  /** 64-bit dHash as hex, for spotting the same photograph arriving twice. */
  phash: string;
  /** The grid-sized copy, THUMB_EDGE on its longest side. */
  thumbBytes: Uint8Array;
  /** True when the picture had to be shrunk to fit PUBLIC_EDGE. */
  resized: boolean;
  /** The quarter-turn read out of the file's own Exif tag, ALREADY applied. */
  exifTurn: number;
  /** A flat margin measured on the result and NOT applied — a suggestion for
      whoever decides whether this picture is worth rescuing. */
  trim: Crop | null;
}

/* The whole defence in one call. Throws UnsafeFile with a plain reason if the
   file should not be touched at all; the reason is safe to log but is never
   shown to the sender verbatim. */
export async function sanitize(bytes: Uint8Array): Promise<Clean> {
  if (bytes.length === 0) throw new UnsafeFile('empty file');
  if (bytes.length > MAX_BYTES) throw new UnsafeFile(`too large (${bytes.length} bytes)`, true);

  const kind = sniff(bytes);
  if (!kind) throw new UnsafeFile('not a JPEG, PNG, WebP or GIF');

  const dim = dimensions(bytes, kind);
  if (!dim) throw new UnsafeFile('unreadable image header');
  if (dim.w < 40 || dim.h < 40) throw new UnsafeFile(`too small (${dim.w}x${dim.h})`);
  if (dim.w * dim.h > MAX_PIXELS) throw new UnsafeFile(`too many pixels (${dim.w}x${dim.h})`, true);

  let img: Image;
  try {
    const decoded = await decode(bytes);
    // An animation is a container of frames; take the first and drop the rest.
    img = (decoded as { width: number }).width !== undefined && decoded instanceof Image
      ? decoded
      : ((decoded as unknown as Image[])[0] as Image);
  } catch (e) {
    throw new UnsafeFile(`decode failed: ${e instanceof Error ? e.message : e}`);
  }
  if (!img || !img.width || !img.height) throw new UnsafeFile('decoded to nothing');

  /* ORDER MATTERS HERE, and getting it wrong took the function down on every
     photograph a modern phone takes.

     A decoded image is width x height x 4 bytes of raw bitmap: 48 MB for a
     4000x3000 frame. This used to hash a clone, resize a clone for the master
     and resize another clone for the public copy — three copies of that 48 MB
     alive at once, which the edge worker answered with WORKER_RESOURCE_LIMIT
     and no reply at all. 3200x2400 survived; 4000x3000, the ordinary output of
     any phone sold today, did not.

     So: shrink FIRST, in place, and derive everything from the small one.
     resize() mutates rather than copying, so the big bitmap is released before
     anything else is allocated. */
  const aScale = Math.min(1, ARCHIVE_EDGE / Math.max(img.width, img.height));
  const shrunk = aScale < 1;
  if (shrunk) img.resize(Math.round(img.width * aScale), Math.round(img.height * aScale));

  /* Every phone writes the turn into Exif instead of turning the pixels, and
     this decoder ignores the tag — so a photograph taken in portrait decoded
     landscape and was published on its side, with the tag stripped by the
     re-encode below so nothing downstream could ever put it right. Applied
     here, before the master is written, so the stored copy is upright and
     every later decision is about the picture rather than about the file.

     After the shrink on purpose: turning allocates a second bitmap, and doing
     it at full size is how this function used to run out of memory. */
  const exifTurn = exifQuarterTurns(bytes);
  turnClockwise(img, exifTurn);

  /* Re-encoded from the decoded pixels. This is the step that makes the file
     safe: whatever was hiding in the container is not in the bitmap, and the
     bitmap is all that survives. */
  const archiveBytes = await img.encodeJPEG(ARCHIVE_QUALITY);
  const phash = dhash(img);

  /* Measured, not applied. A screenshot's bars and a photocopy's white margin
     are the same thing to this, and whether cutting them is the right answer
     is a decision for the screener, not for a geometry routine. */
  const trim = findMargins(pixels(img));

  const scale = Math.min(1, PUBLIC_EDGE / Math.max(img.width, img.height));
  const pub = scale < 1
    ? img.clone().resize(Math.round(img.width * scale), Math.round(img.height * scale))
    : img;
  const publicBytes = await pub.encodeJPEG(PUBLIC_QUALITY);

  /* Derived from the public copy, which is already small: the big bitmap is
     long gone by here, and this clone is at most 1600px on its longest side. */
  const tScale = Math.min(1, THUMB_EDGE / Math.max(pub.width, pub.height));
  const thumbBytes = tScale < 1
    ? await pub.clone().resize(Math.round(pub.width * tScale), Math.round(pub.height * tScale))
             .encodeJPEG(THUMB_QUALITY)
    : publicBytes;

  return {
    publicBytes, archiveBytes, thumbBytes,
    width: pub.width, height: pub.height,
    kind, phash, resized: scale < 1 || shrunk,
    exifTurn, trim
  };
}

/* The margins of a master already in storage. sanitize measures this on the
   way in; this reads it back for a photograph being looked at again, so the
   rescue works the second time as well as the first. */
export async function measureTrim(masterBytes: Uint8Array): Promise<Crop | null> {
  const decoded = await decode(masterBytes);
  const img = decoded instanceof Image ? decoded : (decoded as unknown as Image[])[0];
  if (!img?.width) return null;
  return findMargins(pixels(img));
}

/* The served copies, cut afresh from a master that is never touched.
 *
 * This is the other half of the back office's crop tool and of the automatic
 * trim: both record a decision rather than applying one, and both come back
 * here to have it carried out. The master is already at ARCHIVE_EDGE, so this
 * decodes something small and can run on a request without the memory dance
 * sanitize has to do.
 *
 * Rotation first, then the rectangle in fractions of the rotated frame — the
 * same order and the same meaning as the column it is stored in. */
export async function rerender(
  masterBytes: Uint8Array,
  edit: { rot?: number; crop?: Crop | null }
): Promise<{ publicBytes: Uint8Array; thumbBytes: Uint8Array; width: number; height: number }> {
  const decoded = await decode(masterBytes);
  let img = decoded instanceof Image ? decoded : (decoded as unknown as Image[])[0];
  if (!img?.width) throw new UnsafeFile('the master decoded to nothing');

  turnClockwise(img, edit.rot ?? 0);

  const c = edit.crop;
  if (c && (c.x > 0.001 || c.y > 0.001 || c.w < 0.999 || c.h < 0.999)) {
    const x = Math.max(0, Math.round(c.x * img.width));
    const y = Math.max(0, Math.round(c.y * img.height));
    const w = Math.max(1, Math.min(img.width - x, Math.round(c.w * img.width)));
    const h = Math.max(1, Math.min(img.height - y, Math.round(c.h * img.height)));
    img = img.crop(x, y, w, h);
  }

  const scale = Math.min(1, PUBLIC_EDGE / Math.max(img.width, img.height));
  const pub = scale < 1
    ? img.clone().resize(Math.round(img.width * scale), Math.round(img.height * scale))
    : img;
  const publicBytes = await pub.encodeJPEG(PUBLIC_QUALITY);

  const tScale = Math.min(1, THUMB_EDGE / Math.max(pub.width, pub.height));
  const thumbBytes = tScale < 1
    ? await pub.clone().resize(Math.round(pub.width * tScale), Math.round(pub.height * tScale))
             .encodeJPEG(THUMB_QUALITY)
    : publicBytes;

  return { publicBytes, thumbBytes, width: pub.width, height: pub.height };
}

/* dHash: shrink to 9x8 greyscale and record whether each pixel is brighter
   than the one to its right. The same 64 bits the contribute page computes in
   the browser, so a photograph sent by both routes collides. */
export function dhash(img: Image): string {
  const small = img.clone().resize(9, 8);
  const px = small.bitmap; // RGBA
  let hex = '', bits = 0, acc = 0;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const a = (y * 9 + x) * 4, b = (y * 9 + x + 1) * 4;
      const la = px[a] * 0.299 + px[a + 1] * 0.587 + px[a + 2] * 0.114;
      const lb = px[b] * 0.299 + px[b + 1] * 0.587 + px[b + 2] * 0.114;
      acc = (acc << 1) | (la > lb ? 1 : 0);
      if (++bits === 4) { hex += acc.toString(16); bits = 0; acc = 0; }
    }
  }
  return hex;
}

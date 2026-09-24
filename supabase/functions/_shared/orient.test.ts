import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { exifQuarterTurns, findMargins, turnCrop, type Px } from './orient.ts';

/* ---- a bitmap made of numbers, so the rule is testable without a decoder --- */

function grid(w: number, h: number, paint: (x: number, y: number) => [number, number, number]): Px {
  return { w, h, at: paint };
}
/* A photograph with a frame round it: `pad` pixels of one flat colour on each
   named side, noise in the middle so nothing in it reads as flat. */
function framed(w: number, h: number, pad: { t?: number; b?: number; l?: number; r?: number },
                colour: [number, number, number] = [255, 255, 255]): Px {
  const t = pad.t ?? 0, b = pad.b ?? 0, l = pad.l ?? 0, r = pad.r ?? 0;
  return grid(w, h, (x, y) => {
    if (y < t || y >= h - b || x < l || x >= w - r) return colour;
    const n = ((x * 7919 + y * 104729) % 200);
    return [30 + n, 90 + ((n * 3) % 120), 160 - (n % 130)];
  });
}

/* Each trimmed side also loses the compression fringe: two pixels, or half a
   percent of that dimension, whichever is larger. */
Deno.test('a white margin is found on every side it is on', () => {
  const c = findMargins(framed(400, 300, { t: 30, b: 30, l: 40, r: 40 }));
  assert(c);
  assertEquals(Math.round(c!.x * 400), 42);
  assertEquals(Math.round(c!.y * 300), 32);
  assertEquals(Math.round(c!.w * 400), 316);
  assertEquals(Math.round(c!.h * 300), 236);
});

Deno.test('a side with no margin loses nothing at all', () => {
  const c = findMargins(framed(400, 300, { t: 60 }));
  assert(c);
  assertEquals(c!.x, 0);
  assertEquals(1 - c!.x - c!.w, 0);
  assertEquals(1 - c!.y - c!.h, 0);
});

Deno.test('a bar on one side only is still found', () => {
  const c = findMargins(framed(400, 300, { t: 60 }));
  assert(c);
  assertEquals(Math.round(c!.y * 300), 62);
  assertEquals(Math.round(c!.h * 300), 238);
  assertEquals(c!.x, 0);
});

Deno.test('a photograph with no frame is left alone', () => {
  assertEquals(findMargins(framed(400, 300, {})), null);
});

Deno.test('a hairline is not worth cutting', () => {
  assertEquals(findMargins(framed(400, 300, { t: 2 })), null);
});

Deno.test('an image that is one flat colour is not a framed photograph', () => {
  assertEquals(findMargins(grid(400, 300, () => [12, 12, 12])), null);
});

/* The case the whole feature exists to protect: refusing to cut away most of
   the picture just because it has a wide border. Better to hand it to the
   screener whole and let it decide than to publish a fragment. */
Deno.test('a frame that is most of the picture is refused rather than cut to a stamp', () => {
  assertEquals(findMargins(framed(400, 300, { t: 120, b: 120, l: 160, r: 160 })), null);
});

Deno.test('a black screenshot bar is found as readily as a white margin', () => {
  const c = findMargins(framed(400, 300, { t: 40, b: 40 }, [0, 0, 0]));
  assert(c);
  assertEquals(Math.round(c!.y * 300), 42);
});

Deno.test('a sky is not a margin: flat rows that are not the edge colour stop the scan', () => {
  /* Top eighth is a flat sky, then the ground. The sky IS flat, so it is cut —
     that is the honest limit of a purely geometric rule, and the reason the
     screener still gets the last word. What must not happen is the scan
     running on into the ground. */
  const px = grid(400, 300, (x, y) => y < 36 ? [180, 205, 235]
    : [40 + ((x * 31 + y * 17) % 120), 90, 60]);
  const c = findMargins(px);
  assert(c);
  assertEquals(Math.round(c!.y * 300), 38);
  assertEquals(Math.round(c!.h * 300), 262);
});

/* ---- which way up --------------------------------------------------------- */

Deno.test('a file with no Exif asks for no turn', () => {
  assertEquals(exifQuarterTurns(new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0, 4, 0, 0])), 0);
});

Deno.test('something that is not a JPEG asks for no turn', () => {
  assertEquals(exifQuarterTurns(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), 0);
});

Deno.test('a truncated file does not throw', () => {
  assertEquals(exifQuarterTurns(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 20, 0x45, 0x78])), 0);
});

/* Built by hand rather than by a library: the point is that THIS parser reads
   the bytes a camera writes. */
function jpegWithOrientation(value: number, littleEndian = true): Uint8Array {
  const tiff: number[] = [];
  const u16 = (v: number) => littleEndian ? [v & 255, v >> 8] : [v >> 8, v & 255];
  const u32 = (v: number) => littleEndian
    ? [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >> 24) & 255]
    : [(v >> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255];
  tiff.push(...(littleEndian ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8));
  tiff.push(...u16(1));                                  // one entry
  tiff.push(...u16(0x0112), ...u16(3), ...u32(1), ...u16(value), 0, 0);
  tiff.push(...u32(0));                                  // no next directory
  const payload = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const len = payload.length + 2;
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 255, ...payload, 0xff, 0xda]);
}

Deno.test('the eight Exif orientations become four turns', () => {
  const want: Record<number, number> = { 1: 0, 2: 0, 3: 180, 4: 180, 5: 90, 6: 90, 7: 270, 8: 270 };
  for (const [value, turns] of Object.entries(want)) {
    assertEquals(exifQuarterTurns(jpegWithOrientation(Number(value))), turns, `orientation ${value}`);
  }
});

Deno.test('big-endian Exif reads the same as little-endian', () => {
  assertEquals(exifQuarterTurns(jpegWithOrientation(6, false)), 90);
});

Deno.test('a nonsense orientation value asks for no turn', () => {
  assertEquals(exifQuarterTurns(jpegWithOrientation(99)), 0);
});

/* ---- the two decisions composed ------------------------------------------- */

Deno.test('a margin found before the turn travels with the picture', () => {
  /* A bar across the top, then a quarter turn to the right: the bar is now
     down the right-hand side. */
  const c = turnCrop({ x: 0, y: 0.2, w: 1, h: 0.8 }, 90);
  assertEquals(c, { x: 0, y: 0, w: 0.8, h: 1 });
});

Deno.test('four turns come back to where they started', () => {
  const start = { x: 0.1, y: 0.2, w: 0.5, h: 0.6 };
  assertEquals(turnCrop(start, 360), start);
});

Deno.test('no turn changes nothing', () => {
  const start = { x: 0.1, y: 0.2, w: 0.5, h: 0.6 };
  assertEquals(turnCrop(start, 0), start);
});

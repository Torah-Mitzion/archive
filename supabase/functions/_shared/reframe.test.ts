import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { framingOnly, uprightTurn } from './reframe.ts';
import type { Verdict } from './screen.ts';

const v = (o: Partial<Verdict>): Verdict => ({
  decision: 'reject', reasons: [], confidence: 0.9, facts: {}, scores: {}, passes: [], ...o
});

/* ---- when a refusal is worth a second look -------------------------------- */

Deno.test('a screen capture is worth cutting down and asking again', () => {
  assert(framingOnly(v({ reasons: ['first pass refused it', 'this is a chat screenshot'] })));
});

Deno.test('so is a white border round a scan', () => {
  assert(framingOnly(v({ reasons: ['the image has a wide white border round the photograph'] })));
});

Deno.test('and the screener own screenshot score', () => {
  assert(framingOnly(v({ reasons: ['screenshot scored 78'], scores: { screenshot: 78 } })));
});

Deno.test('"not a photograph" is a framing complaint, not a harm one', () => {
  assert(framingOnly(v({ reasons: ['not a photograph'] })));
});

/* ---- when it is not ------------------------------------------------------- */

Deno.test('nudity is never retried', () => {
  assertEquals(framingOnly(v({ reasons: ['screenshot', 'partial nudity visible'] })), false);
});

Deno.test('nor violence', () => {
  assertEquals(framingOnly(v({ reasons: ['bordered image showing blood'] })), false);
});

Deno.test('nor an advertisement, however it is framed', () => {
  assertEquals(framingOnly(v({ reasons: ['screenshot of a promotional flyer'] })), false);
});

Deno.test('nor a legible document', () => {
  assertEquals(framingOnly(v({ reasons: ['screen capture', 'a passport is legible'] })), false);
});

/* The model's numbers are read independently of its prose: a crop is exactly
   how a picture refused for its content would be got past a second look, so
   any harm score at all ends the attempt whatever the words said. */
Deno.test('a harm score ends it even when the words only mention a frame', () => {
  assertEquals(framingOnly(v({ reasons: ['it is a screenshot'], scores: { advertising: 40 } })), false);
  assertEquals(framingOnly(v({ reasons: ['it is a screenshot'], scores: { sexual: 36 } })), false);
});

Deno.test('a harm score below the line does not block a framing retry', () => {
  assert(framingOnly(v({ reasons: ['it is a screenshot'], scores: { advertising: 10, sexual: 0 } })));
});

Deno.test('a refusal with no reason given is not retried', () => {
  assertEquals(framingOnly(v({ reasons: [] })), false);
});

Deno.test('a refusal about the subject is not retried', () => {
  assertEquals(framingOnly(v({ reasons: ['nobody in the picture'] })), false);
  assertEquals(framingOnly(v({ reasons: ['confidence 0.3 below 0.6'] })), false);
});

Deno.test('a picture that was not refused is not a candidate', () => {
  assertEquals(framingOnly(v({ decision: 'publish', reasons: ['screenshot'] })), false);
  assertEquals(framingOnly(v({ decision: 'hold', reasons: ['screenshot'] })), false);
});

/* ---- which way up --------------------------------------------------------- */

Deno.test('the four turns are taken as given', () => {
  for (const u of [90, 180, 270]) {
    assertEquals(uprightTurn(v({ facts: { upright: u } as never })), u);
  }
});

Deno.test('anything else means leave it alone', () => {
  for (const u of [0, 45, -90, 360, '90', null, undefined, NaN]) {
    assertEquals(uprightTurn(v({ facts: { upright: u } as never })), 0);
  }
});

Deno.test('a verdict with no facts at all asks for no turn', () => {
  assertEquals(uprightTurn(v({})), 0);
});

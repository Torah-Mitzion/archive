/* Trying to fix a photograph before turning it away.
 *
 * The screener refuses a screen capture, and it is right to: a chat screenshot
 * or a promotional graphic is not what this archive collects. But the same
 * verdict falls on a real photograph that happens to arrive inside a frame —
 * a phone screenshot OF an old picture, a scan with the lid's white border
 * round it, a photograph of a print with the table it was lying on at the
 * edges. Those are the pictures this archive most needs and least often gets,
 * and refusing them for their margins is refusing them for the way somebody's
 * grandmother happened to have them.
 *
 * So a refusal that is only ever about the frame is not final while there is a
 * frame to remove. The margin is cut and the picture is put to the screener
 * again, once. If it passes, it is the photograph that passes — nothing here
 * argues with the screener, it only stops handing it a picture with a border
 * round it and calling the answer final.
 *
 * ONE THING THIS MUST NEVER DO is rescue a refusal that was about the picture.
 * Nudity, violence, a legible document, an advertisement: a crop can make any
 * of those pass by removing the part that gave them away. So the rescue runs
 * only when NOTHING in the verdict suggests harm, and any hint of it — in the
 * scores or in the model's own words — ends the attempt.
 */
import { rerender } from './imagesafe.ts';
import type { Crop } from './orient.ts';
import type { Scores, Verdict } from './screen.ts';

/* Words that mean "this is not a photograph, it is a picture of one". */
const FRAMING = /screenshot|screen capture|screen-?grab|screen shot|border|margin|frame[sd]?\b|letterbox|cropp?ed|not a photograph|composed|scan of/i;
/* Words that mean the picture itself is the problem. If any of these appear,
   nothing is retried — a crop is exactly how someone would get a refused
   picture past a second look. */
const HARM = /nud|naked|sexual|erotic|breast|underwear|violen|blood|injur|weapon|gun|knife|corpse|humiliat|degrad|advert|promotion|price|logo|flyer|passport|id card|identity card|bank|credit card|payslip|address|licence|license plate/i;

const HARM_SCORES: (keyof Scores)[] = ['sexual', 'violence', 'advertising', 'private_document'];

/* Whether this refusal is about the frame and only the frame. */
export function framingOnly(v: Verdict): boolean {
  if (v.decision !== 'reject') return false;
  const said = (v.reasons || []).join(' · ');
  if (HARM.test(said)) return false;
  /* The model's own numbers, independent of what it wrote. A picture it scored
     50 for advertising is not being retried whatever its prose said. */
  for (const k of HARM_SCORES) {
    const n = v.scores?.[k];
    if (typeof n === 'number' && n >= 35) return false;
  }
  if (!said) return false;
  return FRAMING.test(said);
}

/* The quarter-turn the screener asked for, if it asked for a sane one. */
export function uprightTurn(v: Verdict): 0 | 90 | 180 | 270 {
  const u = (v.facts as { upright?: unknown } | undefined)?.upright;
  return u === 90 || u === 180 || u === 270 ? u : 0;
}

export interface Reframed {
  verdict: Verdict;
  /** What to store in tmz_photo.edit, or null when the picture is left whole. */
  edit: { rot: number; crop: Crop | null } | null;
  /** The re-rendered copies — null when nothing changed and the ones already
      made (or already in storage) are still right. */
  rendered: { publicBytes: Uint8Array; thumbBytes: Uint8Array; width: number; height: number } | null;
  /** True when cutting the frame off turned a refusal into a pass. */
  rescued: boolean;
}

/* Screen, and if the only thing wrong is the frame, cut it and screen once
   more. Then turn the result the way up the screener says it should be.

   `run` is the screening call itself, passed in so this can be tested without
   a network and without a key. `trim` is what sanitize measured, or what
   measureTrim reads back off a master — the caller has one or the other
   depending on whether the picture is arriving or being looked at again. */
export async function screenAndReframe(
  master: Uint8Array,
  trim: Crop | null,
  run: (bytes: Uint8Array) => Promise<Verdict>
): Promise<Reframed> {
  let verdict = await run(master);
  let crop: Crop | null = null;
  let rescued = false;

  if (trim && framingOnly(verdict)) {
    const cut = await rerender(master, { rot: 0, crop: trim });
    const second = await run(cut.publicBytes);
    if (second.decision === 'reject') {
      /* Still refused with the frame gone: the refusal was never about the
         frame. Keep the first verdict and record that the attempt was made, so
         the record shows the picture was given its chance. */
      verdict = { ...verdict, reasons: [...verdict.reasons, 'still refused after its margins were cut off'] };
    } else {
      verdict = { ...second, reasons: [...second.reasons, 'passed once its margins were cut off'] };
      crop = trim;
      rescued = true;
    }
  }

  const rot = uprightTurn(verdict);
  if (!crop && !rot) return { verdict, edit: null, rendered: null, rescued };

  return { verdict, edit: { rot, crop }, rendered: await rerender(master, { rot, crop }), rescued };
}

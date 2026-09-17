/* Getting to know the sender.
 *
 *   npx deno test supabase/functions/_shared/intro.test.ts
 *
 * No imports but the module under test: these are the decisions that put a
 * face beside a name on a public site, and they should be checkable without a
 * model, a webhook or a database. */
import { absorb, introComplete, answersPortraitOffer, type Known, type Heard } from './intro.ts';

function eq(got: unknown, want: unknown, what: string) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) throw new Error(`${what}\n  got  ${g}\n  want ${w}`);
}

const silence: Heard = { name: null, was_shaliach: null, year: null, community_slug: null, wants_portrait: false };
const heard = (o: Partial<Heard> = {}): Heard => ({ ...silence, ...o });
const known = (o: Partial<Known> = {}): Partial<Known> => o;

Deno.test('a message that says nothing about them writes nothing', () => {
  eq(absorb(known({ person_name: 'יהודה לפיאן', was_shaliach: true, shaliach_year: 2016 }), heard(), null),
     {}, '"thanks!" must not erase what is known');
});

Deno.test('what they say is written', () => {
  eq(absorb(known(), heard({ name: 'Yehuda Lapian' }), null),
     { person_name: 'Yehuda Lapian' }, 'their name');
  eq(absorb(known({ person_name: 'Yehuda' }), heard({ was_shaliach: true, year: 2016 }), 'c-munich'),
     { was_shaliach: true, shaliach_year: 2016, shaliach_community_id: 'c-munich' }, 'where and when');
});

Deno.test('"no, I was not" is an answer and survives', () => {
  /* The one value where false and null must not be confused: false ends the
     questions, null is a question not yet answered. */
  eq(absorb(known(), heard({ was_shaliach: false }), null),
     { was_shaliach: false }, 'a plain no is recorded');
  eq(absorb(known({ was_shaliach: false }), heard(), null), {}, 'and is not asked again');
});

Deno.test('a correction replaces, an echo does not write', () => {
  eq(absorb(known({ shaliach_year: 2016 }), heard({ year: 2015 }), null),
     { shaliach_year: 2015 }, '"actually it was 2015"');
  eq(absorb(known({ shaliach_year: 2016 }), heard({ year: 2016 }), null),
     {}, 'the same year again is not a change');
});

Deno.test('the introduction is over when there is nothing left to ask', () => {
  eq(introComplete(known({ was_shaliach: false })), true, 'they did not serve — that is the end of it');
  eq(introComplete(known({ was_shaliach: true, person_name: 'A', shaliach_year: 2016, shaliach_community_id: 'c' })),
     true, 'name, year and community all known');
  eq(introComplete(known({ was_shaliach: true, person_name: 'A', shaliach_year: 2016 })),
     false, 'without the community it is not finished');
  eq(introComplete(known({ was_shaliach: true, shaliach_year: 2016, shaliach_community_id: 'c' })),
     false, 'nor without a name');
  eq(introComplete(known()), false, 'nor before anything is known');
  eq(introComplete(known({ person_name: 'A', shaliach_year: 2016, shaliach_community_id: 'c' })),
     false, 'a year and a place they never claimed do not finish it');
});

/* ---- the picture we asked for ------------------------------------------- */

const arriving = (o: Record<string, unknown> = {}) => answersPortraitOffer({
  offered: true, name: 'Yehuda Lapian', saysItIsThem: false,
  captionPeople: null, captionOccasion: null, captionPlacedIt: false, ...o
} as Parameters<typeof answersPortraitOffer>[0]);

Deno.test('a photograph with nothing to say, right after the offer, is the picture', () => {
  eq(arriving(), true, 'no caption at all');
});

Deno.test('but only after the offer, and only for someone we can name', () => {
  eq(arriving({ offered: false }), false, 'nobody asked them for one');
  eq(arriving({ name: null }), false, 'we do not know whose it would be');
});

Deno.test('a caption that says anything makes it an ordinary photograph', () => {
  /* The guard that matters: a portrait skips every question and goes onto a
     person's entry, so a group photograph read as one puts the wrong face
     beside a name. */
  eq(arriving({ captionPeople: 'הרב כהן ומשפחתו' }), false, 'it names people');
  eq(arriving({ captionOccasion: 'סיום הש"ס' }), false, 'it describes an occasion');
  eq(arriving({ captionPlacedIt: true }), false, 'it places itself in a community or a year');
});

Deno.test('a caption that says outright it is them takes its own path', () => {
  eq(arriving({ saysItIsThem: true }), false, 'the "this is me" path handles that one');
});

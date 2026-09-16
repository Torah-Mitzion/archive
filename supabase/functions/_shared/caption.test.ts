/* What a message is allowed to write under a photograph.
 *
 *   npx deno test supabase/functions/_shared/caption.test.ts
 *
 * Every message quoted below is a real one from the archive's own WhatsApp
 * log. The first three were filed as the names of the people in a photograph
 * — one of them under five photographs at once — because the agent had last
 * asked who was in them. They are the reason this file exists, so they are
 * the first thing it tests.
 *
 * No imports but the module under test: the rule is meant to be checkable
 * without a model, a webhook, a database or a network. */
import { captionDecision, type CaptionInput, type CaptionPatch } from './caption.ts';

function eq(got: unknown, want: unknown, what: string) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) throw new Error(`${what}\n  got  ${g}\n  want ${w}`);
}

/* An answer to a question about who is in the photograph, from a model that
   did answer, about the photograph that was asked about, which holds nothing
   yet. Every test below changes one thing about that. */
function ask(over: Partial<CaptionInput> = {}): CaptionInput {
  return {
    text: '', people: null, occasion: null,
    provides: new Set<string>(), hasModel: true,
    asking: 'people', askingThis: true,
    current: { people_text: null, occasion_text: null },
    ...over
  };
}
const decide = (over: Partial<CaptionInput> = {}): CaptionPatch => captionDecision(ask(over));

Deno.test('an instruction to move a batch is not the people in it', () => {
  /* Printed under five Munich photographs as their caption. It gives a place
     and a year — never who is in the picture. */
  eq(decide({
    text: 'the most recent photos that you put in greater washington need to be put into Munich 2016',
    provides: new Set(['community', 'year'])
  }), {}, 'the Munich instruction must write nothing');
});

Deno.test('covering words are not the people in it', () => {
  for (const text of ['here they are', 'wait its from 2025', 'wait the last image was from 2019']) {
    eq(decide({ text, provides: new Set(text.includes('20') ? ['year'] : []) }), {}, text);
  }
});

Deno.test('a bare list of names the extractor missed is still the answer', () => {
  /* The case the fallback exists for: the model read the message as an answer
     about the people, but could not isolate a value from it. */
  eq(decide({ text: 'הרב יהודה לפיאן ורעייתו', provides: new Set(['people']) }),
     { people_text: 'הרב יהודה לפיאן ורעייתו' }, 'a named answer is written whole');
});

Deno.test('what the model isolated wins over the whole message', () => {
  eq(decide({ text: 'I think that is Rabbi Lapian on the right', people: 'Rabbi Yehuda Lapian',
              provides: new Set(['people']) }),
     { people_text: 'Rabbi Yehuda Lapian' }, 'the isolated value, not the sentence');
});

Deno.test('with no model the older, blunter rule stands', () => {
  /* Nothing to ask and nobody to ask it: losing a real answer is worse. */
  eq(decide({ text: 'here they are', hasModel: false }),
     { people_text: 'here they are' }, 'no model: the message stands in');
});

Deno.test('a question about another photograph does not answer this one', () => {
  eq(decide({ text: 'Cape Town 2011', provides: new Set(['people']), askingThis: false }),
     {}, 'a quote routed this elsewhere');
});

Deno.test('nothing was asked, so nothing is an answer', () => {
  eq(decide({ text: 'הרב יהודה לפיאן', provides: new Set(['people']), asking: null }),
     {}, 'unasked');
  eq(decide({ text: 'הרב יהודה לפיאן', provides: new Set(['people']), asking: 'year' }),
     {}, 'asked for something else');
});

Deno.test('a guess never replaces an answer already there', () => {
  eq(decide({ text: 'ועוד כמה אנשים', provides: new Set(['people']),
              current: { people_text: 'הרב יהודה לפיאן', occasion_text: null } }),
     {}, 'the fallback only fills an empty field');
});

Deno.test('a correction the model isolated does replace it', () => {
  /* People correct themselves. The model only extracts a value when the
     message really gives one, so overwriting is safe. */
  eq(decide({ text: 'sorry, it is his brother', people: 'Rabbi Moshe Lapian',
              provides: new Set(['people']),
              current: { people_text: 'הרב יהודה לפיאן', occasion_text: null } }),
     { people_text: 'Rabbi Moshe Lapian' }, 'a stated value overwrites');
  eq(decide({ text: 'yes, Rabbi Lapian', people: 'הרב יהודה לפיאן', provides: new Set(['people']),
              current: { people_text: 'הרב יהודה לפיאן', occasion_text: null } }),
     {}, 'the same value again is not a change');
});

Deno.test('what the screener refused is not written', () => {
  eq(decide({ text: 'x', people: 'something the screener would not have', provides: new Set(['people']),
              peopleRefused: true }),
     {}, 'refused, and the whole message does not take its place');
  eq(decide({ text: 'x', occasion: 'likewise', provides: new Set(['occasion']),
              asking: 'occasion', occasionRefused: true }),
     {}, 'refused occasion');
});

Deno.test('the occasion is decided the same way', () => {
  eq(decide({ text: 'מסיבת סיום הזמן', provides: new Set(['occasion']), asking: 'occasion' }),
     { occasion_text: 'מסיבת סיום הזמן' }, 'an answer about the occasion');
  eq(decide({ text: 'here they are', provides: new Set(), asking: 'occasion' }),
     {}, 'covering words are not the occasion either');
  eq(decide({ text: 'anything', occasion: 'סיום הש"ס', provides: new Set(['occasion']), asking: 'occasion' }),
     { occasion_text: 'סיום הש"ס' }, 'the isolated occasion');
});

Deno.test('a message may answer both at once', () => {
  eq(decide({ text: 'הרב לפיאן בסיום הש"ס', people: 'הרב לפיאן', occasion: 'סיום הש"ס',
              provides: new Set(['people', 'occasion']) }),
     { people_text: 'הרב לפיאן', occasion_text: 'סיום הש"ס' }, 'both fields');
});

Deno.test('being asked is never evidence of having answered', () => {
  /* The whole defect in one line: the question alone used to be enough. */
  for (const field of ['people', 'occasion'] as const) {
    eq(decide({ text: 'ok thanks', asking: field, provides: new Set() }), {}, `asked for ${field}`);
  }
});

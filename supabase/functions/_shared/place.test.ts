/* Where a photograph goes.
 *
 *   npx deno test supabase/functions/_shared/place.test.ts
 *
 * The first two cases are the real ones: a photograph filed in St. Louis 2016
 * whose caption said "same location and year" about a picture that had just
 * gone into Johannesburg 2005, and two filed in Munich whose captions said
 * "saint louisa". */
import { placeDecision } from './place.ts';

function eq(got: unknown, want: unknown, what: string) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) throw new Error(`${what}\n  got  ${g}\n  want ${w}`);
}
const decide = (o: Partial<Parameters<typeof placeDecision>[0]>) => placeDecision({
  captionCommunityId: null, captionYear: null, carriedCommunityId: null, carriedYear: null, ...o
});

Deno.test('the caption places the photograph', () => {
  eq(decide({ captionCommunityId: 'c-joburg', captionYear: 2005 }),
     { community_id: 'c-joburg', year: 2005, fromCaption: true, unknownPlace: null },
     '"johannesburg year 2005"');
});

Deno.test('the caption beats what was carried over', () => {
  eq(decide({ captionCommunityId: 'c-joburg', captionYear: 2005,
              carriedCommunityId: 'c-munich', carriedYear: 2016 }).community_id,
     'c-joburg', 'a stated community wins');
  eq(decide({ captionCommunityId: 'c-joburg', captionYear: 2005,
              carriedCommunityId: 'c-munich', carriedYear: 2016 }).year,
     2005, 'a stated year wins');
});

Deno.test('a caption with nothing to say inherits the one before', () => {
  /* Which is only right because what is carried is now where the PREVIOUS
     PHOTOGRAPH went — see the write-back in the handler. Someone emptying a
     shoebox from Memphis 2003 sends eleven more with no caption at all. */
  eq(decide({ carriedCommunityId: 'c-memphis', carriedYear: 2003 }),
     { community_id: 'c-memphis', year: 2003, fromCaption: false, unknownPlace: null },
     'no caption');
});

Deno.test('a caption that gives only a year keeps the place it came with', () => {
  eq(decide({ captionYear: 2004, carriedCommunityId: 'c-memphis', carriedYear: 2003 }),
     { community_id: 'c-memphis', year: 2004, fromCaption: true, unknownPlace: null },
     '"2004" while working through one community');
});

Deno.test('a place we could not place is asked about, never inherited', () => {
  /* The Munich case. "saint louisa 2011" named somewhere; the matcher did not
     know it (St. Louis is held as "St. Louis" and "Saint-Louis", and neither
     is a substring of "saint louisa"), and the community from a message sent
     the day before filled the gap in silence. */
  eq(decide({ captionYear: 2011, placeSaid: 'saint louisa', carriedCommunityId: 'c-munich', carriedYear: 2016 }),
     { community_id: null, year: 2011, fromCaption: true, unknownPlace: 'saint louisa' },
     'it names somewhere we do not hold');
});

Deno.test('naming nowhere and naming somewhere unknown are different things', () => {
  eq(decide({ captionYear: 2011, carriedCommunityId: 'c-munich' }).community_id, 'c-munich',
     'nowhere named: inherit');
  eq(decide({ captionYear: 2011, placeSaid: 'saint louisa', carriedCommunityId: 'c-munich' }).community_id, null,
     'somewhere named that we do not hold: ask');
});

Deno.test('a resolved place is never reported as unknown', () => {
  eq(decide({ captionCommunityId: 'c-stlouis', placeSaid: 'st louis' }).unknownPlace, null,
     'we placed it, so there is nothing to ask');
});

Deno.test('fromCaption says whether this caption placed it', () => {
  eq(decide({ carriedCommunityId: 'c-memphis', carriedYear: 2003 }).fromCaption, false, 'inherited');
  eq(decide({ captionYear: 2003 }).fromCaption, true, 'a year of its own');
  eq(decide({ captionCommunityId: 'c-memphis' }).fromCaption, true, 'a place of its own');
});

Deno.test('the afternoon this went wrong, replayed', () => {
  /* The rule above only holds the line because what is carried is now where
     the previous PHOTOGRAPH went. Walking the real sequence:
     a text had left "Munich 2016" on the sender days earlier, and a second
     text "they were for st louis" had left St. Louis on top of it. */
  let carried = { c: 'c-munich' as string | null, y: 2016 as number | null };
  const send = (captionCommunityId: string | null, captionYear: number | null, placeSaid?: string) => {
    const p = placeDecision({ captionCommunityId, captionYear, placeSaid,
                              carriedCommunityId: carried.c, carriedYear: carried.y });
    /* the write-back: the next photograph inherits where THIS one went */
    if (p.community_id) carried.c = p.community_id;
    if (p.year) carried.y = p.year;
    return p;
  };

  eq(send(null, 2011, 'saint louisa').community_id, null,
     '"saint louisa 2011" is asked about, not filed in Munich');
  carried = { c: 'c-stlouis', y: 2016 };            // "they were for st louis", then the answer
  const joburg = send('c-joburg', 2005);
  eq([joburg.community_id, joburg.year], ['c-joburg', 2005], '"johannesburg year 2005"');
  const same = send(null, null);
  eq([same.community_id, same.year], ['c-joburg', 2005],
     '"same location and year" now means the photograph before it');
});

/* Getting to know the sender: what may be written about a person, when there
 * is nothing left to ask, and whether the photograph that just arrived is the
 * picture we asked them for.
 *
 * Out here for the same reason the caption rule is: these are the decisions
 * that quietly corrupt an archive when they are wrong, and in the middle of
 * the handler they cannot be read at a glance or tested without a model, a
 * webhook and a database. Each one is a few lines.
 */

/* What the agent knows about a sender — the columns of tmz_wa_contact that are
   about the person rather than about their next photograph. */
export interface Known {
  person_name: string | null;
  was_shaliach: boolean | null;
  shaliach_year: number | null;
  shaliach_community_id: string | null;
  person_id: string | null;
  intro_done_at: string | null;
  portrait_offered_at: string | null;
}

/* What one message said about them. Anything it did not say is null, and
   was_shaliach carries a third state: false is an answer, null is silence. */
export interface Heard {
  name: string | null;
  was_shaliach: boolean | null;
  year: number | null;
  community_slug: string | null;
  wants_portrait: boolean;
}

/* Silence never overwrites. Someone who says "actually it was 2015" corrects
   their year; someone who says "thanks!" does not erase it. Only a value the
   message really carries is written, and only when it differs from what is
   already there — an unchanged value is not a write. */
export function absorb(known: Partial<Known>, heard: Heard,
                       communityId: string | null): Partial<Known> {
  const patch: Partial<Known> = {};
  if (heard.name && heard.name !== known.person_name) patch.person_name = heard.name;
  if (heard.was_shaliach !== null && heard.was_shaliach !== known.was_shaliach) {
    patch.was_shaliach = heard.was_shaliach;
  }
  if (heard.year && heard.year !== known.shaliach_year) patch.shaliach_year = heard.year;
  if (communityId && communityId !== known.shaliach_community_id) {
    patch.shaliach_community_id = communityId;
  }
  return patch;
}

/* Nothing left to ask. Either they say they did not serve — which ends the
   questions, because the rest are all about a tenure — or their name, their
   year and their community are all known.

   An introduction that never completes is only ever a question not asked: the
   model is told to accept a refusal and move on, and this side simply never
   marks it done. That is the right way round. A sender who will not give a
   name is not pestered for one on every message, because the model can see in
   the transcript that it already asked. */
export function introComplete(c: Partial<Known>): boolean {
  if (c.was_shaliach === false) return true;
  return Boolean(c.was_shaliach && c.person_name && c.shaliach_year && c.shaliach_community_id);
}

/* Is the photograph that just arrived the picture of themselves we asked for?
 *
 * The guard is deliberately strict. A portrait skips the questions a
 * photograph is asked and goes straight onto a person's entry on the site, so
 * reading a group photograph as one puts the wrong face beside a name. Only a
 * picture that says NOTHING about itself qualifies: a caption naming anyone,
 * describing an occasion, or placing it in a community or a year is an
 * ordinary photograph out of their shoebox, however soon after the offer it
 * arrives. */
export function answersPortraitOffer(o: {
  offered: boolean;          // we asked them for one and they have not sent it yet
  name: string | null;       // we know what to call them
  saysItIsThem: boolean;     // the caption said so outright — that path is its own
  captionPeople: string | null;
  captionOccasion: string | null;
  captionPlacedIt: boolean;  // this caption gave a community or a year
}): boolean {
  return o.offered && Boolean(o.name) && !o.saysItIsThem
    && !o.captionPeople && !o.captionOccasion && !o.captionPlacedIt;
}

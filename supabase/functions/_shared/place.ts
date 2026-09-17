/* Where a photograph goes: what its own caption says, and what may be carried
 * over from the one before it.
 *
 * This is where a photograph was filed in St. Louis 2016 because someone had
 * typed "st louis" twenty minutes earlier and "Munich 2016" the day before.
 * The caption said "same location and year" — meaning the photograph before,
 * which had just been filed correctly in Johannesburg 2005 — and it was never
 * read at all, because the carried-over pair had already filled both fields
 * and the code only consulted the model when something was still missing.
 *
 * Two rules come out of that, and they are the whole of this file:
 *
 *   1. The caption is read first and always. What it says wins.
 *   2. What is carried over fills only what the caption did not say — and
 *      never the community when the caption named a place we could not place.
 *      A caption that says "saint louisa" is talking about somewhere; filing
 *      it under the community someone mentioned yesterday is worse than
 *      asking.
 */

export interface Placement {
  community_id: string | null;
  year: number | null;
  /** this caption placed the photograph itself, rather than inheriting */
  fromCaption: boolean;
  /** the caption named a place and we could not tell which community: ask */
  unknownPlace: string | null;
}

export function placeDecision(o: {
  /** what the caption named, already resolved against the community list */
  captionCommunityId: string | null;
  captionYear: number | null;
  /** the place words the caption used, whether or not they resolved */
  placeSaid?: string | null;
  /** where the sender's previous photograph was filed */
  carriedCommunityId: string | null;
  carriedYear: number | null;
}): Placement {
  const fromCaption = Boolean(o.captionCommunityId || o.captionYear);
  /* They named somewhere, and it is not a community we hold. */
  const unknownPlace = !o.captionCommunityId && o.placeSaid ? o.placeSaid : null;

  return {
    community_id: o.captionCommunityId ?? (unknownPlace ? null : o.carriedCommunityId),
    year: o.captionYear ?? o.carriedYear,
    fromCaption,
    unknownPlace
  };
}

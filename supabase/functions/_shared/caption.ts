/* What a message is allowed to write under a photograph.
 *
 * This lived inside the WhatsApp handler, in the middle of a long block, and
 * it is where the archive was quietly poisoned: one clause filed the WHOLE of
 * whatever someone typed as the names of the people in a photograph, on no
 * stronger grounds than that the agent had last asked who was in it. So an
 * instruction to move a batch — "the most recent photos that you put in
 * greater washington need to be put into Munich 2016" — was printed under
 * five photographs as the people in them, and "here they are", "wait its from
 * 2025" and "wait the last image was from 2019" under five more.
 *
 * The rule is six lines. It is out here so it can be read at a glance and
 * tested without a model, a webhook or a database.
 */

export type Field = 'community' | 'year' | 'people' | 'occasion';

export interface CaptionInput {
  /** what they typed, whole */
  text: string;
  /** the names the model isolated from it, if it could */
  people: string | null;
  /** the occasion the model isolated from it, if it could */
  occasion: string | null;
  /** the fields the model says this message genuinely gives a value for */
  provides: Set<string>;
  /** false when no model answered: then there is nothing to ask, and the
      older, blunter behaviour stands rather than losing a real answer */
  hasModel: boolean;
  /** what the agent last asked this sender for */
  asking: string | null;
  /** whether that question was about THIS photograph */
  askingThis: boolean;
  /** the screener refused the text for that field */
  peopleRefused?: boolean;
  occasionRefused?: boolean;
  /** what the photograph already holds */
  current: { people_text: string | null; occasion_text: string | null };
}

export interface CaptionPatch { people_text?: string; occasion_text?: string }

export function captionDecision(o: CaptionInput): CaptionPatch {
  const patch: CaptionPatch = {};
  /* The whole message may stand in for an answer the model could not isolate —
     a bare list of names usually — but only when the model says the message
     really does answer that question. Being asked something is not evidence of
     having answered it. */
  const answers = (f: Field) => !o.hasModel || o.provides.has(f);

  if (o.people && !o.peopleRefused && o.people !== o.current.people_text) {
    patch.people_text = o.people;
  } else if (!o.people && o.askingThis && o.asking === 'people'
             && !o.current.people_text && answers('people')) {
    patch.people_text = o.text;
  }

  if (o.occasion && !o.occasionRefused && o.occasion !== o.current.occasion_text) {
    patch.occasion_text = o.occasion;
  } else if (!o.occasion && o.askingThis && o.asking === 'occasion'
             && !o.current.occasion_text && answers('occasion')) {
    patch.occasion_text = o.text;
  }

  return patch;
}

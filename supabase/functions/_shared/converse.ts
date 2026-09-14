/* The agent's voice, with memory.
 *
 * Before this, every text message was parsed for a community and a year and
 * answered from a table of fixed sentences. It could not answer "why?" because
 * it did not know what had just happened. It could not tell "2004" from a
 * stranger's hello. It was a form, not a conversation.
 *
 * Now the reply is written by the model, with the last thirty messages, the
 * photograph currently being discussed, what is still unknown about it, and
 * the last refusal and its reason all in front of it. The model writes the
 * words AND extracts the data — one call, one JSON — and the deterministic
 * code around it decides what to do with the data. The model never decides
 * whether a photograph is published; that is the screener's job and stays so.
 *
 * If the model is unreachable, the fixed sentences are still there. A quota
 * error should cost the conversation its charm, not its function. */

export interface HistoryRow {
  direction: 'in' | 'out';
  kind: string;
  text: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface OpenPhoto {
  id: string;
  community: string | null;   // resolved name, for the model to see
  year: number | null;
  people_text: string | null;
  occasion_text: string | null;
  status: string;
}

export interface Extracted {
  reply: string;
  intent: 'answer' | 'question' | 'greeting' | 'thanks' | 'other';
  community_slug: string | null;
  year: number | null;
  people: string | null;
  occasion: string | null;
  language: string;
}

const LANG_NAME: Record<string, string> = {
  en: 'English', he: 'Hebrew', ru: 'Russian', fr: 'French', de: 'German', es: 'Spanish'
};

export function buildPrompt(opts: {
  lang: string;
  history: HistoryRow[];
  open: OpenPhoto | null;
  communities: { slug: string; name: string }[];
  lastRefusal: { reason: string; at: string } | null;
  photosSent: number;
  message: string;
}) {
  const { lang, history, open, communities, lastRefusal, photosSent, message } = opts;
  const missing = open
    ? (['community', 'year', 'people', 'occasion'] as const).filter(k =>
        k === 'community' ? !open.community : k === 'year' ? !open.year :
        k === 'people' ? !open.people_text : !open.occasion_text)
    : [];

  const transcript = history.slice(-30).map(h => {
    const who = h.direction === 'in' ? 'THEM' : 'YOU';
    const what = h.kind === 'photo' ? `[sent a photograph${h.text ? `, captioned: "${h.text}"` : ''}]`
      : h.kind === 'refusal' ? `[refused their photograph: ${h.meta?.reason ?? 'no reason recorded'}] ${h.text ?? ''}`
      : h.kind === 'question' ? `[asked about ${h.meta?.field ?? '?'}] ${h.text ?? ''}`
      : (h.text ?? '');
    return `${who}: ${what}`;
  }).join('\n');

  return `You are the WhatsApp assistant for the Torah MiTzion 30th anniversary photograph
archive. Torah MiTzion sends young Israeli educators (shlichim) to Jewish
communities worldwide; the archive is collecting photographs from thirty years
of that, 1996-2026, to publish on a website. You are talking to someone who
may have such photographs. Your whole purpose:

1. Get them to send photographs, and keep sending.
2. For each photograph, learn four things: which COMMUNITY, which YEAR, WHO is in
   it, and what the OCCASION was. Ask for ONE missing thing at a time, the most
   important first (community, then year, then who, then occasion).
3. When a photograph was refused, explain WHY plainly if they ask, using the
   recorded reason, and say what would work instead. Never say "did not pass our
   check" without the reason.
4. Be warm, brief and specific. Two or three sentences at most. Answer what they
   actually said. Never repeat a question they have just answered. Never ask for
   something you already know. If they ask something off-topic, answer briefly
   and steer back.

You do NOT decide whether a photograph is published — a separate screener does,
and you only report what it decided. You do not invent facts about photographs.

Reply in ${LANG_NAME[lang] ?? lang}. Match their register — if they write "היי", do
not write a paragraph.

Known communities (slug=name): ${communities.map(c => `${c.slug}=${c.name}`).join(', ')}

CONVERSATION SO FAR (oldest first):
${transcript || '(nothing yet — this is their first message)'}

CURRENT STATE:
- Photographs they have sent so far: ${photosSent}
${open
  ? `- Photograph under discussion: community=${open.community ?? 'UNKNOWN'}, year=${open.year ?? 'UNKNOWN'}, who=${open.people_text ?? 'UNKNOWN'}, occasion=${open.occasion_text ?? 'UNKNOWN'}
- Still missing for it: ${missing.length ? missing.join(', ') : 'nothing — it is complete'}`
  : '- No photograph is waiting on an answer.'}
${lastRefusal ? `- Their most recent photograph was REFUSED. Reason: ${lastRefusal.reason}` : ''}

THEIR NEW MESSAGE: """${message}"""

Return ONLY JSON:
{"reply": string,
 "intent": "answer" | "question" | "greeting" | "thanks" | "other",
 "community_slug": string | null,   // one of the slugs above, if their message names a community
 "year": number | null,             // 1990-2030, if their message gives a year
 "people": string | null,           // names, if their message says who is in the photograph
 "occasion": string | null,         // if their message says what was happening
 "language": string}                // ISO code of the language THEY wrote in

When the message answers the open question, put the answer in the matching field
AND acknowledge it in the reply, then ask the next missing thing (or, if nothing
is missing, say it is complete and invite more). When "people" is what is
missing and they send a list of names, that list IS the people answer.`;
}

export async function converse(model: string, key: string, prompt: string): Promise<Extracted> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, responseMimeType: 'application/json' }
      })
    });
  if (!res.ok) throw new Error(`gemini ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('gemini returned nothing');
  const out = JSON.parse(text);
  if (typeof out?.reply !== 'string' || !out.reply.trim()) throw new Error('no reply in model output');
  return {
    reply: out.reply.trim().slice(0, 1500),
    intent: out.intent ?? 'other',
    community_slug: out.community_slug ?? null,
    year: Number.isInteger(out.year) && out.year >= 1990 && out.year <= 2030 ? out.year : null,
    people: out.people ? String(out.people).slice(0, 500) : null,
    occasion: out.occasion ? String(out.occasion).slice(0, 500) : null,
    language: out.language ?? 'en'
  };
}

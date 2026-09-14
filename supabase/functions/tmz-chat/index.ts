/* The site's assistant.
 *
 * It answers one kind of question: where in the archive to look. Ask it
 * about a place and a year and it hands back a line or two — the community,
 * the Rosh Kollel, how many shlichim, how many photographs — and the page
 * that holds them. Ask it anything else and it says, politely, that this is
 * all it does.
 *
 * It knows only what tmz_chat_facts() tells it, which is only what the year
 * pages already print. The browser gets links as {community, year} pairs and
 * builds the URLs itself, so the model never invents a URL.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.6-flash';
const IP_SALT = Deno.env.get('TMZ_IP_SALT') ?? 'tmz-default-salt';

const QUESTIONS_PER_HOUR = 40;
const FACTS_TTL_MS = 5 * 60_000;
const MAX_QUESTION = 500;
const MAX_HISTORY = 8;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function rpc(fn: string, args: unknown) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${fn} → ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

/* The whole archive is ~35KB of JSON and changes a few times a day at most;
   one fetch per isolate per five minutes is plenty. */
let facts: { at: number; text: string } | null = null;
async function factsText() {
  if (facts && Date.now() - facts.at < FACTS_TTL_MS) return facts.text;
  const f = await rpc('tmz_chat_facts', {});
  facts = { at: Date.now(), text: JSON.stringify(f.communities) };
  return facts.text;
}

interface Turn { role: 'user' | 'assistant'; text: string }
interface Answer { reply: string; links: { community: string; year: number | null }[] }

function prompt(factsJson: string, history: Turn[], question: string) {
  return `You are the assistant of the Torah MiTzion 30th-anniversary photograph archive (1996–2026), a website that maps the Torah MiTzion kollels around the world and holds their photographs by community and by year.

YOUR ONLY JOB: help a visitor find the right page. They tell you a place and/or a year; you answer in a few words — the community (kollel), the year, who was Rosh Kollel then, how many shlichim, how many photographs are held — and point to the page. You may also answer simple factual questions that the DATA below answers (which year did a kollel open, who was Rosh Kollel in a given year, which communities are in a region, which years have no photographs yet).

RULES
- Answer ONLY from the DATA. Never invent a name, a year, a number or a community. If the data does not say, say so in one short sentence.
- If the question is not about this archive (news, other topics, chit-chat beyond a greeting, requests to write code or essays), reply in one sentence that you can only help find communities and years on this site, and invite them to name a place or a year.
- Reply in the language the visitor wrote in. Community names: use the "names" entry for that language when there is one.
- Be brief: two or three short sentences at most. No headings, no lists, no markdown.
- Call it "the album" or "the site" — never "the archive", in any language.
- Call it "the album" or "the site" — never "the archive", in any language.
- Every time you point to a page, put it in "links": the community slug from the DATA and the year (null when the whole community is meant). Up to 4 links. The site turns them into buttons; do not write URLs in the reply.
- When both a place and a year are named, answer about THAT page only: the Rosh Kollel that year (from rosh_kollel, by the from/to span), the number of shlichim (shlichim_by_year), the number of photographs (photos_by_year, 0 when absent), and one link to it. Do not list other communities.
- If the visitor names a place but no year, pick the best years to suggest (the founding year, and years that hold photographs) and say the kollel's span.
- If the visitor names a year but no place, list up to four communities that were open that year and link them with that year.
- A place that is not in the DATA is not a Torah MiTzion kollel as far as this archive knows; say so and offer the nearest region's communities.
- Photographs are still being collected; when a year holds none, say so and mention that they can send one via "Add photographs".
- Regions: na = North America, la = Latin America, eu = Europe & Asia, oc = Africa & Oceania.

DATA (JSON, one object per community; shlichim_by_year and photos_by_year are keyed by year):
${factsJson}

CONVERSATION SO FAR:
${history.map(h => `${h.role === 'user' ? 'Visitor' : 'You'}: ${h.text}`).join('\n') || '(none)'}

VISITOR'S MESSAGE:
${question}

Return JSON only: {"reply": "...", "links": [{"community": "<slug>", "year": <number|null>}]}`;
}

async function ask(p: string): Promise<Answer> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: p }] }],
        generationConfig: { temperature: 0.3, responseMimeType: 'application/json' }
      })
    });
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('gemini returned nothing');
  const out = JSON.parse(text);
  const links = Array.isArray(out.links) ? out.links.slice(0, 4).map((l: any) => ({
    community: String(l?.community ?? '').replace(/[^a-z0-9_-]/gi, '').slice(0, 64),
    year: Number.isInteger(l?.year) && l.year >= 1990 && l.year <= 2030 ? l.year : null
  })).filter((l: any) => l.community) : [];
  return { reply: String(out.reply ?? '').trim().slice(0, 800), links };
}

const BUSY: Record<string, string> = {
  en: 'I am a little overloaded right now — please ask again in a moment.',
  he: 'אני קצת עמוס כרגע — נסו שוב בעוד רגע.',
  ru: 'Я сейчас немного перегружен — спросите ещё раз через минуту.',
  fr: 'Je suis un peu surchargé en ce moment — réessayez dans un instant.',
  de: 'Ich bin gerade etwas überlastet — bitte gleich noch einmal fragen.',
  es: 'Estoy un poco saturado ahora mismo — vuelve a preguntar en un momento.'
};
const TOO_MANY: Record<string, string> = {
  en: 'That is a lot of questions for one hour. Please come back a little later.',
  he: 'זה הרבה שאלות לשעה אחת. חזרו קצת מאוחר יותר.',
  ru: 'Слишком много вопросов за час. Возвращайтесь чуть позже.',
  fr: 'Cela fait beaucoup de questions en une heure. Revenez un peu plus tard.',
  de: 'Das sind viele Fragen für eine Stunde. Bitte später noch einmal vorbeischauen.',
  es: 'Son muchas preguntas para una hora. Vuelve un poco más tarde.'
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const lang = ['en', 'he', 'ru', 'fr', 'de', 'es'].includes(body?.lang) ? body.lang : 'en';
  const question = String(body?.question ?? '').trim().slice(0, MAX_QUESTION);
  if (!question) return json({ error: 'empty' }, 400);
  const history: Turn[] = (Array.isArray(body?.history) ? body.history : [])
    .filter((h: any) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.text === 'string')
    .slice(-MAX_HISTORY)
    .map((h: any) => ({ role: h.role, text: h.text.slice(0, MAX_QUESTION) }));

  if (!GEMINI_KEY) return json({ reply: BUSY[lang], links: [] }, 503);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ipHash = await sha256(IP_SALT + ip);
  try {
    const allowed = await rpc('tmz_rate_take', {
      p_bucket: `chat:${ipHash}`, p_limit: QUESTIONS_PER_HOUR, p_window_seconds: 3600
    });
    if (allowed === false) return json({ reply: TOO_MANY[lang], links: [] }, 429);
  } catch (e) { console.error('rate', e); }

  try {
    const p = prompt(await factsText(), history, question);
    return json(await ask(p));
  } catch (e) {
    console.error('chat', e);
    return json({ reply: BUSY[lang], links: [] }, 503);
  }
});

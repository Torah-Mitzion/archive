/* WhatsApp intake.
 *
 * Meta POSTs the webhook here and signs the raw body with the app's App Secret
 * in X-Hub-Signature-256. This function verifies that signature, keeps a short
 * conversation with the sender in their own language, and pushes photographs
 * into the same moderation queue the upload page uses.
 *
 * It talks to Meta directly. There is no messaging provider in the path and no
 * per-message fee: this agent only ever REPLIES, and a reply inside the 24-hour
 * window a contributor opened is free with no monthly cap.
 *
 * The conversation is deliberately thin: a photograph is accepted immediately
 * and the questions come afterwards. Someone digging through a shoebox will
 * send five pictures in a row; making them answer four questions before the
 * first one is accepted is how you lose the other four.
 *
 * A second entry point (?sim=1, gated by SIM_TOKEN) exists so the conversation
 * can be exercised from a browser before the organisation's WhatsApp number is
 * connected. It swaps the two transport edges — where a photograph comes from,
 * where a reply goes — and NOTHING else. Screening, parsing, deduplication,
 * rate limiting and every database write are the same lines of code the real
 * webhook runs, because a simulator that reimplements the agent tests the
 * simulator.
 */

import { sanitize, UnsafeFile } from '../_shared/imagesafe.ts';
import { screen, type Verdict } from '../_shared/screen.ts';
import { say, phrase, refusalIn, configureSay } from '../_shared/say.ts';
import { buildPrompt, converse, type HistoryRow } from '../_shared/converse.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.6-flash';
/* The webhook can come straight from Meta or through a forwarding service.
   Both sign the raw body with HMAC-SHA256 and both send it as `sha256=<hex>`;
   they differ only in which header carries it and which secret signs it. Meta
   signs with the App Secret in X-Hub-Signature-256, which is the arrangement
   this deployment uses — a forwarder is a middleman charging for a hop that
   Meta already provides. WEBHOOK_HMAC_SECRET is still read so an existing
   HookMyApp channel keeps working without a redeploy. */
const WEBHOOK_SECRET = Deno.env.get('META_APP_SECRET')
  ?? Deno.env.get('WEBHOOK_HMAC_SECRET') ?? '';
/* Every provider in this market signs the raw body with HMAC-SHA256 and sends
   it as `sha256=<hex>`; they differ only in the header name and the secret.
   So the header is configuration, not code — naming a new provider is an
   environment variable, and swapping one for another costs no deploy. */
/* Heyy (heyy.io) is the organisation's own messaging provider, so the archive
   goes through the account they already pay for rather than a second vendor.
   It is NOT a Meta passthrough: it delivers its own event shape and takes its
   own send call, so it needs a translation layer. That layer is heyyChannel
   below — the handler never learns which provider it is talking to. */
const HEYY_API_TOKEN = Deno.env.get('HEYY_API_TOKEN') ?? '';
const HEYY_CHANNEL_ID = Deno.env.get('HEYY_CHANNEL_ID') ?? '';
const HEYY_API_BASE = Deno.env.get('HEYY_API_BASE') ?? 'https://api.heyy.io';
/* Heyy documents no webhook signature, so the URL carries the proof instead:
   Heyy is given .../tmz-whatsapp?heyy=<secret> and anything without it is
   refused. Weaker than an HMAC over the body — the secret travels in the URL
   and lands in their logs — so it is worth asking Heyy support whether a
   signing secret exists; if one appears, WEBHOOK_SIGNATURE_HEADER and
   META_APP_SECRET already handle it and this can go. */
const HEYY_WEBHOOK_SECRET = Deno.env.get('HEYY_WEBHOOK_SECRET') ?? '';

configureSay(GEMINI_MODEL, GEMINI_KEY);

const SIGNATURE_HEADERS = (Deno.env.get('WEBHOOK_SIGNATURE_HEADER')
  ?? 'x-hub-signature-256,x-hookmyapp-signature-256')
  .split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
const VERIFY_TOKEN = Deno.env.get('VERIFY_TOKEN') ?? '';
/* Meta's own endpoint by default. This was a forwarding service's gateway, and
   pointing it back at Meta is the whole of the change — the message shape, the
   media endpoints and the send call were always Meta's Graph API, because a
   forwarder is a pass-through. */
const GRAPH_URL = Deno.env.get('META_GRAPH_API_URL') ?? 'https://graph.facebook.com/v22.0';
const WA_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? '';
const WA_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '';
/* Unset means the test console is off. That is the right default for a
   function that writes to the real archive. */
const SIM_TOKEN = Deno.env.get('SIM_TOKEN') ?? '';

/* The three dials on automatic publishing, all readable as secrets so they can
   be turned without a deploy. AUTO_PUBLISH=off is the stop button: screening
   still runs and still records its verdict, but nothing reaches the site. */
const AUTO_PUBLISH = (Deno.env.get('AUTO_PUBLISH') ?? 'on') !== 'off';
/* MEASURED, not chosen. The first default here was 0.8, which sat inside the
   range ordinary photographs actually produce — benign pictures came back at
   0.75, 0.85 and 0.88 in testing, so the bar was refusing perfectly good
   material at the low end of normal.

   The deeper lesson is that this number is not a safety signal. The model's
   confidence expresses how sure it is about the PICTURE, not about harm: a
   beach with walruses scored 0.75 because it is unusual, not because it is
   risky. Harm is caught by safe_to_publish, the challenge pass and the score
   ceilings, all of which are about harm. This is a backstop for a model that
   is genuinely lost, so it belongs below the normal range, not inside it. */
const MIN_CONFIDENCE = Number(Deno.env.get('MIN_CONFIDENCE') ?? '0.6');
const REQUIRE_PEOPLE = (Deno.env.get('REQUIRE_PEOPLE') ?? 'on') !== 'off';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tmz-sim-token',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

// ---- database --------------------------------------------------------------

async function pg(path: string, init: RequestInit & { prefer?: string } = {}) {
  const headers: Record<string, string> = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };
  if (init.prefer) headers.Prefer = init.prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} → ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const rpc = (fn: string, args: unknown) =>
  pg(`/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });

// ---- signature -------------------------------------------------------------

/* Verify over the bytes as received. Parsing and re-serialising first is the
   classic way to break this: JSON round-trips are not byte-identical, and the
   signature is over bytes. */
async function verifySignature(raw: string, header: string | null) {
  if (!WEBHOOK_SECRET) return { ok: false, why: 'no webhook secret configured (META_APP_SECRET)' };
  if (!header) return { ok: false, why: `missing ${SIGNATURE_HEADERS.join(' / ')}` };

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  const hex = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
  const expected = `sha256=${hex}`;

  // constant-time compare
  if (expected.length !== header.length) return { ok: false, why: 'signature length mismatch' };
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0 ? { ok: true, why: '' } : { ok: false, why: 'signature mismatch' };
}

// ---- the channel -----------------------------------------------------------

/* Everything the handler needs from the outside world. The real webhook binds
   this to Meta's Graph API; the test console binds it to the request body and
   an array. The handler cannot tell the difference, which is the point. */
interface Channel {
  fetchMedia(ref: string): Promise<{ bytes: Uint8Array; mime: string }>;
  /* replyTo is the provider's id of the message to quote. Quoting is what lets
     a person with five photographs in flight see which one a question is
     about. Returns the provider's id of what was sent, so it can be quoted
     back in turn. */
  reply(to: string, text: string, replyTo?: string | null): Promise<string | null>;
  trace(step: string, detail: unknown): void;
  isTest: boolean;
  /* Test console only, and only ever set inside handleSim. Lets the publish,
     hold and reject branches be exercised without a model call — which is the
     difference between testing the pipeline and testing Gemini's quota. The
     live channel below cannot set it, so there is no path from a real WhatsApp
     message to a forced verdict. */
  forceVerdict?: 'publish' | 'hold' | 'reject';
}

async function reply(to: string, text: string, replyTo?: string | null): Promise<string | null> {
  if (!WA_TOKEN || !WA_PHONE_ID) {
    console.log(`[no channel configured] would reply to ${to}: ${text}`);
    return null;
  }
  const res = await fetch(`${GRAPH_URL}/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to, type: 'text',
      text: { body: text, preview_url: false },
      ...(replyTo ? { context: { message_id: replyTo } } : {})
    })
  });
  if (!res.ok) { console.error('reply failed', res.status, await res.text()); return null; }
  const data = await res.json().catch(() => null);
  return data?.messages?.[0]?.id ?? null;
}

/* Spreading a multi-megabyte Uint8Array into String.fromCharCode overflows the
   call stack — which is exactly the size a phone camera produces. Chunk it. */
function toBase64(bytes: Uint8Array) {
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

async function fetchMedia(mediaId: string) {
  const meta = await fetch(`${GRAPH_URL}/${mediaId}`, {
    headers: { Authorization: `Bearer ${WA_TOKEN}` }
  });
  if (!meta.ok) throw new Error(`media lookup ${meta.status}`);
  const { url, mime_type } = await meta.json();
  const bin = await fetch(url, { headers: { Authorization: `Bearer ${WA_TOKEN}` } });
  if (!bin.ok) throw new Error(`media download ${bin.status}`);
  return { bytes: new Uint8Array(await bin.arrayBuffer()), mime: mime_type as string };
}

// ---- Gemini ----------------------------------------------------------------

const SCREEN_PROMPT = `You are screening a photograph sent to the Torah MiTzion 30th anniversary
archive over WhatsApp. Torah MiTzion runs religious-Zionist kollels in Jewish
communities worldwide; photographs show community events, Torah study, shlichim,
families and everyday life across 1996-2026.

Return ONLY JSON: {"publishable":boolean,"reasons":string[],
"scores":{"sexual":number,"violence":number,"advertising":number,"unrelated":number},
"guess":{"decade":string|null,"people_count":number|null,"setting":string|null,
"event_type":string|null,"description":string}}

Set publishable FALSE only for nudity or sexual content, graphic violence, an
advertisement or promotional graphic, a screenshot, or a meme. Set it TRUE for
everything else — including scans of old prints, photocopies, faded or grainy
film, damaged pictures, pictures of documents, and anything whose connection to
Torah MiTzion you cannot tell. You filter only what must never reach a human
reviewer; you do not judge quality, medium or belonging. When uncertain, TRUE.
event_type is one of simchat_torah, shabbaton, morning_seder, yom_haatzmaut,
chanukah, purim, opening_night, melave_malka, shavuot, farewell, chavruta,
youth — or null.`;

async function gemini(parts: unknown[], jsonOut = true) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: jsonOut
          ? { temperature: 0, responseMimeType: 'application/json' }
          : { temperature: 0.4 }
      })
    }
  );
  if (!res.ok) throw new Error(`gemini ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

/* Reads whatever the sender typed and pulls out the details we need. Free text,
   any language, in whatever order they felt like — "Memphis 2003, that's my
   father on the left" has to land as community + year + a note. */
async function parseDetails(text: string, communities: { slug: string; name: string }[]) {
  const list = communities.map(c => `${c.slug}=${c.name}`).join(', ');
  const out = await gemini([{
    text: `Extract details from a WhatsApp message about an old photograph.
Known community slugs: ${list}

Message: """${text}"""

Return ONLY JSON:
{"community_slug":string|null,"year":number|null,"people":string|null,
 "event_note":string|null,"language":string,"is_answer":boolean}

community_slug must be one of the slugs above or null. year is 1996-2026 or
null. people is whoever they named. event_note is the occasion if mentioned.
language is the ISO code of the language the message is WRITTEN in — judge it
from the words themselves, not from the topic. "Bonjour" is fr, "Hallo" is de,
"Hola" is es. Only use en if the words really are English.
is_answer is false if the message is unrelated small talk.`
  }]);
  let det: any;
  try { det = JSON.parse(out); } catch { det = {}; }
  /* The script someone types in settles the question the model keeps getting
     wrong: asked about "שלום" it answers English. Hebrew and Cyrillic letters
     are not a hint, they are the answer, so they win. Latin script really is
     ambiguous between en/fr/de/es, and there the model's guess stands. */
  const script = scriptOf(text);
  if (script !== 'en' || !det.language) det.language = script;
  return det;
}

/* The sender's own row, written on the first message of any kind — which is
   what lets a greeting in Hebrew decide the language of the photograph that
   follows it, before any submission exists. */
async function remember(ref: string, patch: Record<string, unknown>) {
  try {
    await pg('/tmz_wa_contact?on_conflict=ref', {
      method: 'POST', prefer: 'resolution=merge-duplicates',
      body: JSON.stringify([{ ref, last_seen: new Date().toISOString(), ...patch }])
    });
  } catch (e) { console.error('remember', e); }
}

/* The conversation, both directions. Everything the agent reads before it
   answers comes from here, and everything it says goes here — otherwise the
   next message is answered by an agent that has forgotten this one. */
async function log(ref: string, direction: 'in' | 'out', kind: string,
                   text: string | null, photoId: string | null = null,
                   meta: Record<string, unknown> = {}, providerMsgId: string | null = null) {
  try {
    await pg('/tmz_wa_message', { method: 'POST',
      body: JSON.stringify([{ ref, direction, kind, text, photo_id: photoId, meta,
                              provider_msg_id: providerMsgId }]) });
  } catch (e) { console.error('log', e); }
}

/* The photograph a quoted message was about — whether they quoted the
   photograph itself or the question we asked about it. */
async function photoQuotedBy(ref: string, providerMsgId: string | null) {
  if (!providerMsgId) return null;
  try {
    const rows = await pg(`/tmz_wa_message?select=photo_id&ref=eq.${encodeURIComponent(ref)}` +
      `&provider_msg_id=eq.${encodeURIComponent(providerMsgId)}&photo_id=not.is.null&limit=1`);
    return rows?.[0]?.photo_id ?? null;
  } catch { return null; }
}

/* Every photograph of theirs still missing something. More than one means a
   bare answer is ambiguous. */
async function openPhotos(ref: string) {
  const rows = await pg(`/tmz_photo?select=id,community_id,year,people_text,occasion_text,agent_decision,status,public_path,ai_description,created_at` +
    `&submitter_ref=eq.${encodeURIComponent(ref)}&status=neq.rejected&order=created_at.desc&limit=10`);
  return (rows ?? []).filter((p: any) => nextMissing(p));
}

async function history(ref: string, n = 30): Promise<HistoryRow[]> {
  try {
    const rows = await pg(`/tmz_wa_message?select=direction,kind,text,meta,created_at` +
      `&ref=eq.${encodeURIComponent(ref)}&order=created_at.desc&limit=${n}`);
    return (rows ?? []).reverse();
  } catch { return []; }
}

async function recallLang(ref: string) {
  try {
    const rows = await pg(`/tmz_wa_contact?select=lang&ref=eq.${encodeURIComponent(ref)}`);
    return rows?.[0]?.lang ?? 'en';
  } catch { return 'en'; }
}

/* The script someone writes in settles their language when the script is
   distinctive. Latin script is not — Portuguese, Italian, Dutch and English
   look alike to a regex — and there the model's reading of the words decides.
   'en' here means "Latin script, ask the model", not "English". */
function scriptOf(text: string) {
  if (/[\u0590-\u05FF]/.test(text)) return 'he';
  if (/[\u0400-\u04FF]/.test(text)) return 'ru';
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  if (/[\u0370-\u03FF]/.test(text)) return 'el';
  if (/[\u3040-\u30FF]/.test(text)) return 'ja';
  if (/[\uAC00-\uD7AF]/.test(text)) return 'ko';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';
  if (/[\u0E00-\u0E7F]/.test(text)) return 'th';
  return 'en';
}

/* Everything the agent says lives in _shared/say.ts, six languages, one
   place. */

// ---- handler ---------------------------------------------------------------

/* The real channel: photographs come from Meta, replies go to Meta. */
const liveChannel: Channel = {
  fetchMedia,
  reply,
  trace: (step, detail) => console.log(step, JSON.stringify(detail)),
  isTest: false
  // forceVerdict is deliberately absent here and cannot be reached from a webhook.
};

/* Heyy's channel. Two edges differ from Meta and nothing else does: a
   photograph arrives as an attachment URL rather than a media id, and a reply
   is a POST to their send endpoint rather than to the Graph API. */
const heyyChannel: Channel = {
  async fetchMedia(ref: string) {
    /* metaEnvelopeFromHeyy puts the attachment's download URL where Meta would
       put a media id, so "fetching media" here is just following it.

       Tried two ways, because the first deployment turned away every real
       photograph the client sent and counted each against them: a pre-signed
       download URL can refuse a request that carries an Authorization header it
       did not ask for, and a URL on Heyy's own API can refuse one that does
       not. Whichever answers with an image wins; anything else is reported as
       what it was, not as a bad photograph. */
    const attempts: RequestInit[] = HEYY_API_TOKEN
      ? [{ headers: { Authorization: `Bearer ${HEYY_API_TOKEN}` } }, {}]
      : [{}];
    let last = '';
    for (const init of attempts) {
      const res = await fetch(ref, init);
      const type = res.headers.get('content-type') ?? '';
      if (res.ok && !type.startsWith('text/') && !type.includes('json') && !type.includes('html')) {
        return { bytes: new Uint8Array(await res.arrayBuffer()), mime: type || 'image/jpeg' };
      }
      last = `${res.status} ${type}`.trim();
    }
    throw new Error(`heyy media: ${last}`);
  },
  async reply(to: string, text: string, replyTo?: string | null) {
    if (!HEYY_API_TOKEN || !HEYY_CHANNEL_ID) {
      console.log(`[heyy not configured] would reply to ${to}: ${text}`);
      return null;
    }
    /* v3 rather than v2: only v3 can quote (replyToMessageId), and quoting is
       the whole point of tracking message ids. The handler carries digits
       only, the way Meta addresses people; Heyy wants it dialable. */
    const res = await fetch(`${HEYY_API_BASE}/v3/messages/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${HEYY_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat: { channelId: HEYY_CHANNEL_ID, phoneNumber: to.startsWith('+') ? to : `+${to}` },
        body: text.slice(0, 4096),
        ...(replyTo ? { replyToMessageId: replyTo } : {})
      })
    });
    if (!res.ok) { console.error('heyy reply failed', res.status, (await res.text()).slice(0, 300)); return null; }
    const data = await res.json().catch(() => null);
    return data?.data?.id ?? data?.id ?? null;
  },
  trace: (step, detail) => console.log('[heyy]', step, JSON.stringify(detail)),
  isTest: false
};

/* Heyy's event, rewritten as the envelope Meta sends — so one handler serves
   both providers and neither one gets a private code path to rot in. */
function metaEnvelopeFromHeyy(body: any) {
  const d = body?.data;
  if (body?.event !== 'message.received' || d?.sender !== 'inbound') return null;

  const from = String(d?.handle?.value ?? '').replace(/[^0-9]/g, '');
  if (!from) return null;

  /* Only the first image. Someone sending four photographs sends four events,
     which is what the archive wants anyway — one row each. */
  const file = (d?.content?.attachments ?? [])
    .map((a: any) => a?.file)
    .find((f: any) => f?.url && /image/i.test(String(f?.contentType ?? '') + ' ' + String(f?.type ?? '')));

  const msg: any = { from, id: d?.id ?? crypto.randomUUID() };
  /* Meta puts the quoted message under context.id; Heyy under replyTo.id. */
  if (d?.replyTo?.id) msg.context = { id: d.replyTo.id };
  if (file) {
    msg.type = 'image';
    // the download URL stands in for Meta's media id; heyyChannel follows it
    msg.image = { id: file.url, caption: d?.content?.body || undefined };
  } else {
    msg.type = 'text';
    msg.text = { body: d?.content?.body ?? '' };
  }

  return {
    entry: [{ changes: [{ value: {
      contacts: [{ profile: { name: d?.contact?.name ?? null }, wa_id: from }],
      messages: [msg]
    } }] }]
  };
}

/* The test console's channel. The photograph arrives inline in the request and
   replies are collected rather than sent, so the browser can render the
   conversation. Nothing else about the handler changes. */
function simChannel(inline: { bytes: Uint8Array; mime: string } | null,
                    forceVerdict?: 'publish' | 'hold' | 'reject') {
  const replies: string[] = [];
  const trace: { step: string; detail: unknown }[] = [];
  const ch: Channel = {
    async fetchMedia() {
      if (!inline) throw new Error('no image in the simulated message');
      return inline;
    },
    async reply(_to, text, replyTo) {
      replies.push(replyTo ? `↩︎[${String(replyTo).slice(0, 8)}] ${text}` : text);
      return `sim-out-${crypto.randomUUID().slice(0, 8)}`;
    },
    trace: (step, detail) => { trace.push({ step, detail }); console.log('[sim]', step); },
    isTest: true,
    forceVerdict
  };
  return { ch, replies, trace };
}

function b64ToBytes(b64: string) {
  const clean = b64.includes(',') ? b64.slice(b64.indexOf(',') + 1) : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' }
  });

/* Wraps a simulated message in the exact envelope Meta sends, so the handler
   reads it through the same accessors as a real one. If Meta's shape changes,
   the console breaks too — which is correct: it is supposed to be a mirror. */
function metaEnvelope(m: any) {
  const msg: any = { from: m.from, id: m.id ?? `sim.${crypto.randomUUID().slice(0, 8)}`, type: m.type };
  if (m.reply_to) msg.context = { id: m.reply_to };
  if (m.type === 'image') msg.image = { id: 'sim', caption: m.caption ?? undefined };
  else msg.text = { body: m.text ?? '' };
  return {
    entry: [{ changes: [{ value: {
      contacts: [{ profile: { name: m.name ?? 'Test sender' }, wa_id: m.from }],
      messages: [msg]
    } }] }]
  };
}

async function handleHeyy(req: Request, url: URL) {
  if (!HEYY_WEBHOOK_SECRET) return new Response('heyy webhook not configured', { status: 503 });
  const given = url.searchParams.get('heyy') ?? '';
  if (given.length !== HEYY_WEBHOOK_SECRET.length) return new Response('forbidden', { status: 403 });
  let diff = 0;
  for (let i = 0; i < HEYY_WEBHOOK_SECRET.length; i++) {
    diff |= given.charCodeAt(i) ^ HEYY_WEBHOOK_SECRET.charCodeAt(i);
  }
  if (diff !== 0) return new Response('forbidden', { status: 403 });

  const body = await req.json().catch(() => null);
  const envelope = body ? metaEnvelopeFromHeyy(body) : null;

  /* Heyy also sends message.sent and message.updated, and retries anything that
     is not 2XX. Acknowledging what we deliberately ignore stops it retrying
     forever and eventually disabling the webhook. */
  if (!envelope) return new Response('ignored', { status: 200 });

  /* 200 first, work after: Heyy retries on anything else, and a slow screening
     call would have it sending the same photograph again. */
  queueMicrotask(() => handleAndDrain(envelope, heyyChannel).catch(e => console.error('heyy', e)));
  return new Response('ok', { status: 200 });
}

async function handleSim(req: Request, url: URL) {
  if (!SIM_TOKEN) return json({ error: 'The test console is not enabled (SIM_TOKEN is unset).' }, 503);
  const given = req.headers.get('x-tmz-sim-token') ?? '';
  /* Constant-time-ish: the token is not a signature, but there is no reason to
     leak its length either. */
  if (given.length !== SIM_TOKEN.length) return json({ error: 'bad token' }, 401);
  let diff = 0;
  for (let i = 0; i < SIM_TOKEN.length; i++) diff |= given.charCodeAt(i) ^ SIM_TOKEN.charCodeAt(i);
  if (diff !== 0) return json({ error: 'bad token' }, 401);

  const body = await req.json().catch(() => null) as any;
  if (!body?.from) return json({ error: 'from is required' }, 400);

  if (url.searchParams.get('sim') === 'reset') {
    const ref = `wa:${body.from}`;
    /* Files first. SQL cannot delete from storage.objects — Supabase refuses
       it outright — so a reset that only removed rows left every test
       photograph still serving from its public URL, which is precisely the
       bug this console was built to catch. */
    const doomed = await pg(
      `/tmz_photo?select=storage_path,derived_path,public_path` +
      `&submitter_ref=like.${encodeURIComponent(ref + '%')}`) ?? [];
    let files = 0;
    for (const p of doomed) {
      for (const [bucket, key] of [
        ['tmz-photo-originals', p.storage_path],
        ['tmz-photo-originals', p.derived_path],
        ['tmz-photo-public', p.public_path]
      ] as [string, string | null][]) {
        if (!key) continue;
        const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${key}`, {
          method: 'DELETE',
          headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
        });
        if (r.ok) files++;
      }
    }
    const [row] = await rpc('tmz_sim_reset', { p_ref: ref });
    return json({ reset: { ...(row ?? { photos: 0, submissions: 0 }), files } });
  }

  const inline = body.type === 'image' && body.image?.data
    ? { bytes: b64ToBytes(body.image.data), mime: body.image.mime ?? 'image/jpeg' }
    : null;
  if (body.type === 'image' && !inline) return json({ error: 'image.data is required' }, 400);

  const force = ['publish', 'hold', 'reject'].includes(body.force_verdict)
    ? body.force_verdict as 'publish' | 'hold' | 'reject' : undefined;
  const { ch, replies, trace } = simChannel(inline, force);
  try {
    /* Awaited, not queued: the console needs the answer in the response. The
       real webhook must still return 200 immediately or Meta retries. */
    await handleAndDrain(metaEnvelope(body), ch);
  } catch (e) {
    return json({ replies, trace, error: String(e) }, 200);
  }
  return json({ replies, trace });
}

Deno.serve(async req => {
  const url = new URL(req.url);

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (url.searchParams.has('sim') && req.method === 'POST') return handleSim(req, url);
  if (url.searchParams.has('heyy') && req.method === 'POST') return handleHeyy(req, url);

  // Meta's verification handshake
  if (req.method === 'GET') {
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (VERIFY_TOKEN && token === VERIFY_TOKEN && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response('forbidden', { status: 403 });
  }
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });

  const raw = await req.text();
  const signature = SIGNATURE_HEADERS
    .map(h => req.headers.get(h)).find(Boolean) ?? null;
  const check = await verifySignature(raw, signature);
  if (!check.ok) {
    console.error('rejected webhook:', check.why);
    return new Response('bad signature', { status: 401 });
  }

  // Always 200 quickly; Meta retries anything else, and a retry storm on a
  // slow Gemini call would duplicate photographs.
  const body = JSON.parse(raw);
  queueMicrotask(() => handleAndDrain(body, liveChannel).catch(e => console.error('handler', e)));
  return new Response('ok', { status: 200 });
});

/* Anything the screener could not answer for earlier gets another chance now.
   No scheduler and no second service: every message that arrives is a chance
   to drain the backlog, and a backlog only matters when messages are arriving.

   It sits OUT HERE rather than at the end of the photograph branch because
   handle() returns early in half a dozen places — a duplicate, a rate limit, a
   plain "hello" — and the drain should not depend on which. Getting that wrong
   is exactly why the first version never ran: the commonest follow-up message
   is a text, and the text branch was the one place it was missing. */
async function handleAndDrain(body: any, ch: Channel) {
  try {
    await handle(body, ch);
  } finally {
    if (!ch.forceVerdict) {
      try { await drainBacklog(ch); } catch (e) { console.error('drain', e); }
    }
  }
}

async function handle(body: any, ch: Channel) {
  const value = body?.entry?.[0]?.changes?.[0]?.value;
  const msg = value?.messages?.[0];
  if (!msg) return;

  const from = msg.from as string;
  const waId = `wa:${from}`;
  ch.trace('received', { type: msg.type, from });

  const contact = await contactOf(waId);
  if (contact?.blocked_until && new Date(contact.blocked_until) > new Date()) {
    ch.trace('blocked', { until: contact.blocked_until, strikes: contact.strikes });
    return;
  }
  const displayName = value?.contacts?.[0]?.profile?.name ?? null;

  // ======================================================================
  // TEXT — an answer to the open question, a greeting, or small talk
  // ======================================================================
  if (msg.type === 'text') {
    const text = (msg.text?.body ?? '').trim();
    let lang = scriptOf(text) !== 'en' ? scriptOf(text) : (contact?.lang ?? 'en');

    /* The first thing anyone ever hears is the welcome: what this is, why it
       matters, what to do. Everything after that assumes they know.

       In their language. Latin script alone cannot say whether "Olá" is
       Portuguese or "Ciao" Italian, and the welcome used to go out in English
       to both — and then the contact remembered "en", so every bare answer
       after it came back in English too. One model call here, before the
       welcome, settles it for the whole conversation. */
    if (!contact) {
      let first = lang;
      if (scriptOf(text) === 'en' && /[a-z]{2,}/i.test(text) && GEMINI_KEY) {
        try { const d = await parseDetails(text, await communityList()); if (d?.language) first = d.language; }
        catch { /* English it is */ }
      }
      lang = first;
      await remember(waId, { lang, is_test: ch.isTest, display_name: displayName });
      ch.trace('welcome', { lang });
      await log(waId, 'in', 'text', text);
      const w = await phrase(lang, x => x.welcome);
      await log(waId, 'out', 'welcome', w);
      await ch.reply(from, w);
      return;
    }

    await log(waId, 'in', 'text', text, null, {}, msg.id ?? null);

    const comms = await communityList();
    const local = parseLocally(text, comms);

    /* Which photograph is this about? In order of certainty:
         1. They quoted a message — the photograph that message was about.
         2. Exactly one of their photographs is still missing something.
         3. Several are — then the model is shown all of them, with what each
            shows, and either picks one from the wording or asks which.
       And whatever was last refused, so "why?" has a referent. */
    const candidates = await openPhotos(waId);
    const quotedPhotoId = await photoQuotedBy(waId, msg.context?.id ?? null);
    let openLive: any = null;
    if (quotedPhotoId) {
      openLive = candidates.find((p: any) => p.id === quotedPhotoId)
        ?? (await pg(`/tmz_photo?select=id,community_id,year,people_text,occasion_text,agent_decision,status,public_path,ai_description&id=eq.${quotedPhotoId}`))?.[0]
        ?? null;
      if (openLive?.status === 'rejected') openLive = null;
      ch.trace('quoted', { photo_id: quotedPhotoId, resolved: Boolean(openLive) });
    } else if (candidates.length === 1) {
      openLive = candidates[0];
    } else if (candidates.length > 1 && contact.asking_for) {
      /* Several open; the one we most recently asked about is the default the
         model may override. */
      openLive = candidates.find((p: any) => p.id === contact.asking_for) ?? null;
    }
    const ambiguous = !quotedPhotoId && candidates.length > 1;
    const past = await history(waId);
    const lastRefusal = [...past].reverse().find(h => h.kind === 'refusal');

    /* One model call: it reads the conversation, extracts the data, writes the
       reply. If it cannot be reached the fixed sentences take over, so a quota
       error costs the conversation its charm and not its function. */
    let out: Awaited<ReturnType<typeof converse>> | null = null;
    if (GEMINI_KEY) {
      try {
        const nameOf = (id: string | null) => id ? (comms.find(c => c.id === id)?.name ?? null) : null;
        out = await converse(GEMINI_MODEL, GEMINI_KEY, buildPrompt({
          lang, history: past,
          open: openLive ? { id: openLive.id, community: nameOf(openLive.community_id), year: openLive.year,
                             people_text: openLive.people_text, occasion_text: openLive.occasion_text,
                             status: openLive.status, description: openLive.ai_description ?? null } : null,
          candidates: ambiguous ? candidates.map((p: any, i: number) => ({
            index: i + 1, description: p.ai_description ?? 'no description',
            community: nameOf(p.community_id), year: p.year,
            missing: nextMissing(p) })) : [],
          communities: comms,
          lastRefusal: lastRefusal ? { reason: String(lastRefusal.meta?.reason ?? ''), at: lastRefusal.created_at } : null,
          photosSent: contact.photos_sent ?? 0,
          message: text
        }));
        ch.trace('conversed', { intent: out.intent, community: out.community_slug, year: out.year,
                                people: out.people, occasion: out.occasion, target: out.target_photo });
        /* When several photographs are open and the model could tell which one
           the answer meant, that one is the target. When it could not, the
           reply it wrote asks — and nothing is written to any of them. */
        if (ambiguous) {
          openLive = out.target_photo ? (candidates[out.target_photo - 1] ?? null) : null;
          ch.trace(openLive ? 'disambiguated' : 'asking which photograph', { target: out.target_photo });
        }
      } catch (e) { ch.trace('converse failed', { error: String(e).slice(0, 160) }); }
    }

    /* Plain matching wins where it found something: it read the actual words
       and cannot hallucinate a community that was never named. */
    const det = {
      community_slug: local.community_slug ?? out?.community_slug ?? null,
      year: local.year ?? out?.year ?? null,
      people: out?.people ?? null,
      event_note: out?.occasion ?? null
    };
    const hasLatinWords = /[a-z]{2,}/i.test(text);
    const spoken = hasLatinWords && out?.language && scriptOf(text) === 'en' ? out.language : lang;

    let communityId: string | null = null;
    if (det.community_slug) {
      const c = await pg(`/tmz_community?select=id&slug=eq.${encodeURIComponent(det.community_slug)}`);
      communityId = c?.[0]?.id ?? null;
    }
    await remember(waId, {
      lang: spoken, is_test: ch.isTest,
      ...(communityId ? { community_id: communityId } : {}),
      ...(det.year ? { year: det.year } : {})
    });

    if (openLive) {
      /* A value the message STATES overwrites what is there. The first version
         only filled empty fields, so "sorry, I was confused, it was Melbourne"
         acknowledged the correction in words and kept Montevideo in the row.
         People correct themselves; the model only extracts a value when the
         message actually gives one, so overwriting is safe. The
         whole-message fallback for who/what still applies only when empty —
         that one is a guess, and a guess must not replace an answer. */
      /* `asking` is per sender, not per photograph. When a quote routed this
         answer to a DIFFERENT photograph than the one last asked about, the
         "whole message is the answer" fallback must not fire — "Cape Town
         2011" quoted at photograph B is not who is in it, whatever was last
         asked about photograph A. */
      const askingThis = contact.asking_for === openLive.id;
      const patch: Record<string, unknown> = {};
      if (communityId && communityId !== openLive.community_id) patch.community_id = communityId;
      if (det.year && det.year !== openLive.year) patch.year = det.year;
      if (det.people && det.people !== openLive.people_text) patch.people_text = det.people;
      else if (askingThis && contact.asking === 'people' && !openLive.people_text) patch.people_text = text;
      if (det.event_note && det.event_note !== openLive.occasion_text) patch.occasion_text = det.event_note;
      else if (askingThis && contact.asking === 'occasion' && !openLive.occasion_text) patch.occasion_text = text;

      if (Object.keys(patch).length) {
        await pg(`/tmz_photo?id=eq.${openLive.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
        ch.trace('attached', { photo_id: openLive.id, patch });
      }
      const merged = { ...openLive, ...patch };

      /* The state machine still decides what is missing and whether the
         photograph publishes; the model only chose the words. */
      const missing = nextMissing(merged);
      if (missing) {
        await remember(waId, { asking: missing, asking_for: merged.id });
      } else {
        await remember(waId, { asking: null, asking_for: null });
        const live = await publishIfReady(merged.id, ch);
        ch.trace(live ? 'published' : 'complete, held', { photo_id: merged.id });
      }

      /* Quote the photograph this is about, so the question visibly hangs off
         the right picture even with five in flight. */
      const quote = await providerIdOfPhoto(waId, merged.id);
      if (out) {
        const sentId = await ch.reply(from, out.reply, quote);
        await log(waId, 'out', missing ? 'question' : 'text', out.reply, merged.id, missing ? { field: missing } : {}, sentId);
      } else {
        await continueConversation(waId, from, merged, spoken, ch, Object.keys(patch).length === 0, '', quote);
      }
      return;
    }

    /* Nothing waiting. The model answers in context — a "why?" after a refusal
       gets the reason; a hello gets a hello. Without the model, a nudge. */
    if (out) {
      const sentId = await ch.reply(from, out.reply, ambiguous ? null : null);
      await log(waId, 'out', ambiguous ? 'question' : 'text', out.reply, null,
                ambiguous ? { field: 'which' } : {}, sentId);
      return;
    }
    const greeting = /^(hi|hello|hey|shalom|שלום|היי|הי|привет|здравствуйте|bonjour|salut|hallo|hola)\b/i.test(text)
      || text.length < 4;
    ch.trace('nothing waiting', { greeting });
    const fallback = await phrase(spoken, x => greeting ? x.hello : x.nophoto);
    await log(waId, 'out', 'text', fallback);
    await ch.reply(from, fallback);
    return;
  }

  if (msg.type !== 'image') {
    await ch.reply(from, await phrase(contact?.lang ?? 'en', x => x.nophoto));
    return;
  }

  // ======================================================================
  // PHOTOGRAPH
  // ======================================================================
  const allowed = await rpc('tmz_rate_take', {
    p_bucket: `wa:${from}`, p_limit: 40, p_window_seconds: 3600
  });
  if (allowed === false) { ch.trace('rate limited', { bucket: `wa:${from}` }); return; }

  const caption = (msg.image?.caption ?? '').trim();
  let lang = caption && scriptOf(caption) !== 'en' ? scriptOf(caption) : (contact?.lang ?? 'en');
  /* A Latin-script caption from someone whose language we do not yet know:
     let the model read it rather than assume English. */
  if (caption && scriptOf(caption) === 'en' && /[a-z]{2,}/i.test(caption) && !contact?.lang && GEMINI_KEY) {
    try { const d = await parseDetails(caption, await communityList()); if (d?.language) lang = d.language; }
    catch { /* keep the default */ }
  }
  const firstEver = !contact;
  await remember(waId, { lang, is_test: ch.isTest, display_name: displayName });

  /* Fetching is OUR step, not theirs. If it fails, the sender did nothing
     wrong, hears that plainly, and is not marked for it. */
  let bytes: Uint8Array, mime: string;
  try {
    ({ bytes, mime } = await ch.fetchMedia(msg.image.id));
    ch.trace('fetched', { bytes: bytes.length, declared_mime: mime });
  } catch (e) {
    const error = String(e).slice(0, 500);
    ch.trace('fetch failed', { error });
    await log(waId, 'in', 'photo', caption || null);
    const ff = await phrase(lang, x => x.fetchfail);
    await log(waId, 'out', 'refusal', ff, null, { reason: 'could not download it (our fault)' });
    /* Written where it can be read, because the log line this used to be was
       not readable with the deploy token, and a failure nobody can see becomes
       a theory. */
    await remember(waId, { last_error: `fetch: ${error} | ref=${String(msg.image.id).slice(0, 200)}`,
                           last_error_at: new Date().toISOString() });
    await ch.reply(from, ff);
    return;
  }

  let clean;
  try {
    clean = await sanitize(bytes);
    ch.trace('sanitised', {
      kind: clean.kind, out: `${clean.width}x${clean.height}`, resized: clean.resized,
      phash: clean.phash, archive_bytes: clean.archiveBytes.length, public_bytes: clean.publicBytes.length
    });
  } catch (e) {
    const why = e instanceof UnsafeFile ? e.message : String(e);
    const tooBig = e instanceof UnsafeFile && e.tooBig;
    ch.trace('refused at the door', { why, tooBig });
    await remember(waId, { last_error: `sanitize: ${why} | mime=${mime} bytes=${bytes.length}`,
                           last_error_at: new Date().toISOString() });
    /* A large or unreadable file is a mishap, not an attempt. No strike. */
    const said = await refusalIn(lang, [why]);
    await log(waId, 'in', 'photo', caption || null);
    await log(waId, 'out', 'refusal', said, null, { reason: why });
    await ch.reply(from, said);
    return;
  }

  const dupe = await rpc('tmz_find_duplicate', { p_hash: clean.phash, p_max_distance: 4 }).catch(() => null);
  if (Array.isArray(dupe) ? dupe.length > 0 : Boolean(dupe)) {
    ch.trace('duplicate', { of: dupe });
    await log(waId, 'in', 'photo', caption || null);
    const d = await phrase(lang, x => x.dupe);
    await log(waId, 'out', 'text', d, null, { reason: 'duplicate' });
    await ch.reply(from, d);
    return;
  }

  // ---- screening ----
  let verdict: Verdict;
  if (ch.forceVerdict) {
    verdict = {
      decision: ch.forceVerdict, confidence: 1, facts: {}, scores: {},
      passes: [{ pass: 'assess', raw: null }, { pass: 'challenge', raw: null }],
      reasons: ['VERDICT FORCED BY THE TEST CONSOLE — no model looked at this picture']
    };
    ch.trace('screening SKIPPED (forced)', { decision: ch.forceVerdict });
  } else if (!GEMINI_KEY) {
    verdict = holdBecause('no screening key configured');
  } else {
    try {
      verdict = await screen(toBase64(clean.archiveBytes), 'image/jpeg', {
        model: GEMINI_MODEL, key: GEMINI_KEY, minConfidence: MIN_CONFIDENCE, requirePeople: REQUIRE_PEOPLE
      });
    } catch (e) {
      ch.trace('screening unavailable', { error: String(e).slice(0, 300) });
      verdict = holdBecause(`screening unavailable: ${String(e).slice(0, 200)}`);
    }
  }
  if (!AUTO_PUBLISH && verdict.decision === 'publish') {
    verdict = { ...verdict, decision: 'hold', reasons: ['auto-publish is switched off', ...verdict.reasons] };
  }
  ch.trace('screened', {
    decision: verdict.decision, confidence: verdict.confidence,
    reasons: verdict.reasons, scores: verdict.scores, facts: verdict.facts
  });

  // ---- record ----
  const [submission] = await pg('/tmz_submission', {
    method: 'POST', prefer: 'return=representation',
    body: JSON.stringify([{
      contributor_name: displayName, contributor_note: caption || null,
      source: 'whatsapp', ip_hash: waId, consented: true, is_test: ch.isTest, lang
    }])
  });
  const key = `${new Date().getFullYear()}/wa-${submission.id}.jpg`;
  const derivedKey = `derived/${key}`;
  await putObject('tmz-photo-originals', key, clean.archiveBytes);
  await putObject('tmz-photo-originals', derivedKey, clean.publicBytes);

  const placed = await placeFrom(caption, contact, ch);

  /* A caption that names people or an occasion is already an answer. */
  let captionPeople: string | null = null, captionOccasion: string | null = null;
  if (caption && GEMINI_KEY) {
    try {
      const d = await parseDetails(caption, await communityList());
      captionPeople = d.people || null; captionOccasion = d.event_note || null;
    } catch { /* the questions will ask */ }
  }

  const [photo] = await pg('/tmz_photo', {
    method: 'POST', prefer: 'return=representation',
    body: JSON.stringify([{
      storage_path: key, derived_path: derivedKey,
      width: clean.width, height: clean.height, bytes: clean.archiveBytes.length, phash: clean.phash,
      community_id: placed.community_id, year: placed.year,
      people_text: captionPeople, occasion_text: captionOccasion,
      ai_description: verdict.facts.description ? String(verdict.facts.description).slice(0, 300) : null,
      event_type_id: verdict.facts.event_type || null, venue: verdict.facts.setting || null,
      status: verdict.decision === 'reject' ? 'rejected' : 'pending',
      agent_decision: verdict.decision, needs_rescreen: verdict.decision === 'hold',
      source: 'whatsapp', submission_id: submission.id, submitter_ref: waId
    }])
  });

  await pg('/tmz_moderation', {
    method: 'POST',
    body: JSON.stringify([
      ...verdict.passes.map(p => ({
        photo_id: photo.id, model: GEMINI_MODEL, pass: p.pass,
        verdict: verdict.decision === 'reject' ? 'rejected' : 'pending', decision: null,
        scores: verdict.scores ?? {}, reasons: verdict.reasons ?? []
      })),
      {
        photo_id: photo.id, model: ch.forceVerdict ? 'forced (test console)' : GEMINI_MODEL, pass: 'final',
        verdict: verdict.decision === 'reject' ? 'rejected' : 'pending', decision: verdict.decision,
        scores: verdict.scores ?? {}, reasons: verdict.reasons ?? []
      }
    ])
  });

  if (verdict.decision === 'reject') {
    ch.trace('rejected', { photo_id: photo.id, reasons: verdict.reasons });
    /* Harm is a strike. Scope ("nobody in it") and uncertainty are not — the
       sender did nothing wrong and should not be silenced for it. */
    const text = verdict.reasons.join(' ').toLowerCase();
    const harm = /sexual|violence|injur|advert|promot|screenshot|meme|document|private/.test(text)
      || verdict.reasons.some(r => /scored \d+/.test(r));
    if (harm) await strike(waId, ch.isTest);
    const said = await refusalIn(lang, verdict.reasons, verdict.scores as Record<string, number>);
    await log(waId, 'in', 'photo', caption || null, photo.id, {}, msg.id ?? null);
    /* The reason is stored in plain words alongside, so "why?" in five minutes
       can be answered with it. The refusal quotes the photograph it refuses. */
    const sentId = await ch.reply(from, said, msg.id ?? null);
    await log(waId, 'out', 'refusal', said, photo.id, { reason: verdict.reasons.join('; ').slice(0, 300) }, sentId);
    return;
  }

  await remember(waId, { photos_sent: (contact?.photos_sent ?? 0) + 1, last_error: null });
  await log(waId, 'in', 'photo', caption || null, photo.id, {}, msg.id ?? null);
  /* A brand-new contact who sends a photograph with no words has given no
     language signal at all. Hebrew and English together cover most of this
     archive's world; the moment they type anything, their language takes over. */
  const noSignal = firstEver && !caption;
  const prefix = firstEver
    ? (noSignal
        ? say('he').welcome + '\n\n' + say('en').welcome + '\n\n'
        : await phrase(lang, x => x.welcome) + '\n\n')
    : '';
  const got = await phrase(lang, x => x.got);
  await continueConversation(waId, from, photo, lang, ch, false, prefix + got + ' ', msg.id ?? null);
}

/* ---- the conversation ----------------------------------------------------- */

const ASK_ORDER: Array<'community' | 'year' | 'people' | 'occasion'> =
  ['community', 'year', 'people', 'occasion'];

/* Asks for the next thing the photograph is missing, or — when nothing is —
   publishes it and says so. One question per message: a person who has just
   found a shoebox will answer one thing gladly and four things not at all. */
async function continueConversation(
  waId: string, from: string, photo: any, lang: string, ch: Channel,
  answerWasEmpty: boolean, lead = '', quote: string | null = null
) {
  const missing = ASK_ORDER.find(k => {
    if (k === 'community') return !photo.community_id;
    if (k === 'year') return !photo.year;
    if (k === 'people') return !photo.people_text;
    return !photo.occasion_text;
  });

  if (missing) {
    await remember(waId, { asking: missing, asking_for: photo.id });
    const head = answerWasEmpty
      ? await phrase(lang, x => x.unclear)
      : (lead || (photo.people_text || photo.year ? await phrase(lang, x => x.noted) : ''));
    const q = await phrase(lang, x => x.ask[missing]);
    ch.trace('asking', { photo_id: photo.id, for: missing, quoting: Boolean(quote) });
    const sentId = await ch.reply(from, head + q, quote);
    await log(waId, 'out', 'question', head + q, photo.id, { field: missing }, sentId);
    return;
  }

  await remember(waId, { asking: null, asking_for: null });
  const live = await publishIfReady(photo.id, ch);
  ch.trace(live ? 'published' : 'complete, held', { photo_id: photo.id, decision: photo.agent_decision });
  const said = lead + await phrase(lang, x => (live ? x.complete : x.completeHeld) + x.more);
  const sentId = await ch.reply(from, said, quote);
  await log(waId, 'out', 'text', said, photo.id, {}, sentId);
}

/* The provider id of the message in which this photograph arrived — what a
   question about it should quote. */
async function providerIdOfPhoto(ref: string, photoId: string): Promise<string | null> {
  try {
    const rows = await pg(`/tmz_wa_message?select=provider_msg_id&ref=eq.${encodeURIComponent(ref)}` +
      `&photo_id=eq.${photoId}&direction=eq.in&kind=eq.photo&provider_msg_id=not.is.null&limit=1`);
    return rows?.[0]?.provider_msg_id ?? null;
  } catch { return null; }
}

function nextMissing(photo: any): 'community' | 'year' | 'people' | 'occasion' | null {
  return ASK_ORDER.find(k =>
    k === 'community' ? !photo.community_id : k === 'year' ? !photo.year :
    k === 'people' ? !photo.people_text : !photo.occasion_text) ?? null;
}

/* ---- placement ----------------------------------------------------------- */

async function placeFrom(caption: string, contact: any, ch: Channel) {
  let community_id = contact?.community_id ?? null;
  let year = contact?.year ?? null;
  if (!caption) return { community_id, year };

  const comms = await communityList();
  const slugToId = async (slug: string) => {
    const c = await pg(`/tmz_community?select=id&slug=eq.${encodeURIComponent(slug)}`);
    return c?.[0]?.id ?? null;
  };

  const local = parseLocally(caption, comms);
  if (local.year) year = local.year;
  if (local.community_slug) community_id = (await slugToId(local.community_slug)) ?? community_id;
  ch.trace('caption read locally', local);

  /* The model is only asked about what plain matching could not settle, which
     keeps a photograph placeable when the quota is gone. */
  if (GEMINI_KEY && (!year || !community_id)) {
    try {
      const det = await parseDetails(caption, comms);
      ch.trace('caption', det);
      if (!year && det.year) year = det.year;
      if (!community_id && det.community_slug) {
        community_id = (await slugToId(det.community_slug)) ?? community_id;
      }
    } catch (e) { ch.trace('caption parse failed', { error: String(e).slice(0, 200) }); }
  }
  return { community_id, year };
}

async function communityList() {
  const comms = await pg('/tmz_community?select=id,slug,tmz_community_tr(lang,name)&limit=200');
  return (comms ?? []).map((c: any) => ({
    id: c.id,
    slug: c.slug,
    name: (c.tmz_community_tr?.find((t: any) => t.lang === 'en') ?? c.tmz_community_tr?.[0])?.name ?? c.slug,
    /* Every rendering we hold. A caption reading "ממפיס 2003" places itself
       without a model call precisely because the translations exist. */
    names: (c.tmz_community_tr ?? []).map((t: any) => t.name).filter(Boolean)
  }));
}

/* The common caption is "Memphis, 2003" and it does not need a language model
   to read. This runs first, costs nothing, and works when the model is
   unavailable — which is exactly when a photograph would otherwise sit
   unplaced and unpublished forever. */
function parseLocally(text: string, comms: { slug: string; names?: string[]; name: string }[]) {
  const out: { community_slug: string | null; year: number | null } =
    { community_slug: null, year: null };
  if (!text) return out;

  const years = [...text.matchAll(/\b(19[9]\d|20[0-4]\d)\b/g)].map(m => Number(m[1]))
    .filter(y => y >= 1990 && y <= 2030);
  if (years.length === 1) out.year = years[0];
  /* A range like "2003-2004" is the school year the archive already thinks in;
     take the first, which is how every tenure in the database is keyed. */
  else if (years.length > 1 && years[1] - years[0] === 1) out.year = years[0];

  const hay = text.toLowerCase();
  let best: { slug: string; len: number } | null = null;
  for (const c of comms) {
    for (const n of [...(c.names ?? []), c.name, c.slug]) {
      const needle = String(n).toLowerCase().trim();
      /* Longest match wins, so "Kansas City" is not shadowed by a shorter name
         that happens to be a substring of the same caption. */
      if (needle.length >= 4 && hay.includes(needle) && (!best || needle.length > best.len)) {
        best = { slug: c.slug, len: needle.length };
      }
    }
  }
  if (best) out.community_slug = best.slug;
  return out;
}

/* The single door to the public bucket. Everything that publishes goes through
   here, so the conditions are stated once: screening said publish, the
   photograph has somewhere to appear, and it is not already up. */
async function publishIfReady(photoId: string, ch: Channel) {
  const rows = await pg(
    `/tmz_photo?select=id,community_id,year,derived_path,storage_path,public_path,agent_decision,status` +
    `&id=eq.${photoId}`);
  const p = rows?.[0];
  if (!p) return false;
  if (p.public_path) return true;
  if (p.agent_decision !== 'publish') return false;
  if (!p.community_id || !p.year) return false;
  if (!AUTO_PUBLISH) return false;

  const source = p.derived_path ?? p.storage_path;
  const dest = source.replace(/^derived\//, '');
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/copy`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
               'Content-Type': 'application/json' },
    body: JSON.stringify({
      bucketId: 'tmz-photo-originals', sourceKey: source,
      destinationBucket: 'tmz-photo-public', destinationKey: dest
    })
  });
  if (!res.ok) {
    ch.trace('publish failed', { status: res.status, body: (await res.text()).slice(0, 200) });
    return false;
  }

  await pg(`/tmz_photo?id=eq.${photoId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'approved', public_path: dest,
      published_by: 'agent', published_at: new Date().toISOString()
    })
  });
  await pg('/tmz_moderation', {
    method: 'POST',
    body: JSON.stringify([{
      photo_id: photoId, model: GEMINI_MODEL, pass: 'final', decision: 'published',
      verdict: 'approved', reasons: ['published automatically']
    }])
  });
  return true;
}

/* ---- contacts and abuse -------------------------------------------------- */

async function contactOf(ref: string) {
  try {
    const rows = await pg(`/tmz_wa_contact?select=*&ref=eq.${encodeURIComponent(ref)}`);
    return rows?.[0] ?? null;
  } catch { return null; }
}

/* Nobody reviews these decisions, so the only thing standing between a
   determined sender and an unlucky screening result is refusing to keep
   looking at their pictures. Three refusals buys a day of silence. */
async function strike(ref: string, isTest: boolean) {
  try {
    const c = await contactOf(ref);
    const strikes = (c?.strikes ?? 0) + 1;
    const blocked_until = strikes >= 3
      ? new Date(Date.now() + 24 * 3600 * 1000).toISOString()
      : (c?.blocked_until ?? null);
    await remember(ref, { strikes, blocked_until, is_test: isTest });
  } catch (e) { console.error('strike', e); }
}

async function putObject(bucket: string, key: string, bytes: Uint8Array) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${key}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
               'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
    body: bytes
  });
  if (!res.ok) throw new Error(`storage ${bucket}/${key} → ${res.status} ${await res.text()}`);
}

const holdBecause = (why: string): Verdict => ({
  decision: 'hold', reasons: [why], confidence: 0, facts: {}, scores: {}, passes: []
});

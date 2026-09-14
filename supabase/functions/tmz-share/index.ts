/* A link to one photograph that unfurls as that photograph.
 *
 * The site is a hash-routed page on GitHub Pages: everything after the # is
 * for the browser, and a messenger's link preview never gets that far. It
 * reads the one index.html, sees the map, and shows the map — for every
 * photograph on the site. WhatsApp, Telegram and Facebook do not run
 * JavaScript, so nothing the page could do would change that.
 *
 * This function is the page they read instead. GET /tmz-share?p=<photo id>
 * answers with a few Open Graph tags whose image is the photograph itself,
 * and then sends a person on to the site — a meta refresh for browsers, a
 * location.replace for the ones that run scripts, a plain link for whatever
 * is left. Only an approved photograph with a public copy is described; any
 * other id goes to the front page, so a guessed or withdrawn link reveals
 * nothing but the site.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://30.torahmitzion.org').replace(/\/$/, '');

const PUBLIC_BUCKET = `${SUPABASE_URL}/storage/v1/object/public/tmz-photo-public`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

// ---- database helpers (service role, so RLS does not apply) ----------------

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

// ---- the page --------------------------------------------------------------

import { sharePageHtml } from '../_shared/sharepage.ts';
const goHome = () => new Response(null, { status: 302, headers: { ...CORS, Location: `${SITE_URL}/` } });
const page = (photo: any) => sharePageHtml(photo, SITE_URL, PUBLIC_BUCKET);

// ---- handler ---------------------------------------------------------------

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'GET') return new Response('GET only', { status: 405, headers: CORS });

  const id = new URL(req.url).searchParams.get('p') ?? '';
  if (!UUID.test(id)) return new Response('bad photo id', { status: 400, headers: CORS });

  try {
    const rows = await pg(`/tmz_photo?select=id,public_path,year,status,people_text,people_tr,occasion_text,occasion_tr,event_type_id,` +
      `tmz_community(slug,tmz_community_tr(lang,name))&id=eq.${id}&limit=1`);
    const photo = rows?.[0];
    if (!photo || photo.status !== 'approved' || !photo.public_path || !photo.tmz_community?.slug || photo.year == null) {
      return goHome();
    }
    return new Response(page(photo), {
      headers: { ...CORS, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' }
    });
  } catch (e) {
    console.error('tmz-share', id, e);
    return goHome();
  }
});

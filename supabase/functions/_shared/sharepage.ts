/* The share page of one photograph, and how it gets onto the site.
 *
 * A messenger's link preview reads one static HTML page and never runs a
 * script, so a hash route on the site unfurls as the map, every time. The
 * answer is a real page per photograph at SITE_URL/p/<id>.html — Open Graph
 * tags whose image is the photograph, then a redirect to the year page that
 * opens on it. The site lives on GitHub Pages, so "a real page" means a
 * file in the repository: this module builds the HTML and, when a token is
 * configured, commits it through GitHub's contents API the moment a
 * photograph is published. scripts/share-pages.mjs writes the same pages
 * for everything already published. */

export interface SharePhoto {
  id: string; public_path: string; year: number;
  people_text?: string | null; people_tr?: Record<string, string> | null;
  occasion_text?: string | null; occasion_tr?: Record<string, string> | null;
  tmz_community: { slug: string; tmz_community_tr?: { lang: string; name: string }[] };
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* One line, the way the site prints it under the photograph: the English
   rendering when there is one, the sender's own words otherwise. */
function line(tr: unknown, text: unknown) {
  const en = (tr as Record<string, string> | null)?.en;
  return (typeof en === 'string' && en.trim() ? en : String(text ?? '')).trim();
}

export const sharePagePath = (id: string) => `p/${id}.html`;

export function sharePageHtml(photo: SharePhoto, siteUrl: string, publicBucket: string) {
  const comm = photo.tmz_community;
  const name = (comm.tmz_community_tr ?? []).find(t => t.lang === 'en')?.name ?? comm.slug;
  const title = `${name} ${photo.year} — Torah MiTzion 30`;
  const description = [line(photo.people_tr, photo.people_text), line(photo.occasion_tr, photo.occasion_text)]
    .filter(Boolean).join(' · ') || 'Thirty years of Torah MiTzion in photographs.';
  const image = `${publicBucket}/${photo.public_path}`;
  const self = `${siteUrl}/${sharePagePath(photo.id)}`;
  const link = `${siteUrl}/#/c/${comm.slug}/${photo.year}/${photo.id}`;
  const meta = (attr: string, key: string, value: string) => `<meta ${attr}="${key}" content="${esc(value)}">`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
${meta('property', 'og:type', 'article')}
${meta('property', 'og:site_name', 'Torah MiTzion 30')}
${meta('property', 'og:title', title)}
${meta('property', 'og:description', description)}
${meta('property', 'og:image', image)}
${meta('property', 'og:image:secure_url', image)}
${meta('property', 'og:url', self)}
${meta('name', 'twitter:card', 'summary_large_image')}
${meta('name', 'twitter:title', title)}
${meta('name', 'twitter:description', description)}
${meta('name', 'twitter:image', image)}
<meta http-equiv="refresh" content="0;url=${esc(link)}">
<script>location.replace(${JSON.stringify(link)})</script>
<style>body{margin:0;background:#070B16;color:#F0EDE4;font:15px system-ui,sans-serif;display:grid;place-items:center;min-height:100vh}a{color:#E8C87D}</style>
</head><body><a href="${esc(link)}">${esc(title)}</a></body></html>
`;
}

/* Commits the page to the site's repository. Silent when no token is
   configured — the local script still covers everything published. */
export async function pushSharePage(photo: SharePhoto, opts: {
  siteUrl: string; publicBucket: string; token: string; repo: string; branch?: string;
}): Promise<boolean> {
  if (!opts.token) return false;
  const path = `docs/${sharePagePath(photo.id)}`;
  const api = `https://api.github.com/repos/${opts.repo}/contents/${path}`;
  const headers = { Authorization: `Bearer ${opts.token}`, Accept: 'application/vnd.github+json',
                    'User-Agent': 'tmz-share', 'Content-Type': 'application/json' };
  const html = sharePageHtml(photo, opts.siteUrl, opts.publicBucket);
  const content = btoa(String.fromCharCode(...new TextEncoder().encode(html)));
  // an existing file needs its sha to be replaced
  let sha: string | undefined;
  const head = await fetch(`${api}?ref=${opts.branch ?? 'master'}`, { headers });
  if (head.ok) sha = (await head.json())?.sha;
  const res = await fetch(api, {
    method: 'PUT', headers,
    body: JSON.stringify({ message: `Share page for photograph ${photo.id}`, content, branch: opts.branch ?? 'master', ...(sha ? { sha } : {}) })
  });
  if (!res.ok) { console.error('share page push', res.status, (await res.text()).slice(0, 200)); return false; }
  return true;
}

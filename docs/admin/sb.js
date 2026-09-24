/* A minimal Supabase client for the back office. The full supabase-js is 60KB
   over the CDN and needs a bundler for its ESM imports; every call the CMS
   actually makes is a plain PostgREST HTTPS request. This wraps that plus
   Auth's implicit-flow token handling. */

const AUTH = `${window.TMZ_SUPABASE_URL}/auth/v1`;
const REST = `${window.TMZ_SUPABASE_URL}/rest/v1`;
const KEY = window.TMZ_SUPABASE_ANON_KEY;
const SESSION_STORAGE_KEY = 'tmz.admin.session';

// ---- session ---------------------------------------------------------------

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.access_token) return null;
    if (s.expires_at && s.expires_at * 1000 < Date.now()) return null;
    return s;
  } catch { return null; }
}

/* Access tokens last an hour. Without this the back office signs you out
   mid-afternoon and asks for the password again, which is no way to spend a
   day editing records. Refresh a minute early so a long request cannot land
   on an expired token. */
async function refreshSession() {
  let stored;
  try { stored = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || 'null'); }
  catch { return null; }
  if (!stored?.refresh_token) return null;

  const res = await fetch(`${AUTH}/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: stored.refresh_token })
  });
  if (!res.ok) { writeSession(null); return null; }

  const d = await res.json();
  if (!d.access_token) { writeSession(null); return null; }
  const s = {
    access_token: d.access_token,
    refresh_token: d.refresh_token ?? stored.refresh_token,
    expires_in: d.expires_in ?? 3600,
    expires_at: Math.floor(Date.now() / 1000) + (d.expires_in ?? 3600) - 60,
    token_type: d.token_type || 'bearer'
  };
  writeSession(s);
  return s;
}

/* The one entry point the app should use: hands back a usable session,
   refreshing transparently, or null when the user really must sign in again. */
export async function ensureSession() {
  return readSession() ?? await refreshSession();
}

function writeSession(s) {
  if (s && s.access_token) localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_STORAGE_KEY);
}

/* Left over from the OAuth days: a redirect that still carries tokens in the
   URL fragment is honoured, then wiped so the URL is safe to bookmark. */
export function captureRedirect() {
  if (!location.hash.includes('access_token=')) return null;
  const params = new URLSearchParams(location.hash.slice(1));
  const access_token = params.get('access_token');
  if (!access_token) return null;
  const ttl = +params.get('expires_in') || 3600;
  const s = {
    access_token,
    refresh_token: params.get('refresh_token'),
    expires_in: ttl,
    expires_at: Math.floor(Date.now() / 1000) + ttl - 60,
    token_type: params.get('token_type') || 'bearer'
  };
  writeSession(s);
  history.replaceState(null, '', location.pathname + location.search);
  return s;
}

export function getSession() { return readSession(); }

export function signOut() {
  const s = readSession();
  writeSession(null);
  if (s) fetch(`${AUTH}/logout`, { method: 'POST', headers: authHeaders(s) }).catch(() => {});
  location.reload();
}

/* Username and password. The username is a synthetic address on the site's
   own domain — nobody needs to receive mail at it — so a plain "tmzadmin"
   becomes tmzadmin@30.torahmitzion.org before it reaches Auth. A full e-mail
   address, if someone has one, passes through untouched. */
const USERNAME_DOMAIN = '30.torahmitzion.org';

export async function signInWithPassword(username, password) {
  const email = username.includes('@') ? username.trim() : `${username.trim().toLowerCase()}@${USERNAME_DOMAIN}`;
  const res = await fetch(`${AUTH}/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.access_token) {
    throw new Error(d.error_description || d.msg || d.message || 'Wrong username or password.');
  }
  const ttl = d.expires_in ?? 3600;
  const s = {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_in: ttl,
    expires_at: Math.floor(Date.now() / 1000) + ttl - 60,
    token_type: d.token_type || 'bearer'
  };
  writeSession(s);
  return s;
}

// ---- request layer ---------------------------------------------------------

function authHeaders(session) {
  return {
    apikey: KEY,
    Authorization: `Bearer ${session ? session.access_token : KEY}`
  };
}

async function pg(path, { method = 'GET', body, prefer, session, retried } = {}) {
  const active = session || await ensureSession();
  const headers = { ...authHeaders(active), 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${REST}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined
  });

  // A token can expire between the check and the request landing. Refresh once
  // and replay rather than throwing a confusing 401 at the view.
  if (res.status === 401 && !retried) {
    const fresh = await refreshSession();
    if (fresh) return pg(path, { method, body, prefer, session: fresh, retried: true });
  }

  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

// A named alias the views can read to know they've reached the DB at all.
export const sb = {
  from(table) {
    return {
      select(cols = '*', { order, limit, filter } = {}) {
        const q = new URLSearchParams();
        q.set('select', cols);
        if (order) q.set('order', order);
        if (limit != null) q.set('limit', limit);
        if (filter) for (const [k, v] of Object.entries(filter)) q.set(k, v);
        return pg(`/${table}?${q}`);
      },
      insert(row, opts = {}) {
        return pg(`/${table}`, {
          method: 'POST',
          body: Array.isArray(row) ? row : [row],
          prefer: `resolution=merge-duplicates,return=${opts.return || 'representation'}`
        });
      },
      update(patch, filter) {
        const q = new URLSearchParams(filter || {});
        return pg(`/${table}?${q}`, {
          method: 'PATCH', body: patch, prefer: 'return=representation'
        });
      },
      upsert(row, opts = {}) {
        const q = new URLSearchParams();
        if (opts.onConflict) q.set('on_conflict', opts.onConflict);
        return pg(`/${table}?${q}`, {
          method: 'POST',
          body: Array.isArray(row) ? row : [row],
          prefer: 'resolution=merge-duplicates,return=representation'
        });
      },
      delete(filter) {
        const q = new URLSearchParams(filter || {});
        return pg(`/${table}?${q}`, { method: 'DELETE' });
      }
    };
  },

  async rpc(fn, args = {}) {
    return pg(`/rpc/${fn}`, { method: 'POST', body: args });
  },

  /* How many rows, without fetching them: PostgREST caps a page at 1,000 and
     the register holds more people than that. */
  async count(table, filter) {
    const q = new URLSearchParams({ select: 'id', ...(filter || {}) });
    const s = await ensureSession();
    const res = await fetch(`${REST}/${table}?${q}`, {
      headers: { ...authHeaders(s), Prefer: 'count=exact', Range: '0-0', 'Range-Unit': 'items' }
    });
    if (!res.ok && res.status !== 206) throw new Error(`count ${table} → ${res.status}`);
    // content-range reads 0-0/6, or */0 when the table is empty.
    const total = (res.headers.get('content-range') || '/0').split('/')[1];
    return total === '*' ? 0 : (+total || 0);
  },

  /* Every row of a table, a page at a time. */
  async all(table, cols, opts = {}) {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const q = new URLSearchParams({ select: cols, offset: from, limit: 1000, ...(opts.order ? { order: opts.order } : {}), ...(opts.filter || {}) });
      const page = await pg(`/${table}?${q}`);
      out.push(...page);
      if (page.length < 1000) return out;
    }
  },

  /* Storage sits on a different path than PostgREST, so it does not go through
     pg(). Copy is server-side — the bytes never travel to the browser. */
  async storageCopy(bucketId, sourceKey, destinationBucket, destinationKey) {
    const s = await ensureSession();
    const res = await fetch(`${window.TMZ_SUPABASE_URL}/storage/v1/object/copy`, {
      method: 'POST',
      headers: { ...authHeaders(s), 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucketId, sourceKey, destinationBucket, destinationKey })
    });
    if (!res.ok) throw new Error(`copy → ${res.status} ${await res.text()}`);
    return res.json();
  },

  /* Signed URLs for private objects, a batch at a time; the Storage API
     returns one entry per path with either a signedURL or an error. */
  async signedUrls(bucket, paths) {
    const s = await ensureSession();
    const res = await fetch(`${window.TMZ_SUPABASE_URL}/storage/v1/object/sign/${bucket}`, {
      method: 'POST', headers: { ...authHeaders(s), 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 3600, paths })
    });
    if (!res.ok) throw new Error(`sign → ${res.status} ${await res.text()}`);
    const out = await res.json();
    return out.map(o => o.signedURL ? `${window.TMZ_SUPABASE_URL}/storage/v1${o.signedURL}` : null);
  },

  /* Put bytes in a bucket, replacing what is there. Storage is not PostgREST,
     so it does not go through pg(); upsert is a header rather than a verb, and
     without it a second save of the same photograph answers 409. The cache
     header matches what the edge functions write, so an edited copy is
     revalidated rather than served from yesterday. */
  async storageUpload(bucket, key, blob, { contentType = 'image/jpeg' } = {}) {
    const s = await ensureSession();
    const res = await fetch(`${window.TMZ_SUPABASE_URL}/storage/v1/object/${bucket}/${key}`, {
      method: 'POST',
      headers: { ...authHeaders(s), 'Content-Type': contentType, 'x-upsert': 'true', 'Cache-Control': 'no-cache' },
      body: blob
    });
    if (!res.ok) throw new Error(`upload ${bucket}/${key} → ${res.status} ${(await res.text()).slice(0, 200)}`);
    return res.json().catch(() => ({}));
  },

  async storageRemove(bucket, key) {
    const s = await ensureSession();
    const res = await fetch(`${window.TMZ_SUPABASE_URL}/storage/v1/object/${bucket}/${key}`, {
      method: 'DELETE', headers: authHeaders(s)
    });
    if (!res.ok) throw new Error(`remove → ${res.status} ${await res.text()}`);
  },

  async me() {
    const s = await ensureSession();
    if (!s) return null;
    const res = await fetch(`${AUTH}/user`, { headers: authHeaders(s) });
    if (!res.ok) { writeSession(null); return null; }
    return res.json();
  }
};

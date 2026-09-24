import { sb, captureRedirect, ensureSession, signInWithPassword, signOut } from './sb.js';
import { $, esc, REGION_NAMES } from './ui.js';
import { dashboard, campaign, communities, people, photos, translations, requests, openRequestCount } from './views.js';
import { visits } from './visits.js';

/* A token arriving in the URL fragment is captured and cleared BEFORE we ask
   the DB who we are — otherwise the first request goes out anonymous and the
   RLS check for tmz_app_user fails silently. */
captureRedirect();

const app = $('#app');

async function boot() {
  const session = await ensureSession();
  if (!session) { renderGate(); return; }

  const user = await sb.me();
  if (!user) { renderGate(); return; }

  /* tmz_app_user is empty on first sign-in. The RLS policy lets a user insert
     only their OWN row, so this is safe to do straight from the client. */
  const rows = await sb.from('tmz_app_user').select('*', { filter: { id: `eq.${user.id}` } });
  const profile = rows[0];
  if (!profile) { autoRegister(user); return; }

  renderShell(user, profile);
  handleRoute();
}

/* ---- signed out --------------------------------------------------------- */

function renderGate(error) {
  app.innerHTML = `
    <div class="gate"><div class="gate-card">
      <img src="../tmz-mark.png" alt="Torah MiTzion">
      <h1>Back office</h1>
      <p>Sign in to manage communities, people and photographs for the Torah MiTzion 30 album.</p>
      <form class="gate-form" id="gateForm" autocomplete="on">
        <label>Username<input id="gateUser" name="username" autocomplete="username" required autofocus></label>
        <label>Password<input id="gatePass" name="password" type="password" autocomplete="current-password" required></label>
        <p class="gate-err" id="gateErr" hidden></p>
        <button class="btn solid" id="signIn" type="submit">Sign in</button>
      </form>
      <small>Accounts are created by an administrator.</small>
    </div></div>`;
  const err = $('#gateErr');
  if (error) { err.textContent = error; err.hidden = false; }
  $('#gateForm').onsubmit = async e => {
    e.preventDefault();
    const btn = $('#signIn');
    btn.disabled = true; btn.textContent = 'Signing in…';
    err.hidden = true;
    try {
      await signInWithPassword($('#gateUser').value, $('#gatePass').value);
      start();
    } catch (ex) {
      err.textContent = ex.message; err.hidden = false;
      btn.disabled = false; btn.textContent = 'Sign in';
    }
  };
}

/* ---- first-run intake --------------------------------------------------- */

/* Silent registration for the back office. The public "how do you know Torah
   MiTzion" question belongs to the site's contributor signup, not here — a
   back-office user is either promoted by an admin or they're not. */
async function autoRegister(user) {
  const displayName = user.user_metadata?.full_name || user.email || null;
  try {
    await sb.from('tmz_app_user').insert({ id: user.id, display_name: displayName });
    start();
  } catch (e) {
    app.innerHTML = `<div class="gate"><div class="gate-card">
      <h1>Couldn't register</h1>
      <p>${esc(e.message)}</p>
      <button class="btn ghost" onclick="location.reload()">Try again</button>
    </div></div>`;
  }
}

/* ---- signed in ---------------------------------------------------------- */

function renderShell(user, profile) {
  const canWrite = ['editor', 'admin'].includes(profile.role);
  const displayName = profile.display_name || user.email;

  app.innerHTML = `
    <div class="shell">
      <aside class="side">
        <a class="side-brand" href="#/">
          <img src="../tmz-mark.png" alt="">
          <span>Back office<small>Torah MiTzion 30</small></span>
        </a>
        <nav class="nav" id="nav">
          <a href="#/" data-route="dashboard">Dashboard</a>
          <a href="#/campaign" data-route="campaign">Campaign</a>
          <a href="#/visits" data-route="visits">Visits</a>
          <a href="#/communities" data-route="communities">Communities</a>
          <a href="#/people" data-route="people">People</a>
          <a href="#/translations" data-route="translations">Translations</a>
          <a href="#/photos" data-route="photos">Moderation</a>
          <a href="#/requests" data-route="requests">Requests <span class="nav-badge" id="reqBadge" hidden></span></a>
        </nav>
        <div class="side-me">
          <span class="name">${esc(displayName)}<span class="role-badge">${esc(profile.role)}</span></span>
          <span>${esc(user.email)}</span><br>
          <button id="signOut">Sign out</button>
        </div>
      </aside>
      <main id="page"></main>
    </div>`;

  $('#signOut').onclick = signOut;

  if (!canWrite) {
    /* A contributor can sign in but has no reason to be in the CMS — RLS would
       refuse every write anyway. Tell them plainly rather than showing an app
       full of buttons that fail. */
    $('#page').innerHTML = `
      <div class="page-head"><div><h1>Access pending</h1>
        <p>Your account is registered as <b>${esc(profile.role)}</b>.
          An administrator needs to grant you the <b>editor</b> role before you can use the back office.</p></div></div>
      <div class="empty">
        Nothing to show yet.<br>
        <small style="color:var(--dim)">Your user id: <span class="mono">${esc(user.id)}</span></small>
      </div>`;
  }
}

/* ---- routing ------------------------------------------------------------ */

const routes = {
  dashboard, campaign, visits, communities, people, photos, translations, requests
};

async function handleRoute() {
  if (!$('#page')) return;
  // strip any ?query the view carries (translations uses ?lang=)
  const h = (location.hash || '#/').slice(2).split('?')[0] || 'dashboard';
  const name = routes[h] ? h : 'dashboard';
  document.querySelectorAll('#nav a').forEach(a =>
    a.classList.toggle('on', a.dataset.route === name));
  openRequestCount().then(n => { const b = $('#reqBadge'); if (b) { b.textContent = n; b.hidden = !n; } }).catch(() => {});
  try {
    $('#page').innerHTML = `<div class="empty">Loading…</div>`;
    await routes[name]();
  } catch (e) {
    $('#page').innerHTML = `<div class="error">${esc(e.message)}</div>`;
    console.error(e);
  }
}

/* Until boot() paints something the page is nothing but the word "Loading",
   so a failure on the way in — the network down, a table that answers 500 —
   would leave it there for ever with the reason only in the console. Say it
   on screen, above the sign-in form, where the person can act on it. */
function start() {
  boot().catch(e => {
    console.error(e);
    renderGate(e.message || String(e));
  });
}

window.addEventListener('hashchange', handleRoute);
start();

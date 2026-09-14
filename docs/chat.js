/* The floating guide.
 *
 * A button in the corner opens a small chat that answers one kind of
 * question — which community, which year — and hands back the page. The
 * answers come from the tmz-chat function, which knows only what the year
 * pages print; the links come back as {community, year} and are built here,
 * so nothing the model says can point off the site.
 *
 * Lives outside #app, so the conversation survives navigating to the page
 * it just recommended. */

(function () {
  const ENDPOINT = `${TMZ_SUPABASE_URL}/functions/v1/tmz-chat`;
  const MAX_TURNS = 8;
  let root, log, input, sendBtn, open = false;
  const turns = [];   // {role, text, links?}

  const escape = s => String(s).replace(/[&<>"]/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m]));

  function build() {
    root = document.createElement('div');
    root.className = 'chat';
    root.innerHTML = `
      <button class="chat-fab" id="chatFab" aria-expanded="false">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5z"/>
          <path d="M8.5 8h7M8.5 11.5h4.5"/></svg>
        <span class="chat-fab-txt"></span>
      </button>
      <section class="chat-panel" hidden aria-label="">
        <header class="chat-head">
          <span class="chat-title"></span>
          <button class="chat-x" aria-label="">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 5l10 10M15 5L5 15"/></svg></button>
        </header>
        <div class="chat-log"></div>
        <form class="chat-form">
          <input class="chat-in" type="text" maxlength="500" autocomplete="off" placeholder="">
          <button class="btn-gold sm chat-send" type="submit"></button>
        </form>
      </section>`;
    document.body.appendChild(root);
    log = root.querySelector('.chat-log');
    input = root.querySelector('.chat-in');
    sendBtn = root.querySelector('.chat-send');

    root.querySelector('#chatFab').onclick = () => toggle(!open);
    root.querySelector('.chat-x').onclick = () => toggle(false);
    root.querySelector('.chat-form').onsubmit = e => { e.preventDefault(); send(); };
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); send(); } });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && open) toggle(false); });
    relabel();
  }

  function toggle(on) {
    open = on;
    root.querySelector('.chat-panel').hidden = !on;
    root.querySelector('#chatFab').setAttribute('aria-expanded', String(on));
    root.classList.toggle('is-open', on);
    if (on) {
      if (!turns.length) greet();
      setTimeout(() => input.focus(), 50);
    }
  }

  function greet() {
    turns.length = 0;
    log.innerHTML = '';
    bubble('assistant', t('chat.hello'), [], false);
  }

  function relabel() {
    if (!root) return;
    root.querySelector('.chat-fab-txt').textContent = t('chat.open');
    root.querySelector('.chat-fab').setAttribute('aria-label', t('chat.open'));
    root.querySelector('.chat-panel').setAttribute('aria-label', t('chat.title'));
    root.querySelector('.chat-title').textContent = t('chat.title');
    root.querySelector('.chat-x').setAttribute('aria-label', t('lb.close'));
    input.placeholder = t('chat.placeholder');
    sendBtn.textContent = t('chat.send');
    // a fresh language means a fresh greeting, unless a conversation is under way
    if (turns.length === 0 && log.children.length) greet();
  }

  function communityName(slug) {
    const c = (typeof STATE !== 'undefined' ? STATE.communities : []).find(x => x.id === slug);
    return c ? tf(c.name) : slug;
  }

  function bubble(role, text, links, remember = true) {
    const el = document.createElement('div');
    el.className = `chat-msg ${role}`;
    el.dir = 'auto';
    el.innerHTML = `<p>${escape(text)}</p>` + (links && links.length ? `<div class="chat-links">${
      links.map(l => `<a class="chat-link" href="#/c/${escape(l.community)}${l.year ? '/' + l.year : ''}">
        <b>${escape(communityName(l.community))}</b>
        <span dir="ltr">${l.year ? l.year : escape(t('chat.all'))}</span></a>`).join('')}</div>` : '');
    el.querySelectorAll('.chat-link').forEach(a => {
      a.onclick = () => { if (window.innerWidth < 700) toggle(false); };
    });
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    if (remember) turns.push({ role, text });
    return el;
  }

  async function send() {
    const q = input.value.trim();
    if (!q || sendBtn.disabled) return;
    input.value = '';
    bubble('user', q);
    sendBtn.disabled = true;
    const wait = document.createElement('div');
    wait.className = 'chat-msg assistant wait';
    wait.innerHTML = '<span></span><span></span><span></span>';
    log.appendChild(wait);
    log.scrollTop = log.scrollHeight;
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { apikey: TMZ_ANON_KEY, Authorization: `Bearer ${TMZ_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q, lang: LANG,
          history: turns.slice(-MAX_TURNS - 1, -1)
        })
      });
      const out = await res.json().catch(() => ({}));
      wait.remove();
      if (!out.reply) throw new Error(out.error || res.status);
      bubble('assistant', out.reply, out.links || []);
    } catch (e) {
      wait.remove();
      bubble('assistant', t('chat.busy'), [], false);
      console.error('chat', e);
    }
    sendBtn.disabled = false;
    input.focus();
  }

  window.TMZChat = {
    relabel() { if (!root) build(); else relabel(); },
    open() { if (!root) build(); toggle(true); }
  };
})();

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
      <a class="wa-fab" href="https://wa.me/972765300609" target="_blank" rel="noopener">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
        <span class="wa-fab-txt"></span>
      </a>
      <button class="chat-fab" id="chatFab" aria-expanded="false">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M10 5Q11.6 12.2 18.5 14Q11.6 15.8 10 23Q8.4 15.8 1.5 14Q8.4 12.2 10 5Z"/>
          <path d="M18 1Q18.7 4.3 22 5Q18.7 5.7 18 9Q17.3 5.7 14 5Q17.3 4.3 18 1Z"/>
          <path d="M19.5 16.5Q20 18.8 22.5 19.5Q20 20.2 19.5 22.5Q19 20.2 16.5 19.5Q19 18.8 19.5 16.5Z"/></svg>
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
    bubble('assistant', '✦ ' + t('chat.hello'), [], false);
  }

  function relabel() {
    if (!root) return;
    root.querySelector('.chat-fab-txt').textContent = t('chat.open');
    root.querySelector('.chat-fab').setAttribute('aria-label', t('chat.open'));
    root.querySelector('.wa-fab-txt').textContent = t('wa.fab');
    root.querySelector('.wa-fab').setAttribute('aria-label', t('wa.fab'));
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

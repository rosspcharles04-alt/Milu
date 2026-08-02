/* Router and bootstrap. */
(function () {
  'use strict';

  const Views = window.Views = window.Views || {};

  const TABS = [
    { id: 'today',    icon: 'home',   label: 'Today' },
    { id: 'study',    icon: 'book',   label: 'Study' },
    { id: 'practice', icon: 'target', label: 'Practice' },
    { id: 'chars',    icon: 'brush',  label: 'Hanzi' },
    { id: 'me',       icon: 'deer',   label: 'Me' },
  ];

  // Views that take over the whole screen (no bottom nav).
  const FULLSCREEN = new Set(['session', 'quiz', 'tones', 'speak', 'sentences',
                              'dialogue', 'char', 'write', 'match']);

  let root, navEl, currentRoute = '';

  function parse() {
    const raw = (location.hash || '#/today').replace(/^#\/?/, '');
    const parts = raw.split('/').filter(Boolean);
    return { name: parts[0] || 'today', args: parts.slice(1).map(decodeURIComponent) };
  }

  async function render() {
    const { name, args } = parse();
    const view = Views[name] || Views.today;
    currentRoute = name;

    Audio2.stop();
    UI.closeSheet(true);

    root.innerHTML = '';
    const host = document.createElement('div');
    host.className = FULLSCREEN.has(name) ? 'session' : 'view';
    root.appendChild(host);

    try {
      await view(host, args);
    } catch (err) {
      console.error('view failed:', name, err);
      host.innerHTML = `
        <div class="card center">
          ${Mascot.svg('sad', 96)}
          <h2 class="card__title" style="justify-content:center">Something broke</h2>
          <p class="card__note">${UI.esc(err.message || err)}</p>
          <button class="btn btn--primary" style="margin-top:14px"
                  onclick="location.hash='#/today';location.reload()">Back to start</button>
        </div>`;
    }

    navEl.classList.toggle('hidden', FULLSCREEN.has(name));
    updateNav(name);
    if (!FULLSCREEN.has(name)) window.scrollTo(0, 0);
  }

  function updateNav(name) {
    const counts = SRS.counts();
    navEl.innerHTML = TABS.map(t => {
      const on = t.id === name;
      const badge = (t.id === 'today' && counts.due + counts.fresh > 0)
        ? `<span class="nav__badge">${Math.min(99, counts.due + counts.fresh)}</span>` : '';
      return `<button class="nav__item${on ? ' nav__item--on' : ''}"
                      data-tab="${t.id}" aria-label="${t.label}"
                      ${on ? 'aria-current="page"' : ''}>
                ${badge}${UI.icon(t.icon, 24)}<span>${t.label}</span>
              </button>`;
    }).join('');
  }

  function go(hash) { location.hash = hash; }

  /* ---- boot -------------------------------------------------------------- */

  async function boot() {
    root = document.getElementById('app');
    navEl = document.getElementById('nav');

    navEl.addEventListener('click', e => {
      const btn = e.target.closest('[data-tab]');
      if (btn) { Audio2.unlock(); go('#/' + btn.dataset.tab); }
    });

    // Any tap counts as the gesture iOS needs before it will speak.
    document.addEventListener('pointerdown', () => Audio2.unlock(), { once: true });

    try {
      await Store.load();
    } catch (err) {
      root.innerHTML = `<div class="view"><div class="card center">
        ${Mascot.svg('sad', 100)}
        <h2 class="card__title" style="justify-content:center">Couldn't load the word list</h2>
        <p class="card__note">${UI.esc(err.message)}</p>
        <p class="card__note small" style="margin-top:10px">
          If you opened this file directly, it needs to be served over http —
          see the README.</p>
      </div></div>`;
      return;
    }

    Store.applyTheme();
    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => {
        if (Store.S.settings.theme === 'auto') Store.applyTheme();
      });

    Audio2.init();
    Cloud.init();

    window.addEventListener('hashchange', render);
    await render();

    document.getElementById('splash')?.remove();

    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(e => console.warn('sw:', e));
    }
  }

  window.App = { go, render, updateNav, TABS, get route() { return currentRoute; } };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

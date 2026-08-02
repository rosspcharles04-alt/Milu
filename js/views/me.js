/* Me — progress, the family leaderboard, settings, and importing new decks. */
(function () {
  const Views = window.Views = window.Views || {};

  Views.me = function (host) {
    const s = Store.S.settings;
    const c = SRS.counts();
    const streak = Store.liveStreak();
    const days = Store.S.stats.days || {};
    let reviews = 0, correct = 0;
    Object.values(days).forEach(d => { reviews += d.reviews || 0; correct += d.correct || 0; });
    const acc = reviews ? Math.round(correct / reviews * 100) : 0;
    const traced = Object.values(Store.S.chars).filter(x => x.traced > 0).length;

    host.innerHTML = `
      <div class="topbar">
        <div>
          <div class="topbar__title">${s.familyCode || Store.S.profile.name ? UI.esc(Store.S.profile.name || 'You') : 'Me'}</div>
          <div class="topbar__sub">我 · wǒ</div>
        </div>
        <div class="topbar__spacer"></div>
        ${Mascot.svg(streak >= 3 ? 'proud' : 'idle', 56)}
      </div>

      <div class="card" style="display:flex;justify-content:space-around;text-align:center">
        <div class="stat"><div class="stat__num" style="color:var(--coral)">${streak}</div>
          <div class="stat__label">Streak</div></div>
        <div class="stat"><div class="stat__num" style="color:var(--mint)">${c.known}</div>
          <div class="stat__label">Known</div></div>
        <div class="stat"><div class="stat__num">${acc}%</div>
          <div class="stat__label">Accuracy</div></div>
      </div>

      ${activityCard(days)}

      <div class="card">
        <div class="card__title">📚 Your collection</div>
        <div class="stack" style="margin-top:10px">
          ${statLine('Words started', `${c.started} / ${c.total}`, c.total ? c.started / c.total : 0)}
          ${statLine('Words solid (3 weeks+)', `${c.known}`, c.total ? c.known / c.total : 0)}
          ${statLine('Characters traced', `${traced} / ${Hanzi.allChars().length}`,
                     Hanzi.allChars().length ? traced / Hanzi.allChars().length : 0)}
          ${statLine('Longest streak', `${Store.S.stats.longest} days`, 0, true)}
          ${statLine('Total reviews', `${reviews}`, 0, true)}
        </div>
      </div>

      <div class="section-title">Family leaderboard</div>
      <div id="board"></div>

      <div class="section-title">Add to your deck</div>
      <button class="row" data-go="#/import">
        <span class="row__lead">📥</span>
        <span class="row__main">
          <span class="row__title">Import a PowerPoint</span>
          <span class="row__sub">Pull the words out of a deck from your tutor</span>
        </span>
        ${UI.icon('chev', 18)}
      </button>
      <button class="row" id="addWord">
        <span class="row__lead">✏️</span>
        <span class="row__main">
          <span class="row__title">Add a word by hand</span>
          <span class="row__sub">${Store.S.custom.length} added so far</span>
        </span>
        ${UI.icon('chev', 18)}
      </button>

      <div class="section-title">Settings</div>

      <div class="card">
        <label class="small muted" for="name">Your name (shown on the leaderboard)</label>
        <input class="field" id="name" value="${UI.esc(Store.S.profile.name)}"
               placeholder="Ross" maxlength="24" style="margin-top:6px">
      </div>

      <div class="card">
        <div class="card__title">New words per day</div>
        <p class="card__note">Currently ${s.newPerDay}. Reviews are on top of this.</p>
        <div class="hstack" style="margin-top:10px">
          ${[5, 10, 15, 20, 30].map(n => `
            <button class="btn btn--sm flex1 ${n === s.newPerDay ? 'btn--primary' : 'btn--ghost'}"
                    data-new="${n}">${n}</button>`).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card__title">Pinyin</div>
        <div class="stack" style="margin-top:10px">
          ${[['fade', 'Fades out as you learn each word', 'Recommended'],
             ['hidden', 'Always hidden, tap to reveal', 'Strictest'],
             ['always', 'Always visible', 'Easiest']].map(([id, label, note]) => `
            <button class="row" data-pinyin="${id}" style="margin:0">
              <span class="row__main">
                <span class="row__title" style="font-size:14.5px">${label}</span>
                <span class="row__sub">${note}</span>
              </span>
              ${s.pinyinMode === id ? `<span style="color:var(--mint)">${UI.icon('check', 20)}</span>` : ''}
            </button>`).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card__title">Voice</div>
        <p class="card__note" id="voiceNote">Checking what's available…</p>
        <select class="field" id="voice" style="margin-top:8px"></select>
        <label class="small muted" style="display:block;margin-top:12px">
          Speed — ${s.rate.toFixed(2)}×</label>
        <input type="range" id="rate" min="0.5" max="1.2" step="0.05" value="${s.rate}"
               style="width:100%;margin-top:6px">
        <button class="btn btn--sm btn--ghost" id="testVoice" style="margin-top:10px">
          ${UI.icon('sound', 15)} Test: 你好，我叫麋鹿</button>
      </div>

      <div class="card">
        <div class="stack">
          ${toggleRow('theme', 'Dark mode',
            s.theme === 'dark' || (s.theme === 'auto' &&
              window.matchMedia('(prefers-color-scheme: dark)').matches),
            s.theme === 'auto' ? 'Following your phone' : 'Set manually')}
          ${toggleRow('sound', 'Sound effects', s.sound, '')}
          ${toggleRow('haptics', 'Vibration', s.haptics, 'Android only — iOS ignores it')}
        </div>
      </div>

      <div class="card">
        <div class="card__title">Family code</div>
        <p class="card__note">Type the same code on both phones to share a leaderboard.
          ${Cloud.configured() ? '' : ' <b>Not set up yet</b> — see SETUP.md.'}</p>
        <input class="field" id="code" value="${UI.esc(s.familyCode)}"
               placeholder="e.g. CHARLES" maxlength="24" autocapitalize="characters"
               style="margin-top:8px;text-transform:uppercase">
      </div>

      <button class="btn btn--ghost btn--block" id="reset" style="margin:18px 0 4px;color:var(--bad)">
        Reset everything</button>
      <p class="muted small center" style="margin-bottom:20px">
        Mílù 麋鹿 · ${Store.S.vocab.length} words · all progress stored on this device</p>`;

    wire(host);
    paintBoard(host.querySelector('#board'));
    fillVoices(host);
  };

  function statLine(label, value, pct, plain) {
    return `
      <div>
        <div class="hstack" style="justify-content:space-between">
          <span class="small muted">${label}</span>
          <span class="small" style="font-weight:800">${value}</span>
        </div>
        ${plain ? '' : `<div class="bar" style="height:7px;margin-top:5px">
          <div class="bar__fill" style="width:${Math.min(100, pct * 100)}%"></div></div>`}
      </div>`;
  }

  function toggleRow(id, label, on, note) {
    return `
      <button class="row" data-toggle="${id}" style="margin:0">
        <span class="row__main">
          <span class="row__title" style="font-size:14.5px">${label}</span>
          ${note ? `<span class="row__sub">${note}</span>` : ''}
        </span>
        <span class="switch${on ? ' switch--on' : ''}"></span>
      </button>`;
  }

  function activityCard(days) {
    const out = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      out.push({ key, n: (days[key] && days[key].reviews) || 0, day: d.getDay() });
    }
    const max = Math.max(10, ...out.map(o => o.n));
    return `
      <div class="card">
        <div class="card__title">📅 Last two weeks</div>
        <div class="hstack" style="align-items:flex-end;gap:4px;height:74px;margin-top:12px">
          ${out.map(o => `
            <div class="flex1" style="display:flex;flex-direction:column;
                 align-items:center;gap:4px;height:100%;justify-content:flex-end"
                 title="${o.key}: ${o.n} reviews">
              <div style="width:100%;border-radius:4px;
                   height:${Math.max(3, o.n / max * 56)}px;
                   background:${o.n ? 'linear-gradient(180deg,var(--amber),var(--coral))' : 'var(--line)'}">
              </div>
              <span class="muted" style="font-size:9px">${'SMTWTFS'[o.day]}</span>
            </div>`).join('')}
        </div>
      </div>`;
  }

  /* ---- leaderboard --------------------------------------------------------- */

  async function paintBoard(el) {
    if (!Cloud.configured()) {
      el.innerHTML = `
        <div class="card card--tint">
          <p class="card__note">The leaderboard needs a one-off Firebase setup —
            the steps are in <b>SETUP.md</b>. Everything else works without it.</p>
        </div>`;
      return;
    }
    if (!Cloud.code()) {
      el.innerHTML = `
        <div class="card card--tint">
          <p class="card__note">Enter a family code below and you'll both show up here.</p>
        </div>`;
      return;
    }

    el.innerHTML = `<div class="card card--tint"><p class="card__note">Loading…</p></div>`;
    await Cloud.push();
    const r = await Cloud.fetchBoard();

    if (!r.rows.length) {
      el.innerHTML = `<div class="card card--tint">
        <p class="card__note">${r.ok ? 'Nobody on this code yet — get your sister to type the same one.'
                                     : 'Offline — the board will sync when you have signal.'}</p></div>`;
      return;
    }

    const me = Store.S.profile.id;
    el.innerHTML = `
      ${r.rows.map((row, i) => `
        <div class="row" style="${row.id === me ? 'box-shadow:inset 0 0 0 2.5px var(--amber)' : ''}">
          <span class="row__lead" style="background:${
            i === 0 ? 'var(--amber-soft)' : 'var(--surface-2)'};font-size:19px">
            ${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
          <span class="row__main">
            <span class="row__title">${UI.esc(row.name)}${row.id === me ? ' <span class="pill pill--amber">you</span>' : ''}</span>
            <span class="row__sub">${row.known} known · ${row.accuracy}% accurate</span>
          </span>
          <span class="row__end">🔥 ${row.streak}</span>
        </div>`).join('')}
      <p class="muted small center">${r.stale ? 'Showing the last synced copy — you\'re offline.'
        : 'Updated just now.'}</p>`;
  }

  /* ---- wiring -------------------------------------------------------------- */

  function wire(host) {
    const s = Store.S.settings;

    host.querySelectorAll('[data-go]').forEach(b =>
      b.addEventListener('click', () => App.go(b.dataset.go)));

    host.querySelector('#name').addEventListener('change', e => {
      Store.S.profile.name = e.target.value.trim();
      Store.saveProfile();
      Cloud.push();
      UI.toast('Saved');
    });

    host.querySelectorAll('[data-new]').forEach(b =>
      b.addEventListener('click', () => {
        s.newPerDay = +b.dataset.new;
        Store.saveSettings();
        App.render();
      }));

    host.querySelectorAll('[data-pinyin]').forEach(b =>
      b.addEventListener('click', () => {
        s.pinyinMode = b.dataset.pinyin;
        Store.saveSettings();
        App.render();
      }));

    host.querySelectorAll('[data-toggle]').forEach(b =>
      b.addEventListener('click', () => {
        const id = b.dataset.toggle;
        if (id === 'theme') {
          const isDark = document.documentElement.dataset.theme === 'dark';
          s.theme = isDark ? 'light' : 'dark';
        } else {
          s[id] = !s[id];
        }
        Store.saveSettings();
        App.render();
      }));

    const rate = host.querySelector('#rate');
    rate.addEventListener('change', () => {
      s.rate = +rate.value;
      Store.saveSettings();
      Audio2.speak('你好');
    });

    host.querySelector('#testVoice').addEventListener('click', () =>
      Audio2.speak('你好，我叫麋鹿。很高兴认识你。'));

    const code = host.querySelector('#code');
    code.addEventListener('change', async () => {
      const old = s.familyCode;
      if (old && old !== code.value.trim().toUpperCase()) await Cloud.leave();
      s.familyCode = code.value.trim().toUpperCase();
      Store.saveSettings();
      await Cloud.push();
      App.render();
    });

    host.querySelector('#addWord').addEventListener('click', addWordSheet);

    host.querySelector('#reset').addEventListener('click', () => {
      const s2 = UI.sheet(`
        <h3 style="font-size:19px;font-weight:800">Reset everything?</h3>
        <p class="card__note" style="margin:8px 0 16px">
          This wipes your progress, streak, settings and any words you've added
          on this device. It can't be undone.</p>
        <button class="btn btn--bad btn--block" id="yes">Yes, wipe it</button>
        <button class="btn btn--ghost btn--block" id="no" style="margin-top:9px">Cancel</button>`);
      s2.querySelector('#no').addEventListener('click', () => UI.closeSheet());
      s2.querySelector('#yes').addEventListener('click', () => {
        Store.reset();
        location.hash = '#/today';
        location.reload();
      });
    });
  }

  function fillVoices(host) {
    const sel = host.querySelector('#voice');
    const note = host.querySelector('#voiceNote');
    if (!sel) return;

    function paint() {
      const list = Audio2.chineseVoices();
      if (!list.length) {
        note.innerHTML = `No Chinese voice found on this device. On iPhone:
          <b>Settings → Accessibility → Spoken Content → Voices → Chinese</b>,
          then download one (the Enhanced ones sound much better).`;
        sel.classList.add('hidden');
        return;
      }
      sel.classList.remove('hidden');
      note.innerHTML = `${list.length} Chinese voice${list.length === 1 ? '' : 's'} available.
        Downloading an <b>Enhanced</b> or <b>Premium</b> voice in
        Settings → Accessibility → Spoken Content → Voices makes a big difference.`;
      const cur = Audio2.voice;
      sel.innerHTML = list.map(v =>
        `<option value="${UI.esc(v.voiceURI)}"${cur && v.voiceURI === cur.voiceURI ? ' selected' : ''}>
          ${UI.esc(v.name)} — ${UI.esc(v.lang)}</option>`).join('');
    }

    paint();
    setTimeout(paint, 700);
    sel.addEventListener('change', () => {
      Store.S.settings.voiceURI = sel.value;
      Store.saveSettings();
      Audio2.pickVoice();
      Audio2.speak('你好');
    });
  }

  /* ---- add a word by hand --------------------------------------------------- */

  function addWordSheet() {
    const s = UI.sheet(`
      <h3 style="font-size:19px;font-weight:800;margin-bottom:12px">Add a word</h3>
      <div class="stack">
        <input class="field hz" id="w_hz" placeholder="汉字" autocomplete="off">
        <input class="field" id="w_py" placeholder="pīnyīn (with tone marks)" autocomplete="off">
        <input class="field" id="w_en" placeholder="English meaning" autocomplete="off">
      </div>
      <button class="btn btn--primary btn--block" id="save" style="margin-top:14px">Add it</button>
      ${Store.S.custom.length ? `
        <div class="section-title">Your added words</div>
        ${Store.S.custom.slice().reverse().map(w => `
          <div class="row">
            <span class="row__lead hz" style="font-size:19px">${UI.esc(w.hanzi)}</span>
            <span class="row__main">
              <span class="row__title">${UI.esc(w.english)}</span>
              <span class="row__sub">${UI.esc(w.pinyin)}</span>
            </span>
            <button class="btn btn--sm btn--ghost" data-del="${UI.esc(w.id)}">Remove</button>
          </div>`).join('')}` : ''}`);

    s.querySelector('#save').addEventListener('click', () => {
      const hz = s.querySelector('#w_hz').value.trim();
      const py = s.querySelector('#w_py').value.trim();
      const en = s.querySelector('#w_en').value.trim();
      if (!hz || !en) { UI.toast('Characters and meaning are required'); return; }
      const n = Store.addCustomWords([{
        hanzi: hz, pinyin: py, english: en, topic: 'custom',
        lessons: ['custom'], hsk: 0, units: Import.units(hz, py),
        tones: [], chars: [...hz].filter(c => /[㐀-鿿]/.test(c)),
      }]);
      UI.closeSheet();
      UI.toast(n ? 'Added to your deck' : 'You already have that word');
      App.render();
    });

    s.querySelectorAll('[data-del]').forEach(b =>
      b.addEventListener('click', () => {
        Store.removeCustomWord(b.dataset.del);
        UI.closeSheet();
        UI.toast('Removed');
        App.render();
      }));
  }
})();

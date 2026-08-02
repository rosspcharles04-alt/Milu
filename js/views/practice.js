/* Practice — the hub of everything you can drill on demand. */
(function () {
  const Views = window.Views = window.Views || {};

  Views.practice = function (host) {
    const c = SRS.counts();
    const topics = topicList();

    host.innerHTML = `
      <div class="topbar">
        <div>
          <div class="topbar__title">Practice</div>
          <div class="topbar__sub">练习 · liànxí — pick your poison</div>
        </div>
      </div>

      ${Gamify.mistakeList().length ? `
        <button class="row" id="mistakes" style="background:var(--bad-soft)">
          <span class="row__lead" style="background:transparent;font-size:24px">🩹</span>
          <span class="row__main">
            <span class="row__title">Your mistakes</span>
            <span class="row__sub">${Gamify.mistakeList().length} word${
              Gamify.mistakeList().length === 1 ? '' : 's'} to put right</span>
          </span>
          ${UI.icon('chev', 18)}
        </button>` : ''}

      <div class="section-title">Games</div>
      <div class="grid grid--2">
        <button class="tile card--amber" data-go="#/match">
          <span class="tile__emoji">⚡️</span>
          <span class="tile__label">Match up</span>
          <span class="tile__sub">60 seconds, go</span>
        </button>
        <button class="tile" data-go="#/session">
          <span class="tile__emoji">🎯</span>
          <span class="tile__label">Mixed lesson</span>
          <span class="tile__sub">All exercise types</span>
        </button>
      </div>

      <div class="section-title">Drills</div>
      <div class="grid grid--2">
        <button class="tile" data-go="#/quiz/meaning">
          <span class="tile__emoji">🀄️</span>
          <span class="tile__label">Character → meaning</span>
          <span class="tile__sub">Read and recognise</span>
        </button>
        <button class="tile" data-go="#/quiz/hanzi">
          <span class="tile__emoji">🔤</span>
          <span class="tile__label">Meaning → character</span>
          <span class="tile__sub">Harder direction</span>
        </button>
        <button class="tile" data-go="#/quiz/listen">
          <span class="tile__emoji">🎧</span>
          <span class="tile__label">Listening</span>
          <span class="tile__sub">Ears only</span>
        </button>
        <button class="tile" data-go="#/quiz/pinyin">
          <span class="tile__emoji">🅿️</span>
          <span class="tile__label">Pinyin</span>
          <span class="tile__sub">Get the sounds right</span>
        </button>
        <button class="tile" data-go="#/tones">
          <span class="tile__emoji">🎵</span>
          <span class="tile__label">Tone trainer</span>
          <span class="tile__sub">Hear the difference</span>
        </button>
        <button class="tile" data-go="#/speak">
          <span class="tile__emoji">🎤</span>
          <span class="tile__label">Speaking</span>
          <span class="tile__sub">Say it, see your pitch</span>
        </button>
        <button class="tile" data-go="#/sentences">
          <span class="tile__emoji">🧩</span>
          <span class="tile__label">Sentence builder</span>
          <span class="tile__sub">Word order drills</span>
        </button>
        <button class="tile" data-go="#/write">
          <span class="tile__emoji">✍️</span>
          <span class="tile__label">Writing</span>
          <span class="tile__sub">Trace from memory</span>
        </button>
      </div>

      <div class="section-title">Quiz one topic</div>
      <div class="grid grid--auto">
        ${topics.map(t => `
          <button class="tile center" data-topic="${UI.esc(t.id)}" style="align-items:center">
            <span class="tile__emoji">${UI.topicEmoji(t.id)}</span>
            <span class="tile__label" style="font-size:13px">${UI.esc(cap(t.id))}</span>
            <span class="tile__sub">${t.n} words</span>
          </button>`).join('')}
      </div>

      <div class="section-title">By level</div>
      <div class="grid grid--2">
        <button class="tile" data-go="#/quiz/meaning/hsk/1">
          <span class="tile__emoji">1️⃣</span>
          <span class="tile__label">HSK 1</span>
          <span class="tile__sub">${SRS.pool({ hsk: 1 }).length} words</span>
        </button>
        <button class="tile" data-go="#/quiz/meaning/hsk/2">
          <span class="tile__emoji">2️⃣</span>
          <span class="tile__label">HSK 2</span>
          <span class="tile__sub">${SRS.pool({ hsk: 2 }).length} words</span>
        </button>
      </div>

      <div class="card card--sky" style="margin-top:18px">
        <div class="card__title">📈 Where you're at</div>
        <p class="card__note">${c.started} of ${c.total} words started · ${c.known} solid</p>
        <div class="bar" style="margin-top:10px">
          <div class="bar__fill" style="width:${c.total ? c.started / c.total * 100 : 0}%"></div>
        </div>
      </div>`;

    host.querySelectorAll('[data-go]').forEach(b =>
      b.addEventListener('click', () => { Audio2.unlock(); App.go(b.dataset.go); }));

    host.querySelector('#mistakes')?.addEventListener('click', () => {
      Audio2.unlock();
      App.go('#/session/mistakes');
    });

    host.querySelectorAll('[data-topic]').forEach(b =>
      b.addEventListener('click', () => chooseMode(b.dataset.topic)));
  };

  function chooseMode(topic) {
    const modes = [
      ['meaning', '🀄️', 'Character → meaning'],
      ['hanzi',   '🔤', 'Meaning → character'],
      ['pinyin',  '🅿️', 'Character → pinyin'],
      ['listen',  '🎧', 'Listening'],
      ['match',   '⚡️', 'Match up (timed)'],
    ];
    const s = UI.sheet(`
      <h3 style="font-size:20px;font-weight:800;margin-bottom:4px">
        ${UI.topicEmoji(topic)} ${UI.esc(cap(topic))}</h3>
      <p class="muted small" style="margin-bottom:14px">How do you want to be tested?</p>
      ${modes.map(([id, emoji, label]) => `
        <button class="row" data-mode="${id}">
          <span class="row__lead">${emoji}</span>
          <span class="row__main"><span class="row__title">${label}</span></span>
          ${UI.icon('chev', 18)}
        </button>`).join('')}`);

    s.querySelectorAll('[data-mode]').forEach(b =>
      b.addEventListener('click', () => {
        UI.closeSheet();
        App.go(b.dataset.mode === 'match'
          ? `#/match/topic/${encodeURIComponent(topic)}`
          : `#/quiz/${b.dataset.mode}/topic/${encodeURIComponent(topic)}`);
      }));
  }

  function topicList() {
    const counts = {};
    Store.S.vocab.forEach(w => { counts[w.topic] = (counts[w.topic] || 0) + 1; });
    return Object.entries(counts)
      .map(([id, n]) => ({ id, n }))
      .filter(t => t.n >= 4)
      .sort((a, b) => b.n - a.n);
  }

  const cap = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);
})();

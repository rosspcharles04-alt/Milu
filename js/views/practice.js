/* Practice.

   Deliberately short. The lesson engine already covers recognition, recall and
   production across nine exercise types, so duplicating those as standalone
   quizzes just gave you a worse version of the same drill with no XP, no hearts
   and no adaptation. What's left here is the things a lesson *can't* do:
   a timed game, focused tone work, open-ended speaking, and sentence order. */
(function () {
  const Views = window.Views = window.Views || {};

  const cap = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);

  function topicList() {
    const counts = {};
    Store.S.vocab.forEach(w => { counts[w.topic] = (counts[w.topic] || 0) + 1; });
    return Object.entries(counts)
      .map(([id, n]) => ({ id, n }))
      .filter(t => t.n >= 6)
      .sort((a, b) => b.n - a.n);
  }

  Views.practice = function (host) {
    const c = SRS.counts();
    const mistakes = Gamify.mistakeList();
    const topics = topicList();

    host.innerHTML = `
      <div class="topbar">
        <div>
          <div class="topbar__title">Practice</div>
          <div class="topbar__sub">练习 · liànxí</div>
        </div>
      </div>

      ${mistakes.length ? `
        <button class="row" id="mistakes" style="background:var(--bad-soft)">
          <span class="row__lead" style="background:transparent;font-size:24px">🩹</span>
          <span class="row__main">
            <span class="row__title">Fix your mistakes</span>
            <span class="row__sub">${mistakes.length} word${mistakes.length === 1 ? '' : 's'} to put right</span>
          </span>
          ${UI.icon('chev', 18)}
        </button>` : ''}

      <div class="grid grid--2" style="margin-top:4px">
        <button class="tile card--amber" data-go="#/match">
          <span class="tile__emoji">⚡️</span>
          <span class="tile__label">Match up</span>
          <span class="tile__sub">60 seconds, go</span>
        </button>
        <button class="tile" data-go="#/tones">
          <span class="tile__emoji">🎵</span>
          <span class="tile__label">Tones</span>
          <span class="tile__sub">Shapes, ear test, rules</span>
        </button>
        <button class="tile" data-go="#/speak">
          <span class="tile__emoji">🎤</span>
          <span class="tile__label">Speaking</span>
          <span class="tile__sub">See your pitch</span>
        </button>
        <button class="tile" data-go="#/sentences">
          <span class="tile__emoji">🧩</span>
          <span class="tile__label">Sentences</span>
          <span class="tile__sub">Word order</span>
        </button>
        <button class="tile" data-go="#/write">
          <span class="tile__emoji">✍️</span>
          <span class="tile__label">Writing</span>
          <span class="tile__sub">From memory</span>
        </button>
        <button class="tile" data-go="#/session">
          <span class="tile__emoji">🎯</span>
          <span class="tile__label">Mixed lesson</span>
          <span class="tile__sub">All nine types</span>
        </button>
      </div>

      <div class="section-title">Focus on one topic</div>
      <p class="muted small" style="margin:-4px 4px 10px">
        Runs a full lesson using only these words.</p>
      <div class="grid grid--auto">
        ${topics.map(t => `
          <button class="tile center" data-topic="${UI.esc(t.id)}" style="align-items:center">
            <span class="tile__emoji">${UI.topicEmoji(t.id)}</span>
            <span class="tile__label" style="font-size:13px">${UI.esc(cap(t.id))}</span>
            <span class="tile__sub">${t.n} words</span>
          </button>`).join('')}
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
      b.addEventListener('click', () => {
        Audio2.unlock();
        App.go('#/session/topic/' + encodeURIComponent(b.dataset.topic));
      }));
  };
})();

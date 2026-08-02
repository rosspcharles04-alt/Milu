/* Study — browse the lessons from Ross's tutor decks, the dialogues, and the
   sentence patterns. Reading and listening, not testing. */
(function () {
  const Views = window.Views = window.Views || {};

  /* ---- lesson list ------------------------------------------------------- */

  Views.study = function (host) {
    const lessons = Store.S.lessons.slice().sort((a, b) => a.order - b.order);

    host.innerHTML = `
      <div class="topbar">
        <div>
          <div class="topbar__title">Study</div>
          <div class="topbar__sub">学习 · xuéxí — your lessons, at your pace</div>
        </div>
      </div>

      <div class="section-title">Your lessons</div>
      ${lessons.map(l => {
        const words = SRS.pool({ lesson: l.id });
        if (!words.length) return '';
        const seen = words.filter(w => SRS.has(w.id)).length;
        return `
          <button class="row" data-lesson="${UI.esc(l.id)}">
            <span class="row__lead">${l.emoji}</span>
            <span class="row__main">
              <span class="row__title">${UI.esc(l.title)}</span>
              <span class="row__sub hz">${UI.esc(l.chinese)} · ${words.length} words</span>
              <span class="bar" style="height:6px;margin-top:6px">
                <span class="bar__fill" style="width:${seen / words.length * 100}%"></span>
              </span>
            </span>
            ${UI.icon('chev', 18)}
          </button>`;
      }).join('')}

      <div class="section-title">Conversations</div>
      ${Store.S.dialogues.map(d => `
        <button class="row" data-dialogue="${UI.esc(d.id)}">
          <span class="row__lead">${d.emoji}</span>
          <span class="row__main">
            <span class="row__title">${UI.esc(d.title)}</span>
            <span class="row__sub">${d.lines.length} lines</span>
          </span>
          ${UI.icon('play', 18)}
        </button>`).join('')}

      <div class="section-title">Sentence patterns</div>
      ${Store.S.patterns.map(p => `
        <button class="row" data-pattern="${UI.esc(p.id)}">
          <span class="row__lead hz" style="font-size:17px">句</span>
          <span class="row__main">
            <span class="row__title hz" style="font-size:17px">${UI.esc(p.hanzi)}</span>
            <span class="row__sub">${UI.esc(p.english)}</span>
          </span>
          ${UI.icon('chev', 18)}
        </button>`).join('')}`;

    host.querySelectorAll('[data-lesson]').forEach(b =>
      b.addEventListener('click', () => App.go('#/lesson/' + encodeURIComponent(b.dataset.lesson))));
    host.querySelectorAll('[data-dialogue]').forEach(b =>
      b.addEventListener('click', () => App.go('#/dialogue/' + encodeURIComponent(b.dataset.dialogue))));
    host.querySelectorAll('[data-pattern]').forEach(b =>
      b.addEventListener('click', () => patternSheet(b.dataset.pattern)));
  };

  /* ---- one lesson -------------------------------------------------------- */

  Views.lesson = function (host, args) {
    const id = args[0];
    const lesson = Store.S.lessons.find(l => l.id === id);
    const words = SRS.pool({ lesson: id });
    if (!lesson) return App.go('#/study');

    host.innerHTML = `
      <div class="topbar">
        <button class="icon-btn" id="back" aria-label="Back">${UI.icon('back', 20)}</button>
        <div style="min-width:0">
          <div class="topbar__title" style="font-size:21px">${lesson.emoji} ${UI.esc(lesson.title)}</div>
          <div class="topbar__sub hz">${UI.esc(lesson.chinese)}</div>
        </div>
      </div>

      <div class="card card--amber">
        <p class="card__note">${UI.esc(lesson.subtitle)}</p>
        <div class="hstack" style="margin-top:12px">
          <button class="btn btn--primary btn--sm flex1" id="quiz">Quiz me on these</button>
          <button class="btn btn--ghost btn--sm" id="playAll">${UI.icon('play', 16)} Play all</button>
        </div>
      </div>

      <div class="section-title">${words.length} words</div>
      ${words.map(w => {
        const c = Store.S.progress[w.id];
        const dot = !c ? 'var(--line)'
                  : c.interval >= 21 ? 'var(--mint)'
                  : c.state === 'review' ? 'var(--amber)' : 'var(--coral)';
        return `
          <button class="row" data-word="${UI.esc(w.id)}">
            <span class="row__lead hz" style="font-size:22px;background:var(--amber-soft)">
              ${UI.esc(w.hanzi.slice(0, 2))}</span>
            <span class="row__main">
              <span class="row__title">${UI.esc(w.english)}</span>
              <span class="row__sub">${UI.esc(w.pinyin)}</span>
            </span>
            <span style="width:9px;height:9px;border-radius:50%;background:${dot};flex:none"></span>
          </button>`;
      }).join('')}`;

    host.querySelector('#back').addEventListener('click', () => App.go('#/study'));
    host.querySelector('#quiz').addEventListener('click', () =>
      App.go(`#/quiz/meaning/lesson/${encodeURIComponent(id)}`));
    host.querySelector('#playAll').addEventListener('click', () => playAll(words));
    host.querySelectorAll('[data-word]').forEach(b =>
      b.addEventListener('click', () => wordSheet(b.dataset.word)));
  };

  let playing = false;
  async function playAll(words) {
    if (playing) { playing = false; return; }
    playing = true;
    for (const w of words) {
      if (!playing) break;
      await Audio2.speak(w.hanzi);
      await new Promise(r => setTimeout(r, 420));
    }
    playing = false;
  }

  /* ---- word detail sheet -------------------------------------------------- */

  function wordSheet(id) {
    const w = Store.S.byId.get(id);
    if (!w) return;
    const c = Store.S.progress[id];

    const s = UI.sheet(`
      <div class="center">
        ${UI.ruby(w, { size: '54px' })}
        <div class="en" style="margin-top:10px;font-size:19px;font-weight:700">${UI.esc(w.english)}</div>
        <div class="wrap" style="justify-content:center;margin-top:10px">
          <span class="pill">${UI.topicEmoji(w.topic)} ${UI.esc(w.topic)}</span>
          ${w.hsk ? `<span class="pill pill--sky">HSK ${w.hsk}</span>` : ''}
          ${c ? `<span class="pill pill--mint">next ${SRS.fmtInterval(c.interval || 0)}</span>` : ''}
        </div>
        <button class="btn btn--primary" id="say" style="margin-top:16px">
          ${UI.icon('sound', 20)} Listen</button>
      </div>

      <div class="section-title">Characters</div>
      <div class="grid grid--auto">
        ${w.chars.map(ch => `
          <button class="char-cell" data-char="${UI.esc(ch)}">${UI.esc(ch)}</button>`).join('')}
      </div>

      <div class="hstack" style="margin-top:18px">
        <button class="btn btn--ghost btn--sm flex1" id="known">Mark as known</button>
        <button class="btn btn--ghost btn--sm flex1" id="reset">Reset progress</button>
      </div>`);

    s.querySelector('#say').addEventListener('click', () => Audio2.speak(w.hanzi));
    s.querySelectorAll('[data-char]').forEach(b =>
      b.addEventListener('click', () => {
        UI.closeSheet();
        App.go('#/char/' + encodeURIComponent(b.dataset.char));
      }));
    s.querySelector('#known').addEventListener('click', () => {
      SRS.markKnown(id); UI.closeSheet(); UI.toast('Marked as known'); App.render();
    });
    s.querySelector('#reset').addEventListener('click', () => {
      SRS.forget(id); UI.closeSheet(); UI.toast('Progress cleared'); App.render();
    });
    setTimeout(() => Audio2.speak(w.hanzi), 260);
  }

  /* ---- pattern sheet ------------------------------------------------------ */

  function patternSheet(id) {
    const p = Store.S.patterns.find(x => x.id === id);
    if (!p) return;
    const s = UI.sheet(`
      <div class="center">
        <div class="hz" style="font-size:32px">${UI.esc(p.hanzi)}</div>
        <div class="py" style="margin-top:4px">${UI.esc(p.pinyin)}</div>
        <div class="en" style="margin-top:2px">${UI.esc(p.english)}</div>
      </div>
      <div class="card card--amber" style="margin-top:16px">
        <div class="card__title">💡 The rule</div>
        <p class="card__note">${UI.esc(p.note)}</p>
      </div>
      <div class="section-title">Examples</div>
      ${p.examples.map(ex => `
        <button class="row" data-say="${UI.esc(ex.hanzi)}">
          <span class="row__main">
            <span class="row__title hz" style="font-size:19px">${UI.esc(ex.hanzi)}</span>
            <span class="row__sub">${UI.esc(ex.pinyin)}</span>
            <span class="row__sub">${UI.esc(ex.english)}</span>
          </span>
          ${UI.icon('sound', 18)}
        </button>`).join('')}
      <button class="btn btn--primary btn--block" id="build" style="margin-top:14px">
        Practise building these</button>`);

    s.querySelectorAll('[data-say]').forEach(b =>
      b.addEventListener('click', () => Audio2.speak(b.dataset.say)));
    s.querySelector('#build').addEventListener('click', () => {
      UI.closeSheet();
      App.go('#/sentences/' + encodeURIComponent(id));
    });
  }

  /* ---- dialogue player ---------------------------------------------------- */

  Views.dialogue = function (host, args) {
    const d = Store.S.dialogues.find(x => x.id === args[0]);
    if (!d) return App.go('#/study');

    const st = { i: -1, mode: 'read', role: 'A', playing: false };
    draw();

    function draw() {
      host.innerHTML = `
        <div class="session__head">
          <button class="icon-btn" id="back" aria-label="Back">${UI.icon('back', 20)}</button>
          <div style="flex:1;min-width:0">
            <div style="font-weight:800;font-size:17px">${d.emoji} ${UI.esc(d.title)}</div>
            <div class="muted small">${st.mode === 'read' ? 'Read along' : `You are ${st.role}`}</div>
          </div>
          <button class="btn btn--sm btn--ghost" id="mode">
            ${st.mode === 'read' ? '🎭 Role-play' : '📖 Read'}
          </button>
        </div>

        <div style="flex:1;overflow-y:auto;padding:4px 0" id="lines">
          ${d.lines.map((ln, k) => lineHtml(ln, k)).join('')}
        </div>

        <div class="session__foot">
          ${st.mode === 'read'
            ? `<button class="btn btn--primary btn--block" id="play">
                 ${st.playing ? '⏸ Stop' : '▶︎ Play the conversation'}</button>`
            : `<div class="hstack">
                 <button class="btn btn--ghost flex1" id="swap">Swap role</button>
                 <button class="btn btn--primary flex1" id="next">
                   ${st.i >= d.lines.length - 1 ? 'Start again' : 'Next line'}</button>
               </div>`}
        </div>`;

      host.querySelector('#back').addEventListener('click', () => App.go('#/study'));
      host.querySelector('#mode').addEventListener('click', () => {
        st.mode = st.mode === 'read' ? 'play' : 'read';
        st.i = st.mode === 'play' ? -1 : -1;
        st.playing = false;
        draw();
      });
      host.querySelectorAll('[data-line]').forEach(b =>
        b.addEventListener('click', () => Audio2.speak(d.lines[+b.dataset.line].hanzi)));
      host.querySelector('#play')?.addEventListener('click', playThrough);
      host.querySelector('#swap')?.addEventListener('click', () => {
        st.role = st.role === 'A' ? 'B' : 'A'; st.i = -1; draw();
      });
      host.querySelector('#next')?.addEventListener('click', advance);
    }

    function lineHtml(ln, k) {
      const isB = ln.speaker === 'B';
      let cls = 'line' + (isB ? ' line--b' : '');
      let body;

      if (st.mode === 'play') {
        if (k > st.i) {
          cls += ' line--muted';
          body = `<div class="line__hz">· · ·</div>`;
        } else if (ln.speaker === st.role && k === st.i) {
          cls += ' line--active';
          body = `<div class="line__hz">${UI.esc(ln.hanzi)}</div>
                  <div class="line__py">${UI.esc(ln.pinyin)}</div>
                  <div class="line__en">👈 your line — say it out loud</div>`;
        } else {
          body = `<div class="line__hz">${UI.esc(ln.hanzi)}</div>
                  <div class="line__py">${UI.esc(ln.pinyin)}</div>
                  <div class="line__en">${UI.esc(ln.english)}</div>`;
        }
      } else {
        body = `<div class="line__hz">${UI.esc(ln.hanzi)}</div>
                <div class="line__py">${UI.esc(ln.pinyin)}</div>
                <div class="line__en">${UI.esc(ln.english)}</div>`;
      }

      return `<div class="${cls}${k === st.i && st.mode === 'read' ? ' line--active' : ''}">
                <div class="line__who">${ln.speaker}</div>
                <button class="line__bubble" data-line="${k}">${body}</button>
              </div>`;
    }

    async function playThrough() {
      if (st.playing) { st.playing = false; Audio2.stop(); draw(); return; }
      st.playing = true;
      draw();
      for (let k = 0; k < d.lines.length; k++) {
        if (!st.playing) break;
        st.i = k;
        draw();
        host.querySelector(`[data-line="${k}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        await Audio2.speak(d.lines[k].hanzi);
        await new Promise(r => setTimeout(r, 480));
      }
      st.playing = false;
      st.i = -1;
      draw();
    }

    async function advance() {
      if (st.i >= d.lines.length - 1) { st.i = -1; draw(); return; }
      st.i++;
      draw();
      const ln = d.lines[st.i];
      host.querySelector(`[data-line="${st.i}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (ln.speaker !== st.role) await Audio2.speak(ln.hanzi);
    }
  };
})();

/* The daily study session: new words get taught, then everything gets tested
   and scheduled. */
(function () {
  const Views = window.Views = window.Views || {};

  Views.session = function (host) {
    const queue = SRS.session();
    if (!queue.length) return done(host, { reviewed: 0, right: 0, learned: 0, empty: true });

    const state = { i: 0, queue, reviewed: 0, right: 0, learned: 0, revealed: false, t0: Date.now() };
    render(host, state);
  };

  function render(host, st) {
    if (st.i >= st.queue.length) {
      const secs = Math.round((Date.now() - st.t0) / 1000);
      Store.dayEntry().seconds += secs;
      Store.saveStats();
      Cloud.push();
      return done(host, st);
    }

    const w = st.queue[st.i];
    const card = Store.S.progress[w.id];
    const isNew = !card || card.state === 'new';
    st.revealed = isNew;               // new words are shown in full straight away

    host.innerHTML = shell(st, w, isNew);
    wire(host, st, w, isNew);

    if (isNew) setTimeout(() => Audio2.speak(w.hanzi), 260);
  }

  function shell(st, w, isNew) {
    const pct = st.i / st.queue.length;
    const showPy = isNew || st.revealed || SRS.showPinyin(w.id);

    return `
      <div class="session__head">
        <button class="icon-btn" id="quit" aria-label="End session">${UI.icon('close', 18)}</button>
        <div class="bar flex1"><div class="bar__fill" style="width:${pct * 100}%"></div></div>
        <span class="chip chip--amber">${st.i + 1}/${st.queue.length}</span>
      </div>

      <div class="session__body">
        ${isNew ? `<span class="pill pill--mint">New word</span>` : ''}
        ${UI.ruby(w, { size: 'clamp(58px,19vw,100px)', hidePinyin: !showPy })}
        <button class="btn btn--round" id="say" aria-label="Play pronunciation"
                style="background:var(--amber-soft);color:var(--amber-deep)">
          ${UI.icon('sound', 24)}
        </button>
        <div id="answer" class="${st.revealed ? '' : 'hidden'}">
          <div class="en" style="font-size:20px;font-weight:700">${UI.esc(w.english)}</div>
          ${meta(w)}
        </div>
      </div>

      <div class="session__foot" id="foot">${isNew ? newFoot(w) : reviewFoot(st, w)}</div>`;
  }

  function meta(w) {
    const bits = [];
    if (w.topic) bits.push(`<span class="pill">${UI.topicEmoji(w.topic)} ${UI.esc(w.topic)}</span>`);
    if (w.hsk) bits.push(`<span class="pill pill--sky">HSK ${w.hsk}</span>`);
    (w.lessons || []).filter(l => !/^hsk/.test(l) && l !== 'food').forEach(l => {
      const les = Store.S.lessons.find(x => x.id === l);
      if (les) bits.push(`<span class="pill pill--amber">${les.emoji} ${UI.esc(les.title)}</span>`);
    });
    return `<div class="wrap" style="justify-content:center;margin-top:12px">${bits.join('')}</div>`;
  }

  function newFoot(w) {
    return `
      <div class="hstack">
        <button class="btn btn--ghost flex1" id="skip">I know this</button>
        <button class="btn btn--ghost" id="study" aria-label="Study the characters">
          ${UI.icon('brush', 20)}
        </button>
      </div>
      <button class="btn btn--primary btn--block" id="got">Got it</button>`;
  }

  function reviewFoot(st, w) {
    if (!st.revealed) {
      return `<button class="btn btn--primary btn--block" id="reveal">Show answer</button>`;
    }
    const g = i => SRS.preview(w.id, i);
    return `
      <div class="grid grid--2" style="gap:9px">
        <button class="btn btn--bad" data-grade="0">Again<br><span class="small"
          style="font-weight:600;opacity:.85">${g(0)}</span></button>
        <button class="btn" data-grade="1" style="background:var(--amber-soft);color:var(--amber-deep)">
          Hard<br><span class="small" style="font-weight:600;opacity:.8">${g(1)}</span></button>
        <button class="btn btn--good" data-grade="2">Good<br><span class="small"
          style="font-weight:600;opacity:.85">${g(2)}</span></button>
        <button class="btn" data-grade="3" style="background:var(--sky-soft);color:var(--sky)">
          Easy<br><span class="small" style="font-weight:600;opacity:.8">${g(3)}</span></button>
      </div>`;
  }

  function wire(host, st, w, isNew) {
    host.querySelector('#quit').addEventListener('click', () => App.go('#/today'));
    host.querySelector('#say').addEventListener('click', () => Audio2.speak(w.hanzi));

    const reveal = host.querySelector('#reveal');
    if (reveal) {
      reveal.addEventListener('click', () => {
        st.revealed = true;
        host.querySelector('#answer').classList.remove('hidden');
        host.querySelector('.ruby')?.classList.remove('ruby--hide');
        host.querySelector('#foot').innerHTML = reviewFoot(st, w);
        wireGrades(host, st, w);
        Audio2.speak(w.hanzi);
      });
    }

    const got = host.querySelector('#got');
    if (got) {
      got.addEventListener('click', () => {
        SRS.answer(w.id, 2);
        st.learned++;
        st.reviewed++;
        st.right++;
        Audio2.pop();
        st.i++;
        render(host, st);
      });
    }

    const skip = host.querySelector('#skip');
    if (skip) {
      skip.addEventListener('click', () => {
        SRS.markKnown(w.id);
        UI.toast('Marked as known');
        st.i++;
        render(host, st);
      });
    }

    const study = host.querySelector('#study');
    if (study) study.addEventListener('click', () => App.go('#/char/' + encodeURIComponent(w.hanzi[0])));

    if (!isNew) wireGrades(host, st, w);
  }

  function wireGrades(host, st, w) {
    host.querySelectorAll('[data-grade]').forEach(btn => {
      btn.addEventListener('click', () => {
        const grade = +btn.dataset.grade;
        SRS.answer(w.id, grade);
        st.reviewed++;
        if (grade > 0) { st.right++; Audio2.pop(); } else { Audio2.buzz(); }
        Audio2.buzzPhone(grade > 0 ? 8 : [14, 40, 14]);
        // A lapsed card comes back later in the same session.
        if (grade === 0) st.queue.push(w);
        st.i++;
        render(host, st);
      });
    });
  }

  /* ---- finished ---------------------------------------------------------- */

  function done(host, st) {
    const acc = st.reviewed ? Math.round(st.right / st.reviewed * 100) : 0;
    const streak = Store.liveStreak();
    const c = SRS.counts();

    if (st.reviewed >= 5) { UI.confetti(); Audio2.fanfare(); }

    host.innerHTML = `
      <div class="session__body">
        ${Mascot.svg(st.empty ? 'idle' : 'cheer', 132)}
        <h2 style="font-size:26px;font-weight:800;margin-top:6px">
          ${st.empty ? 'Nothing due right now' : '做得好！'}
        </h2>
        ${st.empty ? '' : `<div class="py">Zuò de hǎo! — Well done!</div>`}

        ${st.empty ? `
          <p class="card__note center" style="max-width:300px">
            You've cleared everything scheduled for now. Come back later, or
            keep going with free practice.</p>` : `
          <div class="card" style="width:100%;display:flex;justify-content:space-around">
            <div class="stat"><div class="stat__num">${st.reviewed}</div>
              <div class="stat__label">Reviewed</div></div>
            <div class="stat"><div class="stat__num" style="color:var(--mint)">${acc}%</div>
              <div class="stat__label">Correct</div></div>
            <div class="stat"><div class="stat__num" style="color:var(--amber-deep)">${st.learned}</div>
              <div class="stat__label">New</div></div>
          </div>
          <div class="chip chip--flame">🔥 ${streak} day streak</div>`}
      </div>

      <div class="session__foot">
        ${c.due + c.fresh > 0
          ? `<button class="btn btn--primary btn--block" id="more">Keep going · ${c.due + c.fresh} left</button>`
          : `<button class="btn btn--primary btn--block" id="practise">Free practice</button>`}
        <button class="btn btn--ghost btn--block" id="home">Done for now</button>
      </div>`;

    host.querySelector('#home').addEventListener('click', () => App.go('#/today'));
    host.querySelector('#more')?.addEventListener('click', () => Views.session(host));
    host.querySelector('#practise')?.addEventListener('click', () => App.go('#/practice'));
  }
})();

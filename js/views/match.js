/* Match pairs — tap a character, tap its meaning, clear the board.

   Duolingo's Match Madness. It's the fastest way to churn through a lot of
   recognition in a short burst, and the timer makes it genuinely fun. Pairs
   refill as you clear them, so a good run keeps going. */
(function () {
  const Views = window.Views = window.Views || {};

  const PAIRS_ON_BOARD = 5;
  const ROUND_SECONDS = 60;

  Views.match = function (host, args) {
    args = args || [];
    const filter = args[0] === 'lesson' ? { lesson: args[1] }
                 : args[0] === 'topic'  ? { topic: args[1] }
                 : null;
    let pool = SRS.pool(filter).filter(w => w.english && w.hanzi);
    // Prefer words already met so it's a test, not a guess.
    const met = pool.filter(w => SRS.has(w.id));
    if (met.length >= 12) pool = met;
    if (pool.length < PAIRS_ON_BOARD) {
      host.innerHTML = `<div class="session__body">${Mascot.svg('think', 110)}
        <p class="card__note center">Not enough words for this yet.</p></div>
        <div class="session__foot"><button class="btn btn--primary btn--block"
          onclick="location.hash='#/practice'">Back</button></div>`;
      return;
    }

    const st = {
      pool: UI.shuffle(pool),
      next: 0,
      board: [],
      sel: null,
      matched: 0,
      misses: 0,
      combo: 0,
      best: 0,
      left: ROUND_SECONDS,
      over: false,
      ses: Gamify.newSession({ noHearts: true }),
    };

    start();

    function take() {
      if (st.next >= st.pool.length) { st.pool = UI.shuffle(st.pool); st.next = 0; }
      return st.pool[st.next++];
    }

    function fill() {
      while (st.board.length < PAIRS_ON_BOARD) {
        const w = take();
        if (st.board.some(b => b.word.id === w.id)) continue;
        st.board.push({ word: w, cleared: false });
      }
    }

    function start() {
      fill();
      draw();
      const timer = setInterval(() => {
        if (st.over) return clearInterval(timer);
        st.left--;
        const el = host.querySelector('#clock');
        if (el) {
          el.textContent = `${st.left}s`;
          el.style.color = st.left <= 10 ? 'var(--bad)' : '';
        }
        const bar = host.querySelector('#timebar');
        if (bar) bar.style.width = `${st.left / ROUND_SECONDS * 100}%`;
        if (st.left <= 0) { clearInterval(timer); over(); }
      }, 1000);
    }

    function draw() {
      const live = st.board.filter(b => !b.cleared);
      const left = UI.shuffle(live.map(b => ({ id: b.word.id, side: 'hz', w: b.word })));
      const right = UI.shuffle(live.map(b => ({ id: b.word.id, side: 'en', w: b.word })));

      host.innerHTML = `
        <div class="session__head">
          <button class="icon-btn" id="quit" aria-label="Quit">${UI.icon('close', 18)}</button>
          <div class="flex1">
            <div class="bar" style="height:9px">
              <div class="bar__fill" id="timebar" style="width:${st.left / ROUND_SECONDS * 100}%"></div>
            </div>
          </div>
          <span class="chip chip--amber" id="clock">${st.left}s</span>
        </div>

        <div class="hstack" style="justify-content:space-between;margin-bottom:10px">
          <span class="chip chip--mint">${st.matched} matched</span>
          ${st.combo >= 3 ? `<span class="chip chip--flame">⚡︎ ${st.combo} streak</span>` : ''}
          <span class="chip">${st.ses.xp} XP</span>
        </div>

        <div class="session__body" style="justify-content:flex-start">
          <div class="match-grid" style="width:100%">
            ${left.map((o, i) => `
              <button class="match-tile" data-id="${UI.esc(o.id)}" data-side="hz">
                <span class="hz">${UI.esc(o.w.hanzi)}</span>
              </button>
              <button class="match-tile" data-id="${UI.esc(right[i].id)}" data-side="en">
                ${UI.esc(right[i].w.english)}
              </button>`).join('')}
          </div>
        </div>`;

      host.querySelector('#quit').addEventListener('click', () => { st.over = true; App.go('#/practice'); });
      host.querySelectorAll('.match-tile').forEach(t =>
        t.addEventListener('click', () => tap(t)));
    }

    function tap(tile) {
      if (st.over || tile.classList.contains('match-tile--gone')) return;

      if (tile.dataset.side === 'hz') Audio2.speak(tile.dataset.id);

      if (!st.sel) {
        st.sel = tile;
        tile.classList.add('match-tile--sel');
        return;
      }
      if (st.sel === tile) {
        tile.classList.remove('match-tile--sel');
        st.sel = null;
        return;
      }
      // Two tiles from the same column: move the selection instead.
      if (st.sel.dataset.side === tile.dataset.side) {
        st.sel.classList.remove('match-tile--sel');
        st.sel = tile;
        tile.classList.add('match-tile--sel');
        return;
      }

      const a = st.sel, b = tile;
      st.sel = null;
      a.classList.remove('match-tile--sel');

      if (a.dataset.id === b.dataset.id) {
        const word = Store.S.byId.get(a.dataset.id);
        a.classList.add('match-tile--right');
        b.classList.add('match-tile--right');
        st.matched++;
        st.combo++;
        st.best = Math.max(st.best, st.combo);

        const r = Gamify.score(st.ses, true, false);
        Gamify.floatXP(b, r.xp);
        if (r.milestone) Gamify.showCombo(`${st.combo} in a row!`);
        Audio2.ding();

        // Credit it in the scheduler as an easy recognition hit.
        const c = Store.S.progress[word.id];
        if (c) SRS.answer(word.id, 1);
        Gamify.clearMistake(word.id);

        setTimeout(() => {
          a.classList.add('match-tile--gone');
          b.classList.add('match-tile--gone');
          const entry = st.board.find(x => x.word.id === word.id);
          if (entry) entry.cleared = true;
          setTimeout(() => {
            if (st.over) return;
            st.board = st.board.filter(x => !x.cleared);
            fill();
            draw();
          }, 180);
        }, 260);
      } else {
        st.misses++;
        st.combo = 0;
        Gamify.score(st.ses, false, false);
        Gamify.logMistake(a.dataset.side === 'hz' ? a.dataset.id : b.dataset.id, 'match');
        Audio2.buzz();
        Audio2.buzzPhone([14, 40, 14]);
        [a, b].forEach(el => {
          el.classList.add('match-tile--wrong');
          setTimeout(() => el.classList.remove('match-tile--wrong'), 420);
        });
      }
    }

    function over() {
      st.over = true;
      const res = Gamify.finish(st.ses);
      const badges = Gamify.checkBadges();
      Cloud.push();
      if (st.matched >= 12) { UI.confetti(); Audio2.fanfare(); }

      host.innerHTML = `
        <div class="session__body">
          ${Mascot.svg(st.matched >= 12 ? 'cheer' : 'proud', 124)}
          <h2 style="font-size:27px;font-weight:800">${st.matched} matched</h2>
          <div class="card" style="width:100%;display:flex;justify-content:space-around">
            <div class="stat"><div class="stat__num" style="color:var(--amber-deep)">${res.total}</div>
              <div class="stat__label">XP</div></div>
            <div class="stat"><div class="stat__num" style="color:var(--coral)">${st.best}</div>
              <div class="stat__label">Best streak</div></div>
            <div class="stat"><div class="stat__num" style="color:var(--bad)">${st.misses}</div>
              <div class="stat__label">Misses</div></div>
          </div>
        </div>
        <div class="session__foot">
          <button class="btn btn--primary btn--block" id="again">Play again</button>
          <button class="btn btn--ghost btn--block" id="back">Done</button>
        </div>`;

      host.querySelector('#again').addEventListener('click', () => Views.match(host, args));
      host.querySelector('#back').addEventListener('click', () => App.go('#/practice'));
      Gamify.celebrate(badges);
    }
  };
})();

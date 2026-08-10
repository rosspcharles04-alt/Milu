/* A lesson.

   The old version was a flashcard you graded yourself. This one is a run of
   mixed exercises chosen per word by how well it's known — recognise it, then
   recall it, then produce it — with hearts, XP and a combo on top. That's the
   Duolingo/HelloChinese shape, and it works far better than self-grading. */
(function () {
  const Views = window.Views = window.Views || {};

  const LESSON_LEN = 14;   // exercises per lesson, ~5 minutes
  const MAX_RETRIES = 1;   // times a missed word comes back within the lesson
  const MAX_QUEUE = 22;    // hard ceiling so a bad run still ends

  /**
   * @param args  []              the daily mix
   *              ['lesson', id]  one deck
   *              ['topic', name] one topic
   *              ['mistakes']    only words previously got wrong
   */
  Views.session = async function (host, args) {
    args = args || [];
    const mode = args[0] || 'daily';
    const words = buildQueue(mode, args[1]);

    if (!words.length) return empty(host, mode);

    await Hanzi.load().catch(() => {});   // so tracing exercises are available

    const filter = mode === 'lesson' ? { lesson: args[1] }
                 : mode === 'topic'  ? { topic: args[1] }
                 : null;

    const st = {
      mode,
      arg: args[1] || null,
      lessonId: mode === 'lesson' ? args[1] : null,
      pool: SRS.pool(filter),
      queue: words.map(w => ({ word: w, kind: null })),
      i: 0,
      lastKind: null,
      ses: Gamify.newSession(),
      wrongWords: [],
      t0: Date.now(),
    };
    if (!st.pool.length) st.pool = Store.S.vocab;

    run(host, st);
  };

  /**
   * Should a missed word come back later in this lesson?
   *
   * Duolingo re-asks what you got wrong, but re-queueing on *every* miss makes
   * the queue grow exactly as fast as the learner works through it, so the
   * lesson never ends — with hearts switched off it runs forever. Allowing one
   * retry per word, under a hard ceiling, keeps the second chance and
   * guarantees termination.
   */
  function shouldRequeue(retries, queueLength) {
    return retries <= MAX_RETRIES && queueLength < MAX_QUEUE;
  }

  /* ---- building the queue ----------------------------------------------------- */

  function buildQueue(mode, id) {
    if (mode === 'mistakes') {
      return Gamify.mistakeList().slice(0, LESSON_LEN).map(m => m.word);
    }
    if (mode === 'lesson' || mode === 'topic') {
      const all = SRS.pool(mode === 'lesson' ? { lesson: id } : { topic: id });
      // Unseen words first, then whatever is due, then a refresher.
      const unseen = all.filter(w => !SRS.has(w.id));
      const due = all.filter(w => {
        const c = Store.S.progress[w.id];
        return c && c.due <= Date.now();
      });
      const rest = all.filter(w => SRS.has(w.id) && !due.includes(w));
      return unseen.slice(0, 6)
        .concat(UI.shuffle(due).slice(0, 6))
        .concat(UI.shuffle(rest).slice(0, 4))
        .slice(0, LESSON_LEN);
    }
    return SRS.session(LESSON_LEN);
  }

  /* ---- the loop ---------------------------------------------------------------- */

  async function run(host, st) {
    while (st.i < st.queue.length) {
      const step = st.queue[st.i];
      const word = step.word;
      const kind = Exercises.pick(word, st.lastKind);
      st.lastKind = kind;

      host.innerHTML = chrome(st);
      const body = host.querySelector('#exHost');
      wireChrome(host, st);

      const result = await Exercises.run(kind, body, word, { pool: st.pool });

      if (result.skipped) {
        // A teach card isn't graded — it just introduces the word.
        if (!SRS.has(word.id)) SRS.answer(word.id, 2);
        st.i++;
        continue;
      }

      const r = Gamify.score(st.ses, result.correct, result.hard);

      if (result.correct) {
        const c = Store.S.progress[word.id];
        SRS.answer(word.id, result.hard ? 3 : (c && c.streak >= 2 ? 2 : 1));
        Gamify.clearMistake(word.id);
        if (r.milestone) Gamify.showCombo(`${st.ses.combo} in a row! +${r.xp} XP`);
      } else {
        SRS.answer(word.id, 0);
        Gamify.logMistake(word.id, kind);
        if (!st.wrongWords.includes(word)) st.wrongWords.push(word);

        step.retries = (step.retries || 0) + 1;
        if (shouldRequeue(step.retries, st.queue.length)) {
          st.queue.push({ word, kind: null, retries: step.retries });
        }
      }

      st.i++;

      if (r.dead) {
        const carryOn = await outOfHearts(host, st);
        if (!carryOn) break;
      }
    }
    finish(host, st);
  }

  /* ---- the frame around each exercise -------------------------------------------- */

  function chrome(st) {
    const pct = st.i / st.queue.length * 100;
    return `
      <div class="session__head">
        <button class="icon-btn" id="quit" aria-label="Quit lesson">${UI.icon('close', 18)}</button>
        <div class="bar flex1"><div class="bar__fill" style="width:${pct}%"></div></div>
        ${Gamify.heartsHTML(st.ses)}
        <span class="chip chip--mint" id="xpChip">${st.ses.xp} XP</span>
      </div>
      <div id="exHost" style="display:flex;flex-direction:column;flex:1"></div>`;
  }

  function wireChrome(host, st) {
    host.querySelector('#quit').addEventListener('click', () => confirmQuit(host, st));
  }

  function confirmQuit(host, st) {
    if (st.ses.answered === 0) return App.go('#/today');
    const s = UI.sheet(`
      <div class="center">
        ${Mascot.svg('sad', 92)}
        <h3 style="font-size:19px;font-weight:800;margin-top:6px">Leave the lesson?</h3>
        <p class="card__note" style="margin:6px 0 16px">
          You'll keep the ${st.ses.xp} XP you've earned, but the rest of this
          lesson won't count.</p>
      </div>
      <button class="btn btn--primary btn--block" id="stay">Keep going</button>
      <button class="btn btn--ghost btn--block" id="leave" style="margin-top:9px;color:var(--bad)">
        Leave</button>`);
    s.querySelector('#stay').addEventListener('click', () => UI.closeSheet());
    s.querySelector('#leave').addEventListener('click', () => {
      UI.closeSheet();
      Gamify.finish(st.ses);
      App.go('#/today');
    });
  }

  /* ---- hearts ------------------------------------------------------------------- */

  function outOfHearts(host, st) {
    return new Promise(resolve => {
      const s = UI.sheet(`
        <div class="center">
          ${Mascot.svg('sad', 100)}
          <h3 style="font-size:20px;font-weight:800;margin-top:6px">Out of hearts</h3>
          <p class="card__note" style="margin:6px 0 16px">
            Five slips this lesson. Take a breath — or carry on with a fresh set.</p>
        </div>
        <button class="btn btn--primary btn--block" id="refill">Carry on with 5 more</button>
        <button class="btn btn--ghost btn--block" id="stopNow" style="margin-top:9px">
          Finish the lesson here</button>
        <p class="muted small center" style="margin-top:12px">
          You can turn hearts off entirely in Me → Settings.</p>`);
      s.querySelector('#refill').addEventListener('click', () => {
        UI.closeSheet();
        Gamify.refillHearts(st.ses);
        resolve(true);
      });
      s.querySelector('#stopNow').addEventListener('click', () => {
        UI.closeSheet();
        resolve(false);
      });
    });
  }

  /* ---- empty and finished --------------------------------------------------------- */

  function empty(host, mode) {
    host.innerHTML = `
      <div class="session__body">
        ${Mascot.svg('proud', 128)}
        <h2 style="font-size:24px;font-weight:800">
          ${mode === 'mistakes' ? 'No mistakes to review' : 'Nothing due right now'}</h2>
        <p class="card__note center" style="max-width:300px">
          ${mode === 'mistakes'
            ? "You've cleared everything you'd previously got wrong. Good going."
            : "You're all caught up. Come back later, or pick a lesson from Study."}</p>
      </div>
      <div class="session__foot">
        <button class="btn btn--primary btn--block" onclick="location.hash='#/study'">Browse lessons</button>
        <button class="btn btn--ghost btn--block" onclick="location.hash='#/today'">Back</button>
      </div>`;
  }

  function finish(host, st) {
    const ses = st.ses;
    const res = Gamify.finish(ses);
    const secs = Math.round((Date.now() - st.t0) / 1000);
    Store.dayEntry().seconds += secs;
    Store.saveStats();
    Cloud.push();

    const acc = ses.answered ? Math.round(ses.right / ses.answered * 100) : 0;
    const great = acc >= 80 && ses.answered >= 5;
    const badges = Gamify.checkBadges();
    const lvl = Gamify.level();
    const goal = Gamify.dailyGoal();
    const today = Gamify.xpToday();

    if (great || res.bonus) { UI.confetti(); Audio2.fanfare(); }

    host.innerHTML = `
      <div class="session__body" style="justify-content:flex-start">
        ${Mascot.svg(great ? 'cheer' : acc >= 50 ? 'proud' : 'think', 120)}
        <h2 style="font-size:25px;font-weight:800">
          ${res.bonus ? '完美！ Perfect lesson!' : great ? '做得好！ Well done!' : 'Lesson complete'}</h2>

        <div class="card" style="width:100%;display:flex;justify-content:space-around">
          <div class="stat"><div class="stat__num" style="color:var(--amber-deep)">${res.total}</div>
            <div class="stat__label">XP</div></div>
          <div class="stat"><div class="stat__num" style="color:var(--mint)">${acc}%</div>
            <div class="stat__label">Accuracy</div></div>
          <div class="stat"><div class="stat__num" style="color:var(--coral)">${ses.bestCombo}</div>
            <div class="stat__label">Best combo</div></div>
        </div>

        ${res.bonus ? `<div class="banner banner--good" style="width:100%">
          ⭐️ No mistakes — +${res.bonus} XP bonus</div>` : ''}
        ${res.levelled ? `<div class="banner banner--good" style="width:100%">
          🎉 Level up! You're level ${res.level}</div>` : ''}

        <div class="card" style="width:100%">
          <div class="hstack" style="justify-content:space-between">
            <span class="small" style="font-weight:800">Daily goal</span>
            <span class="small muted">${Math.min(today, goal)} / ${goal} XP</span>
          </div>
          <div class="bar" style="margin-top:8px">
            <div class="bar__fill" style="width:${Math.min(100, today / goal * 100)}%"></div>
          </div>
          ${today >= goal ? `<p class="card__note" style="margin-top:8px;color:var(--mint);font-weight:700">
            ✓ Goal hit — streak safe for today</p>` : `
            <p class="card__note" style="margin-top:8px">${goal - today} XP to keep your streak.</p>`}
        </div>

        <div class="hstack" style="justify-content:center;gap:14px">
          <span class="chip chip--flame">🔥 ${Store.liveStreak()}</span>
          <span class="chip chip--amber">Level ${lvl.level}</span>
        </div>

        ${st.wrongWords.length ? `
          <div class="card" style="width:100%;text-align:left">
            <div class="card__title">Worth another look</div>
            ${st.wrongWords.map(w => `
              <button class="row" data-say="${UI.esc(w.hanzi)}" style="margin-top:8px">
                <span class="row__lead hz" style="font-size:20px">${UI.esc(w.hanzi.slice(0, 3))}</span>
                <span class="row__main">
                  <span class="row__title">${UI.esc(w.english)}</span>
                  <span class="row__sub">${UI.esc(w.pinyin)}</span>
                </span>
                ${UI.icon('sound', 17)}
              </button>`).join('')}
          </div>` : ''}
      </div>

      <div class="session__foot">
        <button class="btn btn--primary btn--block" id="again">Another lesson</button>
        <button class="btn btn--ghost btn--block" id="home">Done for now</button>
      </div>`;

    host.querySelectorAll('[data-say]').forEach(b =>
      b.addEventListener('click', () => Audio2.speak(b.dataset.say)));
    host.querySelector('#home').addEventListener('click', () => App.go('#/today'));
    host.querySelector('#again').addEventListener('click', () =>
      Views.session(host, st.arg ? [st.mode, st.arg] : []));

    Gamify.celebrate(badges);
  }

  // Exposed for the test suite.
  Views.session.shouldRequeue = shouldRequeue;
  Views.session.LIMITS = { LESSON_LEN, MAX_RETRIES, MAX_QUEUE };
})();

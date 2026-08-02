/* Free-play quizzes. Routes look like:
     #/quiz/meaning              — everything
     #/quiz/listen/lesson/clothes
     #/quiz/hanzi/topic/food
   Answers feed back into the scheduler, but a quiz never introduces new words. */
(function () {
  const Views = window.Views = window.Views || {};

  const MODES = {
    meaning: {
      title: 'Character → meaning', emoji: '🀄️',
      prompt: w => `${UI.ruby(w, { size: 'clamp(52px,17vw,88px)', hidePinyin: !SRS.showPinyin(w.id) })}`,
      choice: w => UI.esc(w.english),
      key: w => w.english,
      say: w => w.hanzi,
    },
    hanzi: {
      title: 'Meaning → character', emoji: '🔤',
      prompt: w => `<div class="en" style="font-size:26px;font-weight:800">${UI.esc(w.english)}</div>`,
      choice: w => `<span class="hz" style="font-size:26px">${UI.esc(w.hanzi)}</span>`,
      key: w => w.hanzi,
      say: w => w.hanzi,
      sayAfter: true,
    },
    pinyin: {
      title: 'Character → pinyin', emoji: '🅿️',
      prompt: w => `<div class="hz-big">${UI.esc(w.hanzi)}</div>`,
      choice: w => UI.pinyinColoured(w),
      key: w => w.pinyin,
      say: w => w.hanzi,
      sayAfter: true,
    },
    listen: {
      title: 'Listening', emoji: '🎧',
      prompt: () => `<div style="font-size:64px">🎧</div>
        <p class="muted small">Tap the speaker, then choose what you heard</p>`,
      choice: w => `<span class="hz" style="font-size:22px">${UI.esc(w.hanzi)}</span>
        <span class="muted small flex1" style="text-align:right">${UI.esc(w.english)}</span>`,
      key: w => w.hanzi,
      say: w => w.hanzi,
      autoSay: true,
    },
  };

  Views.quiz = function (host, args) {
    const mode = MODES[args[0]] ? args[0] : 'meaning';
    const filter = {};
    if (args[1] === 'lesson') filter.lesson = args[2];
    if (args[1] === 'topic')  filter.topic = args[2];
    if (args[1] === 'hsk')    filter.hsk = +args[2];

    let pool = SRS.pool(filter);
    if (pool.length < 4) {
      host.innerHTML = empty(mode);
      host.querySelector('#back').addEventListener('click', () => history.back());
      return;
    }

    // Prefer words already met; top up with unseen ones if there aren't enough.
    const met = pool.filter(w => SRS.has(w.id));
    const rest = pool.filter(w => !SRS.has(w.id));
    const ordered = UI.shuffle(met).concat(UI.shuffle(rest));
    const n = Math.min(12, ordered.length);

    const st = {
      mode, pool, filter,
      queue: ordered.slice(0, n),
      i: 0, right: 0, wrong: [],
      answered: false,
    };
    ask(host, st);
  };

  function empty(mode) {
    return `
      <div class="session__body">
        ${Mascot.svg('think', 118)}
        <h2 style="font-size:22px;font-weight:800">Not enough words yet</h2>
        <p class="card__note center">This quiz needs at least four words in the set.</p>
      </div>
      <div class="session__foot">
        <button class="btn btn--primary btn--block" id="back">Go back</button>
      </div>`;
  }

  function ask(host, st) {
    if (st.i >= st.queue.length) return finish(host, st);

    const M = MODES[st.mode];
    const w = st.queue[st.i];
    const wrongs = UI.distractors(w, 3, M.key, st.pool);
    const options = UI.shuffle([w].concat(wrongs));
    st.answered = false;

    host.innerHTML = `
      <div class="session__head">
        <button class="icon-btn" id="quit" aria-label="Quit">${UI.icon('close', 18)}</button>
        <div class="bar flex1"><div class="bar__fill" style="width:${st.i / st.queue.length * 100}%"></div></div>
        <span class="chip chip--mint">${st.right}/${st.queue.length}</span>
      </div>

      <div class="session__body">
        <div id="prompt">${M.prompt(w)}</div>
        <button class="btn btn--round" id="say" aria-label="Play"
                style="background:var(--amber-soft);color:var(--amber-deep)">
          ${UI.icon('sound', 24)}</button>
      </div>

      <div class="session__foot">
        <div class="choices" id="choices">
          ${options.map((o, k) => `
            <button class="choice" data-k="${k}" data-id="${UI.esc(o.id)}">
              ${M.choice(o)}
            </button>`).join('')}
        </div>
      </div>`;

    host.querySelector('#quit').addEventListener('click', () => App.go('#/practice'));
    host.querySelector('#say').addEventListener('click', () => Audio2.speak(M.say(w)));
    if (M.autoSay) setTimeout(() => Audio2.speak(M.say(w)), 320);

    host.querySelectorAll('.choice').forEach(btn => {
      btn.addEventListener('click', () => {
        if (st.answered) return;
        st.answered = true;
        const chosen = btn.dataset.id;
        const ok = chosen === w.id;

        host.querySelectorAll('.choice').forEach(b => {
          if (b.dataset.id === w.id) b.classList.add('choice--right');
          else if (b === btn) b.classList.add('choice--wrong');
          else b.classList.add('choice--dim');
        });

        if (ok) { st.right++; Audio2.ding(); Audio2.buzzPhone(10); }
        else { st.wrong.push(w); Audio2.buzz(); Audio2.buzzPhone([16, 50, 16]); }

        // Multiple choice is easier than free recall, so a hit counts as
        // "hard" rather than "good" unless they were already solid on it.
        const c = Store.S.progress[w.id];
        SRS.answer(w.id, ok ? (c && c.streak >= 2 ? 2 : 1) : 0);

        if (M.sayAfter || !M.autoSay) Audio2.speak(M.say(w));

        // Reveal the pinyin so a miss still teaches something.
        host.querySelector('#prompt .ruby')?.classList.remove('ruby--hide');

        setTimeout(() => { st.i++; ask(host, st); }, ok ? 750 : 1500);
      });
    });
  }

  function finish(host, st) {
    const pct = Math.round(st.right / st.queue.length * 100);
    const great = pct >= 80;
    if (great) { UI.confetti(); Audio2.fanfare(); }
    Cloud.push();

    host.innerHTML = `
      <div class="session__body">
        ${Mascot.svg(great ? 'cheer' : pct >= 50 ? 'proud' : 'think', 128)}
        <h2 style="font-size:27px;font-weight:800">${st.right} / ${st.queue.length}</h2>
        <div class="py">${great ? '太棒了！ Tài bàng le! — Brilliant!'
                        : pct >= 50 ? '不错！ Bú cuò! — Not bad!'
                        : '继续加油！ Jìxù jiāyóu! — Keep at it!'}</div>
        ${st.wrong.length ? `
          <div class="card" style="width:100%;text-align:left">
            <div class="card__title">Worth another look</div>
            ${st.wrong.map(w => `
              <button class="row" data-say="${UI.esc(w.hanzi)}" style="margin-top:8px">
                <span class="row__lead hz" style="font-size:21px">${UI.esc(w.hanzi)}</span>
                <span class="row__main">
                  <span class="row__title">${UI.esc(w.english)}</span>
                  <span class="row__sub">${UI.esc(w.pinyin)}</span>
                </span>
                ${UI.icon('sound', 18)}
              </button>`).join('')}
          </div>` : ''}
      </div>
      <div class="session__foot">
        <button class="btn btn--primary btn--block" id="again">Go again</button>
        <button class="btn btn--ghost btn--block" id="back">Back to practice</button>
      </div>`;

    host.querySelectorAll('[data-say]').forEach(b =>
      b.addEventListener('click', () => Audio2.speak(b.dataset.say)));
    host.querySelector('#back').addEventListener('click', () => App.go('#/practice'));
    host.querySelector('#again').addEventListener('click', () => {
      const f = st.filter;
      const suffix = f.lesson ? `/lesson/${f.lesson}` : f.topic ? `/topic/${f.topic}`
                   : f.hsk ? `/hsk/${f.hsk}` : '';
      Views.quiz(host, [st.mode].concat(suffix.split('/').filter(Boolean)));
    });
  }

  Views.quiz.MODES = MODES;
})();

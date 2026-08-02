/* Today — the home screen: daily goal, what to do next, and the learning path. */
(function () {
  const Views = window.Views = window.Views || {};

  function greeting() {
    const h = new Date().getHours();
    if (h < 5)  return { hz: '晚上好', py: 'wǎnshang hǎo', en: 'Good evening', mood: 'sleepy' };
    if (h < 12) return { hz: '早上好', py: 'zǎoshang hǎo', en: 'Good morning', mood: 'idle' };
    if (h < 18) return { hz: '下午好', py: 'xiàwǔ hǎo',   en: 'Good afternoon', mood: 'idle' };
    return { hz: '晚上好', py: 'wǎnshang hǎo', en: 'Good evening', mood: 'idle' };
  }

  /** 0–5 "crowns" for a lesson, from how many of its words are solid. */
  function crowns(lessonId) {
    const words = SRS.pool({ lesson: lessonId });
    if (!words.length) return { n: 0, pct: 0, total: 0, started: 0 };
    let score = 0, started = 0;
    words.forEach(w => {
      const c = Store.S.progress[w.id];
      if (!c) return;
      started++;
      if (c.interval >= 21) score += 1;
      else if (c.interval >= 7) score += 0.7;
      else if (c.state === 'review') score += 0.4;
      else score += 0.15;
    });
    const pct = score / words.length;
    return { n: Math.min(5, Math.floor(pct * 5.999)), pct, total: words.length, started };
  }

  Views.today = function (host) {
    const c = SRS.counts();
    const g = greeting();
    const streak = Store.liveStreak();
    const lvl = Gamify.level();
    const goal = Gamify.dailyGoal();
    const xp = Gamify.xpToday();
    const goalPct = Math.min(1, xp / goal);
    const mistakes = Gamify.mistakeList();
    const name = Store.S.profile.name;

    const lessons = Store.S.lessons.slice().sort((a, b) => a.order - b.order)
      .map(l => ({ ...l, c: crowns(l.id) }))
      .filter(l => l.c.total > 0);

    // The "current" lesson is the first not yet mostly done.
    const currentIdx = Math.max(0, lessons.findIndex(l => l.c.pct < 0.6));

    host.innerHTML = `
      <div class="topbar">
        <div style="min-width:0">
          <div class="topbar__title">麋鹿 <span style="font-size:18px">Mílù</span></div>
          <div class="topbar__sub">${name ? UI.esc(name) : 'Chinese, one deer at a time'}</div>
        </div>
        <div class="topbar__spacer"></div>
        <span class="chip chip--flame">🔥 ${streak}</span>
        <span class="chip chip--amber">Lv ${lvl.level}</span>
      </div>

      <div class="card card--amber" style="display:flex;gap:12px;align-items:center">
        <div style="flex:none">${Mascot.svg(goalPct >= 1 ? 'proud' : g.mood, 82)}</div>
        <div style="flex:1;min-width:0">
          <div class="hz" style="font-size:24px;line-height:1.2">${g.hz}</div>
          <div class="py" style="font-size:14px">${g.py}</div>
          <div class="card__note" style="margin-top:4px">${blurb(c, streak, xp, goal)}</div>
        </div>
      </div>

      <div class="card" style="display:flex;align-items:center;gap:16px">
        <div style="position:relative;flex:none">
          ${UI.ring(goalPct, 84, 10)}
          <div style="position:absolute;inset:0;display:grid;place-items:center">
            <div class="center">
              <div style="font-size:19px;font-weight:800;line-height:1">${xp}</div>
              <div style="font-size:9px;color:var(--muted);font-weight:800">/${goal} XP</div>
            </div>
          </div>
        </div>
        <div style="flex:1">
          <div class="hstack" style="justify-content:space-between">
            <span class="small" style="font-weight:800">Daily goal</span>
            ${goalPct >= 1 ? '<span class="pill pill--mint">✓ done</span>' : ''}
          </div>
          <p class="card__note small" style="margin-top:2px">
            ${goalPct >= 1 ? 'Streak is safe for today. Anything more is a bonus.'
                           : `${goal - xp} XP to go — about ${Math.ceil((goal - xp) / 45)} lesson${Math.ceil((goal - xp) / 45) === 1 ? '' : 's'}.`}
          </p>
          <div class="hstack" style="margin-top:8px;gap:14px">
            <span class="small muted"><b style="color:var(--coral)">${c.due}</b> due</span>
            <span class="small muted"><b style="color:var(--amber-deep)">${c.fresh}</b> new</span>
            <span class="small muted"><b style="color:var(--mint)">${c.known}</b> solid</span>
          </div>
        </div>
      </div>

      <button class="btn btn--primary btn--block" id="start" style="margin:2px 0 6px">
        ${c.started === 0 ? 'Start your first lesson' : 'Start a lesson'}
      </button>

      ${mistakes.length ? `
        <button class="row" id="fixMistakes" style="background:var(--bad-soft)">
          <span class="row__lead" style="background:transparent;font-size:24px">🩹</span>
          <span class="row__main">
            <span class="row__title">Review your mistakes</span>
            <span class="row__sub">${mistakes.length} word${mistakes.length === 1 ? '' : 's'} tripped you up</span>
          </span>
          ${UI.icon('chev', 18)}
        </button>` : ''}

      <div class="section-title">Quick practice</div>
      <div class="grid grid--2">
        <button class="tile" data-go="#/match">
          <span class="tile__emoji">⚡️</span>
          <span class="tile__label">Match up</span>
          <span class="tile__sub">Beat the clock</span>
        </button>
        <button class="tile" data-go="#/tones/ear">
          <span class="tile__emoji">🎵</span>
          <span class="tile__label">Tones</span>
          <span class="tile__sub">Train your ear</span>
        </button>
        <button class="tile" data-go="#/speak">
          <span class="tile__emoji">🎤</span>
          <span class="tile__label">Speaking</span>
          <span class="tile__sub">Check your tone</span>
        </button>
        <button class="tile" data-go="#/sentences">
          <span class="tile__emoji">🧩</span>
          <span class="tile__label">Sentences</span>
          <span class="tile__sub">Build them up</span>
        </button>
      </div>

      <div class="section-title">Your path</div>
      <div class="path">
        <div class="path__line"></div>
        ${lessons.map((l, i) => {
          const state = l.c.pct >= 0.6 ? 'done' : i === currentIdx ? 'now' : i < currentIdx ? 'done' : 'locked';
          return `
            <button class="path__node" data-lesson="${UI.esc(l.id)}">
              <span class="path__dot path__dot--${state}">
                ${l.emoji}
                ${l.c.n ? `<span class="path__crowns">${'👑'.repeat(Math.min(3, l.c.n))}${l.c.n > 3 ? l.c.n : ''}</span>` : ''}
              </span>
              <span class="path__label">
                <span class="path__title">${UI.esc(l.title)}</span>
                <span class="path__sub">${l.c.started}/${l.c.total} words${
                  state === 'now' ? ' · continue here' : ''}</span>
              </span>
            </button>`;
        }).join('')}
      </div>

      ${wordOfDay()}`;

    host.querySelector('#start').addEventListener('click', () => {
      Audio2.unlock();
      App.go('#/session');
    });
    host.querySelector('#fixMistakes')?.addEventListener('click', () => {
      Audio2.unlock();
      App.go('#/session/mistakes');
    });
    host.querySelectorAll('[data-go]').forEach(b =>
      b.addEventListener('click', () => { Audio2.unlock(); App.go(b.dataset.go); }));
    host.querySelectorAll('[data-lesson]').forEach(b =>
      b.addEventListener('click', () => {
        Audio2.unlock();
        App.go('#/lesson/' + encodeURIComponent(b.dataset.lesson));
      }));

    const wod = host.querySelector('#wodPlay');
    if (wod) wod.addEventListener('click', () => Audio2.speak(wod.dataset.hz));
  };

  function blurb(c, streak, xp, goal) {
    if (c.started === 0) return "Let's learn your first words together!";
    if (xp >= goal) return `Goal hit${streak > 1 ? ` — ${streak} days running!` : '!'} 太棒了！`;
    if (streak >= 7) return `${streak} days running. Don't break it now!`;
    if (c.due > 25) return `${c.due} words waiting. Little and often wins.`;
    return 'Ready when you are.';
  }

  function wordOfDay() {
    const list = Store.S.vocab;
    if (!list.length) return '';
    const seed = Store.today().split('-').join('') | 0;
    const w = list[seed % list.length];
    return `
      <div class="section-title">Word of the day</div>
      <div class="card card--mint center">
        ${UI.ruby(w, { cap: 54, hidePinyin: !SRS.showPinyin(w.id) })}
        <div class="en" style="margin-top:8px">${UI.esc(w.english)}</div>
        <button class="btn btn--sm btn--ghost" id="wodPlay" data-hz="${UI.esc(w.hanzi)}"
                style="margin-top:12px">${UI.icon('sound', 18)} Listen</button>
      </div>`;
  }

  Views.today.crowns = crowns;
})();

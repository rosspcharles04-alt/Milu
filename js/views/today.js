/* Today — the home screen. Streak, what's due, and a way straight into it. */
(function () {
  const Views = window.Views = window.Views || {};

  function greeting() {
    const h = new Date().getHours();
    if (h < 5)  return { hz: '晚上好', py: 'wǎnshang hǎo', en: 'Good evening', mood: 'sleepy' };
    if (h < 12) return { hz: '早上好', py: 'zǎoshang hǎo', en: 'Good morning', mood: 'idle' };
    if (h < 18) return { hz: '下午好', py: 'xiàwǔ hǎo',   en: 'Good afternoon', mood: 'idle' };
    return { hz: '晚上好', py: 'wǎnshang hǎo', en: 'Good evening', mood: 'idle' };
  }

  function encouragement(c, streak) {
    if (c.started === 0) return "Let's learn your first words together!";
    if (c.due + c.fresh === 0) return "All caught up — nothing due. Nicely done!";
    if (streak >= 7) return `${streak} days running. You're on a roll!`;
    if (c.due > 20) return `${c.due} words are waiting. Little and often wins.`;
    return 'Ready when you are.';
  }

  Views.today = function (host) {
    const c = SRS.counts();
    const g = greeting();
    const streak = Store.liveStreak();
    const day = Store.dayEntry();
    const goal = Store.S.settings.newPerDay;
    const done = Math.min(day.new || 0, goal);
    const pct = goal ? done / goal : 0;
    const name = Store.S.profile.name;

    host.innerHTML = `
      <div class="topbar">
        <div>
          <div class="topbar__title">麋鹿 <span style="font-size:19px">Mílù</span></div>
          <div class="topbar__sub">${name ? UI.esc(name) : 'Chinese, one deer at a time'}</div>
        </div>
        <div class="topbar__spacer"></div>
        <span class="chip chip--flame">🔥 ${streak}</span>
      </div>

      <div class="card card--amber" style="display:flex;gap:14px;align-items:center">
        <div id="mascotSlot">${Mascot.svg(g.mood, 92)}</div>
        <div style="flex:1;min-width:0">
          <div class="hz" style="font-size:27px;line-height:1.2">${g.hz}</div>
          <div class="py" style="font-size:15px">${g.py}</div>
          <div class="card__note" style="margin-top:5px">${encouragement(c, streak)}</div>
        </div>
      </div>

      <div class="card" style="display:flex;align-items:center;gap:16px">
        <div style="position:relative;flex:none">
          ${UI.ring(pct, 86, 10)}
          <div style="position:absolute;inset:0;display:grid;place-items:center">
            <div class="center">
              <div style="font-size:21px;font-weight:800;line-height:1">${done}<span
                   style="font-size:13px;color:var(--muted)">/${goal}</span></div>
              <div style="font-size:9.5px;color:var(--muted);font-weight:700">NEW</div>
            </div>
          </div>
        </div>
        <div style="flex:1;display:flex;justify-content:space-around;text-align:center">
          <div class="stat">
            <div class="stat__num" style="color:var(--coral)">${c.due}</div>
            <div class="stat__label">Due</div>
          </div>
          <div class="stat">
            <div class="stat__num" style="color:var(--amber-deep)">${c.fresh}</div>
            <div class="stat__label">New</div>
          </div>
          <div class="stat">
            <div class="stat__num" style="color:var(--mint)">${c.known}</div>
            <div class="stat__label">Known</div>
          </div>
        </div>
      </div>

      <button class="btn btn--primary btn--block" id="start" style="margin:4px 0 6px">
        ${c.due + c.fresh > 0
          ? `Study now · ${c.due + c.fresh} card${c.due + c.fresh === 1 ? '' : 's'}`
          : 'Practise anyway'}
      </button>

      <div class="section-title">Quick practice</div>
      <div class="grid grid--2">
        <button class="tile" data-go="#/quiz/listen">
          <span class="tile__emoji">🎧</span>
          <span class="tile__label">Listening</span>
          <span class="tile__sub">Hear it, pick it</span>
        </button>
        <button class="tile" data-go="#/tones">
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

      ${wordOfDay()}
    `;

    host.querySelector('#start').addEventListener('click', () => {
      Audio2.unlock();
      App.go('#/session');
    });

    host.querySelectorAll('[data-go]').forEach(b =>
      b.addEventListener('click', () => App.go(b.dataset.go)));

    const wod = host.querySelector('#wodPlay');
    if (wod) wod.addEventListener('click', () => Audio2.speak(wod.dataset.hz));
  };

  function wordOfDay() {
    const list = Store.S.vocab;
    if (!list.length) return '';
    // Stable per calendar day so it doesn't change on every render.
    const seed = Store.today().split('-').join('') | 0;
    const w = list[seed % list.length];
    const show = SRS.showPinyin(w.id);
    return `
      <div class="section-title">Word of the day</div>
      <div class="card card--mint center">
        ${UI.ruby(w, { size: '46px', hidePinyin: !show })}
        <div class="en" style="margin-top:8px">${UI.esc(w.english)}</div>
        <button class="btn btn--sm btn--ghost" id="wodPlay" data-hz="${UI.esc(w.hanzi)}"
                style="margin-top:12px">${UI.icon('sound', 18)} Listen</button>
      </div>`;
  }
})();

/* The game layer: XP, levels, hearts, combos, achievements and a mistakes log.

   Borrowed from Duolingo, which is unusually good at getting people to come
   back tomorrow: a daily XP goal rather than a word count, a visible cost to
   careless mistakes, and a combo that rewards a run of correct answers. */
(function () {
  'use strict';

  const HEARTS_PER_LESSON = 5;
  const XP_CORRECT = 10;
  const XP_HARD_BONUS = 5;      // production exercises are worth more
  const XP_PERFECT = 25;
  const XP_COMBO_STEP = 5;      // every 5 in a row

  /* ---- persistent totals -------------------------------------------------- */

  function g() {
    const s = Store.S.stats;
    if (s.xp == null) s.xp = 0;
    if (!s.mistakes) s.mistakes = {};
    if (!s.badges) s.badges = {};
    if (s.speakAttempts == null) s.speakAttempts = 0;
    if (s.perfectLessons == null) s.perfectLessons = 0;
    if (s.bestCombo == null) s.bestCombo = 0;
    return s;
  }

  /* Levels get progressively longer: 100, 250, 450, 700, 1000 … */
  function levelFor(xp) {
    let lvl = 1, need = 100, acc = 0;
    while (xp >= acc + need) { acc += need; lvl++; need += 50 * lvl; }
    return { level: lvl, into: xp - acc, need, floor: acc };
  }

  const level = () => levelFor(g().xp);

  function addXP(n) {
    const s = g();
    const before = levelFor(s.xp).level;
    s.xp += n;
    const day = Store.dayEntry();
    day.xp = (day.xp || 0) + n;
    Store.saveStats();
    const after = levelFor(s.xp).level;
    return { levelled: after > before, level: after };
  }

  const xpToday = () => Store.dayEntry().xp || 0;
  const dailyGoal = () => Store.S.settings.dailyXP || 60;
  const goalMet = () => xpToday() >= dailyGoal();

  /* ---- mistakes ----------------------------------------------------------- */

  function logMistake(wordId, kind) {
    const s = g();
    if (!s.mistakes[wordId]) s.mistakes[wordId] = { n: 0, last: 0, kinds: {} };
    const m = s.mistakes[wordId];
    m.n++;
    m.last = Date.now();
    if (kind) m.kinds[kind] = (m.kinds[kind] || 0) + 1;
    Store.saveStats();
  }

  function clearMistake(wordId) {
    const s = g();
    if (s.mistakes[wordId]) {
      delete s.mistakes[wordId];
      Store.saveStats();
    }
  }

  /** Words to revisit, worst and most recent first. */
  function mistakeList() {
    const s = g();
    return Object.entries(s.mistakes)
      .map(([id, m]) => ({ word: Store.S.byId.get(id), ...m, id }))
      .filter(x => x.word)
      .sort((a, b) => (b.n - a.n) || (b.last - a.last));
  }

  /* ---- per-session state --------------------------------------------------- */

  function newSession(opts) {
    opts = opts || {};
    return {
      hearts: Store.S.settings.hearts && !opts.noHearts ? HEARTS_PER_LESSON : Infinity,
      maxHearts: HEARTS_PER_LESSON,
      combo: 0,
      bestCombo: 0,
      xp: 0,
      right: 0,
      wrong: 0,
      answered: 0,
    };
  }

  /**
   * Record one exercise result.
   * @returns {{xp:number, combo:number, milestone:boolean, dead:boolean}}
   */
  function score(ses, correct, hard) {
    ses.answered++;
    let gained = 0;
    let milestone = false;

    if (correct) {
      ses.right++;
      ses.combo++;
      ses.bestCombo = Math.max(ses.bestCombo, ses.combo);
      gained = XP_CORRECT + (hard ? XP_HARD_BONUS : 0);
      if (ses.combo > 0 && ses.combo % 5 === 0) {
        gained += XP_COMBO_STEP * (ses.combo / 5);
        milestone = true;
      }
    } else {
      ses.wrong++;
      ses.combo = 0;
      if (ses.hearts !== Infinity) ses.hearts--;
    }

    ses.xp += gained;
    const s = g();
    if (ses.bestCombo > s.bestCombo) { s.bestCombo = ses.bestCombo; Store.saveStats(); }

    return { xp: gained, combo: ses.combo, milestone, dead: ses.hearts <= 0 };
  }

  /** Called once when a lesson ends — banks the XP and any perfect bonus. */
  function finish(ses) {
    let bonus = 0;
    if (ses.wrong === 0 && ses.answered >= 5) {
      bonus = XP_PERFECT;
      g().perfectLessons++;
    }
    const total = ses.xp + bonus;
    const res = addXP(total);
    Store.saveStats();
    return { total, bonus, ...res };
  }

  function refillHearts(ses) {
    ses.hearts = HEARTS_PER_LESSON;
  }

  /* ---- achievements --------------------------------------------------------- */

  const BADGES = [
    { id: 'first',    icon: '🌱', name: 'First steps',   note: 'Learn your first word',
      test: c => c.started >= 1 },
    { id: 'ten',      icon: '🌿', name: 'Ten down',      note: '10 words started',
      test: c => c.started >= 10 },
    { id: 'fifty',    icon: '📚', name: 'Fifty strong',  note: '50 words started',
      test: c => c.started >= 50 },
    { id: 'century',  icon: '💯', name: 'Century',       note: '100 words started',
      test: c => c.started >= 100 },
    { id: 'solid50',  icon: '🧠', name: 'Sticking',      note: '50 words solid',
      test: c => c.known >= 50 },
    { id: 'streak3',  icon: '🔥', name: 'Three in a row', note: '3-day streak',
      test: (c, s) => s.longest >= 3 },
    { id: 'streak7',  icon: '🔥', name: 'A full week',   note: '7-day streak',
      test: (c, s) => s.longest >= 7 },
    { id: 'streak30', icon: '🏆', name: 'A month!',      note: '30-day streak',
      test: (c, s) => s.longest >= 30 },
    { id: 'write25',  icon: '✍️', name: 'Steady hand',   note: 'Trace 25 characters',
      test: () => tracedCount() >= 25 },
    { id: 'write100', icon: '🖌️', name: 'Calligrapher',  note: 'Trace 100 characters',
      test: () => tracedCount() >= 100 },
    { id: 'speak25',  icon: '🎤', name: 'Speaking up',   note: '25 spoken attempts',
      test: (c, s) => (s.speakAttempts || 0) >= 25 },
    { id: 'perfect',  icon: '⭐️', name: 'Flawless',      note: 'Finish a lesson with no mistakes',
      test: (c, s) => (s.perfectLessons || 0) >= 1 },
    { id: 'perfect10', icon: '🌟', name: 'Ten flawless', note: '10 perfect lessons',
      test: (c, s) => (s.perfectLessons || 0) >= 10 },
    { id: 'combo20',  icon: '⚡️', name: 'On a roll',     note: '20 correct in a row',
      test: (c, s) => (s.bestCombo || 0) >= 20 },
    { id: 'level5',   icon: '🦌', name: 'Level 5',       note: 'Reach level 5',
      test: () => level().level >= 5 },
    { id: 'level10',  icon: '👑', name: 'Level 10',      note: 'Reach level 10',
      test: () => level().level >= 10 },
  ];

  function tracedCount() {
    return Object.values(Store.S.chars || {}).filter(c => c.traced > 0).length;
  }

  /** Re-evaluate all badges; returns any newly earned. */
  function checkBadges() {
    const s = g();
    const c = SRS.counts();
    const fresh = [];
    BADGES.forEach(b => {
      if (s.badges[b.id]) return;
      let ok = false;
      try { ok = b.test(c, s); } catch (e) { ok = false; }
      if (ok) {
        s.badges[b.id] = Date.now();
        fresh.push(b);
      }
    });
    if (fresh.length) Store.saveStats();
    return fresh;
  }

  function badgeState() {
    const s = g();
    return BADGES.map(b => ({ ...b, earned: !!s.badges[b.id], at: s.badges[b.id] || 0 }));
  }

  /* ---- visual feedback helpers ---------------------------------------------- */

  function showCombo(text) {
    let el = document.querySelector('.combo');
    if (!el) {
      el = document.createElement('div');
      el.className = 'combo';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.remove('combo--on');
    void el.offsetWidth;              // restart the animation
    el.classList.add('combo--on');
  }

  function floatXP(anchor, n) {
    if (!anchor || !n) return;
    const r = anchor.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'xp-pop';
    el.textContent = `+${n} XP`;
    el.style.left = `${r.left + r.width / 2 - 24}px`;
    el.style.top = `${r.top - 6}px`;
    el.style.position = 'fixed';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  function heartsHTML(ses) {
    if (ses.hearts === Infinity) return '';
    let out = '<div class="hearts" id="hearts">';
    for (let i = 0; i < ses.maxHearts; i++) {
      out += `<span class="heart${i >= ses.hearts ? ' heart--gone' : ''}">❤️</span>`;
    }
    return out + '</div>';
  }

  /** Announce any newly earned badges, one after another. */
  function celebrate(badges) {
    if (!badges || !badges.length) return;
    badges.forEach((b, i) => {
      setTimeout(() => {
        UI.toast(`${b.icon}  ${b.name} — ${b.note}`, 2600);
        Audio2.fanfare();
      }, i * 1400);
    });
    UI.confetti(30);
  }

  window.Gamify = {
    HEARTS_PER_LESSON,
    level, levelFor, addXP, xpToday, dailyGoal, goalMet,
    logMistake, clearMistake, mistakeList,
    newSession, score, finish, refillHearts,
    BADGES, checkBadges, badgeState, tracedCount,
    showCombo, floatXP, heartsHTML, celebrate,
    get stats() { return g(); },
  };
})();

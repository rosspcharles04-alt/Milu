/* Spaced repetition — an SM-2 variant with short learning steps.

   Grades: 0 = again, 1 = hard, 2 = good, 3 = easy.
   New and lapsed words get a couple of quick in-session repeats before they
   graduate to real day-scale intervals. */
(function () {
  'use strict';

  const MIN = 60 * 1000;
  const DAY = 24 * 60 * MIN;

  const LEARN_STEPS  = [1 * MIN, 10 * MIN];   // new words
  const RELEARN_STEP = 10 * MIN;              // after a lapse
  const MIN_EASE = 1.3;

  function blank() {
    return {
      state: 'new',      // new | learning | review | relearning
      step: 0,
      ease: 2.5,
      interval: 0,       // days
      due: 0,
      reps: 0,
      lapses: 0,
      seen: 0,
      correct: 0,
      streak: 0,         // consecutive correct — drives the pinyin fade
      last: 0,
    };
  }

  function card(id) {
    const P = Store.S.progress;
    if (!P[id]) P[id] = blank();
    return P[id];
  }

  function has(id) {
    return Object.prototype.hasOwnProperty.call(Store.S.progress, id);
  }

  /** Record an answer and schedule the next showing. */
  function answer(id, grade) {
    const c = card(id);
    const now = Date.now();

    c.seen++;
    c.reps++;
    c.last = now;
    if (grade > 0) { c.correct++; c.streak++; } else { c.streak = 0; }

    const day = Store.dayEntry();
    day.reviews++;
    if (grade > 0) day.correct++;
    if (c.state === 'new') day.new++;
    Store.S.stats.totalReviews++;

    schedule(c, grade, now);

    Store.touchStreak();
    Store.saveProgress();
    Store.saveStats();
    return c;
  }

  /** The scheduling maths on its own, so it can also be run speculatively. */
  function schedule(c, grade, now) {
    if (c.state === 'new' || c.state === 'learning') {
      if (grade === 0) {
        c.state = 'learning';
        c.step = 0;
        c.due = now + LEARN_STEPS[0];
      } else if (grade === 1) {
        c.state = 'learning';
        c.due = now + LEARN_STEPS[Math.min(c.step, LEARN_STEPS.length - 1)];
      } else {
        c.step++;
        if (c.step >= LEARN_STEPS.length || grade === 3) {
          c.state = 'review';
          c.interval = grade === 3 ? 4 : 1;
          c.due = now + c.interval * DAY;
        } else {
          c.state = 'learning';
          c.due = now + LEARN_STEPS[c.step];
        }
      }
    } else if (c.state === 'relearning') {
      if (grade === 0) {
        c.due = now + RELEARN_STEP;
      } else {
        c.state = 'review';
        c.interval = Math.max(1, Math.round(c.interval));
        c.due = now + c.interval * DAY;
      }
    } else { // review
      if (grade === 0) {
        c.lapses++;
        c.ease = Math.max(MIN_EASE, c.ease - 0.20);
        c.interval = Math.max(1, c.interval * 0.4);
        c.state = 'relearning';
        c.due = now + RELEARN_STEP;
      } else {
        if (grade === 1) {
          c.ease = Math.max(MIN_EASE, c.ease - 0.15);
          c.interval = Math.max(1, c.interval * 1.2);
        } else if (grade === 2) {
          c.interval = Math.max(1, c.interval * c.ease);
        } else {
          c.ease += 0.15;
          c.interval = Math.max(1, c.interval * c.ease * 1.3);
        }
        c.interval = Math.min(c.interval, 365);
        c.due = now + c.interval * DAY;
      }
    }
    return c;
  }

  /** What answering with this grade would mean, without committing to it.
      Returns a short label for the grade buttons. */
  function preview(id, grade) {
    const c = JSON.parse(JSON.stringify(Store.S.progress[id] || blank()));
    const now = Date.now();
    schedule(c, grade, now);
    const ms = c.due - now;
    if (ms < 60 * 1000) return 'now';
    if (ms < 60 * MIN) return Math.round(ms / MIN) + 'm';
    if (ms < DAY) return Math.round(ms / (60 * MIN)) + 'h';
    return fmtInterval(ms / DAY);
  }

  /** Mark a word as already known — skip straight to a long interval. */
  function markKnown(id) {
    const c = card(id);
    c.state = 'review';
    c.ease = 2.6;
    c.interval = 14;
    c.streak = 4;
    c.due = Date.now() + 14 * DAY;
    Store.saveProgress();
  }

  function forget(id) {
    delete Store.S.progress[id];
    Store.saveProgress();
  }

  /* ---- queues ----------------------------------------------------------- */

  function dueList(now) {
    now = now || Date.now();
    return Store.S.vocab.filter(w => {
      const c = Store.S.progress[w.id];
      return c && c.state !== 'new' && c.due <= now;
    });
  }

  function newList() {
    return Store.S.vocab
      .filter(w => !has(w.id))
      .sort((a, b) => a.order - b.order);
  }

  function newRemainingToday() {
    const done = Store.dayEntry().new || 0;
    return Math.max(0, Store.S.settings.newPerDay - done);
  }

  function counts() {
    const now = Date.now();
    let due = 0, learning = 0, review = 0, known = 0, started = 0;
    Store.S.vocab.forEach(w => {
      const c = Store.S.progress[w.id];
      if (!c) return;
      started++;
      if (c.state === 'review' && c.interval >= 21) known++;
      if (c.due <= now) {
        due++;
        if (c.state === 'review') review++; else learning++;
      }
    });
    return {
      due, learning, review, known, started,
      total: Store.S.vocab.length,
      fresh: Math.min(newRemainingToday(), newList().length),
    };
  }

  /**
   * Build the queue for a study session: everything due, plus today's
   * allowance of new words, interleaved so it doesn't feel like a wall.
   */
  function session(limit) {
    const due = shuffle(dueList());
    const fresh = newList().slice(0, newRemainingToday());
    const out = [];

    // Front-load a few reviews, then weave the new words through.
    const head = due.splice(0, Math.min(3, due.length));
    out.push(...head);

    const ratio = fresh.length ? Math.max(1, Math.round(due.length / fresh.length)) : 0;
    let d = 0, n = 0;
    while (d < due.length || n < fresh.length) {
      for (let i = 0; i < ratio && d < due.length; i++) out.push(due[d++]);
      if (n < fresh.length) out.push(fresh[n++]);
      if (!ratio && d < due.length) out.push(due[d++]);
    }
    return limit ? out.slice(0, limit) : out;
  }

  /** A pool for free-play quizzes — no scheduling, just words to test on. */
  function pool(filter) {
    let list = Store.S.vocab.slice();
    if (filter) {
      if (filter.lesson) list = list.filter(w => (w.lessons || []).includes(filter.lesson));
      if (filter.topic)  list = list.filter(w => w.topic === filter.topic);
      if (filter.hsk)    list = list.filter(w => w.hsk === filter.hsk);
      if (filter.seenOnly) list = list.filter(w => has(w.id));
      if (filter.maxChars) list = list.filter(w => w.chars.length <= filter.maxChars);
    }
    return list;
  }

  /** Words the user has actually met — used to keep quiz distractors familiar. */
  function familiar() {
    const seen = Store.S.vocab.filter(w => has(w.id));
    return seen.length >= 8 ? seen : Store.S.vocab.slice(0, 40);
  }

  /* Should pinyin be visible for this word right now? */
  function showPinyin(id) {
    const mode = Store.S.settings.pinyinMode;
    if (mode === 'always') return true;
    if (mode === 'hidden') return false;
    const c = Store.S.progress[id];
    return !c || c.streak < 3;         // fade: hide once they've got it 3× running
  }

  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function fmtInterval(days) {
    if (days < 1) return '<1d';
    if (days < 30) return Math.round(days) + 'd';
    if (days < 365) return Math.round(days / 30) + 'mo';
    return (days / 365).toFixed(1) + 'y';
  }

  window.SRS = {
    blank, card, has, answer, schedule, preview, markKnown, forget,
    dueList, newList, newRemainingToday, counts, session, pool, familiar,
    showPinyin, shuffle, fmtInterval, DAY, MIN,
  };
})();

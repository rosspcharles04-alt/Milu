/* The exercise library.

   Both Duolingo and HelloChinese teach a word by cycling it through *different*
   exercise types rather than showing the same flashcard repeatedly, and they
   escalate: recognise it, then recall it, then produce it. That's what this
   file is — a set of interchangeable exercises with one interface, plus the
   logic that picks which one a given word has earned.

   Every exercise resolves with { correct, hard, skipped } so the lesson loop
   stays a simple `for … await`. */
(function () {
  'use strict';

  /* ---- picking an exercise -------------------------------------------------- */

  // Ordered easiest → hardest. `hard` ones are worth bonus XP.
  const KINDS = {
    teach:        { label: 'New word',        hard: false },
    choose_mean:  { label: 'What does it mean?', hard: false },
    listen:       { label: 'What did you hear?', hard: false },
    choose_hanzi: { label: 'Pick the characters', hard: false },
    choose_pin:   { label: 'Pick the pinyin',  hard: false },
    tone_id:      { label: 'Which tone?',      hard: false },
    type_pin:     { label: 'Type the pinyin',  hard: true },
    trace:        { label: 'Write it',         hard: true },
    speak:        { label: 'Say it out loud',  hard: true },
  };

  /** How well is this word known? 0 = new, 3 = solid. */
  function strength(word) {
    const c = Store.S.progress[word.id];
    if (!c || c.state === 'new') return 0;
    if (c.streak >= 4 && c.interval >= 7) return 3;
    if (c.streak >= 2) return 2;
    return 1;
  }

  /**
   * Choose an exercise for a word, avoiding an immediate repeat of the same
   * kind and skipping any the device can't support.
   */
  function pick(word, lastKind) {
    const s = strength(word);
    let pool;

    if (s === 0) {
      pool = ['teach'];
    } else if (s === 1) {
      pool = ['choose_mean', 'listen', 'choose_mean', 'choose_pin'];
    } else if (s === 2) {
      pool = ['choose_hanzi', 'listen', 'choose_pin', 'tone_id', 'choose_mean'];
    } else {
      pool = ['type_pin', 'choose_hanzi', 'trace', 'speak', 'listen', 'tone_id'];
    }

    pool = pool.filter(k => supported(k, word));
    if (!pool.length) pool = ['choose_mean'];

    const fresh = pool.filter(k => k !== lastKind);
    const from = fresh.length ? fresh : pool;
    return from[Math.floor(Math.random() * from.length)];
  }

  function supported(kind, word) {
    if (kind === 'tone_id') {
      return word.tones && word.tones.length === 1 && word.tones[0] >= 1 && word.tones[0] <= 4;
    }
    if (kind === 'trace') {
      return !!(Store.S.strokes && word.chars.length &&
                word.chars.every(c => Store.S.strokes[c]));
    }
    if (kind === 'speak') {
      return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) &&
             word.tones && word.tones.length && word.tones.length <= 3;
    }
    if (kind === 'type_pin') return !!word.pinyin;
    return true;
  }

  /* ---- shared shell ---------------------------------------------------------- */

  /**
   * Render an exercise and resolve once the learner has answered *and*
   * acknowledged the feedback — the Duolingo rhythm of answer → see why → continue.
   *
   * spec = { kind, promptHTML, bodyHTML, wire(el, submit), autoPlay, answerText }
   */
  function shell(host, spec) {
    return new Promise(resolve => {
      const meta = KINDS[spec.kind] || { label: '', hard: false };
      host.innerHTML = `
        <div class="session__body" style="justify-content:flex-start;gap:12px">
          <div class="center" style="width:100%">
            <div class="ex-kind">${UI.esc(meta.label)}</div>
            ${meta.hard ? '<span class="hard-flag">⚡︎ harder</span>' : ''}
          </div>
          <div class="center" style="width:100%">${spec.promptHTML || ''}</div>
          <div style="width:100%" id="exBody">${spec.bodyHTML || ''}</div>
        </div>
        <div class="session__foot" id="exFoot"></div>`;

      const body = host.querySelector('#exBody');
      const foot = host.querySelector('#exFoot');
      let done = false;

      function submit(correct, detail) {
        if (done) return;
        done = true;
        feedback(correct, detail);
      }

      function feedback(correct, detail) {
        if (correct) { Audio2.ding(); Audio2.buzzPhone(10); }
        else { Audio2.buzz(); Audio2.buzzPhone([16, 50, 16]); }

        foot.innerHTML = `
          <div class="banner banner--${correct ? 'good' : 'bad'}">
            <div style="min-width:0">
              <div>${correct ? pickPraise() : 'Not quite'}</div>
              ${detail ? `<div class="small" style="font-weight:600;opacity:.9;margin-top:2px">${detail}</div>` : ''}
            </div>
          </div>
          <button class="btn ${correct ? 'btn--good' : 'btn--bad'} btn--block" id="cont">Continue</button>`;

        const cont = foot.querySelector('#cont');
        cont.focus({ preventScroll: true });
        cont.addEventListener('click', () => resolve({ correct, hard: meta.hard }));
      }

      // Exercises drive the footer until they submit.
      spec.wire(body, submit, foot, () => resolve({ correct: true, hard: false, skipped: true }));

      if (spec.autoPlay) setTimeout(() => Audio2.speak(spec.autoPlay), 300);
    });
  }

  const PRAISE = ['对了！ Correct!', 'Nice one!', '很好！ Very good!', 'Got it!',
                  '太棒了！ Excellent!', 'Spot on!', '不错！ Not bad!'];
  const pickPraise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)];

  /* ---- multiple choice -------------------------------------------------------- */

  function choiceExercise(host, word, cfg) {
    const wrongs = UI.distractors(word, 3, cfg.key, cfg.pool);
    const options = UI.shuffle([word].concat(wrongs));

    return shell(host, {
      kind: cfg.kind,
      promptHTML: cfg.promptHTML,
      autoPlay: cfg.autoPlay,
      bodyHTML: `<div class="choices">
        ${options.map(o => `<button class="choice" data-id="${UI.esc(o.id)}">${cfg.render(o)}</button>`).join('')}
      </div>`,
      wire(body, submit, foot) {
        if (cfg.replayBtn) {
          foot.innerHTML = `<button class="btn btn--ghost btn--block" id="replay">
            ${UI.icon('sound', 18)} Play again</button>`;
          foot.querySelector('#replay').addEventListener('click', () => Audio2.speak(word.hanzi));
        }
        body.querySelectorAll('.choice').forEach(btn => {
          btn.addEventListener('click', () => {
            const ok = btn.dataset.id === word.id;
            body.querySelectorAll('.choice').forEach(b => {
              if (b.dataset.id === word.id) b.classList.add('choice--right');
              else if (b === btn) b.classList.add('choice--wrong');
              else b.classList.add('choice--dim');
              b.style.pointerEvents = 'none';
            });
            if (!ok) Audio2.speak(word.hanzi);
            submit(ok, `${word.hanzi} · ${word.pinyin} · ${word.english}`);
          });
        });
      },
    });
  }

  /* ---- the individual exercises ------------------------------------------------ */

  const EX = {};

  EX.teach = (host, word) => {
    const parts = word.chars.map(c => Hanzi.breakdown(c)).filter(Boolean);
    return shell(host, {
      kind: 'teach',
      autoPlay: word.hanzi,
      promptHTML: `
        ${UI.ruby(word, { cap: 88 })}
        <div class="en" style="font-size:20px;font-weight:700;margin-top:10px">${UI.esc(word.english)}</div>`,
      bodyHTML: `
        <div class="center">
          <button class="btn btn--round" id="say"
                  style="background:var(--amber-soft);color:var(--amber-deep);margin:4px auto">
            ${UI.icon('sound', 24)}</button>
        </div>
        ${parts.length ? `
          <div class="card card--amber" style="margin-top:12px">
            <div class="card__title">🧩 Built from</div>
            ${parts.map((p, i) => `
              <p class="card__note"><b class="hz">${UI.esc(word.chars[i])}</b> — ${UI.esc(p.parts)}</p>`).join('')}
          </div>` : ''}
        <div class="wrap" style="justify-content:center;margin-top:10px">
          <span class="pill">${UI.topicEmoji(word.topic)} ${UI.esc(word.topic)}</span>
          ${word.hsk ? `<span class="pill pill--sky">HSK ${word.hsk}</span>` : ''}
        </div>`,
      wire(body, submit, foot, skip) {
        body.querySelector('#say').addEventListener('click', () => Audio2.speak(word.hanzi));
        foot.innerHTML = `
          <button class="btn btn--primary btn--block" id="got">Got it</button>
          <button class="btn btn--ghost btn--block" id="know">I already know this</button>`;
        foot.querySelector('#got').addEventListener('click', () => skip());
        foot.querySelector('#know').addEventListener('click', () => {
          SRS.markKnown(word.id);
          UI.toast('Marked as known');
          skip();
        });
      },
    });
  };

  EX.choose_mean = (host, word, ctx) => choiceExercise(host, word, {
    kind: 'choose_mean',
    key: w => w.english,
    pool: ctx.pool,
    promptHTML: UI.ruby(word, { cap: 84, hidePinyin: !SRS.showPinyin(word.id) }),
    render: o => UI.esc(o.english),
  });

  EX.choose_hanzi = (host, word, ctx) => choiceExercise(host, word, {
    kind: 'choose_hanzi',
    key: w => w.hanzi,
    pool: ctx.pool,
    promptHTML: `<div class="en" style="font-size:25px;font-weight:800">${UI.esc(word.english)}</div>`,
    render: o => `<span class="hz" style="font-size:25px">${UI.esc(o.hanzi)}</span>`,
  });

  EX.choose_pin = (host, word, ctx) => choiceExercise(host, word, {
    kind: 'choose_pin',
    key: w => w.pinyin,
    pool: ctx.pool,
    promptHTML: UI.hanziBlock(word.hanzi, 84),
    render: o => UI.pinyinColoured(o),
  });

  EX.listen = (host, word, ctx) => choiceExercise(host, word, {
    kind: 'listen',
    key: w => w.hanzi,
    pool: ctx.pool,
    autoPlay: word.hanzi,
    replayBtn: true,
    promptHTML: `<div style="font-size:56px">🎧</div>`,
    render: o => `<span class="hz" style="font-size:23px;flex:1;text-align:left">${UI.esc(o.hanzi)}</span>
                  <span class="muted small">${UI.esc(o.english)}</span>`,
  });

  EX.tone_id = (host, word) => {
    const tones = Store.S.tones.tones;
    const right = word.tones[0];
    return shell(host, {
      kind: 'tone_id',
      autoPlay: word.hanzi,
      promptHTML: `<div style="font-size:52px">🎵</div>
        <p class="muted small">Listen, then pick the tone</p>`,
      bodyHTML: `<div class="choices">
        ${[1, 2, 3, 4].map(t => {
          const spec = tones.find(x => x.tone === t);
          return `<button class="choice" data-tone="${t}" style="align-items:center">
            <span style="width:52px;flex:none">
              ${ToneDraw.contourSvg(spec.contour, ToneDraw.TONE_COLOUR[t], 58, 32)}
            </span>
            <span style="flex:1"><span class="t${t}" style="font-weight:800">Tone ${t}</span>
            <span class="muted small" style="display:block">${UI.esc(spec.desc)}</span></span>
          </button>`;
        }).join('')}
      </div>`,
      wire(body, submit, foot) {
        foot.innerHTML = `<button class="btn btn--ghost btn--block" id="replay">
          ${UI.icon('sound', 18)} Play again</button>`;
        foot.querySelector('#replay').addEventListener('click', () => Audio2.speak(word.hanzi));
        body.querySelectorAll('[data-tone]').forEach(btn => {
          btn.addEventListener('click', () => {
            const ok = +btn.dataset.tone === right;
            body.querySelectorAll('[data-tone]').forEach(b => {
              if (+b.dataset.tone === right) b.classList.add('choice--right');
              else if (b === btn) b.classList.add('choice--wrong');
              else b.classList.add('choice--dim');
              b.style.pointerEvents = 'none';
            });
            submit(ok, `${word.hanzi} is ${word.pinyin} — tone ${right}`);
          });
        });
      },
    });
  };

  /** Strip tone marks and spacing so typed pinyin can be compared forgivingly. */
  function plainPinyin(s) {
    const map = { 'ā':'a','á':'a','ǎ':'a','à':'a','ē':'e','é':'e','ě':'e','è':'e',
      'ī':'i','í':'i','ǐ':'i','ì':'i','ō':'o','ó':'o','ǒ':'o','ò':'o',
      'ū':'u','ú':'u','ǔ':'u','ù':'u','ǖ':'v','ǘ':'v','ǚ':'v','ǜ':'v','ü':'v' };
    return [...(s || '').toLowerCase()]
      .map(c => map[c] || c)
      .join('')
      .replace(/[^a-z]/g, '');
  }

  EX.type_pin = (host, word) => shell(host, {
    kind: 'type_pin',
    promptHTML: `${UI.hanziBlock(word.hanzi, 80)}
      <div class="en small" style="margin-top:6px">${UI.esc(word.english)}</div>`,
    bodyHTML: `
      <input class="field" id="typed" placeholder="type the pinyin…" autocomplete="off"
             autocorrect="off" autocapitalize="off" spellcheck="false"
             inputmode="latin" style="text-align:center;font-size:19px">
      <p class="muted small center" style="margin-top:8px">
        Tone marks optional — "ni hao" and "nǐ hǎo" both count.</p>`,
    wire(body, submit, foot) {
      const input = body.querySelector('#typed');
      setTimeout(() => input.focus(), 120);

      foot.innerHTML = `
        <button class="btn btn--ghost btn--block" id="hear">${UI.icon('sound', 18)} Hear it</button>
        <button class="btn btn--primary btn--block" id="check">Check</button>`;
      foot.querySelector('#hear').addEventListener('click', () => Audio2.speak(word.hanzi));

      const check = () => {
        const ok = plainPinyin(input.value) === plainPinyin(word.pinyin);
        input.style.borderColor = ok ? 'var(--mint)' : 'var(--bad)';
        input.disabled = true;
        Audio2.speak(word.hanzi);
        submit(ok, ok ? `${word.hanzi} · ${word.pinyin}`
                      : `It's <b>${UI.esc(word.pinyin)}</b> — you typed "${UI.esc(input.value || '—')}"`);
      };
      foot.querySelector('#check').addEventListener('click', check);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
    },
  });

  EX.trace = (host, word) => {
    const ch = word.chars[Math.floor(Math.random() * word.chars.length)];
    const unit = (word.units || []).find(u => u.c === ch);
    return shell(host, {
      kind: 'trace',
      promptHTML: `
        <div class="py" style="font-size:26px">${UI.esc(unit ? unit.p : word.pinyin)}</div>
        <div class="en small">${UI.esc(word.english)}
          ${word.chars.length > 1 ? `<span class="muted">(the ${UI.esc(ch)} in ${UI.esc(word.hanzi)})</span>` : ''}
        </div>`,
      bodyHTML: `<div class="hanzi-box" id="box" style="margin:8px auto"></div>
                 <p class="muted small center" id="hint" style="min-height:20px">
                   Draw the strokes in order</p>`,
      wire(body, submit, foot) {
        const box = body.querySelector('#box');
        const hint = body.querySelector('#hint');
        let misses = 0, finished = false;

        foot.innerHTML = `
          <button class="btn btn--ghost btn--block" id="show">Show me how</button>`;

        Hanzi.create(box, ch, { showCharacter: false, showOutline: true }).then(writer => {
          if (!writer) return submit(true, '');
          writer.quiz({
            showHintAfterMisses: 3,
            onMistake: () => { misses++; Audio2.buzzPhone(10); },
            onCorrectStroke: () => Audio2.pop(),
            onComplete: () => {
              if (finished) return;
              finished = true;
              Hanzi.recordTrace(ch, misses);
              Audio2.speak(word.hanzi);
              submit(misses <= 2,
                misses === 0 ? `Perfect — every stroke first time`
                             : `${ch} · ${unit ? unit.p : ''} — ${misses} slip${misses === 1 ? '' : 's'}`);
            },
          });
          foot.querySelector('#show').addEventListener('click', () => {
            misses += 3;
            writer.showCharacter();
            writer.animateCharacter();
            hint.textContent = 'Watch the order, then try again';
          });
        });
      },
    });
  };

  EX.speak = (host, word) => {
    const target = Views.speak.targetContour(word.tones);
    return shell(host, {
      kind: 'speak',
      promptHTML: `${UI.ruby(word, { cap: 62 })}
        <div class="en small" style="margin-top:4px">${UI.esc(word.english)}</div>`,
      bodyHTML: `
        <canvas id="plot" class="contour" style="height:132px"></canvas>
        <p class="muted small center" id="sHint" style="margin-top:8px">
          Tap the mic and say it — the grey line is the shape to aim for</p>`,
      wire(body, submit, foot) {
        const canvas = body.querySelector('#plot');
        const hint = body.querySelector('#sHint');
        const plot = new Views.speak.Plot(canvas, target.points);
        plot.draw();

        let rec = null, recording = false, timer = null;
        foot.innerHTML = `
          <button class="btn btn--ghost btn--block" id="hear">${UI.icon('sound', 18)} Hear it first</button>
          <div class="hstack">
            <button class="btn btn--ghost flex1" id="skip">Skip</button>
            <button class="btn btn--primary flex1" id="mic">${UI.icon('mic', 18)} Speak</button>
          </div>`;
        foot.querySelector('#hear').addEventListener('click', () => Audio2.speak(word.hanzi));
        foot.querySelector('#skip').addEventListener('click', () => submit(true, 'Skipped'));

        const mic = foot.querySelector('#mic');
        mic.addEventListener('click', async () => {
          if (recording) return stop();
          try {
            rec = new Pitch.Recorder();
            await rec.start(f => plot.push(f));
          } catch (e) {
            hint.textContent = 'Could not reach the microphone.';
            return submit(true, 'Microphone unavailable — skipped');
          }
          recording = true;
          Gamify.stats.speakAttempts = (Gamify.stats.speakAttempts || 0) + 1;
          mic.innerHTML = `${UI.icon('mic', 18)} Stop`;
          mic.classList.replace('btn--primary', 'btn--bad');
          hint.textContent = 'Listening…';
          timer = setTimeout(() => recording && stop(), 5000);
        });

        function stop() {
          clearTimeout(timer);
          recording = false;
          const frames = rec ? rec.stop() : [];
          rec = null;
          const clean = Pitch.cleanContour(frames);
          const norm = clean.length >= 4 ? Pitch.normalise(clean, target.points.length) : null;
          if (!norm) {
            hint.textContent = 'Didn\'t catch that.';
            mic.innerHTML = `${UI.icon('mic', 18)} Try again`;
            mic.classList.replace('btn--bad', 'btn--primary');
            return;
          }
          plot.setUser(norm.points);
          const cmp = Pitch.compare(norm.points, target.points);
          const v = Pitch.verdict(cmp.score);
          submit(cmp.score >= 60,
            `${v.text} — ${cmp.score}%. Target tones ${target.tones.join('-')}.`);
        }
      },
    });
  };

  /* ---- public ------------------------------------------------------------------ */

  /** Run one exercise. Falls back to multiple choice if a kind misbehaves. */
  async function run(kind, host, word, ctx) {
    const fn = EX[kind] || EX.choose_mean;
    try {
      return await fn(host, word, ctx || {});
    } catch (e) {
      console.warn('exercise failed:', kind, e);
      return EX.choose_mean(host, word, ctx || {});
    }
  }

  window.Exercises = { KINDS, EX, run, pick, strength, supported, plainPinyin, shell };
})();

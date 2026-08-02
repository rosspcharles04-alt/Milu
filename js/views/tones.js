/* Tone trainer — the thing self-taught learners most often skip.
   Three parts: learn the shapes, hear the difference, and read the sandhi rules
   from the 10.16 deck. */
(function () {
  const Views = window.Views = window.Views || {};

  /* ---- drawing a tone contour --------------------------------------------- */

  const TONE_COLOUR = { 1: '#E0524E', 2: '#E09A2C', 3: '#3EA06E', 4: '#4E7FC4', 5: '#9C8676' };

  function contourPath(points, w, h, pad) {
    pad = pad == null ? 16 : pad;
    const iw = w - pad * 2, ih = h - pad * 2;
    return points.map((v, i) => {
      const x = pad + (i / (points.length - 1)) * iw;
      const y = pad + (1 - v) * ih;
      return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  }

  function contourSvg(points, colour, w, h, extra) {
    w = w || 260; h = h || 100;
    return `
      <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" style="overflow:visible">
        <line x1="12" y1="${h - 14}" x2="${w - 12}" y2="${h - 14}"
              stroke="var(--line)" stroke-width="1.5"/>
        <line x1="12" y1="14" x2="${w - 12}" y2="14"
              stroke="var(--line)" stroke-width="1.5" stroke-dasharray="3 4"/>
        ${extra || ''}
        <path d="${contourPath(points, w, h)}" fill="none" stroke="${colour}"
              stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
  }

  window.ToneDraw = { contourSvg, contourPath, TONE_COLOUR };

  /* ---- the view ----------------------------------------------------------- */

  Views.tones = function (host, args) {
    const tab = args[0] || 'learn';
    host.innerHTML = `
      <div class="session__head">
        <button class="icon-btn" id="back" aria-label="Back">${UI.icon('back', 20)}</button>
        <div style="flex:1">
          <div style="font-weight:800;font-size:18px">Tone trainer</div>
          <div class="muted small">声调 · shēngdiào</div>
        </div>
      </div>

      <div class="hstack" style="margin-bottom:14px">
        ${[['learn', 'Shapes'], ['ear', 'Ear test'], ['sandhi', 'Rules']].map(([id, label]) => `
          <button class="btn btn--sm flex1 ${tab === id ? 'btn--primary' : 'btn--ghost'}"
                  data-tab="${id}">${label}</button>`).join('')}
      </div>

      <div style="flex:1;overflow-y:auto" id="body"></div>`;

    host.querySelector('#back').addEventListener('click', () => history.back());
    host.querySelectorAll('[data-tab]').forEach(b =>
      b.addEventListener('click', () => App.go('#/tones/' + b.dataset.tab)));

    const body = host.querySelector('#body');
    if (tab === 'ear') earTest(body);
    else if (tab === 'sandhi') sandhi(body);
    else learn(body);
  };

  /* ---- 1. the five shapes -------------------------------------------------- */

  function learn(body) {
    const tones = Store.S.tones.tones;
    body.innerHTML = `
      <p class="muted small" style="margin-bottom:12px">
        Mandarin uses pitch to tell words apart. Same syllable, different tone,
        completely different word. Tap each one to hear it.</p>
      ${tones.map(t => `
        <div class="card" style="display:flex;gap:14px;align-items:center">
          <div style="flex:none;width:96px">
            ${contourSvg(t.contour, TONE_COLOUR[t.tone], 120, 74)}
          </div>
          <div style="flex:1;min-width:0">
            <div class="card__title" style="color:${TONE_COLOUR[t.tone]}">
              ${t.tone === 5 ? 'Neutral' : t.tone} ${t.mark} ${UI.esc(t.name)}
            </div>
            <p class="card__note">${UI.esc(t.desc)}</p>
            <button class="btn btn--sm btn--ghost" data-say="${UI.esc(t.example.split(' ')[1] || t.example)}"
                    style="margin-top:8px">
              ${UI.icon('sound', 15)} ${UI.esc(t.example)}</button>
          </div>
        </div>`).join('')}

      <div class="card card--amber">
        <div class="card__title">🎧 The classic four</div>
        <p class="card__note">Same syllable "ma", four meanings. Play them back to back.</p>
        <div class="wrap" style="margin-top:10px">
          ${[['妈', 'mā', 'mother', 1], ['麻', 'má', 'hemp', 2],
             ['马', 'mǎ', 'horse', 3], ['骂', 'mà', 'to scold', 4]].map(([hz, py, en, t]) => `
            <button class="btn btn--sm" data-say="${hz}"
                    style="background:var(--surface);flex-direction:column;gap:1px">
              <span class="hz" style="font-size:23px">${hz}</span>
              <span class="t${t}" style="font-size:12px;font-weight:800">${py}</span>
              <span class="muted" style="font-size:10px">${en}</span>
            </button>`).join('')}
        </div>
      </div>`;

    body.querySelectorAll('[data-say]').forEach(b =>
      b.addEventListener('click', () => Audio2.speak(b.dataset.say)));
  }

  /* ---- 2. ear test ---------------------------------------------------------- */

  function earTest(body) {
    // Single-syllable words make the cleanest tone questions.
    const pool = Store.S.vocab.filter(w =>
      w.chars.length === 1 && w.tones.length === 1 && w.tones[0] >= 1 && w.tones[0] <= 4);

    if (pool.length < 4) {
      body.innerHTML = `<p class="muted center">Not enough single-character words yet.</p>`;
      return;
    }

    const st = { i: 0, right: 0, n: 10, queue: UI.shuffle(pool).slice(0, 10), answered: false };
    ask();

    function ask() {
      if (st.i >= st.queue.length) return done();
      const w = st.queue[st.i];
      st.answered = false;

      body.innerHTML = `
        <div class="hstack" style="margin-bottom:12px">
          <div class="bar flex1"><div class="bar__fill"
               style="width:${st.i / st.queue.length * 100}%"></div></div>
          <span class="chip chip--mint">${st.right}/${st.queue.length}</span>
        </div>

        <div class="card center">
          <p class="muted small">Which tone did you hear?</p>
          <button class="btn btn--round" id="say" style="margin:12px auto;
                  background:var(--amber);color:#fff">${UI.icon('sound', 26)}</button>
          <div id="reveal" class="hidden">
            <div class="hz" style="font-size:44px">${UI.esc(w.hanzi)}</div>
            <div style="margin-top:2px">${UI.pinyinColoured(w)}</div>
            <div class="en small">${UI.esc(w.english)}</div>
          </div>
        </div>

        <div class="choices" id="opts">
          ${[1, 2, 3, 4].map(t => {
            const tone = Store.S.tones.tones.find(x => x.tone === t);
            return `
              <button class="choice" data-tone="${t}" style="align-items:center">
                <span style="width:56px;flex:none">
                  ${contourSvg(tone.contour, TONE_COLOUR[t], 60, 34, '')}
                </span>
                <span style="flex:1">
                  <span class="t${t}" style="font-weight:800">Tone ${t}</span>
                  <span class="muted small" style="display:block">${UI.esc(tone.desc)}</span>
                </span>
              </button>`;
          }).join('')}
        </div>`;

      body.querySelector('#say').addEventListener('click', () => Audio2.speak(w.hanzi));
      setTimeout(() => Audio2.speak(w.hanzi), 300);

      body.querySelectorAll('[data-tone]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (st.answered) return;
          st.answered = true;
          const guess = +btn.dataset.tone;
          const ok = guess === w.tones[0];

          body.querySelectorAll('[data-tone]').forEach(b => {
            if (+b.dataset.tone === w.tones[0]) b.classList.add('choice--right');
            else if (b === btn) b.classList.add('choice--wrong');
            else b.classList.add('choice--dim');
          });
          body.querySelector('#reveal').classList.remove('hidden');

          if (ok) { st.right++; Audio2.ding(); } else { Audio2.buzz(); }
          Audio2.buzzPhone(ok ? 10 : [16, 50, 16]);

          setTimeout(() => { st.i++; ask(); }, ok ? 900 : 1700);
        });
      });
    }

    function done() {
      const pct = Math.round(st.right / st.queue.length * 100);
      if (pct >= 80) { UI.confetti(); Audio2.fanfare(); }
      body.innerHTML = `
        <div class="center" style="padding-top:20px">
          ${Mascot.svg(pct >= 80 ? 'cheer' : pct >= 50 ? 'proud' : 'think', 120)}
          <h2 style="font-size:26px;font-weight:800;margin-top:8px">${st.right} / ${st.queue.length}</h2>
          <p class="card__note">${
            pct >= 80 ? 'Your ear is getting sharp.'
            : pct >= 50 ? 'Tones 2 and 3 trip everyone up — keep going.'
            : 'Go back to Shapes and listen a few more times.'}</p>
          <button class="btn btn--primary" id="again" style="margin-top:16px">Again</button>
        </div>`;
      body.querySelector('#again').addEventListener('click', () => earTest(body));
    }
  }

  /* ---- 3. sandhi rules ------------------------------------------------------ */

  function sandhi(body) {
    body.innerHTML = `
      <p class="muted small" style="margin-bottom:12px">
        Tones shift when they bump into each other. These four rules cover almost
        everything you'll hit as a beginner.</p>
      ${Store.S.tones.sandhi.map(r => `
        <div class="card">
          <div class="card__title">${UI.esc(r.title)}</div>
          <div class="pill pill--amber" style="margin:4px 0 8px">${UI.esc(r.rule)}</div>
          <p class="card__note">${UI.esc(r.explain)}</p>
          <div style="margin-top:12px">
            ${r.examples.map(ex => `
              <button class="row" data-say="${UI.esc(ex.hanzi)}" style="margin-bottom:7px">
                <span class="row__lead hz" style="font-size:19px">${UI.esc(ex.hanzi)}</span>
                <span class="row__main">
                  <span class="row__title" style="font-size:14px">
                    <span class="muted" style="text-decoration:line-through">${UI.esc(ex.written)}</span>
                    &nbsp;→&nbsp;
                    <span style="color:var(--amber-deep)">${UI.esc(ex.spoken)}</span>
                  </span>
                  <span class="row__sub">${UI.esc(ex.english)}</span>
                </span>
                ${UI.icon('sound', 17)}
              </button>`).join('')}
          </div>
        </div>`).join('')}

      <div class="card card--mint">
        <div class="card__title">🦌 Mílù's tip</div>
        <p class="card__note">You don't write these changes down — pinyin keeps the
          original tone marks. They only happen when you speak. So read 你好 as
          <b>ní hǎo</b> even though it's written <b>nǐ hǎo</b>.</p>
      </div>`;

    body.querySelectorAll('[data-say]').forEach(b =>
      b.addEventListener('click', () => Audio2.speak(b.dataset.say)));
  }
})();

/* Characters — browse them, watch the stroke order, trace them with a finger,
   and see what they're built from. */
(function () {
  const Views = window.Views = window.Views || {};

  /* ---- grid --------------------------------------------------------------- */

  Views.chars = function (host) {
    const all = Hanzi.allChars();
    const traced = Object.values(Store.S.chars).filter(c => c.traced > 0).length;

    host.innerHTML = `
      <div class="topbar">
        <div>
          <div class="topbar__title">Characters</div>
          <div class="topbar__sub">汉字 · hànzì — ${all.length} in your deck</div>
        </div>
      </div>

      <div class="card card--lilac">
        <div class="card__title">✍️ Written practice</div>
        <p class="card__note">${traced} of ${all.length} characters traced at least once.</p>
        <div class="bar" style="margin:10px 0 12px">
          <div class="bar__fill" style="width:${all.length ? traced / all.length * 100 : 0}%"></div>
        </div>
        <button class="btn btn--primary btn--block btn--sm" id="write">
          Practise writing from memory</button>
      </div>

      <input class="field" id="search" placeholder="Search a character, pinyin or meaning"
             autocomplete="off" autocorrect="off" spellcheck="false" style="margin-bottom:14px">

      <div class="grid grid--auto" id="grid"></div>`;

    const grid = host.querySelector('#grid');
    const search = host.querySelector('#search');

    function paint(filter) {
      const q = (filter || '').trim().toLowerCase();
      const list = all.filter(c => {
        if (!q) return true;
        if (c.ch === q || c.ch.includes(q)) return true;
        return c.words.some(w =>
          w.pinyin.toLowerCase().includes(q) || w.english.toLowerCase().includes(q));
      }).slice(0, 400);

      grid.innerHTML = list.map(c => {
        const s = Store.S.chars[c.ch];
        const dot = !s || !s.traced ? '' :
          `<span class="char-cell__dot" style="background:${s.best === 0 ? 'var(--mint)' : 'var(--amber)'}"></span>`;
        return `<button class="char-cell" data-char="${UI.esc(c.ch)}">${UI.esc(c.ch)}${dot}</button>`;
      }).join('') || `<p class="muted small" style="grid-column:1/-1">Nothing matches that.</p>`;

      grid.querySelectorAll('[data-char]').forEach(b =>
        b.addEventListener('click', () => App.go('#/char/' + encodeURIComponent(b.dataset.char))));
    }

    paint('');
    search.addEventListener('input', () => paint(search.value));
    host.querySelector('#write').addEventListener('click', () => App.go('#/write'));
  };

  /* ---- one character ------------------------------------------------------ */

  Views.char = async function (host, args) {
    const ch = args[0];
    await Hanzi.load();

    const words = Store.S.vocab.filter(w => (w.chars || []).includes(ch)).slice(0, 14);
    const info = Hanzi.breakdown(ch);
    const strokes = Hanzi.strokeCount(ch);
    const stat = Store.S.chars[ch];
    // Pinyin for the character on its own, if we have a one-character word for it.
    const solo = Store.S.vocab.find(w => w.hanzi === ch);
    const unit = words.length ? (words[0].units || []).find(u => u.c === ch) : null;

    host.innerHTML = `
      <div class="session__head">
        <button class="icon-btn" id="back" aria-label="Back">${UI.icon('back', 20)}</button>
        <div style="flex:1">
          <div style="font-weight:800;font-size:18px">${UI.esc(ch)}
            <span class="py" style="font-size:15px">${UI.esc(solo ? solo.pinyin : (unit ? unit.p : ''))}</span>
          </div>
          <div class="muted small">${strokes} stroke${strokes === 1 ? '' : 's'}${
            solo ? ' · ' + UI.esc(solo.english) : ''}</div>
        </div>
        <button class="icon-btn" id="say" aria-label="Play">${UI.icon('sound', 20)}</button>
      </div>

      <div style="flex:1;overflow-y:auto">
        <div class="hanzi-box" id="box"></div>

        <div class="hstack" style="justify-content:center;margin:16px 0 6px">
          <button class="btn btn--ghost btn--sm" id="animate">${UI.icon('play', 16)} Stroke order</button>
          <button class="btn btn--primary btn--sm" id="trace">✍️ Trace it</button>
        </div>
        <p class="muted small center" id="hint" style="min-height:20px"></p>

        ${info ? `
          <div class="card card--amber">
            <div class="card__title">🧩 What it's made of</div>
            <p class="card__note hz" style="font-size:16px;margin-bottom:4px">${UI.esc(info.parts)}</p>
            <p class="card__note">${UI.esc(info.note)}</p>
          </div>` : ''}

        ${stat && stat.traced ? `
          <div class="card card--mint">
            <div class="card__title">✅ Your writing</div>
            <p class="card__note">Traced ${stat.traced}×${
              stat.best === 0 ? ' — best attempt was perfect' : `, best had ${stat.best} slip${stat.best === 1 ? '' : 's'}`}</p>
          </div>` : ''}

        ${words.length ? `
          <div class="section-title">Words with ${UI.esc(ch)}</div>
          ${words.map(w => `
            <button class="row" data-say="${UI.esc(w.hanzi)}">
              <span class="row__lead hz" style="font-size:20px">${UI.esc(w.hanzi.slice(0, 3))}</span>
              <span class="row__main">
                <span class="row__title">${UI.esc(w.english)}</span>
                <span class="row__sub">${UI.esc(w.pinyin)}</span>
              </span>
              ${UI.icon('sound', 18)}
            </button>`).join('')}` : ''}
      </div>`;

    const box = host.querySelector('#box');
    const hint = host.querySelector('#hint');
    let writer = null;

    if (!Hanzi.hasChar(ch)) {
      box.innerHTML = `<div style="display:grid;place-items:center;height:100%">
        <span class="hz" style="font-size:110px">${UI.esc(ch)}</span></div>`;
      hint.textContent = 'No stroke data for this character.';
      host.querySelector('#animate').disabled = true;
      host.querySelector('#trace').disabled = true;
    } else {
      writer = await Hanzi.create(box, ch);
    }

    host.querySelector('#back').addEventListener('click', () => history.back());
    host.querySelector('#say').addEventListener('click', () =>
      Audio2.speak(solo ? solo.hanzi : ch));
    host.querySelectorAll('[data-say]').forEach(b =>
      b.addEventListener('click', () => Audio2.speak(b.dataset.say)));

    host.querySelector('#animate').addEventListener('click', () => {
      if (!writer) return;
      hint.textContent = 'Watch the order and direction…';
      writer.animateCharacter({ onComplete: () => { hint.textContent = ''; } });
    });

    host.querySelector('#trace').addEventListener('click', () => {
      if (!writer) return;
      let misses = 0;
      hint.textContent = 'Draw the strokes in order — I\'ll nudge you if you get stuck.';
      writer.quiz({
        showHintAfterMisses: 2,
        onMistake: () => { misses++; Audio2.buzzPhone(10); },
        onCorrectStroke: () => Audio2.pop(),
        onComplete: () => {
          Hanzi.recordTrace(ch, misses);
          Audio2.ding();
          UI.confetti(16);
          hint.textContent = misses === 0
            ? 'Perfect — every stroke first time! 太好了！'
            : `Done, with ${misses} slip${misses === 1 ? '' : 's'}. Try again to beat it.`;
        },
      });
    });
  };

  /* ---- writing practice --------------------------------------------------- */

  Views.write = async function (host) {
    await Hanzi.load();

    // Practise the characters from words that are actually in rotation.
    const seen = Store.S.vocab.filter(w => SRS.has(w.id));
    const source = (seen.length >= 5 ? seen : Store.S.vocab.slice(0, 40));
    const chars = [];
    const used = new Set();
    source.forEach(w => (w.chars || []).forEach(c => {
      if (!used.has(c) && Hanzi.hasChar(c)) { used.add(c); chars.push({ ch: c, word: w }); }
    }));

    if (!chars.length) {
      host.innerHTML = `<div class="session__body">${Mascot.svg('think', 110)}
        <p class="card__note center">Learn a few words first, then come back to write them.</p></div>
        <div class="session__foot"><button class="btn btn--primary btn--block"
          onclick="location.hash='#/today'">Back</button></div>`;
      return;
    }

    const queue = UI.shuffle(chars).slice(0, 10);
    const st = { i: 0, perfect: 0, misses: 0 };
    step();

    function step() {
      if (st.i >= queue.length) return finish();
      const { ch, word } = queue[st.i];
      const unit = (word.units || []).find(u => u.c === ch);

      host.innerHTML = `
        <div class="session__head">
          <button class="icon-btn" id="quit" aria-label="Quit">${UI.icon('close', 18)}</button>
          <div class="bar flex1"><div class="bar__fill"
               style="width:${st.i / queue.length * 100}%"></div></div>
          <span class="chip chip--mint">${st.i + 1}/${queue.length}</span>
        </div>

        <div class="session__body">
          <p class="muted small">Write this character from memory</p>
          <div class="py" style="font-size:30px">${UI.esc(unit ? unit.p : '')}</div>
          <div class="en">${UI.esc(word.english)}
            <span class="muted small">(in ${UI.esc(word.hanzi)})</span></div>
          <div class="hanzi-box" id="box" style="margin-top:8px"></div>
          <p class="muted small" id="hint" style="min-height:20px"></p>
        </div>

        <div class="session__foot">
          <div class="hstack">
            <button class="btn btn--ghost flex1" id="show">Show me</button>
            <button class="btn btn--ghost flex1" id="skip">Skip</button>
          </div>
        </div>`;

      const box = host.querySelector('#box');
      const hint = host.querySelector('#hint');
      let misses = 0;

      Hanzi.create(box, ch, { showCharacter: false, showOutline: false }).then(writer => {
        if (!writer) return next();
        writer.quiz({
          showHintAfterMisses: 3,
          onMistake: () => { misses++; Audio2.buzzPhone(10); },
          onCorrectStroke: () => Audio2.pop(),
          onComplete: () => {
            Hanzi.recordTrace(ch, misses);
            st.misses += misses;
            if (misses === 0) st.perfect++;
            Audio2.ding();
            hint.textContent = misses === 0 ? 'Perfect!' : `${misses} slip${misses === 1 ? '' : 's'}`;
            setTimeout(next, 850);
          },
        });

        host.querySelector('#show').addEventListener('click', () => {
          misses += 2;
          writer.showCharacter();
          writer.animateCharacter();
          hint.textContent = 'Watch, then try the next one.';
        });
      });

      host.querySelector('#quit').addEventListener('click', () => App.go('#/chars'));
      host.querySelector('#skip').addEventListener('click', next);
    }

    function next() { st.i++; step(); }

    function finish() {
      if (st.perfect >= queue.length * 0.6) { UI.confetti(); Audio2.fanfare(); }
      host.innerHTML = `
        <div class="session__body">
          ${Mascot.svg(st.perfect >= queue.length * 0.6 ? 'cheer' : 'proud', 128)}
          <h2 style="font-size:25px;font-weight:800">${st.perfect} / ${queue.length} perfect</h2>
          <p class="card__note center">${st.misses} stroke slip${st.misses === 1 ? '' : 's'} altogether.</p>
        </div>
        <div class="session__foot">
          <button class="btn btn--primary btn--block" id="again">Another round</button>
          <button class="btn btn--ghost btn--block" id="back">Done</button>
        </div>`;
      host.querySelector('#again').addEventListener('click', () => Views.write(host));
      host.querySelector('#back').addEventListener('click', () => App.go('#/chars'));
    }
  };
})();

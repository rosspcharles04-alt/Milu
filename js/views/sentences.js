/* Sentence builder — put the words in the right order.

   Tap to place rather than drag: far more reliable on a phone, and quicker. */
(function () {
  const Views = window.Views = window.Views || {};

  function bank() {
    const out = [];
    Store.S.patterns.forEach(p => {
      p.examples.forEach(ex => {
        if (ex.words && ex.words.length >= 2 && ex.words.length <= 8) {
          out.push({ ...ex, patternId: p.id, note: p.note, pattern: p.hanzi });
        }
      });
    });
    Store.S.dialogues.forEach(d => {
      d.lines.forEach(ln => {
        const words = segment(ln.hanzi);
        if (words.length >= 3 && words.length <= 8) {
          out.push({ hanzi: ln.hanzi, pinyin: ln.pinyin, english: ln.english,
                     words, from: d.title });
        }
      });
    });
    return out;
  }

  // Punctuation is never a tile — placing full stops is not a language skill.
  const PUNCT = /[，。！？、；：""''〈〉《》（）,.!?;:'"()\s]/;

  /** Longest-match segmentation against known vocabulary. */
  function segment(hanzi) {
    const known = Store.S.byId;
    const tiles = [];
    let i = 0;
    while (i < hanzi.length) {
      const ch = hanzi[i];
      if (!/[㐀-鿿]/.test(ch)) {
        if (ch.trim() && !PUNCT.test(ch)) tiles.push(ch);
        i++;
        continue;
      }
      let taken = false;
      for (let len = Math.min(4, hanzi.length - i); len >= 1; len--) {
        const chunk = hanzi.slice(i, i + len);
        if (known.has(chunk) || len === 1) {
          tiles.push(chunk);
          i += len;
          taken = true;
          break;
        }
      }
      if (!taken) i++;
    }
    return tiles;
  }

  Views.sentences = function (host, args) {
    let all = bank();
    if (args[0]) {
      const only = all.filter(s => s.patternId === args[0]);
      if (only.length) all = only;
    }
    if (!all.length) {
      host.innerHTML = `<div class="session__body">${Mascot.svg('think', 110)}
        <p class="card__note center">No sentences available.</p></div>
        <div class="session__foot"><button class="btn btn--primary btn--block"
          onclick="location.hash='#/practice'">Back</button></div>`;
      return;
    }

    const st = { queue: UI.shuffle(all).slice(0, 10), i: 0, right: 0 };
    step();

    function step() {
      if (st.i >= st.queue.length) return finish();
      const s = st.queue[st.i];
      const answer = s.words.slice();
      const tiles = UI.shuffle(answer.map((w, k) => ({ w, k })));
      const placed = [];
      let checked = false;

      host.innerHTML = `
        <div class="session__head">
          <button class="icon-btn" id="quit" aria-label="Quit">${UI.icon('close', 18)}</button>
          <div class="bar flex1"><div class="bar__fill"
               style="width:${st.i / st.queue.length * 100}%"></div></div>
          <span class="chip chip--mint">${st.right}/${st.queue.length}</span>
        </div>

        <div class="session__body" style="justify-content:flex-start;gap:14px">
          <p class="muted small">Build this sentence</p>
          <div class="en" style="font-size:20px;font-weight:800">${UI.esc(s.english)}</div>
          ${s.pattern ? `<span class="pill pill--amber hz">${UI.esc(s.pattern)}</span>` : ''}

          <div class="slots" id="slots"></div>
          <div class="bank" id="bank"></div>
          <div id="feedback" style="width:100%"></div>
        </div>

        <div class="session__foot">
          <div class="hstack">
            <button class="btn btn--ghost flex1" id="undo">Undo</button>
            <button class="btn btn--primary flex1" id="check">Check</button>
          </div>
        </div>`;

      const slotsEl = host.querySelector('#slots');
      const bankEl = host.querySelector('#bank');
      const fb = host.querySelector('#feedback');

      function paint() {
        slotsEl.innerHTML = placed.map((p, idx) =>
          `<button class="tok" data-remove="${idx}">${UI.esc(p.w)}</button>`).join('')
          || `<span class="muted small" style="align-self:center;padding:8px">
                Tap the words below in order</span>`;

        bankEl.innerHTML = tiles.map(t => {
          const used = placed.some(p => p.k === t.k);
          return `<button class="tok${used ? ' tok--used' : ''}"
                    data-add="${t.k}">${UI.esc(t.w)}</button>`;
        }).join('');

        if (!checked) {
          slotsEl.querySelectorAll('[data-remove]').forEach(b =>
            b.addEventListener('click', () => {
              placed.splice(+b.dataset.remove, 1);
              paint();
            }));
          bankEl.querySelectorAll('[data-add]').forEach(b =>
            b.addEventListener('click', () => {
              const k = +b.dataset.add;
              if (placed.some(p => p.k === k)) return;
              placed.push(tiles.find(t => t.k === k));
              Audio2.pop();
              paint();
            }));
        }
      }
      paint();

      host.querySelector('#quit').addEventListener('click', () => App.go('#/practice'));
      host.querySelector('#undo').addEventListener('click', () => {
        if (checked) return;
        placed.pop();
        paint();
      });

      host.querySelector('#check').addEventListener('click', () => {
        if (checked) { st.i++; step(); return; }
        if (placed.length !== answer.length) {
          UI.toast('Use all the words first');
          return;
        }
        checked = true;

        const built = placed.map(p => p.w).join('');
        const ok = built === answer.join('');
        if (ok) { st.right++; Audio2.ding(); UI.confetti(14); } else Audio2.buzz();
        Audio2.buzzPhone(ok ? 10 : [16, 50, 16]);

        // Mark each tile against the correct position.
        slotsEl.querySelectorAll('.tok').forEach((el, idx) => {
          el.classList.add(placed[idx].w === answer[idx] ? 'tok--right' : 'tok--wrong');
        });

        fb.innerHTML = `
          <div class="banner banner--${ok ? 'good' : 'bad'}" style="margin-top:6px">
            <div>
              <div>${ok ? '对了！ Correct!' : 'Not quite — here it is:'}</div>
              ${!ok ? `<div class="hz" style="font-size:20px;margin-top:4px">${UI.esc(s.hanzi)}</div>` : ''}
              <div class="small" style="font-weight:600;opacity:.85">${UI.esc(s.pinyin)}</div>
            </div>
          </div>
          ${s.note ? `<p class="muted small" style="margin-top:8px">💡 ${UI.esc(s.note)}</p>` : ''}`;

        Audio2.speak(s.hanzi);
        host.querySelector('#check').textContent =
          st.i >= st.queue.length - 1 ? 'See results' : 'Next sentence';
      });
    }

    function finish() {
      const pct = Math.round(st.right / st.queue.length * 100);
      if (pct >= 80) { UI.confetti(); Audio2.fanfare(); }
      host.innerHTML = `
        <div class="session__body">
          ${Mascot.svg(pct >= 80 ? 'cheer' : pct >= 50 ? 'proud' : 'think', 128)}
          <h2 style="font-size:26px;font-weight:800">${st.right} / ${st.queue.length}</h2>
          <p class="card__note center">${
            pct >= 80 ? 'Word order is clicking for you.'
            : 'Word order takes repetition — the patterns page helps.'}</p>
        </div>
        <div class="session__foot">
          <button class="btn btn--primary btn--block" id="again">Again</button>
          <button class="btn btn--ghost btn--block" id="back">Done</button>
        </div>`;
      host.querySelector('#again').addEventListener('click', () => Views.sentences(host, args));
      host.querySelector('#back').addEventListener('click', () => App.go('#/practice'));
    }
  };
})();

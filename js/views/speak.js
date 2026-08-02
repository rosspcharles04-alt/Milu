/* Speaking practice.

   Two checks run off one recording:
     · tone  — your pitch contour against the shape the word should have
     · word  — the browser's recogniser confirming you said the right thing
   The tone check is entirely on-device. The word check needs a connection, so
   it's treated as a bonus: if it can't run, the tone feedback still stands. */
(function () {
  const Views = window.Views = window.Views || {};

  const PTS = 5;   // points sampled per syllable

  /** Build the target contour for a whole word, applying tone sandhi. */
  function targetContour(tones) {
    const t = applySandhi(tones.slice());
    const table = Store.S.tones.tones;
    const out = [];
    t.forEach((tone, i) => {
      const spec = table.find(x => x.tone === tone) || table[4];
      // Each syllable sits slightly lower than the last, as speech naturally does.
      const drift = 1 - i * 0.05;
      spec.contour.forEach(v => out.push(Math.max(0, Math.min(1, v * drift))));
    });
    return { points: out, tones: t };
  }

  /** 3+3 → 2+3, and the 一/不 shifts, exactly as the sandhi rules describe. */
  function applySandhi(t) {
    for (let i = 0; i < t.length - 1; i++) {
      if (t[i] === 3 && t[i + 1] === 3) t[i] = 2;
    }
    return t;
  }

  Views.speak = function (host) {
    const pool = buildPool();
    if (!pool.length) {
      host.innerHTML = `<div class="session__body">${Mascot.svg('think', 110)}
        <p class="card__note center">Learn a few words first, then come back and say them.</p></div>
        <div class="session__foot"><button class="btn btn--primary btn--block"
          onclick="location.hash='#/today'">Back</button></div>`;
      return;
    }

    const st = {
      queue: UI.shuffle(pool).slice(0, 12),
      i: 0,
      rec: null,
      recording: false,
      best: {},
      attempts: 0,
      scores: [],
    };
    step(host, st);
  };

  function buildPool() {
    const seen = Store.S.vocab.filter(w => SRS.has(w.id) && w.tones.length && w.tones.length <= 3);
    if (seen.length >= 6) return seen;
    return Store.S.vocab.filter(w => w.tones.length && w.tones.length <= 2).slice(0, 60);
  }

  function step(host, st) {
    if (st.i >= st.queue.length) return finish(host, st);
    const w = st.queue[st.i];
    const target = targetContour(w.tones);

    host.innerHTML = `
      <div class="session__head">
        <button class="icon-btn" id="quit" aria-label="Quit">${UI.icon('close', 18)}</button>
        <div class="bar flex1"><div class="bar__fill"
             style="width:${st.i / st.queue.length * 100}%"></div></div>
        <span class="chip chip--amber">${st.i + 1}/${st.queue.length}</span>
      </div>

      <div class="session__body" style="justify-content:flex-start;gap:10px">
        ${UI.ruby(w, { size: 'clamp(44px,13vw,68px)' })}
        <div class="en">${UI.esc(w.english)}</div>
        <button class="btn btn--sm btn--ghost" id="ref">
          ${UI.icon('sound', 16)} Hear it first</button>

        <div style="width:100%;position:relative;margin-top:6px">
          <canvas id="plot" class="contour"></canvas>
          <div id="legend" class="hstack small"
               style="justify-content:center;gap:16px;margin-top:8px">
            <span class="hstack" style="gap:5px"><i style="width:16px;height:4px;
              border-radius:2px;background:var(--line);display:inline-block"></i>
              target ${target.tones.join('-')}</span>
            <span class="hstack" style="gap:5px"><i style="width:16px;height:4px;
              border-radius:2px;background:var(--amber);display:inline-block"></i> you</span>
          </div>
        </div>

        <div id="result" style="width:100%"></div>
      </div>

      <div class="session__foot">
        <button class="btn btn--primary btn--block" id="mic">
          ${UI.icon('mic', 20)} Hold to speak</button>
        <div class="hstack">
          <button class="btn btn--ghost flex1" id="skip">Skip</button>
          <button class="btn btn--ghost flex1" id="next">Next word</button>
        </div>
      </div>`;

    const canvas = host.querySelector('#plot');
    const plot = new Plot(canvas, target.points);
    plot.draw([]);

    host.querySelector('#quit').addEventListener('click', () => { cleanup(st); App.go('#/practice'); });
    host.querySelector('#ref').addEventListener('click', () => Audio2.speak(w.hanzi));
    host.querySelector('#skip').addEventListener('click', () => { cleanup(st); st.i++; step(host, st); });
    host.querySelector('#next').addEventListener('click', () => { cleanup(st); st.i++; step(host, st); });

    const mic = host.querySelector('#mic');
    const result = host.querySelector('#result');

    // Press and hold, or tap to toggle — both work.
    let holdTimer = null, viaHold = false;

    mic.addEventListener('pointerdown', e => {
      e.preventDefault();
      viaHold = false;
      holdTimer = setTimeout(() => { viaHold = true; }, 260);
      if (!st.recording) start();
    });
    mic.addEventListener('pointerup', () => {
      clearTimeout(holdTimer);
      if (viaHold && st.recording) stop();
    });
    mic.addEventListener('pointercancel', () => { clearTimeout(holdTimer); if (st.recording) stop(); });
    mic.addEventListener('click', e => {
      e.preventDefault();
      if (!viaHold && st.recording && st.startedAt && Date.now() - st.startedAt > 350) stop();
    });

    async function start() {
      if (!(await Pitch.supported())) {
        result.innerHTML = banner('bad', 'This browser can\'t reach the microphone.');
        return;
      }
      result.innerHTML = '';
      plot.reset();

      // Kick off the word check alongside; it may not be available, that's fine.
      st.recognition = Speech.supported()
        ? Speech.listen({ timeout: 6000 }).catch(() => null)
        : Promise.resolve(null);

      st.rec = new Pitch.Recorder();
      try {
        await st.rec.start(frame => plot.push(frame));
      } catch (e) {
        result.innerHTML = banner('bad',
          e.name === 'NotAllowedError'
            ? 'Microphone blocked — allow it in Safari settings for this site.'
            : 'Could not start the microphone.');
        st.rec = null;
        return;
      }

      st.recording = true;
      st.startedAt = Date.now();
      mic.innerHTML = `${UI.icon('mic', 20)} Listening… tap to stop`;
      mic.classList.add('btn--bad');
      mic.classList.remove('btn--primary');

      // Safety net so a stuck recording doesn't run forever.
      st.autoStop = setTimeout(() => { if (st.recording) stop(); }, 6000);
    }

    async function stop() {
      if (!st.recording) return;
      clearTimeout(st.autoStop);
      st.recording = false;
      mic.innerHTML = `${UI.icon('mic', 20)} Hold to speak`;
      mic.classList.remove('btn--bad');
      mic.classList.add('btn--primary');

      const frames = st.rec ? st.rec.stop() : [];
      st.rec = null;

      const clean = Pitch.cleanContour(frames);
      if (clean.length < 4) {
        result.innerHTML = banner('bad', 'Didn\'t catch that — speak a little louder, closer to the mic.');
        return;
      }

      const norm = Pitch.normalise(clean, target.points.length);
      if (!norm) {
        result.innerHTML = banner('bad', 'Too short to read — try holding the sound a moment longer.');
        return;
      }

      plot.setUser(norm.points);
      const cmp = Pitch.compare(norm.points, target.points);
      const v = Pitch.verdict(cmp.score);
      st.attempts++;
      st.scores.push(cmp.score);
      if (!st.best[w.id] || cmp.score > st.best[w.id]) st.best[w.id] = cmp.score;

      result.innerHTML = `
        <div class="card" style="margin-top:4px">
          <div class="hstack">
            <div style="flex:none">${Mascot.svg(v.mood, 56)}</div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:800;font-size:17px;color:${v.colour}">
                ${v.text} · ${cmp.score}%</div>
              <div class="meter" style="margin-top:7px">
                <div class="meter__fill" style="width:${cmp.score}%;background:${v.colour}"></div>
              </div>
              <div class="muted small" style="margin-top:6px">
                Shape ${Math.round(cmp.shape * 100)}% · direction ${Math.round(cmp.direction * 100)}%
              </div>
            </div>
          </div>
          <div id="wordcheck" class="muted small" style="margin-top:10px">
            Checking the word…</div>
        </div>`;

      if (cmp.score >= 82) { Audio2.ding(); UI.confetti(14); }
      else if (cmp.score < 45) Audio2.buzz();

      // Fold in the word check when it lands.
      const box = host.querySelector('#wordcheck');
      const r = await (st.recognition || Promise.resolve(null));
      if (!box || !box.isConnected) return;

      if (!r || !r.ok) {
        box.innerHTML = Speech.supported()
          ? `<span class="muted">Word check unavailable ${
              r && r.error === 'no-speech' ? '(nothing recognised)' : '(needs a connection)'}.</span>`
          : `<span class="muted">Word check isn't supported in this browser.</span>`;
        return;
      }
      const m = Speech.bestMatch(w.hanzi, r);
      box.innerHTML = m.score >= 0.85
        ? `<span style="color:var(--mint);font-weight:700">✓ Heard "${UI.esc(m.heard)}" — that's the word.</span>`
        : m.score >= 0.4
          ? `<span style="color:var(--amber-deep);font-weight:700">Heard "${UI.esc(m.heard)}" — close, but not quite ${UI.esc(w.hanzi)}.</span>`
          : `<span style="color:var(--bad);font-weight:700">Heard "${UI.esc(m.heard)}" instead of ${UI.esc(w.hanzi)}.</span>`;
    }
  }

  function banner(kind, text) {
    return `<div class="banner banner--${kind}" style="margin-top:8px">${UI.esc(text)}</div>`;
  }

  function cleanup(st) {
    if (st.rec) { try { st.rec.stop(); } catch (e) {} st.rec = null; }
    st.recording = false;
    clearTimeout(st.autoStop);
  }

  /* ---- live pitch plot ------------------------------------------------------ */

  function Plot(canvas, target) {
    this.canvas = canvas;
    this.target = target;
    this.live = [];
    this.user = null;
    this.resize();
  }

  Plot.prototype.resize = function () {
    const dpr = window.devicePixelRatio || 1;
    const r = this.canvas.getBoundingClientRect();
    this.w = r.width || 320;
    this.h = r.height || 168;
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  Plot.prototype.reset = function () { this.live = []; this.user = null; this.draw(); };
  Plot.prototype.setUser = function (points) { this.user = points; this.draw(); };

  Plot.prototype.push = function (frame) {
    this.live.push(frame);
    if (this.live.length > 400) this.live.shift();
    this.draw();
  };

  Plot.prototype.draw = function () {
    const c = this.ctx, w = this.w, h = this.h, pad = 18;
    if (!c) return;
    const css = getComputedStyle(document.documentElement);
    const line = css.getPropertyValue('--line').trim() || '#eee';
    const amber = css.getPropertyValue('--amber').trim() || '#E89049';

    c.clearRect(0, 0, w, h);

    // guide lines
    c.strokeStyle = line;
    c.lineWidth = 1.5;
    [0.15, 0.5, 0.85].forEach(f => {
      c.beginPath();
      c.setLineDash(f === 0.5 ? [3, 4] : []);
      c.moveTo(pad, pad + (1 - f) * (h - pad * 2));
      c.lineTo(w - pad, pad + (1 - f) * (h - pad * 2));
      c.stroke();
    });
    c.setLineDash([]);

    // target shape
    const plotLine = (pts, colour, width, alpha) => {
      if (!pts || pts.length < 2) return;
      c.globalAlpha = alpha == null ? 1 : alpha;
      c.strokeStyle = colour;
      c.lineWidth = width;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.beginPath();
      pts.forEach((v, i) => {
        const x = pad + (i / (pts.length - 1)) * (w - pad * 2);
        const y = pad + (1 - v) * (h - pad * 2);
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      });
      c.stroke();
      c.globalAlpha = 1;
    };

    plotLine(this.target, line, 7, 1);

    // live trace while recording
    const voiced = this.live.filter(f => f.hz > 0);
    if (voiced.length > 2 && !this.user) {
      const hz = voiced.map(f => f.hz);
      const lo = Math.min(...hz), hi = Math.max(...hz);
      const span = Math.max(hi - lo, 25);
      plotLine(hz.map(v => (v - lo) / span), amber, 4, .75);
    }

    if (this.user) plotLine(this.user, amber, 6, 1);

    // level meter down the left while recording
    const last = this.live[this.live.length - 1];
    if (last && !this.user) {
      const lvl = Math.min(1, (last.rms || 0) * 14);
      c.fillStyle = amber;
      c.globalAlpha = .5;
      c.fillRect(4, h - 6 - lvl * (h - 12), 4, lvl * (h - 12));
      c.globalAlpha = 1;
    }
  };

  /* ---- summary ------------------------------------------------------------- */

  function finish(host, st) {
    const scores = Object.values(st.best);
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    if (avg >= 75) { UI.confetti(); Audio2.fanfare(); }

    host.innerHTML = `
      <div class="session__body">
        ${Mascot.svg(avg >= 75 ? 'cheer' : avg >= 50 ? 'proud' : 'think', 128)}
        <h2 style="font-size:26px;font-weight:800">${avg}% average</h2>
        <p class="card__note center">
          ${st.attempts} attempt${st.attempts === 1 ? '' : 's'} across ${scores.length} word${scores.length === 1 ? '' : 's'}.</p>
        <p class="muted small center" style="max-width:320px">
          Tone shape is what this scores — the rise and fall, not your accent.
          Getting above 80 consistently means you're genuinely tonal.</p>
      </div>
      <div class="session__foot">
        <button class="btn btn--primary btn--block" id="again">Another round</button>
        <button class="btn btn--ghost btn--block" id="back">Done</button>
      </div>`;

    host.querySelector('#again').addEventListener('click', () => Views.speak(host));
    host.querySelector('#back').addEventListener('click', () => App.go('#/practice'));
  }

  // Shared with the in-lesson speaking exercise.
  Views.speak.targetContour = targetContour;
  Views.speak.Plot = Plot;
  Views.speak.applySandhi = applySandhi;
})();

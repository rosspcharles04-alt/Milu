/* Read a .pptx in the browser and pull vocabulary out of it.

   A .pptx is a ZIP of XML. Safari 16.4+ ships DecompressionStream, so the ZIP
   can be unpacked with no library at all — parse the central directory, inflate
   the slide parts, then read them with DOMParser.

   Extraction is deliberately generous: it guesses, then the user confirms and
   edits on screen before anything is added. */
(function () {
  'use strict';

  /* ---- zip --------------------------------------------------------------- */

  function u16(v, o) { return v.getUint16(o, true); }
  function u32(v, o) { return v.getUint32(o, true); }

  function findEOCD(view) {
    // Scan back from the end for the end-of-central-directory signature.
    const max = Math.min(view.byteLength, 66000);
    for (let i = view.byteLength - 22; i >= view.byteLength - max; i--) {
      if (i < 0) break;
      if (u32(view, i) === 0x06054b50) return i;
    }
    return -1;
  }

  function entries(buf) {
    const view = new DataView(buf);
    const eocd = findEOCD(view);
    if (eocd < 0) throw new Error('That file does not look like a .pptx');

    const count = u16(view, eocd + 10);
    let p = u32(view, eocd + 16);
    const out = [];
    const dec = new TextDecoder('utf-8');

    for (let i = 0; i < count && p + 46 <= view.byteLength; i++) {
      if (u32(view, p) !== 0x02014b50) break;
      const method = u16(view, p + 10);
      const compSize = u32(view, p + 20);
      const nameLen = u16(view, p + 28);
      const extraLen = u16(view, p + 30);
      const commentLen = u16(view, p + 32);
      const localOff = u32(view, p + 42);
      const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
      out.push({ name, method, compSize, localOff });
      p += 46 + nameLen + extraLen + commentLen;
    }
    return out;
  }

  async function readEntry(buf, e) {
    const view = new DataView(buf);
    if (u32(view, e.localOff) !== 0x04034b50) throw new Error('Damaged zip entry');
    const nameLen = u16(view, e.localOff + 26);
    const extraLen = u16(view, e.localOff + 28);
    const start = e.localOff + 30 + nameLen + extraLen;
    const raw = new Uint8Array(buf, start, e.compSize);

    if (e.method === 0) return new TextDecoder('utf-8').decode(raw);
    if (e.method !== 8) throw new Error('Unsupported compression in the .pptx');

    if (!('DecompressionStream' in window)) {
      throw new Error('This browser cannot unzip files — needs iOS 16.4 or newer');
    }
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([raw]).stream().pipeThrough(ds);
    return new Response(stream).text();
  }

  /* ---- text extraction --------------------------------------------------- */

  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';

  function slideLines(xml) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) return [];
    const paras = doc.getElementsByTagNameNS(A, 'p');
    const lines = [];
    for (const p of paras) {
      // <a:br/> inside a paragraph is a visual line break; treat it as one.
      let buf = '';
      for (const node of p.childNodes) {
        if (node.nodeType !== 1) continue;
        const local = node.localName;
        if (local === 'br') { pushLine(lines, buf); buf = ''; continue; }
        if (local === 'r' || local === 'fld') {
          const ts = node.getElementsByTagNameNS(A, 't');
          for (const t of ts) buf += t.textContent || '';
        }
      }
      pushLine(lines, buf);
    }
    return lines;
  }

  function pushLine(lines, s) {
    // Some decks put the three parts on one line separated by a label.
    String(s || '').split(/\r?\n/).forEach(part => {
      const t = part.replace(/ /g, ' ').trim();
      if (t) lines.push(t);
    });
  }

  /* ---- classification ---------------------------------------------------- */

  const TONE_CHARS = 'āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńňǹ';
  const hasHan = s => /[㐀-鿿]/.test(s);
  const hasTone = s => new RegExp('[' + TONE_CHARS + ']', 'i').test(s);

  const SYL = new RegExp(
    '^(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?' +
    '(iang|iong|uang|ueng|uai|uan|ian|iao|ing|ong|eng|ang|üan|' +
    'ai|ei|ao|ou|an|en|er|ia|ie|iu|in|ua|uo|ui|un|ün|üe|ue|' +
    'a|o|e|i|u|ü|v|n|m|r)r?$', 'i');

  function stripTones(s) {
    const map = { 'ā':'a','á':'a','ǎ':'a','à':'a','ē':'e','é':'e','ě':'e','è':'e',
      'ī':'i','í':'i','ǐ':'i','ì':'i','ō':'o','ó':'o','ǒ':'o','ò':'o',
      'ū':'u','ú':'u','ǔ':'u','ù':'u','ǖ':'ü','ǘ':'ü','ǚ':'ü','ǜ':'ü',
      'ń':'n','ň':'n','ǹ':'n' };
    return [...s.toLowerCase()].map(c => map[c] || c).join('');
  }

  function isPinyin(s) {
    if (hasHan(s)) return false;
    const cleaned = s.replace(/[^A-Za-zü' \-]/gi, ' ').trim();
    if (!cleaned) return false;
    if (hasTone(s)) return true;
    const words = stripTones(cleaned).split(/[\s'\-]+/).filter(Boolean);
    if (!words.length || words.length > 8) return false;
    return words.every(w => SYL.test(w));
  }

  const LABEL = /^\s*(中文|拼音|英文|chinese|pinyin|english|meaning)\s*[:：]\s*/i;
  const stripLabel = s => s.replace(LABEL, '').trim();
  const labelOf = s => {
    const m = s.match(LABEL);
    if (!m) return null;
    const k = m[1].toLowerCase();
    if (k === '中文' || k === 'chinese') return 'hanzi';
    if (k === '拼音' || k === 'pinyin') return 'pinyin';
    return 'english';
  };

  const NOISE = /^(目录|contents?|table of contents|谢谢|谢谢观看|thank you|学习目标|learning goals?|练习时间|practice time|课堂练习|课堂对话|角色扮演|总结|review|summary|核心句型|核心词汇|实用句型|应用例句|学习词汇|学习句型|例句|对话练习|发音练习|part \w+|\d+|[•·\-—]+)$/i;

  // Something like "。" or "？" is not an English gloss.
  const isJustPunct = s => !/[A-Za-z一-鿿]/.test(s);

  /* ---- assembling candidate words ---------------------------------------- */

  function fromSlide(lines) {
    const out = [];
    const used = new Set();

    // Pass 1 — explicitly labelled blocks (中文: / Pinyin: / English:)
    let block = null;
    lines.forEach((line, i) => {
      const lab = labelOf(line);
      if (!lab) { if (block && block.hanzi) { flush(); } return; }
      if (!block) block = {};
      block[lab] = stripLabel(line);
      used.add(i);
      if (block.hanzi && block.pinyin && block.english) flush();

      function flush() {
        if (block && block.hanzi) out.push(mk(block.hanzi, block.pinyin, block.english));
        block = null;
      }
    });
    if (block && block.hanzi) out.push(mk(block.hanzi, block.pinyin, block.english));

    // Pass 2 — ruby runs: alternating single syllable / single character,
    // the layout used in the Transportation deck.
    let i = 0;
    while (i < lines.length) {
      if (used.has(i)) { i++; continue; }
      let j = i, hz = '', py = [];
      while (j + 1 < lines.length &&
             !used.has(j) && !used.has(j + 1) &&
             isPinyin(lines[j]) && !lines[j].includes(' ') &&
             hasHan(lines[j + 1]) && [...lines[j + 1]].length === 1) {
        py.push(lines[j]);
        hz += lines[j + 1];
        j += 2;
      }
      if (hz.length >= 1 && py.length >= 1) {
        // The English gloss usually follows the run.
        let en = '';
        if (j < lines.length && !hasHan(lines[j]) && !isPinyin(lines[j])) {
          en = lines[j];
          used.add(j);
          j++;
        }
        if (hz.length >= 2 || en) {
          out.push(mk(hz, py.join(' '), en));
          for (let k = i; k < j; k++) used.add(k);
        }
      }
      i = Math.max(j, i + 1);
    }

    // Pass 3 — the common three-line stack, and "汉字 (pīnyīn)" forms.
    for (let k = 0; k < lines.length; k++) {
      if (used.has(k)) continue;
      const line = lines[k];
      if (!hasHan(line) || NOISE.test(line)) continue;

      // 火锅 (huǒ guō)  /  火锅（huǒ guō）
      const inline = line.match(/^([㐀-鿿·]+)\s*[（(]\s*([^）)]+)\s*[）)]\s*(.*)$/);
      if (inline && isPinyin(inline[2])) {
        let en = inline[3].trim();
        if (!en && k + 1 < lines.length && !hasHan(lines[k + 1]) && !isPinyin(lines[k + 1])) {
          en = lines[k + 1]; used.add(k + 1);
        }
        out.push(mk(inline[1], inline[2], en));
        used.add(k);
        continue;
      }

      // hanzi / pinyin / english on three consecutive lines
      const hz = cleanHanzi(line);
      if (!hz) continue;
      const next = lines[k + 1] || '';
      const after = lines[k + 2] || '';
      if (isPinyin(next)) {
        const en = (!hasHan(after) && !isPinyin(after) && !NOISE.test(after)) ? after : '';
        out.push(mk(hz, next, en));
        used.add(k); used.add(k + 1);
        if (en) used.add(k + 2);
      }
    }

    return out;
  }

  function cleanHanzi(s) {
    // Drop leading numbering / speaker labels and any emoji.
    let t = s.replace(/^\s*(\d+[.、)]|[A-Z][:：])\s*/, '').trim();
    t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim();

    // Keep whole phrases together — truncating "对，我戴帽子！" at the comma
    // would pair a single character with the whole sentence's translation.
    const m = t.match(/^[㐀-鿿·A-Za-z]+(?:[，、。！？：]?[㐀-鿿·A-Za-z]+)*[。！？]?/);
    if (!m) return '';
    let hz = m[0].split('/')[0].trim().replace(/[。！？]+$/, '');
    return (hz.length >= 1 && hz.length <= 18 && /[㐀-鿿]/.test(hz)) ? hz : '';
  }

  function mk(hanzi, pinyin, english) {
    let py = stripLabel((pinyin || '').trim());
    let en = stripLabel((english || '').trim()).replace(/^[-–—·•]\s*/, '');

    // Some decks write "kàn diàn yǐng - to watch movies" on one line.
    const split = py.match(/^(.*?)\s+[-–—]\s+(.+)$/);
    if (split && !en) { py = split[1].trim(); en = split[2].trim(); }

    if (isJustPunct(en)) en = '';
    return { hanzi: (hanzi || '').trim(), pinyin: py, english: en };
  }

  /* ---- public ------------------------------------------------------------ */

  /**
   * @param {File} file  a .pptx picked by the user
   * @returns {Promise<{title:string, words:Array, slides:number}>}
   */
  async function parse(file) {
    const buf = await file.arrayBuffer();
    const all = entries(buf);
    const slides = all
      .filter(e => /^ppt\/slides\/slide\d+\.xml$/.test(e.name))
      .sort((a, b) => {
        const n = s => +s.name.match(/(\d+)\.xml$/)[1];
        return n(a) - n(b);
      });

    if (!slides.length) throw new Error('No slides found in that file');

    const words = [];
    for (const s of slides) {
      let xml;
      try { xml = await readEntry(buf, s); } catch (e) { continue; }
      fromSlide(slideLines(xml)).forEach(w => words.push(w));
    }

    // Deduplicate, drop junk, and keep the first sighting of each word.
    const seen = new Set();
    const clean = [];
    words.forEach(w => {
      if (!w.hanzi || !hasHan(w.hanzi)) return;
      if (w.hanzi.length > 10) return;
      if (NOISE.test(w.hanzi)) return;
      if (seen.has(w.hanzi)) return;
      seen.add(w.hanzi);
      clean.push(w);
    });

    return {
      title: file.name.replace(/\.pptx$/i, ''),
      slides: slides.length,
      words: clean,
    };
  }

  function supported() { return 'DecompressionStream' in window; }

  window.Pptx = { parse, supported, isPinyin, hasHan, _fromSlide: fromSlide, _slideLines: slideLines };
})();

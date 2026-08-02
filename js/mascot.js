/* Mílù 麋鹿 — the deer. Drawn as inline SVG so it scales crisply and can
   change expression to react to how the session is going. */
(function () {
  'use strict';

  const C = {
    fur:     '#E9A868',
    furDark: '#D8914E',
    cream:   '#FBE7CE',
    antler:  '#C08048',
    ink:     '#3B2A21',
    blush:   '#FF9E8E',
    white:   '#FFFFFF',
  };

  /* Eyes ------------------------------------------------------------------ */
  function eyes(mood) {
    const L = 47, R = 73, Y = 58;

    // happy closed arcs  ^  ^
    const arcs = `
      <path d="M${L - 6} ${Y + 1} q6 -8 12 0" fill="none" stroke="${C.ink}"
            stroke-width="3.4" stroke-linecap="round"/>
      <path d="M${R - 6} ${Y + 1} q6 -8 12 0" fill="none" stroke="${C.ink}"
            stroke-width="3.4" stroke-linecap="round"/>`;

    // sleeping lines  ‿  ‿
    const shut = `
      <path d="M${L - 6} ${Y} q6 7 12 0" fill="none" stroke="${C.ink}"
            stroke-width="3.4" stroke-linecap="round"/>
      <path d="M${R - 6} ${Y} q6 7 12 0" fill="none" stroke="${C.ink}"
            stroke-width="3.4" stroke-linecap="round"/>`;

    const ball = (cx, cy, r) => `
      <ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 1.08}" fill="${C.ink}"/>
      <circle cx="${cx + r * .36}" cy="${cy - r * .42}" r="${r * .34}" fill="${C.white}"/>
      <circle cx="${cx - r * .34}" cy="${cy + r * .38}" r="${r * .16}"
              fill="${C.white}" opacity=".65"/>`;

    switch (mood) {
      case 'cheer':
      case 'proud':  return arcs;
      case 'sleepy': return shut;
      case 'wow':    return ball(L, Y, 6.6) + ball(R, Y, 6.6);
      case 'think':  return ball(L, Y - 1, 5.2) + `
        <path d="M${R - 6} ${Y - 1} q6 -6 12 0" fill="none" stroke="${C.ink}"
              stroke-width="3.2" stroke-linecap="round"/>`;
      case 'sad':    return ball(L, Y + 1, 4.8) + ball(R, Y + 1, 4.8);
      default:       return ball(L, Y, 5.4) + ball(R, Y, 5.4);
    }
  }

  /* Mouth ----------------------------------------------------------------- */
  function mouth(mood) {
    const Y = 79;
    switch (mood) {
      case 'cheer':
      case 'wow':
        return `<path d="M53 ${Y} q7 10 14 0 q-7 4 -14 0" fill="${C.ink}"/>`;
      case 'proud':
        return `<path d="M53 ${Y} q7 8 14 0" fill="none" stroke="${C.ink}"
                  stroke-width="2.8" stroke-linecap="round"/>`;
      case 'sad':
        return `<path d="M54 ${Y + 4} q6 -7 12 0" fill="none" stroke="${C.ink}"
                  stroke-width="2.8" stroke-linecap="round"/>`;
      case 'think':
        return `<ellipse cx="60" cy="${Y + 1}" rx="3.4" ry="3" fill="${C.ink}"/>`;
      case 'sleepy':
        return `<ellipse cx="60" cy="${Y + 1}" rx="3" ry="3.6" fill="${C.ink}" opacity=".85"/>`;
      default:
        return `<path d="M55 ${Y} q5 6 10 0" fill="none" stroke="${C.ink}"
                  stroke-width="2.8" stroke-linecap="round"/>`;
    }
  }

  /* Extras ---------------------------------------------------------------- */
  function extras(mood) {
    if (mood === 'sleepy') {
      return `<g fill="${C.ink}" opacity=".5" font-family="sans-serif" font-weight="700">
        <text x="92" y="34" font-size="13">z</text>
        <text x="101" y="24" font-size="10">z</text>
      </g>`;
    }
    if (mood === 'cheer' || mood === 'proud') {
      return `<g fill="#FFD166">
        <path d="M18 26 l2.4 5 5 2.4 -5 2.4 -2.4 5 -2.4 -5 -5 -2.4 5 -2.4z"/>
        <path d="M101 44 l1.8 3.8 3.8 1.8 -3.8 1.8 -1.8 3.8 -1.8 -3.8 -3.8 -1.8 3.8 -1.8z"/>
      </g>`;
    }
    if (mood === 'sad') {
      return `<ellipse cx="45" cy="70" rx="2.6" ry="3.6" fill="#7FB3E8" opacity=".9"/>`;
    }
    if (mood === 'think') {
      return `<g fill="${C.ink}" opacity=".35">
        <circle cx="96" cy="42" r="3"/><circle cx="104" cy="34" r="2.1"/>
      </g>`;
    }
    return '';
  }

  /**
   * Build the deer.
   * @param {string} mood  idle | cheer | proud | sad | think | sleepy | wow
   * @param {number} size  pixel width/height
   */
  function svg(mood, size) {
    mood = mood || 'idle';
    size = size || 110;
    return `
<svg class="mascot" viewBox="0 0 120 120" width="${size}" height="${size}"
     role="img" aria-label="Mílù the deer" xmlns="http://www.w3.org/2000/svg">
  <!-- antlers -->
  <g fill="none" stroke="${C.antler}" stroke-width="5" stroke-linecap="round">
    <path d="M45 32 C41 22 39 16 37 10"/>
    <path d="M41.5 21 C35 19 31 16 28 13"/>
    <path d="M75 32 C79 22 81 16 83 10"/>
    <path d="M78.5 21 C85 19 89 16 92 13"/>
  </g>

  <!-- ears -->
  <ellipse cx="26" cy="52" rx="9.5" ry="13.5" fill="${C.furDark}"
           transform="rotate(-24 26 52)"/>
  <ellipse cx="27" cy="52" rx="5" ry="8.5" fill="${C.cream}"
           transform="rotate(-24 27 52)"/>
  <ellipse cx="94" cy="52" rx="9.5" ry="13.5" fill="${C.furDark}"
           transform="rotate(24 94 52)"/>
  <ellipse cx="93" cy="52" rx="5" ry="8.5" fill="${C.cream}"
           transform="rotate(24 93 52)"/>

  <!-- head -->
  <ellipse cx="60" cy="62" rx="33" ry="31" fill="${C.fur}"/>
  <!-- forehead spots -->
  <g fill="${C.cream}" opacity=".55">
    <ellipse cx="49" cy="41" rx="3.4" ry="2.6"/>
    <ellipse cx="60" cy="37" rx="2.8" ry="2.2"/>
    <ellipse cx="71" cy="41" rx="3.4" ry="2.6"/>
  </g>

  <!-- muzzle -->
  <ellipse cx="60" cy="76" rx="18" ry="14" fill="${C.cream}"/>
  <ellipse cx="60" cy="70" rx="5.4" ry="4" fill="${C.ink}"/>

  <!-- blush -->
  <ellipse cx="36" cy="70" rx="6.5" ry="4.2" fill="${C.blush}" opacity=".5"/>
  <ellipse cx="84" cy="70" rx="6.5" ry="4.2" fill="${C.blush}" opacity=".5"/>

  ${eyes(mood)}
  ${mouth(mood)}
  ${extras(mood)}
</svg>`;
  }

  /** Swap an existing mascot's expression in place, with a little animation. */
  function setMood(el, mood, anim) {
    if (!el) return;
    const size = el.getAttribute('width') || 110;
    el.outerHTML = svg(mood, size);
    if (!anim) return;
    // outerHTML replaced the node, so re-find it in the same parent
    const fresh = document.querySelector('.mascot');
    if (fresh) {
      fresh.classList.add(anim);
      setTimeout(() => fresh.classList.remove(anim), 800);
    }
  }

  window.Mascot = { svg, setMood };
})();

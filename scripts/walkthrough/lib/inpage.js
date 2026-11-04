// Runs in every recorded page before the app (addInitScript). Plain browser
// JavaScript, no imports. `opts` = { zoom, lang, record }.
(opts) => {
  try {
    localStorage.setItem('qubirex_ui_lang', opts.lang || 'english');
    localStorage.setItem('qubirex_theme', 'light');
    // The recording flag: hides the developer bar and test badges for test-tenant sessions.
    if (opts.record) sessionStorage.setItem('qbx_record', '1');
  } catch { /* storage blocked */ }

  const ready = (fn) => (document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn());
  ready(() => {
    if (opts.zoom && opts.zoom !== 1) document.documentElement.style.zoom = String(opts.zoom);
    const css = document.createElement('style');
    css.textContent = `
      html, body { scrollbar-width: none !important; }
      ::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
      html { scroll-behavior: smooth; }
      #qbx-cursor { position: fixed; left: 0; top: 0; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%;
        background: rgba(27,27,31,.82); border: 2px solid #fff; box-shadow: 0 1px 6px rgba(0,0,0,.35); z-index: 2147483647;
        pointer-events: none; transition: transform .12s ease; }
      #qbx-cursor.down { transform: scale(.78); }
      .qbx-ring { position: fixed; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; border: 3px solid #E73B2B;
        z-index: 2147483646; pointer-events: none; animation: qbx-ring .6s ease-out forwards; }
      @keyframes qbx-ring { from { transform: scale(.6); opacity: .95; } to { transform: scale(3.2); opacity: 0; } }
      .qbx-hl { outline: 3px solid rgba(231,59,43,.9) !important; outline-offset: 5px !important; border-radius: 10px;
        box-shadow: 0 0 0 9999px rgba(20,20,24,.18), 0 0 24px rgba(248,152,51,.55) !important; transition: outline-color .3s, box-shadow .3s; position: relative; z-index: 50; }
    `;
    document.head.appendChild(css);
    const dot = document.createElement('div');
    dot.id = 'qbx-cursor';
    dot.style.display = 'none';
    document.documentElement.appendChild(dot);
  });

  const z = () => Number(document.documentElement.style.zoom || 1) || 1;
  window.__qbx = {
    move(x, y) {
      const d = document.getElementById('qbx-cursor');
      if (!d) return;
      d.style.display = 'block';
      d.style.left = `${x / z()}px`; d.style.top = `${y / z()}px`;
    },
    down(on) { document.getElementById('qbx-cursor')?.classList.toggle('down', on); },
    ring(x, y) {
      const r = document.createElement('div');
      r.className = 'qbx-ring';
      r.style.left = `${x / z()}px`; r.style.top = `${y / z()}px`;
      document.documentElement.appendChild(r);
      setTimeout(() => r.remove(), 700);
    },
    hide() { const d = document.getElementById('qbx-cursor'); if (d) d.style.display = 'none'; },
    highlight(sel, on) {
      document.querySelectorAll('.qbx-hl').forEach(e => e.classList.remove('qbx-hl'));
      if (!on) return;
      const el = document.querySelector(sel);
      if (el) el.classList.add('qbx-hl');
    },
    // Words a screen must never show in a video.
    ugly() {
      const text = document.body ? document.body.innerText : '';
      const hits = [];
      const rules = [
        [/Syntax error/i, 'Syntax error'], [/mermaid version/i, 'mermaid version'], [/\bundefined\b/, '"undefined"'],
        [/\bNaN\b/, '"NaN"'], [/\[object Object\]/, '[object Object]'], [/\bmock:/i, '"mock:" text'],
        [/\b(TypeError|ReferenceError|Exception)\b/, 'raw error'], [/^\s*Error:/m, 'raw "Error:"'],
        [/at [\w$.]+ \(.*:\d+:\d+\)/, 'stack trace'], [/Test data only/i, 'test badge']
      ];
      for (const [re, name] of rules) { const m = text.match(re); if (m) hits.push(`${name}: “${text.slice(Math.max(0, m.index - 40), m.index + 60).replace(/\s+/g, ' ').trim()}”`); }
      if (document.querySelector('.error-icon, svg[aria-roledescription="error"]')) hits.push('diagram error graphic');
      if (document.querySelector('.dx-bar')) hits.push('developer bar');
      return hits;
    }
  };

  // App audio: what the page actually plays (lesson voice, sample lesson),
  // with times, sent to the recorder so the edit can mix it in.
  const sent = new Set();
  const report = (type, el) => {
    const src = el.currentSrc || el.src || '';
    if (!src || !window.__qbxAudio) return;
    window.__qbxAudio({ type, src, at: Date.now(), offset: el.currentTime || 0, rate: el.playbackRate || 1 });
    if (type === 'start' && !sent.has(src)) {
      sent.add(src);
      fetch(src).then(r => r.arrayBuffer()).then((buf) => {
        let s = ''; const b = new Uint8Array(buf);
        for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
        window.__qbxAudio({ type: 'data', src, b64: btoa(s) });
      }).catch(() => {});
    }
  };
  const hooked = new WeakSet();
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...a) {
    if (!hooked.has(this) && this.tagName !== 'VIDEO') {
      hooked.add(this);
      this.addEventListener('playing', () => report('start', this));
      for (const ev of ['pause', 'ended', 'emptied']) this.addEventListener(ev, () => report('stop', this));
      this.addEventListener('ratechange', () => { if (!this.paused) { report('stop', this); report('start', this); } });
    }
    return play.apply(this, a);
  };
}

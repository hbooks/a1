/* =====================================================================
 * MainMenuScene + MK (menu kit: buttons, icon buttons, vector icons, modals, toast)
 * Layout is computed from the REAL visible screen (UI.view), in portrait AND landscape.
 * ===================================================================== */
const MK = {
  GOLD: '#e8b923', GOLD_N: 0xe8b923,
  BASE: window.CARDI_BASE || '/cardi/',

  /** Design box per orientation. The camera zooms so this box fits the screen. */
  design(s) { return s.scale.height > s.scale.width ? { w: 480, h: 880 } : { w: UI.W, h: UI.H }; },
  isPortrait(s) { return s.scale.height > s.scale.width; },
  click(s) { if (s.cache.audio.exists('sfx_click')) s.sound.play('sfx_click'); },

  /* ---- vector icons (no font glyph dependency). fn(g, color, ...extra) draws around 0,0 ---- */
  icons: {
    gear(g, c) { g.lineStyle(4, c, 1); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.lineBetween(Math.cos(a) * 9, Math.sin(a) * 9, Math.cos(a) * 13, Math.sin(a) * 13); } g.strokeCircle(0, 0, 8); g.fillStyle(c, 1).fillCircle(0, 0, 3); },
    sound(g, c, on = true) {
      g.fillStyle(c, 1).fillPoints([{ x: -12, y: -5 }, { x: -6, y: -5 }, { x: 0, y: -11 }, { x: 0, y: 11 }, { x: -6, y: 5 }, { x: -12, y: 5 }], true);
      if (on) { g.lineStyle(3, c, 1); g.beginPath(); g.arc(2, 0, 6, -0.9, 0.9); g.strokePath(); g.beginPath(); g.arc(2, 0, 11, -0.9, 0.9); g.strokePath(); }
      else g.lineStyle(3, 0xff6b6b, 1).lineBetween(6, -6, 15, 6).lineBetween(15, -6, 6, 6);
    },
    full(g, c) { g.lineStyle(3, c, 1);[[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => { g.lineBetween(sx * 11, sy * 11, sx * 11, sy * 5); g.lineBetween(sx * 11, sy * 11, sx * 5, sy * 11); }); },
    share(g, c) { g.lineStyle(2.5, c, 1).lineBetween(-8, 0, 8, -8).lineBetween(-8, 0, 8, 8); g.fillStyle(c, 1).fillCircle(-8, 0, 4.5).fillCircle(8, -8, 4.5).fillCircle(8, 8, 4.5); },
    rotate(g, c) { g.lineStyle(3, c, 1); g.beginPath(); g.arc(0, 0, 9, 0.4, 4.9); g.strokePath(); g.fillStyle(c, 1).fillTriangle(7.6, -7.7, 2.6, -13.7, 0.8, -3.9); },
    play(g, c) { g.fillStyle(c, 1).fillTriangle(-7, -11, -7, 11, 11, 0); },
    people(g, c) { g.fillStyle(c, 1).fillCircle(-6, -5, 5).fillCircle(8, -5, 4.5).fillRoundedRect(-14, 2, 16, 9, { tl: 6, tr: 6, bl: 2, br: 2 }).fillRoundedRect(1, 2, 14, 9, { tl: 6, tr: 6, bl: 2, br: 2 }); },
    shop(g, c) { g.fillStyle(c, 1).fillRoundedRect(-11, -4, 22, 16, 4); g.lineStyle(3, c, 1); g.beginPath(); g.arc(0, -4, 6, Math.PI, 0); g.strokePath(); },
  },

  /** Chunky text button; opts.icon(g,color) draws a vector icon on the left. */
  btn(s, x, y, label, cb, o = {}) {
    const w = o.w || 240, h = o.h || 56, r = Math.min(18, h / 3);
    const P = o.primary ? { f: 0xe8b923, hf: 0xffd24a, c: '#241900', b: 0xffe48a, i: 0x241900 }
      : o.danger ? { f: 0x2a1212, hf: 0x421a1a, c: '#ffb4b4', b: 0x6b2a2a, i: 0xffb4b4 }
        : { f: 0x1a3a2e, hf: 0x24543f, c: '#f3ead2', b: 0xe8b923, i: 0xe8b923 };
    const c = s.add.container(x, y), g = s.add.graphics();
    const draw = (hover) => {
      g.clear();
      g.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2, -h / 2 + 5, w, h, r);
      g.fillStyle(hover ? P.hf : P.f, 1).fillRoundedRect(-w / 2, -h / 2, w, h, r);
      g.fillStyle(0xffffff, 0.12).fillRoundedRect(-w / 2 + 4, -h / 2 + 3, w - 8, h / 2 - 3, { tl: r - 2, tr: r - 2, bl: 0, br: 0 });
      g.lineStyle(2, P.b, o.primary ? 1 : 0.6).strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    };
    draw(false);
    const t = s.add.text(0, -1, label, { fontFamily: UI.FONT, fontSize: o.size || (h > 50 ? '24px' : '16px'), fontStyle: '900', color: P.c }).setOrigin(0.5);
    c.add([g, t]);
    if (o.icon) { const ic = s.add.graphics().setPosition(-w / 2 + (h > 50 ? 38 : 24), 0); o.icon(ic, P.i); c.add(ic); t.x = h > 50 ? 8 : 12; }
    c.label = t; c.setSize(w, h);
    if (o.disabled) return c.setAlpha(0.5);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerover', () => { draw(true); s.tweens.add({ targets: c, scale: 1.04, duration: 90 }); });
    c.on('pointerout', () => { draw(false); s.tweens.add({ targets: c, scale: 1, duration: 90 }); });
    c.on('pointerdown', () => s.tweens.add({ targets: c, scale: 0.95, duration: 60 }));
    c.on('pointerup', () => { s.tweens.add({ targets: c, scale: 1.04, duration: 80 }); MK.click(s); if (cb) cb(); });
    return c;
  },

  /** Round icon button. icon = vector fn or a short string like '?'. c.paint(fn, ...extra) repaints the icon. */
  iconBtn(s, x, y, icon, cb, o = {}) {
    const r = o.r || 24, c = s.add.container(x, y), g = s.add.graphics(), ic = s.add.graphics();
    const draw = (hv) => {
      g.clear();
      g.fillStyle(0x000000, 0.35).fillCircle(0, 4, r);
      g.fillStyle(hv ? 0x2f6b51 : 0x1a3a2e, 1).fillCircle(0, 0, r);
      g.fillStyle(0xffffff, 0.1).fillEllipse(0, -r * 0.45, r * 1.3, r * 0.7);
      g.lineStyle(2.5, 0xe8b923, hv ? 1 : 0.7).strokeCircle(0, 0, r);
    };
    draw(false);
    c.add([g, ic]);
    c.paint = (fn, ...a) => { ic.clear(); fn(ic, 0xf3ead2, ...a); };
    if (typeof icon === 'string') c.add(s.add.text(0, -1, icon, { fontFamily: UI.FONT, fontSize: Math.round(r * 1.15) + 'px', fontStyle: '900', color: '#f3ead2' }).setOrigin(0.5));
    else c.paint(icon);
    c.setSize(r * 2, r * 2).setInteractive({ useHandCursor: true });
    c.on('pointerover', () => { draw(true); s.tweens.add({ targets: c, scale: 1.1, duration: 90 }); });
    c.on('pointerout', () => { draw(false); s.tweens.add({ targets: c, scale: 1, duration: 90 }); });
    c.on('pointerdown', () => s.tweens.add({ targets: c, scale: 0.9, duration: 60 }));
    c.on('pointerup', () => { s.tweens.add({ targets: c, scale: 1.1, duration: 80 }); MK.click(s); if (cb) cb(); });
    return c;
  },

  /** Modal: auto-shrinks to fit narrow screens, ESC closes, clicks inside the panel don't. */
  modal(s, { title, w, h, close = 'Close' }, build) {
    const d = MK.design(s), cx = d.w / 2, cy = d.h / 2, FONT = UI.FONT;
    const fs = Math.min(1, (d.w - 24) / w, (d.h - 24) / h);
    const layer = s.add.container(0, 0).setDepth(100);
    const dim = s.add.rectangle(cx, cy, d.w * 6, d.h * 6, 0x000000, 0).setInteractive();
    s.tweens.add({ targets: dim, fillAlpha: 0.78, duration: 180 });
    const panel = s.add.container(cx, cy).setScale(fs * 0.88).setAlpha(0);
    const g = s.add.graphics()
      .fillStyle(0x000000, 0.4).fillRoundedRect(-w / 2 + 6, -h / 2 + 10, w, h, 26)
      .fillStyle(0x0c2119, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 26)
      .lineStyle(3, 0xe8b923, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 26)
      .lineStyle(1, 0xe8b923, 0.25).strokeRoundedRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 20);
    const blocker = s.add.zone(0, 0, w, h).setInteractive();
    const ti = s.add.text(0, -h / 2 + 42, title, { fontFamily: FONT, fontSize: '26px', fontStyle: '900', color: MK.GOLD }).setOrigin(0.5).setLetterSpacing(5);
    panel.add([g, blocker, ti]);
    const api = {
      layer, panel, closed: false, hooks: [],
      setTitle(t) { ti.setText(t); },
      close() {
        if (api.closed) return; api.closed = true;
        api.hooks.forEach((f) => { try { f(); } catch (e) { /* ignore */ } });
        if (s.input.keyboard) s.input.keyboard.off('keydown-ESC', api.close);
        s.tweens.add({ targets: panel, scale: fs * 0.92, alpha: 0, duration: 120 });
        s.tweens.add({ targets: dim, fillAlpha: 0, duration: 120, onComplete: () => layer.destroy() });
      },
    };
    dim.on('pointerdown', api.close);
    if (s.input.keyboard) s.input.keyboard.on('keydown-ESC', api.close);
    if (build) build(panel, api);
    if (close) panel.add(MK.btn(s, 0, h / 2 - 40, close, api.close, { w: 140, h: 42, danger: true }));
    layer.add([dim, panel]);
    layer.once('destroy', () => api.hooks.forEach((f) => { try { f(); } catch (e) { /* ignore */ } }));
    s.tweens.add({ targets: panel, scale: fs, alpha: 1, duration: 260, ease: 'Back.out' });
    return api;
  },

  toast(s, msg) {
    const v = UI.view(s);
    const t = s.add.text((v.left + v.right) / 2, v.bottom - 90, msg, { fontFamily: UI.FONT, fontSize: '17px', fontStyle: 'bold', color: '#241900', backgroundColor: '#e8b923', padding: { x: 18, y: 10 }, align: 'center', wordWrap: { width: Math.min(420, v.right - v.left - 40) } })
      .setOrigin(0.5).setDepth(300).setAlpha(0);
    s.tweens.add({ targets: t, alpha: 1, y: t.y - 14, duration: 200, hold: 2200, yoyo: true, onComplete: () => t.destroy() });
  },

  fullscreen(s) {
    if (!document.fullscreenEnabled && !document.webkitFullscreenEnabled) return MK.toast(s, 'Fullscreen is not supported here. Try “Add to Home Screen”.');
    s.scale.isFullscreen ? s.scale.stopFullscreen() : s.scale.startFullscreen();
  },

  /** Portrait <-> landscape. Mobile browsers only allow the lock in fullscreen; iOS Safari has no lock at all. */
  async orient(s) {
    const so = screen.orientation;
    if (!so || !so.lock) return MK.toast(s, 'This device can’t be rotated from here. Turn your phone instead.');
    const want = window.innerHeight > window.innerWidth ? 'landscape' : 'portrait';
    try {
      if (!s.scale.isFullscreen) { s.scale.startFullscreen(); await new Promise((r) => setTimeout(r, 300)); }
      await so.lock(want);
    } catch (e) { MK.toast(s, 'Your browser blocked the rotation. Turn your phone instead.'); }
  },
};

/* =====================================================================
 * ONLINE: create / join / waiting room. Talks to /api (see api.ts).
 *   MK.field        a real <input> that sits exactly on top of a spot in the canvas
 *                   (so phones get their keyboard) but looks like part of the game.
 *   CardiOnline     name + room size + code screens, and the waiting room.
 * ===================================================================== */
MK.icons.copy = function (g, c) { g.lineStyle(2.5, c, 1).strokeRoundedRect(-3, -11, 14, 16, 3).strokeRoundedRect(-11, -5, 14, 16, 3); };
MK.icons.check = function (g, c) { g.lineStyle(3.5, c, 1); g.beginPath(); g.moveTo(-9, 0); g.lineTo(-3, 7); g.lineTo(9, -7); g.strokePath(); };

/** DOM text field pinned to an anchor inside a Phaser container. o: x,y,w,h,placeholder,value,max,upper,font,enter,onEnter,onInput */
MK.field = function (scene, host, o) {
  if (!MK._fieldCss) {
    MK._fieldCss = true;
    const st = document.createElement('style');
    st.textContent = '.cardi-field::placeholder{color:#5f7f70;opacity:1;letter-spacing:normal;font-weight:700}'
      + '.cardi-field:focus{border-color:#ffd24a!important;box-shadow:0 0 0 3px rgba(232,185,35,.25)}'
      + '.cardi-field.bad{border-color:#ff6b6b!important;box-shadow:0 0 0 3px rgba(255,107,107,.2)}';
    document.head.appendChild(st);
  }
  const el = document.createElement('input');
  el.className = 'cardi-field'; el.type = 'text'; el.value = o.value || ''; el.placeholder = o.placeholder || '';
  el.maxLength = o.max || 20; el.autocomplete = 'off'; el.spellcheck = false;
  el.setAttribute('autocapitalize', o.upper ? 'characters' : 'words');
  el.setAttribute('autocorrect', 'off');
  el.setAttribute('enterkeyhint', o.enter || 'go');
  el.setAttribute('aria-label', o.placeholder || 'input');
  Object.assign(el.style, {
    position: 'fixed', zIndex: '1000', boxSizing: 'border-box', margin: '0', padding: '0 12px', display: 'none',
    background: '#0f241c', color: '#f3ead2', border: '2px solid rgba(232,185,35,.7)', borderRadius: '14px',
    outline: 'none', textAlign: 'center', fontFamily: UI.FONT, fontWeight: '800', caretColor: '#e8b923',
    letterSpacing: o.upper ? '0.32em' : 'normal', textTransform: o.upper ? 'uppercase' : 'none',
  });
  el.addEventListener('input', () => {
    if (o.upper) { const v = el.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (v !== el.value) el.value = v; }
    el.classList.remove('bad');
    if (o.onInput) o.onInput();
  });
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (o.onEnter) o.onEnter(); } });
  document.body.appendChild(el);

  const anchor = scene.add.zone(o.x, o.y, o.w, o.h); host.add(anchor);
  const m = new Phaser.GameObjects.Components.TransformMatrix();
  let dead = false;
  const place = () => {
    if (dead) return;
    if (!anchor.scene || !scene.sys.isActive()) { el.style.display = 'none'; return; }
    let a = 1, vis = true;
    for (let n = anchor; n; n = n.parentContainer) { if (n.alpha !== undefined) a *= n.alpha; if (n.visible === false) vis = false; }
    if (!vis || a < 0.05) { el.style.display = 'none'; return; }
    anchor.getWorldTransformMatrix(m);
    const cam = scene.cameras.main, rect = scene.game.canvas.getBoundingClientRect();
    const k = rect.width / scene.scale.gameSize.width, s = m.scaleX * cam.zoom * k;
    const px = rect.left + (m.tx - cam.worldView.x) * cam.zoom * k, py = rect.top + (m.ty - cam.worldView.y) * cam.zoom * k;
    const w = o.w * s, h = o.h * s;
    Object.assign(el.style, {
      display: 'block', left: (px - w / 2) + 'px', top: (py - h / 2) + 'px', width: w + 'px', height: h + 'px',
      fontSize: Math.max(16, (o.font || 20) * s) + 'px', opacity: String(a), borderRadius: (14 * s) + 'px',
    });
  };
  scene.events.on('postupdate', place);
  place();
  return {
    el,
    get: () => el.value,
    set: (v) => { el.value = v; },
    focus: () => { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } },
    flag: () => { el.classList.add('bad'); },
    shake: () => { if (el.animate) el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-9px)' }, { transform: 'translateX(9px)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(0)' }], { duration: 300 }); },
    destroy: () => { if (dead) return; dead = true; scene.events.off('postupdate', place); el.remove(); },
  };
};

const CardiOnline = {
  NAME_KEY: 'cardi_player_name',
  MAX_KEY: 'cardi_max_players',
  COLORS: [0x4da3ff, 0x57c785, 0xc084fc, 0xff9f43],
  MSG: {
    not_found: 'We couldn\u2019t find that room. It may have closed, so double-check the code.',
    full: 'That room is already full.',
    started: 'That game has already started.',
    name_taken: 'Someone in that room already uses that name. Try another one.',
    bad_code: 'Room codes have 6 characters.',
    bad_name: 'Pick a name so your friends know who you are.',
    network: 'Can\u2019t reach the server. Check your connection and try again.',
    server: 'Something went wrong on our side. Please try again in a moment.',
  },

  clientId() {
    let id = localStorage.getItem('cardi_client_id');
    if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12)); localStorage.setItem('cardi_client_id', id); }
    return id;
  },
  savedName() { return localStorage.getItem(this.NAME_KEY) || ''; },
  clean(s) { return String(s || '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14); },
  errText(e) { return this.MSG[e.code] || (e.code === 'bad_request' ? e.message : null) || this.MSG.server; },

  async call(action, body) {
    let res;
    try {
      res = await fetch('/api?action=' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch (e) { const err = new Error('network'); err.code = 'network'; throw err; }
    if (!(res.headers.get('content-type') || '').includes('application/json')) { const err = new Error('server'); err.code = 'server'; throw err; }
    const data = await res.json();
    if (!res.ok || data.error) { const err = new Error(data.error || 'server'); err.code = data.code || 'server'; throw err; }
    return data;
  },

  /* ------------------------- the ONLINE PLAY modal ------------------------- */
  open(scene) {
    const flow = { fields: [], api: null, go: null };
    scene.modal = MK.modal(scene, { title: 'ONLINE PLAY', w: 500, h: 520, close: null }, (panel, api) => {
      const body = scene.add.container(0, 0); panel.add(body);
      flow.api = api;
      const clear = () => { flow.fields.forEach((f) => f.destroy()); flow.fields = []; scene.tweens.killTweensOf(body.list); body.removeAll(true); };
      flow.go = (name) => { clear(); api.setTitle(name === 'menu' ? 'ONLINE PLAY' : name === 'create' ? 'CREATE ROOM' : 'JOIN ROOM'); CardiOnline[name + 'Step'](scene, flow, body); };
      api.hooks.push(clear);
      flow.go('menu');
    });
  },

  menuStep(scene, flow, body) {
    const FONT = UI.FONT;
    const T = (x, y, str, st) => { const t = scene.add.text(x, y, str, { fontFamily: FONT, ...st }).setOrigin(0.5); body.add(t); return t; };
    T(0, -150, 'PLAY WITH FRIENDS', { fontSize: '13px', fontStyle: 'bold', color: '#9fbfae' }).setLetterSpacing(4);
    T(0, -102, 'Start a room and share the code,\nor jump into a friend\u2019s room with theirs.', { fontSize: '15px', color: '#cfe3d8', align: 'center', lineSpacing: 4 });
    body.add(MK.btn(scene, 0, -10, 'Create Room', () => flow.go('create'), { w: 320, h: 64, primary: true, size: '24px', icon: MK.icons.people }));
    body.add(MK.btn(scene, 0, 70, 'Join Room', () => flow.go('join'), { w: 320, h: 64, size: '24px', icon: MK.icons.play }));
    T(0, 140, '2 to 4 players per room. No sign-up needed.', { fontSize: '13px', color: '#7fa391' });
    body.add(MK.btn(scene, 0, 205, 'Close', () => flow.api.close(), { w: 140, h: 42, danger: true, size: '16px' }));
  },

  createStep(scene, flow, body) {
    const FONT = UI.FONT, self = CardiOnline;
    let max = parseInt(localStorage.getItem(self.MAX_KEY), 10); if (!(max >= 2 && max <= 4)) max = 4;
    let busy = false;
    const T = (x, y, str, st, org) => { const t = scene.add.text(x, y, str, { fontFamily: FONT, ...st }).setOrigin(...(org || [0.5, 0.5])); body.add(t); return t; };
    const label = (y, s) => T(-190, y, s, { fontSize: '13px', fontStyle: 'bold', color: '#9fbfae' }, [0, 0.5]).setLetterSpacing(3);

    label(-168, 'YOUR NAME');
    const nameF = MK.field(scene, body, { x: 0, y: -126, w: 380, h: 52, placeholder: 'Enter your name', value: self.savedName(), max: 14, font: 21, onEnter: () => submit() });
    flow.fields.push(nameF);

    label(-60, 'PLAYERS IN THE ROOM');
    const chips = [];
    const figs = (g, n, color) => { const gap = 18, x0 = -((n - 1) * gap) / 2; for (let i = 0; i < n; i++) { const x = x0 + i * gap; g.fillStyle(color, 1).fillCircle(x, 16, 4.5).fillRoundedRect(x - 7, 22, 14, 8, { tl: 6, tr: 6, bl: 2, br: 2 }); } };
    const paintChip = (c, on) => {
      c.g.clear();
      c.g.fillStyle(0x000000, 0.35).fillRoundedRect(-48, -38, 96, 88, 18);
      c.g.fillStyle(on ? 0xe8b923 : 0x1a3a2e, 1).fillRoundedRect(-48, -42, 96, 88, 18);
      c.g.lineStyle(2, on ? 0xffe48a : 0x2e5242, 1).strokeRoundedRect(-48, -42, 96, 88, 18);
      c.f.clear(); figs(c.f, c.n, on ? 0x241900 : 0x9fbfae);
      c.t.setColor(on ? '#241900' : '#f3ead2');
    };
    [2, 3, 4].forEach((n, i) => {
      const c = scene.add.container(-110 + i * 110, 6);
      const g = scene.add.graphics(), f = scene.add.graphics();
      const t = scene.add.text(0, -14, String(n), { fontFamily: FONT, fontSize: '36px', fontStyle: '900', color: '#f3ead2' }).setOrigin(0.5);
      c.add([g, f, t]); c.g = g; c.f = f; c.t = t; c.n = n;
      c.setSize(96, 88).setInteractive({ useHandCursor: true });
      c.on('pointerover', () => scene.tweens.add({ targets: c, scale: 1.05, duration: 90 }));
      c.on('pointerout', () => scene.tweens.add({ targets: c, scale: 1, duration: 90 }));
      c.on('pointerup', () => { MK.click(scene); max = n; chips.forEach((k) => paintChip(k, k.n === max)); scene.tweens.add({ targets: c, scale: { from: 0.92, to: 1.05 }, duration: 160, ease: 'Back.out' }); });
      body.add(c); chips.push(c);
    });
    chips.forEach((k) => paintChip(k, k.n === max));
    T(0, 74, 'Including you. The game starts the moment the room is full.', { fontSize: '13px', color: '#7fa391', align: 'center', wordWrap: { width: 400 } });

    const errT = T(0, 112, '', { fontSize: '14px', fontStyle: 'bold', color: '#ff8a8a', align: 'center', wordWrap: { width: 400 } });
    const showError = (msg, field) => {
      errT.setText(msg).setAlpha(0).setY(118); scene.tweens.add({ targets: errT, alpha: 1, y: 112, duration: 180 });
      if (field) { field.flag(); field.shake(); field.focus(); }
    };

    const btn = MK.btn(scene, 0, 160, 'Create Room', () => submit(), { w: 320, h: 56, primary: true, size: '22px' });
    body.add(btn);
    body.add(MK.btn(scene, 0, 220, 'Back', () => { if (!busy) flow.go('menu'); }, { w: 130, h: 38, size: '15px' }));

    async function submit() {
      if (busy) return;
      const name = self.clean(nameF.get());
      if (!name) return showError(self.MSG.bad_name, nameF);
      busy = true; errT.setText(''); btn.label.setText('Creating\u2026'); nameF.el.blur();
      try {
        const d = await self.call('create', { hostId: self.clientId(), hostName: name, maxPlayers: max });
        localStorage.setItem(self.NAME_KEY, name); localStorage.setItem(self.MAX_KEY, String(max));
        if (flow.api.closed) { self.call('leave', { roomCode: d.roomCode, userId: self.clientId() }).catch(() => { }); return; }
        flow.api.close();
        self.lobby(scene, { roomCode: d.roomCode, maxPlayers: d.maxPlayers, name, isHost: true });
      } catch (e) {
        if (flow.api.closed) return;
        busy = false; btn.label.setText('Create Room');
        showError(self.errText(e), e.code === 'bad_name' ? nameF : null);
      }
    }
    setTimeout(() => { if (!flow.api.closed && !nameF.get()) nameF.focus(); }, 380);
  },

  joinStep(scene, flow, body) {
    const FONT = UI.FONT, self = CardiOnline;
    let busy = false;
    const T = (x, y, str, st, org) => { const t = scene.add.text(x, y, str, { fontFamily: FONT, ...st }).setOrigin(...(org || [0.5, 0.5])); body.add(t); return t; };
    const label = (y, s) => T(-190, y, s, { fontSize: '13px', fontStyle: 'bold', color: '#9fbfae' }, [0, 0.5]).setLetterSpacing(3);

    label(-168, 'ROOM CODE');
    const codeF = MK.field(scene, body, { x: 0, y: -116, w: 380, h: 68, placeholder: 'ABC123', max: 6, upper: true, font: 32, enter: 'next', onEnter: () => nameF.focus() });
    T(0, -66, 'Ask the host for the 6-character code.', { fontSize: '13px', color: '#7fa391' });

    label(-22, 'YOUR NAME');
    const nameF = MK.field(scene, body, { x: 0, y: 20, w: 380, h: 52, placeholder: 'Enter your name', value: self.savedName(), max: 14, font: 21, onEnter: () => submit() });
    flow.fields.push(codeF, nameF);

    const errT = T(0, 82, '', { fontSize: '14px', fontStyle: 'bold', color: '#ff8a8a', align: 'center', wordWrap: { width: 400 } });
    const showError = (msg, field) => {
      errT.setText(msg).setAlpha(0).setY(88); scene.tweens.add({ targets: errT, alpha: 1, y: 82, duration: 180 });
      if (field) { field.flag(); field.shake(); field.focus(); }
    };

    const btn = MK.btn(scene, 0, 150, 'Join Room', () => submit(), { w: 320, h: 56, primary: true, size: '22px' });
    body.add(btn);
    body.add(MK.btn(scene, 0, 214, 'Back', () => { if (!busy) flow.go('menu'); }, { w: 130, h: 38, size: '15px' }));

    async function submit() {
      if (busy) return;
      const code = codeF.get(), name = self.clean(nameF.get());
      if (code.length !== 6) return showError(self.MSG.bad_code, codeF);
      if (!name) return showError(self.MSG.bad_name, nameF);
      busy = true; errT.setText(''); btn.label.setText('Joining\u2026'); codeF.el.blur(); nameF.el.blur();
      try {
        const d = await self.call('join', { roomCode: code, userId: self.clientId(), playerName: name });
        localStorage.setItem(self.NAME_KEY, name);
        if (flow.api.closed) { self.call('leave', { roomCode: code, userId: self.clientId() }).catch(() => { }); return; }
        flow.api.close();
        self.lobby(scene, { roomCode: code, maxPlayers: d.maxPlayers, name, isHost: false });
      } catch (e) {
        if (flow.api.closed) return;
        busy = false; btn.label.setText('Join Room');
        showError(self.errText(e), e.code === 'name_taken' || e.code === 'bad_name' ? nameF : codeF);
      }
    }
    setTimeout(() => { if (!flow.api.closed) codeF.focus(); }, 380);
  },

  /* ----------------------------- the WAITING ROOM ----------------------------- */
  lobby(scene, info) {
    const self = this, FONT = UI.FONT, userId = this.clientId(), roomCode = info.roomCode, N = info.maxPlayers;
    const W = 500, PITCH = 62, H = 384 + N * PITCH, top = -H / 2;
    if (scene.lobby) scene.lobby.close(false);

    const layer = scene.add.container(0, 0).setDepth(150).setAlpha(0);
    const dim = scene.add.rectangle(0, 0, 4000, 4000, 0x061510, 0.92).setInteractive();
    const panel = scene.add.container(0, 0);
    const frame = scene.add.graphics()
      .fillStyle(0x000000, 0.4).fillRoundedRect(-W / 2 + 6, -H / 2 + 10, W, H, 26)
      .fillStyle(0x0c2119, 1).fillRoundedRect(-W / 2, -H / 2, W, H, 26)
      .lineStyle(3, 0xe8b923, 1).strokeRoundedRect(-W / 2, -H / 2, W, H, 26)
      .lineStyle(1, 0xe8b923, 0.25).strokeRoundedRect(-W / 2 + 8, -H / 2 + 8, W - 16, H - 16, 20);
    const content = scene.add.container(0, 0);
    panel.add([frame, content]); layer.add([dim, panel]);

    const place = () => {
      const d = MK.design(scene), fs = Math.min(1, (d.w - 24) / W, (d.h - 24) / H);
      panel.setPosition(d.w / 2, d.h / 2).setScale(fs); dim.setPosition(d.w / 2, d.h / 2);
    };
    place(); scene.scale.on('resize', place);
    scene.tweens.add({ targets: layer, alpha: 1, duration: 220 });

    const T = (x, y, str, st, org) => { const t = scene.add.text(x, y, str, { fontFamily: FONT, ...st }).setOrigin(...(org || [0.5, 0.5])); content.add(t); return t; };
    const state = { done: false, starting: false, left: false, closedView: false, failures: 0, busy: false, first: true, prev: {} };

    T(0, top + 42, 'WAITING ROOM', { fontSize: '26px', fontStyle: 'bold', color: MK.GOLD }).setLetterSpacing(5);

    // Room code card
    const cy = top + 122;
    content.add(scene.add.graphics().fillStyle(0x1a3a2e, 1).fillRoundedRect(-220, cy - 42, 440, 84, 18).lineStyle(2, MK.GOLD_N, 0.8).strokeRoundedRect(-220, cy - 42, 440, 84, 18));
    T(-35, cy - 24, 'ROOM CODE', { fontSize: '11px', fontStyle: 'bold', color: '#9fbfae' }).setLetterSpacing(4);
    T(-35, cy + 10, roomCode, { fontSize: '44px', fontStyle: '900', color: '#ffffff' }).setLetterSpacing(10);
    const canShare = typeof navigator.share === 'function';
    const copyBtn = MK.iconBtn(scene, 185, canShare ? cy - 22 : cy, MK.icons.copy, () => copyCode(), { r: 18 });
    content.add(copyBtn);
    if (canShare) content.add(MK.iconBtn(scene, 185, cy + 22, MK.icons.share, () => { navigator.share({ title: 'Cardi', text: 'Join my Cardi game! Room code: ' + roomCode, url: location.origin }).catch(() => { }); }, { r: 18 }));
    const copyCode = async () => {
      try { await navigator.clipboard.writeText(roomCode); }
      catch (e) { const ta = document.createElement('textarea'); ta.value = roomCode; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (_) { /* ignore */ } ta.remove(); }
      copyBtn.paint(MK.icons.check); MK.toast(scene, 'Room code copied');
      scene.time.delayedCall(1600, () => { if (copyBtn.scene) copyBtn.paint(MK.icons.copy); });
    };

    // Player count + progress
    T(-220, top + 205, 'PLAYERS', { fontSize: '13px', fontStyle: 'bold', color: '#9fbfae' }, [0, 0.5]).setLetterSpacing(3);
    const countT = T(220, top + 205, '0 / ' + N, { fontSize: '16px', fontStyle: '900', color: MK.GOLD }, [1, 0.5]);
    const barG = scene.add.graphics(); content.add(barG);
    const bar = { v: 0 };
    const drawBar = () => { barG.clear().fillStyle(0x1a3a2e, 1).fillRoundedRect(-220, top + 222, 440, 8, 4); if (bar.v > 0.001) barG.fillStyle(0xe8b923, 1).fillRoundedRect(-220, top + 222, Math.max(8, 440 * bar.v), 8, 4); };
    drawBar();

    // Seats
    const slots = [];
    for (let i = 0; i < N; i++) { const c = scene.add.container(0, top + 289 + i * PITCH); content.add(c); slots.push({ c, key: null }); }
    const paintSlot = (slot, i, p, pop) => {
      scene.tweens.killTweensOf(slot.c.list); slot.c.removeAll(true);
      const g = scene.add.graphics(); slot.c.add(g);
      if (!p) {
        g.fillStyle(0x0c2119, 1).fillRoundedRect(-220, -27, 440, 54, 16).lineStyle(2, 0x2e5242, 0.9).strokeRoundedRect(-220, -27, 440, 54, 16);
        g.lineStyle(2, 0x2e5242, 1).strokeCircle(-190, 0, 19);
        slot.c.add(scene.add.text(-156, 0, 'Waiting for a player', { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#5f7f70' }).setOrigin(0, 0.5));
        for (let k = 0; k < 3; k++) {
          const dot = scene.add.circle(190 + k * 14, 0, 3.5, 0xe8b923, 1).setAlpha(0.2); slot.c.add(dot);
          scene.tweens.add({ targets: dot, alpha: 1, duration: 520, yoyo: true, repeat: -1, delay: k * 170 });
        }
        slot.c.setScale(1);
        return;
      }
      const col = self.COLORS[p.seat % 4];
      g.fillStyle(0x16342a, 1).fillRoundedRect(-220, -27, 440, 54, 16).lineStyle(2, col, 0.6).strokeRoundedRect(-220, -27, 440, 54, 16);
      g.fillStyle(col, 1).fillCircle(-190, 0, 19);
      slot.c.add(scene.add.text(-190, 0, (Array.from(p.name)[0] || '?').toUpperCase(), { fontFamily: FONT, fontSize: '20px', fontStyle: '900', color: '#0c2119' }).setOrigin(0.5));
      slot.c.add(scene.add.text(-156, 0, p.name, { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0, 0.5));
      let x = 206;
      const badge = (txt, fill, tc, outline) => {
        const w = txt.length * 9 + 22, bg = scene.add.graphics();
        if (fill) bg.fillStyle(fill, 1).fillRoundedRect(x - w, -11, w, 22, 11); else bg.lineStyle(1.5, outline, 0.9).strokeRoundedRect(x - w, -11, w, 22, 11);
        slot.c.add(bg); slot.c.add(scene.add.text(x - w / 2, 0, txt, { fontFamily: FONT, fontSize: '11px', fontStyle: '900', color: tc }).setOrigin(0.5).setLetterSpacing(2));
        x -= w + 8;
      };
      if (p.isHost) badge('HOST', 0xe8b923, '#241900');
      if (p.isYou) badge('YOU', 0, '#f3ead2', 0xf3ead2);
      if (pop) { slot.c.setScale(0.92); scene.tweens.add({ targets: slot.c, scale: 1, duration: 280, ease: 'Back.out' }); } else slot.c.setScale(1);
    };
    slots.forEach((s, i) => paintSlot(s, i, null, false));

    const statusT = T(0, top + 274 + N * PITCH, '', { fontSize: '16px', fontStyle: 'bold', color: '#f3ead2' });
    const hintT = T(0, top + 298 + N * PITCH, info.isHost ? 'If you leave, the room closes for everyone.' : 'You can leave any time.', { fontSize: '12px', color: '#7fa391' });
    const connT = T(0, top + 74, '', { fontSize: '12px', fontStyle: 'bold', color: '#241900', backgroundColor: '#e8b923', padding: { x: 10, y: 3 } }).setAlpha(0);

    // Leave / close
    let armed = false, armTimer = null, pollTimer = null;
    const leaveBtn = MK.btn(scene, 0, H / 2 - 44, info.isHost ? 'Close room' : 'Leave room', () => onLeaveTap(), { w: 290, h: 46, danger: true, size: '17px' });
    content.add(leaveBtn);

    const stopPolling = () => { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } };
    const ctl = {
      close(fade) {
        if (state.done) return; state.done = true;
        stopPolling(); clearTimeout(armTimer);
        window.removeEventListener('pagehide', onHide); document.removeEventListener('visibilitychange', onVis);
        scene.scale.off('resize', place);
        if (scene.input.keyboard) scene.input.keyboard.off('keydown-ESC', onLeaveTap);
        if (scene.lobby === ctl) scene.lobby = null;
        if (!layer.scene) return;
        if (fade) scene.tweens.add({ targets: layer, alpha: 0, duration: 200, onComplete: () => { if (layer.scene) layer.destroy(); } });
        else layer.destroy();
      },
    };
    scene.lobby = ctl;
    scene.events.once('shutdown', () => ctl.close(false));

    const leave = () => {
      if (state.left) return; state.left = true;
      self.call('leave', { roomCode, userId }).catch(() => { });
      ctl.close(true);
    };
    function onLeaveTap() {
      if (state.done || state.starting || state.closedView) return;
      if (info.isHost && !armed) {
        armed = true; leaveBtn.label.setText('Tap again to close the room');
        armTimer = setTimeout(() => { armed = false; if (!state.done && !state.closedView) leaveBtn.label.setText('Close room'); }, 3000);
        return;
      }
      leave();
    }
    function onHide() { if (!state.left && !state.starting && !state.closedView && navigator.sendBeacon) navigator.sendBeacon('/api?action=leave', new Blob([JSON.stringify({ roomCode, userId })], { type: 'application/json' })); }
    function onVis() { if (!document.hidden) tick(); }
    window.addEventListener('pagehide', onHide); document.addEventListener('visibilitychange', onVis);
    if (scene.input.keyboard) scene.input.keyboard.on('keydown-ESC', onLeaveTap);

    // Closed view (host left, room removed, connection lost)
    const showClosed = (title, msg) => {
      if (state.closedView || state.done) return;
      state.closedView = true; stopPolling();
      leaveBtn.disableInteractive(); content.setVisible(false);
      const c = scene.add.container(0, 0).setAlpha(0); panel.add(c);
      c.add(scene.add.text(0, -70, title, { fontFamily: FONT, fontSize: '28px', fontStyle: '900', color: MK.GOLD }).setOrigin(0.5).setLetterSpacing(4));
      c.add(scene.add.text(0, -8, msg, { fontFamily: FONT, fontSize: '16px', color: '#cfe3d8', align: 'center', wordWrap: { width: 380 }, lineSpacing: 4 }).setOrigin(0.5));
      c.add(MK.btn(scene, 0, 78, 'Back to menu', () => ctl.close(true), { w: 260, h: 54, primary: true, size: '20px' }));
      scene.tweens.add({ targets: c, alpha: 1, duration: 240 });
    };

    // Launch the match
    const launch = (d) => {
      const list = d.players.slice().sort((a, b) => a.seat - b.seat);
      const players = list.map((p) => ({ name: p.name, isBot: false, isHost: p.isHost }));
      const localIndex = Math.max(0, list.findIndex((p) => p.isYou));
      scene.launchOnline({ players, localIndex, seed: d.seed, online: { roomCode, userId } });
    };
    const startCountdown = (d) => {
      if (state.starting) return; state.starting = true; stopPolling();
      leaveBtn.disableInteractive(); leaveBtn.setAlpha(0.35); hintT.setText('');
      let n = 3;
      const step = () => {
        if (state.done) return;
        if (n === 0) return launch(d);
        statusT.setText('Room full! Starting in ' + n + '\u2026').setColor('#e8b923');
        scene.tweens.add({ targets: statusT, scale: { from: 1.25, to: 1 }, duration: 260, ease: 'Back.out' });
        n--; setTimeout(step, 700);
      };
      step();
    };

    // Apply server state
    const apply = (d) => {
      const bySeat = {}; d.players.forEach((p) => { bySeat[p.seat] = p; });
      const now = {};
      slots.forEach((s, i) => {
        const p = bySeat[i], key = p ? p.name + '|' + p.isHost + '|' + p.isYou : 'empty';
        if (p) now[p.seat] = p.name;
        if (s.key !== key) { paintSlot(s, i, p || null, !!p && !state.first); s.key = key; }
      });
      if (!state.first) {
        d.players.forEach((p) => { if (!p.isYou && state.prev[p.seat] !== p.name) MK.toast(scene, p.name + ' joined'); });
        Object.keys(state.prev).forEach((seat) => { if (!now[seat]) MK.toast(scene, state.prev[seat] + ' left'); });
      }
      state.prev = now; state.first = false;
      const count = d.players.length, left = N - count;
      countT.setText(count + ' / ' + N);
      scene.tweens.add({ targets: bar, v: count / N, duration: 320, ease: 'Cubic.out', onUpdate: drawBar });
      if (d.status === 'playing' || left <= 0) return startCountdown(d);
      statusT.setText(count === 1 ? 'Share the code with your friends' : 'Waiting for ' + left + ' more player' + (left === 1 ? '' : 's') + '\u2026');
    };

    const tick = async () => {
      if (state.done || state.busy || state.starting || state.closedView) return;
      state.busy = true;
      try {
        const d = await self.call('status', { roomCode, userId });
        if (state.done || state.closedView) return;
        state.failures = 0; connT.setAlpha(0);
        if (d.closed) {
          if (d.reason === 'host_left') showClosed('ROOM CLOSED', info.isHost ? 'This room timed out because it was idle for too long.' : 'The host left, so this room was closed.');
          else showClosed('ROOM CLOSED', 'This room is no longer available.');
        } else apply(d);
      } catch (e) {
        state.failures++;
        if (state.failures >= 3) connT.setText('Reconnecting\u2026').setAlpha(1);
        if (state.failures >= 20) showClosed('CONNECTION LOST', 'We couldn\u2019t reach the server. Check your connection and try again.');
      } finally { state.busy = false; }
    };
    // Real timers on purpose: they keep running while the tab is in the background (sharing the code).
    pollTimer = setInterval(tick, 1500);
    statusT.setText('Opening the room\u2026');
    tick();
    return ctl;
  },
};

class MainMenuScene extends Phaser.Scene {
  constructor() { super('MainMenuScene'); }
  getDesign() { return MK.design(this); }

  create() {
    const { FONT } = UI;
    UI.drawFelt(this);
    this.modal = null;
    this.cameras.main.fadeIn(300, 15, 36, 28);
    this.buildSuits();
    this.buildFan();

    this.title = this.add.text(0, 0, 'CARDI', { fontFamily: FONT, fontSize: '120px', color: MK.GOLD, fontStyle: '900', stroke: '#5a4300', strokeThickness: 8, shadow: { offsetX: 0, offsetY: 6, color: '#000', blur: 12, fill: true } }).setOrigin(0.5);
    this.tag = this.add.text(0, 0, 'DOMINATE THE SPINNING TABLE', { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#f3ead2' }).setOrigin(0.5).setLetterSpacing(4);

    this.halo = this.add.graphics().fillStyle(0xe8b923, 1).fillRoundedRect(-170, -46, 340, 92, 32).setAlpha(0.05);
    this.tweens.add({ targets: this.halo, alpha: 0.28, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.play = MK.btn(this, 0, 0, 'PLAY', () => this.showPlayModal(), { w: 300, h: 70, primary: true, size: '32px', icon: MK.icons.play });
    this.multi = MK.btn(this, 0, 0, 'Multiplayer', () => this.showMultiplayerModal(), { w: 260, h: 54, size: '21px', icon: MK.icons.people });
    this.shop = MK.btn(this, 0, 0, 'Shop', () => this.scene.start('ShopScene'), { w: 260, h: 54, size: '21px', icon: MK.icons.shop });

    // Icon buttons: a dock under the menu buttons in portrait, corner icons in landscape.
    // Array order = left-to-right order of the portrait dock.
    this.dock = this.add.graphics();
    this.bar = [];
    const pin = (o, side, dx) => { this.bar.push({ o, side, dx }); return o; };
    this.soundBtn = pin(MK.iconBtn(this, 0, 0, (g, c) => MK.icons.sound(g, c, !this.sound.mute), () => {
      this.sound.mute = !this.sound.mute;
      localStorage.setItem('cardi_mute', this.sound.mute ? '1' : '0');
      this.soundBtn.paint(MK.icons.sound, !this.sound.mute);
    }), 'l', 36);
    pin(MK.iconBtn(this, 0, 0, MK.icons.full, () => MK.fullscreen(this)), 'l', 92);
    pin(MK.iconBtn(this, 0, 0, MK.icons.share, () => this.showSocial()), 'r', 92);
    pin(MK.iconBtn(this, 0, 0, '?', () => this.showHowTo()), 'r', 148);
    pin(MK.iconBtn(this, 0, 0, MK.icons.gear, () => this.scene.start('SettingsScene', { returnScene: 'MainMenuScene' })), 'r', 36);
    this.copy = this.add.text(0, 0, '© 2026 Hazy Pixel Studio', { fontFamily: FONT, fontSize: '11px', color: '#4d6b5d' }).setOrigin(0.5);

    this.layout();
    const onResize = () => this.layout();
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));

    // Entrance (alpha/scale only, so layout stays in charge of positions)
    this.title.setScale(0.4).setAlpha(0);
    this.tweens.add({ targets: this.title, scale: 1, alpha: 1, duration: 600, ease: 'Back.out', onComplete: () => this.tweens.add({ targets: this.title, scale: 1.03, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.inOut' }) });
    this.tag.setAlpha(0); this.tweens.add({ targets: this.tag, alpha: 1, duration: 500, delay: 300 });
    [this.play, this.multi, this.shop, ...this.bar.map((b) => b.o)].forEach((o, i) => {
      o.setAlpha(0).setScale(0.85);
      this.tweens.add({ targets: o, alpha: 1, scale: 1, duration: 380, delay: 350 + i * 70, ease: 'Back.out' });
    });
    this.dock.setAlpha(0); this.tweens.add({ targets: this.dock, alpha: 1, duration: 400, delay: 450 });
    this.startMusic();
  }

  /** Everything positioned from the visible screen rect, so portrait, landscape and ultrawide all work. */
  layout() {
    const v = this.v = UI.view(this);
    const vw = v.right - v.left, vh = v.bottom - v.top, cx = (v.left + v.right) / 2;
    const fs = Math.round(Math.min(120, vw * 0.24));
    this.title.setFontSize(fs + 'px');
    const ty = v.top + vh * 0.17;
    this.title.setPosition(cx, ty);
    this.tag.setPosition(cx, ty + fs * 0.65);
    const py = v.top + vh * 0.41;
    this.play.setPosition(cx, py); this.halo.setPosition(cx, py);
    this.multi.setPosition(cx, py + 78);
    this.shop.setPosition(cx, py + 144);
    const portrait = vh > vw;
    this.dock.clear().setVisible(portrait);
    if (portrait) {
      const n = this.bar.length, gap = Math.min(64, (vw - 120) / (n - 1));
      const dy = Math.min(this.shop.y + 96, v.bottom - 225), half = (gap * (n - 1)) / 2 + 42;
      this.dock.fillStyle(0x000000, 0.35).fillRoundedRect(cx - half, dy - 32, half * 2, 72, 36)
        .fillStyle(0x0c2119, 0.92).fillRoundedRect(cx - half, dy - 36, half * 2, 72, 36)
        .lineStyle(2, 0xe8b923, 0.6).strokeRoundedRect(cx - half, dy - 36, half * 2, 72, 36);
      this.bar.forEach(({ o }, i) => o.setPosition(cx - (gap * (n - 1)) / 2 + i * gap, dy));
    } else {
      this.bar.forEach(({ o, side, dx }) => o.setPosition(side === 'l' ? v.left + dx : v.right - dx, v.top + 38));
    }
    this.copy.setPosition(cx, v.bottom - 12);
    const sp = Math.min(70, (vw - 150) / 6);
    this.fan.setPosition(cx, v.bottom - 100);
    this.fanCards.forEach((c) => (c.x = c.slot * sp));
  }

  buildSuits() {
    this.suits = [];
    ['♠', '♥', '♦', '♣'].forEach((s, k) => {
      for (let i = 0; i < 5; i++) {
        const t = this.add.text(0, 0, s, { fontFamily: UI.FONT, fontSize: Phaser.Math.Between(30, 72) + 'px', color: k % 3 ? '#ff6b6b' : '#ffffff' }).setAlpha(Phaser.Math.FloatBetween(0.04, 0.09));
        t.fx = Math.random(); t.fy = Math.random(); t.ph = Math.random() * 6.28; t.sp = Phaser.Math.Between(2500, 5000);
        this.suits.push(t);
      }
    });
  }

  /** Suits drift across the WHOLE screen (positions are fractions of the visible rect). */
  update(time) {
    const v = this.v; if (!v || !this.suits) return;
    const vw = v.right - v.left, vh = v.bottom - v.top;
    this.suits.forEach((t) => {
      const a = time / t.sp + t.ph;
      t.setPosition(v.left + t.fx * vw + Math.sin(a) * 18, v.top + t.fy * vh + Math.cos(a) * 30).setAngle(Math.sin(a * 0.8) * 25);
    });
  }

  buildFan() {
    this.fan = this.add.container(0, 0); this.fanCards = [];
    ['hearts_ace', 'card_back', 'clubs_king', 'card_back', 'spades_jack', 'card_back', 'diamonds_3'].forEach((key, i) => {
      const off = i - 3, ty = Math.abs(off) * 10;
      const img = this.add.image(0, 320, key).setDisplaySize(110, 160).setAngle(off * 8).setAlpha(0.92);
      img.slot = off; this.fan.add(img); this.fanCards.push(img);
      this.tweens.add({
        targets: img, y: ty, duration: 500, delay: 500 + i * 70, ease: 'Cubic.out',
        onComplete: () => this.tweens.add({ targets: img, y: ty - 8, duration: 1600 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
      });
    });
  }

  /** Music streams in AFTER the menu is visible, so the menu never waits on the big mp3. */
  startMusic() {
    const play = () => {
      if (!this.scene.isActive('MainMenuScene') || !this.cache.audio.exists('menu_music')) return;
      if (!this.menuMusic || !this.menuMusic.manager) this.menuMusic = this.sound.add('menu_music', { loop: true, volume: 0 });
      if (!this.menuMusic.isPlaying) { this.menuMusic.play(); this.tweens.add({ targets: this.menuMusic, volume: 0.4, duration: 1500 }); }
    };
    const ready = () => (this.sound.locked ? this.sound.once('unlocked', play) : play());
    if (this.cache.audio.exists('menu_music')) return ready();
    this.load.once('filecomplete-audio-menu_music', ready);
    this.load.audio('menu_music', MK.BASE + 'assets/bg.mp3');
    this.load.start();
  }

  /* --- PLAY --- */
  showPlayModal() {
    const start = (bots) => {
      const used = new Set(), players = [{ name: 'You', isBot: false }];
      for (let i = 0; i < bots; i++) {
        let n = 'Bot ' + (i + 1);
        for (let k = 0; k < 10; k++) { const c = window.NameHandler ? NameHandler.getRandomName() : n; if (!used.has(c)) { n = c; break; } }
        used.add(n); players.push({ name: n, isBot: true });
      }
      this.modal.close();
      const go = () => this.scene.start('GameScene', { players });
      if (this.menuMusic && this.menuMusic.isPlaying) {
        this.tweens.add({ targets: this.menuMusic, volume: 0, duration: 700, onComplete: () => { this.menuMusic.stop(); this.menuMusic.destroy(); this.menuMusic = null; go(); } });
      } else go();
    };
    this.modal = MK.modal(this, { title: 'SELECT OPPONENTS', w: 520, h: 330, close: 'Cancel' }, (panel) => {
      [[1, '1 vs 1', '1 Bot'], [2, '1 vs 2', '2 Bots'], [3, '1 vs 3', '3 Bots']].forEach(([n, a, b], i) => {
        const c = this.add.container(-150 + i * 150, 5);
        const g = this.add.graphics().fillStyle(0x1a3a2e, 1).fillRoundedRect(-65, -60, 130, 120, 16).lineStyle(2, 0x2e5242, 1).strokeRoundedRect(-65, -60, 130, 120, 16);
        const t1 = this.add.text(0, -14, a, { fontFamily: UI.FONT, fontSize: '28px', fontStyle: '900', color: '#fff' }).setOrigin(0.5);
        const t2 = this.add.text(0, 26, b, { fontFamily: UI.FONT, fontSize: '14px', fontStyle: 'bold', color: '#9fbfae' }).setOrigin(0.5);
        c.add([g, t1, t2]).setSize(130, 120).setInteractive({ useHandCursor: true });
        c.on('pointerover', () => { g.lineStyle(3, 0xe8b923, 1).strokeRoundedRect(-65, -60, 130, 120, 16); this.tweens.add({ targets: c, scale: 1.06, duration: 100 }); });
        c.on('pointerout', () => { g.lineStyle(3, 0x2e5242, 1).strokeRoundedRect(-65, -60, 130, 120, 16); this.tweens.add({ targets: c, scale: 1, duration: 100 }); });
        c.on('pointerdown', () => { MK.click(this); start(n); });
        panel.add(c);
      });
    });
  }

  showMultiplayerModal() { CardiOnline.open(this); }

  /** Start an online match: same fade-out as a local game, then hand the roster + shared seed to GameScene. */
  launchOnline(data) {
    const go = () => this.scene.start('GameScene', data);
    if (this.menuMusic && this.menuMusic.isPlaying) {
      this.tweens.add({ targets: this.menuMusic, volume: 0, duration: 500, onComplete: () => { this.menuMusic.stop(); this.menuMusic.destroy(); this.menuMusic = null; go(); } });
    } else go();
  }

  showSocial() {
    const links = [['Instagram', 'hazypixelstudios', 'https://instagram.com/hazypixelstudios'], ['X (Twitter)', 'hazypixelstudio', 'https://x.com/hazypixelstudio'], ['TikTok', 'lordquz', 'https://tiktok.com/@lordquz']];
    this.modal = MK.modal(this, { title: 'FOLLOW US', w: 440, h: 330 }, (panel) => {
      links.forEach(([n, h, url], i) => panel.add(MK.btn(this, 0, -60 + i * 58, `${n}  @${h}`, () => window.open(url, '_blank', 'noopener'), { w: 340, h: 46, size: '16px' })));
    });
  }

  /* --- HOW TO PLAY (two columns in landscape, one column in portrait) --- */
  showHowTo() {
    const P = MK.isPortrait(this);
    const rules = [
      ['GOAL', 'Empty your hand before anyone else.'],
      ['YOUR TURN', 'Play a card matching the suit or rank. No match? Draw 1.'],
      ['KICKBACK (King)', 'Reverses direction of play.'],
      ['JUMP (Jack)', 'Skips the next player.'],
      ['ACE', 'Wild card. Changes the suit. Cuts a punishment by 3.'],
      ['FOUL (3)', 'Starts a 3-card punishment. Stack 3s or use an Ace.'],
      ['NIKO CARDI', 'Shout it at 1 card left. Forget and draw +1.'],
    ];
    const scores = [['+2', 'Combo (2 cards)'], ['+3', 'Mega Combo (3+)'], ['+4', 'Block / Sniper Foul'], ['+5', 'Sniper Kickback'], ['+6', 'Sniper Jump'], ['+7', 'Ace Override']];
    const w = P ? 440 : 700, h = P ? 800 : 600;
    this.modal = MK.modal(this, { title: 'HOW TO PLAY', w, h, close: 'Got it' }, (panel) => {
      const rx = P ? -195 : -320, ry = P ? -h / 2 + 90 : -200, step = P ? 52 : 64;
      rules.forEach(([hd, b], i) => {
        const y = ry + i * step;
        panel.add([this.add.text(rx, y, hd, { fontFamily: UI.FONT, fontSize: '15px', fontStyle: '900', color: MK.GOLD }),
        this.add.text(rx, y + 20, b, { fontFamily: UI.FONT, fontSize: '13px', color: '#cfe3d8', wordWrap: { width: P ? 390 : 330 } })]);
      });
      const sx = P ? 0 : 185, sy = P ? ry + 7 * step + 6 : -200;
      panel.add(this.add.text(sx, sy, 'SMART MOVES', { fontFamily: UI.FONT, fontSize: '16px', fontStyle: '900', color: '#ff6b6b' }).setOrigin(0.5));
      scores.forEach(([p, t], i) => {
        const x = P ? -195 + (i % 2) * 215 : 35, y = P ? sy + 40 + Math.floor(i / 2) * 42 : -150 + i * 44;
        panel.add([this.add.graphics().fillStyle(0x1a3a2e, 1).fillRoundedRect(x, y - 14, 50, 28, 7).lineStyle(1.5, 0xe8b923, 1).strokeRoundedRect(x, y - 14, 50, 28, 7),
        this.add.text(x + 25, y, p, { fontFamily: UI.FONT, fontSize: '15px', fontStyle: '900', color: MK.GOLD }).setOrigin(0.5),
        this.add.text(x + 60, y, t, { fontFamily: UI.FONT, fontSize: '13px', fontStyle: 'bold', color: '#f3ead2' }).setOrigin(0, 0.5)]);
      });
    });
  }
}
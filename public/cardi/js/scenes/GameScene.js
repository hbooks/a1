/* =====================================================================
 * GameScene — Smart Tap, Premium Niko UI, Timer, Audio + animated table
 *
 *  GAMEPLAY (unchanged): smart-tap selection, tap the discard pile to play a
 *  batch, Ace suit picker (leftover-Ace rule), 5s Niko Cardi timer, delayed
 *  hint, Carl the bot, direct Rules.applyMove.
 *
 *  UI LAYER (new): persistent card sprites (hands re-fan, cards fly, bot cards
 *  flip), pop-up announcements, screen shake/flash, deal animation, bot idle
 *  sway, sound effects, redesigned side panel / name plate / turn pill.
 *
 *  SOUNDS (all in /cardi/assets/, played automatically, missing files are skipped):
 *    nc.mp3 = Niko Cardi     rg.mp3 = game start + reshuffle
 *    dg.mp3 = drawing        pg.mp3 = playing a card      pt.mp3 = punishment
 * ===================================================================== */
const BOT_Y = 100;
const HAND_Y = 600;
const PILE_Y = 330;
const DRAW_X = 255;
const DISCARD_X = 445;
const TABLE_CX = 350;

const Z = { hand: 10, selected: 120, hover: 300, fly: 700, fx: 900, toast: 2000, modal: 3000 };
const GOLD = 0xe8b923;

class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init(data) {
    this.options = { humanName: 'You', botName: 'Carl', ...data };
  }

  preload() {
    const base = '/cardi/assets/';
    this.load.audio('niko_audio', base + 'nc.mp3');
    this.load.audio('sfx_rg', base + 'rg.wav');   // reshuffle + start of game
    this.load.audio('sfx_dg', base + 'dg.wav');   // drawing
    this.load.audio('sfx_pg', base + 'pg.wav');   // playing a card
    this.load.audio('sfx_pt', base + 'pt.wav');   // punishment
  }

  create() {
    // Unlock the browser's audio context on the first click
    this.input.once('pointerdown', () => {
      if (this.sound.context && this.sound.context.state === 'suspended') this.sound.context.resume();
    });
    try { this.sound.mute = localStorage.getItem('cardi_mute') === '1'; } catch (e) { /* no storage */ }

    this.dead = false;
    this.humanIndex = 0;
    this.botIndex = 1;
    this.busy = true;
    this.dealing = true;
    this.modal = null;
    this.selectedCards = [];
    this.handSprites = new Map();
    this.botSprites = [];
    this.angles = {};
    this.activeToasts = [];
    this.nikoWindow = null;
    this.hintTimer = null;
    this.lastPun = 0;
    this.lastLogLen = 0;
    this.lastDirection = 1;
    this.lastTurnBase = '';
    this.thinkEv = null;
    this.turnPulse = null;
    this.botIdleOn = false;
    this.dropHintOn = false;
    this.botNikoShown = false;

    UI.drawFelt(this);
    this.drawTableDecor();
    this.ensureTextures();

    this.state = GameStateMgr.createGame([
      { name: this.options.humanName, isBot: false },
      { name: this.options.botName, isBot: true },
    ]);
    this.vw = { human: [], discard: [], discardCount: 0, drawCount: 0, suit: this.state.currentSuit, suitShown: null };
    this.lastDirection = this.state.direction;

    this.buildStaticUI();
    this.events.once('shutdown', () => { this.dead = true; });

    this.startDealSequence();
  }

  /* ------------------------------------------------------------------ */
  /* small helpers                                                       */
  /* ------------------------------------------------------------------ */
  alive() { return !this.dead; }
  wait(ms) { return new Promise((r) => this.time.delayedCall(ms, r)); }
  tweenP(cfg) { return new Promise((r) => this.tweens.add({ ...cfg, onComplete: r, onStop: r })); }

  /** Play a sound if its file was found. Never throws. */
  sfx(key, volume = 0.9) {
    try { if (this.cache.audio.exists(key)) this.sound.play(key, { volume }); } catch (e) { /* ignore */ }
  }

  suitName(s) { const n = Rules.SUIT_NAMES[s] || s; return n.charAt(0).toUpperCase() + n.slice(1); }
  suitColorCss(s) { return Rules.SUIT_COLORS[s] === '#1d1d1d' ? '#ffffff' : Rules.SUIT_COLORS[s]; }

  isHumanTurn() {
    const s = this.state;
    return s.winnerIndex == null && s.currentPlayerIndex === this.humanIndex && s.turnStarted;
  }

  humanLegalIds() {
    const s = this.state;
    const hand = s.players[this.humanIndex].hand;
    let legal = Rules.getLegalMoves(hand, s.topCard, s.pendingPunishment, s.currentSuit);
    if (s.drawnCardId) legal = legal.filter((c) => c.id === s.drawnCardId);
    return new Set(legal.map((c) => c.id));
  }

  canHumanDraw() {
    if (!this.isHumanTurn() || this.busy || this.state.drawnCardId) return false;
    return true;
  }

  angleFor(id) {
    if (this.angles[id] == null) this.angles[id] = Phaser.Math.Between(-9, 9);
    return this.angles[id];
  }

  triggerHint() {
    if (this.hintTimer) this.hintTimer.remove();
    this.hintText.setAlpha(0);
    if (!this.isHumanTurn() || this.busy) return;
    this.hintTimer = this.time.delayedCall(4000, () => {
      if (this.hintText.text !== '') this.tweens.add({ targets: this.hintText, alpha: 1, duration: 300 });
    });
  }

  showToast(msg, color = '#ffffff', y = 255) {
    this.activeToasts.forEach((t) => { this.tweens.killTweensOf(t); t.destroy(); });
    this.activeToasts = [];
    const t = this.add.text(TABLE_CX, y, msg, {
      fontFamily: UI.FONT, fontSize: '18px', color, fontStyle: 'bold',
      backgroundColor: 'rgba(0,0,0,0.85)', padding: { x: 14, y: 8 }, align: 'center', wordWrap: { width: 460 },
    }).setOrigin(0.5).setDepth(Z.toast).setAlpha(0);
    this.activeToasts.push(t);
    this.tweens.add({ targets: t, alpha: 1, y: y - 8, duration: 160 });
    this.tweens.add({
      targets: t, alpha: 0, delay: 1500, duration: 300,
      onComplete: () => { t.destroy(); this.activeToasts = this.activeToasts.filter((x) => x !== t); },
    });
  }

  clearToasts() {
    this.activeToasts.forEach((t) => { this.tweens.killTweensOf(t); t.destroy(); });
    this.activeToasts = [];
  }

  ensureTextures() {
    const { CW, CH } = UI;
    if (!this.textures.exists('cardi_shadow')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x000000, 0.38).fillRoundedRect(0, 0, CW, CH, 10);
      g.generateTexture('cardi_shadow', CW, CH);
      g.destroy();
    }
    if (!this.textures.exists('cardi_glow')) {
      const w = CW + 16, h = CH + 16;
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.lineStyle(3, GOLD, 0.35).strokeRoundedRect(1, 1, w - 2, h - 2, 15);
      g.lineStyle(4, 0xffd54a, 1).strokeRoundedRect(4, 4, w - 8, h - 8, 12);
      g.generateTexture('cardi_glow', w, h);
      g.destroy();
    }
  }

  cardScale(key) {
    const f = this.textures.getFrame(key) || this.textures.getFrame('__MISSING');
    return { sx: UI.CW / f.width, sy: UI.CH / f.height };
  }

  /* ------------------------------------------------------------------ */
  /* static UI                                                           */
  /* ------------------------------------------------------------------ */
  drawTableDecor() {
    const g = this.add.graphics().setDepth(0);
    // soft shadow band that "grounds" the hand
    for (let i = 0; i < 9; i++) { g.fillStyle(0x000000, 0.04); g.fillRect(0, 500 + i * 20, 710, 200 - i * 20); }
    // faint table rings around the play area
    g.lineStyle(2, 0xffffff, 0.045).strokeCircle(TABLE_CX, PILE_Y, 168);
    g.lineStyle(1, GOLD, 0.12).strokeCircle(TABLE_CX, PILE_Y, 176);
    g.lineStyle(1, 0xffffff, 0.04).strokeCircle(TABLE_CX, PILE_Y, 232);
  }

  section(x, y, w, h, title) {
    const g = this.add.graphics();
    g.fillStyle(0x07150f, 0.55).fillRoundedRect(x, y, w, h, 12);
    g.lineStyle(1.5, 0x2e5242, 1).strokeRoundedRect(x, y, w, h, 12);
    if (title) this.add.text(x + w / 2, y + 12, title, { fontFamily: UI.FONT, fontSize: '11px', fontStyle: 'bold', color: '#8fb09e' }).setOrigin(0.5).setLetterSpacing(2);
    return g;
  }

  buildStaticUI() {
    const { FONT } = UI;

    // ---------- side panel ----------
    const p = this.add.graphics();
    p.fillStyle(0x000000, 0.38).fillRoundedRect(710, 14, 176, 672, 16);
    p.lineStyle(2, GOLD, 0.6).strokeRoundedRect(710, 14, 176, 672, 16);
    this.add.text(798, 40, 'CARDI', { fontFamily: FONT, fontSize: '30px', fontStyle: '900', color: '#e8b923', stroke: '#5a4300', strokeThickness: 4 }).setOrigin(0.5);
    this.add.text(798, 62, 'NIKO CARDI', { fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: '#8fb09e' }).setOrigin(0.5).setLetterSpacing(3);

    // direction: a rotating arrow ring
    this.section(722, 78, 152, 100, 'DIRECTION');
    this.dirIcon = this.add.container(798, 122);
    const ring = this.add.graphics();
    ring.lineStyle(4, GOLD, 1);
    const arc = (a0, a1) => {
      ring.beginPath(); ring.arc(0, 0, 18, a0, a1, false); ring.strokePath();
      const px = 18 * Math.cos(a1), py = 18 * Math.sin(a1), tx = -Math.sin(a1), ty = Math.cos(a1);
      ring.fillStyle(GOLD, 1).fillTriangle(px + tx * 9, py + ty * 9, px - ty * 6 - tx * 1, py + tx * 6 - ty * 1, px + ty * 6 - tx * 1, py - tx * 6 - ty * 1);
    };
    arc(0.35, 2.55); arc(Math.PI + 0.35, Math.PI + 2.55);
    this.dirIcon.add(ring);
    this.dirText = this.add.text(798, 158, '', { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#f3ead2', align: 'center' }).setOrigin(0.5);

    // punishment
    this.punBox = this.add.graphics();
    this.drawPunBox(false);
    this.add.text(798, 202, 'PUNISHMENT', { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: '#8fb09e' }).setOrigin(0.5).setLetterSpacing(2);
    this.punText = this.add.text(798, 245, '0', { fontFamily: FONT, fontSize: '52px', fontStyle: '900', color: '#4d6b5d' }).setOrigin(0.5);
    this.punSub = this.add.text(798, 278, 'all clear', { fontFamily: FONT, fontSize: '11px', color: '#6f8f7d' }).setOrigin(0.5);

    // log
    this.section(722, 300, 152, 316, 'TABLE LOG');
    this.logLines = [];

    // menu + mute
    UI.makeButton(this, 826, 652, 'Menu', () => this.scene.start('MainMenuScene'), { width: 96, height: 36, fontSize: '16px', fill: 0x24543f, hoverFill: 0x2f6b51, color: '#f3ead2', border: GOLD });
    this.buildMuteButton(740, 652);

    // ---------- piles ----------
    this.drawPileC = this.add.container(DRAW_X, PILE_Y).setDepth(2);
    this.discardC = this.add.container(DISCARD_X, PILE_Y).setDepth(2);
    this.deckChip = this.add.graphics().setDepth(2);
    this.deckChipText = this.add.text(DRAW_X, PILE_Y + 84, '', { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#cfe3d8' }).setOrigin(0.5).setDepth(3);

    this.glow = this.add.graphics().setDepth(1);
    this.tweens.add({ targets: this.glow, alpha: 0.45, duration: 900, yoyo: true, repeat: -1 });
    this.suitPill = this.add.graphics().setDepth(2);
    this.suitText = this.add.text(DISCARD_X, PILE_Y + 90, '', { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#f3ead2' }).setOrigin(0.5).setDepth(3);

    this.drawGlow = this.add.graphics().setDepth(1);
    this.drawGlow.lineStyle(4, GOLD, 1).strokeRoundedRect(DRAW_X - 50, PILE_Y - 68, 100, 136, 14);
    this.drawGlow.setVisible(false);
    this.tweens.add({ targets: this.drawGlow, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });

    this.drawZone = this.add.zone(DRAW_X, PILE_Y, 96, 130).setInteractive({ useHandCursor: true }).setDepth(3);
    this.drawZone.on('pointerdown', () => { if (this.canHumanDraw()) this.perform({ type: 'draw' }); });
    this.drawZone.on('pointerover', () => { if (this.canHumanDraw()) this.tweens.add({ targets: this.drawPileC, scale: 1.06, y: PILE_Y - 4, duration: 120 }); });
    this.drawZone.on('pointerout', () => this.tweens.add({ targets: this.drawPileC, scale: 1, y: PILE_Y, duration: 120 }));

    // pulsing ring on the discard pile while a selection is waiting to be played
    this.dropHot = this.add.graphics().setDepth(1).setAlpha(0);
    this.dropHot.lineStyle(4, 0xffffff, 0.95).strokeRoundedRect(DISCARD_X - 66, PILE_Y - 84, 132, 168, 18);

    this.playZone = this.add.zone(DISCARD_X, PILE_Y, 160, 200).setInteractive({ useHandCursor: true }).setDepth(3);
    this.playZone.on('pointerdown', () => { if (this.selectedCards.length > 0) this.dropBatch(); });

    // ---------- bot name plate (top-left) ----------
    this.buildBotPlate();

    // ---------- turn pill ----------
    this.turnPill = this.add.graphics().setDepth(4);
    this.turnText = this.add.text(TABLE_CX, 196, '', { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#e8b923' }).setOrigin(0, 0.5).setDepth(5);

    this.hintText = this.add.text(TABLE_CX, 466, '', {
      fontFamily: FONT, fontSize: '16px', color: '#cfe3d8', align: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: { x: 12, y: 6 }, wordWrap: { width: 330 },
    }).setOrigin(0.5).setAlpha(0).setDepth(55);

    this.passBtn = UI.makeButton(this, 590, 470, 'Pass', () => {
      if (this.isHumanTurn() && !this.busy && this.state.drawnCardId) this.perform({ type: 'pass' });
    }, { width: 110, height: 40, fontSize: '18px' }).setVisible(false).setDepth(60);

    this.buildNikoButton();
  }

  buildMuteButton(x, y) {
    const c = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(0x24543f, 1).fillCircle(0, 0, 18).lineStyle(2, GOLD, 1).strokeCircle(0, 0, 18);
    this.muteIcon = this.add.graphics();
    c.add([bg, this.muteIcon]).setSize(36, 36).setInteractive({ useHandCursor: true });
    const draw = () => {
      const g = this.muteIcon; g.clear();
      g.fillStyle(0xf3ead2, 1).fillPoints([{ x: -9, y: -4 }, { x: -4, y: -4 }, { x: 2, y: -9 }, { x: 2, y: 9 }, { x: -4, y: 4 }, { x: -9, y: 4 }], true);
      g.lineStyle(2, 0xf3ead2, 1);
      if (this.sound.mute) { g.lineBetween(6, -5, 13, 5); g.lineBetween(13, -5, 6, 5); }
      else { g.beginPath(); g.arc(2, 0, 6, -0.9, 0.9); g.strokePath(); g.beginPath(); g.arc(2, 0, 10, -0.9, 0.9); g.strokePath(); }
    };
    draw();
    c.on('pointerdown', () => {
      this.sound.mute = !this.sound.mute;
      try { localStorage.setItem('cardi_mute', this.sound.mute ? '1' : '0'); } catch (e) { /* ignore */ }
      draw();
      this.tweens.add({ targets: c, scale: { from: 0.85, to: 1 }, duration: 160, ease: 'Back.out' });
    });
  }

  buildBotPlate() {
    const { FONT } = UI;
    const c = this.add.container(20, 18).setDepth(6);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.42).fillRoundedRect(0, 0, 172, 58, 14);
    this.botPlateBorder = this.add.graphics();
    this.botAvatar = this.add.circle(31, 29, 20, 0x24543f).setStrokeStyle(3, 0x4d6b5d);
    const initial = this.add.text(31, 29, (this.options.botName || 'C').charAt(0).toUpperCase(), { fontFamily: FONT, fontSize: '22px', fontStyle: '900', color: '#f3ead2' }).setOrigin(0.5);
    this.botName = this.add.text(60, 13, this.options.botName, { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#f3ead2' });
    this.botCount = this.add.text(60, 35, '', { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#9fbfae' });
    this.botNikoChip = this.add.container(138, 43).setVisible(false);
    const chipBg = this.add.graphics();
    chipBg.fillStyle(GOLD, 1).fillRoundedRect(-27, -9, 54, 18, 9);
    const chipTx = this.add.text(0, 0, 'NIKO!', { fontFamily: FONT, fontSize: '11px', fontStyle: '900', color: '#2a1d00' }).setOrigin(0.5);
    this.botNikoChip.add([chipBg, chipTx]);
    c.add([bg, this.botPlateBorder, this.botAvatar, initial, this.botName, this.botCount, this.botNikoChip]);
    this.botPlate = c;
  }

  // ==========================================
  // PREMIUM NIKO CARDI BUTTON
  // ==========================================
  buildNikoButton() {
    const { FONT } = UI;
    this.nikoContainer = this.add.container(TABLE_CX, 470).setDepth(60).setVisible(false);

    this.nikoShadow = this.add.graphics();
    this.nikoShadow.fillStyle(0x000000, 0.6);
    this.nikoShadow.fillRoundedRect(-115, -38, 230, 76, 38);

    this.nikoBg = this.add.graphics();
    this.nikoBg.fillStyle(0x1a3a2e, 1);
    this.nikoBg.fillRoundedRect(-110, -35, 220, 70, 35);
    this.nikoBg.lineStyle(4, GOLD, 1);
    this.nikoBg.strokeRoundedRect(-110, -35, 220, 70, 35);

    this.nikoHighlight = this.add.graphics();
    this.nikoHighlight.fillStyle(0xffffff, 0.1);
    this.nikoHighlight.fillRoundedRect(-105, -30, 210, 30, { tl: 30, tr: 30, bl: 0, br: 0 });

    this.nikoTail = this.add.graphics();
    this.nikoTail.fillStyle(GOLD, 1);
    this.nikoTail.lineStyle(4, GOLD, 1);
    this.nikoTail.beginPath();
    this.nikoTail.moveTo(-15, 35);
    this.nikoTail.lineTo(0, 50);
    this.nikoTail.lineTo(15, 35);
    this.nikoTail.strokePath();
    this.nikoTail.fillPath();

    this.nikoText = this.add.text(0, 0, 'NIKO CARDI!', { fontFamily: FONT, fontSize: '28px', fontStyle: '900', color: '#e8b923' }).setOrigin(0.5);
    this.nikoTimerFill = this.add.graphics();

    this.nikoContainer.add([this.nikoShadow, this.nikoBg, this.nikoHighlight, this.nikoTail, this.nikoTimerFill, this.nikoText]);
    this.nikoContainer.setSize(220, 70).setInteractive({ useHandCursor: true });
    this.nikoContainer.on('pointerdown', () => this.declareNiko());

    this.tweens.add({ targets: this.nikoContainer, scale: 1.05, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  startNikoTimer() {
    this.nikoTimerFill.clear();
    this.nikoTimerTween = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 5000,
      onUpdate: (tween) => {
        const remaining = 1 - tween.getValue();
        this.nikoTimerFill.clear();
        if (remaining > 0) {
          let color = 0x28a745;
          if (remaining < 0.3) color = 0xd62828;
          else if (remaining < 0.6) color = 0xf77f00;
          this.nikoTimerFill.fillStyle(color, 0.8);
          this.nikoTimerFill.fillRoundedRect(-110, -35, 220 * remaining, 70, 35);
        }
      },
      onComplete: () => {
        this.nikoContainer.setVisible(false);
        this.nikoWindow = null;
        this.beginTurn(); // Foul penalty triggers here
      },
    });
  }

  drawPunBox(active) {
    const g = this.punBox;
    g.clear();
    g.fillStyle(active ? 0x2a0a0a : 0x07150f, active ? 0.8 : 0.55).fillRoundedRect(722, 190, 152, 100, 12);
    g.lineStyle(active ? 2.5 : 1.5, active ? 0xff3b3b : 0x2e5242, 1).strokeRoundedRect(722, 190, 152, 100, 12);
  }

  /* ------------------------------------------------------------------ */
  /* card sprites                                                        */
  /* ------------------------------------------------------------------ */
  makeCard(key, x, y, scale = 1) {
    const { CW, CH, FONT } = UI;
    const c = this.add.container(x, y);
    const shadow = this.add.image(5, 8, 'cardi_shadow').setDisplaySize(CW, CH);
    const glow = this.add.image(0, 0, 'cardi_glow').setAlpha(0);
    const face = this.add.image(0, 0, key).setDisplaySize(CW, CH);
    const badge = this.add.container(0, -CH / 2 - 16).setVisible(false);
    const bbg = this.add.circle(0, 0, 11, GOLD).setStrokeStyle(2, 0x7a5c00);
    const btx = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '14px', color: '#1a1a1a', fontStyle: '900' }).setOrigin(0.5);
    badge.add([bbg, btx]);
    const inner = this.add.container(0, 0, [shadow, glow, face, badge]);
    c.add(inner);
    c.inner = inner; c.face = face; c.glow = glow; c.badge = badge; c.bbg = bbg; c.btx = btx;
    c.glowMode = 0;
    c.setSize(CW, CH).setScale(scale);
    return c;
  }

  async flip(sp, key, dur = 110) {
    const { sy, sx } = this.cardScale(key);
    await this.tweenP({ targets: sp.face, scaleX: 0, duration: dur, ease: 'Sine.in' });
    if (!this.alive() || !sp.scene) return;
    sp.face.setTexture(key).setScale(0, sy);
    await this.tweenP({ targets: sp.face, scaleX: sx, duration: dur, ease: 'Sine.out' });
  }

  /** Fly a card sprite somewhere (optional arc, flip, and a callback at take-off). */
  flyCard(sp, o) {
    sp.flying = true;
    this.tweens.killTweensOf(sp);
    this.tweens.killTweensOf(sp.inner);
    sp.y += sp.inner.y; sp.inner.y = 0; sp.inner.setScale(1);
    sp.glow.setAlpha(0); sp.glowMode = 0; sp.badge.setVisible(false);
    sp.setDepth(o.depth ?? Z.fly);
    const dur = o.dur ?? 340, delay = o.delay ?? 0;
    if (o.onStart) this.time.delayedCall(delay, o.onStart);
    const jobs = [this.tweenP({
      targets: sp, x: o.x, y: o.y, angle: o.angle ?? 0,
      scaleX: o.scale ?? sp.scaleX, scaleY: o.scale ?? sp.scaleY,
      delay, duration: dur, ease: o.ease || 'Cubic.out',
    })];
    if (o.arc) jobs.push(this.tweenP({ targets: sp.inner, y: -o.arc, delay, duration: dur / 2, yoyo: true, ease: 'Sine.out' }));
    if (o.flipKey) jobs.push(this.wait(delay + dur * 0.22).then(() => (this.alive() && sp.scene ? this.flip(sp, o.flipKey, dur * 0.2) : null)));
    return Promise.all(jobs).then(() => { sp.flying = false; });
  }

  settle(sp) {
    if (!sp.scene) return;
    this.tweens.add({ targets: sp.inner, scaleX: { from: 1.1, to: 1 }, scaleY: { from: 1.1, to: 1 }, duration: 200, ease: 'Back.out' });
  }

  /* ---- human hand ---- */
  handSlot(i, n) {
    const spacing = Math.min(UI.CW * 0.82, 560 / Math.max(n, 1));
    const off = i - (n - 1) / 2;
    return {
      x: TABLE_CX + off * spacing,
      y: HAND_Y + Math.abs(off) * Math.min(4, 28 / n),
      angle: off * Math.min(4, 22 / n),
      depth: Z.hand + i,
    };
  }

  spawnHandCard(card, x, y, key) {
    const { CW, CH } = UI;
    const sp = this.makeCard(key || card.id, x, y);
    sp.card = card;
    sp.setInteractive(new Phaser.Geom.Rectangle(0, -56, CW, CH + 56), Phaser.Geom.Rectangle.Contains);
    sp.input.cursor = 'pointer';
    sp.on('pointerover', () => { sp.hover = true; if (!sp.flying) this.applyLift(sp); });
    sp.on('pointerout', () => { sp.hover = false; if (!sp.flying) this.applyLift(sp); });
    sp.on('pointerup', () => { if (!sp.flying) this.onCardTap(sp); });
    this.handSprites.set(card.id, sp);
    return sp;
  }

  layoutHand(dur = 280, ease = 'Cubic.out') {
    const n = this.vw.human.length;
    this.vw.human.forEach((card, i) => {
      const sp = this.handSprites.get(card.id);
      if (!sp) return;
      const t = this.handSlot(i, n);
      sp.slot = t;
      if (sp.flying) return;
      this.tweens.killTweensOf(sp);
      sp.setDepth(this.depthOf(sp));
      this.tweens.add({ targets: sp, x: t.x, y: t.y, angle: t.angle, duration: dur, ease });
    });
  }

  isSelected(card) { return this.selectedCards.some((sc) => sc.id === card.id); }

  depthOf(sp) {
    if (sp.hover) return Z.hover;
    const base = sp.slot ? sp.slot.depth : Z.hand;
    return this.isSelected(sp.card) ? Z.selected + base : base;
  }

  applyLift(sp, dur = 130) {
    const drawn = this.state.drawnCardId === sp.card.id && this.isHumanTurn();
    const hov = sp.hover && sp.playable;
    const lift = (this.isSelected(sp.card) || drawn ? -26 : 0) + (hov ? -14 : 0);
    const sc = hov ? 1.07 : 1;
    this.tweens.killTweensOf(sp.inner);
    this.tweens.add({ targets: sp.inner, y: lift, scaleX: sc, scaleY: sc, duration: dur, ease: 'Quad.out' });
    sp.setDepth(this.depthOf(sp));
  }

  /** Tint, glow, badge and lift for every card in the hand. */
  refreshHand() {
    const s = this.state;
    const humanTurn = this.isHumanTurn() && !this.busy;
    const legal = this.humanLegalIds();
    const opener = this.selectedCards[0] || null;

    this.vw.human.forEach((card) => {
      const sp = this.handSprites.get(card.id);
      if (!sp || sp.flying) return;
      const selIdx = this.selectedCards.findIndex((sc) => sc.id === card.id);
      const isSel = selIdx >= 0;
      const isDrawn = s.drawnCardId === card.id && humanTurn;

      let playable = true;
      if (humanTurn) playable = opener ? (isSel || card.rank === opener.rank) : legal.has(card.id);
      sp.playable = playable;

      if (humanTurn && !playable) { sp.face.setTint(0x777777); sp.inner.setAlpha(0.78); }
      else { sp.face.clearTint(); sp.inner.setAlpha(1); }

      sp.glowMode = isSel || isDrawn ? 2 : (humanTurn && playable && !opener ? 1 : 0);
      if (!sp.glowMode && sp.prevGlow) sp.glow.setAlpha(0);
      sp.prevGlow = sp.glowMode;

      // order badge sits ABOVE the card, never over its rank/suit
      if (isSel) { sp.badge.setVisible(true); sp.btx.setText(String(selIdx + 1)); sp.bbg.setFillStyle(GOLD); }
      else if (opener && playable) { sp.badge.setVisible(true); sp.btx.setText('+'); sp.bbg.setFillStyle(0xcfe3d8); }
      else sp.badge.setVisible(false);

      this.applyLift(sp);
    });
  }

  /* ---- bot hand ---- */
  botSlot(i, n) {
    const spacing = Math.min(44, 440 / Math.max(n, 1));
    const off = i - (n - 1) / 2;
    return { x: TABLE_CX + off * spacing, y: BOT_Y + Math.abs(off) * 2, angle: -off * Math.min(3, 24 / n), depth: 5 + i };
  }

  makeBotCard(x, y) { return this.makeCard('card_back', x, y, 0.8); }

  layoutBot(dur = 280) {
    const n = this.botSprites.length;
    this.botSprites.forEach((sp, i) => {
      const t = this.botSlot(i, n);
      sp.slot = t;
      if (sp.flying) return;
      this.tweens.killTweensOf(sp);
      sp.setDepth(t.depth);
      this.tweens.add({ targets: sp, x: t.x, y: t.y, angle: t.angle, duration: dur, ease: 'Cubic.out' });
    });
  }

  /** Cards gently bob while the bot "thinks". */
  setBotIdle(on) {
    if (on === this.botIdleOn) return;
    this.botIdleOn = on;
    this.botSprites.forEach((sp, i) => {
      if (sp.flying) return;
      this.tweens.killTweensOf(sp.inner);
      if (on) this.tweens.add({ targets: sp.inner, y: { from: 0, to: -5 }, duration: 520, delay: i * 70, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      else this.tweens.add({ targets: sp.inner, y: 0, duration: 150 });
    });
  }

  /* ---- piles ---- */
  updateDrawPile() {
    const { CW, CH } = UI;
    this.drawPileC.removeAll(true);
    const dc = this.vw.drawCount;
    for (let i = Math.min(3, dc) - 1; i >= 0; i--) this.drawPileC.add(this.add.image(-i * 2, -i * 2, 'card_back').setDisplaySize(CW, CH));
    if (dc <= 0) this.drawPileC.add(this.add.rectangle(0, 0, CW, CH).setStrokeStyle(2, 0x9fbfae, 0.5));
    this.deckChipText.setText(dc > 0 ? String(dc) : '0');
    const w = Math.max(34, this.deckChipText.width + 18);
    this.deckChip.clear().fillStyle(0x000000, 0.45).fillRoundedRect(DRAW_X - w / 2, PILE_Y + 74, w, 20, 10).lineStyle(1.5, 0x2e5242, 1).strokeRoundedRect(DRAW_X - w / 2, PILE_Y + 74, w, 20, 10);
  }

  updateDiscard() {
    const { CW, CH } = UI;
    this.discardC.removeAll(true);
    const pile = this.vw.discard.slice(-3);
    pile.forEach((c, i) => {
      const x = (i - pile.length + 1) * 3;
      const sh = this.add.image(x + 4, 6, 'cardi_shadow').setDisplaySize(CW, CH).setAngle(this.angleFor(c.id));
      const img = this.add.image(x, 0, c.id).setDisplaySize(CW, CH).setAngle(this.angleFor(c.id));
      this.discardC.add([sh, img]);
    });
  }

  updateSuitUI(suit, pulse = true) {
    const css = this.suitColorCss(suit);
    const col = UI.hex(Rules.SUIT_COLORS[suit] === '#1d1d1d' ? '#cfcfcf' : Rules.SUIT_COLORS[suit]);
    this.glow.clear();
    this.glow.lineStyle(6, col, 1).strokeRoundedRect(DISCARD_X - 56, PILE_Y - 74, 112, 148, 16);
    this.glow.lineStyle(14, col, 0.25).strokeRoundedRect(DISCARD_X - 60, PILE_Y - 78, 120, 156, 18);
    this.suitText.setText(`${Rules.SUIT_SYMBOLS[suit]}  ${this.suitName(suit)}`).setColor(css);
    const w = this.suitText.width + 22;
    this.suitPill.clear().fillStyle(0x000000, 0.5).fillRoundedRect(DISCARD_X - w / 2, PILE_Y + 78, w, 24, 12).lineStyle(2, col, 1).strokeRoundedRect(DISCARD_X - w / 2, PILE_Y + 78, w, 24, 12);
    if (pulse && this.vw.suitShown && this.vw.suitShown !== suit) {
      this.tweens.add({ targets: this.suitText, scale: { from: 1.45, to: 1 }, duration: 300, ease: 'Back.out' });
      this.burstRing(DISCARD_X, PILE_Y, col);
    }
    this.vw.suitShown = suit;
  }

  /* ------------------------------------------------------------------ */
  /* effects                                                             */
  /* ------------------------------------------------------------------ */
  burstRing(x, y, color = 0xffffff) {
    const r = this.add.circle(x, y, 20).setStrokeStyle(5, color, 0.9).setDepth(Z.fx);
    this.tweens.add({ targets: r, scale: 4.5, alpha: 0, duration: 520, ease: 'Cubic.out', onComplete: () => r.destroy() });
  }

  /** Big pop-up text over the table (KICKBACK!, FOUL +3, ×2, suit, NO ANSWER...). */
  announce(text, color = '#e8b923', size = 44) {
    const t = this.add.text(DISCARD_X, 268, text, {
      fontFamily: UI.FONT, fontSize: `${size}px`, fontStyle: '900', color, stroke: '#000000', strokeThickness: 7,
    }).setOrigin(0.5).setDepth(Z.fx).setScale(0.3).setAlpha(0);
    this.tweens.add({
      targets: t, scale: 1, alpha: 1, duration: 230, ease: 'Back.out',
      onComplete: () => this.tweens.add({ targets: t, y: 215, alpha: 0, delay: 520, duration: 420, ease: 'Quad.in', onComplete: () => t.destroy() }),
    });
    return this.wait(260);
  }

  floatLabel(text, x, y, color = '#ffffff') {
    const t = this.add.text(x, y, text, { fontFamily: UI.FONT, fontSize: '24px', fontStyle: '900', color, stroke: '#000', strokeThickness: 5 })
      .setOrigin(0.5).setDepth(Z.fx).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: y - 18, duration: 180 });
    this.tweens.add({ targets: t, alpha: 0, y: y - 60, delay: 700, duration: 450, onComplete: () => t.destroy() });
  }

  shakeSprites(list, amp = 7) {
    const targets = list.filter((s) => s && s.inner).map((s) => s.inner);
    if (!targets.length) return Promise.resolve();
    return this.tweenP({ targets, x: amp, duration: 45, yoyo: true, repeat: 4 }).then(() => targets.forEach((t) => { if (t.scene) t.x = 0; }));
  }

  flash(color = 0xff2a2a, alpha = 0.25) {
    const r = this.add.rectangle(UI.W / 2, UI.H / 2, UI.W, UI.H, color, alpha).setDepth(Z.fx - 1);
    this.tweens.add({ targets: r, alpha: 0, duration: 380, onComplete: () => r.destroy() });
  }

  confetti() {
    const cols = [GOLD, 0xd62828, 0x2fa36b, 0xffffff, 0x4da3ff];
    for (let i = 0; i < 46; i++) {
      const r = this.add.rectangle(Phaser.Math.Between(80, 640), -20, 8, 13, Phaser.Math.RND.pick(cols)).setDepth(Z.fx + 20).setAngle(Phaser.Math.Between(0, 180));
      this.tweens.add({
        targets: r, y: Phaser.Math.Between(420, 720), x: r.x + Phaser.Math.Between(-80, 80), angle: r.angle + Phaser.Math.Between(180, 540),
        alpha: { from: 1, to: 0.2 }, delay: Phaser.Math.Between(0, 450), duration: Phaser.Math.Between(900, 1500), ease: 'Quad.in', onComplete: () => r.destroy(),
      });
    }
  }

  setDropHint(on) {
    if (on === this.dropHintOn) return;
    this.dropHintOn = on;
    if (this.dropTween) { this.dropTween.stop(); this.dropTween = null; }
    if (on) { this.dropHot.setAlpha(0.2); this.dropTween = this.tweens.add({ targets: this.dropHot, alpha: 0.95, duration: 520, yoyo: true, repeat: -1 }); }
    else this.tweens.add({ targets: this.dropHot, alpha: 0, duration: 150 });
  }

  /* ------------------------------------------------------------------ */
  /* HUD                                                                 */
  /* ------------------------------------------------------------------ */
  setTurnText(base, thinking, human) {
    this.thinkBase = base;
    if (thinking) {
      if (!this.thinkEv) {
        this.dots = 0;
        this.thinkEv = this.time.addEvent({ delay: 380, loop: true, callback: () => { this.dots = (this.dots + 1) % 4; this.turnText.setText(this.thinkBase + '.'.repeat(this.dots)); } });
      }
    } else if (this.thinkEv) { this.thinkEv.remove(false); this.thinkEv = null; }

    this.turnText.setText(base + (thinking ? '...' : ''));
    const tw = this.turnText.width;
    this.turnText.setText(base);
    const w = tw + 36, x = TABLE_CX - w / 2;
    this.turnText.setPosition(x + 18, 196).setColor(human ? '#ffe08a' : '#e8b923');
    this.turnPill.clear();
    this.turnPill.fillStyle(human ? 0x3a2d00 : 0x000000, human ? 0.75 : 0.45).fillRoundedRect(x, 178, w, 36, 18);
    this.turnPill.lineStyle(2, human ? GOLD : 0x2e5242, 1).strokeRoundedRect(x, 178, w, 36, 18);
    if (base !== this.lastTurnBase) {
      this.lastTurnBase = base;
      [this.turnText, this.turnPill].forEach((o) => { o.setAlpha(0.2); this.tweens.add({ targets: o, alpha: 1, duration: 260 }); });
    }
  }

  updateBotLabel() {
    const s = this.state, bn = this.botSprites.length;
    const botTurn = s.currentPlayerIndex === this.botIndex && s.winnerIndex == null && !this.dealing;
    this.botCount.setText(`${bn} card${bn === 1 ? '' : 's'}`);
    this.botName.setColor(botTurn ? '#ffe08a' : '#f3ead2');
    this.botAvatar.setStrokeStyle(3, botTurn ? GOLD : 0x4d6b5d);
    this.botPlateBorder.clear().lineStyle(2, botTurn ? GOLD : 0x2e5242, 1).strokeRoundedRect(0, 0, 172, 58, 14);
    const nikoOn = !!s.declaredNikoCardi[this.botIndex] && bn === 1;
    if (nikoOn && !this.botNikoShown) {
      this.botNikoChip.setVisible(true).setScale(0.4);
      this.tweens.add({ targets: this.botNikoChip, scale: 1, duration: 260, ease: 'Back.out' });
    } else if (!nikoOn) this.botNikoChip.setVisible(false);
    this.botNikoShown = nikoOn;
  }

  setLog(lines) {
    this.logLines.forEach((t) => t.destroy());
    this.logLines = [];
    const shown = lines.slice(-6);
    const alphas = [0.32, 0.42, 0.55, 0.7, 0.85, 1];
    const objs = shown.map((txt, i) => this.add.text(732, 0, txt, { fontFamily: UI.FONT, fontSize: '12.5px', color: '#f3ead2', wordWrap: { width: 134 }, lineSpacing: 2 })
      .setAlpha(alphas[alphas.length - shown.length + i]));
    let total = objs.reduce((a, t) => a + t.height + 8, 0);
    while (total > 262 && objs.length > 1) { const t = objs.shift(); total -= t.height + 8; t.destroy(); }
    let y = 322;
    objs.forEach((t) => { t.setY(y); y += t.height + 8; });
    this.logLines = objs;
    const newest = objs[objs.length - 1];
    if (newest) { newest.setX(742); this.tweens.add({ targets: newest, x: 732, duration: 260, ease: 'Quad.out' }); }
  }

  updateHud() {
    const s = this.state;
    const bot = s.players[this.botIndex];
    const humanTurn = this.isHumanTurn() && !this.busy;
    const botTurn = s.winnerIndex == null && s.currentPlayerIndex === this.botIndex && !this.dealing;
    this.updateBotLabel();

    if (this.dealing) this.setTurnText('Dealing', false, false);
    else if (s.winnerIndex != null) this.setTurnText(`${s.players[s.winnerIndex].name} win${s.winnerIndex === 0 ? '' : 's'}!`, false, s.winnerIndex === 0);
    else if (s.currentPlayerIndex === this.humanIndex) this.setTurnText('Your turn', false, true);
    else this.setTurnText(`${bot.name} is thinking`, true, false);

    if (humanTurn && !this.turnPulse) this.turnPulse = this.tweens.add({ targets: this.turnText, alpha: 0.6, duration: 700, yoyo: true, repeat: -1 });
    else if (!humanTurn && this.turnPulse) { this.turnPulse.stop(); this.turnPulse = null; this.turnText.setAlpha(1); }

    this.setBotIdle(botTurn && !this.busy);

    // punishment
    const pun = s.pendingPunishment;
    this.punText.setText(String(pun)).setColor(pun > 0 ? '#ff3b3b' : '#4d6b5d');
    this.punSub.setText(pun > 0 ? 'cards pending!' : 'all clear').setColor(pun > 0 ? '#ff9b9b' : '#6f8f7d');
    this.drawPunBox(pun > 0);
    if (pun !== this.lastPun) {
      this.tweens.add({ targets: this.punText, scale: { from: pun > this.lastPun ? 1.7 : 1.3, to: 1 }, duration: 320, ease: 'Back.out' });
      this.lastPun = pun;
    }

    // direction
    this.dirText.setText(s.direction === 1 ? 'Clockwise' : 'Counter-clockwise');
    if (s.direction !== this.lastDirection) {
      this.tweens.add({ targets: this.dirIcon, scaleX: s.direction === 1 ? 1 : -1, duration: 360, ease: 'Back.out' });
      this.tweens.add({ targets: this.dirText, scale: { from: 1.3, to: 1 }, duration: 300, ease: 'Back.out' });
    }
    this.lastDirection = s.direction;

    if (s.log.length !== this.lastLogLen) { this.setLog(s.log); this.lastLogLen = s.log.length; }

    this.drawGlow.setVisible(this.canHumanDraw());
    this.setDropHint(humanTurn && this.selectedCards.length > 0);

    // hint text (shown after a short delay by triggerHint)
    const legal = this.humanLegalIds();
    let hint = '';
    if (humanTurn) {
      if (s.drawnCardId) hint = 'You drew a playable card — play it or pass';
      else if (s.pendingPunishment > 0) hint = legal.size ? `Stack a 3, play an Ace, or tap the deck to take ${s.pendingPunishment}` : `Tap the deck to take ${s.pendingPunishment} cards`;
      else if (!legal.size) hint = 'No moves — tap the deck to draw';
      else if (this.selectedCards.length > 0) hint = `Tap the Discard Pile to play ${this.selectedCards.length} card${this.selectedCards.length > 1 ? 's' : ''}`;
      else hint = 'Tap a card to play, or tap the deck to draw';
    }
    const nikoVisible = !this.dealing && !this.busy && Rules.canDeclareNiko(s, this.humanIndex);
    this.hintText.setText(nikoVisible ? '' : hint);
    this.passBtn.setVisible(humanTurn && !!s.drawnCardId);

    if (nikoVisible && !this.nikoContainer.visible) {
      this.nikoContainer.setVisible(true).setAlpha(0);
      this.tweens.add({ targets: this.nikoContainer, alpha: 1, duration: 160 });
      this.startNikoTimer();
    } else if (!nikoVisible) {
      this.nikoContainer.setVisible(false);
      if (this.nikoTimerTween) this.nikoTimerTween.remove();
    }
  }

  /** Bring the on-screen view fully in line with the real state (cheap when already in sync). */
  render() {
    const s = this.state;
    const hand = s.players[this.humanIndex].hand;
    const ids = new Set(hand.map((c) => c.id));
    for (const [id, sp] of [...this.handSprites]) {
      if (!ids.has(id)) { this.tweens.killTweensOf(sp); this.tweens.killTweensOf(sp.inner); sp.destroy(); this.handSprites.delete(id); }
    }
    hand.forEach((c) => {
      if (!this.handSprites.has(c.id)) { const sp = this.spawnHandCard(c, TABLE_CX, HAND_Y + 40); sp.setScale(0.9); }
    });
    this.vw.human = hand.slice();
    this.selectedCards = this.selectedCards.filter((sc) => ids.has(sc.id));
    this.layoutHand();

    const bn = s.players[this.botIndex].hand.length;
    while (this.botSprites.length > bn) { const sp = this.botSprites.pop(); this.tweens.killTweensOf(sp); this.tweens.killTweensOf(sp.inner); sp.destroy(); }
    while (this.botSprites.length < bn) this.botSprites.push(this.makeBotCard(TABLE_CX, BOT_Y));
    this.layoutBot();
    this.botIdleOn = false;

    this.vw.discard = s.discardPile.slice(-3);
    this.vw.discardCount = s.discardPile.length;
    this.vw.drawCount = s.drawPile.length;
    this.vw.suit = s.currentSuit;
    this.updateDiscard();
    this.updateDrawPile();
    this.updateSuitUI(s.currentSuit);
    this.updateHud();
    this.refreshHand();
    this.triggerHint();
  }

  /** Lightweight refresh after a selection change. */
  refreshSel() {
    this.refreshHand();
    this.updateHud();
    this.triggerHint();
  }

  /* ------------------------------------------------------------------ */
  /* start of game                                                       */
  /* ------------------------------------------------------------------ */
  async startDealSequence() {
    const st = this.state;
    this.busy = true; this.dealing = true;
    this.vw.drawCount = st.drawPile.length + 9;
    this.updateDrawPile();
    this.updateSuitUI(st.currentSuit, false);
    this.suitText.setText(''); this.suitPill.clear();
    this.updateHud();
    this.sfx('sfx_rg');

    // a little shuffle shimmy of the deck before dealing
    await this.tweenP({ targets: this.drawPileC, angle: { from: -4, to: 4 }, duration: 70, yoyo: true, repeat: 3 });
    this.drawPileC.setAngle(0);
    if (!this.alive()) return;

    const hHand = st.players[this.humanIndex].hand;
    const bHand = st.players[this.botIndex].hand;
    const humanSprites = hHand.map((c) => { this.vw.human.push(c); const sp = this.spawnHandCard(c, DRAW_X, PILE_Y, 'card_back'); sp.flying = true; sp.setDepth(Z.fly); return sp; });
    const botSprites = bHand.map(() => { const sp = this.makeBotCard(DRAW_X, PILE_Y); sp.flying = true; sp.setDepth(Z.fly); this.botSprites.push(sp); return sp; });
    this.layoutHand(); this.layoutBot();

    const jobs = [];
    const dealOne = (sp, k, human, card) => {
      const delay = k * 125;
      jobs.push(this.wait(delay).then(() => { this.vw.drawCount--; this.updateDrawPile(); }));
      jobs.push(this.flyCard(sp, {
        x: sp.slot.x, y: sp.slot.y, angle: sp.slot.angle, scale: human ? 1 : 0.8, delay, dur: 330, arc: 18,
        flipKey: human ? card.id : null, depth: Z.fly + k,
      }).then(() => { sp.setDepth(sp.slot.depth); this.settle(sp); }));
    };
    for (let r = 0; r < 4; r++) { dealOne(humanSprites[r], r * 2, true, hHand[r]); dealOne(botSprites[r], r * 2 + 1, false); }
    await Promise.all(jobs);
    if (!this.alive()) return;

    // flip the opening card onto the table
    await this.wait(120);
    const open = st.discardPile[st.discardPile.length - 1];
    const sp = this.makeCard('card_back', DRAW_X, PILE_Y).setDepth(Z.fly);
    this.vw.drawCount--; this.updateDrawPile();
    await this.flyCard(sp, { x: DISCARD_X, y: PILE_Y, angle: this.angleFor(open.id), dur: 420, arc: 26, flipKey: open.id });
    if (!this.alive()) return;
    this.vw.discard = [open]; this.vw.discardCount = 1;
    this.updateDiscard(); sp.destroy();
    this.updateSuitUI(open.suit, false);
    this.burstRing(DISCARD_X, PILE_Y, GOLD);
    this.announce('GAME ON!', '#e8b923', 40);

    this.dealing = false;
    this.busy = false;
    this.render();
    this.advance();
  }

  /* ------------------------------------------------------------------ */
  /* player input (smart tap)                                            */
  /* ------------------------------------------------------------------ */
  rejectReason(card) {
    const s = this.state;
    if (s.drawnCardId) return 'Play the card you just drew, or pass';
    if (s.pendingPunishment > 0) return 'Only a 3 or an Ace can answer a punishment';
    return `Cannot play ${card.displayName} ${Rules.SUIT_SYMBOLS[card.suit]} — need ${this.suitName(s.currentSuit)} or ${s.topCard.displayName}`;
  }

  rejectCard(sp, msg) {
    this.showToast(msg, '#ff6b6b', 520);
    this.shakeSprites([sp], 6);
  }

  onCardTap(sp) {
    if (this.busy || !this.isHumanTurn() || this.modal) return;
    this.triggerHint();
    const c = sp.card;
    const hand = this.state.players[this.humanIndex].hand;

    if (this.isSelected(c)) {
      this.selectedCards = this.selectedCards.filter((sc) => sc.id !== c.id);
      this.refreshSel();
      return;
    }

    if (this.selectedCards.length > 0) {
      const opener = this.selectedCards[0];
      if (c.rank !== opener.rank) { this.rejectCard(sp, `Batch must be all ${opener.displayName}s`); return; }
    } else if (!this.humanLegalIds().has(c.id)) {
      this.rejectCard(sp, this.rejectReason(c));
      return;
    }

    this.selectedCards.push(c);

    const remainingHand = hand.filter((h) => h.id !== c.id);
    const possiblePartners = remainingHand.filter((h) => h.rank === c.rank);
    if (possiblePartners.length === 0) this.dropBatch();
    else this.refreshSel();
  }

  dropBatch() {
    const cards = [...this.selectedCards];
    this.selectedCards = [];
    this.refreshSel();

    const acesPlayed = cards.filter((c) => c.rank === 'ace').length;
    const punishment = this.state.pendingPunishment;

    if (acesPlayed > 0) {
      const acesSpentOnPunishment = Math.ceil(Math.min(punishment, acesPlayed * 3) / 3);
      const leftoverAces = acesPlayed - acesSpentOnPunishment;

      if (leftoverAces > 0) {
        this.showSuitPicker(cards, (suit) => this.perform({ type: 'play', cards, chosenSuit: suit }), () => { this.selectedCards = cards; this.refreshSel(); });
      } else {
        this.perform({ type: 'play', cards });
      }
    } else {
      this.perform({ type: 'play', cards });
    }
  }

  /* ------------------------------------------------------------------ */
  /* turn flow                                                           */
  /* ------------------------------------------------------------------ */
  advance() {
    if (!this.scene.isActive() || !this.alive()) return;
    const s = this.state;
    if (s.winnerIndex != null) {
      this.render();
      const humanWon = s.winnerIndex === this.humanIndex;
      if (humanWon) this.confetti(); else this.flash(0x000000, 0.35);
      this.announce(humanWon ? 'YOU WIN!' : `${s.players[s.winnerIndex].name} wins`, humanWon ? '#e8b923' : '#ff6b6b', 52);
      this.time.delayedCall(1300, () => this.cameras.main.fadeOut(450, 0, 0, 0));
      this.time.delayedCall(1750, () => this.scene.start('WinScene', {
        winnerIndex: s.winnerIndex, winnerName: s.players[s.winnerIndex].name, humanWon,
      }));
      return;
    }

    s.players.forEach((p, i) => {
      if (p.isBot && p.hand.length === 1 && !this.state.declaredNikoCardi[i]) {
        if (!Rules.isSpecial(p.hand[0])) {
          this.state = Rules.applyMove(this.state, { type: 'declare', playerIndex: i });
          this.sfx('niko_audio', 1);
          this.showToast(`${p.name}: "Niko Cardi!"`, '#e8b923', 150);
          this.burstRing(60, 46, GOLD);
        }
      }
    });

    if (!this.state.turnStarted) {
      if (Rules.canDeclareNiko(this.state, this.humanIndex)) {
        this.render();
      } else {
        this.time.delayedCall(300, () => this.beginTurn());
      }
      return;
    }

    const legal = Rules.getLegalMoves(s.players[s.currentPlayerIndex].hand, s.topCard, s.pendingPunishment, s.currentSuit);
    if (s.pendingPunishment > 0 && legal.length === 0) {
      this.busy = true;
      this.render();
      const who = s.players[s.currentPlayerIndex];
      this.announce(who.isBot ? `${who.name}: NO ANSWER` : 'NO ANSWER!', '#ff6b6b', 38);
      this.time.delayedCall(800, async () => {
        const next = Rules.applyMove(this.state, { type: 'draw' });
        await this.playEvents(next.events);
        if (!this.alive()) return;
        this.state = next;
        this.busy = false;
        this.render();
        this.advance();
      });
      return;
    }

    if (this.state.players[this.state.currentPlayerIndex].isBot) {
      this.render();
      this.time.delayedCall(800 + Math.random() * 500, () => this.botAct());
    } else {
      this.render();
    }
  }

  async beginTurn() {
    if (!this.alive()) return;
    this.busy = true;
    const next = Rules.startTurn(this.state);
    this.nikoWindow = null;
    this.nikoContainer.setVisible(false);
    if (next.events.some((e) => e.type === 'foul')) this.showToast('No "Niko Cardi!" — +1 card, turn lost', '#ff6b6b');
    await this.playEvents(next.events);
    if (!this.alive()) return;
    this.state = next;
    this.busy = false;
    this.render();
    this.advance();
  }

  declareNiko() {
    if (!Rules.canDeclareNiko(this.state, this.humanIndex)) return;

    if (this.nikoTimerTween) this.nikoTimerTween.remove();
    this.nikoTimerFill.clear();
    this.nikoContainer.setVisible(false);
    this.burstRing(this.nikoContainer.x, this.nikoContainer.y, GOLD);
    this.sfx('niko_audio', 1);

    this.state = Rules.applyMove(this.state, { type: 'declare', playerIndex: this.humanIndex });
    this.showToast('Niko Cardi! You\'re safe', '#e8b923');
    this.render();

    this.time.delayedCall(400, () => this.beginTurn());
  }

  async botAct() {
    if (!this.scene.isActive() || !this.alive()) return;
    const i = this.state.currentPlayerIndex;
    const move = Bot.chooseMove(this.state, i);
    if (move.type === 'declare') {
      this.state = Rules.applyMove(this.state, { type: 'declare', playerIndex: i });
      return this.botAct();
    }
    await this.perform(move);
  }

  async perform(move) {
    if (this.busy) return;
    let next;
    try {
      next = Rules.applyMove(this.state, move);
    } catch (e) {
      console.warn('Rejected move', move, e.message);
      this.showToast(e.message, '#ff6b6b', 520);
      return;
    }
    this.busy = true;
    this.clearToasts();
    this.render();
    await this.playEvents(next.events);
    if (!this.alive()) return;
    this.state = next;
    this.busy = false;
    this.render();
    this.advance();
  }

  /* ------------------------------------------------------------------ */
  /* event animations (+ sounds)                                         */
  /* ------------------------------------------------------------------ */
  async playEvents(events = []) {
    for (let i = 0; i < events.length; i++) {
      if (!this.alive()) return;
      const e = events[i];
      if (e.type === 'play') {
        const batch = [e];
        while (events[i + 1] && events[i + 1].type === 'play' && events[i + 1].player === e.player) batch.push(events[++i]);
        await this.animPlayBatch(batch);
      } else if (e.type === 'draw') await this.animDraw(e);
      else if (e.type === 'reshuffle') await this.animReshuffle();
      else if (e.type === 'foul') await this.animFoul(e);
      else if (e.type === 'suit') await this.animSuit(e);
    }
  }

  flyPlayed(e, k) {
    const human = e.player === this.humanIndex;
    const land = () => {
      this.vw.discard.push(e.card); this.vw.discardCount++;
      this.vw.discard = this.vw.discard.slice(-3);
      this.updateDiscard();
      this.vw.suit = e.card.suit;
      this.updateSuitUI(e.card.suit);
      this.sfx('sfx_pg');
    };
    let sp;
    if (human) {
      sp = this.handSprites.get(e.card.id);
      this.handSprites.delete(e.card.id);
      this.vw.human = this.vw.human.filter((c) => c.id !== e.card.id);
      if (!sp) sp = this.makeCard(e.card.id, TABLE_CX, HAND_Y);
      if (sp.input) sp.disableInteractive();
      this.layoutHand(260);                       // the rest of the hand closes the gap smoothly
      sp.hover = false;
    } else {
      const idx = this.botSprites.length ? Phaser.Math.Between(0, this.botSprites.length - 1) : -1;
      sp = idx >= 0 ? this.botSprites.splice(idx, 1)[0] : this.makeBotCard(TABLE_CX, BOT_Y);
      this.layoutBot(260);
      this.updateBotLabel();
    }
    return this.flyCard(sp, {
      x: DISCARD_X, y: PILE_Y, angle: this.angleFor(e.card.id), scale: 1,
      delay: k * 130, dur: 360, arc: 30, flipKey: human ? null : e.card.id, depth: Z.fly + 20 + k,
    }).then(() => {
      if (!this.alive()) return;
      land();
      sp.destroy();
      this.burstRing(DISCARD_X, PILE_Y, 0xffffff);
    });
  }

  async animPlayBatch(batch) {
    const pendBefore = this.state.pendingPunishment;
    await Promise.all(batch.map((e, k) => this.flyPlayed(e, k)));
    if (!this.alive()) return;
    const last = batch[batch.length - 1].card;
    const n = batch.length;
    if (last.rank === 'king') { this.cameras.main.shake(140, 0.003); await this.announce('KICKBACK!', '#7ad7ff'); }
    else if (last.rank === 'jack') await this.announce('JUMP!', '#ffd166');
    else if (last.rank === '3') { this.cameras.main.shake(180, 0.004); await this.announce(`FOUL!  +${3 * n}`, '#ff6b6b'); }
    else if (last.rank === 'ace') {
      if (pendBefore > 0 && Rules.resolvePunishment(pendBefore, n) === 0) { this.flash(0x2fa36b, 0.18); await this.announce('CANCELLED!', '#6df0a8'); }
      else await this.announce(n > 1 ? `ACE ×${n}` : 'ACE!', '#e8b923');
    } else if (n > 1) await this.announce(`${['', '', 'DOUBLE', 'TRIPLE', 'QUAD'][n] || 'COMBO'}  ×${n}`, '#cfe3d8', 38);
  }

  async animDraw(e) {
    const human = e.player === this.humanIndex;
    const cards = e.cards;
    const punish = e.reason === 'punishment' || e.reason === 'foul';
    const sprites = [];
    if (human) {
      cards.forEach((c) => {
        this.vw.human.push(c);
        const sp = this.spawnHandCard(c, DRAW_X, PILE_Y, 'card_back');
        sp.flying = true; sp.setDepth(Z.fly);
        sprites.push(sp);
      });
      this.layoutHand(300);                        // existing cards fan out to make room
    } else {
      cards.forEach(() => { const sp = this.makeBotCard(DRAW_X, PILE_Y); sp.flying = true; sp.setDepth(Z.fly); this.botSprites.push(sp); sprites.push(sp); });
      this.layoutBot(300);
    }
    this.vw.drawCount = Math.max(0, this.vw.drawCount - cards.length);
    this.updateDrawPile();
    this.tweens.add({ targets: this.drawPileC, scale: { from: 1.08, to: 1 }, duration: 220 });

    if (punish) {
      this.sfx('sfx_pt');
      this.floatLabel(`+${cards.length}`, TABLE_CX, human ? 520 : 170, '#ff6b6b');
      this.flash(0xff2a2a, 0.16);
    }

    await Promise.all(sprites.map((sp, i) => this.flyCard(sp, {
      x: sp.slot.x, y: sp.slot.y, angle: sp.slot.angle, scale: human ? 1 : 0.8,
      delay: i * 140, dur: 400, arc: 28, flipKey: human ? cards[i].id : null, depth: Z.fly + i,
      onStart: punish ? null : () => this.sfx('sfx_dg'),
    }).then(() => {
      if (!sp.scene) return;
      sp.setDepth(sp.slot.depth);
      this.settle(sp);
      if (human) {                                  // quick "new card" sparkle
        sp.glow.setAlpha(1);
        this.tweens.add({ targets: sp.glow, alpha: 0, duration: 650, delay: 150 });
      }
    })));
    if (!this.alive()) return;
    if (human) this.refreshHand();
    this.updateBotLabel();
    await this.wait(80);
  }

  async animReshuffle() {
    this.sfx('sfx_rg');
    this.showToast('Reshuffling…', '#cfe3d8', 420);
    const keep = this.vw.discard.slice(-1);
    const moved = Math.max(0, this.vw.discardCount - 1);
    this.vw.discard = keep; this.vw.discardCount = 1;
    this.updateDiscard();
    const imgs = [];
    for (let i = 0; i < 7; i++) {
      imgs.push(this.add.image(DISCARD_X + Phaser.Math.Between(-18, 18), PILE_Y + Phaser.Math.Between(-10, 10), 'card_back')
        .setDisplaySize(UI.CW, UI.CH).setDepth(Z.fly).setAngle(Phaser.Math.Between(-20, 20)));
    }
    await this.tweenP({ targets: imgs, x: DRAW_X, y: PILE_Y, angle: 0, duration: 600, ease: 'Cubic.inOut', delay: this.tweens.stagger(45) });
    imgs.forEach((i) => i.destroy());
    this.vw.drawCount += moved;
    this.updateDrawPile();
    this.tweens.add({ targets: this.drawPileC, scale: { from: 1.12, to: 1 }, duration: 260, ease: 'Back.out' });
  }

  async animFoul(e) {
    const human = e.player === this.humanIndex;
    this.cameras.main.shake(160, 0.004);
    await this.shakeSprites(human ? [...this.handSprites.values()] : this.botSprites, 8);
  }

  async animSuit(e) {
    this.vw.suit = e.suit;
    this.updateSuitUI(e.suit);
    await this.announce(`${Rules.SUIT_SYMBOLS[e.suit]} ${this.suitName(e.suit)}`, this.suitColorCss(e.suit), 36);
  }

  /* ------------------------------------------------------------------ */
  /* suit picker (Ace)                                                   */
  /* ------------------------------------------------------------------ */
  showSuitPicker(playingCards, onPick, onCancel) {
    if (this.modal) return;
    const { W, H, FONT } = UI;
    const layer = this.add.container(0, 0).setDepth(Z.modal);
    this.modal = layer;
    const close = () => { this.modal = null; layer.destroy(); };

    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setInteractive();
    this.tweens.add({ targets: dim, fillAlpha: 0.6, duration: 180 });
    dim.on('pointerdown', () => { close(); if (onCancel) onCancel(); });      // tap outside = cancel

    const panelC = this.add.container(W / 2, 345);
    const panel = this.add.graphics();
    panel.fillStyle(0x10291f, 1).fillRoundedRect(-280, -125, 560, 250, 20);
    panel.lineStyle(3, GOLD, 1).strokeRoundedRect(-280, -125, 560, 250, 20);
    const title = this.add.text(0, -88, 'Ace! Choose a suit', { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: '#e8b923' }).setOrigin(0.5);
    const sub = this.add.text(0, 112, 'tap outside to cancel', { fontFamily: FONT, fontSize: '12px', color: '#6f8f7d' }).setOrigin(0.5);
    panelC.add([panel, title, sub]).setSize(560, 250).setInteractive();
    panelC.setScale(0.8).setAlpha(0);
    this.tweens.add({ targets: panelC, scale: 1, alpha: 1, duration: 220, ease: 'Back.out' });
    layer.add([dim, panelC]);

    const ids = new Set(playingCards.map((c) => c.id));
    const hand = this.state.players[this.humanIndex].hand.filter((c) => !ids.has(c.id));
    Rules.SUITS.forEach((suit, i) => {
      const inHand = hand.filter((c) => c.suit === suit).length;
      const c = this.add.container(W / 2 - 195 + i * 130, 365).setScale(0);
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 1).fillRoundedRect(-52, -60, 104, 120, 14);
      g.lineStyle(3, UI.hex(Rules.SUIT_COLORS[suit]), 1).strokeRoundedRect(-52, -60, 104, 120, 14);
      const sym = this.add.text(0, -16, Rules.SUIT_SYMBOLS[suit], { fontFamily: FONT, fontSize: '58px', color: Rules.SUIT_COLORS[suit], fontStyle: 'bold' }).setOrigin(0.5);
      const nm = this.add.text(0, 30, this.suitName(suit), { fontFamily: FONT, fontSize: '15px', color: '#333', fontStyle: 'bold' }).setOrigin(0.5);
      const cnt = this.add.text(0, 48, `${inHand} in hand`, { fontFamily: FONT, fontSize: '11px', color: '#777' }).setOrigin(0.5);
      c.add([g, sym, nm, cnt]).setSize(104, 120).setInteractive({ useHandCursor: true });
      c.on('pointerover', () => this.tweens.add({ targets: c, scale: 1.1, duration: 100 }));
      c.on('pointerout', () => this.tweens.add({ targets: c, scale: 1, duration: 100 }));
      c.on('pointerdown', () => { close(); onPick(suit); });
      layer.add(c);
      this.tweens.add({ targets: c, scale: 1, duration: 240, delay: 120 + i * 70, ease: 'Back.out' });
    });
  }

  /* ------------------------------------------------------------------ */
  update(time, delta) {
    // pulsing gold outline on playable cards, solid on selected ones
    const a = 0.45 + 0.4 * Math.sin(time / 260);
    this.handSprites.forEach((sp) => {
      if (!sp.glow || sp.flying) return;
      if (sp.glowMode === 2) sp.glow.setAlpha(1);
      else if (sp.glowMode === 1) sp.glow.setAlpha(a * 0.75);
    });
    // direction ring slowly turns the way play is going
    if (this.dirIcon && this.state) this.dirIcon.angle += this.state.direction * delta * 0.035;
  }
}
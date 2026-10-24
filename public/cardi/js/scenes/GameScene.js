/* =====================================================================
 * GameScene — oval table, player seats, top HUD, pause menu, audio
 *
 *  GAMEPLAY (unchanged): smart tap, tap the discard pile to play a batch,
 *  Ace suit picker (leftover-Ace rule), 5s Niko Cardi timer, delayed hint,
 *  direct Rules.applyMove.
 *
 *  LAYOUT
 *   - Oval table in the middle. Every player (bot, online or local) is a SEAT
 *     placed around the rim automatically: 2 players = one across, 3 = two
 *     across-left/right, 4 = left/top/right, and so on.
 *   - Each seat has ONE plate that shows everything about that player:
 *       avatar + name + card count, a status line (thinking dots / last
 *       action / "Your turn"), and the NIKO flag.
 *   - Top-middle capsule: play direction + pending punishment.
 *   - Top-right: pause button -> Pause menu (Resume, Moves log, Settings,
 *     Sound, Leave table). The game really pauses (timers + animations).
 *
 *  OPTIONS (scene data): { humanName, botName, players?, localIndex? }
 *    players = [{ name, isBot }, ...]  (default: you + one bot)
 *    localIndex = which player is the person at this screen (default 0)
 *
 *  SETTINGS SCENE CONTRACT (optional): the Settings button runs
 *    this.scene.launch('SettingsScene', { from: 'GameScene' }) and pauses this scene;
 *    your SettingsScene should call  this.scene.stop(); this.scene.resume('GameScene')
 *    when closed. If no SettingsScene is registered, the menu shows "coming soon".
 *
 *  SOUNDS (/cardi/assets/): nc.mp3 Niko Cardi, rg.mp3 start + reshuffle,
 *    dg.mp3 drawing, pg.mp3 playing, pt.mp3 punishment. Missing files are skipped.
 * ===================================================================== */
const TABLE_CX = 450;
const TABLE_CY = 368;
const TABLE_RX = 372;
const TABLE_RY = 212;
const PILE_Y = 368;
const DRAW_X = 355;
const DISCARD_X = 545;
const HAND_Y = 612;
const PLATE_W = 172;
const PLATE_H = 56;
const POP_Y = 258;        // the one 'stage' where every big pop-up appears

const Z = { hand: 10, selected: 120, hover: 300, fly: 700, fx: 900, toast: 2000, modal: 3000, pause: 3500 };
const GOLD = 0xe8b923;
const SEAT_COLORS = [0x4da3ff, 0x57c785, 0xc084fc, 0xff9f43, 0xf472b6];

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
    this.load.audio('sfx_win', base + 'wn.wav');  // Win sound
    this.load.audio('sfx_score', base + 'ss.wav'); // Score sound
  }

  create() {
    // Unlock the browser's audio context on the first click
    this.input.once('pointerdown', () => {
      if (this.sound.context && this.sound.context.state === 'suspended') this.sound.context.resume();
    });
    // Sound is ALWAYS on when a game starts (the mute switch lives in the pause menu)
    this.muted = false;
    try { this.sound.mute = false; } catch (e) { /* ignore */ }

    this.dead = false;
    this.paused = false;
    this.clock = 0;                 // game time in ms (does not advance while paused)
    this.busy = true;
    this.dealing = true;
    this.modal = null;
    this.selectedCards = [];
    this.handSprites = new Map();
    this.angles = {};
    this.activeToasts = [];
    this.nikoWindow = null;
    this.hintTimer = null;
    this.lastPun = 0;
    this.lastDirection = 1;
    this.dropHintOn = false;
    this.pauseTweens = [];
    this.passTimer = null;
    this.passTimerRing = null;
    this.popQ = [];                 // pop-up lane (see queuePopup)
    this.popBusy = false;
    this.popLive = 0;
    this.popMax = 0;
    this.acePrefix = null;

    UI.drawFelt(this);
    this.ensureTextures();

    const roster = this.options.players || [
      { name: this.options.humanName, isBot: false },
      { name: this.options.botName, isBot: true },
    ];
    this.humanIndex = this.options.localIndex || 0;
    // Online rooms pass a shared seed so every player gets the exact same shuffle.
    let rng;
    if (this.options.seed != null) {
      let a = (Number(this.options.seed) >>> 0) || 1;
      rng = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }
    this.state = GameStateMgr.createGame(roster, rng);
    this.vw = { human: [], discard: [], discardCount: 0, drawCount: 0, suit: this.state.currentSuit, suitShown: null };
    this.lastDirection = this.state.direction;

    this.drawTable();
    this.buildHud();
    this.buildPauseButton();
    this.buildPiles();
    this.buildSeats();
    this.buildNikoButton();
    this.buildPrompts();

    this.input.on('pointermove', this.onPtrMove, this);
    this.input.on('pointerup', this.onPtrUp, this);
    this.input.on('wheel', this.onWheel, this);
    if (this.input.keyboard) this.input.keyboard.on('keydown-ESC', this.onEsc, this);
    this.events.once('shutdown', () => {
      this.dead = true;
      this.input.off('pointermove', this.onPtrMove, this);
      this.input.off('pointerup', this.onPtrUp, this);
      this.input.off('wheel', this.onWheel, this);
      if (this.input.keyboard) this.input.keyboard.off('keydown-ESC', this.onEsc, this);
    });

    // --- WAKE LISTENER ---
    // When Settings closes and wakes the game, make sure we are still paused safely
    this.events.on('wake', () => {
      if (this.paused) {
        this.time.paused = true;
      }
    });

    this.startDealSequence();
  }

  /* ------------------------------------------------------------------ */
  /* small helpers                                                       */
  /* ------------------------------------------------------------------ */
  alive() { return !this.dead; }
  wait(ms) { return new Promise((r) => this.time.delayedCall(ms, r)); }
  tweenP(cfg) { return new Promise((r) => this.tweens.add({ ...cfg, onComplete: r, onStop: r })); }
  /** tween for the pause menu: tracked so it is cleaned up when the menu closes */
  pt(cfg) { const t = this.tweens.add(cfg); this.pauseTweens.push(t); return t; }

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
    if (!this.isHumanTurn() || this.busy || this.paused || this.state.drawnCardId) return false;
    return true;
  }

  clearPassTimer() {
    if (this.passTimer) {
      this.passTimer.remove();
      this.passTimer = null;
    }
    if (this.passTimerRing) {
      this.passTimerRing.destroy();
      this.passTimerRing = null;
    }
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

  showToast(msg, color = '#ffffff', y = 280) {
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
  /* the table                                                           */
  /* ------------------------------------------------------------------ */
  drawTable() {
    const { W, H } = UI;
    const g = this.add.graphics().setDepth(0);
    const cx = TABLE_CX, cy = TABLE_CY, rx = TABLE_RX, ry = TABLE_RY;
    // dim the room so the table is the star
    g.fillStyle(0x020a06, 0.6).fillRect(0, 0, W, H);
    // soft light pool under the table
    for (let i = 0; i < 6; i++) g.fillStyle(0x1f5c49, 0.035).fillEllipse(cx, cy + 6, 2 * (rx + 150 - i * 22), 2 * (ry + 120 - i * 18));
    // shadow
    g.fillStyle(0x000000, 0.4).fillEllipse(cx, cy + 18, 2 * (rx + 36), 2 * (ry + 36));
    // wooden rim
    g.fillStyle(0x24140b, 1).fillEllipse(cx, cy, 2 * (rx + 24), 2 * (ry + 24));
    g.fillStyle(0x4d2d19, 1).fillEllipse(cx, cy, 2 * (rx + 18), 2 * (ry + 18));
    g.fillStyle(0x34200f, 1).fillEllipse(cx, cy, 2 * (rx + 10), 2 * (ry + 10));
    g.lineStyle(2, GOLD, 0.55).strokeEllipse(cx, cy, 2 * (rx + 10), 2 * (ry + 10));
    // leather padding
    g.fillStyle(0x0e2118, 1).fillEllipse(cx, cy, 2 * (rx + 3), 2 * (ry + 3));
    // felt with a gentle lit centre
    g.fillStyle(0x15463a, 1).fillEllipse(cx, cy, 2 * rx, 2 * ry);
    for (let i = 1; i <= 8; i++) g.fillStyle(0x1f6a55, 0.09).fillEllipse(cx, cy - 8, 2 * rx * (1 - i * 0.1), 2 * ry * (1 - i * 0.1));
    // stitched line
    g.lineStyle(2, GOLD, 0.3);
    const N = 120, pr = (k) => { const t = (k / N) * Math.PI * 2; return [cx + (rx - 16) * Math.cos(t), cy + (ry - 16) * Math.sin(t)]; };
    for (let k = 0; k < N; k += 2) { const a = pr(k), b = pr(k + 1); g.lineBetween(a[0], a[1], b[0], b[1]); }
    // faint ring around the card area
    g.lineStyle(1.5, 0xffffff, 0.05).strokeEllipse(cx, cy, 2 * 150, 2 * 92);
  }

  /* ---------- top-middle HUD: direction + punishment ---------- */
  buildHud() {
    const { FONT } = UI;
    const hud = this.add.container(TABLE_CX, 30).setDepth(8);
    this.hudBg = this.add.graphics();
    this.hudDivider = this.add.graphics();
    hud.add([this.hudBg, this.hudDivider]);

    this.dirIcon = this.add.container(-128, 0);
    const ring = this.add.graphics();
    ring.lineStyle(3, GOLD, 1);
    const arc = (a0, a1) => {
      ring.beginPath(); ring.arc(0, 0, 10, a0, a1, false); ring.strokePath();
      const px = 10 * Math.cos(a1), py = 10 * Math.sin(a1), tx = -Math.sin(a1), ty = Math.cos(a1);
      ring.fillStyle(GOLD, 1).fillTriangle(px + tx * 6, py + ty * 6, px - ty * 4, py + tx * 4, px + ty * 4, py - tx * 4);
    };
    arc(0.35, 2.55); arc(Math.PI + 0.35, Math.PI + 2.55);
    this.dirIcon.add(ring);
    this.dirText = this.add.text(-110, 0, 'Clockwise', { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#f3ead2' }).setOrigin(0, 0.5);
    this.punLabel = this.add.text(-2, 0, 'PUNISHMENT', { fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: '#8fb09e' }).setOrigin(0, 0.5).setLetterSpacing(1);
    this.punText = this.add.text(118, 0, '0', { fontFamily: FONT, fontSize: '24px', fontStyle: '900', color: '#4d6b5d' }).setOrigin(0.5);
    hud.add([this.dirIcon, this.dirText, this.punLabel, this.punText]);
    this.hud = hud;
    this.drawHud(false);
  }

  drawHud(active) {
    const g = this.hudBg;
    g.clear();
    g.fillStyle(0x000000, 0.55).fillRoundedRect(-150, -20, 300, 40, 20);
    if (active) g.fillStyle(0x6b0f0f, 0.65).fillRoundedRect(-8, -18, 156, 36, { tl: 0, bl: 0, tr: 18, br: 18 });
    g.lineStyle(2, active ? 0xff3b3b : 0x2e5242, 1).strokeRoundedRect(-150, -20, 300, 40, 20);
    this.hudDivider.clear().lineStyle(1.5, active ? 0xff3b3b : 0x2e5242, 1).lineBetween(-8, -12, -8, 12);
  }

  /* ---------- top-right pause button ---------- */
  buildPauseButton() {
    const c = this.add.container(UI.W - 40, 36).setDepth(8);
    const bg = this.add.graphics();
    const draw = (hover) => {
      bg.clear();
      bg.fillStyle(0x000000, 0.35).fillCircle(2, 3, 22);
      bg.fillStyle(hover ? 0x2f6b51 : 0x143528, 1).fillCircle(0, 0, 22);
      bg.lineStyle(2, GOLD, 1).strokeCircle(0, 0, 22);
      bg.fillStyle(0xf3ead2, 1).fillRoundedRect(-8, -9, 5.5, 18, 2).fillRoundedRect(2.5, -9, 5.5, 18, 2);
    };
    draw(false);
    c.add(bg).setSize(44, 44).setInteractive({ useHandCursor: true });
    c.on('pointerover', () => { draw(true); this.tweens.add({ targets: c, scale: 1.08, duration: 100 }); });
    c.on('pointerout', () => { draw(false); this.tweens.add({ targets: c, scale: 1, duration: 100 }); });
    c.on('pointerdown', () => this.openPause());
    this.pauseBtn = c;
  }

  /* ---------- piles ---------- */
  buildPiles() {
    const { FONT } = UI;
    this.drawPileC = this.add.container(DRAW_X, PILE_Y).setDepth(2);
    this.discardC = this.add.container(DISCARD_X, PILE_Y).setDepth(2);

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
    this.playZone.on('pointerdown', () => { if (this.selectedCards.length > 0 && !this.paused) this.dropBatch(); });
  }

  buildPrompts() {
    const { FONT } = UI;
    this.hintText = this.add.text(TABLE_CX, 508, '', {
      fontFamily: FONT, fontSize: '16px', color: '#cfe3d8', align: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: { x: 12, y: 6 }, wordWrap: { width: 360 },
    }).setOrigin(0.5).setAlpha(0).setDepth(55);

    this.passBtn = UI.makeButton(this, 650, 500, 'Pass', () => {
      if (this.isHumanTurn() && !this.busy && !this.paused && this.state.drawnCardId) {
        this.clearPassTimer();
        this.perform({ type: 'pass' });
      }
    }, { width: 110, height: 40, fontSize: '18px' }).setVisible(false).setDepth(60);
  }

  // ==========================================
  // PREMIUM NIKO CARDI BUTTON
  // ==========================================
  buildNikoButton() {
    const { FONT } = UI;
    this.nikoContainer = this.add.container(TABLE_CX, 496).setDepth(60).setVisible(false);

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
    this.nikoContainer.on('pointerdown', () => { if (!this.paused) this.declareNiko(); });

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

  /* ------------------------------------------------------------------ */
  /* seats (one per player) — each has ONE plate with all its info       */
  /* ------------------------------------------------------------------ */
  buildSeats() {
    const n = this.state.players.length;
    const L = this.humanIndex;
    const opponents = n - 1;
    const scale = opponents <= 2 ? 0.8 : opponents === 3 ? 0.7 : 0.6;
    let colorIdx = 0;

    this.seats = this.state.players.map((player, i) => {
      const seat = { index: i, player, local: i === L, cards: [], action: null, mode: '', modeText: '', active: false, nikoOn: false };
      seat.color = seat.local ? GOLD : SEAT_COLORS[colorIdx++ % SEAT_COLORS.length];
      if (seat.local) {
        seat.anchor = { x: 14 + PLATE_W / 2, y: 662 };
      } else {
        // seats go clockwise around the table starting from the local player at the bottom
        const k = (i - L + n) % n;
        const phi = Phaser.Math.DegToRad(90 + (360 * k) / n);
        seat.anchor = { x: TABLE_CX + 330 * Math.cos(phi), y: TABLE_CY + 284 * Math.sin(phi) };
        const dx = TABLE_CX - seat.anchor.x, dy = TABLE_CY - seat.anchor.y, len = Math.hypot(dx, dy) || 1;
        const dist = (72 + 70 * Math.abs(dx / len)) * (scale / 0.8);
        seat.fan = {
          x: seat.anchor.x + (dx / len) * dist,
          y: seat.anchor.y + (dy / len) * dist,
          rot: -Phaser.Math.RadToDeg(Math.atan2(dx / len, dy / len)),
          scale,
        };
      }
      this.buildPlate(seat);
      return seat;
    });
  }

  buildPlate(seat) {
    const { FONT } = UI;
    const c = this.add.container(seat.anchor.x, seat.anchor.y).setDepth(seat.local ? 4 : 20);
    const x0 = -PLATE_W / 2, y0 = -PLATE_H / 2;

    const glow = this.add.graphics().setAlpha(0);
    glow.lineStyle(8, seat.color, 0.35).strokeRoundedRect(x0 - 3, y0 - 3, PLATE_W + 6, PLATE_H + 6, 17);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.5).fillRoundedRect(x0 + 2, y0 + 4, PLATE_W, PLATE_H, 14);
    bg.fillStyle(0x0b1a13, 0.92).fillRoundedRect(x0, y0, PLATE_W, PLATE_H, 14);
    const border = this.add.graphics();

    const avatar = this.add.circle(x0 + 30, 0, 21, Phaser.Display.Color.ValueToColor(seat.color).darken(55).color).setStrokeStyle(3, seat.color);
    const initial = this.add.text(x0 + 30, 0, (seat.player.name || '?').charAt(0).toUpperCase(), { fontFamily: FONT, fontSize: '22px', fontStyle: '900', color: '#f3ead2' }).setOrigin(0.5);
    const badge = this.add.circle(x0 + 46, 17, 10, 0x0b1a13).setStrokeStyle(2, GOLD);
    const count = this.add.text(x0 + 46, 17, '0', { fontFamily: FONT, fontSize: '11px', fontStyle: '900', color: '#f3ead2' }).setOrigin(0.5);

    let name = seat.player.name || '';
    if (name.length > 12) name = name.slice(0, 11) + '…';
    const nameT = this.add.text(x0 + 60, y0 + 8, name, { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#f3ead2' });
    const status = this.add.text(x0 + 60, y0 + 31, '', { fontFamily: FONT, fontSize: '12.5px', fontStyle: 'bold', color: '#6f8f7d' });
    const dots = this.add.container(x0 + 64, y0 + 39).setVisible(false);
    const dotObjs = [0, 1, 2].map((k) => { const d = this.add.circle(k * 13, 0, 3.5, 0xe8b923); dots.add(d); return d; });

    // NIKO flag: sits on the plate corner for as long as the player is on their last card
    const flag = this.add.container(PLATE_W / 2 - 22, y0 - 8).setVisible(false);
    const fg = this.add.graphics();
    fg.fillStyle(GOLD, 1).fillRoundedRect(-30, -10, 60, 20, 10);
    fg.lineStyle(2, 0x7a5c00, 1).strokeRoundedRect(-30, -10, 60, 20, 10);
    const fl = this.add.text(0, 0, 'NIKO!', { fontFamily: FONT, fontSize: '12px', fontStyle: '900', color: '#2a1d00' }).setOrigin(0.5);
    flag.add([fg, fl]);

    c.add([glow, bg, border, avatar, initial, badge, count, nameT, status, dots, flag]);
    seat.ui = { c, glow, border, avatar, badge, count, nameT, status, dots, dotObjs, flag };
  }

  /** Redraw every plate from the current view state. */
  refreshSeats() { this.seats.forEach((s) => this.refreshSeat(s)); }

  refreshSeat(seat) {
    const st = this.state, i = seat.index, ui = seat.ui;
    const hand = st.players[i].hand;
    const shown = seat.local ? this.vw.human.length : seat.cards.length;
    ui.count.setText(String(shown));

    const current = st.winnerIndex == null && st.currentPlayerIndex === i && !this.dealing;
    const turnReady = current && st.turnStarted && !this.busy;

    // --- status line: thinking dots / your turn > last action > idle
    let mode = 'idle', text = 'Waiting';
    if (st.winnerIndex === i) { mode = 'action'; text = 'Winner!'; }
    else if (turnReady) { if (seat.local) { mode = 'turn'; text = 'Your turn'; } else mode = 'thinking'; }
    else if (seat.action && this.clock < seat.action.until) { mode = 'action'; text = seat.action.text; }
    else if (this.dealing) text = 'Dealing…';
    this.setSeatMode(seat, mode, text);

    // --- active-turn highlight
    ui.border.clear().lineStyle(2, current ? seat.color : 0x2e5242, 1).strokeRoundedRect(-PLATE_W / 2, -PLATE_H / 2, PLATE_W, PLATE_H, 14);
    ui.nameT.setColor(current ? '#ffffff' : '#f3ead2');
    if (current !== seat.active) {
      seat.active = current;
      if (seat.glowTween) { seat.glowTween.stop(); seat.glowTween = null; }
      if (current) seat.glowTween = this.tweens.add({ targets: ui.glow, alpha: { from: 0.25, to: 1 }, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      else this.tweens.add({ targets: ui.glow, alpha: 0, duration: 200 });
    }

    // --- Niko flag
    const niko = !!st.declaredNikoCardi[i] && hand.length === 1;
    if (niko && !seat.nikoOn) {
      ui.flag.setVisible(true).setScale(0.3);
      this.tweens.add({ targets: ui.flag, scale: 1, angle: { from: -14, to: -4 }, duration: 320, ease: 'Back.out' });
      this.burstRing(seat.anchor.x, seat.anchor.y, GOLD);
    } else if (!niko) ui.flag.setVisible(false);
    seat.nikoOn = niko;
  }

  setSeatMode(seat, mode, text) {
    if (seat.mode === mode && seat.modeText === text) return;
    const ui = seat.ui;
    const prev = seat.mode;
    seat.mode = mode; seat.modeText = text;

    if (mode === 'thinking') {
      ui.status.setVisible(false);
      ui.dots.setVisible(true);
      ui.dotObjs.forEach((d, k) => {
        this.tweens.killTweensOf(d);
        d.setAlpha(0.3).setScale(1);
        this.tweens.add({ targets: d, alpha: 1, scale: 1.45, duration: 330, delay: k * 150, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      });
      return;
    }
    if (prev === 'thinking') { ui.dotObjs.forEach((d) => this.tweens.killTweensOf(d)); ui.dots.setVisible(false); }
    ui.status.setVisible(true).setText(text);
    ui.status.setScale(Math.min(1, 100 / Math.max(1, ui.status.width)));
    ui.status.setColor(mode === 'turn' ? '#ffe08a' : mode === 'action' ? '#f3ead2' : '#6f8f7d');
    this.tweens.killTweensOf(ui.status);
    ui.status.setAlpha(0);
    this.tweens.add({ targets: ui.status, alpha: 1, duration: 220 });
    if (mode === 'turn') this.tweens.add({ targets: ui.status, alpha: 0.65, delay: 240, duration: 600, yoyo: true, repeat: -1 });
  }

  /** Show what a player just did, in their own plate, for a few seconds. */
  seatAction(index, text, ttl = 2800) {
    const seat = this.seats[index];
    if (!seat) return;
    seat.action = { text, until: this.clock + ttl };
    this.refreshSeat(seat);
    this.time.delayedCall(ttl + 60, () => { if (this.alive()) this.refreshSeat(seat); });
  }

  cardWord(card) {
    if (card.rank === 'king' || card.rank === 'jack' || card.rank === '3' || card.rank === 'ace') return card.displayName;
    return String(card.displayName);
  }

  /* ---- non-local seat cards (face-down fan, rotated toward the table) ---- */
  seatSlot(seat, i, n) {
    const f = seat.fan, k = f.scale / 0.8;
    const sp = Math.min(44 * k, 330 / Math.max(n, 1)), off = i - (n - 1) / 2;
    const lx = off * sp, ly = Math.abs(off) * 2 * k, r = Phaser.Math.DegToRad(f.rot);
    return {
      x: f.x + lx * Math.cos(r) - ly * Math.sin(r),
      y: f.y + lx * Math.sin(r) + ly * Math.cos(r),
      angle: f.rot - off * Math.min(3, 24 / n),
      depth: 5 + i,
    };
  }

  makeSeatCard(seat, x, y) { return this.makeCard('card_back', x, y, seat.fan.scale); }

  layoutSeat(seat, dur = 280) {
    const n = seat.cards.length;
    seat.cards.forEach((sp, i) => {
      const t = this.seatSlot(seat, i, n);
      sp.slot = t;
      if (sp.flying) return;
      this.tweens.killTweensOf(sp);
      sp.setDepth(t.depth);
      this.tweens.add({ targets: sp, x: t.x, y: t.y, angle: t.angle, duration: dur, ease: 'Cubic.out' });
    });
  }

  /** Cards gently bob while that player is thinking. */
  setSeatIdle(seat, on) {
    if (on === !!seat.idleOn) return;
    seat.idleOn = on;
    seat.cards.forEach((sp, i) => {
      if (sp.flying) return;
      this.tweens.killTweensOf(sp.inner);
      if (on) this.tweens.add({ targets: sp.inner, y: { from: 0, to: -5 }, duration: 520, delay: i * 70, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      else this.tweens.add({ targets: sp.inner, y: 0, duration: 150 });
    });
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

  /* ---- local player's hand ---- */
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

  /* ---- piles ---- */
  updateDrawPile() {
    const { CW, CH } = UI;
    this.drawPileC.removeAll(true);
    const dc = this.vw.drawCount;
    for (let i = Math.min(3, dc) - 1; i >= 0; i--) this.drawPileC.add(this.add.image(-i * 2, -i * 2, 'card_back').setDisplaySize(CW, CH));
    if (dc <= 0) this.drawPileC.add(this.add.rectangle(0, 0, CW, CH).setStrokeStyle(2, 0x9fbfae, 0.5));
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
    this.suitPill.clear().fillStyle(0x000000, 0.55).fillRoundedRect(DISCARD_X - w / 2, PILE_Y + 78, w, 24, 12).lineStyle(2, col, 1).strokeRoundedRect(DISCARD_X - w / 2, PILE_Y + 78, w, 24, 12);
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

  /* ---------- POP-UP LANE ----------
   * Every big pop-up (KICKBACK!, FOUL +3, suit, +N POINTS, YOU WIN...) goes through ONE
   * lane and plays strictly one after another: fade in -> hold -> fade out. They can never
   * overlap. If several pile up, the hold time shortens so the lane keeps up with the game,
   * stale low-priority ones are skipped, and score/win pop-ups are never dropped.
   * prio: 0 = minor, 1 = normal, 2 = must-show */
  announce(text, color = '#e8b923', size = 44, opts = {}) {
    return this.queuePopup({ text, color, size, prio: 1, ...opts });
  }

  queuePopup(spec) {
    spec.t0 = this.clock;
    if (this.popQ.length >= 4) {
      const i = this.popQ.findIndex((p) => p.prio < 2);
      if (i >= 0) this.popQ.splice(i, 1);
      else if (spec.prio < 2) return this.wait(120);
    }
    this.popQ.push(spec);
    this.pumpPopups();
    return this.wait(spec.pace ?? 200);          // the game does not wait for the whole pop-up
  }

  async pumpPopups() {
    if (this.popBusy) return;
    this.popBusy = true;
    while (this.popQ.length && this.alive()) {
      const spec = this.popQ.shift();
      if (spec.prio < 2 && this.clock - spec.t0 > 2400) continue;   // too late to matter
      await this.showPopup(spec);
    }
    this.popBusy = false;
  }

  popupIdle() {
    return new Promise((resolve) => {
      const check = () => (!this.alive() || (!this.popBusy && !this.popQ.length) ? resolve() : this.time.delayedCall(80, check));
      check();
    });
  }

  async showPopup(spec) {
    const backlog = this.popQ.length;
    const hold = spec.hold ?? (backlog >= 3 ? 240 : backlog === 2 ? 340 : backlog === 1 ? 480 : 780);
    const col = Phaser.Display.Color.HexStringToColor(spec.color).color;
    const c = this.add.container(TABLE_CX, POP_Y).setDepth(Z.fx).setAlpha(0);

    const label = this.add.text(0, 0, spec.text, {
      fontFamily: UI.FONT, fontSize: `${spec.size}px`, fontStyle: '900', color: spec.color,
      stroke: '#000000', strokeThickness: Math.max(4, Math.round(spec.size / 8)),
    }).setOrigin(0.5);
    let sub = null;
    if (spec.sub) sub = this.add.text(0, 0, spec.sub, { fontFamily: UI.FONT, fontSize: '14px', fontStyle: 'bold', color: '#f3ead2' }).setOrigin(0.5);

    const w = Math.max(label.width, sub ? sub.width : 0) + 56;
    const h = label.height + 14 + (sub ? sub.height + 10 : 0);
    const r = Math.min(h / 2, 30);
    const bg = this.add.graphics();
    bg.fillStyle(0x040d08, 0.74).fillRoundedRect(-w / 2, -h / 2, w, h, r);
    bg.lineStyle(2, col, 0.9).strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    c.add([bg, label]);
    label.setY(sub ? -h / 2 + (label.height + 14) / 2 : 0);
    if (sub) { sub.setY(h / 2 - (sub.height + 10) / 2 - 2); c.add(sub); }

    const fit = Math.min(1, 440 / w);
    c.setScale(0.86 * fit);
    this.popLive++; this.popMax = Math.max(this.popMax, this.popLive);
    if (spec.onShow) spec.onShow();
    await this.tweenP({ targets: c, alpha: 1, scale: fit, duration: 170, ease: 'Back.out' });
    if (spec.afterIn) spec.afterIn();
    await this.wait(hold);
    await this.tweenP({ targets: c, alpha: 0, y: POP_Y - 16, duration: 210, ease: 'Quad.in' });
    c.destroy();
    this.popLive--;
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
    for (let i = 0; i < 52; i++) {
      const r = this.add.rectangle(Phaser.Math.Between(100, 800), -20, 8, 13, Phaser.Math.RND.pick(cols)).setDepth(Z.fx + 20).setAngle(Phaser.Math.Between(0, 180));
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
  /* HUD refresh                                                         */
  /* ------------------------------------------------------------------ */
  updateHud() {
    const s = this.state;
    const humanTurn = this.isHumanTurn() && !this.busy;

    // punishment (top-middle capsule)
    const pun = s.pendingPunishment;
    this.punText.setText(String(pun)).setColor(pun > 0 ? '#ff5a5a' : '#4d6b5d');
    this.punLabel.setColor(pun > 0 ? '#ffb0b0' : '#8fb09e');
    this.drawHud(pun > 0);
    if (pun !== this.lastPun) {
      this.tweens.add({ targets: this.punText, scale: { from: pun > this.lastPun ? 1.8 : 1.3, to: 1 }, duration: 320, ease: 'Back.out' });
      if (pun > this.lastPun) this.tweens.add({ targets: this.hud, y: { from: 24, to: 30 }, duration: 260, ease: 'Bounce.out' });
      this.lastPun = pun;
    }

    // direction
    this.dirText.setText(s.direction === 1 ? 'Clockwise' : 'Reversed');
    if (s.direction !== this.lastDirection) {
      this.tweens.add({ targets: this.dirIcon, scaleX: s.direction === 1 ? 1 : -1, duration: 360, ease: 'Back.out' });
      this.tweens.add({ targets: this.dirText, scale: { from: 1.3, to: 1 }, duration: 300, ease: 'Back.out' });
    }
    this.lastDirection = s.direction;

    // opponents' cards bob while they think
    this.seats.forEach((seat) => {
      if (seat.local) return;
      const thinking = s.winnerIndex == null && !this.dealing && s.currentPlayerIndex === seat.index && s.turnStarted && !this.busy;
      this.setSeatIdle(seat, thinking);
    });
    this.refreshSeats();

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

    const showPass = humanTurn && !!s.drawnCardId;
    this.passBtn.setVisible(showPass);

    if (showPass && !this.passTimer) {
      // 4-second auto-pass countdown: a draining bar under the Pass button
      this.passTimerRing = this.add.graphics().setDepth(59);
      const bx = this.passBtn.x, by = this.passBtn.y + 30, bw = 104;
      this.passTimer = this.tweens.addCounter({
        from: 1,
        to: 0,
        duration: 4000,
        onUpdate: (tween) => {
          const v = tween.getValue();
          const g = this.passTimerRing;
          if (!g || !g.scene) return;
          g.clear();
          g.fillStyle(0x000000, 0.5).fillRoundedRect(bx - bw / 2, by - 3, bw, 6, 3);
          if (v > 0) {
            const col = v < 0.3 ? 0xd62828 : v < 0.6 ? 0xf77f00 : 0x28a745;
            g.fillStyle(col, 0.95).fillRoundedRect(bx - bw / 2, by - 3, bw * v, 6, 3);
          }
        },
        onComplete: () => {
          // AUTO PASS!
          if (this.isHumanTurn() && this.state.drawnCardId) this.perform({ type: 'pass' });
          this.clearPassTimer();
        },
      });
    } else if (!showPass && this.passTimer) {
      // played the card or passed manually: kill the timer
      this.clearPassTimer();
    }

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

    this.seats.forEach((seat) => {
      if (seat.local) return;
      const bn = s.players[seat.index].hand.length;
      while (seat.cards.length > bn) { const sp = seat.cards.pop(); this.tweens.killTweensOf(sp); this.tweens.killTweensOf(sp.inner); sp.destroy(); }
      while (seat.cards.length < bn) seat.cards.push(this.makeSeatCard(seat, seat.fan.x, seat.fan.y));
      this.layoutSeat(seat);
      seat.idleOn = false;
    });

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
    const total = st.players.reduce((a, p) => a + p.hand.length, 0);
    this.vw.drawCount = st.drawPile.length + total + 1;
    this.updateDrawPile();
    this.updateSuitUI(st.currentSuit, false);
    this.suitText.setText(''); this.suitPill.clear();
    this.refreshSeats();
    this.updateHud();
    this.sfx('sfx_rg');

    // a little shuffle shimmy of the deck before dealing
    await this.tweenP({ targets: this.drawPileC, angle: { from: -4, to: 4 }, duration: 70, yoyo: true, repeat: 3 });
    this.drawPileC.setAngle(0);
    if (!this.alive()) return;

    // create every dealt card at the deck, face-down
    const perPlayer = st.players.map((p, i) => {
      const seat = this.seats[i];
      if (seat.local) {
        return p.hand.map((c) => { this.vw.human.push(c); const sp = this.spawnHandCard(c, DRAW_X, PILE_Y, 'card_back'); sp.flying = true; sp.setDepth(Z.fly); return { sp, card: c, seat }; });
      }
      return p.hand.map(() => { const sp = this.makeSeatCard(seat, DRAW_X, PILE_Y); sp.flying = true; sp.setDepth(Z.fly); seat.cards.push(sp); return { sp, seat }; });
    });
    this.layoutHand(); this.seats.forEach((s) => { if (!s.local) this.layoutSeat(s); });

    const jobs = [];
    let k = 0;
    const rounds = Math.max(...st.players.map((p) => p.hand.length));
    for (let r = 0; r < rounds; r++) {
      perPlayer.forEach((list) => {
        const it = list[r];
        if (!it) return;
        const delay = k * 125; k++;
        const human = it.seat.local;
        jobs.push(this.wait(delay).then(() => { this.vw.drawCount--; this.updateDrawPile(); this.refreshSeat(it.seat); }));
        jobs.push(this.flyCard(it.sp, {
          x: it.sp.slot.x, y: it.sp.slot.y, angle: it.sp.slot.angle, scale: human ? 1 : it.seat.fan.scale, delay, dur: 330, arc: 18,
          flipKey: human ? it.card.id : null, depth: Z.fly + k,
        }).then(() => { it.sp.setDepth(it.sp.slot.depth); this.settle(it.sp); }));
      });
    }
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
    this.showToast(msg, '#ff6b6b', 536);
    this.shakeSprites([sp], 6);
  }

  onCardTap(sp) {
    if (this.busy || this.paused || !this.isHumanTurn() || this.modal) return;
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
      this.sfx('sfx_win', 1.0);
      this.announce(humanWon ? 'YOU WIN!' : `${s.players[s.winnerIndex].name} wins`, humanWon ? '#e8b923' : '#ff6b6b', 52, { prio: 2, hold: 1000 });
      this.popupIdle().then(() => {
        if (!this.alive()) return;
        this.time.delayedCall(250, () => {
          this.cameras.main.fadeOut(380, 0, 0, 0);
          this.time.delayedCall(400, () => this.scene.start('WinScene', {
            winnerIndex: s.winnerIndex,
            winnerName: s.players[s.winnerIndex].name,
            humanWon,
            humanName: this.options.humanName,
            botName: this.options.botName,
            names: s.players.map((p) => p.name),     // every player, for the scoreboard
            localIndex: this.humanIndex,
            players: this.options.players,           // roster, so Rematch keeps the same table
            scores: s.scores,
          }));
        });
      });
      return;
    }

    // Bots announce "Niko Cardi!" automatically when their last card is a winning one
    s.players.forEach((p, i) => {
      if (p.isBot && p.hand.length === 1 && !this.state.declaredNikoCardi[i]) {
        if (!Rules.isSpecial(p.hand[0])) {
          this.state = Rules.applyMove(this.state, { type: 'declare', playerIndex: i });
          this.sfx('niko_audio', 1);
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
      this.announce('NO ANSWER!', '#ff6b6b', 40);
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
    if (next.events.some((e) => e.type === 'foul')) this.announce('FORGOT NIKO!  +1', '#ff6b6b', 36);
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
      this.showToast(e.message, '#ff6b6b', 536);
      return;
    }
    const mover = this.state.currentPlayerIndex;
    this.clearPassTimer();
    this.busy = true;
    this.clearToasts();
    this.render();
    if (move.type === 'pass') this.seatAction(mover, 'Passed');
    await this.playEvents(next.events);
    if (!this.alive()) return;
    this.state = next;
    this.busy = false;
    this.render();
    this.advance();
  }

  /* ------------------------------------------------------------------ */
  /* event animations (+ sounds + plate status)                          */
  /* ------------------------------------------------------------------ */
  async playEvents(events = []) {
    for (let i = 0; i < events.length; i++) {
      if (!this.alive()) return;
      const e = events[i];
      if (e.type === 'play') {
        const batch = [e];
        while (events[i + 1] && events[i + 1].type === 'play' && events[i + 1].player === e.player) batch.push(events[++i]);
        await this.animPlayBatch(batch, events[i + 1]);
      } else if (e.type === 'draw') await this.animDraw(e);
      else if (e.type === 'reshuffle') await this.animReshuffle();
      else if (e.type === 'foul') await this.animFoul(e);
      else if (e.type === 'suit') await this.animSuit(e);
      else if (e.type === 'score') await this.animScore(e);
    }
  }

  flyPlayed(e, k) {
    const seat = this.seats[e.player];
    const human = seat.local;
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
      const idx = seat.cards.length ? Phaser.Math.Between(0, seat.cards.length - 1) : -1;
      sp = idx >= 0 ? seat.cards.splice(idx, 1)[0] : this.makeSeatCard(seat, seat.fan.x, seat.fan.y);
      this.layoutSeat(seat, 260);
    }
    this.refreshSeat(seat);
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

  async animPlayBatch(batch, next) {
    const pendBefore = this.state.pendingPunishment;
    const who = batch[0].player;
    await Promise.all(batch.map((e, k) => this.flyPlayed(e, k)));
    if (!this.alive()) return;
    const last = batch[batch.length - 1].card;
    const n = batch.length;
    const sym = Rules.SUIT_SYMBOLS[last.suit];
    const times = n > 1 ? ` ×${n}` : '';

    if (last.rank === 'king') { this.seatAction(who, `Kickback ${sym}${times}`); this.cameras.main.shake(140, 0.003); await this.announce('KICKBACK!', '#7ad7ff'); }
    else if (last.rank === 'jack') { this.seatAction(who, `Jump ${sym}${times}`); await this.announce('JUMP!', '#ffd166'); }
    else if (last.rank === '3') { this.seatAction(who, `Foul ${sym}${times}`); this.cameras.main.shake(180, 0.004); await this.announce(`FOUL!  +${3 * n}`, '#ff6b6b'); }
    else if (last.rank === 'ace') {
      const cancels = pendBefore > 0 && Rules.resolvePunishment(pendBefore, n) === 0;
      const suitNext = !!(next && next.type === 'suit' && next.player === who);
      if (cancels) { this.seatAction(who, 'Cancelled!'); this.flash(0x2fa36b, 0.18); }
      if (suitNext) this.acePrefix = cancels ? 'CANCELLED' : (n > 1 ? `ACE ×${n}` : 'ACE');   // merged into the suit pop-up
      else if (cancels) await this.announce('CANCELLED!', '#6df0a8');
      else await this.announce(n > 1 ? `ACE ×${n}` : 'ACE!', '#e8b923');
    } else {
      this.seatAction(who, `Played ${last.displayName} ${sym}${times}`);
      if (n > 1) await this.announce(`${['', '', 'DOUBLE', 'TRIPLE', 'QUAD'][n] || 'COMBO'}  ×${n}`, '#cfe3d8', 36, { prio: 0 });
    }
  }

  async animDraw(e) {
    const seat = this.seats[e.player];
    const human = seat.local;
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
      cards.forEach(() => { const sp = this.makeSeatCard(seat, DRAW_X, PILE_Y); sp.flying = true; sp.setDepth(Z.fly); seat.cards.push(sp); sprites.push(sp); });
      this.layoutSeat(seat, 300);
    }
    this.vw.drawCount = Math.max(0, this.vw.drawCount - cards.length);
    this.updateDrawPile();
    this.tweens.add({ targets: this.drawPileC, scale: { from: 1.08, to: 1 }, duration: 220 });

    const nC = cards.length;
    this.seatAction(e.player, e.reason === 'punishment' ? `Took ${nC}` : e.reason === 'foul' ? `Foul!  +${nC}` : (nC > 1 ? `Drew ${nC} cards` : 'Drew a card'));
    if (punish) {
      this.sfx('sfx_pt');
      this.floatLabel(`+${nC}`, seat.anchor.x, seat.anchor.y + (seat.local ? -50 : 50), '#ff6b6b');
      this.flash(0xff2a2a, 0.16);
    }

    await Promise.all(sprites.map((sp, i) => this.flyCard(sp, {
      x: sp.slot.x, y: sp.slot.y, angle: sp.slot.angle, scale: human ? 1 : seat.fan.scale,
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
      this.refreshSeat(seat);
    })));
    if (!this.alive()) return;
    if (human) this.refreshHand();
    await this.wait(80);
  }

  async animReshuffle() {
    this.sfx('sfx_rg');
    this.announce('RESHUFFLING', '#cfe3d8', 24, { prio: 0, hold: 360, pace: 0 });
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
    const seat = this.seats[e.player];
    this.cameras.main.shake(160, 0.004);
    await this.shakeSprites(seat.local ? [...this.handSprites.values()] : seat.cards, 8);
  }

  async animSuit(e) {
    this.vw.suit = e.suit;
    this.updateSuitUI(e.suit);
    this.seatAction(e.player, `Ace → ${Rules.SUIT_SYMBOLS[e.suit]} ${this.suitName(e.suit)}`);
    const prefix = this.acePrefix || 'ACE';
    this.acePrefix = null;
    await this.announce(`${prefix}  →  ${Rules.SUIT_SYMBOLS[e.suit]} ${this.suitName(e.suit)}`, this.suitColorCss(e.suit), 34);
  }

  async animScore(e) {
    const isHuman = e.player === this.humanIndex;
    const reasons = e.reasons ? e.reasons.join('  |  ') : '';
    const who = isHuman ? 'YOU' : String(this.seats[e.player].player.name).toUpperCase();
    return this.queuePopup({
      text: `+${e.points} POINTS`, color: '#ffd54a', size: 42, sub: reasons ? `${who}  ·  ${reasons}` : who,
      prio: 2, hold: 1500, pace: 500,
      onShow: () => this.sfx('sfx_score', 0.9),
      afterIn: () => this.cameras.main.shake(120, 0.004),
    });
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
  /* PAUSE MENU                                                          */
  /* ------------------------------------------------------------------ */
  onEsc() {
    if (this.paused) { if (this.pauseMode === 'moves') this.showPauseMain(); else this.closePause(); }
    else this.openPause();
  }

  openPause() {
    if (this.paused || this.modal || this.dead) return;
    this.paused = true;
    // freeze everything that is running; the menu's own tweens are created after this
    this.frozenTweens = this.tweens.getTweens().filter((t) => !t.isPaused());
    this.frozenTweens.forEach((t) => t.pause());
    this.time.paused = true;
    this.handSprites.forEach((sp) => { sp.hover = false; });
    this.pauseTweens = [];
    this.leaveArmed = false;

    const { W, H } = UI;
    const layer = this.add.container(0, 0).setDepth(Z.pause);
    this.pauseLayer = layer;
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setInteractive();
    this.pt({ targets: dim, fillAlpha: 0.74, duration: 220 });
    layer.add(dim);
    this.showPauseMain(true);
  }

  closePause() {
    if (!this.paused) return;
    this.pauseTweens.forEach((t) => { if (t && t.stop) t.stop(); });
    this.pauseTweens = [];
    this.scroll = null;
    if (this.listMask) { this.listMask.destroy(); this.listMask = null; }
    if (this.pauseLayer) { this.pauseLayer.destroy(); this.pauseLayer = null; }
    this.pauseView = null;
    this.paused = false;
    this.time.paused = false;
    (this.frozenTweens || []).forEach((t) => { if (t.isPaused && t.isPaused()) t.resume(); });
    this.frozenTweens = [];
    this.triggerHint();
  }

  /** shared look for a panel */
  pausePanel(w, h, title) {
    const { FONT } = UI;
    const v = this.add.container(UI.W / 2, UI.H / 2);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.5).fillRoundedRect(-w / 2 + 4, -h / 2 + 10, w, h, 22);
    g.fillStyle(0x0c1d15, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 22);
    g.fillStyle(0x16382a, 1).fillRoundedRect(-w / 2, -h / 2, w, 78, { tl: 22, tr: 22, bl: 0, br: 0 });
    g.lineStyle(2.5, GOLD, 0.95).strokeRoundedRect(-w / 2, -h / 2, w, h, 22);
    g.lineStyle(1, 0xe8b923, 0.25).strokeRoundedRect(-w / 2 + 7, -h / 2 + 7, w - 14, h - 14, 17);
    g.lineStyle(1.5, 0x2e5242, 1).lineBetween(-w / 2 + 1, -h / 2 + 78, w / 2 - 1, -h / 2 + 78);
    const t = this.add.text(0, -h / 2 + 39, title, { fontFamily: FONT, fontSize: '28px', fontStyle: '900', color: '#e8b923' }).setOrigin(0.5).setLetterSpacing(6);
    v.add([g, t]);
    return v;
  }

  pauseButton(parent, x, y, w, h, label, kind, onClick, sub) {
    const { FONT } = UI;
    const c = this.add.container(x, y);
    const bg = this.add.graphics();
    const pal = {
      primary: { f: 0xe8b923, h: 0xf5cd3c, b: 0x7a5c00, t: '#241900' },
      secondary: { f: 0x15382a, h: 0x1d4a37, b: 0x2e5242, t: '#f3ead2' },
      danger: { f: 0x2a1212, h: 0x3d1818, b: 0x6b2a2a, t: '#ff9b9b' },
    }[kind];
    const draw = (hover) => {
      bg.clear();
      bg.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2 + 2, -h / 2 + 4, w, h, 14);
      bg.fillStyle(hover ? pal.h : pal.f, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
      bg.lineStyle(2, pal.b, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
      if (kind === 'primary') bg.fillStyle(0xffffff, 0.18).fillRoundedRect(-w / 2 + 4, -h / 2 + 3, w - 8, h / 2 - 3, { tl: 11, tr: 11, bl: 0, br: 0 });
    };
    draw(false);
    const t = this.add.text(sub ? -w / 2 + 22 : 0, sub ? -8 : 0, label, { fontFamily: FONT, fontSize: kind === 'primary' ? '24px' : '20px', fontStyle: '900', color: pal.t }).setOrigin(sub ? 0 : 0.5, 0.5);
    c.add([bg, t]);
    if (sub) {
      const s = this.add.text(-w / 2 + 22, 13, sub, { fontFamily: FONT, fontSize: '12px', color: '#8fb09e', wordWrap: { width: w - 120 } }).setOrigin(0, 0.5);
      c.add(s);
      c.sub = s;
    }
    c.label = t; c.draw = draw;
    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on('pointerover', () => { draw(true); this.pt({ targets: c, scale: 1.03, duration: 90 }); });
    c.on('pointerout', () => { draw(false); this.pt({ targets: c, scale: 1, duration: 90 }); });

    // --- THE FIX: Added sound trigger here ---
    c.on('pointerdown', () => {
      if (this.cache.audio.exists('sfx_click')) {
        this.sound.play('sfx_click', { volume: 1 });
      }
      this.pt({ targets: c, scale: { from: 0.96, to: 1 }, duration: 140 });
      onClick(c);
    });

    parent.add(c);
    return c;
  }
  clearPauseView() {
    if (this.pauseView) { this.pauseView.destroy(); this.pauseView = null; }
    if (this.listMask) { this.listMask.destroy(); this.listMask = null; }
    this.scroll = null;
  }

  showPauseMain(first) {
    const { FONT } = UI;
    this.clearPauseView();
    this.pauseMode = 'main';
    const v = this.pausePanel(380, 470, 'PAUSED');
    this.pauseView = v;
    this.pauseLayer.add(v);

    const log = this.state.log || [];
    let last = log.length ? log[log.length - 1] : 'No moves yet';
    if (last.length > 27) last = last.slice(0, 26) + '…';      // one line only, so it never collides with the label
    this.pauseButton(v, 0, -104, 300, 62, 'Resume', 'primary', () => this.closePause());
    const mv = this.pauseButton(v, 0, -28, 300, 62, 'Moves', 'secondary', () => this.showMoves(), last);
    // chevron + count chip
    const chev = this.add.graphics();
    chev.lineStyle(3, GOLD, 1).beginPath().moveTo(118, -9).lineTo(128, 0).lineTo(118, 9).strokePath();
    mv.add(chev);
    const chip = this.add.container(86, 0);
    const cg = this.add.graphics(); cg.fillStyle(0x0b1a13, 1).fillRoundedRect(-16, -11, 32, 22, 11).lineStyle(1.5, GOLD, 1).strokeRoundedRect(-16, -11, 32, 22, 11);
    chip.add([cg, this.add.text(0, 0, String(log.length), { fontFamily: FONT, fontSize: '12px', fontStyle: '900', color: '#f3ead2' }).setOrigin(0.5)]);
    mv.add(chip);

    this.pauseButton(v, 0, 48, 300, 62, 'Settings', 'secondary', () => this.openSettings());

    // sound switch row
    const row = this.add.container(0, 124);
    const rg = this.add.graphics();
    rg.fillStyle(0x0f2a1f, 1).fillRoundedRect(-150, -26, 300, 52, 14).lineStyle(2, 0x2e5242, 1).strokeRoundedRect(-150, -26, 300, 52, 14);
    const rl = this.add.text(-128, 0, 'Sound', { fontFamily: FONT, fontSize: '20px', fontStyle: '900', color: '#f3ead2' }).setOrigin(0, 0.5);
    const track = this.add.graphics();
    const knob = this.add.circle(0, 0, 11, 0xffffff);
    const stateT = this.add.text(70, 0, '', { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#8fb09e' }).setOrigin(1, 0.5);
    const paint = () => {
      const on = !this.muted;
      track.clear().fillStyle(on ? 0x2fa36b : 0x3a4a42, 1).fillRoundedRect(84, -13, 50, 26, 13).lineStyle(2, on ? 0x145c3a : 0x25302b, 1).strokeRoundedRect(84, -13, 50, 26, 13);
      stateT.setText(on ? 'ON' : 'OFF').setColor(on ? '#6df0a8' : '#8fb09e');
    };
    paint();
    knob.setPosition(this.muted ? 97 : 121, 0);
    row.add([rg, rl, track, stateT, knob]);
    row.setSize(300, 52).setInteractive({ useHandCursor: true });
    row.on('pointerdown', () => {
      this.muted = !this.muted;
      try { this.sound.mute = this.muted; } catch (e) { /* ignore */ }
      paint();
      this.pt({ targets: knob, x: this.muted ? 97 : 121, duration: 140, ease: 'Back.out' });
    });
    v.add(row);

    // leave table (asks twice)
    const leave = this.pauseButton(v, 0, 196, 300, 44, 'Leave table', 'danger', (b) => {
      if (!this.leaveArmed) {
        this.leaveArmed = true;
        b.label.setText('Tap again to leave');
        this.pt({ targets: b, scale: { from: 1.06, to: 1 }, duration: 200 });
        this.pt({ targets: b, alpha: 1, delay: 2400, duration: 10, onComplete: () => { this.leaveArmed = false; if (b.label.scene) b.label.setText('Leave table'); } });
      } else { this.leaveArmed = false; this.scene.start('MainMenuScene'); }
    });
    leave.label.setFontSize('17px');

    this.pauseNoteT = this.add.text(0, 224, '', { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#ffd166' }).setOrigin(0.5);
    v.add(this.pauseNoteT);

    if (first) { v.setScale(0.9).setAlpha(0); this.pt({ targets: v, scale: 1, alpha: 1, duration: 240, ease: 'Back.out' }); }
    else { v.setAlpha(0); this.pt({ targets: v, alpha: 1, duration: 160 }); }
  }

  pauseNote(text) {
    if (!this.pauseNoteT || !this.pauseNoteT.scene) return;
    this.pauseNoteT.setText(text).setAlpha(1);
    this.pt({ targets: this.pauseNoteT, alpha: 0, delay: 1600, duration: 400 });
  }

  openSettings() {
    const has = this.scene.manager && this.scene.manager.keys && this.scene.manager.keys['SettingsScene'];
    if (!has) { this.pauseNote('Settings coming soon'); return; }

    // Put the game to sleep (freezes it) and launch settings on top
    this.scene.sleep();
    this.scene.launch('SettingsScene', { returnScene: 'GameScene' });
  }
  /* ---------- Moves (full log) ---------- */
  actorOf(line) {
    for (const seat of this.seats) {
      const nm = seat.player.name;
      if (nm && (line.startsWith(nm + ' ') || line.startsWith(nm + ':'))) return seat;
    }
    return null;
  }

  showMoves() {
    const { FONT } = UI;
    this.clearPauseView();
    this.pauseMode = 'moves';
    const w = 560, h = 560;
    const v = this.pausePanel(w, h, 'MOVES');
    this.pauseView = v;
    this.pauseLayer.add(v);

    // back button
    const back = this.add.container(-w / 2 + 64, -h / 2 + 39);
    const bg = this.add.graphics();
    const drawBack = (hv) => { bg.clear().fillStyle(hv ? 0x2f6b51 : 0x143528, 1).fillRoundedRect(-46, -17, 92, 34, 17).lineStyle(2, GOLD, 1).strokeRoundedRect(-46, -17, 92, 34, 17); };
    drawBack(false);
    const bt = this.add.text(4, 0, 'Back', { fontFamily: FONT, fontSize: '16px', fontStyle: '900', color: '#f3ead2' }).setOrigin(0.5);
    const arrow = this.add.graphics().lineStyle(3, GOLD, 1).beginPath().moveTo(-20, -7).lineTo(-28, 0).lineTo(-20, 7).strokePath();
    back.add([bg, arrow, bt]).setSize(92, 34).setInteractive({ useHandCursor: true });
    back.on('pointerover', () => drawBack(true)); back.on('pointerout', () => drawBack(false));
    back.on('pointerdown', () => this.showPauseMain());
    v.add(back);

    const log = this.state.log || [];
    const count = this.add.text(w / 2 - 28, -h / 2 + 39, `${log.length} move${log.length === 1 ? '' : 's'}`, { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#8fb09e' }).setOrigin(1, 0.5);
    v.add(count);

    // scrolling list
    const lx = -w / 2 + 24, ly = -h / 2 + 96, lw = w - 48, lh = h - 96 - 30;
    const content = this.add.container(0, 0);
    v.add(content);
    let y = 0;
    const rows = log.length ? log : ['No moves yet — make the first one!'];
    rows.forEach((line, idx) => {
      const seat = this.actorOf(line);
      const col = seat ? seat.color : 0x6f8f7d;
      const tx = this.add.text(lx + 58, 0, line, { fontFamily: FONT, fontSize: '15px', color: seat ? '#f3ead2' : '#9fbfae', wordWrap: { width: lw - 120 }, lineSpacing: 2 }).setOrigin(0, 0.5);
      const rh = Math.max(46, tx.height + 22);
      const rowG = this.add.graphics();
      rowG.fillStyle(idx % 2 ? 0x0f261c : 0x12301f, 0.9).fillRoundedRect(lx, y, lw - 14, rh - 6, 10);
      rowG.fillStyle(col, 1).fillRoundedRect(lx, y, 5, rh - 6, { tl: 10, bl: 10, tr: 0, br: 0 });
      const dot = this.add.circle(lx + 30, y + (rh - 6) / 2, 13, Phaser.Display.Color.ValueToColor(col).darken(50).color).setStrokeStyle(2, col);
      const ini = this.add.text(lx + 30, y + (rh - 6) / 2, seat ? seat.player.name.charAt(0).toUpperCase() : '•', { fontFamily: FONT, fontSize: '14px', fontStyle: '900', color: '#f3ead2' }).setOrigin(0.5);
      tx.setY(y + (rh - 6) / 2);
      const num = this.add.text(lx + lw - 24, y + (rh - 6) / 2, String(idx + 1), { fontFamily: FONT, fontSize: '11px', color: '#4d6b5d', fontStyle: 'bold' }).setOrigin(1, 0.5);
      content.add([rowG, dot, ini, tx, num]);
      y += rh;
    });

    // clip the list and make it scrollable (wheel, drag, scrollbar)
    const maskG = this.make.graphics({ x: 0, y: 0, add: false });
    maskG.fillStyle(0xffffff).fillRect(UI.W / 2 + lx, UI.H / 2 + ly, lw, lh);
    this.listMask = maskG;
    content.setMask(maskG.createGeometryMask());
    const track = this.add.graphics();
    track.fillStyle(0x1b3a2d, 1).fillRoundedRect(lx + lw - 8, ly, 6, lh, 3);
    const thumb = this.add.graphics();
    v.add([track, thumb]);

    const max = Math.max(0, y - lh);
    this.scroll = { y: max, max, content, thumb, ly, lh, lx, lw, total: y, drag: false };
    this.applyScroll();
    // zone for dragging the list on touch screens
    const zone = this.add.zone(lx + (lw - 14) / 2, ly + lh / 2, lw - 14, lh).setInteractive();
    zone.on('pointerdown', (p) => { if (this.scroll) { this.scroll.drag = true; this.scroll.sy = p.y; this.scroll.s0 = this.scroll.y; } });
    v.add(zone);

    v.setAlpha(0); v.setScale(0.96);
    this.pt({ targets: v, alpha: 1, scale: 1, duration: 200, ease: 'Quad.out' });
  }

  applyScroll() {
    const sc = this.scroll;
    if (!sc) return;
    sc.y = Phaser.Math.Clamp(sc.y, 0, sc.max);
    sc.content.setY(sc.ly - sc.y);
    sc.thumb.clear();
    if (sc.max > 0) {
      const th = Math.max(34, sc.lh * (sc.lh / sc.total));
      const ty = sc.ly + (sc.lh - th) * (sc.y / sc.max);
      sc.thumb.fillStyle(GOLD, 0.9).fillRoundedRect(sc.lx + sc.lw - 8, ty, 6, th, 3);
    }
  }

  onWheel(pointer, objs, dx, dy) { if (this.scroll) { this.scroll.y += dy * 0.6; this.applyScroll(); } }
  onPtrMove(p) { const sc = this.scroll; if (sc && sc.drag && p.isDown) { sc.y = sc.s0 - (p.y - sc.sy); this.applyScroll(); } }
  onPtrUp() { if (this.scroll) this.scroll.drag = false; }

  /* ------------------------------------------------------------------ */
  update(time, delta) {
    if (!this.paused) this.clock += delta;
    // pulsing gold outline on playable cards, solid on selected ones
    const a = 0.45 + 0.4 * Math.sin(time / 260);
    this.handSprites.forEach((sp) => {
      if (!sp.glow || sp.flying) return;
      if (sp.glowMode === 2) sp.glow.setAlpha(1);
      else if (sp.glowMode === 1) sp.glow.setAlpha(a * 0.75);
    });
    // direction ring slowly turns the way play is going
    if (this.dirIcon && this.state && !this.paused) this.dirIcon.angle += this.state.direction * delta * 0.04;
  }
}
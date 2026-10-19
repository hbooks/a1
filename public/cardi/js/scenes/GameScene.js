/* =====================================================================
 * GameScene — renders state from the Rules engine and drives turns.
 * The scene never decides rules: it asks Rules/Bot and animates events.
 * ===================================================================== */
const BOT_Y = 92;
const HAND_Y = 600;
const PILE_Y = 330;
const DRAW_X = 255;
const DISCARD_X = 445;
const TABLE_CX = 350;

class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init(data) {
    this.options = { humanName: 'You', botName: 'Mzalendo', ...data };
  }

  create() {
    UI.drawFelt(this);
    this.humanIndex = 0;
    this.state = GameStateMgr.createGame([
      { name: this.options.humanName, isBot: false },
      { name: this.options.botName, isBot: true },
    ]);
    this.busy = false;
    this.temps = [];
    this.cardSprites = {};
    this.lastSuit = null;
    this.lastDirection = 1;
    this.nikoWindow = null;
    this.buildStaticUI();
    this.dyn = this.add.container(0, 0);
    this.render();
    this.time.delayedCall(600, () => this.advance());
  }

  /* ------------------------------ helpers ---------------------------- */
  wait(ms) { return new Promise((r) => this.time.delayedCall(ms, r)); }
  tweenP(cfg) { return new Promise((r) => this.tweens.add({ ...cfg, onComplete: r })); }
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
    return this.state.pendingPunishment > 0 || this.humanLegalIds().size === 0;
  }

  /* --------------------------- static UI ----------------------------- */
  buildStaticUI() {
    const { FONT } = UI;
    // Side panel
    const p = this.add.graphics();
    p.fillStyle(0x000000, 0.35).fillRoundedRect(710, 14, 176, 672, 16);
    p.lineStyle(2, 0xe8b923, 0.6).strokeRoundedRect(710, 14, 176, 672, 16);
    this.add.text(798, 44, 'CARDI', { fontFamily: FONT, fontSize: '30px', fontStyle: '900', color: '#e8b923' }).setOrigin(0.5);
    const label = (y, t) => this.add.text(725, y, t, { fontFamily: FONT, fontSize: '13px', color: '#9fbfae', fontStyle: 'bold' });
    label(86, 'DIRECTION');
    this.dirText = this.add.text(798, 124, '', { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#f3ead2', align: 'center' }).setOrigin(0.5);
    label(170, 'PUNISHMENT');
    this.punText = this.add.text(798, 222, '0', { fontFamily: FONT, fontSize: '56px', fontStyle: '900', color: '#4d6b5d' }).setOrigin(0.5);
    label(278, 'TABLE LOG');
    this.logText = this.add.text(725, 300, '', { fontFamily: FONT, fontSize: '14px', color: '#f3ead2', wordWrap: { width: 148 }, lineSpacing: 6 });
    UI.makeButton(this, 798, 650, 'Menu', () => this.scene.start('MainMenuScene'), { width: 130, height: 40, fontSize: '18px', fill: 0x24543f, hoverFill: 0x2f6b51, color: '#f3ead2', border: 0xe8b923 });

    // Suit glow ring around discard pile
    this.glow = this.add.graphics();
    this.glowTween = this.tweens.add({ targets: this.glow, alpha: 0.45, duration: 900, yoyo: true, repeat: -1 });
    // Draw-pile highlight
    this.drawGlow = this.add.graphics();
    this.drawGlow.lineStyle(4, 0xe8b923, 1).strokeRoundedRect(DRAW_X - 50, PILE_Y - 68, 100, 136, 14);
    this.drawGlow.setVisible(false);
    this.tweens.add({ targets: this.drawGlow, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
    this.drawZone = this.add.zone(DRAW_X, PILE_Y, 96, 130).setInteractive({ useHandCursor: true });
    this.drawZone.on('pointerdown', () => { if (this.canHumanDraw()) this.perform({ type: 'draw' }); });

    this.suitText = this.add.text(DISCARD_X, PILE_Y + 86, '', { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#f3ead2' }).setOrigin(0.5);
    this.drawCount = this.add.text(DRAW_X, PILE_Y + 86, '', { fontFamily: FONT, fontSize: '14px', color: '#9fbfae' }).setOrigin(0.5);
    this.botLabel = this.add.text(TABLE_CX, 170, '', { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#f3ead2' }).setOrigin(0.5);
    this.turnText = this.add.text(TABLE_CX, 215, '', { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#e8b923' }).setOrigin(0.5);
    this.hintText = this.add.text(TABLE_CX, 448, '', { fontFamily: FONT, fontSize: '15px', color: '#cfe3d8', align: 'center' }).setOrigin(0.5);

    // Pass button (after drawing a playable card)
    this.passBtn = UI.makeButton(this, 590, 448, 'Pass', () => {
      if (this.isHumanTurn() && !this.busy && this.state.drawnCardId) this.perform({ type: 'pass' });
    }, { width: 110, height: 40, fontSize: '18px' }).setVisible(false);

    // Niko Cardi button
    this.niko = this.add.container(TABLE_CX, 470).setDepth(60).setVisible(false);
    const ng = this.add.graphics();
    ng.fillStyle(0xe8b923, 0.25).fillRoundedRect(-130, -36, 260, 72, 22);
    ng.fillStyle(0xd62828, 1).fillRoundedRect(-118, -28, 236, 56, 18);
    ng.lineStyle(4, 0xe8b923, 1).strokeRoundedRect(-118, -28, 236, 56, 18);
    const nt = this.add.text(0, 0, 'Niko Cardi!', { fontFamily: FONT, fontSize: '28px', fontStyle: '900', color: '#ffffff' }).setOrigin(0.5);
    this.niko.add([ng, nt]).setSize(236, 56).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: this.niko, scale: 1.08, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.niko.on('pointerdown', () => this.declareNiko());
  }

  /* ----------------------------- render ------------------------------ */
  render() {
    const s = this.state;
    const { CW, CH } = UI;
    this.temps.forEach((t) => t.destroy());
    this.temps = [];
    this.dyn.each((c) => this.tweens.killTweensOf(c));
    this.dyn.removeAll(true);
    this.cardSprites = {};

    // Bot hand (face down, fanned)
    const bot = s.players[1];
    const bn = bot.hand.length;
    const bs = Math.min(44, 440 / Math.max(bn, 1));
    bot.hand.forEach((_, i) => {
      const off = i - (bn - 1) / 2;
      this.dyn.add(this.add.image(TABLE_CX + off * bs, BOT_Y + Math.abs(off) * 2, 'card_back').setDisplaySize(CW * 0.8, CH * 0.8).setAngle(-off * Math.min(3, 24 / bn)));
    });
    const botTurn = s.currentPlayerIndex === 1 && s.winnerIndex == null;
    this.botLabel.setText(`${bot.name} · ${bn} card${bn === 1 ? '' : 's'}${s.declaredNikoCardi[1] ? '  · Niko Cardi!' : ''}`);
    this.botLabel.setColor(botTurn ? '#e8b923' : '#f3ead2');

    // Draw pile
    const dc = s.drawPile.length;
    for (let i = 0; i < Math.min(3, dc); i++) this.dyn.add(this.add.image(DRAW_X - i * 2, PILE_Y - i * 2, 'card_back').setDisplaySize(CW, CH));
    if (!dc) this.dyn.add(this.add.rectangle(DRAW_X, PILE_Y, CW, CH).setStrokeStyle(2, 0x9fbfae, 0.5));
    this.drawCount.setText(`${dc} in deck`);
    this.drawGlow.setVisible(this.canHumanDraw());

    // Discard pile (last 3, slightly rotated)
    const pile = s.discardPile.slice(-3);
    pile.forEach((c, i) => {
      const k = s.discardPile.length - pile.length + i;
      const ang = ((k * 37) % 17) - 8;
      this.dyn.add(this.add.image(DISCARD_X + (i - pile.length + 1) * 3, PILE_Y, c.id).setDisplaySize(CW, CH).setAngle(ang));
    });

    // Suit glow
    const col = UI.hex(Rules.SUIT_COLORS[s.currentSuit] === '#1d1d1d' ? '#cfcfcf' : Rules.SUIT_COLORS[s.currentSuit]);
    this.glow.clear();
    this.glow.lineStyle(6, col, 1).strokeRoundedRect(DISCARD_X - 56, PILE_Y - 74, 112, 148, 16);
    this.glow.lineStyle(14, col, 0.25).strokeRoundedRect(DISCARD_X - 60, PILE_Y - 78, 120, 156, 18);
    if (this.lastSuit && this.lastSuit !== s.currentSuit) {
      this.glow.setScale(1);
      this.tweens.add({ targets: this.suitText, scale: 1.4, duration: 180, yoyo: true });
    }
    this.lastSuit = s.currentSuit;
    this.suitText.setText(`Suit: ${Rules.SUIT_SYMBOLS[s.currentSuit]} ${Rules.SUIT_NAMES[s.currentSuit]}`).setColor(Rules.SUIT_COLORS[s.currentSuit] === '#1d1d1d' ? '#ffffff' : Rules.SUIT_COLORS[s.currentSuit]);

    // Human hand
    const hand = s.players[this.humanIndex].hand;
    const n = hand.length;
    const humanTurn = this.isHumanTurn() && !this.busy;
    const legal = this.humanLegalIds();
    const spacing = Math.min(CW + 8, (620 - CW) / Math.max(n - 1, 1));
    const startX = TABLE_CX - ((n - 1) * spacing) / 2;
    hand.forEach((c, i) => {
      const off = i - (n - 1) / 2;
      const y = HAND_Y + Math.abs(off) * Math.min(4, 30 / n);
      const img = this.add.image(startX + i * spacing, y, c.id).setDisplaySize(CW, CH).setAngle(off * Math.min(3, 24 / n));
      const playable = humanTurn && legal.has(c.id);
      if (humanTurn && !playable) img.setTint(0x777777).setAlpha(0.75);
      if (playable) {
        img.setInteractive({ useHandCursor: true });
        img.on('pointerover', () => this.tweens.add({ targets: img, y: y - 24, duration: 120 }));
        img.on('pointerout', () => this.tweens.add({ targets: img, y, duration: 120 }));
        img.on('pointerdown', () => this.onCardClick(c));
      }
      if (s.drawnCardId === c.id && humanTurn) img.y = y - 24;
      this.dyn.add(img);
      this.cardSprites[c.id] = img;
    });

    // Side panel
    this.dirText.setText(s.direction === 1 ? '→  ↻\nClockwise' : '←  ↺\nCounter-clockwise');
    if (s.direction !== this.lastDirection) this.tweens.add({ targets: this.dirText, scale: 1.3, duration: 200, yoyo: true });
    this.lastDirection = s.direction;
    this.punText.setText(String(s.pendingPunishment)).setColor(s.pendingPunishment > 0 ? '#ff3b3b' : '#4d6b5d');
    this.logText.setText(s.log.slice(-4).join('\n\n'));

    // Turn + hints
    if (s.winnerIndex != null) this.turnText.setText(`${s.players[s.winnerIndex].name} win${s.winnerIndex === 0 ? '' : 's'}!`);
    else this.turnText.setText(s.currentPlayerIndex === this.humanIndex ? 'Your turn' : `${bot.name} is thinking…`);
    let hint = '';
    if (humanTurn) {
      if (s.drawnCardId) hint = 'You drew a playable card — play it or pass';
      else if (s.pendingPunishment > 0) hint = legal.size ? `Stack a 3, play an Ace, or tap the deck to take ${s.pendingPunishment}` : `Tap the deck to take ${s.pendingPunishment} cards`;
      else if (!legal.size) hint = 'No moves — tap the deck to draw';
    }
    const nikoVisible = Rules.canDeclareNiko(s, this.humanIndex);
    this.hintText.setText(nikoVisible ? '' : hint);
    this.passBtn.setVisible(humanTurn && !!s.drawnCardId);
    this.niko.setVisible(nikoVisible);
  }

  /* ---------------------------- turn flow ---------------------------- */
  advance() {
    if (!this.scene.isActive()) return;
    const s = this.state;
    if (s.winnerIndex != null) {
      this.render();
      this.time.delayedCall(900, () => this.scene.start('WinScene', {
        winnerIndex: s.winnerIndex, winnerName: s.players[s.winnerIndex].name, humanWon: s.winnerIndex === this.humanIndex,
      }));
      return;
    }
    // Bots shout Niko Cardi automatically.
    s.players.forEach((p, i) => {
      if (p.isBot && p.hand.length === 1 && !this.state.declaredNikoCardi[i]) {
        this.state = Rules.applyMove(this.state, { type: 'declare', playerIndex: i });
        UI.toast(this, `${p.name}: "Niko Cardi!"`, '#e8b923', 215);
      }
    });
    if (!this.state.turnStarted) {
      if (Rules.canDeclareNiko(this.state, this.humanIndex)) {
        this.render();
        this.nikoWindow = this.time.delayedCall(3000, () => { this.nikoWindow = null; this.beginTurn(); });
      } else {
        this.time.delayedCall(300, () => this.beginTurn());
      }
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
    this.busy = true;
    const next = Rules.startTurn(this.state);
    await this.playEvents(next.events);
    this.state = next;
    this.busy = false;
    if (next.events.some((e) => e.type === 'foul')) UI.toast(this, 'No "Niko Cardi!" — +1 card, turn lost', '#ff6b6b');
    this.render();
    this.advance();
  }

  declareNiko() {
    if (!Rules.canDeclareNiko(this.state, this.humanIndex)) return;
    this.state = Rules.applyMove(this.state, { type: 'declare', playerIndex: this.humanIndex });
    UI.toast(this, 'Niko Cardi! You\'re safe', '#e8b923');
    this.render();
    if (this.nikoWindow) {
      this.nikoWindow.remove(false);
      this.nikoWindow = null;
      this.time.delayedCall(400, () => this.beginTurn());
    }
  }

  async botAct() {
    if (!this.scene.isActive()) return;
    const i = this.state.currentPlayerIndex;
    const move = Bot.chooseMove(this.state, i);
    if (move.type === 'declare') {
      this.state = Rules.applyMove(this.state, { type: 'declare', playerIndex: i });
      return this.botAct();
    }
    await this.perform(move);
  }

  onCardClick(card) {
    if (this.busy || !this.isHumanTurn() || !this.humanLegalIds().has(card.id)) return;
    if (card.rank === 'ace') this.showSuitPicker((suit) => this.perform({ type: 'play', card, chosenSuit: suit }));
    else this.perform({ type: 'play', card });
  }

  async perform(move) {
    if (this.busy) return;
    let next;
    try {
      next = Rules.applyMove(this.state, move);
    } catch (e) {
      console.warn('Rejected move', move, e.message);
      return;
    }
    this.busy = true;
    this.render();
    await this.playEvents(next.events);
    this.state = next;
    this.busy = false;
    this.render();
    this.advance();
  }

  /* --------------------------- animations ---------------------------- */
  async playEvents(events = []) {
    for (const e of events) {
      if (e.type === 'play') await this.animPlay(e);
      else if (e.type === 'draw') await this.animDraw(e);
      else if (e.type === 'reshuffle') await this.animReshuffle();
      else if (e.type === 'suit' && this.state.players[e.player].isBot) {
        UI.toast(this, `${this.state.players[e.player].name} chose ${Rules.SUIT_SYMBOLS[e.suit]} ${Rules.SUIT_NAMES[e.suit]}`, '#e8b923');
      }
    }
  }

  animPlay(e) {
    let from = { x: TABLE_CX, y: BOT_Y };
    if (e.player === this.humanIndex) {
      const sp = this.cardSprites[e.card.id];
      from = sp ? { x: sp.x, y: sp.y } : { x: TABLE_CX, y: HAND_Y };
      if (sp) sp.setVisible(false);
    }
    const img = this.add.image(from.x, from.y, e.card.id).setDisplaySize(UI.CW, UI.CH).setDepth(50);
    this.temps.push(img);
    return this.tweenP({ targets: img, x: DISCARD_X, y: PILE_Y, angle: Phaser.Math.Between(-8, 8), duration: 300, ease: 'Cubic.easeOut' });
  }

  animDraw(e) {
    const human = e.player === this.humanIndex;
    const ty = human ? HAND_Y : BOT_Y;
    const promises = e.cards.map((c, i) => {
      const img = this.add.image(DRAW_X, PILE_Y, 'card_back').setDisplaySize(UI.CW, UI.CH).setDepth(50 + i);
      this.temps.push(img);
      const tx = TABLE_CX + (i - (e.cards.length - 1) / 2) * 22;
      return this.tweenP({ targets: img, x: tx, y: ty, delay: i * 140, duration: 250, ease: 'Quad.out' }).then(() => {
        if (human) img.setTexture(c.id).setDisplaySize(UI.CW, UI.CH);
      });
    });
    return Promise.all(promises).then(() => this.wait(120));
  }

  async animReshuffle() {
    UI.toast(this, 'Reshuffling…', '#cfe3d8', 420);
    const imgs = [];
    for (let i = 0; i < 6; i++) {
      const img = this.add.image(DISCARD_X + Phaser.Math.Between(-20, 20), PILE_Y + Phaser.Math.Between(-10, 10), 'card_back').setDisplaySize(UI.CW, UI.CH).setDepth(55).setAngle(Phaser.Math.Between(-20, 20));
      imgs.push(img);
      this.temps.push(img);
    }
    await this.tweenP({ targets: imgs, x: DRAW_X, y: PILE_Y, angle: 0, duration: 600, ease: 'Cubic.inOut', delay: this.tweens.stagger(40) });
  }

  /* --------------------------- suit picker --------------------------- */
  showSuitPicker(onPick) {
    const { W, H, FONT } = UI;
    const layer = this.add.container(0, 0).setDepth(150);
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setInteractive();
    const panel = this.add.graphics();
    panel.fillStyle(0x10291f, 1).fillRoundedRect(W / 2 - 280, 220, 560, 250, 20);
    panel.lineStyle(3, 0xe8b923, 1).strokeRoundedRect(W / 2 - 280, 220, 560, 250, 20);
    const title = this.add.text(W / 2, 260, 'Ace! Choose a suit', { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: '#e8b923' }).setOrigin(0.5);
    layer.add([dim, panel, title]);
    Rules.SUITS.forEach((suit, i) => {
      const x = W / 2 - 195 + i * 130;
      const c = this.add.container(x, 370);
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 1).fillRoundedRect(-52, -60, 104, 120, 14);
      g.lineStyle(3, UI.hex(Rules.SUIT_COLORS[suit]), 1).strokeRoundedRect(-52, -60, 104, 120, 14);
      const sym = this.add.text(0, -10, Rules.SUIT_SYMBOLS[suit], { fontFamily: FONT, fontSize: '58px', color: Rules.SUIT_COLORS[suit], fontStyle: 'bold' }).setOrigin(0.5);
      const nm = this.add.text(0, 40, Rules.SUIT_NAMES[suit], { fontFamily: FONT, fontSize: '15px', color: '#333', fontStyle: 'bold' }).setOrigin(0.5);
      c.add([g, sym, nm]).setSize(104, 120).setInteractive({ useHandCursor: true });
      c.on('pointerover', () => this.tweens.add({ targets: c, scale: 1.1, duration: 100 }));
      c.on('pointerout', () => this.tweens.add({ targets: c, scale: 1, duration: 100 }));
      c.on('pointerdown', () => { layer.destroy(); onPick(suit); });
      layer.add(c);
    });
  }
}

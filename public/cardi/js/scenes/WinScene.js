/* =====================================================================
 * WinScene — result screen.
 *
 *  Data from GameScene:
 *    { winnerIndex, winnerName, humanWon, humanName, botName,
 *      names?: string[]     (every player, in seat order — enables N-player boards)
 *      scores: number[]     (points per player, same order)
 *      localIndex?, players? (kept so "Rematch" re-creates the same table) }
 *
 *  Sequence: fade in -> panel -> ribbon + crown -> line of text ->
 *  scoreboard rows slide in and count up (winner first) -> buttons.
 *  Win: light rays, confetti, gold dust.  Loss: calm, dimmer, no confetti.
 *  Keys: ENTER / SPACE = Rematch, ESC = Main Menu.
 * ===================================================================== */
class WinScene extends Phaser.Scene {
  constructor() {
    super('WinScene');
  }

  init(data) {
    data = data || {};
    const names = Array.isArray(data.names) && data.names.length ? data.names : [data.humanName || 'You', data.botName || 'Carl'];
    const raw = Array.isArray(data.scores) ? data.scores : [];
    const localIndex = data.localIndex || 0;
    let winnerIndex = data.winnerIndex;
    if (winnerIndex == null) winnerIndex = data.humanWon === false ? (localIndex === 0 ? 1 : 0) : localIndex;
    this.result = {
      ...data,
      names,
      scores: names.map((_, i) => Number(raw[i]) || 0),
      localIndex,
      winnerIndex,
      humanWon: data.humanWon !== false,
      winnerName: data.winnerName || names[winnerIndex],
    };
  }

  create() {
    const { W, H } = UI;
    const r = this.result;
    const won = r.humanWon;
    this.leaving = false;
    this.palette = [0x4da3ff, 0x57c785, 0xc084fc, 0xff9f43, 0xf472b6];

    UI.drawFelt(this);
    this.add.rectangle(W / 2, H / 2, W, H, 0x020a06, won ? 0.5 : 0.68);
    this.cameras.main.fadeIn(380, 0, 0, 0);

    this.buildFallingCards(won);

    // ----- layout -----
    const n = Math.min(r.names.length, 6);
    const rowH = 58;
    const panelW = 600;
    const panelH = 140 + n * rowH + 14 + 54 + 54;
    const top = Math.round((H - panelH) / 2) + 24;
    const cx = W / 2;
    this.top = top; this.panelH = panelH;

    if (won) this.buildRays(cx, top + 10);

    // ----- panel -----
    const panel = this.add.container(cx, top + panelH / 2).setAlpha(0).setScale(0.92);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.5).fillRoundedRect(-panelW / 2 + 4, -panelH / 2 + 12, panelW, panelH, 24);
    g.fillStyle(0x0b1c14, 0.97).fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 24);
    g.lineStyle(3, won ? 0xe8b923 : 0x5b7a6b, 1).strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 24);
    g.lineStyle(1, won ? 0xe8b923 : 0x5b7a6b, 0.3).strokeRoundedRect(-panelW / 2 + 7, -panelH / 2 + 7, panelW - 14, panelH - 14, 18);
    panel.add(g);
    this.tweens.add({ targets: panel, alpha: 1, scale: 1, duration: 420, delay: 120, ease: 'Back.out' });

    // ----- ribbon + title -----
    this.buildTitle(cx, top + 6, won);

    // ----- wholesome line -----
    const lines = won
      ? ['Smooth moves — table cleared!', "That's how Cardi is played.", 'Sweet play. Enjoy the win!', 'The cards were in your favour.']
      : [`${r.winnerName} takes this one. Rematch?`, 'So close! The cards had other plans.', 'Well played. Next hand is yours.', 'Shuffle up and go again?'];
    const line = this.add.text(cx, top + 82, Phaser.Utils.Array.GetRandom(lines), {
      fontFamily: UI.FONT, fontSize: '17px', fontStyle: 'italic', color: won ? '#f3ead2' : '#b9cfc3',
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: line, alpha: 1, y: top + 78, duration: 400, delay: 950 });

    const cap = this.add.text(cx, top + 116, 'POINTS EARNED', {
      fontFamily: UI.FONT, fontSize: '11px', fontStyle: 'bold', color: '#7fa393',
    }).setOrigin(0.5).setAlpha(0).setLetterSpacing(3);
    this.tweens.add({ targets: cap, alpha: 1, duration: 300, delay: 1050 });

    // ----- scoreboard -----
    const order = r.names.map((nm, i) => i).sort((a, b) => {
      if (a === r.winnerIndex) return -1;
      if (b === r.winnerIndex) return 1;
      return r.scores[b] - r.scores[a] || a - b;
    }).slice(0, n);
    const rowsTop = top + 140;
    order.forEach((pi, k) => this.buildRow(cx, rowsTop + k * rowH + rowH / 2 - 4, pi, k, 1150 + k * 170));

    // ----- buttons -----
    const by = rowsTop + n * rowH + 40;
    const tBtn = 1150 + n * 170 + 450;
    this.buildButtons(cx, by, tBtn);

    // ----- ambience -----
    if (won) {
      this.cameras.main.flash(420, 232, 185, 35, false);
      this.time.delayedCall(250, () => this.confetti(70));
      this.time.delayedCall(1700, () => this.confetti(40));
      this.time.addEvent({ delay: 360, loop: true, callback: () => this.goldDust(top + panelH) });
    } else {
      this.time.delayedCall(520, () => this.cameras.main.shake(180, 0.0025));
    }

    // ----- keys -----
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-ENTER', () => this.rematch());
      this.input.keyboard.on('keydown-SPACE', () => this.rematch());
      this.input.keyboard.on('keydown-ESC', () => this.toMenu());
    }
  }

  /* ------------------------------------------------------------------ */
  buildFallingCards(won) {
    const { W, H } = UI;
    const deck = Rules.createDeck();
    const count = 26;
    for (let i = 0; i < count; i++) {
      const card = Phaser.Utils.Array.GetRandom(deck);
      const sc = Phaser.Math.FloatBetween(0.55, 0.95);
      const img = this.add.image(0, 0, card.id).setDisplaySize(70 * sc, 102 * sc).setAlpha(won ? 0.3 : 0.2);
      const drop = () => {
        img.setPosition(Phaser.Math.Between(30, W - 30), -90).setAngle(Phaser.Math.Between(-30, 30));
        this.tweens.add({
          targets: img, y: H + 110, angle: img.angle + Phaser.Math.Between(-160, 160), x: img.x + Phaser.Math.Between(-60, 60),
          duration: Phaser.Math.Between(won ? 3200 : 4600, won ? 5200 : 6800), ease: 'Sine.in', onComplete: drop,
        });
      };
      this.time.delayedCall(i * (won ? 170 : 260), drop);
    }
  }

  buildRays(x, y) {
    const rays = this.add.container(x, y);
    const g = this.add.graphics();
    const N = 14, R = 700;
    for (let i = 0; i < N; i += 2) {
      const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
      g.fillStyle(0xe8b923, 0.07).fillTriangle(0, 0, R * Math.cos(a0), R * Math.sin(a0), R * Math.cos(a1), R * Math.sin(a1));
    }
    rays.add(g).setAlpha(0);
    this.tweens.add({ targets: rays, alpha: 1, duration: 900, delay: 200 });
    this.tweens.add({ targets: rays, angle: 360, duration: 60000, repeat: -1 });
    const glow = this.add.graphics();
    for (let i = 0; i < 7; i++) glow.fillStyle(0xe8b923, 0.035).fillCircle(x, y + 20, 240 - i * 30);
  }

  drawCrown(g, s = 1) {
    const w = 64 * s, h = 46 * s;
    g.clear();
    g.fillStyle(0x7a5200, 1).fillPoints([
      { x: -w / 2, y: h / 2 }, { x: -w / 2 - 2 * s, y: -h / 2 + 4 * s }, { x: -w / 4, y: 0 }, { x: 0, y: -h / 2 - 6 * s },
      { x: w / 4, y: 0 }, { x: w / 2 + 2 * s, y: -h / 2 + 4 * s }, { x: w / 2, y: h / 2 },
    ], true);
    g.fillStyle(0xe8b923, 1).fillPoints([
      { x: -w / 2 + 3 * s, y: h / 2 - 3 * s }, { x: -w / 2, y: -h / 2 + 7 * s }, { x: -w / 4, y: 2 * s }, { x: 0, y: -h / 2 - 1 * s },
      { x: w / 4, y: 2 * s }, { x: w / 2, y: -h / 2 + 7 * s }, { x: w / 2 - 3 * s, y: h / 2 - 3 * s },
    ], true);
    g.fillStyle(0xfff0b0, 0.55).fillRect(-w / 2 + 6 * s, -2 * s, w - 12 * s, 5 * s);
    g.fillStyle(0xb8860b, 1).fillRoundedRect(-w / 2 + 2 * s, h / 2 - 12 * s, w - 4 * s, 10 * s, 3 * s);
    const gem = (x, y, c) => g.fillStyle(c, 1).fillCircle(x, y, 4.2 * s).lineStyle(1.5, 0x5a3a00, 1).strokeCircle(x, y, 4.2 * s);
    gem(-w / 2 + 2 * s, -h / 2 + 5 * s, 0xd62828); gem(0, -h / 2 - 5 * s, 0x4da3ff); gem(w / 2 - 2 * s, -h / 2 + 5 * s, 0x2fa36b);
    gem(0, h / 2 - 7 * s, 0xffffff);
  }

  buildTitle(cx, y, won) {
    const { FONT } = UI;
    const w = 340, h = 70;
    const main = won ? 0xe8b923 : 0x8a3a3a;
    const dark = won ? 0x9a7410 : 0x5c2222;
    const hi = won ? 0xffe28a : 0xc46a6a;

    const rib = this.add.container(cx, y).setScale(0, 1);
    const g = this.add.graphics();
    // tails (behind), plate, folds, highlight
    [-1, 1].forEach((sd) => {
      const x0 = sd * (w / 2 - 8), x1 = sd * (w / 2 + 52);
      g.fillStyle(dark, 1).fillPoints([
        { x: x0, y: -h / 2 + 14 }, { x: x1, y: -h / 2 + 14 }, { x: x1 - sd * 22, y: 14 + 0 }, { x: x1, y: h / 2 + 14 }, { x: x0, y: h / 2 + 14 },
      ], true);
      g.fillStyle(0x000000, 0.35).fillTriangle(sd * (w / 2), h / 2, sd * (w / 2 - 16), h / 2, sd * (w / 2 - 16), h / 2 + 14);
    });
    g.fillStyle(main, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    g.fillStyle(hi, 0.55).fillRoundedRect(-w / 2 + 6, -h / 2 + 5, w - 12, 14, { tl: 5, tr: 5, bl: 0, br: 0 });
    g.lineStyle(2.5, dark, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    g.lineStyle(1.5, hi, 0.7).strokeRoundedRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 5);
    rib.add(g);
    this.tweens.add({ targets: rib, scaleX: 1, duration: 480, delay: 380, ease: 'Back.out' });

    const t = this.add.text(cx, y + 2, won ? 'VICTORY' : 'DEFEAT', {
      fontFamily: FONT, fontSize: '52px', fontStyle: '900', color: won ? '#fff6d6' : '#ffe3e3',
      stroke: won ? '#5a3a00' : '#2a0a0a', strokeThickness: 6,
    }).setOrigin(0.5).setAlpha(0).setScale(1.5);
    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 360, delay: 640, ease: 'Back.out' });

    if (won) {
      const crown = this.add.container(cx, y - 66).setAlpha(0).setScale(0.4);
      const cg = this.add.graphics();
      this.drawCrown(cg, 1.35);
      crown.add(cg);
      this.tweens.add({ targets: crown, alpha: 1, scale: 1, y: y - 62, duration: 520, delay: 700, ease: 'Bounce.out' });
      this.tweens.add({ targets: crown, y: y - 68, angle: { from: -3, to: 3 }, duration: 1600, delay: 1300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      // twinkles around the banner
      for (let i = 0; i < 9; i++) {
        const px = cx + Phaser.Math.Between(-210, 210), py = y + Phaser.Math.Between(-80, 36);
        const st = this.add.star(px, py, 4, 2, Phaser.Math.Between(7, 12), 0xfff0b0).setScale(0).setDepth(5);
        this.tweens.add({ targets: st, scale: 1, angle: 90, duration: 520, delay: 900 + Math.random() * 1800, yoyo: true, repeat: -1, repeatDelay: Phaser.Math.Between(500, 1800), ease: 'Sine.inOut' });
      }
    }
  }

  colorOf(i) {
    if (i === this.result.localIndex) return 0xe8b923;
    let k = 0;
    for (let j = 0; j < i; j++) if (j !== this.result.localIndex) k++;
    return this.palette[k % this.palette.length];
  }

  buildRow(cx, y, pi, rank, delay) {
    const { FONT } = UI;
    const r = this.result;
    const isWinner = pi === r.winnerIndex;
    const isMe = pi === r.localIndex;
    const col = this.colorOf(pi);
    const w = 520, h = 50;

    const row = this.add.container(cx - 70, y).setAlpha(0);
    const bg = this.add.graphics();
    if (isWinner) {
      bg.fillStyle(0xe8b923, 0.12).fillRoundedRect(-w / 2 - 5, -h / 2 - 5, w + 10, h + 10, 16);
      bg.fillStyle(0x2a2208, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 13);
      bg.lineStyle(3, 0xe8b923, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 13);
    } else {
      bg.fillStyle(rank % 2 ? 0x102a1f : 0x12301f, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 13);
      bg.lineStyle(2, 0x2e5242, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 13);
    }
    row.add(bg);

    // rank medal
    const medal = [0xe8b923, 0xc9d1d6, 0xcd7f32][rank] ?? 0x3f5b4e;
    const mc = this.add.circle(-w / 2 + 30, 0, 15, medal).setStrokeStyle(2, 0x000000, 0.35);
    const mt = this.add.text(-w / 2 + 30, 0, String(rank + 1), { fontFamily: FONT, fontSize: '17px', fontStyle: '900', color: rank < 3 ? '#2a1d00' : '#cfe3d8' }).setOrigin(0.5);
    // avatar
    const av = this.add.circle(-w / 2 + 76, 0, 18, Phaser.Display.Color.ValueToColor(col).darken(50).color).setStrokeStyle(3, col);
    const ini = this.add.text(-w / 2 + 76, 0, (r.names[pi] || '?').charAt(0).toUpperCase(), { fontFamily: FONT, fontSize: '19px', fontStyle: '900', color: '#f3ead2' }).setOrigin(0.5);
    let nm = r.names[pi] || '';
    if (nm.length > 14) nm = nm.slice(0, 13) + '…';
    const nt = this.add.text(-w / 2 + 104, 0, nm, { fontFamily: FONT, fontSize: '21px', fontStyle: 'bold', color: isWinner ? '#ffe08a' : '#f3ead2' }).setOrigin(0, 0.5);
    row.add([mc, mt, av, ini, nt]);

    if (isMe && String(r.names[pi]).trim().toLowerCase() !== 'you') {
      const cw = 44, cxp = -w / 2 + 104 + nt.width + 10 + cw / 2;
      const cg = this.add.graphics();
      cg.fillStyle(0xe8b923, 0.18).fillRoundedRect(cxp - cw / 2, -10, cw, 20, 10).lineStyle(1.5, 0xe8b923, 0.9).strokeRoundedRect(cxp - cw / 2, -10, cw, 20, 10);
      const ct = this.add.text(cxp, 0, 'YOU', { fontFamily: FONT, fontSize: '11px', fontStyle: '900', color: '#ffe08a' }).setOrigin(0.5).setLetterSpacing(1);
      row.add([cg, ct]);
    }
    if (isWinner) {
      const cr = this.add.graphics();
      this.drawCrown(cr, 0.42);
      const cc = this.add.container(-w / 2 + 76, -h / 2 - 7, [cr]);
      row.add(cc);
      this.tweens.add({ targets: cc, y: -h / 2 - 11, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: delay });
    }

    // points
    const score = r.scores[pi];
    const st = this.add.text(w / 2 - 62, 0, '0', { fontFamily: FONT, fontSize: '32px', fontStyle: '900', color: isWinner ? '#ffd54a' : '#ffffff' }).setOrigin(1, 0.5);
    const pt = this.add.text(w / 2 - 54, 5, 'pts', { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#7fa393' }).setOrigin(0, 0.5);
    row.add([st, pt]);

    this.tweens.add({
      targets: row, x: cx, alpha: 1, duration: 340, delay, ease: 'Cubic.out',
      onStart: () => { if (isWinner) this.tweens.add({ targets: bg, alpha: { from: 1, to: 0.75 }, duration: 900, yoyo: true, repeat: -1, delay: 600 }); },
      onComplete: () => {
        if (score <= 0) return;
        this.tweens.addCounter({
          from: 0, to: score, duration: Math.min(1100, 450 + score * 40), ease: 'Cubic.out',
          onUpdate: (tw) => st.setText(String(Math.round(tw.getValue()))),
          onComplete: () => {
            st.setText(String(score));
            this.tweens.add({ targets: st, scale: { from: 1.35, to: 1 }, duration: 300, ease: 'Back.out' });
            try { if (this.cache.audio.exists('sfx_score')) this.sound.play('sfx_score', { volume: 0.45 }); } catch (e) { /* ignore */ }
          },
        });
      },
    });
  }

  button(x, y, w, h, label, kind, onClick, delay) {
    const { FONT } = UI;
    const c = this.add.container(x, y).setScale(0).setAlpha(0);
    const bg = this.add.graphics();
    const pal = kind === 'primary'
      ? { f: 0xe8b923, h: 0xf5cd3c, b: 0x7a5c00, t: '#241900' }
      : { f: 0x15382a, h: 0x1d4a37, b: 0x2e5242, t: '#f3ead2' };
    const draw = (hover) => {
      bg.clear();
      bg.fillStyle(0x000000, 0.4).fillRoundedRect(-w / 2 + 2, -h / 2 + 5, w, h, 15);
      bg.fillStyle(hover ? pal.h : pal.f, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 15);
      bg.lineStyle(2.5, pal.b, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 15);
      if (kind === 'primary') bg.fillStyle(0xffffff, 0.2).fillRoundedRect(-w / 2 + 4, -h / 2 + 3, w - 8, h / 2 - 3, { tl: 12, tr: 12, bl: 0, br: 0 });
    };
    draw(false);
    const t = this.add.text(0, 0, label, { fontFamily: FONT, fontSize: kind === 'primary' ? '24px' : '20px', fontStyle: '900', color: pal.t }).setOrigin(0.5);
    c.add([bg, t]).setSize(w, h).setInteractive({ useHandCursor: true });
    c.on('pointerover', () => { draw(true); this.tweens.add({ targets: c, scale: 1.05, duration: 90 }); });
    c.on('pointerout', () => { draw(false); this.tweens.add({ targets: c, scale: 1, duration: 90 }); });
    c.on('pointerdown', () => { this.tweens.add({ targets: c, scale: { from: 0.94, to: 1 }, duration: 140 }); onClick(); });
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 320, delay, ease: 'Back.out' });
    return c;
  }

  buildButtons(cx, y, delay) {
    const { FONT } = UI;
    this.button(cx - 108, y, 190, 54, 'Main Menu', 'secondary', () => this.toMenu(), delay);
    const re = this.button(cx + 112, y, 230, 54, 'Rematch', 'primary', () => this.rematch(), delay + 120);
    this.tweens.add({ targets: re, scale: 1.04, duration: 800, delay: delay + 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const hint = this.add.text(cx, y + 46, 'ENTER  rematch      ·      ESC  menu', { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: '#58796a' }).setOrigin(0.5).setAlpha(0).setLetterSpacing(2);
    this.tweens.add({ targets: hint, alpha: 1, duration: 400, delay: delay + 400 });
  }

  /* ------------------------------------------------------------------ */
  confetti(count) {
    const { W } = UI;
    const cols = [0xe8b923, 0xd62828, 0x2fa36b, 0xffffff, 0x4da3ff, 0xc084fc];
    for (let i = 0; i < count; i++) {
      const sz = Phaser.Math.Between(7, 12);
      const p = this.add.rectangle(Phaser.Math.Between(40, W - 40), -20, sz, sz * 1.5, Phaser.Utils.Array.GetRandom(cols)).setDepth(50).setAngle(Phaser.Math.Between(0, 180));
      this.tweens.add({
        targets: p, y: Phaser.Math.Between(420, 760), x: p.x + Phaser.Math.Between(-110, 110), angle: p.angle + Phaser.Math.Between(240, 720),
        scaleX: { from: 1, to: 0.25 }, alpha: { from: 1, to: 0.15 }, delay: Phaser.Math.Between(0, 500), duration: Phaser.Math.Between(1500, 2600), ease: 'Quad.in',
        onComplete: () => p.destroy(),
      });
    }
  }

  goldDust(bottom) {
    const x = Phaser.Math.Between(150, 750);
    const d = this.add.circle(x, bottom + 10, Phaser.Math.Between(2, 4), 0xffe08a, 0.8).setDepth(4);
    this.tweens.add({ targets: d, y: bottom - Phaser.Math.Between(160, 340), x: x + Phaser.Math.Between(-40, 40), alpha: 0, duration: Phaser.Math.Between(1800, 2800), ease: 'Sine.out', onComplete: () => d.destroy() });
  }

  /* ------------------------------------------------------------------ */
  leave(fn) {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(260, 0, 0, 0);
    this.time.delayedCall(280, fn);
  }

  rematch() {
    const r = this.result;
    this.leave(() => this.scene.start('GameScene', { humanName: r.humanName, botName: r.botName, players: r.players, localIndex: r.localIndex }));
  }

  toMenu() {
    this.leave(() => this.scene.start('MainMenuScene'));
  }
}
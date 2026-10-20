/* =====================================================================
 * MainMenuScene — title, Play / Shop / How to Play.
 * ===================================================================== */
class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
  }

  create() {
    const { W, FONT } = UI;
    UI.drawFelt(this);

    // Decorative fanned cards.
    const deco = ['hearts_ace', 'card_back', 'clubs_king', 'card_back', 'spades_jack', 'card_back', 'diamonds_3'];
    deco.forEach((key, i) => {
      const off = i - (deco.length - 1) / 2;
      const img = this.add.image(W / 2 + off * 70, 610 + Math.abs(off) * 10, key).setDisplaySize(110, 160).setAngle(off * 8).setAlpha(0.9);
      this.tweens.add({ targets: img, y: img.y - 8, duration: 1600 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    });
    [[110, 140, -18], [790, 160, 16]].forEach(([x, y, a]) => this.add.image(x, y, 'card_back').setDisplaySize(90, 130).setAngle(a).setAlpha(0.35));

    const title = this.add.text(W / 2, 150, 'CARDI', {
      fontFamily: FONT, fontSize: '120px', color: '#e8b923', fontStyle: '900',
      stroke: '#5a4300', strokeThickness: 8, shadow: { offsetX: 0, offsetY: 6, color: '#000', blur: 12, fill: true },
    }).setOrigin(0.5);
    this.tweens.add({ targets: title, scale: 1.03, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.add.text(W / 2, 228, 'Dominate the spinning table', { fontFamily: FONT, fontSize: '24px', color: '#f3ead2', fontStyle: 'italic' }).setOrigin(0.5);

    UI.makeButton(this, W / 2, 310, 'Play', () => this.scene.start('GameScene', {}));
    UI.makeButton(this, W / 2, 380, 'Shop', () => this.scene.start('ShopScene'), { fill: 0x24543f, hoverFill: 0x2f6b51, color: '#f3ead2', border: 0xe8b923 });
    UI.makeButton(this, W / 2, 450, 'How to Play', () => this.showHowTo(), { fill: 0x24543f, hoverFill: 0x2f6b51, color: '#f3ead2', border: 0xe8b923 });
  }

  /** Scrollable rules modal. */
  showHowTo() {
    const { W, H, FONT } = UI;
    const layer = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7).setInteractive();
    const panel = this.add.graphics();
    panel.fillStyle(0x10291f, 1).fillRoundedRect(130, 70, 640, 560, 20);
    panel.lineStyle(3, 0xe8b923, 1).strokeRoundedRect(130, 70, 640, 560, 20);
    const head = this.add.text(W / 2, 108, 'How to Play', { fontFamily: FONT, fontSize: '32px', color: '#e8b923', fontStyle: 'bold' }).setOrigin(0.5);
    const rules = [
      'GOAL — Be the first to empty your hand.',
      '',
      'SETUP — Everyone gets 4 cards. A plain card (2, 4–10 or Queen) opens the table.',
      '',
      'YOUR TURN — Play a card matching the top card\'s suit or rank. No match? Tap the deck to draw 1. If it\'s playable you may play it, or pass.',
      '',
      'KICKBACK (King) — Reverses direction. With 2 players you go again.',
      'JUMP (Jack) — Skips the next player.',
      'ACE — Wild! Play it any time and choose the next suit. It also cuts a pending punishment by 3.',
      'FOUL (3) — Starts a punishment of 3 cards. The next player can stack another 3 (+3) or an Ace (−3). Otherwise they draw the total.',
      '',
      'NIKO CARDI! — When you\'re down to your last card and it can be played, a gold button appears after your opponent moves. Tap it before your turn — or draw 1 card as a foul and lose your turn.',
      '',
      'clubs (✿) replace Clubs. Good luck, mzalendo!',
    ].join('\n');
    const body = this.add.text(165, 150, rules, { fontFamily: FONT, fontSize: '18px', color: '#f3ead2', wordWrap: { width: 570 }, lineSpacing: 4 });
    const maskG = this.make.graphics({ add: false }, false);
    maskG.fillRect(150, 145, 600, 405);
    body.setMask(maskG.createGeometryMask());
    const maxScroll = Math.max(0, body.height - 400);
    const scrollTo = (y) => { body.y = Phaser.Math.Clamp(y, 150 - maxScroll, 150); };
    const onWheel = (_p, _o, _dx, dy) => scrollTo(body.y - dy * 0.5);
    this.input.on('wheel', onWheel);
    let dragY = null;
    dim.on('pointerdown', (p) => { dragY = p.y; });
    dim.on('pointermove', (p) => { if (dragY != null && p.isDown) { scrollTo(body.y + (p.y - dragY)); dragY = p.y; } });
    dim.on('pointerup', () => { dragY = null; });
    const close = UI.makeButton(this, W / 2, 590, 'Got it', () => { this.input.off('wheel', onWheel); layer.destroy(); }, { width: 160, height: 48 });
    layer.add([dim, panel, head, body, close]);
  }
}

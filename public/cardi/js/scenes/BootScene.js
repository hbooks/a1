/* =====================================================================
 * BootScene — loads card art from /assets/cards/{suit}_{rank}.png and
 * generates clean programmatic fallbacks for anything that fails.
 * ===================================================================== */
class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    const { W, H, FONT } = UI;
    const bar = this.add.graphics();
    const label = this.add.text(W / 2, H / 2 - 40, 'Shuffling the deck…', { fontFamily: FONT, fontSize: '22px', color: '#e8b923' }).setOrigin(0.5);
    this.load.on('progress', (v) => {
      bar.clear();
      bar.fillStyle(0x000000, 0.4).fillRoundedRect(W / 2 - 160, H / 2, 320, 16, 8);
      bar.fillStyle(0xe8b923, 1).fillRoundedRect(W / 2 - 160, H / 2, Math.max(16, 320 * v), 16, 8);
    });
    this.load.on('complete', () => { bar.destroy(); label.destroy(); });
    // Placeholder art paths; failures fall back silently.
    this.load.on('loaderror', () => {});
    this.load.setPath('assets/cards/');
    Rules.createDeck().forEach((c) => this.load.image(c.id, `${c.id}.png`));
    this.load.image('card_back', 'back.png');
  }

  create() {
    Rules.createDeck().forEach((c) => {
      if (!this.textures.exists(c.id)) this.makeCardTexture(c);
    });
    if (!this.textures.exists('card_back')) this.makeBackTexture();
    this.scene.start('MainMenuScene');
  }

  /** Draw a text object into a dynamic texture. */
  drawText(dt, str, size, color, x, y, ox = 0, oy = 0, angle = 0) {
    const t = this.make.text({ x: 0, y: 0, text: str, style: { fontFamily: UI.FONT, fontSize: `${size}px`, color, fontStyle: 'bold' }, add: false }, false);
    t.setOrigin(ox, oy).setAngle(angle);
    dt.draw(t, x, y);
    t.destroy();
  }

  /** Fallback face: rounded white card, suit border, ranks + center symbol. */
  makeCardTexture(card) {
    const W = 160, H = 232;
    const col = Rules.SUIT_COLORS[card.suit];
    const colNum = UI.hex(col);
    const sym = Rules.SUIT_SYMBOLS[card.suit];
    const short = Rules.RANK_SHORT[card.rank] || card.rank;
    const banner = ['king', 'jack', '3'].includes(card.rank);
    const dt = this.textures.addDynamicTexture(card.id, W, H);
    const g = this.make.graphics({ add: false }, false);
    g.fillStyle(0xffffff, 1).fillRoundedRect(2, 2, W - 4, H - 4, 22);
    g.lineStyle(4, colNum, 1).strokeRoundedRect(3, 3, W - 6, H - 6, 22);
    if (banner) g.fillStyle(colNum, 1).fillRect(4, H - 84, W - 8, 32);
    dt.draw(g);
    g.destroy();
    this.drawText(dt, short, 38, col, 16, 8);
    this.drawText(dt, sym, 28, col, 18, 52);
    this.drawText(dt, sym, card.rank === 'ace' ? 96 : 76, col, W / 2, banner ? H / 2 - 22 : H / 2, 0.5, 0.5);
    if (banner) this.drawText(dt, card.displayName.toUpperCase(), 20, '#ffffff', W / 2, H - 68, 0.5, 0.5);
    this.drawText(dt, short, 28, col, W - 14, H - 8, 0, 0, 180);
  }

  /** Fallback back: deep green with gold diamond lattice + CARDI mark. */
  makeBackTexture() {
    const W = 160, H = 232;
    const dt = this.textures.addDynamicTexture('card_back', W, H);
    const g = this.make.graphics({ add: false }, false);
    g.fillStyle(0xffffff, 1).fillRoundedRect(2, 2, W - 4, H - 4, 22);
    g.fillStyle(0x123326, 1).fillRoundedRect(10, 10, W - 20, H - 20, 16);
    g.lineStyle(2, 0xe8b923, 0.35);
    for (let i = -H; i < W + H; i += 22) {
      g.lineBetween(10 + i, 10, 10 + i + H, H - 10);
      g.lineBetween(10 + i, H - 10, 10 + i + H, 10);
    }
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, W, 10); g.fillRect(0, H - 10, W, 10); g.fillRect(0, 0, 10, H); g.fillRect(W - 10, 0, 10, H);
    g.lineStyle(3, 0xe8b923, 1).strokeRoundedRect(12, 12, W - 24, H - 24, 14);
    g.fillStyle(0x123326, 1).fillCircle(W / 2, H / 2, 36);
    g.lineStyle(3, 0xe8b923, 1).strokeCircle(W / 2, H / 2, 36);
    dt.draw(g);
    g.destroy();
    this.drawText(dt, '✿', 40, '#e8b923', W / 2, H / 2, 0.5, 0.5);
  }
}

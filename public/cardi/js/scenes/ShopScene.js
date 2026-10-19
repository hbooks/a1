/* =====================================================================
 * ShopScene — static placeholder: tabs, locked items, fake currency.
 * ===================================================================== */
class ShopScene extends Phaser.Scene {
  constructor() {
    super('ShopScene');
  }

  create() {
    const { W, FONT } = UI;
    UI.drawFelt(this);
    this.categories = {
      'UI Themes': [['🟥', 'Maasai Felt'], ['🌙', 'Savanna Nights'], ['🌃', 'Neon Nairobi'], ['🌊', 'Coastal Breeze'], ['⛰️', 'Rift Valley']],
      Components: [['🃏', 'Gold Card Back'], ['🧑🏾', 'Animated Avatar'], ['📿', 'Beaded Border'], ['🚐', 'Matatu Table']],
      Abilities: [['🛡️', 'Kickback Defense'], ['✨', 'Ace Shield'], ['➕', 'Double Draw'], ['🚫', 'Foul Immunity']],
    };
    this.add.text(60, 50, 'Shop', { fontFamily: FONT, fontSize: '48px', fontStyle: '900', color: '#e8b923' }).setOrigin(0, 0.5);
    this.add.rectangle(60, 82, 90, 4, 0xe8b923).setOrigin(0, 0.5);
    this.add.text(W - 40, 50, '🪙 0 Coins', { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: '#f3ead2', backgroundColor: 'rgba(0,0,0,0.4)', padding: { x: 12, y: 6 } }).setOrigin(1, 0.5);

    this.tabs = Object.keys(this.categories).map((name, i) =>
      UI.makeButton(this, 180 + i * 270, 135, name, () => this.showTab(name), { width: 230, height: 48, fontSize: '20px' }));
    this.grid = this.add.container(0, 0);
    UI.makeButton(this, W / 2, 650, '← Back', () => this.scene.start('MainMenuScene'), { width: 180, height: 48, fill: 0x24543f, hoverFill: 0x2f6b51, color: '#f3ead2', border: 0xe8b923 });
    this.showTab('UI Themes');
  }

  showTab(name) {
    const { FONT } = UI;
    Object.keys(this.categories).forEach((n, i) => {
      const active = n === name;
      this.tabs[i].setAlpha(active ? 1 : 0.55);
    });
    this.grid.removeAll(true);
    this.categories[name].forEach(([icon, label], i) => {
      const x = 180 + (i % 3) * 270;
      const y = 290 + Math.floor(i / 3) * 200;
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.35).fillRoundedRect(x - 115, y - 80, 230, 170, 16);
      g.lineStyle(2, 0x6b6b6b, 1).strokeRoundedRect(x - 115, y - 80, 230, 170, 16);
      const ic = this.add.text(x, y - 25, icon, { fontSize: '52px' }).setOrigin(0.5).setAlpha(0.35);
      const lock = this.add.text(x + 85, y - 58, '🔒', { fontSize: '22px' }).setOrigin(0.5);
      const t = this.add.text(x, y + 32, label, { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#bdbdbd' }).setOrigin(0.5);
      const s = this.add.text(x, y + 60, 'Coming Soon', { fontFamily: FONT, fontSize: '15px', color: '#e8b923', fontStyle: 'italic' }).setOrigin(0.5);
      this.grid.add([g, ic, lock, t, s]);
    });
  }
}

/* =====================================================================
 * WinScene — result screen with cascading cards, rematch & menu.
 * ===================================================================== */
class WinScene extends Phaser.Scene {
  constructor() {
    super('WinScene');
  }

  init(data) {
    this.result = { winnerName: 'You', humanWon: true, ...data };
  }

  create() {
    const { W, H, FONT } = UI;
    UI.drawFelt(this);
    const deck = Rules.createDeck();
    for (let i = 0; i < 36; i++) {
      const card = deck[Math.floor(Math.random() * deck.length)];
      const img = this.add.image(Phaser.Math.Between(40, W - 40), -100, card.id).setDisplaySize(70, 102).setAngle(Phaser.Math.Between(-30, 30));
      this.tweens.add({
        targets: img, y: H + 120, angle: img.angle + Phaser.Math.Between(-180, 180),
        delay: i * 140, duration: Phaser.Math.Between(2200, 3400), repeat: -1, ease: 'Quad.in',
      });
    }
    const won = this.result.humanWon;
    const panel = this.add.graphics();
    panel.fillStyle(0x0f241c, 0.88).fillRoundedRect(W / 2 - 260, 170, 520, 360, 24);
    panel.lineStyle(3, 0xe8b923, 1).strokeRoundedRect(W / 2 - 260, 170, 520, 360, 24);
    this.add.text(W / 2, 250, won ? 'You win!' : `${this.result.winnerName} wins!`, {
      fontFamily: FONT, fontSize: '64px', fontStyle: '900', color: won ? '#e8b923' : '#f3ead2', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);
    this.add.text(W / 2, 315, won ? 'Hongera! Your hand is empty.' : 'Mzalendo got there first. Rematch?', { fontFamily: FONT, fontSize: '20px', color: '#f3ead2', fontStyle: 'italic' }).setOrigin(0.5);
    UI.makeButton(this, W / 2, 400, 'Rematch', () => this.scene.start('GameScene', {}));
    UI.makeButton(this, W / 2, 470, 'Main Menu', () => this.scene.start('MainMenuScene'), { fill: 0x24543f, hoverFill: 0x2f6b51, color: '#f3ead2', border: 0xe8b923 });
  }
}

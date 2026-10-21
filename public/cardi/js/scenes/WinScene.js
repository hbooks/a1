/* =====================================================================
 * WinScene — result screen with cascading cards, final scores, rematch.
 * ===================================================================== */
class WinScene extends Phaser.Scene {
  constructor() {
    super('WinScene');
  }

  init(data) {
    // data now receives scores and player names from GameScene
    this.result = {
      winnerName: 'You',
      humanWon: true,
      humanName: 'You',
      botName: 'Carl',
      scores: [0, 0],
      ...data
    };
  }

  create() {
    const { W, H, FONT } = UI;
    UI.drawFelt(this);

    // 1. Cascading background cards
    const deck = Rules.createDeck();
    for (let i = 0; i < 36; i++) {
      const card = deck[Math.floor(Math.random() * deck.length)];
      const img = this.add.image(Phaser.Math.Between(40, W - 40), -100, card.id).setDisplaySize(70, 102).setAngle(Phaser.Math.Between(-30, 30));
      this.tweens.add({
        targets: img, y: H + 120, angle: img.angle + Phaser.Math.Between(-180, 180),
        delay: i * 140, duration: Phaser.Math.Between(2200, 3400), repeat: -1, ease: 'Quad.in', alpha: 0.4
      });
    }

    const won = this.result.humanWon;

    // 2. Main Panel (Wider and taller to fit the scoreboard)
    const panelW = 560, panelH = 480;
    const panelX = W / 2 - panelW / 2, panelY = H / 2 - panelH / 2 - 20;

    const panel = this.add.graphics();
    panel.fillStyle(0x0a1a14, 0.95).fillRoundedRect(panelX, panelY, panelW, panelH, 24);
    panel.lineStyle(3, 0xe8b923, 1).strokeRoundedRect(panelX, panelY, panelW, panelH, 24);
    panel.lineStyle(1, 0xe8b923, 0.3).strokeRoundedRect(panelX + 6, panelY + 6, panelW - 12, panelH - 12, 20);

    // 3. Title
    this.add.text(W / 2, panelY + 60, won ? 'VICTORY' : 'DEFEAT', {
      fontFamily: FONT, fontSize: '56px', fontStyle: '900', color: won ? '#e8b923' : '#ff6b6b',
      stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(W / 2, panelY + 105, won ? 'SMART MOVES POINTS EARNED' : `SMART MOVES POINTS EARNED`, {
      fontFamily: FONT, fontSize: '18px', color: '#cfe3d8', fontStyle: 'italic'
    }).setOrigin(0.5);

    // 4. SCOREBOARD (The new UI)
    const sbY = panelY + 160;

    // Divider line
    const div = this.add.graphics();
    div.lineStyle(1, 0x2e5242, 1).lineBetween(panelX + 40, sbY + 40, panelX + panelW - 40, sbY + 40);

    // Player 1 (Human)
    this.add.text(W / 2 - 110, sbY, this.result.humanName.toUpperCase(), {
      fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: won ? '#e8b923' : '#9fbfae'
    }).setOrigin(0.5);
    this.add.text(W / 2 - 110, sbY + 35, String(this.result.scores[0]), {
      fontFamily: FONT, fontSize: '48px', fontStyle: '900', color: '#ffffff'
    }).setOrigin(0.5);

    // VS
    this.add.text(W / 2, sbY + 25, 'VS', {
      fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#4d6b5d'
    }).setOrigin(0.5);

    // Player 2 (Bot)
    this.add.text(W / 2 + 110, sbY, this.result.botName.toUpperCase(), {
      fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: !won ? '#e8b923' : '#9fbfae'
    }).setOrigin(0.5);
    this.add.text(W / 2 + 110, sbY + 35, String(this.result.scores[1]), {
      fontFamily: FONT, fontSize: '48px', fontStyle: '900', color: '#ffffff'
    }).setOrigin(0.5);

    // 5. Buttons
    const btnY = panelY + panelH - 80;
    UI.makeButton(this, W / 2, btnY, 'Rematch', () => this.scene.start('GameScene', {}));
    UI.makeButton(this, W / 2, btnY + 70, 'Main Menu', () => this.scene.start('MainMenuScene'), {
      fill: 0x24543f, hoverFill: 0x2f6b51, color: '#f3ead2', border: 0xe8b923
    });

    // 6. Win effect (Confetti / Flash)
    if (won) {
      this.cameras.main.flash(400, 232, 185, 35, false);
    }
  }
}
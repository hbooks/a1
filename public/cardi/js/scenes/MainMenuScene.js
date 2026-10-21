/* =====================================================================
 * MainMenuScene — Title, Modals (Play, Multiplayer, Social, Rules), Audio
 * ===================================================================== */
class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
  }

  preload() {
    // Load menu music and click sound
    this.load.audio('menu_music', '/cardi/assets/bg.mp3');
    this.load.audio('sfx_click', '/cardi/assets/ck.wav');
  }

  create() {
    const { W, H, FONT } = UI;
    UI.drawFelt(this);

    // --- AUDIO SETUP ---
    // Start background music on a loop
    if (!this.menuMusic) {
      this.menuMusic = this.sound.add('menu_music', { loop: true, volume: 0.4 });
      this.menuMusic.play();
    }

    // Fade out and stop music when leaving the menu
    this.events.once('shutdown', () => {
      if (this.menuMusic) {
        this.tweens.add({
          targets: this.menuMusic,
          volume: 0,
          duration: 800,
          onComplete: () => {
            this.menuMusic.stop();
            this.menuMusic = null;
          }
        });
      }
    });

    // Decorative fanned cards.
    const deco = ['hearts_ace', 'card_back', 'clubs_king', 'card_back', 'spades_jack', 'card_back', 'diamonds_3'];
    deco.forEach((key, i) => {
      const off = i - (deco.length - 1) / 2;
      const img = this.add.image(W / 2 + off * 70, 610 + Math.abs(off) * 10, key).setDisplaySize(110, 160).setAngle(off * 8).setAlpha(0.9);
      this.tweens.add({ targets: img, y: img.y - 8, duration: 1600 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    });
    [[110, 140, -18], [790, 160, 16]].forEach(([x, y, a]) => this.add.image(x, y, 'card_back').setDisplaySize(90, 130).setAngle(a).setAlpha(0.35));

    // Title
    const title = this.add.text(W / 2, 130, 'CARDI', {
      fontFamily: FONT, fontSize: '120px', color: '#e8b923', fontStyle: '900',
      stroke: '#5a4300', strokeThickness: 8, shadow: { offsetX: 0, offsetY: 6, color: '#000', blur: 12, fill: true },
    }).setOrigin(0.5);
    this.tweens.add({ targets: title, scale: 1.03, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.add.text(W / 2, 208, 'Dominate the spinning table', { fontFamily: FONT, fontSize: '22px', color: '#f3ead2', fontStyle: 'italic' }).setOrigin(0.5);

    // Buttons (ui.js handles the click sound automatically)
    UI.makeButton(this, W / 2, 280, 'Play', () => this.showPlayModal(), { width: 240, height: 56 });
    UI.makeButton(this, W / 2, 350, 'Multiplayer', () => this.showMultiplayerModal(), { width: 240, height: 56, fill: 0x24543f, hoverFill: 0x2f6b51, color: '#f3ead2', border: 0xe8b923 });
    UI.makeButton(this, W / 2, 420, 'Shop', () => this.scene.start('ShopScene'), { width: 240, height: 56, fill: 0x24543f, hoverFill: 0x2f6b51, color: '#f3ead2', border: 0xe8b923 });

    // How to Play link (custom interactive, needs manual sound)
    const ht = this.add.text(W / 2, 495, 'How to Play', { fontFamily: FONT, fontSize: '20px', color: '#9fbfae', fontStyle: 'italic' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    ht.on('pointerover', () => ht.setColor('#e8b923'));
    ht.on('pointerout', () => ht.setColor('#9fbfae'));
    ht.on('pointerdown', () => {
      if (this.cache.audio.exists('sfx_click')) this.sound.play('sfx_click');
      this.showHowTo();
    });

    // Bottom corner buttons (ui.js handles the click sound)
    UI.makeButton(this, W - 50, H - 50, 'Settings', () => this.showSettings(), { width: 100, height: 40, fontSize: '14px', fill: 0x1a3a2e, border: 0x4d6b5d });
    UI.makeButton(this, W - 160, H - 50, 'Social', () => this.showSocial(), { width: 100, height: 40, fontSize: '14px', fill: 0x1a3a2e, border: 0x4d6b5d });
  }

  /* --- 1. PLAY MODAL --- */
  showPlayModal() {
    const { W, H, FONT } = UI;
    const layer = this.add.container(0, 0).setDepth(100);
    this.modal = layer;
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setInteractive();
    this.tweens.add({ targets: dim, fillAlpha: 0.75, duration: 200 });
    dim.on('pointerdown', () => { this.modal.destroy(); this.modal = null; });

    const panel = this.add.container(W / 2, H / 2).setScale(0.9).setAlpha(0);
    const bg = this.add.graphics().fillStyle(0x10291f, 1).fillRoundedRect(-240, -180, 480, 360, 24).lineStyle(3, 0xe8b923, 1).strokeRoundedRect(-240, -180, 480, 360, 24);
    const title = this.add.text(0, -140, 'SELECT OPPONENTS', { fontFamily: FONT, fontSize: '24px', fontStyle: '900', color: '#e8b923' }).setOrigin(0.5).setLetterSpacing(4);

    panel.add([bg, title]);

    const startGame = (botCount) => {
      const players = [{ name: 'You', isBot: false }];
      const names = [NameHandler.getRandomName(), NameHandler.getRandomName(), NameHandler.getRandomName()];
      for (let i = 0; i < botCount; i++) players.push({ name: names[i], isBot: true });

      this.modal.destroy();
      this.scene.start('GameScene', { players });
    };

    const configs = [
      { bots: 1, label: '1 vs 1', sub: '1 Bot' },
      { bots: 2, label: '1 vs 2', sub: '2 Bots' },
      { bots: 3, label: '1 vs 3', sub: '3 Bots' }
    ];

    configs.forEach((cfg, i) => {
      const x = -140 + i * 140;
      const c = this.add.container(x, -20);
      const b = this.add.graphics();
      b.fillStyle(0x1a3a2e, 1).fillRoundedRect(-60, -60, 120, 120, 16).lineStyle(2, 0x2e5242, 1).strokeRoundedRect(-60, -60, 120, 120, 16);
      const countTxt = this.add.text(0, -15, cfg.label, { fontFamily: FONT, fontSize: '28px', fontStyle: '900', color: '#ffffff' }).setOrigin(0.5);
      const subTxt = this.add.text(0, 25, cfg.sub, { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#9fbfae' }).setOrigin(0.5);
      c.add([b, countTxt, subTxt]).setSize(120, 120).setInteractive({ useHandCursor: true });
      c.on('pointerover', () => this.tweens.add({ targets: c, scale: 1.05, duration: 100 }));
      c.on('pointerout', () => this.tweens.add({ targets: c, scale: 1, duration: 100 }));
      c.on('pointerdown', () => {
        if (this.cache.audio.exists('sfx_click')) this.sound.play('sfx_click');
        startGame(cfg.bots);
      });
      panel.add(c);
    });

    const cancel = UI.makeButton(this, W / 2, H / 2 + 130, 'Cancel', () => { this.modal.destroy(); this.modal = null; }, { width: 120, height: 40, fill: 0x2a1212, border: 0x6b2a2a });
    panel.add(cancel);

    layer.add([dim, panel]);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 250, ease: 'Back.out' });
  }

  /* --- 2. MULTIPLAYER MODAL --- */
  showMultiplayerModal() {
    const { W, H, FONT } = UI;
    const layer = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setInteractive();
    this.tweens.add({ targets: dim, fillAlpha: 0.75, duration: 200 });
    dim.on('pointerdown', () => { layer.destroy(); });

    const panel = this.add.container(W / 2, H / 2).setScale(0.9).setAlpha(0);
    const bg = this.add.graphics().fillStyle(0x10291f, 1).fillRoundedRect(-240, -160, 480, 320, 24).lineStyle(3, 0xe8b923, 1).strokeRoundedRect(-240, -160, 480, 320, 24);
    const title = this.add.text(0, -120, 'ONLINE PLAY', { fontFamily: FONT, fontSize: '24px', fontStyle: '900', color: '#e8b923' }).setOrigin(0.5).setLetterSpacing(4);
    const sub = this.add.text(0, -85, 'Coming Soon', { fontFamily: FONT, fontSize: '14px', fontStyle: 'italic', color: '#9fbfae' }).setOrigin(0.5);
    panel.add([bg, title, sub]);

    UI.makeButton(this, 0, -20, 'Create Room', () => { /* logic later */ }, { width: 240, height: 50, fill: 0x24543f, border: 0xe8b923 });
    UI.makeButton(this, 0, 50, 'Join Room', () => { /* logic later */ }, { width: 240, height: 50, fill: 0x24543f, border: 0xe8b923 });

    const closeBtn = UI.makeButton(this, 0, 120, 'Close', () => { layer.destroy(); }, { width: 120, height: 40, fill: 0x2a1212, border: 0x6b2a2a });
    panel.add(closeBtn);

    layer.add([dim, panel]);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 250, ease: 'Back.out' });
  }

  /* --- 3. SOCIAL MODAL --- */
  showSocial() {
    const { W, H, FONT } = UI;
    const layer = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setInteractive();
    this.tweens.add({ targets: dim, fillAlpha: 0.75, duration: 200 });
    dim.on('pointerdown', () => { layer.destroy(); });

    const panel = this.add.container(W / 2, H / 2).setScale(0.9).setAlpha(0);
    const bg = this.add.graphics().fillStyle(0x10291f, 1).fillRoundedRect(-200, -120, 400, 240, 24).lineStyle(3, 0xe8b923, 1).strokeRoundedRect(-200, -120, 400, 240, 24);
    const title = this.add.text(0, -80, 'FOLLOW US', { fontFamily: FONT, fontSize: '22px', fontStyle: '900', color: '#e8b923' }).setOrigin(0.5).setLetterSpacing(4);
    panel.add([bg, title]);

    const link = (y, label, handle) => {
      const t = this.add.text(0, y, `${label}  @${handle}`, { fontFamily: FONT, fontSize: '18px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on('pointerover', () => t.setColor('#e8b923'));
      t.on('pointerout', () => t.setColor('#ffffff'));
      t.on('pointerdown', () => {
        if (this.cache.audio.exists('sfx_click')) this.sound.play('sfx_click');
        /* open url logic */
      });
      panel.add(t);
    };
    link(-20, 'Instagram', 'hazypixelstudios');
    link(20, 'X (Twitter)', 'hazypixelstudio');
    link(60, 'TikTok', 'lordquz');

    const closeBtn = UI.makeButton(this, 0, 110, 'Close', () => { layer.destroy(); }, { width: 120, height: 36, fill: 0x2a1212, border: 0x6b2a2a });
    panel.add(closeBtn);

    layer.add([dim, panel]);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 250, ease: 'Back.out' });
  }

  /* --- 4. SETTINGS MODAL --- */
  showSettings() {
    const { W, H, FONT } = UI;
    const layer = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setInteractive();
    this.tweens.add({ targets: dim, fillAlpha: 0.75, duration: 200 });
    dim.on('pointerdown', () => { layer.destroy(); });

    const panel = this.add.container(W / 2, H / 2).setScale(0.9).setAlpha(0);
    const bg = this.add.graphics().fillStyle(0x10291f, 1).fillRoundedRect(-200, -100, 400, 200, 24).lineStyle(3, 0xe8b923, 1).strokeRoundedRect(-200, -100, 400, 200, 24);
    const title = this.add.text(0, -60, 'SETTINGS', { fontFamily: FONT, fontSize: '22px', fontStyle: '900', color: '#e8b923' }).setOrigin(0.5).setLetterSpacing(4);
    panel.add([bg, title]);

    const muteBtn = UI.makeButton(this, 0, 0, 'Toggle Sound', () => {
      this.sound.mute = !this.sound.mute;
      muteBtn.label.setText(this.sound.mute ? 'Sound: OFF' : 'Sound: ON');
    }, { width: 200, height: 50, fill: 0x24543f, border: 0xe8b923 });
    panel.add(muteBtn);

    const closeBtn = UI.makeButton(this, 0, 80, 'Close', () => { layer.destroy(); }, { width: 120, height: 40, fill: 0x2a1212, border: 0x6b2a2a });
    panel.add(closeBtn);

    layer.add([dim, panel]);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 250, ease: 'Back.out' });
  }

  /* --- 5. HOW TO PLAY --- */
  showHowTo() {
    const { W, H, FONT } = UI;
    const layer = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.85).setInteractive();
    dim.on('pointerdown', () => layer.destroy());

    const panel = this.add.container(W / 2, H / 2).setScale(0.95).setAlpha(0);

    // Background panel
    const bg = this.add.graphics().fillStyle(0x0a1a14, 1).fillRoundedRect(-320, -300, 640, 600, 20).lineStyle(3, 0xe8b923, 1).strokeRoundedRect(-320, -300, 640, 600, 20);

    const title = this.add.text(0, -260, 'HOW TO PLAY', { fontFamily: FONT, fontSize: '32px', fontStyle: '900', color: '#e8b923' }).setOrigin(0.5).setLetterSpacing(6);
    panel.add([bg, title]);

    // Left Column (Rules)
    const rulesText = [
      { head: 'GOAL', body: 'Empty your hand before anyone else.' },
      { head: 'YOUR TURN', body: 'Play a card matching the suit or rank. If no match, draw 1.' },
      { head: 'KICKBACK (King)', body: 'Reverses direction of play.' },
      { head: 'JUMP (Jack)', body: 'Skips the next player.' },
      { head: 'ACE', body: 'Wild card. Changes the suit. Cuts a punishment by 3.' },
      { head: 'FOUL (3)', body: 'Starts a punishment of 3 cards. Next player can stack 3s or use an Ace.' },
      { head: 'NIKO CARDI', body: 'Shout it when you have 1 card left. Forgetting costs +1 card.' },
    ];

    let ry = -210;
    rulesText.forEach(r => {
      const h = this.add.text(-290, ry, r.head, { fontFamily: FONT, fontSize: '16px', fontStyle: '900', color: '#e8b923' });
      const b = this.add.text(-290, ry + 22, r.body, { fontFamily: FONT, fontSize: '14px', color: '#cfe3d8', wordWrap: { width: 300 } });
      panel.add([h, b]);
      ry += 66;
    });

    // Right Column (Scoring & Icons)
    const scoreTitle = this.add.text(140, -210, 'SMART MOVES (SCORES)', { fontFamily: FONT, fontSize: '16px', fontStyle: '900', color: '#ff6b6b' }).setOrigin(0.5);
    const scoreSub = this.add.text(140, -185, 'Earn points for tactical plays:', { fontFamily: FONT, fontSize: '12px', fontStyle: 'italic', color: '#9fbfae' }).setOrigin(0.5);
    panel.add([scoreTitle, scoreSub]);

    const scores = [
      { pts: '+2', text: 'Combo (2 cards)' },
      { pts: '+3', text: 'Mega Combo (3+ cards)' },
      { pts: '+4', text: 'Tactical Block / Sniper Foul' },
      { pts: '+5', text: 'Sniper Kickback' },
      { pts: '+6', text: 'Sniper Jump' },
      { pts: '+7', text: 'Ace Override' },
    ];

    let sy = -150;
    scores.forEach(s => {
      const ptBox = this.add.graphics().fillStyle(0x1a3a2e, 1).fillRoundedRect(-40, sy - 12, 60, 24, 6).lineStyle(1.5, 0xe8b923, 1).strokeRoundedRect(-40, sy - 12, 60, 24, 6);
      const ptTxt = this.add.text(-10, sy, s.pts, { fontFamily: FONT, fontSize: '14px', fontStyle: '900', color: '#e8b923' }).setOrigin(0.5);
      const descTxt = this.add.text(35, sy, s.text, { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#f3ead2' }).setOrigin(0, 0.5);
      panel.add([ptBox, ptTxt, descTxt]);
      sy += 42;
    });

    // Close Button
    const closeBtn = UI.makeButton(this, 0, 260, 'Got it', () => layer.destroy(), { width: 160, height: 44, fill: 0xe8b923, color: '#241900' });
    panel.add(closeBtn);

    layer.add([dim, panel]);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 250, ease: 'Back.out' });
  }
}
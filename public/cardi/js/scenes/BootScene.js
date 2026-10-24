/* =====================================================================
 * BootScene — Simple centered loader with secure config fetch.
 * ===================================================================== */
class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Get the actual screen center
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    // 1. The Centered Pulsing Text
    const loadText = this.add.text(cx, cy - 30, 'Loading Assets...', {
      fontFamily: UI.FONT,
      fontSize: '28px',
      fontStyle: '900',
      color: '#e8b923',
      shadow: { offsetX: 0, offsetY: 4, color: '#000', blur: 8, fill: true }
    }).setOrigin(0.5);

    // Pulse animation for the text
    this.tweens.add({
      targets: loadText,
      scale: 1.08,
      alpha: 0.7,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });

    // 2. The Progress Bar (Directly under the text)
    const barWidth = 240;
    const barY = cy + 20;

    const barBg = this.add.graphics();
    const barFill = this.add.graphics();

    // Background track
    barBg.fillStyle(0x000000, 0.5).fillRoundedRect(cx - barWidth / 2, barY, barWidth, 10, 5);
    barBg.lineStyle(2, 0x2e5242, 1).strokeRoundedRect(cx - barWidth / 2, barY, barWidth, 10, 5);

    // 3. Fetch Secure Config (Invisible to user, happens in background)
    this.fetchConfig();

    // 4. Update Progress Bar & Load Assets
    this.load.on('progress', (v) => {
      barFill.clear();
      if (v > 0) {
        barFill.fillStyle(0xe8b923, 1).fillRoundedRect(cx - barWidth / 2, barY, Math.max(10, barWidth * v), 10, 5);
      }
    });

    this.load.on('complete', () => {
      loadText.setText('Ready!');
      // Brief pause before transitioning
      this.time.delayedCall(300, () => {
        this.cameras.main.fadeOut(400, 15, 36, 28);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MainMenuScene'));
      });
    });

    // Load sounds
    this.load.audio('sfx_click', MK.BASE + 'assets/ck.wav');

    // Load card art if it exists
    if (window.CARDI_CARD_ART) {
      this.load.setPath(MK.BASE + 'assets/cards/');
      Rules.createDeck().forEach((c) => this.load.image(c.id, `${c.id}.png`));
      this.load.image('card_back', 'back.png');
    }
  }

  async fetchConfig(statusText) {
    try {
      const res = await fetch('/config', {
        method: 'GET',
        headers: {
          'x-cardi-client': 'true' // Tell the server we are the game
        }
      });

      if (res.ok) {
        const contentType = res.headers.get("content-type");

        // Make sure we actually got JSON back, not just a text "OK"
        if (contentType && contentType.includes("application/json")) {
          window.CARDI_CONFIG = await res.json();
          if (window.CARDI_CONFIG.supabaseUrl) {
            statusText.setText('Secure connection established');
          } else {
            statusText.setText('Warning: Supabase keys missing in env');
          }
        } else {
          statusText.setText('Server returned invalid config format');
        }
      } else {
        statusText.setText('Failed to load config');
      }
    } catch (e) {
      console.warn('Could not load secure config', e);
      statusText.setText('Offline mode');
    }
  }

  create() {
    // Generate fallback card textures if the images failed to load
    Rules.createDeck().forEach((c) => {
      if (!this.textures.exists(c.id)) this.makeCardTexture(c);
    });
    if (!this.textures.exists('card_back')) this.makeBackTexture();

    // Load volume and mute settings
    const v = localStorage.getItem('cardi_vol');
    if (v !== null) this.sound.volume = parseFloat(v);
    this.sound.mute = localStorage.getItem('cardi_mute') === '1';
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
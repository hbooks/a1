/* =====================================================================
 * MainMenuScene + MK (menu kit: buttons, modals, toast shared by menu scenes)
 * ===================================================================== */
const MK = {
  GOLD: '#e8b923', GOLD_N: 0xe8b923,
  BASE: window.CARDI_BASE || '/cardi/',

  click(s) { if (s.cache.audio.exists('sfx_click')) s.sound.play('sfx_click'); },

  /** Chunky game button. Returns a container (.label = text). Position is local if you later add it to a container. */
  btn(s, x, y, label, cb, o = {}) {
    const w = o.w || 240, h = o.h || 56, r = Math.min(18, h / 3);
    const P = o.primary ? { f: 0xe8b923, hf: 0xffd24a, c: '#241900', b: 0xffe48a }
      : o.danger ? { f: 0x2a1212, hf: 0x421a1a, c: '#ffb4b4', b: 0x6b2a2a }
        : { f: 0x1a3a2e, hf: 0x24543f, c: '#f3ead2', b: 0xe8b923 };
    const c = s.add.container(x, y), g = s.add.graphics();
    const draw = (hover) => {
      g.clear();
      g.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2, -h / 2 + 5, w, h, r);
      g.fillStyle(hover ? P.hf : P.f, 1).fillRoundedRect(-w / 2, -h / 2, w, h, r);
      g.fillStyle(0xffffff, 0.12).fillRoundedRect(-w / 2 + 4, -h / 2 + 3, w - 8, h / 2 - 3, { tl: r - 2, tr: r - 2, bl: 0, br: 0 });
      g.lineStyle(2, P.b, o.primary ? 1 : 0.6).strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    };
    draw(false);
    const t = s.add.text(0, -1, label, { fontFamily: UI.FONT, fontSize: o.size || (h > 50 ? '24px' : '16px'), fontStyle: '900', color: P.c }).setOrigin(0.5);
    c.add([g, t]); c.label = t; c.setSize(w, h);
    if (o.disabled) return c.setAlpha(0.5);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerover', () => { draw(true); s.tweens.add({ targets: c, scale: 1.04, duration: 90 }); });
    c.on('pointerout', () => { draw(false); s.tweens.add({ targets: c, scale: 1, duration: 90 }); });
    c.on('pointerdown', () => s.tweens.add({ targets: c, scale: 0.95, duration: 60 }));
    c.on('pointerup', () => { s.tweens.add({ targets: c, scale: 1.04, duration: 80 }); MK.click(s); if (cb) cb(); });
    return c;
  },

  /** Modal with dim, blocker (clicks on the panel no longer close it), ESC + Close button. build(panel, api) adds content. */
  modal(s, { title, w, h, close = 'Close' }, build) {
    const { W, H, FONT } = UI;
    const layer = s.add.container(0, 0).setDepth(100);
    const dim = s.add.rectangle(W / 2, H / 2, W * 6, H * 6, 0x000000, 0).setInteractive();
    s.tweens.add({ targets: dim, fillAlpha: 0.78, duration: 180 });
    const panel = s.add.container(W / 2, H / 2).setScale(0.88).setAlpha(0);
    const g = s.add.graphics()
      .fillStyle(0x000000, 0.4).fillRoundedRect(-w / 2 + 6, -h / 2 + 10, w, h, 26)
      .fillStyle(0x0c2119, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 26)
      .lineStyle(3, 0xe8b923, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 26)
      .lineStyle(1, 0xe8b923, 0.25).strokeRoundedRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 20);
    const blocker = s.add.zone(0, 0, w, h).setInteractive();
    const ti = s.add.text(0, -h / 2 + 42, title, { fontFamily: FONT, fontSize: '26px', fontStyle: '900', color: MK.GOLD }).setOrigin(0.5).setLetterSpacing(5);
    panel.add([g, blocker, ti]);
    const api = {
      layer, panel, closed: false,
      close() {
        if (api.closed) return; api.closed = true;
        if (s.input.keyboard) s.input.keyboard.off('keydown-ESC', api.close);
        s.tweens.add({ targets: panel, scale: 0.92, alpha: 0, duration: 120 });
        s.tweens.add({ targets: dim, fillAlpha: 0, duration: 120, onComplete: () => layer.destroy() });
      },
    };
    dim.on('pointerdown', api.close);
    if (s.input.keyboard) s.input.keyboard.on('keydown-ESC', api.close);
    if (build) build(panel, api);
    if (close) panel.add(MK.btn(s, 0, h / 2 - 40, close, api.close, { w: 140, h: 42, danger: true }));
    layer.add([dim, panel]);
    s.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 260, ease: 'Back.out' });
    return api;
  },

  toast(s, msg) {
    const t = s.add.text(UI.W / 2, UI.H - 90, msg, { fontFamily: UI.FONT, fontSize: '18px', fontStyle: 'bold', color: '#241900', backgroundColor: '#e8b923', padding: { x: 18, y: 10 } })
      .setOrigin(0.5).setDepth(300).setAlpha(0);
    s.tweens.add({ targets: t, alpha: 1, y: t.y - 14, duration: 200, hold: 1400, yoyo: true, onComplete: () => t.destroy() });
  },

  /** Slide-and-fade entrance. */
  pop(s, obj, delay, dy = 30) {
    const y = obj.y; obj.setAlpha(0).setY(y + dy);
    s.tweens.add({ targets: obj, alpha: obj.__a || 1, y, duration: 420, delay, ease: 'Back.out' });
  },

  fullscreen(s) { s.scale.isFullscreen ? s.scale.stopFullscreen() : s.scale.startFullscreen(); },
};

class MainMenuScene extends Phaser.Scene {
  constructor() { super('MainMenuScene'); }

  create() {
    const { W, H, FONT } = UI;
    UI.drawFelt(this);
    this.modal = null;
    this.cameras.main.fadeIn(300, 15, 36, 28);

    // Drifting suit symbols for depth
    ['♠', '♥', '♦', '♣'].forEach((s, k) => {
      for (let i = 0; i < 4; i++) {
        const t = this.add.text(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), s, { fontFamily: FONT, fontSize: Phaser.Math.Between(30, 70) + 'px', color: k % 3 ? '#ff6b6b' : '#ffffff' })
          .setAlpha(0.06).setAngle(Phaser.Math.Between(-30, 30));
        this.tweens.add({ targets: t, y: t.y - 110, angle: t.angle + 35, duration: Phaser.Math.Between(6000, 11000), yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
    });

    this.startMusic();
    this.buildFan(W, H);

    // Title
    const title = this.add.text(W / 2, 120, 'CARDI', { fontFamily: FONT, fontSize: '120px', color: MK.GOLD, fontStyle: '900', stroke: '#5a4300', strokeThickness: 8, shadow: { offsetX: 0, offsetY: 6, color: '#000', blur: 12, fill: true } }).setOrigin(0.5);
    const tag = this.add.text(W / 2, 198, 'DOMINATE THE SPINNING TABLE', { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#f3ead2' }).setOrigin(0.5).setLetterSpacing(5);
    title.setScale(0.4).setAlpha(0);
    this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 600, ease: 'Back.out', onComplete: () => this.tweens.add({ targets: title, scale: 1.03, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.inOut' }) });
    MK.pop(this, tag, 300, 10);

    // Main buttons
    const play = MK.btn(this, W / 2, 285, 'PLAY', () => this.showPlayModal(), { w: 300, h: 70, primary: true, size: '32px' });
    const multi = MK.btn(this, W / 2, 365, 'Multiplayer', () => this.showMultiplayerModal(), { w: 250, h: 52 });
    const shop = MK.btn(this, W / 2, 430, 'Shop', () => this.scene.start('ShopScene'), { w: 250, h: 52 });
    [play, multi, shop].forEach((b, i) => MK.pop(this, b, 350 + i * 90));
    this.tweens.add({ targets: play, scale: 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: 1200 });

    const ht = this.add.text(W / 2, 492, 'How to Play', { fontFamily: FONT, fontSize: '19px', color: '#9fbfae', fontStyle: 'italic' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    ht.on('pointerover', () => ht.setColor(MK.GOLD)).on('pointerout', () => ht.setColor('#9fbfae'));
    ht.on('pointerdown', () => { MK.click(this); this.showHowTo(); });
    MK.pop(this, ht, 650, 10);

    // Top bar pinned to the real screen edges, not the 900x700 design box
    const small = { w: 124, h: 38, size: '14px' };
    const bar = [], pin = (o, side, dx) => { bar.push({ o, side, dx }); return o; };
    this.soundBtn = pin(MK.btn(this, 0, 0, this.sound.mute ? 'Sound: OFF' : 'Sound: ON', () => {
      this.sound.mute = !this.sound.mute;
      localStorage.setItem('cardi_mute', this.sound.mute ? '1' : '0');
      this.soundBtn.label.setText(this.sound.mute ? 'Sound: OFF' : 'Sound: ON');
    }, small), 'l', 215);
    pin(MK.btn(this, 0, 0, 'Fullscreen', () => MK.fullscreen(this), small), 'l', 80);
    pin(MK.btn(this, 0, 0, 'Social', () => this.showSocial(), small), 'r', 215);
    pin(MK.btn(this, 0, 0, 'Settings', () => this.scene.start('SettingsScene', { returnScene: 'MainMenuScene' }), small), 'r', 80);
    const copy = this.add.text(0, 0, '© 2026 Hazy Pixel Studio', { fontFamily: FONT, fontSize: '11px', color: '#4d6b5d' }).setOrigin(0.5);
    const layout = () => {
      const v = UI.view(this);
      bar.forEach(({ o, side, dx }) => { o.x = side === 'l' ? v.left + dx : v.right - dx; o.y = v.top + 36; });
      copy.setPosition(W / 2, v.bottom - 14);
    };
    layout();
    this.scale.on('resize', layout);
    this.events.once('shutdown', () => this.scale.off('resize', layout));
  }

  /** Music streams in AFTER the menu is visible, so the menu never waits on the big mp3. */
  startMusic() {
    const play = () => {
      if (!this.scene.isActive('MainMenuScene') || !this.cache.audio.exists('menu_music')) return;
      if (!this.menuMusic || !this.menuMusic.manager) this.menuMusic = this.sound.add('menu_music', { loop: true, volume: 0 });
      if (!this.menuMusic.isPlaying) { this.menuMusic.play(); this.tweens.add({ targets: this.menuMusic, volume: 0.4, duration: 1500 }); }
    };
    const ready = () => (this.sound.locked ? this.sound.once('unlocked', play) : play());
    if (this.cache.audio.exists('menu_music')) return ready();
    this.load.once('filecomplete-audio-menu_music', ready);
    this.load.audio('menu_music', MK.BASE + 'assets/bg.mp3');
    this.load.start();
  }

  buildFan(W, H) {
    const deco = ['hearts_ace', 'card_back', 'clubs_king', 'card_back', 'spades_jack', 'card_back', 'diamonds_3'];
    deco.forEach((key, i) => {
      const off = i - 3, ty = H - 90 + Math.abs(off) * 10;
      const img = this.add.image(W / 2 + off * 70, H + 200, key).setDisplaySize(110, 160).setAngle(off * 8).setAlpha(0.92);
      this.tweens.add({
        targets: img, y: ty, duration: 500, delay: 500 + i * 70, ease: 'Cubic.out',
        onComplete: () => this.tweens.add({ targets: img, y: ty - 8, duration: 1600 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
      });
    });
  }

  /* --- PLAY --- */
  showPlayModal() {
    const start = (bots) => {
      const used = new Set(), players = [{ name: 'You', isBot: false }];
      for (let i = 0; i < bots; i++) {
        let n = 'Bot ' + (i + 1);
        for (let k = 0; k < 10; k++) { const c = window.NameHandler ? NameHandler.getRandomName() : n; if (!used.has(c)) { n = c; break; } }
        used.add(n); players.push({ name: n, isBot: true });
      }
      this.modal.close();
      const go = () => this.scene.start('GameScene', { players });
      if (this.menuMusic && this.menuMusic.isPlaying) {
        this.tweens.add({ targets: this.menuMusic, volume: 0, duration: 700, onComplete: () => { this.menuMusic.stop(); this.menuMusic.destroy(); this.menuMusic = null; go(); } });
      } else go();
    };
    this.modal = MK.modal(this, { title: 'SELECT OPPONENTS', w: 520, h: 330, close: 'Cancel' }, (panel) => {
      [[1, '1 vs 1', '1 Bot'], [2, '1 vs 2', '2 Bots'], [3, '1 vs 3', '3 Bots']].forEach(([n, a, b], i) => {
        const c = this.add.container(-150 + i * 150, 5);
        const g = this.add.graphics().fillStyle(0x1a3a2e, 1).fillRoundedRect(-65, -60, 130, 120, 16).lineStyle(2, 0x2e5242, 1).strokeRoundedRect(-65, -60, 130, 120, 16);
        const t1 = this.add.text(0, -14, a, { fontFamily: UI.FONT, fontSize: '28px', fontStyle: '900', color: '#fff' }).setOrigin(0.5);
        const t2 = this.add.text(0, 26, b, { fontFamily: UI.FONT, fontSize: '14px', fontStyle: 'bold', color: '#9fbfae' }).setOrigin(0.5);
        c.add([g, t1, t2]).setSize(130, 120).setInteractive({ useHandCursor: true });
        c.on('pointerover', () => { g.lineStyle(3, 0xe8b923, 1).strokeRoundedRect(-65, -60, 130, 120, 16); this.tweens.add({ targets: c, scale: 1.06, duration: 100 }); });
        c.on('pointerout', () => { g.lineStyle(3, 0x2e5242, 1).strokeRoundedRect(-65, -60, 130, 120, 16); this.tweens.add({ targets: c, scale: 1, duration: 100 }); });
        c.on('pointerdown', () => { MK.click(this); start(n); });
        panel.add(c);
      });
    });
  }

  /* --- MULTIPLAYER --- */
  showMultiplayerModal() {
    this.modal = MK.modal(this, { title: 'ONLINE PLAY', w: 480, h: 330 }, (panel) => {

      // Helper to get or create an anonymous client ID
      const getClientId = () => {
        let id = localStorage.getItem('cardi_client_id');
        if (!id) {
          // Generate a v4 UUID
          id = crypto.randomUUID();
          localStorage.setItem('cardi_client_id', id);
        }
        return id;
      };

      // CREATE ROOM
      const createBtn = MK.btn(this, 0, -60, 'Create Room', () => {
        createBtn.label.setText('Creating...');
        createBtn.disableInteractive();

        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const clientId = getClientId();

        fetch('/api?action=create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomCode: roomCode,
            hostId: clientId,
            hostName: 'Host' // Or your username later
          })
        })
          .then(res => {
            // Check if the response is JSON before parsing
            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
              throw new Error("Server returned HTML instead of JSON. API route is broken.");
            }
            return res.json();
          })
          .then(data => {
            if (data.error) throw new Error(data.error);

            // Success: Show the room code
            panel.removeAll(true);
            panel.add(this.add.text(0, -80, 'ROOM CREATED', { fontFamily: UI.FONT, fontSize: '24px', fontStyle: '900', color: '#e8b923' }).setOrigin(0.5));
            panel.add(this.add.text(0, -20, 'Share this code:', { fontFamily: UI.FONT, fontSize: '16px', color: '#cfe3d8' }).setOrigin(0.5));
            panel.add(this.add.text(0, 30, roomCode, { fontFamily: UI.FONT, fontSize: '48px', fontStyle: '900', color: '#fff', letterSpacing: 10 }).setOrigin(0.5));

            panel.add(MK.btn(this, 0, 110, 'Start Game', () => {
              MK.toast(this, 'Waiting for players (Realtime coming next)');
            }, { w: 160, h: 42, primary: true }));
          })
          .catch(err => {
            createBtn.label.setText('Create Room');
            createBtn.setInteractive();
            MK.toast(this, err.message);
          });
      }, { w: 260, h: 52 });
      panel.add(createBtn);

      // JOIN ROOM
      panel.add(MK.btn(this, 0, 10, 'Join Room', () => {
        const code = window.prompt("Enter the 6-character room code:");
        if (!code || code.length !== 6) return;
        const clientId = getClientId();

        fetch('/api?action=join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomCode: code.toUpperCase(),
            userId: clientId,
            playerName: 'Guest'
          })
        })
          .then(res => {
            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
              throw new Error("Server returned HTML instead of JSON.");
            }
            return res.json();
          })
          .then(data => {
            if (data.error) throw new Error(data.error);
            MK.toast(this, `Joined room! Seat ${data.seatIndex + 1}`);
            this.modal.close();
          })
          .catch(err => MK.toast(this, err.message));
      }, { w: 260, h: 52 }));

    });
  }

  /* --- SOCIAL --- */
  showSocial() {
    const links = [['Instagram', 'hazypixelstudios', 'https://instagram.com/hazypixelstudios'], ['X (Twitter)', 'hazypixelstudio', 'https://x.com/hazypixelstudio'], ['TikTok', 'lordquz', 'https://tiktok.com/@lordquz']];
    this.modal = MK.modal(this, { title: 'FOLLOW US', w: 440, h: 330 }, (panel) => {
      links.forEach(([n, h, url], i) => panel.add(MK.btn(this, 0, -60 + i * 58, `${n}  @${h}`, () => window.open(url, '_blank', 'noopener'), { w: 340, h: 46, size: '16px' })));
    });
  }

  /* --- HOW TO PLAY --- */
  showHowTo() {
    const rules = [
      ['GOAL', 'Empty your hand before anyone else.'],
      ['YOUR TURN', 'Play a card matching the suit or rank. No match? Draw 1.'],
      ['KICKBACK (King)', 'Reverses direction of play.'],
      ['JUMP (Jack)', 'Skips the next player.'],
      ['ACE', 'Wild card. Changes the suit. Cuts a punishment by 3.'],
      ['FOUL (3)', 'Starts a 3-card punishment. Stack 3s or use an Ace.'],
      ['NIKO CARDI', 'Shout it at 1 card left. Forget and draw +1.'],
    ];
    const scores = [['+2', 'Combo (2 cards)'], ['+3', 'Mega Combo (3+)'], ['+4', 'Tactical Block / Sniper Foul'], ['+5', 'Sniper Kickback'], ['+6', 'Sniper Jump'], ['+7', 'Ace Override']];
    this.modal = MK.modal(this, { title: 'HOW TO PLAY', w: 700, h: 600, close: 'Got it' }, (panel) => {
      rules.forEach(([h, b], i) => {
        const y = -200 + i * 64;
        panel.add([this.add.text(-320, y, h, { fontFamily: UI.FONT, fontSize: '16px', fontStyle: '900', color: MK.GOLD }),
        this.add.text(-320, y + 21, b, { fontFamily: UI.FONT, fontSize: '14px', color: '#cfe3d8', wordWrap: { width: 330 } })]);
      });
      panel.add(this.add.text(185, -200, 'SMART MOVES', { fontFamily: UI.FONT, fontSize: '16px', fontStyle: '900', color: '#ff6b6b' }).setOrigin(0.5));
      scores.forEach(([p, t], i) => {
        const y = -150 + i * 44;
        panel.add([this.add.graphics().fillStyle(0x1a3a2e, 1).fillRoundedRect(35, y - 14, 50, 28, 7).lineStyle(1.5, 0xe8b923, 1).strokeRoundedRect(35, y - 14, 50, 28, 7),
        this.add.text(60, y, p, { fontFamily: UI.FONT, fontSize: '15px', fontStyle: '900', color: MK.GOLD }).setOrigin(0.5),
        this.add.text(98, y, t, { fontFamily: UI.FONT, fontSize: '14px', fontStyle: 'bold', color: '#f3ead2' }).setOrigin(0, 0.5)]);
      });
    });
  }
}
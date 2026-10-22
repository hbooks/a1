/* =====================================================================
 * ui.js — shared Phaser UI helpers (buttons, toasts, constants).
 * ===================================================================== */
(function (global) {
  'use strict';
  const UI = {
    W: 900,
    H: 700,
    FONT: 'Nunito, sans-serif',
    CW: 80,
    CH: 116,
    GOLD: 0xe8b923,
    FELT: 0x1a3a2e,
    hex: (s) => parseInt(s.replace('#', ''), 16),

    /** Visible world rect for the current screen (design area is 900x700, centered). */
    view(scene) {
      const sc = scene.scale, z = Math.min(sc.width / UI.W, sc.height / UI.H);
      const vw = sc.width / z, vh = sc.height / z;
      return { left: (UI.W - vw) / 2, right: (UI.W + vw) / 2, top: (UI.H - vh) / 2, bottom: (UI.H + vh) / 2, zoom: z };
    },

    /** Rounded gold button with hover scale. Returns a container. */
    makeButton(scene, x, y, label, onClick, opts = {}) {
      const w = opts.width || 220;
      const h = opts.height || 56;
      const fill = opts.fill ?? 0xe8b923;
      const hoverFill = opts.hoverFill ?? 0xf5cd3c;
      const c = scene.add.container(x, y);
      const bg = scene.add.graphics();
      const draw = (hover) => {
        bg.clear();
        bg.fillStyle(0x000000, 0.3);
        bg.fillRoundedRect(-w / 2 + 2, -h / 2 + 4, w, h, 14);
        bg.fillStyle(hover ? hoverFill : fill, 1);
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
        bg.lineStyle(2, opts.border ?? 0x7a5c00, 1);
        bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
      };
      draw(false);
      const t = scene.add
        .text(0, 0, label, {
          fontFamily: UI.FONT,
          fontSize: opts.fontSize || '24px',
          color: opts.color || '#1a1a1a',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      c.add([bg, t]);
      c.setSize(w, h);
      c.setInteractive({ useHandCursor: true });
      c.on('pointerover', () => { draw(true); scene.tweens.add({ targets: c, scale: 1.05, duration: 120 }); });
      c.on('pointerout', () => { draw(false); scene.tweens.add({ targets: c, scale: 1, duration: 120 }); });

      // --- AUTOMATIC CLICK SOUND FOR ALL BUTTONS ---
      c.on('pointerdown', () => {
        if (scene.cache.audio.exists('sfx_click')) {
          scene.sound.play('sfx_click', { volume: 1 });
        }
        onClick();
      });
      // ---------------------------------------------

      c.label = t;
      c.redraw = draw;
      return c;
    },

    /** A volume/range slider. Returns { container, value } */
    makeSlider(scene, x, y, w, initialValue, onChange) {
      const c = scene.add.container(x, y);
      const bg = scene.add.graphics();
      const fill = scene.add.graphics();
      const knob = scene.add.circle(0, 0, 12, 0xffffff).setStrokeStyle(3, 0x7a5c00);

      const draw = (val) => {
        bg.clear().fillStyle(0x1a3a2e, 1).fillRoundedRect(-w / 2, -6, w, 12, 6);
        bg.lineStyle(2, 0x2e5242, 1).strokeRoundedRect(-w / 2, -6, w, 12, 6);

        const fillW = w * val;
        fill.clear().fillStyle(0xe8b923, 1).fillRoundedRect(-w / 2, -6, fillW, 12, 6);

        knob.x = -w / 2 + fillW;
      };

      draw(initialValue);
      c.add([bg, fill, knob]);
      c.setSize(w, 24);

      // Handle Drag
      const updateFromPointer = (pointer) => {
        const localX = pointer.worldX - c.x;
        let val = (localX + w / 2) / w;
        val = Phaser.Math.Clamp(val, 0, 1);
        draw(val);
        onChange(val);
      };

      const zone = scene.add.zone(0, 0, w, 40).setInteractive({ useHandCursor: true, draggable: true });
      c.add(zone);

      zone.on('pointerdown', updateFromPointer);
      zone.on('drag', updateFromPointer);

      c.setValue = (val) => draw(val);
      return c;
    },

    /** Brief floating message. */
    toast(scene, msg, color = '#ffffff', y = 255) {
      const t = scene.add
        .text(UI.W / 2, y, msg, {
          fontFamily: UI.FONT, fontSize: '20px', color, fontStyle: 'bold',
          backgroundColor: 'rgba(0,0,0,0.65)', padding: { x: 14, y: 8 },
        })
        .setOrigin(0.5)
        .setDepth(200)
        .setAlpha(0);
      scene.tweens.add({
        targets: t, alpha: 1, y: y - 10, duration: 200,
        onComplete: () => scene.tweens.add({ targets: t, alpha: 0, delay: 1300, duration: 300, onComplete: () => t.destroy() }),
      });
    },

    /** Felt background: painted ONCE into a texture, then a single image (was 14 big ellipses redrawn every frame). */
    drawFelt(scene) {
      if (!scene.textures.exists('felt_bg')) {
        const g = scene.make.graphics({ add: false }, false), w = 1200, h = 900;
        g.fillStyle(0x0f241c, 1).fillRect(0, 0, w, h);
        for (let i = 0; i < 14; i++) { g.fillStyle(0x1a3a2e, 0.12 + i * 0.06); g.fillEllipse(w / 2, h / 2, w * 1.3 - i * 53, h * 1.2 - i * 40); }
        g.generateTexture('felt_bg', w, h); g.destroy();
      }
      return scene.add.image(UI.W / 2, UI.H / 2, 'felt_bg').setDisplaySize(4000, 3000).setDepth(-1000);
    },
  };
  global.UI = UI;
})(window);
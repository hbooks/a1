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

    /** Brief floating message. */
    toast(scene, msg, color = '#ffffff', y = 255) {
      const t = scene.add
        .text(350, y, msg, {
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

    /** Felt-table background with a soft vignette. */
    drawFelt(scene) {
      const g = scene.add.graphics();
      g.fillStyle(0x0f241c, 1).fillRect(0, 0, UI.W, UI.H);
      for (let i = 0; i < 14; i++) {
        g.fillStyle(0x1a3a2e, 0.12 + i * 0.06);
        g.fillEllipse(UI.W / 2, UI.H / 2, UI.W * 1.3 - i * 40, UI.H * 1.2 - i * 30);
      }
      return g;
    },
  };
  global.UI = UI;
})(window);
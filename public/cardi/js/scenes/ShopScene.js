/* Shared look: felt table, wooden rim, stitched border. Defined once, used by Shop + Settings. */
window.cardiPanel = window.cardiPanel || function (s, x, y, w, h) {
  const GOLD = 0xe8b923, r = 24, c = s.add.container(x, y), g = s.add.graphics();
  g.fillStyle(0x000000, 0.5).fillRoundedRect(-w / 2 + 8, -h / 2 + 14, w, h, r + 2);
  g.fillStyle(0x24140b, 1).fillRoundedRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16, r + 6);
  g.fillStyle(0x4d2d19, 1).fillRoundedRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, r + 4);
  g.fillStyle(0x123326, 1).fillRoundedRect(-w / 2, -h / 2, w, h, r);
  g.fillStyle(0x1f5c49, 0.35).fillRoundedRect(-w / 2 + 6, -h / 2 + 6, w - 12, Math.min(90, h * 0.2), { tl: r - 4, tr: r - 4, bl: 0, br: 0 });
  g.lineStyle(1.5, GOLD, 0.3).strokeRoundedRect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24, r - 6);
  g.lineStyle(2, GOLD, 0.85);
  const x0 = -w / 2 + 6, y0 = -h / 2 + 6, ww = w - 12, hh = h - 12, rr = r - 2, step = 14, dash = 8;
  const seg = (x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), n = Math.floor(len / step); for (let i = 0; i < n; i++) { const a = (i * step) / len, b = (i * step + dash) / len; g.lineBetween(x1 + dx * a, y1 + dy * a, x1 + dx * b, y1 + dy * b); } };
  seg(x0 + rr, y0, x0 + ww - rr, y0); seg(x0 + ww, y0 + rr, x0 + ww, y0 + hh - rr); seg(x0 + ww - rr, y0 + hh, x0 + rr, y0 + hh); seg(x0, y0 + hh - rr, x0, y0 + rr);
  [[x0 + rr, y0 + rr, Math.PI, 1.5 * Math.PI], [x0 + ww - rr, y0 + rr, 1.5 * Math.PI, 2 * Math.PI], [x0 + ww - rr, y0 + hh - rr, 0, 0.5 * Math.PI], [x0 + rr, y0 + hh - rr, 0.5 * Math.PI, Math.PI]]
    .forEach(([ax, ay, a, b]) => { g.beginPath(); g.arc(ax, ay, rr, a, b); g.strokePath(); });
  c.add(g);
  return c;
};

/* =====================================================================
 * ShopScene — "Under Construction". Everything is laid out in WORLD space from the
 * visible screen rectangle (UI.view), so it fills phones, tablets and desktops,
 * portrait or landscape, and rebuilds itself when the window or orientation changes.
 * (Using scale.width/height directly misplaces everything once the camera is zoomed.)
 * ===================================================================== */
class ShopScene extends Phaser.Scene {
  constructor() { super('ShopScene'); }
  getDesign() { return MK.design(this); }

  create() {
    this.build();
    let t = null;
    const onResize = () => { if (t) t.remove(false); t = this.time.delayedCall(120, () => this.scene.restart()); };
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
  }

  build() {
    const FONT = UI.FONT, GOLD = 0xe8b923;
    const v = UI.view(this), vw = v.right - v.left, vh = v.bottom - v.top;
    const cx = (v.left + v.right) / 2, cy = (v.top + v.bottom) / 2;

    UI.drawFelt(this);
    this.add.rectangle(cx, cy, vw + 400, vh + 400, 0x000000, 0.4);          // vignette, covers every screen shape

    // header, pinned to the real screen edges
    this.add.text(v.left + 28, v.top + 40, 'SHOP', { fontFamily: FONT, fontSize: vw < 600 ? '30px' : '40px', fontStyle: '900', color: '#e8b923' }).setOrigin(0, 0.5).setLetterSpacing(4).setAlpha(0.95);
    const tag = this.add.text(v.right - 28, v.top + 40, 'UNDER CONSTRUCTION', { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: '#8fb09e' }).setOrigin(1, 0.5).setLetterSpacing(3).setAlpha(0.8);
    this.add.rectangle(v.right - 28, v.top + 54, tag.width, 1, 0x8fb09e).setOrigin(1, 0.5).setAlpha(0.3);

    // panel
    const cardW = Math.min(640, vw - 36), cardH = Math.min(430, vh * 0.7);
    const panel = window.cardiPanel(this, cx, cy - 10, cardW, cardH);

    // the card-back motif
    const k = Math.min(1, cardW / 560), cw = 78 * k, ch = 108 * k, motifY = -cardH / 2 + 28 + ch / 2 + 14;
    const motif = this.add.container(0, motifY);
    // soft glow: stacked ellipses fade out smoothly, and the height is clamped so it never crosses the stitched border
    const room = (motifY + cardH / 2 - 22) * 2;
    const gh = Math.min(ch * 2.2, room), gw = Math.min(cw * 3.4, cardW - 70);
    const glow = this.add.graphics();
    for (let i = 0; i < 6; i++) glow.fillStyle(GOLD, 0.026).fillEllipse(0, 0, gw * (1 - i * 0.15), gh * (1 - i * 0.15));
    motif.add(glow);
    this.tweens.add({ targets: glow, alpha: { from: 0.5, to: 1 }, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const back = (ox, oy, ang, a) => {
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.4 * a).fillRoundedRect(-cw / 2 + 3, -ch / 2 + 5, cw, ch, 8);
      g.fillStyle(0x0b1a13, 1).fillRoundedRect(-cw / 2, -ch / 2, cw, ch, 8);
      g.lineStyle(1.5, GOLD, a).strokeRoundedRect(-cw / 2 + 5, -ch / 2 + 5, cw - 10, ch - 10, 5);
      g.lineStyle(1.5, GOLD, a * 0.9).beginPath().moveTo(0, -ch / 2 + 22).lineTo(cw / 2 - 18, 0).lineTo(0, ch / 2 - 22).lineTo(-cw / 2 + 18, 0).closePath().strokePath();
      g.fillStyle(GOLD, a).fillCircle(0, 0, 3);
      return this.add.container(ox, oy, [g]).setAngle(ang);
    };
    motif.add([back(-14 * k, 4 * k, -10, 0.55), back(14 * k, 4 * k, 10, 0.55), back(0, 0, 0, 1)]);
    const scan = this.add.graphics().lineStyle(2, GOLD, 0.9).lineBetween(-cw / 2 + 6, 0, cw / 2 - 6, 0);
    scan.y = -ch / 2 + 6; motif.add(scan);
    this.tweens.add({ targets: scan, y: ch / 2 - 6, alpha: { from: 1, to: 0.35 }, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    panel.add(motif);

    // headline + rule
    const hy = motifY + ch / 2 + 38;
    const head = this.add.text(0, hy, 'Under Construction', { fontFamily: FONT, fontSize: Math.round(Phaser.Math.Clamp(cardW * 0.06, 22, 36)) + 'px', fontStyle: '900', color: '#f3ead2' }).setOrigin(0.5);
    const ry = hy + head.height / 2 + 12, rw = Math.min(head.width * 0.9, cardW - 120);
    const rule = this.add.graphics().lineStyle(2, GOLD, 0.9).lineBetween(-rw / 2, ry, rw / 2, ry).fillStyle(GOLD, 1).fillTriangle(0, ry - 4, 4, ry, -4, ry).fillTriangle(0, ry + 4, 4, ry, -4, ry);
    panel.add([head, rule]);

    const body = this.add.text(0, ry + 24, 'The shop is being stocked with new themes, card backs\nand abilities. Check back soon.', {
      fontFamily: FONT, fontSize: Math.round(Phaser.Math.Clamp(cardW * 0.03, 13, 16)) + 'px', color: '#b8d4c3', align: 'center', lineSpacing: 6, wordWrap: { width: cardW - 80 },
    }).setOrigin(0.5, 0);
    panel.add(body);

    // segmented progress meter
    const py = Math.min(body.y + body.height + 30, cardH / 2 - 52), pw = Math.min(cardW - 80, 380), n = 10, gap = 4, sw = (pw - gap * (n - 1)) / n;
    const prog = this.add.graphics();
    for (let i = 0; i < n; i++) prog.fillStyle(i < 3 ? GOLD : 0x1f4a37, 1).fillRoundedRect(-pw / 2 + i * (sw + gap), py, sw, 6, 3);
    panel.add([prog, this.add.text(0, py + 14, 'SHELVES STOCKED  3 / 10', { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: '#8fb09e' }).setOrigin(0.5, 0).setLetterSpacing(2).setAlpha(0.85)]);

    panel.setAlpha(0).setScale(0.96);
    this.tweens.add({ targets: panel, alpha: 1, scale: 1, duration: 320, ease: 'Sine.out' });

    MK.btn(this, cx, v.bottom - Math.max(52, vh * 0.07), 'Back to Menu', () => this.scene.start('MainMenuScene'), { w: Math.min(260, vw - 60), h: 50, size: '17px' });
  }
}
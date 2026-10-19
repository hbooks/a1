/* =====================================================================
 * main.js — Phaser configuration & scene registration.
 * Waits for the Nunito web font so canvas text renders correctly.
 * ===================================================================== */
(function () {
  'use strict';
  const config = {
    type: Phaser.AUTO,
    parent: 'game',
    width: 900,
    height: 700,
    backgroundColor: '#0f241c',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, MainMenuScene, GameScene, WinScene, ShopScene],
  };
  const start = () => new Phaser.Game(config);
  Promise.all([
    document.fonts.load('700 20px Nunito'),
    document.fonts.load('900 20px Nunito'),
    document.fonts.load('italic 400 20px Nunito'),
  ])
    .catch(() => {})
    .then(start);
})();

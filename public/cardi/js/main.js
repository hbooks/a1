/* =====================================================================
 * main.js — Phaser configuration.
 * NOTE: We no longer auto-start the game here. React (PhaserGame.tsx) 
 * will read this config and start the game to avoid double-rendering.
 * ===================================================================== */
(function () {
  'use strict';

  window.CardiConfig = {
    type: Phaser.AUTO,
    width: 900,
    height: 700,
    backgroundColor: '#0f241c',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 900,
      height: 700
    },
    scene: [BootScene, MainMenuScene, GameScene, WinScene, ShopScene],
  };

  // We wait for the Nunito font to load before React triggers the start
  window.fontsReady = Promise.all([
    document.fonts.load('700 20px Nunito'),
    document.fonts.load('900 20px Nunito'),
    document.fonts.load('italic 400 20px Nunito'),
  ]).catch(() => { });
})();
/* main.js — Phaser config. React (PhaserGame.tsx) starts the game.
 * RESIZE = the canvas always matches the screen (no square box). Each scene's camera
 * zooms so the 900x700 design area fits, while backgrounds and edge-pinned UI fill the rest. */
(function () {
  'use strict';
  window.CardiConfig = {
    type: Phaser.AUTO,
    width: '100%',
    height: '100%',
    backgroundColor: '#0f241c',
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.NO_CENTER, width: '100%', height: '100%' },
    input: { activePointers: 3 },
    render: { antialias: true, roundPixels: true, powerPreference: 'high-performance' },
    scene: [BootScene, MainMenuScene, GameScene, WinScene, ShopScene, SettingsScene],
    callbacks: {
      postBoot: (game) => {
        const fit = (scene) => {
          const cam = scene.cameras && scene.cameras.main;
          if (!cam) return;
          const w = game.scale.width, h = game.scale.height;
          cam.setSize(w, h);
          cam.setZoom(Math.min(w / UI.W, h / UI.H));
          cam.centerOn(UI.W / 2, UI.H / 2);
        };
        game.scene.scenes.forEach((s) => { s.events.on('start', () => fit(s)); s.events.on('wake', () => fit(s)); });
        game.scale.on('resize', () => game.scene.scenes.forEach(fit));
      },
    },
  };
  window.fontsReady = Promise.all([
    document.fonts.load('700 20px Nunito'),
    document.fonts.load('900 20px Nunito'),
    document.fonts.load('italic 400 20px Nunito'),
  ]).catch(() => { });
})();
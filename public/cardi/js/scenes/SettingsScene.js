/* =====================================================================
 * SettingsScene — Volume, Sound, Region, Terms, Privacy, Credits
 * Requires MK (defined in MainMenuScene.js).
 * ===================================================================== */
const TERMS = [
    ['1. Acceptance', 'By playing Cardi you agree to these terms. If you do not agree, please stop playing.'],
    ['2. Fair play', 'Play honestly. Do not cheat, exploit bugs, tamper with the game files, or interfere with other players.'],
    ['3. No real money', 'Cardi is free to play. Coins, items and scores in the game are virtual, have no cash value and cannot be bought, sold or exchanged for money. Cardi is not a gambling product.'],
    ['4. Online play', 'When online modes launch, keep chat and names respectful. We may remove names or restrict access for abuse, harassment or cheating.'],
    ['5. Ownership', 'The Cardi name, artwork, audio and code belong to Hazy Pixel Studio. The traditional rules of the card game belong to everyone who plays it.'],
    ['6. As-is & changes', 'The game is provided as is, without guarantees. We may update the game or these terms; continuing to play means you accept the changes.'],
];
const PRIVACY = [
    ['What we store', 'Your settings (volume, mute, region) and local game progress are saved on your device only, in your browser storage.'],
    ['What we collect', 'No accounts, no email, no personal data. We do not run ads or sell data.'],
    ['Third parties', 'The game loads fonts and code from Google Fonts and jsDelivr. As with any website, they receive your IP address and browser details to deliver files.'],
    ['Children', 'Cardi is suitable for all ages and does not knowingly collect information from anyone.'],
    ['Your control', 'Clear your browser site data at any time to erase everything the game has saved.'],
    ['Changes', 'If online features arrive, we will update this policy before they collect any data.'],
];

class SettingsScene extends Phaser.Scene {
    constructor() { super('SettingsScene'); }

    init(data) { this.returnScene = (data && data.returnScene) || 'MainMenuScene'; }

    create() {
        const { W, H, FONT } = UI;
        UI.drawFelt(this);
        const cx = W / 2;

        this.add.text(cx, 56, 'SETTINGS', { fontFamily: FONT, fontSize: '40px', fontStyle: '900', color: MK.GOLD }).setOrigin(0.5).setLetterSpacing(6);
        this.add.graphics().fillStyle(0x0c2119, 0.9).fillRoundedRect(cx - 300, 100, 600, 270, 22).lineStyle(2, MK.GOLD_N, 0.7).strokeRoundedRect(cx - 300, 100, 600, 270, 22);

        const label = (y, t) => this.add.text(cx - 260, y, t, { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#f3ead2' }).setOrigin(0, 0.5).setLetterSpacing(2);

        // Volume
        const saved = localStorage.getItem('cardi_vol');
        const vol = saved !== null ? parseFloat(saved) : 1;
        this.sound.volume = vol;
        label(145, 'MASTER VOLUME');
        UI.makeSlider(this, cx + 70, 145, 200, vol, (v) => { this.sound.volume = v; localStorage.setItem('cardi_vol', v); });

        // Sound on/off
        label(205, 'SOUND');
        const snd = MK.btn(this, cx + 170, 205, this.sound.mute ? 'OFF' : 'ON', () => {
            this.sound.mute = !this.sound.mute;
            localStorage.setItem('cardi_mute', this.sound.mute ? '1' : '0');
            snd.label.setText(this.sound.mute ? 'OFF' : 'ON');
        }, { w: 120, h: 38, size: '15px' });

        // Region (cosmetic)
        const regions = ['Africa', 'Europe', 'North America', 'Asia', 'South America'];
        label(265, 'REGION');
        const regTxt = this.add.text(cx + 20, 265, localStorage.getItem('cardi_region') || 'Africa', { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: MK.GOLD }).setOrigin(0.5);
        MK.btn(this, cx + 200, 265, 'Change', () => {
            const next = regions[(regions.indexOf(regTxt.text) + 1) % regions.length];
            localStorage.setItem('cardi_region', next); regTxt.setText(next);
        }, { w: 110, h: 38, size: '15px' });

        // Fullscreen
        label(325, 'DISPLAY');
        MK.btn(this, cx + 170, 325, 'Fullscreen', () => MK.fullscreen(this), { w: 150, h: 38, size: '15px' });

        // Legal + credits + back
        MK.btn(this, cx - 130, 420, 'Terms of Service', () => this.showLegal('TERMS OF SERVICE', TERMS), { w: 240, h: 46, size: '16px' });
        MK.btn(this, cx + 130, 420, 'Privacy Policy', () => this.showLegal('PRIVACY POLICY', PRIVACY), { w: 240, h: 46, size: '16px' });
        MK.btn(this, cx, 490, 'View Credits', () => this.startCredits(), { w: 240, h: 50, primary: true, size: '18px' });
        MK.btn(this, cx, 570, 'Back', () => {
            if (this.returnScene === 'GameScene') { this.scene.stop(); this.scene.wake('GameScene'); }
            else this.scene.start('MainMenuScene');
        }, { w: 160, h: 46, danger: true, size: '18px' });
    }

    showLegal(title, sections) {
        MK.modal(this, { title, w: 660, h: 580 }, (panel) => {
            let y = -205;
            sections.forEach(([h, b]) => {
                const ht = this.add.text(-290, y, h, { fontFamily: UI.FONT, fontSize: '14px', fontStyle: '900', color: MK.GOLD });
                const bt = this.add.text(-290, y + 19, b, { fontFamily: UI.FONT, fontSize: '13px', color: '#cfe3d8', wordWrap: { width: 580 }, lineSpacing: 3 });
                panel.add([ht, bt]);
                y += 19 + bt.height + 12;
            });
            panel.add(this.add.text(0, 218, 'Last updated 2026. Hazy Pixel Studio.', { fontFamily: UI.FONT, fontSize: '11px', color: '#4d6b5d' }).setOrigin(0.5));
        });
    }

    startCredits() {
        const { W, H, FONT } = UI;
        const layer = this.add.container(0, 0).setDepth(200);
        layer.add(this.add.rectangle(W / 2, H / 2, W * 6, H * 6, 0x000000, 1).setInteractive());
        const G = MK.GOLD, M = '#9fbfae', X = '#ffffff';
        const lines = [
            ['HAZY PIXEL STUDIO', '36px', G, 60], ['PRESENTS', '16px', M, 120],
            ['CARDI', '64px', X, 80], ['The Kenyan Card Game', '20px', G, 160],
            ['LEAD DEVELOPER', '14px', M, 30], ['Raphael Jabari', '28px', X, 100],
            ['AUDIO & SOUND DESIGN', '14px', M, 30], ['Frank Opio', '28px', X, 20], ['Tabitha Zainab', '28px', X, 100],
            ['ART & ASSETS', '14px', M, 30], ['Andrew Kibet', '28px', X, 20], ['Julia Njoki', '28px', X, 160],
            ['SPECIAL THANKS', '14px', M, 30], ['To everyone who plays,\nand to the spirit of the Kenyan table.', '18px', X, 120],
            ['© 2026 HAZY PIXEL STUDIO', '14px', M, 0],
        ];
        const roll = this.add.container(W / 2, H + 50);
        let y = 0;
        lines.forEach(([text, size, color, gap]) => {
            const t = this.add.text(0, y, text, { fontFamily: FONT, fontSize: size, fontStyle: '900', color, align: 'center', shadow: { offsetX: 0, offsetY: 2, color: '#000', blur: 6, fill: true } }).setOrigin(0.5);
            roll.add(t); y += t.height + gap;
        });
        layer.add(roll);

        let wait = null;
        const end = () => { this.tweens.killTweensOf(roll); if (wait) wait.remove(false); layer.destroy(); };
        this.tweens.add({ targets: roll, y: -y - 100, duration: y * 35, ease: 'Linear', onComplete: () => { wait = this.time.delayedCall(1500, end); } });
        const skip = this.add.text(W - 40, H - 40, 'SKIP', { fontFamily: FONT, fontSize: '18px', color: '#888' }).setOrigin(1, 1).setInteractive({ useHandCursor: true });
        skip.on('pointerover', () => skip.setColor('#fff')).on('pointerout', () => skip.setColor('#888')).on('pointerdown', end);
        layer.add(skip);
        this.input.keyboard.once('keydown-ESC', end);
    }
}
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
    getDesign() { return MK.design(this); }
    init(data) { this.returnScene = (data && data.returnScene) || 'MainMenuScene'; }

    create() {
        const { FONT } = UI;
        UI.drawFelt(this);
        const v = UI.view(this), vw = v.right - v.left, vh = v.bottom - v.top, cx = (v.left + v.right) / 2;
        const cw = Math.min(600, vw - 30), y0 = Math.max(v.top + 20, v.top + (vh - 620) / 2), ct = y0 + 80;
        const L = cx - cw / 2 + 24, R = cx + cw / 2 - 24;

        this.add.text(cx, y0 + 30, 'SETTINGS', { fontFamily: FONT, fontSize: vw < 600 ? '34px' : '40px', fontStyle: '900', color: MK.GOLD }).setOrigin(0.5).setLetterSpacing(6);
        this.add.graphics().fillStyle(0x0c2119, 0.9).fillRoundedRect(cx - cw / 2, ct, cw, 330, 22).lineStyle(2, MK.GOLD_N, 0.7).strokeRoundedRect(cx - cw / 2, ct, cw, 330, 22);
        const row = (i, t) => { const y = ct + 42 + i * 60; this.add.text(L, y, t, { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#f3ead2' }).setOrigin(0, 0.5).setLetterSpacing(2); return y; };
        const sm = { h: 38, size: '15px' };

        // Volume
        const saved = localStorage.getItem('cardi_vol'), vol = saved !== null ? parseFloat(saved) : 1;
        this.sound.volume = vol;
        UI.makeSlider(this, R - 80, row(0, 'VOLUME'), 160, vol, (val) => { this.sound.volume = val; localStorage.setItem('cardi_vol', val); });

        // Sound
        const snd = MK.btn(this, R - 60, row(1, 'SOUND'), this.sound.mute ? 'OFF' : 'ON', () => {
            this.sound.mute = !this.sound.mute;
            localStorage.setItem('cardi_mute', this.sound.mute ? '1' : '0');
            snd.label.setText(this.sound.mute ? 'OFF' : 'ON');
        }, { ...sm, w: 120 });

        // Region (cosmetic)
        const regions = ['Africa', 'Europe', 'North America', 'Asia', 'South America'], ry = row(2, 'REGION');
        const regTxt = this.add.text(R - 146, ry, localStorage.getItem('cardi_region') || 'Africa', { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: MK.GOLD }).setOrigin(1, 0.5);
        MK.btn(this, R - 55, ry, 'Change', () => {
            const next = regions[(regions.indexOf(regTxt.text) + 1) % regions.length];
            localStorage.setItem('cardi_region', next); regTxt.setText(next);
        }, { ...sm, w: 110 });

        // Display + orientation
        MK.btn(this, R - 75, row(3, 'DISPLAY'), 'Fullscreen', () => MK.fullscreen(this), { ...sm, w: 150, icon: MK.icons.full });
        MK.btn(this, R - 75, row(4, 'ORIENTATION'), 'Rotate', () => MK.orient(this), { ...sm, w: 150, icon: MK.icons.rotate });

        // Legal, credits, back
        const lw = Math.min(240, (cw - 14) / 2), ly = ct + 375;
        MK.btn(this, cx - lw / 2 - 7, ly, 'Terms of Service', () => this.showLegal('TERMS OF SERVICE', TERMS), { w: lw, h: 46, size: '15px' });
        MK.btn(this, cx + lw / 2 + 7, ly, 'Privacy Policy', () => this.showLegal('PRIVACY POLICY', PRIVACY), { w: lw, h: 46, size: '15px' });
        MK.btn(this, cx, ly + 65, 'View Credits', () => this.startCredits(), { w: 240, h: 50, primary: true, size: '18px' });
        MK.btn(this, cx, ly + 135, 'Back', () => {
            if (this.returnScene === 'GameScene') { this.scene.stop(); this.scene.wake('GameScene'); }
            else this.scene.start('MainMenuScene');
        }, { w: 160, h: 46, danger: true, size: '18px' });

        // Rotating the phone changes the layout: rebuild (debounced)
        let timer = null;
        const onResize = () => { if (timer) timer.remove(false); timer = this.time.delayedCall(180, () => this.scene.restart({ returnScene: this.returnScene })); };
        this.scale.on('resize', onResize);
        this.events.once('shutdown', () => this.scale.off('resize', onResize));
    }

    showLegal(title, sections) {
        const d = MK.design(this), P = d.w < 600, w = Math.min(660, d.w - 24), h = P ? 780 : 580;
        MK.modal(this, { title, w, h }, (panel) => {
            const box = this.add.container(-w / 2 + 30, -h / 2 + 80);
            let y = 0;
            sections.forEach(([hd, b]) => {
                const ht = this.add.text(0, y, hd, { fontFamily: UI.FONT, fontSize: '14px', fontStyle: '900', color: MK.GOLD });
                const bt = this.add.text(0, y + 19, b, { fontFamily: UI.FONT, fontSize: '13px', color: '#cfe3d8', wordWrap: { width: w - 60 }, lineSpacing: 3 });
                box.add([ht, bt]); y += 19 + bt.height + 12;
            });
            const avail = h - 160;
            if (y > avail) box.setScale(avail / y);
            panel.add(box);
        });
    }

    startCredits() {
        const { FONT } = UI, d = MK.design(this), v = UI.view(this), W = d.w, H = d.h;
        const layer = this.add.container(0, 0).setDepth(200);
        layer.add(this.add.rectangle(W / 2, H / 2, W * 6, H * 6, 0x000000, 1).setInteractive());
        const G = MK.GOLD, M = '#9fbfae', X = '#ffffff';
        const lines = [
            ['HAZY PIXEL STUDIO', '34px', G, 60], ['PRESENTS', '16px', M, 120],
            ['CARDI', '64px', X, 80], ['The Kenyan Card Game', '20px', G, 160],
            ['LEAD DEVELOPER', '14px', M, 30], ['Raphael Jabari', '28px', X, 100],
            ['AUDIO & SOUND DESIGN', '14px', M, 30], ['Frank Opio', '28px', X, 20], ['Tabitha Zainab', '28px', X, 100],
            ['ART & ASSETS', '14px', M, 30], ['Andrew Kibet', '28px', X, 20], ['Julia Njoki', '28px', X, 160],
            ['SPECIAL THANKS', '14px', M, 30], ['To everyone who plays,\nand to the spirit of the Kenyan table.', '18px', X, 120],
            ['© 2026 HAZY PIXEL STUDIO', '14px', M, 0],
        ];
        const roll = this.add.container(W / 2, v.bottom + 50);
        let y = 0;
        lines.forEach(([text, size, color, gap]) => {
            const t = this.add.text(0, y, text, { fontFamily: FONT, fontSize: size, fontStyle: '900', color, align: 'center', shadow: { offsetX: 0, offsetY: 2, color: '#000', blur: 6, fill: true } }).setOrigin(0.5);
            roll.add(t); y += t.height + gap;
        });
        layer.add(roll);
        let wait = null;
        const end = () => { this.tweens.killTweensOf(roll); if (wait) wait.remove(false); layer.destroy(); };
        this.tweens.add({ targets: roll, y: v.top - y - 100, duration: (y + (v.bottom - v.top)) * 30, ease: 'Linear', onComplete: () => { wait = this.time.delayedCall(1500, end); } });
        const skip = this.add.text(v.right - 30, v.bottom - 30, 'SKIP', { fontFamily: FONT, fontSize: '18px', color: '#888' }).setOrigin(1, 1).setInteractive({ useHandCursor: true });
        skip.on('pointerover', () => skip.setColor('#fff')).on('pointerout', () => skip.setColor('#888')).on('pointerdown', end);
        layer.add(skip);
        this.input.keyboard.once('keydown-ESC', end);
    }
}
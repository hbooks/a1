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
 * SettingsScene — Volume, Sound, Region, Terms, Privacy, Credits
 * Requires MK (defined in MainMenuScene.js).
 * ===================================================================== */
/* =====================================================================
 * LEGAL TEXT — edit freely. {EMAIL} is replaced by CONTACT_EMAIL.
 * Set CONTACT_EMAIL below before you ship: the Data Protection Act expects a real contact point.
 * ===================================================================== */
const CONTACT_EMAIL = 'support@hpbooks.uk';             
const LEGAL_UPDATED = '24 August 2026';
const legalText = (t) => t.replace(/\{EMAIL\}/g, CONTACT_EMAIL || 'our official social channels (see Social in the main menu)');

const TERMS = [
    ['1. Acceptance & Eligibility', 'By accessing or using Cardi ("the Game"), you agree to these Terms. You must be at least 18 years old to use the Game. If you do not agree or do not meet the age requirement, you must stop playing immediately.'],
    ['2. Fair Play & Prohibited Conduct', 'You agree not to use cheats, automation software (bots), hacks, or any unauthorized third-party software designed to modify the Game. You agree not to exploit bugs for unfair advantage. We reserve the right to terminate access or delete rooms if we detect violations.'],
    ['3. Virtual Items & No Gambling', 'Cardi is a game of skill, not chance. Any virtual items, coins, or scores have no cash value and cannot be bought, sold, or exchanged for real currency. Cardi is not a gambling product as defined under the Gambling Control Act, 2025. We do not offer real-money wagering, loot boxes purchased with real money, or any chance-based monetization mechanics.'],
    ['4. Online Play & Anonymous IDs', 'The Game uses locally generated anonymous identifiers and room codes to connect players. You are responsible for any room code you share. Game state (moves, draws, passes) is recorded temporarily to keep multiplayer matches synchronized and is automatically deleted after the time periods specified in our Privacy Policy.'],
    ['5. Content Moderation', 'We reserve the right to remove or modify any player name that violates these Terms. You agree not to use offensive, hateful, or inappropriate names.'],
    ['6. As-Is & Limitation of Liability', 'The Game is provided "as is" without guarantees of uptime or error-free operation. To the maximum extent permitted by Kenyan law, Hazy Pixel Studio shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Game.'],
    ['7. Ownership', 'The Cardi name, artwork, audio, and code belong to Hazy Pixel Studio. The traditional rules of the card game belong to everyone who plays it.'],
    ['8. Changes to Terms', 'We may update these Terms. Continuing to play after changes are posted constitutes acceptance of the updated Terms.'],
];

const PRIVACY = [
    ['1. Data Controller', 'Hazy Pixel Studio is the data controller for the purposes of the Kenya Data Protection Act, 2019 (DPA). For legal or data protection inquiries, contact us at legal@hpbooks.uk.'],
    ['2. What We Collect & Why', 'We collect only the minimum data necessary to operate the Game: (a) Anonymous Player IDs (locally generated, not linked to your real identity) — to assign you a seat and synchronize multiplayer games; (b) Game Moves (play, draw, pass, declare) — to maintain a consistent game state across all devices in a room; (c) Room Codes — to allow players to join the correct room; (d) Local Settings (volume, mute, region) — stored only in your browser, never transmitted to our servers.'],
    ['3. Legal Basis for Processing', 'We process the data above on the basis of performance of a contract (operating the multiplayer game you have joined) and our legitimate interest in maintaining game integrity and preventing abuse. We do not rely on consent for essential game data because the Game cannot function without it.'],
    ['4. Data Retention (Automatic Deletion)', 'Game moves and room data are automatically deleted by our systems within 1 hour of the room closing or becoming inactive, or sooner when the game ends. We do not retain game history beyond this period. Local settings remain on your device until you clear your browser data.'],
    ['5. Your Rights under the DPA', 'Under Sections 26 and 32 of the DPA, you have the right to: (a) be informed about how your data is used (this policy); (b) access the data we hold about you; (c) request correction of inaccurate data; (d) request erasure of your data; (e) object to processing. Because we store only anonymous IDs and temporary game logs, most rights can be exercised by simply leaving the room and allowing the automatic deletion to occur. To make a formal request, contact legal@hpbooks.uk.'],
    ['6. Third-Party Recipients', 'We use the following third parties: (a) database (maybe in a different country for better distribution all over the world) — stores game state temporarily; (b) Google Fonts / jsDelivr — deliver fonts and code; these providers receive your IP address as part of standard HTTP requests. We do not sell your data to any third party.'],
    ['7. Cross-Border Data Transfer', 'Game data is stored on servers located outside Kenya. We rely on the necessity basis for this transfer under Regulation 40 of the Data Protection (General) Regulations, 2021, as the transfer is essential to operate the multiplayer service you have requested.'],
    ['8. Children', 'The Game is intended for users aged 18 and over. We do not knowingly collect data from anyone under 18.'],
    ['9. Data Breach', 'If a breach affecting your data occurs, we will notify the Office of the Data Protection Commissioner within 72 hours as required by Section 43 of the DPA, and notify affected users without undue delay where the breach poses a risk to their rights.'],
    ['10. Changes', 'We will update this policy before any new data collection begins. The "Last Updated" date will reflect the most recent version.'],
];

/** Extra vector icons for the settings rows (drawn around 0,0). */
const SET_ICONS = {
    globe(g, c) { g.lineStyle(2.5, c, 1).strokeCircle(0, 0, 10).strokeEllipse(0, 0, 10, 20).lineBetween(-10, 0, 10, 0); },
    doc(g, c) { g.lineStyle(2.5, c, 1).strokeRoundedRect(-8, -11, 16, 22, 3).lineBetween(-4, -4, 4, -4).lineBetween(-4, 1, 4, 1).lineBetween(-4, 6, 2, 6); },
    lock(g, c) { g.fillStyle(c, 1).fillRoundedRect(-8, -2, 16, 12, 3); g.lineStyle(2.5, c, 1); g.beginPath(); g.arc(0, -3, 5, Math.PI, 0); g.strokePath(); },
    star(g, c) { const p = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 4.5 : 11, a = -Math.PI / 2 + (i * Math.PI) / 5; p.push({ x: Math.cos(a) * r, y: Math.sin(a) * r }); } g.fillStyle(c, 1).fillPoints(p, true); },
    chevR(g, c) { g.lineStyle(3, c, 1).lineBetween(-4, -8, 4, 0).lineBetween(4, 0, -4, 8); },
    chevL(g, c) { g.lineStyle(3, c, 1).lineBetween(4, -8, -4, 0).lineBetween(-4, 0, 4, 8); },
    back(g, c) { g.lineStyle(4, c, 1).lineBetween(6, -10, -6, 0).lineBetween(-6, 0, 6, 10); },
};

/* =====================================================================
 * SettingsScene — full-bleed and responsive.
 *   PC / landscape : two columns.   Phone / portrait : one column.
 *   Every position comes from the visible screen rectangle (UI.view), so it fills any device.
 *   Rows that cannot work on a device (fullscreen on iPhone, rotation lock on desktop) are hidden.
 * ===================================================================== */
class SettingsScene extends Phaser.Scene {
    constructor() { super('SettingsScene'); }
    getDesign() { return MK.design(this); }
    init(data) { this.returnScene = (data && data.returnScene) || 'MainMenuScene'; }

    create() {
        const FONT = UI.FONT, GOLD = MK.GOLD, GOLD_N = MK.GOLD_N;
        UI.drawFelt(this);
        const v = UI.view(this), vw = v.right - v.left, vh = v.bottom - v.top, cx = (v.left + v.right) / 2;
        this.add.rectangle(cx, (v.top + v.bottom) / 2, vw + 400, vh + 400, 0x000000, 0.35);

        // ---- what this device can actually do ----
        const dev = this.sys.game.device;
        const canFull = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
        const canRotate = !!(dev.input.touch && window.screen && screen.orientation && screen.orientation.lock);
        const saved = localStorage.getItem('cardi_vol'), vol = saved !== null ? parseFloat(saved) : 1;
        this.sound.volume = vol;
        const regions = ['Africa', 'Europe', 'North America', 'Asia', 'South America'];
        let region = localStorage.getItem('cardi_region') || 'Africa';

        // ---- content, as blocks of rows ----
        const ROW = 62, HEAD = 42, GAP = 14, PAD = 30;
        const blocks = {
            audio: {
                title: 'AUDIO', rows: [
                    { label: 'Volume', icon: (g, c) => MK.icons.sound(g, c, true), kind: 'slider' },
                    { label: 'Sound', icon: (g, c) => MK.icons.sound(g, c, !this.sound.mute), kind: 'sound' },
                ]
            },
            display: {
                title: 'DISPLAY', rows: [
                    ...(canFull ? [{ label: 'Fullscreen', icon: MK.icons.full, kind: 'full' }] : []),
                    ...(canRotate ? [{ label: 'Rotate screen', icon: MK.icons.rotate, kind: 'rotate' }] : []),
                ]
            },
            general: {
                title: 'GENERAL', rows: [
                    { label: 'Region', icon: SET_ICONS.globe, kind: 'region' },
                    { label: 'Terms of Service', icon: SET_ICONS.doc, kind: 'link', go: () => this.showLegal('TERMS OF SERVICE', TERMS) },
                    { label: 'Privacy Policy', icon: SET_ICONS.lock, kind: 'link', go: () => this.showLegal('PRIVACY POLICY', PRIVACY) },
                    { label: 'Credits', icon: SET_ICONS.star, kind: 'link', go: () => this.startCredits() },
                ]
            },
        };
        if (!blocks.display.rows.length) delete blocks.display;
        const bh = (b) => HEAD + b.rows.length * ROW;
        const two = vw >= 760;
        const cols = two ? [[blocks.audio, blocks.display].filter(Boolean), [blocks.general]] : [Object.values(blocks)];
        const colH = cols.map((c) => c.reduce((a, b) => a + bh(b), 0) + (c.length - 1) * GAP);
        const pw = Math.min(two ? 880 : 520, vw - 36), ph = Math.max(...colH) + PAD * 2;

        // ---- header bar ----
        const barY = v.top + 46;
        MK.iconBtn(this, v.left + 46, barY, SET_ICONS.back, () => this.leave(), { r: 26 });
        this.add.text(v.left + 92, barY, 'SETTINGS', { fontFamily: FONT, fontSize: vw < 600 ? '28px' : '36px', fontStyle: '900', color: GOLD }).setOrigin(0, 0.5).setLetterSpacing(5);

        // ---- panel ----
        const top = v.top + 96, free = v.bottom - 44 - top;
        const py = top + Math.max(0, (free - ph) / 2) + ph / 2;
        const panel = window.cardiPanel(this, cx, py, pw, ph);
        panel.setAlpha(0).setScale(0.97);
        this.tweens.add({ targets: panel, alpha: 1, scale: 1, duration: 300, ease: 'Sine.out' });

        const colW = two ? (pw - PAD * 3) / 2 : pw - PAD * 2;
        const xs = two ? [cx - pw / 2 + PAD + colW / 2, cx + pw / 2 - PAD - colW / 2] : [cx];
        cols.forEach((col, ci) => {
            const x0 = xs[ci] - colW / 2, xr = xs[ci] + colW / 2;
            let y = py - ph / 2 + PAD;
            col.forEach((b) => {
                this.add.text(x0 + 4, y + 16, b.title, { fontFamily: FONT, fontSize: '12px', fontStyle: '900', color: GOLD }).setOrigin(0, 0.5).setLetterSpacing(4).setAlpha(0.9);
                this.add.rectangle(x0 + colW / 2, y + 32, colW, 1, GOLD_N, 0.25);
                y += HEAD;
                b.rows.forEach((r, i) => { this.buildRow(r, x0, xr, y + ROW / 2, colW, i < b.rows.length - 1); y += ROW; });
                y += GAP;
            });
        });

        this.add.text(cx, v.bottom - 20, 'CARDI  ·  v3.2  ·  HAZY PIXEL STUDIO', { fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: '#4d6b5d' }).setOrigin(0.5).setLetterSpacing(2);

        // new orientation / window size = new layout
        let t = null;
        const onResize = () => { if (t) t.remove(false); t = this.time.delayedCall(160, () => this.scene.restart({ returnScene: this.returnScene })); };
        this.scale.on('resize', onResize);
        this.events.once('shutdown', () => this.scale.off('resize', onResize));
        this.input.keyboard.on('keydown-ESC', this.escBack = () => { if (!this.modalOpen) this.leave(); });
        this.events.once('shutdown', () => { if (this.input.keyboard) this.input.keyboard.off('keydown-ESC', this.escBack); });
    }

    leave() {
        if (this.returnScene === 'GameScene') { this.scene.stop(); this.scene.wake('GameScene'); }
        else this.scene.start('MainMenuScene');
    }

    buildRow(r, x0, xr, y, w, separator) {
        const FONT = UI.FONT;
        const ic = this.add.graphics().setPosition(x0 + 22, y).setScale(0.95);
        r.icon(ic, MK.GOLD_N);
        this.add.text(x0 + 52, y, r.label, { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#f3ead2' }).setOrigin(0, 0.5);
        if (separator) this.add.rectangle(x0 + w / 2, y + 31, w - 8, 1, 0xffffff, 0.06);

        if (r.kind === 'slider') {
            const sw = Math.min(190, w * 0.42);
            UI.makeSlider(this, xr - sw / 2 - 14, y, sw, parseFloat(localStorage.getItem('cardi_vol') ?? '1'), (val) => { this.sound.volume = val; localStorage.setItem('cardi_vol', val); });
        } else if (r.kind === 'sound') {
            this.makeSwitch(xr - 36, y, !this.sound.mute, (on, sw) => { this.sound.mute = !on; localStorage.setItem('cardi_mute', on ? '0' : '1'); sw.set(on); });
        } else if (r.kind === 'full') {
            const sw = this.makeSwitch(xr - 36, y, this.scale.isFullscreen, () => MK.fullscreen(this));
            const sync = () => sw.set(this.scale.isFullscreen);
            this.scale.on('enterfullscreen', sync); this.scale.on('leavefullscreen', sync);
            this.events.once('shutdown', () => { this.scale.off('enterfullscreen', sync); this.scale.off('leavefullscreen', sync); });
        } else if (r.kind === 'rotate') {
            MK.btn(this, xr - 62, y, 'Rotate', () => MK.orient(this), { w: 116, h: 40, size: '15px', icon: MK.icons.rotate });
        } else if (r.kind === 'region') {
            const regions = ['Africa', 'Europe', 'North America', 'Asia', 'South America'];
            let cur = localStorage.getItem('cardi_region') || 'Africa';
            const val = this.add.text(xr - 66, y, cur, { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: MK.GOLD }).setOrigin(0.5);
            val.setScale(Math.min(1, 104 / Math.max(1, val.width)));
            const step = (d) => { cur = regions[(regions.indexOf(cur) + d + regions.length) % regions.length]; localStorage.setItem('cardi_region', cur); val.setText(cur).setScale(Math.min(1, 104 / Math.max(1, val.width))); };
            MK.iconBtn(this, xr - 128 - 12, y, SET_ICONS.chevL, () => step(-1), { r: 17 });
            MK.iconBtn(this, xr - 4, y, SET_ICONS.chevR, () => step(1), { r: 17 });
            val.x = xr - 66 - 6;
        } else if (r.kind === 'link') {
            const hl = this.add.graphics().setAlpha(0);
            hl.fillStyle(0xffffff, 0.06).fillRoundedRect(x0 - 6, y - 28, w + 12, 56, 12);
            const chev = this.add.graphics().setPosition(xr - 10, y); SET_ICONS.chevR(chev, 0x8fb09e);
            const z = this.add.zone(x0 + w / 2, y, w + 12, 56).setInteractive({ useHandCursor: true });
            z.on('pointerover', () => this.tweens.add({ targets: hl, alpha: 1, duration: 100 }));
            z.on('pointerout', () => this.tweens.add({ targets: hl, alpha: 0, duration: 100 }));
            z.on('pointerup', () => { MK.click(this); r.go(); });
        }
    }

    /** iOS-style switch. c.set(on) animates it. */
    makeSwitch(x, y, on, cb) {
        const c = this.add.container(x, y), g = this.add.graphics(), knob = this.add.circle(on ? 12 : -12, 0, 12, 0xffffff);
        const paint = () => {
            g.clear().fillStyle(0x000000, 0.35).fillRoundedRect(-27, -13, 54, 30, 15)
                .fillStyle(on ? 0xe8b923 : 0x2a4a3b, 1).fillRoundedRect(-27, -15, 54, 30, 15)
                .lineStyle(2, on ? 0xffe48a : 0x4d6b5d, 1).strokeRoundedRect(-27, -15, 54, 30, 15);
            knob.setFillStyle(on ? 0x241900 : 0xcfe3d8);
        };
        paint();
        c.add([g, knob]).setSize(78, 46).setInteractive({ useHandCursor: true });
        c.set = (val) => { on = val; paint(); this.tweens.add({ targets: knob, x: on ? 12 : -12, duration: 120, ease: 'Sine.out' }); };
        c.on('pointerup', () => { MK.click(this); cb(!on, c); });
        return c;
    }

    /** Scrollable reader: drag / swipe (with momentum), mouse wheel, arrow keys, PageUp/PageDown. */
    showLegal(title, sections) {
        const d = MK.design(this), P = d.w < 600, w = Math.min(680, d.w - 24), h = P ? 800 : 600;
        const fs = Math.min(1, (d.w - 24) / w, (d.h - 24) / h);          // same scale MK.modal gives the panel
        const top = -h / 2 + 78, view = h - 156, textW = w - 76;
        const lg = this.legal = { scroll: 0, max: 0, vel: 0, drag: false };
        this.modalOpen = true;
        const m = MK.modal(this, { title, w, h }, (panel) => {
            const box = this.add.container(-w / 2 + 30, top);
            let y = 0;
            box.add(this.add.text(0, y, 'Last updated: ' + LEGAL_UPDATED, { fontFamily: UI.FONT, fontSize: '12px', fontStyle: 'italic', color: '#8fb09e' }));
            y += 30;
            sections.forEach(([hd, body]) => {
                const ht = this.add.text(0, y, hd, { fontFamily: UI.FONT, fontSize: '15px', fontStyle: '900', color: MK.GOLD, wordWrap: { width: textW } });
                const bt = this.add.text(0, y + ht.height + 5, legalText(body), { fontFamily: UI.FONT, fontSize: '14px', color: '#cfe3d8', wordWrap: { width: textW }, lineSpacing: 4 });
                box.add([ht, bt]);
                y += ht.height + 5 + bt.height + 20;
            });
            lg.max = Math.max(0, y - view);
            panel.add(box);

            // clip the text to the reading window (world coordinates)
            const mg = this.make.graphics({ add: false });
            mg.fillRect(d.w / 2 + (-w / 2 + 22) * fs, d.h / 2 + top * fs, (w - 44) * fs, view * fs);
            box.setMask(mg.createGeometryMask());

            // scrollbar
            const track = this.add.graphics(), thumb = this.add.graphics();
            track.fillStyle(0xffffff, 0.08).fillRoundedRect(w / 2 - 22, top, 5, view, 3);
            panel.add([track, thumb]);
            lg.draw = () => {
                box.y = top - lg.scroll;
                thumb.clear();
                if (lg.max <= 0) return;
                const th = Math.max(36, (view * view) / (view + lg.max));
                thumb.fillStyle(0xe8b923, 0.9).fillRoundedRect(w / 2 - 22, top + (view - th) * (lg.scroll / lg.max), 5, th, 3);
            };
            lg.draw();

            const zone = this.add.zone(0, top + view / 2, w - 44, view).setInteractive();
            panel.add(zone);
            zone.on('pointerdown', (p) => { lg.drag = true; lg.sy = p.worldY; lg.s0 = lg.scroll; lg.last = p.worldY; lg.lt = performance.now(); lg.vel = 0; });
            lg.move = (p) => {
                if (!lg.drag) return;
                this.legalSet(lg.s0 - (p.worldY - lg.sy) / fs);
                const now = performance.now(), dt = Math.max(1, now - lg.lt);
                lg.vel = -((p.worldY - lg.last) / fs) / dt;                 // content px per ms
                lg.last = p.worldY; lg.lt = now;
            };
            lg.up = () => { if (lg.drag && performance.now() - lg.lt > 90) lg.vel = 0; lg.drag = false; };
            lg.wheel = (p, o, dx, dy) => this.legalSet(lg.scroll + dy * 0.7);
            lg.key = (e) => {
                const step = { ArrowDown: 60, ArrowUp: -60, PageDown: view * 0.9, PageUp: -view * 0.9, Home: -1e6, End: 1e6, ' ': view * 0.9 }[e.key];
                if (step) this.legalSet(lg.scroll + step);
            };
            this.input.on('pointermove', lg.move); this.input.on('pointerup', lg.up); this.input.on('pointerupoutside', lg.up); this.input.on('wheel', lg.wheel);
            if (this.input.keyboard) this.input.keyboard.on('keydown', lg.key);
        });
        m.layer.once('destroy', () => {
            this.input.off('pointermove', lg.move); this.input.off('pointerup', lg.up); this.input.off('pointerupoutside', lg.up); this.input.off('wheel', lg.wheel);
            if (this.input.keyboard) this.input.keyboard.off('keydown', lg.key);
            this.legal = null; this.modalOpen = false;
        });
    }

    legalSet(v) {
        const lg = this.legal;
        if (!lg) return;
        lg.scroll = Phaser.Math.Clamp(v, 0, lg.max);
        lg.draw();
    }

    /** Momentum after a swipe. */
    update(time, delta) {
        const lg = this.legal;
        if (!lg || lg.drag || Math.abs(lg.vel) < 0.01) return;
        this.legalSet(lg.scroll + lg.vel * delta);
        lg.vel *= Math.pow(0.994, delta);
        if (lg.scroll <= 0 || lg.scroll >= lg.max) lg.vel = 0;
    }

    startCredits() {
        const { FONT } = UI, d = MK.design(this), v = UI.view(this), W = d.w, H = d.h;
        this.modalOpen = true;
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
        const end = () => { this.tweens.killTweensOf(roll); if (wait) wait.remove(false); layer.destroy(); this.modalOpen = false; };
        this.tweens.add({ targets: roll, y: v.top - y - 100, duration: (y + (v.bottom - v.top)) * 30, ease: 'Linear', onComplete: () => { wait = this.time.delayedCall(1500, end); } });
        const skip = this.add.text(v.right - 30, v.bottom - 30, 'SKIP', { fontFamily: FONT, fontSize: '18px', color: '#888' }).setOrigin(1, 1).setInteractive({ useHandCursor: true });
        skip.on('pointerover', () => skip.setColor('#fff')).on('pointerout', () => skip.setColor('#888')).on('pointerdown', end);
        layer.add(skip);
        this.input.keyboard.once('keydown-ESC', end);
    }
}
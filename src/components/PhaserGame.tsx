import { useEffect, useRef, useState } from "react";

const BASE = "/cardi/";
const PHASER_URL = "https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js";
// Cache-buster for the game scripts. Dev: changes on every full page load. Prod: bump VITE_CARDI_BUILD per deploy.
// Kept on window so React hot-reload never re-executes already-loaded scripts (that would redeclare their classes).
const BUILD: string = (() => {
    if (typeof window === "undefined") return "1"; // server render: no window
    const w = window as any;
    if (!w.__CARDI_BUILD__) {
        const env = (import.meta as any).env;
        w.__CARDI_BUILD__ = env?.DEV ? String(Date.now()) : env?.VITE_CARDI_BUILD || "1";
    }
    return w.__CARDI_BUILD__ as string;
})();
const SCRIPTS = [
    "js/ui.js", "js/names.js", "js/rules.js", "js/gameState.js", "js/bot.js",
    "js/scenes/BootScene.js", "js/scenes/MainMenuScene.js", "js/scenes/GameScene.js",
    "js/scenes/WinScene.js", "js/scenes/ShopScene.js", "js/scenes/SettingsScene.js", "js/main.js",
].map((s) => `${BASE}${s}?v=${BUILD}`);

const CSS = `
.cardi-stage{position:relative;width:96px;height:140px;perspective:700px;margin-bottom:14px}
.cardi-card{position:absolute;inset:0;transform-style:preserve-3d}
.cardi-card.spin{animation:cardi-flip 1.8s cubic-bezier(.65,0,.35,1) infinite}
.cardi-face{position:absolute;inset:0;border-radius:12px;backface-visibility:hidden;-webkit-backface-visibility:hidden;display:flex;align-items:center;justify-content:center;box-shadow:0 0 28px rgba(232,185,35,.35)}
.cardi-back{background:repeating-linear-gradient(45deg,#123326 0 8px,#17402f 8px 16px);border:3px solid #e8b923;color:#e8b923;font-size:44px}
.cardi-front{background:#fff;border:3px solid #1a1a1a;transform:rotateY(180deg);color:#1a1a1a}
.cardi-front b{position:absolute;top:6px;left:10px;font-size:22px}
.cardi-front i{font-style:normal;font-size:54px}
.cardi-shadow{position:absolute;left:50%;bottom:-24px;width:80px;height:12px;margin-left:-40px;border-radius:50%;background:rgba(0,0,0,.5);filter:blur(4px);animation:cardi-shadow 1.8s ease-in-out infinite}
.cardi-suit{opacity:.25}
.cardi-suit.on{animation:cardi-pulse 1.2s ease-in-out infinite}
@keyframes cardi-flip{0%{transform:translateY(0) rotateY(0)}50%{transform:translateY(-14px) rotateY(180deg)}100%{transform:translateY(0) rotateY(360deg)}}
@keyframes cardi-shadow{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(.7);opacity:.25}}
@keyframes cardi-pulse{0%,100%{opacity:.25;transform:translateY(0)}50%{opacity:1;transform:translateY(-6px)}}
`;

type Phase = "loading" | "offline" | "error" | "ready";

const loadScript = (src: string, timeout = 15000) =>
    new Promise<void>((resolve, reject) => {
        const old = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
        if (old?.dataset["loaded"] === "1") return resolve();
        old?.remove(); // a stale/failed tag must never block a retry
        const s = document.createElement("script");
        s.src = src;
        s.async = false;
        const timer = setTimeout(() => { s.remove(); reject(new Error("timeout: " + src)); }, timeout);
        s.onload = () => { clearTimeout(timer); s.dataset["loaded"] = "1"; resolve(); };
        s.onerror = () => { clearTimeout(timer); s.remove(); reject(new Error("failed: " + src)); };
        document.body.appendChild(s);
    });

const loadWithRetry = async (src: string, tries = 3) => {
    for (let i = 0; i < tries; i++) {
        try { return await loadScript(src); }
        catch (e) {
            if (i === tries - 1) throw e;
            await new Promise((r) => setTimeout(r, 800 * (i + 1)));
        }
    }
};

/** Parallel download, ordered execution (async=false). Falls back to slow ordered retries if any fails. */
const loadAll = async () => {
    try { await Promise.all(SCRIPTS.map((src) => loadScript(src))); }
    catch { for (const src of SCRIPTS) await loadWithRetry(src); }
};

export default function PhaserGame() {
    const containerRef = useRef<HTMLDivElement>(null);
    const [phase, setPhase] = useState<Phase>("loading");
    const [slow, setSlow] = useState(false);
    const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
    const [attempt, setAttempt] = useState(0);
    const phaseRef = useRef<Phase>("loading");
    phaseRef.current = phase;

    // Track connection live: auto-retry when it comes back, warn if it drops mid-game.
    useEffect(() => {
        const up = () => {
            setOnline(true);
            if (phaseRef.current === "offline" || phaseRef.current === "error") setAttempt((a) => a + 1);
        };
        const down = () => setOnline(false);
        window.addEventListener("online", up);
        window.addEventListener("offline", down);
        return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
    }, []);

    useEffect(() => {
        let cancelled = false;
        let game: any = null;
        const timers: ReturnType<typeof setTimeout>[] = [];
        setSlow(false);

        if (!navigator.onLine && !(window as any).Phaser) { setPhase("offline"); return; }
        setPhase("loading");
        timers.push(setTimeout(() => !cancelled && setSlow(true), 6000));

        (async () => {
            try {
                if (!(window as any).Phaser) await loadWithRetry(PHASER_URL);
                await loadAll();
                if (cancelled) return;
                await Promise.race([(window as any).fontsReady, new Promise((r) => setTimeout(r, 4000))]);
                if (cancelled || !containerRef.current) return;

                containerRef.current.innerHTML = "";
                game = new (window as any).Phaser.Game({ ...(window as any).CardiConfig, parent: containerRef.current });
                const show = () => !cancelled && setPhase("ready");
                game.events.once("ready", show);
                timers.push(setTimeout(show, 4000)); // safety net
            } catch (err) {
                console.error("Cardi failed to load", err);
                if (!cancelled) setPhase(navigator.onLine ? "error" : "offline");
            }
        })();

        return () => {
            cancelled = true;
            timers.forEach(clearTimeout);
            if (game) game.destroy(true);
        };
    }, [attempt]);

    const retry = () => setAttempt((a) => a + 1);
    const covered = phase !== "ready";

    return (
        <div className="relative w-full h-dvh overflow-hidden bg-[#0f241c] select-none"
            style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
            <style>{CSS}</style>
            {/* Phaser fills everything; Scale.FIT handles the aspect ratio */}
            <div ref={containerRef} className="absolute"
                style={{ inset: "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)" }} />

            {/* Connection lost mid-game: non-blocking */}
            {phase === "ready" && !online && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full bg-[#e8b923] px-4 py-2 text-sm font-bold text-[#241900] shadow-lg">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#241900]" />
                    Connection lost — reconnecting…
                </div>
            )}

            {/* Full loader / offline / error screen. Never a blank screen. */}
            <div
                className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#0f241c] px-6 text-center transition-opacity duration-500"
                style={{ background: "radial-gradient(ellipse at center,#1d4333 0%,#0f241c 70%)", opacity: covered ? 1 : 0, pointerEvents: covered ? "auto" : "none" }}
            >
                <div className="cardi-stage">
                    <div className={"cardi-card" + (phase === "loading" ? " spin" : "")}>
                        <div className="cardi-face cardi-back"><span>{phase === "loading" ? "✿" : phase === "offline" ? "⌁" : "!"}</span></div>
                        <div className="cardi-face cardi-front"><b>A</b><i>♠</i></div>
                    </div>
                    <div className="cardi-shadow" />
                </div>
                <div className="flex gap-4 text-2xl">
                    {["♠", "♥", "♦", "♣"].map((su, i) => (
                        <span key={su} className={"cardi-suit" + (phase === "loading" ? " on" : "")}
                            style={{ animationDelay: `${i * 0.25}s`, color: i === 1 || i === 2 ? "#ff6b6b" : "#f3ead2" }}>{su}</span>
                    ))}
                </div>

                <div className="space-y-1">
                    <h2 className="text-2xl font-black tracking-widest text-[#e8b923]">
                        {phase === "loading" && (slow ? "STILL TRYING…" : "CONNECTING")}
                        {phase === "offline" && "YOU'RE OFFLINE"}
                        {phase === "error" && "SOMETHING WENT WRONG"}
                    </h2>
                    <p className="max-w-xs text-sm text-[#9fbfae]">
                        {phase === "loading" && (slow ? "Your connection looks slow. Hang tight, we keep retrying." : "Shuffling the deck…")}
                        {phase === "offline" && "Check your network. The game starts automatically when you're back online."}
                        {phase === "error" && "We couldn't load the game files. This is usually a flaky connection."}
                    </p>
                </div>

                {(phase === "error" || phase === "offline" || (phase === "loading" && slow)) && (
                    <button onClick={retry}
                        className="rounded-2xl bg-[#e8b923] px-8 py-3 text-lg font-black text-[#241900] shadow-[0_5px_0_#7a5f0b] transition active:translate-y-1">
                        Try again
                    </button>
                )}
            </div>
        </div>
    );
}
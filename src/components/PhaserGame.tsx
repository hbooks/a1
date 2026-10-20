import { useEffect, useRef } from "react";

export default function PhaserGame() {
    const containerRef = useRef<HTMLDivElement>(null);
    const gameRef = useRef<any>(null);

    useEffect(() => {
        // 1. Prevent double-start in React Strict Mode
        if (gameRef.current) return;

        const loadScript = (src: string) => {
            return new Promise((resolve, reject) => {
                if (document.querySelector(`script[src="${src}"]`)) {
                    resolve(true);
                    return;
                }
                const script = document.createElement("script");
                script.src = src;
                script.onload = resolve;
                script.onerror = reject;
                document.body.appendChild(script);
            });
        };

        const initGame = async () => {
            try {
                if (!(window as any).Phaser) {
                    await loadScript("https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js");
                }

                const scripts = [
                    "/cardi/js/ui.js",
                    "/cardi/js/names.js",
                    "/cardi/js/rules.js",
                    "/cardi/js/gameState.js",
                    "/cardi/js/bot.js",
                    "/cardi/js/scenes/BootScene.js",
                    "/cardi/js/scenes/MainMenuScene.js",
                    "/cardi/js/scenes/GameScene.js",
                    "/cardi/js/scenes/WinScene.js",
                    "/cardi/js/scenes/ShopScene.js",
                    "/cardi/js/main.js",
                ];

                for (const src of scripts) {
                    await loadScript(src);
                }

                // 2. Wait for fonts to be ready
                await (window as any).fontsReady;

                // 3. Wait for React container to have dimensions
                setTimeout(() => {
                    if (containerRef.current) {
                        containerRef.current.innerHTML = ""; // Clear just in case

                        // 4. Build config using the global window.CardiConfig
                        const config = {
                            ...(window as any).CardiConfig,
                            parent: containerRef.current,
                        };

                        gameRef.current = new (window as any).Phaser.Game(config);
                    }
                }, 50);

            } catch (err) {
                console.error("Failed to load game scripts", err);
            }
        };

        initGame();

        // 5. Cleanup: Destroy the Phaser game when leaving the page
        return () => {
            if (gameRef.current) {
                gameRef.current.destroy(true);
                gameRef.current = null;
            }
        };
    }, []);

    return (
        <div className="w-full h-[100dvh] bg-[#0b1c15] flex items-center justify-center overflow-hidden">
            <div ref={containerRef} className="w-full h-full max-w-[900px] max-h-[700px]" />
        </div>
    );
}
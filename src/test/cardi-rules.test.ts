import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let R: any, G: any;
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win: any = {};
  for (const f of ["rules.js", "gameState.js"]) {
    const code = readFileSync(resolve(__dirname, "../../public/cardi/js", f), "utf8");
    new Function("window", code)(win);
  }
  R = win.Rules;
  G = win.GameStateMgr;
});

const c = (suit: string, rank: string) => ({ id: `${suit}_${rank}`, suit, rank, displayName: rank });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mk = (hands: any[][], top: any, extra = {}) => ({
  players: hands.map((h, i) => ({ name: `P${i}`, isBot: i > 0, hand: h })),
  drawPile: Array.from({ length: 20 }, (_, i) => c("spades", String((i % 6) + 4))),
  discardPile: [top], topCard: top, currentSuit: top.suit, direction: 1, currentPlayerIndex: 0,
  pendingPunishment: 0, winnerIndex: null, declaredNikoCardi: hands.map(() => false),
  lastMoverIndex: null, turnStarted: true, drawnCardId: null, log: [], events: [], ...extra,
});

describe("Cardi rules", () => {
  it("deals 4 each and never opens with King, Jack, 3 or Ace", () => {
    for (let i = 0; i < 200; i++) {
      const s = G.createGame([{ name: "a" }, { name: "b", isBot: true }]);
      expect(s.players.every((p: { hand: unknown[] }) => p.hand.length === 4)).toBe(true);
      expect(["king", "jack", "3", "ace"]).not.toContain(s.topCard.rank);
      expect(s.drawPile.length).toBe(52 - 8 - 1);
    }
  });

  it("King and Jack return the turn to the player in a 2-player game", () => {
    const top = c("hearts", "5");
    for (const rank of ["king", "jack"]) {
      const s = R.applyMove(mk([[c("hearts", rank), c("spades", "9")], [c("spades", "4")]], top), { type: "play", card: c("hearts", rank) });
      expect(s.currentPlayerIndex).toBe(0);
    }
  });

  it("3 adds 3 punishment; Ace on 6 makes the player draw 3", () => {
    const s1 = R.applyMove(mk([[c("hearts", "3"), c("spades", "9")], [c("spades", "4")]], c("hearts", "5")), { type: "play", card: c("hearts", "3") });
    expect(s1.pendingPunishment).toBe(3);
    const s = mk([[c("spades", "ace"), c("spades", "9")], [c("spades", "4")]], c("diamonds", "3"), { pendingPunishment: 6 });
    const after = R.applyMove(s, { type: "play", card: c("spades", "ace"), chosenSuit: "flowers" });
    expect(after.players[0].hand.length).toBe(1 + 3);
    expect(after.pendingPunishment).toBe(0);
    expect(after.currentSuit).toBe("flowers");
    expect(R.resolvePunishment(3, 2)).toBe(0);
  });

  it("forgetting Niko Cardi with a playable last card costs 1 card and the turn", () => {
    const s = mk([[c("hearts", "9")], [c("spades", "4"), c("spades", "5")]], c("hearts", "5"), { turnStarted: false, lastMoverIndex: 1 });
    const after = R.startTurn(s);
    expect(after.players[0].hand.length).toBe(2);
    expect(after.currentPlayerIndex).toBe(1);
  });
});

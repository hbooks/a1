/* =====================================================================
 * gameState.js — deck creation, dealing and state management.
 * ---------------------------------------------------------------------
 * STATE SHAPE
 * {
 *   players: [{ name, isBot, hand: Card[] }],   // N players supported
 *   drawPile: Card[],          // last element = top of pile
 *   discardPile: Card[],       // last element = current top card
 *   topCard: Card,
 *   currentSuit: string,       // may differ from topCard.suit after an Ace
 *   direction: 1 | -1,         // 1 = clockwise
 *   currentPlayerIndex: number,
 *   pendingPunishment: number, // accumulated Foul (3) cards
 *   winnerIndex: number|null,
 *   declaredNikoCardi: boolean[],
 *   lastMoverIndex: number|null, // who ended the previous turn
 *   turnStarted: boolean,      // false during the Niko Cardi window
 *   drawnCardId: string|null,  // playable card drawn this turn
 *   log: string[],
 *   events: object[],          // what the last transition did (for UI)
 * }
 * Card = { id, suit, rank, displayName }
 * Reshuffling is handled inside Rules (pure) so the engine stays portable.
 * ===================================================================== */
(function (global) {
  'use strict';
  const R = global.Rules;

  /** Create a fresh game for the given players [{ name, isBot }]. */
  function createGame(players, rng = Math.random, handSize = 4) {
    const deck = R.shuffleDeck(R.createDeck(), rng);
    const { hands, remaining } = R.dealHands(deck, players.length, handSize);
    const { openingCard, drawPile } = R.selectOpeningCard(remaining, hands, rng);
    return {
      players: players.map((p, i) => ({ name: p.name, isBot: !!p.isBot, hand: hands[i] })),
      drawPile,
      discardPile: [openingCard],
      topCard: openingCard,
      currentSuit: openingCard.suit,
      direction: 1,
      currentPlayerIndex: 0,
      pendingPunishment: 0,
      winnerIndex: null,
      declaredNikoCardi: players.map(() => false),
      lastMoverIndex: null,
      turnStarted: false,
      drawnCardId: null,
      log: [`Opening card: ${R.cardLabel(openingCard)}`],
      events: [],
      scores: players.map(() => 0),
    };
  }

  global.GameStateMgr = { createGame };
})(typeof window !== 'undefined' ? window : globalThis);

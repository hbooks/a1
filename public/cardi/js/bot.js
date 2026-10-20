/* =====================================================================
 * bot.js — Mzalendo, a medium/analytical bot. Pure, no Phaser.
 * chooseMove(state, botIndex) → { type:'play', card, chosenSuit? }
 *                              | { type:'draw' } | { type:'pass' } | { type:'declare' }
 * ===================================================================== */
/* =====================================================================
 * bot.js — Mzalendo, a medium/analytical bot. Pure, no Phaser.
 * ===================================================================== */

(function (global) {
  'use strict';
  const R = global.Rules;

  function suitCounts(hand, excludeId) {
    const counts = { hearts: 0, spades: 0, diamonds: 0, clubs: 0 };
    hand.forEach((c) => { if (c.id !== excludeId) counts[c.suit]++; });
    return counts;
  }

  function bestSuit(hand, excludeId, rng) {
    const counts = suitCounts(hand, excludeId);
    const max = Math.max(...Object.values(counts));
    const ties = R.SUITS.filter((s) => counts[s] === max);
    return ties[Math.floor(rng() * ties.length)];
  }

  function play(card, hand, rng) {
    return card.rank === 'ace'
      ? { type: 'play', cards: [card], chosenSuit: bestSuit(hand, card.id, rng) }
      : { type: 'play', cards: [card] };
  }

  function chooseMove(state, botIndex, rng = Math.random) {
    const hand = state.players[botIndex].hand;
    const { topCard, pendingPunishment: pend, currentSuit } = state;

    // Bot only declares Niko if its last card is a WINNING card
    if (hand.length === 1 && !state.declaredNikoCardi[botIndex]) {
      if (!R.isSpecial(hand[0])) {
        return { type: 'declare' };
      }
    }

    if (state.drawnCardId) {
      const c = hand.find((h) => h.id === state.drawnCardId);
      return c && R.isPlayable(c, topCard, pend, currentSuit) ? play(c, hand, rng) : { type: 'pass' };
    }

    const legal = R.getLegalMoves(hand, topCard, pend, currentSuit);
    if (!legal.length) return { type: 'draw' };

    const aces = legal.filter((c) => c.rank === 'ace');
    const threes = legal.filter((c) => c.rank === '3');

    if (pend > 0) {
      if (aces.length && (pend > 3 || !threes.length)) return play(aces[0], hand, rng);
      if (threes.length) return play(threes[0], hand, rng);
      return play(aces[0], hand, rng);
    }

    if (hand.length === 1) return play(legal[0], hand, rng);

    if (rng() < 0.1) {
      const pool = legal.filter((c) => c.rank !== 'ace');
      if (pool.length) return play(pool[Math.floor(rng() * pool.length)], hand, rng);
    }

    const oppNear = state.players.some((p, i) => i !== botIndex && p.hand.length === 1);
    if (oppNear) {
      const disrupt = legal.find((c) => c.rank === 'king' || c.rank === 'jack');
      if (disrupt) return play(disrupt, hand, rng);
      if (threes.length) return play(threes[0], hand, rng);
    }

    const counts = suitCounts(hand);
    const normal = legal.filter((c) => !R.isSpecial(c)).sort((a, b) => counts[b.suit] - counts[a.suit]);
    if (normal.length) return play(normal[0], hand, rng);

    const order = ['jack', 'king', '3', 'ace'];
    const specials = legal.slice().sort((a, b) => order.indexOf(a.rank) - order.indexOf(b.rank));
    return play(specials[0], hand, rng);
  }

  global.Bot = { chooseMove, bestSuit };
})(typeof window !== 'undefined' ? window : globalThis);
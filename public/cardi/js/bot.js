/* =====================================================================
 * bot.js — Mzalendo v2: an analytical bot. Pure, no Phaser.
 *
 * chooseMove(state, botIndex, rng) →
 *   { type:'play', cards:[...], chosenSuit? } | { type:'draw' } | { type:'pass' } | { type:'declare' }
 *
 * FAIRNESS: the bot never reads the opponent's hand or the draw-pile order.
 * It only uses public information: its own hand, the discard pile (everything
 * that has been played), hand SIZES, and the table. From that it counts which
 * cards are still unseen and works with probabilities.
 * Every move is applied to a "belief state" (opponent hand + deck are random
 * samples of the unseen cards), through the real Rules engine, so the bot can
 * only ever pick moves the rules allow.
 * ===================================================================== */
(function (global) {
  'use strict';
  const R = global.Rules;
  const ALL = R.createDeck();
  const WIN = 1e6;

  // ---------- belief / probability helpers ----------
  function unseenCards(state, me) {
    const known = new Set();
    state.players[me].hand.forEach((c) => known.add(c.id));
    state.discardPile.forEach((c) => known.add(c.id));
    return ALL.filter((c) => !known.has(c.id));
  }

  function shuffle(a, rng) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // One random world consistent with what the bot can know.
  function makeBelief(state, me, unseen, rng) {
    const pool = shuffle(unseen, rng);
    const players = state.players.map((p, i) => {
      if (i === me) return { ...p, hand: p.hand.slice() };
      return { ...p, hand: pool.splice(0, p.hand.length) };
    });
    return {
      ...state,
      players,
      drawPile: pool.slice(0, state.drawPile.length),   // sampled order, not the real one
      discardPile: state.discardPile.slice(),
      declaredNikoCardi: state.declaredNikoCardi.slice(),
      log: [], events: [],
    };
  }

  // P(opponent holding m random unseen cards has at least one of k "good" cards among U)
  function pAtLeastOne(U, k, m) {
    if (m <= 0 || k <= 0 || U <= 0) return 0;
    if (m >= U || k >= U) return 1;
    let none = 1;
    for (let i = 0; i < m; i++) { none *= Math.max(0, U - k - i) / (U - i); if (none === 0) return 1; }
    return 1 - none;
  }

  // ---------- move generation ----------
  function enumeratePlays(hand, st) {
    const legalIds = new Set(R.getLegalMoves(hand, st.topCard, st.pendingPunishment, st.currentSuit).map((c) => c.id));
    const byRank = {};
    hand.forEach((c) => (byRank[c.rank] = byRank[c.rank] || []).push(c));
    const plays = [];
    for (const rank of Object.keys(byRank)) {
      const group = byRank[rank];
      for (let mask = 1; mask < (1 << group.length); mask++) {
        const set = group.filter((_, i) => mask & (1 << i));
        if (set.length === 1) { if (legalIds.has(set[0].id)) plays.push([set[0]]); continue; }
        for (const fin of set) {                        // the LAST card decides the suit
          const opener = set.find((c) => c.id !== fin.id && legalIds.has(c.id));
          if (!opener) continue;
          const mid = set.filter((c) => c.id !== fin.id && c.id !== opener.id);
          plays.push([opener, ...mid, fin]);
        }
      }
    }
    return plays;
  }

  function toMoves(plays, st) {
    const moves = [];
    for (const cards of plays) {
      // An Ace picks a suit when there is no punishment, or when it has a LEFTOVER Ace after cancelling it
      if (cards[0].rank === 'ace' && (st.pendingPunishment === 0 || cards.length > Math.ceil(st.pendingPunishment / 3))) {
        R.SUITS.forEach((s) => moves.push({ type: 'play', cards, chosenSuit: s }));
      } else moves.push({ type: 'play', cards });
    }
    return moves;
  }

  // ---------- evaluation (higher = better for `me`) ----------
  function staticScore(s, me, ctx, handDelta) {
    const hand = s.players[me].hand;
    const h = hand.length + (handDelta || 0);
    const n = s.players.length;
    const oppIdx = s.currentPlayerIndex !== me ? s.currentPlayerIndex : R.getNextPlayerIndex(me, s.direction, n);
    const m = s.players[oppIdx].hand.length;
    const U = ctx.unseen.length;
    const T = s.topCard, S = s.currentSuit, P = s.pendingPunishment;

    let score = (m - h) * 10;

    // How likely is the opponent able to answer the table?
    let answers = 0, winners = 0;
    for (const c of ctx.unseen) {
      if (R.isPlayable(c, T, P, S)) { answers++; if (!R.isSpecial(c)) winners++; }
    }
    const pHas = pAtLeastOne(U, answers, m);

    // Opponent about to win on a single non-special card
    if (m === 1 && P === 0 && U > 0) score -= 700 * (winners / U);
    else if (m === 2 && P === 0) score -= 25 * pHas;

    if (P > 0) {
      const myAces = hand.filter((c) => c.rank === 'ace').length;
      const myThrees = hand.filter((c) => c.rank === '3').length;
      const risk = Math.max(0, P + 3 - 3 * myAces) * (myThrees ? 0.55 : 1);
      score += (1 - pHas) * P * 10 - pHas * risk * 10;
    } else {
      score += 9 * (1 - pHas);                         // opponent likely has to draw
    }

    // Shape of my remaining hand
    let aces = 0, kj = 0, threes = 0, normal = 0, suitMatch = 0;
    const suits = new Set(), ranks = {};
    for (const c of hand) {
      if (c.rank === 'ace') aces++;
      else if (c.rank === 'king' || c.rank === 'jack') kj++;
      else if (c.rank === '3') threes++;
      else { normal++; suits.add(c.suit); if (c.suit === S) suitMatch++; }
      ranks[c.rank] = (ranks[c.rank] || 0) + 1;
    }
    score += suitMatch * 5 + suits.size * 2;
    Object.values(ranks).forEach((k) => { if (k > 1) score += 3 * (k - 1); });
    if (h >= 3) score += Math.min(aces, 2) * 5 + kj * 3 + threes * 2;
    else score += aces * 1.5 + kj * 0.5 + threes * 1;
    if (h > 0 && normal === 0) score -= 22;            // cannot win with a special card
    if (h === 1 && normal === 1) score += 14;          // one winning card left
    // Expected opponent cards in my best suit (they would steal the suit back)
    if (U > 0 && m > 0) {
      const oppInSuit = ctx.unseen.filter((c) => c.suit === S && !R.isSpecial(c)).length / U * m;
      score -= oppInSuit * 1.5;
    }
    return score;
  }

  // Best value of the position when it is my move again (Jack/King in 2-player = extra turn)
  function bestContinuation(s, me, ctx, depth) {
    const st = R.startTurn(s);
    if (st.winnerIndex != null) return st.winnerIndex === me ? WIN : -WIN;
    if (st.currentPlayerIndex !== me) return staticScore(st, me, ctx, 0);
    const plays = enumeratePlays(st.players[me].hand, st);
    if (!plays.length) return staticScore(st, me, ctx, 1) - 6;        // forced to draw
    if (depth >= 3) return staticScore(st, me, ctx, 0);
    let best = -Infinity;
    for (const mv of toMoves(plays, st)) {
      best = Math.max(best, valueOf(st, mv, me, ctx, depth + 1));
    }
    return best;
  }

  function valueOf(s, move, me, ctx, depth) {
    let next;
    try { next = R.applyMove(s, move); } catch (e) { return -Infinity; }
    if (next.winnerIndex != null) return next.winnerIndex === me ? WIN : -WIN;
    if (next.currentPlayerIndex === me) return 2 + bestContinuation(next, me, ctx, depth);
    return staticScore(next, me, ctx, 0);
  }


  // ---------- public API ----------
  function chooseMove(state, botIndex, rng = Math.random) {
    const hand = state.players[botIndex].hand;

    // Declare "Niko Cardi" only when the last card is a winning (non-special) card
    if (hand.length === 1 && !state.declaredNikoCardi[botIndex] && !R.isSpecial(hand[0])) return { type: 'declare' };

    try {
      const unseen = unseenCards(state, botIndex);
      const ctx = { unseen };
      const belief = makeBelief(state, botIndex, unseen, rng);
      const pend = state.pendingPunishment;
      let candidates = [];

      if (state.drawnCardId) {
        const c = hand.find((h) => h.id === state.drawnCardId);
        if (c && R.isPlayable(c, state.topCard, pend, state.currentSuit)) candidates = toMoves([[c]], state);
        candidates.push({ type: 'pass' });
      } else {
        candidates = toMoves(enumeratePlays(hand, state), state);
        if (!candidates.length || pend > 0) candidates.push({ type: 'draw' });
      }

      // Pass 1: heuristic value of every candidate (cheap)
      const scored = [];
      for (const mv of candidates) {
        let v;
        if (mv.type === 'draw' || mv.type === 'pass') {
          let nx; try { nx = R.applyMove(belief, mv, rng); } catch (e) { continue; }
          v = nx.currentPlayerIndex === botIndex ? bestContinuation(nx, botIndex, ctx, 1) : staticScore(nx, botIndex, ctx, 0);
          if (mv.type === 'draw' && !pend) v -= 8;
        } else v = valueOf(belief, mv, botIndex, ctx, 0);
        if (v === -Infinity) continue;
        scored.push({ mv, v });
      }
      scored.sort((a, b) => b.v - a.v);
      let best = scored.length ? scored[0].mv : null;

      if (best) return best;
    } catch (e) { /* fall through to the safe fallback */ }

    // Safe fallback: simplest legal action
    if (state.drawnCardId) return { type: 'pass' };
    const legal = R.getLegalMoves(hand, state.topCard, state.pendingPunishment, state.currentSuit);
    if (!legal.length) return { type: 'draw' };
    const c = legal[0];
    return { type: 'play', cards: [c], chosenSuit: c.rank === 'ace' ? bestSuit(hand, c.id, rng) : undefined };
  }

  function bestSuit(hand, excludeId, rng = Math.random) {
    const counts = {}; R.SUITS.forEach((s) => (counts[s] = 0));
    hand.forEach((c) => { if (c.id !== excludeId) counts[c.suit]++; });
    const max = Math.max(...Object.values(counts));
    const ties = R.SUITS.filter((s) => counts[s] === max);
    return ties[Math.floor(rng() * ties.length)];
  }

  global.Bot = { chooseMove, bestSuit };
})(typeof window !== 'undefined' ? window : globalThis);
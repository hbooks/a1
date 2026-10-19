/* =====================================================================
 * rules.js — CARDI RULES ENGINE (pure functions, zero Phaser references)
 * ---------------------------------------------------------------------
 * Every rule of Cardi lives here. Functions never mutate their inputs:
 * applyMove() / startTurn() clone the state and return a new one.
 * This file is designed to be reused verbatim by a multiplayer server.
 *
 * Exposed as window.Rules (classic script, no build step).
 *
 * Interpretation notes:
 *  - During an active punishment chain only a 3 (extend) or an Ace
 *    (reduce by 3) may be played; otherwise the player draws the total.
 *  - An Ace played against punishment: remaining = total - 3. If the
 *    remaining is > 0 the Ace player draws it; the chain is then cleared.
 *  - Kickback (King) in a 2-player game returns the turn to its player.
 * ===================================================================== */
(function (global) {
  'use strict';

  const SUITS = ['hearts', 'spades', 'diamonds', 'flowers'];
  const RANKS = ['ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king'];
  const SUIT_SYMBOLS = { hearts: '♥', spades: '♠', diamonds: '♦', flowers: '✿' };
  const SUIT_NAMES = { hearts: 'Hearts', spades: 'Spades', diamonds: 'Diamonds', flowers: 'Flowers' };
  const SUIT_COLORS = { hearts: '#d62828', diamonds: '#f77f00', spades: '#1d1d1d', flowers: '#c9a227' };
  const RANK_SHORT = { ace: 'A', jack: 'J', queen: 'Q', king: 'K' };
  const DISPLAY_NAMES = { king: 'Kickback', jack: 'Jump', queen: 'Queen', ace: 'Ace', 3: 'Foul' };
  /** Ranks that can never be the opening card. */
  const SPECIAL_RANKS = ['king', 'jack', '3', 'ace'];
  const PUNISHMENT_PER_THREE = 3;
  const ACE_CANCEL_AMOUNT = 3;

  /** Build an ordered 52-card deck (no jokers). */
  function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ id: `${suit}_${rank}`, suit, rank, displayName: DISPLAY_NAMES[rank] || rank });
      }
    }
    return deck;
  }

  /** Fisher–Yates shuffle returning a NEW array. rng is injectable for tests. */
  function shuffleDeck(deck, rng = Math.random) {
    const d = deck.slice();
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  /** Deal handSize cards round-robin to playerCount players. */
  function dealHands(deck, playerCount, handSize = 4) {
    const remaining = deck.slice();
    const hands = Array.from({ length: playerCount }, () => []);
    for (let r = 0; r < handSize; r++) {
      for (let p = 0; p < playerCount; p++) hands[p].push(remaining.shift());
    }
    return { hands, remaining };
  }

  /** True for King, Jack, 3 and Ace. */
  function isSpecial(card) {
    return SPECIAL_RANKS.includes(card.rank);
  }

  /**
   * Pick a random opening card from the remaining deck that is not in any
   * hand and is not special. Returns { openingCard, drawPile }.
   */
  function selectOpeningCard(remaining, hands = [], rng = Math.random) {
    const inHand = new Set(hands.flat().map((c) => c.id));
    const candidates = [];
    remaining.forEach((c, i) => {
      if (!inHand.has(c.id) && !isSpecial(c)) candidates.push(i);
    });
    if (!candidates.length) throw new Error('No valid opening card');
    const idx = candidates[Math.floor(rng() * candidates.length)];
    return { openingCard: remaining[idx], drawPile: remaining.filter((_, i) => i !== idx) };
  }

  /**
   * Can `card` be played on `topCard`? Aces are always playable.
   * While punishment is pending only a 3 (or Ace) may be played.
   * currentSuit overrides the top card's suit (after an Ace).
   */
  function isPlayable(card, topCard, pendingPunishment = 0, currentSuit) {
    const suit = currentSuit || topCard.suit;
    if (card.rank === 'ace') return true;
    if (pendingPunishment > 0) return card.rank === '3';
    return card.suit === suit || card.rank === topCard.rank;
  }

  /** All cards in `hand` that may legally be played. */
  function getLegalMoves(hand, topCard, pendingPunishment = 0, currentSuit) {
    return hand.filter((c) => isPlayable(c, topCard, pendingPunishment, currentSuit));
  }

  /** Index of the next player in the given direction (1 / -1). */
  function getNextPlayerIndex(currentIndex, direction, playerCount) {
    return (((currentIndex + direction) % playerCount) + playerCount) % playerCount;
  }

  /** Remaining punishment after `acesPlayed` Aces (never below zero). */
  function resolvePunishment(punishment, acesPlayed) {
    return Math.max(0, punishment - ACE_CANCEL_AMOUNT * acesPlayed);
  }

  /** Human-readable card label, e.g. "Kickback ♥". */
  function cardLabel(card) {
    return `${card.displayName} ${SUIT_SYMBOLS[card.suit]}`;
  }

  /* ---------------- internal helpers (operate on a cloned state) ------ */

  function cloneState(state) {
    return typeof structuredClone === 'function' ? structuredClone(state) : JSON.parse(JSON.stringify(state));
  }

  function addLog(s, msg) {
    s.log = [...(s.log || []), msg].slice(-30);
  }

  /** Move discard pile (except top card) into a freshly shuffled draw pile. */
  function reshuffleDiscard(s, rng) {
    const top = s.discardPile.pop();
    s.drawPile = shuffleDeck(s.discardPile, rng);
    s.discardPile = [top];
  }

  /** Draw `count` cards for player i, reshuffling when needed. Emits events. */
  function drawCards(s, i, count, reason, rng) {
    const all = [];
    let batch = [];
    for (let k = 0; k < count; k++) {
      if (!s.drawPile.length) {
        if (s.discardPile.length <= 1) break; // nothing left anywhere
        if (batch.length) s.events.push({ type: 'draw', player: i, cards: batch, reason });
        batch = [];
        reshuffleDiscard(s, rng);
        s.events.push({ type: 'reshuffle' });
        addLog(s, 'Draw pile reshuffled');
      }
      const c = s.drawPile.pop();
      s.players[i].hand.push(c);
      batch.push(c);
      all.push(c);
    }
    if (batch.length) s.events.push({ type: 'draw', player: i, cards: batch, reason });
    return all;
  }

  /** Pass the turn to `next` and refresh Niko Cardi flags. */
  function endTurn(s, next) {
    s.lastMoverIndex = s.currentPlayerIndex;
    s.currentPlayerIndex = next;
    s.turnStarted = false;
    s.drawnCardId = null;
    s.players.forEach((p, i) => {
      if (p.hand.length !== 1) s.declaredNikoCardi[i] = false;
    });
  }

  /**
   * Deferred "Niko Cardi" rule: player i may declare when they hold exactly
   * one card, it is not (actively) their turn, someone else moved last, and
   * that last card is playable on the current top card.
   */
  function canDeclareNiko(state, i) {
    const p = state.players[i];
    if (!p || state.winnerIndex != null || p.hand.length !== 1) return false;
    if (state.declaredNikoCardi[i]) return false;
    if (state.lastMoverIndex === i || state.lastMoverIndex == null) return false;
    if (state.currentPlayerIndex === i && state.turnStarted) return false;
    return isPlayable(p.hand[0], state.topCard, state.pendingPunishment, state.currentSuit);
  }

  /**
   * Begin the current player's turn. Applies the Niko Cardi foul: a player
   * who had the chance to declare but didn't draws 1 and loses the turn.
   * Bots declare automatically.
   */
  function startTurn(state, rng = Math.random) {
    const s = cloneState(state);
    s.events = [];
    const i = s.currentPlayerIndex;
    const pl = s.players[i];
    if (pl.isBot && pl.hand.length === 1) s.declaredNikoCardi[i] = true;
    const hadChance =
      pl.hand.length === 1 &&
      s.lastMoverIndex != null &&
      s.lastMoverIndex !== i &&
      isPlayable(pl.hand[0], s.topCard, s.pendingPunishment, s.currentSuit);
    if (!pl.isBot && hadChance && !s.declaredNikoCardi[i] && s.pendingPunishment === 0) {
      drawCards(s, i, 1, 'foul', rng);
      s.events.push({ type: 'foul', player: i });
      addLog(s, `${pl.name} forgot "Niko Cardi!" — +1 card`);
      endTurn(s, getNextPlayerIndex(i, s.direction, s.players.length));
      return s;
    }
    s.turnStarted = true;
    return s;
  }

  /**
   * Apply a move and return the NEW state (input is never mutated).
   * move: { type:'play', card, chosenSuit? } | { type:'draw' } | { type:'pass' }
   *     | { type:'declare', playerIndex? }
   * The returned state carries `events` describing what happened (for UI).
   */
  function applyMove(state, move, rng = Math.random) {
    if (state.winnerIndex != null) throw new Error('Game is over');
    const s = cloneState(state);
    s.events = [];
    const n = s.players.length;

    if (move.type === 'declare') {
      const i = move.playerIndex ?? s.currentPlayerIndex;
      const pl = s.players[i];
      if (pl.hand.length !== 1) throw new Error('Can only declare with one card');
      s.declaredNikoCardi[i] = true;
      addLog(s, `${pl.name}: "Niko Cardi!"`);
      return s;
    }

    if (!s.turnStarted) throw new Error('Turn has not started');
    const p = s.currentPlayerIndex;
    const pl = s.players[p];
    let next = getNextPlayerIndex(p, s.direction, n);

    if (move.type === 'play') {
      const idx = pl.hand.findIndex((c) => c.id === move.card.id);
      if (idx < 0) throw new Error('Card not in hand');
      const card = pl.hand[idx];
      if (s.drawnCardId && card.id !== s.drawnCardId) throw new Error('Only the drawn card may be played');
      if (!isPlayable(card, s.topCard, s.pendingPunishment, s.currentSuit)) throw new Error('Illegal play');

      pl.hand.splice(idx, 1);
      s.discardPile.push(card);
      s.topCard = card;
      s.currentSuit = card.suit;
      s.events.push({ type: 'play', player: p, card });
      const sym = SUIT_SYMBOLS[card.suit];

      switch (card.rank) {
        case 'ace': {
          const chosen = SUITS.includes(move.chosenSuit) ? move.chosenSuit : card.suit;
          s.currentSuit = chosen;
          s.events.push({ type: 'suit', player: p, suit: chosen });
          if (s.pendingPunishment > 0) {
            const before = s.pendingPunishment;
            const remaining = resolvePunishment(before, 1);
            s.pendingPunishment = 0;
            addLog(s, `${pl.name}'s Ace cuts punishment ${before} → ${remaining}`);
            if (remaining > 0) drawCards(s, p, remaining, 'punishment', rng);
          }
          addLog(s, `${pl.name} played Ace, chose ${SUIT_SYMBOLS[chosen]}`);
          break;
        }
        case '3':
          s.pendingPunishment += PUNISHMENT_PER_THREE;
          addLog(s, `${pl.name} played Foul ${sym} — punishment ${s.pendingPunishment}`);
          break;
        case 'king':
          s.direction *= -1;
          next = n === 2 ? p : getNextPlayerIndex(p, s.direction, n);
          addLog(s, `${pl.name} played Kickback ${sym} — direction reversed`);
          break;
        case 'jack': {
          const skipped = next;
          next = getNextPlayerIndex(next, s.direction, n);
          addLog(s, `${pl.name} played Jump ${sym} — ${s.players[skipped].name} skipped`);
          break;
        }
        default:
          addLog(s, `${pl.name} played ${cardLabel(card)}`);
      }

      if (pl.hand.length === 0) {
        s.winnerIndex = p;
        addLog(s, `${pl.name} wins!`);
        return s;
      }
      endTurn(s, next);
      return s;
    }

    if (move.type === 'draw') {
      if (s.drawnCardId) throw new Error('Already drew this turn');
      if (s.pendingPunishment > 0) {
        const amt = s.pendingPunishment;
        s.pendingPunishment = 0;
        drawCards(s, p, amt, 'punishment', rng);
        addLog(s, `${pl.name} drew ${amt} (punishment)`);
        endTurn(s, next);
        return s;
      }
      if (getLegalMoves(pl.hand, s.topCard, 0, s.currentSuit).length) throw new Error('Must play a legal card');
      const drawn = drawCards(s, p, 1, 'draw', rng);
      addLog(s, `${pl.name} drew a card`);
      if (drawn.length && isPlayable(drawn[0], s.topCard, 0, s.currentSuit)) s.drawnCardId = drawn[0].id;
      else endTurn(s, next);
      return s;
    }

    if (move.type === 'pass') {
      if (!s.drawnCardId) throw new Error('Can only pass after drawing a playable card');
      addLog(s, `${pl.name} passed`);
      endTurn(s, next);
      return s;
    }

    throw new Error(`Unknown move type: ${move.type}`);
  }

  global.Rules = {
    SUITS, RANKS, SUIT_SYMBOLS, SUIT_NAMES, SUIT_COLORS, RANK_SHORT, DISPLAY_NAMES,
    createDeck, shuffleDeck, dealHands, isSpecial, selectOpeningCard, isPlayable,
    getLegalMoves, getNextPlayerIndex, resolvePunishment, cardLabel, canDeclareNiko,
    startTurn, applyMove,
  };
})(typeof window !== 'undefined' ? window : globalThis);

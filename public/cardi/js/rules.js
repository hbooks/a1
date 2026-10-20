/* =====================================================================
 * rules.js — CARDI RULES ENGINE (pure functions, zero Phaser references)
 * ===================================================================== */
(function (global) {
  'use strict';

  const SUITS = ['hearts', 'spades', 'diamonds', 'clubs'];
  const RANKS = ['ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king'];
  const SUIT_SYMBOLS = { hearts: '♥', spades: '♠', diamonds: '♦', clubs: '✿' };
  const SUIT_NAMES = { hearts: 'Hearts', spades: 'Spades', diamonds: 'Diamonds', clubs: 'clubs' };
  const SUIT_COLORS = { hearts: '#d62828', diamonds: '#f77f00', spades: '#1d1d1d', clubs: '#c9a227' };
  const RANK_SHORT = { ace: 'A', jack: 'J', queen: 'Q', king: 'K' };
  const DISPLAY_NAMES = { king: 'Kickback', jack: 'Jump', queen: 'Queen', ace: 'Ace', 3: 'Foul' };
  const SPECIAL_RANKS = ['king', 'jack', '3', 'ace'];
  const PUNISHMENT_PER_THREE = 3;
  const ACE_CANCEL_AMOUNT = 3;

  function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ id: `${suit}_${rank}`, suit, rank, displayName: DISPLAY_NAMES[rank] || rank });
      }
    }
    return deck;
  }

  function shuffleDeck(deck, rng = Math.random) {
    const d = deck.slice();
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  function dealHands(deck, playerCount, handSize = 4) {
    const remaining = deck.slice();
    const hands = Array.from({ length: playerCount }, () => []);
    for (let r = 0; r < handSize; r++) {
      for (let p = 0; p < playerCount; p++) hands[p].push(remaining.shift());
    }
    return { hands, remaining };
  }

  function isSpecial(card) {
    return SPECIAL_RANKS.includes(card.rank);
  }

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

  function isPlayable(card, topCard, pendingPunishment = 0, currentSuit) {
    const suit = currentSuit || topCard.suit;
    if (card.rank === 'ace') return true;
    if (pendingPunishment > 0) return card.rank === '3';
    return card.suit === suit || card.rank === topCard.rank;
  }

  function getLegalMoves(hand, topCard, pendingPunishment = 0, currentSuit) {
    return hand.filter((c) => isPlayable(c, topCard, pendingPunishment, currentSuit));
  }

  function getNextPlayerIndex(currentIndex, direction, playerCount) {
    return (((currentIndex + direction) % playerCount) + playerCount) % playerCount;
  }

  function resolvePunishment(punishment, acesPlayed) {
    return Math.max(0, punishment - ACE_CANCEL_AMOUNT * acesPlayed);
  }

  function cardLabel(card) {
    return `${card.displayName} ${SUIT_SYMBOLS[card.suit]}`;
  }

  function cloneState(state) {
    return typeof structuredClone === 'function' ? structuredClone(state) : JSON.parse(JSON.stringify(state));
  }

  function addLog(s, msg) {
    s.log = [...(s.log || []), msg].slice(-30);
  }

  function reshuffleDiscard(s, rng) {
    const top = s.discardPile.pop();
    s.drawPile = shuffleDeck(s.discardPile, rng);
    s.discardPile = [top];
  }

  function drawCards(s, i, count, reason, rng) {
    const all = [];
    let batch = [];
    for (let k = 0; k < count; k++) {
      if (!s.drawPile.length) {
        if (s.discardPile.length <= 1) break;
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

  function endTurn(s, next) {
    s.lastMoverIndex = s.currentPlayerIndex;
    s.currentPlayerIndex = next;
    s.turnStarted = false;
    s.drawnCardId = null;
    s.players.forEach((p, i) => {
      if (p.hand.length !== 1) s.declaredNikoCardi[i] = false;
    });
  }

  function canDeclareNiko(state, i) {
    const p = state.players[i];
    if (!p || state.winnerIndex != null || p.hand.length !== 1) return false;
    if (state.declaredNikoCardi[i]) return false;
    if (state.lastMoverIndex === i || state.lastMoverIndex == null) return false;
    if (state.currentPlayerIndex === i && state.turnStarted) return false;

    const lastCard = p.hand[0];

    // 1. You can ONLY declare if the last card is a WINNING card (not Special)
    if (isSpecial(lastCard)) return false;

    // 2. The card must also be playable on the current table
    return isPlayable(lastCard, state.topCard, state.pendingPunishment, state.currentSuit);
  }

  function startTurn(state, rng = Math.random) {
    const s = cloneState(state);
    s.events = [];
    const i = s.currentPlayerIndex;
    const pl = s.players[i];

    if (pl.isBot && pl.hand.length === 1 && !isSpecial(pl.hand[0])) {
      s.declaredNikoCardi[i] = true;
    }

    const hadChance =
      pl.hand.length === 1 &&
      !isSpecial(pl.hand[0]) &&
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
      const cardsToPlay = Array.isArray(move.cards) ? move.cards : [move.card];
      if (!cardsToPlay.length) throw new Error('No cards to play');

      // STRICT BATCH VALIDATION
      if (cardsToPlay.length > 1) {
        const opener = cardsToPlay[0];
        if (!isPlayable(opener, s.topCard, s.pendingPunishment, s.currentSuit)) {
          throw new Error(`Opener ${opener.id} does not match the table.`);
        }
        const targetRank = opener.rank;
        for (let i = 1; i < cardsToPlay.length; i++) {
          if (cardsToPlay[i].rank !== targetRank) {
            throw new Error(`Batch failed: ${cardsToPlay[i].id} does not match rank ${targetRank}.`);
          }
        }
      } else {
        if (!isPlayable(cardsToPlay[0], s.topCard, s.pendingPunishment, s.currentSuit)) {
          throw new Error(`Card ${cardsToPlay[0].id} does not match the table.`);
        }
      }

      let lastCard = s.topCard;
      let currentSuit = s.currentSuit;

      for (const cardToPlay of cardsToPlay) {
        const idx = pl.hand.findIndex((c) => c.id === cardToPlay.id);
        if (idx < 0) throw new Error('Card not in hand');
        const card = pl.hand[idx];

        pl.hand.splice(idx, 1);
        s.discardPile.push(card);
        s.topCard = card;
        lastCard = card;
        currentSuit = card.suit;

        s.events.push({ type: 'play', player: p, card });
      }

      const finalCard = cardsToPlay[cardsToPlay.length - 1];
      const sym = SUIT_SYMBOLS[finalCard.suit];
      s.currentSuit = finalCard.suit;

      switch (finalCard.rank) {
        case 'ace': {
          if (s.pendingPunishment > 0) {
            const before = s.pendingPunishment;
            const acesPlayed = cardsToPlay.filter(c => c.rank === 'ace').length;

            // Each Ace cancels 3 punishment points
            const punishmentCancelled = acesPlayed * ACE_CANCEL_AMOUNT;
            const remainingPunishment = Math.max(0, before - punishmentCancelled);

            // Calculate how many Aces were "spent" purely canceling punishment
            const acesSpentOnPunishment = Math.ceil(Math.min(before, punishmentCancelled) / ACE_CANCEL_AMOUNT);

            // The "leftover" Aces have the power to change the suit
            const leftoverAces = acesPlayed - acesSpentOnPunishment;

            s.pendingPunishment = remainingPunishment;

            if (remainingPunishment > 0) {
              // If the punishment wasn't fully cancelled, you draw the rest
              drawCards(s, p, remainingPunishment, 'punishment', rng);
              s.events.push({ type: 'foul', player: p });
              s.currentSuit = finalCard.suit;
              addLog(s, `${pl.name} played ${acesPlayed} Ace(s) but still took ${remainingPunishment} cards.`);
            } else {
              // Punishment is fully canceled.
              if (leftoverAces > 0) {
                // You have leftover Aces! You get to choose the suit.
                const chosen = SUITS.includes(move.chosenSuit) ? move.chosenSuit : finalCard.suit;
                s.currentSuit = chosen;
                s.events.push({ type: 'suit', player: p, suit: chosen });
                addLog(s, `${pl.name} cancelled punishment and used a leftover Ace to choose ${SUIT_SYMBOLS[chosen]}`);
              } else {
                // All Aces were spent canceling. No popup. Suit follows the Ace.
                s.currentSuit = finalCard.suit;
                addLog(s, `${pl.name} played ${acesPlayed} Ace(s) to exactly cancel punishment.`);
              }
            }
          } else {
            // Normal Ace play (no punishment): Ask for suit
            const chosen = SUITS.includes(move.chosenSuit) ? move.chosenSuit : finalCard.suit;
            s.currentSuit = chosen;
            s.events.push({ type: 'suit', player: p, suit: chosen });
            addLog(s, `${pl.name} played Ace, chose ${SUIT_SYMBOLS[chosen]}`);
          }
          break;
        }
        case '3':
          s.pendingPunishment += (PUNISHMENT_PER_THREE * cardsToPlay.length);
          addLog(s, `${pl.name} played Foul x${cardsToPlay.length} — punishment ${s.pendingPunishment}`);
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
          addLog(s, `${pl.name} played ${cardLabel(finalCard)}`);
      }

      if (pl.hand.length === 0) {
        if (isSpecial(finalCard)) {
          addLog(s, `${pl.name} cannot win on a ${finalCard.displayName}. Drawing 1 card.`);
          drawCards(s, p, 1, 'foul', rng);
        } else {
          s.winnerIndex = p;
          addLog(s, `${pl.name} wins!`);
          return s;
        }
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
        addLog(s, `${pl.name} took the ${amt} punishment`);
        endTurn(s, next);
        return s;
      }

      const drawn = drawCards(s, p, 1, 'draw', rng);
      addLog(s, `${pl.name} drew a card`);

      if (drawn.length && isPlayable(drawn[0], s.topCard, 0, s.currentSuit)) {
        s.drawnCardId = drawn[0].id;
      } else {
        endTurn(s, next);
      }
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
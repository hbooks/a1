/* =====================================================================
 * scoring.js — The Smart Guard (Awards points for tactical brilliance)
 * ===================================================================== */
(function (global) {
    'use strict';

    // Point Values Configuration
    const POINTS = {
        MULTI_2: 2,       // Playing a batch of 2 cards
        MULTI_3: 3,       // Playing a batch of 3+ cards
        COUNTER_3: 4,     // Blocking a punishment with exactly one 3 (saving the rest)
        PUNISH_3: 4,      // Playing a 3 when opponent has 1 card (forcing them to draw)
        KICKBACK_SNIPE: 5,// Playing a King when opponent has 1 card
        JUMP_SNIPE: 6,    // Playing a Jack when opponent has 1 card
        ACE_DOUBLE: 7,    // Using an Ace to cancel punishment AND change suit
    };

    function evaluateMove(prevState, nextState, playerIndex, playedCards) {
        let points = 0;
        const reasons = [];

        // Safety check
        if (!playedCards || playedCards.length === 0) return { points, reasons };

        const finalCard = playedCards[playedCards.length - 1];
        const opponentIndex = (playerIndex + 1) % nextState.players.length;
        const opponentWasNearWin = prevState.players[opponentIndex].hand.length === 1;

        // 1. The Multi-Select Combo
        if (playedCards.length === 2) {
            points += POINTS.MULTI_2;
            reasons.push(`Combo ×2 (+${POINTS.MULTI_2})`);
        } else if (playedCards.length >= 3) {
            points += POINTS.MULTI_3;
            reasons.push(`Mega Combo ×${playedCards.length} (+${POINTS.MULTI_3})`);
        }

        // 2. The Counter-Attack (3s)
        if (finalCard.rank === '3') {
            const hadPunishment = prevState.pendingPunishment > 0;
            const playedThrees = playedCards.filter(c => c.rank === '3').length;

            if (hadPunishment && playedThrees === 1) {
                // They blocked a punishment with a single 3, saving the rest for later
                points += POINTS.COUNTER_3;
                reasons.push(`Tactical Block (+${POINTS.COUNTER_3})`);
            } else if (!hadPunishment && opponentWasNearWin) {
                // They aggressively fouled an opponent who was about to win
                points += POINTS.PUNISH_3;
                reasons.push(`Sniper Foul (+${POINTS.PUNISH_3})`);
            }
        }

        // 3. The Sniper Kickback (King)
        if (finalCard.rank === 'king' && opponentWasNearWin) {
            points += POINTS.KICKBACK_SNIPE;
            reasons.push(`Sniper Kickback (+${POINTS.KICKBACK_SNIPE})`);
        }

        // 4. The Sniper Jump (Jack)
        if (finalCard.rank === 'jack' && opponentWasNearWin) {
            points += POINTS.JUMP_SNIPE;
            reasons.push(`Sniper Jump (+${POINTS.JUMP_SNIPE})`);
        }

        // 5. The Ace Double
        if (finalCard.rank === 'ace') {
            const hadPunishment = prevState.pendingPunishment > 0;
            const cancelledPunishment = nextState.pendingPunishment === 0;
            const acesPlayed = playedCards.filter(c => c.rank === 'ace').length;

            // If they had a punishment, fully cancelled it, AND had a leftover Ace to change suit
            if (hadPunishment && cancelledPunishment) {
                const spent = Math.ceil(Math.min(prevState.pendingPunishment, acesPlayed * 3) / 3);
                if (acesPlayed > spent) {
                    points += POINTS.ACE_DOUBLE;
                    reasons.push(`Ace Override (+${POINTS.ACE_DOUBLE})`);
                }
            }
        }

        return { points, reasons };
    }

    global.Scoring = { evaluateMove };
})(typeof window !== 'undefined' ? window : globalThis);
// Spelregels. De volledige spelstand wordt telkens opnieuw uitgerekend uit
// de lijst met gegooide pijlen; daardoor is "ongedaan maken" gewoon de
// laatste pijl weghalen.

// Een pijl: { seg: 0-20 of 25, mult: 1|2|3 }. seg 0 = mis, seg 25 mult 2 = bull (50).

export function dartValue(d) {
  return d.seg * d.mult;
}

export function dartLabel(d) {
  if (d.seg === 0) return 'Mis';
  if (d.seg === 25) return d.mult === 2 ? 'Bull' : '25';
  return (d.mult === 3 ? 'T' : d.mult === 2 ? 'D' : 'S') + d.seg;
}

export function isValidDart(d) {
  if (!d || ![1, 2, 3].includes(d.mult)) return false;
  if (d.seg === 0) return d.mult === 1;
  if (d.seg === 25) return d.mult !== 3;
  return Number.isInteger(d.seg) && d.seg >= 1 && d.seg <= 20;
}

// Aantal gewonnen legs/sets dat nodig is bij "best of N".
export function toWin(bestOf) {
  return Math.floor(bestOf / 2) + 1;
}

function emptyStats() {
  return {
    darts: 0,
    points: 0,
    turns: 0,
    highest: 0,
    t100: 0,
    t140: 0,
    t180: 0,
    checkoutAttempts: 0,
    checkouts: 0,
    bestCheckout: 0,
  };
}

// Kan deze score met één pijl uitgegooid worden?
function oneDartFinish(score, outRule) {
  if (outRule === 'double') return score === 50 || (score >= 2 && score <= 40 && score % 2 === 0);
  return score === 50 || score === 25 || (score >= 1 && score <= 20) ||
    (score <= 40 && score % 2 === 0) || (score <= 60 && score % 3 === 0);
}

// settings: { startScore, outRule: 'double'|'single', legsBestOf, setsBestOf }
// players: [{ name }]
// darts: [{ seg, mult }]
export function computeState(settings, players, darts) {
  const n = players.length;
  const legsNeeded = toWin(settings.legsBestOf);
  const setsNeeded = toWin(settings.setsBestOf);
  const isDoubleOut = settings.outRule === 'double';

  const st = {
    scores: players.map(() => settings.startScore),
    legs: players.map(() => 0),
    sets: players.map(() => 0),
    legsTotal: players.map(() => 0),
    stats: players.map(emptyStats),
    lastTurn: players.map(() => null), // { score, bust }
    current: 0,
    turnDarts: [],
    legNumber: 0,
    setNumber: 0,
    finished: false,
    winner: null,
    lastEvent: null,
  };

  let turnStart = settings.startScore;

  const endTurn = (p, scored, bust) => {
    const s = st.stats[p];
    s.turns++;
    if (scored > s.highest) s.highest = scored;
    if (scored >= 180) s.t180++;
    else if (scored >= 140) s.t140++;
    else if (scored >= 100) s.t100++;
    st.lastTurn[p] = { score: scored, bust };
    st.turnDarts = [];
    st.current = (p + 1) % n;
    turnStart = st.scores[st.current];
  };

  for (const d of darts) {
    if (st.finished) break;
    const p = st.current;
    const s = st.stats[p];
    const before = st.scores[p];
    const value = dartValue(d);
    const after = before - value;

    if (oneDartFinish(before, settings.outRule)) s.checkoutAttempts++;
    s.darts++;

    const bust = after < 0 ||
      (isDoubleOut && after === 1) ||
      (isDoubleOut && after === 0 && d.mult !== 2);

    if (bust) {
      // De hele beurt telt niet: punten van deze beurt terugdraaien.
      s.points -= turnStart - before;
      st.scores[p] = turnStart;
      st.lastEvent = { type: 'bust', player: p, turn: [...st.turnDarts, d] };
      endTurn(p, 0, true);
      continue;
    }

    s.points += value;
    st.scores[p] = after;
    st.turnDarts.push(d);

    if (after === 0) {
      const scored = turnStart;
      const turn = st.turnDarts;
      s.checkouts++;
      if (scored > s.bestCheckout) s.bestCheckout = scored;
      endTurn(p, scored, false);

      st.legs[p]++;
      st.legsTotal[p]++;
      let type = 'leg';
      if (st.legs[p] >= legsNeeded) {
        st.sets[p]++;
        type = 'set';
        if (st.sets[p] >= setsNeeded) {
          type = 'match';
          st.finished = true;
          st.winner = p;
        } else {
          st.legs = players.map(() => 0);
          st.setNumber++;
        }
      }
      st.lastEvent = { type, player: p, score: scored, turn };

      if (!st.finished) {
        // Nieuwe leg: iedereen terug naar de startscore, volgende speler begint.
        st.legNumber++;
        st.scores = players.map(() => settings.startScore);
        st.current = st.legNumber % n;
        turnStart = settings.startScore;
      }
      continue;
    }

    if (st.turnDarts.length === 3) {
      const scored = turnStart - after;
      const turn = st.turnDarts;
      endTurn(p, scored, false);
      st.lastEvent = { type: 'turn', player: p, score: scored, turn };
    } else {
      st.lastEvent = { type: 'dart', player: p, dart: d };
    }
  }

  return st;
}

export function average(stats) {
  return stats.darts ? (stats.points / stats.darts) * 3 : 0;
}

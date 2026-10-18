// Uitgooi-advies: zoekt de beste route van 1 tot 3 pijlen naar precies 0.

import { dartLabel, dartValue } from './game.js';

const ALL = [];
for (let n = 1; n <= 20; n++) {
  ALL.push({ seg: n, mult: 1 }, { seg: n, mult: 2 }, { seg: n, mult: 3 });
}
ALL.push({ seg: 25, mult: 1 }, { seg: 25, mult: 2 });

// Favoriete dubbels als laatste pijl (hoe eerder in de lijst, hoe liever).
const DOUBLE_PREF = [20, 16, 18, 12, 10, 8, 14, 6, 4, 19, 17, 15, 13, 11, 9, 7, 5, 3, 2, 1, 25];

function finishCost(d, outRule) {
  if (outRule === 'double') return DOUBLE_PREF.indexOf(d.seg) * 4;
  // Single out: liever een groot enkel vak dan een dubbel of triple.
  if (d.seg === 25) return d.mult === 2 ? 16 : 12;
  return d.mult === 1 ? 0 : d.mult === 2 ? 4 : 8;
}

// Kosten van een opzet-pijl (niet de laatste).
function setupCost(d) {
  if (d.seg === 25) return d.mult === 2 ? 20 : 10;
  if (d.mult === 1) return 0;
  if (d.mult === 3) return d.seg === 20 ? 1 : 2 + (20 - d.seg) * 0.6;
  return 12;
}

function canFinish(d, outRule) {
  return outRule === 'double' ? d.mult === 2 : true;
}

const cache = new Map();

// Geeft een lijst labels (bv. ['T20', 'T20', 'Bull']) of null.
export function suggestCheckout(score, dartsLeft, outRule) {
  if (score <= 0 || dartsLeft <= 0 || score > 180) return null;
  const key = `${score}|${dartsLeft}|${outRule}`;
  if (cache.has(key)) return cache.get(key);

  const finishers = ALL.filter((d) => canFinish(d, outRule));
  let best = null;
  let bestCost = Infinity;

  const consider = (setup, last) => {
    const cost = finishCost(last, outRule) + setup.reduce((c, d) => c + setupCost(d), 0);
    if (cost < bestCost) {
      bestCost = cost;
      // Zwaarste opzet-pijl eerst.
      const ordered = [...setup].sort((a, b) => dartValue(b) - dartValue(a));
      best = [...ordered, last];
    }
  };

  // Zo min mogelijk pijlen: eerst alle routes van 1 pijl, dan 2, dan 3.
  for (let count = 1; count <= Math.min(3, dartsLeft) && !best; count++) {
    for (const last of finishers) {
      const rest = score - dartValue(last);
      if (count === 1) {
        if (rest === 0) consider([], last);
      } else if (count === 2) {
        for (const a of ALL) if (dartValue(a) === rest) consider([a], last);
      } else {
        for (const a of ALL) {
          const rest2 = rest - dartValue(a);
          if (rest2 <= 0) continue;
          for (const b of ALL) if (dartValue(b) === rest2) consider([a, b], last);
        }
      }
    }
  }

  const result = best ? best.map(dartLabel) : null;
  cache.set(key, result);
  return result;
}

// Eerste pijl van het advies als { seg, mult }, om op het bord te markeren.
export function suggestFirstDart(score, dartsLeft, outRule) {
  const route = suggestCheckout(score, dartsLeft, outRule);
  if (!route) return null;
  const l = route[0];
  if (l === 'Bull') return { seg: 25, mult: 2 };
  if (l === '25') return { seg: 25, mult: 1 };
  return { seg: Number(l.slice(1)), mult: l[0] === 'T' ? 3 : l[0] === 'D' ? 2 : 1 };
}

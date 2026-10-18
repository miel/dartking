import assert from 'node:assert/strict';
import { computeState, average } from '../js/game.js';
import { suggestCheckout } from '../js/checkout.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error(`✗ ${name}\n  ${e.message}`);
    process.exitCode = 1;
  }
}

const S = (n) => ({ seg: n, mult: 1 });
const D = (n) => ({ seg: n, mult: 2 });
const T = (n) => ({ seg: n, mult: 3 });
const MISS = { seg: 0, mult: 1 };
const BULL = { seg: 25, mult: 2 };

const two = [{ name: 'A' }, { name: 'B' }];
const cfg = (o = {}) => ({ startScore: 501, outRule: 'double', legsBestOf: 1, setsBestOf: 1, ...o });

// --- Spelregels ---

test('drie pijlen trekken score af en wisselen van speler', () => {
  const st = computeState(cfg(), two, [T(20), T(20), T(20)]);
  assert.equal(st.scores[0], 321);
  assert.equal(st.current, 1);
  assert.equal(st.stats[0].t180, 1);
  assert.deepEqual(st.lastEvent.type, 'turn');
});

test('bust onder nul zet score terug naar begin van de beurt', () => {
  const st = computeState(cfg({ startScore: 40 }), two, [S(20), S(20)]);
  // S20 S20 = 0 maar niet op dubbel → bust bij de tweede pijl
  assert.equal(st.scores[0], 40);
  assert.equal(st.current, 1);
  assert.equal(st.lastEvent.type, 'bust');
  assert.equal(st.stats[0].points, 0);
});

test('double out: 1 over is bust', () => {
  const st = computeState(cfg({ startScore: 21 }), two, [S(20)]);
  assert.equal(st.scores[0], 21);
  assert.equal(st.lastEvent.type, 'bust');
});

test('double out: uitgooien op dubbel wint de leg', () => {
  const st = computeState(cfg({ startScore: 40 }), two, [D(20)]);
  assert.equal(st.finished, true);
  assert.equal(st.winner, 0);
  assert.equal(st.stats[0].checkouts, 1);
});

test('double out: bull telt als dubbel', () => {
  const st = computeState(cfg({ startScore: 50 }), two, [BULL]);
  assert.equal(st.winner, 0);
});

test('single out: uitgooien op enkel mag', () => {
  const st = computeState(cfg({ startScore: 20, outRule: 'single' }), two, [S(20)]);
  assert.equal(st.winner, 0);
});

test('single out: 1 over is geen bust', () => {
  const st = computeState(cfg({ startScore: 21, outRule: 'single' }), two, [S(20)]);
  assert.equal(st.scores[0], 1);
  assert.equal(st.current, 0);
});

test('undo = pijl weghalen, ook over beurten heen', () => {
  const darts = [T(20), T(20), T(20), S(1)];
  const a = computeState(cfg(), two, darts);
  assert.equal(a.current, 1);
  assert.equal(a.scores[1], 500);
  const b = computeState(cfg(), two, darts.slice(0, -1));
  assert.equal(b.current, 1);
  assert.equal(b.scores[1], 501);
  const c = computeState(cfg(), two, darts.slice(0, -2));
  assert.equal(c.current, 0);
  assert.equal(c.scores[0], 381);
  assert.equal(c.turnDarts.length, 2);
});

test('best of 3 legs: leg wissel, startspeler roteert', () => {
  const s = cfg({ startScore: 40, legsBestOf: 3 });
  const st = computeState(s, two, [D(20)]);
  assert.equal(st.finished, false);
  assert.deepEqual(st.legs, [1, 0]);
  assert.deepEqual(st.scores, [40, 40]);
  assert.equal(st.current, 1); // leg 2 begint speler B
  const st2 = computeState(s, two, [D(20), MISS, MISS, MISS, D(20)]);
  assert.equal(st2.finished, true);
  assert.equal(st2.winner, 0);
});

test('sets: legs resetten na gewonnen set', () => {
  const s = cfg({ startScore: 40, legsBestOf: 1, setsBestOf: 3 });
  const st = computeState(s, two, [D(20)]);
  assert.deepEqual(st.sets, [1, 0]);
  assert.deepEqual(st.legs, [0, 0]);
  assert.equal(st.lastEvent.type, 'set');
  assert.equal(st.finished, false);
});

test('gemiddelde per 3 pijlen', () => {
  const st = computeState(cfg(), two, [T(20), S(20), S(20)]);
  assert.equal(average(st.stats[0]), 100);
});

// --- Uitgooi-advies ---

const co = (score, darts = 3, rule = 'double') => suggestCheckout(score, darts, rule);

test('bekende uitgooi-routes', () => {
  assert.deepEqual(co(170), ['T20', 'T20', 'Bull']);
  assert.deepEqual(co(167), ['T20', 'T19', 'Bull']);
  assert.deepEqual(co(160), ['T20', 'T20', 'D20']);
  assert.deepEqual(co(100), ['T20', 'D20']);
  assert.deepEqual(co(50), ['Bull']);
  assert.deepEqual(co(40), ['D20']);
  assert.deepEqual(co(32), ['D16']);
  assert.deepEqual(co(3), ['S1', 'D1']);
  assert.deepEqual(co(2), ['D1']);
});

test('41 gaat in 2 pijlen eindigend op een dubbel', () => {
  const r = co(41);
  assert.equal(r.length, 2);
  assert.match(r[1], /^D/);
});

test('geen uitgooi mogelijk', () => {
  for (const s of [169, 168, 166, 165, 163, 162, 159, 171, 1]) assert.equal(co(s), null, `score ${s}`);
  assert.equal(co(99, 2), null);
  assert.equal(co(41, 1), null);
});

test('elke route klopt en eindigt op een dubbel', () => {
  const val = (l) => (l === 'Bull' ? 50 : l === '25' ? 25 : Number(l.slice(1)) * { S: 1, D: 2, T: 3 }[l[0]]);
  for (let s = 2; s <= 170; s++) {
    const r = co(s);
    if (!r) continue;
    assert.equal(r.reduce((t, l) => t + val(l), 0), s, `som ${s}`);
    assert.ok(/^D|^Bull$/.test(r.at(-1)), `dubbel ${s}`);
  }
});

test('single out advies', () => {
  assert.deepEqual(co(60, 3, 'single'), ['T20']);
  assert.deepEqual(co(180, 3, 'single'), ['T20', 'T20', 'T20']);
  assert.deepEqual(co(1, 1, 'single'), ['S1']);
});

console.log(`${passed} tests geslaagd${process.exitCode ? ', maar er zijn fouten' : ''}`);

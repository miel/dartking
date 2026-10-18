import { computeState, dartLabel, average, isValidDart } from './game.js';
import { suggestCheckout, suggestFirstDart } from './checkout.js';
import { createBoard } from './board.js';
import { say, phrase, setSpeechEnabled, setSpeechLanguage, unlockSpeech } from './speech.js';
import { saveGame, loadGame, clearGame, loadPrefs, savePrefs } from './storage.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

let prefs = loadPrefs();
let game = null; // { settings, players, darts }
let st = null; // uitgerekende spelstand

// ---------- Schermen ----------

function show(id) {
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
}

function currentScreen() {
  return $('.screen.active')?.id;
}

function openModal(id) {
  $(`#${id}`).hidden = false;
}

function closeModal(id) {
  $(`#${id}`).hidden = true;
}

function anyModalOpen() {
  return $$('.modal').some((m) => !m.hidden);
}

// ---------- Geluid ----------

function applySound() {
  setSpeechLanguage(prefs.voiceLang);
  setSpeechEnabled(prefs.sound);
  $$('.sound-toggle').forEach((b) => {
    b.textContent = prefs.sound ? '🔊' : '🔇';
    b.setAttribute('aria-pressed', String(prefs.sound));
  });
}

$$('.sound-toggle').forEach((b) =>
  b.addEventListener('click', () => {
    prefs.sound = !prefs.sound;
    savePrefs(prefs);
    applySound();
    if (prefs.sound) {
      unlockSpeech();
      say(phrase('gameOn'));
    }
  }),
);

// ---------- 1. Instellingen + startpunten ----------

function renderSettings() {
  $$('.seg-control').forEach((ctrl) => {
    const value = String(prefs[ctrl.dataset.pref]);
    ctrl.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.value === value));
  });
  $$('#start-scores button').forEach((b) => b.classList.toggle('on', Number(b.dataset.score) === prefs.startScore));
}

$$('.seg-control').forEach((ctrl) =>
  ctrl.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const key = ctrl.dataset.pref;
    const v = b.dataset.value;
    prefs[key] = /^\d+$/.test(v) ? Number(v) : v;
    savePrefs(prefs);
    renderSettings();
    if (key === 'voiceLang') {
      applySound();
      if (prefs.sound) {
        unlockSpeech();
        say(phrase('gameOn'));
      }
    }
  }),
);

function chooseStartScore(score) {
  prefs.startScore = score;
  savePrefs(prefs);
  renderPlayerCounts();
  show('screen-players');
}

$('#start-scores').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) chooseStartScore(Number(b.dataset.score));
});

$('#custom-score').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#custom-score-input');
  const n = Math.round(Number(input.value));
  if (!n || n < 2 || n > 9999) {
    input.classList.add('error');
    input.focus();
    return;
  }
  input.classList.remove('error');
  input.blur();
  chooseStartScore(n);
});

$$('[data-back]').forEach((b) => b.addEventListener('click', () => show(b.dataset.back)));

// ---------- 2. Aantal spelers ----------

function renderPlayerCounts() {
  $$('#player-counts button').forEach((b) => b.classList.toggle('on', Number(b.dataset.count) === prefs.playerCount));
}

$('#player-counts').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  prefs.playerCount = Number(b.dataset.count);
  savePrefs(prefs);
  renderNameInputs();
  show('screen-names');
});

// ---------- 3. Namen ----------

function renderNameInputs() {
  const wrap = $('#name-inputs');
  wrap.replaceChildren();
  for (let i = 0; i < prefs.playerCount; i++) {
    const label = document.createElement('label');
    label.className = 'name-row';
    const num = document.createElement('span');
    num.textContent = i + 1;
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 16;
    input.autocomplete = 'off';
    input.placeholder = `Speler ${i + 1}`;
    input.value = prefs.names[i] ?? '';
    input.enterKeyHint = i === prefs.playerCount - 1 ? 'go' : 'next';
    label.append(num, input);
    wrap.appendChild(label);
  }
}

$('#names-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const inputs = $$('#name-inputs input');
  const names = inputs.map((inp, i) => inp.value.trim() || `Speler ${i + 1}`);
  prefs.names = inputs.map((inp) => inp.value.trim());
  savePrefs(prefs);
  document.activeElement?.blur();
  unlockSpeech();
  startGame(
    {
      startScore: prefs.startScore,
      outRule: prefs.outRule,
      legsBestOf: prefs.legsBestOf,
      setsBestOf: prefs.setsBestOf,
    },
    names.map((name) => ({ name })),
  );
});

// ---------- 4. Spel ----------

const board = createBoard($('#board'), addDart);

function startGame(settings, players) {
  game = { settings, players, darts: [] };
  st = computeState(settings, players, []);
  saveGame(game);
  show('screen-game');
  render();
  say(`${phrase('gameOn')} ${phrase('first', players[st.current].name)}`);
}

function resumeGame(saved) {
  game = saved;
  game.darts = game.darts.filter(isValidDart);
  st = computeState(game.settings, game.players, game.darts);
  show('screen-game');
  render();
}

function addDart(dart) {
  if (!game || st.finished || anyModalOpen() || currentScreen() !== 'screen-game') return;
  game.darts.push(dart);
  st = computeState(game.settings, game.players, game.darts);
  saveGame(game);
  render();
  handleEvent(st.lastEvent);
}

function undo() {
  if (!game || game.darts.length === 0) return;
  const removed = game.darts.pop();
  st = computeState(game.settings, game.players, game.darts);
  saveGame(game);
  show('screen-game');
  render();
  toast(`Teruggenomen: ${dartLabel(removed)}`);
}

function requireText(p) {
  const score = st.scores[p];
  if (!suggestCheckout(score, 3, game.settings.outRule)) return '';
  return ` ${phrase('require', game.players[p].name, score)}`;
}

function handleEvent(ev) {
  if (!ev) return;
  const name = game.players[ev.player].name;
  switch (ev.type) {
    case 'turn':
      toast(`${name}: ${ev.score}`, ev.score >= 100 ? 'good' : '');
      say(`${phrase('turn', ev.score)}${requireText(st.current)}`);
      break;
    case 'bust':
      toast(`${name}: BUST!`, 'bad');
      say(`${phrase('bust')}${requireText(st.current)}`);
      break;
    case 'leg':
    case 'set': {
      $('#leg-title').textContent = `${ev.type === 'set' ? '🏆 Set' : '🎯 Leg'} voor ${name}!`;
      $('#leg-text').textContent = `Uitgegooid met ${ev.score} (${ev.turn.map(dartLabel).join(' · ')}). Stand: ${standText()}`;
      $('#leg-ok').textContent = ev.type === 'set' ? 'Volgende set' : 'Volgende leg';
      openModal('dlg-leg');
      say(phrase('leg', ev.type, name));
      break;
    }
    case 'match':
      say(phrase('match', name));
      showEnd();
      break;
  }
}

function standText() {
  const multiSet = game.settings.setsBestOf > 1;
  return game.players
    .map((p, i) => `${p.name} ${multiSet ? `${st.sets[i]} sets, ${st.legs[i]} legs` : st.legs[i]}`)
    .join(' – ');
}

function gameInfoText() {
  const s = game.settings;
  const parts = [s.startScore, s.outRule === 'double' ? 'Double out' : 'Single out'];
  if (s.setsBestOf > 1) parts.push(`Bo${s.setsBestOf} sets`);
  if (s.legsBestOf > 1) parts.push(`Bo${s.legsBestOf} legs`);
  return parts.join(' · ');
}

function render() {
  if (!game) return;
  const { players, settings } = game;
  $('#game-info').textContent = gameInfoText();

  const cards = $('#player-cards');
  cards.replaceChildren();
  cards.classList.toggle('many', players.length > 3);
  players.forEach((p, i) => {
    const c = document.createElement('div');
    c.className = 'card' + (i === st.current ? ' active' : '');
    const last = st.lastTurn[i];
    const lastText = last ? (last.bust ? 'bust' : last.score) : '–';
    const legsText = settings.setsBestOf > 1 ? `S${st.sets[i]} L${st.legs[i]}` : settings.legsBestOf > 1 ? `L${st.legs[i]}` : '';
    c.innerHTML = `
      <div class="card-top"><span class="card-name"></span><span class="card-legs">${legsText}</span></div>
      <div class="card-score">${st.scores[i]}</div>
      <div class="card-meta">gem ${average(st.stats[i]).toFixed(1)} · laatst ${lastText}</div>`;
    c.querySelector('.card-name').textContent = p.name;
    cards.appendChild(c);
  });
  cards.querySelector('.active')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });

  const cur = st.current;
  const score = st.scores[cur];
  $('#current-name').textContent = players[cur].name;
  $('#current-score').textContent = score;

  const slots = $('#turn-darts');
  slots.replaceChildren();
  for (let i = 0; i < 3; i++) {
    const d = st.turnDarts[i];
    const s = document.createElement('span');
    s.className = 'slot' + (d ? ' filled' : '');
    s.textContent = d ? dartLabel(d) : '';
    slots.appendChild(s);
  }

  const dartsLeft = 3 - st.turnDarts.length;
  const route = st.finished ? null : suggestCheckout(score, dartsLeft, settings.outRule);
  const co = $('#checkout');
  if (route) {
    co.textContent = route.join(' · ');
    co.className = 'checkout show';
  } else {
    co.textContent = '';
    co.className = 'checkout';
  }
  board.highlight(route ? suggestFirstDart(score, dartsLeft, settings.outRule) : null);
  $('#undo-btn').disabled = game.darts.length === 0;
}

let toastTimer;
function toast(text, kind = '') {
  const t = $('#toast');
  t.textContent = text;
  t.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = 'toast'), 1600);
}

$$('.pad-btn[data-seg]').forEach((b) =>
  b.addEventListener('click', () => addDart({ seg: Number(b.dataset.seg), mult: Number(b.dataset.mult) })),
);
$('#undo-btn').addEventListener('click', undo);

$('#leg-ok').addEventListener('click', () => {
  closeModal('dlg-leg');
  const p = st.current;
  say(phrase('first', game.players[p].name));
});

$('#game-menu-btn').addEventListener('click', () => openModal('dlg-menu'));
$('#menu-close').addEventListener('click', () => closeModal('dlg-menu'));
$('#menu-quit').addEventListener('click', () => {
  closeModal('dlg-menu');
  clearGame();
  game = null;
  goHome();
});
$('#menu-stats').addEventListener('click', () => {
  closeModal('dlg-menu');
  renderStats($('#live-stats-table'));
  openModal('dlg-stats');
});
$('#stats-close').addEventListener('click', () => closeModal('dlg-stats'));

// ---------- 5. Einde + statistieken ----------

function renderStats(table) {
  const rows = [
    ['Gemiddelde (3 pijlen)', (s) => average(s).toFixed(1)],
    ['Hoogste beurt', (s) => s.highest],
    ['100+', (s) => s.t100],
    ['140+', (s) => s.t140],
    ['180', (s) => s.t180],
    ['Hoogste uitgooi', (s) => s.bestCheckout || '–'],
    ['Checkout %', (s) => (s.checkoutAttempts ? `${Math.round((s.checkouts / s.checkoutAttempts) * 100)}%` : '–')],
    ['Pijlen gegooid', (s) => s.darts],
    ['Legs gewonnen', (s, i) => st.legsTotal[i]],
  ];
  if (game.settings.setsBestOf > 1) rows.push(['Sets gewonnen', (s, i) => st.sets[i]]);

  table.replaceChildren();
  const head = table.insertRow();
  head.appendChild(document.createElement('th'));
  game.players.forEach((p) => {
    const th = document.createElement('th');
    th.textContent = p.name;
    head.appendChild(th);
  });
  for (const [label, fn] of rows) {
    const tr = table.insertRow();
    const th = document.createElement('th');
    th.textContent = label;
    tr.appendChild(th);
    st.stats.forEach((s, i) => (tr.insertCell().textContent = fn(s, i)));
  }
}

function showEnd() {
  clearGame(); // afgelopen spel hoeft niet hervat te worden
  $('#winner').textContent = `🏆 ${game.players[st.winner].name} wint!`;
  renderStats($('#stats-table'));
  show('screen-end');
}

$('#rematch-btn').addEventListener('click', () => startGame(game.settings, game.players));
$('#home-btn').addEventListener('click', () => {
  game = null;
  goHome();
});
$('#end-undo-btn').addEventListener('click', undo);

function goHome() {
  renderSettings();
  show('screen-start');
}

// ---------- Hervatten ----------

function offerResume(saved) {
  const s = computeState(saved.settings, saved.players, saved.darts.filter(isValidDart));
  if (s.finished) {
    clearGame();
    return false;
  }
  const names = saved.players.map((p, i) => `${p.name} (${s.scores[i]})`).join(', ');
  $('#resume-text').textContent = `${saved.settings.startScore}-spel: ${names}.`;
  openModal('dlg-resume');
  return true;
}

$('#resume-yes').addEventListener('click', () => {
  closeModal('dlg-resume');
  const saved = loadGame();
  if (saved) {
    unlockSpeech();
    resumeGame(saved);
    say(phrase('yourThrow', game.players[st.current].name));
  } else {
    goHome();
  }
});

$('#resume-no').addEventListener('click', () => {
  closeModal('dlg-resume');
  clearGame();
  game = null;
  goHome();
});

// Terugkomen in de app na wegklikken: vragen of je verder wilt.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (currentScreen() !== 'screen-game' || !game || st.finished) return;
  if (!$('#dlg-resume').hidden) return;
  ['dlg-menu', 'dlg-stats'].forEach(closeModal);
  // Een open leg-melding blijft staan; de vraag komt erbovenop.
  offerResume(game);
});

// ---------- Start ----------

applySound();
renderSettings();

const saved = loadGame();
if (!saved || !offerResume(saved)) goHome();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

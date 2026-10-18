// Klikbaar SVG-dartbord. De ringen zijn breder dan op een echt bord,
// zodat dubbel en triple goed te raken zijn met een vinger.

const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const NS = 'http://www.w3.org/2000/svg';

const R = {
  bull: 12,
  outerBull: 26,
  trebleIn: 92,
  trebleOut: 116,
  doubleIn: 150,
  doubleOut: 174,
  numbers: 191,
  rim: 208,
};

function polar(r, deg) {
  const a = (deg * Math.PI) / 180;
  return [r * Math.cos(a), r * Math.sin(a)];
}

function arcPath(r1, r2, a1, a2) {
  const [x1, y1] = polar(r2, a1);
  const [x2, y2] = polar(r2, a2);
  const [x3, y3] = polar(r1, a2);
  const [x4, y4] = polar(r1, a1);
  return `M${x1} ${y1}A${r2} ${r2} 0 0 1 ${x2} ${y2}L${x3} ${y3}A${r1} ${r1} 0 0 0 ${x4} ${y4}Z`;
}

function el(name, attrs, parent) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

function addDefs(svg) {
  const defs = el('defs', {}, svg);

  // Donkere buitenrand met een beetje diepte.
  const rim = el('radialGradient', { id: 'db-rim', cx: '50%', cy: '45%', r: '55%' }, defs);
  el('stop', { offset: '80%', 'stop-color': '#262626' }, rim);
  el('stop', { offset: '100%', 'stop-color': '#0a0a0a' }, rim);

  // Zilveren draad.
  const wire = el('linearGradient', { id: 'db-wire', x1: '0', y1: '0', x2: '1', y2: '1' }, defs);
  el('stop', { offset: '0%', 'stop-color': '#f4f5f7' }, wire);
  el('stop', { offset: '50%', 'stop-color': '#9ea3aa' }, wire);
  el('stop', { offset: '100%', 'stop-color': '#e3e5e8' }, wire);

  // Lichtval van linksboven.
  const shine = el('radialGradient', { id: 'db-shine', cx: '30%', cy: '22%', r: '75%' }, defs);
  el('stop', { offset: '0%', 'stop-color': '#fff', 'stop-opacity': '0.16' }, shine);
  el('stop', { offset: '55%', 'stop-color': '#fff', 'stop-opacity': '0' }, shine);
  el('stop', { offset: '100%', 'stop-color': '#000', 'stop-opacity': '0.28' }, shine);

  // Sisal-structuur.
  const noise = el('filter', { id: 'db-sisal', x: '0', y: '0', width: '100%', height: '100%' }, defs);
  el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.9', numOctaves: '2', seed: '7' }, noise);
  el('feColorMatrix', { values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0' }, noise);

  const clip = el('clipPath', { id: 'db-play' }, defs);
  el('circle', { r: R.doubleOut }, clip);
}

export function createBoard(container, onHit) {
  const svg = el('svg', { viewBox: '-210 -210 420 420', class: 'board', role: 'img', 'aria-label': 'Dartbord' });
  addDefs(svg);

  // Buitenrand + metalen ring rond de cijfers.
  el('circle', { r: R.rim, fill: 'url(#db-rim)' }, svg);
  el('circle', { r: R.rim - 1.5, fill: 'none', stroke: '#3a3a3a', 'stroke-width': 3 }, svg);

  const segments = new Map(); // "seg-mult" -> element

  ORDER.forEach((num, i) => {
    const mid = -90 + i * 18;
    const a1 = mid - 9;
    const a2 = mid + 9;
    const dark = i % 2 === 0;
    const rings = [
      [R.outerBull, R.trebleIn, 1],
      [R.trebleIn, R.trebleOut, 3],
      [R.trebleOut, R.doubleIn, 1],
      [R.doubleIn, R.doubleOut, 2],
    ];
    for (const [r1, r2, mult] of rings) {
      const color = mult === 1 ? (dark ? 'seg-dark' : 'seg-light') : (dark ? 'seg-red' : 'seg-green');
      const p = el('path', { d: arcPath(r1, r2, a1, a2), class: `seg ${color}`, 'data-seg': num, 'data-mult': mult }, svg);
      segments.set(`${num}-${mult}`, p);
    }
  });

  const outer = el('circle', { r: R.outerBull, class: 'seg seg-green', 'data-seg': 25, 'data-mult': 1 }, svg);
  const bull = el('circle', { r: R.bull, class: 'seg seg-red', 'data-seg': 25, 'data-mult': 2 }, svg);
  segments.set('25-1', outer);
  segments.set('25-2', bull);

  // Alles hieronder is decoratie en niet aanklikbaar.
  const deco = el('g', { class: 'board-deco' }, svg);

  el('rect', { x: -R.doubleOut, y: -R.doubleOut, width: R.doubleOut * 2, height: R.doubleOut * 2, filter: 'url(#db-sisal)', 'clip-path': 'url(#db-play)', class: 'sisal' }, deco);

  // Draden: spaken tussen de vakken en ringen.
  const wires = el('g', { stroke: 'url(#db-wire)', fill: 'none', 'stroke-linecap': 'round' }, deco);
  for (let i = 0; i < 20; i++) {
    const a = -99 + i * 18;
    const [x1, y1] = polar(R.outerBull, a);
    const [x2, y2] = polar(R.doubleOut + 4, a);
    el('line', { x1, y1, x2, y2, 'stroke-width': 1.3 }, wires);
  }
  for (const r of [R.trebleIn, R.trebleOut, R.doubleIn]) el('circle', { r, 'stroke-width': 1.5 }, wires);
  el('circle', { r: R.doubleOut, 'stroke-width': 2.2 }, wires);
  el('circle', { r: R.outerBull, 'stroke-width': 1.5 }, wires);
  el('circle', { r: R.bull, 'stroke-width': 1.3 }, wires);

  el('circle', { r: R.rim, fill: 'url(#db-shine)' }, deco);

  ORDER.forEach((num, i) => {
    const [tx, ty] = polar(R.numbers, -90 + i * 18);
    const t = el('text', { x: tx, y: ty, class: 'board-num', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, deco);
    t.textContent = num;
  });

  svg.addEventListener('click', (e) => {
    const target = e.target.closest('.seg');
    if (!target) return;
    const dart = { seg: Number(target.dataset.seg), mult: Number(target.dataset.mult) };
    target.classList.remove('flash');
    // Reflow zodat de animatie opnieuw start bij twee keer hetzelfde vak.
    void target.getBoundingClientRect();
    target.classList.add('flash');
    onHit(dart);
  });
  svg.addEventListener('animationend', (e) => e.target.classList.remove('flash'));

  // Rand rond het geadviseerde vak, bovenop alles en niet aanklikbaar.
  const overlay = el('g', { class: 'target-layer' }, svg);
  container.appendChild(svg);

  return {
    highlight(dart) {
      overlay.replaceChildren();
      const src = dart && segments.get(`${dart.seg}-${dart.mult}`);
      if (!src) return;
      const copy = src.cloneNode(false);
      copy.setAttribute('class', 'target');
      overlay.appendChild(copy);
    },
  };
}

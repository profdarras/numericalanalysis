/* ============================================================
   Numerical Analysis Workbench
   Core utilities + tool framework
   ============================================================ */

/* ---------- small DOM helper ---------- */
function el(tag, attrs, children) {
  const node = document.createElement(tag);
  attrs = attrs || {};
  for (const k in attrs) {
    if (k === 'class') node.className = attrs[k];
    else if (k === 'html') node.innerHTML = attrs[k];
    else if (k === 'text') node.textContent = attrs[k];
    else if (k.startsWith('on') && typeof attrs[k] === 'function') node.addEventListener(k.slice(2), attrs[k]);
    else node.setAttribute(k, attrs[k]);
  }
  (children || []).forEach(c => { if (c) node.appendChild(c); });
  return node;
}

/* ---------- number formatting ---------- */
function fmt(x, d) {
  d = (d === undefined) ? 6 : d;
  if (x === null || x === undefined || Number.isNaN(x)) return '--';
  if (!Number.isFinite(x)) return x > 0 ? 'Infinity' : '-Infinity';
  if (Math.abs(x) !== 0 && (Math.abs(x) < 1e-4 || Math.abs(x) >= 1e6)) return x.toExponential(d - 2);
  return x.toFixed(d);
}

/* ---------- safe expression compiling (math.js) ---------- */
function compileExpr(str) {
  if (typeof window.math === 'undefined') {
    throw new Error('The math.js library failed to load. Make sure the vendor/ folder (vendor/math.min.js) was uploaded to the site, then hard-refresh (Ctrl+F5).');
  }
  const compiled = math.compile(str);
  return compiled;
}
function evalScalar(compiled, scope) {
  const v = compiled.evaluate(scope);
  if (typeof v !== 'number') throw new Error('Expression did not evaluate to a number.');
  return v;
}
function makeF1(exprStr, varName) {
  varName = varName || 'x';
  const c = compileExpr(exprStr);
  return function (v) {
    const scope = {};
    scope[varName] = v;
    return evalScalar(c, scope);
  };
}
function makeF2(exprStr, v1, v2) {
  const c = compileExpr(exprStr);
  return function (a, b) {
    const scope = {};
    scope[v1] = a; scope[v2] = b;
    return evalScalar(c, scope);
  };
}

/* ---------- error / summary boxes ---------- */
function errorBox(msg) {
  return el('div', { class: 'err-box', text: msg });
}
function summaryBox(html) {
  return el('div', { class: 'result-summary', html: html });
}

/* ---------- steps table ---------- */
function stepsTable(caption, headers, rows, opts) {
  opts = opts || {};
  const t = el('table', { class: 'steps' });
  if (caption) t.appendChild(el('caption', { text: caption }));
  const thead = el('thead');
  const htr = el('tr');
  headers.forEach(h => htr.appendChild(el('th', { html: h })));
  thead.appendChild(htr);
  t.appendChild(thead);
  const tbody = el('tbody');
  rows.forEach((r, i) => {
    const tr = el('tr', { class: (opts.highlightLast && i === rows.length - 1) ? 'hl' : '' });
    r.forEach(cell => tr.appendChild(el('td', { html: (cell === undefined || cell === null) ? '' : String(cell) })));
    tbody.appendChild(tr);
  });
  t.appendChild(tbody);
  return el('div', { class: 'table-scroll' }, [t]);
}

/* ---------- KaTeX render helper ---------- */
function katexEl(tex, displayMode) {
  const span = el('span');
  try {
    katex.render(tex, span, { displayMode: !!displayMode, throwOnError: false });
  } catch (e) {
    span.textContent = tex;
  }
  return span;
}

/* ---------- simple function plot (SVG) ---------- */
function plotFunction(opts) {
  // opts: { f, xMin, xMax, markers: [{x,y,color,label}], width, height, extraCurves: [{f,color}] }
  const W = opts.width || 640, H = opts.height || 320;
  const padL = 46, padR = 18, padT = 18, padB = 34;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  const N = 240;
  const xs = [];
  const ys = [];
  for (let i = 0; i <= N; i++) {
    const x = opts.xMin + (opts.xMax - opts.xMin) * i / N;
    let y;
    try { y = opts.f(x); } catch (e) { y = NaN; }
    xs.push(x);
    ys.push(y);
  }
  let yMin = Infinity, yMax = -Infinity;
  ys.forEach(y => { if (Number.isFinite(y)) { yMin = Math.min(yMin, y); yMax = Math.max(yMax, y); } });
  (opts.markers || []).forEach(m => { if (Number.isFinite(m.y)) { yMin = Math.min(yMin, m.y); yMax = Math.max(yMax, m.y); } });
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax) || yMin === yMax) { yMin -= 1; yMax += 1; }
  const yPad = (yMax - yMin) * 0.1 || 1;
  yMin -= yPad; yMax += yPad;

  function px(x) { return padL + (x - opts.xMin) / (opts.xMax - opts.xMin) * plotW; }
  function py(y) { return padT + (1 - (y - yMin) / (yMax - yMin)) * plotH; }

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  function line(x1, y1, x2, y2, stroke, width, dash) {
    const l = document.createElementNS(svgNS, 'line');
    l.setAttribute('x1', x1); l.setAttribute('y1', y1);
    l.setAttribute('x2', x2); l.setAttribute('y2', y2);
    l.setAttribute('stroke', stroke); l.setAttribute('stroke-width', width || 1);
    if (dash) l.setAttribute('stroke-dasharray', dash);
    return l;
  }

  // axes
  if (yMin < 0 && yMax > 0) svg.appendChild(line(px(opts.xMin), py(0), px(opts.xMax), py(0), '#C7CEDA', 1));
  svg.appendChild(line(padL, padT, padL, H - padB, '#C7CEDA', 1));
  svg.appendChild(line(padL, H - padB, W - padR, H - padB, '#C7CEDA', 1));

  // optional shaded region (e.g. current bracket)
  if (opts.shadeRegion) {
    const rect = document.createElementNS(svgNS, 'rect');
    const x1 = px(opts.shadeRegion.x1), x2 = px(opts.shadeRegion.x2);
    rect.setAttribute('x', Math.min(x1, x2)); rect.setAttribute('y', padT);
    rect.setAttribute('width', Math.abs(x2 - x1)); rect.setAttribute('height', plotH);
    rect.setAttribute('fill', opts.shadeRegion.color || '#13A0A6');
    rect.setAttribute('opacity', '0.10');
    svg.appendChild(rect);
  }

  // optional vertical reference lines (e.g. bracket endpoints)
  (opts.vlines || []).forEach(v => {
    svg.appendChild(line(px(v.x), padT, px(v.x), H - padB, v.color || '#5B6577', v.width || 1.4, v.dash || '4,3'));
    if (v.label) {
      const t = document.createElementNS(svgNS, 'text');
      t.setAttribute('x', px(v.x)); t.setAttribute('y', padT - 5);
      t.setAttribute('font-size', '11'); t.setAttribute('fill', v.color || '#5B6577');
      t.setAttribute('font-family', 'JetBrains Mono, monospace');
      t.setAttribute('text-anchor', 'middle');
      t.textContent = v.label;
      svg.appendChild(t);
    }
  });

  // x tick labels
  for (let i = 0; i <= 4; i++) {
    const x = opts.xMin + (opts.xMax - opts.xMin) * i / 4;
    const t = document.createElementNS(svgNS, 'text');
    t.setAttribute('x', px(x)); t.setAttribute('y', H - padB + 16);
    t.setAttribute('font-size', '10.5'); t.setAttribute('fill', '#5B6577');
    t.setAttribute('font-family', 'JetBrains Mono, monospace');
    t.setAttribute('text-anchor', 'middle');
    t.textContent = fmt(x, 2);
    svg.appendChild(t);
  }

  function pathFor(fn, color) {
    let d = '';
    let started = false;
    for (let i = 0; i <= N; i++) {
      const x = opts.xMin + (opts.xMax - opts.xMin) * i / N;
      let y; try { y = fn(x); } catch (e) { y = NaN; }
      if (!Number.isFinite(y)) { started = false; continue; }
      const X = px(x), Y = py(y);
      d += (started ? ' L ' : ' M ') + X.toFixed(2) + ' ' + Y.toFixed(2);
      started = true;
    }
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', 2);
    return path;
  }

  svg.appendChild(pathFor(opts.f, '#0B2545'));
  (opts.extraCurves || []).forEach(c => svg.appendChild(pathFor(c.f, c.color || '#13A0A6')));

  (opts.markers || []).forEach(m => {
    if (!Number.isFinite(m.x) || !Number.isFinite(m.y)) return;
    const c = document.createElementNS(svgNS, 'circle');
    c.setAttribute('cx', px(m.x)); c.setAttribute('cy', py(m.y));
    c.setAttribute('r', 4.5); c.setAttribute('fill', m.color || '#F4743B');
    c.setAttribute('stroke', '#fff'); c.setAttribute('stroke-width', 1.5);
    svg.appendChild(c);
    if (m.label) {
      const t = document.createElementNS(svgNS, 'text');
      t.setAttribute('x', px(m.x)); t.setAttribute('y', py(m.y) - 9);
      t.setAttribute('font-size', '11'); t.setAttribute('fill', m.color || '#F4743B');
      t.setAttribute('font-family', 'JetBrains Mono, monospace');
      t.setAttribute('text-anchor', 'middle');
      t.textContent = m.label;
      svg.appendChild(t);
    }
  });

  return svg;
}
function plotWrap(svg) {
  return el('div', { class: 'plot-wrap' }, [svg]);
}

/* ============================================================
   STEP PLAYER
   Reveal a precomputed sequence of steps one at a time via a
   "Next Step" button, instead of dumping the whole table at once.
   Each step: { cells: [...row values...], plot: svgElement|null }
   ============================================================ */
function stepPlayer(opts) {
  // opts: { headers, steps, caption, summaryFor(shownCount) -> html string }
  const wrap = el('div');
  const controls = el('div', { class: 'btn-row' });
  const summaryHost = el('div');
  const tableHost = el('div');
  const plotHost = el('div');

  let shown = Math.min(1, opts.steps.length); // reveal the first step immediately

  const nextBtn = el('button', { class: 'btn', text: 'Next Step \u2192', onclick: () => { if (shown < opts.steps.length) { shown++; render(); } } });
  const allBtn = el('button', { class: 'btn secondary', text: 'Show All Steps', onclick: () => { shown = opts.steps.length; render(); } });
  const resetBtn = el('button', { class: 'btn secondary', text: 'Reset', onclick: () => { shown = Math.min(1, opts.steps.length); render(); } });
  controls.appendChild(nextBtn);
  controls.appendChild(allBtn);
  controls.appendChild(resetBtn);

  function render() {
    summaryHost.innerHTML = '';
    if (opts.summaryFor) summaryHost.appendChild(summaryBox(opts.summaryFor(shown)));

    tableHost.innerHTML = '';
    const rows = opts.steps.slice(0, shown).map(s => s.cells);
    tableHost.appendChild(stepsTable(opts.caption || null, opts.headers, rows, { highlightLast: true }));

    plotHost.innerHTML = '';
    const cur = opts.steps[shown - 1];
    if (cur && cur.plot) plotHost.appendChild(plotWrap(cur.plot));

    const atEnd = shown >= opts.steps.length;
    nextBtn.disabled = atEnd;
    nextBtn.textContent = atEnd ? 'All steps shown' : `Next Step \u2192  (${shown} of ${opts.steps.length})`;
  }

  wrap.appendChild(summaryHost);
  wrap.appendChild(controls);
  wrap.appendChild(plotHost);
  wrap.appendChild(tableHost);
  render();
  return wrap;
}

/* ---------- convergence plot: error (or value) vs iteration, log-scale option ---------- */
function plotSeries(opts) {
  // opts: { points: [{k, v}], width, height, logScale, yLabel, color, markLast }
  const W = opts.width || 640, H = opts.height || 280;
  const padL = 54, padR = 18, padT = 18, padB = 34;
  const plotWth = W - padL - padR, plotH = H - padT - padB;
  const pts = opts.points.filter(p => Number.isFinite(p.v) && (!opts.logScale || p.v > 0));
  if (pts.length < 1) return null;

  const kMin = pts[0].k, kMax = pts[pts.length - 1].k || 1;
  let vMin = Math.min(...pts.map(p => p.v)), vMax = Math.max(...pts.map(p => p.v));
  if (opts.logScale) { vMin = Math.log10(vMin); vMax = Math.log10(vMax); }
  if (vMin === vMax) { vMin -= 1; vMax += 1; }
  const vPad = (vMax - vMin) * 0.12 || 1;
  vMin -= vPad; vMax += vPad;

  function px(k) { return padL + (kMax === kMin ? 0.5 : (k - kMin) / (kMax - kMin)) * plotWth; }
  function py(v) { const vv = opts.logScale ? Math.log10(v) : v; return padT + (1 - (vv - vMin) / (vMax - vMin)) * plotH; }

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  function line(x1, y1, x2, y2, stroke, w) {
    const l = document.createElementNS(svgNS, 'line');
    l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
    l.setAttribute('stroke', stroke); l.setAttribute('stroke-width', w || 1);
    return l;
  }
  svg.appendChild(line(padL, padT, padL, H - padB, '#C7CEDA', 1));
  svg.appendChild(line(padL, H - padB, W - padR, H - padB, '#C7CEDA', 1));

  function text(x, y, str, anchor) {
    const t = document.createElementNS(svgNS, 'text');
    t.setAttribute('x', x); t.setAttribute('y', y);
    t.setAttribute('font-size', '10.5'); t.setAttribute('fill', '#5B6577');
    t.setAttribute('font-family', 'JetBrains Mono, monospace');
    t.setAttribute('text-anchor', anchor || 'middle');
    t.textContent = str;
    return t;
  }
  for (let i = 0; i <= Math.min(4, kMax - kMin); i++) {
    const k = Math.round(kMin + (kMax - kMin) * i / Math.min(4, Math.max(kMax - kMin, 1)));
    svg.appendChild(text(px(k), H - padB + 16, String(k)));
  }
  svg.appendChild(text(10, padT + 4, opts.logScale ? 'log' : (opts.yLabel || ''), 'start'));

  let d = '';
  pts.forEach((p, i) => { d += (i === 0 ? 'M ' : 'L ') + px(p.k).toFixed(2) + ' ' + py(p.v).toFixed(2) + ' '; });
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', d.trim());
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', opts.color || '#0B2545');
  path.setAttribute('stroke-width', 2);
  svg.appendChild(path);

  pts.forEach((p, i) => {
    const c = document.createElementNS(svgNS, 'circle');
    c.setAttribute('cx', px(p.k)); c.setAttribute('cy', py(p.v));
    const isLast = i === pts.length - 1;
    c.setAttribute('r', isLast ? 5 : 3);
    c.setAttribute('fill', isLast ? '#F4743B' : (opts.color || '#0B2545'));
    svg.appendChild(c);
  });

  return svg;
}

/* ---------- cobweb diagram for fixed-point iteration ---------- */
function plotCobweb(opts) {
  // opts: { g, xMin, xMax, path: [p0, p1, p2, ...] (as many as revealed so far) }
  const W = opts.width || 640, H = opts.height || 360;
  const padL = 46, padR = 18, padT = 18, padB = 34;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  const allY = opts.path.slice();
  for (let i = 0; i <= 60; i++) {
    const x = opts.xMin + (opts.xMax - opts.xMin) * i / 60;
    try { const y = opts.g(x); if (Number.isFinite(y)) allY.push(y); } catch (e) {}
  }
  let yMin = Math.min(opts.xMin, ...allY), yMax = Math.max(opts.xMax, ...allY);
  const yPad = (yMax - yMin) * 0.1 || 1;
  yMin -= yPad; yMax += yPad;

  function px(x) { return padL + (x - opts.xMin) / (opts.xMax - opts.xMin) * plotW; }
  function py(y) { return padT + (1 - (y - yMin) / (yMax - yMin)) * plotH; }

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  function line(x1, y1, x2, y2, stroke, w, dash) {
    const l = document.createElementNS(svgNS, 'line');
    l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
    l.setAttribute('stroke', stroke); l.setAttribute('stroke-width', w || 1);
    if (dash) l.setAttribute('stroke-dasharray', dash);
    return l;
  }
  svg.appendChild(line(padL, padT, padL, H - padB, '#C7CEDA', 1));
  svg.appendChild(line(padL, H - padB, W - padR, H - padB, '#C7CEDA', 1));

  // y = x reference line
  svg.appendChild(line(px(opts.xMin), py(opts.xMin), px(opts.xMax), py(opts.xMax), '#C7CEDA', 1.5, '4,3'));

  // y = g(x) curve
  let d = '', started = false;
  const N = 200;
  for (let i = 0; i <= N; i++) {
    const x = opts.xMin + (opts.xMax - opts.xMin) * i / N;
    let y; try { y = opts.g(x); } catch (e) { y = NaN; }
    if (!Number.isFinite(y)) { started = false; continue; }
    d += (started ? ' L ' : ' M ') + px(x).toFixed(2) + ' ' + py(y).toFixed(2);
    started = true;
  }
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', d); path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#0B2545'); path.setAttribute('stroke-width', 2);
  svg.appendChild(path);

  // cobweb staircase: p0 -> (p0,g(p0)) -> (g(p0),g(p0)) -> (g(p0),g(g(p0))) -> ...
  const p = opts.path;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1];
    svg.appendChild(line(px(a), py(a), px(a), py(b), '#F4743B', 1.6));
    svg.appendChild(line(px(a), py(b), px(b), py(b), '#F4743B', 1.6));
  }
  // mark points
  p.forEach((v, i) => {
    const c = document.createElementNS(svgNS, 'circle');
    c.setAttribute('cx', px(v)); c.setAttribute('cy', py(v));
    c.setAttribute('r', i === p.length - 1 ? 5 : 3);
    c.setAttribute('fill', i === p.length - 1 ? '#F4743B' : '#13A0A6');
    svg.appendChild(c);
  });

  return svg;
}

/* ============================================================
   POLYNOMIAL UTILITIES
   Coefficient arrays are ascending order: [c0, c1, c2, ...] means
   c0 + c1*x + c2*x^2 + ...
   ============================================================ */
function polyFromRoots(roots) {
  let coeffs = [1];
  roots.forEach(r => {
    const next = new Array(coeffs.length + 1).fill(0);
    for (let i = 0; i < coeffs.length; i++) {
      next[i] += -r * coeffs[i];
      next[i + 1] += coeffs[i];
    }
    coeffs = next;
  });
  return coeffs;
}
function polyAdd(a, b) {
  const n = Math.max(a.length, b.length);
  const out = new Array(n).fill(0);
  for (let i = 0; i < n; i++) out[i] = (a[i] || 0) + (b[i] || 0);
  return out;
}
function polyScale(a, k) { return a.map(v => v * k); }

function numToClean(v, d) {
  d = d === undefined ? 6 : d;
  let s = v.toFixed(d);
  s = s.replace(/0+$/, '').replace(/\.$/, '');
  if (s === '' || s === '-') s = '0';
  return s;
}

function polyToLatex(coeffs, varName) {
  varName = varName || 'x';
  const terms = [];
  for (let i = coeffs.length - 1; i >= 0; i--) {
    const c = coeffs[i];
    if (Math.abs(c) < 1e-9) continue;
    const sign = c < 0 ? ' - ' : (terms.length ? ' + ' : '');
    const absC = Math.abs(c);
    let coefStr = '';
    if (i === 0 || Math.abs(absC - 1) > 1e-9) coefStr = numToClean(absC);
    const varPart = i === 0 ? '' : (i === 1 ? varName : varName + '^{' + i + '}');
    terms.push(sign + coefStr + varPart);
  }
  return terms.length ? terms.join('') : '0';
}
function polyEval(coeffs, x) {
  let s = 0, p = 1;
  for (let i = 0; i < coeffs.length; i++) { s += coeffs[i] * p; p *= x; }
  return s;
}

/* ---------- dynamic (x, y) nodes editor ---------- */
function nodesEditor(initialPoints, opts) {
  opts = opts || {};
  const yLabel = opts.yLabel || 'y';
  const wrap = el('div', { class: 'nodes-editor' });
  const table = el('table');
  const thead = el('thead', {}, [el('tr', {}, [
    el('th', { text: 'x' }), el('th', { text: yLabel }), el('th', { text: '' })
  ])]);
  const tbody = el('tbody');
  table.appendChild(thead);
  table.appendChild(tbody);
  wrap.appendChild(table);

  function addRow(x, y) {
    const xInput = el('input', { value: (x === undefined ? '' : x), type: 'text' });
    const yInput = el('input', { value: (y === undefined ? '' : y), type: 'text' });
    const rmBtn = el('button', { class: 'rm', html: '&times;', title: 'Remove point', onclick: () => tr.remove() });
    const tr = el('tr', {}, [
      el('td', {}, [xInput]),
      el('td', {}, [yInput]),
      el('td', {}, [rmBtn])
    ]);
    tbody.appendChild(tr);
  }
  (initialPoints || []).forEach(p => addRow(p[0], p[1]));

  const addBtn = el('button', { class: 'btn secondary', text: '+ Add point', onclick: (e) => { e.preventDefault(); addRow(); } });
  wrap.appendChild(addBtn);

  function getPoints() {
    const pts = [];
    tbody.querySelectorAll('tr').forEach(tr => {
      const inputs = tr.querySelectorAll('input');
      const x = parseFloat(inputs[0].value);
      const y = parseFloat(inputs[1].value);
      if (Number.isFinite(x) && Number.isFinite(y)) pts.push([x, y]);
    });
    return pts;
  }
  return { element: wrap, getPoints };
}

/* ---------- matrix + vector editor for Ax=b ---------- */
function systemEditor(initialA, initialB) {
  const n = initialA.length;
  const wrap = el('div', { class: 'matrix-editor' });
  const inputs = [];
  for (let i = 0; i < n; i++) {
    const rowInputs = [];
    const rowEl = el('div', { class: 'mrow' });
    for (let j = 0; j < n; j++) {
      const inp = el('input', { value: initialA[i][j], type: 'text' });
      rowInputs.push(inp);
      rowEl.appendChild(inp);
    }
    const bInp = el('input', { value: initialB[i], type: 'text', class: 'bcol' });
    rowInputs.push(bInp);
    rowEl.appendChild(bInp);
    inputs.push(rowInputs);
    wrap.appendChild(rowEl);
  }
  function getSystem() {
    const A = [], b = [];
    for (let i = 0; i < n; i++) {
      const row = [];
      for (let j = 0; j < n; j++) row.push(parseFloat(inputs[i][j].value));
      A.push(row);
      b.push(parseFloat(inputs[i][n].value));
    }
    return { A, b, n };
  }
  return { element: wrap, getSystem, size: n };
}
function resizeSystemEditor(container, n, oldGet) {
  let A = [], b = [];
  try { const s = oldGet(); A = s.A; b = s.b; } catch (e) {}
  const newA = [], newB = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n; j++) row.push((A[i] && Number.isFinite(A[i][j])) ? A[i][j] : (i === j ? 1 : 0));
    newA.push(row);
    newB.push(Number.isFinite(b[i]) ? b[i] : 0);
  }
  return { A: newA, b: newB };
}

/* ---------- generic field builders ---------- */
function field(labelText, inputAttrs, hint) {
  const input = el('input', inputAttrs);
  const wrap = el('div', { class: 'field' + (inputAttrs.wide ? ' wide' : '') }, [
    el('label', { text: labelText }),
    input
  ]);
  if (hint) wrap.appendChild(el('div', { class: 'hint', text: hint }));
  wrap._input = input;
  return wrap;
}
function getVal(fieldNode) { return fieldNode._input.value; }
function getNum(fieldNode) { return parseFloat(fieldNode._input.value); }
function getInt(fieldNode) { return parseInt(fieldNode._input.value, 10); }

/* ============================================================
   TOOL DEFINITIONS
   ============================================================ */
const CHAPTERS = [];

function registerChapter(id, title, tools) {
  CHAPTERS.push({ id, title, tools });
}

/* ---------- Chapter 1: Mathematical Preliminaries ---------- */
registerChapter('ch1', 'Chapter 1 \u2014 Mathematical Preliminaries', [
  {
    id: 'error',
    title: 'Absolute & Relative Error',
    eyebrow: 'CHAPTER 1 \u00b7 MATHEMATICAL PRELIMINARIES',
    intro: 'Compare a true value p to an approximation p*. Relative error is usually the more meaningful of the two.',
    formula: '\\text{Absolute error} = |p-p^*|, \\qquad \\text{Relative error} = \\frac{|p-p^*|}{|p|}',
    build(container) {
      const pField = field('p (true value)', { value: '10000' });
      const pStarField = field('p* (approximation)', { value: '10001' });
      const resultArea = el('div', { class: 'result-area' });

      function run() {
        resultArea.innerHTML = '';
        const p = getNum(pField), pStar = getNum(pStarField);
        if (!Number.isFinite(p) || !Number.isFinite(pStar)) { resultArea.appendChild(errorBox('Both p and p* must be numbers.')); return; }
        if (p === 0) { resultArea.appendChild(errorBox('Relative error is undefined when p = 0 (division by zero).')); return; }
        const absErr = Math.abs(p - pStar);
        const relErr = absErr / Math.abs(p);
        resultArea.appendChild(stepsTable(null, ['Quantity', 'Value'], [
          ['Absolute error, |p \u2212 p*|', fmt(absErr, 8)],
          ['Relative error, |p \u2212 p*| / |p|', fmt(relErr, 8)]
        ]));
      }

      container.appendChild(el('div', { class: 'field-grid' }, [pField, pStarField]));
      container.appendChild(el('div', { class: 'btn-row' }, [el('button', { class: 'btn', text: 'Calculate', onclick: run })]));
      container.appendChild(resultArea);
    }
  },
  {
    id: 'taylor',
    title: 'Taylor Polynomial Approximation',
    eyebrow: 'CHAPTER 1 \u00b7 MATHEMATICAL PRELIMINARIES',
    intro: 'See how the degree-n Taylor polynomial of a function, centered at x\u2080, approaches the true function as n grows.',
    formula: 'P_n(x) = \\sum_{k=0}^{n} \\frac{f^{(k)}(x_0)}{k!}(x-x_0)^k',
    formulaNote: 'Derivatives are estimated numerically, so very high degrees may lose accuracy.',
    build(container) {
      const fField = field('f(x) =', { value: 'exp(x)', wide: true });
      const x0Field = field('center x\u2080', { value: '0' });
      const xField = field('evaluate at x =', { value: '1' });
      const nField = field('degree n', { value: '3' });

      const grid = el('div', { class: 'field-grid' }, [fField, x0Field, xField, nField]);
      const resultArea = el('div', { class: 'result-area' });

      function nthDerivative(f, x0, k, h) {
        // central finite-difference approximation of the k-th derivative
        h = h || 0.01;
        if (k === 0) return f(x0);
        const coeffsCache = { 1: [-1, 0, 1], 2: [1, -2, 1] };
        if (k === 1) return (f(x0 + h) - f(x0 - h)) / (2 * h);
        if (k === 2) return (f(x0 + h) - 2 * f(x0) + f(x0 - h)) / (h * h);
        if (k === 3) return (f(x0 + 2 * h) - 2 * f(x0 + h) + 2 * f(x0 - h) - f(x0 - 2 * h)) / (2 * h * h * h);
        if (k === 4) return (f(x0 + 2 * h) - 4 * f(x0 + h) + 6 * f(x0) - 4 * f(x0 - h) + f(x0 - 2 * h)) / (h * h * h * h);
        throw new Error('Degree above 4 is not supported by this numeric-derivative tool.');
      }
      function factorial(k) { let r = 1; for (let i = 2; i <= k; i++) r *= i; return r; }

      function run() {
        resultArea.innerHTML = '';
        let f;
        try { f = makeF1(getVal(fField)); } catch (e) { resultArea.appendChild(errorBox('Could not parse f(x): ' + e.message)); return; }
        const x0 = getNum(x0Field), x = getNum(xField), n = getInt(nField);
        if (![x0, x].every(Number.isFinite)) { resultArea.appendChild(errorBox('x\u2080 and x must be numbers.')); return; }
        if (!Number.isInteger(n) || n < 0 || n > 4) { resultArea.appendChild(errorBox('This tool supports degree n from 0 to 4.')); return; }

        let trueVal;
        try { trueVal = f(x); } catch (e) { resultArea.appendChild(errorBox('f(x) could not be evaluated: ' + e.message)); return; }

        const rows = [];
        let P = 0;
        for (let k = 0; k <= n; k++) {
          let dk;
          try { dk = nthDerivative(f, x0, k); } catch (e) { resultArea.appendChild(errorBox(e.message)); return; }
          const term = dk / factorial(k) * Math.pow(x - x0, k);
          P += term;
          rows.push(['P' + k, fmt(P, 8), fmt(Math.abs(trueVal - P), 8)]);
        }

        resultArea.appendChild(summaryBox(`True f(${fmt(x, 4)}) = ${fmt(trueVal, 8)}`));
        resultArea.appendChild(stepsTable('Successive Taylor approximations', ['P\u2099(x)', 'Value', '|error|'], rows, { highlightLast: true }));

        try {
          resultArea.appendChild(plotWrap(plotFunction({
            f, xMin: Math.min(x0, x) - 2, xMax: Math.max(x0, x) + 2,
            extraCurves: [{
              f: (xv) => { let s = 0; for (let k = 0; k <= n; k++) s += nthDerivative(f, x0, k) / factorial(k) * Math.pow(xv - x0, k); return s; },
              color: '#F4743B'
            }],
            markers: [{ x: x0, y: f(x0), color: '#13A0A6', label: 'x\u2080' }]
          })));
        } catch (e) { /* optional */ }
      }

      container.appendChild(grid);
      container.appendChild(el('div', { class: 'btn-row' }, [el('button', { class: 'btn', text: 'Calculate', onclick: run })]));
      container.appendChild(resultArea);
    }
  }
]);

/* ---------- Chapter 2: Root-Finding ---------- */
registerChapter('ch2', 'Chapter 2 \u2014 Root-Finding', [
  {
    id: 'bisection',
    title: 'Bisection Method',
    eyebrow: 'CHAPTER 2 \u00b7 ROOT-FINDING',
    intro: 'Given f continuous on [a,b] with a sign change, repeatedly halve the bracket that still contains the root.',
    formula: 'p_n = a_n + \\dfrac{b_n-a_n}{2}',
    build(container) {
      const fFieldWrap = field('f(x) =', { value: 'x^3 + 4*x^2 - 10', wide: true }, 'Use x as the variable. Supports + - * / ^, sin, cos, exp, sqrt, log, etc.');
      const aField = field('a (left endpoint)', { value: '1', type: 'text' });
      const bField = field('b (right endpoint)', { value: '2', type: 'text' });
      const tolField = field('tolerance', { value: '1e-6', type: 'text' });
      const nField = field('max iterations', { value: '30', type: 'text' });

      const grid = el('div', { class: 'field-grid' }, [fFieldWrap, aField, bField, tolField, nField]);
      const resultArea = el('div', { class: 'result-area' });

      function run() {
        resultArea.innerHTML = '';
        let f;
        try { f = makeF1(getVal(fFieldWrap)); } catch (e) {
          resultArea.appendChild(errorBox('Could not parse f(x): ' + e.message));
          return;
        }
        const a0 = getNum(aField), b0 = getNum(bField);
        const tol = getNum(tolField), maxN = getInt(nField);
        if (!Number.isFinite(a0) || !Number.isFinite(b0)) { resultArea.appendChild(errorBox('a and b must be numbers.')); return; }
        if (a0 >= b0) { resultArea.appendChild(errorBox('a must be less than b.')); return; }

        let fa;
        try { fa = f(a0); } catch (e) { resultArea.appendChild(errorBox('f(a) could not be evaluated: ' + e.message)); return; }
        let fb;
        try { fb = f(b0); } catch (e) { resultArea.appendChild(errorBox('f(b) could not be evaluated: ' + e.message)); return; }

        if (fa * fb >= 0) {
          resultArea.appendChild(errorBox(
            `f(a)\u00b7f(b) = ${fmt(fa)} \u00d7 ${fmt(fb)} = ${fmt(fa * fb)} \u2265 0 \u2014 there is no guaranteed sign change on [${a0}, ${b0}]. Bisection needs f(a) and f(b) to have opposite signs.`
          ));
          return;
        }

        let a = a0, b = b0;
        const domXMin = a0 - (b0 - a0) * 0.15, domXMax = b0 + (b0 - a0) * 0.15;
        const steps = [];
        let root = null, converged = false;
        for (let n = 1; n <= maxN; n++) {
          const p = a + (b - a) / 2;
          let fp;
          try { fp = f(p); } catch (e) { resultArea.appendChild(errorBox('f(p) failed at p=' + fmt(p) + ': ' + e.message)); return; }
          const aAtStep = a, bAtStep = b;
          steps.push({
            cells: [n, fmt(a), fmt(b), fmt(p), fmt(fp)],
            plot: plotFunction({
              f, xMin: domXMin, xMax: domXMax,
              shadeRegion: { x1: aAtStep, x2: bAtStep },
              vlines: [{ x: aAtStep, color: '#13A0A6', label: 'a' }, { x: bAtStep, color: '#13A0A6', label: 'b' }],
              markers: [{ x: p, y: fp, color: '#F4743B', label: 'p' }]
            })
          });
          if (fp === 0 || (b - a) / 2 < tol) { root = p; converged = true; break; }
          if (fa * fp < 0) { b = p; } else { a = p; fa = fp; }
          root = p;
        }

        resultArea.appendChild(stepPlayer({
          headers: ['n', 'a\u2099', 'b\u2099', 'p\u2099', 'f(p\u2099)'],
          steps,
          summaryFor: (shown) => {
            const atEnd = shown >= steps.length;
            if (atEnd) {
              return converged
                ? `<b>Converged.</b> Approximate root p \u2248 ${fmt(root, 8)} after ${steps.length} iteration${steps.length === 1 ? '' : 's'}.`
                : `<span class="fail">Did not converge</span> within ${maxN} iterations. Last estimate: p \u2248 ${fmt(root, 8)}.`;
            }
            const cur = steps[shown - 1];
            return `Step ${shown} of ${steps.length} \u2014 current estimate p\u2099 = ${cur.cells[3]}. Click <b>Next Step</b> to continue.`;
          }
        }));
      }

      container.appendChild(grid);
      container.appendChild(el('div', { class: 'btn-row' }, [
        el('button', { class: 'btn', text: 'Calculate', onclick: run })
      ]));
      container.appendChild(resultArea);
    }
  },
  {
    id: 'fixedpoint',
    title: 'Fixed-Point Iteration',
    eyebrow: 'CHAPTER 2 \u00b7 ROOT-FINDING',
    intro: 'Rewrite f(x)=0 as x=g(x), then repeatedly apply g. Convergence depends entirely on how g behaves near the fixed point.',
    formula: 'p_n = g(p_{n-1})',
    build(container) {
      const gField = field('g(x) =', { value: 'sqrt(10/(4+x))', wide: true }, 'Enter the rearranged x = g(x). Use x as the variable.');
      const p0Field = field('p\u2080 (initial guess)', { value: '1.5' });
      const tolField = field('tolerance', { value: '1e-6' });
      const nField = field('max iterations', { value: '30' });

      const grid = el('div', { class: 'field-grid' }, [gField, p0Field, tolField, nField]);
      const resultArea = el('div', { class: 'result-area' });

      function run() {
        resultArea.innerHTML = '';
        let g;
        try { g = makeF1(getVal(gField)); } catch (e) { resultArea.appendChild(errorBox('Could not parse g(x): ' + e.message)); return; }
        let p = getNum(p0Field);
        const tol = getNum(tolField), maxN = getInt(nField);
        if (!Number.isFinite(p)) { resultArea.appendChild(errorBox('p\u2080 must be a number.')); return; }

        const p0Val = p;
        const path = [p0Val];
        const rows = [[0, fmt(p), '\u2014']];
        let converged = false, failMsg = null;
        for (let n = 1; n <= maxN; n++) {
          let pNext;
          try { pNext = g(p); }
          catch (e) { failMsg = `g(x) could not be evaluated at p=${fmt(p)}: ${e.message}`; break; }
          if (!Number.isFinite(pNext)) { failMsg = `g(p) produced a non-real or infinite value at iteration ${n} (p=${fmt(p)}) \u2014 this rearrangement diverges.`; break; }
          const diff = Math.abs(pNext - p);
          rows.push([n, fmt(pNext), fmt(diff)]);
          path.push(pNext);
          if (diff < tol) { p = pNext; converged = true; break; }
          if (Math.abs(pNext) > 1e8) { failMsg = `|p_n| exceeded 1e8 at iteration ${n} \u2014 this rearrangement diverges.`; break; }
          p = pNext;
        }

        if (failMsg) {
          resultArea.appendChild(errorBox(failMsg));
          if (rows.length > 1) resultArea.appendChild(stepsTable('Iterations before divergence', ['n', 'p\u2099', '|p\u2099 \u2212 p\u2099\u208b\u2081|'], rows));
          return;
        }

        const allVals = path.filter(Number.isFinite);
        const domMin = Math.min(...allVals), domMax = Math.max(...allVals);
        const domPad = (domMax - domMin) * 0.3 || 1;
        const cobwebXMin = domMin - domPad, cobwebXMax = domMax + domPad;

        const steps = rows.map((rowCells, idx) => ({
          cells: rowCells,
          plot: plotCobweb({ g, xMin: cobwebXMin, xMax: cobwebXMax, path: path.slice(0, idx + 1) })
        }));

        resultArea.appendChild(stepPlayer({
          headers: ['n', 'p\u2099', '|p\u2099 \u2212 p\u2099\u208b\u2081|'],
          steps,
          summaryFor: (shown) => {
            const atEnd = shown >= steps.length;
            if (atEnd) {
              return converged
                ? `<b>Converged.</b> Fixed point p \u2248 ${fmt(p, 8)} after ${rows.length - 1} iteration${rows.length - 1 === 1 ? '' : 's'}.`
                : `<span class="fail">Did not converge</span> within ${maxN} iterations. Last estimate: p \u2248 ${fmt(p, 8)}.`;
            }
            return `Step ${shown - 1} of ${steps.length - 1} \u2014 current estimate p\u2099 = ${steps[shown - 1].cells[1]}. Click <b>Next Step</b> to continue.`;
          }
        }));
      }

      container.appendChild(grid);
      container.appendChild(el('div', { class: 'btn-row' }, [
        el('button', { class: 'btn', text: 'Calculate', onclick: run })
      ]));
      container.appendChild(resultArea);
    }
  },
  {
    id: 'newton',
    title: "Newton's Method",
    eyebrow: 'CHAPTER 2 \u00b7 ROOT-FINDING',
    intro: 'Follow the tangent line down to the x-axis at every step. Fast (quadratic convergence) when it works, but needs f\u2019(x) and a good starting guess.',
    formula: "p_n = p_{n-1} - \\dfrac{f(p_{n-1})}{f'(p_{n-1})}",
    build(container) {
      const fField = field('f(x) =', { value: 'x^3 + 4*x^2 - 10', wide: true });
      const fpField = field("f'(x) =", { value: '3*x^2 + 8*x', wide: true }, 'Enter the derivative yourself \u2014 Newton\u2019s Method needs it explicitly.');
      const p0Field = field('p\u2080 (initial guess)', { value: '1.5' });
      const tolField = field('tolerance', { value: '1e-8' });
      const nField = field('max iterations', { value: '20' });

      const grid = el('div', { class: 'field-grid' }, [fField, fpField, p0Field, tolField, nField]);
      const resultArea = el('div', { class: 'result-area' });

      function run() {
        resultArea.innerHTML = '';
        let f, fp;
        try { f = makeF1(getVal(fField)); } catch (e) { resultArea.appendChild(errorBox('Could not parse f(x): ' + e.message)); return; }
        try { fp = makeF1(getVal(fpField)); } catch (e) { resultArea.appendChild(errorBox("Could not parse f'(x): " + e.message)); return; }
        let p = getNum(p0Field);
        const tol = getNum(tolField), maxN = getInt(nField);
        if (!Number.isFinite(p)) { resultArea.appendChild(errorBox('p\u2080 must be a number.')); return; }

        const steps = [];
        const allPs = [p];
        let converged = false, failMsg = null;
        for (let n = 1; n <= maxN; n++) {
          let fpn, fppn;
          try { fpn = f(p); fppn = fp(p); }
          catch (e) { failMsg = 'Evaluation failed at p=' + fmt(p) + ': ' + e.message; break; }
          if (fppn === 0) { failMsg = `f'(p) = 0 at p=${fmt(p)} \u2014 Newton\u2019s Method cannot continue (division by zero).`; break; }
          const pPrev = p;
          const pNext = p - fpn / fppn;
          allPs.push(pNext);
          const tangentFn = (xv) => fpn + fppn * (xv - pPrev);
          steps.push({ cells: [n, fmt(pNext, 8), fmt(f(pNext), 8)], pPrev, pNext, tangentFn });
          if (Math.abs(pNext - p) < tol) { p = pNext; converged = true; break; }
          p = pNext;
        }

        if (failMsg) { resultArea.appendChild(errorBox(failMsg)); if (steps.length) resultArea.appendChild(stepsTable(null, ['n', 'p\u2099', 'f(p\u2099)'], steps.map(s => s.cells))); return; }

        const validPs = allPs.filter(Number.isFinite);
        const domMin = Math.min(...validPs), domMax = Math.max(...validPs);
        const domPad = (domMax - domMin) * 0.4 || 1;
        const xMin = domMin - domPad, xMax = domMax + domPad;

        steps.forEach(s => {
          s.plot = plotFunction({
            f, xMin, xMax,
            extraCurves: [{ f: s.tangentFn, color: '#F4743B' }],
            vlines: [{ x: s.pPrev, color: '#13A0A6', dash: '2,2', label: 'p\u2099\u208b\u2081' }],
            markers: [{ x: s.pNext, y: f(s.pNext), color: '#F4743B', label: 'p\u2099' }]
          });
        });

        resultArea.appendChild(stepPlayer({
          headers: ['n', 'p\u2099', 'f(p\u2099)'],
          steps,
          summaryFor: (shown) => {
            const atEnd = shown >= steps.length;
            if (atEnd) {
              return converged
                ? `<b>Converged.</b> Root p \u2248 ${fmt(p, 8)} after ${steps.length} iteration${steps.length === 1 ? '' : 's'}.`
                : `<span class="fail">Did not converge</span> within ${maxN} iterations. Last estimate: p \u2248 ${fmt(p, 8)}.`;
            }
            return `Step ${shown} of ${steps.length} \u2014 current estimate p\u2099 = ${steps[shown - 1].cells[1]}. Click <b>Next Step</b> to continue.`;
          }
        }));
      }

      container.appendChild(grid);
      container.appendChild(el('div', { class: 'btn-row' }, [
        el('button', { class: 'btn', text: 'Calculate', onclick: run })
      ]));
      container.appendChild(resultArea);
    }
  },
  {
    id: 'secant',
    title: 'The Secant Method',
    eyebrow: 'CHAPTER 2 \u00b7 ROOT-FINDING',
    intro: 'Like Newton\u2019s Method, but approximates the derivative from the last two points instead \u2014 no derivative required.',
    formula: 'p_n = p_{n-1} - \\dfrac{f(p_{n-1})(p_{n-1}-p_{n-2})}{f(p_{n-1})-f(p_{n-2})}',
    build(container) {
      const fField = field('f(x) =', { value: 'x^3 + 4*x^2 - 10', wide: true });
      const p0Field = field('p\u2080', { value: '1' });
      const p1Field = field('p\u2081', { value: '2' });
      const tolField = field('tolerance', { value: '1e-8' });
      const nField = field('max iterations', { value: '20' });

      const grid = el('div', { class: 'field-grid' }, [fField, p0Field, p1Field, tolField, nField]);
      const resultArea = el('div', { class: 'result-area' });

      function run() {
        resultArea.innerHTML = '';
        let f;
        try { f = makeF1(getVal(fField)); } catch (e) { resultArea.appendChild(errorBox('Could not parse f(x): ' + e.message)); return; }
        let p0 = getNum(p0Field), p1 = getNum(p1Field);
        const tol = getNum(tolField), maxN = getInt(nField);
        if (!Number.isFinite(p0) || !Number.isFinite(p1)) { resultArea.appendChild(errorBox('p\u2080 and p\u2081 must be numbers.')); return; }

        let q0, q1;
        try { q0 = f(p0); q1 = f(p1); } catch (e) { resultArea.appendChild(errorBox('Could not evaluate f at p\u2080 or p\u2081: ' + e.message)); return; }

        const steps = [];
        const allPs = [p0, p1];
        let converged = false, failMsg = null, pFinal = p1;
        for (let n = 2; n <= maxN + 1; n++) {
          if (q1 - q0 === 0) { failMsg = `f(p\u2099) \u2212 f(p\u2099\u208b\u2081) = 0 at step ${n} \u2014 the secant line is flat and the method breaks down.`; break; }
          const p0AtStep = p0, p1AtStep = p1, q0AtStep = q0, q1AtStep = q1;
          const p2 = p1 - q1 * (p1 - p0) / (q1 - q0);
          let q2;
          try { q2 = f(p2); } catch (e) { failMsg = 'f could not be evaluated at p=' + fmt(p2) + ': ' + e.message; break; }
          allPs.push(p2);
          const secantFn = (xv) => q1AtStep + (q1AtStep - q0AtStep) / (p1AtStep - p0AtStep) * (xv - p1AtStep);
          steps.push({ cells: [n, fmt(p2, 8), fmt(q2, 8)], p0: p0AtStep, p1: p1AtStep, p2, secantFn });
          pFinal = p2;
          if (Math.abs(p2 - p1) < tol) { converged = true; break; }
          p0 = p1; q0 = q1;
          p1 = p2; q1 = q2;
        }

        if (failMsg) { resultArea.appendChild(errorBox(failMsg)); if (steps.length) resultArea.appendChild(stepsTable(null, ['n', 'p\u2099', 'f(p\u2099)'], steps.map(s => s.cells))); return; }

        const validPs = allPs.filter(Number.isFinite);
        const domMin = Math.min(...validPs), domMax = Math.max(...validPs);
        const domPad = (domMax - domMin) * 0.3 || 1;
        const xMin = domMin - domPad, xMax = domMax + domPad;
        steps.forEach(s => {
          s.plot = plotFunction({
            f, xMin, xMax,
            extraCurves: [{ f: s.secantFn, color: '#F4743B' }],
            vlines: [{ x: s.p0, color: '#13A0A6', dash: '2,2', label: 'p\u2099\u208b\u2082' }, { x: s.p1, color: '#13A0A6', dash: '2,2', label: 'p\u2099\u208b\u2081' }],
            markers: [{ x: s.p2, y: f(s.p2), color: '#F4743B', label: 'p\u2099' }]
          });
        });

        resultArea.appendChild(stepPlayer({
          headers: ['n', 'p\u2099', 'f(p\u2099)'],
          steps,
          summaryFor: (shown) => {
            const atEnd = shown >= steps.length;
            if (atEnd) {
              return converged
                ? `<b>Converged.</b> Root p \u2248 ${fmt(pFinal, 8)} after ${steps.length} iteration${steps.length === 1 ? '' : 's'}.`
                : `<span class="fail">Did not converge</span> within ${maxN} iterations. Last estimate: p \u2248 ${fmt(pFinal, 8)}.`;
            }
            return `Step ${shown} of ${steps.length} \u2014 current estimate p\u2099 = ${steps[shown - 1].cells[1]}. Click <b>Next Step</b> to continue.`;
          }
        }));
      }

      container.appendChild(grid);
      container.appendChild(el('div', { class: 'btn-row' }, [
        el('button', { class: 'btn', text: 'Calculate', onclick: run })
      ]));
      container.appendChild(resultArea);
    }
  },
  {
    id: 'falseposition',
    title: 'Method of False Position',
    eyebrow: 'CHAPTER 2 \u00b7 ROOT-FINDING',
    intro: 'The Secant Method\u2019s formula, but with Bisection\u2019s safety net: re-check the bracket every step so the estimate can never wander outside it.',
    formula: 'p_n = p_{n-1} - \\dfrac{f(p_{n-1})(p_{n-1}-p_{n-2})}{f(p_{n-1})-f(p_{n-2})}',
    formulaNote: 'Same formula as Secant \u2014 the difference is entirely in which pair of points is kept for the next step.',
    build(container) {
      const fField = field('f(x) =', { value: 'x^3 + 4*x^2 - 10', wide: true });
      const p0Field = field('p\u2080', { value: '1' });
      const p1Field = field('p\u2081', { value: '2' });
      const tolField = field('tolerance', { value: '1e-8' });
      const nField = field('max iterations', { value: '20' });

      const grid = el('div', { class: 'field-grid' }, [fField, p0Field, p1Field, tolField, nField]);
      const resultArea = el('div', { class: 'result-area' });

      function run() {
        resultArea.innerHTML = '';
        let f;
        try { f = makeF1(getVal(fField)); } catch (e) { resultArea.appendChild(errorBox('Could not parse f(x): ' + e.message)); return; }
        let p0 = getNum(p0Field), p1 = getNum(p1Field);
        const tol = getNum(tolField), maxN = getInt(nField);
        if (!Number.isFinite(p0) || !Number.isFinite(p1)) { resultArea.appendChild(errorBox('p\u2080 and p\u2081 must be numbers.')); return; }

        let q0, q1;
        try { q0 = f(p0); q1 = f(p1); } catch (e) { resultArea.appendChild(errorBox('Could not evaluate f at p\u2080 or p\u2081: ' + e.message)); return; }
        if (q0 * q1 >= 0) { resultArea.appendChild(errorBox(`f(p\u2080)\u00b7f(p\u2081) = ${fmt(q0 * q1)} \u2265 0 \u2014 False Position needs an initial sign change.`)); return; }

        const steps = [];
        const allPs = [p0, p1];
        let converged = false, failMsg = null, pFinal = p1;
        for (let n = 2; n <= maxN + 1; n++) {
          if (q1 - q0 === 0) { failMsg = `f(p\u2099) \u2212 f(p\u2099\u208b\u2081) = 0 at step ${n}.`; break; }
          const p0AtStep = p0, p1AtStep = p1, q0AtStep = q0, q1AtStep = q1;
          const p2 = p1 - q1 * (p1 - p0) / (q1 - q0);
          let q2;
          try { q2 = f(p2); } catch (e) { failMsg = 'f could not be evaluated at p=' + fmt(p2) + ': ' + e.message; break; }
          allPs.push(p2);
          const kept = (q2 * q1 < 0) ? 'p\u2080 \u2190 p\u2081' : 'p\u2080 unchanged';
          const secantFn = (xv) => q1AtStep + (q1AtStep - q0AtStep) / (p1AtStep - p0AtStep) * (xv - p1AtStep);
          steps.push({ cells: [n, fmt(p2, 8), fmt(q2, 8), kept], p0: p0AtStep, p1: p1AtStep, p2, secantFn });
          pFinal = p2;
          if (Math.abs(p2 - p1) < tol) { converged = true; break; }
          if (q2 * q1 < 0) { p0 = p1; q0 = q1; }
          p1 = p2; q1 = q2;
        }

        if (failMsg) { resultArea.appendChild(errorBox(failMsg)); if (steps.length) resultArea.appendChild(stepsTable(null, ['n', 'p\u2099', 'f(p\u2099)', 'bracket'], steps.map(s => s.cells))); return; }

        const validPs = allPs.filter(Number.isFinite);
        const domMin = Math.min(...validPs), domMax = Math.max(...validPs);
        const domPad = (domMax - domMin) * 0.3 || 1;
        const xMin = domMin - domPad, xMax = domMax + domPad;
        steps.forEach(s => {
          s.plot = plotFunction({
            f, xMin, xMax,
            extraCurves: [{ f: s.secantFn, color: '#F4743B' }],
            shadeRegion: { x1: s.p0, x2: s.p1, color: '#13A0A6' },
            vlines: [{ x: s.p0, color: '#13A0A6', dash: '2,2', label: 'p\u2099\u208b\u2082' }, { x: s.p1, color: '#13A0A6', dash: '2,2', label: 'p\u2099\u208b\u2081' }],
            markers: [{ x: s.p2, y: f(s.p2), color: '#F4743B', label: 'p\u2099' }]
          });
        });

        resultArea.appendChild(stepPlayer({
          headers: ['n', 'p\u2099', 'f(p\u2099)', 'bracket'],
          steps,
          summaryFor: (shown) => {
            const atEnd = shown >= steps.length;
            if (atEnd) {
              return converged
                ? `<b>Converged.</b> Root p \u2248 ${fmt(pFinal, 8)} after ${steps.length} iteration${steps.length === 1 ? '' : 's'}.`
                : `<span class="fail">Did not converge</span> within ${maxN} iterations. Last estimate: p \u2248 ${fmt(pFinal, 8)}.`;
            }
            return `Step ${shown} of ${steps.length} \u2014 current estimate p\u2099 = ${steps[shown - 1].cells[1]}. Click <b>Next Step</b> to continue.`;
          }
        }));
      }

      container.appendChild(grid);
      container.appendChild(el('div', { class: 'btn-row' }, [
        el('button', { class: 'btn', text: 'Calculate', onclick: run })
      ]));
      container.appendChild(resultArea);
    }
  }
]);

/* ---------- Chapter 3: Interpolation ---------- */
registerChapter('ch3', 'Chapter 3 \u2014 Interpolation', [
  {
    id: 'lagrange',
    title: 'Lagrange Interpolation',
    eyebrow: 'CHAPTER 3 \u00b7 INTERPOLATION',
    intro: 'Build the unique polynomial through your data points as a weighted sum of basis polynomials \u2014 see each basis polynomial and the final P(x), fully expanded \u2014 then evaluate it anywhere.',
    formula: 'P(x) = \\sum_{k} f(x_k)\\,L_k(x), \\qquad L_k(x)=\\prod_{i\\neq k}\\frac{x-x_i}{x_k-x_i}',
    build(container) {
      const editor = nodesEditor([[1, 2], [2, 4], [3, 7]], { yLabel: 'f(x)' });
      const targetField = field('Evaluate P(x) at x =', { value: '2.5' });
      const resultArea = el('div', { class: 'result-area' });
      function subscript(k) { return ['\u2080', '\u2081', '\u2082', '\u2083', '\u2084', '\u2085', '\u2086', '\u2087', '\u2088', '\u2089'][k] || ('_' + k); }

      function run() {
        resultArea.innerHTML = '';
        const pts = editor.getPoints();
        if (pts.length < 2) { resultArea.appendChild(errorBox('Enter at least 2 data points.')); return; }
        const xs = pts.map(p => p[0]);
        if (new Set(xs).size !== xs.length) { resultArea.appendChild(errorBox('All x-values must be distinct.')); return; }
        const target = getNum(targetField);
        if (!Number.isFinite(target)) { resultArea.appendChild(errorBox('Target x must be a number.')); return; }

        // --- Build each L_k(x) as an expanded polynomial, and accumulate P(x) ---
        const Lpolys = [];
        let Ppoly = [0];
        pts.forEach((pt, k) => {
          const others = pts.filter((_, i) => i !== k).map(p => p[0]);
          let denom = 1;
          others.forEach(xi => denom *= (pt[0] - xi));
          const Lk = polyScale(polyFromRoots(others), 1 / denom);
          Lpolys.push(Lk);
          Ppoly = polyAdd(Ppoly, polyScale(Lk, pt[1]));
        });

        resultArea.appendChild(el('p', { class: 'tool-intro', html: '<b>Step 1 \u2014 the basis polynomials, fully expanded:</b>' }));
        pts.forEach((pt, k) => {
          const box = el('div', { class: 'tool-formula' });
          box.appendChild(katexEl('L_' + k + '(x) = ' + polyToLatex(Lpolys[k]), true));
          resultArea.appendChild(box);
        });

        resultArea.appendChild(el('p', { class: 'tool-intro', html: '<b>Step 2 \u2014 combine them into P(x):</b>' }));
        const pBox = el('div', { class: 'tool-formula' });
        pBox.appendChild(katexEl('P(x) = ' + polyToLatex(Ppoly), true));
        resultArea.appendChild(pBox);

        // --- Step 3: evaluate at the target using the basis polynomials ---
        const rows = pts.map((pt, k) => {
          const Lk_val = polyEval(Lpolys[k], target);
          return ['L' + subscript(k) + '(' + fmt(target, 4) + ')', fmt(Lk_val, 6), fmt(pt[1] * Lk_val, 6)];
        });
        const Pval = polyEval(Ppoly, target);

        resultArea.appendChild(el('p', { class: 'tool-intro', html: `<b>Step 3 \u2014 evaluate at x = ${fmt(target, 4)}:</b>` }));
        resultArea.appendChild(summaryBox(`<b>P(${fmt(target, 4)}) \u2248 ${fmt(Pval, 8)}</b>`));
        resultArea.appendChild(stepsTable(null, ['Quantity', 'L\u2096 value', 'f(x\u2096)\u00b7L\u2096'], rows));

        try {
          const xMin = Math.min(...xs, target), xMax = Math.max(...xs, target);
          const pad = (xMax - xMin) * 0.2 || 1;
          resultArea.appendChild(plotWrap(plotFunction({
            f: (xv) => polyEval(Ppoly, xv), xMin: xMin - pad, xMax: xMax + pad,
            markers: pts.map(p => ({ x: p[0], y: p[1], color: '#13A0A6' })).concat([{ x: target, y: Pval, color: '#F4743B', label: 'P(x)' }])
          })));
        } catch (e) { /* plotting optional */ }
      }

      container.appendChild(editor.element);
      container.appendChild(el('div', { class: 'field-grid' }, [targetField]));
      container.appendChild(el('div', { class: 'btn-row' }, [el('button', { class: 'btn', text: 'Calculate', onclick: run })]));
      container.appendChild(resultArea);
    }
  },
  {
    id: 'divideddiff',
    title: 'Divided Differences',
    eyebrow: 'CHAPTER 3 \u00b7 INTERPOLATION',
    intro: 'Build a triangular table from the data alone, giving a reusable Newton-form polynomial \u2014 see it fully expanded, then evaluate it at as many points as you like without rebuilding anything.',
    formula: 'P(x) = f[x_0] + \\sum_{k=1}^{n} f[x_0,\\dots,x_k]\\prod_{i=0}^{k-1}(x-x_i)',
    build(container) {
      const editor = nodesEditor([[2, 0.5], [2.75, 0.363636], [4, 0.25]], { yLabel: 'f(x)' });
      const targetField = field('Evaluate P(x) at x =', { value: '3' });
      const resultArea = el('div', { class: 'result-area' });

      function run() {
        resultArea.innerHTML = '';
        const pts = editor.getPoints();
        if (pts.length < 2) { resultArea.appendChild(errorBox('Enter at least 2 data points.')); return; }
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
        if (new Set(xs).size !== xs.length) { resultArea.appendChild(errorBox('All x-values must be distinct.')); return; }
        const target = getNum(targetField);
        if (!Number.isFinite(target)) { resultArea.appendChild(errorBox('Target x must be a number.')); return; }

        const n = xs.length;
        const table = Array.from({ length: n }, () => new Array(n).fill(null));
        for (let i = 0; i < n; i++) table[i][0] = ys[i];
        for (let j = 1; j < n; j++) {
          for (let i = j; i < n; i++) {
            table[i][j] = (table[i][j - 1] - table[i - 1][j - 1]) / (xs[i] - xs[i - j]);
          }
        }
        const coeffs = table.map((row, i) => row[i]);

        const rows = xs.map((x, i) => {
          const rowCells = [fmt(x, 6), fmt(table[i][0], 6)];
          for (let j = 1; j < n; j++) rowCells.push(i >= j ? fmt(table[i][j], 6) : '');
          return rowCells;
        });
        const headers = ['x\u1d62', 'f[x\u1d62]'];
        for (let j = 1; j < n; j++) headers.push('order ' + j);

        resultArea.appendChild(el('p', { class: 'tool-intro', html: '<b>Step 1 \u2014 the divided-difference table:</b>' }));
        resultArea.appendChild(stepsTable(null, headers, rows));

        // --- Build Newton's form as an expanded polynomial ---
        let Ppoly = [coeffs[0]];
        for (let k = 1; k < n; k++) {
          const term = polyScale(polyFromRoots(xs.slice(0, k)), coeffs[k]);
          Ppoly = polyAdd(Ppoly, term);
        }

        resultArea.appendChild(el('p', { class: 'tool-intro', html: '<b>Step 2 \u2014 Newton\u2019s form, then expanded into standard form:</b>' }));
        const newtonBox = el('div', { class: 'tool-formula' });
        const firstLine = el('div');
        firstLine.appendChild(katexEl('P(x) = f[x_0] = ' + numToClean(coeffs[0]), true));
        newtonBox.appendChild(firstLine);
        for (let k = 1; k < n; k++) {
          let prodStr = '';
          for (let i = 0; i < k; i++) prodStr += '(x-' + numToClean(xs[i]) + ')';
          const line = el('div');
          line.appendChild(katexEl('{}+ f[x_0,\\dots,x_' + k + ']' + prodStr + ' = ' + numToClean(coeffs[k]) + prodStr, true));
          newtonBox.appendChild(line);
        }
        resultArea.appendChild(newtonBox);
        const expandedBox = el('div', { class: 'tool-formula' });
        expandedBox.appendChild(katexEl('P(x) = ' + polyToLatex(Ppoly), true));
        resultArea.appendChild(expandedBox);

        const Pval = polyEval(Ppoly, target);
        resultArea.appendChild(el('p', { class: 'tool-intro', html: `<b>Step 3 \u2014 evaluate at x = ${fmt(target, 4)}:</b>` }));
        resultArea.appendChild(summaryBox(`<b>P(${fmt(target, 4)}) \u2248 ${fmt(Pval, 8)}</b>`));

        try {
          const xMin = Math.min(...xs, target), xMax = Math.max(...xs, target);
          const pad = (xMax - xMin) * 0.2 || 1;
          resultArea.appendChild(plotWrap(plotFunction({
            f: (xv) => polyEval(Ppoly, xv), xMin: xMin - pad, xMax: xMax + pad,
            markers: pts.map(p => ({ x: p[0], y: p[1], color: '#13A0A6' })).concat([{ x: target, y: Pval, color: '#F4743B', label: 'P(x)' }])
          })));
        } catch (e) { /* plotting optional */ }
      }

      container.appendChild(editor.element);
      container.appendChild(el('div', { class: 'field-grid' }, [targetField]));
      container.appendChild(el('div', { class: 'btn-row' }, [el('button', { class: 'btn', text: 'Calculate', onclick: run })]));
      container.appendChild(resultArea);
    }
  },
  {
    id: 'cubicspline',
    title: 'Natural Cubic Spline',
    eyebrow: 'CHAPTER 3 \u00b7 INTERPOLATION',
    intro: 'Instead of one polynomial through all the data, fit a separate cubic on each subinterval, matched up to two derivatives at every interior node.',
    formula: "S_i(x) = a_i + b_i(x-x_i) + c_i(x-x_i)^2 + d_i(x-x_i)^3",
    formulaNote: 'Natural boundary: c\u2080 = c\u2099 = 0.',
    build(container) {
      const editor = nodesEditor([[1, 2], [2, 4], [3, 7]], { yLabel: 'f(x)' });
      const targetField = field('Evaluate S(x) at x =', { value: '2.5' });
      const resultArea = el('div', { class: 'result-area' });

      function run() {
        resultArea.innerHTML = '';
        const pts = editor.getPoints().sort((p, q) => p[0] - q[0]);
        if (pts.length < 3) { resultArea.appendChild(errorBox('Enter at least 3 data points (a spline needs interior nodes).')); return; }
        const xs = pts.map(p => p[0]), a = pts.map(p => p[1]);
        if (new Set(xs).size !== xs.length) { resultArea.appendChild(errorBox('All x-values must be distinct.')); return; }
        const target = getNum(targetField);
        if (!Number.isFinite(target)) { resultArea.appendChild(errorBox('Target x must be a number.')); return; }
        if (target < xs[0] || target > xs[xs.length - 1]) { resultArea.appendChild(errorBox(`Target x must lie within [${fmt(xs[0], 4)}, ${fmt(xs[xs.length - 1], 4)}] \u2014 this is interpolation, not extrapolation.`)); return; }

        const n = xs.length - 1;
        const h = []; for (let i = 0; i < n; i++) h.push(xs[i + 1] - xs[i]);

        const alpha = new Array(n + 1).fill(0);
        for (let i = 1; i < n; i++) alpha[i] = 3 / h[i] * (a[i + 1] - a[i]) - 3 / h[i - 1] * (a[i] - a[i - 1]);

        const l = new Array(n + 1).fill(1), mu = new Array(n + 1).fill(0), z = new Array(n + 1).fill(0);
        for (let i = 1; i < n; i++) {
          l[i] = 2 * (xs[i + 1] - xs[i - 1]) - h[i - 1] * mu[i - 1];
          mu[i] = h[i] / l[i];
          z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
        }
        const c = new Array(n + 1).fill(0), b = new Array(n).fill(0), d = new Array(n).fill(0);
        for (let j = n - 1; j >= 0; j--) {
          c[j] = z[j] - mu[j] * c[j + 1];
          b[j] = (a[j + 1] - a[j]) / h[j] - h[j] * (c[j + 1] + 2 * c[j]) / 3;
          d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
        }

        const rows = [];
        for (let i = 0; i < n; i++) rows.push([i, fmt(a[i], 6), fmt(b[i], 6), fmt(c[i], 6), fmt(d[i], 6)]);

        resultArea.appendChild(el('p', { class: 'tool-intro', html: '<b>Step 1 \u2014 piecewise coefficients (in the (x \u2212 x\u1d62) form):</b>' }));
        resultArea.appendChild(stepsTable(null, ['piece i', 'a\u1d62', 'b\u1d62', 'c\u1d62', 'd\u1d62'], rows));

        resultArea.appendChild(el('p', { class: 'tool-intro', html: '<b>Step 2 \u2014 each piece, expanded into standard form:</b>' }));
        for (let i = 0; i < n; i++) {
          let piecePoly = [a[i]];
          piecePoly = polyAdd(piecePoly, polyScale(polyFromRoots([xs[i]]), b[i]));
          piecePoly = polyAdd(piecePoly, polyScale(polyFromRoots([xs[i], xs[i]]), c[i]));
          piecePoly = polyAdd(piecePoly, polyScale(polyFromRoots([xs[i], xs[i], xs[i]]), d[i]));
          const box = el('div', { class: 'tool-formula' });
          box.appendChild(katexEl(`S_${i}(x) = ` + polyToLatex(piecePoly) + `, \\quad x\\in[${numToClean(xs[i])}, ${numToClean(xs[i + 1])}]`, true));
          resultArea.appendChild(box);
        }

        let seg = 0;
        for (let i = 0; i < n; i++) { if (target >= xs[i] && target <= xs[i + 1]) { seg = i; break; } }
        const dx = target - xs[seg];
        const S = a[seg] + b[seg] * dx + c[seg] * dx * dx + d[seg] * dx * dx * dx;

        resultArea.appendChild(el('p', { class: 'tool-intro', html: `<b>Step 3 \u2014 evaluate at x = ${fmt(target, 4)}:</b>` }));
        resultArea.appendChild(summaryBox(`<b>S(${fmt(target, 4)}) \u2248 ${fmt(S, 8)}</b> (using piece ${seg}, on [${fmt(xs[seg], 4)}, ${fmt(xs[seg + 1], 4)}])`));

        try {
          const Sfun = (xv) => {
            let s2 = 0;
            for (let i = 0; i < n; i++) { if (xv >= xs[i] && xv <= xs[i + 1]) { s2 = i; break; } if (i === n - 1) s2 = n - 1; }
            const dxv = xv - xs[s2];
            return a[s2] + b[s2] * dxv + c[s2] * dxv * dxv + d[s2] * dxv * dxv * dxv;
          };
          resultArea.appendChild(plotWrap(plotFunction({
            f: Sfun, xMin: xs[0], xMax: xs[xs.length - 1],
            markers: pts.map(p => ({ x: p[0], y: p[1], color: '#13A0A6' })).concat([{ x: target, y: S, color: '#F4743B', label: 'S(x)' }])
          })));
        } catch (e) { /* optional */ }
      }

      container.appendChild(editor.element);
      container.appendChild(el('div', { class: 'field-grid' }, [targetField]));
      container.appendChild(el('div', { class: 'btn-row' }, [el('button', { class: 'btn', text: 'Calculate', onclick: run })]));
      container.appendChild(resultArea);
    }
  }
]);

/* ---------- Chapter 4: Differentiation & Integration ---------- */
registerChapter('ch4', 'Chapter 4 \u2014 Differentiation & Integration', [
  {
    id: 'numdiff',
    title: 'Numerical Differentiation',
    eyebrow: 'CHAPTER 4 \u00b7 DIFFERENTIATION & INTEGRATION',
    intro: 'Estimate f\u2019(x\u2080) and f\u2019\u2019(x\u2080) from a handful of function values, using forward, backward, midpoint, and second-derivative formulas side by side.',
    formula: "f'(x_0) \\approx \\frac{f(x_0+h)-f(x_0-h)}{2h} \\quad (\\text{midpoint}, O(h^2))",
    build(container) {
      const fField = field('f(x) =', { value: '1/x', wide: true });
      const x0Field = field('x\u2080', { value: '2' });
      const hField = field('h', { value: '0.5' });

      const grid = el('div', { class: 'field-grid' }, [fField, x0Field, hField]);
      const resultArea = el('div', { class: 'result-area' });

      function run() {
        resultArea.innerHTML = '';
        let f;
        try { f = makeF1(getVal(fField)); } catch (e) { resultArea.appendChild(errorBox('Could not parse f(x): ' + e.message)); return; }
        const x0 = getNum(x0Field), h = getNum(hField);
        if (!Number.isFinite(x0) || !Number.isFinite(h) || h === 0) { resultArea.appendChild(errorBox('x\u2080 and h must be numbers, and h cannot be 0.')); return; }

        let fMinus, f0, fPlus;
        try { fMinus = f(x0 - h); f0 = f(x0); fPlus = f(x0 + h); }
        catch (e) { resultArea.appendChild(errorBox('f(x) could not be evaluated near x\u2080: ' + e.message)); return; }

        const forward = (fPlus - f0) / h;
        const backward = (f0 - fMinus) / h;
        const midpoint = (fPlus - fMinus) / (2 * h);
        const secondDeriv = (fMinus - 2 * f0 + fPlus) / (h * h);

        resultArea.appendChild(summaryBox(
          `Using f(x\u2080\u2212h)=${fmt(fMinus, 6)}, f(x\u2080)=${fmt(f0, 6)}, f(x\u2080+h)=${fmt(fPlus, 6)}`
        ));
        resultArea.appendChild(stepsTable(null, ['Formula', 'Order', 'Estimate'], [
          ['Forward difference', 'O(h)', fmt(forward, 8)],
          ['Backward difference', 'O(h)', fmt(backward, 8)],
          ['Midpoint (centered)', 'O(h\u00b2)', fmt(midpoint, 8)],
          ["f''(x\u2080), midpoint", 'O(h\u00b2)', fmt(secondDeriv, 8)]
        ]));
      }

      container.appendChild(grid);
      container.appendChild(el('div', { class: 'btn-row' }, [el('button', { class: 'btn', text: 'Calculate', onclick: run })]));
      container.appendChild(resultArea);
    }
  },
  {
    id: 'richardson',
    title: "Richardson's Extrapolation",
    eyebrow: 'CHAPTER 4 \u00b7 DIFFERENTIATION & INTEGRATION',
    intro: 'Combine two O(h\u00b2) midpoint-derivative estimates \u2014 at h and h/2 \u2014 to cancel the leading error term and get an O(h\u2074) result, for free.',
    formula: 'N_2(h) = \\dfrac{4N_1(h/2) - N_1(h)}{3}',
    build(container) {
      const fField = field('f(x) =', { value: '1/x', wide: true });
      const x0Field = field('x\u2080', { value: '2' });
      const hField = field('h', { value: '0.5' });

      const grid = el('div', { class: 'field-grid' }, [fField, x0Field, hField]);
      const resultArea = el('div', { class: 'result-area' });

      function midpointDiff(f, x0, h) { return (f(x0 + h) - f(x0 - h)) / (2 * h); }

      function run() {
        resultArea.innerHTML = '';
        let f;
        try { f = makeF1(getVal(fField)); } catch (e) { resultArea.appendChild(errorBox('Could not parse f(x): ' + e.message)); return; }
        const x0 = getNum(x0Field), h = getNum(hField);
        if (!Number.isFinite(x0) || !Number.isFinite(h) || h === 0) { resultArea.appendChild(errorBox('x\u2080 and h must be numbers, and h cannot be 0.')); return; }

        let N1_h, N1_h2;
        try { N1_h = midpointDiff(f, x0, h); N1_h2 = midpointDiff(f, x0, h / 2); }
        catch (e) { resultArea.appendChild(errorBox('f(x) could not be evaluated: ' + e.message)); return; }
        const N2 = (4 * N1_h2 - N1_h) / 3;

        resultArea.appendChild(summaryBox(`<b>N\u2082(h) \u2248 ${fmt(N2, 10)}</b>`));
        resultArea.appendChild(stepsTable(null, ['Quantity', 'Value'], [
          ['N\u2081(h) = midpoint at h', fmt(N1_h, 10)],
          ['N\u2081(h/2) = midpoint at h/2', fmt(N1_h2, 10)],
          ['N\u2082(h) = extrapolated', fmt(N2, 10)]
        ]));
      }

      container.appendChild(grid);
      container.appendChild(el('div', { class: 'btn-row' }, [el('button', { class: 'btn', text: 'Calculate', onclick: run })]));
      container.appendChild(resultArea);
    }
  },
  {
    id: 'integration',
    title: 'Trapezoidal & Simpson\u2019s Rule (Composite)',
    eyebrow: 'CHAPTER 4 \u00b7 DIFFERENTIATION & INTEGRATION',
    intro: 'Split [a,b] into n subintervals and apply the Trapezoidal or Simpson\u2019s Rule on each piece. Use n=1 (Trapezoidal) or n=2 (Simpson\u2019s) for the plain single-interval rule.',
    formula: "\\int_a^b f(x)\\,dx \\approx \\frac{h}{3}\\Big[f(x_0)+4\\!\\!\\sum_{\\text{odd}}f(x_j)+2\\!\\!\\sum_{\\text{even}}f(x_j)+f(x_n)\\Big]",
    build(container) {
      const fField = field('f(x) =', { value: '1/x', wide: true });
      const aField = field('a', { value: '2' });
      const bField = field('b', { value: '4' });
      const nField = field('n (subintervals)', { value: '4' }, 'Simpson\u2019s requires n to be even.');

      const grid = el('div', { class: 'field-grid' }, [fField, aField, bField, nField]);
      const resultArea = el('div', { class: 'result-area' });

      function run() {
        resultArea.innerHTML = '';
        let f;
        try { f = makeF1(getVal(fField)); } catch (e) { resultArea.appendChild(errorBox('Could not parse f(x): ' + e.message)); return; }
        const a = getNum(aField), b = getNum(bField), n = getInt(nField);
        if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b) { resultArea.appendChild(errorBox('Need a < b, both numbers.')); return; }
        if (!Number.isInteger(n) || n < 1) { resultArea.appendChild(errorBox('n must be a positive integer.')); return; }

        const h = (b - a) / n;
        const xs = []; for (let i = 0; i <= n; i++) xs.push(a + i * h);
        let fs;
        try { fs = xs.map(f); } catch (e) { resultArea.appendChild(errorBox('f(x) could not be evaluated on [a,b]: ' + e.message)); return; }

        let trapSum = fs[0] + fs[n];
        for (let i = 1; i < n; i++) trapSum += 2 * fs[i];
        const trap = h / 2 * trapSum;

        const rows = [['Composite Trapezoidal', fmt(trap, 8)]];

        if (n % 2 === 0) {
          let simpSum = fs[0] + fs[n];
          for (let i = 1; i < n; i++) simpSum += (i % 2 === 1 ? 4 : 2) * fs[i];
          const simp = h / 3 * simpSum;
          rows.push(['Composite Simpson\u2019s', fmt(simp, 8)]);
        }

        resultArea.appendChild(summaryBox(`h = ${fmt(h, 6)}, nodes: ${xs.map(x => fmt(x, 4)).join(', ')}`));
        resultArea.appendChild(stepsTable(null, ['Rule', 'Estimate'], rows));
        if (n % 2 !== 0) resultArea.appendChild(errorBox('n is odd \u2014 Simpson\u2019s Rule needs an even number of subintervals, so only Trapezoidal is shown above.'));

        try {
          resultArea.appendChild(plotWrap(plotFunction({
            f, xMin: a - (b - a) * 0.1, xMax: b + (b - a) * 0.1,
            markers: xs.map(x => ({ x, y: f(x), color: '#13A0A6' }))
          })));
        } catch (e) { /* optional */ }
      }

      container.appendChild(grid);
      container.appendChild(el('div', { class: 'btn-row' }, [el('button', { class: 'btn', text: 'Calculate', onclick: run })]));
      container.appendChild(resultArea);
    }
  },
  {
    id: 'gaussquad',
    title: 'Gaussian Quadrature',
    eyebrow: 'CHAPTER 4 \u00b7 DIFFERENTIATION & INTEGRATION',
    intro: 'Optimize node locations, not just weights. The 2- and 3-point rules reach degree of precision 3 and 5 respectively \u2014 more accuracy per evaluation than Simpson\u2019s.',
    formula: '\\int_a^b f(x)\\,dx \\approx \\frac{b-a}{2}\\sum_i c_i\\, f\\!\\left(\\frac{b-a}{2}t_i+\\frac{a+b}{2}\\right)',
    build(container) {
      const fField = field('f(x) =', { value: '1/x', wide: true });
      const aField = field('a', { value: '2' });
      const bField = field('b', { value: '4' });
      const nSelect = el('select', {}, [
        el('option', { value: '2', text: '2-point' }),
        el('option', { value: '3', text: '3-point' })
      ]);
      const nWrap = el('div', { class: 'field' }, [el('label', { text: 'Rule' }), nSelect]);

      const grid = el('div', { class: 'field-grid' }, [fField, aField, bField, nWrap]);
      const resultArea = el('div', { class: 'result-area' });

      const NODES = {
        2: { t: [-1 / Math.sqrt(3), 1 / Math.sqrt(3)], c: [1, 1] },
        3: { t: [0, -Math.sqrt(3 / 5), Math.sqrt(3 / 5)], c: [8 / 9, 5 / 9, 5 / 9] }
      };

      function run() {
        resultArea.innerHTML = '';
        let f;
        try { f = makeF1(getVal(fField)); } catch (e) { resultArea.appendChild(errorBox('Could not parse f(x): ' + e.message)); return; }
        const a = getNum(aField), b = getNum(bField);
        if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b) { resultArea.appendChild(errorBox('Need a < b, both numbers.')); return; }

        const rule = NODES[nSelect.value];
        const rows = [];
        let total = 0;
        for (let i = 0; i < rule.t.length; i++) {
          const x = (b - a) / 2 * rule.t[i] + (a + b) / 2;
          let fx;
          try { fx = f(x); } catch (e) { resultArea.appendChild(errorBox('f(x) could not be evaluated at x=' + fmt(x) + ': ' + e.message)); return; }
          total += rule.c[i] * fx;
          rows.push([i + 1, fmt(rule.t[i], 6), fmt(x, 6), fmt(rule.c[i], 6), fmt(fx, 6)]);
        }
        const result = (b - a) / 2 * total;

        resultArea.appendChild(summaryBox(`<b>Estimate \u2248 ${fmt(result, 8)}</b>`));
        resultArea.appendChild(stepsTable(null, ['i', 't\u1d62', 'x\u1d62 (transformed)', 'c\u1d62', 'f(x\u1d62)'], rows));
      }

      container.appendChild(grid);
      container.appendChild(el('div', { class: 'btn-row' }, [el('button', { class: 'btn', text: 'Calculate', onclick: run })]));
      container.appendChild(resultArea);
    }
  }
]);

/* ---------- Chapter 5: ODEs ---------- */
registerChapter('ch5', 'Chapter 5 \u2014 Initial-Value Problems', [
  {
    id: 'euler',
    title: "Euler's Method",
    eyebrow: 'CHAPTER 5 \u00b7 INITIAL-VALUE PROBLEMS',
    intro: 'March forward in steps of size h, following the current tangent line at every point. Cheap, but only O(h) accurate.',
    formula: 'w_0 = y_0, \\qquad w_{i+1} = w_i + h\\,f(t_i, w_i)',
    build(container) {
      const fField = field('f(t, y) =', { value: 'y - t^2 + 1', wide: true }, 'Use t and y as variables.');
      const t0Field = field('t\u2080', { value: '0' });
      const y0Field = field('y\u2080', { value: '0.5' });
      const bField = field('stop at t =', { value: '2' });
      const hField = field('step size h', { value: '0.5' });

      const grid = el('div', { class: 'field-grid' }, [fField, t0Field, y0Field, bField, hField]);
      const resultArea = el('div', { class: 'result-area' });

      function run() {
        resultArea.innerHTML = '';
        let f;
        try { f = makeF2(getVal(fField), 't', 'y'); } catch (e) { resultArea.appendChild(errorBox('Could not parse f(t,y): ' + e.message)); return; }
        const t0 = getNum(t0Field), y0 = getNum(y0Field), b = getNum(bField), h = getNum(hField);
        if (![t0, y0, b, h].every(Number.isFinite) || h <= 0 || b <= t0) { resultArea.appendChild(errorBox('Check that t\u2080 < stop time, and h > 0.')); return; }

        const N = Math.round((b - t0) / h);
        let t = t0, w = y0;
        const rows = [[0, fmt(t, 4), fmt(w, 6)]];
        for (let i = 1; i <= N; i++) {
          let slope;
          try { slope = f(t, w); } catch (e) { resultArea.appendChild(errorBox('f(t,y) failed at t=' + fmt(t) + ', y=' + fmt(w) + ': ' + e.message)); return; }
          w = w + h * slope;
          t = t + h;
          rows.push([i, fmt(t, 4), fmt(w, 6)]);
        }

        resultArea.appendChild(summaryBox(`<b>w(${fmt(t, 4)}) \u2248 ${fmt(w, 8)}</b> after ${N} step${N === 1 ? '' : 's'} of size h=${fmt(h, 4)}.`));
        resultArea.appendChild(stepsTable(null, ['i', 't\u1d62', 'w\u1d62'], rows, { highlightLast: true }));
      }

      container.appendChild(grid);
      container.appendChild(el('div', { class: 'btn-row' }, [el('button', { class: 'btn', text: 'Calculate', onclick: run })]));
      container.appendChild(resultArea);
    }
  },
  {
    id: 'rk4',
    title: 'Runge\u2013Kutta (RK4)',
    eyebrow: 'CHAPTER 5 \u00b7 INITIAL-VALUE PROBLEMS',
    intro: 'Match Taylor\u2019s order-4 accuracy using only function evaluations \u2014 no derivatives of f required. The standard general-purpose ODE method.',
    formula: 'w_{i+1} = w_i + \\frac{h}{6}(k_1+2k_2+2k_3+k_4)',
    build(container) {
      const fField = field('f(t, y) =', { value: 'y - t^2 + 1', wide: true }, 'Use t and y as variables.');
      const t0Field = field('t\u2080', { value: '0' });
      const y0Field = field('y\u2080', { value: '0.5' });
      const bField = field('stop at t =', { value: '2' });
      const hField = field('step size h', { value: '0.5' });

      const grid = el('div', { class: 'field-grid' }, [fField, t0Field, y0Field, bField, hField]);
      const resultArea = el('div', { class: 'result-area' });

      function run() {
        resultArea.innerHTML = '';
        let f;
        try { f = makeF2(getVal(fField), 't', 'y'); } catch (e) { resultArea.appendChild(errorBox('Could not parse f(t,y): ' + e.message)); return; }
        const t0 = getNum(t0Field), y0 = getNum(y0Field), b = getNum(bField), h = getNum(hField);
        if (![t0, y0, b, h].every(Number.isFinite) || h <= 0 || b <= t0) { resultArea.appendChild(errorBox('Check that t\u2080 < stop time, and h > 0.')); return; }

        const N = Math.round((b - t0) / h);
        let t = t0, w = y0;
        const rows = [[0, fmt(t, 4), fmt(w, 8)]];
        try {
          for (let i = 1; i <= N; i++) {
            const k1 = f(t, w);
            const k2 = f(t + h / 2, w + h / 2 * k1);
            const k3 = f(t + h / 2, w + h / 2 * k2);
            const k4 = f(t + h, w + h * k3);
            w = w + h / 6 * (k1 + 2 * k2 + 2 * k3 + k4);
            t = t + h;
            rows.push([i, fmt(t, 4), fmt(w, 8)]);
          }
        } catch (e) { resultArea.appendChild(errorBox('f(t,y) could not be evaluated: ' + e.message)); return; }

        resultArea.appendChild(summaryBox(`<b>w(${fmt(t, 4)}) \u2248 ${fmt(w, 8)}</b> after ${N} step${N === 1 ? '' : 's'} of size h=${fmt(h, 4)}.`));
        resultArea.appendChild(stepsTable(null, ['i', 't\u1d62', 'w\u1d62'], rows, { highlightLast: true }));
      }

      container.appendChild(grid);
      container.appendChild(el('div', { class: 'btn-row' }, [el('button', { class: 'btn', text: 'Calculate', onclick: run })]));
      container.appendChild(resultArea);
    }
  }
]);

/* ---------- shared: render an augmented matrix as a small table ---------- */
function augMatrixTable(M, caption) {
  const n = M.length;
  const headers = [];
  for (let j = 0; j < n; j++) headers.push('col ' + (j + 1));
  headers.push('b');
  const rows = M.map(row => row.map(v => fmt(v, 5)));
  return stepsTable(caption || null, headers, rows);
}

/* ---------- Chapter 6: Linear Systems ---------- */
registerChapter('ch6', 'Chapter 6 \u2014 Linear Systems', [
  {
    id: 'gauss-elim',
    title: 'Gaussian Elimination',
    eyebrow: 'CHAPTER 6 \u00b7 DIRECT METHODS',
    intro: 'Reduce Ax=b to upper-triangular form using row operations, then solve by back substitution. Toggle partial pivoting to see how it changes the pivot order.',
    formula: 'm_{ik} = \\dfrac{a_{ik}}{a_{kk}}, \\qquad \\text{Row}_i \\gets \\text{Row}_i - m_{ik}\\cdot\\text{Row}_k',
    build(container) {
      let sizeSel = el('select', {}, [
        el('option', { value: '2', text: '2 \u00d7 2' }),
        el('option', { value: '3', text: '3 \u00d7 3', selected: 'selected' }),
        el('option', { value: '4', text: '4 \u00d7 4' })
      ]);
      const sizeWrap = el('div', { class: 'field' }, [el('label', { text: 'System size' }), sizeSel]);
      const pivotChk = el('input', { type: 'checkbox', checked: 'checked', style: 'width:auto;' });
      const pivotWrap = el('div', { class: 'field' }, [el('label', { text: 'Use partial pivoting' }), pivotChk]);

      const editorHost = el('div');
      let editor = systemEditor([[1, 1, 1], [2, -1, 1], [1, 2, -1]], [6, 3, 2]);
      editorHost.appendChild(editor.element);

      const resultArea = el('div', { class: 'result-area' });

      sizeSel.addEventListener('change', () => {
        const n = parseInt(sizeSel.value, 10);
        const rebuilt = resizeSystemEditor(editorHost, n, editor.getSystem);
        editorHost.innerHTML = '';
        editor = systemEditor(rebuilt.A, rebuilt.b);
        editorHost.appendChild(editor.element);
        resultArea.innerHTML = '';
      });

      function run() {
        resultArea.innerHTML = '';
        const { A, b, n } = editor.getSystem();
        for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) if (!Number.isFinite(A[i][j])) { resultArea.appendChild(errorBox('All matrix entries must be numbers.')); return; } if (!Number.isFinite(b[i])) { resultArea.appendChild(errorBox('All b entries must be numbers.')); return; } }

        const M = A.map((row, i) => row.concat([b[i]]));
        const usePivot = pivotChk.checked;
        const snapshots = [];

        for (let k = 0; k < n - 1; k++) {
          if (usePivot) {
            let p = k, best = Math.abs(M[k][k]);
            for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > best) { best = Math.abs(M[i][k]); p = i; }
            if (p !== k) { const tmp = M[k]; M[k] = M[p]; M[p] = tmp; snapshots.push({ note: `Swap Row ${k + 1} \u2194 Row ${p + 1} (largest pivot candidate)`, M: M.map(r => r.slice()) }); }
          }
          if (M[k][k] === 0) { resultArea.appendChild(errorBox(`Pivot a\u2096\u2096 = 0 at step ${k + 1} and no nonzero candidate is available below it \u2014 elimination cannot continue${usePivot ? '' : '. Try enabling partial pivoting.'}.`)); return; }
          for (let i = k + 1; i < n; i++) {
            const m = M[i][k] / M[k][k];
            if (m === 0) continue;
            for (let j = k; j <= n; j++) M[i][j] -= m * M[k][j];
          }
          snapshots.push({ note: `After eliminating column ${k + 1}`, M: M.map(r => r.slice()) });
        }

        if (M[n - 1][n - 1] === 0) { resultArea.appendChild(errorBox('The system is singular (a zero pivot remains after elimination) \u2014 there is no unique solution.')); return; }

        const x = new Array(n).fill(0);
        x[n - 1] = M[n - 1][n] / M[n - 1][n - 1];
        for (let i = n - 2; i >= 0; i--) {
          let s = M[i][n];
          for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
          x[i] = s / M[i][i];
        }

        resultArea.appendChild(summaryBox('<b>Solution:</b> ' + x.map((xi, i) => 'x' + (i + 1) + ' = ' + fmt(xi, 6)).join(',  ')));
        snapshots.forEach(s => resultArea.appendChild(augMatrixTable(s.M, s.note)));
      }

      container.appendChild(el('div', { class: 'field-grid' }, [sizeWrap, pivotWrap]));
      container.appendChild(editorHost);
      container.appendChild(el('div', { class: 'btn-row' }, [el('button', { class: 'btn', text: 'Calculate', onclick: run })]));
      container.appendChild(resultArea);
    }
  }
]);

/* ---------- Chapter 7: Iterative Matrix Algebra ---------- */
registerChapter('ch7', 'Chapter 7 \u2014 Iterative Matrix Algebra', [
  {
    id: 'norms',
    title: 'Vector & Matrix Norms',
    eyebrow: 'CHAPTER 7 \u00b7 ITERATIVE TECHNIQUES',
    intro: 'Measure the size of a vector, or the largest a matrix can stretch a unit vector \u2014 the tool used throughout this chapter to talk about convergence.',
    formula: "\\|x\\|_2=\\Big(\\sum x_i^2\\Big)^{1/2}, \\quad \\|x\\|_\\infty=\\max_i|x_i|, \\quad \\|A\\|_\\infty=\\max_i\\sum_j|a_{ij}|",
    build(container) {
      const vecField = field('Vector (comma-separated)', { value: '3, -4, 0', wide: true });
      const resultArea = el('div', { class: 'result-area' });
      const vecBtn = el('button', { class: 'btn', text: 'Compute vector norms', onclick: runVec });

      function runVec() {
        resultArea.innerHTML = '';
        const parts = getVal(vecField).split(',').map(s => parseFloat(s.trim()));
        if (parts.some(v => !Number.isFinite(v)) || parts.length === 0) { resultArea.appendChild(errorBox('Enter numbers separated by commas, e.g. 3, -4, 0')); return; }
        const norm2 = Math.sqrt(parts.reduce((s, v) => s + v * v, 0));
        const normInf = Math.max(...parts.map(Math.abs));
        resultArea.appendChild(stepsTable(null, ['Norm', 'Value'], [
          ['\u2016x\u2016\u2082 (Euclidean)', fmt(norm2, 6)],
          ['\u2016x\u2016\u221e (max)', fmt(normInf, 6)]
        ]));
      }

      container.appendChild(el('div', { class: 'field-grid' }, [vecField]));
      container.appendChild(el('div', { class: 'btn-row' }, [vecBtn]));
      container.appendChild(resultArea);

      container.appendChild(el('div', { html: '<hr style="border:none;border-top:1px solid var(--line);margin:8px 0 22px;">' }));

      let editor = systemEditor([[1, 2, -1], [0, 3, -1], [5, -1, 1]], [0, 0, 0]);
      const matResult = el('div', { class: 'result-area' });
      function runMat() {
        matResult.innerHTML = '';
        const { A, n } = editor.getSystem();
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (!Number.isFinite(A[i][j])) { matResult.appendChild(errorBox('All matrix entries must be numbers.')); return; }
        const rowSums = A.map(row => row.reduce((s, v) => s + Math.abs(v), 0));
        matResult.appendChild(summaryBox(`<b>\u2016A\u2016\u221e = ${fmt(Math.max(...rowSums), 6)}</b> (largest row sum)`));
        matResult.appendChild(stepsTable(null, ['Row', 'Absolute row sum'], rowSums.map((s, i) => [i + 1, fmt(s, 6)])));
      }
      container.appendChild(el('p', { class: 'tool-intro', html: '<b>Matrix norm</b> (ignore the b-column below \u2014 it isn\u2019t used here):' }));
      container.appendChild(editor.element);
      container.appendChild(el('div', { class: 'btn-row' }, [el('button', { class: 'btn', text: 'Compute \u2016A\u2016\u221e', onclick: runMat })]));
      container.appendChild(matResult);
    }
  },
  {
    id: 'jacobi-gs',
    title: 'Jacobi & Gauss\u2013Seidel',
    eyebrow: 'CHAPTER 7 \u00b7 ITERATIVE TECHNIQUES',
    intro: 'Solve Ax=b by repeatedly isolating x\u1d62 in equation i. Jacobi uses only old values; Gauss\u2013Seidel uses the newest values immediately. Both are guaranteed to converge if A is strictly diagonally dominant.',
    formula: "x_i^{(k)} = \\frac{1}{a_{ii}}\\Big(b_i - \\sum_{j\\neq i} a_{ij}x_j^{(\\cdot)}\\Big)",
    build(container) {
      let sizeSel = el('select', {}, [
        el('option', { value: '2', text: '2 \u00d7 2' }),
        el('option', { value: '3', text: '3 \u00d7 3', selected: 'selected' }),
        el('option', { value: '4', text: '4 \u00d7 4' })
      ]);
      const sizeWrap = el('div', { class: 'field' }, [el('label', { text: 'System size' }), sizeSel]);
      const methodSel = el('select', {}, [
        el('option', { value: 'jacobi', text: 'Jacobi' }),
        el('option', { value: 'gs', text: 'Gauss\u2013Seidel' })
      ]);
      const methodWrap = el('div', { class: 'field' }, [el('label', { text: 'Method' }), methodSel]);
      const tolField = field('tolerance', { value: '1e-4' });
      const nField = field('max iterations', { value: '15' });

      const editorHost = el('div');
      let editor = systemEditor([[10, -1, 2], [1, 8, -3], [2, 1, 9]], [6, -4, 12]);
      editorHost.appendChild(editor.element);

      const resultArea = el('div', { class: 'result-area' });

      sizeSel.addEventListener('change', () => {
        const n = parseInt(sizeSel.value, 10);
        const rebuilt = resizeSystemEditor(editorHost, n, editor.getSystem);
        editorHost.innerHTML = '';
        editor = systemEditor(rebuilt.A, rebuilt.b);
        editorHost.appendChild(editor.element);
        resultArea.innerHTML = '';
      });

      function run() {
        resultArea.innerHTML = '';
        const { A, b, n } = editor.getSystem();
        for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) if (!Number.isFinite(A[i][j])) { resultArea.appendChild(errorBox('All matrix entries must be numbers.')); return; } if (!Number.isFinite(b[i])) { resultArea.appendChild(errorBox('All b entries must be numbers.')); return; } if (A[i][i] === 0) { resultArea.appendChild(errorBox(`a\u2091\u2091 = 0 on the diagonal (row ${i + 1}) \u2014 these formulas divide by the diagonal entry and cannot proceed.`)); return; } }

        let dominant = true;
        for (let i = 0; i < n; i++) {
          const diag = Math.abs(A[i][i]);
          const off = A[i].reduce((s, v, j) => j === i ? s : s + Math.abs(v), 0);
          if (diag <= off) dominant = false;
        }

        const tol = getNum(tolField), maxN = getInt(nField);
        const useGS = methodSel.value === 'gs';
        let x = new Array(n).fill(0);
        const steps = [];
        let converged = false, divergeMsg = null;

        for (let k = 1; k <= maxN; k++) {
          const xOld = x.slice();
          const xNew = useGS ? x : x.slice();
          for (let i = 0; i < n; i++) {
            let s = b[i];
            for (let j = 0; j < n; j++) { if (j === i) continue; s -= A[i][j] * (useGS ? xNew[j] : xOld[j]); }
            xNew[i] = s / A[i][i];
          }
          x = xNew;
          const diff = Math.max(...x.map((v, i) => Math.abs(v - xOld[i])));
          steps.push({ cells: [k, ...x.map(v => fmt(v, 6))], diff });
          if (diff < tol) { converged = true; break; }
          if (x.some(v => Math.abs(v) > 1e8)) { divergeMsg = `Diverging \u2014 values exceeded 1e8 by iteration ${k}.`; break; }
        }

        if (divergeMsg) { resultArea.appendChild(errorBox(divergeMsg)); resultArea.appendChild(stepsTable(null, ['k'].concat(x.map((_, i) => 'x' + (i + 1) + '\u207d\u1d4f\u207e')), steps.map(s => s.cells))); return; }

        steps.forEach((s, idx) => {
          s.plot = plotSeries({
            points: steps.slice(0, idx + 1).map((st, i) => ({ k: i + 1, v: st.diff })),
            logScale: true,
            color: useGS ? '#13A0A6' : '#0B2545'
          });
        });

        resultArea.appendChild(stepPlayer({
          headers: ['k'].concat(x.map((_, i) => 'x' + (i + 1) + '\u207d\u1d4f\u207e')),
          steps,
          summaryFor: (shown) => {
            const domMsg = dominant ? '<b>A is strictly diagonally dominant</b> \u2014 convergence is guaranteed.' : '<span class="fail">A is not strictly diagonally dominant</span> \u2014 convergence is not guaranteed by this test (it may still converge).';
            const atEnd = shown >= steps.length;
            if (atEnd) return domMsg + '<br>' + (converged ? `<b>Converged</b> after ${steps.length} iterations.` : `<span class="fail">Did not reach tolerance</span> within ${maxN} iterations.`);
            return domMsg + `<br>Step ${shown} of ${steps.length} \u2014 largest change so far: ${fmt(steps[shown - 1].diff, 6)}. Click <b>Next Step</b> to continue.`;
          }
        }));
      }

      container.appendChild(el('div', { class: 'field-grid' }, [sizeWrap, methodWrap, tolField, nField]));
      container.appendChild(editorHost);
      container.appendChild(el('div', { class: 'btn-row' }, [el('button', { class: 'btn', text: 'Calculate', onclick: run })]));
      container.appendChild(resultArea);
    }
  }
]);

/* ============================================================
   NAVIGATION + APP SHELL
   ============================================================ */
let activeToolId = null;

function toolKey(chId, toolId) { return chId + '/' + toolId; }

function renderNav() {
  const nav = document.getElementById('nav');
  nav.innerHTML = '';
  CHAPTERS.forEach(ch => {
    const block = el('div', { class: 'nav-chapter' });
    block.appendChild(el('div', { class: 'nav-chapter-title', text: ch.title }));
    ch.tools.forEach(tool => {
      const btn = el('button', {
        class: 'nav-item',
        id: 'nav-' + toolKey(ch.id, tool.id),
        text: tool.title,
        onclick: () => showTool(ch, tool)
      });
      block.appendChild(btn);
    });
    nav.appendChild(block);
  });
}

function showTool(ch, tool) {
  activeToolId = toolKey(ch.id, tool.id);
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navBtn = document.getElementById('nav-' + activeToolId);
  if (navBtn) navBtn.classList.add('active');

  const main = document.getElementById('main');
  main.innerHTML = '';
  main.appendChild(el('p', { class: 'tool-eyebrow', text: tool.eyebrow || ch.title.toUpperCase() }));
  main.appendChild(el('h2', { class: 'tool-title', text: tool.title }));
  if (tool.intro) main.appendChild(el('p', { class: 'tool-intro', text: tool.intro }));
  if (tool.formula) {
    const fbox = el('div', { class: 'tool-formula' });
    fbox.appendChild(katexEl(tool.formula, true));
    if (tool.formulaNote) fbox.appendChild(el('div', { class: 'note', text: tool.formulaNote }));
    main.appendChild(fbox);
  }
  const body = el('div', { class: 'tool-body' });
  main.appendChild(body);
  tool.build(body);

  main.appendChild(el('footer', { class: 'appfoot', text: 'Numerical Analysis \u2014 Zarqa University. Built to accompany the course slides, chapter by chapter.' }));

  // close mobile nav after selection
  document.getElementById('nav').classList.remove('open');
  window.scrollTo(0, 0);
}

function renderHome() {
  const main = document.getElementById('main');
  main.innerHTML = '';
  main.appendChild(el('p', { class: 'tool-eyebrow', text: 'NUMERICAL ANALYSIS \u00b7 ZARQA UNIVERSITY' }));
  main.appendChild(el('h2', { class: 'tool-title', text: 'Pick a method to get started' }));
  main.appendChild(el('p', { class: 'tool-intro', text: 'Every calculator below mirrors the course slides: enter your own function, interval, or data, and see every iteration \u2014 not just the final answer.' }));
  const grid = el('div', { class: 'home-grid' });
  CHAPTERS.forEach(ch => {
    ch.tools.forEach(tool => {
      grid.appendChild(el('div', {
        class: 'home-card',
        onclick: () => showTool(ch, tool)
      }, [
        el('div', { class: 'n', text: ch.title }),
        el('h3', { text: tool.title })
      ]));
    });
  });
  main.appendChild(grid);
}

document.addEventListener('DOMContentLoaded', () => {
  renderNav();
  renderHome();
  document.getElementById('navToggle').addEventListener('click', () => {
    document.getElementById('nav').classList.toggle('open');
  });
});

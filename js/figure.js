/* ميزان — stick-figure renderer with SMIL animation between two poses. */
(function (root) {
  'use strict';
  const M = (root.M = root.M || {});

  const pt = (a, i) => `${a[i]},${a[i + 1]}`;
  // index map in the 22-number pose array
  const H = 0, N = 2, E1 = 4, W1 = 6, E2 = 8, W2 = 10, P = 12, K1 = 14, F1 = 16, K2 = 18, F2 = 20;
  const parts = (a) => ({
    torso: `${pt(a, N)} ${pt(a, P)}`,
    arm1: `${pt(a, N)} ${pt(a, E1)} ${pt(a, W1)}`,
    arm2: `${pt(a, N)} ${pt(a, E2)} ${pt(a, W2)}`,
    leg1: `${pt(a, P)} ${pt(a, K1)} ${pt(a, F1)}`,
    leg2: `${pt(a, P)} ${pt(a, K2)} ${pt(a, F2)}`
  });

  function figure(ex, opts = {}) {
    const a = ex.a, b = ex.b || ex.a;
    const animate = opts.animate !== false && b !== a;
    const dur = opts.dur || 2.4;
    const A = parts(a), B = parts(b);
    const anim = (attr, va, vb) => animate && va !== vb
      ? `<animate attributeName="${attr}" values="${va};${vb};${va}" dur="${dur}s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines=".45 0 .55 1;.45 0 .55 1"/>`
      : '';
    const line = (k, cls) => `<polyline class="${cls}" points="${A[k]}">${anim('points', A[k], B[k])}</polyline>`;
    let props = '';
    for (const pr of ex.props || []) {
      if (pr.box) props += `<rect class="fig-prop" x="${pr.box[0]}" y="${pr.box[1]}" width="${pr.box[2]}" height="${pr.box[3]}" rx="2"/>`;
      if (pr.bench) props += `<rect class="fig-prop" x="${pr.bench[0]}" y="${pr.bench[1]}" width="${pr.bench[2]}" height="${pr.bench[3]}" rx="2"/><line class="fig-prop-line" x1="${pr.bench[0] + 6}" y1="${pr.bench[1] + pr.bench[3]}" x2="${pr.bench[0] + 6}" y2="91"/><line class="fig-prop-line" x1="${pr.bench[0] + pr.bench[2] - 6}" y1="${pr.bench[1] + pr.bench[3]}" x2="${pr.bench[0] + pr.bench[2] - 6}" y2="91"/>`;
      if (pr.wall) props += `<line class="fig-prop-line" x1="${pr.wall}" y1="-6" x2="${pr.wall}" y2="92"/>`;
      if (pr.bar) {
        const ya = a[W1 + 1], yb = b[W1 + 1];
        props += `<line class="fig-prop-line" x1="30" y1="${ya}" x2="78" y2="${ya}">${anim('y1', ya, yb)}${anim('y2', ya, yb)}</line>`;
      }
    }
    let db = '';
    if ((ex.props || []).some((p) => p.db)) {
      const c = (arr, i) => `<circle class="fig-db" r="3.6" cx="${arr[i]}" cy="${arr[i + 1]}">${anim('cx', arr[i], (i === W1 ? b : b)[i])}${anim('cy', arr[i + 1], b[i + 1])}</circle>`;
      db = c(a, W1);
    }
    const head = `<circle class="fig-head" r="6.2" cx="${a[H]}" cy="${a[H + 1]}">${anim('cx', a[H], b[H])}${anim('cy', a[H + 1], b[H + 1])}</circle>`;
    return `<svg class="figure ${opts.cls || ''}" viewBox="0 -8 100 104" aria-hidden="true" focusable="false">
      <line class="fig-ground" x1="2" y1="92.5" x2="98" y2="92.5"/>${props}
      ${line('arm2', 'fig-far')}${line('leg2', 'fig-far')}
      ${line('torso', 'fig-near fig-torso')}${line('leg1', 'fig-near')}${line('arm1', 'fig-near')}${db}${head}</svg>`;
  }

  M.figure = figure;
})(typeof window !== 'undefined' ? window : globalThis);

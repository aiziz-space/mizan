/* ميزان — fullscreen workout timer. Wall-clock based so it survives iOS backgrounding. */
(function (root) {
  'use strict';
  const M = (root.M = root.M || {});
  const C = M.Calc;
  const KIND_LABEL = { prep: 'استعد', warm: 'إحماء', work: 'تمرين', rest: 'راحة', cool: 'تبريد' };

  /* ---------- Sound (Web Audio, unlocked by the start tap) ---------- */
  let ctx = null;
  function audioUnlock() {
    try {
      ctx = ctx || new (root.AudioContext || root.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      const o = ctx.createOscillator(), g = ctx.createGain(); g.gain.value = 0; o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.01);
    } catch { ctx = null; }
  }
  function beep(freq = 880, dur = 0.12, vol = 0.25, when = 0) {
    if (!ctx) return;
    try {
      const t = ctx.currentTime + when;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch { /* ignore */ }
  }
  const SOUNDS = {
    tick: () => beep(740, 0.09, 0.22),
    work: () => { beep(988, 0.14, 0.3); beep(1319, 0.22, 0.3, 0.14); },
    rest: () => { beep(660, 0.16, 0.28); beep(494, 0.24, 0.28, 0.16); },
    done: () => { [784, 988, 1175, 1568].forEach((f, i) => beep(f, 0.22, 0.28, i * 0.14)); }
  };

  /* ---------- Wake lock ---------- */
  let wake = null;
  async function keepAwake(on) {
    try {
      if (on && 'wakeLock' in navigator && document.visibilityState === 'visible') wake = await navigator.wakeLock.request('screen');
      else if (!on && wake) { await wake.release(); wake = null; }
    } catch { wake = null; }
  }

  /* ---------- Engine ---------- */
  let st = null;
  const now = () => Date.now();
  const el = (id) => document.getElementById(id);

  function start(def, opts) {
    const segs = M.Programs.buildSession(def);
    st = {
      def, segs, opts, idx: 0, segStart: now(), paused: false, pausedElapsed: 0,
      spent: segs.map(() => 0), lastShown: null, startedAt: now(), timer: null
    };
    audioUnlock();
    keepAwake(true);
    render(true);
    el('timer').hidden = false;
    document.body.classList.add('no-scroll');
    st.timer = setInterval(tick, 200);
    document.addEventListener('visibilitychange', onVis);
    if (opts.sound) SOUNDS.rest();
  }

  const segElapsed = () => (st.paused ? st.pausedElapsed : st.pausedElapsed + (now() - st.segStart) / 1000);
  const remaining = () => st.segs[st.idx].sec - segElapsed();

  function goTo(i, { recordFull = true } = {}) {
    // record time spent on the segment we leave
    st.spent[st.idx] = Math.min(st.segs[st.idx].sec, recordFull ? st.segs[st.idx].sec : segElapsed());
    if (i >= st.segs.length) return finish(true);
    st.idx = Math.max(0, i);
    st.pausedElapsed = 0; st.segStart = now();
    if (st.paused) st.pausedElapsed = 0;
    const k = st.segs[st.idx].kind;
    if (st.opts.sound) (k === 'work' ? SOUNDS.work : k === 'rest' ? SOUNDS.rest : SOUNDS.work)();
    render(true);
  }

  function tick() {
    if (!st || st.paused) return;
    let rem = remaining();
    // advance through any segments that elapsed while the app was in background
    while (rem <= 0 && st) {
      const overflow = -rem;
      const next = st.idx + 1;
      st.spent[st.idx] = st.segs[st.idx].sec;
      if (next >= st.segs.length) return finish(true);
      st.idx = next; st.pausedElapsed = 0; st.segStart = now() - overflow * 1000;
      const k = st.segs[st.idx].kind;
      if (st.opts.sound && overflow < 1) (k === 'rest' ? SOUNDS.rest : SOUNDS.work)();
      render(true);
      rem = remaining();
    }
    const whole = Math.ceil(rem);
    if (st.opts.sound && whole !== st.lastShown && whole <= 3 && whole >= 1) SOUNDS.tick();
    render(false);
  }

  function onVis() {
    if (!st) return;
    if (document.visibilityState === 'visible') { keepAwake(true); tick(); }
  }

  function togglePause() {
    if (!st) return;
    if (st.paused) { st.paused = false; st.segStart = now(); audioUnlock(); }
    else { st.pausedElapsed = segElapsed(); st.paused = true; }
    render(true);
  }

  function result(completed) {
    const w = st.opts.weight;
    const counted = st.segs.map((s, i) => ({ met: s.kind === 'prep' ? 1 : s.met, sec: st.spent[i] }));
    const activeSec = counted.reduce((a, s, i) => a + (st.segs[i].kind === 'prep' ? 0 : s.sec), 0);
    return {
      completed, programId: st.def.id, title: st.def.title, kind: st.def.kind,
      minutes: Math.max(1, Math.round(activeSec / 60)), kcal: C.segmentsKcal(counted, w), activeSec
    };
  }

  function finish(completed) {
    if (!st) return;
    if (!completed) st.spent[st.idx] = Math.min(st.segs[st.idx].sec, segElapsed());
    clearInterval(st.timer);
    document.removeEventListener('visibilitychange', onVis);
    keepAwake(false);
    const r = result(completed);
    if (st.opts.sound && completed) SOUNDS.done();
    const cb = st.opts.onFinish;
    close();
    if (cb) cb(r);
  }
  function close() {
    if (st) clearInterval(st.timer);
    st = null;
    el('timer').hidden = true;
    document.body.classList.remove('no-scroll');
    keepAwake(false);
  }

  /* ---------- UI ---------- */
  const RING_R = 108, RING_C = 2 * Math.PI * RING_R;
  function render(full) {
    if (!st) return;
    const seg = st.segs[st.idx];
    const rem = Math.max(0, remaining());
    const whole = Math.ceil(rem);
    st.lastShown = whole;
    const root = el('timer');
    root.dataset.kind = seg.kind;
    el('t-time').textContent = whole >= 60 ? `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}` : String(whole);
    const frac = seg.sec ? rem / seg.sec : 0;
    el('t-ring').style.strokeDashoffset = String(RING_C * (1 - frac));
    // overall progress
    const total = st.segs.reduce((a, s) => a + s.sec, 0);
    const done = st.segs.slice(0, st.idx).reduce((a, s) => a + s.sec, 0) + (seg.sec - rem);
    el('t-progress').style.width = `${Math.min(100, (done / total) * 100)}%`;
    el('t-left').textContent = fmtMin(total - done);
    if (!full) return;
    const ex = M.EX.BY_ID[seg.ex];
    el('t-kind').textContent = KIND_LABEL[seg.kind];
    el('t-round').textContent = seg.round ? `جولة ${seg.round} من ${seg.rounds}` : (seg.kind === 'warm' ? 'تجهيز الجسم' : seg.kind === 'cool' ? 'إطالة واسترخاء' : '');
    el('t-name').textContent = seg.kind === 'rest' || seg.kind === 'prep' ? `الجاي: ${ex.name}` : ex.name;
    el('t-hint').textContent = ex.steps[0] || '';
    el('t-fig').innerHTML = M.figure(ex, { animate: seg.kind !== 'rest', dur: seg.kind === 'work' ? 1.6 : 2.6 });
    let nx = null;
    for (let i = st.idx + 1; i < st.segs.length; i++) if (st.segs[i].kind !== 'rest') { nx = st.segs[i]; break; }
    el('t-next').innerHTML = nx ? `التالي: <b>${M.EX.BY_ID[nx.ex].name}</b> · ${nx.sec} ث` : 'آخر واحد! 💪';
    el('t-pause').innerHTML = M.icon(st.paused ? 'play' : 'pause');
    el('t-pause').setAttribute('aria-label', st.paused ? 'استئناف' : 'إيقاف مؤقت');
    root.classList.toggle('paused', st.paused);
    el('t-title').textContent = st.def.title;
  }
  const fmtMin = (s) => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  function bind() {
    el('t-pause').onclick = togglePause;
    el('t-next-btn').onclick = () => st && goTo(st.idx + 1, { recordFull: false });
    el('t-prev-btn').onclick = () => { if (!st) return; if (segElapsed() > 3 || st.idx === 0) goTo(st.idx, { recordFull: false }); else goTo(st.idx - 1, { recordFull: false }); };
    el('t-close').onclick = () => {
      if (!st) return;
      const wasPaused = st.paused; if (!wasPaused) togglePause();
      M.ui.choice('تنهي التمرين الحين؟', 'تقدر تسجّل الوقت اللي تمرنته وسعراته.', [
        { label: 'سجّل اللي سويته وأنهِ', cls: 'primary', fn: () => finish(false) },
        { label: 'كمّل التمرين', cls: 'ghost', fn: () => { if (!wasPaused) togglePause(); } },
        { label: 'إنهاء بدون تسجيل', cls: 'danger', fn: () => close() }
      ], { layer: 'top' });
    };
  }

  M.Timer = { start, bind, isRunning: () => !!st, _state: () => st, _tick: tick, RING_C };
})(typeof window !== 'undefined' ? window : globalThis);

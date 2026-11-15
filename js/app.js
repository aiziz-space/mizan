/* ميزان v2 — UI layer. */
(function () {
  'use strict';
  const M = window.M, C = M.Calc, P = M.Programs, EX = M.EX, Store = M.Store, icon = M.icon;
  const VERSION = '2.0.0';

  /* ================= Helpers ================= */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const fmt1 = (n) => (Math.round(n * 10) / 10).toLocaleString('en-US', { maximumFractionDigits: 1 });
  const fmt2 = (n) => (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const sign = (n, f = fmt1) => `<span class="n">${n > 0 ? '+' : n < 0 ? '−' : ''}${f(Math.abs(n))}</span>`;
  const ltr = (s) => `<span class="n">${s}</span>`;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v) => { const n = parseFloat(String(v ?? '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
  const AR = 'ar-u-ca-gregory-nu-latn';
  const dFmt = new Intl.DateTimeFormat(AR, { weekday: 'long', day: 'numeric', month: 'long' });
  const fullFmt = new Intl.DateTimeFormat(AR, { day: 'numeric', month: 'long', year: 'numeric' });
  const dmFmt = new Intl.DateTimeFormat(AR, { day: 'numeric', month: 'long' });
  const wdFmt = new Intl.DateTimeFormat(AR, { weekday: 'short' });
  const dm = (k) => { const d = C.parseKey(k); return `${d.getDate()}/${d.getMonth() + 1}`; };
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================= State ================= */
  let S;
  const today = () => C.dateKey(new Date());
  const UI = { view: 'home', foodTab: 'log', trainTab: 'today', progTab: 'weight', libCat: 'all', libQ: '', mealsQ: '', reportOffset: 0, cur: today(), heroShown: null };
  const weightFor = (k) => C.weightOn(S.days, k, S.profile.startWeight);
  const goalInfo = (k) => C.goalFor(S.profile, weightFor(k), k);
  const totals = (k) => C.dayTotals(S.days[k], goalInfo(k).goal, S.settings.exerciseRatio);
  const day = (k) => (S.days[k] ||= { food: [], activity: [] });
  const pruneDay = (k) => { const d = S.days[k]; if (d && !d.food.length && !d.activity.length && d.weight == null && !d.water && !d.steps && d.waist == null) delete S.days[k]; };
  function save() { if (!Store.save(S)) toast('تعذّر الحفظ — مساحة التخزين ممتلئة؟', 'warn'); }
  function commit() { save(); render(); checkAchievements(); }

  /* ================= UI primitives ================= */
  let toastT;
  function toast(msg, kind = '') {
    const t = $('#toast'); t.className = 'toast ' + kind; t.innerHTML = msg; t.hidden = false;
    t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => { t.classList.remove('show'); setTimeout(() => (t.hidden = true), 250); }, 2600);
  }
  let sheetLocked = false;
  function openSheet(title, html, { locked = false } = {}) {
    $('#sheet-title').textContent = title;
    $('#sheet-body').innerHTML = html;
    $('#sheet-close').hidden = locked;
    sheetLocked = locked;
    const w = $('#sheet-wrap'); w.hidden = false; w.classList.remove('closing');
    $('#sheet-body').scrollTop = 0;
    return $('#sheet-body');
  }
  function closeSheet(force) {
    if (sheetLocked && !force) return;
    const w = $('#sheet-wrap');
    if (w.hidden) return;
    w.classList.add('closing'); sheetLocked = false;
    setTimeout(() => { w.hidden = true; w.classList.remove('closing'); $('#sheet-body').innerHTML = ''; }, reduceMotion ? 0 : 180);
  }
  $('#sheet-close').onclick = () => closeSheet();
  $('#sheet-backdrop').onclick = () => closeSheet();

  function choice(title, text, buttons, { layer } = {}) {
    const d = $('#dialog');
    d.classList.toggle('top', layer === 'top');
    $('#dialog-title').textContent = title;
    $('#dialog-text').textContent = text || '';
    const box = $('#dialog-actions'); box.innerHTML = '';
    buttons.forEach((b) => {
      const el = document.createElement('button');
      el.className = 'btn full ' + (b.cls || 'ghost'); el.textContent = b.label;
      el.onclick = () => { d.hidden = true; b.fn && b.fn(); };
      box.appendChild(el);
    });
    d.hidden = false;
  }
  const confirmDo = (title, text, okLabel, fn, danger = false) =>
    choice(title, text, [{ label: okLabel, cls: danger ? 'danger' : 'primary', fn }, { label: 'إلغاء', cls: 'ghost' }]);
  M.ui = { choice, toast };

  function seg(el, value, onChange) {
    if (!el) return;
    el.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('on', b.dataset.v === String(value));
      b.onclick = () => { el.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); onChange(b.dataset.v); };
    });
  }

  /* ---------- Effects ---------- */
  function confetti(n = 110) {
    if (reduceMotion) return;
    const cv = $('#fx'), g = cv.getContext('2d');
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; cv.hidden = false;
    const cols = ['#2fd3a0', '#e9c46a', '#f4f1de', '#7bdff2', '#f28482'];
    const ps = Array.from({ length: n }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 80, y: innerHeight * 0.38,
      vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 12 - 4, r: Math.random() * 360, vr: (Math.random() - 0.5) * 18,
      w: 5 + Math.random() * 6, h: 8 + Math.random() * 8, c: cols[(Math.random() * cols.length) | 0]
    }));
    const t0 = performance.now();
    (function frame(t) {
      const el = t - t0;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of ps) {
        p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.translate(p.x, p.y); g.rotate((p.r * Math.PI) / 180); g.globalAlpha = Math.max(0, 1 - el / 2200);
        g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore();
      }
      if (el < 2200) requestAnimationFrame(frame); else { g.clearRect(0, 0, innerWidth, innerHeight); cv.hidden = true; }
    })(t0);
  }
  M.fx = { confetti };
  function countUp(el, from, to, dur = 650) {
    if (reduceMotion || from == null || from === to) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    (function step(t) {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  const ringSVG = (frac, { size = 220, r = 96, sw = 14, cls = '' } = {}) => {
    const c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(1, frac)));
    return `<svg class="ring ${cls}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${sw}"/>
      <circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${sw}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
  };

  /* ================= Navigation ================= */
  const TITLES = { home: '', food: 'الأكل', train: 'التمارين', progress: 'التقدم', more: 'الإعدادات' };
  function show(v) {
    UI.view = v;
    $$('.view').forEach((s) => (s.hidden = s.id !== 'view-' + v));
    $$('#tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
    render();
    window.scrollTo(0, 0);
    const vEl = $('#view-' + v); vEl.classList.remove('enter'); void vEl.offsetWidth; vEl.classList.add('enter');
  }
  $$('#tabbar button').forEach((b) => (b.onclick = () => show(b.dataset.view)));
  addEventListener('scroll', () => $('.topbar').classList.toggle('scrolled', scrollY > 4), { passive: true });

  function render() {
    if (!S.profile) return;
    const h = new Date().getHours();
    if (UI.view === 'home') {
      $('#title').textContent = h < 12 ? 'صباح الخير' : h < 18 ? 'مساء النور' : 'مساء الخير';
      $('#subtitle').textContent = dFmt.format(new Date());
    } else { $('#title').textContent = TITLES[UI.view]; $('#subtitle').textContent = ''; }
    const st = C.streak(S.days, today());
    $('#streak').innerHTML = `${icon('flame')}<b>${st}</b>`;
    $('#streak').classList.toggle('hot', st > 0);
    ({ home: renderHome, food: renderFood, train: renderTrain, progress: renderProgress, more: renderMore })[UI.view]();
  }

  /* ================= Delegated actions ================= */
  const ACT = {};
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t || t.disabled) return;
    const fn = ACT[t.dataset.act];
    if (fn) { e.preventDefault(); fn(t, e); }
  });
  ACT.go = (t) => { if (t.dataset.sub) UI[t.dataset.subkey] = t.dataset.sub; show(t.dataset.view); };

  /* ================= Home ================= */
  function renderHome() {
    const k = today(), p = S.profile;
    const g = goalInfo(k), t = totals(k), d = S.days[k] || {};
    const prot = C.proteinTarget(p);
    const frac = t.budget > 0 ? t.food / t.budget : 1;
    const plan = P.planFor(p, k);
    const doneW = (d.activity || []).filter((a) => a.type === 'workout');
    const cups = Math.max(1, Math.round(p.waterGoal / 250)), water = d.water || 0, filled = Math.floor(water / 250);
    const steps = d.steps || 0;
    const tip = M.Tips.tipFor(k);
    const wToday = typeof d.weight === 'number';
    const avg7 = C.avgWeight(S.days, k, 7);

    let workoutCard;
    if (doneW.length) {
      const kc = doneW.reduce((s, a) => s + a.kcal, 0), mins = doneW.reduce((s, a) => s + a.minutes, 0);
      workoutCard = `<div class="card wk-card done pop">
        <div class="wk-badge">${icon('check')}</div>
        <div class="wk-main"><div class="eyebrow">تمرين اليوم</div><div class="wk-title">خلصته! 💪</div>
        <div class="muted small">${fmt(mins)} دقيقة · ${fmt(kc)} سعرة محروقة</div></div>
        <button class="btn ghost sm" data-act="go" data-view="train">التفاصيل</button></div>`;
    } else if (plan.rest) {
      workoutCard = `<div class="card wk-card rest">
        <div class="wk-icon">${icon('walk')}</div>
        <div class="wk-main"><div class="eyebrow">تمرين اليوم</div><div class="wk-title">يوم راحة نشطة</div>
        <div class="muted small">${p.stepsGoal ? `امشِ وحاول توصل ${fmt(p.stepsGoal)} خطوة` : 'امشِ 20–30 دقيقة براحتك'}</div></div>
        <button class="btn ghost sm" data-act="go" data-view="train">البرامج</button></div>`;
    } else {
      const segs = P.buildSession(plan.def), mins = Math.round(P.totalSec(segs) / 60);
      workoutCard = `<div class="card wk-card">
        <div class="wk-fig">${M.figure(EX.BY_ID[plan.def.blocks[0].items[0]], { dur: 2 })}</div>
        <div class="wk-main"><div class="eyebrow">تمرين اليوم · ${P.KINDS[plan.kind].label}</div>
        <div class="wk-title">${esc(plan.def.title)}</div>
        <div class="muted small">${mins} دقيقة · ~${fmt(C.segmentsKcal(segs, weightFor(k)))} سعرة</div></div>
        <button class="btn primary sm" data-act="workout-preview" data-plan="${k}">${icon('play')} ابدأ</button></div>`;
    }

    $('#view-home').innerHTML = `
      ${noticesHTML()}
      <div class="card hero ${t.over ? 'over' : ''}">
        <div class="hero-ring">${ringSVG(frac)}
          <div class="hero-center"><div class="hero-label">${t.over ? 'تجاوزت بـ' : 'باقي لك'}</div>
          <div class="hero-num" id="hero-num">${fmt(Math.abs(t.remaining))}</div><div class="hero-unit">سعرة</div></div>
        </div>
        <div class="stats3">
          <div><span class="s-num">${fmt(g.goal)}</span><span class="s-lbl">الهدف</span></div>
          <div><span class="s-num">${fmt(t.food)}</span><span class="s-lbl">الأكل</span></div>
          <div><span class="s-num">${ltr('+' + fmt(t.exCredit))}</span><span class="s-lbl">الرياضة ${Math.round(S.settings.exerciseRatio * 100)}%</span></div>
        </div>
        <div class="bar-row"><span class="bar-lbl">${icon('egg')} بروتين</span>
          <div class="bar"><i style="width:${Math.min(100, (t.protein / prot) * 100)}%"></i></div>
          <span class="bar-val"><span class="n"><b>${fmt(t.protein)}</b>/${fmt(prot)}</span> جم</span></div>
      </div>
      <div class="actions2">
        <button class="btn primary big" data-act="add-food" data-day="${k}">${icon('plus')} أكل</button>
        <button class="btn secondary big" data-act="add-activity" data-day="${k}">${icon('plus')} نشاط</button>
      </div>
      ${workoutCard}
      <div class="grid2">
        <div class="card mini water">
          <div class="mini-head">${icon('drop')}<span>الماء</span><b class="n">${fmt2(water / 1000)}<small>/${fmt2(p.waterGoal / 1000)}</small></b><small>لتر</small></div>
          <div class="cups">${Array.from({ length: cups }, (_, i) => `<button class="cup ${i < filled ? 'on' : ''}" data-act="cup" data-i="${i}" aria-label="كوب ${i + 1}">${icon('drop')}</button>`).join('')}</div>
          <div class="mini-btns"><button class="btn ghost xs" data-act="water" data-d="-250" aria-label="ناقص كوب">${icon('minus')}</button><button class="btn secondary xs" data-act="water" data-d="250" aria-label="زِد كوب">${icon('plus')} كوب</button></div>
        </div>
        <button class="card mini steps" data-act="steps" data-day="${k}">
          <div class="mini-head">${icon('steps')}<span>الخطوات</span></div>
          <div class="steps-ring">${ringSVG(p.stepsGoal ? steps / p.stepsGoal : 0, { size: 120, r: 50, sw: 10, cls: 'sm' })}
            <div class="steps-center"><b>${fmt(steps)}</b><small>${p.stepsGoal ? 'من ' + fmt(p.stepsGoal) : 'حدد هدف'}</small></div></div>
        </button>
      </div>
      <div class="card row-card weight-card">
        <div class="wc-ic">${icon('scale')}</div>
        <div class="wc-main"><div class="muted small">${wToday ? 'وزن اليوم' : 'وزن الصباح'}</div>
          <div class="weight-val">${wToday ? fmt1(d.weight) + ' <small>كجم</small>' : '<span class="muted">ما سجلته</span>'}</div>
          ${avg7.n >= 2 ? `<div class="muted xs">متوسط 7 أيام: ${fmt1(avg7.avg)} كجم</div>` : ''}</div>
        <button class="btn ${wToday ? 'ghost' : 'primary'} sm" data-act="weight" data-day="${k}">${wToday ? 'تعديل' : 'سجّل'}</button>
      </div>
      <div class="card tip">
        <div class="tip-head">${icon('leaf')}<span>نصيحة اليوم · ${M.Tips.TOPICS[tip.topic]}</span></div>
        <p>${esc(tip.text)}</p>
      </div>`;
    const hn = $('#hero-num');
    countUp(hn, UI.heroShown, Math.abs(t.remaining));
    UI.heroShown = Math.abs(t.remaining);
  }

  /* ---------- Notices ---------- */
  function noticesHTML() {
    const p = S.profile, k = today(), out = [];
    const g = goalInfo(k);
    for (const n of S.notices.filter((x) => !x.dismissed)) {
      if (n.type === 'rate_migrated') {
        const old = C.goalFor({ ...p, rateMode: 'kg', ratePerWeek: n.from, adjustLog: [] }, weightFor(k), k).goal;
        out.push(`<div class="card notice">
          <div class="nt-head">${icon('info')}<b>تحديث سرعة النزول</b></div>
          <p>خيار ${n.from} كجم/أسبوع ما عاد موجود، فصارت سرعتك ${n.to} كجم. هدفك صار <b>${fmt(g.goal)}</b> بدل <b>${fmt(old)}</b> سعرة.</p>
          <div class="nt-btns"><button class="btn primary sm" data-act="notice-ok" data-id="${n.id}">تمام</button>
          <button class="btn ghost sm" data-act="keep-old-goal" data-id="${n.id}" data-goal="${old}">خلّ هدفي ${fmt(old)}</button></div></div>`);
      } else if (n.type === 'adjust') {
        const R = { stalled: 'متوسط وزنك ما نزل', slow: 'النزول أبطأ من المتوقع', fast: 'النزول أسرع من المخطط', too_fast: 'النزول أسرع بكثير من المخطط', on_track: 'ماشي على الخطة 👌', at_floor: 'النزول بطيء لكن هدفك على الحد الأدنى الآمن', at_cap: 'وصلنا حد التعديل' }[n.reason];
        const what = n.delta ? `${n.delta < 0 ? 'نقّصنا' : 'زدنا'} هدفك ${fmt(Math.abs(n.delta))} سعرة.` : 'ما غيّرنا هدفك.';
        out.push(`<div class="card notice ${n.delta < 0 ? '' : 'good'}">
          <div class="nt-head">${icon('refresh')}<b>المراجعة الأسبوعية</b></div>
          <p><b>${R}</b><br>متوسط وزنك هالأسبوع ${fmt1(n.curAvg)} كجم مقابل ${fmt1(n.prevAvg)} الأسبوع اللي قبله، يعني نزلت ${fmt2(n.actual)} كجم والمخطط ${fmt2(n.expected)}. ${what}</p>
          <div class="nt-btns"><button class="btn primary sm" data-act="notice-ok" data-id="${n.id}">تمام</button>
          ${n.delta ? `<button class="btn ghost sm" data-act="undo-adjust" data-id="${n.id}">تراجع</button>` : ''}</div></div>`);
      }
    }
    if (!p.manualGoal && g.floored) {
      out.push(`<div class="card notice warn"><div class="nt-head">${icon('warn')}<b>الهدف على الحد الأدنى الآمن</b></div>
        <p>سرعتك المختارة تحتاج ${fmt(g.planned)} سعرة، وهذا أقل من ${fmt(g.min)}. ثبّتنا هدفك على ${fmt(g.min)}، فالنزول المتوقع حوالي ${fmt1(g.realKg)} كجم بالأسبوع بدل ${fmt1(g.kg)}.</p>
        <div class="nt-btns"><button class="btn ghost sm" data-act="edit-profile">غيّر السرعة</button></div></div>`);
    }
    const since = C.daysBetween(p.planStart, k);
    const wk = C.weightKeys(S.days);
    if (since < C.WATER_PHASE_DAYS && wk.length >= 2 && S.days[wk[0]].weight - S.days[wk[wk.length - 1]].weight >= 0.5 && S.settings.waterNoteSeen !== p.planStart) {
      out.push(`<div class="card notice good"><div class="nt-head">${icon('drop')}<b>أول أسبوعين</b></div>
        <p>نزلت ${fmt1(S.days[wk[0]].weight - S.days[wk[wk.length - 1]].weight)} كجم. أغلب النزول في هالفترة ماء وجلايكوجين، وبعدها يصير أبطأ وأغلبه دهون. هذا طبيعي، لا تحبط لما يهدى.</p>
        <div class="nt-btns"><button class="btn ghost sm" data-act="water-note-ok">فهمت</button></div></div>`);
    }
    const plan = P.planFor(p, k);
    if (!plan.rest && plan.levelUp && S.settings.levelUpSeen !== p.level) {
      out.push(`<div class="card notice good"><div class="nt-head">${icon('bolt')}<b>جاهز للمستوى الجاي؟</b></div>
        <p>صار لك أكثر من 8 أسابيع على مستوى ${P.LEVELS[p.level].label}. جرّب ترفع المستوى من الإعدادات.</p>
        <div class="nt-btns"><button class="btn primary sm" data-act="level-up">ارفع المستوى</button><button class="btn ghost sm" data-act="level-up-later">بعدين</button></div></div>`);
    }
    return out.join('');
  }
  ACT['notice-ok'] = (t) => { const n = S.notices.find((x) => x.id === t.dataset.id); if (n) n.dismissed = true; commit(); };
  ACT['keep-old-goal'] = (t) => { S.profile.manualGoal = +t.dataset.goal; ACT['notice-ok'](t); toast('ثبّتنا هدفك اليدوي'); };
  ACT['undo-adjust'] = (t) => {
    const n = S.notices.find((x) => x.id === t.dataset.id);
    if (!n) return;
    S.profile.adjustLog = S.profile.adjustLog.filter((a) => a.id !== n.adjustId);
    n.dismissed = true; commit(); toast('رجّعنا هدفك');
  };
  ACT['water-note-ok'] = () => { S.settings.waterNoteSeen = S.profile.planStart; commit(); };
  ACT['level-up'] = () => { const p = S.profile; p.level = p.level === 'beginner' ? 'intermediate' : 'advanced'; p.planStart = today(); S.settings.levelUpSeen = p.level; commit(); toast(`صار مستواك ${P.LEVELS[p.level].label} 🔥`); };
  ACT['level-up-later'] = () => { S.settings.levelUpSeen = S.profile.level; commit(); };

  /* ---------- Water / steps ---------- */
  function setWater(ml) { const k = today(); day(k).water = Math.max(0, Math.min(10000, ml)); pruneDay(k); commit(); }
  ACT.water = (t) => setWater(((S.days[today()] || {}).water || 0) + +t.dataset.d);
  ACT.cup = (t) => { const i = +t.dataset.i, w = (S.days[today()] || {}).water || 0; setWater(Math.floor(w / 250) === i + 1 ? i * 250 : (i + 1) * 250); };
  ACT.steps = (t) => {
    const k = t.dataset.day || today(), p = S.profile, cur = (S.days[k] || {}).steps || '';
    const body = openSheet('خطوات اليوم', `
      <div class="field"><label for="s-in">عدد الخطوات (من جوالك أو ساعتك)</label>
        <input class="input" id="s-in" type="number" inputmode="numeric" min="0" max="100000" value="${cur}"></div>
      <div class="field"><label for="s-goal">هدفك اليومي</label>
        <input class="input" id="s-goal" type="number" inputmode="numeric" min="1000" max="40000" step="500" value="${p.stepsGoal || ''}" placeholder="مثلاً 8000"></div>
      <p class="hint">الخطوات للمتابعة فقط وما تنضاف لسعراتك (عشان ما تنحسب مرتين). لو تبي سعرات المشي سجّله كنشاط.</p>
      <button class="btn primary big full" id="s-save">حفظ</button>`);
    body.querySelector('#s-save').onclick = () => {
      const v = num(body.querySelector('#s-in').value), g = num(body.querySelector('#s-goal').value);
      if (body.querySelector('#s-in').value !== '' && !(v >= 0 && v <= 100000)) return toast('رقم غير صحيح');
      day(k).steps = Number.isFinite(v) ? Math.round(v) : 0;
      if (g >= 1000 && g <= 40000) p.stepsGoal = Math.round(g);
      pruneDay(k); closeSheet(); commit(); toast('تم الحفظ');
    };
  };

  /* ================= Food ================= */
  function renderFood() {
    const v = $('#view-food');
    const tabs = `<div class="seg wide" id="food-tabs"><button data-v="log">سجل اليوم</button><button data-v="meals">قائمتي</button></div>`;
    if (UI.foodTab === 'meals') {
      const q = UI.mealsQ.trim();
      const items = S.meals.filter((m) => !q || m.name.includes(q)).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      v.innerHTML = `${tabs}
        <div class="search">${icon('search')}<input type="search" class="input" id="meals-search" placeholder="ابحث في قائمتي…" value="${esc(UI.mealsQ)}" autocomplete="off"></div>
        <ul class="list">${!S.meals.length ? '<li class="empty">قائمتك فاضية. أضف وجباتك اللي تتكرر عشان تسجلها بضغطة.</li>' : !items.length ? '<li class="empty">ما فيه نتائج</li>'
          : items.map((m) => `<li><div class="li-main"><div class="li-title">${esc(m.name)}</div>
              <div class="li-sub">${mealSub(m)}</div></div>
              <button class="li-btn" data-act="edit-meal" data-id="${m.id}" aria-label="تعديل">${icon('edit')}</button>
              <button class="li-btn del" data-act="del-meal" data-id="${m.id}" aria-label="حذف">${icon('trash')}</button></li>`).join('')}</ul>
        <button class="btn primary big full" data-act="edit-meal">${icon('plus')} وجبة جديدة</button>`;
      const s = $('#meals-search');
      s.oninput = () => { UI.mealsQ = s.value; const pos = s.selectionStart; renderFood(); const n = $('#meals-search'); n.focus(); n.setSelectionRange(pos, pos); };
    } else {
      const k = UI.cur, t0 = today();
      if (k > t0) UI.cur = t0;
      const d = S.days[k] || { food: [], activity: [] };
      const g = goalInfo(k), t = totals(k);
      const label = k === t0 ? 'اليوم' : k === C.addDays(t0, -1) ? 'أمس' : '';
      v.innerHTML = `${tabs}
        <div class="daynav">
          <button class="icon-btn" data-act="day" data-d="-1" aria-label="اليوم السابق">${icon('chevR')}</button>
          <button class="day-label" data-act="day" data-d="0">${label ? label + ' · ' : ''}${dFmt.format(C.parseKey(k))}</button>
          <button class="icon-btn" data-act="day" data-d="1" ${k >= t0 ? 'disabled' : ''} aria-label="اليوم التالي">${icon('chevL')}</button>
        </div>
        <div class="card sumrow ${t.over ? 'over' : ''}">
          <div><span class="muted xs">${t.over ? 'تجاوزت بـ' : 'باقي'}</span><b>${fmt(Math.abs(t.remaining))}</b></div>
          <div><span class="muted xs">الأكل</span><b>${fmt(t.food)}</b></div>
          <div><span class="muted xs">الهدف</span><b>${fmt(g.goal)}</b></div>
          <div><span class="muted xs">بروتين</span><b>${fmt(t.protein)}<small> جم</small></b></div>
        </div>
        <div class="actions2">
          <button class="btn primary big" data-act="add-food" data-day="${k}">${icon('plus')} أكل</button>
          <button class="btn secondary big" data-act="add-activity" data-day="${k}">${icon('plus')} نشاط</button>
        </div>
        <h2 class="section-h">الأكل</h2>
        <ul class="list">${d.food.length ? d.food.map((f) => `<li class="${f.id === UI.fresh ? 'pop' : ''}">
            <div class="li-main"><div class="li-title">${esc(f.name)}</div>
            <div class="li-sub">${foodSub(f)}</div></div>
            <div class="li-kcal">${fmt(f.kcal * f.qty)}</div>
            <button class="li-btn del" data-act="del-food" data-day="${k}" data-id="${f.id}" aria-label="حذف">${icon('trash')}</button></li>`).join('')
          : '<li class="empty">ما سجلت أكل لهذا اليوم</li>'}</ul>
        <h2 class="section-h">النشاط</h2>
        <ul class="list">${d.activity.length ? d.activity.map((a) => `<li class="${a.id === UI.fresh ? 'pop' : ''}">
            <div class="li-ic">${icon(a.type === 'workout' ? 'bolt' : a.type === 'walk' || a.type === 'brisk' ? 'walk' : 'dumbbell')}</div>
            <div class="li-main"><div class="li-title">${esc(a.title || C.EXERCISES[a.type]?.label || a.type)}</div>
            <div class="li-sub">${fmt(a.minutes)} دقيقة${a.steps ? ` · ${fmt(a.steps)} خطوة` : ''}</div></div>
            <div class="li-kcal">${fmt(a.kcal)}</div>
            <button class="li-btn del" data-act="del-act" data-day="${k}" data-id="${a.id}" aria-label="حذف">${icon('trash')}</button></li>`).join('')
          : '<li class="empty">ما سجلت نشاط لهذا اليوم</li>'}</ul>`;
    }
    seg($('#food-tabs'), UI.foodTab, (x) => { UI.foodTab = x; renderFood(); });
    UI.fresh = null;
  }
  const SIZE_LABEL = { s: 'صغير', m: 'وسط', l: 'كبير' };
  const mealSizes = (m) => {
    const out = [];
    if (m.sizes?.s?.kcal) out.push({ key: 's', kcal: m.sizes.s.kcal, protein: m.sizes.s.protein ?? null });
    out.push({ key: 'm', kcal: m.kcal, protein: m.protein ?? null });
    if (m.sizes?.l?.kcal) out.push({ key: 'l', kcal: m.sizes.l.kcal, protein: m.sizes.l.protein ?? null });
    return out;
  };
  const mealSub = (m) => mealSizes(m).map((s) => `${mealSizes(m).length > 1 ? SIZE_LABEL[s.key] + ' ' : ''}${fmt(s.kcal)}${s.protein ? ` · ${fmt(s.protein)}ج بروتين` : ''}`).join(' — ');
  const foodSub = (f) => [f.size && f.size !== 'm' ? SIZE_LABEL[f.size] : f.size === 'm' ? 'وسط' : '', f.qty !== 1 ? `${fmt1(f.qty)} × ${fmt(f.kcal)}` : 'حصة واحدة', f.protein ? `${fmt(f.protein * f.qty)} جم بروتين` : ''].filter(Boolean).join(' · ');

  ACT.day = (t) => { const d = +t.dataset.d; if (d === 0) UI.cur = today(); else if (d > 0 && UI.cur >= today()) return; else UI.cur = C.addDays(UI.cur, d); renderFood(); };
  ACT['del-food'] = (t) => confirmDo('تحذف هذا الأكل؟', '', 'حذف', () => { const k = t.dataset.day, d = day(k); d.food = d.food.filter((x) => x.id !== t.dataset.id); pruneDay(k); commit(); }, true);
  ACT['del-act'] = (t) => confirmDo('تحذف هذا النشاط؟', '', 'حذف', () => { const k = t.dataset.day, d = day(k); d.activity = d.activity.filter((x) => x.id !== t.dataset.id); pruneDay(k); commit(); }, true);
  ACT['del-meal'] = (t) => { const m = S.meals.find((x) => x.id === t.dataset.id); confirmDo(`تحذف "${m.name}"؟`, 'الأيام اللي سجلتها قبل ما تتأثر.', 'حذف', () => { S.meals = S.meals.filter((x) => x.id !== m.id); commit(); }, true); };

  function addFoodEntry(k, e) {
    const entry = { id: uid(), name: e.name, kcal: Math.round(e.kcal), qty: e.qty || 1 };
    if (e.protein != null && e.protein > 0) entry.protein = Math.round(e.protein * 10) / 10;
    if (e.size) entry.size = e.size;
    day(k).food.push(entry); UI.fresh = entry.id;
    return entry;
  }

  ACT['add-food'] = (t) => openFoodSheet(t.dataset.day || today(), S.meals.length ? 'list' : 'quick');
  function openFoodSheet(k, tab) {
    const body = openSheet('إضافة أكل', `<div class="seg" id="food-tab"><button data-v="list">من قائمتي</button><button data-v="quick">إدخال سريع</button></div><div id="food-pane"></div>`);
    const pane = body.querySelector('#food-pane');
    seg(body.querySelector('#food-tab'), tab, (v) => draw(v));
    draw(tab);
    function draw(v) {
      if (v === 'quick') {
        pane.innerHTML = `<div class="fields">
          <div class="field"><label for="q-name">اسم الأكل</label><input class="input" id="q-name" type="text" autocomplete="off" placeholder="مثلاً: شاورما دجاج"></div>
          <div class="row2"><div class="field"><label for="q-kcal">السعرات</label><input class="input" id="q-kcal" type="number" inputmode="numeric" min="0" placeholder="0"></div>
          <div class="field"><label for="q-prot">بروتين (جم) <span class="opt">اختياري</span></label><input class="input" id="q-prot" type="number" inputmode="decimal" min="0" placeholder="—"></div></div>
          <label class="check"><input type="checkbox" id="q-keep"> احفظه في قائمتي</label>
          <button class="btn primary big full" id="q-save">إضافة</button></div>`;
        pane.querySelector('#q-save').onclick = () => {
          const name = pane.querySelector('#q-name').value.trim() || 'أكل';
          const kcal = num(pane.querySelector('#q-kcal').value), prot = num(pane.querySelector('#q-prot').value);
          if (!(kcal >= 0 && kcal <= 10000)) return toast('أدخل السعرات');
          if (Number.isFinite(prot) && !(prot >= 0 && prot <= 500)) return toast('البروتين غير صحيح');
          addFoodEntry(k, { name, kcal, protein: Number.isFinite(prot) ? prot : null });
          if (pane.querySelector('#q-keep').checked && !S.meals.some((m) => m.name === name)) S.meals.push({ id: uid(), name, kcal: Math.round(kcal), protein: Number.isFinite(prot) ? prot : null, sizes: {} });
          closeSheet(); commit(); toast(`${icon('check')} تمت الإضافة`, 'ok');
        };
        return;
      }
      if (!S.meals.length) { pane.innerHTML = `<div class="empty">قائمتك فاضية. أضف بالإدخال السريع وعلّم "احفظه في قائمتي".</div>`; return; }
      let sel = null, size = 'm', qty = 1, q = '';
      pane.innerHTML = `<div class="fields">
        <div class="search">${icon('search')}<input type="search" class="input" id="f-search" placeholder="ابحث…" autocomplete="off"></div>
        <ul class="list picks" id="f-list"></ul>
        <div class="field" id="f-size-wrap" hidden><span class="lbl">الحجم</span><div class="seg" id="f-size"></div></div>
        <div class="field"><span class="lbl">الكمية</span>
          <div class="chips" id="f-qty">${[0.5, 1, 1.5, 2, 3].map((x) => `<button data-q="${x}">${x === 0.5 ? '½' : x}</button>`).join('')}</div>
          <input class="input" id="f-qty-in" type="number" inputmode="decimal" step="0.25" min="0.25" value="1" aria-label="كمية مخصصة"></div>
        <div class="preview"><div><span class="pv-num" id="f-pv">—</span><span class="muted small"> سعرة</span></div><div class="muted small" id="f-pv-p"></div></div>
        <button class="btn primary big full" id="f-save" disabled>إضافة</button></div>`;
      const list = pane.querySelector('#f-list'), qin = pane.querySelector('#f-qty-in');
      const cur = () => (sel ? mealSizes(sel).find((s) => s.key === size) || mealSizes(sel).find((s) => s.key === 'm') : null);
      const upd = () => {
        pane.querySelectorAll('#f-qty button').forEach((b) => b.classList.toggle('on', +b.dataset.q === qty));
        const c = cur();
        pane.querySelector('#f-pv').textContent = c ? fmt(c.kcal * qty) : '—';
        pane.querySelector('#f-pv-p').textContent = c && c.protein ? `${fmt(c.protein * qty)} جم بروتين` : '';
        pane.querySelector('#f-save').disabled = !sel || !(qty > 0);
      };
      const drawSizes = () => {
        const sz = sel ? mealSizes(sel) : [];
        pane.querySelector('#f-size-wrap').hidden = sz.length < 2;
        pane.querySelector('#f-size').innerHTML = sz.map((s) => `<button data-v="${s.key}">${SIZE_LABEL[s.key]}<small> ${fmt(s.kcal)}</small></button>`).join('');
        if (!sz.some((s) => s.key === size)) size = 'm';
        seg(pane.querySelector('#f-size'), size, (v) => { size = v; upd(); });
      };
      const drawList = () => {
        const items = S.meals.filter((m) => !q || m.name.includes(q)).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
        list.innerHTML = items.length ? items.map((m) => `<li class="pick${sel?.id === m.id ? ' selected' : ''}" data-id="${m.id}">
          <div class="li-main"><div class="li-title">${esc(m.name)}</div><div class="li-sub">${mealSub(m)}</div></div>${sel?.id === m.id ? icon('check', 'ok') : ''}</li>`).join('') : '<li class="empty">ما فيه نتائج</li>';
        list.querySelectorAll('li.pick').forEach((li) => (li.onclick = () => { sel = S.meals.find((m) => m.id === li.dataset.id); size = 'm'; drawList(); drawSizes(); upd(); }));
      };
      pane.querySelector('#f-search').oninput = (e) => { q = e.target.value.trim(); drawList(); };
      pane.querySelectorAll('#f-qty button').forEach((b) => (b.onclick = () => { qty = +b.dataset.q; qin.value = qty; upd(); }));
      qin.oninput = () => { qty = num(qin.value); upd(); };
      pane.querySelector('#f-save').onclick = () => {
        const c = cur(); if (!c || !(qty > 0)) return;
        addFoodEntry(k, { name: sel.name, kcal: c.kcal, protein: c.protein, qty, size: mealSizes(sel).length > 1 ? size : undefined });
        closeSheet(); commit(); toast(`${icon('check')} تمت الإضافة`, 'ok');
      };
      drawList(); drawSizes(); upd();
    }
  }

  ACT['edit-meal'] = (t) => mealSheet(t.dataset.id ? S.meals.find((m) => m.id === t.dataset.id) : null);
  function mealSheet(meal) {
    const sz = meal?.sizes || {};
    const v = (x) => (x == null || x === '' ? '' : x);
    const body = openSheet(meal ? 'تعديل وجبة' : 'وجبة جديدة', `<div class="fields">
      <div class="field"><label for="m-name">الاسم</label><input class="input" id="m-name" type="text" autocomplete="off" value="${esc(meal?.name || '')}" placeholder="مثلاً: كبسة دجاج"></div>
      <div class="size-block"><div class="lbl">الحجم الوسط (الأساسي)</div><div class="row2">
        <div class="field"><label for="m-kcal">سعرات</label><input class="input" id="m-kcal" type="number" inputmode="numeric" min="0" value="${v(meal?.kcal)}"></div>
        <div class="field"><label for="m-prot">بروتين <span class="opt">اختياري</span></label><input class="input" id="m-prot" type="number" inputmode="decimal" min="0" value="${v(meal?.protein)}"></div></div></div>
      <details class="size-more" ${sz.s || sz.l ? 'open' : ''}><summary>أحجام إضافية (صغير / كبير) — للأكل العائلي</summary>
        <div class="size-block"><div class="lbl">صغير</div><div class="row2">
          <div class="field"><label for="m-s-kcal">سعرات</label><input class="input" id="m-s-kcal" type="number" inputmode="numeric" min="0" value="${v(sz.s?.kcal)}"></div>
          <div class="field"><label for="m-s-prot">بروتين</label><input class="input" id="m-s-prot" type="number" inputmode="decimal" min="0" value="${v(sz.s?.protein)}"></div></div></div>
        <div class="size-block"><div class="lbl">كبير</div><div class="row2">
          <div class="field"><label for="m-l-kcal">سعرات</label><input class="input" id="m-l-kcal" type="number" inputmode="numeric" min="0" value="${v(sz.l?.kcal)}"></div>
          <div class="field"><label for="m-l-prot">بروتين</label><input class="input" id="m-l-prot" type="number" inputmode="decimal" min="0" value="${v(sz.l?.protein)}"></div></div></div>
        <p class="hint">مثال: كبسة لحم — صغير 450، وسط 700، كبير 1000.</p>
      </details>
      <button class="btn primary big full" id="m-save">حفظ</button></div>`);
    const val = (id) => num(body.querySelector(id).value);
    body.querySelector('#m-save').onclick = () => {
      const name = body.querySelector('#m-name').value.trim();
      const kcal = val('#m-kcal'), prot = val('#m-prot');
      if (!name) return toast('اكتب اسم الوجبة');
      if (!(kcal >= 0 && kcal <= 10000)) return toast('أدخل سعرات الحجم الوسط');
      const mk = (kid, pid) => { const kc = val(kid), pr = val(pid); return kc > 0 && kc <= 10000 ? { kcal: Math.round(kc), protein: pr > 0 ? pr : null } : undefined; };
      const sizes = {}; const s = mk('#m-s-kcal', '#m-s-prot'), l = mk('#m-l-kcal', '#m-l-prot');
      if (s) sizes.s = s; if (l) sizes.l = l;
      const data = { name, kcal: Math.round(kcal), protein: prot > 0 ? prot : null, sizes };
      if (meal) Object.assign(meal, data); else S.meals.push({ id: uid(), ...data });
      closeSheet(); commit(); toast('تم الحفظ', 'ok');
    };
  }

  /* ---------- Activity sheet (manual) ---------- */
  ACT['add-activity'] = (t) => {
    const k = t.dataset.day || today(), w = weightFor(k);
    let type = 'walk', mode = 'min', kcalEdited = false;
    const body = openSheet('إضافة نشاط', `
      <div class="opt-list" id="a-type">
        <button data-t="walk">${icon('walk')}مشي عادي<small>~5 كم/س</small></button>
        <button data-t="brisk">${icon('walk')}مشي سريع<small>~6 كم/س</small></button>
        <button data-t="weights">${icon('dumbbell')}أوزان بالنادي<small>تمارين مقاومة</small></button>
        <button data-t="cardio">${icon('bolt')}كارديو بالنادي<small>أوبتيكال، دراجة…</small></button>
      </div>
      <div class="field" id="a-int-wrap" hidden><span class="lbl">شدة الكارديو</span>
        <div class="seg" id="a-int"><button data-v="cardio">متوسط</button><button data-v="cardio_hard">عالي</button></div></div>
      <div class="seg" id="a-mode"><button data-v="min">بالدقائق</button><button data-v="steps">بالخطوات</button></div>
      <div class="field"><label for="a-val" id="a-val-lbl">المدة (دقيقة)</label><input class="input" id="a-val" type="number" inputmode="numeric" min="1"></div>
      <div class="field"><label for="a-kcal">السعرات المحروقة (تقدير، تقدر تعدّله)</label><input class="input" id="a-kcal" type="number" inputmode="numeric" min="0"></div>
      <div class="hint" id="a-hint"></div>
      <button class="btn primary big full" id="a-save">إضافة</button>`);
    const $b = (s) => body.querySelector(s);
    const minutes = () => { const v = num($b('#a-val').value); if (!(v > 0)) return 0; return mode === 'steps' && C.EXERCISES[type].steps ? C.stepsToMinutes(v) : v; };
    const recalc = () => {
      const ex = C.EXERCISES[type], m = minutes();
      if (!kcalEdited) $b('#a-kcal').value = m ? C.exerciseKcal(ex.met, w, m) : '';
      $b('#a-hint').textContent = `الحساب: معامل MET ${ex.met} · وزنك ${fmt1(w)} كجم · ${fmt(m)} دقيقة` + (mode === 'steps' && ex.steps ? ` (كل ${C.STEPS_PER_MIN} خطوة ≈ دقيقة)` : '');
    };
    const drawType = () => {
      const base = type.startsWith('cardio') ? 'cardio' : type;
      body.querySelectorAll('#a-type button').forEach((b) => b.classList.toggle('on', b.dataset.t === base));
      $b('#a-int-wrap').hidden = base !== 'cardio';
      const canSteps = !!C.EXERCISES[type].steps;
      $b('#a-mode').hidden = !canSteps; if (!canSteps) mode = 'min';
      seg($b('#a-mode'), mode, (v) => { mode = v; $b('#a-val-lbl').textContent = mode === 'steps' ? 'عدد الخطوات' : 'المدة (دقيقة)'; recalc(); });
      $b('#a-val-lbl').textContent = mode === 'steps' ? 'عدد الخطوات' : 'المدة (دقيقة)';
      recalc();
    };
    body.querySelectorAll('#a-type button').forEach((b) => (b.onclick = () => { type = b.dataset.t; kcalEdited = false; drawType(); }));
    seg($b('#a-int'), 'cardio', (v) => { type = v; kcalEdited = false; drawType(); });
    $b('#a-val').oninput = () => { kcalEdited = false; recalc(); };
    $b('#a-kcal').oninput = () => { kcalEdited = true; };
    $b('#a-save').onclick = () => {
      const m = minutes(), kcal = num($b('#a-kcal').value);
      if (!(m > 0)) return toast(mode === 'steps' ? 'أدخل عدد الخطوات' : 'أدخل المدة');
      if (!(kcal >= 0)) return toast('أدخل السعرات');
      const entry = { id: uid(), type, minutes: Math.round(m), kcal: Math.round(kcal) };
      if (mode === 'steps' && C.EXERCISES[type].steps) {
        entry.steps = Math.round(num($b('#a-val').value));
        day(k).steps = (day(k).steps || 0) + entry.steps;
      }
      day(k).activity.push(entry); UI.fresh = entry.id;
      closeSheet(); commit(); toast(`${icon('check')} تمت الإضافة`, 'ok');
    };
    drawType();
  };

  /* ---------- Weight / waist ---------- */
  ACT.weight = (t) => {
    const k = t.dataset.day || today(), d = S.days[k], has = typeof d?.weight === 'number';
    const body = openSheet('وزن ' + (k === today() ? 'اليوم' : dmFmt.format(C.parseKey(k))), `
      <div class="field"><label for="w-in">الوزن (كجم)</label>
        <input class="input big-in" id="w-in" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="${has ? d.weight : fmt1(weightFor(k))}"></div>
      <p class="hint">أفضل وقت: الصبح بعد الحمام وقبل الأكل. التطبيق يعتمد على متوسط الأسبوع.</p>
      <button class="btn primary big full" id="w-save">حفظ</button>
      ${has ? '<button class="btn danger full" id="w-del">حذف وزن هذا اليوم</button>' : ''}`);
    body.querySelector('#w-save').onclick = () => {
      const w = num(body.querySelector('#w-in').value);
      if (!(w >= 30 && w <= 300)) return toast('أدخل وزن صحيح بين 30 و300');
      day(k).weight = Math.round(w * 10) / 10; closeSheet(); commit(); toast('تم حفظ الوزن', 'ok');
    };
    const del = body.querySelector('#w-del');
    if (del) del.onclick = () => { delete day(k).weight; pruneDay(k); closeSheet(); commit(); };
  };
  ACT.waist = () => {
    const k = today(), d = S.days[k], has = typeof d?.waist === 'number';
    const last = Object.keys(S.days).filter((x) => typeof S.days[x].waist === 'number').sort().pop();
    const body = openSheet('قياس الخصر', `
      <div class="field"><label for="ws-in">محيط الخصر (سم)</label>
        <input class="input big-in" id="ws-in" type="number" inputmode="decimal" step="0.5" min="40" max="250" value="${has ? d.waist : last ? S.days[last].waist : ''}"></div>
      <p class="hint">قِس عند مستوى السرة، بعد زفير طبيعي، والشريط ملامس بدون ضغط. مرة بالأسبوع بنفس الظروف كافية.</p>
      <button class="btn primary big full" id="ws-save">حفظ</button>
      ${has ? '<button class="btn danger full" id="ws-del">حذف قياس اليوم</button>' : ''}`);
    body.querySelector('#ws-save').onclick = () => {
      const v = num(body.querySelector('#ws-in').value);
      if (!(v >= 40 && v <= 250)) return toast('أدخل قياس صحيح');
      day(k).waist = Math.round(v * 10) / 10; closeSheet(); commit(); toast('تم الحفظ', 'ok');
    };
    const del = body.querySelector('#ws-del');
    if (del) del.onclick = () => { delete day(k).waist; pruneDay(k); closeSheet(); commit(); };
  };

  /* ================= Train ================= */
  function renderTrain() {
    const v = $('#view-train'), p = S.profile, k = today();
    const tabs = `<div class="chips-scroll" id="train-tabs">${[['today', 'تمرين اليوم'], ['programs', 'البرامج'], ['library', 'المكتبة'], ['gym', 'النادي']].map(([id, l]) => `<button data-v="${id}">${l}</button>`).join('')}</div>`;
    let html = '';
    if (UI.trainTab === 'today') {
      const plan = P.planFor(p, k), d = S.days[k] || {};
      const done = (d.activity || []).filter((a) => a.type === 'workout');
      const sched = P.weekSchedule(p, k);
      const strip = `<div class="week-strip">${sched.map((x) => {
        const did = (S.days[x.k]?.activity || []).some(C.isTraining);
        return `<div class="ws-day ${x.k === k ? 'today' : ''} ${did ? 'did' : ''} ${x.rest ? 'rest' : ''}">
          <span class="ws-wd">${wdFmt.format(C.parseKey(x.k))}</span>
          <span class="ws-dot">${did ? icon('check') : x.rest ? icon('walk') : icon(x.kind === 'hiit' ? 'bolt' : x.kind === 'strength' ? 'dumbbell' : 'refresh')}</span>
          <span class="ws-kind">${x.rest ? 'راحة' : P.KINDS[x.kind].label.split(' ')[0]}</span></div>`;
      }).join('')}</div>`;
      if (plan.rest) {
        html = `<div class="card plan-hero rest"><div class="eyebrow">الأسبوع ${plan.week + 1} · ${P.LEVELS[p.level].label}</div>
          <h2>يوم راحة نشطة</h2><p class="muted">العضلات تبني نفسها وقت الراحة. امشِ ${p.stepsGoal ? 'لين توصل ' + fmt(p.stepsGoal) + ' خطوة' : '20–30 دقيقة'}، أو سوِّ برنامج خفيف لو حاب.</p>
          <div class="actions2"><button class="btn secondary" data-act="steps">${icon('steps')} خطواتي</button><button class="btn ghost" data-act="train-tab" data-v="programs">البرامج</button></div></div>`;
      } else {
        const segs = P.buildSession(plan.def), mins = Math.round(P.totalSec(segs) / 60), b = plan.def.blocks[0];
        html = `<div class="card plan-hero">
          <div class="plan-fig">${M.figure(EX.BY_ID[b.items[0]], { dur: 2 })}</div>
          <div class="eyebrow">الأسبوع ${plan.week + 1} · ${P.LEVELS[p.level].label} · ${P.KINDS[plan.kind].label}</div>
          <h2>${esc(plan.def.title)}</h2>
          <div class="plan-meta"><span>${icon('timer')} ${mins} دقيقة</span><span>${icon('flame')} ~${fmt(C.segmentsKcal(segs, weightFor(k)))} سعرة</span><span>${icon('refresh')} ${b.rounds} جولات</span></div>
          <p class="muted small">${esc(plan.def.desc)}</p>
          <ol class="ex-mini">${b.items.map((id) => `<li data-act="ex" data-id="${id}"><span>${EX.BY_ID[id].name}</span><small>${b.work} ث</small></li>`).join('')}</ol>
          ${done.length ? `<div class="done-line">${icon('check')} خلصت تمرين اليوم (${fmt(done.reduce((s, a) => s + a.kcal, 0))} سعرة). تقدر تعيده لو تبي.</div>` : ''}
          <button class="btn primary big full" data-act="workout-preview" data-plan="${k}">${icon('play')} ${done.length ? 'ابدأ مرة ثانية' : 'ابدأ التمرين'}</button></div>`;
      }
      html += `<h2 class="section-h">هذا الأسبوع</h2>${strip}
        <div class="card row-card"><div><div class="muted small">المستوى والأيام</div><b>${P.LEVELS[p.level].label} · ${p.trainDays} أيام بالأسبوع</b></div>
        <button class="btn ghost sm" data-act="train-settings">تغيير</button></div>
        <p class="hint center">كل أسبوع يزيد وقت العمل شوي، وبعدين تدخل تمارين أصعب، والتطبيق يبدّل التمارين عشان ما تمل.</p>`;
    } else if (UI.trainTab === 'programs') {
      html = `<div class="prog-list">${P.PROGRAMS.map((d) => {
        const segs = P.buildSession(d);
        return `<button class="card prog" data-act="workout-preview" data-prog="${d.id}">
          <div class="prog-fig">${M.figure(EX.BY_ID[d.blocks[0].items[0]], { animate: false })}</div>
          <div class="prog-main"><div class="eyebrow">${P.LEVELS[d.level].label} · ${P.KINDS[d.kind].label}</div>
          <div class="prog-title">${esc(d.title)}</div><div class="muted xs">${esc(d.desc)}</div>
          <div class="plan-meta sm"><span>${icon('timer')} ${Math.round(P.totalSec(segs) / 60)} د</span><span>${icon('flame')} ~${fmt(C.segmentsKcal(segs, weightFor(k)))}</span></div></div>
          ${icon('chevL', 'chev')}</button>`;
      }).join('')}</div>`;
    } else if (UI.trainTab === 'library') {
      const cats = [['all', 'الكل'], ...Object.entries(EX.CATS)];
      const q = UI.libQ.trim();
      const list = EX.LIST.filter((e) => (UI.libCat === 'all' || e.cat === UI.libCat) && (!q || e.name.includes(q) || (e.muscles || '').includes(q)));
      html = `<div class="search">${icon('search')}<input type="search" class="input" id="lib-search" placeholder="ابحث عن تمرين أو عضلة…" value="${esc(UI.libQ)}" autocomplete="off"></div>
        <div class="chips-scroll sm" id="lib-cats">${cats.map(([id, l]) => `<button data-v="${id}">${l}</button>`).join('')}</div>
        <div class="ex-grid">${list.map((e) => `<button class="card ex-card" data-act="ex" data-id="${e.id}">
          ${M.figure(e, { animate: false })}<div class="ex-name">${e.name}</div><div class="muted xs">${EX.CATS[e.cat]}</div></button>`).join('') || '<div class="empty">ما فيه نتائج</div>'}</div>`;
    } else {
      const G = P.GYM, n = Object.values(S.days).reduce((s, d) => s + (d.activity || []).filter((a) => a.type === 'weights' && a.gymDay).length, 0);
      const next = G.nextDay(n);
      html = `<div class="card"><h2 class="card-h">${icon('gym')} برنامج النادي للمبتدئين</h2><p class="muted small">3 أيام بالأسبوع، كامل الجسم.</p>
          <ul class="bullets">${G.guide.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
        ${['A', 'B'].map((id) => `<div class="card gym-day ${id === next ? 'next' : ''}">
          <div class="gd-head"><h2 class="card-h">${G.days[id].title}</h2>${id === next ? '<span class="pill">الجلسة الجاية</span>' : ''}</div>
          <div class="muted xs">إحماء: ${esc(G.warm)}</div>
          <ul class="list gym-list">${G.days[id].items.map((it) => `<li data-act="ex" data-id="${it.ex}">
            <div class="li-fig">${M.figure(EX.BY_ID[it.ex], { animate: false })}</div>
            <div class="li-main"><div class="li-title">${EX.BY_ID[it.ex].name}</div><div class="li-sub">${it.sets} مجموعات × ${ltr(it.reps)} · راحة ${it.rest} ث</div></div>${icon('chevL', 'chev')}</li>`).join('')}</ul>
          <div class="muted xs">تبريد: ${esc(G.cool)}</div>
          <button class="btn ${id === next ? 'primary' : 'secondary'} full" data-act="log-gym" data-gd="${id}">${icon('check')} سجّل جلسة ${id}</button></div>`).join('')}`;
    }
    v.innerHTML = tabs + html;
    seg($('#train-tabs'), UI.trainTab, (x) => { UI.trainTab = x; renderTrain(); });
    if (UI.trainTab === 'library') {
      seg($('#lib-cats'), UI.libCat, (x) => { UI.libCat = x; renderTrain(); });
      const s = $('#lib-search');
      s.oninput = () => { UI.libQ = s.value; const pos = s.selectionStart; renderTrain(); const n = $('#lib-search'); n.focus(); n.setSelectionRange(pos, pos); };
    }
  }
  ACT['train-tab'] = (t) => { UI.trainTab = t.dataset.v; renderTrain(); };
  ACT['train-settings'] = () => { show('more'); setTimeout(() => $('#set-train')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); };

  ACT.ex = (t) => exerciseSheet(EX.BY_ID[t.dataset.id]);
  function exerciseSheet(e) {
    const link = (id, label) => (id && EX.BY_ID[id] ? `<button class="link" data-act="ex" data-id="${id}">${label} ←</button>` : '');
    openSheet(e.name, `
      <div class="ex-hero">${M.figure(e, { dur: 2.2 })}</div>
      <div class="pill-row"><span class="pill">${EX.CATS[e.cat]}</span><span class="pill soft">${esc(e.muscles)}</span></div>
      <div class="card"><h3 class="card-h">طريقة الأداء</h3><ol class="steps-list">${e.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>
      <div class="card"><h3 class="card-h">${icon('warn')} أخطاء شائعة</h3><ul class="bullets bad">${e.mistakes.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>
      <div class="grid2">
        <div class="card mini var"><div class="eyebrow">أسهل</div><div>${esc(e.easier)}</div>${link(e.easierId, 'افتح')}</div>
        <div class="card mini var"><div class="eyebrow">أصعب</div><div>${esc(e.harder)}</div>${link(e.harderId, 'افتح')}</div>
      </div>`);
  }

  ACT['log-gym'] = (t) => {
    const gd = t.dataset.gd, k = today(), w = weightFor(k);
    const body = openSheet(`سجّل جلسة النادي ${gd}`, `
      <div class="field"><label for="g-min">مدة الجلسة (دقيقة) — بدون الراحات الطويلة</label><input class="input" id="g-min" type="number" inputmode="numeric" min="5" max="180" value="45"></div>
      <div class="preview"><span class="pv-num" id="g-pv">0</span><span class="muted small"> سعرة (MET ${P.GYM.met})</span></div>
      <button class="btn primary big full" id="g-save">حفظ</button>`);
    const upd = () => { body.querySelector('#g-pv').textContent = fmt(C.exerciseKcal(P.GYM.met, w, num(body.querySelector('#g-min').value) || 0)); };
    body.querySelector('#g-min').oninput = upd; upd();
    body.querySelector('#g-save').onclick = () => {
      const m = num(body.querySelector('#g-min').value);
      if (!(m >= 5 && m <= 180)) return toast('أدخل المدة');
      const entry = { id: uid(), type: 'weights', gymDay: gd, title: `نادي — اليوم ${gd}`, minutes: Math.round(m), kcal: C.exerciseKcal(P.GYM.met, w, m) };
      day(k).activity.push(entry); closeSheet(); commit(); celebrate({ title: 'جلسة نادي مسجّلة 💪', minutes: entry.minutes, kcal: entry.kcal });
    };
  };

  /* ---------- Workout preview + run ---------- */
  ACT['workout-preview'] = (t) => {
    const def = t.dataset.plan ? P.planFor(S.profile, t.dataset.plan).def : P.PROGRAMS.find((x) => x.id === t.dataset.prog);
    if (!def) return;
    const segs = P.buildSession(def), w = weightFor(today());
    const work = segs.filter((s) => s.kind === 'work');
    const body = openSheet(def.title, `
      <div class="plan-meta center"><span>${icon('timer')} ${Math.round(P.totalSec(segs) / 60)} دقيقة</span><span>${icon('flame')} ~${fmt(C.segmentsKcal(segs, w))} سعرة</span><span>${icon('bolt')} ${work.length} فترة</span></div>
      <p class="muted small center">${esc(def.desc)}</p>
      <div class="card"><h3 class="card-h">${icon('sun')} إحماء (${Math.round(P.WARM.reduce((s, x) => s + x[1], 0) / 60)} د)</h3>
        <div class="tag-row">${P.WARM.map(([id, s]) => `<button class="tag" data-act="ex" data-id="${id}">${EX.BY_ID[id].name} <small>${s}ث</small></button>`).join('')}</div></div>
      ${def.blocks.map((b, i) => `<div class="card"><h3 class="card-h">${icon('bolt')} ${def.blocks.length > 1 ? `الجزء ${i + 1}: ` : 'التمرين: '}${b.rounds} جولات · ${b.work}ث عمل / ${b.rest}ث راحة</h3>
        <ul class="list gym-list">${b.items.map((id) => `<li data-act="ex" data-id="${id}"><div class="li-fig">${M.figure(EX.BY_ID[id], { animate: false })}</div>
          <div class="li-main"><div class="li-title">${EX.BY_ID[id].name}</div><div class="li-sub">${esc(EX.BY_ID[id].muscles)}</div></div>${icon('chevL', 'chev')}</li>`).join('')}</ul></div>`).join('')}
      <div class="card"><h3 class="card-h">${icon('moon')} تبريد (${Math.round(P.COOL.reduce((s, x) => s + x[1], 0) / 60)} د)</h3>
        <div class="tag-row">${P.COOL.map(([id, s]) => `<button class="tag" data-act="ex" data-id="${id}">${EX.BY_ID[id].name} <small>${s}ث</small></button>`).join('')}</div></div>
      <label class="check"><input type="checkbox" id="wp-sound" ${S.settings.sound ? 'checked' : ''}> صوت تنبيه عند التبديل</label>
      <p class="hint">الصوت ما يشتغل لو الجوال على الصامت. الشاشة تبقى صاحية أثناء التمرين إذا جهازك يدعم.</p>
      <button class="btn primary big full sticky-cta" id="wp-start">${icon('play')} ابدأ</button>`);
    body.querySelector('#wp-sound').onchange = (e) => { S.settings.sound = e.target.checked; save(); };
    body.querySelector('#wp-start').onclick = () => {
      closeSheet(true);
      M.Timer.start(def, { weight: w, sound: S.settings.sound, onFinish: onWorkoutDone });
    };
  };
  function onWorkoutDone(r) {
    if (r.activeSec < 30) { toast('التمرين قصير جداً وما انسجل'); return; }
    const k = today();
    const entry = { id: uid(), type: 'workout', programId: r.programId, title: r.title, minutes: r.minutes, kcal: r.kcal, completed: r.completed };
    day(k).activity.push(entry);
    save(); render(); checkAchievements();
    celebrate({ title: r.completed ? 'عاش! خلصت التمرين 🔥' : 'سجّلنا اللي سويته 👏', minutes: r.minutes, kcal: r.kcal, credit: Math.round(r.kcal * S.settings.exerciseRatio) });
  }
  function celebrate({ title, minutes, kcal, credit }) {
    const c = $('#celebrate');
    $('#cel-title').textContent = title;
    $('#cel-stats').innerHTML = `<div><b>${fmt(minutes)}</b><span>دقيقة</span></div><div><b>${fmt(kcal)}</b><span>سعرة محروقة</span></div>${credit != null ? `<div><b>${ltr('+' + fmt(credit))}</b><span>لرصيدك اليوم</span></div>` : ''}`;
    c.hidden = false; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
    confetti(140);
  }
  $('#cel-ok').onclick = () => { $('#celebrate').hidden = true; };

  /* ================= Progress ================= */
  function renderProgress() {
    const v = $('#view-progress');
    const tabs = `<div class="chips-scroll" id="prog-tabs">${[['weight', 'الوزن'], ['report', 'التقرير'], ['measure', 'الخصر'], ['photos', 'الصور'], ['badges', 'الإنجازات']].map(([id, l]) => `<button data-v="${id}">${l}</button>`).join('')}</div>`;
    v.innerHTML = tabs + '<div id="prog-body"></div>';
    seg($('#prog-tabs'), UI.progTab, (x) => { UI.progTab = x; renderProgress(); });
    const b = $('#prog-body');
    ({ weight: progWeight, report: progReport, measure: progWaist, photos: progPhotos, badges: progBadges })[UI.progTab](b);
  }

  function progWeight(b) {
    const p = S.profile;
    const ws = C.weightKeys(S.days).map((k) => ({ k, w: S.days[k].weight }));
    const first = ws.length ? ws[0].w : p.startWeight, current = ws.length ? ws[ws.length - 1].w : p.startWeight;
    const avg = C.avgWeight(S.days, today(), 7);
    const ref = avg.n >= 3 ? avg.avg : current;
    const lost = first - ref, left = ref - p.targetWeight;
    const pct = first > p.targetWeight ? Math.max(0, Math.min(100, ((first - ref) / (first - p.targetWeight)) * 100)) : 100;
    b.innerHTML = `
      <div class="card goal-prog"><div class="gp-top"><div><div class="muted xs">من ${fmt1(first)} إلى ${fmt1(p.targetWeight)} كجم</div><b>${Math.round(pct)}%</b> من الطريق</div>
        <button class="btn primary sm" data-act="weight" data-day="${today()}">${icon('plus')} وزن</button></div>
        <div class="bar big"><i style="width:${pct}%"></i></div></div>
      <div class="grid2">
        <div class="stat"><div class="v">${fmt1(current)} <small>كجم</small></div><div class="l">آخر وزن</div></div>
        <div class="stat"><div class="v">${avg.n ? fmt1(avg.avg) : '—'} <small>كجم</small></div><div class="l">متوسط 7 أيام (${avg.n} قياسات)</div></div>
        <div class="stat ${lost > 0 ? 'good' : ''}"><div class="v">${lost >= 0 ? fmt1(lost) : ltr('+' + fmt1(-lost))} <small>كجم</small></div><div class="l">${lost >= 0 ? 'نزلت' : 'زدت'} (بالمتوسط)</div></div>
        <div class="stat"><div class="v">${left > 0 ? fmt1(left) : '0'} <small>كجم</small></div><div class="l">${left > 0 ? 'باقي للهدف' : 'وصلت هدفك 🎉'}</div></div>
      </div>
      <div class="card"><h2 class="card-h">منحنى الوزن</h2>
        <div class="chart">${ws.length >= 2 ? weightChart(ws, p.targetWeight) : '<div class="empty">سجّل وزنك في يومين على الأقل عشان يطلع الرسم.</div>'}</div>
        ${ws.length >= 2 ? '<div class="legend"><span><i class="lg lg-dot"></i>الوزن اليومي</span><span><i class="lg lg-avg"></i>متوسط 7 أيام</span><span><i class="lg lg-goal"></i>الهدف</span></div>' : ''}</div>
      ${(p.adjustLog || []).length ? `<div class="card"><h2 class="card-h">${icon('refresh')} التعديلات الأسبوعية على هدفك</h2>
        <ul class="plain">${p.adjustLog.slice().reverse().map((a) => `<li><span>${dmFmt.format(C.parseKey(a.date))}</span><b class="${a.delta < 0 ? 'neg' : 'pos'}">${sign(a.delta, fmt)} سعرة</b></li>`).join('')}</ul></div>` : ''}
      <div class="card"><h2 class="card-h">آخر القياسات</h2>
        <ul class="plain">${ws.slice(-10).reverse().map((x) => `<li><span>${dFmt.format(C.parseKey(x.k))}</span><b>${fmt1(x.w)} كجم</b></li>`).join('') || '<li class="empty">—</li>'}</ul></div>`;
  }

  function weightChart(ws, target) {
    const W = 340, H = 210, L = 10, R = 38, T = 14, B = 26;
    const t0 = C.parseKey(ws[0].k).getTime(), t1 = C.parseKey(ws[ws.length - 1].k).getTime();
    const avgPts = ws.map((p) => ({ k: p.k, w: C.avgWeight(S.days, p.k, 7).avg }));
    let lo = Math.min(...ws.map((x) => x.w)), hi = Math.max(...ws.map((x) => x.w));
    if (target >= lo - 3 && target < lo) lo = target;
    const padY = Math.max(0.5, (hi - lo) * 0.12); lo -= padY; hi += padY;
    const x = (k) => W - R - ((C.parseKey(k).getTime() - t0) / Math.max(1, t1 - t0)) * (W - L - R);
    const y = (w) => T + (1 - (w - lo) / (hi - lo)) * (H - T - B);
    let g = '';
    for (let i = 0; i <= 4; i++) { const v = lo + ((hi - lo) * i) / 4, yy = y(v); g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" class="grid"/><text x="${W - R + 6}" y="${yy + 4}">${fmt1(v)}</text>`; }
    if (target >= lo && target <= hi) g += `<line x1="${L}" x2="${W - R}" y1="${y(target)}" y2="${y(target)}" class="goal-line"/><text x="${L}" y="${y(target) - 5}" class="goal-t">الهدف</text>`;
    const pts = (arr) => arr.map((p) => `${x(p.k).toFixed(1)},${y(p.w).toFixed(1)}`).join(' ');
    const area = `${x(ws[0].k).toFixed(1)},${H - B} ${pts(avgPts)} ${x(ws[ws.length - 1].k).toFixed(1)},${H - B}`;
    const idx = [0, Math.floor((ws.length - 1) / 2), ws.length - 1].filter((v, i, a) => a.indexOf(v) === i);
    const xl = idx.map((i) => `<text x="${x(ws[i].k)}" y="${H - 6}" text-anchor="${i === 0 ? 'end' : i === ws.length - 1 ? 'start' : 'middle'}">${dm(ws[i].k)}</text>`).join('');
    const dots = ws.length <= 60 ? ws.map((p) => `<circle cx="${x(p.k)}" cy="${y(p.w)}" r="2.8" class="dot"/>`).join('') : '';
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="رسم الوزن">
      <defs><linearGradient id="wg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--brand)" stop-opacity=".28"/><stop offset="1" stop-color="var(--brand)" stop-opacity="0"/></linearGradient></defs>
      ${g}<polygon points="${area}" fill="url(#wg)"/>${dots}
      <polyline points="${pts(avgPts)}" class="avg-line draw"/>${xl}</svg>`;
  }

  function weekBars(endKey) {
    const ratio = S.settings.exerciseRatio, rows = [];
    for (let i = 6; i >= 0; i--) {
      const k = C.addDays(endKey, -i), d = S.days[k], goal = goalInfo(k).goal, t = C.dayTotals(d, goal, ratio);
      rows.push({ k, eaten: t.food, budget: t.budget, logged: !!d?.food?.length });
    }
    const W = 340, H = 180, L = 8, R = 8, T = 18, B = 34;
    const max = Math.max(...rows.map((r) => Math.max(r.eaten, r.budget)), 1) * 1.1, bw = (W - L - R) / 7;
    const y = (v) => T + (1 - v / max) * (H - T - B);
    let s = '';
    rows.forEach((r, i) => {
      const x0 = L + (6 - i) * bw, cx = x0 + bw / 2, over = r.eaten > r.budget;
      if (r.logged) {
        s += `<rect x="${x0 + bw * 0.22}" y="${y(r.eaten)}" width="${bw * 0.56}" height="${H - B - y(r.eaten)}" rx="6" class="${over ? 'bar-over' : 'bar-ok'} grow" style="animation-delay:${i * 40}ms"/>`;
        s += `<text x="${cx}" y="${y(r.eaten) - 5}" text-anchor="middle">${fmt(r.eaten)}</text>`;
      } else s += `<text x="${cx}" y="${H - B - 6}" text-anchor="middle">—</text>`;
      s += `<line x1="${x0 + bw * 0.12}" x2="${x0 + bw * 0.88}" y1="${y(r.budget)}" y2="${y(r.budget)}" class="budget-line"/>`;
      s += `<text x="${cx}" y="${H - 18}" text-anchor="middle">${wdFmt.format(C.parseKey(r.k))}</text><text x="${cx}" y="${H - 4}" text-anchor="middle">${dm(r.k)}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="الأكل مقابل الهدف">${s}</svg>`;
  }

  function progReport(b) {
    const end = C.addDays(today(), -7 * UI.reportOffset);
    const r = C.weeklyReport(S, end);
    const p = S.profile, prot = C.proteinTarget(p);
    const goalAvg = Math.round([0, 1, 2, 3, 4, 5, 6].reduce((s, i) => s + goalInfo(C.addDays(end, -i)).goal, 0) / 7);
    b.innerHTML = `
      <div class="daynav"><button class="icon-btn" data-act="report" data-d="1" aria-label="الأسبوع السابق">${icon('chevR')}</button>
        <div class="day-label">${dmFmt.format(C.parseKey(r.start))} – ${dmFmt.format(C.parseKey(r.end))}</div>
        <button class="icon-btn" data-act="report" data-d="-1" ${UI.reportOffset === 0 ? 'disabled' : ''} aria-label="الأسبوع التالي">${icon('chevL')}</button></div>
      <div class="grid2">
        <div class="stat"><div class="v">${r.avgWeight != null ? fmt1(r.avgWeight) : '—'} <small>كجم</small></div><div class="l">متوسط الوزن${r.weightDelta != null ? ` · <b class="${r.weightDelta <= 0 ? 'pos' : 'neg'}">${sign(r.weightDelta)}</b>` : ''}</div></div>
        <div class="stat"><div class="v">${ltr(`${r.within}<small>/${r.logged || 0}</small>`)}</div><div class="l">أيام ضمن السعرات</div></div>
        <div class="stat"><div class="v">${r.avgKcal != null ? fmt(r.avgKcal) : '—'}</div><div class="l">متوسط الأكل · الهدف ${fmt(goalAvg)}</div></div>
        <div class="stat"><div class="v">${r.avgProtein != null ? fmt(r.avgProtein) : '—'} <small>جم</small></div><div class="l">متوسط البروتين (هدف ${prot})</div></div>
        <div class="stat"><div class="v">${ltr(`${r.workouts}<small>/${p.trainDays}</small>`)}</div><div class="l">تمارين · ${fmt(r.workoutMin)} د · ${fmt(r.workoutKcal)} سعرة</div></div>
        <div class="stat"><div class="v">${r.waist != null ? fmt1(r.waist) : '—'} <small>سم</small></div><div class="l">الخصر${r.waistDelta != null ? ` · <b class="${r.waistDelta <= 0 ? 'pos' : 'neg'}">${sign(r.waistDelta)}</b>` : ''}</div></div>
        <div class="stat"><div class="v">${r.avgSteps != null ? fmt(r.avgSteps) : '—'}</div><div class="l">متوسط الخطوات</div></div>
        <div class="stat"><div class="v">${r.avgWater != null ? fmt1(r.avgWater / 1000) : '—'} <small>لتر</small></div><div class="l">متوسط الماء</div></div>
      </div>
      <div class="card"><h2 class="card-h">الأكل مقابل الهدف</h2><div class="chart">${weekBars(end)}</div>
        <div class="legend"><span><i class="lg lg-ok"></i>ضمن الهدف</span><span><i class="lg lg-over"></i>فوق</span><span><i class="lg lg-goal"></i>الهدف + الرياضة</span></div></div>
      <div class="card summary-card">${reportSummary(r)}</div>`;
  }
  function reportSummary(r) {
    const out = [];
    if (r.weightDelta != null) out.push(r.weightDelta < -0.05 ? `نزل متوسط وزنك ${fmt1(-r.weightDelta)} كجم 👏` : r.weightDelta > 0.05 ? `ارتفع المتوسط ${fmt1(r.weightDelta)} كجم. غالباً ماء أو ملح؛ راقب الأسبوع الجاي.` : 'متوسط وزنك ثابت هالأسبوع.');
    else out.push('تحتاج 3 قياسات وزن على الأقل بالأسبوع عشان نقارن المتوسط.');
    if (r.logged) out.push(`التزمت بالسعرات ${r.within} من ${r.logged} أيام مسجلة.`);
    out.push(r.workouts >= S.profile.trainDays ? `خلصت كل تمارين الأسبوع (${r.workouts}) 💪` : `تمارينك ${r.workouts} من ${S.profile.trainDays}.`);
    return `<h2 class="card-h">${icon('spark')} الخلاصة</h2><ul class="bullets">${out.map((x) => `<li>${x}</li>`).join('')}</ul>`;
  }
  ACT.report = (t) => { UI.reportOffset = Math.max(0, UI.reportOffset + +t.dataset.d); renderProgress(); };

  function progWaist(b) {
    const ks = Object.keys(S.days).filter((k) => typeof S.days[k].waist === 'number').sort();
    const pts = ks.map((k) => ({ k, w: S.days[k].waist }));
    b.innerHTML = `<div class="card row-card"><div><div class="muted small">آخر قياس للخصر</div><div class="weight-val">${pts.length ? fmt1(pts[pts.length - 1].w) + ' <small>سم</small>' : '—'}</div>
      ${pts.length >= 2 ? `<div class="muted xs">التغيير من البداية: <b class="${pts[pts.length - 1].w <= pts[0].w ? 'pos' : 'neg'}">${sign(pts[pts.length - 1].w - pts[0].w)} سم</b></div>` : ''}</div>
      <button class="btn primary sm" data-act="waist">${icon('ruler')} قياس</button></div>
      <div class="card"><h2 class="card-h">منحنى الخصر</h2><div class="chart">${pts.length >= 2 ? miniLine(pts) : '<div class="empty">سجّل قياسين على الأقل.</div>'}</div></div>
      <div class="card"><ul class="plain">${pts.slice().reverse().map((x) => `<li><span>${dFmt.format(C.parseKey(x.k))}</span><b>${fmt1(x.w)} سم</b></li>`).join('') || '<li class="empty">ما فيه قياسات</li>'}</ul></div>
      <p class="hint center">الخصر مؤشر ممتاز للدهون، خصوصاً لما الوزن يثبت وأنت تتمرن.</p>`;
  }
  function miniLine(pts) {
    const W = 340, H = 150, L = 10, R = 34, T = 12, B = 22;
    const t0 = C.parseKey(pts[0].k).getTime(), t1 = C.parseKey(pts[pts.length - 1].k).getTime();
    let lo = Math.min(...pts.map((p) => p.w)), hi = Math.max(...pts.map((p) => p.w)); const pad = Math.max(1, (hi - lo) * 0.15); lo -= pad; hi += pad;
    const x = (k) => W - R - ((C.parseKey(k).getTime() - t0) / Math.max(1, t1 - t0)) * (W - L - R), y = (w) => T + (1 - (w - lo) / (hi - lo)) * (H - T - B);
    let g = ''; for (let i = 0; i <= 3; i++) { const v = lo + ((hi - lo) * i) / 3; g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${W - R + 6}" y="${y(v) + 4}">${fmt1(v)}</text>`; }
    return `<svg viewBox="0 0 ${W} ${H}">${g}<polyline class="avg-line draw" points="${pts.map((p) => `${x(p.k).toFixed(1)},${y(p.w).toFixed(1)}`).join(' ')}"/>${pts.map((p) => `<circle class="dot" r="3" cx="${x(p.k)}" cy="${y(p.w)}"/>`).join('')}
      <text x="${x(pts[0].k)}" y="${H - 4}" text-anchor="end">${dm(pts[0].k)}</text><text x="${x(pts[pts.length - 1].k)}" y="${H - 4}" text-anchor="start">${dm(pts[pts.length - 1].k)}</text></svg>`;
  }

  /* ---------- Photos (IndexedDB only) ---------- */
  let photoURLs = [];
  const freeURLs = () => { photoURLs.forEach((u) => URL.revokeObjectURL(u)); photoURLs = []; };
  const purl = (blob) => { const u = URL.createObjectURL(blob); photoURLs.push(u); return u; };
  async function progPhotos(b) {
    b.innerHTML = '<div class="empty">…</div>';
    let ps = [];
    try { ps = await Store.Photos.all(); } catch { b.innerHTML = '<div class="empty">التخزين ما يدعم الصور في هذا المتصفح.</div>'; return; }
    if (UI.progTab !== 'photos' || UI.view !== 'progress') return;
    freeURLs();
    b.innerHTML = `<div class="card"><p class="muted small">${icon('lock')} الصور تنحفظ في جهازك بس، وما ترتفع لأي مكان.</p>
        <div class="actions2"><button class="btn primary" data-act="photo-add">${icon('camera')} صورة جديدة</button>
        <button class="btn secondary" data-act="photo-compare" ${ps.length < 2 ? 'disabled' : ''}>قبل / بعد</button></div>
        <input type="file" id="photo-file" accept="image/*" hidden></div>
      <div class="photo-grid">${ps.slice().reverse().map((p) => `<button class="ph" data-act="photo-view" data-id="${p.id}"><img alt="" src="${purl(p.blob)}"><span>${dm(p.date)}</span></button>`).join('') || '<div class="empty">ما فيه صور. صوّر نفسك بنفس المكان والإضاءة كل أسبوعين.</div>'}</div>`;
    $('#photo-file').onchange = async (e) => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      try {
        const blob = await Store.downscale(f);
        await Store.Photos.add({ id: 'ph_' + uid(), date: today(), note: '', blob });
        toast('انحفظت الصورة في جهازك', 'ok'); renderProgress(); checkAchievements();
      } catch { toast('ما قدرنا نقرأ الصورة', 'warn'); }
    };
  }
  ACT['photo-add'] = () => $('#photo-file')?.click();
  ACT['photo-view'] = async (t) => {
    const ps = await Store.Photos.all(), p = ps.find((x) => x.id === t.dataset.id);
    if (!p) return;
    const body = openSheet(fullFmt.format(C.parseKey(p.date)), `<img class="photo-full" alt="" src="${purl(p.blob)}">
      <button class="btn danger full" id="ph-del">${icon('trash')} حذف الصورة</button>`);
    body.querySelector('#ph-del').onclick = () => confirmDo('تحذف الصورة؟', 'ما يمكن التراجع.', 'حذف', async () => { await Store.Photos.del(p.id); closeSheet(); renderProgress(); }, true);
  };
  ACT['photo-compare'] = async () => {
    const ps = await Store.Photos.all();
    if (ps.length < 2) return;
    const opts = (sel) => ps.map((p, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${fullFmt.format(C.parseKey(p.date))}</option>`).join('');
    const body = openSheet('قبل / بعد', `
      <div class="row2"><div class="field"><label for="cmp-a">قبل</label><select class="input" id="cmp-a">${opts(0)}</select></div>
        <div class="field"><label for="cmp-b">بعد</label><select class="input" id="cmp-b">${opts(ps.length - 1)}</select></div></div>
      <div class="compare" id="cmp"><img id="cmp-img-a" alt="قبل"><img id="cmp-img-b" alt="بعد"><div class="cmp-handle" id="cmp-h"></div>
        <span class="cmp-tag a">قبل</span><span class="cmp-tag b">بعد</span></div>
      <input type="range" id="cmp-r" min="0" max="100" value="50" aria-label="مقارنة">`);
    const setImgs = () => { body.querySelector('#cmp-img-a').src = purl(ps[+body.querySelector('#cmp-a').value].blob); body.querySelector('#cmp-img-b').src = purl(ps[+body.querySelector('#cmp-b').value].blob); };
    const setPos = (v) => { body.querySelector('#cmp-img-b').style.clipPath = `inset(0 0 0 ${v}%)`; body.querySelector('#cmp-h').style.left = v + '%'; };
    body.querySelector('#cmp-a').onchange = setImgs; body.querySelector('#cmp-b').onchange = setImgs;
    body.querySelector('#cmp-r').oninput = (e) => setPos(e.target.value);
    setImgs(); setPos(50);
  };

  async function progBadges(b) {
    const got = S.achievements;
    b.innerHTML = `<div class="badge-grid">${C.ACHIEVEMENTS.map((a) => `<div class="badge ${got[a.id] ? 'on' : ''}">
      <div class="bd-ic">${icon(got[a.id] ? a.icon : 'lock')}</div><div class="bd-t">${a.title}</div><div class="bd-d">${a.desc}</div>
      ${got[a.id] ? `<div class="bd-date">${dmFmt.format(C.parseKey(got[a.id]))}</div>` : ''}</div>`).join('')}</div>
      <p class="hint center">أعلى سلسلة أيام: ${C.maxStreak(S.days)} · تمارين: ${C.countWorkouts(S.days)}</p>`;
  }

  /* ================= More / settings ================= */
  function renderMore() {
    const p = S.profile, g = goalInfo(today());
    const rateTxt = p.rateMode === 'pct' ? `سريع 1% (${fmt1(g.kg ?? C.rateKg(p, weightFor(today())))} كجم)` : `${p.ratePerWeek} كجم`;
    $('#view-more').innerHTML = `
      <div class="card"><h2 class="card-h">${icon('user')} الملف والهدف</h2>
        <div class="kv"><span>الهدف اليومي</span><b>${fmt(g.goal)} سعرة${g.manual ? ' (يدوي)' : ''}</b></div>
        <div class="kv"><span>البروتين</span><b>${C.proteinTarget(p)} جم/يوم</b></div>
        <div class="kv"><span>سرعة النزول</span><b>${rateTxt}/أسبوع</b></div>
        <div class="kv"><span>الوزن المستهدف</span><b>${fmt1(p.targetWeight)} كجم</b></div>
        ${!g.manual && g.adjust ? `<div class="kv"><span>تعديلات أسبوعية</span><b>${sign(g.adjust, fmt)} سعرة</b></div>` : ''}
        <button class="btn secondary full" data-act="edit-profile">تعديل الملف الشخصي</button>
        ${(p.adjustLog || []).length ? '<button class="btn ghost full" data-act="reset-adjust">إلغاء التعديلات الأسبوعية</button>' : ''}</div>
      <div class="card" id="set-train"><h2 class="card-h">${icon('dumbbell')} التمارين</h2>
        <div class="field"><span class="lbl">المستوى</span><div class="seg" id="set-level">${Object.entries(P.LEVELS).map(([k, l]) => `<button data-v="${k}">${l.label}</button>`).join('')}</div></div>
        <div class="field"><span class="lbl">أيام التمرين بالأسبوع</span><div class="seg" id="set-days"><button data-v="3">3</button><button data-v="4">4</button><button data-v="5">5</button></div></div>
        <div class="field"><label for="set-steps">هدف الخطوات اليومي</label><input class="input" id="set-steps" type="number" inputmode="numeric" min="1000" max="40000" step="500" value="${p.stepsGoal || ''}" placeholder="مثلاً 8000"></div>
        <div class="field"><label for="set-water">هدف الماء (أكواب 250 مل)</label><input class="input" id="set-water" type="number" inputmode="numeric" min="2" max="20" value="${Math.round(p.waterGoal / 250)}"></div>
        <label class="check"><input type="checkbox" id="set-sound" ${S.settings.sound ? 'checked' : ''}> صوت المؤقت</label></div>
      <div class="card"><h2 class="card-h">${icon('bolt')} سعرات الرياضة المضافة للرصيد</h2>
        <div class="seg" id="seg-ratio"><button data-v="0">0%</button><button data-v="0.5">50%</button><button data-v="1">100%</button></div>
        <p class="muted small">التقديرات غالباً أعلى من الحقيقة، عشان كذا الافتراضي 50%.</p></div>
      <div class="card"><h2 class="card-h">${icon('moon')} المظهر</h2>
        <div class="seg" id="seg-theme"><button data-v="dark">داكن</button><button data-v="auto">تلقائي</button><button data-v="light">فاتح</button></div></div>
      <div class="card"><h2 class="card-h">${icon('download')} النسخ الاحتياطي</h2>
        <label class="check"><input type="checkbox" id="exp-photos"> تضمين صور التقدّم (الملف بيكبر)</label>
        <button class="btn secondary full" data-act="export">${icon('share')} تصدير نسخة احتياطية</button>
        <button class="btn secondary full" data-act="import">${icon('upload')} استيراد نسخة احتياطية</button>
        <input type="file" id="import-file" accept="application/json,.json" hidden>
        <p class="muted small" id="persist-status"></p></div>
      <div class="card"><button class="btn danger full" data-act="wipe">${icon('trash')} مسح كل البيانات</button></div>
      <p class="muted xs center">ميزان ${VERSION} · بياناتك في جهازك فقط</p>`;
    seg($('#set-level'), p.level, (v) => { p.level = v; save(); toast(`المستوى: ${P.LEVELS[v].label}`, 'ok'); });
    seg($('#set-days'), p.trainDays, (v) => { p.trainDays = +v; save(); toast(`${v} أيام بالأسبوع`, 'ok'); });
    $('#set-steps').onchange = (e) => { const v = num(e.target.value); p.stepsGoal = v >= 1000 && v <= 40000 ? Math.round(v) : null; save(); toast('تم الحفظ', 'ok'); };
    $('#set-water').onchange = (e) => { const v = num(e.target.value); if (v >= 2 && v <= 20) { p.waterGoal = Math.round(v) * 250; save(); toast('تم الحفظ', 'ok'); } };
    $('#set-sound').onchange = (e) => { S.settings.sound = e.target.checked; save(); };
    seg($('#seg-ratio'), S.settings.exerciseRatio, (v) => { S.settings.exerciseRatio = +v; save(); toast('تم الحفظ', 'ok'); });
    seg($('#seg-theme'), S.settings.theme, (v) => { S.settings.theme = v; save(); applyTheme(); });
    $('#import-file').onchange = importFile;
    persistStatus();
  }
  ACT['edit-profile'] = () => profileSheet(false);
  ACT['reset-adjust'] = () => confirmDo('تلغي كل التعديلات الأسبوعية؟', 'هدفك يرجع لحسبة المعادلة.', 'إلغاء التعديلات', () => { S.profile.adjustLog = []; commit(); }, true);

  /* ---------- Profile sheet ---------- */
  function profileSheet(first) {
    const p = S.profile || { sex: 'm', age: '', heightCm: '', targetWeight: '', activity: 'sedentary', ratePerWeek: 0.5, rateMode: 'kg', manualGoal: null, level: 'beginner', trainDays: 4 };
    const curW = S.profile ? weightFor(today()) : '';
    const st = { sex: p.sex, activity: p.activity, rate: p.rateMode === 'pct' ? 'pct' : String(p.ratePerWeek), manual: !!p.manualGoal, level: p.level, days: p.trainDays };
    const body = openSheet(first ? 'أهلاً في ميزان' : 'الملف الشخصي', `<div class="fields">
      ${first ? '<p class="muted">خلنا نحسب هدفك اليومي ونجهّز برنامج تمارينك. كل شي ينحفظ في جهازك.</p>' : ''}
      <div class="field"><span class="lbl">الجنس</span><div class="seg" id="p-sex"><button data-v="m">ذكر</button><button data-v="f">أنثى</button></div></div>
      <div class="row2"><div class="field"><label for="p-age">العمر</label><input class="input" id="p-age" type="number" inputmode="numeric" min="14" max="100" value="${p.age}"></div>
        <div class="field"><label for="p-h">الطول (سم)</label><input class="input" id="p-h" type="number" inputmode="numeric" min="120" max="230" value="${p.heightCm}"></div></div>
      <div class="row2"><div class="field"><label for="p-w">الوزن الحالي (كجم)</label><input class="input" id="p-w" type="number" inputmode="decimal" step="0.1" value="${curW === '' ? '' : fmt1(curW)}"></div>
        <div class="field"><label for="p-t">الوزن المستهدف</label><input class="input" id="p-t" type="number" inputmode="decimal" step="0.1" value="${p.targetWeight}"></div></div>
      <div class="field"><span class="lbl">نشاطك اليومي (بدون الرياضة)</span>
        <div class="opt-list" id="p-act">${Object.entries(C.ACTIVITY).map(([k, a]) => `<button data-v="${k}">${a.label}<small>${a.hint}</small></button>`).join('')}</div></div>
      <div class="field"><span class="lbl">سرعة النزول بالأسبوع</span>
        <div class="seg" id="p-rate">${C.RATES.map((r) => `<button data-v="${r}">${r} كجم</button>`).join('')}<button data-v="pct">سريع 1%</button></div>
        <div class="hint" id="p-rate-hint"></div></div>
      <label class="check"><input type="checkbox" id="p-man" ${st.manual ? 'checked' : ''}> أبي أكتب هدفي اليومي بنفسي</label>
      <div class="field" id="p-man-wrap" ${st.manual ? '' : 'hidden'}><label for="p-goal">الهدف اليومي (سعرة)</label>
        <input class="input" id="p-goal" type="number" inputmode="numeric" min="800" max="6000" value="${p.manualGoal || ''}"></div>
      <div class="note" id="p-calc"></div>
      <div class="field"><span class="lbl">مستوى التمارين</span><div class="seg" id="p-level">${Object.entries(P.LEVELS).map(([k, l]) => `<button data-v="${k}">${l.label}</button>`).join('')}</div></div>
      <div class="field"><span class="lbl">أيام التمرين بالأسبوع</span><div class="seg" id="p-days"><button data-v="3">3</button><button data-v="4">4</button><button data-v="5">5</button></div></div>
      <button class="btn primary big full" id="p-save">${first ? 'ابدأ' : 'حفظ'}</button></div>`, { locked: first });
    const $b = (s) => body.querySelector(s);
    const read = () => ({
      sex: st.sex, age: num($b('#p-age').value), heightCm: num($b('#p-h').value), weight: num($b('#p-w').value), targetWeight: num($b('#p-t').value),
      activity: st.activity, rateMode: st.rate === 'pct' ? 'pct' : 'kg', ratePerWeek: st.rate === 'pct' ? 0.5 : +st.rate, manualGoal: st.manual ? num($b('#p-goal').value) : null
    });
    const valid = (v) => v.age >= 14 && v.age <= 100 && v.heightCm >= 120 && v.heightCm <= 230 && v.weight >= 30 && v.weight <= 300 && v.targetWeight >= 30 && v.targetWeight <= 300;
    const calc = () => {
      const v = read(), el = $b('#p-calc');
      el.className = 'note';
      const w = v.weight >= 30 ? v.weight : null;
      const kg = v.rateMode === 'pct' ? (w ? w * C.PCT_RATE : null) : v.ratePerWeek;
      $b('#p-rate-hint').innerHTML = kg ? `يعني <b>${fmt1(kg)} كجم</b> بالأسبوع · عجز <b>${fmt(C.dailyDeficit(kg))}</b> سعرة باليوم${v.rateMode === 'pct' ? ' (يتغير مع وزنك)' : ''}` : 'اكتب وزنك عشان نحسب';
      if (!valid(v)) { el.textContent = 'عبّ البيانات عشان نحسب هدفك اليومي.'; return; }
      const a = C.goalFor({ ...v, manualGoal: null, adjustLog: [] }, v.weight);
      let html = `معدل الحرق الأساسي (BMR): <b>${fmt(a.bmr)}</b><br>احتياجك اليومي: <b>${fmt(a.tdee)}</b><br>العجز: <b>${fmt(a.deficit)}</b><br>`;
      html += st.manual && v.manualGoal > 0 ? `هدفك اليومي (يدوي): <b>${fmt(v.manualGoal)}</b> سعرة` : `هدفك اليومي: <b>${fmt(a.goal)}</b> سعرة`;
      html += `<br>هدف البروتين: <b>${Math.round(1.6 * v.targetWeight)}</b> جم/يوم`;
      if (!st.manual && a.floored) { html += `<br><br>⚠️ <b>تنبيه:</b> هالسرعة تحتاج ${fmt(a.planned)} سعرة، وهو أقل من الحد الأدنى الآمن ${fmt(a.min)}. بنثبت هدفك على ${fmt(a.min)}، فنزولك المتوقع حوالي <b>${fmt1(a.realKg)} كجم</b> بالأسبوع. جرّب سرعة أبطأ.`; el.classList.add('warn'); }
      if (st.manual && v.manualGoal > 0 && v.manualGoal < C.MIN_GOAL[v.sex]) { html += `<br><br>⚠️ أقل من الحد الأدنى المنصوح (${fmt(C.MIN_GOAL[v.sex])}).`; el.classList.add('warn'); }
      el.innerHTML = html;
    };
    seg($b('#p-sex'), st.sex, (v) => { st.sex = v; calc(); });
    seg($b('#p-act'), st.activity, (v) => { st.activity = v; calc(); });
    seg($b('#p-rate'), st.rate, (v) => { st.rate = v; calc(); });
    seg($b('#p-level'), st.level, (v) => { st.level = v; });
    seg($b('#p-days'), st.days, (v) => { st.days = +v; });
    $b('#p-man').onchange = (e) => { st.manual = e.target.checked; $b('#p-man-wrap').hidden = !st.manual; calc(); };
    body.querySelectorAll('input').forEach((i) => i.addEventListener('input', calc));
    calc();
    $b('#p-save').onclick = () => {
      const v = read();
      if (!valid(v)) return toast('تأكد من العمر والطول والوزن');
      if (st.manual && !(v.manualGoal >= 800 && v.manualGoal <= 6000)) return toast('أدخل هدف يومي بين 800 و6000');
      const t = today(), old = S.profile;
      S.profile = {
        ...(old || {}),
        sex: v.sex, age: Math.round(v.age), heightCm: Math.round(v.heightCm),
        startWeight: old?.startWeight ?? Math.round(v.weight * 10) / 10,
        targetWeight: Math.round(v.targetWeight * 10) / 10, activity: v.activity, ratePerWeek: v.ratePerWeek, rateMode: v.rateMode,
        manualGoal: st.manual ? Math.round(v.manualGoal) : null, level: st.level, trainDays: st.days
      };
      if (first) S = C.migrate(S, t).data; // fill v2 defaults (planStart, waterGoal…)
      if (first) S.profile.planStart = t;
      const w = Math.round(v.weight * 10) / 10;
      if (first || w !== Math.round(weightFor(t) * 10) / 10) day(t).weight = w;
      closeSheet(true); commit(); toast(first ? 'جاهز! سجّل أول وجبة' : 'تم الحفظ', 'ok');
      if (first) requestPersist();
    };
  }

  /* ---------- Backup ---------- */
  ACT.export = async () => {
    const withPhotos = $('#exp-photos')?.checked;
    let data;
    try { data = await Store.exportJSON(S, withPhotos); } catch { return toast('تعذّر تجهيز النسخة', 'warn'); }
    const name = `mizan-backup-${today()}.json`;
    try {
      const file = new File([data], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'نسخة ميزان الاحتياطية' }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('تم تنزيل النسخة', 'ok');
  };
  ACT.import = () => $('#import-file').click();
  async function importFile(e) {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    let parsed;
    try { parsed = Store.parseBackup(await f.text()); } catch { return toast('الملف غير صالح', 'warn'); }
    const n = parsed.photos.length;
    confirmDo('تستورد النسخة؟', `بتستبدل كل بياناتك الحالية${n ? ` وتضيف ${n} صور` : ''}.`, 'استيراد', async () => {
      S = parsed.data; save();
      if (n) { try { await Store.importPhotos(parsed.photos); } catch { toast('ما قدرنا نستورد الصور', 'warn'); } }
      UI.cur = today(); UI.heroShown = null; applyTheme(); render(); toast('تم استيراد النسخة', 'ok');
    });
  }
  ACT.wipe = () => confirmDo('متأكد؟', 'بيتم مسح كل البيانات والصور من هذا الجهاز.', 'متابعة', () =>
    confirmDo('تأكيد أخير', 'ما يمكن التراجع. صدّرت نسخة احتياطية؟', 'امسح كل شي', async () => {
      Store.wipe(); try { await Store.Photos.clear(); } catch { /* none */ }
      S = Store.load().S; UI.cur = today(); UI.heroShown = null; show('home'); profileSheet(true);
    }, true), true);

  async function requestPersist() {
    try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch { /* ignore */ }
    persistStatus();
  }
  async function persistStatus() {
    const el = $('#persist-status'); if (!el) return;
    try {
      if (!navigator.storage?.persisted) { el.textContent = ''; return; }
      el.textContent = (await navigator.storage.persisted()) ? 'التخزين الدائم مفعّل ✓' : 'المتصفح ما فعّل التخزين الدائم. صدّر نسخة احتياطية بين فترة وفترة.';
    } catch { el.textContent = ''; }
  }

  /* ================= Achievements / weekly adjust ================= */
  let achBusy = false;
  async function checkAchievements() {
    if (achBusy || !S.profile) return; achBusy = true;
    try {
      const n = await Store.Photos.count();
      const earned = C.earnedAchievements(S, today(), n);
      const fresh = [...earned].filter((id) => !S.achievements[id]);
      if (!fresh.length) return;
      fresh.forEach((id) => (S.achievements[id] = today()));
      save();
      const a = C.ACHIEVEMENTS.find((x) => x.id === fresh[fresh.length - 1]);
      setTimeout(() => {
        toast(`${icon(a.icon)} <b>إنجاز جديد:</b> ${a.title}${fresh.length > 1 ? ` ${ltr('+' + (fresh.length - 1))}` : ''}`, 'ach');
        confetti(90);
      }, $('#celebrate').hidden ? 300 : 1400);
    } finally { achBusy = false; }
  }
  function runWeeklyAdjust() {
    const k = today(), r = C.adaptiveCheck(S, k);
    if (r.skip) return;
    const p = S.profile;
    p.lastAdjustCheck = k;
    const note = { id: 'adj_' + k, type: 'adjust', date: k, delta: r.delta, reason: r.reason, actual: r.actual, expected: r.expected, curAvg: r.curAvg, prevAvg: r.prevAvg };
    if (r.delta) { note.adjustId = 'a_' + k; p.adjustLog.push({ id: note.adjustId, date: k, delta: r.delta }); }
    S.notices = S.notices.filter((n) => n.type !== 'adjust' || !n.dismissed).concat(note);
    save();
  }

  /* ================= Theme / update / boot ================= */
  const mq = matchMedia('(prefers-color-scheme: light)');
  function applyTheme() {
    const t = S.settings.theme || 'dark';
    const eff = t === 'auto' ? (mq.matches ? 'light' : 'dark') : t;
    document.documentElement.dataset.theme = eff;
    $('meta[name="theme-color"]').setAttribute('content', eff === 'light' ? '#f3f1ec' : '#0b0f0e');
  }
  mq.addEventListener?.('change', () => S && applyTheme());

  function setupSW() {
    if (!('serviceWorker' in navigator)) return;
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) $('#update-banner').hidden = false; });
    navigator.serviceWorker.register('sw.js').then((reg) => {
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    }).catch(() => {});
    $('#update-reload').onclick = () => location.reload();
  }

  function boot() {
    const res = Store.load();
    S = res.S;
    applyTheme();
    M.Timer.bind();
    if (!S.profile) profileSheet(true);
    else runWeeklyAdjust();
    show('home');
    checkAchievements();
    requestPersist();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || !S.profile || M.Timer.isRunning()) return;
      if (UI.cur > today()) UI.cur = today();
      runWeeklyAdjust(); render();
    });
    setupSW();
    if (res.migrated) setTimeout(() => toast('حدّثنا ميزان للنسخة الجديدة. بياناتك كلها موجودة ✓', 'ok'), 400);
  }
  M.app = { get S() { return S; }, render, show, UI };
  boot();
})();

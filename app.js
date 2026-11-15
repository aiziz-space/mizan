/* ميزان — personal weight & calorie tracker. Plain JS, no build step. */
'use strict';

/* ================= Calc (pure, unit-testable) ================= */
const Calc = (() => {
  const ACTIVITY = {
    sedentary: { f: 1.2, label: 'خامل', hint: 'مكتبي، حركة قليلة' },
    light: { f: 1.375, label: 'خفيف', hint: 'مشي خفيف خلال اليوم' },
    moderate: { f: 1.55, label: 'متوسط', hint: 'حركة كثيرة أغلب اليوم' },
    active: { f: 1.725, label: 'عالي', hint: 'شغل بدني معظم اليوم' }
  };
  const RATES = [0.25, 0.5, 0.75];
  const KCAL_PER_KG = 7700;
  const MIN_GOAL = { m: 1500, f: 1200 };

  // MET values: 2024 Adult Compendium of Physical Activities (pacompendium.com)
  const EXERCISES = {
    walk: { label: 'مشي عادي', met: 3.8, code: '17190', steps: true },          // walking 2.8–3.4 mph, level, moderate pace
    brisk: { label: 'مشي سريع', met: 4.8, code: '17200', steps: true },         // walking 3.5–3.9 mph, level, brisk
    weights: { label: 'أوزان بالنادي', met: 3.5, code: '02054' },              // resistance training, multiple exercises, 8–15 reps
    cardio: { label: 'كارديو بالنادي', met: 5.0, code: '02048' },              // elliptical trainer, moderate effort
    cardio_hard: { label: 'كارديو بالنادي (عالي)', met: 9.0, code: '02049' }   // elliptical trainer, vigorous effort
  };
  const STEPS_PER_MIN = 100;

  const bmr = ({ sex, age, heightCm, weight }) =>
    10 * weight + 6.25 * heightCm - 5 * age + (sex === 'm' ? 5 : -161);

  const dailyDeficit = (ratePerWeek) => (ratePerWeek * KCAL_PER_KG) / 7;

  // Returns { goal, bmr, tdee, deficit, floored, manual }
  function goalFor(profile, weight) {
    if (profile.manualGoal) return { goal: Math.round(profile.manualGoal), manual: true };
    const b = bmr({ ...profile, weight });
    const tdee = b * ACTIVITY[profile.activity].f;
    const deficit = dailyDeficit(profile.ratePerWeek);
    const raw = Math.round(tdee - deficit);
    const min = MIN_GOAL[profile.sex];
    return { goal: Math.max(raw, min), bmr: b, tdee, deficit, floored: raw < min, manual: false };
  }

  const exerciseKcal = (met, weight, minutes) => Math.max(0, Math.round((met - 1) * weight * (minutes / 60)));
  const stepsToMinutes = (steps) => steps / STEPS_PER_MIN;

  function dayTotals(day, goal, ratio) {
    const food = Math.round((day?.food || []).reduce((s, x) => s + x.kcal * x.qty, 0));
    const exRaw = (day?.activity || []).reduce((s, x) => s + x.kcal, 0);
    const exCredit = Math.round(exRaw * ratio);
    const remaining = goal + exCredit - food;
    return { food, exRaw, exCredit, remaining, over: remaining < 0 };
  }

  // Latest weight recorded on or before dateKey (keys are YYYY-MM-DD so string compare works)
  function weightOn(days, dateKey, fallback) {
    let best = null;
    for (const k in days) {
      if (k <= dateKey && typeof days[k].weight === 'number' && (best === null || k > best)) best = k;
    }
    return best ? days[best].weight : fallback;
  }

  const pad = (n) => String(n).padStart(2, '0');
  const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dateKey(d); };

  return { ACTIVITY, RATES, MIN_GOAL, EXERCISES, STEPS_PER_MIN, bmr, dailyDeficit, goalFor, exerciseKcal,
    stepsToMinutes, dayTotals, weightOn, dateKey, parseKey, addDays };
})();

if (typeof module !== 'undefined') module.exports = Calc;

/* ================= App (browser only) ================= */
if (typeof document !== 'undefined') (() => {
  const KEY = 'mizan.v1';
  const $ = (s, r = document) => r.querySelector(s);
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const fmt1 = (n) => (Math.round(n * 10) / 10).toLocaleString('en-US', { maximumFractionDigits: 1 });
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v) => { const n = parseFloat(String(v).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
  const dateFmt = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' });
  const shortFmt = { format: (d) => `${d.getDate()}/${d.getMonth() + 1}` }; // plain d/m, Latin digits, no bidi marks
  const fullFmt = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' });

  /* ---------- Storage ---------- */
  const blank = () => ({ version: 1, profile: null, settings: { exerciseRatio: 0.5 }, meals: [], days: {} });
  let S;
  function load() {
    try { S = JSON.parse(localStorage.getItem(KEY)) || blank(); } catch { S = blank(); }
    S.settings = { exerciseRatio: 0.5, ...(S.settings || {}) };
    S.meals ||= []; S.days ||= {};
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch { toast('تعذّر الحفظ — مساحة التخزين ممتلئة؟'); }
  }
  const day = (k) => (S.days[k] ||= { food: [], activity: [] });
  function pruneDay(k) {
    const d = S.days[k];
    if (d && !d.food.length && !d.activity.length && typeof d.weight !== 'number') delete S.days[k];
  }

  /* ---------- State ---------- */
  const today = () => Calc.dateKey(new Date());
  let cur = today();
  let view = 'today';

  const weightFor = (k) => Calc.weightOn(S.days, k, S.profile?.startWeight);
  const goalInfo = (k) => Calc.goalFor(S.profile, weightFor(k));

  /* ---------- UI helpers ---------- */
  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2200);
  }
  let sheetLocked = false;
  function openSheet(title, html, { locked = false } = {}) {
    $('#sheet-title').textContent = title;
    $('#sheet-body').innerHTML = html;
    $('#sheet-close').hidden = locked;
    sheetLocked = locked;
    $('#sheet-wrap').hidden = false;
    $('#sheet-body').scrollTop = 0;
    return $('#sheet-body');
  }
  function closeSheet(force) {
    if (sheetLocked && !force) return;
    $('#sheet-wrap').hidden = true; $('#sheet-body').innerHTML = ''; sheetLocked = false;
  }
  $('#sheet-close').onclick = () => closeSheet();
  $('#sheet-backdrop').onclick = () => closeSheet();

  function seg(el, value, onChange) {
    el.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('on', b.dataset.v === String(value));
      b.onclick = () => { el.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); onChange(b.dataset.v); };
    });
  }

  /* ---------- Navigation ---------- */
  function show(v) {
    view = v;
    document.querySelectorAll('.view').forEach((s) => (s.hidden = s.id !== 'view-' + v));
    document.querySelectorAll('#tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
    $('#title').textContent = $('#view-' + v).dataset.title;
    render();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('#tabbar button').forEach((b) => (b.onclick = () => show(b.dataset.view)));

  function render() {
    if (!S.profile) return;
    if (view === 'today') renderToday();
    else if (view === 'progress') renderProgress();
    else if (view === 'meals') renderMeals();
    else if (view === 'settings') renderSettings();
  }

  /* ================= Today ================= */
  $('#day-prev').onclick = () => { cur = Calc.addDays(cur, -1); renderToday(); };
  $('#day-next').onclick = () => { if (cur < today()) { cur = Calc.addDays(cur, 1); renderToday(); } };
  $('#day-label').onclick = () => { cur = today(); renderToday(); };

  function renderToday() {
    const t = today();
    if (cur > t) cur = t;
    const k = cur;
    const d = S.days[k] || { food: [], activity: [] };
    const g = goalInfo(k);
    const ratio = S.settings.exerciseRatio;
    const tot = Calc.dayTotals(d, g.goal, ratio);

    $('#day-label').textContent = k === t ? 'اليوم · ' + dateFmt.format(Calc.parseKey(k))
      : k === Calc.addDays(t, -1) ? 'أمس · ' + dateFmt.format(Calc.parseKey(k)) : dateFmt.format(Calc.parseKey(k));
    $('#day-next').disabled = k >= t;

    const hero = $('#hero');
    hero.classList.toggle('over', tot.over);
    $('#hero-label').textContent = tot.over ? 'تجاوزت بـ' : 'باقي لك';
    $('#hero-num').textContent = fmt(Math.abs(tot.remaining));
    const budget = g.goal + tot.exCredit;
    $('#ring-fill').style.width = Math.min(100, budget > 0 ? (tot.food / budget) * 100 : 100) + '%';
    $('#st-goal').textContent = fmt(g.goal);
    $('#st-food').textContent = fmt(tot.food);
    $('#st-ex').textContent = fmt(tot.exCredit);
    $('#st-ex-lbl').textContent = `الرياضة (${Math.round(ratio * 100)}%)`;

    const hasW = typeof d.weight === 'number';
    $('#day-weight').textContent = hasW ? fmt1(d.weight) + ' كجم' : '—';
    $('#btn-weight').textContent = hasW ? 'تعديل' : 'سجّل الوزن';

    const fl = $('#food-list');
    fl.innerHTML = d.food.length ? d.food.map((f) => `
      <li><div class="li-main"><div class="li-title">${esc(f.name)}</div>
        <div class="li-sub">${f.qty !== 1 ? `${fmt1(f.qty)} × ${fmt(f.kcal)}` : 'حصة واحدة'}</div></div>
        <div class="li-kcal">${fmt(f.kcal * f.qty)}</div>
        <button class="li-btn del" data-del-food="${f.id}" aria-label="حذف">✕</button></li>`).join('')
      : '<li class="empty">ما سجلت أكل لهذا اليوم</li>';
    const al = $('#act-list');
    al.innerHTML = d.activity.length ? d.activity.map((a) => `
      <li><div class="li-main"><div class="li-title">${esc(Calc.EXERCISES[a.type]?.label || a.type)}</div>
        <div class="li-sub">${fmt(a.minutes)} دقيقة${a.steps ? ` · ${fmt(a.steps)} خطوة` : ''}</div></div>
        <div class="li-kcal">${fmt(a.kcal)}</div>
        <button class="li-btn del" data-del-act="${a.id}" aria-label="حذف">✕</button></li>`).join('')
      : '<li class="empty">ما سجلت نشاط لهذا اليوم</li>';

    fl.querySelectorAll('[data-del-food]').forEach((b) => (b.onclick = () => {
      if (!confirm('تحذف هذا الأكل؟')) return;
      const dd = day(k); dd.food = dd.food.filter((x) => x.id !== b.dataset.delFood); pruneDay(k); save(); renderToday();
    }));
    al.querySelectorAll('[data-del-act]').forEach((b) => (b.onclick = () => {
      if (!confirm('تحذف هذا النشاط؟')) return;
      const dd = day(k); dd.activity = dd.activity.filter((x) => x.id !== b.dataset.delAct); pruneDay(k); save(); renderToday();
    }));
  }

  /* ---------- Weight sheet ---------- */
  $('#btn-weight').onclick = () => {
    const k = cur, d = S.days[k];
    const has = typeof d?.weight === 'number';
    const body = openSheet('وزن ' + (k === today() ? 'اليوم' : dateFmt.format(Calc.parseKey(k))), `
      <div class="field"><label for="w-in">الوزن (كجم)</label>
        <input class="input" id="w-in" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="${has ? d.weight : fmt1(weightFor(k))}"></div>
      <button class="btn primary big full" id="w-save">حفظ</button>
      ${has ? '<button class="btn danger full" id="w-del">حذف وزن هذا اليوم</button>' : ''}`);
    body.querySelector('#w-save').onclick = () => {
      const w = num(body.querySelector('#w-in').value);
      if (!(w >= 30 && w <= 300)) return toast('أدخل وزن صحيح بين 30 و300');
      day(k).weight = Math.round(w * 10) / 10; save(); closeSheet(); renderToday(); toast('تم حفظ الوزن');
    };
    const del = body.querySelector('#w-del');
    if (del) del.onclick = () => { delete day(k).weight; pruneDay(k); save(); closeSheet(); renderToday(); };
  };

  /* ---------- Add food sheet ---------- */
  $('#btn-add-food').onclick = () => openFoodSheet(S.meals.length ? 'list' : 'quick');

  function openFoodSheet(tab) {
    const k = cur;
    const body = openSheet('إضافة أكل', `
      <div class="seg" id="food-tab"><button data-v="list">من قائمتي</button><button data-v="quick">إدخال سريع</button></div>
      <div id="food-pane"></div>`);
    const pane = body.querySelector('#food-pane');
    seg(body.querySelector('#food-tab'), tab, (v) => draw(v));
    draw(tab);

    function draw(t) {
      if (t === 'quick') {
        pane.innerHTML = `<div class="fields">
          <div class="field"><label for="q-name">اسم الأكل</label><input class="input" id="q-name" type="text" autocomplete="off" placeholder="مثلاً: شاورما دجاج"></div>
          <div class="field"><label for="q-kcal">السعرات</label><input class="input" id="q-kcal" type="number" inputmode="numeric" min="0" placeholder="0"></div>
          <label class="check"><input type="checkbox" id="q-keep"> احفظه في قائمتي</label>
          <button class="btn primary big full" id="q-save">إضافة</button></div>`;
        pane.querySelector('#q-save').onclick = () => {
          const name = pane.querySelector('#q-name').value.trim() || 'أكل';
          const kcal = num(pane.querySelector('#q-kcal').value);
          if (!(kcal >= 0 && kcal <= 10000)) return toast('أدخل السعرات');
          day(k).food.push({ id: uid(), name, kcal: Math.round(kcal), qty: 1 });
          if (pane.querySelector('#q-keep').checked && !S.meals.some((m) => m.name === name)) S.meals.push({ id: uid(), name, kcal: Math.round(kcal) });
          save(); closeSheet(); renderToday(); toast('تمت الإضافة');
        };
        return;
      }
      if (!S.meals.length) {
        pane.innerHTML = `<div class="empty">قائمتك فاضية. أضف وجبة بالإدخال السريع وعلّم "احفظه في قائمتي"، أو من تبويب قائمتي.</div>`;
        return;
      }
      let sel = null, qty = 1;
      pane.innerHTML = `<div class="fields">
        <input type="search" class="input" id="f-search" placeholder="ابحث…" autocomplete="off">
        <ul class="list" id="f-list"></ul>
        <div class="field"><span class="lbl">الكمية</span>
          <div class="chips" id="f-qty">${[0.5, 1, 1.5, 2, 3].map((q) => `<button data-q="${q}">${q === 0.5 ? '½' : q}</button>`).join('')}</div>
          <input class="input" id="f-qty-in" type="number" inputmode="decimal" step="0.25" min="0.25" value="1" aria-label="كمية مخصصة"></div>
        <div class="preview"><div class="pv-num" id="f-pv">—</div><div class="muted small">سعرة</div></div>
        <button class="btn primary big full" id="f-save" disabled>إضافة</button></div>`;
      const list = pane.querySelector('#f-list');
      const qin = pane.querySelector('#f-qty-in');
      const upd = () => {
        pane.querySelectorAll('#f-qty button').forEach((b) => b.classList.toggle('on', +b.dataset.q === qty));
        pane.querySelector('#f-pv').textContent = sel ? fmt(sel.kcal * qty) : '—';
        pane.querySelector('#f-save').disabled = !sel || !(qty > 0);
      };
      const drawList = () => {
        const q = pane.querySelector('#f-search').value.trim();
        const items = S.meals.filter((m) => !q || m.name.includes(q)).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
        list.innerHTML = items.length ? items.map((m) => `<li class="pick${sel?.id === m.id ? ' selected' : ''}" data-id="${m.id}">
          <div class="li-main"><div class="li-title">${esc(m.name)}</div></div><div class="li-kcal">${fmt(m.kcal)}</div></li>`).join('')
          : '<li class="empty">ما فيه نتائج</li>';
        list.querySelectorAll('li.pick').forEach((li) => (li.onclick = () => { sel = S.meals.find((m) => m.id === li.dataset.id); drawList(); upd(); }));
      };
      pane.querySelector('#f-search').oninput = drawList;
      pane.querySelectorAll('#f-qty button').forEach((b) => (b.onclick = () => { qty = +b.dataset.q; qin.value = qty; upd(); }));
      qin.oninput = () => { qty = num(qin.value); upd(); };
      pane.querySelector('#f-save').onclick = () => {
        if (!sel || !(qty > 0)) return;
        day(k).food.push({ id: uid(), name: sel.name, kcal: sel.kcal, qty });
        save(); closeSheet(); renderToday(); toast('تمت الإضافة');
      };
      drawList(); upd();
    }
  }

  /* ---------- Add activity sheet ---------- */
  $('#btn-add-act').onclick = () => {
    const k = cur;
    const w = weightFor(k);
    let type = 'walk', mode = 'min', kcalEdited = false;
    const body = openSheet('إضافة نشاط', `
      <div class="opt-list" id="a-type">
        <button data-t="walk">مشي عادي<small>~5 كم/س</small></button>
        <button data-t="brisk">مشي سريع<small>~6 كم/س</small></button>
        <button data-t="weights">أوزان بالنادي<small>تمارين مقاومة</small></button>
        <button data-t="cardio">كارديو بالنادي<small>أوبتيكال، دراجة…</small></button>
      </div>
      <div class="field" id="a-int-wrap" hidden><span class="lbl">شدة الكارديو</span>
        <div class="seg" id="a-int"><button data-v="cardio">متوسط</button><button data-v="cardio_hard">عالي</button></div></div>
      <div class="seg" id="a-mode"><button data-v="min">بالدقائق</button><button data-v="steps">بالخطوات</button></div>
      <div class="field"><label for="a-val" id="a-val-lbl">المدة (دقيقة)</label>
        <input class="input" id="a-val" type="number" inputmode="numeric" min="1"></div>
      <div class="field"><label for="a-kcal">السعرات المحروقة (تقدير، تقدر تعدّله)</label>
        <input class="input" id="a-kcal" type="number" inputmode="numeric" min="0"></div>
      <div class="hint" id="a-hint"></div>
      <button class="btn primary big full" id="a-save">إضافة</button>`);
    const $b = (s) => body.querySelector(s);
    const minutes = () => {
      const v = num($b('#a-val').value);
      if (!(v > 0)) return 0;
      return mode === 'steps' && Calc.EXERCISES[type].steps ? Calc.stepsToMinutes(v) : v;
    };
    const recalc = () => {
      const ex = Calc.EXERCISES[type];
      const m = minutes();
      if (!kcalEdited) $b('#a-kcal').value = m ? Calc.exerciseKcal(ex.met, w, m) : '';
      $b('#a-hint').textContent = `الحساب: معامل MET ${ex.met} · وزنك ${fmt1(w)} كجم · ${fmt(m)} دقيقة` +
        (mode === 'steps' && ex.steps ? ` (كل ${Calc.STEPS_PER_MIN} خطوة ≈ دقيقة)` : '');
    };
    const drawType = () => {
      const base = type.startsWith('cardio') ? 'cardio' : type;
      body.querySelectorAll('#a-type button').forEach((b) => b.classList.toggle('on', b.dataset.t === base));
      $b('#a-int-wrap').hidden = base !== 'cardio';
      const canSteps = !!Calc.EXERCISES[type].steps;
      $b('#a-mode').hidden = !canSteps;
      if (!canSteps) mode = 'min';
      seg($b('#a-mode'), mode, (v) => { mode = v; drawMode(); });
      drawMode();
    };
    const drawMode = () => {
      $b('#a-val-lbl').textContent = mode === 'steps' ? 'عدد الخطوات' : 'المدة (دقيقة)';
      recalc();
    };
    body.querySelectorAll('#a-type button').forEach((b) => (b.onclick = () => {
      type = b.dataset.t === 'cardio' ? 'cardio' : b.dataset.t; kcalEdited = false; drawType();
    }));
    seg($b('#a-int'), 'cardio', (v) => { type = v; kcalEdited = false; drawType(); });
    $b('#a-val').oninput = () => { kcalEdited = false; recalc(); };
    $b('#a-kcal').oninput = () => { kcalEdited = true; };
    $b('#a-save').onclick = () => {
      const m = minutes();
      const kcal = num($b('#a-kcal').value);
      if (!(m > 0)) return toast(mode === 'steps' ? 'أدخل عدد الخطوات' : 'أدخل المدة');
      if (!(kcal >= 0)) return toast('أدخل السعرات');
      const entry = { id: uid(), type, minutes: Math.round(m), kcal: Math.round(kcal) };
      if (mode === 'steps' && Calc.EXERCISES[type].steps) entry.steps = Math.round(num($b('#a-val').value));
      day(k).activity.push(entry);
      save(); closeSheet(); renderToday(); toast('تمت الإضافة');
    };
    drawType();
  };

  /* ================= My meals ================= */
  $('#meals-search').oninput = () => renderMeals();
  $('#btn-new-meal').onclick = () => mealSheet();

  function renderMeals() {
    const q = $('#meals-search').value.trim();
    const items = S.meals.filter((m) => !q || m.name.includes(q)).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    const ul = $('#meals-list');
    ul.innerHTML = !S.meals.length ? '<li class="empty">قائمتك فاضية. أضف وجباتك اللي تتكرر عشان تسجلها بضغطة.</li>'
      : !items.length ? '<li class="empty">ما فيه نتائج</li>'
      : items.map((m) => `<li><div class="li-main"><div class="li-title">${esc(m.name)}</div></div>
          <div class="li-kcal">${fmt(m.kcal)}</div>
          <button class="li-btn" data-edit="${m.id}" aria-label="تعديل">✎</button>
          <button class="li-btn del" data-del="${m.id}" aria-label="حذف">✕</button></li>`).join('');
    ul.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => mealSheet(S.meals.find((m) => m.id === b.dataset.edit))));
    ul.querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => {
      const m = S.meals.find((x) => x.id === b.dataset.del);
      if (!confirm(`تحذف "${m.name}" من قائمتك؟`)) return;
      S.meals = S.meals.filter((x) => x.id !== m.id); save(); renderMeals();
    }));
  }

  function mealSheet(meal) {
    const body = openSheet(meal ? 'تعديل وجبة' : 'وجبة جديدة', `
      <div class="field"><label for="m-name">الاسم</label><input class="input" id="m-name" type="text" autocomplete="off" value="${meal ? esc(meal.name) : ''}"></div>
      <div class="field"><label for="m-kcal">السعرات للحصة الواحدة</label><input class="input" id="m-kcal" type="number" inputmode="numeric" min="0" value="${meal ? meal.kcal : ''}"></div>
      <button class="btn primary big full" id="m-save">حفظ</button>`);
    body.querySelector('#m-save').onclick = () => {
      const name = body.querySelector('#m-name').value.trim();
      const kcal = num(body.querySelector('#m-kcal').value);
      if (!name) return toast('اكتب اسم الوجبة');
      if (!(kcal >= 0 && kcal <= 10000)) return toast('أدخل السعرات');
      if (meal) Object.assign(meal, { name, kcal: Math.round(kcal) });
      else S.meals.push({ id: uid(), name, kcal: Math.round(kcal) });
      save(); closeSheet(); renderMeals(); toast('تم الحفظ');
    };
  }

  /* ================= Progress ================= */
  const svgNS = 'http://www.w3.org/2000/svg';
  function renderProgress() {
    const p = S.profile;
    const ws = Object.keys(S.days).filter((k) => typeof S.days[k].weight === 'number').sort().map((k) => ({ k, w: S.days[k].weight }));
    const first = ws.length ? ws[0].w : p.startWeight;
    const current = ws.length ? ws[ws.length - 1].w : p.startWeight;
    const lost = first - current;
    const left = current - p.targetWeight;
    $('#prog-stats').innerHTML = `
      <div class="stat"><div class="v">${fmt1(first)} <small>كجم</small></div><div class="l">أول وزن${ws.length ? ' · ' + fullFmt.format(Calc.parseKey(ws[0].k)) : ''}</div></div>
      <div class="stat"><div class="v">${fmt1(current)} <small>كجم</small></div><div class="l">الوزن الحالي</div></div>
      <div class="stat ${lost > 0 ? 'good' : ''}"><div class="v">${lost >= 0 ? fmt1(lost) : '+' + fmt1(-lost)} <small>كجم</small></div><div class="l">${lost >= 0 ? 'نزلت' : 'زدت'}</div></div>
      <div class="stat"><div class="v">${left > 0 ? fmt1(left) : '0'} <small>كجم</small></div><div class="l">${left > 0 ? 'باقي للهدف (' + fmt1(p.targetWeight) + ')' : 'وصلت هدفك 🎉'}</div></div>`;
    $('#weight-chart').innerHTML = ws.length >= 2 ? weightChart(ws, p.targetWeight) : '<div class="empty">سجّل وزنك في يومين على الأقل عشان يطلع الرسم.</div>';
    renderWeek();
  }

  function weightChart(ws, target) {
    const W = 340, H = 200, L = 10, R = 36, T = 12, B = 26; // RTL: time flows right→left, axis on the right
    const t0 = Calc.parseKey(ws[0].k).getTime(), t1 = Calc.parseKey(ws[ws.length - 1].k).getTime();
    let lo = Math.min(...ws.map((x) => x.w)), hi = Math.max(...ws.map((x) => x.w));
    if (target >= lo - 3 && target < lo) lo = target;
    const padY = Math.max(0.5, (hi - lo) * 0.12); lo -= padY; hi += padY;
    const x = (k) => W - R - ((Calc.parseKey(k).getTime() - t0) / Math.max(1, t1 - t0)) * (W - L - R);
    const y = (w) => T + (1 - (w - lo) / (hi - lo)) * (H - T - B);
    let g = '';
    for (let i = 0; i <= 4; i++) {
      const v = lo + ((hi - lo) * i) / 4, yy = y(v);
      g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="currentColor" stroke-opacity=".12"/><text x="${W - R + 6}" y="${yy + 4}" text-anchor="start">${fmt1(v)}</text>`;
    }
    if (target >= lo && target <= hi) g += `<line x1="${L}" x2="${W - R}" y1="${y(target)}" y2="${y(target)}" stroke="var(--brand)" stroke-dasharray="5 4" stroke-width="1.5"/><text x="${L}" y="${y(target) - 5}" text-anchor="start" style="fill:var(--brand)">الهدف</text>`;
    const pts = ws.map((p) => `${x(p.k).toFixed(1)},${y(p.w).toFixed(1)}`).join(' ');
    const area = `${x(ws[0].k).toFixed(1)},${H - B} ${pts} ${x(ws[ws.length - 1].k).toFixed(1)},${H - B}`;
    const idx = [0, Math.floor((ws.length - 1) / 2), ws.length - 1].filter((v, i, a) => a.indexOf(v) === i);
    const xl = idx.map((i) => `<text x="${x(ws[i].k)}" y="${H - 6}" text-anchor="${i === 0 ? 'end' : i === ws.length - 1 ? 'start' : 'middle'}">${shortFmt.format(Calc.parseKey(ws[i].k))}</text>`).join('');
    const dots = ws.length <= 40 ? ws.map((p) => `<circle cx="${x(p.k)}" cy="${y(p.w)}" r="3.5" fill="var(--brand)" stroke="var(--card)" stroke-width="1.5"/>`).join('') : '';
    return `<svg xmlns="${svgNS}" viewBox="0 0 ${W} ${H}" direction="ltr" role="img" aria-label="رسم بياني للوزن" style="color:var(--text)">
      ${g}<polygon points="${area}" fill="var(--brand)" fill-opacity=".1"/>
      <polyline points="${pts}" fill="none" stroke="var(--brand)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}${xl}</svg>`;
  }

  function renderWeek() {
    const t = today();
    const ratio = S.settings.exerciseRatio;
    const rows = [];
    for (let i = 6; i >= 0; i--) {
      const k = Calc.addDays(t, -i);
      const d = S.days[k];
      const goal = goalInfo(k).goal;
      const tot = Calc.dayTotals(d, goal, ratio);
      rows.push({ k, eaten: tot.food, budget: goal + tot.exCredit, logged: !!d?.food?.length });
    }
    const W = 340, H = 180, L = 8, R = 8, T = 18, B = 34;
    const max = Math.max(...rows.map((r) => Math.max(r.eaten, r.budget)), 1) * 1.08;
    const bw = (W - L - R) / 7;
    const y = (v) => T + (1 - v / max) * (H - T - B);
    let s = '';
    rows.forEach((r, i) => {
      const x0 = L + (6 - i) * bw, cx = x0 + bw / 2; // oldest on the right (RTL)
      const over = r.eaten > r.budget;
      if (r.logged) {
        s += `<rect x="${x0 + bw * 0.2}" y="${y(r.eaten)}" width="${bw * 0.6}" height="${H - B - y(r.eaten)}" rx="5" fill="${over ? 'var(--danger)' : 'var(--brand)'}"/>`;
        s += `<text x="${cx}" y="${y(r.eaten) - 4}" text-anchor="middle">${fmt(r.eaten)}</text>`;
      } else {
        s += `<text x="${cx}" y="${H - B - 6}" text-anchor="middle">—</text>`;
      }
      s += `<line x1="${x0 + bw * 0.1}" x2="${x0 + bw * 0.9}" y1="${y(r.budget)}" y2="${y(r.budget)}" stroke="currentColor" stroke-opacity=".55" stroke-width="2" stroke-dasharray="3 2"/>`;
      const dn = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', { weekday: 'short' }).format(Calc.parseKey(r.k));
      s += `<text x="${cx}" y="${H - 18}" text-anchor="middle">${dn}</text><text x="${cx}" y="${H - 4}" text-anchor="middle">${shortFmt.format(Calc.parseKey(r.k))}</text>`;
    });
    $('#week-chart').innerHTML = `<svg xmlns="${svgNS}" viewBox="0 0 ${W} ${H}" role="img" aria-label="الأكل مقابل الهدف لآخر 7 أيام" style="color:var(--text)">${s}</svg>`;
    const logged = rows.filter((r) => r.logged);
    const eaten = logged.reduce((a, r) => a + r.eaten, 0), budget = logged.reduce((a, r) => a + r.budget, 0);
    $('#week-summary').textContent = logged.length
      ? `في ${logged.length} أيام مسجلة: أكلت ${fmt(eaten)} من ${fmt(budget)} (${eaten <= budget ? 'أقل بـ ' + fmt(budget - eaten) : 'أكثر بـ ' + fmt(eaten - budget)})`
      : 'ما فيه أكل مسجل بآخر 7 أيام';
  }

  /* ================= Settings ================= */
  function renderSettings() {
    const p = S.profile;
    const g = goalInfo(today());
    $('#profile-summary').innerHTML = `${p.sex === 'm' ? 'ذكر' : 'أنثى'} · ${p.age} سنة · ${p.heightCm} سم · الهدف ${fmt1(p.targetWeight)} كجم<br>
      النشاط: ${Calc.ACTIVITY[p.activity].label} · النزول: ${p.ratePerWeek} كجم/أسبوع<br>
      الهدف اليومي: <b>${fmt(g.goal)}</b> سعرة${g.manual ? ' (يدوي)' : ''}`;
    seg($('#seg-ratio'), S.settings.exerciseRatio, (v) => { S.settings.exerciseRatio = +v; save(); toast('تم الحفظ'); });
  }
  $('#btn-edit-profile').onclick = () => profileSheet(false);

  function profileSheet(first) {
    const p = S.profile || { sex: 'm', age: '', heightCm: '', startWeight: '', targetWeight: '', activity: 'sedentary', ratePerWeek: 0.5, manualGoal: null };
    const curW = S.profile ? weightFor(today()) : '';
    const st = { sex: p.sex, activity: p.activity, rate: p.ratePerWeek, manual: !!p.manualGoal };
    const body = openSheet(first ? 'أهلاً! خلنا نحسب هدفك' : 'الملف الشخصي', `
      <div class="fields">
        <div class="field"><span class="lbl">الجنس</span><div class="seg" id="p-sex"><button data-v="m">ذكر</button><button data-v="f">أنثى</button></div></div>
        <div class="row2">
          <div class="field"><label for="p-age">العمر</label><input class="input" id="p-age" type="number" inputmode="numeric" min="14" max="100" value="${p.age}"></div>
          <div class="field"><label for="p-h">الطول (سم)</label><input class="input" id="p-h" type="number" inputmode="numeric" min="120" max="230" value="${p.heightCm}"></div>
        </div>
        <div class="row2">
          <div class="field"><label for="p-w">الوزن الحالي (كجم)</label><input class="input" id="p-w" type="number" inputmode="decimal" step="0.1" value="${curW === '' ? '' : fmt1(curW)}"></div>
          <div class="field"><label for="p-t">الوزن المستهدف</label><input class="input" id="p-t" type="number" inputmode="decimal" step="0.1" value="${p.targetWeight}"></div>
        </div>
        <div class="field"><span class="lbl">نشاطك اليومي (بدون الرياضة)</span>
          <div class="opt-list" id="p-act">${Object.entries(Calc.ACTIVITY).map(([k, a]) => `<button data-v="${k}">${a.label}<small>${a.hint}</small></button>`).join('')}</div></div>
        <div class="field"><span class="lbl">سرعة النزول بالأسبوع</span>
          <div class="seg" id="p-rate">${Calc.RATES.map((r) => `<button data-v="${r}">${r} كجم</button>`).join('')}</div></div>
        <label class="check"><input type="checkbox" id="p-man" ${st.manual ? 'checked' : ''}> أبي أكتب هدفي اليومي بنفسي</label>
        <div class="field" id="p-man-wrap" ${st.manual ? '' : 'hidden'}><label for="p-goal">الهدف اليومي (سعرة)</label>
          <input class="input" id="p-goal" type="number" inputmode="numeric" min="800" max="6000" value="${p.manualGoal || ''}"></div>
        <div class="note" id="p-calc"></div>
        <button class="btn primary big full" id="p-save">${first ? 'ابدأ' : 'حفظ'}</button>
      </div>`, { locked: first });
    const $b = (s) => body.querySelector(s);
    const read = () => ({
      sex: st.sex, age: num($b('#p-age').value), heightCm: num($b('#p-h').value),
      weight: num($b('#p-w').value), targetWeight: num($b('#p-t').value),
      activity: st.activity, ratePerWeek: st.rate,
      manualGoal: st.manual ? num($b('#p-goal').value) : null
    });
    const valid = (v) => v.age >= 14 && v.age <= 100 && v.heightCm >= 120 && v.heightCm <= 230 && v.weight >= 30 && v.weight <= 300 && v.targetWeight >= 30 && v.targetWeight <= 300;
    const calc = () => {
      const v = read();
      const el = $b('#p-calc');
      el.classList.remove('warn');
      if (!valid(v)) { el.textContent = 'عبّ البيانات عشان نحسب هدفك اليومي.'; return; }
      const auto = Calc.goalFor({ ...v, manualGoal: null }, v.weight);
      let html = `معدل الحرق الأساسي (BMR): <b>${fmt(auto.bmr)}</b><br>احتياجك اليومي: <b>${fmt(auto.tdee)}</b><br>العجز: <b>${fmt(auto.deficit)}</b><br>`;
      if (st.manual && v.manualGoal > 0) html += `هدفك اليومي (يدوي): <b>${fmt(v.manualGoal)}</b> سعرة`;
      else html += `هدفك اليومي: <b>${fmt(auto.goal)}</b> سعرة`;
      if (!st.manual && auto.floored) { html += `<br>رفعناه للحد الأدنى الآمن (${fmt(Calc.MIN_GOAL[v.sex])}). جرّب سرعة نزول أبطأ.`; el.classList.add('warn'); }
      if (st.manual && v.manualGoal > 0 && v.manualGoal < Calc.MIN_GOAL[v.sex]) { html += `<br>تنبيه: أقل من الحد الأدنى المنصوح (${fmt(Calc.MIN_GOAL[v.sex])}).`; el.classList.add('warn'); }
      el.innerHTML = html;
    };
    seg($b('#p-sex'), st.sex, (v) => { st.sex = v; calc(); });
    seg($b('#p-act'), st.activity, (v) => { st.activity = v; calc(); });
    seg($b('#p-rate'), st.rate, (v) => { st.rate = +v; calc(); });
    $b('#p-man').onchange = (e) => { st.manual = e.target.checked; $b('#p-man-wrap').hidden = !st.manual; calc(); };
    body.querySelectorAll('input').forEach((i) => i.addEventListener('input', calc));
    calc();
    $b('#p-save').onclick = () => {
      const v = read();
      if (!valid(v)) return toast('تأكد من العمر والطول والوزن');
      if (st.manual && !(v.manualGoal >= 800 && v.manualGoal <= 6000)) return toast('أدخل هدف يومي بين 800 و6000');
      const t = today();
      S.profile = {
        sex: v.sex, age: Math.round(v.age), heightCm: Math.round(v.heightCm),
        startWeight: S.profile?.startWeight ?? Math.round(v.weight * 10) / 10,
        targetWeight: Math.round(v.targetWeight * 10) / 10, activity: v.activity, ratePerWeek: v.ratePerWeek,
        manualGoal: st.manual ? Math.round(v.manualGoal) : null
      };
      const w = Math.round(v.weight * 10) / 10;
      if (first || w !== Math.round(weightFor(t) * 10) / 10) day(t).weight = w;
      save(); closeSheet(true); render(); toast(first ? 'جاهز! سجّل أول وجبة' : 'تم الحفظ');
      if (first) requestPersist();
    };
  }

  /* ---------- Backup ---------- */
  $('#btn-export').onclick = async () => {
    const data = JSON.stringify({ app: 'mizan', exportedAt: new Date().toISOString(), data: S }, null, 2);
    const name = `mizan-backup-${today()}.json`;
    try {
      const file = new File([data], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'نسخة ميزان الاحتياطية' });
        return;
      }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('تم تنزيل النسخة');
  };
  $('#btn-import').onclick = () => $('#import-file').click();
  $('#import-file').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      const d = j.data || j;
      if (!d || typeof d !== 'object' || !d.profile || typeof d.days !== 'object' || !Array.isArray(d.meals)) throw new Error('bad');
      if (!confirm('الاستيراد بيستبدل كل بياناتك الحالية. تكمل؟')) return;
      localStorage.setItem(KEY, JSON.stringify(d)); load(); cur = today(); render(); toast('تم استيراد النسخة');
    } catch { toast('الملف غير صالح'); }
  };
  $('#btn-wipe').onclick = () => {
    if (!confirm('متأكد؟ بيتم مسح كل البيانات من هذا الجهاز.')) return;
    if (!confirm('تأكيد أخير: ما يمكن التراجع. صدّرت نسخة احتياطية؟')) return;
    localStorage.removeItem(KEY); load(); cur = today(); show('today'); profileSheet(true);
  };

  async function requestPersist() {
    const el = $('#persist-status');
    try {
      if (!navigator.storage?.persist) { el.textContent = ''; return; }
      const ok = (await navigator.storage.persisted()) || (await navigator.storage.persist());
      el.textContent = ok ? 'التخزين الدائم مفعّل ✓' : 'المتصفح ما فعّل التخزين الدائم — صدّر نسخة احتياطية بين فترة وفترة.';
    } catch { el.textContent = ''; }
  }

  /* ---------- Boot ---------- */
  load();
  if (!S.profile) profileSheet(true);
  render();
  requestPersist();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { if (cur > today()) cur = today(); render(); } });
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();

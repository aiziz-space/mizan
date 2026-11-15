/* ميزان — pure calculations, migration and evaluation logic (no DOM). Testable in Node. */
(function (root) {
  'use strict';
  const M = (root.M = root.M || {});

  /* ---------- Constants ---------- */
  const ACTIVITY = {
    sedentary: { f: 1.2, label: 'خامل', hint: 'مكتبي، حركة قليلة' },
    light: { f: 1.375, label: 'خفيف', hint: 'مشي خفيف خلال اليوم' },
    moderate: { f: 1.55, label: 'متوسط', hint: 'حركة كثيرة أغلب اليوم' },
    active: { f: 1.725, label: 'عالي', hint: 'شغل بدني معظم اليوم' }
  };
  const RATES = [0.5, 0.75, 1];           // kg/week; plus 'pct' mode = 1% of body weight/week
  const PCT_RATE = 0.01;
  const KCAL_PER_KG = 7700;
  const MIN_GOAL = { m: 1500, f: 1200 };
  const ADJUST_LIMIT = 600;               // total adaptive adjustment cap (±kcal)
  const WATER_PHASE_DAYS = 14;
  const PROTEIN_PER_KG = 1.6;             // g per kg of target body weight

  // MET values — 2024 Adult Compendium of Physical Activities (pacompendium.com)
  const MET = {
    walk: 3.8,          // 17190 walking 2.8–3.4 mph, level, moderate pace
    brisk: 4.8,         // 17200 walking 3.5–3.9 mph, level, brisk
    weights: 3.5,       // 02054 resistance training, multiple exercises, 8–15 reps
    cardio: 5.0,        // 02048 elliptical trainer, moderate effort
    cardio_hard: 9.0,   // 02049 elliptical trainer, vigorous effort
    cal_light: 2.8,     // 02024 calisthenics, light effort (warm-up / cool-down / mobility)
    cal_moderate: 3.8,  // 02022 calisthenics, moderate effort
    cal_vigorous: 7.5,  // 02020 calisthenics (burpees, jumping jacks…), vigorous effort
    circuit: 6.0        // 02032 circuit training, body weight exercises
  };
  // Manually logged activity types (v1 types kept unchanged) + 'workout' (logged by the timer)
  const EXERCISES = {
    walk: { label: 'مشي عادي', met: MET.walk, steps: true },
    brisk: { label: 'مشي سريع', met: MET.brisk, steps: true },
    weights: { label: 'أوزان بالنادي', met: MET.weights },
    cardio: { label: 'كارديو بالنادي', met: MET.cardio },
    cardio_hard: { label: 'كارديو بالنادي (عالي)', met: MET.cardio_hard },
    workout: { label: 'تمرين', met: null }
  };
  const STEPS_PER_MIN = 100;
  const TRAINING_TYPES = new Set(['workout', 'weights', 'cardio', 'cardio_hard']);

  /* ---------- Dates (local, never via toISOString) ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dateKey(d); };
  const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 864e5);

  /* ---------- Energy ---------- */
  const bmr = ({ sex, age, heightCm, weight }) => 10 * weight + 6.25 * heightCm - 5 * age + (sex === 'm' ? 5 : -161);
  const rateKg = (p, weight) => (p.rateMode === 'pct' ? weight * PCT_RATE : p.ratePerWeek);
  const dailyDeficit = (kgPerWeek) => (kgPerWeek * KCAL_PER_KG) / 7;
  const adjustOn = (p, k) => (p.adjustLog || []).reduce((s, a) => (a.date <= k ? s + a.delta : s), 0);

  // Full goal breakdown for a profile at a given weight (and date for adaptive adjustments)
  function goalFor(p, weight, k) {
    const min = MIN_GOAL[p.sex];
    if (p.manualGoal) return { goal: Math.round(p.manualGoal), manual: true, min, belowMin: p.manualGoal < min };
    const b = bmr({ ...p, weight });
    const tdee = b * ACTIVITY[p.activity].f;
    const kg = rateKg(p, weight);
    const deficit = dailyDeficit(kg);
    const planned = Math.round(tdee - deficit);
    const adjust = k ? adjustOn(p, k) : 0;
    const goal = Math.max(planned + adjust, min);
    const floored = planned < min;                         // plan itself needs less than the safe minimum
    const realKg = floored ? Math.max(0, ((tdee - min) * 7) / KCAL_PER_KG) : kg;
    return { goal, bmr: b, tdee, deficit, kg, planned, adjust, floored, min, realKg, manual: false };
  }

  const proteinTarget = (p) => Math.round(PROTEIN_PER_KG * p.targetWeight);
  const exerciseKcal = (met, weight, minutes) => Math.max(0, Math.round((met - 1) * weight * (minutes / 60)));
  const stepsToMinutes = (steps) => steps / STEPS_PER_MIN;
  // segments: [{met, sec}] — net kcal ((MET−1) excludes resting metabolism already in the goal)
  const segmentsKcal = (segs, weight) => Math.round(segs.reduce((s, x) => s + Math.max(0, x.met - 1) * weight * (x.sec / 3600), 0));

  function dayTotals(day, goal, ratio) {
    const food = Math.round((day?.food || []).reduce((s, x) => s + x.kcal * x.qty, 0));
    const protein = Math.round((day?.food || []).reduce((s, x) => s + (x.protein || 0) * x.qty, 0));
    const exRaw = (day?.activity || []).reduce((s, x) => s + x.kcal, 0);
    const exCredit = Math.round(exRaw * ratio);
    const remaining = goal + exCredit - food;
    return { food, protein, exRaw, exCredit, budget: goal + exCredit, remaining, over: remaining < 0 };
  }

  /* ---------- Weight ---------- */
  function weightOn(days, k, fallback) {
    let best = null;
    for (const d in days) if (d <= k && typeof days[d].weight === 'number' && (best === null || d > best)) best = d;
    return best ? days[best].weight : fallback;
  }
  const weightKeys = (days) => Object.keys(days).filter((k) => typeof days[k].weight === 'number').sort();
  // Average weight over the n days ending at k (inclusive)
  function avgWeight(days, k, n = 7) {
    const start = addDays(k, -(n - 1));
    const ws = weightKeys(days).filter((d) => d >= start && d <= k).map((d) => days[d].weight);
    return { n: ws.length, avg: ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : null };
  }

  /* ---------- Weekly adaptive adjustment ---------- */
  // Returns {skip:reason} or {delta, wanted, actual, expected, curAvg, prevAvg, reason}
  function adaptiveCheck(S, today) {
    const p = S.profile;
    if (!p) return { skip: 'no_profile' };
    if (p.manualGoal) return { skip: 'manual' };
    if (p.lastAdjustCheck && daysBetween(p.lastAdjustCheck, today) < 7) return { skip: 'recent' };
    if (daysBetween(p.planStart, today) < WATER_PHASE_DAYS) return { skip: 'water_phase' };
    const cur = avgWeight(S.days, today, 7), prev = avgWeight(S.days, addDays(today, -7), 7);
    if (cur.n < 3 || prev.n < 3) return { skip: 'data', cur, prev };
    const actual = prev.avg - cur.avg;
    const expected = rateKg(p, cur.avg);
    let wanted = 0, reason = 'on_track';
    if (actual <= 0) { wanted = -150; reason = 'stalled'; }
    else if (actual < 0.5 * expected) { wanted = -100; reason = 'slow'; }
    else if (actual > 2 * expected) { wanted = 150; reason = 'too_fast'; }
    else if (actual > 1.5 * expected) { wanted = 100; reason = 'fast'; }
    const g = goalFor(p, cur.avg, today);
    const oldAdj = g.adjust;
    let newAdj = Math.max(-ADJUST_LIMIT, Math.min(ADJUST_LIMIT, oldAdj + wanted));
    if (g.planned + newAdj < g.min) newAdj = Math.max(g.min - g.planned, Math.min(oldAdj, newAdj + 0));
    let delta = newAdj - oldAdj;
    if (wanted < 0 && delta > 0) delta = 0;
    if (wanted < 0 && g.planned + oldAdj <= g.min) delta = 0;
    if (wanted !== 0 && delta === 0) reason = wanted < 0 ? 'at_floor' : 'at_cap';
    return { delta, wanted, actual, expected, curAvg: cur.avg, prevAvg: prev.avg, reason };
  }

  /* ---------- Logging / streaks ---------- */
  const isTraining = (a) => TRAINING_TYPES.has(a.type);
  const isLogged = (d) => !!d && ((d.food && d.food.length > 0) || (d.activity || []).some(isTraining));
  function streak(days, today) {
    let k = isLogged(days[today]) ? today : addDays(today, -1), n = 0;
    while (isLogged(days[k])) { n++; k = addDays(k, -1); }
    return n;
  }
  function maxStreak(days) {
    const keys = Object.keys(days).filter((k) => isLogged(days[k])).sort();
    let best = 0, run = 0, prev = null;
    for (const k of keys) { run = prev && daysBetween(prev, k) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = k; }
    return best;
  }
  const countWorkouts = (days) => Object.values(days).reduce((s, d) => s + (d.activity || []).filter(isTraining).length, 0);

  /* ---------- Weekly report ---------- */
  function weeklyReport(S, endKey) {
    const p = S.profile, ratio = S.settings.exerciseRatio;
    const start = addDays(endKey, -6);
    const cur = avgWeight(S.days, endKey, 7), prev = avgWeight(S.days, addDays(endKey, -7), 7);
    let logged = 0, within = 0, kcal = 0, protein = 0, workouts = 0, workoutMin = 0, workoutKcal = 0, steps = 0, stepDays = 0, water = 0, waterDays = 0;
    for (let i = 0; i < 7; i++) {
      const k = addDays(start, i), d = S.days[k];
      if (!d) continue;
      const g = goalFor(p, weightOn(S.days, k, p.startWeight), k).goal;
      const t = dayTotals(d, g, ratio);
      if (d.food && d.food.length) { logged++; kcal += t.food; protein += t.protein; if (t.food <= t.budget) within++; }
      for (const a of d.activity || []) if (isTraining(a)) { workouts++; workoutMin += a.minutes; workoutKcal += a.kcal; }
      if (d.steps) { steps += d.steps; stepDays++; }
      if (d.water) { water += d.water; waterDays++; }
    }
    const waistIn = Object.keys(S.days).filter((k) => typeof S.days[k].waist === 'number' && k >= start && k <= endKey).sort();
    const waistBefore = Object.keys(S.days).filter((k) => typeof S.days[k].waist === 'number' && k < start).sort();
    const waistNow = waistIn.length ? S.days[waistIn[waistIn.length - 1]].waist : null;
    const waistPrev = waistBefore.length ? S.days[waistBefore[waistBefore.length - 1]].waist : (waistIn.length > 1 ? S.days[waistIn[0]].waist : null);
    return {
      start, end: endKey,
      avgWeight: cur.avg, weighIns: cur.n, prevAvgWeight: prev.avg,
      weightDelta: cur.avg != null && prev.avg != null ? cur.avg - prev.avg : null,
      logged, within, avgKcal: logged ? Math.round(kcal / logged) : null, avgProtein: logged ? Math.round(protein / logged) : null,
      workouts, workoutMin, workoutKcal,
      avgSteps: stepDays ? Math.round(steps / stepDays) : null, avgWater: waterDays ? Math.round(water / waterDays) : null,
      waist: waistNow, waistDelta: waistNow != null && waistPrev != null && waistNow !== waistPrev ? waistNow - waistPrev : null
    };
  }

  /* ---------- Achievements ---------- */
  const ACHIEVEMENTS = [
    { id: 'first_log', title: 'البداية', desc: 'سجّلت أول يوم', icon: 'spark' },
    { id: 'first_workout', title: 'أول تمرين', desc: 'خلصت أول تمرين', icon: 'bolt' },
    { id: 'workouts_10', title: '10 تمارين', desc: 'خلصت 10 تمارين', icon: 'dumbbell' },
    { id: 'workouts_25', title: '25 تمرين', desc: 'خلصت 25 تمرين', icon: 'trophy' },
    { id: 'streak_7', title: 'أسبوع متواصل', desc: '7 أيام تسجيل متتالية', icon: 'flame' },
    { id: 'streak_30', title: 'شهر متواصل', desc: '30 يوم تسجيل متتالي', icon: 'crown' },
    { id: 'perfect_week', title: 'أسبوع التزام كامل', desc: '7 أيام ضمن السعرات + تمارين الأسبوع كاملة', icon: 'medal' },
    { id: 'lost_5', title: 'أول 5 كجم', desc: 'نزلت 5 كجم من أول وزن', icon: 'scale' },
    { id: 'lost_10', title: '10 كجم', desc: 'نزلت 10 كجم من أول وزن', icon: 'star' },
    { id: 'first_photo', title: 'أول صورة', desc: 'حفظت أول صورة تقدّم', icon: 'camera' }
  ];
  function perfectWeekEnding(S, end) {
    const p = S.profile, ratio = S.settings.exerciseRatio;
    let workouts = 0;
    for (let i = 0; i < 7; i++) {
      const k = addDays(end, -i), d = S.days[k];
      if (!d || !d.food || !d.food.length) return false;
      const g = goalFor(p, weightOn(S.days, k, p.startWeight), k).goal;
      if (dayTotals(d, g, ratio).over) return false;
      workouts += (d.activity || []).filter(isTraining).length;
    }
    return workouts >= (p.trainDays || 3);
  }
  function earnedAchievements(S, today, photoCount = 0) {
    const out = new Set();
    const days = S.days, p = S.profile;
    if (!p) return out;
    if (Object.values(days).some(isLogged)) out.add('first_log');
    const w = countWorkouts(days);
    if (w >= 1) out.add('first_workout');
    if (w >= 10) out.add('workouts_10');
    if (w >= 25) out.add('workouts_25');
    const ms = maxStreak(days);
    if (ms >= 7) out.add('streak_7');
    if (ms >= 30) out.add('streak_30');
    const wk = weightKeys(days);
    if (wk.length) {
      const first = days[wk[0]].weight, last = days[wk[wk.length - 1]].weight;
      if (first - last >= 5) out.add('lost_5');
      if (first - last >= 10) out.add('lost_10');
    }
    if (photoCount > 0) out.add('first_photo');
    if (!(S.achievements || {}).perfect_week) {
      for (const k of Object.keys(days)) if (k <= today && perfectWeekEnding(S, k)) { out.add('perfect_week'); break; }
    } else out.add('perfect_week');
    return out;
  }

  /* ---------- Migration (v1 → v2), idempotent ---------- */
  function migrate(input, today) {
    const d = JSON.parse(JSON.stringify(input || {}));
    const from = d.version || 1;
    d.settings = { exerciseRatio: 0.5, theme: 'dark', sound: true, ...(d.settings || {}) };
    d.meals = Array.isArray(d.meals) ? d.meals : [];
    d.days = d.days && typeof d.days === 'object' ? d.days : {};
    d.achievements = d.achievements && typeof d.achievements === 'object' ? d.achievements : {};
    d.notices = Array.isArray(d.notices) ? d.notices : [];
    for (const m of d.meals) {
      if (typeof m.protein !== 'number') m.protein = null;
      if (!m.sizes || typeof m.sizes !== 'object') m.sizes = {};
    }
    for (const k in d.days) {
      const day = d.days[k];
      if (!Array.isArray(day.food)) day.food = [];
      if (!Array.isArray(day.activity)) day.activity = [];
    }
    const p = d.profile;
    if (p) {
      if (!p.rateMode) p.rateMode = 'kg';
      if (p.rateMode === 'kg' && !RATES.includes(p.ratePerWeek)) {
        const old = p.ratePerWeek;
        p.ratePerWeek = RATES.reduce((a, b) => (Math.abs(b - old) < Math.abs(a - old) ? b : a));
        if (!p.manualGoal && !d.notices.some((n) => n.type === 'rate_migrated')) {
          d.notices.push({ id: 'rate_migrated', type: 'rate_migrated', date: today, from: old, to: p.ratePerWeek });
        }
      }
      if (!Array.isArray(p.adjustLog)) p.adjustLog = [];
      if (p.lastAdjustCheck === undefined) p.lastAdjustCheck = null;
      if (!p.planStart) { const wk = weightKeys(d.days); p.planStart = wk.length ? wk[0] : today; }
      if (!p.level) p.level = 'beginner';
      if (!p.trainDays) p.trainDays = 4;
      if (p.stepsGoal === undefined) p.stepsGoal = null;
      if (!p.waterGoal) p.waterGoal = 2000;
    }
    d.version = 2;
    return { data: d, from, changed: from !== 2 };
  }

  const Calc = {
    ACTIVITY, RATES, PCT_RATE, KCAL_PER_KG, MIN_GOAL, MET, EXERCISES, STEPS_PER_MIN, ACHIEVEMENTS, WATER_PHASE_DAYS, ADJUST_LIMIT,
    dateKey, parseKey, addDays, daysBetween,
    bmr, rateKg, dailyDeficit, adjustOn, goalFor, proteinTarget, exerciseKcal, stepsToMinutes, segmentsKcal, dayTotals,
    weightOn, weightKeys, avgWeight, adaptiveCheck,
    isTraining, isLogged, streak, maxStreak, countWorkouts, weeklyReport, earnedAchievements, perfectWeekEnding, migrate
  };
  M.Calc = Calc;
  if (typeof module !== 'undefined') module.exports = Calc;
})(typeof window !== 'undefined' ? window : globalThis);

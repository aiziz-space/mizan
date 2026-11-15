// Run: node tests/calc.test.js
const R = require('path').join(__dirname, '../js/');
const C = require(R + 'calc.js'); require(R + 'data-exercises.js'); const P = require(R + 'data-programs.js'); const T = require(R + 'data-tips.js');
const assert = require('assert'); let n = 0; const t = (name, f) => { f(); n++; console.log('✓', name); };
const base = { sex: 'm', age: 30, heightCm: 175, activity: 'moderate', ratePerWeek: 0.5, rateMode: 'kg', manualGoal: null, targetWeight: 78, adjustLog: [] };
// ---- goal
t('goal 0.5 = 2316 (v1 parity)', () => assert.strictEqual(C.goalFor(base, 90).goal, 2316));
t('goal 1 kg = 1766', () => assert.strictEqual(C.goalFor({ ...base, ratePerWeek: 1 }, 90).goal, Math.round(1848.75 * 1.55 - 1100)));
t('pct mode: 1% of 90 = 0.9 kg → deficit 990', () => { const g = C.goalFor({ ...base, rateMode: 'pct' }, 90); assert.strictEqual(+g.kg.toFixed(2), 0.9); assert.strictEqual(Math.round(g.deficit), 990); assert.strictEqual(g.goal, Math.round(2865.5625 - 990)); });
t('floor + warning + realKg', () => { const g = C.goalFor({ sex: 'f', age: 50, heightCm: 155, activity: 'sedentary', ratePerWeek: 1, rateMode: 'kg', adjustLog: [] }, 60);
  assert.ok(g.floored); assert.strictEqual(g.goal, 1200); assert.ok(g.planned < 1200); assert.ok(Math.abs(g.realKg - (g.tdee - 1200) * 7 / 7700) < 1e-9); });
t('manual goal bypasses + belowMin flag', () => { const g = C.goalFor({ ...base, manualGoal: 1300 }, 90); assert.strictEqual(g.goal, 1300); assert.ok(g.belowMin); });
t('adjust applies from its date only', () => { const p = { ...base, adjustLog: [{ date: '2026-11-10', delta: -100 }] };
  assert.strictEqual(C.goalFor(p, 90, '2026-11-09').goal, 2316); assert.strictEqual(C.goalFor(p, 90, '2026-11-10').goal, 2216); });
t('adjust never below floor', () => { const p = { sex: 'm', age: 60, heightCm: 165, activity: 'sedentary', ratePerWeek: 0.5, rateMode: 'kg', adjustLog: [{ date: '2026-01-01', delta: -600 }] };
  assert.strictEqual(C.goalFor(p, 70, '2026-02-01').goal, 1500); });
t('protein = 1.6 × target', () => assert.strictEqual(C.proteinTarget({ targetWeight: 78 }), 125));
t('dayTotals with protein & qty', () => { const r = C.dayTotals({ food: [{ kcal: 400, qty: 1.5, protein: 30 }, { kcal: 300, qty: 1 }], activity: [{ kcal: 342 }] }, 2316, 0.5);
  assert.deepStrictEqual([r.food, r.protein, r.exCredit, r.remaining, r.budget], [900, 45, 171, 1587, 2487]); });
t('segmentsKcal: rest (MET 1) adds nothing', () => { assert.strictEqual(C.segmentsKcal([{ met: 7.5, sec: 600 }, { met: 1, sec: 600 }], 90), Math.round(6.5 * 90 / 6)); });
// ---- adaptive
const mk = (pairs) => Object.fromEntries(pairs.map(([k, w]) => [k, { food: [], activity: [], weight: w }]));
const daysSeq = (start, ws) => mk(ws.map((w, i) => [C.addDays(start, i), w]));
const S0 = (days, extra = {}) => ({ profile: { ...base, planStart: '2026-10-01', lastAdjustCheck: null, ...extra }, days, settings: { exerciseRatio: 0.5 } });
t('adaptive: skip in water phase (<14 days)', () => assert.strictEqual(C.adaptiveCheck(S0({}, { planStart: '2026-11-05' }), '2026-11-15').skip, 'water_phase'));
t('adaptive: skip with <3 weigh-ins', () => assert.strictEqual(C.adaptiveCheck(S0(daysSeq('2026-11-13', [90, 90])), '2026-11-15').skip, 'data'));
t('adaptive: skip if checked <7 days ago', () => assert.strictEqual(C.adaptiveCheck(S0({}, { lastAdjustCheck: '2026-11-10' }), '2026-11-15').skip, 'recent'));
t('adaptive: skip manual', () => assert.strictEqual(C.adaptiveCheck(S0({}, { manualGoal: 2000 }), '2026-11-15').skip, 'manual'));
t('adaptive: stalled → −150', () => { const r = C.adaptiveCheck(S0(daysSeq('2026-11-02', Array(14).fill(90))), '2026-11-15'); assert.strictEqual(r.delta, -150); assert.strictEqual(r.reason, 'stalled'); });
t('adaptive: slow (0.2 vs 0.5) → −100', () => { const r = C.adaptiveCheck(S0(daysSeq('2026-11-02', [...Array(7).fill(90.2), ...Array(7).fill(90)])), '2026-11-15'); assert.strictEqual(r.delta, -100); });
t('adaptive: on track → 0', () => { const r = C.adaptiveCheck(S0(daysSeq('2026-11-02', [...Array(7).fill(90.5), ...Array(7).fill(90)])), '2026-11-15'); assert.strictEqual(r.delta, 0); assert.strictEqual(r.reason, 'on_track'); });
t('adaptive: fast (0.9) → +100', () => { const r = C.adaptiveCheck(S0(daysSeq('2026-11-02', [...Array(7).fill(90.9), ...Array(7).fill(90)])), '2026-11-15'); assert.strictEqual(r.delta, 100); });
t('adaptive: too fast (1.2) → +150', () => { const r = C.adaptiveCheck(S0(daysSeq('2026-11-02', [...Array(7).fill(91.2), ...Array(7).fill(90)])), '2026-11-15'); assert.strictEqual(r.delta, 150); });
t('adaptive: uses 7-day average not single day', () => { // last day spikes but averages show 0.5 drop
  const ws = [...Array(7).fill(90.5), 90, 90, 90, 90, 90, 89.5, 90.5]; const r = C.adaptiveCheck(S0(daysSeq('2026-11-02', ws)), '2026-11-15'); assert.strictEqual(r.reason, 'on_track'); });
t('adaptive: at floor → no cut', () => { const S = S0(daysSeq('2026-11-02', Array(14).fill(60)), { sex: 'f', age: 50, heightCm: 155, activity: 'sedentary', ratePerWeek: 1 });
  const r = C.adaptiveCheck(S, '2026-11-15'); assert.strictEqual(r.delta, 0); assert.strictEqual(r.reason, 'at_floor'); });
t('adaptive: partial cut down to floor', () => { const S = S0(daysSeq('2026-11-02', Array(14).fill(85)), { sex: 'm', age: 40, heightCm: 175, activity: 'sedentary', ratePerWeek: 0.5 });
  const g = C.goalFor(S.profile, 85); const room = g.planned - 1500; const r = C.adaptiveCheck(S, '2026-11-15');
  assert.ok(room > 0 && room < 150, 'room ' + room); assert.strictEqual(r.delta, -room); });
t('adaptive: cap ±600', () => { const S = S0(daysSeq('2026-11-02', Array(14).fill(90)), { adjustLog: [{ date: '2026-10-01', delta: -550 }] }); assert.strictEqual(C.adaptiveCheck(S, '2026-11-15').delta, -50); });
// ---- streak / report / achievements
const D = (o) => ({ food: [], activity: [], ...o });
t('streak counts from yesterday if today empty', () => { const days = { '2026-11-12': D({ food: [{ kcal: 1, qty: 1 }] }), '2026-11-13': D({ food: [{ kcal: 1, qty: 1 }] }), '2026-11-14': D({ activity: [{ type: 'workout', kcal: 1 }] }) };
  assert.strictEqual(C.streak(days, '2026-11-15'), 3); days['2026-11-15'] = D({ food: [{ kcal: 1, qty: 1 }] }); assert.strictEqual(C.streak(days, '2026-11-15'), 4);
  delete days['2026-11-13']; assert.strictEqual(C.streak(days, '2026-11-15'), 2); });
t('streak: walk-only day does not count, weight-only neither', () => { const days = { '2026-11-14': D({ activity: [{ type: 'walk', kcal: 1 }], weight: 90 }) }; assert.strictEqual(C.streak(days, '2026-11-15'), 0); });
t('maxStreak', () => { const days = {}; for (let i = 0; i < 9; i++) days[C.addDays('2026-10-01', i)] = D({ food: [{ kcal: 1, qty: 1 }] }); days['2026-10-20'] = D({ food: [{ kcal: 1, qty: 1 }] }); assert.strictEqual(C.maxStreak(days), 9); });
t('weekly report', () => { const days = daysSeq('2026-11-02', [...Array(7).fill(91), ...Array(7).fill(90)]);
  days['2026-11-15'].food = [{ kcal: 2000, qty: 1, protein: 100 }]; days['2026-11-14'].food = [{ kcal: 3000, qty: 1 }]; days['2026-11-14'].activity = [{ type: 'workout', minutes: 20, kcal: 150 }];
  days['2026-11-14'].waist = 100; days['2026-11-01'] = D({ waist: 102 }); days['2026-11-15'].steps = 8000; days['2026-11-15'].water = 2000;
  const r = C.weeklyReport({ profile: { ...base, startWeight: 91 }, days, settings: { exerciseRatio: 0.5 } }, '2026-11-15');
  assert.strictEqual(r.avgWeight, 90); assert.strictEqual(r.prevAvgWeight, 91); assert.strictEqual(r.weightDelta, -1); assert.strictEqual(r.logged, 2); assert.strictEqual(r.within, 1);
  assert.strictEqual(r.avgKcal, 2500); assert.strictEqual(r.avgProtein, 50); assert.strictEqual(r.workouts, 1); assert.strictEqual(r.waist, 100); assert.strictEqual(r.waistDelta, -2); assert.strictEqual(r.avgSteps, 8000); assert.strictEqual(r.avgWater, 2000); });
t('achievements', () => { const days = {}; for (let i = 0; i < 7; i++) days[C.addDays('2026-11-09', i)] = D({ food: [{ kcal: 1500, qty: 1 }], activity: i < 4 ? [{ type: 'workout', kcal: 100, minutes: 20 }] : [] });
  days['2026-11-09'].weight = 96; days['2026-11-15'].weight = 90.5;
  const e = C.earnedAchievements({ profile: { ...base, trainDays: 4, startWeight: 96 }, days, settings: { exerciseRatio: 0.5 }, achievements: {} }, '2026-11-15', 1);
  for (const id of ['first_log', 'first_workout', 'streak_7', 'perfect_week', 'lost_5', 'first_photo']) assert.ok(e.has(id), id);
  for (const id of ['workouts_10', 'lost_10', 'streak_30']) assert.ok(!e.has(id), id); });
t('perfect week fails if a day is over budget', () => { const days = {}; for (let i = 0; i < 7; i++) days[C.addDays('2026-11-09', i)] = D({ food: [{ kcal: i === 3 ? 4000 : 1500, qty: 1 }], activity: [{ type: 'workout', kcal: 100, minutes: 20 }] });
  assert.ok(!C.perfectWeekEnding({ profile: { ...base, trainDays: 4, startWeight: 90 }, days, settings: { exerciseRatio: 0.5 } }, '2026-11-15')); });
// ---- migration
const v1 = { profile: { sex: 'm', age: 30, heightCm: 175, startWeight: 90, targetWeight: 78, activity: 'moderate', ratePerWeek: 0.25, manualGoal: null }, settings: { exerciseRatio: 0.5 }, meals: [{ id: 'a', name: 'شوفان', kcal: 350 }],
  days: { '2026-11-10': { food: [{ id: 'f', name: 'x', kcal: 350, qty: 1 }], activity: [{ id: 'g', type: 'brisk', minutes: 60, steps: 6000, kcal: 342 }], weight: 92 }, '2026-11-15': { food: [], activity: [], weight: 90 } } };
t('migrate v1 → v2 keeps all data', () => { const { data, changed, from } = C.migrate(v1, '2026-11-15');
  assert.ok(changed); assert.strictEqual(from, 1); assert.strictEqual(data.version, 2);
  assert.deepStrictEqual(data.days['2026-11-10'].food, v1.days['2026-11-10'].food); assert.deepStrictEqual(data.days['2026-11-10'].activity, v1.days['2026-11-10'].activity);
  assert.strictEqual(data.days['2026-11-10'].weight, 92); assert.strictEqual(data.meals[0].kcal, 350); assert.strictEqual(data.meals[0].name, 'شوفان');
  assert.strictEqual(data.profile.planStart, '2026-11-10'); assert.strictEqual(data.profile.rateMode, 'kg'); assert.strictEqual(data.settings.theme, 'dark'); });
t('migrate 0.25 → 0.5 + notice', () => { const { data } = C.migrate(v1, '2026-11-15'); assert.strictEqual(data.profile.ratePerWeek, 0.5); assert.strictEqual(data.notices[0].type, 'rate_migrated'); assert.strictEqual(data.notices[0].from, 0.25); });
t('migrate is idempotent', () => { const a = C.migrate(v1, '2026-11-15').data; const b = C.migrate(a, '2026-11-16'); assert.ok(!b.changed); assert.deepStrictEqual(b.data, a); });
t('migrate does not mutate input', () => { const copy = JSON.parse(JSON.stringify(v1)); C.migrate(v1, '2026-11-15'); assert.deepStrictEqual(v1, copy); });
t('migrate manual goal: no notice', () => { const { data } = C.migrate({ ...v1, profile: { ...v1.profile, manualGoal: 1900 } }, '2026-11-15'); assert.strictEqual(data.notices.length, 0); });
// ---- programs
t('every program 10–25 min & all exercises exist', () => { for (const d of P.PROGRAMS) { const s = P.buildSession(d); const m = P.totalSec(s) / 60; assert.ok(m >= 10 && m <= 25, d.id + ' ' + m);
  for (const x of s) assert.ok(globalThis.M.EX.BY_ID[x.ex], x.ex); } });
t('session has prep, warm-up, work/rest and cool-down in order', () => { const s = P.buildSession(P.PROGRAMS[0]); assert.strictEqual(s[0].kind, 'prep'); assert.strictEqual(s[1].kind, 'warm'); assert.strictEqual(s[s.length - 1].kind, 'cool');
  const ks = s.map((x) => x.kind).join(','); assert.ok(/warm,work/.test(ks) && /work,cool/.test(ks) && /work,rest,work/.test(ks)); });
t('plan deterministic per date', () => { const p = { level: 'intermediate', trainDays: 4, planStart: '2026-11-01' }; assert.deepStrictEqual(P.planFor(p, '2026-11-14'), P.planFor(p, '2026-11-14')); });
t('plan training days match setting', () => { for (const n of [3, 4, 5]) { const p = { level: 'beginner', trainDays: n, planStart: '2026-11-01' }; const s = P.weekSchedule(p, '2026-11-15'); assert.strictEqual(s.filter((x) => !x.rest).length, n); } });
t('plan rotates session kinds', () => { const p = { level: 'intermediate', trainDays: 5, planStart: '2026-11-01' }; const kinds = P.weekSchedule(p, '2026-11-15').filter((x) => !x.rest).map((x) => x.kind); assert.ok(new Set(kinds).size >= 3, kinds); });
t('plan avoids repeating previous session items', () => { const p = { level: 'intermediate', trainDays: 5, planStart: '2026-11-01' }; const s = P.weekSchedule(p, '2026-11-15').filter((x) => !x.rest);
  for (let i = 1; i < s.length; i++) { const a = s[i - 1].def.blocks[0].items, b = s[i].def.blocks[0].items; const same = b.filter((x) => a.includes(x)).length; assert.ok(same <= 1, `${a} vs ${b}`); } });
t('plan progresses: week 4 work > week 1 work, ≤25 min', () => { const p = { level: 'beginner', trainDays: 3, planStart: '2026-11-07' };
  const w1 = P.planFor(p, '2026-11-07'), w4 = P.planFor(p, '2026-11-28'); assert.ok(w4.def.blocks[0].work > w1.def.blocks[0].work);
  for (let i = 0; i < 70; i++) { const k = C.addDays('2026-11-07', i); const r = P.planFor(p, k); if (!r.rest) assert.ok(P.totalSec(P.buildSession(r.def)) <= 25 * 60, k); } });
t('tips: 30+ and deterministic', () => { assert.ok(T.TIPS.length >= 30); assert.strictEqual(T.tipFor('2026-11-15'), T.tipFor('2026-11-15')); assert.notStrictEqual(T.tipFor('2026-11-15'), T.tipFor('2026-11-16')); });
t('tips: no supplements/pills', () => { for (const x of T.TIPS) assert.ok(!/مكمل|حبوب|حارق/.test(x.text), x.text); });
console.log(n, 'tests passed');

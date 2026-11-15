/* ميزان — ready programs, weekly progressive plan generator, gym program. */
(function (root) {
  'use strict';
  const M = (root.M = root.M || {});
  const C = M.Calc, EX = M.EX;
  const MET = C.MET;

  const WARM = [['march', 40], ['arm_circles', 30], ['hip_circles', 30], ['leg_swings', 30], ['cat_cow', 30], ['inchworm', 40]];
  const COOL = [['quad_stretch', 40], ['hamstring_stretch', 40], ['hip_flexor', 40], ['chest_stretch', 30], ['child_pose', 40], ['breathing', 30]];
  const PREP = 10;

  const LEVELS = {
    beginner: { label: 'مبتدئ', work: 30, rest: 30, minRest: 15, rounds: 2 },
    intermediate: { label: 'متوسط', work: 40, rest: 20, minRest: 10, rounds: 2 },
    advanced: { label: 'متقدم', work: 45, rest: 15, minRest: 10, rounds: 3 }
  };
  const KINDS = {
    strength: { label: 'قوة', met: 'cal_moderate', slots: ['legs', 'push', 'back', 'core', 'legs'] },
    hiit: { label: 'HIIT حرق', met: 'cal_vigorous', slots: ['cardio', 'legs', 'cardio', 'push', 'cardio'] },
    circuit: { label: 'سيركت', met: 'circuit', slots: ['legs', 'push', 'cardio', 'back', 'core'] },
    lowcardio: { label: 'كارديو خفيف', met: 'cal_moderate', slots: ['cardio', 'legs', 'cardio', 'core'] }
  };
  const ROTATION = { beginner: ['strength', 'lowcardio', 'strength'], intermediate: ['strength', 'hiit', 'circuit'], advanced: ['strength', 'hiit', 'circuit'] };
  const POOLS = {
    beginner: {
      legs: ['squat', 'chair_squat', 'sumo_squat', 'wall_sit', 'step_up', 'calf_raise'],
      push: ['knee_pushup', 'incline_pushup'],
      back: ['glute_bridge', 'superman', 'good_morning'],
      core: ['plank', 'dead_bug', 'bird_dog', 'reverse_crunch'],
      cardio: ['step_jacks', 'march', 'jumping_jacks']
    },
    intermediate: {
      legs: ['squat', 'reverse_lunge', 'sumo_squat', 'side_lunge', 'step_up', 'wall_sit'],
      push: ['pushup', 'knee_pushup', 'tricep_dip', 'incline_pushup'],
      back: ['glute_bridge', 'single_bridge', 'superman', 'good_morning'],
      core: ['plank', 'side_plank', 'dead_bug', 'bicycle', 'bird_dog', 'reverse_crunch'],
      cardio: ['jumping_jacks', 'high_knees', 'mountain_climber', 'skater']
    },
    advanced: {
      legs: ['squat_jump', 'bulgarian', 'reverse_lunge', 'side_lunge', 'sumo_squat'],
      push: ['pushup', 'pike_pushup', 'tricep_dip', 'plank_taps'],
      back: ['single_bridge', 'superman', 'good_morning'],
      core: ['side_plank', 'plank_taps', 'bicycle', 'reverse_crunch', 'dead_bug'],
      cardio: ['burpee', 'mountain_climber', 'skater', 'high_knees', 'jumping_jacks']
    }
  };
  // JS getDay(): 0=Sun … 6=Sat. Week starts Saturday.
  const TRAIN_DAYS = { 3: [6, 1, 3], 4: [6, 1, 3, 4], 5: [6, 0, 1, 3, 4] };
  const MAIN_BUDGET = 17.5 * 60; // keep whole session ≤ ~25 min with warm-up + cool-down

  /* ---------- Ready programs ---------- */
  const blk = (rounds, work, rest, items, roundRest = 0) => ({ rounds, work, rest, roundRest, items });
  const PROGRAMS = [
    { id: 'p_beginner', title: 'أساسيات الجسم', level: 'beginner', kind: 'strength', met: 'cal_moderate',
      desc: 'بداية مريحة لكل العضلات الكبيرة.', blocks: [blk(2, 30, 30, ['squat', 'knee_pushup', 'glute_bridge', 'bird_dog', 'plank'], 30)] },
    { id: 'p_lowcardio', title: 'كارديو بدون قفز', level: 'beginner', kind: 'lowcardio', met: 'cal_moderate',
      desc: 'حرق لطيف على الركب والجيران.', blocks: [blk(3, 30, 30, ['step_jacks', 'chair_squat', 'march', 'dead_bug'], 30)] },
    { id: 'p_intermediate', title: 'قوة كامل الجسم', level: 'intermediate', kind: 'strength', met: 'cal_moderate',
      desc: 'تمارين مركبة 40 ثانية عمل و20 راحة.', blocks: [blk(3, 40, 20, ['squat', 'pushup', 'reverse_lunge', 'superman', 'side_plank'], 40)] },
    { id: 'p_hiit', title: 'HIIT حرق 40/20', level: 'intermediate', kind: 'hiit', met: 'cal_vigorous',
      desc: 'فترات عالية الشدة ترفع النبض.', blocks: [blk(3, 40, 20, ['jumping_jacks', 'squat', 'mountain_climber', 'high_knees'], 40)] },
    { id: 'p_tabata', title: 'تاباتا 20/10', level: 'advanced', kind: 'hiit', met: 'cal_vigorous',
      desc: 'جولتين × 4 دقايق، عمل 20 وراحة 10.', blocks: [blk(4, 20, 10, ['high_knees', 'squat_jump'], 0), blk(4, 20, 10, ['mountain_climber', 'jumping_jacks'], 0)], blockRest: 60 },
    { id: 'p_circuit', title: 'سيركت كامل الجسم', level: 'intermediate', kind: 'circuit', met: 'circuit',
      desc: '6 محطات بدون توقف طويل.', blocks: [blk(2, 40, 20, ['squat', 'pushup', 'reverse_lunge', 'glute_bridge', 'mountain_climber', 'plank'], 45)] },
    { id: 'p_advanced', title: 'قوة وتحمّل', level: 'advanced', kind: 'strength', met: 'cal_vigorous',
      desc: 'للمتقدم: قفزات وتمارين على رجل وحدة.', blocks: [blk(3, 45, 15, ['squat_jump', 'pushup', 'bulgarian', 'pike_pushup', 'burpee'], 40)] }
  ];

  /* ---------- Build timer segments ---------- */
  function buildSession(def) {
    const segs = [];
    const first = def.warm === false ? def.blocks[0].items[0] : WARM[0][0];
    segs.push({ kind: 'prep', ex: first, sec: PREP, met: 1 });
    if (def.warm !== false) for (const [ex, sec] of WARM) segs.push({ kind: 'warm', ex, sec, met: MET.cal_light });
    def.blocks.forEach((b, bi) => {
      for (let r = 1; r <= b.rounds; r++) {
        b.items.forEach((ex, i) => {
          segs.push({ kind: 'work', ex, sec: b.work, met: MET[def.met], round: r, rounds: b.rounds, block: bi });
          const lastItem = i === b.items.length - 1, lastRound = r === b.rounds, lastBlock = bi === def.blocks.length - 1;
          if (lastItem && lastRound && lastBlock) return;
          let rest = b.rest;
          if (lastItem && !lastRound && b.roundRest) rest = b.roundRest;
          if (lastItem && lastRound && def.blockRest) rest = def.blockRest;
          if (rest > 0) {
            const nextEx = lastItem ? (lastRound ? def.blocks[bi + 1].items[0] : b.items[0]) : b.items[i + 1];
            segs.push({ kind: 'rest', ex: nextEx, sec: rest, met: 1, round: r, rounds: b.rounds, block: bi });
          }
        });
      }
    });
    if (def.cool !== false) for (const [ex, sec] of COOL) segs.push({ kind: 'cool', ex, sec, met: MET.cal_light });
    return segs;
  }
  const totalSec = (segs) => segs.reduce((s, x) => s + x.sec, 0);
  const mainSec = (b) => b.rounds * b.items.length * (b.work + b.rest) - b.rest + (b.rounds - 1) * Math.max(0, (b.roundRest || 0) - b.rest);

  /* ---------- Seeded PRNG ---------- */
  function seedOf(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; }
  function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* ---------- Weekly progressive plan ---------- */
  const isTrainDay = (k, n) => (TRAIN_DAYS[n] || TRAIN_DAYS[4]).includes(C.parseKey(k).getDay());
  const weekOf = (start, k) => Math.max(0, Math.floor(C.daysBetween(start, k) / 7));
  // weeks 5–8: one more slot per week uses harder variations (advanced: shorter round rests instead)
  const harderFor = (level, kind, week) => (level === 'advanced' ? 0 : Math.max(0, Math.min(week - 3, KINDS[kind].slots.length)));

  const NEXT = { beginner: 'intermediate', intermediate: 'advanced', advanced: 'advanced' };
  // harder = number of slots (from the start) drawn from the next level's pool
  function pickExercises(level, kind, k, exclude, harder = 0) {
    const r = rng(seedOf(k + level + kind));
    const used = new Set();
    return KINDS[kind].slots.map((slot, i) => {
      const pool = POOLS[i < harder ? NEXT[level] : level][slot];
      let cand = pool.filter((x) => !used.has(x) && !exclude.has(x));
      if (!cand.length) cand = pool.filter((x) => !used.has(x));
      if (!cand.length) cand = pool;
      const pick = cand[Math.floor(r() * cand.length)];
      used.add(pick);
      return pick;
    });
  }

  // Sessions are generated sequentially from planStart so each one can avoid the previous one's
  // exercises consistently (memoized per level/days/start).
  const chains = new Map();
  function sessionAt(level, n, start, k) {
    if (k < start) { const kind = ROTATION[level][0]; return { idx: 0, kind, items: pickExercises(level, kind, k, new Set()) }; }
    const key = `${level}|${n}|${start}`;
    let c = chains.get(key);
    if (!c) { c = { upto: C.addDays(start, -1), idx: 0, last: null, days: {} }; chains.set(key, c); }
    for (let d = C.addDays(c.upto, 1); d <= k; d = C.addDays(d, 1)) {
      if (isTrainDay(d, n)) {
        const rot = ROTATION[level], kind = rot[c.idx % rot.length];
        const items = pickExercises(level, kind, d, new Set(c.last || []), harderFor(level, kind, weekOf(start, d)));
        c.days[d] = { idx: c.idx, kind, items }; c.last = items; c.idx++;
      }
      c.upto = d;
    }
    return c.days[k];
  }

  // Returns {rest:true, week} or {rest:false, def, week, kind, levelUp}
  function planFor(profile, k) {
    const level = profile.level || 'beginner', n = profile.trainDays || 4;
    const start = profile.planStart || k;
    const week = weekOf(start, k);
    if (!isTrainDay(k, n)) return { rest: true, week };
    const { kind, items } = sessionAt(level, n, start, k);
    const L = LEVELS[level];
    const step = Math.min(week, 3);
    // keep the work+rest cycle constant: more work, less rest each week
    const rest = Math.max(L.minRest, L.rest - 5 * step);
    const work = L.work + L.rest - rest;
    let rounds = L.rounds + (week >= 2 ? 1 : 0) + (week >= 5 ? 1 : 0);
    const harder = harderFor(level, kind, week);
    const roundRest = level === 'beginner' ? 45 : level === 'advanced' ? Math.max(15, 30 - 5 * Math.max(0, week - 3)) : 30;
    while (rounds > 1 && mainSec({ rounds, items, work, rest, roundRest }) > MAIN_BUDGET) rounds--;
    const def = {
      id: 'plan_' + k, title: `${KINDS[kind].label} · ${L.label}`, level, kind, met: KINDS[kind].met,
      desc: `الأسبوع ${week + 1}: ${work} ث عمل / ${rest} ث راحة × ${rounds} جولات` + (harder ? ` · ${harder} تمارين أصعب` : ''),
      blocks: [{ rounds, work, rest, roundRest, items }]
    };
    return { rest: false, def, week, kind, levelUp: week >= 8 && level !== 'advanced' };
  }

  function weekSchedule(profile, k) {
    // Saturday-start week containing k
    const d = C.parseKey(k), back = (d.getDay() + 1) % 7;
    const sat = C.addDays(k, -back);
    return Array.from({ length: 7 }, (_, i) => { const day = C.addDays(sat, i); return { k: day, ...planFor(profile, day) }; });
  }

  /* ---------- Gym: 3-day full body for beginners (A/B alternating) ---------- */
  const GYM = {
    days: {
      A: { title: 'اليوم A', items: [
        { ex: 'goblet_squat', sets: 3, reps: '8–12', rest: 90 },
        { ex: 'db_bench', sets: 3, reps: '8–12', rest: 90 },
        { ex: 'lat_pulldown', sets: 3, reps: '10–12', rest: 75 },
        { ex: 'rdl', sets: 3, reps: '8–12', rest: 90 },
        { ex: 'plank', sets: 3, reps: '30 ثانية', rest: 45 }
      ] },
      B: { title: 'اليوم B', items: [
        { ex: 'leg_press', sets: 3, reps: '10–12', rest: 90 },
        { ex: 'seated_row', sets: 3, reps: '10–12', rest: 75 },
        { ex: 'db_press', sets: 3, reps: '8–12', rest: 90 },
        { ex: 'hip_thrust', sets: 3, reps: '10–12', rest: 75 },
        { ex: 'dead_bug', sets: 3, reps: '8 لكل جهة', rest: 45 }
      ] }
    },
    warm: '5 دقايق مشي سريع أو دراجة، ثم مجموعة خفيفة (نص الوزن) لأول تمرين.',
    cool: 'إطالات التبريد: الفخذ الأمامي والخلفي ومقدمة الورك والصدر، 30–40 ثانية لكل وحدة.',
    guide: [
      '3 أيام بالأسبوع بينها يوم راحة (مثلاً سبت، اثنين، أربعاء). بدّل بين A و B.',
      'اختر وزن تقدر تسوي فيه الحد الأدنى من التكرارات وباقي عندك تكرارين تقريباً قبل الفشل.',
      'التدرّج المزدوج: لما توصل الحد الأعلى للتكرارات في كل المجموعات، زِد الوزن أقل زيادة متاحة وارجع للحد الأدنى.',
      'الأداء الصحيح أهم من الوزن. لو الحركة خربت، خفّف.',
      'سجّل الجلسة بعدها عشان تنحسب سعراتها.'
    ],
    met: MET.weights,
    nextDay: (count) => (count % 2 === 0 ? 'A' : 'B')
  };

  M.Programs = { WARM, COOL, LEVELS, KINDS, POOLS, TRAIN_DAYS, PROGRAMS, GYM, buildSession, totalSec, mainSec, planFor, weekSchedule, isTrainDay, seedOf, rng };
  if (typeof module !== 'undefined') module.exports = M.Programs;
})(typeof window !== 'undefined' ? window : globalThis);

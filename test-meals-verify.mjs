import assert from 'node:assert';
import { readFileSync } from 'node:fs';

// ===== helpers =====
const LS_PREFIX = 'ddc_today_sim_';
const simStore = {};
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function saveToday(t) { simStore[LS_PREFIX + todayKey()] = JSON.stringify(t); }
function loadToday() {
  const raw = simStore[LS_PREFIX + todayKey()] || null;
  if (!raw) return null;
  try { const t = JSON.parse(raw); if (!t || typeof t.activityLevel !== 'string') return null; return t; }
  catch { return null; }
}
function clearToday() { delete simStore[LS_PREFIX + todayKey()]; }

// ===== renderFoodLog (index.html 로직과 동일) =====
function renderFoodLog(foods, meals) {
  const mealKeys = [
    { key: 'breakfast', label: '아침' },
    { key: 'lunch', label: '점심' },
    { key: 'dinner', label: '저녁' },
    { key: 'snack', label: '간식' },
  ];
  if (meals && typeof meals === 'object' && !Array.isArray(meals)) {
    let html = '';
    let hasAny = false;
    for (const { key, label } of mealKeys) {
      const items = Array.isArray(meals[key]) ? meals[key] : [];
      if (items.length === 0) continue;
      hasAny = true;
      html += `<div style="margin-bottom:14px;"><div style="font-size:12px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px;">${label}</div>`;
      for (const f of items) {
        const lo = f.calLow != null ? Math.round(f.calLow).toLocaleString() : '—';
        const hi = f.calHigh != null ? Math.round(f.calHigh).toLocaleString() : '—';
        html += `<table class="food-table"><thead><tr><th>음식</th><th>추정 칼로리</th></tr></thead><tbody><tr><td><strong>${f.name}</strong> ${f.qty || ''}</td><td class="cal-range">약 ${lo}~${hi} kcal</td></tr></tbody></table>`;
      }
      const mLo = items.reduce((s, f) => s + (f.calLow ?? 0), 0);
      const mHi = items.reduce((s, f) => s + (f.calHigh ?? 0), 0);
      html += `<tr style="font-weight:600;background:#f9fafb;"><td>${label} 합계</td><td class="cal-range">약 ${Math.round(mLo).toLocaleString()}~${Math.round(mHi).toLocaleString()} kcal</td></tr>`;
      html += '</div>';
    }
    if (!hasAny) html = '<div class="empty">아직 먹은 음식이 없어요.</div>';
    return { html, type: 'meals' };
  }
  // legacy
  if (!foods || foods.length === 0) return { html: '<div class="empty">아직 먹은 음식이 없어요.</div>', type: 'legacy-empty' };
  let html = '<table class="food-table"><thead><tr><th>음식</th><th>추정 칼로리</th></tr></thead><tbody>';
  for (const f of foods) {
    const lo = f.calLow != null ? Math.round(f.calLow).toLocaleString() : '—';
    const hi = f.calHigh != null ? Math.round(f.calHigh).toLocaleString() : '—';
    html += `<tr><td><strong>${f.name}</strong> ${f.qty || ''}</td><td class="cal-range">약 ${lo}~${hi} kcal</td></tr>`;
  }
  const tLo = foods.reduce((s, f) => s + (f.calLow ?? 0), 0);
  const tHi = foods.reduce((s, f) => s + (f.calHigh ?? 0), 0);
  html += `<tr style="font-weight:600;background:#f9fafb;"><td>합계</td><td class="cal-range">약 ${Math.round(tLo).toLocaleString()}~${Math.round(tHi).toLocaleString()} kcal</td></tr></tbody></table>`;
  return { html, type: 'legacy' };
}

// ===== renderMealSummary =====
function renderMealSummary(foods, meals) {
  const mealKeys = [
    { key: 'breakfast', label: '아침' },
    { key: 'lunch', label: '점심' },
    { key: 'dinner', label: '저녁' },
    { key: 'snack', label: '간식' },
  ];
  if (meals && typeof meals === 'object' && !Array.isArray(meals)) {
    let html = '';
    let hasAny = false;
    for (const { key, label } of mealKeys) {
      const items = Array.isArray(meals[key]) ? meals[key] : [];
      if (items.length === 0) continue;
      hasAny = true;
      const mLo = items.reduce((s, f) => s + (f.calLow ?? 0), 0);
      const mHi = items.reduce((s, f) => s + (f.calHigh ?? 0), 0);
      html += `<div style="margin-bottom:8px;font-size:13px;"><strong>${label}</strong>: 약 ${Math.round(mLo).toLocaleString()}~${Math.round(mHi).toLocaleString()} kcal (${items.length}개 항목)</div>`;
    }
    if (!hasAny) html = '<div class="empty">끼니별 기록이 없어요.</div>';
    return { html, type: 'meals' };
  }
  if (!foods || foods.length === 0) return { html: '<div class="empty">끼니별 기록이 없어요.</div>', type: 'legacy-empty' };
  const tLo = foods.reduce((s, f) => s + (f.calLow ?? 0), 0);
  const tHi = foods.reduce((s, f) => s + (f.calHigh ?? 0), 0);
  return { html: `<div style="font-size:13px;">전체: 약 ${Math.round(tLo).toLocaleString()}~${Math.round(tHi).toLocaleString()} kcal (${foods.length}개 항목)</div>`, type: 'legacy' };
}

// ===== renderTodayForm =====
function renderTodayForm(t) {
  if (!t) return { breakfast: '', lunch: '', dinner: '', snack: '', plannedFoods: '' };
  let b = '', l = '', d = '', s = '';
  if (t.meals && typeof t.meals === 'object' && !Array.isArray(t.meals)) {
    b = (t.meals.breakfast ?? '').trim();
    l = (t.meals.lunch ?? '').trim();
    d = (t.meals.dinner ?? '').trim();
    s = (t.meals.snack ?? '').trim();
  } else {
    b = ''; l = ''; d = ''; s = '';
  }
  return { breakfast: b, lunch: l, dinner: d, snack: s, plannedFoods: (t.plannedFoods ?? '').trim() };
}

// ===== buildPayload =====
function buildPayload(profile, activityLevel, mealBreakfast, mealLunch, mealDinner, mealSnack, plannedRaw) {
  return {
    profile,
    activityLevel: parseFloat(activityLevel),
    meals: { breakfast: mealBreakfast, lunch: mealLunch, dinner: mealDinner, snack: mealSnack },
    plannedFoods: plannedRaw ? plannedRaw.split('\n').map(x => x.trim()).filter(Boolean) : []
  };
}

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (e) {
    console.log(`FAIL: ${name} — ${e.message}`);
    failed++;
  }
}

// ===== TEST 1: HTML 요소 =====
console.log('=== TEST 1: 4개 입력란 존재 ===');
check('mealBreakfast textarea 존재', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.ok(html.includes('id="mealBreakfast"'), 'mealBreakfast 없음');
  assert.ok(html.includes('id="mealLunch"'), 'mealLunch 없음');
  assert.ok(html.includes('id="mealDinner"'), 'mealDinner 없음');
  assert.ok(html.includes('id="mealSnack"'), 'mealSnack 없음');
  assert.ok(!html.includes('id="eatenFoods"'), '구 eatenFoods textarea가 남아있음');
});

// ===== TEST 2: payload meals =====
console.log('\n=== TEST 2: 4개 입력 → meals payload ===');
check('payload가 meals 구조로 전달됨', () => {
  const p = buildPayload({ gender: 'male', age: 30, height: 175, weight: 70, goal: 'loss' }, '1.55',
    '밥 한 공기, 계란 프라이 2개', '김치찌개, 밥 한 공기', '삼겹살 200g, 상추, 쌈장', '바나나 1개, 견과류 한 줌', '삼겹살 200g');
  assert.ok(p.meals, 'meals 없음');
  assert.strictEqual(p.meals.breakfast, '밥 한 공기, 계란 프라이 2개');
  assert.strictEqual(p.meals.lunch, '김치찌개, 밥 한 공기');
  assert.strictEqual(p.meals.dinner, '삼겹살 200g, 상추, 쌈장');
  assert.strictEqual(p.meals.snack, '바나나 1개, 견과류 한 줌');
  assert.deepStrictEqual(p.plannedFoods, ['삼겹살 200g']);
  assert.strictEqual(p.eatenFoods, undefined, 'eatenFoods가 없어야 함');
});

// ===== TEST 3: localStorage 저장·복원 =====
console.log('\n=== TEST 3: localStorage 끼니별 저장·복원 ===');
check('saveToday → loadToday → renderTodayForm (새 형식)', () => {
  saveToday({ activityLevel: '1.55', meals: { breakfast: '밥 한 공기, 계란 프라이 2개', lunch: '김치찌개, 밥 한 공기', dinner: '삼겹살 200g, 상추, 쌈장', snack: '바나나 1개' }, plannedFoods: '삼겹살 200g' });
  const t = loadToday();
  assert.ok(t, 'loadToday null');
  assert.ok(t.meals, '복원 데이터에 meals 없음');
  assert.strictEqual(t.meals.breakfast, '밥 한 공기, 계란 프라이 2개');
  const r = renderTodayForm(t);
  assert.strictEqual(r.breakfast, '밥 한 공기, 계란 프라이 2개');
  assert.strictEqual(r.lunch, '김치찌개, 밥 한 공기');
  assert.strictEqual(r.dinner, '삼겹살 200g, 상추, 쌈장');
  assert.strictEqual(r.snack, '바나나 1개');
  assert.strictEqual(r.plannedFoods, '삼겹살 200g');
});

check('새 형식 저장 후 복원 (빈 끼니 포함)', () => {
  clearToday();
  saveToday({ activityLevel: '1.725', meals: { breakfast: '', lunch: '냉면, 만두 3개', dinner: '', snack: '아이스 아메리카노 1잔' }, plannedFoods: '' });
  const t = loadToday();
  const r = renderTodayForm(t);
  assert.strictEqual(r.breakfast, '');
  assert.strictEqual(r.lunch, '냉면, 만두 3개');
  assert.strictEqual(r.dinner, '');
  assert.strictEqual(r.snack, '아이스 아메리카노 1잔');
});

// ===== TEST 4: 결과 화면 끼니별 표시 =====
console.log('\n=== TEST 4: 결과 화면 끼니별 표시 ===');
check('renderFoodLog가 meals 기준 끼니별 표시', () => {
  const m = {
    breakfast: [{ name: '밥 한 공기', qty: '', calLow: 300, calHigh: 350 }, { name: '계란 프라이 2개', qty: '', calLow: 180, calHigh: 200 }],
    lunch: [{ name: '김치찌개', qty: '1그릇', calLow: 400, calHigh: 500 }],
    dinner: [],
    snack: [{ name: '바나나 1개', qty: '', calLow: 90, calHigh: 120 }, { name: '견과류 한 줌', qty: '약 20g', calLow: 120, calHigh: 200 }],
  };
  const r = renderFoodLog([], m);
  assert.strictEqual(r.type, 'meals');
  assert.ok(r.html.includes('아침'), '아침 섹션 없음');
  assert.ok(r.html.includes('밥 한 공기'), '밥 한 공기 없음');
  assert.ok(r.html.includes('계란 프라이 2개'), '계란 프라이 2개 없음');
  assert.ok(r.html.includes('점심'), '점심 섹션 없음');
  assert.ok(r.html.includes('김치찌개'), '김치찌개 없음');
  assert.ok(r.html.includes('간식'), '간식 섹션 없음');
  assert.ok(r.html.includes('바나나 1개'), '바나나 1개 없음');
  assert.ok(r.html.includes('견과류 한 줌'), '견과류 한 줌 없음');
});

check('renderMealSummary가 meals 기준 끼니별 요약', () => {
  const m = {
    breakfast: [{ name: '밥 한 공기', qty: '', calLow: 300, calHigh: 350 }, { name: '계란 프라이 2개', qty: '', calLow: 180, calHigh: 200 }],
    lunch: [{ name: '김치찌개', qty: '1그릇', calLow: 400, calHigh: 500 }],
    dinner: [],
    snack: [],
  };
  const r = renderMealSummary([], m);
  assert.strictEqual(r.type, 'meals');
  assert.ok(r.html.includes('아침'), '아침 없음');
  assert.ok(r.html.includes('약 480'), '아침 합계 없음 (300+180=480)');
  assert.ok(r.html.includes('점심'), '점심 없음');
  assert.ok(r.html.includes('약 400'), '점심 합계 없음');
  assert.ok(!r.html.includes('저녁'), '빈 저녁이 표시되면 안 됨');
  assert.ok(!r.html.includes('간식'), '빈 간식이 표시되면 안 됨');
});

// ===== TEST 5: 하위 호환 =====
console.log('\n=== TEST 5: 기존 eatenFoods 데이터 하위 호환 ===');
check('옛 eatenFoods 단일 구조 로드 시 renderTodayForm 오류 없이 동작', () => {
  clearToday();
  saveToday({ activityLevel: '1.55', eatenFoods: '라면 1개, 계란 2개, 김밥 한 줄', plannedFoods: '삼겹살 200g' });
  const t = loadToday();
  assert.ok(t, '로드 실패');
  assert.ok(!t.meals || typeof t.meals !== 'object' || Array.isArray(t.meals), '옛 데이터에 meals 없어야 함');
  let r;
  try { r = renderTodayForm(t); } catch (e) { throw new Error(`renderTodayForm 오류: ${e.message}`); }
  assert.strictEqual(r.breakfast, '', '옛 데이터 로드 시 아침이 채워지면 안 됨');
  assert.strictEqual(r.lunch, '');
  assert.strictEqual(r.dinner, '');
  assert.strictEqual(r.snack, '');
  assert.strictEqual(r.plannedFoods, '삼겹살 200g');
});

check('renderFoodLog 하위 호환 (meals 없을 때 기존 foods 배열 표시)', () => {
  const foods = [
    { name: '라면 1개', qty: '', calLow: 450, calHigh: 550 },
    { name: '계란 2개', qty: '', calLow: 140, calHigh: 160 },
    { name: '김밥 한 줄', qty: '', calLow: 300, calHigh: 400 },
  ];
  const r = renderFoodLog(foods, null);
  assert.strictEqual(r.type, 'legacy');
  assert.ok(r.html.includes('라면 1개'), '라면 1개 없음');
  assert.ok(r.html.includes('계란 2개'), '계란 2개 없음');
  assert.ok(r.html.includes('김밥 한 줄'), '김밥 한 줄 없음');
  assert.ok(r.html.includes('약 890'), '합계 없음 (450+140+300=890)');
});

check('renderMealSummary 하위 호환 (meals 없을 때 전체 합계)', () => {
  const foods = [
    { name: '라면 1개', qty: '', calLow: 450, calHigh: 550 },
    { name: '계란 2개', qty: '', calLow: 140, calHigh: 160 },
  ];
  const r = renderMealSummary(foods, null);
  assert.strictEqual(r.type, 'legacy');
  assert.ok(r.html.includes('약 590'), '전체 합계 없음 (450+140=590)');
  assert.ok(r.html.includes('2개 항목'), '항목 수 표시 없음');
});

check('init 자동실행 조건: 옛 eatenFoods만으로는 실행 안 됨', () => {
  clearToday();
  saveToday({ activityLevel: '1.55', eatenFoods: '라면 1개', plannedFoods: '' });
  const t = loadToday();
  const hasMeals = t.meals && typeof t.meals === 'object' && !Array.isArray(t.meals)
    && Object.values(t.meals).some(v => v && typeof v === 'string' && v.trim());
  const shouldRun = true && t && (hasMeals || t.plannedFoods);
  assert.strictEqual(shouldRun, false, '옛 eatenFoods만 있을 때 자동 실행되면 안 됨');
});

check('init 자동실행 조건: 새 meals 데이터로 동작', () => {
  clearToday();
  saveToday({ activityLevel: '1.55', meals: { breakfast: '밥 한 공기', lunch: '', dinner: '', snack: '' }, plannedFoods: '' });
  const t = loadToday();
  const hasMeals = t.meals && typeof t.meals === 'object' && !Array.isArray(t.meals)
    && Object.values(t.meals).some(v => v && typeof v === 'string' && v.trim());
  const shouldRun = true && t && (hasMeals || t.plannedFoods);
  assert.strictEqual(shouldRun, true, 'meals에 내용이 있으면 자동 실행돼야 함');
});

check('init 자동실행 조건: plannedFoods만으로도 동작', () => {
  clearToday();
  saveToday({ activityLevel: '1.55', meals: { breakfast: '', lunch: '', dinner: '', snack: '' }, plannedFoods: '삼겹살 200g' });
  const t = loadToday();
  const hasMeals = t.meals && typeof t.meals === 'object' && !Array.isArray(t.meals)
    && Object.values(t.meals).some(v => v && typeof v === 'string' && v.trim());
  const shouldRun = true && t && (hasMeals || t.plannedFoods);
  assert.strictEqual(shouldRun, true, 'plannedFoods만 있어도 자동 실행돼야 함');
});

console.log('\n=== 최종 결과 ===');
console.log(`통과: ${passed}`);
console.log(`실패: ${failed}`);
console.log(failed === 0 ? '\n🎉 모든 테스트 통과!' : `\n⚠️  ${failed}개 테스트 실패`);

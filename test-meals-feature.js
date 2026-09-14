#!/usr/bin/env node
// test-meals-feature.js
// 실제 index.html의 함수를 흉내낸 순수 로직 테스트
// meals 구조 저장·복원·표시·하위 호환 검증을 위해
// 실제 DOM 없이도 runCalc/renderFoodLog/renderMealSummary/renderTodayForm 흐름을 시뮬레이션

const assert = require('assert');

// ==== 헬퍼 (index.html에서 가져온 로직과 동일하게) ====
const LS_TODAY_PREFIX = 'ddc_today_sim_';  // 실제 localStorage 대신 메모리 사용
const simStorage = {};

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// localStorage 흉내 (문자열만 저장)
function localStorageSetItem(key, val) { simStorage[key] = String(val); }
function localStorageGetItem(key) { return simStorage[key] || null; }
function localStorageRemoveItem(key) { delete simStorage[key]; }

function saveToday(t) {
  localStorageSetItem(LS_TODAY_PREFIX + todayKey(), JSON.stringify(t));
}

function loadToday() {
  try {
    const raw = localStorageGetItem(LS_TODAY_PREFIX + todayKey());
    if (!raw) return null;
    const t = JSON.parse(raw);
    if (!t || typeof t.activityLevel !== 'string') return null;
    return t;
  } catch { return null; }
}

function clearToday() {
  localStorageRemoveItem(LS_TODAY_PREFIX + todayKey());
}

// ==== renderTodayForm (index.html 수정본 기준) ====
function renderTodayForm(t) {
  if (!t) return { breakfast: '', lunch: '', dinner: '', snack: '', plannedFoods: '' };
  // meals 복원 (새 형식)
  let breakfast = '', lunch = '', dinner = '', snack = '';
  if (t.meals && typeof t.meals === 'object' && !Array.isArray(t.meals)) {
    breakfast = (t.meals.breakfast || '').trim();
    lunch = (t.meals.lunch || '').trim();
    dinner = (t.meals.dinner || '').trim();
    snack = (t.meals.snack || '').trim();
  } else {
    // 하위 호환: 기존 eatenFoods 단일 구조 — meals textarea는 비워둠
    breakfast = '';
    lunch = '';
    dinner = '';
    snack = '';
  }
  return {
    breakfast,
    lunch,
    dinner,
    snack,
    plannedFoods: (t.plannedFoods || '').trim(),
  };
}

// ==== renderFoodLog (index.html 수정본 기준) ====
function renderFoodLog(foods, meals) {
  const mealKeys = [
    { key: 'breakfast', label: '아침' },
    { key: 'lunch', label: '점심' },
    { key: 'dinner', label: '저녁' },
    { key: 'snack', label: '간식' },
  ];

  // meals 기준 끼니별 렌더링
  if (meals && typeof meals === 'object' && !Array.isArray(meals)) {
    let html = '';
    let hasAny = false;

    for (const { key, label } of mealKeys) {
      const mealFoods = Array.isArray(meals[key]) ? meals[key] : [];
      if (mealFoods.length === 0) continue;
      hasAny = true;
      html += `<div style="margin-bottom:14px;">
        <div style="font-size:12px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px;">${label}</div>
        <table class="food-table">
          <thead><tr><th>음식</th><th>추정 칼로리</th></tr></thead>
          <tbody>`;
      for (const f of mealFoods) {
        const lo = f.calLow != null ? Math.round(f.calLow).toLocaleString() : '—';
        const hi = f.calHigh != null ? Math.round(f.calHigh).toLocaleString() : '—';
        html += `<tr>
          <td><strong>${f.name}</strong> ${f.qty || ''}</td>
          <td class="cal-range">약 ${lo}~${hi} kcal</td>
        </tr>`;
      }
      const mLo = mealFoods.reduce((s, f) => s + (f.calLow ?? 0), 0);
      const mHi = mealFoods.reduce((s, f) => s + (f.calHigh ?? 0), 0);
      html += `<tr style="font-weight:600;background:#f9fafb;">
        <td>${label} 합계</td>
        <td class="cal-range">약 ${Math.round(mLo).toLocaleString()}~${Math.round(mHi).toLocaleString()} kcal</td>
      </tr>`;
      html += '</tbody></table></div>';
    }

    if (!hasAny) {
      html = '<div class="empty">아직 먹은 음식이 없어요.</div>';
    }

    return { html, type: 'meals' };
  }

  // 하위 호환: meals 없을 때 기존 foods 배열 표시
  if (!foods || foods.length === 0) {
    return { html: '<div class="empty">아직 먹은 음식이 없어요.</div>', type: 'legacy-empty' };
  }
  let html = '<table class="food-table"><thead><tr><th>음식</th><th>추정 칼로리</th></tr></thead><tbody>';
  for (const f of foods) {
    const lo = f.calLow != null ? Math.round(f.calLow).toLocaleString() : '—';
    const hi = f.calHigh != null ? Math.round(f.calHigh).toLocaleString() : '—';
    html += `<tr>
      <td><strong>${f.name}</strong> ${f.qty || ''}</td>
      <td class="cal-range">약 ${lo}~${hi} kcal</td>
    </tr>`;
  }
  const totalLo = foods.reduce((s, f) => s + (f.calLow ?? 0), 0);
  const totalHi = foods.reduce((s, f) => s + (f.calHigh ?? 0), 0);
  html += `<tr style="font-weight:600;background:#f9fafb;">
    <td>합계</td>
    <td class="cal-range">약 ${Math.round(totalLo).toLocaleString()}~${Math.round(totalHi).toLocaleString()} kcal</td>
  </tr>`;
  html += '</tbody></table>';
  return { html, type: 'legacy' };
}

// ==== renderMealSummary (index.html 수정본 기준) ====
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
      const mealFoods = Array.isArray(meals[key]) ? meals[key] : [];
      if (mealFoods.length === 0) continue;
      hasAny = true;
      const mLo = mealFoods.reduce((s, f) => s + (f.calLow ?? 0), 0);
      const mHi = mealFoods.reduce((s, f) => s + (f.calHigh ?? 0), 0);
      html += `<div style="margin-bottom:8px;font-size:13px;">
        <strong>${label}</strong>: 약 ${Math.round(mLo).toLocaleString()}~${Math.round(mHi).toLocaleString()} kcal
        (${mealFoods.length}개 항목)
      </div>`;
    }
    if (!hasAny) {
      html = '<div class="empty">끼니별 기록이 없어요.</div>';
    }
    return { html, type: 'meals' };
  }

  if (!foods || foods.length === 0) {
    return { html: '<div class="empty">끼니별 기록이 없어요.</div>', type: 'legacy-empty' };
  }
  const totalLo = foods.reduce((s, f) => s + (f.calLow ?? 0), 0);
  const totalHi = foods.reduce((s, f) => s + (f.calHigh ?? 0), 0);
  return { html: `<div style="font-size:13px;">전체: 약 ${Math.round(totalLo).toLocaleString()}~${Math.round(totalHi).toLocaleString()} kcal (${foods.length}개 항목)</div>`, type: 'legacy' };
}

// ==== runCalc payload 구성 (index.html 수정본 기준) ====
function buildPayload(profile, activityLevel, mealBreakfast, mealLunch, mealDinner, mealSnack, plannedRaw) {
  return {
    profile,
    activityLevel: parseFloat(activityLevel),
    meals: {
      breakfast: mealBreakfast,
      lunch: mealLunch,
      dinner: mealDinner,
      snack: mealSnack,
    },
    plannedFoods: plannedRaw ? plannedRaw.split('\n').map(s => s.trim()).filter(Boolean) : []
  };
}

// ============================================================
// 테스트 시작
// ============================================================

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`❌ ${name}`);
    console.log(`   오류: ${e.message}`);
    failed++;
  }
}

console.log('=== 테스트 1: 4개 입력란 존재 (HTML 요소 확인) ===\n');

check('mealBreakfast textarea가 HTML에 있다', () => {
  // 실제 index.html 파일에서 확인
  const fs = require('fs');
  const html = fs.readFileSync('index.html', 'utf8');
  const hasBreakfast = html.includes('id="mealBreakfast"');
  const hasLunch = html.includes('id="mealLunch"');
  const hasDinner = html.includes('id="mealDinner"');
  const hasSnack = html.includes('id="mealSnack"');
  if (!hasBreakfast || !hasLunch || !hasDinner || !hasSnack) {
    throw new Error(`4개 textarea 중 누락: breakfast=${hasBreakfast}, lunch=${hasLunch}, dinner=${hasDinner}, snack=${hasSnack}`);
  }
  // 옛 eatenFoods textarea는 없어야 함
  const hasOld = html.includes('id="eatenFoods"');
  if (hasOld) throw new Error('구 eatenFoods textarea가 아직 남아있음');
});

console.log('\n=== 테스트 2: 4개 입력값을 meals 구조로 API에 전달 ===\n');

check('runCalc payload가 meals 구조로 구성된다', () => {
  const profile = { gender: 'male', age: 30, height: 175, weight: 70, goal: 'loss' };
  const payload = buildPayload(
    profile,
    '1.55',
    '밥 한 공기, 계란 프라이 2개',  // breakfast
    '김치찌개, 밥 한 공기',           // lunch
    '삼겹살 200g, 상추, 쌈장',       // dinner
    '바나나 1개, 견과류 한 줌',       // snack
    '삼겹살 200g'                     // planned
  );
  // meals 구조가 맞는지
  assert.ok(payload.meals, 'payload.meals가 undefined');
  assert.strictEqual(typeof payload.meals, 'object');
  assert.strictEqual(payload.meals.breakfast, '밥 한 공기, 계란 프라이 2개');
  assert.strictEqual(payload.meals.lunch, '김치찌개, 밥 한 공기');
  assert.strictEqual(payload.meals.dinner, '삼겹살 200g, 상추, 쌈장');
  assert.strictEqual(payload.meals.snack, '바나나 1개, 견과류 한 줌');
  // plannedFoods도 잘 전달되는지
  assert.deepStrictEqual(payload.plannedFoods, ['삼겹살 200g']);
  // eatenFoods가 payload에 없어야 함
  assert.strictEqual(payload.eatenFoods, undefined, 'payload에 eatenFoods가 있으면 안 됨 (meals로 대체됨)');
});

check('빈 끼니는 빈 문자열로 전달된다', () => {
  const payload = buildPayload(
    { gender: 'male', age: 30, height: 175, weight: 70, goal: 'loss' },
    '1.55',
    '',   // 아침 안 먹음
    '',   // 점심 안 먹음
    '저녁만 먹음',
    '',   // 간식 안 먹음
    ''
  );
  assert.strictEqual(payload.meals.breakfast, '');
  assert.strictEqual(payload.meals.lunch, '');
  assert.strictEqual(payload.meals.dinner, '저녁만 먹음');
  assert.strictEqual(payload.meals.snack, '');
});

console.log('\n=== 테스트 3: localStorage 끼니별 저장·복원 ===\n');

check('saveToday → loadToday → renderTodayForm 흐름이 meals 기준으로 동작한다', () => {
  // 저장
  saveToday({
    activityLevel: '1.55',
    meals: {
      breakfast: '밥 한 공기, 계란 프라이 2개',
      lunch: '김치찌개, 밥 한 공기',
      dinner: '삼겹살 200g, 상추, 쌈장',
      snack: '바나나 1개',
    },
    plannedFoods: '삼겹살 200g',
    savedAt: new Date().toISOString()
  });
  // 복원
  const t = loadToday();
  assert.ok(t, 'loadToday가 null return');
  assert.ok(t.meals, '복원된 데이터에 meals가 없음');
  assert.strictEqual(t.meals.breakfast, '밥 한 공기, 계란 프라이 2개');
  assert.strictEqual(t.meals.lunch, '김치찌개, 밥 한 공기');
  assert.strictEqual(t.meals.dinner, '삼겹살 200g, 상추, 쌈장');
  assert.strictEqual(t.meals.snack, '바나나 1개');
  // renderTodayForm으로 복원
  const restored = renderTodayForm(t);
  assert.strictEqual(restored.breakfast, '밥 한 공기, 계란 프라이 2개');
  assert.strictEqual(restored.lunch, '김치찌개, 밥 한 공기');
  assert.strictEqual(restored.dinner, '삼겹살 200g, 상추, 쌈장');
  assert.strictEqual(restored.snack, '바나나 1개');
  assert.strictEqual(restored.plannedFoods, '삼겹살 200g');
});

check('새 형식 저장 후 새로고침(load)해도 meals 그대로 복원된다', () => {
  clearToday();
  saveToday({
    activityLevel: '1.725',
    meals: {
      breakfast: '',
      lunch: '냉면, 만두 3개',
      dinner: '',
      snack: '아이스 아메리카노 1잔',
    },
    plannedFoods: '',
    savedAt: new Date().toISOString()
  });
  const t = loadToday();
  const restored = renderTodayForm(t);
  assert.strictEqual(restored.breakfast, '');
  assert.strictEqual(restored.lunch, '냉면, 만두 3개');
  assert.strictEqual(restored.dinner, '');
  assert.strictEqual(restored.snack, '아이스 아메리카노 1잔');
});

console.log('\n=== 테스트 4: 결과 화면에서 끼니별 표시 ===\n');

check('renderFoodLog가 meals를 받아 끼니별로 표시한다', () => {
  const foodsByMeal = {
    breakfast: [
      { name: '밥 한 공기', qty: '', calLow: 300, calHigh: 350, note: '', isPlanned: false },
      { name: '계란 프라이 2개', qty: '', calLow: 180, calHigh: 200, note: '', isPlanned: false },
    ],
    lunch: [
      { name: '김치찌개', qty: '1그릇', calLow: 400, calHigh: 500, note: '', isPlanned: false },
    ],
    dinner: [],
    snack: [
      { name: '바나나 1개', qty: '', calLow: 90, calHigh: 120, note: '', isPlanned: false },
      { name: '견과류 한 줌', qty: '약 20g', calLow: 120, calHigh: 200, note: '', isPlanned: false },
    ],
  };
  const result = renderFoodLog([], foodsByMeal);
  assert.strictEqual(result.type, 'meals', 'meals 기준 렌더링이어야 함');
  // 아침이 포함되는지
  assert.ok(result.html.includes('아침'), 'HTML에 아침 섹션이 없음');
  assert.ok(result.html.includes('밥 한 공기'), '아침 음식에 밥 한 공기가 없음');
  assert.ok(result.html.includes('계란 프라이 2개'), '아침 음식에 계란 프라이 2개가 없음');
  // 점심
  assert.ok(result.html.includes('점심'), 'HTML에 점심 섹션이 없음');
  assert.ok(result.html.includes('김치찌개'), '점심 음식에 김치찌개가 없음');
  // 저녁은 비었으므로 없어야 함
  // 간식은 포함되는지
  assert.ok(result.html.includes('간식'), 'HTML에 간식 섹션이 없음');
  assert.ok(result.html.includes('바나나 1개'), '간식 음식에 바나나 1개가 없음');
  assert.ok(result.html.includes('견과류 한 줌'), '간식 음식에 견과류 한 줌이 없음');
});

check('renderMealSummary가 meals 기준 끼니별 요약을 표시한다', () => {
  const foodsByMeal = {
    breakfast: [
      { name: '밥 한 공기', qty: '', calLow: 300, calHigh: 350, note: '', isPlanned: false },
      { name: '계란 프라이 2개', qty: '', calLow: 180, calHigh: 200, note: '', isPlanned: false },
    ],
    lunch: [
      { name: '김치찌개', qty: '1그릇', calLow: 400, calHigh: 500, note: '', isPlanned: false },
    ],
    dinner: [],
    snack: [],
  };
  const result = renderMealSummary([], foodsByMeal);
  assert.strictEqual(result.type, 'meals');
  assert.ok(result.html.includes('아침'), '요약에 아침이 없음');
  assert.ok(result.html.includes('약 480'), '아침 합계 칼로리가 없음 (300+180=480)');
  assert.ok(result.html.includes('점심'), '요약에 점심이 없음');
  assert.ok(result.html.includes('약 400'), '점심 합계 칼로리가 없음');
  // 저녁, 간식 없음 → 표시 안 됨
  assert.ok(!result.html.includes('저녁'), '빈 저녁이 요약에 표시되면 안 됨');
  assert.ok(!result.html.includes('간식'), '빈 간식이 요약에 표시되면 안 됨');
});

console.log('\n=== 테스트 5: 기존 eatenFoods 데이터 하위 호환 ===\n');

check('기존 eatenFoods 단일 구조 데이터가 로드돼도 renderTodayForm이 오류 없이 동작한다', () => {
  // 새 format 초기화
  clearToday();
  // 옛 형식 저장 (meals 없음, eatenFoods만 있음)
  saveToday({
    activityLevel: '1.55',
    eatenFoods: '라면 1개, 계란 2개, 김밥 한 줄',  // 옛 단일 문자열
    plannedFoods: '삼겹살 200g',
    savedAt: new Date().toISOString()
  });
  // 로드
  const t = loadToday();
  assert.ok(t, '로드 실패');
  // 옛 형식은 meals 키가 없거나 meals가 객체가 아님
  assert.ok(!t.meals || typeof t.meals !== 'object' || Array.isArray(t.meals), '옛 데이터에 meals가 있으면 안 됨 (또는 meals가 객체/배열이 아니어야 함)');
  // renderTodayForm 호출 — 오류 없이 동작해야 함
  let rendered;
  try {
    rendered = renderTodayForm(t);
  } catch (e) {
    throw new Error(`renderTodayForm에서 오류: ${e.message}`);
  }
  // meals textarea는 모두 비어 있어야 함 (과거 기록을 끼니로 분류하지 않음)
  assert.strictEqual(rendered.breakfast, '', '옛 데이터 로드 시 아침이 채워지면 안 됨');
  assert.strictEqual(rendered.lunch, '', '옛 데이터 로드 시 점심이 채워지면 안 됨');
  assert.strictEqual(rendered.dinner, '', '옛 데이터 로드 시 저녁이 채워지면 안 됨');
  assert.strictEqual(rendered.snack, '', '옛 데이터 로드 시 간식이 채워지면 안 됨');
  // plannedFoods는 복원됨
  assert.strictEqual(rendered.plannedFoods, '삼겹살 200g');
});

check('옛 eatenFoods 데이터만 있을 때 renderFoodLog가 기존 foods 배열로 표시한다 (하위 호환)', () => {
  // meals 없이 foods만 있을 때
  const foods = [
    { name: '라면 1개', qty: '', calLow: 450, calHigh: 550, note: '', isPlanned: false },
    { name: '계란 2개', qty: '', calLow: 140, calHigh: 160, note: '', isPlanned: false },
    { name: '김밥 한 줄', qty: '', calLow: 300, calHigh: 400, note: '', isPlanned: false },
  ];
  const result = renderFoodLog(foods, null);  // meals 없음
  assert.strictEqual(result.type, 'legacy', '하위 호환 모드여야 함');
  assert.ok(result.html.includes('라면 1개'), 'legacy 표시에 라면 1개가 없음');
  assert.ok(result.html.includes('계란 2개'), 'legacy 표시에 계란 2개가 없음');
  assert.ok(result.html.includes('김밥 한 줄'), 'legacy 표시에 김밥 한 줄이 없음');
  assert.ok(result.html.includes('약 890'), 'legacy 합계 칼로리가 없음 (450+140+300=890)');
});

check('옛 eatenFoods 데이터 + meals 모두 없을 때 renderMealSummary가 기존 전체 합계로 표시한다', () => {
  const foods = [
    { name: '라면 1개', qty: '', calLow: 450, calHigh: 550, note: '', isPlanned: false },
    { name: '계란 2개', qty: '', calLow: 140, calHigh: 160, note: '', isPlanned: false },
  ];
  const result = renderMealSummary(foods, null);
  assert.strictEqual(result.type, 'legacy');
  assert.ok(result.html.includes('약 590'), '전체 합계가 없음 (450+140=590)');
  assert.ok(result.html.includes('2개 항목'), '항목 수 표시가 없음');
});

check('init 자동실행 조건이 meals 기준으로 동작한다 (옛 eatenFoods만으로는 실행 안 됨)', () => {
  // 옛 데이터: meals 없음, eatenFoods만 있음, plannedFoods 없음
  clearToday();
  saveToday({
    activityLevel: '1.55',
    eatenFoods: '라면 1개',
    plannedFoods: '',
    savedAt: new Date().toISOString()
  });
  const t = loadToday();
  // init 조건 시뮬레이션
  const profile = { gender: 'male', age: 30, height: 175, weight: 70, goal: 'loss' };
  const hasMeals = t.meals && typeof t.meals === 'object' && !Array.isArray(t.meals)
    && Object.values(t.meals).some(v => v && typeof v === 'string' && v.trim());
  const shouldRun = profile && t && (hasMeals || t.plannedFoods);
  assert.strictEqual(shouldRun, false, '옛 eatenFoods만 있을 때는 자동 실행되면 안 됨 (meals도 plannedFoods도 없음)');
});


check('init 자동실행 조건이 새 meals 데이터로 동작한다', () => {
  clearToday();
  saveToday({
    activityLevel: '1.55',
    meals: {
      breakfast: '밥 한 공기',
      lunch: '',
      dinner: '',
      snack: '',
    },
    plannedFoods: '',
    savedAt: new Date().toISOString()
  });
  const t = loadToday();
  const hasMeals = t.meals && typeof t.meals === 'object' && !Array.isArray(t.meals)
    && Object.values(t.meals).some(v => v && typeof v === 'string' && v.trim());
  const shouldRun = true && t && (hasMeals || t.plannedFoods);
  assert.strictEqual(shouldRun, true, 'meals에 내용이 있으면 자동 실행돼야 함');
});

check('init 자동실행 조건이 plannedFoods만으로도 동작한다', () => {
  clearToday();
  saveToday({
    activityLevel: '1.55',
    meals: {
      breakfast: '',
      lunch: '',
      dinner: '',
      snack: '',
    },
    plannedFoods: '삼겹살 200g',
    savedAt: new Date().toISOString()
  });
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

process.exit(failed === 0 ? 0 : 1);

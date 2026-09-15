// 결과 렌더링 — 음식 로그, 끼니 요약, 추천, 전체 결과

import { $, esc, fmt, MEAL_KEYS } from './state.js';

function renderFoodLog(foods, meals) {
  const el = $('foodLog');

  if (meals && typeof meals === 'object' && !Array.isArray(meals)) {
    let html = '';
    let hasAny = false;

    for (const { key, label } of MEAL_KEYS) {
      const mealFoods = Array.isArray(meals[key]) ? meals[key] : [];
      if (mealFoods.length === 0) continue;
      hasAny = true;
      html += `<div style="margin-bottom:14px;">
        <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px;">${esc(label)}</div>
        <table class="food-table">
          <thead><tr><th>음식</th><th>추정 칼로리</th></tr></thead>
          <tbody>`;
      for (const f of mealFoods) {
        const lo = f.calLow != null ? fmt(f.calLow) : '—';
        const hi = f.calHigh != null ? fmt(f.calHigh) : '—';
        html += `<tr>
          <td><strong>${esc(f.name)}</strong> ${esc(f.qty || '')}</td>
          <td class="cal-range">약 ${lo}~${hi} kcal${f.note ? '<br><span style="color:var(--muted);font-size:11px;">'+esc(f.note)+'</span>' : ''}</td>
        </tr>`;
      }
      const mLo = mealFoods.reduce((s, f) => s + (f.calLow ?? 0), 0);
      const mHi = mealFoods.reduce((s, f) => s + (f.calHigh ?? 0), 0);
      html += `<tr style="font-weight:600;background:#f9fafb;">
        <td>${label} 합계</td>
        <td class="cal-range">약 ${fmt(mLo)}~${fmt(mHi)} kcal</td>
      </tr>`;
      html += '</tbody></table></div>';
    }

    if (!hasAny) {
      html = '<div class="empty">아직 먹은 음식이 없어요.</div>';
    }

    el.innerHTML = html;
    return;
  }

  if (!foods || foods.length === 0) {
    el.innerHTML = '<div class="empty">아직 먹은 음식이 없어요.</div>';
    return;
  }
  let html = '<table class="food-table"><thead><tr><th>음식</th><th>추정 칼로리</th></tr></thead><tbody>';
  for (const f of foods) {
    const lo = f.calLow != null ? fmt(f.calLow) : '—';
    const hi = f.calHigh != null ? fmt(f.calHigh) : '—';
    html += `<tr>
      <td><strong>${esc(f.name)}</strong> ${esc(f.qty || '')}</td>
      <td class="cal-range">약 ${lo}~${hi} kcal${f.note ? '<br><span style="color:var(--muted);font-size:11px;">'+esc(f.note)+'</span>' : ''}</td>
    </tr>`;
  }
  const totalLo = foods.reduce((s, f) => s + (f.calLow ?? 0), 0);
  const totalHi = foods.reduce((s, f) => s + (f.calHigh ?? 0), 0);
  html += `<tr style="font-weight:600;background:#f9fafb;">
    <td>합계</td>
    <td class="cal-range">약 ${fmt(totalLo)}~${fmt(totalHi)} kcal</td>
  </tr>`;
  html += '</tbody></table>';
  el.innerHTML = html;
}

function renderMealSummary(foods, meals) {
  const el = $('mealSummary');

  if (meals && typeof meals === 'object' && !Array.isArray(meals)) {
    let html = '';
    let hasAny = false;
    for (const { key, label } of MEAL_KEYS) {
      const mealFoods = Array.isArray(meals[key]) ? meals[key] : [];
      if (mealFoods.length === 0) continue;
      hasAny = true;
      const mLo = mealFoods.reduce((s, f) => s + (f.calLow ?? 0), 0);
      const mHi = mealFoods.reduce((s, f) => s + (f.calHigh ?? 0), 0);
      html += `<div style="margin-bottom:8px;font-size:13px;">
        <strong>${esc(label)}</strong>: 약 ${fmt(mLo)}~${fmt(mHi)} kcal
        (${mealFoods.length}개 항목)
      </div>`;
    }
    if (!hasAny) {
      html = '<div class="empty">끼니별 기록이 없어요.</div>';
    }
    el.innerHTML = html;
    return;
  }

  if (!foods || foods.length === 0) {
    el.innerHTML = '<div class="empty">끼니별 기록이 없어요.</div>';
    return;
  }
  const totalLo = foods.reduce((s, f) => s + (f.calLow ?? 0), 0);
  const totalHi = foods.reduce((s, f) => s + (f.calHigh ?? 0), 0);
  el.innerHTML = `<div style="font-size:13px;">전체: 약 ${fmt(totalLo)}~${fmt(totalHi)} kcal (${foods.length}개 항목)</div>`;
}

function renderSuggestions(suggestions) {
 const target = document.getElementById('suggestionsContent');
  if (!target) return;
  if (!suggestions || suggestions.length === 0) {
    target.innerHTML = '<div class="suggestions-empty">추천할 음식이 아직 없어요.</div>';
    return;
  }
  let html = '<div class="suggestions-grid">';
  for (const s of suggestions) {
    const note = s.note ? esc(s.note) : '';
    const category = s.mealType || '';
    html += `<div class="suggestion-card ${esc(category)}">
      <p class="name">${esc(s.name)}</p>
      <p class="range">약 ${fmt(s.calLow)} kcal</p>
      ${note ? `<p class="note">${note}</p>` : ''}
    </div>`;
  }
  html += '</div>';
  target.innerHTML = html;
}

function renderResult(data) {
  $('bmrValue').textContent = fmt(data.bmr) + ' kcal';
  $('tdeeValue').textContent = fmt(data.todayConsumption) + ' kcal';
  const goalLabel = data.goal === 'loss' ? '감량' : data.goal === 'maintain' ? '유지' : '증량';
  $('goalValue').textContent = fmt(data.targetCalories) + ' kcal (' + goalLabel + ')';
  $('currentIntakeValue').textContent = '약 ' + fmt(data.currentIntakeLo) + '~' + fmt(data.currentIntakeHi) + ' kcal';
  // 남은 칼로리 상태 표시
if (data.remainingHi < 0) {
  const overLo = Math.abs(data.remainingHi);
  const overHi = Math.abs(data.remainingLo);

  $('remainingValue').textContent =
    '약 ' + fmt(overLo) + '~' + fmt(overHi) + ' kcal 초과';

  $('goalNote').textContent =
    '현재까지 섭취량을 기준으로 오늘 목표 섭취량을 약 ' +
    fmt(overLo) + '~' + fmt(overHi) +
    ' kcal 초과했어요. 추가 섭취는 가볍게 조절하는 것이 좋아요.';

} else if (data.remainingLo < 0) {
  $('remainingValue').textContent = '목표 범위 근처';

  $('goalNote').textContent =
    '현재 섭취량은 목표 범위에 가까워요. 추정치에 따라 최대 ' +
    fmt(Math.abs(data.remainingLo)) + ' kcal 초과하거나 ' +
    fmt(data.remainingHi) + ' kcal 정도 남을 수 있어요.';

} else {
  $('remainingValue').textContent =
    '약 ' + fmt(data.remainingLo) + '~' + fmt(data.remainingHi) + ' kcal';

  $('goalNote').textContent =
    '현재까지 섭취량을 기준으로 오늘 남은 식사는 약 ' +
    fmt(data.remainingLo) + '~' +
    fmt(data.remainingHi) +
    ' kcal 범위에서 계획할 수 있어요.';
}
const mealCalorieTargets = {
  breakfast: 'breakfastCalorie',
  lunch: 'lunchCalorie',
  dinner: 'dinnerCalorie',
  snack: 'snackCalorie'
};

for (const [mealKey, elementId] of Object.entries(mealCalorieTargets)) {
  const el = $(elementId);
  if (!el) continue;

  const foods = Array.isArray(data.meals?.[mealKey])
  ? data.meals[mealKey]
  : Array.isArray(data.foods)
    ? data.foods.filter(food => food.mealType === mealKey)
    : [];

  if (foods.length === 0) {
    el.textContent = '아직 기록 없음';
    el.style.color = '#94a3b8';
    continue;
  }

  const lo = foods.reduce(
    (sum, food) => sum + (food.calLow ?? 0),
    0
  );

  const hi = foods.reduce(
    (sum, food) => sum + (food.calHigh ?? 0),
    0
  );

  el.textContent = '약 ' + fmt(lo) + '~' + fmt(hi) + ' kcal';
  el.style.color = '#2563eb';
}
  renderFoodLog(data.foods, data.meals);

  const plannedEl = $('plannedContent');
  if (data.plannedFoods && data.plannedFoods.length > 0) {
    let html = '<table class="food-table"><thead><tr><th>예정 음식</th><th>추정 칼로리</th></tr></thead><tbody>';
    for (const f of data.plannedFoods) {
      const lo = f.calLow != null ? fmt(f.calLow) : '—';
      const hi = f.calHigh != null ? fmt(f.calHigh) : '—';
      html += `<tr>
        <td><strong>${esc(f.name)}</strong> ${esc(f.qty || '')}</td>
        <td class="cal-range">약 ${lo}~${hi} kcal${f.note ? '<br><span style="color:var(--muted);font-size:11px;">'+esc(f.note)+'</span>' : ''}</td>
      </tr>`;
    }
    const pLo = data.plannedFoods.reduce((s,f) => s + (f.calLow ?? 0), 0);
    const pHi = data.plannedFoods.reduce((s,f) => s + (f.calHigh ?? 0), 0);
    html += `<tr style="font-weight:600;background:#f9fafb;">
      <td>합계</td>
      <td class="cal-range">약 ${fmt(pLo)}~${fmt(pHi)} kcal</td>
    </tr>`;
    html += '</tbody></table>';
    const totalLo = data.currentIntakeLo + pLo;
    const totalHi = data.currentIntakeHi + pHi;
    html += `<div style="margin-top:8px;font-size:13px;">
      예정대로 먹는다면 오늘 총 섭취량은 <strong>약 ${fmt(totalLo)}~${fmt(totalHi)} kcal</strong>로 예상돼요.
    </div>`;
    html += `<div style="margin-top:6px;font-size:13px;color:var(--muted);">
      ${data.plannedComparison || ''}
    </div>`;
    plannedEl.innerHTML = html;
    $('plannedSection').classList.remove('hidden');
  } else {
    plannedEl.innerHTML = '<div class="empty">예정된 식사가 없어요.</div>';
    $('plannedSection').classList.add('hidden');
  }

  function summarizeStrategy(strategy, remainingLo, remainingHi) {
    if (!strategy) return '계산된 전략이 없어요.';
    const raw = strategy.split(/\n+/).join(' ').trim();
    const sentences = raw.split(/(?<=[\u2026.!?])\s+/).map(s => s.trim()).filter(Boolean);
    if (sentences.length === 0) return '계산된 전략이 없어요.';
    const kw = /다음 식사|활동량|예정|새 기록|추천이|달라|남은 칼로리|범위/i;
    const preferred = sentences.filter(s => kw.test(s));
    const selected = preferred.length ? preferred.slice(0, 4) : sentences.slice(0, 4);
    let first = selected[0] || '';
    const hasRemaining = remainingLo != null && remainingHi != null &&
      !first.includes('약 ' + remainingLo) && !first.includes(remainingHi);
    if (hasRemaining) {
      first = '현재 남은 칼로리는 약 ' + remainingLo + '~' + remainingHi + ' kcal예요. ' + first;
    }
    return selected.length ? selected.map((s, i) => i === 0 ? first : s).join('<br>') : first;
  }

  const strategySummary = summarizeStrategy(
  data.strategy,
  data.remainingLo,
  data.remainingHi
);

let strategyItems = strategySummary
  .replace(/<br\s*\/?>/g, '\n')
  .split(/[①②③④]/)
  .map(item => item.trim())
  .filter(Boolean)
  .slice(0, 3);

// 전략 항목이 3개 미만이면 부족한 칸을 실제 전략 내용으로 보완
if (strategyItems.length < 3 && data.strategy) {
  const raw = data.strategy;
  const sentences = raw.split(/(?<=[\u2026.!?])\s+/).map(s => s.trim()).filter(Boolean);

  // plannedFoods 이름이 언급된 문장 추출
  const plannedNames = (data.plannedFoods || [])
    .map(p => p.name)
    .filter(Boolean);

  const relevantSentences = plannedNames.length > 0
    ? sentences.filter(s => plannedNames.some(n => s.includes(n)))
    : [];

  for (let i = strategyItems.length; i < 3; i++) {
    if (i === 2 && relevantSentences.length > 0) {
      // 생활패턴 반영 칸에는 예정 음식 관련 전략 문장을 넣음
      strategyItems.push(relevantSentences.slice(0, 2).join(' '));
    } else if (i === 1 && strategyItems.length < 2) {
      strategyItems.push(sentences[0] || strategyItems[0] || '');
    } else {
      strategyItems.push(strategyItems[strategyItems.length - 1] || '');
    }
  }
}

const coachingTitles = [
  '현재 상태',
  '식단 분석',
  '생활 패턴 반영'
];

const agentInput =
  document.getElementById('plannedFoods')?.value.trim() || '';

const currentStatus =
  strategyItems[0] || '현재 상태를 분석하고 있어요.';

const dietAnalysis =
  strategyItems[1] || (agentInput
    ? '입력한 내용을 바탕으로 식단을 분석해드렸어요.'
    : '오늘 식사 기록을 입력하면 식단을 분석해드려요.');

const lifestylePattern =
  strategyItems[2] || (agentInput
    ? '입력한 일정을 반영했어요. 자세한 내용은 현재 상태 항목을 참고하세요.'
    : 'DDC 에이전트에 예정된 식사, 활동, 일정 등을 적어주세요.');
    
const coachingItems = [
  { title: '현재 상태', text: currentStatus },
  { title: '식단 분석', text: dietAnalysis },
  { title: '생활 패턴 반영', text: lifestylePattern }
];

$('strategyContent').innerHTML = `
  <div class="coaching-blocks">
    ${coachingItems.map(item => `
      <div class="coaching-item">
        <div class="coaching-body">
          <div class="coaching-title">${item.title}</div>
          <div class="coaching-text">${esc(item.text)}</div>
        </div>
      </div>
    `).join('')}
  </div>
`;

  // 진행바 세팅 (기존 로직 건드리지 않고 추가)
  if (data.targetCalories) {
    const fill = $('progressFill');
    const cur = $('progressCurrent');
    const goal = $('progressGoal');
    const pMin = 0;
    const pMax = Math.max(data.targetCalories, 1);
    const curVal = Math.min(data.currentIntakeLo, pMax);
    const pct = Math.min(Math.max((curVal / pMax) * 100, 0), 100);
   if (fill) {
  fill.style.width = pct + '%';
  fill.textContent = pct >= 10 ? Math.round(pct) + '%' : '';
}
    if (cur) cur.textContent = '약 ' + fmt(data.currentIntakeLo) + '~' + fmt(data.currentIntakeHi) + ' kcal';
    if (goal) goal.textContent = '목표 ' + fmt(data.targetCalories) + ' kcal';
  }

  renderSuggestions(data.recommendedFoods || []);
}

export { renderFoodLog, renderMealSummary, renderSuggestions, renderResult };

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
  const target = document.getElementById('suggestionsSection');
  if (!target) return;
  if (!suggestions || suggestions.length === 0) {
    target.innerHTML = '<div class="suggestions-empty">추천할 음식이 아직 없어요.</div>';
    return;
  }
  let html = '<div class="suggestions-grid">';
  for (const s of suggestions) {
    const category = (s.category || '').toUpperCase();
    const name = s.name || '이름 없음';
    const qty = s.qty ? ` (${esc(s.qty)})` : '';
    const rangeLow = s.calLow ?? s.rangeLow;
    const rangeHigh = s.calHigh ?? s.rangeHigh;
    const hasRange = rangeLow != null && rangeHigh != null;
    const note = s.note ? esc(s.note) : '';
    html += `<div class="suggestion-card ${esc((s.category || ''))}">
      ${category ? `<span class="hint-tag">${esc(category)}</span>` : ''}
      <p class="name">${esc(name)}${qty}</p>
      <p class="range">${hasRange ? '약 ' + fmt(rangeLow) + '~' + fmt(rangeHigh) + ' kcal' : '칼로리 범위 미확인'}</p>
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
  $('remainingValue').textContent = '약 ' + fmt(data.remainingLo) + '~' + fmt(data.remainingHi) + ' kcal';

  const goalLabel2 = data.goal === 'loss' ? '감량' : data.goal === 'maintain' ? '유지' : '증량';
  $('goalNote').textContent = '현재 추정치상 ' + goalLabel2 + ' 목표(' + fmt(data.targetCalories) + ' kcal) 대비 상태예요.';

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

  $('strategyContent').innerHTML =
    `<div class="strategy-box">${esc(data.strategy || '계산된 전략이 없어요.')}</div>`;

  renderSuggestions(data.recommendedFoods);
}

export { renderFoodLog, renderMealSummary, renderSuggestions, renderResult };

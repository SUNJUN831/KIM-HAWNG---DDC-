// 공공 API 기반 음식 추천 + 분량 조정 헬퍼
// buildRecommendedFoods, adjustQuantity, generatePortionNote, filterCandidatesByHistory,
// getRecommendedFoodsForAvg(테스트용)를 포함.

import { pickFoodsByCalorieTarget } from './foodRequest.js';
import { selectDiverseFoodsWithSolar } from './solar-pick.js';

export async function buildRecommendedFoods(
  remainingAvg,
  eatenFoods,
  count = null,
  remainingLo = null,
  remainingHi = null,
  foodHistory = [],
  macroFilter = null,
  lifestyle = '',
  splitMeals = null
) {
  if (remainingAvg < 100) return [];
  const useCount = count ?? 4;
  const preferredCodes = macroFilter?.boostCodes || null;
  const avoidCodes = macroFilter?.avoidCodes || null;

  if (splitMeals && splitMeals.parts && splitMeals.parts > 1) {
    return buildSplitRecommendations(splitMeals, eatenFoods, useCount, foodHistory, lifestyle, macroFilter);
  }

  let targetCalForPick = remainingAvg;
  let customSolarHint = macroFilter?.solarHint || '';
  
  console.log('[DDC] pickFoodsByCalorieTarget 호출 — targetCal:', remainingAvg, 'useCount:', useCount);
  const candidates = await pickFoodsByCalorieTarget(remainingAvg, useCount, 250, preferredCodes, avoidCodes);
  console.log('[DDC] candidates 획득 — 개수:', candidates.length);
  candidates.forEach((c, i) => console.log(`  후보${i + 1}: ${c.name} | ${c.qty} | ${c.calLow}~${c.calHigh}kcal | code=${c.code} | cat=${c.category}`));

  const filteredCandidates = filterCandidatesByHistory(candidates, foodHistory);
  if (filteredCandidates.length !== candidates.length) {
    console.log('[DDC] foodHistory 필터링 — 후보', candidates.length, '→', filteredCandidates.length, '개로 축소');
  }

  if (candidates.length === 0) return [];
  const selected = await selectDiverseFoodsWithSolar(
    filteredCandidates, remainingAvg, remainingLo, remainingHi, useCount, foodHistory, lifestyle, macroFilter?.solarHint || ''
  );
  if (selected.length === 0) return [];

  const matchedSelected = [];
  const seenNames = new Set();
  let matchCount = 0;
  for (const item of selected) {
    const name = (item.name || '').trim();
    if (seenNames.has(name)) continue;
    seenNames.add(name);
    const matched = candidates.find(
      (c) => c.name === name || (c.displayName || '').trim() === name || (c.category || '').trim() === name
    );
    if (matched && matched.foodSize != null && matched.foodSize > 0) {


      const calActual = matched.calActual != null ? matched.calActual : (item.calActual != null ? item.calActual : 0);
      const gram = matched.foodSize;
      matchedSelected.push({
        name: matched.category || matched.displayName || matched.name,
        qty: item.qty || `${gram}g`,
        calActual,
        gram,
        note: item.note || (matched.category ? `${matched.category} 계열` : ''),
        code: matched.code,
      });
      matchCount++;
    } else {
      const calActual = item.calActual != null ? item.calActual : 0;
      matchedSelected.push({
        name,
        qty: item.qty || '',
        calActual,
        gram: item.gram != null ? Number(item.gram) : null,
        note: item.note || '',
        code: '',
      });
    }
  }

  if (matchCount === 0 && candidates.length > 0) {
    console.log('[DDC] Solar 응답 매칭 0개 — candidates에서 직접 추천 구성');
    const sorted = [...candidates]
      .sort((a, b) => Math.abs(a.calActual - remainingAvg) - Math.abs(b.calActual - remainingAvg));
    const picked = sorted.slice(0, useCount);
    matchedSelected.push(...picked.map((c) => ({
      name: c.category || c.displayName || c.name,
      qty: c.foodSize != null ? c.foodSize + 'g' : c.qty || '1인분',
      calActual: c.calActual,
      gram: c.foodSize,
      note: c.category ? `${c.category} 계열` : '',
      code: c.code,
    })));
  }

  if (matchedSelected.length < useCount) {
    const usedNames = new Set(matchedSelected.map((p) => (p.name || '').trim()));
    const usedCategories = new Set();
    for (const s of matchedSelected) {
      const matchedCandidate = candidates.find(
        (c) => c.category === s.name || c.name === s.name || (c.displayName || '').trim() === s.name
      );
      if (matchedCandidate) {
        usedCategories.add(matchedCandidate.category);
      }
    }
    const filler = candidates
      .filter((c) => !usedNames.has(c.category) && !usedNames.has(c.name) && !usedNames.has((c.displayName || '').trim()))
      .filter((c) => !usedCategories.has(c.category))
      .filter((c) => !matchedSelected.some((s) => s.code === '08' && c.code === '08'))
      .sort((a, b) => Math.abs(a.calActual - remainingAvg) - Math.abs(b.calActual - remainingAvg))
      .slice(0, useCount - matchedSelected.length);
    matchedSelected.push(...filler);
  }

  if (matchedSelected.length === 0) return [];
  return matchedSelected.map((p, i) => ({
    name: p.name,
    qty: p.qty,
    kcal: p.calActual,
    gram: p.gram,
    note: p.note,
    isPlanned: false,
    mealType: i < useCount - 1 || useCount === 1 ? 'dinner' : 'snack',
  }));
}

/** qty 문자열을 스케일 팩터로 조정한 권장량 문자열을 반환 */
export function adjustQuantity(qty, scale) {
  if (!qty) return '';

  const gMatch = qty.match(/^(\d+(?:\.\d+)?)\s*g$/i);
  if (gMatch) {
    const val = parseFloat(gMatch[1]);
    return `${Math.round(val * scale)}g`;
  }

  const mlMatch = qty.match(/^(\d+(?:\.\d+)?)\s*ml$/i);
  if (mlMatch) {
    const val = parseFloat(mlMatch[1]);
    return `${Math.round(val * scale)}ml`;
  }

  const countMatch = qty.match(/^(\d+(?:\.\d+)?)\s*(공기|개|인분|조각|그릇|토막|마리|잔|컵)/i);
  if (countMatch) {
    const val = parseFloat(countMatch[1]);
    const unit = countMatch[2];
    const adjusted = val * scale;
    if (adjusted < 0.5) return `반 ${unit}`;
    if (Math.abs(adjusted - Math.round(adjusted)) < 0.15) return `${Math.round(adjusted)} ${unit}`;
    return `약 ${adjusted.toFixed(1)} ${unit}`;
  }

  const fracMap = { 반: 0.5, '1/2': 0.5, '1/3': 1 / 3, '2/3': 2 / 3, '1/4': 0.25, '3/4': 0.75 };
  const fracMatch = qty.match(/^(반|1\/2|1\/3|2\/3|1\/4|3\/4)(\s*마리|\s*공기|\s*개|\s*인분|\s*조각)?$/i);
  if (fracMatch) {
    const fracStr = fracMatch[1];
    const unit = fracMatch[2] || '';
    const fracVal = fracMap[fracStr] || 0.5;
    const adjusted = fracVal * scale;
    if (adjusted < 0.2) return `조금${unit ? ' ' + unit : ''}`;
    if (adjusted < 0.4) return `1/3${unit}`;
    if (adjusted < 0.6) return `반${unit}`;
    if (adjusted < 0.85) return `2/3${unit}`;
    if (Math.abs(adjusted - 1) < 0.15) return `1${unit}`;
    return qty;
  }

  if (scale < 0.7) return `조금 줄여서`;
  if (scale < 0.9) return `계획보다 약간 적게`;
  return qty;
}

/** 축소 비율에 따른 적정량 안내 문구 */
export function generatePortionNote(scaleFactor) {
  if (scaleFactor >= 0.9) return '계획대로 드셔도 괜찮아요.';
  if (scaleFactor >= 0.7) return '계획보다 아주 조금 줄여서 드세요.';
  if (scaleFactor >= 0.5) return '계획보다 절반 정도로 줄여서 드시는 게 좋아요.';
  return '계획보다 많이 줄여서 드시는 게 좋아요.';
}

/** 음식 기록(history) 기준으로 후보 음식 필터링 — 중복 회피 */
export function filterCandidatesByHistory(candidates, history) {
  if (!history || !history.length) return candidates;
  const historyItems = history.map((h) => ({
    name: (h.name || '').toLowerCase(),
    category: (h.category || '').toLowerCase(),
  })).filter((h) => h.name || h.category);

  if (!historyItems.length) return candidates;

  return candidates.filter((c) => {
    const cname = (c.name || c.foodNm || '').toLowerCase();
    const ccat = (c.category || c.foodLv4Nm || '').toLowerCase();
    for (const h of historyItems) {
      if (!h.name && !h.category) continue;
      if (h.name && (cname.includes(h.name) || h.name.includes(cname))) return false;
      if (h.category && ccat && ccat === h.category) return false;
    }
    return true;
  });
}

/** 남은 칼로리 중간값(remainingAvg)을 받아 공공 API에서 실제 음식을 추천.
 *  calculate.js 핸들러 밖에서 테스트할 때 쓰기 위한 함수.
 */
export async function getRecommendedFoodsForAvg(remainingAvg, count = null, eatenFoods = [], foodHistory = []) {
  return buildRecommendedFoods(remainingAvg, eatenFoods, count, null, null, foodHistory);
}

/**
 * 남은 칼로리 중간값이 커서 여러 끼로 나누어 추천할 때 사용.
 * splitMeals.parts 개수만큼 반복하며 각 파트별 타겟 칼로리에 맞는 후보를 뽑아 구성.
 */
async function buildSplitRecommendations(splitMeals, eatenFoods, useCount, foodHistory, lifestyle, macroFilter) {
  const { parts, perPartAvg, perPartLo, perPartHi } = splitMeals;
  if (!parts || parts < 2) return [];

  const allSelected = [];
  const usedNames = new Set();
  const partCount = Math.ceil(useCount / parts); // 파트당 할당량 (전체 useCount를 parts로 나눔)

  for (let i = 0; i < parts; i++) {
    const candidates = await pickFoodsByCalorieTarget(
      perPartAvg,
      partCount,
      250,
      macroFilter?.boostCodes || null,
      macroFilter?.avoidCodes || null
    );
    const filtered = filterCandidatesByHistory(candidates, foodHistory);
    const selected = await selectDiverseFoodsWithSolar(
      filtered,
      perPartAvg,
      perPartLo,
      perPartHi,
      partCount,
      foodHistory,
      lifestyle,
      macroFilter?.solarHint || ''
    );

    for (const item of selected) {
      const name = (item.name || '').trim();
      if (!name || usedNames.has(name)) continue;
      usedNames.add(name);

      const matched = candidates.find(
        (c) => c.name === name || (c.displayName || '').trim() === name || (c.category || '').trim() === name
      );
      if (matched && matched.foodSize != null && matched.foodSize > 0) {
        const calActual = matched.calActual != null ? matched.calActual : (item.calActual != null ? item.calActual : 0);
        const gram = matched.foodSize;
        allSelected.push({
          name: matched.category || matched.displayName || matched.name,
          qty: item.qty || `${gram}g`,
          calActual,
          gram,
          note: item.note || (matched.category ? `${matched.category} 계열` : ''),
          code: matched.code,
        });
      } else {
        allSelected.push({
          name,
          qty: item.qty || '',
          calActual: item.calActual != null ? item.calActual : 0,
          gram: item.gram != null ? Number(item.gram) : null,
          note: item.note || '',
          code: '',
        });
      }
    }
  }

  if (allSelected.length === 0) return [];
  const capped = allSelected.slice(0, useCount);
  return capped.map((p, i) => ({
    name: p.name,
    qty: p.qty,
    kcal: p.calActual,
    gram: p.gram,
    note: p.note,
    isPlanned: false,
    mealType: i < useCount - 1 ? 'dinner' : 'snack',
    splitPart: i + 1,
  }));
}

import { interpretFoodsWithSolar, generateStrategyWithSolar, selectDiverseFoodsWithSolar } from './solar.js';
import { pickFoodsByCalorieTarget } from './foodRequest.js';
import { FOOD_LV3_SERVING_G } from './foodCategories.js';

// ---------- 매크로 분석 ----------

function buildMacroAnalysis(foods, profile, targetCaloriesRaw, foodHistory = []) {
  if (!foods || foods.length === 0) {
    return {
      totalCalLow: 0,
      totalCalHigh: 0,
      totalCalAvg: 0,
      totalProt_g: 0,
      totalFat_g: 0,
      totalCarbs_g: 0,
      targetProtein_g: 0,
      targetFat_g: 0,
      targetCarbs_g: 0,
      analysis: '아직 먹은 음식이 없어요.',
    };
  }

  const totalCalLow = foods.reduce((s, f) => s + (f.calLow || 0), 0);
  const totalCalHigh = foods.reduce((s, f) => s + (f.calHigh || 0), 0);
  const totalCalAvg = Math.round((totalCalLow + totalCalHigh) / 2);
  const totalProt_g = foods.reduce((s, f) => s + (f.prot_g || 0), 0);
  const totalFat_g = foods.reduce((s, f) => s + (f.fat_g || 0), 0);
  const totalCarbs_g = foods.reduce((s, f) => s + (f.carbs_g || 0), 0);

  // 영양소별 목표 (체중·목표 기준)
  const weight = profile.weight;
  // 단백질 목표: 감량 시 1.5g/kg, 증량 1.4g/kg, 유지/기타 1.2g/kg
  const proteinPerKg = profile.goal === 'loss' ? 1.5 : profile.goal === 'gain' ? 1.4 : 1.2;
  const targetProtein_g = Math.round(weight * proteinPerKg);
  // 지방 목표: 체중 1kg당 약 0.9g
  const targetFat_g = Math.round(weight * 0.9);
  // 탄수화물 목표: 총 목표 칼로리에서 단백질·지방 칼로리 제외한 나머지를 탄수화물로 채우는 방식
  const remainingForCarbs = Math.max(0, targetCaloriesRaw - targetProtein_g * 4 - targetFat_g * 9);
  const targetCarbs_g = Math.round(remainingForCarbs / 4);

  // ◆ 실제 섭취 칼로리의 목표 대비 상태
  const calDiff = totalCalAvg - targetCaloriesRaw;
  const calStatus = calDiff > 0 ? '섭취 칼로리가 목표보다 다소 높아요.' : calDiff < 0 ? '섭취 칼로리가 목표보다 낮아요.' : '섭취 칼로리가 목표 범위예요.';

  // ◆ 탄단지 비중 및 목표 대비
  const carbCal = totalCarbs_g * 4;
  const fatCal = totalFat_g * 9;
  const protCal = totalProt_g * 4;
  const totalMacroCal = carbCal + fatCal + protCal;
  const carbRatio = totalMacroCal > 0 ? carbCal / totalMacroCal : 0;
  const fatRatio = totalMacroCal > 0 ? fatCal / totalMacroCal : 0;
  const protRatio = totalMacroCal > 0 ? protCal / totalMacroCal : 0;

  const carbRatioDesc = carbRatio > 0.55 ? '높아요' : carbRatio < 0.45 ? '낮아요' : '적정해요';
  const fatRatioDesc = fatRatio > 0.35 ? '높아요' : fatRatio < 0.20 ? '낮아요' : '적정해요';
  const protRatioDesc = protRatio > 0.30 ? '높아요' : protRatio < 0.15 ? '낮아요' : '적정해요';

  const carbMsg = `탄수화물 비중이 ${carbRatioDesc} (약 ${Math.round(carbRatio * 100)}%).`;
  const fatMsg = `지방 비중이 ${fatRatioDesc} (약 ${Math.round(fatRatio * 100)}%).`;
  const protMsg = `단백질 비중이 ${protRatioDesc} (약 ${Math.round(protRatio * 100)}%).`;

  // ◆ 목표 영양소 대비 과다/부족
  const protGap = totalProt_g - targetProtein_g;
  const fatGap = totalFat_g - targetFat_g;
  const carbsGap = totalCarbs_g - targetCarbs_g;

  const protGapMsg = protGap > 0 ? `단백질은 목표 대비 약 ${Math.round(protGap)}g 많아요.` : protGap < 0 ? `단백질은 목표 대비 약 ${Math.round(Math.abs(protGap))}g 부족해요.` : '단백질은 목표 수준이에요.';
  const fatGapMsg = fatGap > 0 ? `지방은 목표 대비 약 ${Math.round(fatGap)}g 많아요.` : fatGap < 0 ? `지방은 목표 대비 약 ${Math.round(Math.abs(fatGap))}g 부족해요.` : '지방은 목표 수준이에요.';
  const carbsGapMsg = carbsGap > 0 ? `탄수화물은 목표 대비 약 ${Math.round(carbsGap)}g 많아요.` : carbsGap < 0 ? `탄수화물은 목표 대비 약 ${Math.round(Math.abs(carbsGap))}g 부족해요.` : '탄수화물은 목표 수준이에요.';

  // ◆ 최종 분석 문구 (BMR·활동 기반 목표와의 차이 반영)
  const analysis = [
    calStatus,
    `탄단지 비중: ${carbMsg} ${fatMsg} ${protMsg}`,
    `목표 대비: ${protGapMsg} ${fatGapMsg} ${carbsGapMsg}`,
  ].join(' ');

  return {
    totalCalLow,
    totalCalHigh,
    totalCalAvg,
    totalProt_g: Math.round(totalProt_g),
    totalFat_g: Math.round(totalFat_g),
    totalCarbs_g: Math.round(totalCarbs_g),
    targetProtein_g,
    targetFat_g,
    targetCarbs_g,
    analysis,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body;
  try {
    body = req.body;
    if (!body) {
      body = JSON.parse(req.body || '{}');
    }
  } catch {
    return res.status(400).json({ error: '잘못된 요청입니다.' });
  }

  // meals 구조 받기 (아침/점심/저녁/간식)
  // 하위 호환: 기존 eatenFoods 문자열도 지원
  let meals = body.meals || {};
  if (!meals || typeof meals !== 'object' || Array.isArray(meals)) {
    meals = {};
  }
  const mealKeys = ['breakfast', 'lunch', 'dinner', 'snack'];
  for (const k of mealKeys) {
    if (typeof meals[k] !== 'string') meals[k] = '';
  }
  // 기존 eatenFoods 문자열도 meals로 변환 (하위 호환)
  if (typeof body.eatenFoods === 'string' && body.eatenFoods.trim()) {
    // 기존 형식은 줄별로 음식 나열 — 아침으로 통합 (구 형식 마이그레이션)
    if (!meals.breakfast) meals.breakfast = body.eatenFoods.trim();
  }
  // Solar 호출용 텍스트 배열 생성 (빈 값 제외) — 끼니 구분자 포함
  const mealTexts = mealKeys.filter(k => meals[k] && meals[k].trim()).map(k => meals[k].trim());
  const eatenFoodsForSolar = mealTexts.length > 0
    ? mealTexts.map((text, idx) => `${mealKeys[idx]}: ${text}`)
    : [];

  const { profile, activityLevel, plannedFoods, lifestylePatterns = [], foodHistory = [] } = body;

  // 프로필 검증
  if (!profile || !profile.gender || !profile.age || profile.height == null || profile.weight == null || !profile.goal) {
    return res.status(400).json({ error: '프로필이 부족해요. 성별·나이·키·체중·목표를 모두 입력해주세요.' });
  }
  if (profile.height < 120 || profile.height > 250) {
    return res.status(400).json({ error: '키 입력이 이상해요. 120cm 이상 250cm 이하로 입력해주세요.' });
  }
  if (profile.weight < 30 || profile.weight > 300) {
    return res.status(400).json({ error: '체중 입력이 이상해요. 30kg 이상 300kg 이하로 입력해주세요.' });
  }
  if (![1.2, 1.375, 1.55, 1.725, 1.9].includes(activityLevel)) {
    return res.status(400).json({ error: '활동 강도 선택이 이상해요.' });
  }

  // BMR 계산 (Mifflin-St Jeor, 원값 사용)
  const gender = profile.gender === 'male' ? 'male' : 'female';
  let bmrRaw;
  if (gender === 'male') {
    bmrRaw = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
  } else {
    bmrRaw = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161;
  }

  // 오늘 예상 소비칼로리 (BMR 원값 × 오늘 활동계수)
  const todayConsumptionRaw = bmrRaw * activityLevel;

  // 오늘 목표 섭취칼로리
  let targetCaloriesRaw;
  if (profile.goal === 'loss') {
    targetCaloriesRaw = todayConsumptionRaw - 500;
  } else if (profile.goal === 'maintain') {
    targetCaloriesRaw = todayConsumptionRaw;
  } else { // gain
    targetCaloriesRaw = todayConsumptionRaw + 300;
  }

  // 음식 해석: Solar 호출 (solar.js로 분리됨)
  const foodsResult = await interpretFoodsWithSolar(eatenFoodsForSolar, plannedFoods || []);
  if (!foodsResult || foodsResult.error) {
    return res.status(500).json({ error: '음식 해석에 실패했어요: ' + (foodsResult?.error || '알 수 없는 오류') });
  }

  const foods = foodsResult.foods || [];
  const plannedFoodsResult = foodsResult.plannedFoods || [];

  // 범위 밖 요청 검증: 입력된 eatenFoods + plannedFoods 전체가 전부 음식이 아닌 경우(재요청)
  const allFoods = [...foods, ...plannedFoodsResult];
  const allNonFood =
    allFoods.length > 0 &&
    allFoods.every((f) => f.calLow === 0 && f.calHigh === 0);
  if (allNonFood) {
    return res.status(400).json({
      error: '입력한 내용 중 음식이 아닌 항목이 있어요. 실제 먹은 음식과 양을 알려주시면 계산해드릴게요.',
    });
  }

  // 현재 섭취량 계산 (하한 합계 ~ 상한 합계)
  const currentIntakeLo = foods.reduce((s, f) => s + (f.calLow ?? 0), 0);
  const currentIntakeHi = foods.reduce((s, f) => s + (f.calHigh ?? 0), 0);

  // 남은 칼로리 범위
  const remainingLo = targetCaloriesRaw - currentIntakeHi;
  const remainingHi = targetCaloriesRaw - currentIntakeLo;
  const remainingAvg = (remainingLo + remainingHi) / 2;

  // 매크로 분석: 먹은 음식의 탄단지 합산 + 분석 문구 (foodHistory 기반)
  const macroAnalysisBuild = buildMacroAnalysis(foods, profile, targetCaloriesRaw, foodHistory);
  const macroAnalysis = macroAnalysisBuild;

  // 매크로 분석 기반 추천 필터 설정
  const macroFilter = buildMacroFilterConfig(macroAnalysis, profile);

  // 예정 음식 섭취 후 남은 칼로리 (범위 + 중간값)
  const plannedFoodsCalLo = plannedFoodsResult.reduce((s, p) => s + (p.calLow ?? 0), 0);
  const plannedFoodsCalHi = plannedFoodsResult.reduce((s, p) => s + (p.calHigh ?? 0), 0);
  const plannedFoodsCalAvg = (plannedFoodsCalLo + plannedFoodsCalHi) / 2;

  const projectedRemainingLo = targetCaloriesRaw - currentIntakeHi - plannedFoodsCalHi;
  const projectedRemainingHi = targetCaloriesRaw - currentIntakeLo - plannedFoodsCalLo;
  const projectedRemainingAvg = (projectedRemainingLo + projectedRemainingHi) / 2;

  // 예정 음식 양 조절 권장
  const portionRecommendations = [];
  if (plannedFoodsResult.length > 0 && plannedFoodsCalAvg > 0 && projectedRemainingAvg < plannedFoodsCalAvg) {
    // projectedRemainingAvg가 음수(예산 초과)이면 remainingAvg(예전 남은 예산) 기준으로 스케일 계산
    const budgetForPlanned = projectedRemainingAvg >= 0 ? projectedRemainingAvg : remainingAvg;
    let scale = budgetForPlanned / plannedFoodsCalAvg;
    // 너무 작은 양이 안 나오게 최소 기준 적용 (20% 미만이면 20%로)
    scale = Math.max(0.2, Math.min(1.0, scale));
    for (const p of plannedFoodsResult) {
      portionRecommendations.push({
        name: p.name,
        plannedQty: p.qty,
        suggestedQty: adjustQuantity(p.qty, scale),
        note: generatePortionNote(scale),
      });
    }
  }

  // 예정 식사 분석
  let plannedComparison = '';
  if (plannedFoodsResult.length > 0) {
    const pLo = plannedFoodsResult.reduce((s, f) => s + (f.calLow ?? 0), 0);
    const pHi = plannedFoodsResult.reduce((s, f) => s + (f.calHigh ?? 0), 0);
    const totalLo = currentIntakeLo + pLo;
    const totalHi = currentIntakeHi + pHi;
    const targetRounded = Math.round(targetCaloriesRaw);

    if (totalHi < targetRounded) {
      plannedComparison = '현재 추정치상 오늘 목표 섭취량을 초과할 가능성은 낮아 보여. 다만 음식과 소비칼로리 모두 추정치이므로, 추가로 많이 먹거나 일부러 더 제한하기보다는 예정한 정도로 먹는 편이 좋아.';
    } else if (totalLo > targetRounded) {
      plannedComparison = '현재 추정치상 오늘 목표 섭취량을 초과할 가능성이 높아. 예정한 양보다 조금 줄이거나, 사이드·술·추가 분량을 조절하면 목표 범위에 더 가까워질 수 있어.';
    } else {
      plannedComparison = '현재 추정치로는 오늘 목표와 겹치는 범위가 있어. 예정대로 먹되, 사이드·술·추가 분량이 들어가면 목표를 넘을 수 있으니 그 정도만 조절하면 돼.';
    }
  }

  // 식사 전략: Solar 호출 (solar.js로 분리됨)
  const strategyResult = await generateStrategyWithSolar({
    profile,
    activityLevel,
    bmrRaw,
    todayConsumptionRaw,
    targetCaloriesRaw,
    currentIntakeLo,
    currentIntakeHi,
    remainingLo,
    remainingHi,
    foods,
    plannedFoodsResult,
    plannedComparison,
    lifestylePatterns,
  });

  const strategy = strategyResult?.strategy || '계산된 전략이 없어요.';

  // 디버깅: 추천 후보 풀 확인
  console.log('[DDC] buildRecommendedFoods 시작 — remainingAvg:', remainingAvg, 'useCount: 4');

  // Solar는 전략 텍스트만 반환하고, 음식 추천은 공공 API에서 처리
  // 예정 음식이 있으면 projectedRemainingAvg 기준으로 추천, 없으면 원래 remainingAvg 사용
  const recTargetAvg = projectedRemainingAvg !== null && projectedRemainingAvg > 0 ? projectedRemainingAvg : remainingAvg;
  const recTargetLo = projectedRemainingLo !== null && projectedRemainingLo !== undefined ? projectedRemainingLo : remainingLo;
  const recTargetHi = projectedRemainingHi !== null && projectedRemainingHi !== undefined ? projectedRemainingHi : remainingHi;
  const recommendedFoods = await buildRecommendedFoods(recTargetAvg, foods, 4, recTargetLo, recTargetHi, foodHistory, macroFilter);
  const macroFilterForSolar = macroFilter ?? buildMacroFilterConfig(macroAnalysis, profile);

  // 생활 패턴 안내 문구
  const lifestyleNote = lifestylePatterns && lifestylePatterns.length > 0
    ? null
    : '현재 생활패턴이 적혀있지 않아요. 입력하면 더 맞춤화된 조언을 받을 수 있어요.';

  // 응답 구성 (모든 숫자는 반올림하여 표시, 내부 원값 정보는 제외)
  return res.status(200).json({
    bmr: Math.round(bmrRaw),
    todayConsumption: Math.round(todayConsumptionRaw),
    targetCalories: Math.round(targetCaloriesRaw),
    goal: profile.goal,
    currentIntakeLo: Math.round(currentIntakeLo),
    currentIntakeHi: Math.round(currentIntakeHi),
    remainingLo: Math.round(remainingLo),
    remainingHi: Math.round(remainingHi),
    remainingAvg: Math.round(remainingAvg),
    projectedRemainingLo: Math.round(projectedRemainingLo),
    projectedRemainingHi: Math.round(projectedRemainingHi),
    projectedRemainingAvg: Math.round(projectedRemainingAvg),
    foods,
    plannedFoods: plannedFoodsResult,
    plannedComparison,
    portionRecommendations,
    strategy,
    recommendedFoods,
    macroAnalysis,
    lifestyleNote,
    meals,
  });
}

// ---------- 공공 API 기반 추천 로직 ----------

const BANCHAN_CODES = new Set(['11', '13', '14', '15', '16', '17', '18']);
const RICE_CAL_PER_100G = 130;
const RICE_SERVING_G = FOOD_LV3_SERVING_G['01'] || 210;
const RICE_CAL = Math.round(RICE_CAL_PER_100G * RICE_SERVING_G / 100);

async function buildRecommendedFoods(remainingAvg, eatenFoods, count = null, remainingLo = null, remainingHi = null, foodHistory = [], macroFilter = null) {
  if (remainingAvg < 100) return [];
  const useCount = count ?? (remainingAvg >= 600 && remainingAvg < 1200 ? 2 : 1);
  const preferredCodes = macroFilter?.boostCodes || null;
  const avoidCodes = macroFilter?.avoidCodes || null;

  // 1) 전체 remainingAvg에서 후보 검색 (tolerance 넉넉히)
  // 남은 칼로리 중간값 기준으로 후보 풀 구성 (test-calories-request.js와 동일)
  console.log('[DDC] pickFoodsByCalorieTarget 호출 — targetCal:', remainingAvg, 'useCount:', useCount);
  const candidates = await pickFoodsByCalorieTarget(remainingAvg, useCount, 250, preferredCodes, avoidCodes);
  console.log('[DDC] candidates 획득 — 개수:', candidates.length);
  candidates.forEach((c, i) => console.log(`  후보${i+1}: ${c.name} | ${c.qty} | ${c.calLow}~${c.calHigh}kcal | code=${c.code} | cat=${c.category}`));

  // foodHistory(이전 기록) 기준으로 candidate 필터링 — 중복 회피
  const filteredCandidates = filterCandidatesByHistory(candidates, foodHistory);
  if (filteredCandidates.length !== candidates.length) {
    console.log('[DDC] foodHistory 필터링 — 후보', candidates.length, '→', filteredCandidates.length, '개로 축소');
  }

  // 2) 반찬 코드 있어도 Solar한테 후보 풀을 넘겨서 고르게 함
  // 3) Solar 응답 결과에서 반찬 코드에 해당하는 항목만 밥+반찬으로 조합
  if (candidates.length === 0) return [];
  const selected = await selectDiverseFoodsWithSolar(filteredCandidates, remainingAvg, remainingLo, remainingHi, useCount, foodHistory, macroFilterForSolar?.solarHint || '');
  if (selected.length === 0) return [];

  // Solar 응답의 name을 원본 후보와 매칭하여 foodSize(g) 정보를 qty에 반영
  const matchedSelected = [];
  const seenNames = new Set();
  for (const item of selected) {
    const name = (item.name || '').trim();
    if (seenNames.has(name)) continue; // 같은 이름 중복 skip
    seenNames.add(name);
    const matched = candidates.find(
      (c) => (c.name || '').trim() === name || (c.category || '').trim() === name
    );
    if (matched && matched.foodSize != null && matched.foodSize > 0) {
      matchedSelected.push({
        ...item,
        qty: `${item.qty} (${Math.round(matched.foodSize)}g)`,
        foodSize: matched.foodSize,
      });
    } else {
      matchedSelected.push(item);
    }
  }

  // Solar 응답 fallback: useCount보다 적으면 candidates에서 남은 slot만큼 채움 (계열 중복 제외)
  if (matchedSelected.length < useCount) {
    // 이미 선택된 항목들의 이름을 기준으로 category 사용 여부 추적
    const usedNames = new Set(matchedSelected.map((p) => (p.name || '').trim()));
    // 이미 선택된 항목들의 foodLv4Nm 카테고리 수집
    const usedCategories = new Set();
    for (const s of matchedSelected) {
      const matchedCandidate = candidates.find(
        (c) => c.category === s.name || c.name === s.name
      );
      if (matchedCandidate) {
        usedCategories.add(matchedCandidate.category);
      }
    }
    // candidates에서 사용되지 않은 계열 우선으로 추가
    const filler = candidates
      .filter((c) => !usedNames.has(c.category) && !usedNames.has(c.name))
      .filter((c) => !usedCategories.has(c.category))
      .filter((c) => !matchedSelected.some((s) => s.code === '08' && c.code === '08'))
      .sort((a, b) => Math.abs(a.calActual - remainingAvg) - Math.abs(b.calActual - remainingAvg))
      .slice(0, useCount - matchedSelected.length);
    matchedSelected.push(...filler);
  }

  // 반찬 코드(11,13,14,15,16,17,18) 또는 구이류(08)가 있어도
  // 조합 로직 없이 Solar가 뽑은 selected 그대로 사용 (중복 허용, 4개 확보 우선)
  if (matchedSelected.length === 0) return [];
  return matchedSelected.map((p, i) => ({
    ...p,
    isPlanned: false,
    mealType: i < useCount - 1 || useCount === 1 ? 'dinner' : 'snack',
  }));
}

/** 반찬 없이 단독 추천할 때 쓰는 note */
function buildNotePlain(p) {
  const categoryPart = p.category ? `${p.category} · ` : '';
  return `${categoryPart}약 ${p.calLow} kcal (공공 DB 기준)`;
}

/** qty 문자열을 스케일 팩터로 조정한 권장량 문자열을 반환 */
function adjustQuantity(qty, scale) {
  if (!qty) return '';

  // gram: "200g", "150g"
  const gMatch = qty.match(/^(\d+(?:\.\d+)?)\s*g$/i);
  if (gMatch) {
    const val = parseFloat(gMatch[1]);
    return `${Math.round(val * scale)}g`;
  }

  // ml: "200ml"
  const mlMatch = qty.match(/^(\d+(?:\.\d+)?)\s*ml$/i);
  if (mlMatch) {
    const val = parseFloat(mlMatch[1]);
    return `${Math.round(val * scale)}ml`;
  }

  // count with unit: "1공기", "2개", "1인분", "1조각", "1그릇", "1토막", "1마리", "1잔", "1컵"
  const countMatch = qty.match(/^(\d+(?:\.\d+)?)\s*(공기|개|인분|조각|그릇|토막|마리|잔|컵)/i);
  if (countMatch) {
    const val = parseFloat(countMatch[1]);
    const unit = countMatch[2];
    const adjusted = val * scale;
    if (adjusted < 0.5) return `반 ${unit}`;
    if (Math.abs(adjusted - Math.round(adjusted)) < 0.15) return `${Math.round(adjusted)} ${unit}`;
    return `약 ${adjusted.toFixed(1)} ${unit}`;
  }

  // fraction: "반마리", "1/3공기", "2/3개"
  const fracMap = { '반': 0.5, '1/2': 0.5, '1/3': 1/3, '2/3': 2/3, '1/4': 0.25, '3/4': 0.75 };
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

  // Vague quantities: "한 줌", "적당량" 등
  if (scale < 0.7) return `조금 줄여서`;
  if (scale < 0.9) return `계획보다 약간 적게`;
  return qty;
}

/** 축소 비율에 따른 적정량 안내 문구 */
function generatePortionNote(scaleFactor) {
  if (scaleFactor >= 0.9) return '계획대로 드셔도 괜찮아요.';
  if (scaleFactor >= 0.7) return '계획보다 아주 조금 줄여서 드세요.';
  if (scaleFactor >= 0.5) return '계획보다 절반 정도로 줄여서 드시는 게 좋아요.';
  return '계획보다 많이 줄여서 드시는 게 좋아요.';
}

/**
 * 남은 칼로리 중간값(remainingAvg)을 받아 공공 API에서 실제 음식을 추천.
 * calculate.js 핸들러 밖에서 테스트할 때 쓰기 위한 함수.
 */
export async function getRecommendedFoodsForAvg(remainingAvg, count = null, eatenFoods = [], foodHistory = []) {
  return buildRecommendedFoods(remainingAvg, eatenFoods, count, null, null, foodHistory);
}

/** 음식 기록(history) 기준으로 후보 음식 필터링 — 중복 회피 */
function filterCandidatesByHistory(candidates, history) {
  if (!history || !history.length) return candidates;
  // 히스토리에서 name과 category 추출 (lowercase)
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
      // 이름 포함 관계: 어느 한쪽이 다른 쪽에 포함되면 중복으로 간주
      if (h.name && (cname.includes(h.name) || h.name.includes(cname))) return false;
      // 카테고리 일치
      if (h.category && ccat && ccat === h.category) return false;
    }
    return true;
  });
}

export { buildRecommendedFoods, buildMacroAnalysis, filterCandidatesByHistory, buildMacroFilterConfig };

/**
 * 매크로 분석 결과 기반 추천 필터 설정 생성.
 * 탄단지 비중/목표 대비 상태에 따라 회피 코드셋, 선호 코드셋, Solar 프롬프트용 힌트 생성.
 *
 * @param {import('./calculate.js').MacroAnalysisResult} macroAnalysis
 * @param {import('./calculate.js').Profile} profile
 * @returns {{ avoidCodes: Set<string>, boostCodes: Set<string>, solarHint: string }}
 */
function buildMacroFilterConfig(macroAnalysis, profile) {
  const avoidCodes = new Set();   // 후보 풀에서 제외할 대분류 코드
  const boostCodes = new Set();   // 선호 가중치가 들어가는 대분류 코드
  const hints = [];

  const { totalCalAvg, totalProt_g, totalFat_g, totalCarbs_g, targetProtein_g, targetFat_g, targetCarbs_g } = macroAnalysis;
  const totalMacroCal = totalCarbs_g * 4 + totalFat_g * 9 + totalProt_g * 4;
  const carbRatio = totalMacroCal > 0 ? (totalCarbs_g * 4) / totalMacroCal : 0;
  const fatRatio = totalMacroCal > 0 ? (totalFat_g * 9) / totalMacroCal : 0;
  const protRatio = totalMacroCal > 0 ? (totalProt_g * 4) / totalMacroCal : 0;
  const protGap = totalProt_g - targetProtein_g;
  const fatGap = totalFat_g - targetFat_g;
  const carbsGap = totalCarbs_g - targetCarbs_g;

  // 칼로리 과잉/부족 상태
  const calSurplus = totalCalAvg > targetCaloriesRaw;
  const calDeficit = totalCalAvg < targetCaloriesRaw;

  // --- 탄수화물 비중 과다면 고탄수 코드 회피 ---
  if (carbRatio > 0.50) {
    avoidCodes.add('01'); avoidCodes.add('02'); avoidCodes.add('03'); avoidCodes.add('04');
    hints.push('탄수화물 비중이 높은 편이에요. 밥·빵·면·죽·스프보다는 채소·단백질 위주로 채워 보세요.');
  }
  // 탄수화물 비중이 너무 낮으면(< 0.35) 탄수화물 코드 일부 선호
  if (carbRatio < 0.35) {
    boostCodes.add('01'); boostCodes.add('03'); boostCodes.add('04');
    hints.push('탄수화물 비중이 낮은 편이에요. 밥·빵·면류를 적절히 포함해 보세요.');
  }

  // --- 단백질 부족(목표 대비 -20g 이상)이면 단백질 비중 높은 코드 선호 ---
  if (protGap < -20) {
    boostCodes.add('05'); boostCodes.add('06'); boostCodes.add('07'); boostCodes.add('08');
    hints.push('단백질이 부족해요. 국·탕·찌개·찜·구이류처럼 단백질이 넉넉한 메뉴를 우선해 보세요.');
  }
  // 단백질이 과다하면 구이류·부침류 같은 고단백 고지방 코드 회피
  if (protGap > 30) {
    avoidCodes.add('08'); avoidCodes.add('09');
    hints.push('단백질 섭취가 많은 편이에요. 추가 단백질보다 채소·탄수화물을 챙겨 보세요.');
  }

  // --- 지방 과다(목표 대비 +15g 이상)면 고지방 코드 회피 ---
  if (fatGap > 15) {
    avoidCodes.add('08'); avoidCodes.add('09'); avoidCodes.add('12'); // 구이·부침·튀김
    hints.push('지방 섭취가 많은 편이에요. 구이·부침·튀김처럼 기름진 음식은 피하고 담백한 쪽을 선택해 보세요.');
  }
  // 지방 부족(목표 대비 -15g 이하)이면 지방 코드 일부 선호
  if (fatGap < -15) {
    boostCodes.add('08'); boostCodes.add('12');
    hints.push('지방 섭취가 부족한 편이에요. 구이·튀김처럼 지방이 있는 음식도 괜찮아요.');
  }

  // --- 총 칼로리가 목표 대비 현저히 낮으면(< 목표의 80%) 포만감 있는 음식 선호 ---
  if (calDeficit && totalCalAvg < targetCaloriesRaw * 0.8) {
    hints.push('섭취 칼로리가 목표보다 현저히 낮아요. 포만감을 줄 수 있는 넉넉한 메뉴로 채워 보세요.');
  }
  // 총 칼로리가 목표 초과면 가벼운 음식 선호
  if (calSurplus && totalCalAvg > targetCaloriesRaw * 1.1) {
    avoidCodes.add('12'); // 튀김류
    hints.push('섭취 칼로리가 목표보다 높아요. 가벼운 메뉴로 마무리해 보세요.');
  }

  const solarHint = hints.length > 0 ? hints.join(' ') : '';

  return { avoidCodes, boostCodes, solarHint };
}

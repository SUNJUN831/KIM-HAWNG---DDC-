// Solar 3종 호출 orchestration — 해석 → 전략 → 추천까지 한 흐름으로 조율
import { interpretFoodsWithSolar } from './solar-interpret.js';
import { generateStrategyWithSolar } from './solar-strategy.js';
import { buildRecommendedFoods } from './recommend.js';
import { calculateProfileMetrics, buildMacroAnalysis, buildMacroFilterConfig } from './calcs.js';
import { adjustQuantity, generatePortionNote } from './recommend.js';

export async function runDietCoach(body) {
  const { profile, activityLevel, plannedFoods: rawPlannedFoods, lifestylePatterns = [], foodHistory = [], meals: rawMeals } = body;

  const mealKeys = ['breakfast', 'lunch', 'dinner', 'snack'];
  let meals = rawMeals || {};
  if (!meals || typeof meals !== 'object' || Array.isArray(meals)) meals = {};
  for (const k of mealKeys) {
    if (typeof meals[k] !== 'string') meals[k] = '';
  }
  if (typeof body.eatenFoods === 'string' && body.eatenFoods.trim()) {
    if (!meals.breakfast) meals.breakfast = body.eatenFoods.trim();
  }
  const mealTexts = mealKeys.filter(k => meals[k] && meals[k].trim()).map(k => meals[k].trim());
  const eatenFoodsForSolar = mealTexts.length > 0
    ? mealTexts.map((text, idx) => `${mealKeys[idx]}: ${text}`)
    : [];

  const plannedFoods = rawPlannedFoods || [];

  // 1) 프로필 기반 계산
  const { bmrRaw, todayConsumptionRaw, targetCaloriesRaw } = calculateProfileMetrics(profile, activityLevel);

  // 2) Solar 음식 해석
  const foodsResult = await interpretFoodsWithSolar(eatenFoodsForSolar, plannedFoods);
  if (!foodsResult || foodsResult.error) {
    throw new Error('음식 해석에 실패했어요: ' + (foodsResult?.error || '알 수 없는 오류'));
  }
  const foods = foodsResult.foods || [];
  const plannedFoodsResult = foodsResult.plannedFoods || [];

  // allNonFood 검증
  const allFoods = [...foods, ...plannedFoodsResult];
  const allNonFood = allFoods.length > 0 && allFoods.every((f) => f.calLow === 0 && f.calHigh === 0);
  if (allNonFood) {
    throw new Error('입력한 내용 중 음식이 아닌 항목이 있어요. 실제 먹은 음식과 양을 알려주시면 계산해드릴게요.');
  }

  // 3) 현재 섭취량, 남은 칼로리
  const currentIntakeLo = foods.reduce((s, f) => s + (f.calLow ?? 0), 0);
  const currentIntakeHi = foods.reduce((s, f) => s + (f.calHigh ?? 0), 0);
  const remainingLoCalc = targetCaloriesRaw - currentIntakeHi;
  const remainingHiCalc = targetCaloriesRaw - currentIntakeLo;
  const remainingAvgCalc = (remainingLoCalc + remainingHiCalc) / 2;

  // 4) 매크로 분석 + 필터 설정
  const macroAnalysis = buildMacroAnalysis(foods, profile, targetCaloriesRaw, foodHistory);
  const macroFilter = buildMacroFilterConfig(macroAnalysis, profile, targetCaloriesRaw);

  // 5) 예정 음식 포함 남은 칼로리
  const plannedFoodsCalLo = plannedFoodsResult.reduce((s, p) => s + (p.calLow ?? 0), 0);
  const plannedFoodsCalHi = plannedFoodsResult.reduce((s, p) => s + (p.calHigh ?? 0), 0);
  const plannedFoodsCalAvg = (plannedFoodsCalLo + plannedFoodsCalHi) / 2;
  const projectedRemainingLo = targetCaloriesRaw - currentIntakeHi - plannedFoodsCalHi;
  const projectedRemainingHi = targetCaloriesRaw - currentIntakeLo - plannedFoodsCalLo;
  const projectedRemainingAvg = (projectedRemainingLo + projectedRemainingHi) / 2;

  // 6) 예정 음식 양 조절 권장
  const portionRecommendations = [];
  if (plannedFoodsResult.length > 0 && plannedFoodsCalAvg > 0 && projectedRemainingAvg < plannedFoodsCalAvg) {
    const budgetForPlanned = projectedRemainingAvg >= 0 ? projectedRemainingAvg : remainingAvgCalc;
    let scale = budgetForPlanned / plannedFoodsCalAvg;
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

  // 7) 예정 식사 분석
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

  // 8) Solar 전략 생성
  const strategyResult = await generateStrategyWithSolar({
    profile,
    activityLevel,
    bmrRaw,
    todayConsumptionRaw,
    targetCaloriesRaw,
    currentIntakeLo,
    currentIntakeHi,
    remainingLo: remainingLoCalc,
    remainingHi: remainingHiCalc,
    foods,
    plannedFoodsResult,
    plannedComparison,
    lifestylePatterns,
  });
  const strategy = strategyResult?.strategy || '계산된 전략이 없어요.';

  // 9) 공공 API 기반 추천
  const recTargetAvg = projectedRemainingAvg !== null && projectedRemainingAvg > 0 ? projectedRemainingAvg : remainingAvgCalc;
  const recTargetLo = projectedRemainingLo !== null && projectedRemainingLo !== undefined ? projectedRemainingLo : remainingLoCalc;
  const recTargetHi = projectedRemainingHi !== null && projectedRemainingHi !== undefined ? projectedRemainingHi : remainingHiCalc;
  const lifestyleText = lifestylePatterns && lifestylePatterns.length > 0 ? lifestylePatterns.join(' ') : '';
  const recommendedFoods = await buildRecommendedFoods(recTargetAvg, foods, 4, recTargetLo, recTargetHi, foodHistory, macroFilter,lifestyleText);

  // 10) 생활 패턴 안내 문구
  const lifestyleNote = lifestylePatterns && lifestylePatterns.length > 0
    ? null
    : '현재 생활패턴이 적혀있지 않아요. 입력하면 더 맞춤화된 조언을 받을 수 있어요.';

  return {
    bmr: Math.round(bmrRaw),
    todayConsumption: Math.round(todayConsumptionRaw),
    targetCalories: Math.round(targetCaloriesRaw),
    goal: profile.goal,
    currentIntakeLo: Math.round(currentIntakeLo),
    currentIntakeHi: Math.round(currentIntakeHi),
    remainingLo: Math.round(remainingLoCalc),
    remainingHi: Math.round(remainingHiCalc),
    remainingAvg: Math.round(remainingAvgCalc),
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
  };
}

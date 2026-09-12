import { interpretFoodsWithSolar, generateStrategyWithSolar } from './solar.js';

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

  const { profile, activityLevel, plannedFoods } = body;

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
  });

  const strategy = strategyResult?.strategy || '계산된 전략이 없어요.';

  const recommendedFoods = strategyResult?.recommendedFoods || [];

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
    foods,
    plannedFoods: plannedFoodsResult,
    plannedComparison,
    strategy,
    recommendedFoods,
    meals,
  });
}

// ---------- 로컬 추천 로직 (제거됨) ----------

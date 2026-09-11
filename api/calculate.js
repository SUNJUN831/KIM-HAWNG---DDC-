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
  // Solar 호출용 텍스트 배열 생성 (빈 값 제외)
  const mealTexts = mealKeys.filter(k => meals[k] && meals[k].trim()).map(k => meals[k].trim());
  const eatenFoodsForSolar = mealTexts.length > 0 ? mealTexts : [];

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

  // 음식 해석: Solar Pro 4 호출 (모델명 solar-pro4 고정)
  const foodsResult = await interpretFoodsWithSolar(eatenFoodsForSolar, plannedFoods);
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

  // 식사 전략: Solar Pro 4 호출
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
    plannedComparison
  });

  const strategy = strategyResult?.strategy || '계산된 전략이 없어요.';

  const mealSuggestions = generateMealSuggestions({
    goal: profile.goal,
    remainingLo: Math.round(remainingLo),
    remainingHi: Math.round(remainingHi),
    foods,
    plannedFoodsResult,
    meals,
  });

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
    mealSuggestions,
    meals,
  });
}

// 음식 해석: Solar Pro 4 호출 (모델명 solar-pro4 고정)
async function interpretFoodsWithSolar(eatenFoods, plannedFoods) {
  const apiKey = process.env.UPSTAGE_API_KEY;
  if (!apiKey) {
    return { error: 'UPSTAGE_API_KEY가 설정되지 않았어요.' };
  }

  const allFoods = [...eatenFoods, ...plannedFoods];
  const isEaten = eatenFoods.map(() => true).concat(plannedFoods.map(() => false));

  const userMessage = `다음 음식 목록을 보고 각 음식의 추정 칼로리 범위(하한~상한, kcal 단위)를 알려줘.
응답은 JSON 배열로만 반환해. 다른 설명은 넣지 마.
각 항목은 다음 형식이야:
{
  "name": "음식명",
  "qty": "양/단위 (자연어 그대로)",
  "calLow": 숫자 (하한 kcal),
  "calHigh": 숫자 (상한 kcal),
  "note": "참고 문구 (있다면, 없으면 생략)",
  "isPlanned": boolean (예정 음식이면 true, 먹은 음식이면 false)
}

규칙:
- calories는 추정치/범위로만 제시. 정확한 값이라 단정하지 마.
- 일반적인 1인분 기준,Recipe·양·브랜드에 따라 달라지면 그 점을 note에 적어.
- 양을 알 수 없는 애매한 표현이면 calLow와 calHigh를 넉넉하게 잡고 note에 "추정"이라고 적어.
- 한식·육류·간식 등 일반적인 음식 참조를 사용해.
- 명확히 불가능한 음식(예: 음식이 아닌 것)이 있으면 calLow=0, calHigh=0, note="추정 불가"로 해.

음식 목록: ${allFoods.map((f, i) => `${isEaten[i] ? '[먹은]' : '[예정]'} ${f}`).join('\n')}

결과 JSON만 반환해.`;

  try {
    const response = await fetch('https://api.upstage.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'solar-pro4',
        messages: [
          { role: 'system', content: '너는 음식 칼로리 추정 전문가야. 항상 kcal 추정치로 범위만 제시하고, 정확한 값이라 단정하지 마. 응답은 JSON 배열로만 해.' },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 2048
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return { error: `Solar 호출 실패 (${response.status}): ${errText}` };
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return { error: 'Solar 응답이 비어 있어요.' };
    }

    // JSON만 파싱 시도 (마크다운 코드 블록이 섞여 있을 수 있음)
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```')) {
      const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) jsonStr = match[1].trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return { error: 'Solar 응답이 JSON이 아니에요: ' + jsonStr.slice(0, 200) };
    }

    if (!Array.isArray(parsed)) {
      return { error: 'Solar 응답이 배열이 아니에요.' };
    }

    const foods = [];
    const plannedFoodsResult = [];
    for (const item of parsed) {
      const name = item.name || '알 수 없음';
      const qty = item.qty || '';
      const calLow = typeof item.calLow === 'number' ? item.calLow : 0;
      const calHigh = typeof item.calHigh === 'number' ? item.calHigh : 0;
      const note = item.note || '';
      const isPlanned = item.isPlanned === true;
      const entry = { name, qty, calLow, calHigh, note, isPlanned };
      if (isPlanned) {
        plannedFoodsResult.push(entry);
      } else {
        foods.push(entry);
      }
    }

    return { foods, plannedFoods: plannedFoodsResult };
  } catch (e) {
    return { error: 'Solar 호출 중 오류: ' + e.message };
  }
}

// 식사 전략 생성: Solar Pro 4 호출 (모델명 solar-pro4 고정)
async function generateStrategyWithSolar(context) {
  const apiKey = process.env.UPSTAGE_API_KEY;
  if (!apiKey) {
    return { strategy: 'UPSTAGE_API_KEY가 설정되지 않아서 전략을 생성하지 못했어요.' };
  }

  const goalLabel = context.profile.goal === 'loss' ? '감량' : context.profile.goal === 'maintain' ? '유지' : '증량';
  const activityLabel = context.activityLevel === 1.2 ? '거의 활동 없음' :
    context.activityLevel === 1.375 ? '낮음' :
    context.activityLevel === 1.55 ? '보통' :
    context.activityLevel === 1.725 ? '높음' : '매우 높음';

  const userMessage = `다음 정보를 바탕으로 오늘 하루 식사 전략을 작성해줘.
응답은 JSON 하나로만 반환해: { "strategy": "전략 텍스트" }
전략 텍스트는 한국어로, 친절하고 실용적인 코치 톤으로 작성해.

규칙:
- "아침·점심 굶으세요" 같은 극단적 제안 금지.
- "남은 calories 많다고 지금 다 먹자" 식이 아니라, 남은 끼니의 균형을 제안하는 방식.
- 음식이 남는다고 더 먹으라고 권하지 말고, 무리하지 않게 조절하되 과도한 제한은 피하라는 톤.
- 오늘 운동량이 많으면 식사 구성을 확인하라는 정도 언급.
- 과식 위험·균형 관점에서 체크 포인트 1~2개 제시.
- 모든 수치에는 "약"을 붙이고, 범위 추정 시 "~ kcal" 사용. 단정 표현 금지.
- 소비·음식 칼로리가 추정치라는 점을 한 번만 언급하면서 자연스럽게 녹일 것.
- "현재 추정치상 ~ 목표(~ kcal)를 초과할 가능성은 낮아 보여" 같은 표현을 쓸 수 있으면 쓰고, 아니면 전략 텍스트 안에서 자연스럽게 제시해.
- 이 전략은 웹 서비스에 표시될 텍스트야. 너무 길지 않게 (한 단락~두 단락 정도).

정보:
- 성별: ${context.profile.gender === 'male' ? '남성' : '여성'}
- 나이: ${context.profile.age}세
- 키: ${context.profile.height}cm
- 체중: ${context.profile.weight}kg
- 목표: ${goalLabel}
- 오늘 활동 강도: ${activityLabel} (활동계수 ${context.activityLevel})
- 기초대사량(BMR, 원값): 약 ${Math.round(context.bmrRaw)} kcal
- 오늘 예상 소비칼로리(BMR 원값 × 활동계수): 약 ${Math.round(context.todayConsumptionRaw)} kcal
- 오늘 목표 섭취칼로리: 약 ${Math.round(context.targetCaloriesRaw)} kcal (${goalLabel})
- 현재 섭취 추정치: 약 ${Math.round(context.currentIntakeLo)}~${Math.round(context.currentIntakeHi)} kcal
- 남은 칼로리 범위: 약 ${Math.round(context.remainingLo)}~${Math.round(context.remainingHi)} kcal
- 먹은 음식: ${context.foods.map(f => `${f.name} ${f.qty ? '('+f.qty+')' : ''} (약 ${Math.round(f.calLow)}~${Math.round(f.calHigh)} kcal)`).join(', ') || '없음'}
- 예정 음식: ${context.plannedFoodsResult.map(f => `${f.name} ${f.qty ? '('+f.qty+')' : ''} (약 ${Math.round(f.calLow)}~${Math.round(f.calHigh)} kcal)`).join(', ') || '없음'}
- 예정 식사 판단: ${context.plannedComparison || '예정 음식 없음'}
- 남은 칼로리 기준: ${Math.round(context.remainingLo)}~${Math.round(context.remainingHi)} kcal

전략만 JSON으로 반환해. 다른 설명 없이.`;

  try {
    const response = await fetch('https://api.upstage.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'solar-pro4',
        messages: [
          { role: 'system', content: '너는 오늘 하루 식단 코치야. 항상 친절하고 실용적인 톤으로, 극단적 제안 없이 균형 전략을 제시해. 응답은 JSON 객체 하나로만 해: { "strategy": "텍스트" }' },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 2048
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return { strategy: `전략 생성 실패 (${response.status}): ${errText}` };
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return { strategy: '전략 응답이 비어 있어요.' };
    }

    // JSON만 파싱 시도
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```')) {
      const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) jsonStr = match[1].trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // JSON 파싱 실패 시, 텍스트를 그대로 전략으로 사용 (최선의 추정)
      return { strategy: jsonStr.slice(0, 2000) };
    }

    if (parsed && typeof parsed.strategy === 'string') {
      return { strategy: parsed.strategy };
    }

    return { strategy: jsonStr.slice(0, 2000) };
  } catch (e) {
    return { strategy: '전략 생성 중 오류: ' + e.message };
  }
}

function extractFoodFoodTypes(foodList) {
  const foodTypes = new Set();
  const foodTypePatterns = [
    "김밥", "돈까스", "샌드위치", "salad", "라면", "빵", "요거트", "사과", "견과류",
  ];
  for (const food of foodList) {
    if (typeof food.name !== 'string') continue;
    for (const ft of foodTypePatterns) {
      if (food.name.includes(ft)) {
        foodTypes.add(ft);
      }
    }
  }
  return foodTypes;
}

function generateMealSuggestions({ goal, remainingLo, remainingHi, foods = [], plannedFoodsResult = [], meals = {} }) {
  const avgRemaining = (remainingLo + remainingHi) / 2;

  // meals 기반 eatenFoodTypes 추출 (각 끼니의 음식에서 foodTypes 수집)
  const mealsFoodList = [];
  const mealKeys = ['breakfast', 'lunch', 'dinner', 'snack'];
  for (const k of mealKeys) {
    const items = meals[k] || [];
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item && typeof item.name === 'string') mealsFoodList.push(item);
      }
    }
  }
  const eatenFoodTypes = extractFoodFoodTypes([...mealsFoodList, ...plannedFoodsResult]);

  const pool = [
    { name: "견과류 한 줌 (약 20~30g)", low: 120, high: 200, note: "간식", category: "light", foodTypes: ["견과류"] },
    { name: "사과 + 플레인 요거트", low: 150, high: 230, note: "가벼운 간식 느낌", category: "light", foodTypes: ["사과", "요거트"] },
    { name: "계란빵 1개", low: 200, high: 350, note: "간식·간편", category: "light", foodTypes: ["빵"] },
    { name: "닭가슴살 샐러드 (드레싱 포함)", low: 300, high: 450, note: "가벼운 식사", category: "light", foodTypes: ["salad"] },
    { name: "참치김밥 1줄", low: 300, high: 500, note: "한 끼 부담 적은 편", category: "normal", foodTypes: ["김밥"] },
    { name: "샌드위치 (일반 햄/참치 등)", low: 350, high: 500, note: "한 끼로 무난한 편", category: "normal", foodTypes: ["샌드위치"] },
    { name: "소고기 김밥 1줄", low: 400, high: 600, note: "제법 포만감", category: "heavier", foodTypes: ["김밥"] },
    { name: "치즈돈까스 작은 조각 (약 2~3조각)", low: 400, high: 650, note: "고열량, 나눠 먹기", category: "heavier", foodTypes: ["돈까스"] },
  ];

  const filteredPool = pool.filter(item => {
    if (!item.foodTypes || item.foodTypes.length === 0) return true;
    return !item.foodTypes.some(ft => eatenFoodTypes.has(ft));
  });

  const isLowRemaining = remainingLo < 500;

  // 감량일 때는 남은 칼로리가 충분하면 조금 든든한 식사(heavier)도 1개 포함
  const categoryPlan = {
    loss: isLowRemaining
      ? { light: 2, normal: 2, heavier: 0 }
      : { light: 2, normal: 1, heavier: 1 },
    maintain: { light: 1, normal: 2, heavier: 1 },
    gain: { light: 1, normal: 1, heavier: 2 },
  };
  const plan = categoryPlan[goal] || categoryPlan.maintain;

  const pickFromCategory = (cat, needed) => {
    const items = filteredPool
      .filter(item => item.category === cat)
      .sort((a, b) => {
        const aMid = (a.low + a.high) / 2;
        const bMid = (b.low + b.high) / 2;
        if (goal === 'loss') {
          const aFit = Math.abs(aMid - avgRemaining);
          const bFit = Math.abs(bMid - avgRemaining);
          return aFit - bFit;
        }
        if (goal === 'gain') return bMid - aMid;
        return 0;
      });
    const picked = [];
    for (const item of items) {
      if (picked.length >= needed) break;
      picked.push(item);
    }
    return picked;
  };

  const candidates = [];
  for (const cat of ['light', 'normal', 'heavier']) {
    const needed = plan[cat] || 0;
    if (needed > 0) {
      const picked = pickFromCategory(cat, needed);
      candidates.push(...picked);
    }
  }

  if (candidates.length < 4) {
    const usedNames = new Set(candidates.map(c => c.name));
    const fillCandidates = filteredPool
      .filter(item => !usedNames.has(item.name))
      .sort((a, b) => {
        const aMid = (a.low + a.high) / 2;
        const bMid = (b.low + b.high) / 2;
        if (goal === 'loss') {
          const aFit = Math.abs(aMid - avgRemaining);
          const bFit = Math.abs(bMid - avgRemaining);
          return aFit - bFit;
        }
        if (goal === 'gain') return bMid - aMid;
        return 0;
      });
    for (const item of fillCandidates) {
      if (candidates.length >= 4) break;
      candidates.push(item);
    }
  }

  return candidates.slice(0, 4).map((item) => {
    let note = item.note;
    if (goal === 'loss' && (item.low + item.high) / 2 > avgRemaining / 2) {
      note += " 남은 칼로리를 한 끼에 다 채우기보다 나눠 먹는 편이 좋아.";
    }
    if (isLowRemaining && (item.low + item.high) / 2 > remainingHi * 0.7) {
      note += " 남은 칼로리가 많지 않아서, 이걸 먹으면 꽤 찰 수 있어.";
    }
    return {
      name: item.name,
      rangeLow: item.low,
      rangeHigh: item.high,
      category: item.category,
      note: note,
    };
  });
}

function generateMealSuggestionsOriginal({ goal, remainingLo, remainingHi, foods = [], plannedFoodsResult = [] }) {
  const suggestions = [];
  const avgRemaining = (remainingLo + remainingHi) / 2;

  const light = [
    { name: "견과류 한 줌 (약 20~30g)", low: 120, high: 200, note: "간식" },
    { name: "사과 + 플레인 요거트", low: 150, high: 230, note: "가벼운 간식 느낌" },
    { name: "계란빵 1개", low: 200, high: 350, note: "간식·간편" },
    { name: "닭가슴살 샐러드 (드레싱 포함)", low: 300, high: 450, note: "가벼운 식사" },
  ];
  const normal = [
    { name: "참치김밥 1줄", low: 300, high: 500, note: "한 끼 부담 적은 편" },
    { name: "샌드위치 (일반 햄/참치 등)", low: 350, high: 500, note: "한 끼로 무난한 편" },
  ];
  const heavier = [
    { name: "소고기 김밥 1줄", low: 400, high: 600, note: "제법 포만감" },
    { name: "치즈돈까스 작은 조각 (약 2~3조각)", low: 400, high: 650, note: "고열량, 나눠 먹기" },
  ];

  const pickFrom = (arr, count) => {
    const picked = [];
    for (const item of arr) {
      if (picked.length >= count) break;
      picked.push(item);
    }
    return picked;
  };

  if (goal === 'loss') {
    const first = pickFrom(
      [...light].sort((a, b) => (a.low + a.high) - (b.low + b.high)),
      2
    );
    const second = pickFrom(
      [...normal].sort((a, b) => (a.low + a.high) - (b.low + b.high)),
      2
    );
    suggestions.push(...first, ...second);
  } else if (goal === 'gain') {
    const all = [
      ...light,
      ...normal,
      ...heavier,
    ].sort((a, b) => (b.low + b.high) - (a.low + a.high));
    suggestions.push(...pickFrom(all, 4));
  } else {
    const all = [...light, ...normal, ...heavier];
    suggestions.push(...pickFrom(all, 4));
  }

  return suggestions.slice(0, 4).map((item) => ({
    name: item.name,
    rangeLow: item.low,
    rangeHigh: item.high,
    note:
      item.note +
      (goal === "loss" && (item.low + item.high) / 2 > avgRemaining / 2
        ? " 남은 칼로리를 한 끼에 다 채우기보다 나눠 먹는 편이 좋아."
        : ""),
  }));
}


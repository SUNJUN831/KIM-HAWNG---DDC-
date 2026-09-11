import 'dotenv/config';
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

  const { profile, activityLevel, eatenFoods, plannedFoods } = body;

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

  // Solar Pro 4 한 번 호출: 음식 해석 + 전략 + 추천 음식
  const analysisResult = await analyzeWithSolar({
    profile,
    activityLevel,
    eatenFoods,
    plannedFoods,
    bmrRaw,
    todayConsumptionRaw,
    targetCaloriesRaw
  });
  if (!analysisResult || analysisResult.error) {
    return res.status(500).json({ error: '분석 실패: ' + (analysisResult?.error || '알 수 없는 오류') });
  }

  const foods = analysisResult.foods || [];
  const plannedFoodsResult = analysisResult.plannedFoods || [];
  const strategy = analysisResult.strategy || '계산된 전략이 없어요.';
  const recommendedFoods = analysisResult.recommendedFoods || [];

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
    recommendedFoods
  });
}

// 음식 해석 + 전략 + 추천 음식을 한 번에 Solar Pro 4 호출
async function analyzeWithSolar({ profile, activityLevel, eatenFoods, plannedFoods, bmrRaw, todayConsumptionRaw, targetCaloriesRaw }) {
  const apiKey = process.env.UPSTAGE_API_KEY;
  if (!apiKey) {
    return { error: 'UPSTAGE_API_KEY가 설정되지 않았어요.' };
  }

  const goalLabel = profile.goal === 'loss' ? '감량' : profile.goal === 'maintain' ? '유지' : '증량';
  const activityLabel = activityLevel === 1.2 ? '거의 활동 없음' :
    activityLevel === 1.375 ? '낮음' :
    activityLevel === 1.55 ? '보통' :
    activityLevel === 1.725 ? '높음' : '매우 높음';

  const allFoods = [...eatenFoods, ...plannedFoods];
  const isEaten = eatenFoods.map(() => true).concat(plannedFoods.map(() => false));

  const userMessage = `다음 정보를 바탕으로 두 작업을 한 번에 수행해줘.
응답은 JSON 객체 하나로만 반환해: { "foods": [ ... ], "strategy": "...", "recommendedFoods": [ ... ] }

## 1) 음식 칼로리 추정
음식 목록을 보고 각 음식의 추정 칼로리 범위(하한~상한, kcal 단위)를 알려줘.
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
- 일반적인 1인분 기준, Recipe·양·브랜드에 따라 달라지면 그 점을 note에 적어.
- 양을 알 수 없는 애매한 표현이면 calLow와 calHigh를 넉넉하게 잡고 note에 "추정"이라고 적어.
- 한식·육류·간식 등 일반적인 음식 참조를 사용해.
- 명확히 불가능한 음식(예: 음식이 아닌 것)이 있으면 calLow=0, calHigh=0, note="추정 불가"로 해.

음식 목록: ${allFoods.map((f, i) => `${isEaten[i] ? '[먹은]' : '[예정]'} ${f}`).join('\n')}

## 2) 오늘 하루 식사 전략
다음 정보를 바탕으로 오늘 하루 식사 전략을 작성해줘.
- strategy: 한국어로, 친절하고 실용적인 코치 톤. 너무 길지 않게 한 단락~두 단락.
- recommendedFoods: 오늘 목표·남은 칼로리·식단에 맞는 음식 4개 정도. 각각 name, qty, calLow, calHigh 포함.
  - name: 음식 이름 (한국어)
  - qty: 추천 양 (예: "1공기", "200g", "1인분" 등)
  - calLow: 추정 하한 kcal
  - calHigh: 추정 상한 kcal
  - 실제 정확한 값이 아니라 일반적인 추정 범위여도 됨.

전략 텍스트 규칙:
- "아침·점심 굶으세요" 같은 극단적 제안 금지.
- "남은 calories 많다고 지금 다 먹자" 식이 아니라, 남은 끼니의 균형을 제안하는 방식.
- 음식이 남는다고 더 먹으라고 권하지 말고, 무리하지 않게 조절하되 과도한 제한은 피하라는 톤.
- 오늘 운동량이 많으면 식사 구성을 확인하라는 정도 언급.
- 과식 위험·균형 관점에서 체크 포인트 1~2개 제시.
- 모든 수치에는 "약"을 붙이고, 범위 추정 시 "~ kcal" 사용. 단정 표현 금지.
- 소비·음식 칼로리가 추정치라는 점을 한 번만 언급하면서 자연스럽게 녹일 것.

정보:
- 성별: ${profile.gender === 'male' ? '남성' : '여성'}
- 나이: ${profile.age}세
- 키: ${profile.height}cm
- 체중: ${profile.weight}kg
- 목표: ${goalLabel}
- 오늘 활동 강도: ${activityLabel} (활동계수 ${activityLevel})
- 기초대사량(BMR, 원값): 약 ${Math.round(bmrRaw)} kcal
- 오늘 예상 소비칼로리(BMR 원값 × 활동계수): 약 ${Math.round(todayConsumptionRaw)} kcal
- 오늘 목표 섭취칼로리: 약 ${Math.round(targetCaloriesRaw)} kcal (${goalLabel})

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
          { role: 'system', content: '너는 음식 칼로리 추정 전문가이자 오늘 하루 식단 코치야. 요청은 두 가지야: (1) 음식별 칼로리 범위 추정 JSON 배열, (2) 오늘 식사 전략 텍스트. 응답은 JSON 객체 하나로만 해: { "foods": [ ... ], "strategy": "...", "recommendedFoods": [ ... ] }. 항상 추정치/범위만 제시하고 정확한 값이라 단정하지 마.' },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 3072
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
      // JSON 파싱 실패 시, 텍스트 조각으로 전략만 살리기
      return {
        foods: [],
        plannedFoods: [],
        strategy: jsonStr.slice(0, 2000),
        recommendedFoods: []
      };
    }

    // foods 파싱
    const rawFoods = Array.isArray(parsed.foods) ? parsed.foods : [];
    const foods = [];
    const plannedFoodsResult = [];
    for (const item of rawFoods) {
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

    // 전략 파싱
    let strategy = '';
    if (typeof parsed.strategy === 'string' && parsed.strategy.trim()) {
      strategy = parsed.strategy.trim();
    } else {
      strategy = '계산된 전략이 없어요.';
    }

    // 추천 음식 파싱
    const rawRec = Array.isArray(parsed.recommendedFoods) ? parsed.recommendedFoods : [];
    const recommendedFoods = rawRec.map(f => ({
      name: f.name || '추천 음식',
      qty: f.qty || '',
      calLow: typeof f.calLow === 'number' ? f.calLow : 0,
      calHigh: typeof f.calHigh === 'number' ? f.calHigh : 0,
      note: f.note || '',
      isPlanned: false
    }));

    return { foods, plannedFoods: plannedFoodsResult, strategy, recommendedFoods };
  } catch (e) {
    return { error: 'Solar 호출 중 오류: ' + e.message };
  }
}

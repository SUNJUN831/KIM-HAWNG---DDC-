// Solar Pro 4 호출 모듈
// 프롬프트 조립 + fetch 담당. calculate.js는 데이터만 넘겨서 결과에 집중.

const SOLAR_MODEL = 'solar-pro4';
const SOLAR_URL = 'https://api.upstage.ai/v1/chat/completions';

function getApiKey() {
  return process.env.UPSTAGE_API_KEY;
}

// ---------- 음식 해석 프롬프트 ----------

function buildFoodInterpretationPrompt(eatenFoods, plannedFoods) {
  const allFoods = [...eatenFoods, ...plannedFoods];
  const isEaten = eatenFoods.map(() => true).concat(plannedFoods.map(() => false));

  const foodLines = allFoods
    .map((f, i) => `${isEaten[i] ? '' : '[예정] '}${f}`)
    .join('\n');

  return `다음 음식 목록을 보고 각 음식의 추정 칼로리 범위(하한~상한, kcal 단위)를 알려줘.
응답은 JSON 배열로만 반환해. 다른 설명은 넣지 마.
각 항목은 다음 형식이야:
{
  "name": "음식명",
  "qty": "양/단위 (자연어 그대로)",
  "calLow": 숫자 (하한 kcal),
  "calHigh": 숫자 (상한 kcal),
  "note": "참고 문구 (있다면, 없으면 생략)",
  "isPlanned": boolean (예정 음식이면 true, 먹은 음식이면 false),
  "mealType": "breakfast" | "lunch" | "dinner" | "snack" | "planned"
}

mealType 규칙:
- 각 먹은 음식 앞에 [breakfast], [lunch], [dinner], [snack] 중 하나의 태그를 붙여 전달했어. 해당 태그는 그 음식이 속한 끼니를 의미해.
- 먹은 음식의 mealType은 전달받은 태그와 동일한 값("breakfast", "lunch", "dinner", "snack")으로 설정해.
- 예정 음식은 mealType을 "planned"로 해.
- 태그가 애매하면 mealType을 "planned"로 해.

규칙:
- calories는 추정치/범위로만 제시. 정확한 값이라 단정하지 마.
- 일반적인 1인분 기준, 레시피·양·브랜드에 따라 달라지면 그 점을 note에 적어.
- 양을 알 수 없는 애매한 표현이면 calLow와 calHigh를 넉넉하게 잡고 note에 "추정"이라고 적어.
- 한식·육류·간식 등 일반적인 음식 참조를 사용해.
- 명확히 불가능한 음식(예: 음식이 아닌 것)이 있으면 calLow=0, calHigh=0, note="추정 불가"로 해.

음식 목록:
${foodLines}

결과 JSON만 반환해.`;
}

// ---------- 식사 전략 프롬프트 ----------

function buildStrategyPrompt(context) {
  const goalLabel = context.profile.goal === 'loss' ? '감량' : context.profile.goal === 'maintain' ? '유지' : '증량';
  const activityLabel =
    context.activityLevel === 1.2 ? '거의 활동 없음' :
    context.activityLevel === 1.375 ? '낮음' :
    context.activityLevel === 1.55 ? '보통' :
    context.activityLevel === 1.725 ? '높음' : '매우 높음';

  return `다음 정보를 바탕으로 오늘 하루 식사 전략을 작성해줘.
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
}

// ---------- Solar 공통 호출 ----------

async function solarChat(messages, temperature = 0.7, maxTokens = 2048) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { error: 'UPSTAGE_API_KEY가 설정되지 않았어요.' };
  }

  try {
    const response = await fetch(SOLAR_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: SOLAR_MODEL,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
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
    return { content };
  } catch (e) {
    return { error: 'Solar 호출 중 오류: ' + e.message };
  }
}

// ---------- 공개 함수 ----------

/**
 * 먹은 음식 + 예정 음식 목록을 Solar에 넘겨 칼로리 범위 해석.
 * eatenFoods: [ "{mealTag}: 음식명 양", ... ]  (mealTag = breakfast/lunch/dinner/snack)
 * plannedFoods: [ "예정 음식명 양", ... ]
 * 반환: { foods: [...], plannedFoods: [...] } 또는 { error: "..." }
 */
async function interpretFoodsWithSolar(eatenFoods, plannedFoods) {
  const userMessage = buildFoodInterpretationPrompt(eatenFoods, plannedFoods);

  const result = await solarChat([
    {
      role: 'system',
      content: '너는 음식 칼로리 추정 전문가야. 항상 kcal 추정치로 범위만 제시하고, 정확한 값이라 단정하지 마. 응답은 JSON 배열로만 해.',
    },
    { role: 'user', content: userMessage },
  ]);

  if (result.error) return { error: result.error };

  // JSON만 파싱 시도 (마크다운 코드 블록이 섞여 있을 수 있음)
  let jsonStr = result.content.trim();
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
    const mealType = item.mealType || 'breakfast';
    const entry = { name, qty, calLow, calHigh, note, isPlanned, mealType };
    if (isPlanned) {
      plannedFoodsResult.push(entry);
    } else {
      foods.push(entry);
    }
  }

  return { foods, plannedFoods: plannedFoodsResult };
}

/**
 * 식사 전략 생성. context에 수치·음식 목록을 담아 넘기면 Solar가 전략 텍스트를 반환.
 * 반환: { strategy: "..." }
 */
async function generateStrategyWithSolar(context) {
  const userMessage = buildStrategyPrompt(context);

  const result = await solarChat([
    {
      role: 'system',
      content: '너는 오늘 하루 식단 코치야. 항상 친절하고 실용적인 톤으로, 극단적 제안 없이 균형 전략을 제시해. 응답은 JSON 객체 하나로만 해: { "strategy": "텍스트" }',
    },
    { role: 'user', content: userMessage },
  ]);

  if (result.error) {
    return { strategy: result.error };
  }

  // JSON만 파싱 시도
  let jsonStr = result.content.trim();
  if (jsonStr.startsWith('```')) {
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) jsonStr = match[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed.strategy === 'string') {
      return { strategy: parsed.strategy };
    }
  } catch {
    // JSON 파싱 실패 시 텍스트 그대로 사용 (최선의 추정)
    return { strategy: jsonStr.slice(0, 2000) };
  }

  return { strategy: jsonStr.slice(0, 2000) };
}

export { interpretFoodsWithSolar, generateStrategyWithSolar };

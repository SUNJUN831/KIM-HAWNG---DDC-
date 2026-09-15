// Solar Pro 4 — 음식 해석 모듈
// 먹은 음식 / 예정 음식 목록 → 추정 칼로리 범위 + 탄단지(g)

import { solarChat } from './solar-base.js';

function buildFoodInterpretationPrompt(eatenFoods, plannedFoods) {
  const allFoods = [...eatenFoods, ...plannedFoods];
  const isEaten = eatenFoods.map(() => true).concat(plannedFoods.map(() => false));

  const foodLines = allFoods
    .map((f, i) => `${isEaten[i] ? '' : '[예정] '}${f}`)
    .join('\\n');

  return `다음 음식 목록을 보고 각 음식의 추정 칼로리 범위(하한~상한, kcal 단위)와 탄단지 비중을 그램(g) 단위로 알려줘.

탄단지 비중은 각 음식의 일반적인 1인분 기준 추정 그램(g)으로 제시하고, 대략적인 추정값을 제시해줘.

응답은 JSON 배열로만 반환해. 다른 설명은 넣지 마.
각 항목은 다음 형식이야:
{
  "name": "음식명",
  "qty": "양/단위 (자연어 그대로)",
  "calLow": 숫자 (하한 kcal),
  "calHigh": 숫자 (상한 kcal),
  "prot_g": 숫자 (단백질 g estimat),
  "fat_g": 숫자 (지방 g estimat),
  "carbs_g": 숫자 (탄수화물 g estimat),
  "note": "참고 문구 (있다면, 없으면 생략)",
  "isPlanned": boolean (예정 음식이면 true, 먹은 음식이면 false),
  "mealType": "breakfast" | "lunch" | "dinner" | "snack" | "planned"
}

탄단지 그램 추정 규칙:
- 각 음식의 1인분 기준으로, 대략 몇 g 정도의 단백질/지방/탄수화물이 들어있을지 추정해.
- 한식·육류·간식 등 일반적인 음식 조성을 기준으로 대략적인 값을 잡아.
  - 삼겹살 구이: 지방 높음, 단백질 보통 → fat_g 높음, prot_g 보통
  - 닭가슴살/두부/계란: 단백질 높음 → prot_g 높음
  - 라면/파스타/빵/밥: 탄수화물 높음 → carbs_g 높음
  - 튀김류: 지방 높음
  - 나물/샐러드: 탄수화물·단백질 위주, 지방 낮음
  - 유제품·치즈: 지방+단백질
  - 디저트·케이크·과자: 탄수화물+지방
- 정확한 조성 분석이 아니라 대략적인 추정치를 제시하고, 불확실하면 note에 "추정"이라고 적어.
- 애매한 음식이면 calLow와 calHigh를 넉넉하게 잡고 note에 "추정"이라고 적어.

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

export async function interpretFoodsWithSolar(eatenFoods, plannedFoods) {
  const userMessage = buildFoodInterpretationPrompt(eatenFoods, plannedFoods);

  const result = await solarChat([
    {
      role: 'system',
      content: '너는 음식 칼로리 추정 전문가야. 항상 kcal 추정치로 범위만 제시하고, 정확한 값이라 단정하지 마. 응답은 JSON 배열로만 해.',
    },
    { role: 'user', content: userMessage },
  ]);

  if (result.error) return { error: result.error };

  console.log('[DDC] Solar raw 응답 (interpret):', result.content.slice(0, 1000));
  let jsonStr = result.content.trim();
  if (jsonStr.startsWith('```')) {
    const match = jsonStr.match(/```(?:json)?\\s*([\\s\\S]*?)```/);
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
    const protG = typeof item.prot_g === 'number' ? item.prot_g : 0;
    const fatG = typeof item.fat_g === 'number' ? item.fat_g : 0;
    const carbsG = typeof item.carbs_g === 'number' ? item.carbs_g : 0;
    const entry = { name, qty, calLow, calHigh, note, isPlanned, mealType, prot_g: protG, fat_g: fatG, carbs_g: carbsG };
    if (isPlanned) {
      plannedFoodsResult.push(entry);
    } else {
      foods.push(entry);
    }
  }

  return { foods, plannedFoods: plannedFoodsResult };
}

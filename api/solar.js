// Solar Pro 4 호출 모듈
// 프롬프트 조립 + fetch 담당. calculate.js는 데이터만 넘겨서 결과에 집중.

const SOLAR_MODEL = 'solar-pro4';
const SOLAR_URL = 'https://api.upstage.ai/v1/chat/completions';

function getApiKey() {
  return process.env.UPSTAGE_API_KEY;
}

// ---------- 음식 해석 프롬프트 (정상 복구) ----------

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

// ---------- 식사 전략 프롬프트 (전략 + 추천 음식 동시 요청) ----------

function buildStrategyPrompt(context) {
  const goalLabel = context.profile.goal === 'loss' ? '감량' : context.profile.goal === 'maintain' ? '유지' : '증량';
  const activityLabel =
    context.activityLevel === 1.2 ? '거의 활동 없음' :
    context.activityLevel === 1.375 ? '낮음' :
    context.activityLevel === 1.55 ? '보통' :
    context.activityLevel === 1.725 ? '높음' : '매우 높음';

  // 남은 칼로리 중간값(잔여 구간 중간값) — 추천 총량 기준
  const remainingAvg = Math.round((context.remainingLo + context.remainingHi) / 2);
  const currentIntakeAvg = Math.round((context.currentIntakeLo + context.currentIntakeHi) / 2);

  // 구간 판정
  let bandLabel;
  if (remainingAvg < 500) {
    bandLabel = '500 kcal 미만 구간 — 가벼운 간식이나 부담 없는 식사로 마무리';
  } else if (remainingAvg < 1200) {
    bandLabel = '500~1,200 kcal 구간 — 균형 잡힌 정식 한 끼나 알찬 구성으로 남은 양 채우기';
  } else {
    bandLabel = '1,200 kcal 이상 구간 — 하루 전체 분량이 많이 남았으므로 여러 끼니로 나누어 구성';
  }

  return `다음 정보를 바탕으로 오늘 하루 식사 전략을 작성해줘.
응답은 반드시 아래 JSON 객체 하나로만 반환해 (마크다운 코드블록이나 다른 설명 금지):

{
  "strategy": "전략 텍스트 (한~두 단락)"
}

===== 핵심 규칙 =====
- "아침·점심 굶으세요" 같은 극단적 제안 금지.
- 음식이 남는다고 더 먹으라고 권하지 말고, 무리하지 않게 조절하되 과도한 제한은 피하라는 톤.
- 이미 먹은 음식 목록에 있는 메뉴와 겹치지 않는 새로운 종류의 식단 방향성을 언급.
- "현재 추정치상 오늘 목표를 초과할 가능성은 낮아/높아" 같은 비교 표현을 자연스럽게 녹여낼 것.
- 과식 위험 및 영양 균형 관점에서 체크 포인트 1~2개 제시.
- 모든 수치에는 "약"을 붙이고, 범위 추정 시 "~ kcal" 사용.

===== 잔여 칼로리 구간별 구성 =====
${remainingAvg < 700
  ? '- 500 kcal 미만 구간: 가벼운 간식이나 부담 없는 식사로 마무리하는 내용 포함.'
  : remainingAvg >= 700 && remainingAvg < 1200
    ? '- 500~1,200 kcal 구간: 균형 잡힌 정식 한 끼나 알찬 구성으로 남은 양 채우는 내용 포함.'
    : '- 1,200 kcal 이상 구간: 하루 전체 분량이 많이 남았으므로 여러 끼니로 나누어 구성하는 내용 포함.'}

===== 사용자 정보 =====
- 성별: ${context.profile.gender === 'male' ? '남성' : '여성'}
- 나이: ${context.profile.age}세
- 키: ${context.profile.height}cm
- 체중: ${context.profile.weight}kg
- 목표: ${goalLabel}
- 오늘 활동 강도: ${activityLabel} (활동계수 ${context.activityLevel})
- 기초대사량(BMR): 약 ${Math.round(context.bmrRaw)} kcal
- 오늘 예상 소비칼로리: 약 ${Math.round(context.todayConsumptionRaw)} kcal
- 오늘 목표 섭취칼로리: 약 ${Math.round(context.targetCaloriesRaw)} kcal (${goalLabel})
- 현재 섭취 추정치: 약 ${Math.round(context.currentIntakeLo)}~${Math.round(context.currentIntakeHi)} kcal (중간값 약 ${currentIntakeAvg} kcal)
- 남은 칼로리 범위: 약 ${Math.round(context.remainingLo)}~${Math.round(context.remainingHi)} kcal (중간값 약 ${remainingAvg} kcal)
- 먹은 음식: ${context.foods.map(f => `${f.name} ${f.qty ? '('+f.qty+')' : ''}`).join(', ') || '없음'}
- 예정 음식: ${context.plannedFoodsResult.map(f => `${f.name} ${f.qty ? '('+f.qty+')' : ''}`).join(', ') || '없음'}
|- 예정 식사 판단: ${context.plannedComparison || '예정 음식 없음'}
- 생활 패턴: ${context.lifestylePatterns && context.lifestylePatterns.length > 0
    ? context.lifestylePatterns.map(p => `- ${p}`).join('\n')
    : '- 현재 생활패턴이 적혀있지 않아요. (생활 패턴을 입력하면 더 맞춤화된 조언을 받을 수 있어요.)'}

결과 JSON만 반환해.
`;
}

// ---------- Solar 공통 호출 ----------

async function solarChat(messages, temperature = 0.7, maxTokens = 2048) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { error: 'UPSTAGE_API_KEY가 설정되지 않았어요.' };
  }

  try {
    const requestBody = JSON.stringify({
      model: SOLAR_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
    });
    console.log('[DDC] Solar 요청 body:', requestBody.slice(0, 2000));

    const response = await fetch(SOLAR_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: requestBody,
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

  console.log('[DDC] Solar raw 응답 (interpret):', result.content.slice(0, 1000));
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

async function generateStrategyWithSolar(context) {
  const userMessage = buildStrategyPrompt(context);

  const result = await solarChat([
    {
      role: 'system',
      content: '너는 오늘 하루 식단 코치야. 항상 친절하고 실용적인 톤으로 균형 전략과 추천 식단을 제시해. 응답은 반드시 지정된 JSON 객체 하나로만 해.',
    },
    { role: 'user', content: userMessage },
  ]);

  if (result.error) {
    return { strategy: result.error, recommendedFoods: [] };
  }

  console.log('[DDC] Solar raw 응답 (strategy):', result.content.slice(0, 1000));
  let jsonStr = result.content.trim();
  if (jsonStr.startsWith('```')) {
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) jsonStr = match[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      strategy: typeof parsed.strategy === 'string' ? parsed.strategy : '전략을 생성하지 못했어요.',
      recommendedFoods: Array.isArray(parsed.recommendedFoods) ? parsed.recommendedFoods : []
    };
  } catch {
    return { strategy: jsonStr.slice(0, 2000), recommendedFoods: [] };
  }
}

export { interpretFoodsWithSolar, generateStrategyWithSolar };

// ---------- 후보 풀에서 Solar가 중복 없이 고르는 함수 ----------

const BANCHAN_CODES = new Set(['11', '13', '14', '15', '16', '17', '18']);

async function buildSelectFoodsPrompt(candidates, remainingAvg, remainingLo, remainingHi, count, foodHistory = [], solarHint = '') {
  const hasBanchans = candidates.some((c) => BANCHAN_CODES.has(c.code));
  const foodLines = candidates
    .map((c) => {
      const catInfo = c.category ? ` [${c.category}]` : '';
      return `- ${c.displayName}${catInfo} | 약 ${c.calActual} kcal | 코드: ${c.code}`;
    })
    .join('\n');

  return `다음 음식 후보 목록을 보고, 아래 조건에 맞게 ${count}개를 골라줘.

===== 조건 =====
- 반환할 음식은 정확히 ${count}개여야 해 (4개 미만으로 응답하면 안 돼).
- 비슷한 계열(예: 닭볶음/닭발볶음/닭모래집볶음 같은 닭 요리, 죽·스프 여러 개, 구이류 여러 개, 면류 여러 개)은 하나만 남기고, 서로 다른 카테고리에서 골고루 포함해줘.
- 같은 음식군이 여러 개 후보에 있으면 그중 가장 일반적으로 많이 먹는 대표 음식 하나만 남기고 나머지는 제외해. 음식군 예시:
  - 튀김류: 닭껍데기튀김, 김튀김, 뱅어포튀김, 닭발튀김, 닭다리튀김 등 → 하나만 (예: 닭다리튀김)
  - 볶음류: 제육볶음, 오징어볶음, 김치볶음 등 → 하나만
  - 구이류: 삼겹살구이, 닭구이, 고등어구이, 갈매기살구이 등 → 하나만
  - 전류: 김치전, 호박전, 파전, 동태전, 새우전 등 → 하나만
  - 무침류: 시금치무침, 콩나물무침, 도라지무침 등 → 하나만
  - 절임류/장아찌류/조림류: 각각 하나씩만
  - 국·탕류: 닭백숙,갈비탕,삼계탕,꼬리곰탕 등 → 하나만
  - 찌개류: 김치찌개,된장찌개,청국장찌개 등 → 하나만
  - 라면·국수·냉면류: 각각 하나만
  - 죽·스프류: 각각 하나만
  - 샐러드류: 하나
- 남은 칼로리가 600 이상인 경우:
  - 반드시 밥류가 1개 이상 포함되어야 해.
  - 팝콘, 견과, 음료 및 차류, 과일류, 유제품 및 빙과류, 간식류 등 배부름과 무관한 간식·디저트 카테고리는 절대 선택하지 마.
  - 각 항목이 그 자체로 완전한 한 끼 메뉴가 될 수 있는 독립적인 음식으로 골라줘. 밥+찌개+반찬처럼 일부만 부분적으로 뽑는 게 아니라, 각 음식이 충분한 분량과 칼로리를 가진 하나의 메뉴로 구성되어야 해.
  - 구이류(고기·생선 등을 구운 것)가 포함되면, 밥과 함께 먹는 구성으로 자연스럽게 묶일 수 있지만, 다른 항목들은 별도 메인 메뉴로 독립성 있게 골라줘.
- 가능하면 일반적으로 많이 먹는 음식 위주로 선택해. 조림류·젓갈류·장아찌·절임류·김치류 등 호불호 강한 음식 단독보다는, 구이류·국/탕류·면류·밥류·만두·스프·찜·볶음·샐러드·튀김류 등 대중적인 메뉴를 우선해.
- 이름은 반드시 아래 후보 목록에 표시된 이름(displayName) 그대로 사용해. 절대 다른 이름으로 바꾸거나 새로 만들지 말고, 목록에 있는 이름 중 하나를 그대로 name으로 반환해야 해. 예를 들어 목록에 "닭발볶음"이 있으면 "닭볶음"으로 바꾸지 말고 "닭발볶음"을 그대로 쓰고, "비빔면 매콤제육비빔면"이 있으면 "비빔면"으로 줄이지 말고 전체 이름을 그대로 사용해.
- 각 후보의 원래 1인분 중량(g)이 다음과 같이 제공돼. 이 정보를 참고해서 qty를 자연스러운 표현으로 제시해줘. (예: 210g이면 "1공기", 350g이면 "1인분", 130g이면 "1접시" 등) 원정보에 없는 경우 추정하지 말고 qty는 자유롭게 정해.
- **칼로리(calLow/calHigh)는 네가 추정하지 말고, 서버가 DB 실제값으로 채워줘.** 너는 각 음식의 name, qty, note, mealType만 결정해서 반환해. 서버는 DB에서 가져온 실제 칼로리(calActual)를 calLow/calHigh에 넣어줄 거야.
- 선택 항목 간 중복을 피하되, 각 음식이 약 ${remainingAvg} kcal 전후(±150 kcal) 범위에서 충분히 의미 있는 포만감을 주는 메뉴로 구성해줘. 총합이 남은 칼로리를 초과할 수 있지만, 각 메뉴가 부실한 것보다는 낫다.

===== 후보 목록 =====
${foodLines}
${solarHint ? `\n===== 식단 힌트 (참고만 하세요) =====\n${solarHint}\n` : ''}

===== 응답 형식 =====
응답은 반드시 아래 JSON 배열 하나로만 반환해 (마크다운 코드블록이나 다른 설명 금지):

[
  {
    "name": "음식명 (간결한 foodLv4Nm 기준, 예: 팟타이, 삼겹살구이, 나베 등)",
    "qty": "양 (예: 200g, 1인분, 1그릇 등)",
    "calLow": 숫자 (kcal 하한),
    "calHigh": 숫자 (kcal 상한),
    "note": "간단 메모 (있다면)",
    "mealType": "dinner" | "snack"
  }
]

규칙:
- calLow와 calHigh는 네가 추정하지 마. 서버가 DB 실제값(calActual)을 넣어줄 거야.
- 결과는 바로 JSON 배열로만 줘. 다른 설명은 넣지 마.
`;
}

async function selectDiverseFoodsWithSolar(candidates, remainingAvg, remainingLo, remainingHi, count, foodHistory = [], solarHint = '') {
  if (!candidates || candidates.length === 0 || count < 1) return [];

  const useCount = count;
  const userMessage = await buildSelectFoodsPrompt(candidates, remainingAvg, remainingLo, remainingHi, useCount, foodHistory, solarHint);

  const result = await solarChat([
    {
      role: 'system',
      content: '너는 식단 추천 전문가야. 다양한 카테고리에서 골고루 음식을 골라주고, 비슷한 계열 음식은 중복하지 않아. 응답은 반드시 유효한 JSON 배열로만 해.',
    },
    { role: 'user', content: userMessage },
  ]);

  if (result.error) {
    console.log('[DDC] Solar selectDiverseFoods 오류:', result.error);
    // Solar 실패 시 fallback: 기존에는 candidates 중 앞에서 count개 반환
    return candidates.slice(0, count).map((c) => {
      const calActual = c.calActual != null ? c.calActual : (c.calLow || 0);
      const displayName = c.displayName || c.category || c.name;
      return {
        name: displayName,
        qty: c.qty,
        calLow: calActual,
        calHigh: calActual,
        note: buildNotePlain({ category: c.category, calLow: calActual }),
        isPlanned: false,
        mealType: 'dinner',
      };
    });
  }

  console.log('[DDC] Solar raw 응답 (selectDiverseFoods):', result.content.slice(0, 1000));
  let jsonStr = result.content.trim();
  if (jsonStr.startsWith('```')) {
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) jsonStr = match[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) throw new Error('배열이 아님');
    // Solar가 foodLv4Nm 기준 간결한 name으로 응답 → 원본 candidates에서 매칭하여 code 보존
    return parsed.map((item) => {
      const foodLv4Nm = (item.name || '').trim();
      const nameWords = foodLv4Nm.split(/\s+/).filter(Boolean);
      const firstWord = nameWords[0] || '';
      // 1차: 정확한 displayName 일치
      let matched = candidates.find((c) => c.displayName === foodLv4Nm);
      // 2차: 포함 관계 (Solar가 간략화한 이름도 매칭)
      if (!matched) {
        matched = candidates.find((c) =>
          c.displayName.includes(foodLv4Nm) || foodLv4Nm.includes(c.displayName)
        );
      }
      // 3차: category/name 기준 매칭
      if (!matched) {
        matched = candidates.find((c) =>
          c.category === foodLv4Nm || c.name === foodLv4Nm
        );
      }
      // 4차: 단어 기반 fuzzy — 첫 단어 또는 nameWords 중 하나로 match, 접미사 키워드 포함
      if (!matched && firstWord) {
        matched = candidates.find((c) => {
          const dname = c.displayName.toLowerCase();
          const fn = firstWord.toLowerCase();
          // 첫 단어로 시작하거나 접미사 구분자 기준 앞부분 일치, 또는 dname이 fn을 포함
          return dname.startsWith(fn) || dname.includes(fn) ||
            c.displayName.split(/[\s_·]+/).some(w => w.toLowerCase() === fn);
        });
      }
      // DB 매칭된 calActual을 calLow/calHigh에 사용 (LLM 추정 대신 DB 실제값)
      const calActual = matched && matched.calActual != null ? matched.calActual : 0;
      // qty에 gram 정보 추가 (후보의 foodSize 활용) — "1인분(180g)" 형태
      const qty = matched && matched.foodSize != null
        ? `${item.qty || '1인분'} (${matched.foodSize}g)`
        : item.qty || '';
      return {
        name: matched ? matched.displayName : (foodLv4Nm || '알 수 없음'),
        qty: qty,
        calLow: calActual,
        calHigh: calActual,
        note: item.note || (matched && matched.category ? `${matched.category} 계열` : ''),
        isPlanned: false,
        mealType: item.mealType || 'dinner',
        code: matched ? matched.code : '',
      };
    });
  } catch (e) {
    console.log('[DDC] Solar selectDiverseFoods 파싱 실패:', e.message);
    // 파싱 실패 시 fallback: candidates 앞에서 count개 채움 (매칭 실패해도 빈 슬롯 방지용)
    return candidates.slice(0, count).map((c) => {
      const calActual = c.calActual != null ? c.calActual : (c.calLow || 0);
      const displayName = c.displayName || c.category || c.name;
      const qty = c.foodSize != null ? `${c.qty || '1인분'} (${c.foodSize}g)` : c.qty || '';
      return {
        name: displayName,
        qty: qty,
        calLow: calActual,
        calHigh: calActual,
        note: buildNotePlain({ category: c.category, calLow: calActual }),
        isPlanned: false,
        mealType: 'dinner',
      };
    });
  }
}

function buildNotePlain(p) {
  const categoryPart = p.category ? `${p.category} · ` : '';
  return `${categoryPart}약 ${p.calLow} kcal (공공 DB 기준)`;
}

export { selectDiverseFoodsWithSolar, buildNotePlain };

// Solar Pro 4 — 식사 전략 모듈
// 오늘 하루 식단 전략 텍스트 생성 (JSON 구조: { strategy } )

import { solarChat } from './solar-base.js';

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
- 생활 패턴이 있으면 그에 맞춰 현실적인 조언을 구체적으로 포함해:
  - "저녁 회식 예정" 또는 "회식"이 있으면: 알코올 섭취 가능성이 높으니 과식·과음 주의, 기름진 안주 대신 채소·단백질 위주 선택, 다음 날 해장을 위해 물 충분히 마시고 가벼운 식사 권장.
  - "야근"이 많거나 "늦게까지 일"이 있으면: 늦게 먹을 가능성이 높으니 미리 간편식이나 준비 쉬운 음식(김밥, 샐러드, 도시락 등)을 고려하고, 늦은 시간에는 가벼운 음식으로 마무리 권장.
  - "러닝" 또는 "운동"이 있으면: 운동 후 단백질 보충이 중요하니 닭가슴살, 계란, 두부, 생선 등 단백질 음식 언급. 운동 전 가벼운 탄수화물도 고려.
  - 그 외 생활패턴이 있으면 그에 맞춰 현실적인 팁을 1개 이상 포함할 것.

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
- 예정 식사 판단: ${context.plannedComparison || '예정 음식 없음'}
- 생활 패턴: ${context.lifestylePatterns && context.lifestylePatterns.length > 0
    ? context.lifestylePatterns.map(p => `- ${p}`).join('\\n')
    : '- 현재 생활패턴이 적혀있지 않아요. (생활 패턴을 입력하면 더 맞춤화된 조언을 받을 수 있어요.)'}

결과 JSON만 반환해.
`;
}

export async function generateStrategyWithSolar(context) {
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
    const match = jsonStr.match(/```(?:json)?\\s*([\\s\\S]*?)```/);
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

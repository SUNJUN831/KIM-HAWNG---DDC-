// test-meal-suggestions.js — 추천 음식 로직 로컬 검증
// Solar 호출 없이 순수 로직만
// (UPSTAGE_API_KEY 없어도 해석/전략 단계 전에 로직 분기 확인 가능)

import handler from './api/calculate.js';

function makeMockRes() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
    end() {}
  };
}

async function run(label, body) {
  const req = { method: 'POST', body };
  const res = makeMockRes();
  try {
    await handler(req, res);
  } catch (e) {
    console.log(`\n=== ${label} (예외) ===`);
    console.log('오류:', e.message);
    return;
  }
  console.log(`\n=== ${label} ===`);
  console.log('응답 상태:', res.statusCode);
  if (res.headers['Access-Control-Allow-Origin']) {
    console.log('CORS:', res.headers['Access-Control-Allow-Origin']);
  }
  if (res.body && typeof res.body === 'object') {
    console.log('응답 본문:');
    console.log(JSON.stringify(res.body, null, 2));
  } else {
    console.log('응답:', res.body);
  }
}

// 케이스 1: 예정 음식 없음 + 남은 칼로리 넉넉함
await run('케이스 1 — 예정 없음 + 남은 칼로리 넉넉 (감도 낮음, 25세 남성 170/69 감량 활동 보통, 아직 안 먹음)', {
  profile: { gender: 'male', age: 25, height: 170, weight: 69, goal: 'loss' },
  activityLevel: 1.55,
  eatenFoods: [],
  plannedFoods: []
});

// 케이스 1b: 같은 조건에서 이미 라면+계란 먹은 상태 (남은 칼로리 줄어듦)
await run('케이스 1b — 예정 없음 + 라면/계란 먹음 (남은 칼로리 줄어듦)', {
  profile: { gender: 'male', age: 25, height: 170, weight: 69, goal: 'loss' },
  activityLevel: 1.55,
  eatenFoods: ['라면 1개', '계란 2개'],
  plannedFoods: []
});

// 케이스 2: 예정 음식 있음 → mealSuggestions가 빈 배열인지
await run('케이스 2 — 예정 음식 있음 (삼겹살) → mealSuggestions 빈 배열 여부 확인', {
  profile: { gender: 'male', age: 25, height: 170, weight: 69, goal: 'loss' },
  activityLevel: 1.55,
  eatenFoods: ['김밥 1줄'],
  plannedFoods: ['삼겹살 200g']
});

// 케이스 3: 감량 목표 → 저칼로리 편향 아닌지 (유지 목표로도 확인)
await run('케이스 3a — 감량 목표, 예정 없음, 아직 안 먹음 (저칼로리 편향 여부 확인)', {
  profile: { gender: 'male', age: 25, height: 170, weight: 69, goal: 'loss' },
  activityLevel: 1.55,
  eatenFoods: [],
  plannedFoods: []
});

await run('케이스 3b — 유지 목표, 예정 없음, 아직 안 먹음 (비교용)', {
  profile: { gender: 'male', age: 25, height: 170, weight: 69, goal: 'maintain' },
  activityLevel: 1.55,
  eatenFoods: [],
  plannedFoods: []
});

await run('케이스 3c — 증량 목표, 예정 없음, 아직 안 먹음 (비교용)', {
  profile: { gender: 'male', age: 25, height: 170, weight: 69, goal: 'gain' },
  activityLevel: 1.55,
  eatenFoods: [],
  plannedFoods: []
});

// 케이스 4: 남은 칼로리가 적을 때 → 높은 칼로리만 추천하지 않는지 (이미 많이 먹은 상태)
await run('케이스 4 — 이미 많이 먹음 (라면+계란+김밥) 남은 칼로리 적음 → 고열량만 추천하지 않는지', {
  profile: { gender: 'male', age: 25, height: 170, weight: 69, goal: 'loss' },
  activityLevel: 1.55,
  eatenFoods: ['라면 1개', '계란 2개', '김밥 1줄'],
  plannedFoods: []
});

// 케이스 5: 이미 먹은 음식과 유사 메뉴 제외 여부 (라면 먹었으면 라면류 제외)
await run('케이스 5 — 라면 먹고 난 뒤 → 라면류/유사 메뉴 제외 여부 확인', {
  profile: { gender: 'male', age: 25, height: 170, weight: 69, goal: 'loss' },
  activityLevel: 1.55,
  eatenFoods: ['라면 1개'],
  plannedFoods: []
});

// 케이스 6: "서울 여행지 3곳 추천해줘" 범위 밖 입력 → 여전히 400인지
await run('케이스 6 — "서울 여행지 3곳 추천해줘" (식단 무관) → 400 여부 확인', {
  profile: { gender: 'male', age: 25, height: 170, weight: 69, goal: 'loss' },
  activityLevel: 1.55,
  eatenFoods: ['서울 여행지 3곳 추천해줘'],
  plannedFoods: []
});

// 케이스 7: 기존 계산값 변경 여부 확인 (감량 목표 남성 25세/170/69/활동보통)
await run('케이스 7 — 계산값 불변 확인 (감량 남성 25세/170/69/활동보통, 먹은 것 없음)', {
  profile: { gender: 'male', age: 25, height: 170, weight: 69, goal: 'loss' },
  activityLevel: 1.55,
  eatenFoods: [],
  plannedFoods: []
});

console.log('\n=== 검증 완료 ===');

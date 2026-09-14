// test-final-logic.js — Solar 호출 없이 순수 로직만 검증
// (API 키 없으므로 interpretFoodsWithSolar / generateStrategyWithSolar는 에러 처리만 확인)

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

function print(label, res) {
  console.log(`\n=== ${label} ===`);
  console.log('응답 상태:', res.statusCode);
  if (res.headers['Access-Control-Allow-Origin']) {
    console.log('CORS 헤더:', res.headers['Access-Control-Allow-Origin']);
  }
  if (res.body && typeof res.body === 'object') {
    console.log('응답 본문:');
    console.log(JSON.stringify(res.body, null, 2));
  } else if (typeof res.body === 'string') {
    console.log('응답 본문(문자열):', res.body);
  } else {
    console.log('응답 본문:', res.body);
  }
}

// 정상 입력 1 — 프로필 + 활동 + 먹은 것 + 예정 있음
const normalReq = {
  method: 'POST',
  body: {
    profile: { gender: 'male', age: 25, height: 170, weight: 69, goal: 'loss' },
    activityLevel: 1.55,
    eatenFoods: ['라면 1개', '계란 2개'],
    plannedFoods: ['삼겹살 200g']
  }
};

// 범위 밖 입력 1 — 키 110cm (120cm 미만이라 재확인 대상)
const outOfRangeReq = {
  method: 'POST',
  body: {
    profile: { gender: 'female', age: 20, height: 110, weight: 45, goal: 'maintain' },
    activityLevel: 1.55,
    eatenFoods: [],
    plannedFoods: []
  }
};

// 빈 입력 1 — 프로필 없음
const emptyReq = {
  method: 'POST',
  body: {}
};

try {
  const r1 = makeMockRes();
  await handler(normalReq, r1);
  print('정상 입력 1 (남성 25세, 170cm, 69kg, 감량, 활동 보통, 라면+계란, 삼겹살 예정)', r1);
} catch (e) {
  console.log('\n=== 정상 입력 1 (에러 발생) ===');
  console.log('오류:', e.message);
  console.log('스택:', e.stack);
}

try {
  const r2 = makeMockRes();
  await handler(outOfRangeReq, r2);
  print('범위 밖 입력 1 (키 110cm - 재확인 대상) ', r2);
} catch (e) {
  console.log('\n=== 범위 밖 입력 1 (에러 발생) ===');
  console.log('오류:', e.message);
}

try {
  const r3 = makeMockRes();
  await handler(emptyReq, r3);
  print('빈 입력 1 (프로필 없음)', r3);
} catch (e) {
  console.log('\n=== 빈 입력 1 (에러 발생) ===');
  console.log('오류:', e.message);
}

console.log('\n=== 종료 ===');

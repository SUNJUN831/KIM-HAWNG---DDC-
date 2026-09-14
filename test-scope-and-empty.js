// test-scope-and-empty.js — 범위 밖 입력 + 빈 입력 로컬 검증
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
    console.log(`\n=== ${label} (예외 발생) ===`);
    console.log('예외 메시지:', e.message);
    console.log('스택:', e.stack);
    return;
  }
  console.log(`\n=== ${label} ===`);
  console.log('응답 상태:', res.statusCode);
  if (res.headers['Access-Control-Allow-Origin']) {
    console.log('CORS 헤더:', res.headers['Access-Control-Allow-Origin']);
  }
  if (res.body !== undefined) {
    console.log('응답 본문:');
    console.log(JSON.stringify(res.body, null, 2));
  } else {
    console.log('응답 본문: 없음');
  }
}

// 범위 밖 입력 1: 유효 프로필 + 음식 입력에 식단과 무관한 요청
await run('범위 밖 입력 1 — 유효 프로필 + "서울 여행지 3곳 추천해줘" (식단 무관)', {
  profile: { gender: 'male', age: 25, height: 170, weight: 69, goal: 'loss' },
  activityLevel: 1.55,
  eatenFoods: ['서울 여행지 3곳 추천해줘'],
  plannedFoods: []
});

// 빈 입력 1: 프로필 없음
await run('빈 입력 1 — 프로필 없음', {});

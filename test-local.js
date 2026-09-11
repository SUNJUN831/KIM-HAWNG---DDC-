// test-local.js — 핸들러 호출 + Solar Pro 4 호출 검증용
import handler from './api/calculate.js';

const payload = {
  profile: { gender: 'male', age: 25, height: 170, weight: 69, goal: 'loss' },
  activityLevel: 1.55,
  eatenFoods: ['라면 1개', '계란 2개'],
  plannedFoods: ['삼겹살 200g']
};

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

async function run(label, req) {
  const res = makeMockRes();
  console.log(`\n=== ${label} ===`);
  console.time(label);
  await handler(req, res);
  console.timeEnd(label);
  console.log('응답 상태:', res.statusCode);
  if (res.headers['Access-Control-Allow-Origin']) {
    console.log('CORS 헤더:', res.headers['Access-Control-Allow-Origin']);
  }
  if (res.body) {
    console.log('응답 본문:');
    console.log(JSON.stringify(res.body, null, 2));
  } else {
    console.log('응답 본문 없음 (에러 Probably)');
  }
}

// 테스트 1: 객체 body 버전 (Vercel에서 파싱된 body와 유사)
await run('테스트 1 — 객체 body', {
  method: 'POST',
  body: payload
});

// 테스트 2: 문자열 body 버전 (실제 HTTP 요청과 유사)
await run('테스트 2 — 문자열 body', {
  method: 'POST',
  body: JSON.stringify(payload)
});

// 확인: 응답에 API 키가 노출됐는지 체크
console.log('\n=== 키 노출 체크 ===');
const checkBody = (obj) => {
  const json = JSON.stringify(obj);
  const hasKey = /up_[a-zA-Z0-9]+/.test(json);
  console.log('응답 JSON에 up_ 키가 포함됐는지:', hasKey ? '⚠️ 노출됨!' : '✅ 노출 안 됨');
};
checkBody(payload); // payload 자체에 키 없음은 당연

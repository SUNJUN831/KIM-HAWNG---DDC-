import 'dotenv/config';
import { getRecommendedFoodsForAvg } from './api/calculate.js';

async function main() {
  console.log('=== test-calories-request.js ===');
  console.log('남은 칼로리 구간별 공공 API 추천 테스트 (카테고리명 표시)\n');

  const cases = [
    { label: '0~100kcal 구간 (추천 없음)', remainingAvg: 80 },
    { label: '100~600kcal 구간 (1개)', remainingAvg: 350 },
    { label: '600~1200kcal 구간 (2개)', remainingAvg: 800 },
  ];

  for (const c of cases) {
    console.log(`--- ${c.label} (remainingAvg=${c.remainingAvg}) ---`);
    const foods = [];
    const recs = await getRecommendedFoodsForAvg(c.remainingAvg, 4, [], []);

    if (recs.length === 0) {
      console.log('  추천 음식: 없음');
    } else {
      recs.forEach((r, i) => {
        console.log(`  ${i + 1}. name=${r.name} | qty=${r.qty} | ${r.calLow}~${r.calHigh} kcal`);
        console.log(`     note=${r.note}`);
      });
    }
    console.log('');
  }

  console.log('=== 완료 ===');
}

main().catch((e) => {
  console.error('오류:', e);
  process.exit(1);
});

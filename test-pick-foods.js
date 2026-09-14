import { pickFoodsByCalorieTarget } from './api/foodRequest.js';
import { FOOD_LV3_CODES } from './api/foodCategories.js';

const testCases = [
  { targetCal: 350, count: 4, desc: '적은 칼로리 (간식 수준)' },
  { targetCal: 800, count: 4, desc: '중간 칼로리 (한 끼)' },
  { targetCal: 800, count: 6, desc: '중간 칼로리 (아이템 6개)' },
  { targetCal: 1500, count: 4, desc: '높은 칼로리 (여러 끼니 분량)' },
];

for (const tc of testCases) {
  console.log(`\n=== ${tc.desc} (targetCal=${tc.targetCal}, count=${tc.count}) ===`);
  try {
    const result = await pickFoodsByCalorieTarget(tc.targetCal, tc.count, 250);
    if (result.length === 0) {
      console.log('  → 후보 없음');
    } else {
      console.log(`  → ${result.length}개 추천:`);
      result.forEach((f, i) => {
        console.log(`  ${(i+1)}. ${f.name} | ${f.qty} | ${f.calLow}~${f.calHigh}kcal | code=${f.code} | ${f.note}`);
      });
    }
  } catch (e) {
    console.log('  → 오류:', e.message);
  }
}

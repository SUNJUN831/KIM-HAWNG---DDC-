import 'dotenv/config';
import { interpretFoodsWithSolar } from './api/solar.js';

async function main() {
  console.log('=== test-interpret-macro.js (탄단지 비중 파싱 확인) ===');

  const eatenFoods = [
    '라면 1개',
    '김치피자탕수육 1인분',
  ];
  const plannedFoods = [
    '삼겹살 600g',
    '치킨 반마리',
  ];

  console.log('입력 eatenFoods:', eatenFoods);
  console.log('입력 plannedFoods:', plannedFoods);
  console.log('');

  const result = await interpretFoodsWithSolar(eatenFoods, plannedFoods);

  if (result.error) {
    console.error('오류:', result.error);
    process.exit(1);
  }

  console.log('파싱 결과:');
  [...result.foods, ...result.plannedFoods].forEach((f, i) => {
    console.log(`[${i + 1}] ${f.name} (${f.qty})`);
    console.log(`    calLow=${f.calLow}, calHigh=${f.calHigh}`);
    console.log(`    prot_pct=${f.prot_pct}%, fat_pct=${f.fat_pct}%, carbs_pct=${f.carbs_pct}%`);
    console.log(`    note=${f.note}`);
    console.log(`    isPlanned=${f.isPlanned}, mealType=${f.mealType}`);
    console.log('');
  });

  console.log('=== 완료 ===');
}

main().catch((e) => {
  console.error('오류:', e);
  process.exit(1);
});

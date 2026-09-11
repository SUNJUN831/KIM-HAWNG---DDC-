#!/usr/bin/env node
// test-kimbap-dedup.js
// 참치김밥 1줄을 먹은 경우, 김밥류가 추천에서 실제로 제외되는지 확인

// ===== 실제 api/calculate.js의 extractFoodFoodTypes =====
function extractFoodFoodTypes(foodList) {
  const foodTypes = new Set();
  const foodTypePatterns = [
    "김밥", "돈까스", "샌드위치", "salad", "라면", "빵", "요거트", "사과", "견과류",
  ];
  for (const food of foodList) {
    if (typeof food.name !== 'string') continue;
    for (const ft of foodTypePatterns) {
      if (food.name.includes(ft)) {
        foodTypes.add(ft);
      }
    }
  }
  return foodTypes;
}

// ===== 실제 api/calculate.js의 generateMealSuggestions =====
function generateMealSuggestions({ goal, remainingLo, remainingHi, foods = [], plannedFoodsResult = [] }) {
  const avgRemaining = (remainingLo + remainingHi) / 2;
  const eatenFoodTypes = extractFoodFoodTypes([...foods, ...plannedFoodsResult]);

  const pool = [
    { name: "견과류 한 줌 (약 20~30g)", low: 120, high: 200, note: "간식", category: "light", foodTypes: ["견과류"] },
    { name: "사과 + 플레인 요거트", low: 150, high: 230, note: "가벼운 간식 느낌", category: "light", foodTypes: ["사과", "요거트"] },
    { name: "계란빵 1개", low: 200, high: 350, note: "간식·간편", category: "light", foodTypes: ["빵"] },
    { name: "닭가슴살 샐러드 (드레싱 포함)", low: 300, high: 450, note: "가벼운 식사", category: "light", foodTypes: ["salad"] },
    { name: "참치김밥 1줄", low: 300, high: 500, note: "한 끼 부담 적은 편", category: "normal", foodTypes: ["김밥"] },
    { name: "샌드위치 (일반 햄/참치 등)", low: 350, high: 500, note: "한 끼로 무난한 편", category: "normal", foodTypes: ["샌드위치"] },
    { name: "소고기 김밥 1줄", low: 400, high: 600, note: "제법 포만감", category: "heavier", foodTypes: ["김밥"] },
    { name: "치즈돈까스 작은 조각 (약 2~3조각)", low: 400, high: 650, note: "고열량, 나눠 먹기", category: "heavier", foodTypes: ["돈까스"] },
  ];

  const filteredPool = pool.filter(item => {
    if (!item.foodTypes || item.foodTypes.length === 0) return true;
    return !item.foodTypes.some(ft => eatenFoodTypes.has(ft));
  });
  
  const isLowRemaining = remainingLo < 500;
  
  const categoryPlan = {
    loss: isLowRemaining
      ? { light: 2, normal: 2, heavier: 0 }
      : { light: 2, normal: 1, heavier: 1 },
    maintain: { light: 1, normal: 2, heavier: 1 },
    gain: { light: 1, normal: 1, heavier: 2 },
  };
  const plan = categoryPlan[goal] || categoryPlan.maintain;
  
  const pickFromCategory = (cat, needed) => {
    const items = filteredPool
      .filter(item => item.category === cat)
      .sort((a, b) => {
        const aMid = (a.low + a.high) / 2;
        const bMid = (b.low + b.high) / 2;
        if (goal === 'loss') {
          const aFit = Math.abs(aMid - avgRemaining);
          const bFit = Math.abs(bMid - avgRemaining);
          return aFit - bFit;
        }
        if (goal === 'gain') return bMid - aMid;
        return 0;
      });
    const picked = [];
    for (const item of items) {
      if (picked.length >= needed) break;
      picked.push(item);
    }
    return picked;
  };
  
  const candidates = [];
  for (const cat of ['light', 'normal', 'heavier']) {
    const needed = plan[cat] || 0;
    if (needed > 0) {
      const picked = pickFromCategory(cat, needed);
      candidates.push(...picked);
    }
  }
  
  if (candidates.length < 4) {
    const usedNames = new Set(candidates.map(c => c.name));
    const fillCandidates = filteredPool
      .filter(item => !usedNames.has(item.name))
      .sort((a, b) => {
        const aMid = (a.low + a.high) / 2;
        const bMid = (b.low + b.high) / 2;
        if (goal === 'loss') {
          const aFit = Math.abs(aMid - avgRemaining);
          const bFit = Math.abs(bMid - avgRemaining);
          return aFit - bFit;
        }
        if (goal === 'gain') return bMid - aMid;
        return 0;
      });
    for (const item of fillCandidates) {
      if (candidates.length >= 4) break;
      candidates.push(item);
    }
  }
  
  return candidates.slice(0, 4).map((item) => {
    let note = item.note;
    if (goal === 'loss' && (item.low + item.high) / 2 > avgRemaining / 2) {
      note += " 남은 칼로리를 한 끼에 다 채우기보다 나눠 먹는 편이 좋아.";
    }
    if (isLowRemaining && (item.low + item.high) / 2 > remainingHi * 0.7) {
      note += " 남은 칼로리가 많지 않아서, 이걸 먹으면 꽤 찰 수 있어.";
    }
    return {
      name: item.name,
      rangeLow: item.low,
      rangeHigh: item.high,
      category: item.category,
      note: note,
    };
  });
}

// ===== 테스트: 참치김밥 1줄 먹은 경우 =====
console.log("\n\n############################################################");
console.log("테스트 케이스: 참치김밥 1줄을 이미 먹은 경우");
console.log("############################################################");

const eatenFoods = [{"name": "참치김밥 1줄", "calLow": 300, "calHigh": 500}];
const plannedFoods = [];
const profile = { gender: 'male', age: 25, height: 170, weight: 69, goal: 'loss' };
const activityLevel = 1.55;

const bmrRaw = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
const todayConsumptionRaw = bmrRaw * activityLevel;
const targetCaloriesRaw = todayConsumptionRaw - 500;
const currentIntakeLo = eatenFoods.reduce((s, f) => s + (f.calLow ?? 0), 0);
const currentIntakeHi = eatenFoods.reduce((s, f) => s + (f.calHigh ?? 0), 0);
const remainingLo = Math.round(targetCaloriesRaw - currentIntakeHi);
const remainingHi = Math.round(targetCaloriesRaw - currentIntakeLo);

console.log(`입력:
  - 먹은 음식: 참치김밥 1줄 (300~500 kcal)
  - 목표: 감량
  - 남은 칼로리: ${remainingLo}~${remainingHi}
`);

// eatenFoodTypes 확인
const eatenFoodTypes = extractFoodFoodTypes([...eatenFoods, ...plannedFoods]);
console.log(`eatenFoodTypes: ${[...eatenFoodTypes].join(", ")}`);

// filteredPool 확인
const pool = [
  { name: "견과류 한 줌 (약 20~30g)", low: 120, high: 200, note: "간식", category: "light", foodTypes: ["견과류"] },
  { name: "사과 + 플레인 요거트", low: 150, high: 230, note: "가벼운 간식 느낌", category: "light", foodTypes: ["사과", "요거트"] },
  { name: "계란빵 1개", low: 200, high: 350, note: "간식·간편", category: "light", foodTypes: ["빵"] },
  { name: "닭가슴살 샐러드 (드레싱 포함)", low: 300, high: 450, note: "가벼운 식사", category: "light", foodTypes: ["salad"] },
  { name: "참치김밥 1줄", low: 300, high: 500, note: "한 끼 부담 적은 편", category: "normal", foodTypes: ["김밥"] },
  { name: "샌드위치 (일반 햄/참치 등)", low: 350, high: 500, note: "한 끼로 무난한 편", category: "normal", foodTypes: ["샌드위치"] },
  { name: "소고기 김밥 1줄", low: 400, high: 600, note: "제법 포만감", category: "heavier", foodTypes: ["김밥"] },
  { name: "치즈돈까스 작은 조각 (약 2~3조각)", low: 400, high: 650, note: "고열량, 나눠 먹기", category: "heavier", foodTypes: ["돈까스"] },
];

const filteredPool = pool.filter(item => {
  if (!item.foodTypes || item.foodTypes.length === 0) return true;
  return !item.foodTypes.some(ft => eatenFoodTypes.has(ft));
});

console.log(`\nfilteredPool (김밥 관련 foodType 제외 후):`);
for (const item of filteredPool) {
  console.log(`  - ${item.name} [${item.category}] foodTypes: ${item.foodTypes.join(", ")}`);
}

console.log(`\n제외된 아이템:`);
const excluded = pool.filter(item => filteredPool.indexOf(item) === -1);
for (const item of excluded) {
  console.log(`  ✗ ${item.name} [${item.category}] foodTypes: ${item.foodTypes.join(", ")}`);
}

console.log(`\n최종 mealSuggestions:`);
const mealSuggestions = generateMealSuggestions({
  goal: profile.goal,
  remainingLo,
  remainingHi,
  foods: eatenFoods,
  plannedFoodsResult: plannedFoods,
});
console.log(JSON.stringify(mealSuggestions, null, 2));

console.log(`\n검증:`);
const hasKimbap = mealSuggestions.some(s => s.name.includes("김밥"));
console.log(`  추천에 김밥류 포함 여부: ${hasKimbap ? "❌ 포함됨 (제외 실패)" : "✅ 포함되지 않음 (제외 성공)"}`);

const hasChamchi = mealSuggestions.some(s => s.name.includes("참치김밥"));
console.log(`  추천에 참치김밥 포함 여부: ${hasChamchi ? "❌ 포함됨 (제외 실패)" : "✅ 포함되지 않음 (제외 성공)"}`);

const hasSogeog = mealSuggestions.some(s => s.name.includes("소고기 김밥"));
console.log(`  추천에 소고기 김밥 포함 여부: ${hasSogeog ? "❌ 포함됨 (제외 실패)" : "✅ 포함되지 않음 (제외 성공)"}`);

console.log("\n############################################################");
console.log("결과 요약");
console.log("############################################################");
console.log("참치김밥 1줄을 먹으면 '김밥' 키워드가 eatenKeywords에 포함됨");
console.log("그 결과 pool에서 '김밥' 키워드가 있는 모든 아이템이 제외됨:");
console.log("  - 참치김밥 1줄 (normal)");
console.log("  - 소고기 김밥 1줄 (heavier)");
console.log("\n→ 같은 카테고리(김밥류) 음식이 중복 추천되지 않도록 동작함");

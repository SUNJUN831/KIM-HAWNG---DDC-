#!/usr/bin/env node
// test-dedup-kimbap.js
// 참치김밥 1줄을 먹었을 때, 참치김밥과 다른 김밥류가 추천에서 제외되는지 확인

// ===== 실제 api/calculate.js의 extractFoodKeywords =====
function extractFoodKeywords(foodList) {
  const keywords = new Set();
  const keywordPatterns = [
    "김밥", "라면", "치킨", "샌드위치", "샐러드", "계란", "요거트",
    "돈까스", "소고기", "참치", "치즈", "사과", "견과", "빵", "밥",
  ];
  for (const food of foodList) {
    if (typeof food.name !== 'string') continue;
    for (const kw of keywordPatterns) {
      if (food.name.includes(kw)) keywords.add(kw);
    }
  }
  return keywords;
}

// ===== 실제 api/calculate.js의 generateMealSuggestions (최신 버전) =====
function generateMealSuggestions({ goal, remainingLo, remainingHi, foods = [], plannedFoodsResult = [] }) {
  const avgRemaining = (remainingLo + remainingHi) / 2;
  const eatenKeywords = extractFoodKeywords([...foods, ...plannedFoodsResult]);

  const pool = [
    { name: "견과류 한 줌 (약 20~30g)", low: 120, high: 200, note: "간식", category: "light", keywords: ["견과"] },
    { name: "사과 + 플레인 요거트", low: 150, high: 230, note: "가벼운 간식 느낌", category: "light", keywords: ["사과", "요거트"] },
    { name: "계란빵 1개", low: 200, high: 350, note: "간식·간편", category: "light", keywords: ["계란", "빵"] },
    { name: "닭가슴살 샐러드 (드레싱 포함)", low: 300, high: 450, note: "가벼운 식사", category: "light", keywords: ["샐러드", "닭가슴살"] },
    { name: "참치김밥 1줄", low: 300, high: 500, note: "한 끼 부담 적은 편", category: "normal", keywords: ["김밥", "참치"] },
    { name: "샌드위치 (일반 햄/참치 등)", low: 350, high: 500, note: "한 끼로 무난한 편", category: "normal", keywords: ["샌드위치", "햄", "참치"] },
    { name: "소고기 김밥 1줄", low: 400, high: 600, note: "제법 포만감", category: "heavier", keywords: ["김밥", "소고기"] },
    { name: "치즈돈까스 작은 조각 (약 2~3조각)", low: 400, high: 650, note: "고열량, 나눠 먹기", category: "heavier", keywords: ["돈까스", "치즈"] },
  ];

  const filteredPool = pool.filter(item => {
    if (!item.keywords) return true;
    return !item.keywords.some(kw => eatenKeywords.has(kw));
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

// ===== 테스트: 참치김밥 1줄을 먹은 경우 =====
console.log("============================================================");
console.log("테스트: 참치김밥 1줄을 이미 먹었을 때 중복 제외 확인");
console.log("============================================================\n");

const eatenFoods = [{ name: "참치김밥 1줄", calLow: 300, calHigh: 500 }];
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

console.log("입력:");
console.log("  먹은 음식: 참치김밥 1줄 (300~500 kcal)");
console.log("  목표: 감량");
console.log(`  남은 칼로리: ${remainingLo}~${remainingHi}\n`);

// eatenKeywords 추출 과정 확인
const eatenKeywords = extractFoodKeywords([...eatenFoods, ...plannedFoods]);
console.log("추출된 eatenKeywords:", [...eatenKeywords].join(", "));
console.log("→ '김밥'이 키워드에 포함됨\n");

// filteredPool 확인
const pool = [
  { name: "견과류 한 줌 (약 20~30g)", low: 120, high: 200, note: "간식", category: "light", keywords: ["견과"] },
  { name: "사과 + 플레인 요거트", low: 150, high: 230, note: "가벼운 간식 느낌", category: "light", keywords: ["사과", "요거트"] },
  { name: "계란빵 1개", low: 200, high: 350, note: "간식·간편", category: "light", keywords: ["계란", "빵"] },
  { name: "닭가슴살 샐러드 (드레싱 포함)", low: 300, high: 450, note: "가벼운 식사", category: "light", keywords: ["샐러드", "닭가슴살"] },
  { name: "참치김밥 1줄", low: 300, high: 500, note: "한 끼 부담 적은 편", category: "normal", keywords: ["김밥", "참치"] },
  { name: "샌드위치 (일반 햄/참치 등)", low: 350, high: 500, note: "한 끼로 무난한 편", category: "normal", keywords: ["샌드위치", "햄", "참치"] },
  { name: "소고기 김밥 1줄", low: 400, high: 600, note: "제법 포만감", category: "heavier", keywords: ["김밥", "소고기"] },
  { name: "치즈돈까스 작은 조각 (약 2~3조각)", low: 400, high: 650, note: "고열량, 나눠 먹기", category: "heavier", keywords: ["돈까스", "치즈"] },
];

console.log("filteredPool (중복 제거된 후 남은 아이템들):");
const filteredPool = pool.filter(item => {
  if (!item.keywords) return true;
  return !item.keywords.some(kw => eatenKeywords.has(kw));
});
for (const item of filteredPool) {
  console.log(`  - ${item.name} [${item.category}] keywords: ${item.keywords.join(", ")}`);
}
console.log("");

console.log("제외된 아이템:");
const excluded = pool.filter(item => filteredPool.indexOf(item) === -1);
for (const item of excluded) {
  console.log(`  ✗ ${item.name} [${item.category}] keywords: ${item.keywords.join(", ")}`);
  console.log(`    → '${item.keywords.join(", ")}' 중 '${[...eatenKeywords].join(", ")}'에 포함된 키워드 때문에 제외됨`);
}
console.log("");

// 최종 추천 결과
const mealSuggestions = generateMealSuggestions({
  goal: profile.goal,
  remainingLo,
  remainingHi,
  foods: eatenFoods,
  plannedFoodsResult: plannedFoods,
});

console.log("최종 mealSuggestions (length=" + mealSuggestions.length + "):");
console.log(JSON.stringify(mealSuggestions, null, 2));
console.log("");

// 검증
console.log("검증:");
const hasKimbap = mealSuggestions.some(s => s.name.includes("김밥"));
console.log(`  추천에 '김밥'이 포함됐는가?: ${hasKimbap ? "❌ 포함됨 (제외 실패)" : "✅ 포함되지 않음 (제외 성공)"}`);

const hasChamchi = mealSuggestions.some(s => s.name.includes("참치"));
console.log(`  추천에 '참치김밥'이 포함됐는가?: ${hasChamchi ? "❌ 포함됨 (제외 실패)" : "✅ 포함되지 않음 (제외 성공)"}`);

const hasSogeog = mealSuggestions.some(s => s.name.includes("소고기 김밥"));
console.log(`  추천에 '소고기 김밥'이 포함됐는가?: ${hasSogeog ? "❌ 포함됨 (제외 실패)" : "✅ 포함되지 않음 (제외 성공)"}`);

console.log("\n============================================================");
console.log("결과 요약");
console.log("============================================================");
console.log("참치김밥 1줄을 먹으면 '김밥' 키워드가 eatenKeywords에 추가됨");
console.log("그 결과 pool에서 '김밥' 키워드가 있는 모든 아이템이 제외됨:");
console.log("  - 참치김밥 1줄 (normal): 제외됨");
console.log("  - 소고기 김밥 1줄 (heavier): 제외됨");
console.log("");
console.log("이것은 의도한 동작임: 같은 카테고리(김밥류)의 음식을 중복 추천하지 않음.");

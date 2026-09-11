#!/usr/bin/env node
// test-recs-3cases.js
// 실제 api/calculate.js의 extractFoodFoodTypes + generateMealSuggestions 기준으로
// 3가지 케이스 테스트:
// 1. 참치김밥 1줄 먹은 상태에서 추천에 김밥류가 다시 나오는지
// 2. 소고기 김밥 1줄 먹은 상태에서 추천에 김밥류가 다시 나오는지
// 3. loss / 유지 / 증량 각각에서 추천 4개 구성이 한쪽으로 편중되지 않는지

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

// ===== 헬퍼 =====
function calcBMR({ gender, age, height, weight }) {
  if (gender === 'male') {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    return 10 * weight + 6.25 * height - 5 * age - 161;
  }
}

function calcTodayConsumption(bmrRaw, activityLevel) {
  return bmrRaw * activityLevel;
}

function calcTargetCalories(todayConsumptionRaw, goal) {
  if (goal === 'loss') return todayConsumptionRaw - 500;
  if (goal === 'maintain') return todayConsumptionRaw;
  return todayConsumptionRaw + 300;
}

function calcCurrentIntake(foods) {
  const lo = foods.reduce((s, f) => s + (f.calLow ?? 0), 0);
  const hi = foods.reduce((s, f) => s + (f.calHigh ?? 0), 0);
  return { lo, hi };
}

function calcRemaining(targetCaloriesRaw, currentIntakeHi, currentIntakeLo) {
  return {
    lo: targetCaloriesRaw - currentIntakeHi,
    hi: targetCaloriesRaw - currentIntakeLo,
  };
}

// ===== 공통 프로필 =====
const profile = { gender: 'male', age: 25, height: 170, weight: 69, goal: 'loss' };
const activityLevel = 1.55;

// ===== 케이스 1: 참치김밥 1줄 먹은 상태 =====
console.log("\n\n##################################################################");
console.log("케이스 1: 참치김밥 1줄을 이미 먹은 상태에서 추천에 김밥류가 다시 나오는지");
console.log("##################################################################");

{
  const eatenFoods = [{ name: "참치김밥 1줄", calLow: 300, calHigh: 500 }];
  const plannedFoods = [];
  const bmrRaw = calcBMR(profile);
  const todayConsumptionRaw = calcTodayConsumption(bmrRaw, activityLevel);
  const targetCaloriesRaw = calcTargetCalories(todayConsumptionRaw, 'loss');
  const currentIntake = calcCurrentIntake(eatenFoods);
  const remaining = calcRemaining(targetCaloriesRaw, currentIntake.hi, currentIntake.lo);
  const remainingLo = Math.round(remaining.lo);
  const remainingHi = Math.round(remaining.hi);

  console.log(`입력: 참치김밥 1줄 (300~500 kcal), 감량, 남은 칼로리 ${remainingLo}~${remainingHi}`);
  console.log(`eatenFoodTypes: ${[...extractFoodFoodTypes(eatenFoods)].join(", ")}`);

  const mealSuggestions = generateMealSuggestions({
    goal: 'loss',
    remainingLo,
    remainingHi,
    foods: eatenFoods,
    plannedFoodsResult: plannedFoods,
  });

  console.log(`mealSuggestions (length=${mealSuggestions.length}):`);
  console.log(JSON.stringify(mealSuggestions, null, 2));

  const hasKimbap = mealSuggestions.some(s => s.name.includes("김밥"));
  console.log(`\n검증: 추천에 김밥류 포함 여부: ${hasKimbap ? "❌ 포함됨" : "✅ 제외됨"}`);
}

// ===== 케이스 2: 소고기 김밥 1줄 먹은 상태 =====
console.log("\n\n##################################################################");
console.log("케이스 2: 소고기 김밥 1줄을 이미 먹은 상태에서 추천에 김밥류가 다시 나오는지");
console.log("##################################################################");

{
  const eatenFoods = [{ name: "소고기 김밥 1줄", calLow: 400, calHigh: 600 }];
  const plannedFoods = [];
  const bmrRaw = calcBMR(profile);
  const todayConsumptionRaw = calcTodayConsumption(bmrRaw, activityLevel);
  const targetCaloriesRaw = calcTargetCalories(todayConsumptionRaw, 'loss');
  const currentIntake = calcCurrentIntake(eatenFoods);
  const remaining = calcRemaining(targetCaloriesRaw, currentIntake.hi, currentIntake.lo);
  const remainingLo = Math.round(remaining.lo);
  const remainingHi = Math.round(remaining.hi);

  console.log(`입력: 소고기 김밥 1줄 (400~600 kcal), 감량, 남은 칼로리 ${remainingLo}~${remainingHi}`);
  console.log(`eatenFoodTypes: ${[...extractFoodFoodTypes(eatenFoods)].join(", ")}`);

  const mealSuggestions = generateMealSuggestions({
    goal: 'loss',
    remainingLo,
    remainingHi,
    foods: eatenFoods,
    plannedFoodsResult: plannedFoods,
  });

  console.log(`mealSuggestions (length=${mealSuggestions.length}):`);
  console.log(JSON.stringify(mealSuggestions, null, 2));

  const hasKimbap = mealSuggestions.some(s => s.name.includes("김밥"));
  console.log(`\n검증: 추천에 김밥류 포함 여부: ${hasKimbap ? "❌ 포함됨" : "✅ 제외됨"}`);
}

// ===== 케이스 3: loss / 유지 / 증량 각각에서 추천 4개 편중 여부 =====
console.log("\n\n##################################################################");
console.log("케이스 3: loss / 유지 / 증량 각각에서 추천 4개 구성이 한쪽으로 편중되지 않는지");
console.log("##################################################################");

const goals = [
  { label: "loss (감량)", goal: "loss" },
  { label: "maintain (유지)", goal: "maintain" },
  { label: "gain (증량)", goal: "gain" },
];

for (const { label, goal } of goals) {
  const eatenFoods = [];
  const plannedFoods = [];
  const bmrRaw = calcBMR(profile);
  const todayConsumptionRaw = calcTodayConsumption(bmrRaw, activityLevel);
  const targetCaloriesRaw = calcTargetCalories(todayConsumptionRaw, goal);
  const currentIntake = calcCurrentIntake(eatenFoods);
  const remaining = calcRemaining(targetCaloriesRaw, currentIntake.hi, currentIntake.lo);
  const remainingLo = Math.round(remaining.lo);
  const remainingHi = Math.round(remaining.hi);

  console.log(`\n## ${label} | 남은 칼로리 ${remainingLo}~${remainingHi} ##`);

  const mealSuggestions = generateMealSuggestions({
    goal,
    remainingLo,
    remainingHi,
    foods: eatenFoods,
    plannedFoodsResult: plannedFoods,
  });

  console.log(`mealSuggestions (length=${mealSuggestions.length}):`);
  console.log(JSON.stringify(mealSuggestions, null, 2));

  const categories = mealSuggestions.map(s => s.category);
  const lightCount = categories.filter(c => c === "light").length;
  const normalCount = categories.filter(c => c === "normal").length;
  const heavierCount = categories.filter(c => c === "heavier").length;

  console.log(`카테고리 분포: light ${lightCount}개, normal ${normalCount}개, heavier ${heavierCount}개`);

  const biased = (goal === "loss" && heavierCount === 0 && normalCount <= 1) ||
                  (goal === "maintain" && heavierCount === 0 && lightCount === 0) ||
                  (goal === "gain" && lightCount === 0 && normalCount === 0);
  console.log(`편중 여부: ${biased ? "❌ 한쪽으로 편중됨" : "✅ 다양한 카테고리 포함"}`);
}

console.log("\n\n##################################################################");
console.log("테스트 완료");
console.log("##################################################################");

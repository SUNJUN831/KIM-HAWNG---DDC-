#!/usr/bin/env node
// test-recs-from-api.js
// 실제 api/calculate.js에 들어간 extractFoodKeywords + generateMealSuggestions를
// 그대로 옮긴 순수 테스트 (handler 호출 없음, Solar 호출 없음)

// ===== BMR 계산 (Mifflin-St Jeor, 코드와 동일) =====
function calcBMR({ gender, age, height, weight }) {
  if (gender === 'male') {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    return 10 * weight + 6.25 * height - 5 * age - 161;
  }
}

// ===== 오늘 예상 소비 (BMR 원값 × 활동계수) =====
function calcTodayConsumption(bmrRaw, activityLevel) {
  return bmrRaw * activityLevel;
}

// ===== 목표 칼로리 =====
function calcTargetCalories(todayConsumptionRaw, goal) {
  if (goal === 'loss') return todayConsumptionRaw - 500;
  if (goal === 'maintain') return todayConsumptionRaw;
  return todayConsumptionRaw + 300; // gain
}

// ===== 현재 섭취량 =====
function calcCurrentIntake(foods) {
  const lo = foods.reduce((s, f) => s + (f.calLow ?? 0), 0);
  const hi = foods.reduce((s, f) => s + (f.calHigh ?? 0), 0);
  return { lo, hi };
}

// ===== 남은 칼로리 =====
function calcRemaining(targetCaloriesRaw, currentIntakeHi, currentIntakeLo) {
  return {
    lo: targetCaloriesRaw - currentIntakeHi,
    hi: targetCaloriesRaw - currentIntakeLo,
  };
}

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

// ===== 실제 api/calculate.js의 generateMealSuggestions =====
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

// ===== 테스트 헬퍼 =====
function runCase(label, { profile, activityLevel, eatenFoods, plannedFoods }) {
  console.log(`\n=== ${label} ===`);

  const bmrRaw = calcBMR(profile);
  const bmr = Math.round(bmrRaw);

  const todayConsumptionRaw = calcTodayConsumption(bmrRaw, activityLevel);
  const todayConsumption = Math.round(todayConsumptionRaw);

  const targetCaloriesRaw = calcTargetCalories(todayConsumptionRaw, profile.goal);
  const targetCalories = Math.round(targetCaloriesRaw);

  const currentIntake = calcCurrentIntake(eatenFoods);
  const currentIntakeLo = Math.round(currentIntake.lo);
  const currentIntakeHi = Math.round(currentIntake.hi);

  const remaining = calcRemaining(targetCaloriesRaw, currentIntakeHi, currentIntakeLo);
  const remainingLo = Math.round(remaining.lo);
  const remainingHi = Math.round(remaining.hi);

  console.log(`BMR: 원값=${bmrRaw} 반올림=${bmr}`);
  console.log(`오늘소비: 원값=${todayConsumptionRaw} 반올림=${todayConsumption}`);
  console.log(`목표: 원값=${targetCaloriesRaw} 반올림=${targetCalories}`);
  console.log(`현재섭취: ${currentIntakeLo}~${currentIntakeHi}`);
  console.log(`남은칼로리: ${remainingLo}~${remainingHi}`);

  const mealSuggestions =
    (plannedFoods && plannedFoods.length > 0) ? [] : generateMealSuggestions({
      goal: profile.goal,
      remainingLo,
      remainingHi,
      foods: eatenFoods,
      plannedFoodsResult: plannedFoods,
    });

  console.log(`mealSuggestions (length=${mealSuggestions.length}):`);
  console.log(JSON.stringify(mealSuggestions, null, 2));
}

// ===== 케이스 1 =====
console.log("\n\n##################################################################");
console.log("케이스 1: 예정 음식 없음 + 남은 칼로리 넉넉함 → 추천 약 4개 생성");
console.log("##################################################################");
runCase("케이스 1", {
  profile: { gender: 'male', age: 25, height: 170, weight: 69, goal: 'loss' },
  activityLevel: 1.55,
  eatenFoods: [],
  plannedFoods: []
});

// ===== 케이스 2 =====
console.log("\n\n##################################################################");
console.log("케이스 2: 예정 음식 있음 → mealSuggestions 빈 배열");
console.log("##################################################################");
runCase("케이스 2", {
  profile: { gender: 'male', age: 25, height: 170, weight: 69, goal: 'loss' },
  activityLevel: 1.55,
  eatenFoods: [{ name: "김밥 1줄", calLow: 300, calHigh: 500 }],
  plannedFoods: [{ name: "삼겹살 200g", calLow: 530, calHigh: 930 }]
});

// ===== 케이스 3a =====
console.log("\n\n##################################################################");
console.log("케이스 3a: 감량 목표 (예정 없음, 아직 안 먹음) → 저칼로리 편향 여부");
console.log("##################################################################");
runCase("케이스 3a", {
  profile: { gender: 'male', age: 25, height: 170, weight: 69, goal: 'loss' },
  activityLevel: 1.55,
  eatenFoods: [],
  plannedFoods: []
});

// ===== 케이스 3b =====
console.log("\n\n##################################################################");
console.log("케이스 3b: 유지 목표 (예정 없음, 아직 안 먹음)");
console.log("##################################################################");
runCase("케이스 3b", {
  profile: { gender: 'male', age: 25, height: 170, weight: 69, goal: 'maintain' },
  activityLevel: 1.55,
  eatenFoods: [],
  plannedFoods: []
});

// ===== 케이스 3c =====
console.log("\n\n##################################################################");
console.log("케이스 3c: 증량 목표 (예정 없음, 아직 안 먹음)");
console.log("##################################################################");
runCase("케이스 3c", {
  profile: { gender: 'male', age: 25, height: 170, weight: 69, goal: 'gain' },
  activityLevel: 1.55,
  eatenFoods: [],
  plannedFoods: []
});

// ===== 케이스 4 =====
console.log("\n\n##################################################################");
console.log("케이스 4: 이미 많이 먹음 (라면+계란+김밥), 남은 칼로리 적음");
console.log("##################################################################");
runCase("케이스 4", {
  profile: { gender: 'male', age: 25, height: 170, weight: 69, goal: 'loss' },
  activityLevel: 1.55,
  eatenFoods: [
    { name: "라면 1개", calLow: 500, calHigh: 600 },
    { name: "계란 2개", calLow: 140, calHigh: 160 },
    { name: "김밥 1줄", calLow: 300, calHigh: 500 },
  ],
  plannedFoods: []
});

// ===== 케이스 5 =====
console.log("\n\n##################################################################");
console.log("케이스 5: 라면 먹고 난 뒤 → 라면류/유사 메뉴 제외 여부");
console.log("##################################################################");
runCase("케이스 5", {
  profile: { gender: 'male', age: 25, height: 170, weight: 69, goal: 'loss' },
  activityLevel: 1.55,
  eatenFoods: [{ name: "라면 1개", calLow: 500, calHigh: 600 }],
  plannedFoods: []
});

// ===== 케이스 6 =====
console.log("\n\n##################################################################");
console.log("케이스 6: '서울 여행지 3곳 추천해줘' (식단 무관) → 범위 밖 처리");
console.log("##################################################################");
console.log("※ handler 레벨 로직이므로 generateMealSuggestions만으로는 확인 불가");
console.log("※ 현재 api/calculate.js handler 기준:");
console.log("   eatenFoods: ['서울 여행지 3곳 추천해줘']");
console.log("   → interpretFoodsWithSolar 호출 → calLow=0, calHigh=0, note='추정 불가'");
console.log("   → allNonFood 체크 (모든 음식 calLow===0 && calHigh===0) → true");
console.log("   → 400 응답: '입력한 내용 중 음식이 아닌 항목이 있어요...'");
console.log("※ handler 레벨 400 처리는 이미 api/calculate.js에 구현돼 있음 (lines 71-80)");

// ===== 케이스 7 =====
console.log("\n\n##################################################################");
console.log("케이스 7: 기존 계산값(BMR/오늘소비/목표) 수정 전과 동일 여부");
console.log("##################################################################");
const r7 = (() => {
  const profile = { gender: 'male', age: 25, height: 170, weight: 69, goal: 'loss' };
  const activityLevel = 1.55;
  const eatenFoods = [];
  const plannedFoods = [];

  const bmrRaw = calcBMR(profile);
  const todayConsumptionRaw = calcTodayConsumption(bmrRaw, activityLevel);
  const targetCaloriesRaw = calcTargetCalories(todayConsumptionRaw, profile.goal);
  const currentIntake = calcCurrentIntake(eatenFoods);
  const remaining = calcRemaining(targetCaloriesRaw, currentIntake.hi, currentIntake.lo);

  return {
    bmrRaw,
    todayConsumptionRaw,
    targetCaloriesRaw,
    bmr: Math.round(bmrRaw),
    todayConsumption: Math.round(todayConsumptionRaw),
    targetCalories: Math.round(targetCaloriesRaw),
  };
})();

console.log("기존 계산값 (수정 전):");
console.log("  BMR 원값=1632.5 반올림=1633");
console.log("  todayConsumption 원값=2530.375 반올림=2530");
console.log("  targetCalories 원값=2030.375 반올림=2030");

const bmrOk = Math.abs(r7.bmrRaw - 1632.5) < 0.001 && r7.bmr === 1633;
const tdeeOk = Math.abs(r7.todayConsumptionRaw - 2530.375) < 0.001 && r7.todayConsumption === 2530;
const targetOk = Math.abs(r7.targetCaloriesRaw - 2030.375) < 0.001 && r7.targetCalories === 2030;

console.log("현재 계산값 (수정 후):");
console.log(`  BMR 원값=${r7.bmrRaw} 반올림=${r7.bmr}`);
console.log(`  todayConsumption 원값=${r7.todayConsumptionRaw} 반올림=${r7.todayConsumption}`);
console.log(`  targetCalories 원값=${r7.targetCaloriesRaw} 반올림=${r7.targetCalories}`);

console.log("\n일치 여부:");
console.log(`  BMR: ${bmrOk ? '✅ 통과' : '❌ 실패'}`);
console.log(`  todayConsumption: ${tdeeOk ? '✅ 통과' : '❌ 실패'}`);
console.log(`  targetCalories: ${targetOk ? '✅ 통과' : '❌ 실패'}`);

console.log("\n\n##################################################################");
console.log("테스트 완료");
console.log("##################################################################");

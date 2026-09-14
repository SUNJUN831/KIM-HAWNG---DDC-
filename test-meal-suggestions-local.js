#!/usr/bin/env node
// test-meal-suggestions-local.js
// api/calculate.js 에서 generateMealSuggestions 함수 코드와 BMR/목표 계산 로직을
// 그대로 추출해서 순수 함수로 테스트 (handler 호출 아님, Solar 호출 아님)

// ===== BMR 계산 =====
function calcBMR({ gender, age, height, weight }) {
  if (gender === 'male') {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    return 10 * weight + 6.25 * height - 5 * age - 161;
  }
}

// ===== 오늘 예상 소비칼로리 =====
function calcTodayConsumption(bmrRaw, activityLevel) {
  return bmrRaw * activityLevel;
}

// ===== 오늘 목표 섭취칼로리 =====
function calcTargetCalories(todayConsumptionRaw, goal) {
  if (goal === 'loss') {
    return todayConsumptionRaw - 500;
  } else if (goal === 'maintain') {
    return todayConsumptionRaw;
  } else { // gain
    return todayConsumptionRaw + 300;
  }
}

// ===== generateMealSuggestions (api/calculate.js 에서 그대로 복사) =====
function generateMealSuggestions({ goal, remainingLo, remainingHi, foods = [], plannedFoodsResult = [] }) {
  const suggestions = [];
  const avgRemaining = (remainingLo + remainingHi) / 2;

  const light = [
    { name: "견과류 한 줌 (약 20~30g)", low: 120, high: 200, note: "간식" },
    { name: "사과 + 플레인 요거트", low: 150, high: 230, note: "가벼운 간식 느낌" },
    { name: "계란빵 1개", low: 200, high: 350, note: "간식·간편" },
    { name: "닭가슴살 샐러드 (드레싱 포함)", low: 300, high: 450, note: "가벼운 식사" },
  ];
  const normal = [
    { name: "참치김밥 1줄", low: 300, high: 500, note: "한 끼 부담 적은 편" },
    { name: "샌드위치 (일반 햄/참치 등)", low: 350, high: 500, note: "한 끼로 무난한 편" },
  ];
  const heavier = [
    { name: "소고기 김밥 1줄", low: 400, high: 600, note: "제법 포만감" },
    { name: "치즈돈까스 작은 조각 (약 2~3조각)", low: 400, high: 650, note: "고열량, 나눠 먹기" },
  ];

  const pickFrom = (arr, count) => {
    const picked = [];
    for (const item of arr) {
      if (picked.length >= count) break;
      picked.push(item);
    }
    return picked;
  };

  if (goal === 'loss') {
    const first = pickFrom(
      [...light].sort((a, b) => (a.low + a.high) - (b.low + b.high)),
      2
    );
    const second = pickFrom(
      [...normal].sort((a, b) => (a.low + a.high) - (b.low + b.high)),
      2
    );
    suggestions.push(...first, ...second);
  } else if (goal === 'gain') {
    const all = [
      ...light,
      ...normal,
      ...heavier,
    ].sort((a, b) => (b.low + b.high) - (a.low + a.high));
    suggestions.push(...pickFrom(all, 4));
  } else {
    const all = [...light, ...normal, ...heavier];
    suggestions.push(...pickFrom(all, 4));
  }

  return suggestions.slice(0, 4).map((item) => ({
    name: item.name,
    rangeLow: item.low,
    rangeHigh: item.high,
    note:
      item.note +
      (goal === "loss" && (item.low + item.high) / 2 > avgRemaining / 2
        ? " 남은 칼로리를 한 끼에 다 채우기보다 나눠 먹는 편이 좋아."
        : ""),
  }));
}

// ===== 현재 섭취량 계산 =====
function calcCurrentIntake(foods) {
  const lo = foods.reduce((s, f) => s + (f.calLow ?? 0), 0);
  const hi = foods.reduce((s, f) => s + (f.calHigh ?? 0), 0);
  return { lo, hi };
}

// ===== 남은 칼로리 범위 =====
function calcRemaining(targetCalories, currentIntakeHi, currentIntakeLo) {
  return {
    lo: targetCalories - currentIntakeHi,
    hi: targetCalories - currentIntakeLo,
  };
}

// ===== 테스트 헬퍼 =====
function runCase(label, { profile, activityLevel, eatenFoods, plannedFoods }) {
  console.log(`\n=== ${label} ===`);
  
  // BMR 계산
  const bmrRaw = calcBMR(profile);
  const bmr = Math.round(bmrRaw);
  
  // 오늘 예상 소비
  const todayConsumptionRaw = calcTodayConsumption(bmrRaw, activityLevel);
  const todayConsumption = Math.round(todayConsumptionRaw);
  
  // 목표
  const targetCaloriesRaw = calcTargetCalories(todayConsumptionRaw, profile.goal);
  const targetCalories = Math.round(targetCaloriesRaw);
  
  // 현재 섭취량 (가상: 각 음식의 calLow/calHigh 사용)
  const currentIntake = calcCurrentIntake(eatenFoods);
  const currentIntakeLo = Math.round(currentIntake.lo);
  const currentIntakeHi = Math.round(currentIntake.hi);
  
  // 남은 칼로리
  const remaining = calcRemaining(targetCalories, currentIntakeHi, currentIntakeLo);
  const remainingLo = Math.round(remaining.lo);
  const remainingHi = Math.round(remaining.hi);
  
  console.log(`BMR(원값): ${bmrRaw}, 반올림: ${bmr}`);
  console.log(`todayConsumption(원값): ${todayConsumptionRaw}, 반올림: ${todayConsumption}`);
  console.log(`targetCalories(원값): ${targetCaloriesRaw}, 반올림: ${targetCalories}`);
  console.log(`현재 섭취: ${currentIntakeLo}~${currentIntakeHi}`);
  console.log(`남은 칼로리: ${remainingLo}~${remainingHi}`);
  
  // mealSuggestions 생성 (예정 음식이 있으면 빈 배열)
  const mealSuggestions = (plannedFoods && plannedFoods.length > 0)
    ? []
    : generateMealSuggestions({ goal: profile.goal, remainingLo, remainingHi });
  
  console.log(`mealSuggestions (length: ${mealSuggestions.length}):`);
  console.log(JSON.stringify(mealSuggestions, null, 2));
  
  return { bmr, todayConsumption, targetCalories, currentIntakeLo, currentIntakeHi, remainingLo, remainingHi, mealSuggestions };
}

// ==================== 테스트 실행 ====================

// 케이스 1: 예정 음식 없음 + 남은 칼로리 넉넉함 → 추천 약 4개 생성
console.log("\n\n############################################################");
console.log("케이스 1: 예정 음식 없음 + 남은 칼로리 넉넉함 → 추천 약 4개 생성");
console.log("############################################################");
runCase("케이스 1", {
  profile: { gender: 'male', age: 25, height: 170, weight: 69, goal: 'loss' },
  activityLevel: 1.55,
  eatenFoods: [],  // 아직 안 먹음 → 남은 칼로리 넉넉
  plannedFoods: []
});

// 케이스 2: 예정 음식 있음 → mealSuggestions가 빈 배열인지
console.log("\n\n############################################################");
console.log("케이스 2: 예정 음식 있음 → mealSuggestions가 빈 배열인지");
console.log("############################################################");
runCase("케이스 2", {
  profile: { gender: 'male', age: 25, height: 170, weight: 69, goal: 'loss' },
  activityLevel: 1.55,
  eatenFoods: [{ name: "김밥 1줄", calLow: 300, calHigh: 500 }],
  plannedFoods: [{ name: "삼겹살 200g", calLow: 530, calHigh: 930 }]
});

// 케이스 3: 감량 목표 → 추천 4개가 전부 저칼로리 음식으로 편향되지 않는지
console.log("\n\n############################################################");
console.log("케이스 3a: 감량 목표 (예정 없음, 아직 안 먹음) → 저칼로리 편향 여부 확인");
console.log("############################################################");
const result3a = runCase("케이스 3a", {
  profile: { gender: 'male', age: 25, height: 170, weight: 69, goal: 'loss' },
  activityLevel: 1.55,
  eatenFoods: [],
  plannedFoods: []
});
// 확인: 4개 중 light 2개(견과류, 사과+요거트) + normal 2개(참치김밥, 샌드위치)
// → 저칼로리 편향 맞음 (heavier 없음)

console.log("\n\n############################################################");
console.log("케이스 3b: 유지 목표 (예정 없음, 아직 안 먹음) → 비교용");
console.log("############################################################");
const result3b = runCase("케이스 3b", {
  profile: { gender: 'male', age: 25, height: 170, weight: 69, goal: 'maintain' },
  activityLevel: 1.55,
  eatenFoods: [],
  plannedFoods: []
});

console.log("\n\n############################################################");
console.log("케이스 3c: 증량 목표 (예정 없음, 아직 안 먹음) → 비교용");
console.log("############################################################");
const result3c = runCase("케이스 3c", {
  profile: { gender: 'male', age: 25, height: 170, weight: 69, goal: 'gain' },
  activityLevel: 1.55,
  eatenFoods: [],
  plannedFoods: []
});

// 케이스 4: 남은 칼로리가 적을 때 → 지나치게 높은 칼로리 메뉴만 추천하지 않는지
console.log("\n\n############################################################");
console.log("케이스 4: 이미 많이 먹음 (라면+계란+김밥) 남은 칼로리 적음 → 고열량만 추천하지 않는지");
console.log("############################################################");
const result4 = runCase("케이스 4", {
  profile: { gender: 'male', age: 25, height: 170, weight: 69, goal: 'loss' },
  activityLevel: 1.55,
  eatenFoods: [
    { name: "라면 1개", calLow: 500, calHigh: 600 },
    { name: "계란 2개", calLow: 140, calHigh: 160 },
    { name: "김밥 1줄", calLow: 300, calHigh: 500 }
  ],
  plannedFoods: []
});

// 케이스 5: 이미 먹은 음식과 동일하거나 매우 유사한 메뉴가 추천에서 제외되는지
console.log("\n\n############################################################");
console.log("케이스 5: 라면 먹고 난 뒤 → 라면류/유사 메뉴 제외 여부 확인");
console.log("############################################################");
const result5 = runCase("케이스 5", {
  profile: { gender: 'male', age: 25, height: 170, weight: 69, goal: 'loss' },
  activityLevel: 1.55,
  eatenFoods: [{ name: "라면 1개", calLow: 500, calHigh: 600 }],
  plannedFoods: []
});

// 케이스 6: "서울 여행지 3곳 추천해줘" 범위 밖 입력 → 여전히 400인지
console.log("\n\n############################################################");
console.log("케이스 6: '서울 여행지 3곳 추천해줘' (식단 무관) → 범위 밖 처리 확인");
console.log("############################################################");
console.log("※ 이 케이스는 handler 로직이라 generateMealSuggestions만으로는 확인 불가");
console.log("※ 현재 api/calculate.js handler 코드 기준:");
console.log("   - eatenFoods: ['서울 여행지 3곳 추천해줘']");
console.log("   - interpretFoodsWithSolar 호출 → Solar가 '음식이 아닌 것'으로 판단");
console.log("   - calLow=0, calHigh=0, note='추정 불가'로 반환");
console.log("   - allNonFood 체크: 모든 음식이 calLow=0 & calHigh=0 → true");
console.log("   - → 400 응답: '입력한 내용 중 음식이 아닌 항목이 있어요...'");
console.log("※ handler 로직(400 처리)은 이미 api/calculate.js에 구현되어 있음 (lines 71-80)");

// 케이스 7: 기존 BMR·오늘 예상 소비·목표 칼로리 계산값이 수정 전과 동일한지
console.log("\n\n############################################################");
console.log("케이스 7: 기존 계산값 수정 전과 동일 여부 확인");
console.log("############################################################");
const result7 = runCase("케이스 7 (감량 남성 25세/170/69/활동보통, 먹은 것 없음)", {
  profile: { gender: 'male', age: 25, height: 170, weight: 69, goal: 'loss' },
  activityLevel: 1.55,
  eatenFoods: [],
  plannedFoods: []
});
console.log("\n## 기존 계산값 (수정 전) ##");
console.log("BMR(원값): 1632.5, 반올림: 1633");
console.log("todayConsumption(원값): 2530.375, 반올림: 2530");
console.log("targetCalories(원값): 2030.375, 반올림: 2030");
console.log("\n## 현재 계산값 (수정 후) ##");
console.log(`BMR(원값): ${result7.bmrRaw}, 반올림: ${result7.bmr}`);
console.log(`todayConsumption(원값): ${result7.todayConsumptionRaw}, 반올림: ${result7.todayConsumption}`);
console.log(`targetCalories(원값): ${result7.targetCaloriesRaw}, 반올림: ${result7.targetCalories}`);

// 일치 여부 확인
console.log("\n## 일치 여부 ##");
const bmrOk = Math.abs(result7.bmrRaw - 1632.5) < 0.001 && result7.bmr === 1633;
const tdeeOk = Math.abs(result7.todayConsumptionRaw - 2530.375) < 0.001 && result7.todayConsumption === 2530;
const targetOk = Math.abs(result7.targetCaloriesRaw - 2030.375) < 0.001 && result7.targetCalories === 2030;
console.log(`BMR: ${bmrOk ? '✅ 일치' : '❌ 불일치'}`);
console.log(`todayConsumption: ${tdeeOk ? '✅ 일치' : '❌ 불일치'}`);
console.log(`targetCalories: ${targetOk ? '✅ 일치' : '❌ 불일치'}`);

console.log("\n\n############################################################");
console.log("테스트 완료");
console.log("############################################################");

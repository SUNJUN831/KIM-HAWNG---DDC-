// 순수 계산 모듈 — BMR, TDEE, 목표 칼로리, 매크로 분석, 매크로 필터 설정

/** Mifflin-St Jeor 기반 BMR + 오늘 소비칼로리 + 목표 칼로리 계산 */
export function calculateProfileMetrics(profile, activityLevel) {
  const gender = profile.gender === 'male' ? 'male' : 'female';
  let bmrRaw;
  if (gender === 'male') {
    bmrRaw = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
  } else {
    bmrRaw = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161;
  }

  const todayConsumptionRaw = bmrRaw * activityLevel;

  let targetCaloriesRaw;
  if (profile.goal === 'loss') {
    targetCaloriesRaw = todayConsumptionRaw - 500;
  } else if (profile.goal === 'maintain') {
    targetCaloriesRaw = todayConsumptionRaw;
  } else {
    targetCaloriesRaw = todayConsumptionRaw + 300;
  }

  return { bmrRaw, todayConsumptionRaw, targetCaloriesRaw };
}

/** 먹은 음식의 탄단지 합산 + 분석 문구 */
export function buildMacroAnalysis(foods, profile, targetCaloriesRaw, foodHistory = []) {
  if (!foods || foods.length === 0) {
    return {
      totalCalLow: 0,
      totalCalHigh: 0,
      totalCalAvg: 0,
      totalProt_g: 0,
      totalFat_g: 0,
      totalCarbs_g: 0,
      targetProtein_g: 0,
      targetFat_g: 0,
      targetCarbs_g: 0,
      analysis: '아직 먹은 음식이 없어요.',
    };
  }

  const totalCalLow = foods.reduce((s, f) => s + (f.calLow || 0), 0);
  const totalCalHigh = foods.reduce((s, f) => s + (f.calHigh || 0), 0);
  const totalCalAvg = Math.round((totalCalLow + totalCalHigh) / 2);
  const totalProt_g = foods.reduce((s, f) => s + (f.prot_g || 0), 0);
  const totalFat_g = foods.reduce((s, f) => s + (f.fat_g || 0), 0);
  const totalCarbs_g = foods.reduce((s, f) => s + (f.carbs_g || 0), 0);

  const weight = profile.weight;
  const proteinPerKg = profile.goal === 'loss' ? 1.5 : profile.goal === 'gain' ? 1.4 : 1.2;
  const targetProtein_g = Math.round(weight * proteinPerKg);
  const targetFat_g = Math.round(weight * 0.9);
  const remainingForCarbs = Math.max(0, targetCaloriesRaw - targetProtein_g * 4 - targetFat_g * 9);
  const targetCarbs_g = Math.round(remainingForCarbs / 4);

  const calDiff = totalCalAvg - targetCaloriesRaw;
  const calStatus = calDiff > 0 ? '섭취 칼로리가 목표보다 다소 높아요.' : calDiff < 0 ? '섭취 칼로리가 목표보다 낮아요.' : '섭취 칼로리가 목표 범위예요.';

  const carbCal = totalCarbs_g * 4;
  const fatCal = totalFat_g * 9;
  const protCal = totalProt_g * 4;
  const totalMacroCal = carbCal + fatCal + protCal;
  const carbRatio = totalMacroCal > 0 ? carbCal / totalMacroCal : 0;
  const fatRatio = totalMacroCal > 0 ? fatCal / totalMacroCal : 0;
  const protRatio = totalMacroCal > 0 ? protCal / totalMacroCal : 0;

  const carbRatioDesc = carbRatio > 0.55 ? '높아요' : carbRatio < 0.45 ? '낮아요' : '적정해요';
  const fatRatioDesc = fatRatio > 0.35 ? '높아요' : fatRatio < 0.20 ? '낮아요' : '적정해요';
  const protRatioDesc = protRatio > 0.30 ? '높아요' : protRatio < 0.15 ? '낮아요' : '적정해요';

  const carbMsg = `탄수화물 비중이 ${carbRatioDesc} (약 ${Math.round(carbRatio * 100)}%).`;
  const fatMsg = `지방 비중이 ${fatRatioDesc} (약 ${Math.round(fatRatio * 100)}%).`;
  const protMsg = `단백질 비중이 ${protRatioDesc} (약 ${Math.round(protRatio * 100)}%).`;

  const protGap = totalProt_g - targetProtein_g;
  const fatGap = totalFat_g - targetFat_g;
  const carbsGap = totalCarbs_g - targetCarbs_g;

  const protGapMsg = protGap > 0 ? `단백질은 목표 대비 약 ${Math.round(protGap)}g 많아요.` : protGap < 0 ? `단백질은 목표 대비 약 ${Math.round(Math.abs(protGap))}g 부족해요.` : '단백질은 목표 수준이에요.';
  const fatGapMsg = fatGap > 0 ? `지방은 목표 대비 약 ${Math.round(fatGap)}g 많아요.` : fatGap < 0 ? `지방은 목표 대비 약 ${Math.round(Math.abs(fatGap))}g 부족해요.` : '지방은 목표 수준이에요.';
  const carbsGapMsg = carbsGap > 0 ? `탄수화물은 목표 대비 약 ${Math.round(carbsGap)}g 많아요.` : carbsGap < 0 ? `탄수화물은 목표 대비 약 ${Math.round(Math.abs(carbsGap))}g 부족해요.` : '탄수화물은 목표 수준이에요.';

  const analysis = [
    calStatus,
    `탄단지 비중: ${carbMsg} ${fatMsg} ${protMsg}`,
    `목표 대비: ${protGapMsg} ${fatGapMsg} ${carbsGapMsg}`,
  ].join(' ');

  return {
    totalCalLow,
    totalCalHigh,
    totalCalAvg,
    totalProt_g: Math.round(totalProt_g),
    totalFat_g: Math.round(totalFat_g),
    totalCarbs_g: Math.round(totalCarbs_g),
    targetProtein_g,
    targetFat_g,
    targetCarbs_g,
    analysis,
  };
}

/** 매크로 분석 결과 기반 추천 필터 설정 생성 */
export function buildMacroFilterConfig(macroAnalysis, profile, targetCaloriesRaw) {
  const avoidCodes = new Set();
  const boostCodes = new Set();
  const hints = [];

  const { totalCalAvg, totalProt_g, totalFat_g, totalCarbs_g, targetProtein_g, targetFat_g, targetCarbs_g } = macroAnalysis;
  const totalMacroCal = totalCarbs_g * 4 + totalFat_g * 9 + totalProt_g * 4;
  const carbRatio = totalMacroCal > 0 ? (totalCarbs_g * 4) / totalMacroCal : 0;
  const fatRatio = totalMacroCal > 0 ? (totalFat_g * 9) / totalMacroCal : 0;
  const protGap = totalProt_g - targetProtein_g;
  const fatGap = totalFat_g - targetFat_g;

  if (carbRatio > 0.50) {
    avoidCodes.add('01'); avoidCodes.add('02'); avoidCodes.add('03'); avoidCodes.add('04');
    hints.push('탄수화물 비중이 높은 편이에요. 밥·빵·면·죽·스프보다는 채소·단백질 위주로 채워 보세요.');
  }
  if (carbRatio < 0.35) {
    boostCodes.add('01'); boostCodes.add('03'); boostCodes.add('04');
    hints.push('탄수화물 비중이 낮은 편이에요. 밥·빵·면류를 적절히 포함해 보세요.');
  }

  if (protGap < -20) {
    boostCodes.add('05'); boostCodes.add('06'); boostCodes.add('07'); boostCodes.add('08');
    hints.push('단백질이 부족해요. 국·탕·찌개·찜·구이류처럼 단백질이 넉넉한 메뉴를 우선해 보세요.');
  }
  if (protGap > 30) {
    avoidCodes.add('08'); avoidCodes.add('09');
    hints.push('단백질 섭취가 많은 편이에요. 추가 단백질보다 채소·탄수화물을 챙겨 보세요.');
  }

  if (fatGap > 15) {
    avoidCodes.add('08'); avoidCodes.add('09'); avoidCodes.add('12');
    hints.push('지방 섭취가 많은 편이에요. 구이·부침·튀김처럼 기름진 음식은 피하고 담백한 쪽을 선택해 보세요.');
  }
  if (fatGap < -15) {
    boostCodes.add('08'); boostCodes.add('12');
    hints.push('지방 섭취가 부족한 편이에요. 구이·튀김처럼 지방이 있는 음식도 괜찮아요.');
  }

  const calDeficit = totalCalAvg < targetCaloriesRaw;
  if (calDeficit && totalCalAvg < targetCaloriesRaw * 0.8) {
    hints.push('섭취 칼로리가 목표보다 현저히 낮아요. 포만감을 줄 수 있는 넉넉한 메뉴로 채워 보세요.');
  }
  const calSurplus = totalCalAvg > targetCaloriesRaw;
  if (calSurplus && totalCalAvg > targetCaloriesRaw * 1.1) {
    avoidCodes.add('12');
    hints.push('섭취 칼로리가 목표보다 높아요. 가벼운 메뉴로 마무리해 보세요.');
  }

  const solarHint = hints.length > 0 ? hints.join(' ') : '';

  return { avoidCodes, boostCodes, solarHint };
}

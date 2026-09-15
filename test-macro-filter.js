import 'dotenv/config';
import { buildMacroFilterConfig } from './api/calculate.js';

console.log('=== buildMacroFilterConfig 직접 테스트 ===\n');

// 시나리오 1: 탄수화물 비중 높음 (carbRatio > 0.50)
const scenario1 = {
  totalCalAvg: 1100,
  targetCaloriesRaw: 1500,
  carbRatio: 0.55,
  fatRatio: 0.25,
  protRatio: 0.18,
  protGap: -37,
  fatGap: -12,
  carbsGap: -47,
};

console.log('시나리오 1: 탄수화물 비중 높음 (carbRatio=0.55)');
const result1 = buildMacroFilterConfig(scenario1, { weight: 58, goal: 'loss' });
console.log('avoidCodes:', Array.from(result1.avoidCodes).sort());
console.log('boostCodes:', Array.from(result1.boostCodes).sort());
console.log('solarHint:', result1.solarHint);
console.log('');

// 시나리오 2: 지방 과다 (fatGap > 15)
const scenario2 = {
  totalCalAvg: 1300,
  targetCaloriesRaw: 1500,
  carbRatio: 0.45,
  fatRatio: 0.35,
  protRatio: 0.20,
  protGap: -10,
  fatGap: 18,
  carbsGap: -30,
};

console.log('시나리오 2: 지방 과다 (fatGap=18)');
const result2 = buildMacroFilterConfig(scenario2, { weight: 58, goal: 'loss' });
console.log('avoidCodes:', Array.from(result2.avoidCodes).sort());
console.log('boostCodes:', Array.from(result2.boostCodes).sort());
console.log('solarHint:', result2.solarHint);
console.log('');

// 시나리오 3: 단백질 부족 (protGap < -20)
const scenario3 = {
  totalCalAvg: 1200,
  targetCaloriesRaw: 1500,
  carbRatio: 0.40,
  fatRatio: 0.30,
  protRatio: 0.30,
  protGap: -25,
  fatGap: 5,
  carbsGap: -40,
};

console.log('시나리오 3: 단백질 부족 (protGap=-25)');
const result3 = buildMacroFilterConfig(scenario3, { weight: 58, goal: 'loss' });
console.log('avoidCodes:', Array.from(result3.avoidCodes).sort());
console.log('boostCodes:', Array.from(result3.boostCodes).sort());
console.log('solarHint:', result3.solarHint);
console.log('');

// 시나리오 4: 모든 문제 없음 (기본 상태)
const scenario4 = {
  totalCalAvg: 1500,
  targetCaloriesRaw: 1500,
  carbRatio: 0.50,
  fatRatio: 0.25,
  protRatio: 0.25,
  protGap: 0,
  fatGap: 0,
  carbsGap: 0,
};

console.log('시나리오 4: 모든 문제 없음 (목표 달성 상태)');
const result4 = buildMacroFilterConfig(scenario4, { weight: 58, goal: 'loss' });
console.log('avoidCodes:', Array.from(result4.avoidCodes).sort());
console.log('boostCodes:', Array.from(result4.boostCodes).sort());
console.log('solarHint:', result4.solarHint);

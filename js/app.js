import { $, loadProfile, saveProfile, loadToday, saveToday, clearToday, MEAL_KEYS, todayKey, LS_PROFILE_KEY, showElem, hideElem } from './state.js';
import { fetchCalculation } from './api.js';
import { displayProfile, renderProfileForm, renderTodayForm, resetProfile } from './forms.js';
import { renderFoodLog, renderMealSummary, renderSuggestions, renderResult } from './results.js';

async function runCalc() {
  const profile = loadProfile();
  if (!profile) {
    alert('프로필을 먼저 저장해주세요.');
    return;
  }

  const activityLevel = $('activityLevel').value;
  const mealBreakfast = $('mealBreakfast').value.trim();
  const mealLunch = $('mealLunch').value.trim();
  const mealDinner = $('mealDinner').value.trim();
  const mealSnack = $('mealSnack').value.trim();
  const plannedRaw = $('plannedFoods').value.trim();

  saveToday({
    activityLevel,
    meals: {
      breakfast: mealBreakfast,
      lunch: mealLunch,
      dinner: mealDinner,
      snack: mealSnack,
    },
    plannedFoods: plannedRaw,
    savedAt: new Date().toISOString()
  });

  const payload = {
    profile,
    activityLevel: parseFloat(activityLevel),
    meals: {
      breakfast: mealBreakfast,
      lunch: mealLunch,
      dinner: mealDinner,
      snack: mealSnack,
    },
    plannedFoods: plannedRaw ? plannedRaw.split('\n').map(s => s.trim()).filter(Boolean) : []
  };

  hideElem('resultSection');
  $('strategyContent').innerHTML = '<div class="empty">계산 중이에요…</div>';
  showElem('resultSection');
  showElem('strategyContent');

  try {
    const data = await fetchCalculation(payload);
    renderResult(data);
  } catch (e) {
    $('strategyContent').innerHTML =
      `<div class="strategy-box" style="border-left-color:var(--warn);">계산 중 오류가 발생했어요: ${esc(e.message)}</div>`;
    console.error(e);
  }
}

// 프로필 저장
$('saveProfileBtn').addEventListener('click', () => {
  const gender = $('gender').value;
  const age = parseInt($('age').value, 10);
  const height = parseFloat($('height').value);
  const weight = parseFloat($('weight').value);
  const goal = $('goal').value;
  if (!gender || !age || !height || !weight || !goal) {
    alert('모든 항목을 입력해주세요.');
    return;
  }
  if (height < 120 || height > 250) {
    alert('키 입력이 이상해요. 120cm 이상 250cm 이하로 입력해주세요.');
    return;
  }
  if (weight < 30 || weight > 300) {
    alert('체중 입력이 이상해요. 30kg 이상 300kg 이하로 입력해주세요.');
    return;
  }
  saveProfile({ gender, age, height, weight, goal });
  displayProfile({ gender, age, height, weight, goal });
});

$('resetProfileBtn').addEventListener('click', resetProfile);
$('resetProfileBtn2').addEventListener('click', resetProfile);

// 오늘 기록 저장
$('saveTodayBtn').addEventListener('click', runCalc);

$('clearTodayBtn').addEventListener('click', () => {
  if (!confirm('오늘 기록을 초기화할까요?')) return;
  clearToday();
  $('mealBreakfast').value = '';
  $('mealLunch').value = '';
  $('mealDinner').value = '';
  $('mealSnack').value = '';
  $('plannedFoods').value = '';
  $('activityLevel').value = '1.55';
  hideElem('resultSection');
});

// 초기 로딩
(function init() {
  const profile = loadProfile();
  if (profile) {
    displayProfile(profile);
  } else {
    renderProfileForm(null);
  }
  const today = loadToday();
  $('dateLabel').textContent = '오늘의 기록 · ' + todayKey();
  if (today) {
    renderTodayForm(today);
  }
  if (profile && today) {
    const hasMeals = today.meals && typeof today.meals === 'object' && !Array.isArray(today.meals)
      && Object.values(today.meals).some(v => v && typeof v === 'string' && v.trim());
    if (hasMeals || today.plannedFoods) {
      setTimeout(runCalc, 300);
    }
  }
})();

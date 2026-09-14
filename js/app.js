import { $, fmt, loadProfile, saveProfile, loadToday, saveToday, clearToday, MEAL_KEYS, todayKey, LS_PROFILE_KEY, showElem, hideElem, esc } from './state.js';
import { fetchCalculation } from './api.js';
import { displayProfile, renderProfileForm, renderTodayForm, resetProfile } from './forms.js';
import { renderFoodLog, renderMealSummary, renderSuggestions, renderResult } from './results.js';

// 오늘의 상태 카드 — 목표 칼로리만 표시(현재 섭취/남은/진행바는 초기 상태)
async function refreshStateCardTargetOnly(profile, activityLevelValue) {
  if (!profile) return;
  try {
    const payload = {
      profile,
      activityLevel: parseFloat(activityLevelValue),
      meals: { breakfast: '', lunch: '', dinner: '', snack: '' },
      plannedFoods: [],
    };
    const data = await fetchCalculation(payload);
    const goalLabel = data.goal === 'loss' ? '감량' : data.goal === 'maintain' ? '유지' : '증량';
    $('goalValue').textContent = fmt(data.targetCalories) + ' kcal (' + goalLabel + ')';
    $('currentIntakeValue').textContent = '—';
    $('remainingValue').textContent = '—';
    const fill = $('progressFill');
    if (fill) fill.style.width = '0%';
    $('progressCurrent').textContent = '—';
    $('progressGoal').textContent = '목표 ' + fmt(data.targetCalories) + ' kcal';
    $('goalNote').textContent = '현재 프로필 기준으로 오늘 목표 섭취량은 ' + fmt(data.targetCalories) + ' kcal (' + goalLabel + ')예요.';
  } catch (e) {
    console.error('상태 카드 목표 갱신 실패', e);
  }
}

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
  hideElem('todayStateSection');
  $('strategyContent').innerHTML = '<div class="empty">계산 중이에요…</div>';
  showElem('resultSection');
  showElem('todayStateSection');
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
  showElem('todayStateSection');
  refreshStateCardTargetOnly(loadProfile(), $('activityLevel').value);
});

$('resetProfileBtn').addEventListener('click', resetProfile);
$('resetProfileBtn2').addEventListener('click', resetProfile);

// 오늘 기록 저장
$('saveTodayBtn').addEventListener('click', runCalc);

$('saveTodayBtn').addEventListener('click', () => {
  const saveStatus = $('saveStatus');
  const saveStatusTime = $('saveStatusTime');

  if (!saveStatus || !saveStatusTime) return;

  const now = new Date();

  const dateText = now.toLocaleDateString('ko-KR');
  const timeText = now.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  saveStatusTime.textContent = `${dateText} ${timeText} 저장`;
  saveStatus.classList.add('show');
});
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
  if (loadProfile()) {
    refreshStateCardTargetOnly(loadProfile(), $('activityLevel').value);
  }
});

// 초기 로딩
(function init() {
  const profile = loadProfile();
  if (profile) {
    displayProfile(profile);
    // 새로고침 시 자동 계산/상태 카드 갱신 안 함 — 저장 버튼 누를 때만
    hideElem('todayStateSection');
  } else {
    renderProfileForm(null);
    hideElem('todayStateSection');
  }
  
  const today = loadToday();
  $('dateLabel').textContent = '오늘의 기록 · ' + todayKey();
  if (today) {
    renderTodayForm(today);
  }
  if (profile && today) {
    const hasMeals = today.meals && typeof today.meals === 'object' && !Array.isArray(today.meals)
      && Object.values(today.meals).some(v => v && typeof v === 'string' && v.trim());
    const hasPlanned = today.plannedFoods && typeof today.plannedFoods === 'string' && today.plannedFoods.trim();
    // 자동 재계산은 띄우지 않음 — 저장 버튼 누를 때만 runCalc()
    if (hasMeals || hasPlanned) {
      // 과거: setTimeout(runCalc, 300);  // 자동 계산 끄기
    }
  }
})();

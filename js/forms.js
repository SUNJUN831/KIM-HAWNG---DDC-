// 프로필·오늘 폼 렌더링

import { $, loadProfile, saveProfile, LS_PROFILE_KEY } from './state.js';

function displayProfile(p) {
  $('profileForm').classList.add('hidden');
  $('profileSaved').classList.remove('hidden');
  $('profileHint').classList.add('hidden');
  $('profileDisplay').textContent =
    `${p.gender === 'male' ? '남성' : '여성'} / ${p.age}세 / ${p.height}cm / ${p.weight}kg / ${p.goal === 'loss' ? '감량' : p.goal === 'maintain' ? '유지' : '증량'}`;
}

function renderProfileForm(p) {
  if (!p) return;
  $('gender').value = p.gender;
  $('age').value = p.age;
  $('height').value = p.height;
  $('weight').value = p.weight;
  $('goal').value = p.goal;
}

function renderTodayForm(t) {
  if (!t) return;
  $('activityLevel').value = t.activityLevel || '1.55';
  if (t.meals && typeof t.meals === 'object' && !Array.isArray(t.meals)) {
    $('mealBreakfast').value = (t.meals.breakfast || '').trim();
    $('mealLunch').value = (t.meals.lunch || '').trim();
    $('mealDinner').value = (t.meals.dinner || '').trim();
    $('mealSnack').value = (t.meals.snack || '').trim();
  } else {
    $('mealBreakfast').value = '';
    $('mealLunch').value = '';
    $('mealDinner').value = '';
    $('mealSnack').value = '';
  }
  $('plannedFoods').value = t.plannedFoods || '';
}

function resetProfile() {
  localStorage.removeItem(LS_PROFILE_KEY);
  $('profileForm').classList.remove('hidden');
  $('profileSaved').classList.add('hidden');
  $('profileHint').classList.remove('hidden');
  $('age').value = '';
  $('height').value = '';
  $('weight').value = '';
}

export { displayProfile, renderProfileForm, renderTodayForm, resetProfile };

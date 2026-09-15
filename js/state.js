// 데이터 상태 관리 — localStorage + DOM 유틸

const $ = (id) => document.getElementById(id);
const LS_PROFILE_KEY = 'ddc_profile';
const LS_TODAY_PREFIX = 'ddc_today_';

const MEAL_KEYS = [
  { key: 'breakfast', label: '아침' },
  { key: 'lunch', label: '점심' },
  { key: 'dinner', label: '저녁' },
  { key: 'snack', label: '간식' },
];

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function loadProfile() {
  try {
    const raw = localStorage.getItem(LS_PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || !p.gender || !p.age || !p.height || !p.weight || !p.goal) return null;
    return p;
  } catch { return null; }
}

function saveProfile(p) {
  localStorage.setItem(LS_PROFILE_KEY, JSON.stringify(p));
}

function loadToday() {
  try {
    const raw = localStorage.getItem(LS_TODAY_PREFIX + todayKey());
    if (!raw) return null;
    const t = JSON.parse(raw);
    if (!t || typeof t.activityLevel !== 'string') return null;
    return t;
  } catch { return null; }
}

function saveToday(t) {
  localStorage.setItem(LS_TODAY_PREFIX + todayKey(), JSON.stringify(t));
}

function clearToday() {
  localStorage.removeItem(LS_TODAY_PREFIX + todayKey());
}

function showElem(id) { $(id).classList.remove('hidden'); }
function hideElem(id) { $(id).classList.add('hidden'); }

function fmt(n) {
  return Math.round(n).toLocaleString();
}

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

export { $, LS_PROFILE_KEY, LS_TODAY_PREFIX, MEAL_KEYS, todayKey, loadProfile, saveProfile, loadToday, saveToday, clearToday, showElem, hideElem, fmt, esc };

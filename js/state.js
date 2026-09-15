// 데이터 상태 관리 — localStorage + DOM 유틸

const $ = (id) => document.getElementById(id);
const LS_PROFILE_KEY = 'ddc_profile';
const LS_TODAY_PREFIX = 'ddc_today_';
const LS_ACTIVE_KEY = 'ddc_active_record_key';

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

function activeRecordKey() {
  try {
    return localStorage.getItem(LS_ACTIVE_KEY);
  } catch { return null; }s
}

function setActiveRecordKey(key) {
  if (!key || typeof key !== 'string' || !key.match(/^\d{4}-\d{2}-\d{2}$/)) return;
  try { localStorage.setItem(LS_ACTIVE_KEY, key); } catch {}
}

function activeTodayKey() {
  const key = activeRecordKey();
  return key || todayKey();
}

function loadTodayByKey(key) {
  try {
    const raw = localStorage.getItem(LS_TODAY_PREFIX + key);
    if (!raw) return null;
    const t = JSON.parse(raw);
    if (!t || typeof t.activityLevel !== 'string') return null;
    return t;
  } catch { return null; }
}

function saveTodayByKey(key, t) {
  localStorage.setItem(LS_TODAY_PREFIX + key, JSON.stringify(t));
}

function clearTodayByKey(key) {
  localStorage.removeItem(LS_TODAY_PREFIX + key);
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
  return loadTodayByKey(activeTodayKey());
}

function saveToday(t) {
  saveTodayByKey(activeTodayKey(), t);
}

function clearToday() {
  clearTodayByKey(activeTodayKey());
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

export { $, LS_PROFILE_KEY, LS_TODAY_PREFIX, LS_ACTIVE_KEY, MEAL_KEYS, todayKey, activeRecordKey, setActiveRecordKey, activeTodayKey, loadTodayByKey, saveTodayByKey, clearTodayByKey, loadProfile, saveProfile, loadToday, saveToday, clearToday, showElem, hideElem, fmt, esc };

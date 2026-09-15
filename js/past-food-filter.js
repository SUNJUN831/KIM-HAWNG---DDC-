import { loadTodayByKey } from './state.js';

// 메시지 전달 예정/기록된 음식명 정규화·추출 (불러오기 전용)
const SEPARATOR_RE = /[,·그리고와과로]+/;

// 과거 기록 필터 예외: 매일 먹는 기본 음식 — 과거 기록과 관계없이 후보에 유지
const PASTE_FILTER_EXCEPTIONS = new Set([
  '밥',
  '쌀밥',
  '잡곡밥',
  '현미밥',
  '흰밥',
  '공기',
]);

export function extractFoodNames(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(SEPARATOR_RE)
    .map(s => s.trim())
    .filter(Boolean)
    .map(normalizeFoodName)
    .filter(s => s.length >= 2);
}

function normalizeFoodName(raw) {
  let s = raw
    .replace(/^\d+개?$/i, '')
    .replace(/\s+\d+개?$/i, '')
    .replace(/\d+인분$/i, '')
    .replace(/\s+\d+인분$/i, '')
    .replace(/(한|두|세|네|다섯)\s*공기$/i, '')
    .replace(/\s*공기$/i, '')
    .replace(/^\d+\s*/, '')
    .trim();
  return s;
}

function isExceptionFood(name) {
  if (!name) return false;
  return PASTE_FILTER_EXCEPTIONS.has(name)
    || PASTE_FILTER_EXCEPTIONS.has(name.replace(/\s.*$/, ''))  // "밥 한 공기" → "밥" 추출
    || PASTE_FILTER_EXCEPTIONS.has(name.split(/\s+/)[0]);     // 첫 단어만 비교
}

export function getRecentFoodNames(daysBack = 2, todayKey) {
  const names = new Set();
  const parts = todayKey.split('-');
  if (parts.length !== 3) return names;
  const [y, m, d] = parts.map(Number);
  const today = new Date(y, m - 1, d);
  for (let i = 0; i < daysBack; i++) {
    const dt = new Date(today);
    dt.setDate(dt.getDate() - i);
    const dateKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    const record = loadTodayByKey(dateKey);
    if (record?.meals) {
      for (const meal of Object.values(record.meals)) {
        extractFoodNames(meal).forEach(n => names.add(n));
      }
    }
  }
  return names;
}

export function isPastFood(candidateName, recentNames) {
  if (!candidateName) return false;
  const cn = candidateName.toLowerCase();
  // 예외 음식(밥 등 매일 먹는 기본 음식)은 과거 기록과 관계없이 통과
  if (isExceptionFood(cn)) return false;
  for (const past of recentNames) {
    const pn = past.toLowerCase();
    if (cn.includes(pn) || pn.includes(cn)) return true;
  }
  return false;
}

export function filterRecentFoods(candidates, daysBack = 2, todayKey) {
  if (!candidates || !Array.isArray(candidates) || candidates.length === 0) return candidates;
  const recentNames = getRecentFoodNames(daysBack, todayKey);
  if (recentNames.size === 0) return candidates;
  return candidates.filter(c => {
    if (!c || typeof c.name !== 'string') return false;
    return !isPastFood(c.name, recentNames);
  });
}

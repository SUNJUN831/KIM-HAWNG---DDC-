// 달력/날짜 선택 전용 로직 (A 방식: picker 선택 날짜가 곧 기록 기준)
// recordDatePicker 값 변경 → 기록 키(activeRecordKey) 전환 → 라벨/폼 갱신

import { $, setActiveRecordKey, todayKey } from './state.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function formatLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '기록 · ' + dateStr;
  return '기록 · ' + d.toLocaleDateString('ko-KR');
}

function syncFromPicker(picker, label) {
  const val = picker.value;
  if (!val || !DATE_RE.test(val)) return;
  setActiveRecordKey(val);
  if (label) label.textContent = formatLabel(val);
}

export function initCalendar() {
  const picker = $('recordDatePicker');
  const label = $('dateLabel');
  if (!picker) return;

  // picker에 값이 없으면 오늘로 채움
  if (!picker.value) {
    const today = todayKey();
    picker.value = today;
  }

  // 초기: 현재 picker 값을 기록 기준 키로 설정
  syncFromPicker(picker, label);

  picker.addEventListener('change', () => {
    const val = picker.value;
    if (!val || !DATE_RE.test(val)) return;
    setActiveRecordKey(val);
    if (label) label.textContent = formatLabel(val);
    window.dispatchEvent(new CustomEvent('recorddate:changed', { detail: { recordKey: val } }));
  });
}

export function todayLabelText() {
  return formatLabel($('recordDatePicker')?.value || todayKey());
}

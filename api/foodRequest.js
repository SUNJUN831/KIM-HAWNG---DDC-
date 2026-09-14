import { FOOD_LV3_CODES, FOOD_LV3_NAMES, FOOD_LV3_SERVING_G, pickRandomCodes } from './foodCategories.js';

const DEFAULT_BASE = 'https://api.data.go.kr/openapi/tn_pubr_public_nutri_food_info_api'; 

function getApiKey() {
  return process.env.FOOD_API_KEY;
}

function getBaseUrl() {
  return process.env.FOOD_API_BASE || DEFAULT_BASE;
}

/**
 * 음식 목록 조회
 * @param {Object} opts
 * @param {number} opts.pageNo
 * @param {number} opts.numOfRows
 * @param {string} opts.type
 * @param {string} opts.foodLv3Cd
 * @returns {Promise<{ foodNm: string, foodSize: string, enerc: string }[]>}
 */
export async function fetchFoodList({
  pageNo = 1,
  numOfRows = 30,
  type = 'json',
  foodLv3Cd = '02',
} = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('FOOD_API_KEY가 설정되지 않았어요. 공공데이터포털 개발계정 서비스키를 Vercel 환경변수에 등록해주세요.');
  }

  const base = getBaseUrl();
  console.log('[DDC] foodRequest baseUrl:', base);
  console.log('[DDC] foodRequest apiKey 길이:', apiKey ? apiKey.length : 0);

  const url = new URL(base);

  url.searchParams.set('serviceKey', decodeURIComponent(apiKey));
  url.searchParams.set('pageNo', String(pageNo));
  url.searchParams.set('numOfRows', String(numOfRows));
  url.searchParams.set('type', type);
  url.searchParams.set('foodLv3Cd', String(foodLv3Cd));
  // 기타 필요한 파라미터가 있으면 여기에 추가 (예: inferType, etc.)

  // 요청 URL 로그 (디버깅용)
  console.log('[DDC] foodRequest 요청 URL:', url.toString());

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`식품성분 API 호출 실패 (${response.status}): ${errText.slice(0, 500)}`);
  }

  const body = await response.json();
  console.log('[DDC] 식품성분 API 원시 응답 (foodRequest):', JSON.stringify(body, null, 2).slice(0, 2000));

  // NODATA_ERROR (resultCode 03) 처리: 데이터가 없는 코드(예: foodLv3Cd='00')일 수 있음.
  // 이 경우 오류 던지지 말고 빈 배열로 반환해서 다음 코드로 넘어가게 한다.
  const header = body?.header;
  if (header && (header.resultCode === '03' || header.resultMsg === 'NODATA_ERROR')) {
    console.log('[DDC] foodRequest NODATA_ERROR — 해당 코드 데이터 없음. 빈 배열로 반환.');
    return [];
  }


  const items = extractItems(body);
  if (!items || items.length === 0) {
    // items가 없으면 빈 배열로 반환 (NODATA_ERROR 외에도 구조 불일치 등 gracefully 처리)
    console.log('[DDC] foodRequest items 없음 — 빈 배열로 반환.');
    return [];
  }

  // 각 항목에서 foodNm, foodSize, enerc, foodLv4Nm, prot, fatce, chocdf 추출
  const rows = items.map((item) => ({
    foodNm: item.foodNm != null ? String(item.foodNm) : undefined,
    foodSize: item.foodSize != null ? String(item.foodSize) : undefined,
    enerc: item.enerc != null ? String(item.enerc) : undefined,
    foodLv4Nm: item.foodLv4Nm != null ? String(item.foodLv4Nm) : undefined,
    prot: item.prot != null ? String(item.prot) : undefined,
    fatce: item.fatce != null ? String(item.fatce) : undefined,
    chocdf: item.chocdf != null ? String(item.chocdf) : undefined,
  }));

  return rows;
}


function extractItems(body) {
  if (!body || typeof body !== 'object') return null;

  // 현재 확인된 실제 구조:
  // {
  //   "header": { ... },
  //   "body": {
  //     "items": { "item": [ ... ] }
  //   }
  // }

  
  if (body.body && body.body.items && body.body.items.item) {
    const items = body.body.items.item;
    if (Array.isArray(items)) return items;
    if (items && typeof items === 'object') return [items];
  }

  // 이전 예상 구조 (response.response.body.items.item) — fallback
  const resp = body.response;
  if (resp && resp.body) {
    const items = resp.body.items;
    if (items) {
      if (Array.isArray(items.item)) return items.item;
      if (items.item && typeof items.item === 'object') return [items.item];
      if (Array.isArray(items)) return items;
    }
  }

  // 다른 가능한 형태: body.items / body.data / body.result 등
  for (const key of ['items', 'data', 'result', 'foodList', 'foodstuffList']) {
    const val = body[key];
    if (Array.isArray(val)) return val;
    if (val && typeof val === 'object' && Array.isArray(val.item)) return val.item;
    if (val && typeof val === 'object' && Array.isArray(val.items)) return val.items;
  }

  return null;
}

/**
 * 카테고리(foodLv4Nm)별로 1개씩만 추출.
 * 같은 카테고리 내에서 여러 개 있으면 첫 번째 항목만 남긴다.
 * foodLv4Nm이 없는 항목은 '(분류없음)' 카테고리로 묶인다.
 *
 * @param {Array<{ foodNm, foodSize, enerc, foodLv4Nm }>} rows
 * @returns {Array<{ foodNm, foodSize, enerc, foodLv4Nm }>}
 */
export function pickOnePerCategory(rows) {
  const grouped = new Map();

  for (const item of rows) {
    const cat = item.foodLv4Nm != null ? String(item.foodLv4Nm) : '(분류없음)';
    if (!grouped.has(cat)) {
      grouped.set(cat, item);
    }
  }

  return Array.from(grouped.values());
}

export async function fetchFoodListPages({
  pageStart = 1,
  pageEnd = 5,
  perPage = 100,
  type = 'json',
} = {}) {
  // foodLv3Cd 목록에서 '00' 제외, 랜덤 3개 선택
  const availableCodes = FOOD_LV3_CODES.filter((c) => c !== '00');
  const selectedCodes = pickRandomCodes(5);
  console.log('[DDC] foodRequest 랜덤 선택 foodLv3Cd:', selectedCodes);

  const allRows = [];
  for (const code of selectedCodes) {
    console.log(`[DDC] foodRequest code=${code} 페이지 fetch 시작 (page ${pageStart}~${pageEnd})...`);
    for (let p = pageStart; p <= pageEnd; p++) {
      console.log(`[DDC] foodRequest code=${code} 페이지 ${p}/${pageEnd} 요청...`);
      const rows = await fetchFoodList({ pageNo: p, numOfRows: perPage, type, foodLv3Cd: code });
      console.log(`[DDC] foodRequest code=${code} 페이지 ${p}/${pageEnd} 응답 건수: ${rows.length}`);
      allRows.push(...rows);
    }
  }
  console.log(`[DDC] foodRequest 전체 fetch 완료 — 총 ${allRows.length}건`);
  return allRows;
}

export { getApiKey, getBaseUrl };

/**
 * 공공 API에서 남은 칼로리 목표(targetCal)와 유사한 실제 음식을 추출.
 * FOOD_LV3_CODES에서 랜덤 코드 선택 → fetch → 카테고리별 1개 추출 →
 * 실제 칼로리(enerc × foodSize / 100)가 targetCal ± tolerance 안에 드는 것 필터링 →
 * targetCal에 가까운 순서로 정렬 후 count개 반환.
 *
 * @param {number} targetCal - 목표 칼로리 (중간값 기준)
 * @param {number} count - 추출할 음식 개수 (1 또는 2)
 * @param {number} [toleranceKcal] - 허용 오차 (기본: targetCal의 25% 또는 최소 50kcal)
 * @returns {Promise<{ name, qty, calLow, calHigh, note, category, calActual }[]>}
 */
export async function pickFoodsByCalorieTarget(targetCal, count, toleranceKcal = null, preferredCodes = null, avoidCodes = null) {
  if (toleranceKcal == null) {
    toleranceKcal = Math.max(targetCal * 0.25, 50);
  }
  if (count < 1) return [];

  // preferredCodes(boostCodes)가 있으면 해당 코드를 우선 배치, avoidCodes는 제외
  let shuffledCodes;
  if (preferredCodes && preferredCodes.size > 0) {
    const preferredArr = Array.from(preferredCodes).filter(c => c !== '00');
    const others = FOOD_LV3_CODES.filter(c => c !== '00' && !preferredCodes.has(c));
    shuffledCodes = [
      ...preferredArr.slice(0, 3),
      ...others.sort(() => Math.random() - 0.5).slice(0, 5 - Math.min(preferredArr.length, 3)),
    ];
  } else {
    shuffledCodes = FOOD_LV3_CODES.filter((c) => c !== '00').sort(() => Math.random() - 0.5).slice(0, 5);
  }
  // avoidCodes에 속한 코드는 제외
  if (avoidCodes && avoidCodes.size > 0) {
    shuffledCodes = shuffledCodes.filter(c => !avoidCodes.has(c));
  }
  // 구이류(코드 08)를 항상 첫 번째에 두어, Solar가 구이류를 고르게 함
  const grillCodeIndex = shuffledCodes.findIndex((c) => c === '08');
  if (grillCodeIndex > 0) {
    shuffledCodes.splice(grillCodeIndex, 1);
    shuffledCodes.unshift('08');
  }
  // 밥류(코드 01)를 항상 첫 번째로 두어, Solar가 밥+반찬 조합을 만들 수 있게 함
  const riceCodeIndex = shuffledCodes.findIndex((c) => c === '01');
  if (riceCodeIndex > 0 && !avoidCodes?.has('01')) {
    shuffledCodes.splice(riceCodeIndex, 1);
    shuffledCodes.unshift('01');
  }
  const maxCodesToTry = Math.min(shuffledCodes.length, 15);
  const poolSize = Math.max(count * 3, 15);
  const candidates = [];

  for (let i = 0; i < maxCodesToTry && candidates.length < poolSize; i++) {
    const code = shuffledCodes[i];
    for (let p = 1; p <= 5 && candidates.length < poolSize; p++) {
      const rows = await fetchFoodList({ pageNo: p, numOfRows: 100, type: 'json', foodLv3Cd: code });
      if (rows.length === 0) continue;

      const items = pickOnePerCategory(rows);
      for (const item of items) {
        const enercPer100g = parseInt(item.enerc, 10) || 0;
        const servingG = FOOD_LV3_SERVING_G[code] || 150;
        const actualCal = Math.round(enercPer100g * servingG / 100);

        if (actualCal > 0 && Math.abs(actualCal - targetCal) <= toleranceKcal) {
          const alreadyAdded = candidates.some(
            (c) => c.category === item.foodLv4Nm
          );
          if (alreadyAdded) continue;
          candidates.push({
            name: item.foodNm,
            qty: `${servingG}g`,
            foodSize: servingG,
            calLow: actualCal,
            calHigh: actualCal,
            note: item.foodLv4Nm ? `${item.foodLv4Nm} 계열` : '',
            category: item.foodLv4Nm || '',
            lv3Nm: FOOD_LV3_NAMES[code] || '',
            calActual: actualCal,
            code: code,
          });
        }
      }
    }
  }

  candidates.sort((a, b) => Math.abs(a.calActual - targetCal) - Math.abs(b.calActual - targetCal));
  // category별 중복 제거한 pool을 Solar한테 전달 (Solar가 중복 없이 4개 선택)
  const pool = await selectDiverseCandidates(candidates, targetCal, poolSize);
  return pool;
}

/**
 * foodLv4Nm 단위로 그룹핑한 뒤, 각 그룹 내에서 targetCal에 가장 가까운 1개만 선별.
 * 선별된 후보들을 targetCal과의 오차 기준 오름차순 정렬 후 count개 반환.
 *
 * @param {{ category: string, calActual: number, code: string, name: string, qty: string, calLow: number, calHigh: number }[]} candidates
 * @param {number} targetCal
 * @param {number} count
 * @returns {Promise<{ name, qty, calLow, calHigh, note, category, calActual, code }[]>}
 */
export async function selectDiverseCandidates(candidates, targetCal, count) {
  const SPECIAL_LV3 = ['전·적 및 부침류', '죽 및 스프류'];
  const GRILL_CODES = new Set(['08']); // 구이류는 하나의 그룹으로 묶음
  // 접미사 패턴: 음식명 끝 단어 기준 그룹핑 (예: 튀김, 볶음, 구이, 찜, 전, 무침 등)
  // "닭껍데기튀김", "김튀김", "뱅어포튀김" 모두 "튀김"으로 그룹 → 하나만 선택
  const SUFFIX_PATTERNS = [
    { regex: /튀김$/i, key: '튀김' },
    { regex: /볶음$/i, key: '볶음' },
    { regex: /구이$/i, key: '구이' },
    { regex: /찜$/i, key: '찜' },
    { regex: /전$/i, key: '전' },          // 김치전, 호박전, 파전, 동태전 등
    { regex: /무침$/i, key: '무침' },
    { regex: /조림$/i, key: '조림' },
    { regex: /절임$/i, key: '절임' },
    { regex: /장아찌$/i, key: '장아찌' },
    { regex: /김치$/i, key: '김치' },
    { regex: /젓갈$/i, key: '젓갈' },
    { regex: /장$/i, key: '장' },           // 장류 (된장, 고추장 등)
    { regex: /소스$/i, key: '소스' },
    { regex: /국$/i, key: '국' },
    { regex: /찌개$/i, key: '찌개' },
    { regex: /탕$/i, key: '탕' },
    { regex: /라면$/i, key: '라면' },
    { regex: /국수$/i, key: '국수' },
    { regex: /냉면$/i, key: '냉면' },
    { regex: /죽$/i, key: '죽' },
    { regex: /스프$/i, key: '스프' },
    { regex: /샐러드$/i, key: '샐러드' },
    { regex: /나물$/i, key: '나물' },
    { regex: /빵$/i, key: '빵' },
    { regex: /떡$/i, key: '떡' },
    { regex: /과자$/i, key: '과자' },
    { regex: /음료$/i, key: '음료' },
    { regex: /커피$/i, key: '커피' },
    { regex: /차$/i, key: '차' },
    { regex: /디저트$/i, key: '디저트' },
    { regex: /케이크$/i, key: '케이크' },
    { regex: /파이$/i, key: '파이' },
    { regex: /와플$/i, key: '와플' },
    { regex: /아이스크림$/i, key: '아이스크림' },
    { regex: /빙수$/i, key: '빙수' },
    { regex: /스무디$/i, key: '스무디' },
    { regex: /샌드위치$/i, key: '샌드위치' },
    { regex: /버거$/i, key: '버거' },
    { regex: /칩스$/i, key: '칩스' },
  ];
  // 접미사 그룹 키 추출 함수
  function getSuffixGroupKey(name) {
    if (!name) return null;
    for (const { regex, key } of SUFFIX_PATTERNS) {
      if (regex.test(name)) return key;
    }
    return null;
  }

  if (!candidates || candidates.length === 0 || count < 1) return [];

  const bestPerGroup = new Map();
  for (const c of candidates) {
    const name = (c.name || c.foodNm || c.foodLv4Nm || '').trim();
    const groupKey =
      SPECIAL_LV3.includes(c.lv3Nm)
        ? 'SPECIAL_LV3:' + c.lv3Nm
        : GRILL_CODES.has(c.code)
          ? 'GRILL:구이류'
          : getSuffixGroupKey(name)
            ? 'SUFFIX:' + getSuffixGroupKey(name)
            : (c.category || '(분류없음)');
    const existing = bestPerGroup.get(groupKey);
    if (!existing || Math.abs(c.calActual - targetCal) < Math.abs(existing.calActual - targetCal)) {
      bestPerGroup.set(groupKey, c);
    }
  }

  const grouped = Array.from(bestPerGroup.values());
  grouped.sort((a, b) => Math.abs(a.calActual - targetCal) - Math.abs(b.calActual - targetCal));
  return grouped.slice(0, count);
}

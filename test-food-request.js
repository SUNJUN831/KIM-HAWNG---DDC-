// test-food-request.js
// 공공데이터포털 식품영양성분 API 통신 테스트
// 내부에서 fetchFoodListPages가 랜덤 3개 대분류 코드 + 1~5페이지 fetch 처리
// 환경변수 FOOD_API_KEY 필요 (Vercel 또는 로컬 .env 등)
//
// 실행 방법 (ESM):
//   node test-food-request.js

import 'dotenv/config';
import { fetchFoodListPages, pickOnePerCategory } from './api/foodRequest.js';

async function main() {
  console.log('=== 식품영양성분 API 통신 테스트 ===');

  try {
    // fetchFoodListPages 내부에서:
    //  - FOOD_LV3_CODES에서 '00' 제외, 랜덤 3개 선택
    //  - 각 코드별로 1~5페이지(pageStart=1, pageEnd=5, perPage=100) fetch
    //  - 결과 합쳐서 반환
    const allRows = await fetchFoodListPages();

    console.log('');
    console.log('=== 응답 요약 ===');
    console.log('총 건수:', allRows.length);
    console.log('');

    if (allRows.length > 0) {
      console.log('=== 샘플 (앞 5개) ===');
      allRows.slice(0, 5).forEach((r, i) => {
        console.log(
          `${i + 1}. name=${r.foodNm ?? '(없음)'} | size=${r.foodSize ?? '(없음)'} | enerc=${r.enerc ?? '(없음)'} | lv4=${r.foodLv4Nm ?? '(없음)'}`
        );
      });

      console.log('');
      console.log('=== 카테고리별 1개씩 추출 ===');
      const categorized = pickOnePerCategory(allRows);
      console.log('카테고리 수:', categorized.length);
      console.log('');
      categorized.forEach((r, i) => {
        console.log(
          `${i + 1}. [${r.foodLv4Nm ?? '(분류없음)'}] ${r.foodNm ?? '(없음)'} | size=${r.foodSize ?? '(없음)'} | enerc=${r.enerc ?? '(없음)'}`
        );
      });

      console.log('');
      console.log('=== 전체 목록 (카테고리별 첫 번째만) ===');
      const uniqueByCategory = pickOnePerCategory(allRows);
      uniqueByCategory.forEach((r, i) => {
        console.log(
          `${i + 1}. ${r.foodNm ?? '(name없음)'} | ${r.foodSize ?? '(size없음)'} | ${r.enerc ?? '(enerc없음)'} | ${r.foodLv4Nm ?? '(lv4없음)'}`
        );
      });
    } else {
      console.log('items가 비어 있어요. 응답 구조를 확인하고 extractItems()를 수정해야 할 수 있어요.');
    }
  } catch (err) {
    console.error('');
    console.error('=== 오류 ===');
    console.error('메시지:', err.message);
    console.error('전체:', err);
  }
}

main();

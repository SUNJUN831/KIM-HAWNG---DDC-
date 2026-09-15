---
name: Daily-Diet-Coach (DDC)
description: 매일의 활동과 식사를 바탕으로 기초대사량과 목표 칼로리, 남은 섭취 범위를 계산하고 하루 식사 전략을 제안하는 개인 식단 관리 코치 스킬. 입력하지 않은 정보는 임의로 추정하지 않으며, 칼로리는 범위로 안내하고 치료 목적의 식단 처방은 하지 않음.
---

# daily-diet-coach (하루 식단 관리 코치)

## 1. 용도
- 유저가 오늘 먹은 음식과 활동 내용을 입력하면
- Solar Pro 4가 각 음식의 추정 칼로리 범위(하한~상한)를 산출하고
- 오늘 목표 칼로리 대비 잔여 칼로리를 계산
- 공공 식품 DB(전국통합식품영양성분정보(음식)표준데이터 API)에서 후보 음식을 가져와 카테고리화한 뒤
- Solar Pro 4가 2일 내 섭취 이력과 겹치는 후보 제외, 일상 기호·생활 패턴 반영, 잔여 칼로리 ±250kcal 근사값 기준으로 4개 추천
- 목적은 섭취 가능한 칼로리 내 음식을 빠르게 추천받고 남은 끼니를 균형 있게 조절하도록 안내하는 것

## 2. 전체 처리 흐름 (실제 서비스 기준)

```
유저 입력(프로필 + 활동 강도 + 먹은 음식 + 예정 음식 + 2일 내 섭취 이력 foodHistory)
  → POST /api (api/calculate.js 핸들러)
    1) api/calcs.js.calculateProfileMetrics(profile, activityLevel)
       → BMR(Mifflin-St Jeor, 원값) + 오늘 예상 소비칼로리(BMR×활동계수) + 목표 칼로리(감량 -500 / 유지 / 증량 +300)
       → 반환: { bmrRaw, todayConsumptionRaw, targetCaloriesRaw }
    2) api/solar-interpret.js.interpretFoodsWithSolar(먹은음식, 예정음식)
       → Solar Pro 4 호출, 각 음식의 calLow~calHigh 범위 + 탄단지(g) 산출
       → 반환: { foods: [{ name, qty, calLow, calHigh, prot_g, fat_g, carbs_g, note, isPlanned, mealType }], plannedFoods: [...] }
    3) 잔여 칼로리 계산 (api/solar-service.js 내부)
       → currentIntakeLo = Σ foods.calLow, currentIntakeHi = Σ foods.calHigh
       → remainingLo = targetCaloriesRaw - currentIntakeHi
       → remainingHi = targetCaloriesRaw - currentIntakeLo
       → remainingAvg = (remainingLo + remainingHi) / 2
    4) 예정 음식 포함 잔여 칼로리 계산
       → plannedFoodsCalAvg = Σ plannedFoods (calLow+calHigh)/2
       → projectedRemainingLo/Hi/Avg = 목표 - 현재섭취 - 예정음식
    5) 예정 음식 양 조절 (예정 총칼로리 > 잔여면 scale 조정) 
       → api/recommend.js.adjustQuantity(qty, scale), generatePortionNote(scale)
    6) 예정 식사 분석 (plannedComparison)
       → 총 상한 < 목표 / 총 하한 > 목표 / 겹치는 범위 3단계 판단 문구
    7) api/solar-strategy.js.generateStrategyWithSolar(맥락정보)
       → Solar Pro 4가 식사 전략 텍스트 생성 (remainingAvg 명시, 구간 판정)
       → 반환: { strategy, recommendedFoods }
    8) api/foodRequest.js.pickFoodsByCalorieTarget(remainingAvg, count=4, toleranceKcal=250, 선호코드, 회피코드)
       → 공공 식품 DB에서 음식 후보 fetch → 카테고리별 1개 추출 → |calActual - remainingAvg| ≤ 250 후보 선별
    9) api/recommend.js.filterCandidatesByHistory(candidates, foodHistory)
       → 2일 내 먹은 음식(name/category)과 겹치는 후보 제거
    10) api/solar-pick.js.selectDiverseFoodsWithSolar(필터링된후보, remainingAvg, ..., count=4, foodHistory, lifestyle, solarHint)
        → Solar Pro 4가 후보 목록에서 4개 선택 (displayName 기준, kcal·gram은 DB값 사용)
    11) api/recommend.js.buildRecommendedFoods(...)에서 최종 추천 구성
        → Solar 선택 결과 + DB 후보 매칭 → { name, qty, kcal, gram, note, isPlanned, mealType }
        → 매칭 실패 시 fallback, 부족 시 filler 충전
    12) 응답 반환
        → { bmr, todayConsumption, targetCalories, goal,
            currentIntakeLo, currentIntakeHi,
            remainingLo, remainingHi, remainingAvg,
            projectedRemainingLo, projectedRemainingHi, projectedRemainingAvg,
            foods, plannedFoods, plannedComparison,
            portionRecommendations, strategy, recommendedFoods,
            macroAnalysis, lifestyleNote, meals }
```

## 3. 입력 구조

### 3-1. 필수 프로필
- 성별(male/female) / 나이 / 키(cm) / 체중(kg) / 목표(loss/maintain/gain)
- 미입력 시 임의추정 금지, 필요한 항목만 요청
- 유효 범위: 키 120~250cm, 체중 30~300kg (경계값 포함, 범위 밖이면 재확인 요청)

### 3-2. 활동 강도 (하루 전체 활동량 기준)
- 거의 없음(1.2) / 낮음(1.375) / 보통(1.55) / 높음(1.725) / 매우 높음(1.9)
- 운동량이 아니라 하루 전체 활동량으로 해석
- **활동 강도는 반드시 제공되어야 함** — 없으면 오늘 예상 소비칼로리·목표 칼로리 계산 불가, 전략 생성도 불가

### 3-3. 매일 입력
- 먹은 음식: 아침·점심·저녁·간식별 자연어 (예: "제육볶음 1인분, 밥 한 공기")
- 예정 음식/일정: 자연어 배열 (예: ["저녁 회식 삼겹살"])
- 생활 패턴: 자연어 배열 (예: ["야근", "러닝 30분"])
- 2일 내 섭취 이력(foodHistory): [{ name, category }, ...] — 추천 시 중복 회피용

### 3-4. 입력 검증 규칙
- 키 120cm 미만 또는 250cm 초과 → 재확인 (120·250 경계값 포함, 재확인 대상 아님)
- 체중 30kg 미만 또는 300kg 초과 → 재확인 (30·300 경계값 포함, 재확인 대상 아님)
- 활동 강도: 1.2 / 1.375 / 1.55 / 1.725 / 1.9 중 하나여야 함 (아니면 재확인)
- 프로필 5종(성별·나이·키·체중·목표) 중 누락 있으면 추측하지 말고 필요한 항목만 요청
- 재요청 시 다른 정상 입력값은 그대로 인정

## 4. 핵심 계산

### 4-1. BMR — Mifflin-St Jeor (api/calcs.js)
- 남성: 10×체중 + 6.25×키 - 5×나이 + 5
- 여성: 10×체중 + 6.25×키 - 5×나이 - 161
- 화면 표시용: 정수 반올림
- 후속 계산용: 원값(소수점 포함) 사용

### 4-2. 오늘 예상 소비칼로리 = BMR(원값) × 활동계수
- 활동계수는 정밀 측정값이 아니라 추정용 계수
- 실제 소비열량과 차이 날 수 있음

### 4-3. 목표 칼로리 = 오늘 예상 소비 ± 목표 조정 (예시 기준)
- 감량: -500 / 유지: ±0 / 증량: +300

### 4-4. 현재 섭취 추정치
- Solar Pro 4가 각 음식에 대해 calLow~calHigh 범위 산출
- 현재 섭취 하한 = 모든 음식 calLow 합
- 현재 섭취 상한 = 모든 음식 calHigh 합

### 4-5. 잔여 칼로리 (api/solar-service.js 내부 계산)
- 잔여 하한 = 목표 - 현재 섭취 상한
- 잔여 상한 = 목표 - 현재 섭취 하한
- 잔여 중간값(remainingAvg) = (잔여 하한 + 잔여 상한) / 2 → 추천 기준값으로 사용
- 예정 음식 포함 잔여(projetedRemainingLo/Hi/Avg)도 함께 계산

## 5. 음식 칼로리 추정 (Solar Pro 4 해석, api/solar-interpret.js)

- Solar Pro 4 모델에 음식 목록 전달 → 각 음식의 추정 칼로리 범위(하한~상한 kcal) + 탄단지(g) 산출
- 응답 형식: [{ name, qty, calLow, calHigh, prot_g, fat_g, carbs_g, note, isPlanned, mealType }]
- 규칙:
  - 추정/범위로만 제시, 정확한 값이라 단정하지 않음
  - 양이 애매하면 calLow/calHigh 넉넉하게 잡고 note에 "추정" 명시
  - 음식이 아닌 항목은 calLow=0, calHigh=0, note="추정 불가"
- allNonFood 검증: 모든 음식의 calLow=0 & calHigh=0 이면 "음식이 아닌 항목" 에러 → 400 반환

## 6. 음식 추천 (공공 DB 후보 → 이력 필터 → Solar 선택)

### 6-1. 공공 식품 DB에서 후보 fetch (api/foodRequest.js)
- 전국통합식품영양성분정보(음식)표준데이터 API 사용
- FOOD_LV3_CODES(식품대분류코드 25개)에서 랜덤 선택된 코드들로 페이지별 fetch
- 각 항목에서 foodNm, enerc(100g당 칼로리), foodLv4Nm 추출
- calActual = enerc × foodSize / 100 (1인분 기준 실제 칼로리)
   - foodSize: 코드별 통상 1인분 중량(g) (예: 밥류 210g, 국·탕 350g, 구이류 180g 등) - api/foodCategories.js에 정의
   - 1인분의 양만 제공하기 위해 다음과 같은 정의를 해두고 매핑을 하여 구함 
- 카테고리(foodLv4Nm)별 1개씩만 추출(pickOnePerCategory) → 중복 방지
   -예: 닭튀김, 닭다리튀김, 닭날개튀김 중복 제거 -> 닭튀김 하나만 선택 
- NODATA_ERROR(resultCode 03)는 빈 배열로 처리, 오류 던지지 않음

### 6-2. 잔여 칼로리 ±250kcal 근사값 필터 (pickFoodsByCalorieTarget)
- targetCal = remainingAvg (잔여 칼로리 중간값)
- toleranceKcal = 250 (고정)
- |calActual - remainingAvg| ≤ 250 인 후보만 선별
   - 필터링이 너무 강하면 후보 수가 거의 사라져서 Solar 선택이 어려워짐
   - 따라서 250kcal 근사값 기준으로 후보를 충분히 확보하고 Solar가 선택하도록 함
- FOOD_LV3_CODES에서 선호코드(boostCodes) 우선 배치, 회피코드(avoidCodes) 제외
- 구이류(코드 08)·밥류(코드 01)는 항상 첫 번째로 배치 (Solar가 선택 용이하게)
- 반찬류 코드(BANCHAN_CODES) 감지 시 밥(코드 01) 추가 시도
- displayName 정리: 괄호 제거, 접미사(제휴·간편식 등) 제거, underscore→공백

### 6-3. 2일 내 섭취 이력 비중복 필터 (filterCandidatesByHistory, api/recommend.js)
- foodHistory: [{ name, category }, ...] (최근 2일 내 먹은 음식)
   - 단, 한국인의 주식인 밥·면류는 반복 섭취 가능하므로 fillter에서 제외
- 후보의 name 또는 category가 이력과 겹치면 제거
- name 포함 관계(cname.includes(h.name) || h.name.includes(cname)) 및 category 완전 일치 기준
- 이력으로 같은 음식 반복 추천 방지

### 6-4. Solar Pro 4가 4개 선택 (api/solar-pick.js.selectDiverseFoodsWithSolar)
- 필터링된 후보 목록을 Solar에 제시 (displayName, category, calActual, foodSize 포함)
- Solar 선택 기준:
  - 4개 선택 (단, 후보군 음식이 적으면 2개 까지도 축소 가능)
  - 생활 패턴 반영: 야근/늦으면 가벼운 음식(죽·샐러드·가벼운 면), 운동/러닝이면 단백질 음식 포함, 회식/음주면 해장·가벼운 식사 위주
  - 음식군별 중복 제거: 튀김·볶음·구이·전·무침·절임/장아찌/조림·국/탕·찌개·라면/국수/냉면·죽/스프·샐러드 각각 1개
  - 남은 칼로리 600 이상이면 밥류 1개 이상 포함
  - 간식·디저트류(팝콘, 견과, 음료, 과일, 유제품, 빙과류 등)는 정식 메뉴가 아니면 선택 금지
  - 튀김은 정식 메인 메뉴(닭튀김, 돈까스 등)일 때만 선택, 단순 안주용 튀김(닭발튀김, 껍질튀김 등) 제외
  - 비호 식품(개고기, 꼴뚜기, 말고기, 꿩, 닭껍데기) 선택 금지
  - name은 후보 목록에 표시된 displayName 그대로 사용 (raw foodNm이나 변형 이름 금지)
  - kcal·gram은 후보 목록 값 그대로 사용, Solar가 추정하지 않음
- Solar 호출 실패/파싱 실패 시 fallback: 후보 앞에서 4개 반환 (displayName 기준) - 단, 후보가 4개 미만이면 그대로 반환

### 6-5. 최종 추천 결과 구성 (api/recommend.js.buildRecommendedFoods)
- Solar 선택 결과와 DB 후보를 매칭 → name, qty, kcal, gram, note, mealType 구성
- 매칭 실패 시 후보에서 직접 구성 (fallback: remainingAvg 기준 정렬 후 4개)
- 부족하면 filler로 채움 (useCount=4 확보, 중복 카테고리·구이류 중복 방지)
- 응답 형식: [{ name, qty, kcal, gram, note, isPlanned, mealType }]

### 6-6. 분량 조절 (예정 음식 있을 때, api/recommend.js)
- 예정 음식 calLow~calHigh 중간값 합(plannedFoodsCalAvg)과 projectedRemainingAvg 비교
- 예정 총칼로리 > 잔여면 scale = budget / 예정총량 (0.2~1.0 범위 제한)
- adjustQuantity(qty, scale)로 권장량 조정 (g/ml/공기·개·인분 등 단위별)
- generatePortionNote(scale)로 안내 문구 생성

## 7. Solar 전략 생성 (api/solar-strategy.js)

- 맥락 정보 전달: profile, activityLevel, bmrRaw, todayConsumptionRaw, targetCaloriesRaw, currentIntakeLo/Hi, remainingLo/Hi, foods, plannedFoodsResult, plannedComparison, lifestylePatterns
- 남은 칼로리 중간값(remainingAvg = (remainingLo+remainingHi)/2)을 프롬프트에 명시
- 구간 판정: 700미만 / 500~1200 / 1200 이상 - (남은 칼로리가 100 미만은 초기에 추천 음식을 띄우지 않음)
- 핵심 규칙:
  - "아침·점심 굶으세요" 등 극단 제안 금지
  - 남은 칼로리 많다고 더 먹으라고 권하지 않음, 과도한 제한도 피함
  - 이미 먹은 메뉴와 겹치지 않는 새로운 식단 방향성 언급
  - "현재 추정치상 오늘 목표 초과 가능성 낮아/높아" 비교 표현 사용
  - 과식 위험·영양 균형 체크 포인트 1~2개 제시
  - 모든 수치에 "약", 범위 추정 시 "~ kcal"
  - 생활 패턴 있으면 현실적 조언 포함 (회식→과음·기름진 안주 주의, 야근→간편식·가벼운 마무리, 운동→단백질 보충 등)
- 응답: { strategy: "전략 텍스트" } (JSON 객체 하나만, 마크다운 코드블록 금지)
- 파싱 실패 시 원문 슬라이스 fallback

## 8. 예정 식사 분석 (api/solar-service.js 내부)

- 예정 음식 calLow~calHigh 합산 → 현재 섭취와 합쳐 예상 총 섭취 범위 계산
- 목표 대비 3단계 판단:
  - 총 상한 < 목표 → "현재 추정치상 오늘 목표 섭취량을 초과할 가능성은 낮아 보여. 다만 음식과 소비칼로리 모두 추정치이므로, 추가로 많이 먹거나 일부러 더 제한하기보다는 예정한 정도로 먹는 편이 좋아."
  - 총 하한 > 목표 → "현재 추정치상 오늘 목표 섭취량을 초과할 가능성이 높아. 예정한 양보다 조금 줄이거나, 사이드·술·추가 분량을 조절하면 목표 범위에 더 가까워질 수 있어."
  - 그 외(겹치는 범위) → "현재 추정치로는 오늘 목표와 겹치는 범위가 있어. 예정대로 먹되, 사이드·술·추가 분량이 들어가면 목표를 넘을 수 있으니 그 정도만 조절하면 돼."
- 이 plannedComparison을 Solar 전략 프롬프트에 전달

## 9. 응답 구성 (사용자 출력)

### 9-1. 오늘 기준
- 기초대사량: 약 X kcal
- 오늘 예상 소비: 약 X kcal
- 목표(유지/감량/증량): 약 X kcal
- 현재 섭취: 약 X~X kcal
- 남은 범위: 약 X~X kcal

### 9-2. 예정 식사 해석 (있으면)
- 예정 음식(음식·양) → 추정치/범위 제시
- 예정대로 먹을 경우 오늘 총 섭취량 예상 범위
- 목표와의 비교 (3단계): 목표보다 낮음 / 목표와 겹침 / 목표 초과 가능성 높음
- "목표를 초과하지 않았다"는 이유만으로 "목표 범위 안"이라고 표현하지 않음

### 9-3. 오늘 전략
- Solar Pro 4가 생성한 식사 전략 텍스트
- 끼니별 균형 전략, 남은 범위 활용·예정 식사 조절 방향
- 남은 칼로리가 큰 경우 여러 끼니·간식으로 나누어 제안 (잔여 중간값 700 → 2분할, ≥1500 → 3분할) 

### 9-4. 다음 식사 추천 (4개)
- 공공 DB 후보 중 2일 이력 필터링 후 Solar가 선택한 음식 카드 4개
- 각 카드: 음식명, 권장량, 예상 칼로리(공공 DB 실측값), 간단한 설명
- selection 기준: 잔여 ±250kcal 근사값, 2일 이력 비중복, 일상 기호·생활 패턴 반영, 음식군별 다양성

### 9-5. 참고
- "소비·음식 칼로리는 활동계수와 일반적인 음식 정보를 이용한 추정치이며 실제 값과 차이가 날 수 있어."
- 필요 시 재입력 요청(문제가 있는 항목만)

## 10. 안전·윤리 원칙

- 입력값 상식 범위 벗어나면 문제 특정해서 재요청 (추측 금지)
- 미입력 정보 임의추정 금지, 필요한 항목만 요청
- 음식 칼로리는 추정/범위로만 제시, 단정 금지
- 치료식·질환 처방 금지
- 극단 제안 금지 ("아침·점심 굶으세요" 등)
- 남은 칼로리 많다고 다 먹으라고 권하지 않음, 과도한 제한도 피함
- 사용자 정보 저장: 프로필·날짜별 기록은 브라우저 localStorage에 저장 (서비스 구현 기준)

## 11. 제한사항

- 텍스트 기반 추정·전략 제시용, 정밀 영양 분석 도구 아님
- 수치는 예시/추정, 개인차 있음
- 오늘 예상 소비칼로리는 실제 측정값 아님 (활동계수 기반 간이 추정)
- 질환·치료 관련 식단 다루지 않음
- 활동 강도는 오늘 입력한 값만 사용, 별도 기본 활동계수·평소 TDEE 없음
- 오늘 운동은 kcal 중복 계산 안 함, 활동 강도 확인 및 식사전략 참고용
- 음식 칼로리 추정은 Solar Pro 4(solar-pro4) 사용, 추정 범위로 제시
- 음식 추천은 공공 식품 DB 후보 추출 → 2일 이력 필터 → Solar가 ±250kcal·일상 기호 기준 4개 선택 방식

## 12. 기술 스택
- 런타임: Node.js (ES Module, package.json "type": "module")
- 배포: Vercel (프로젝트: kim-hwang-ddc)
- AI: Upstage Solar Pro 4 (solar-pro4), 
- 식품 DB: 공공데이터포털 전국통합식품영양성분정보(음식) 표준데이터 API 
- 환경변수: UPSTAGE_API_KEY (필수), FOOD_API_KEY·FOOD_API_BASE
- API 키: 서버에서만 process.env로 사용, 클라이언트 노출 금지
- 저장: 브라우저 localStorage (프로필, 날짜별 기록, 저장 결과)

## 13. 주요 파일 (실제 서비스)

- `api/calculate.js` — Vercel POST 핸들러 (입력 검증, runDietCoach 호출)
- `api/solar-service.js` — orchestrator (runDietCoach: 해석→계산→추천→전략 흐름 조율)
- `api/solar-base.js` — Solar Pro 4 공통 호출 (solarChat)
- `api/solar-interpret.js` — 음식 해석 (칼로리 범위+탄단지 JSON)
- `api/solar-strategy.js` — 식사 전략 생성 (전략 텍스트 JSON)
- `api/solar-pick.js` — 후보 중 Solar 선택 (displayName 기준, 칼로리 DB값 사용)
- `api/recommend.js` — 추천 구성, 분량 조절 헬퍼 (buildRecommendedFoods, adjustQuantity, filterCandidatesByHistory)
- `api/foodRequest.js` — 공공 식품 DB API 연동 (fetchFoodList, pickFoodsByCalorieTarget, selectDiverseCandidates)
- `api/foodCategories.js` — FOOD_LV3_CODES/NAMES/SERVING_G, BANCHAN_CODES
- `api/calcs.js` — BMR·소비·목표 계산, 매크로 분석, 매크로 필터 설정
- `index.html` — 프론트 (프로필·날짜별 기록·끼니 입력·결과 표시, js/app.js 모듈)

## 14. 아이콘 출처

- ai-robot.png - "https://www.flaticon.com/free-icons/robot"
- clipboard.png - "https://www.flaticon.com/free-icons/checklist"
- ddc-agent.png - "https://www.flaticon.com/free-icons/electricity"
- diet-analysis.png - "https://www.flaticon.com/free-icons/profit"
- lifestyle-pattern.png - "https://www.flaticon.com/free-icons/routine"
- meal-recommendation.png - "https://www.flaticon.com/free-icons/eat"
- meal.png - "https://www.flaticon.com/free-icons/nutrition"
- user.png - "https://www.flaticon.com/free-icons/profile-picture"


// Solar Pro 4 — 후보 선택 모듈
// DB 기반 후보 풀(candidates)에서 Solar가 이름(displayName)만 골라옴 (칼로리는 DB 값 사용)

import { solarChat } from './solar-base.js';

const BANCHAN_CODES = new Set(['11', '13', '14', '15', '16', '17', '18']);

/** foodNm(raw)를 간결명으로 정리 (underscore→공백, 괄호 제거, 접미사 제거) */
function cleanName(raw) {
  if (!raw) return '';
  let n = raw.replace(/\([^)]*\)/g, '');
  n = n.replace(/_(간편조리세트|간편식|즉석|냉동|소금제외|설탕제외|소스제외|기본|매운맛|순한맛|중간맛)(\/_.*)?$/g, '');
  n = n.replace(/_/g, ' ').replace(/  +/g, ' ').trim();
  return n || raw;
}

function buildSelectFoodsPrompt(candidates, remainingAvg, remainingLo, remainingHi, count, foodHistory = [],lifestyle = '', solarHint = '') {
  const foodLines = candidates
    .map((c) => {
      return `- ${c.displayName} [${c.category}] | 약 ${c.calActual} kcal | ${c.foodSize}g`;
    })
    .join('\\n');

  return `다음 음식 후보 목록을 보고, 아래 조건에 맞게 ${count}개를 골라줘.

===== 조건 =====
- 반환할 음식은 정확히 ${count}개여야 해 (4개 미만으로 응답하면 안 돼).
- 사용자의 오늘 생활 패턴: "${lifestyle || '특별한 일정 없음'}"
- 위 생활 패턴을 적극 반영하여 적절한 메뉴를 우선적으로 골라줘.
  - "야근"이나 "늦은"이라는 키워드가 있으면: 소화가 잘 되는 가벼운 음식(죽, 샐러드, 가벼운 면 등) 위주로 선택해.
  - "운동"이나 "러닝"이라는 키워드가 있으면: 단백질이 풍부한 음식(고기구이, 닭가슴살, 생선, 두부 등)을 반드시 포함시켜.
  - "회식"이나 "음주"라는 키워드가 있으면: 해장에 좋거나 기름기가 적고 가벼운 식사 위주로 골라줘.
- 같은 음식군이 여러 개 후보에 있으면 그중 가장 일반적으로 많이 먹는 대표 음식 하나만 남기고 나머지는 제외해. 음식군 예시:
  - 튀김류: 닭껍데기튀김, 김튀김, 뱅어포튀김, 닭발튀김, 닭다리튀김 등 → 하나만 (예: 닭다리튀김)
  - 볶음류: 제육볶음, 오징어볶음, 김치볶음 등 → 하나만
  - 구이류: 삼겹살구이, 닭구이, 고등어구이, 갈매기살구이 등 → 하나만
  - 전류: 김치전, 호박전, 파전, 동태전, 새우전 등 → 하나만
  - 무침류: 시금치무침, 콩나물무침, 도라지무침 등 → 하나만
  - 절임류/장아찌류/조림류: 각각 하나씩만
  - 국·탕류: 닭백숙,갈비탕,삼계탕,꼬리곰탕 등 → 하나만
  - 찌개류: 김치찌개,된장찌개,청국장찌개 등 → 하나만
  - 라면·국수·냉면류: 각각 하나만
  - 죽·스프류: 각각 하나만
  - 샐러드류: 하나
- 남은 칼로리가 600 이상인 경우:
  - 반드시 밥류가 1개 이상 포함되어야 해.
  - 팝콘, 견과, 음료 및 차류, 과일류, 유제품 및 빙과류, 간식류 등 배부름과 무관한 간식·디저트 카테고리는 절대 선택하지 마.
  - 튀김류는 간식·디저트가 아니라 정식 메인 메뉴로 구성되는 경우에만 선택 가능해 (예: 닭튀김, 돈까스 등 한 끼 식사로 성립되는 것). 단순 간식/안주 용도의 튀김(닭발튀김, 껍질튀김 등)은 제외해.
  - 각 항목이 그 자체로 완전한 한 끼 메뉴가 될 수 있는 독립적인 음식으로 골라줘. 밥+찌개+반찬처럼 일부만 부분적으로 뽑는 게 아니라, 각 음식이 충분한 분량과 칼로리를 가진 하나의 메뉴로 구성되어야 해.
  - 구이류(고기·생선 등을 구운 것)가 포함되면, 밥과 함께 먹는 구성으로 자연스럽게 묶일 수 있지만, 다른 항목들은 별도 메인 메뉴로 독립성 있게 골라줘.
- 가능하면 일반적으로 많이 먹는 음식 위주로 선택해. 조림류·젓갈류·장아찌·절임류·김치류 등 호불호 강한 음식 단독보다는, 구이류·국/탕류·면류·밥류·만두·스프·찜·볶음·샐러드·튀김류 등 대중적인 메뉴를 우선해.
|- 각 항목의 name은 반드시 아래 후보 목록에 표시된 음식명(간결명) 그대로 사용해. 화면에 보이는 이름(displayName)을 그대로 name으로 적어줘. 절대 raw foodNm(닭튀김_블랙시크릿 콤보 치킨 (S), 닭발구이_참숯닭발, 불고기전골_간편조리세트_서울식불고기전골 같은 전체 이름)이나 category(닭튀김, 닭발구이 같은 음식군명), 또는 다른 변형 이름으로 쓰지 마. 예를 들어 목록에 "- 불고기전골 [불고기전골]"이 있으면 name은 "불고기전골"만 적어줘.
- 각 후보의 원래 1인분 중량(g)이 다음과 같이 제공돼. 이 정보를 참고해서 qty를 자연스러운 표현으로 제시해줘. (예: 210g이면 "1공기", 350g이면 "1인분", 130g이면 "1접시" 등) 원정보에 없는 경우 추정하지 말고 qty는 자유롭게 정해.
- "개고기", "꼴뚜기", "말고기", "꿩" 같은 비호 식품은 절대 선택하지마.
- 칼로리는 네가 추정하지 말고, 아래 후보 목록에 표시된 kcal 값을 그대로 적어줘.** 너희는 name, qty, gram, kcal, note만 결정해서 반환하면 돼. 서버는 DB에서 가져온 실제 칼로리(calActual)와 gram 정보를 이미 알고 있어.
- 선택 항목 간 중복을 피하되, 각 음식이 약 ${remainingAvg} kcal 전후(±150 kcal) 범위에서 충분히 의미 있는 포만감을 주는 메뉴로 구성해줘. 총합이 남은 칼로리를 초과할 수 있지만, 각 메뉴가 부실한 것보다는 낫다.

===== 후보 목록 =====
${foodLines}
${solarHint ? `\\n===== 식단 힌트 (참고만 하세요) =====\\n${solarHint}\\n` : ''}

===== 응답 형식 =====
응답은 반드시 아래 JSON 배열 하나로만 반환해 (마크다운 코드블록이나 다른 설명 금지):

[
  {
    "name": "음식명 (아래 후보 목록에 표시된 displayName과 정확히 일치해야 함)",
    "qty": "양 (예: 1인분, 1공기, 1그릇 등)",
    "gram": "위 후보 목록에 표시된 중량 중량 숫자만 넣게 해 (g, 예: 210)",
    "kcal": "실제 칼로리(kcal, 후보 목록에 표시된 값 그대로)",
    "note": "간단 메모 (있다면)"
  }
]

규칙:
|- name은 반드시 아래 후보 목록에 표시된 음식명(간결명, displayName) 그대로 사용해. 예: 목록에 "- 불고기전골 [불고기전골]"이 있으면 name은 "불고기전골"만 적어줘. 화면에 보이는 displayName을 그대로 name으로 적어. 절대 raw foodNm(닭튀김_블랙시크릿 콤보 치킨 (S), 닭발구이_참숯닭발, 불고기전골_간편조리세트_서울식불고기전골 같은 전체 이름)이나 category(닭튀김, 닭발구이 같은 음식군명), 또는 다른 변형 이름으로 쓰지 마.
- kcal는 후보 목록에 표시된 값 그대로 적어줘. 추정하지 말고 목록에 있는 값 그대로 사용해.
- gram은 후보의 원래 1인분 중량(g)을 그대로 적으면 돼.
- 결과는 바로 JSON 배열로만 줘. name은 아래 후보 목록에 표시된 category에 있는 이름 그대로 사용해. 절대 다른 이름으로 바꾸거나 새로 만들지 마.
`;

}

async function selectDiverseFoodsWithSolar(candidates, remainingAvg, remainingLo, remainingHi, count, foodHistory = [],lifestyle = '', solarHint = '') {
  if (!candidates || candidates.length === 0 || count < 1) return [];

  const useCount = count;
  const userMessage = await buildSelectFoodsPrompt(candidates, remainingAvg, remainingLo, remainingHi, useCount, foodHistory, lifestyle, solarHint);

  const result = await solarChat([
    {
      role: 'system',
      content: '너는 식단 추천 전문가야. 다양한 카테고리에서 골고루 음식을 골라주고, 비슷한 계열 음식은 중복하지 않아. 응답은 반드시 유효한 JSON 배열로만 해.',
    },
    { role: 'user', content: userMessage },
  ]);

  if (result.error) {
    console.log('[DDC] Solar selectDiverseFoods 오류:', result.error);
    // Solar 실패 시 fallback: 후보 앞에서 count개 반환 (displayName 기준)
    return candidates.slice(0, count).map((c) => {
      const calActual = c.calActual != null ? c.calActual : (c.calLow || 0);
      const displayName = c.displayName || c.name || '';
      const foodSize = c.foodSize != null ? c.foodSize : null;
      const rawQty = foodSize != null ? `${foodSize}g` : (c.qty || '1인분');
      return {
        name: displayName,
        qty: rawQty,
        gram: foodSize,
        kcal: calActual,
        note: buildNotePlain({ category: c.category }),
        code: c.code,
      };
    });
  }

  console.log('[DDC] Solar raw 응답 (selectDiverseFoods):', result.content.slice(0, 1000));
  let jsonStr = result.content.trim();
  if (jsonStr.startsWith('```')) {
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) jsonStr = match[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) throw new Error('배열이 아님');
    // Solar가 name(후보 목록 displayName)으로 응답 → 원본 candidates에서 매칭
    return parsed.map((item) => {
      const name = (item.name || '').trim();
      const nameWords = name.split(/\\s+/).filter(Boolean);
      const firstWord = nameWords[0] || '';
      // 1차: 정확한 category 일치 (Solar가 후보 목록의 category 값으로 응답)
      let matched = candidates.find((c) =>
          c.category === name
        );
      // 2차: 정확한 displayName 일치
      if (!matched) {
        matched = candidates.find((c) => c.displayName === name);
      }
      // 3차: 포함 관계 (Solar가 간략화한 이름도 매칭)
      if (!matched) {
        matched = candidates.find((c) =>
          c.displayName.includes(name) || name.includes(c.displayName)
        );
      }
      // 4차: name(raw foodNm) 기준 매칭
      if (!matched) {
        matched = candidates.find((c) =>
          c.name === name
        );
      }
      // 5차: 단어 기반 fuzzy — 첫 단어 또는 nameWords 중 하나로 match
      if (!matched && firstWord) {
        matched = candidates.find((c) => {
          const dname = c.displayName.toLowerCase();
          const fn = firstWord.toLowerCase();
          return dname.startsWith(fn) || dname.includes(fn) ||
            c.displayName.split(/[\\s_·]+/).some(w => w.toLowerCase() === fn);
        });
      }
      // 매칭된 calActual/gram/안내를 사용 (LLM 추정 대신 DB 실제값)
      const calActual = matched && matched.calActual != null ? matched.calActual : (item.kcal != null ? Number(item.kcal) : 0);
      const gram = matched && matched.foodSize != null ? matched.foodSize : (item.gram != null ? Number(item.gram) : null);
      const rawQty = item.qty || (gram != null ? `${gram}g` : '1인분');
      return {
        name: matched && matched.category ? matched.category : (matched ? (matched.displayName || matched.name) : name),
        qty: rawQty,
        gram: gram,
        kcal: calActual,
        note: item.note || (matched ? (matched.category ? `${matched.category} 계열` : '') : ''),
        code: matched ? matched.code : '',
      };
    });
  } catch (e) {
    console.log('[DDC] Solar selectDiverseFoods 파싱 실패:', e.message);
    // 파싱 실패 시 fallback: 후보 앞에서 count개 채움 (displayName 기준)
    return candidates.slice(0, count).map((c) => {
      const calActual = c.calActual != null ? c.calActual : (c.calLow || 0);
      const displayName = c.displayName || c.name || '';
      const foodSize = c.foodSize != null ? c.foodSize : null;
      const rawQty = foodSize != null ? `${foodSize}g` : (c.qty || '1인분');
      return {
        name: displayName,
        qty: rawQty,
        gram: foodSize,
        kcal: calActual,
        note: buildNotePlain({ category: c.category }),
        code: c.code,
      };
    });
  }
}

function buildNotePlain(p) {
  const categoryPart = p.category ? `${p.category} 계열` : '';
  return categoryPart;
}

export { selectDiverseFoodsWithSolar, buildNotePlain };

// Solar Pro 4 공통 호출 모듈
// 상수, API 키, fetch 담당. 개별 기능 모듈은 여기서 import.

const SOLAR_MODEL = 'solar-pro4';
const SOLAR_URL = 'https://api.upstage.ai/v1/chat/completions';

export function getApiKey() {
  return process.env.UPSTAGE_API_KEY;
}

export async function solarChat(messages, temperature = 0.7, maxTokens = 2048) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { error: 'UPSTAGE_API_KEY가 설정되지 않았어요.' };
  }

  try {
    const requestBody = JSON.stringify({
      model: SOLAR_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
    });
    console.log('[DDC] Solar 요청 body:', requestBody.slice(0, 2000));

    const response = await fetch(SOLAR_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: requestBody,
    });

    if (!response.ok) {
      const errText = await response.text();
      return { error: `Solar 호출 실패 (${response.status}): ${errText}` };
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return { error: 'Solar 응답이 비어 있어요.' };
    }
    return { content };
  } catch (e) {
    return { error: 'Solar 호출 중 오류: ' + e.message };
  }
}

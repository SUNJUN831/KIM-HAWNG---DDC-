// API 통신 연결단 — /api/calculate 호출

async function fetchCalculation(payload) {
  const res = await fetch('/api/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`서버 오류 (${res.status}): ${text}`);
  }
  return res.json();
}

export { fetchCalculation };

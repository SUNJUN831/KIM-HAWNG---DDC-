import { runDietCoach } from './solar-service.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body;
  try {
    body = req.body;
    if (!body) {
      body = JSON.parse(req.body || '{}');
    }
  } catch {
    return res.status(400).json({ error: '잘못된 요청입니다.' });
  }

  const { profile, activityLevel } = body;
  if (!profile || !profile.gender || !profile.age || profile.height == null || profile.weight == null || !profile.goal) {
    return res.status(400).json({ error: '프로필이 부족해요. 성별·나이·키·체중·목표를 모두 입력해주세요.' });
  }
  if (profile.height < 120 || profile.height > 250) {
    return res.status(400).json({ error: '키 입력이 이상해요. 120cm 이상 250cm 이하로 입력해주세요.' });
  }
  if (profile.weight < 30 || profile.weight > 300) {
    return res.status(400).json({ error: '체중 입력이 이상해요. 30kg 이상 300kg 이하로 입력해주세요.' });
  }
  if (![1.2, 1.375, 1.55, 1.725, 1.9].includes(activityLevel)) {
    return res.status(400).json({ error: '활동 강도 선택이 이상해요.' });
  }

  try {
    const result = await runDietCoach(body);
    return res.status(200).json(result);
  } catch (err) {
    if (err.message && err.message.includes('음식이 아닌 항목')) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: '계산 중 오류가 발생했어요: ' + (err.message || '알 수 없는 오류') });
  }
}

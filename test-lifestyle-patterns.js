import 'dotenv/config'

const API_URL = 'http://localhost:3000/api/calculate'

async function test_lifestyle(patterns, label) {
  console.log(`\n========== ${label} ==========`)
  console.log('lifestylePatterns:', JSON.stringify(patterns))

  const payload = {
    profile: {
      gender: 'male',
      age: 27,
      height: 177,
      weight: 72,
      goal: 'loss',
    },
    activityLevel: 1.55,
    meals: {
      breakfast: '라면 1개',
      lunch: '김치피자탕수육 1인분',
    },
    lifestylePatterns: patterns,
  }

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error(`API 오류 (${res.status}):`, errText.slice(0, 300))
      return
    }

    const data = await res.json()

    console.log('--- strategy ---')
    console.log(data.strategy)
    console.log('---')

    // 생활패턴 관련 문구 확인
    if (patterns && patterns.length > 0) {
      const hasLifeRef = data.strategy.includes('러닝') || data.strategy.includes('술약속') || data.strategy.includes('회식') || data.strategy.includes('벌크업')
      console.log('생활패턴 언급 포함:', hasLifeRef ? 'OK' : 'FAIL ( 패턴에 대한 언급이 전략에 없음 )')
      console.log('lifestyleNote (패턴 있음 → null):', data.lifestyleNote === null ? 'OK' : 'FAIL ( 기대: null, 실제: ' + JSON.stringify(data.lifestyleNote) + ' )')
    } else {
      console.log('lifestyleNote:', JSON.stringify(data.lifestyleNote))
      const expectedNote = '현재 생활패턴이 적혀있지 않아요. 입력하면 더 맞춤화된 조언을 받을 수 있어요.'
      const hasNoPatternMsg = data.lifestyleNote === expectedNote
      console.log('패턴 없음 안내 포함:', hasNoPatternMsg ? 'OK' : 'FAIL ( 기대: ' + expectedNote + ', 실제: ' + JSON.stringify(data.lifestyleNote) + ' )')
    }
  } catch (err) {
    console.error('요청 오류:', err.message)
  }
}

async function main() {
  console.log('=== test-lifestyle-patterns.js ===')

  // 케이스 1: 생활패턴 있음 (러닝 + 술약속)
  await test_lifestyle(['러닝 30분', '친구들과 술약속'], '케이스 1: 생활패턴 있음 (러닝 + 술약속)')

  // 케이스 2: 생활패턴 있음 (회식 + 벌크업)
  await test_lifestyle(['회식', '벌크업을 위한 식단'], '케이스 2: 생활패턴 있음 (회식 + 벌크업)')

  // 케이스 3: 생활패턴 없음
  await test_lifestyle([], '케이스 3: 생활패턴 없음')

  console.log('\n=== 완료 ===')
}

main().catch(err => {
  console.error('실행 오류:', err)
  process.exit(1)
})

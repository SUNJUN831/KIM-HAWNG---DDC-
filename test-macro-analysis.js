import 'dotenv/config'
import { getRecommendedFoodsForAvg } from './api/calculate.js'

const profile = {
  gender: 'male',
  age: 27,
  height: 177,
  weight: 72,
  goal: 'loss',
}
const activityLevel = 1.55
const meals = {
  breakfast: '라면 1개',
  lunch: '김치피자탕수육 1인분',
}

async function main() {
  console.log('=== test-macro-analysis.js ===')
  console.log('프로필:', JSON.stringify(profile))
  console.log('활동강도:', activityLevel)
  console.log('먹은 음식:', JSON.stringify(meals))
  console.log('')

  const result = await getRecommendedFoodsForAvg(700, 4, ['라면 1개', '김치피자탕수육 1인분'])

  if (!result || result.error) {
    console.error('추천 실패:', result?.error)
    process.exit(1)
  }

  console.log('추천 결과:')
  console.log(JSON.stringify(result, null, 2))
  console.log('')

  // buildMacroAnalysis 직접 테스트
  const { buildMacroAnalysis } = await import('./api/calculate.js')
  const macroAnalysis = buildMacroAnalysis(
    [
      { name: '라면', calLow: 450, calHigh: 550, prot_g: 10, fat_g: 18, carbs_g: 65 },
      { name: '김치피자탕수육', calLow: 700, calHigh: 1000, prot_g: 20, fat_g: 40, carbs_g: 80 },
    ],
    profile,
    2129
  )

  console.log('buildMacroAnalysis 직접 호출 결과:')
  console.log(JSON.stringify(macroAnalysis, null, 2))
  console.log('')

  console.log('분석 문구:', macroAnalysis.analysis)
  console.log('총 칼로리 범위:', macroAnalysis.totalCalLow, '~', macroAnalysis.totalCalHigh, 'kcal')
  console.log('총 단백질:', macroAnalysis.totalProt_g, 'g (목표:', macroAnalysis.targetProtein_g, 'g)')
  console.log('총 지방:', macroAnalysis.totalFat_g, 'g (목표:', macroAnalysis.targetFat_g, 'g)')
  console.log('총 탄수화물:', macroAnalysis.totalCarbs_g, 'g (목표:', macroAnalysis.targetCarbs_g, 'g)')
}

main().catch(err => {
  console.error('오류:', err)
  process.exit(1)
})

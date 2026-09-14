import 'dotenv/config'
import { interpretFoodsWithSolar } from './api/solar.js'

async function main() {
  const userFoods = process.argv.slice(2)
  if (userFoods.length === 0) {
    console.error('사용법: node test-userfood.js "음식1" "음식2" ...')
    console.error('예: node test-userfood.js "삼겹살 200g" "밥 한공기"')
    process.exit(1)
  }

  console.log('유저 입력 음식:', userFoods.join(', '))
  console.log('---')

  const result = await interpretFoodsWithSolar(userFoods, [])

  if (result.error) {
    console.error('오류:', result.error)
    process.exit(1)
  }

  for (const f of result.foods) {
    console.log(`이름: ${f.name}`)
    console.log(`  양: ${f.qty}`)
    console.log(`  칼로리: ${f.calLow}~${f.calHigh} kcal`)
    console.log(`  탄단지: 단백질 ${f.prot_g}g / 지방 ${f.fat_g}g / 탄수화물 ${f.carbs_g}g`)
    console.log(`  참고: ${f.note || '(없음)'}`)
    console.log()
  }
}

main().catch(err => {
  console.error('실행 오류:', err)
  process.exit(1)
})

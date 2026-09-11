// 테스트용 스크립트: 프로필 저장 버튼 클릭 시뮬레이션
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf-8');

// saveProfileBtn 클릭 이벤트 리스너 추출
const clickHandlerMatch = html.match(/\$'\(saveProfileBtn\)'\)\.addEventListener\('click',\s*\(\)\s*=>\s*\{[\s\S]*?\n\}\);/);
if (clickHandlerMatch) {
  console.log('클릭 핸들러 찾음:');
  console.log(clickHandlerMatch[0].substring(0, 200) + '...');
} else {
  console.log('클릭 핸들러를 찾을 수 없음');
}

// 버튼이 DOM에 있는지 확인 (simple check)
const buttonMatch = html.match(/<button[^>]*id="saveProfileBtn"[^>]*>/);
if (buttonMatch) {
  console.log('\n버튼 HTML:', buttonMatch[0]);
} else {
  console.log('\n버튼 HTML 없음');
}

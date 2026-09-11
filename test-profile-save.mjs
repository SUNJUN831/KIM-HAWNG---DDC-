import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const htmlPath = path.join(__dirname, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf-8');

// saveProfileBtn 클릭 이벤트 리스너 추출
const clickHandlerMatch = html.match(/\$'\(saveProfileBtn\)'\)\.addEventListener\('click',\s*\(\)\s*=>\s*\{[\s\S]*?\n\}\);/);
if (clickHandlerMatch) {
  console.log('클릭 핸들러 찾음:');
  console.log(clickHandlerMatch[0].substring(0, 300) + '...');
} else {
  console.log('클릭 핸들러를 찾을 수 없음');
}

// 버튼이 DOM에 있는지 확인
const buttonMatch = html.match(/<button[^>]*id="saveProfileBtn"[^>]*>/);
if (buttonMatch) {
  console.log('\n버튼 HTML:', buttonMatch[0]);
} else {
  console.log('\n버튼 HTML 없음');
}

// 전체 스크립트 태그 확인
const scriptMatch = html.match(/<script>[\s\S]*<\/script>/);
if (scriptMatch) {
  console.log('\n스크립트 태그 발견, 길이:', scriptMatch[0].length);
} else {
  console.log('\n스크립트 태그 없음');
}

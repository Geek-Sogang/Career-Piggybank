// 데모 웹 셸: export된 dist/index.html에 아이폰 비율 프레임 CSS를 주입한다.
// output:"single"에선 +html.tsx가 무시되므로 export 후 이 스크립트로 처리한다.
// 사용: node scripts/inject-phone-frame.mjs [dist/index.html]
import fs from 'node:fs';

const file = process.argv[2] || 'dist/index.html';
const CSS = `
html, body { height: 100%; margin: 0; }
body { background:#0e1013; display:flex; align-items:center; justify-content:center; overflow:hidden; }
#root {
  flex: none !important;
  width: auto;
  height: min(860px, calc(100dvh - 24px));
  aspect-ratio: 390 / 844;
  max-width: calc(100vw - 24px);
  background:#F7F8FA;
  border-radius: 46px;
  overflow: hidden;
  box-shadow: 0 0 0 10px #111318, 0 0 0 12px #2b2e35, 0 26px 80px rgba(0,0,0,.6);
}
@media (max-width: 520px) {
  body { background:#F7F8FA; }
  #root { width:100%; height:100dvh; aspect-ratio:auto; max-width:none; border-radius:0; box-shadow:none; }
}`;
const TAG = `<style id="phone-frame">${CSS}</style>`;

let html = fs.readFileSync(file, 'utf8');
if (html.includes('id="phone-frame"')) {
  console.log('phone frame already present');
} else {
  html = html.replace('</head>', `  ${TAG}\n  </head>`);
  fs.writeFileSync(file, html);
  console.log('injected phone frame into', file);
}

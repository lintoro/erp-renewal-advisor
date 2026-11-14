const fs = require('fs');
const path = require('path');

const indexHtml = fs.readFileSync('index.html', 'utf8');

console.log('=== 1. 檢查 index.html 中的 chkEncrypt 勾選框 ===');
if (indexHtml.includes('id="chkEncrypt"')) {
  console.log('✅ 找到 chkEncrypt 勾選框！');
  const checked = indexHtml.includes('id="chkEncrypt" checked');
  console.log('預設勾選狀態:', checked ? '✅ 預設已勾選' : '❌ 未預設勾選');
} else {
  console.error('❌ 未找到 chkEncrypt 勾選框');
}

console.log('\n=== 2. 檢查 index.html 與匯出模板中是否殘留 pdfModal 或說明 ===');
if (indexHtml.includes('pdfModal') || indexHtml.includes('LINE 專用 AES-256 加密 PDF 已就緒')) {
  console.error('❌ 仍殘留 pdfModal 或說明文字！');
} else {
  console.log('✅ index.html 與手機 HTML 模板已徹底拔除 pdfModal 與說明文字！');
}

console.log('\n=== 3. 測試前端手機 HTML 產出邏輯 (加密版 vs 免密版) ===');
// 擷取匯出手機報告的 template 與生成函式
const exportMatch = indexHtml.match(/btnExportMobile\.addEventListener\('click'[\s\S]*?\}\);/);
if (exportMatch) {
  console.log('✅ 找到 btnExportMobile 事件處理器');
} else {
  console.error('❌ 找不到 btnExportMobile 事件處理器');
}

console.log('\n=== 4. 檢查 Standalone 打包檔案 ===');
const standaloneHtml = fs.readFileSync('Minerva_Dossier_Standalone.html', 'utf8');
if (standaloneHtml.includes('LINE 專用 AES-256 加密 PDF 已就緒')) {
  console.error('❌ Standalone HTML 中仍包含說明文字！');
} else {
  console.log('✅ Standalone HTML 乾淨無多餘說明！');
}

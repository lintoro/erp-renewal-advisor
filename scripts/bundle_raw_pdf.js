const fs = require('fs');
const path = require('path');

const rawPdfPath = path.join(__dirname, '../output/專櫃合約評估_00032_高管手機加密報告_raw.pdf');
if (!fs.existsSync(rawPdfPath)) {
  console.error('❌ raw PDF 不存在:', rawPdfPath);
  process.exit(1);
}

const b64 = fs.readFileSync(rawPdfPath).toString('base64');
const targetFile = path.join(__dirname, '../src/mobile/raw_pdf_assets.js');

const code = `/**
 * 內嵌標準 Raw PDF 樣板 (Base64) - 供純前端離線動態加密並直接下載至 Downloads 資料夾
 */
window.__RAW_PDF_TEMPLATE__ = "${b64}";
window.__RAW_PDF_00032__ = window.__RAW_PDF_TEMPLATE__;
`;

fs.writeFileSync(targetFile, code, 'utf8');
console.log('✅ 成功寫入 src/mobile/raw_pdf_assets.js，檔案大小:', (fs.statSync(targetFile).size / 1024).toFixed(1), 'KB');

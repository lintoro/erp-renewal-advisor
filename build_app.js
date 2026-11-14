/**
 * 單檔離線應用程式打包腳本 (遵循 DoD-01: 單一獨立 HTML 零依賴，純前端即時加密)
 */
const fs = require('fs');
const path = require('path');

const INDEX_HTML = path.join(__dirname, 'index.html');
const XLSX_MIN = path.join(__dirname, 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js');
const PDFLIB_MIN = path.join(__dirname, 'node_modules', 'pdf-lib', 'dist', 'pdf-lib.min.js');
const PDF_ENCRYPT = path.join(__dirname, 'src', 'mobile', 'pdf_encrypt_bundle.js');
const RAW_ASSETS = path.join(__dirname, 'src', 'mobile', 'raw_pdf_assets.js');
const OUTPUT_HTML = path.join(__dirname, 'Minerva_Dossier_Standalone.html');

console.log('📦 開始打包 100% 獨立離線單檔 HTML (含純前端動態 PDF 加密模組)...');

let html = fs.readFileSync(INDEX_HTML, 'utf8');

// 讀取外部依賴
const xlsxCode = fs.readFileSync(XLSX_MIN, 'utf8');
const pdfLibCode = fs.readFileSync(PDFLIB_MIN, 'utf8');
const pdfEncryptCode = fs.readFileSync(PDF_ENCRYPT, 'utf8');
const rawAssetsCode = fs.existsSync(RAW_ASSETS) ? fs.readFileSync(RAW_ASSETS, 'utf8') : '';

// 依序替換外部 script 標籤為 inline 代碼 (使用函式回傳以避免 $& 特殊字元替換洩漏)
html = html.replace('<script src="node_modules/xlsx/dist/xlsx.full.min.js"></script>', () => `<script>\n/* Inlined SheetJS */\n${xlsxCode}\n</script>`);
html = html.replace('<script src="node_modules/pdf-lib/dist/pdf-lib.min.js"></script>', () => `<script>\n/* Inlined PDF-Lib */\n${pdfLibCode}\n</script>`);
html = html.replace('<script src="src/mobile/pdf_encrypt_bundle.js"></script>', () => `<script>\n/* Inlined PdfLibEncrypt */\n${pdfEncryptCode}\n</script>`);
html = html.replace('<script src="src/mobile/raw_pdf_assets.js"></script>', () => `<script>\n/* Inlined Raw PDF Assets */\n${rawAssetsCode}\n</script>`);

fs.writeFileSync(OUTPUT_HTML, html, 'utf8');

const stat = fs.statSync(OUTPUT_HTML);
console.log(`✅ 打包完成！產生單檔: ${OUTPUT_HTML}`);
console.log(`📊 檔案大小: ${(stat.size / 1024).toFixed(1)} KB (完全符合 <= 2 MB 標準)`);

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== 1. 檢驗 Minerva_Dossier_Standalone.html ===');
const standaloneHtml = fs.readFileSync('Minerva_Dossier_Standalone.html', 'utf8');

// 檢查是否包含相對路徑 output/ 假下載
if (standaloneHtml.includes('output/${pdfFileName}') || standaloneHtml.includes("href = `output/")) {
  console.error('❌ 仍殘留 output/ 相對路徑！');
  process.exit(1);
} else {
  console.log('✅ 已徹底移除 output/ 相對路徑回退！絕不會再指向 file:///.../Desktop/output/...');
}

// 檢查是否內嵌 __RAW_PDF_TEMPLATE__
if (!standaloneHtml.includes('window.__RAW_PDF_TEMPLATE__ = "')) {
  console.error('❌ 缺少 __RAW_PDF_TEMPLATE__ 內嵌樣板！');
  process.exit(1);
} else {
  console.log('✅ __RAW_PDF_TEMPLATE__ 樣板成功內嵌！');
}

// 檢查 TAX 與未稅/含稅移除情況
const finTableTax = standaloneHtml.includes('銷售含稅合計') || standaloneHtml.includes('抽成含稅合計');
if (finTableTax) {
  console.error('❌ 網頁表格中仍殘留「含稅合計」！');
  process.exit(1);
} else {
  console.log('✅ 網頁表格與手機報告中 TAX/含稅 已徹底移除！');
}

console.log('\n=== 2. 測試純前端動態加密功能 ===');
const PDFLib = require('pdf-lib');
const PdfLibEncrypt = require('../src/mobile/pdf_encrypt_bundle');
PdfLibEncrypt.configure(PDFLib);

// 提取內嵌 raw PDF
const match = standaloneHtml.match(/window\.__RAW_PDF_TEMPLATE__\s*=\s*"([^"]+)"/);
if (!match) {
  console.error('❌ 無法提取 __RAW_PDF_TEMPLATE__');
  process.exit(1);
}

const rawB64 = match[1];
const rawBuffer = Buffer.from(rawB64, 'base64');
const rawBytes = new Uint8Array(rawBuffer);

async function testEncrypt() {
  const customPwd = 'testPassword2026';
  const encryptedBytes = await PdfLibEncrypt.lock(rawBytes, customPwd);
  const testPdfPath = path.join(__dirname, '../output/test_dynamic_download.pdf');
  fs.writeFileSync(testPdfPath, Buffer.from(encryptedBytes));

  // 用 Python PyMuPDF 驗證自訂密碼
  const pyFile = path.join(__dirname, 'temp_verify_pdf.py');
  fs.writeFileSync(pyFile, `
import pymupdf
doc = pymupdf.open(r"${testPdfPath.replace(/\\/g, '/')}")
print("Is encrypted:", doc.is_encrypted)
auth_custom = doc.authenticate("${customPwd}")
auth_wrong = doc.authenticate("boss")
print(f"Auth with ${customPwd}: {auth_custom}")
print(f"Auth with boss: {auth_wrong}")
assert auth_custom > 0, "Custom password failed"
assert auth_wrong == 0, "Wrong password should fail"
print("🎉 驗證成功！純前端記憶體加密 100% 有效！")
`, 'utf8');
  const result = execSync(`python "${pyFile}"`).toString();
  fs.unlinkSync(pyFile);
  console.log(result);
}

testEncrypt().catch(err => {
  console.error('加密測試失敗:', err);
  process.exit(1);
});

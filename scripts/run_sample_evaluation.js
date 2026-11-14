/**
 * 專櫃續約精算與全通道（PDF+HTML+Excel）報告生成腳本
 * 參數與預設值由 .env 或命令列參數傳入
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { execSync } = require('child_process');

// 原生載入 .env 環境變數 (無需額外依賴)
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const k = trimmed.slice(0, eqIdx).trim();
      const v = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  });
}

const { sniffTableType, TABLE_TYPES } = require('../src/utils/sniff_tables');
const { parseTableRows, generateDossierData } = require('../src/etl/dossier_generator');
const { buildDossierWorkbook } = require('../src/excel/workbook_builder');
const { computeLeasingAdvisory } = require('../src/etl/advisory_engine');
const { buildEncryptedMobilePackage } = require('../src/mobile/mobile_encryptor');

const ROWDATE_DIR = path.join(__dirname, '..', 'rowdate');
const OUTPUT_DIR = path.join(__dirname, '..', 'output');

console.log('======================================================================');
console.log('🚀 開始執行專櫃續約精算與全通道（PDF+HTML+Excel）報告生成...');
console.log('======================================================================');

const files = fs.readdirSync(ROWDATE_DIR).filter(f => f.endsWith('.xlsx'));
const loadedTables = { contracts: [], commissions: [], deductions: [], monthly: [] };

for (const file of files) {
  if (file.includes('代扣款流水明細') || file.includes('專櫃歷史代扣款流水明細')) continue;

  const filePath = path.join(ROWDATE_DIR, file);
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const info = sniffTableType(sheet, file);

  console.log(`  📄 檔案: [${file}] -> 辨識為: 【${info.name}】`);
  const rows = parseTableRows(sheet, info.headerRow, info.isDoubleHeader);

  switch (info.type) {
    case TABLE_TYPES.CONTRACT_STATUS: loadedTables.contracts = rows; break;
    case TABLE_TYPES.COMMISSION_RATES: loadedTables.commissions = rows; break;
    case TABLE_TYPES.DEDUCTION_ITEMS: loadedTables.deductions = rows; break;
    case TABLE_TYPES.MONTHLY_SUMMARY: loadedTables.monthly = rows; break;
  }
}

const targetCounterId = process.argv[2] || process.env.DEFAULT_COUNTER_ID || '';
const targetPassword = process.argv[3] || process.env.DEFAULT_REPORT_PASSWORD || '';
if (!targetCounterId) {
  console.error('❌ 請於 .env 設定 DEFAULT_COUNTER_ID 或透過命令列參數傳入專櫃編號');
  process.exit(1);
}
const selectedVersions = ['5', '4'];
const storeArea = process.env.DEFAULT_STORE_AREA || '15 坪';
const dossier = generateDossierData(loadedTables, targetCounterId, selectedVersions, storeArea);

// 1. 執行續約精算決策模式
const allContractsOfCounter = loadedTables.contracts.filter(c => String(c['專櫃編號'] || '').padStart(5, '0') === targetCounterId);
const advisory = computeLeasingAdvisory(dossier.meta, dossier.terms, dossier.financials, allContractsOfCounter);

console.log('\n----------------------------------------------------------------------');
console.log('🎯 續約決策精算結果：');
console.log(`  • 續約建議方向: ${advisory.renewalAction}`);
console.log(`  • 抽成調整建議: ${advisory.currentBaseRate} ➔ ${advisory.recommendedBaseRate} (${advisory.rateChangeDelta})`);
console.log(`  • 建議月包底金額: ${advisory.recommendedBaseRent}`);
console.log(`  • 抽成形式策略: ${advisory.commissionStrategy}`);
console.log(`  • 談判作戰籌碼:`);
advisory.negotiationPoints.forEach(p => console.log(`     - ${p}`));

// 2. 輸出三頁式 Excel
const outWb = buildDossierWorkbook(dossier);
const excelPath = path.join(OUTPUT_DIR, `專櫃合約評估報告_${targetCounterId}_第${selectedVersions.join('-')}期.xlsx`);
XLSX.writeFile(outWb, excelPath);

// 3. 輸出手機 AES-256 加密 HTML 報告
const encryptedHtml = buildEncryptedMobilePackage(dossier, advisory, targetPassword);
const mobileHtmlPath = path.join(OUTPUT_DIR, `專櫃合約評估_${targetCounterId}_高管手機加密報告.html`);
fs.writeFileSync(mobileHtmlPath, encryptedHtml, 'utf8');

// 4. 輸出 LINE 專用 AES-256 加密 PDF 報告 (手機免解壓直開)
const tempJsonPath = path.join(__dirname, `temp_dossier_${targetCounterId}.json`);
fs.writeFileSync(tempJsonPath, JSON.stringify({ dossier, advisory }), 'utf8');
const mobilePdfPath = path.join(OUTPUT_DIR, `專櫃合約評估_${targetCounterId}_高管手機加密報告.pdf`);
const pyScript = path.join(__dirname, '../src/mobile/pdf_encryptor.py');

try {
  execSync(`python "${pyScript}" "${tempJsonPath}" "${mobilePdfPath}" "${targetPassword}"`);
  if (fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath);
} catch (err) {
  console.error('PDF 生成失敗:', err);
}

console.log('\n======================================================================');
console.log(`🎉 全套成果成功產出！`);
console.log(`📊 1. 電腦端三頁式 Excel: ${excelPath}`);
console.log(`📱 2. 手機端 AES-256 加密 HTML 報告: ${mobileHtmlPath}`);
console.log(`📄 3. LINE 傳送專用 AES-256 加密 PDF: ${mobilePdfPath} (LINE 原生直接輸入密碼開啟)`);
console.log(`   (設定解鎖密碼: ${targetPassword})`);
console.log('======================================================================');

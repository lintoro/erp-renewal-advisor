const fs = require('fs');

let indexHtml = fs.readFileSync('index.html', 'utf8');

// 讀取新的 advisory_engine.js 內容並將其轉化為前端專用函式
const advEngineContent = fs.readFileSync('src/etl/advisory_engine.js', 'utf8');
const funcStart = advEngineContent.indexOf('function computeLeasingAdvisory');
const funcEnd = advEngineContent.indexOf('module.exports');
let funcCode = advEngineContent.slice(funcStart, funcEnd).trim();

// 前端原有的 computeAdvisory 函式
const oldAdvStart = indexHtml.indexOf('function computeAdvisory(dossier, allContracts) {');
const oldAdvEnd = indexHtml.indexOf('function runEvaluation() {');

// 構建新的前端 computeAdvisory 函式
const newComputeAdvisoryCode = `function computeAdvisory(dossier, allContracts) {
  const dossierMeta = dossier.meta || {};
  const terms = dossier.terms || {};
  const financials = {
    totalSales: dossier.totalSales || 0,
    totalCommission: dossier.totalComm || 0,
    totalDeductions: dossier.totalDeduct || 0,
    monthlyRecords: dossier.records || [],
    shortfallCount: dossier.shortfallCount
  };
  return computeLeasingAdvisory(dossierMeta, terms, financials, allContracts);
}

${funcCode}
`;

indexHtml = indexHtml.slice(0, oldAdvStart) + newComputeAdvisoryCode + indexHtml.slice(oldAdvEnd);

// 更新 renderDashboard 中的屬性映射（advisory_engine 回傳的名稱對齊）
const oldHeroRender = `    document.getElementById('heroAction').innerText = a.renewalAction;
    document.getElementById('heroRate').innerText = \`\${a.currentRate} ➔ \${a.recRate} (\${a.rateChange})\`;
    document.getElementById('heroBaseRent').innerText = a.recBaseRent;
    document.getElementById('heroStrategy').innerText = a.strategy;
    document.getElementById('heroPointsList').innerHTML = a.points.map(p => \`<li>\${p}</li>\`).join('');`;

const newHeroRender = `    document.getElementById('heroAction').innerText = a.renewalAction;
    const curR = a.currentBaseRate || a.currentRate;
    const recR = a.recommendedBaseRate || a.recRate;
    const rDelta = a.rateChangeDelta || a.rateChange;
    document.getElementById('heroRate').innerText = \`\${curR} ➔ \${recR} (\${rDelta})\`;
    document.getElementById('heroBaseRent').innerText = a.recommendedBaseRent || a.recBaseRent;
    document.getElementById('heroStrategy').innerText = a.commissionStrategy || a.strategy;
    const pts = a.negotiationPoints || a.points || [];
    document.getElementById('heroPointsList').innerHTML = pts.map(p => \`<li>\${p}</li>\`).join('');`;

indexHtml = indexHtml.replace(oldHeroRender, newHeroRender);

// 更新 Tab 3 評分卡
const oldScorecard = `    renderTable('tbl-scorecard', [
      ['談判維度', '精算數值與建議策略'],
      ['建議續約結論', a.renewalAction],
      ['抽成模式策略', a.strategy],
      ['作戰籌碼 1', a.points[0] || ''],
      ['作戰籌碼 2', a.points[1] || ''],
      ['作戰籌碼 3', a.points[2] || '']
    ]);`;

const newScorecard = `    const ptsList = a.negotiationPoints || a.points || [];
    renderTable('tbl-scorecard', [
      ['談判維度', '精算數值與建議策略'],
      ['建議續約結論', a.renewalAction],
      ['抽成模式策略', a.commissionStrategy || a.strategy],
      ['建議抽成調整', \`\${a.currentBaseRate || a.currentRate} ➔ \${a.recommendedBaseRate || a.recRate} (\${a.rateChangeDelta || a.rateChange})\`],
      ['建議月包底金額', a.recommendedBaseRent || a.recBaseRent],
      ['未達包底次數統計', (a.shortfallCount !== undefined ? \`\${a.shortfallCount} 次 (累計補足 NT$ \${(a.totalShortfallAmt||0).toLocaleString()})\` : '0 次')],
      ['作戰籌碼 1', ptsList[0] || ''],
      ['作戰籌碼 2', ptsList[1] || ''],
      ['作戰籌碼 3', ptsList[2] || '']
    ]);`;

indexHtml = indexHtml.replace(oldScorecard, newScorecard);

fs.writeFileSync('index.html', indexHtml, 'utf8');
console.log('Successfully synchronized advisory logic into index.html');

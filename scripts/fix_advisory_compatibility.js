const fs = require('fs');

let s = fs.readFileSync('index.html', 'utf8');

// 1. 修正 computeAdvisory 返回相容性屬性
const oldReturnObj = `  return {
    renewalAction,
    commissionStrategy,
    currentBaseRate: currentBaseRate > 0 ? \`\${currentBaseRate}%\` : '未載明',
    recommendedBaseRate: recommendedBaseRate > 0 ? \`\${recommendedBaseRate}%\` : '未載明',
    rateChangeDelta: rateChangeDelta > 0 ? \`+\${rateChangeDelta}%\` : (rateChangeDelta < 0 ? \`\${rateChangeDelta}%\` : '持平 (0%)'),
    recommendedTierRule,
    recommendedBaseRent: recommendedBaseRent > 0 ? \`NT$ \${recommendedBaseRent.toLocaleString()} / 月\` : '依現行約定',
    avgMonthlySales: avgMonthlySales > 0 ? \`NT$ \${avgMonthlySales.toLocaleString()}\` : '無數據',
    avgMonthlyDeductions: avgMonthlyDeductions > 0 ? \`NT$ \${avgMonthlyDeductions.toLocaleString()}\` : '無數據',
    shortfallCount,
    totalShortfallAmt,
    salesPerPing: salesPerPing > 0 ? \`NT$ \${salesPerPing.toLocaleString()} / 坪\` : '未填坪數',
    growthRateStr: growthRate !== 0 ? \`\${growthRate > 0 ? '+' : ''}\${growthRate}%\` : '持平',
    negotiationPoints
  };`;

const newReturnObj = `  const curR = currentBaseRate > 0 ? \`\${currentBaseRate}%\` : '未載明';
  const recR = recommendedBaseRate > 0 ? \`\${recommendedBaseRate}%\` : '未載明';
  const rDelta = rateChangeDelta > 0 ? \`+\${rateChangeDelta}%\` : (rateChangeDelta < 0 ? \`\${rateChangeDelta}%\` : '持平 (0%)');
  const baseRentStr = recommendedBaseRent > 0 ? \`NT$ \${recommendedBaseRent.toLocaleString()} / 月\` : '依現行約定';

  return {
    renewalAction,
    commissionStrategy,
    strategy: commissionStrategy,
    currentBaseRate: curR,
    currentRate: curR,
    recommendedBaseRate: recR,
    recRate: recR,
    rateChangeDelta: rDelta,
    rateChange: rDelta,
    recommendedTierRule,
    recommendedBaseRent: baseRentStr,
    recBaseRent: baseRentStr,
    avgMonthlySales: avgMonthlySales > 0 ? \`NT$ \${avgMonthlySales.toLocaleString()}\` : '無數據',
    avgMonthlyDeductions: avgMonthlyDeductions > 0 ? \`NT$ \${avgMonthlyDeductions.toLocaleString()}\` : '無數據',
    avgMonthlyDeduct: avgMonthlyDeductions > 0 ? \`NT$ \${avgMonthlyDeductions.toLocaleString()}\` : 'NT$ 0',
    shortfallCount,
    totalShortfallAmt,
    salesPerPing: salesPerPing > 0 ? \`NT$ \${salesPerPing.toLocaleString()} / 坪\` : '未填坪數',
    growthRateStr: growthRate !== 0 ? \`\${growthRate > 0 ? '+' : ''}\${growthRate}%\` : '持平',
    negotiationPoints,
    points: negotiationPoints
  };`;

if (s.includes(oldReturnObj)) {
  s = s.replace(oldReturnObj, newReturnObj);
  console.log('Replaced return object in index.html computeLeasingAdvisory');
} else {
  console.log('Target oldReturnObj not found');
}

// 2. 同步更新 src/etl/advisory_engine.js
let advCode = fs.readFileSync('src/etl/advisory_engine.js', 'utf8');
if (advCode.includes(oldReturnObj)) {
  advCode = advCode.replace(oldReturnObj, newReturnObj);
  fs.writeFileSync('src/etl/advisory_engine.js', advCode, 'utf8');
  console.log('Replaced return object in src/etl/advisory_engine.js');
}

fs.writeFileSync('index.html', s, 'utf8');
console.log('Done updating index.html and advisory_engine.js');

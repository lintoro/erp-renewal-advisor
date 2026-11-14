const fs = require('fs');

let code = fs.readFileSync('src/etl/dossier_generator.js', 'utf8');

// Replace the revenue data extraction logic
const targetRevenueBlock = `  // 4. 營收數據 (專櫃結帳彙總表) - 純真實變數驅動
  const monthlyRows = tables.monthly || [];
  const counterMonthlyRows = monthlyRows.filter(m => padCounterId(m['專櫃編號']) === cId);

  // 組織月度明細 (若有月結表記錄則直接提取，並與代扣明細無縫對齊)
  const monthlyRecords = [];
  let totalSales = 0;
  let totalCommission = 0;
  let totalDeductions = 0;
  let totalNetPayout = 0;
  let baseRentShortfallCount = 0;

  if (counterMonthlyRows.length > 0) {
    counterMonthlyRows.sort((a, b) => String(a['結帳年月']).localeCompare(String(b['結帳年月'])));

    counterMonthlyRows.forEach(r => {
      const ymRaw = String(r['結帳年月'] || '').trim();
      const ym = ymRaw.length === 6 ? \`\${ymRaw.substring(0, 4)}-\${ymRaw.substring(4, 6)}\` : ymRaw;
      
      const sales = safeNumber(r['銷貨淨額_合計'] || r['銷貨淨額_未稅金額'] || r['銷貨淨額']);
      const commAmt = safeNumber(r['抽成額_合計'] || r['抽成額_未稅金額'] || r['抽成額']);
      // 優先採用扣款明細表中的真實實扣總額，若無則採用結帳表中的代扣總額
      const deductAmt = monthlyDeductionMap[ym] !== undefined ? monthlyDeductionMap[ym] : safeNumber(r['應收帳款(匯總)_應收合計'] || r['應收帳款(彙總)_應收合計'] || 0);
      const shortfall = safeNumber(r['包底抽成不足(含稅)'] || r['包底抽成不足'] || 0);
      const payout = safeNumber(r['應付帳款(含稅)'] || (sales - commAmt - deductAmt));
      const mallRevenue = commAmt + deductAmt + shortfall;

      if (shortfall > 0) baseRentShortfallCount++;

      totalSales += sales;
      totalCommission += commAmt;
      totalDeductions += deductAmt;
      totalNetPayout += payout;

      monthlyRecords.push({
        month: ym,
        sales,
        commission: commAmt,
        effectiveRate: sales > 0 ? (commAmt / sales * 100).toFixed(2) + '%' : '0.00%',
        deductions: deductAmt,
        baseRentShortfall: shortfall,
        mallRevenue,
        netPayout: payout
      });
    });
  } else if (Object.keys(monthlyDeductionMap).length > 0) {`;

const newRevenueBlock = `  // 4. 營收數據 (專櫃結帳彙總表) - 純真實變數驅動，按月彙總並記錄未稅/稅額/含稅
  const monthlyRows = tables.monthly || [];
  const counterMonthlyRows = monthlyRows.filter(m => {
    const cid = padCounterId(m['專櫃編號']);
    const ymRaw = String(m['結帳年月'] || '').trim();
    return cid === cId && ymRaw.length === 6 && (ymRaw >= contractStartYM && ymRaw <= contractEndYM);
  });

  const monthlyRecords = [];
  let totalSales = 0;
  let totalCommission = 0;
  let totalDeductions = 0;
  let totalNetPayout = 0;
  let baseRentShortfallCount = 0;

  if (counterMonthlyRows.length > 0) {
    // 依月份彙總（避免同月份有多筆結帳帳次）
    const monthGroupMap = {};
    counterMonthlyRows.forEach(r => {
      const ymRaw = String(r['結帳年月']).trim();
      const ym = \`\${ymRaw.substring(0, 4)}-\${ymRaw.substring(4, 6)}\`;
      if (!monthGroupMap[ym]) {
        monthGroupMap[ym] = {
          month: ym,
          sales_untaxed: 0,
          sales_tax: 0,
          sales_total: 0,
          comm_untaxed: 0,
          comm_tax: 0,
          comm_total: 0,
          shortfall: 0,
          reportDeduct: 0,
          payout: 0,
          commType: r['抽成別'] || ''
        };
      }
      const sUn = safeNumber(r['銷貨淨額_未稅金額'] || r['銷貨淨額']);
      const sTax = safeNumber(r['銷貨淨額_稅額'] || r['稅額']);
      const sTot = safeNumber(r['銷貨淨額_合計']) || (sUn + sTax);

      const cUn = safeNumber(r['抽成額_未稅金額'] || r['抽成額']);
      const cTax = safeNumber(r['抽成額_稅額']);
      const cTot = safeNumber(r['抽成額_合計']) || (cUn + cTax);

      const sf = safeNumber(r['包底抽成不足(含稅)'] || r['包底抽成不足'] || 0);
      const dTot = safeNumber(r['應收帳款(匯總)_應收合計'] || r['應收帳款(彙總)_應收合計'] || 0);
      const pay = safeNumber(r['應付帳款(含稅)'] || 0);

      monthGroupMap[ym].sales_untaxed += sUn;
      monthGroupMap[ym].sales_tax += sTax;
      monthGroupMap[ym].sales_total += sTot;
      monthGroupMap[ym].comm_untaxed += cUn;
      monthGroupMap[ym].comm_tax += cTax;
      monthGroupMap[ym].comm_total += cTot;
      monthGroupMap[ym].shortfall += sf;
      monthGroupMap[ym].reportDeduct += dTot;
      monthGroupMap[ym].payout += pay;
    });

    const sortedYMs = Object.keys(monthGroupMap).sort();
    sortedYMs.forEach(ym => {
      const g = monthGroupMap[ym];
      const deductAmt = monthlyDeductionMap[ym] !== undefined ? monthlyDeductionMap[ym] : g.reportDeduct;
      const mallRevenue = g.comm_total + deductAmt + g.shortfall;
      const netPay = g.payout || (g.sales_total - g.comm_total - deductAmt);

      if (g.shortfall > 0) baseRentShortfallCount++;

      totalSales += g.sales_untaxed;
      totalCommission += g.comm_total;
      totalDeductions += deductAmt;
      totalNetPayout += netPay;

      // 產生包底狀態備註
      let shortfallNote = '達標 (無不足額)';
      if (g.shortfall > 0) {
        shortfallNote = \`未達包底 (補足差額 NT$ \${g.shortfall.toLocaleString()})\`;
      }

      monthlyRecords.push({
        month: ym,
        sales: g.sales_untaxed,
        sales_untaxed: g.sales_untaxed,
        sales_tax: g.sales_tax,
        sales_total: g.sales_total,
        commission: g.comm_total,
        comm_untaxed: g.comm_untaxed,
        comm_tax: g.comm_tax,
        comm_total: g.comm_total,
        effectiveRate: g.sales_untaxed > 0 ? (g.comm_total / g.sales_untaxed * 100).toFixed(2) + '%' : '0.00%',
        deductions: deductAmt,
        baseRentShortfall: g.shortfall,
        shortfallNote,
        mallRevenue,
        netPayout: netPay
      });
    });
  } else if (Object.keys(monthlyDeductionMap).length > 0) {`;

if (code.includes('// 4. 營收數據 (專櫃結帳彙總表) - 純真實變數驅動')) {
  const p1 = code.indexOf('// 4. 營收數據 (專櫃結帳彙總表) - 純真實變數驅動');
  const p2 = code.indexOf('} else if (Object.keys(monthlyDeductionMap).length > 0) {', p1);
  const target = code.slice(p1, p2 + '} else if (Object.keys(monthlyDeductionMap).length > 0) {'.length);
  code = code.replace(target, newRevenueBlock);
  fs.writeFileSync('src/etl/dossier_generator.js', code, 'utf8');
  console.log('Successfully updated revenue block in dossier_generator.js');
} else {
  console.log('Could not find revenue block header in dossier_generator.js');
}

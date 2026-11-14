const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { parseTableRows } = require('../src/etl/dossier_generator');

const wb = XLSX.readFile(path.join(__dirname, '../rowdate/樹德企業股份有限公司 專櫃結帳彙總表_20261111.xlsx'));
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = parseTableRows(sheet, 4, true).filter(r => r['結帳年月'] && String(r['結帳年月']).trim().length === 6);

// Group by month
const grouped = {};
rows.forEach(r => {
  const ymRaw = String(r['結帳年月']).trim();
  const ym = `${ymRaw.substring(0, 4)}-${ymRaw.substring(4, 6)}`;
  if (!grouped[ym]) {
    grouped[ym] = {
      month: ym,
      sales_untaxed: 0,
      sales_tax: 0,
      sales_total: 0,
      comm_untaxed: 0,
      comm_tax: 0,
      comm_total: 0,
      deduct_total: 0,
      shortfall: 0,
      payout: 0,
      commType: r['抽成別'] || ''
    };
  }
  const sUn = Number(r['銷貨淨額_未稅金額']) || 0;
  const sTax = Number(r['銷貨淨額_稅額']) || 0;
  const cUn = Number(r['抽成額_未稅金額']) || 0;
  const cTax = Number(r['抽成額_稅額']) || 0;
  const cTot = Number(r['抽成額_合計']) || (cUn + cTax);
  const sTot = sUn + sTax;
  const sf = Number(r['包底抽成不足(含稅)']) || 0;
  const dTot = Number(r['應收帳款(匯總)_應收合計']) || 0;
  const pay = Number(r['應付帳款(含稅)']) || 0;

  grouped[ym].sales_untaxed += sUn;
  grouped[ym].sales_tax += sTax;
  grouped[ym].sales_total += sTot;
  grouped[ym].comm_untaxed += cUn;
  grouped[ym].comm_tax += cTax;
  grouped[ym].comm_total += cTot;
  grouped[ym].deduct_total += dTot;
  grouped[ym].shortfall += sf;
  grouped[ym].payout += pay;
});

const months = Object.keys(grouped).sort();
console.log('Total unique months:', months.length);
console.log('Last 12 months:');
const last12 = months.slice(-12);
last12.forEach(m => {
  const g = grouped[m];
  console.log(`  ${g.month} | 銷貨未稅:${g.sales_untaxed} 稅額:${g.sales_tax} 合計:${g.sales_total} | 抽成未稅:${g.comm_untaxed} 稅額:${g.comm_tax} 合計:${g.comm_total} | 不足差額:${g.shortfall}`);
});

console.log('\n2022-08:');
const g202208 = grouped['2022-08'];
console.log(`  2022-08 | 銷貨未稅:${g202208.sales_untaxed} 稅額:${g202208.sales_tax} 合計:${g202208.sales_total} | 抽成未稅:${g202208.comm_untaxed} 稅額:${g202208.comm_tax} 合計:${g202208.comm_total} | 不足差額:${g202208.shortfall}`);

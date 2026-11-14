const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { parseTableRows } = require('../src/etl/dossier_generator');

const wb = XLSX.readFile(path.join(__dirname, '../rowdate/樹德企業股份有限公司 專櫃結帳彙總表_20261111.xlsx'));
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = parseTableRows(sheet, 4, true).filter(r => r['結帳年月'] && String(r['結帳年月']).trim().length === 6);

const byYear = {};
rows.forEach(r => {
  const ym = String(r['結帳年月']).trim();
  const y = ym.slice(0, 4);
  if (!byYear[y]) byYear[y] = { sales: 0, comm: 0, sf: 0, months: 0, sfMonths: 0 };
  const s = Number(r['銷貨淨額_未稅金額']) || 0;
  const c = Number(r['抽成額_合計']) || 0;
  const sf = Number(r['包底抽成不足(含稅)']) || 0;
  byYear[y].sales += s;
  byYear[y].comm += c;
  byYear[y].sf += sf;
  byYear[y].months++;
  if (sf > 0) byYear[y].sfMonths++;
});

for (const [y, d] of Object.entries(byYear)) {
  const avg = Math.round(d.sales / d.months);
  console.log(`Year ${y} (${d.months} 個月): 未稅銷售 NT$ ${d.sales.toLocaleString()} | 月均: NT$ ${avg.toLocaleString()} | 包底不足次數: ${d.sfMonths} 次 | 不足補足額: NT$ ${d.sf.toLocaleString()}`);
}

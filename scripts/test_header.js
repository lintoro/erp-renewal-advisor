const XLSX = require('xlsx');
const path = require('path');
const wb = XLSX.readFile(path.join(__dirname, '../rowdate/樹德企業股份有限公司 專櫃結帳彙總表_20261111.xlsx'));
const sheet = wb.Sheets[wb.SheetNames[0]];

const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z1000');
const headerRowIdx = 4;
console.log('Range:', range);

for (let C = range.s.c; C <= range.e.c; ++C) {
  const topCell = sheet[XLSX.utils.encode_cell({ r: headerRowIdx, c: C })];
  const subCell = sheet[XLSX.utils.encode_cell({ r: headerRowIdx + 1, c: C })];
  const topVal = topCell ? String(topCell.v).trim() : '';
  const subVal = subCell ? String(subCell.v).trim() : '';
  console.log(`C: ${C} | Top: "${topVal}" | Sub: "${subVal}"`);
}

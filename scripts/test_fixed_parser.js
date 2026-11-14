const XLSX = require('xlsx');

function parseTableRowsFixed(sheet, headerRowIdx, isDoubleHeader = false) {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z1000');
  
  const colHeaders = {};
  if (isDoubleHeader) {
    let currentCategory = '';
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const topCell = sheet[XLSX.utils.encode_cell({ r: headerRowIdx, c: C })];
      const subCell = sheet[XLSX.utils.encode_cell({ r: headerRowIdx + 1, c: C })];
      const topVal = topCell ? String(topCell.v).trim() : '';
      const subVal = subCell ? String(subCell.v).trim() : '';
      
      if (topVal) {
        currentCategory = topVal;
      }

      if (currentCategory && subVal) {
        colHeaders[C] = `${currentCategory}_${subVal}`;
      } else if (subVal) {
        colHeaders[C] = subVal;
      } else if (topVal) {
        colHeaders[C] = topVal;
      } else {
        colHeaders[C] = `COL_${C}`;
      }
    }
  } else {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = sheet[XLSX.utils.encode_cell({ r: headerRowIdx, c: C })];
      colHeaders[C] = cell ? String(cell.v).trim() : `COL_${C}`;
    }
  }

  const startRow = isDoubleHeader ? headerRowIdx + 2 : headerRowIdx + 1;
  const rows = [];

  for (let R = startRow; R <= range.e.r; ++R) {
    const rowObj = {};
    let hasData = false;
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = sheet[XLSX.utils.encode_cell({ r: R, c: C })];
      const key = colHeaders[C];
      const val = cell !== undefined && cell.v !== undefined ? cell.v : '';
      if (val !== '') hasData = true;
      rowObj[key] = val;
    }
    if (hasData) rows.push(rowObj);
  }

  return { colHeaders, rows };
}

const path = require('path');
const wb = XLSX.readFile(path.join(__dirname, '../rowdate/樹德企業股份有限公司 專櫃結帳彙總表_20261111.xlsx'));
const sheet = wb.Sheets[wb.SheetNames[0]];

const { colHeaders, rows } = parseTableRowsFixed(sheet, 4, true);
console.log('Headers:');
for (const [c, h] of Object.entries(colHeaders)) {
  console.log(`  Col ${c} -> ${h}`);
}
const r202208 = rows.find(r => String(r['結帳年月'] || '').includes('202208'));
console.log('\nParsed 202208:');
console.log('銷貨淨額_未稅金額:', r202208['銷貨淨額_未稅金額']);
console.log('銷貨淨額_稅額:', r202208['銷貨淨額_稅額']);
console.log('銷貨淨額合計(未+稅):', Number(r202208['銷貨淨額_未稅金額']) + Number(r202208['銷貨淨額_稅額']));
console.log('抽成額_未稅金額:', r202208['抽成額_未稅金額']);
console.log('抽成額_稅額:', r202208['抽成額_稅額']);
console.log('抽成額_合計:', r202208['抽成額_合計']);
console.log('進貨淨額_未稅金額:', r202208['進貨淨額_未稅金額']);
console.log('進貨淨額_稅額:', r202208['進貨淨額_稅額']);
console.log('進貨淨額_進貨合計:', r202208['進貨淨額_進貨合計']);
console.log('包底抽成不足(含稅):', r202208['包底抽成不足(含稅)']);

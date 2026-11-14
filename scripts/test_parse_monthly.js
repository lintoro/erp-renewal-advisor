const XLSX = require('xlsx');
const path = require('path');
const { parseTableRows } = require('../src/etl/dossier_generator');

const wb = XLSX.readFile(path.join(__dirname, '../rowdate/樹德企業股份有限公司 專櫃結帳彙總表_20261111.xlsx'));
const sheet = wb.Sheets[wb.SheetNames[0]];

const rows = parseTableRows(sheet, 4, true);
console.log('Total parsed rows:', rows.length);
const row202208 = rows.find(r => String(r['結帳年月'] || '').includes('202208'));
console.log('Row 202208:', row202208);

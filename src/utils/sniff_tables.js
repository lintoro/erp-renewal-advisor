/**
 * 嚴格報表類型指紋識別器 (v1.3: 全面支援「專櫃扣款明細表」寬表與時間軸自適應)
 */
const XLSX = require('xlsx');

const TABLE_TYPES = {
  CONTRACT_STATUS: 'CONTRACT_STATUS',     // 合約狀態清單
  COMMISSION_RATES: 'COMMISSION_RATES',   // 專櫃契約抽成報表
  DEDUCTION_ITEMS: 'DEDUCTION_ITEMS',     // 專櫃契約代扣款報表 或 專櫃扣款明細表
  MONTHLY_SUMMARY: 'MONTHLY_SUMMARY',     // 專櫃結帳彙總表 / 匯總表
  PAYMENT_DETAILS: 'PAYMENT_DETAILS'      // 付款別報表 (選填)
};

function sniffTableType(sheet, fileName = '') {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z50');
  
  let headerText = fileName + ' ';
  const first10Rows = [];

  for (let R = range.s.r; R <= Math.min(range.e.r, 9); ++R) {
    const rowCells = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = sheet[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && cell.v !== undefined) {
        const val = String(cell.v).trim();
        if (val) {
          rowCells.push({ c: C, text: val });
          headerText += val + ' ';
        }
      }
    }
    first10Rows.push({ rowIdx: R, cells: rowCells });
  }

  // 1. 專櫃結帳彙總表 / 匯總表
  if (
    headerText.includes('結帳彙總表') ||
    headerText.includes('結帳匯總表') ||
    headerText.includes('結帳彙總') ||
    headerText.includes('結帳匯總') ||
    (headerText.includes('銷貨淨額') && (headerText.includes('包底抽成不足') || headerText.includes('應收帳款')))
  ) {
    let headerRow = 4;
    for (const r of first10Rows) {
      if (r.cells.some(c => c.text.includes('銷貨淨額') || c.text.includes('包底抽成不足'))) {
        headerRow = r.rowIdx;
        break;
      }
    }
    return { type: TABLE_TYPES.MONTHLY_SUMMARY, headerRow, name: '專櫃結帳彙總表', isDoubleHeader: true };
  }

  // 2. 專櫃契約抽成報表
  if (
    headerText.includes('專櫃契約抽成報表') ||
    headerText.includes('契約抽成') ||
    (headerText.includes('抽成別') && (headerText.includes('抽成類別名稱') || headerText.includes('正品') || headerText.includes('90折')))
  ) {
    let headerRow = 4;
    for (const r of first10Rows) {
      if (r.cells.some(c => c.text.includes('抽成類別名稱') || c.text.includes('正品'))) {
        headerRow = r.rowIdx;
        break;
      }
    }
    return { type: TABLE_TYPES.COMMISSION_RATES, headerRow, name: '專櫃契約抽成報表' };
  }

  // 3. 合約狀態清單
  if (
    headerText.includes('合約狀態清單') ||
    headerText.includes('合約狀態') ||
    (headerText.includes('租戶狀況') && headerText.includes('版本編號'))
  ) {
    let headerRow = 4;
    for (const r of first10Rows) {
      if (r.cells.some(c => c.text.includes('版本編號') || c.text.includes('租戶狀況'))) {
        headerRow = r.rowIdx;
        break;
      }
    }
    return { type: TABLE_TYPES.CONTRACT_STATUS, headerRow, name: '合約狀態清單' };
  }

  // 4. 專櫃扣款相關報表 (雙軌相容：專櫃契約代扣款報表 OR 專櫃扣款明細表)
  if (
    headerText.includes('扣款明細表') ||
    headerText.includes('專櫃扣款明細表') ||
    headerText.includes('專櫃契約代扣款報表') ||
    headerText.includes('代扣款報表') ||
    headerText.includes('扣款明細') ||
    (headerText.includes('收銀機租借費') && (headerText.includes('管理費') || headerText.includes('結帳年月')))
  ) {
    // 自動判定表頭列 (專櫃扣款明細表通常在 Row 5；契約代扣款表通常在 Row 3)
    let headerRow = 2; // 預設 Row 3
    let isDetailMatrix = false;
    for (const r of first10Rows) {
      if (r.cells.some(c => c.text.includes('合約編號') || c.text.includes('A01/檔期') || c.text.includes('B01/收銀機'))) {
        headerRow = r.rowIdx;
        isDetailMatrix = true;
        break;
      } else if (r.cells.some(c => c.text.includes('扣款項目名稱') || c.text.includes('扣款類別'))) {
        headerRow = r.rowIdx;
        break;
      }
    }
    return {
      type: TABLE_TYPES.DEDUCTION_ITEMS,
      headerRow,
      name: isDetailMatrix ? '專櫃扣款明細表(實扣流水)' : '專櫃契約代扣款報表(約定規則)',
      isDetailMatrix
    };
  }

  // 5. 付款別報表 (選填)
  if (
    headerText.includes('付款別報表') ||
    headerText.includes('付款別') ||
    (headerText.includes('收銀機編號') && (headerText.includes('交易序號') || headerText.includes('發票字軌')))
  ) {
    let headerRow = 3;
    for (const r of first10Rows) {
      if (r.cells.some(c => c.text.includes('收銀機編號') || c.text.includes('發票字軌'))) {
        headerRow = r.rowIdx;
        break;
      }
    }
    return { type: TABLE_TYPES.PAYMENT_DETAILS, headerRow, name: '付款別報表' };
  }

  return { type: 'UNKNOWN', headerRow: 0, name: '未知報表' };
}

module.exports = {
  TABLE_TYPES,
  sniffTableType
};

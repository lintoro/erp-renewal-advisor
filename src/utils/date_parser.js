/**
 * 日期與文字清洗工具模組 (遵循純文字流水線與嚴格保真原則)
 */

// 將 Excel 序列碼 (例如 45604, 46334) 或字串日期轉換為 YYYY-MM-DD
function parseExcelDate(val) {
  if (val === null || val === undefined || val === '') return '';
  
  const str = String(val).trim();
  if (!str) return '';

  // 1. 判斷是否為純整數 Excel 序列碼 (例如 40000 ~ 75000)
  if (/^\d{5}$/.test(str)) {
    const serial = parseInt(str, 10);
    // Excel 基準日起算為 1899-12-30 (含 1900 閏年歷史相容)
    const ms = (serial - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  // 2. 判斷 YYYY/MM/DD 或 YYYY-MM-DD 或 YYYYMMDD
  const cleanStr = str.replace(/[\/\.]/g, '-');
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(cleanStr)) {
    const parts = cleanStr.split('-');
    const y = parts[0];
    const m = parts[1].padStart(2, '0');
    const d = parts[2].substring(0, 2).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 3. 判斷 8 碼連續數字 YYYYMMDD
  if (/^\d{8}$/.test(str)) {
    const y = str.substring(0, 4);
    const m = str.substring(4, 6);
    const d = str.substring(6, 8);
    return `${y}-${m}-${d}`;
  }

  // 4. 判斷 6 碼年月 YYYYMM
  if (/^\d{6}$/.test(str)) {
    const y = str.substring(0, 4);
    const m = str.substring(4, 6);
    return `${y}-${m}`;
  }

  return str;
}

// 補足專櫃代碼前導零 (預設 5 碼)
function padCounterId(val, length = 5) {
  if (!val) return '';
  const str = String(val).trim();
  if (!str) return '';
  if (/^\d+$/.test(str)) {
    return str.padStart(length, '0');
  }
  return str;
}

// 純字串安全讀取 (Raw String Pipeline)
function rawString(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

// 金額數值安全轉換
function safeNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const num = parseFloat(String(val).replace(/,/g, '').trim());
  return isNaN(num) ? 0 : num;
}

module.exports = {
  parseExcelDate,
  padCounterId,
  rawString,
  safeNumber
};

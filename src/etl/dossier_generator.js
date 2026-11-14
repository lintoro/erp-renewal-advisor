/**
 * 三頁式專櫃合約評估報告 (Contract Dossier) 運算引擎 - v1.3 全面支援月度扣款明細寬表與時間維度自適應
 */
const { parseExcelDate, padCounterId, rawString, safeNumber } = require('../utils/date_parser');

// 解析單一表格資料為乾淨物件陣列
function parseTableRows(sheet, headerRowIdx, isDoubleHeader = false) {
  const XLSX = require('xlsx');
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z1000');
  
  const colHeaders = {};
  if (isDoubleHeader) {
    let currentCategory = '';
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const topCell = sheet[XLSX.utils.encode_cell({ r: headerRowIdx, c: C })];
      const subCell = sheet[XLSX.utils.encode_cell({ r: headerRowIdx + 1, c: C })];
      const topVal = topCell ? String(topCell.v).trim() : '';
      const subVal = subCell ? String(subCell.v).trim() : '';
      if (topVal) currentCategory = topVal;

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
    if (hasData) {
      rows.push(rowObj);
    }
  }

  return rows;
}

/**
 * 產生指定專櫃、支援「多期合約勾選」與「扣款明細自適應」之真實資料評估模型
 */
function generateDossierData(tables, targetCounterId, selectedVersions = [], storeArea = null) {
  const cId = padCounterId(targetCounterId);
  const warnings = [];

  // 1. 合約主檔驗證
  const contracts = tables.contracts || [];
  const counterContracts = contracts.filter(c => padCounterId(c['專櫃編號']) === cId);

  if (counterContracts.length === 0) {
    throw new Error(`在合約狀態清單中找不到專櫃編號 [${cId}] 之資料。`);
  }

  counterContracts.sort((a, b) => safeNumber(b['版本編號']) - safeNumber(a['版本編號']));
  const allAvailableVersions = counterContracts.map(c => String(c['版本編號']));

  let versionsToInclude = selectedVersions && selectedVersions.length > 0 ? selectedVersions.map(String) : [allAvailableVersions[0]];
  let activeContracts = counterContracts.filter(c => versionsToInclude.includes(String(c['版本編號'])));
  if (activeContracts.length === 0) {
    warnings.push(`勾選之期別 (${versionsToInclude.join(', ')}) 在合約主檔中無對應記錄，自動回退為最新一期。`);
    activeContracts = [counterContracts[0]];
    versionsToInclude = [String(counterContracts[0]['版本編號'])];
  }

  const primaryContract = activeContracts[0];
  let counterName = rawString(primaryContract['專櫃名稱']);
  let floor = rawString(primaryContract['樓層名稱']);
  let area = rawString(primaryContract['區域名稱']);
  let industry = rawString(primaryContract['業種名稱']) || rawString(primaryContract['業種編號']);
  let boothNo = rawString(primaryContract['櫃位編號']);

  // 若合約清單中無專櫃名稱、樓層或業種 (例如被脫敏)，從其他報表補齊
  if (!counterName || counterName === `專櫃 ${cId}`) {
    const dRec = (tables.deductions || []).find(r => String(r['專櫃編號'] || '').padStart(5, '0') === cId && (r['專櫃名稱'] || r['專櫃簡稱']));
    if (dRec) counterName = rawString(dRec['專櫃名稱'] || dRec['專櫃簡稱']);
    if (!counterName) {
      const mRec = (tables.monthly || []).find(r => String(r['專櫃編號'] || '').padStart(5, '0') === cId && (r['專櫃名稱'] || r['專櫃簡稱']));
      if (mRec) counterName = rawString(mRec['專櫃名稱'] || mRec['專櫃簡稱']);
    }
  }
  if (!floor) {
    const dRec = (tables.deductions || tables.commissions || []).find(r => String(r['專櫃編號'] || '').padStart(5, '0') === cId && (r['樓層'] || r['樓層名稱']));
    if (dRec) floor = rawString(dRec['樓層'] || dRec['樓層名稱']);
  }
  if (!industry) {
    const mRec = (tables.monthly || tables.commissions || []).find(r => String(r['專櫃編號'] || '').padStart(5, '0') === cId && (r['業種'] || r['業種名稱'] || r['業種中分類']));
    if (mRec) industry = rawString(mRec['業種'] || mRec['業種名稱'] || mRec['業種中分類']);
  }
  if (!counterName) counterName = `專櫃 ${cId}`;

  // 合約期間合併計算
  let earliestStart = '9999-12-31';
  let latestEnd = '0000-00-00';
  const periodDescriptions = [];

  activeContracts.forEach(c => {
    const s = parseExcelDate(c['合約起始日'] || c['正式營運起始日']);
    const e = parseExcelDate(c['合約截止日'] || c['正式營運截止日']);
    const ver = c['版本編號'];
    const st = c['租戶狀況'] || '營運中';
    periodDescriptions.push(`第 ${ver} 期 [${st}]: ${s} ~ ${e}`);
    if (s && s < earliestStart) earliestStart = s;
    if (e && e > latestEnd) latestEnd = e;
  });

  if (earliestStart === '9999-12-31') earliestStart = '2022-01-01';
  if (latestEnd === '0000-00-00') latestEnd = '2026-12-31';

  // 取得合約涵蓋的年月清單 (YYYY-MM)
  const contractStartYM = earliestStart.substring(0, 7).replace('-', '');
  const contractEndYM = latestEnd.substring(0, 7).replace('-', '');

  // 2. 抽成條件 (專櫃契約抽成報表)
  const commissionRows = tables.commissions || [];
  const counterCommissions = commissionRows.filter(c => padCounterId(c['專櫃編號']) === cId);
  let commType = '一般抽成';
  let commCat = '標準費率';
  let baseRate = 0;
  let rate90 = 0;
  let rate80 = 0;

  if (counterCommissions.length > 0) {
    const primComm = counterCommissions[0];
    commType = rawString(primComm['抽成別']) || '一般抽成';
    commCat = rawString(primComm['抽成類別名稱']) || '';
    baseRate = safeNumber(primComm['正品']);
    rate90 = safeNumber(primComm['90折']) || (baseRate > 0 ? baseRate - 1 : 0);
    rate80 = safeNumber(primComm['80折']) || (baseRate > 0 ? baseRate - 2 : 0);
  } else {
    warnings.push(`⚠️ 【專櫃契約抽成報表】未查到專櫃 [${cId}] 之抽成紀錄，抽成費率暫以 0% 標註。`);
  }

  // 3. 代扣費用自適應處理 (支援雙軌：型態 A 約定長表 vs 型態 B 實扣寬表)
  const deductionRows = tables.deductions || [];
  const counterDeductions = deductionRows.filter(d => padCounterId(d['專櫃編號']) === cId);
  
  // 判斷是否為「專櫃扣款明細表 (實扣寬表)」
  const isDetailMatrix = deductionRows.length > 0 && deductionRows[0].hasOwnProperty('結帳年月') && deductionRows[0].hasOwnProperty('總計');
  
  const formattedDeductionItems = [];
  const latestContractDeductionItems = []; // 最後一份合約設定明細
  let latestContractMonth = '';
  let latestContractNo = '';
  let latestDeductionTotal = 0;
  const monthlyDeductionMap = {}; // key: YYYY-MM, val: 實扣總額

  if (isDetailMatrix) {
    // === 型態 B: 專櫃扣款明細表 ===
    // 依合約時間維度進行過濾 (時間交集裁剪)
    const inRangeDeductions = counterDeductions.filter(d => {
      const ym = String(d['結帳年月'] || '').trim();
      return ym >= contractStartYM && ym <= contractEndYM;
    });

    // 取得該專櫃所有有效扣款記錄（依年月升冪排序）
    const allValidCounterDeductions = counterDeductions.filter(d => {
      const ym = String(d['結帳年月'] || '').trim();
      return ym.length === 6;
    }).sort((a, b) => String(a['結帳年月']).localeCompare(String(b['結帳年月'])));

    // 提取最後一份合約設定（優先取全期最後一筆，若無取區間內最後一筆）
    const lastRec = allValidCounterDeductions.length > 0 
      ? allValidCounterDeductions[allValidCounterDeductions.length - 1] 
      : (inRangeDeductions.length > 0 ? inRangeDeductions[inRangeDeductions.length - 1] : null);

    if (lastRec) {
      const ymRaw = String(lastRec['結帳年月']).trim();
      latestContractMonth = (ymRaw.length === 6) ? `${ymRaw.substring(0, 4)}-${ymRaw.substring(4, 6)}` : ymRaw;
      latestContractNo = String(lastRec['合約編號'] || '').trim();

      const rawKeys = Object.keys(lastRec);
      const cleanKeyMap = {};
      rawKeys.forEach(k => {
        const cleanK = k.replace(/\r|\n/g, '').trim();
        cleanKeyMap[cleanK] = k;
      });

      // 業務規則判定
      const isRuleIgnore = (code, name) => ['Z08', 'Z09', 'TAX'].includes(code) || (code && code.toUpperCase().includes('TAX')) || (name && name.includes('稅額'));
      const isRuleAverage = (code) => ['Z01', 'Z02', 'Z03', 'Z05', 'Z06'].includes(code);
      const isRuleDirectZ04 = (code) => code === 'Z04';
      const isRuleZ07 = (code) => code === 'Z07';

      const deductionKeys = Object.keys(cleanKeyMap).filter(k => 
        (k.includes('/') || k.includes('稅額')) && !k.includes('結帳') && !k.includes('總計')
      );

      deductionKeys.forEach(cleanK => {
        const rawK = cleanKeyMap[cleanK];
        const code = cleanK.split('/')[0].trim();
        const name = cleanK;

        // 規則 4：Z08、Z09、TAX/稅額 一律不列出
        if (isRuleIgnore(code, name)) {
          return;
        }

        // 規則 1：Z01(電費), Z02(水費), Z03(廚餘處理費), Z05(檔期廣告贊助), Z06(軌道燈電費) -> 僅依勾選合約期間計算平均值
        if (isRuleAverage(code)) {
          const evalRecs = inRangeDeductions;
          if (!evalRecs || evalRecs.length === 0) return;
          const totalSum = evalRecs.reduce((sum, r) => sum + safeNumber(r[rawK]), 0);

          if (totalSum > 0) {
            const avg = Math.round(totalSum / evalRecs.length);
            const periodNote = `(勾選期間 ${evalRecs.length} 個月平均，累計 NT$ ${totalSum.toLocaleString()})`;

            latestContractDeductionItems.push({
              code,
              name,
              amount: avg,
              calcType: 'average',
              note: `浮動費用 ${periodNote}`,
              month: latestContractMonth,
              contractNo: latestContractNo
            });
            latestDeductionTotal += avg;
          }
          return;
        }

        // 規則 3：Z07 專櫃抵用金抽成扣款額 -> 僅依勾選合約期間計算平均，註明最高最低時間點
        if (isRuleZ07(code)) {
          const recs = inRangeDeductions;
          if (!recs || recs.length === 0) return;

          const monthVals = recs.map(r => {
            const ymStr = String(r['結帳年月'] || '').trim();
            const ymFmt = ymStr.length === 6 ? `${ymStr.substring(0, 4)}-${ymStr.substring(4, 6)}` : ymStr;
            return { month: ymFmt, amount: safeNumber(r[rawK]) };
          });

          const totalSum = monthVals.reduce((sum, r) => sum + r.amount, 0);
          const nonZeroVals = monthVals.filter(r => r.amount > 0);

          if (totalSum > 0) {
            const avg = Math.round(totalSum / recs.length);
            const maxItem = monthVals.reduce((max, r) => r.amount > max.amount ? r : max, monthVals[0]);
            const minItem = nonZeroVals.length > 0 
              ? nonZeroVals.reduce((min, r) => r.amount < min.amount ? r : min, nonZeroVals[0])
              : monthVals.reduce((min, r) => r.amount < min.amount ? r : min, monthVals[0]);

            const note = `計算平均 (最高 NT$ ${maxItem.amount.toLocaleString()} [${maxItem.month}]，最低 NT$ ${minItem.amount.toLocaleString()} [${minItem.month}])`;

            latestContractDeductionItems.push({
              code,
              name,
              amount: avg,
              calcType: 'average_with_extremes',
              note,
              maxAmount: maxItem.amount,
              maxMonth: maxItem.month,
              minAmount: minItem.amount,
              minMonth: minItem.month,
              month: latestContractMonth,
              contractNo: latestContractNo
            });
            latestDeductionTotal += avg;
          }
          return;
        }

        // 規則 2 & 其他：Z04 直接列出，以及 B01~B05, A01, D01, D04, TAX 等合約設定直接列出
        const amt = safeNumber(lastRec[rawK]);
        if (amt > 0) {
          let note = '最後合約約定設定';
          if (isRuleDirectZ04(code)) {
            note = '收銀機檔期租借費 (依約設定直接列出)';
          }
          latestContractDeductionItems.push({
            code,
            name,
            amount: amt,
            calcType: 'direct',
            note,
            month: latestContractMonth,
            contractNo: latestContractNo
          });
          latestDeductionTotal += amt;
        }
      });
    }

    if (inRangeDeductions.length > 0) {
      inRangeDeductions.forEach(d => {
        const ymRaw = String(d['結帳年月']).trim();
        const ymFormatted = ymRaw.length === 6 ? `${ymRaw.substring(0, 4)}-${ymRaw.substring(4, 6)}` : ymRaw;
        const total = safeNumber(d['總計']);
        monthlyDeductionMap[ymFormatted] = total;
      });

      // 提取常態扣款項目清單供 Sheet 1 呈現 (區間月均)
      const feeKeys = Object.keys(inRangeDeductions[0]).filter(k => k.includes('/') && !k.includes('結帳'));
      feeKeys.forEach(k => {
        const sum = inRangeDeductions.reduce((acc, row) => acc + safeNumber(row[k]), 0);
        const avg = Math.round(sum / inRangeDeductions.length);
        formattedDeductionItems.push({
          '扣款項目名稱': k.replace(/\r|\n/g, '').trim(),
          '扣款類別': '實扣月平均',
          '約定金額 (元)': avg,
          '期間總額': sum,
          '扣款起始月份': earliestStart.substring(0, 7),
          '扣款截止月份': latestEnd.substring(0, 7)
        });
      });
    } else {
      warnings.push(`⚠️ 【專櫃扣款明細表】包含專櫃 [${cId}] 資料，但其月份區間與勾選合約期別無重疊（已自動裁剪過濾）。`);
    }
  } else {
    // === 型態 A: 專櫃契約代扣款約定長表 ===
    if (counterDeductions.length > 0) {
      counterDeductions.forEach(d => {
        const amt = safeNumber(d['每月金額'] || d['總金額'] || d['扣款金額(未稅)']);
        formattedDeductionItems.push({
          '扣款項目名稱': d['扣款項目名稱'] || '',
          '扣款類別': d['扣款類別'] || '每月扣款',
          '約定金額 (元)': amt,
          '扣款起始月份': d['扣款起始月份'] || '',
          '扣款截止月份': d['扣款結束月份'] || ''
        });
        if (amt > 0) {
          latestContractDeductionItems.push({
            name: d['扣款項目名稱'] || '合約代扣項目',
            amount: amt,
            month: d['扣款起始月份'] || earliestStart.substring(0, 7),
            contractNo: d['合約編號'] || ''
          });
          latestDeductionTotal += amt;
        }
      });
      latestContractMonth = counterDeductions[counterDeductions.length - 1]['扣款結束月份'] || latestEnd.substring(0, 7);
    } else {
      const anyHasId = deductionRows.some(d => d['專櫃編號'] && String(d['專櫃編號']).trim() !== '');
      if (!anyHasId) {
        warnings.push(`⚠️ 【專櫃契約代扣款報表】之「專櫃編號」欄位為空（脫敏資料），無法按櫃位匹配。`);
      }
    }
  }

    // 4. 營收數據 (專櫃結帳彙總表) - 純真實變數驅動，按月彙總並記錄未稅/稅額/含稅
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
      const ym = `${ymRaw.substring(0, 4)}-${ymRaw.substring(4, 6)}`;
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
        shortfallNote = `未達包底 (補足差額 NT$ ${g.shortfall.toLocaleString()})`;
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
  } else if (Object.keys(monthlyDeductionMap).length > 0) {
    // 特殊情境：使用者上傳了「扣款明細表」，但「結帳彙總表」專櫃編號被清空
    // 將扣款明細表的月份作為時間軸展示，清楚標註營收待對齊
    const sortedYMs = Object.keys(monthlyDeductionMap).sort();
    sortedYMs.forEach(ym => {
      const deductAmt = monthlyDeductionMap[ym];
      totalDeductions += deductAmt;
      monthlyRecords.push({
        month: ym,
        sales: 0,
        commission: 0,
        effectiveRate: '0.00%',
        deductions: deductAmt,
        baseRentShortfall: 0,
        mallRevenue: deductAmt,
        netPayout: -deductAmt
      });
    });
    warnings.push(`ℹ️ 已成功載入「專櫃扣款明細表」共 ${sortedYMs.length} 個月實扣記錄；因月結表代碼為空，該月份銷售額顯示為 0。`);
  } else {
    warnings.push(`ℹ️ 本專櫃目前暫無可對齊之月結營收明細資料（已如實呈現 0 筆）。`);
  }

  // 5. 續約建議指標計算
  let growthRateStr = '無足夠月度資料';
  let growthLight = '⚪ 無資料';
  let growthRate = 0;

  if (monthlyRecords.length >= 2 && totalSales > 0) {
    const halfLen = Math.floor(monthlyRecords.length / 2);
    const firstHalf = monthlyRecords.slice(0, halfLen);
    const secondHalf = monthlyRecords.slice(halfLen);
    const avgFirst = firstHalf.reduce((a, b) => a + b.sales, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b.sales, 0) / secondHalf.length;

    if (avgFirst > 0) {
      growthRate = ((avgSecond - avgFirst) / avgFirst) * 100;
      growthRateStr = (growthRate >= 0 ? '+' : '') + growthRate.toFixed(1) + '%';
      if (growthRate >= 5) growthLight = '🟢 綠燈 (成長)';
      else if (growthRate >= -5) growthLight = '🟡 黃燈 (持平)';
      else growthLight = '🔴 紅燈 (衰退)';
    }
  }

  const effectiveTakeRate = totalSales > 0 ? (totalCommission / totalSales) * 100 : (baseRate || 0);
  let takeRateLight = '⚪ 無資料';
  if (totalSales > 0 || baseRate > 0) {
    if (effectiveTakeRate >= 14) takeRateLight = '🟢 綠燈 (健康)';
    else if (effectiveTakeRate >= 10) takeRateLight = '🟡 黃燈 (中等)';
    else takeRateLight = '🔴 紅燈 (過低)';
  }

  let baseRentLight = '⚪ 無資料';
  if (monthlyRecords.length > 0 && totalSales > 0) {
    if (baseRentShortfallCount === 0) baseRentLight = '🟢 綠燈 (全數達標)';
    else if (baseRentShortfallCount <= 2) baseRentLight = '🟡 黃燈 (偶發未達標)';
    else baseRentLight = '🔴 紅燈 (多次未達標)';
  }

  let finalRecommendation = '資料不齊全，暫無法提供明確評級';
  let suggestedAction = '請確認相關報表（尤其是專櫃結帳彙總表）已包含專櫃編號，以載入完整收支進行評估。';

  if (monthlyRecords.length > 0 && totalSales > 0) {
    if (growthLight.includes('🟢') && takeRateLight.includes('🟢') && baseRentLight.includes('🟢')) {
      finalRecommendation = '強烈建議續約 (Prime Candidate)';
      suggestedAction = '專櫃營收維持正向成長，且各期抽成貢獻穩定。建議維持現行合作模式，或爭取調升 0.5% ~ 1.0% 抽成級距。';
    } else if (growthLight.includes('🔴') || baseRentLight.includes('🔴')) {
      finalRecommendation = '建議列入觀察名單或調整櫃位 (Review Required)';
      suggestedAction = '專櫃營收有明顯衰退跡象或多次落入包底不足。建議約談輔導，或於新合約縮減租賃坪數、評估替換品牌。';
    } else {
      finalRecommendation = '建議附條件續約 (Conditional Renewal)';
      suggestedAction = '專櫃整體營運維持穩定，建議提高保底門檻以保障商場基本租金收益，並加強聯合行銷活動配合度。';
    }
  } else if (Object.keys(monthlyDeductionMap).length > 0) {
    finalRecommendation = '扣款明細已載入，尚缺銷售數據';
    suggestedAction = `已成功解析【專櫃扣款明細表】共 ${Object.keys(monthlyDeductionMap).length} 個月實扣金額（累計扣款 NT$ ${totalDeductions.toLocaleString()}），待補充銷售月結表後即可進行完整評估。`;
  }

  return {
    meta: {
      counterId: cId,
      counterName,
      selectedVersions: versionsToInclude,
      allAvailableVersions,
      periodDescriptions,
      startDate: earliestStart,
      endDate: latestEnd,
      floor,
      area,
      industry,
      boothNo,
      storeArea: storeArea || '未填寫',
      generatedAt: new Date().toISOString().substring(0, 10)
    },
    terms: {
      commType,
      commCat,
      baseRate: baseRate > 0 ? `${baseRate}%` : '未載明',
      rate90: rate90 > 0 ? `${rate90}%` : '未載明',
      rate80: rate80 > 0 ? `${rate80}%` : '未載明',
      deductions: formattedDeductionItems,
      latestContractMonth,
      latestContractNo,
      latestDeductions: latestContractDeductionItems,
      latestDeductionTotal
    },
    financials: {
      monthlyRecords,
      totalSales,
      totalCommission,
      totalDeductions,
      totalNetPayout,
      shortfallCount: baseRentShortfallCount
    },
    scorecard: {
      growthRate: growthRateStr,
      growthLight,
      effectiveTakeRate: effectiveTakeRate > 0 ? effectiveTakeRate.toFixed(2) + '%' : '無資料',
      takeRateLight,
      baseRentShortfallCount: monthlyRecords.length > 0 && totalSales > 0 ? `${baseRentShortfallCount} 次未達標` : '無資料',
      baseRentLight,
      peerRankPercentile: '待同業全量資料對齊',
      peerLight: '⚪ 待全量計算',
      finalRecommendation,
      suggestedAction
    },
    warnings
  };
}

module.exports = {
  parseTableRows,
  generateDossierData
};

const fs = require('fs');

let indexHtml = fs.readFileSync('index.html', 'utf8');

// 1. 更新 parseSheet
const oldParseSheet = `  function parseSheet(sheet, headerRowIdx, isDouble = false) {
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z5000');
    const headers = {};
    if (isDouble) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const t = sheet[XLSX.utils.encode_cell({ r: headerRowIdx, c: C })];
        const s = sheet[XLSX.utils.encode_cell({ r: headerRowIdx + 1, c: C })];
        const tv = t ? String(t.v).trim() : '';
        const sv = s ? String(s.v).trim() : '';
        headers[C] = tv && sv ? \`\${tv}_\${sv}\` : (sv || tv || \`C_\${C}\`);
      }
    } else {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const c = sheet[XLSX.utils.encode_cell({ r: headerRowIdx, c: C })];
        headers[C] = c ? String(c.v).trim() : \`C_\${C}\`;
      }
    }
    const start = isDouble ? headerRowIdx + 2 : headerRowIdx + 1;
    const rows = [];
    for (let R = start; R <= range.e.r; ++R) {
      const row = {};
      let has = false;
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = sheet[XLSX.utils.encode_cell({ r: R, c: C })];
        const val = cell !== undefined && cell.v !== undefined ? cell.v : '';
        if (val !== '') has = true;
        row[headers[C]] = val;
      }
      if (has) rows.push(row);
    }
    return rows;
  }`;

const newParseSheet = `  function parseSheet(sheet, headerRowIdx, isDouble = false) {
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z5000');
    const headers = {};
    if (isDouble) {
      let currentCat = '';
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const t = sheet[XLSX.utils.encode_cell({ r: headerRowIdx, c: C })];
        const s = sheet[XLSX.utils.encode_cell({ r: headerRowIdx + 1, c: C })];
        const tv = t ? String(t.v).trim() : '';
        const sv = s ? String(s.v).trim() : '';
        if (tv) currentCat = tv;
        if (currentCat && sv) {
          headers[C] = \`\${currentCat}_\${sv}\`;
        } else if (sv) {
          headers[C] = sv;
        } else if (tv) {
          headers[C] = tv;
        } else {
          headers[C] = \`C_\${C}\`;
        }
      }
    } else {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const c = sheet[XLSX.utils.encode_cell({ r: headerRowIdx, c: C })];
        headers[C] = c ? String(c.v).trim() : \`C_\${C}\`;
      }
    }
    const start = isDouble ? headerRowIdx + 2 : headerRowIdx + 1;
    const rows = [];
    for (let R = start; R <= range.e.r; ++R) {
      const row = {};
      let has = false;
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = sheet[XLSX.utils.encode_cell({ r: R, c: C })];
        const val = cell !== undefined && cell.v !== undefined ? cell.v : '';
        if (val !== '') has = true;
        row[headers[C]] = val;
      }
      if (has) rows.push(row);
    }
    return rows;
  }`;

// 2. 更新 runEvaluation 及 computeAdvisory
const runEvalStart = indexHtml.indexOf('function runEvaluation()');
const renderDashboardStart = indexHtml.indexOf('function renderDashboard()');

const newRunEvaluationCode = `function runEvaluation() {
    const cId = document.getElementById('selectCounter').value;
    if (!cId || state.selectedVersions.length === 0) {
      document.getElementById('dashboard').style.display = 'none';
      document.getElementById('btnExportExcel').disabled = true;
      document.getElementById('btnExportMobile').disabled = true;
      return;
    }

    const allContracts = state.tables.contracts.filter(c => String(c['專櫃編號'] || '').padStart(5, '0') === cId);
    const activeContracts = allContracts.filter(c => state.selectedVersions.includes(String(c['版本編號'])));
    if (activeContracts.length === 0) return;

    const primary = activeContracts[0];
    const cName = primary['專櫃名稱'] || \`專櫃 \${cId}\`;
    const floor = primary['樓層名稱'] || '未標註';
    const industry = primary['業種名稱'] || primary['業種編號'] || '一般專櫃';

    let earliestStart = '9999-12-31';
    let latestEnd = '0000-00-00';
    activeContracts.forEach(c => {
      const s = parseDate(c['合約起始日']);
      const e = parseDate(c['合約截止日']);
      if (s && s < earliestStart) earliestStart = s;
      if (e && e > latestEnd) latestEnd = e;
    });
    const startYM = earliestStart.substring(0, 7).replace('-', '');
    const endYM = latestEnd.substring(0, 7).replace('-', '');

    const commRows = state.tables.commissions.filter(c => String(c['專櫃編號'] || '').padStart(5, '0') === cId);
    let baseRate = 0, rate90 = 0, rate80 = 0, commType = '一般抽成';
    if (commRows.length > 0) {
      baseRate = safeNum(commRows[0]['正品']);
      rate90 = safeNum(commRows[0]['90折']) || (baseRate > 0 ? baseRate - 1 : 0);
      rate80 = safeNum(commRows[0]['80折']) || (baseRate > 0 ? baseRate - 2 : 0);
      commType = commRows[0]['抽成別'] || '一般抽成';
    }

    const deductRows = state.tables.deductions.filter(d => String(d['專櫃編號'] || '').padStart(5, '0') === cId);
    const isDetailMatrix = deductRows.length > 0 && deductRows[0].hasOwnProperty('結帳年月') && deductRows[0].hasOwnProperty('總計');
    const monthlyDeductMap = {};
    let totalDeductSum = 0;

    if (isDetailMatrix) {
      deductRows.forEach(d => {
        const ymRaw = String(d['結帳年月'] || '').trim();
        if (ymRaw >= startYM && ymRaw <= endYM) {
          const ymFormatted = ymRaw.length === 6 ? \`\${ymRaw.substring(0,4)}-\${ymRaw.substring(4,6)}\` : ymRaw;
          const tot = safeNum(d['總計']);
          monthlyDeductMap[ymFormatted] = tot;
          totalDeductSum += tot;
        }
      });
    }

    // 處理月結營收表 (MONTHLY)
    const monthlyRows = (state.tables.monthly || []).filter(m => {
      const mcid = String(m['專櫃編號'] || '').padStart(5, '0');
      const ym = String(m['結帳年月'] || '').trim();
      return mcid === cId && ym.length === 6 && (ym >= startYM && ym <= endYM);
    });

    const monthGroupMap = {};
    monthlyRows.forEach(r => {
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
          payout: 0
        };
      }
      const sUn = safeNum(r['銷貨淨額_未稅金額'] || r['銷貨淨額']);
      const sTax = safeNum(r['銷貨淨額_稅額'] || r['稅額']);
      const sTot = safeNum(r['銷貨淨額_合計']) || (sUn + sTax);

      const cUn = safeNum(r['抽成額_未稅金額'] || r['抽成額']);
      const cTax = safeNum(r['抽成額_稅額']);
      const cTot = safeNum(r['抽成額_合計']) || (cUn + cTax);

      const sf = safeNum(r['包底抽成不足(含稅)'] || r['包底抽成不足'] || 0);
      const dTot = safeNum(r['應收帳款(匯總)_應收合計'] || r['應收帳款(彙總)_應收合計'] || 0);
      const pay = safeNum(r['應付帳款(含稅)'] || 0);

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

    const records = [];
    let totSales = 0, totComm = 0, totDeduct = 0, shortfallCount = 0;

    const allYMs = Array.from(new Set([...Object.keys(monthlyDeductMap), ...Object.keys(monthGroupMap)])).sort();
    allYMs.forEach(ym => {
      const g = monthGroupMap[ym] || {
        month: ym, sales_untaxed: 0, sales_tax: 0, sales_total: 0,
        comm_untaxed: 0, comm_tax: 0, comm_total: 0, shortfall: 0, reportDeduct: 0, payout: 0
      };
      const deduct = monthlyDeductMap[ym] !== undefined ? monthlyDeductMap[ym] : g.reportDeduct;
      const mallRev = g.comm_total + deduct + g.shortfall;
      const netPay = g.payout || (g.sales_total - g.comm_total - deduct);

      if (g.shortfall > 0) shortfallCount++;

      totSales += g.sales_untaxed;
      totComm += g.comm_total;
      totDeduct += deduct;

      let shortfallNote = '🟢 達標';
      if (g.shortfall > 0) {
        shortfallNote = \`🔴 補足差額 NT$ \${g.shortfall.toLocaleString()}\`;
      }

      records.push({
        month: ym,
        sales: g.sales_untaxed,
        sales_untaxed: g.sales_untaxed,
        sales_tax: g.sales_tax,
        sales_total: g.sales_total,
        commission: g.comm_total,
        comm_untaxed: g.comm_untaxed,
        comm_tax: g.comm_tax,
        comm_total: g.comm_total,
        deduct,
        baseRentShortfall: g.shortfall,
        shortfallNote,
        mallRev,
        payout: netPay
      });
    });

    state.dossier = {
      meta: {
        counterId: cId,
        counterName: cName,
        selectedVersions: state.selectedVersions,
        floor,
        industry,
        startDate: earliestStart,
        endDate: latestEnd,
        storeArea: document.getElementById('inputArea') ? document.getElementById('inputArea').value : '15 坪',
        periodDescriptions: activeContracts.map(c => \`第 \${c['版本編號']} 期 [\${c['租戶狀況']}]: \${parseDate(c['合約起始日'])} ~ \${parseDate(c['合約截止日'])}\`)
      },
      terms: {
        commType,
        baseRate: baseRate > 0 ? \`\${baseRate}%\` : '15%',
        rate90: rate90 > 0 ? \`\${rate90}%\` : '14%',
        rate80: rate80 > 0 ? \`\${rate80}%\` : '13%',
        isDetailMatrix
      },
      records,
      totalSales: totSales,
      totalComm: totComm,
      totalDeduct: totDeduct,
      shortfallCount
    };

    state.advisory = computeAdvisory(state.dossier, allContracts);

    renderDashboard();
    document.getElementById('btnExportExcel').disabled = false;
    document.getElementById('btnExportMobile').disabled = false;
  }
  `;

indexHtml = indexHtml.replace(oldParseSheet, newParseSheet);
indexHtml = indexHtml.slice(0, runEvalStart) + newRunEvaluationCode + indexHtml.slice(renderDashboardStart);

fs.writeFileSync('index.html', indexHtml, 'utf8');
console.log('Successfully updated parseSheet and runEvaluation in index.html');

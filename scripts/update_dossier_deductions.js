const fs = require('fs');

let code = fs.readFileSync('src/etl/dossier_generator.js', 'utf8');

const targetSection = `  // 3. 代扣費用自適應處理 (支援雙軌：型態 A 約定長表 vs 型態 B 實扣寬表)
  const deductionRows = tables.deductions || [];
  const counterDeductions = deductionRows.filter(d => padCounterId(d['專櫃編號']) === cId);
  
  // 判斷是否為「專櫃扣款明細表 (實扣寬表)」
  const isDetailMatrix = deductionRows.length > 0 && deductionRows[0].hasOwnProperty('結帳年月') && deductionRows[0].hasOwnProperty('總計');
  
  const formattedDeductionItems = [];
  const monthlyDeductionMap = {}; // key: YYYY-MM, val: 實扣總額

  if (isDetailMatrix) {
    // === 型態 B: 專櫃扣款明細表 ===
    // 依合約時間維度進行過濾 (時間交集裁剪)
    const inRangeDeductions = counterDeductions.filter(d => {
      const ym = String(d['結帳年月'] || '').trim();
      return ym >= contractStartYM && ym <= contractEndYM;
    });

    if (inRangeDeductions.length > 0) {
      inRangeDeductions.forEach(d => {
        const ymRaw = String(d['結帳年月']).trim();
        const ymFormatted = ymRaw.length === 6 ? \`\${ymRaw.substring(0, 4)}-\${ymRaw.substring(4, 6)}\` : ymRaw;
        const total = safeNumber(d['總計']);
        monthlyDeductionMap[ymFormatted] = total;
      });

      // 提取常態扣款項目清單供 Sheet 1 呈現
      const feeKeys = Object.keys(inRangeDeductions[0]).filter(k => k.includes('/') && !k.includes('結帳'));
      feeKeys.forEach(k => {
        const sum = inRangeDeductions.reduce((acc, row) => acc + safeNumber(row[k]), 0);
        const avg = Math.round(sum / inRangeDeductions.length);
        formattedDeductionItems.push({
          '扣款項目名稱': k,
          '扣款類別': '實扣月平均',
          '約定金額 (元)': avg,
          '期間總額': sum,
          '扣款起始月份': earliestStart.substring(0, 7),
          '扣款截止月份': latestEnd.substring(0, 7)
        });
      });
    } else {
      warnings.push(\`⚠️ 【專櫃扣款明細表】包含專櫃 [\${cId}] 資料，但其月份區間與勾選合約期別無重疊（已自動裁剪過濾）。\`);
    }
  } else {
    // === 型態 A: 專櫃契約代扣款約定長表 ===
    if (counterDeductions.length > 0) {
      counterDeductions.forEach(d => {
        formattedDeductionItems.push({
          '扣款項目名稱': d['扣款項目名稱'] || '',
          '扣款類別': d['扣款類別'] || '每月扣款',
          '約定金額 (元)': safeNumber(d['每月金額'] || d['總金額'] || d['扣款金額(未稅)']),
          '扣款起始月份': d['扣款起始月份'] || '',
          '扣款截止月份': d['扣款結束月份'] || ''
        });
      });
    } else {
      const anyHasId = deductionRows.some(d => d['專櫃編號'] && String(d['專櫃編號']).trim() !== '');
      if (!anyHasId) {
        warnings.push(\`⚠️ 【專櫃契約代扣款報表】之「專櫃編號」欄位為空（脫敏資料），無法按櫃位匹配。\`);
      }
    }
  }`;

const replacementSection = `  // 3. 代扣費用自適應處理 (支援雙軌：型態 A 約定長表 vs 型態 B 實扣寬表)
  const deductionRows = tables.deductions || [];
  const counterDeductions = deductionRows.filter(d => padCounterId(d['專櫃編號']) === cId);
  
  // 判斷是否為「專櫃扣款明細表 (實扣寬表)」
  const isDetailMatrix = deductionRows.length > 0 && deductionRows[0].hasOwnProperty('結帳年月') && deductionRows[0].hasOwnProperty('總計');
  
  const formattedDeductionItems = [];
  const latestContractDeductionItems = []; // 最新期別（或最後月份）設定明細
  let latestContractMonth = '';
  const monthlyDeductionMap = {}; // key: YYYY-MM, val: 實扣總額

  if (isDetailMatrix) {
    // === 型態 B: 專櫃扣款明細表 ===
    // 依合約時間維度進行過濾 (時間交集裁剪)
    const inRangeDeductions = counterDeductions.filter(d => {
      const ym = String(d['結帳年月'] || '').trim();
      return ym >= contractStartYM && ym <= contractEndYM;
    });

    // 取得該專櫃所有有效扣款記錄（用於提取最後一份合約設定）
    const allValidCounterDeductions = counterDeductions.filter(d => {
      const ym = String(d['結帳年月'] || '').trim();
      return ym.length === 6;
    }).sort((a, b) => String(a['結帳年月']).localeCompare(String(b['結帳年月'])));

    // 提取最後一份合約月份與各細項設定
    if (allValidCounterDeductions.length > 0) {
      const lastRec = (inRangeDeductions.length > 0) 
        ? inRangeDeductions[inRangeDeductions.length - 1] 
        : allValidCounterDeductions[allValidCounterDeductions.length - 1];
      const ymRaw = String(lastRec['結帳年月']).trim();
      latestContractMonth = (ymRaw.length === 6) ? \`\${ymRaw.substring(0, 4)}-\${ymRaw.substring(4, 6)}\` : ymRaw;

      Object.keys(lastRec).filter(k => k.includes('/') && k !== '1/1').forEach(k => {
        const amt = safeNumber(lastRec[k]);
        if (amt > 0) {
          latestContractDeductionItems.push({
            name: k,
            amount: amt,
            month: latestContractMonth
          });
        }
      });
    }

    if (inRangeDeductions.length > 0) {
      inRangeDeductions.forEach(d => {
        const ymRaw = String(d['結帳年月']).trim();
        const ymFormatted = ymRaw.length === 6 ? \`\${ymRaw.substring(0, 4)}-\${ymRaw.substring(4, 6)}\` : ymRaw;
        const total = safeNumber(d['總計']);
        monthlyDeductionMap[ymFormatted] = total;
      });

      // 提取常態扣款項目清單供 Sheet 1 呈現
      const feeKeys = Object.keys(inRangeDeductions[0]).filter(k => k.includes('/') && !k.includes('結帳'));
      feeKeys.forEach(k => {
        const sum = inRangeDeductions.reduce((acc, row) => acc + safeNumber(row[k]), 0);
        const avg = Math.round(sum / inRangeDeductions.length);
        formattedDeductionItems.push({
          '扣款項目名稱': k,
          '扣款類別': '實扣月平均',
          '約定金額 (元)': avg,
          '期間總額': sum,
          '扣款起始月份': earliestStart.substring(0, 7),
          '扣款截止月份': latestEnd.substring(0, 7)
        });
      });
    } else {
      warnings.push(\`⚠️ 【專櫃扣款明細表】包含專櫃 [\${cId}] 資料，但其月份區間與勾選合約期別無重疊（已自動裁剪過濾）。\`);
    }
  } else {
    // === 型態 A: 專櫃契約代扣款約定長表 ===
    if (counterDeductions.length > 0) {
      counterDeductions.forEach(d => {
        const itemObj = {
          '扣款項目名稱': d['扣款項目名稱'] || '',
          '扣款類別': d['扣款類別'] || '每月扣款',
          '約定金額 (元)': safeNumber(d['每月金額'] || d['總金額'] || d['扣款金額(未稅)']),
          '扣款起始月份': d['扣款起始月份'] || '',
          '扣款截止月份': d['扣款結束月份'] || ''
        };
        formattedDeductionItems.push(itemObj);
        latestContractDeductionItems.push({
          name: itemObj['扣款項目名稱'],
          amount: itemObj['約定金額 (元)'],
          month: itemObj['扣款起始月份'] || ''
        });
      });
    } else {
      const anyHasId = deductionRows.some(d => d['專櫃編號'] && String(d['專櫃編號']).trim() !== '');
      if (!anyHasId) {
        warnings.push(\`⚠️ 【專櫃契約代扣款報表】之「專櫃編號」欄位為空（脫敏資料），無法按櫃位匹配。\`);
      }
    }
  }`;

if (code.includes('// 3. 代扣費用自適應處理 (支援雙軌：型態 A 約定長表 vs 型態 B 實扣寬表)')) {
  const p1 = code.indexOf('// 3. 代扣費用自適應處理 (支援雙軌：型態 A 約定長表 vs 型態 B 實扣寬表)');
  const p2 = code.indexOf('// 4. 營收數據', p1);
  code = code.slice(0, p1) + replacementSection + '\n\n    ' + code.slice(p2);
  
  // 同步在 return 的 terms 物件中加入 latestDeductions
  const oldTermsObj = `    terms: {
      commType,
      commCat,
      baseRate: baseRate > 0 ? \`\${baseRate}%\` : '未載明',
      rate90: rate90 > 0 ? \`\${rate90}%\` : '未載明',
      rate80: rate80 > 0 ? \`\${rate80}%\` : '未載明',
      deductions: formattedDeductionItems
    },`;

  const newTermsObj = `    terms: {
      commType,
      commCat,
      baseRate: baseRate > 0 ? \`\${baseRate}%\` : '未載明',
      rate90: rate90 > 0 ? \`\${rate90}%\` : '未載明',
      rate80: rate80 > 0 ? \`\${rate80}%\` : '未載明',
      deductions: formattedDeductionItems,
      latestDeductions: latestContractDeductionItems,
      latestContractMonth
    },`;

  code = code.replace(oldTermsObj, newTermsObj);
  fs.writeFileSync('src/etl/dossier_generator.js', code, 'utf8');
  console.log('Successfully updated src/etl/dossier_generator.js with latestDeductions!');
} else {
  console.log('Could not find section 3 header in dossier_generator.js');
}

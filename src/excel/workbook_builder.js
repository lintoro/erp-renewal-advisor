/**
 * 三頁式 Multi-Sheet XLSX 活頁簿建構器 - v1.2 支援多期版本勾選與警示註記
 */
const XLSX = require('xlsx');

function buildDossierWorkbook(dossier) {
  const wb = XLSX.utils.book_new();

  // ==========================================
  // Sheet 1: 條件明細 (Contract_Terms)
  // ==========================================
  const s1Data = [
    ['專櫃合約評估報告 - 【條件明細】', '', '', '', ''],
    ['產生日期：' + dossier.meta.generatedAt, '', '', '', ''],
    ['', '', '', '', ''],
    ['【一、 專櫃基本資料與合約期別】', '', '', '', ''],
    ['專櫃編號', dossier.meta.counterId, '專櫃名稱', dossier.meta.counterName, '納入評比期別', '第 ' + dossier.meta.selectedVersions.join('、') + ' 期'],
    ['綜合評估起訖日', dossier.meta.startDate + ' ~ ' + dossier.meta.endDate, '櫃位編號', dossier.meta.boothNo || '標準櫃位', '租賃坪數', dossier.meta.storeArea],
    ['所屬樓層', dossier.meta.floor || '未標註', '營業區域', dossier.meta.area || '一般商場', '業種分類', dossier.meta.industry || '一般專櫃'],
    ['歷史各期詳細期間', '', '', '', '']
  ];

  for (const desc of dossier.meta.periodDescriptions) {
    s1Data.push(['  • ' + desc, '', '', '', '']);
  }

  s1Data.push(
    ['', '', '', '', ''],
    ['【二、 抽成費率約定矩陣】', '', '', '', ''],
    ['抽成模式', dossier.terms.commType, '抽成類別名稱', dossier.terms.commCat || '標準抽成', '', ''],
    ['折扣級距', '約定抽成費率', '說明', '', '', ''],
    ['正品銷售 (100%)', dossier.terms.baseRate, '基準抽成比率', '', '', ''],
    ['90 折銷售', dossier.terms.rate90, '促銷折讓抽成', '', '', ''],
    ['80 折銷售', dossier.terms.rate80, '特惠折讓抽成', '', '', ''],
    ['', '', '', '', ''],
    [`【三、 最後一份合約扣款設定明細 (基準月份：${dossier.terms.latestContractMonth || '最新期別'}，合計：NT$ ${(dossier.terms.latestDeductionTotal || 0).toLocaleString()})】`, '', '', '', ''],
    ['扣款項目名稱', '設定金額 (元)', '基準月份', '合約編號', '備註']
  );

  const latestDeductions = dossier.terms.latestDeductions || [];
  if (latestDeductions.length > 0) {
    for (const d of latestDeductions) {
      s1Data.push([
        d.name || '',
        d.amount || 0,
        d.month || dossier.terms.latestContractMonth || '',
        d.contractNo || dossier.terms.latestContractNo || '',
        d.note || '最新合約約定設定'
      ]);
    }
    s1Data.push([
      '【最新月設定合計】',
      dossier.terms.latestDeductionTotal || 0,
      dossier.terms.latestContractMonth || '',
      '',
      '月固定/常態扣款總額'
    ]);
  } else {
    s1Data.push(['無匹配之最新合約扣款明細紀錄', 0, '-', '-', '-']);
  }

  s1Data.push(
    ['', '', '', '', ''],
    ['【四、 評估期間歷史常態實扣月平均 (供對照參考)】', '', '', '', ''],
    ['扣款項目名稱', '扣款類別', '月均金額 (元)', '期間總額 (元)', '扣款起訖月份']
  );

  if (dossier.terms.deductions && dossier.terms.deductions.length > 0) {
    for (const d of dossier.terms.deductions) {
      const name = d['扣款項目名稱'] || '';
      if (name.includes('TAX') || name.includes('稅額') || name.includes('Z08') || name.includes('Z09')) continue;
      s1Data.push([
        name,
        d['扣款類別'] || '實扣月平均',
        d['約定金額 (元)'] || 0,
        d['期間總額'] || 0,
        (d['扣款起始月份'] || '') + ' ~ ' + (d['扣款截止月份'] || '')
      ]);
    }
  } else {
    s1Data.push(['無歷史扣款彙總紀錄', '-', 0, 0, '-']);
  }

  // 警示欄
  if (dossier.warnings && dossier.warnings.length > 0) {
    s1Data.push(['', '', '', '', ''], ['【五、 資料完整度警示與備註】', '', '', '', '']);
    for (const w of dossier.warnings) {
      s1Data.push([w, '', '', '', '']);
    }
  }

  const ws1 = XLSX.utils.aoa_to_sheet(s1Data);
  ws1['!cols'] = [{ wch: 26 }, { wch: 22 }, { wch: 20 }, { wch: 22 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws1, '條件明細');

  // ==========================================
  // Sheet 2: 期間營收費用明細 (Financial_Performance)
  // ==========================================
  const s2Data = [
    ['專櫃合約評估報告 - 【合約期間營收與費用明細列表】', '', '', '', '', '', '', ''],
    ['專櫃編號：' + dossier.meta.counterId, '專櫃名稱：' + dossier.meta.counterName, '納入期別：第 ' + dossier.meta.selectedVersions.join('、') + ' 期', '期間：' + dossier.meta.startDate + ' ~ ' + dossier.meta.endDate, '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    [
      '月份 (YYYY-MM)',
      '月銷貨淨額',
      '商場實際抽成額',
      '有效抽成率',
      '代扣款項合計',
      '包底不足補足額',
      '商場總實收額',
      '專櫃實得淨額'
    ]
  ];

  if (dossier.financials.monthlyRecords.length > 0) {
    for (const r of dossier.financials.monthlyRecords) {
      s2Data.push([
        r.month,
        r.sales,
        r.commission,
        r.effectiveRate,
        r.deductions,
        r.baseRentShortfall,
        r.mallRevenue,
        r.netPayout
      ]);
    }

    s2Data.push([
      '【期間累計總額】',
      dossier.financials.totalSales,
      dossier.financials.totalCommission,
      dossier.financials.totalSales > 0 ? (dossier.financials.totalCommission / dossier.financials.totalSales * 100).toFixed(2) + '%' : '0.00%',
      dossier.financials.totalDeductions,
      '-',
      dossier.financials.totalCommission + dossier.financials.totalDeductions,
      dossier.financials.totalNetPayout
    ]);
  } else {
    s2Data.push(['暫無可對齊之月結營收紀錄', 0, 0, '0.00%', 0, 0, 0, 0]);
  }

  const ws2 = XLSX.utils.aoa_to_sheet(s2Data);
  ws2['!cols'] = [
    { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 14 },
    { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 18 }
  ];
  XLSX.utils.book_append_sheet(wb, ws2, '營收與費用明細');

  // ==========================================
  // Sheet 3: 續約建議與評分卡 (Renewal_Advisory)
  // ==========================================
  const s3Data = [
    ['專櫃合約評估報告 - 【續約建議與健康度評分卡】', '', '', ''],
    ['專櫃編號：' + dossier.meta.counterId, '專櫃名稱：' + dossier.meta.counterName, '納入期別：第 ' + dossier.meta.selectedVersions.join('、') + ' 期', ''],
    ['', '', '', ''],
    ['【一、 四維健康度三色燈評估矩陣】', '', '', ''],
    ['評估維度', '計算指標數值', '健康度燈號', '基準參考門檻'],
    ['1. 營收動能 (Growth)', dossier.scorecard.growthRate, dossier.scorecard.growthLight, '後半期月均營收 vs 前半期月均營收成長率 >= 5% 為綠燈'],
    ['2. 抽成貢獻 (Take Rate)', dossier.scorecard.effectiveTakeRate, dossier.scorecard.takeRateLight, '累計有效抽成率 >= 14% 為綠燈，< 10% 為紅燈'],
    ['3. 保底健康 (Base Rent)', dossier.scorecard.baseRentShortfallCount, dossier.scorecard.baseRentLight, '全合約期間未達包底門檻次數 <= 0 次為綠燈，>= 3 次為紅燈'],
    ['4. 業種競爭力 (Peer Rank)', dossier.scorecard.peerRankPercentile, dossier.scorecard.peerLight, '全商場同業種排名前 30% 為綠燈'],
    ['', '', '', ''],
    ['【二、 綜合續約決策推論】', '', '', ''],
    ['決策建議等級', dossier.scorecard.finalRecommendation, '', ''],
    ['具體執行建議', dossier.scorecard.suggestedAction, '', ''],
    ['', '', '', ''],
    ['【三、 趨勢圖表數據區】', '', '', ''],
    ['月份', '銷售額', '商場抽成額', '商場實收額']
  ];

  for (const r of dossier.financials.monthlyRecords) {
    s3Data.push([r.month, r.sales, r.commission, r.mallRevenue]);
  }

  const ws3 = XLSX.utils.aoa_to_sheet(s3Data);
  ws3['!cols'] = [{ wch: 26 }, { wch: 22 }, { wch: 24 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws3, '續約建議評分卡');

  return wb;
}

module.exports = {
  buildDossierWorkbook
};

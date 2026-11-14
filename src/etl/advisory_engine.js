/**
 * 專櫃續約決策與抽成調幅精算引擎 (Leasing Advisory Engine) - v2.0 純真實變數驅動
 * 支援一般抽成、包底抽成、階梯抽成等多維度評估與作戰籌碼推論
 */

function computeLeasingAdvisory(dossierMeta, terms, financials, counterContracts = []) {
  const totalSales = financials.totalSales || 0;
  const totalCommission = financials.totalCommission || 0;
  const monthlyRecords = financials.monthlyRecords || [];
  const monthCount = monthlyRecords.length || 1;
  const avgMonthlySales = totalSales > 0 ? Math.round(totalSales / monthCount) : 0;
  const totalDeductions = financials.totalDeductions || 0;
  const avgMonthlyDeductions = totalDeductions > 0 ? Math.round(totalDeductions / monthCount) : 0;
  const shortfallCount = financials.shortfallCount !== undefined 
    ? financials.shortfallCount 
    : monthlyRecords.filter(r => (r.baseRentShortfall || 0) > 0).length;

  // 計算累計不足額總額
  const totalShortfallAmt = monthlyRecords.reduce((acc, r) => acc + (r.baseRentShortfall || 0), 0);

  // 1. 判定真實基準費率 (若抽成表脫敏無數字，優先採用月結表記錄之有效抽成率)
  let rawBaseRate = parseFloat(String(terms.baseRate || '').replace('%', ''));
  const effectiveTakeRate = totalSales > 0 ? (totalCommission / totalSales) * 100 : 0;
  
  // 若未約定正品抽成率或為 0，則以月結表的實質綜合抽成率為基準
  let currentBaseRate = (!isNaN(rawBaseRate) && rawBaseRate > 0) 
    ? rawBaseRate 
    : (effectiveTakeRate > 0 ? Math.round(effectiveTakeRate * 10) / 10 : 0);

  const versionCount = counterContracts.length || (dossierMeta.selectedVersions || []).length || 1;
  const commType = terms.commType || '一般抽成';
  const hasBaseRentCondition = commType.includes('包底') || shortfallCount > 0 || totalShortfallAmt > 0;

  // 2. 營收動能成長率計算 (前半期 vs 後半期)
  let growthRate = 0;
  let isGrowing = false;
  let isDeclining = false;
  if (monthlyRecords.length >= 4 && totalSales > 0) {
    const half = Math.floor(monthlyRecords.length / 2);
    const firstHalf = monthlyRecords.slice(0, half);
    const secondHalf = monthlyRecords.slice(half);
    const avg1 = firstHalf.reduce((a, b) => a + (b.sales || 0), 0) / firstHalf.length;
    const avg2 = secondHalf.reduce((a, b) => a + (b.sales || 0), 0) / secondHalf.length;
    if (avg1 > 0) {
      growthRate = Math.round(((avg2 - avg1) / avg1) * 1000) / 10;
      if (growthRate >= 5) isGrowing = true;
      else if (growthRate <= -5) isDeclining = true;
    }
  }

  // 3. 坪效計算 (若使用者有填寫坪數)
  const storeAreaNum = parseFloat(String(dossierMeta.storeArea || '').replace(/[^0-9.]/g, '')) || 0;
  const salesPerPing = (storeAreaNum > 0 && avgMonthlySales > 0) ? Math.round(avgMonthlySales / storeAreaNum) : 0;

  // 4. 決策矩陣與談判籌碼精算
  let renewalAction = '';
  let commissionStrategy = '';
  let recommendedBaseRate = currentBaseRate;
  let rateChangeDelta = 0;
  let recommendedTierRule = '';
  let recommendedBaseRent = 0;
  let negotiationPoints = [];

  if (totalSales > 0) {
    if (hasBaseRentCondition) {
      // === 類別 I: 包底型專櫃 (含包底抽成、包底加階梯) ===
      if (shortfallCount === 0) {
        // 100% 達標強勢櫃
        renewalAction = '【強烈建議續約】(包底全期達標，爭取調升條件)';
        rateChangeDelta = 1.0;
        recommendedBaseRate = currentBaseRate > 0 ? (currentBaseRate + rateChangeDelta) : 16.0;
        commissionStrategy = '調升基準抽成 + 等比提高包底門檻';
        recommendedBaseRent = Math.round(avgMonthlySales * (recommendedBaseRate / 100) * 0.85);
        recommendedTierRule = `建議正品抽成由 ${currentBaseRate}% 調升至 ${recommendedBaseRate}% (+1.0%)；月包底調升至 NT$ ${recommendedBaseRent.toLocaleString()}`;
        negotiationPoints = [
          `專櫃在評估期間累計銷售達 NT$ ${totalSales.toLocaleString()}，全期 ${monthCount} 個月 0 次觸發包底，具備自然集客與營收實力。`,
          `因營運表現優良且無保底不足風險，建議爭取基準抽成調升 1.0%（由 ${currentBaseRate}% 調至 ${recommendedBaseRate}%）。`,
          `建議調升新月包底門檻至 NT$ ${recommendedBaseRent.toLocaleString()}，鎖定商場至少 85% 預期抽成收益。`
        ];
      } else if (shortfallCount <= 2) {
        // 偶發未達標 (1~2次)
        renewalAction = '【建議續約】(偶發未達包底，改採激勵型雙階梯)';
        rateChangeDelta = 0;
        recommendedBaseRate = currentBaseRate;
        commissionStrategy = '改採激勵型雙階梯抽成 (降包底促銷型)';
        const threshold = Math.round(avgMonthlySales * 1.05);
        recommendedBaseRent = Math.round(avgMonthlySales * (currentBaseRate / 100) * 0.75);
        recommendedTierRule = `月營收 <= NT$ ${threshold.toLocaleString()} 時維持 ${currentBaseRate}%；超過部分優惠抽成 ${(currentBaseRate - 1)}% (-1.0%) 激勵衝高業績`;
        negotiationPoints = [
          `專櫃全期共 ${shortfallCount} 個月未達包底門檻（累計補足差額 NT$ ${totalShortfallAmt.toLocaleString()}），受淡旺季或檔期波動影響。`,
          `建議將固定月包底適度調降至 NT$ ${recommendedBaseRent.toLocaleString()}，降低廠商淡季沈重負擔。`,
          `改採『超額階梯抽成』模式：超過月均目標（NT$ ${threshold.toLocaleString()}）以上營收讓利 1.0%，激勵專櫃積極參與商場聯合促銷。`
        ];
      } else {
        // 頻繁未達標 (>= 3 次)
        renewalAction = '【建議附條件續約或評估換櫃】(多次未達包底)';
        rateChangeDelta = 0;
        recommendedBaseRate = currentBaseRate;
        commissionStrategy = '維持原抽成，但要求縮減承租坪數或縮短合約期';
        recommendedBaseRent = Math.round(avgMonthlySales * (currentBaseRate / 100) * 0.7);
        recommendedTierRule = `維持基準費率 ${currentBaseRate}%，新月包底依近半年月均下修為 NT$ ${recommendedBaseRent.toLocaleString()}，並附加業績考核條款`;
        negotiationPoints = [
          `專櫃全期有 ${shortfallCount} 個月未達包底門檻（累計補足差額達 NT$ ${totalShortfallAmt.toLocaleString()}），營運動能疲軟。`,
          storeAreaNum > 0
            ? `目前專櫃坪數為 ${storeAreaNum} 坪（換算月均坪效僅 NT$ ${salesPerPing.toLocaleString()} / 坪），若欲續約建議要求縮減承租坪數 20%~30%，釋出面積引入高坪效品牌。`
            : `建議合約縮短為 1 年期考核約，並加註『若連續 3 個月營收低於門檻，商場得調整櫃位動線或解約』之保障條款。`,
          `若專櫃無法配合櫃位調整或強化促銷，建議於合約期滿後不再續約，啟動新品牌招商作業。`
        ];
      }
    } else {
      // === 類別 II: 一般抽成型專櫃 (純% / 無包底) ===
      if (isGrowing && effectiveTakeRate >= 14) {
        renewalAction = '【強烈建議續約】(營收正向成長，抽成貢獻健康)';
        rateChangeDelta = 0.5;
        recommendedBaseRate = currentBaseRate + rateChangeDelta;
        commissionStrategy = '調升基準抽成費率';
        recommendedTierRule = `建議正品由 ${currentBaseRate}% 微調至 ${recommendedBaseRate}% (+0.5%)`;
        negotiationPoints = [
          `專櫃累計營收達 NT$ ${totalSales.toLocaleString()}，且後半期營收較前半期成長 ${growthRate}%，動能強勁。`,
          `實質綜合抽成率達 ${effectiveTakeRate.toFixed(1)}%，對商場收益貢獻度高。`,
          `建議續約時將基準費率微調 +0.5%，並爭取配合大型檔期特別贊助。`
        ];
      } else if (isDeclining) {
        renewalAction = '【建議附條件續約】(營收呈現衰退，需加強考核)';
        rateChangeDelta = 0;
        recommendedBaseRate = currentBaseRate;
        commissionStrategy = '增訂月包底門檻或改換次級櫃位';
        recommendedBaseRent = Math.round(avgMonthlySales * (currentBaseRate / 100) * 0.8);
        recommendedTierRule = `費率維持 ${currentBaseRate}%，但強制增訂每月最低保底抽成 NT$ ${recommendedBaseRent.toLocaleString()}`;
        negotiationPoints = [
          `專櫃後半期營收衰退達 ${Math.abs(growthRate)}%（月均營收降至 NT$ ${avgMonthlySales.toLocaleString()}）。`,
          `為保障商場基本租金收益，新約建議增設每月最低包底 NT$ ${recommendedBaseRent.toLocaleString()}，避免商場營運空轉。`,
          storeAreaNum > 0 ? `目前月均坪效僅 NT$ ${salesPerPing.toLocaleString()} / 坪，建議評估移至坪數較小之次級動線櫃位。` : `建議要求品牌總部更換陳列主力商品或指派督導進駐輔導。`
        ];
      } else {
        renewalAction = '【建議平順續約】(業績平穩，優化固定扣款)';
        rateChangeDelta = 0;
        recommendedBaseRate = currentBaseRate;
        commissionStrategy = '維持抽成費率，調增公攤水電管銷費用';
        recommendedTierRule = `維持現行費率 ${currentBaseRate}%，固定代扣管銷款調增 3%~5%`;
        negotiationPoints = [
          `專櫃全期營收穩定（月均銷貨約 NT$ ${avgMonthlySales.toLocaleString()}），屬平穩合作租戶。`,
          `目前月均實扣款約 NT$ ${avgMonthlyDeductions.toLocaleString()}，建議下一期微調水電空調分攤費以反映成本上升。`,
          `爭取專櫃配合各季主題檔期提供獨家優惠商品，提升商場客流。`
        ];
      }
    }
  } else {
    // === 類別 III: 無月結營收數據 (僅有代扣明細或合約檔) ===
    if (versionCount >= 3) {
      renewalAction = '【建議平順續約】(長期合作租戶，建議優化費用結算)';
      rateChangeDelta = 0.5;
      recommendedBaseRate = currentBaseRate > 0 ? (currentBaseRate + 0.5) : 15.5;
      commissionStrategy = '維持合作，調增固定代扣款項';
      recommendedBaseRent = avgMonthlyDeductions > 0 ? Math.round(avgMonthlyDeductions * 1.5) : 0;
      recommendedTierRule = `建議抽成維持現狀；代扣費用依營運物價調增 3%~5%`;
      negotiationPoints = [
        `該專櫃在商場已歷經 ${versionCount} 期合約，屬於長期穩定租戶，履約與每月費用繳納紀錄良好（月均扣款 NT$ ${avgMonthlyDeductions.toLocaleString()}）。`,
        `建議優化公攤水電與清潔維護費率，以反映商場實際運維成本。`,
        `待補充月結銷貨明細後，可進一步精算其坪效與包底門檻。`
      ];
    } else {
      renewalAction = '【建議續約觀望】(需重新審定營業目標)';
      recommendedBaseRate = currentBaseRate;
      commissionStrategy = '短期 1 年續約 + 設立營業額考核目標';
      recommendedTierRule = `簽署 1 年期合約並設立月度營收檢核標準`;
      negotiationPoints = [
        `專櫃合作期尚短且目前暫缺完整月結營收紀錄，建議先簽署 1 年期合約觀察表現。`,
        `合約中應約定明確營業目標，作為下一期續約之審定標準。`
      ];
    }
  }

  const curR = currentBaseRate > 0 ? `${currentBaseRate}%` : '未載明';
  const recR = recommendedBaseRate > 0 ? `${recommendedBaseRate}%` : '未載明';
  const rDelta = rateChangeDelta > 0 ? `+${rateChangeDelta}%` : (rateChangeDelta < 0 ? `${rateChangeDelta}%` : '持平 (0%)');
  const baseRentStr = recommendedBaseRent > 0 ? `NT$ ${recommendedBaseRent.toLocaleString()} / 月` : '依現行約定';

  return {
    renewalAction,
    commissionStrategy,
    strategy: commissionStrategy,
    currentBaseRate: curR,
    currentRate: curR,
    recommendedBaseRate: recR,
    recRate: recR,
    rateChangeDelta: rDelta,
    rateChange: rDelta,
    recommendedTierRule,
    recommendedBaseRent: baseRentStr,
    recBaseRent: baseRentStr,
    avgMonthlySales: avgMonthlySales > 0 ? `NT$ ${avgMonthlySales.toLocaleString()}` : '無數據',
    avgMonthlyDeductions: avgMonthlyDeductions > 0 ? `NT$ ${avgMonthlyDeductions.toLocaleString()}` : '無數據',
    avgMonthlyDeduct: avgMonthlyDeductions > 0 ? `NT$ ${avgMonthlyDeductions.toLocaleString()}` : 'NT$ 0',
    shortfallCount,
    totalShortfallAmt,
    salesPerPing: salesPerPing > 0 ? `NT$ ${salesPerPing.toLocaleString()} / 坪` : '未填坪數',
    growthRateStr: growthRate !== 0 ? `${growthRate > 0 ? '+' : ''}${growthRate}%` : '持平',
    negotiationPoints,
    points: negotiationPoints
  };
}

module.exports = {
  computeLeasingAdvisory
};

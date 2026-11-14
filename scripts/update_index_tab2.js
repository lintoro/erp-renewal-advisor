const fs = require('fs');
let s = fs.readFileSync('index.html', 'utf8');

const oldFin = `    const finHeaders = ['月份', '銷售淨額', '抽成額', '代扣款項實扣', '商場實收', '專櫃實得'];
    const finRows = [finHeaders];
    d.records.forEach(r => finRows.push([
      r.month, r.sales.toLocaleString(), r.commission.toLocaleString(), r.deduct.toLocaleString(), r.mallRev.toLocaleString(), r.payout.toLocaleString()
    ]));
    renderTable('tbl-financials', finRows);`;

const newFin = `    const finHeaders = ['月份', '銷售淨額 (未稅)', '銷售含稅合計', '抽成額 (未稅)', '抽成含稅合計', '實扣款項', '包底狀態檢核', '商場總實收', '專櫃實得淨額'];
    const finRows = [finHeaders];
    d.records.forEach(r => finRows.push([
      r.month,
      (r.sales_untaxed !== undefined ? r.sales_untaxed : (r.sales || 0)).toLocaleString(),
      (r.sales_total !== undefined ? r.sales_total : (r.sales || 0)).toLocaleString(),
      (r.comm_untaxed !== undefined ? r.comm_untaxed : (r.commission || 0)).toLocaleString(),
      (r.comm_total !== undefined ? r.comm_total : (r.commission || 0)).toLocaleString(),
      (r.deduct || 0).toLocaleString(),
      r.shortfallNote || (r.baseRentShortfall > 0 ? \`🔴 未達包底 (補足 NT$ \${r.baseRentShortfall.toLocaleString()})\` : '🟢 達標'),
      (r.mallRev || 0).toLocaleString(),
      (r.payout || 0).toLocaleString()
    ]));
    renderTable('tbl-financials', finRows);`;

if (s.includes(oldFin)) {
  s = s.replace(oldFin, newFin);
  fs.writeFileSync('index.html', s, 'utf8');
  console.log('Successfully updated tbl-financials columns in index.html');
} else {
  console.log('oldFin not found');
}

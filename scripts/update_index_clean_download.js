const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// 1. 徹底清除模板中誤插入的 pdfModal 區塊
const misplacedModalRegex = /<!-- PDF 說明與下載 Modal -->[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*/;
if (misplacedModalRegex.test(html)) {
  html = html.replace(misplacedModalRegex, '');
  console.log('✅ 成功從 HTML 模板中清除誤插入的 pdfModal 區塊！');
} else {
  console.log('ℹ️ 未找到 misplacedModalRegex');
}

// 2. 徹底移除可能存在的其他 pdfModal
html = html.replace(/<div class="modal-overlay" id="pdfModal">[\s\S]*?<\/div>\s*<\/div>/g, '');

// 3. 更新步驟 2 的密碼欄位結構，加入「啟用密碼加密保護」核取方塊
const oldPwdField = `<div class="field-group">
          <label for="reportPassword">🔒 設定高管解鎖密碼</label>
          <input type="text" id="reportPassword" value="boss" placeholder="預設密碼: boss">
        </div>`;

const newPwdField = `<div class="field-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
            <label for="reportPassword" id="lblPasswordTitle">🔒 設定高管解鎖密碼</label>
            <label style="display: inline-flex; align-items: center; gap: 5px; font-size: 12px; cursor: pointer; color: #2563eb; font-weight: 600; user-select: none;">
              <input type="checkbox" id="chkEncrypt" checked style="cursor: pointer; width: auto; margin: 0;">
              啟用加密
            </label>
          </div>
          <input type="text" id="reportPassword" value="boss" placeholder="設定解鎖密碼 (預設: boss)">
        </div>`;

if (html.includes(oldPwdField)) {
  html = html.replace(oldPwdField, newPwdField);
  console.log('✅ 成功加入「啟用加密」勾選框！');
} else {
  console.error('❌ 未找到 oldPwdField');
}

// 4. 更新 btnExportMobile 點擊事件：支援「加密」與「免密碼明文」雙模式
const oldMobileEventRegex = /document\.getElementById\('btnExportMobile'\)\.addEventListener\('click'[\s\S]*?aLink\.click\(\);[\s\S]*?URL\.revokeObjectURL\(url\);\s*\}\);/;

const newMobileEvent = `// 監聽「啟用加密」核取方塊狀態變更
  document.getElementById('chkEncrypt').addEventListener('change', (e) => {
    const isEnc = e.target.checked;
    const pwdInput = document.getElementById('reportPassword');
    const lbl = document.getElementById('lblPasswordTitle');
    const btnMobile = document.getElementById('btnExportMobile');
    const btnPdf = document.getElementById('btnExportPdf');

    if (isEnc) {
      pwdInput.disabled = false;
      pwdInput.style.background = '#fff';
      pwdInput.placeholder = '設定解鎖密碼 (預設: boss)';
      lbl.innerText = '🔒 設定高管解鎖密碼';
      btnMobile.innerText = '📱 匯出高管手機加密報告 (HTML)';
      btnPdf.innerText = '📄 下載 LINE 加密 PDF';
    } else {
      pwdInput.disabled = true;
      pwdInput.style.background = '#f1f5f9';
      pwdInput.placeholder = '免密碼直接開啟 (明文)';
      lbl.innerText = '🔓 未啟用加密 (明文輸出)';
      btnMobile.innerText = '📱 匯出手機直讀報告 (HTML 免密碼)';
      btnPdf.innerText = '📄 下載 LINE PDF (免密碼)';
    }
  });

  // 匯出手機端 HTML 報告 (直接下載至電腦 Downloads 資料夾)
  document.getElementById('btnExportMobile').addEventListener('click', async () => {
    if (!state.dossier || !state.advisory) return;
    const isEnc = document.getElementById('chkEncrypt').checked;
    const pwd = document.getElementById('reportPassword').value.trim() || 'boss';
    const d = state.dossier;
    const a = state.advisory;
    const records = d.records || [];
    const totalSales = d.totalSales || 0;
    const totalComm = d.totalComm || 0;
    const totalDeduct = d.totalDeduct || 0;
    const shortfallCount = d.shortfallCount !== undefined ? d.shortfallCount : (records.filter(r => (r.baseRentShortfall || 0) > 0).length);

    const reportHtml = \`
      <div class="mobile-doc">
        <div class="m-header">
          <div class="m-badge">高管機密決策簡報</div>
          <h1 class="m-title">[\${d.meta.counterId}] \${d.meta.counterName}</h1>
          <div class="m-sub">所屬樓層：\${d.meta.floor || '未填寫'} ｜ 業種：\${d.meta.industry || '一般專櫃'} ｜ 面積：\${d.meta.storeArea || '15 坪'}</div>
          <div class="m-period">評估期別：第 \${d.meta.selectedVersions.join('、')} 期 (\${d.meta.startDate} ~ \${d.meta.endDate})</div>
        </div>

        <div class="m-card decision-card">
          <div class="d-label">招商決策建議結論</div>
          <div class="d-val">\${a.renewalAction}</div>
          <div class="d-grid">
            <div class="d-item">
              <span class="d-sublabel">建議抽成調整</span>
              <strong class="d-highlight">\${a.currentRate} ➔ \${a.recRate} (\${a.rateChange})</strong>
            </div>
            <div class="d-item">
              <span class="d-sublabel">建議月包底金額</span>
              <strong class="d-highlight">\${a.recBaseRent}</strong>
            </div>
          </div>
          <div class="d-rule">
            <strong>抽成模式策略：</strong>\${a.strategy}
          </div>
        </div>

        <div class="m-card">
          <div class="m-sec-title">🎯 招商同仁談判作戰籌碼 (Talking Points)</div>
          <ul class="m-list">
            \${a.points.map(p => \`<li>\${p}</li>\`).join('')}
          </ul>
        </div>

        <div class="m-card">
          <div class="m-sec-title">📊 期間營運與費用精算數據</div>
          <div class="stat-row"><span>累計銷售淨額 (未稅)：</span><strong style="color: #059669;">NT$ \${totalSales.toLocaleString()}</strong></div>
          <div class="stat-row"><span>累計商場抽成 (含稅)：</span><strong style="color: #d97706;">NT$ \${totalComm.toLocaleString()}</strong></div>
          <div class="stat-row"><span>合約期間實扣總額：</span><strong style="color: #2563eb;">NT$ \${totalDeduct.toLocaleString()}</strong></div>
          <div class="stat-row"><span>歷史月均實扣款：</span><strong>\${a.avgMonthlyDeduct}</strong></div>
          <div class="stat-row"><span>包底不足觸發次數：</span><strong style="\${shortfallCount > 0 ? 'color: #dc2626;' : 'color: #059669;'}">\${shortfallCount > 0 ? \`🔴 未達標共 \${shortfallCount} 次\` : '🟢 全數達標 (0次)'}</strong></div>
          <div class="stat-row"><span>納入評估月份數：</span><strong>\${records.length} 個月</strong></div>
        </div>

        <!-- 近 12 個月收支清單 -->
        <div class="m-card">
          <div class="m-sec-title">📅 近 12 個月收支與包底檢核清單</div>
          <div class="m-table-wrapper">
            <table class="m-table">
              <thead>
                <tr>
                  <th>月份</th>
                  <th>銷售淨額 (未/含稅)</th>
                  <th>抽成額 (未/含稅)</th>
                  <th>實扣款</th>
                  <th>包底狀態備註</th>
                </tr>
              </thead>
              <tbody>
                \${records.slice(-12).map(r => {
                  const sUn = r.sales_untaxed !== undefined ? r.sales_untaxed : (r.sales || 0);
                  const sTot = r.sales_total !== undefined ? r.sales_total : sUn;
                  const cUn = r.comm_untaxed !== undefined ? r.comm_untaxed : (r.commission || 0);
                  const cTot = r.comm_total !== undefined ? r.comm_total : (r.commission || 0);
                  const deduct = r.deduct !== undefined ? r.deduct : (r.deductions || 0);
                  const sf = r.baseRentShortfall || 0;
                  
                  let noteHtml = '<span style="color:#059669; font-weight:600;">🟢 達標</span>';
                  if (sf > 0) {
                    noteHtml = \`<span style="color:#dc2626; font-weight:700;">🔴 補足差額<br>NT$ \${sf.toLocaleString()}</span>\`;
                  }

                  return \`
                  <tr>
                    <td style="font-weight:600; white-space:nowrap;">\${r.month}</td>
                    <td>
                      <div style="font-weight:600;">NT$ \${sUn.toLocaleString()}</div>
                      <div style="font-size:10px; color:#64748b;">含稅 \${sTot.toLocaleString()}</div>
                    </td>
                    <td>
                      <div style="font-weight:600;">NT$ \${cUn.toLocaleString()}</div>
                      <div style="font-size:10px; color:#64748b;">含稅 \${cTot.toLocaleString()}</div>
                    </td>
                    <td>NT$ \${deduct.toLocaleString()}</td>
                    <td>\${noteHtml}</td>
                  </tr>
                  \`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- 最後一份合約扣款設定明細 -->
        <div class="m-card">
          <div class="m-sec-title">📌 最後一份合約扣款設定明細 (基準月份：\${d.terms.latestContractMonth || '最新期別'}，合計：NT$ \${(d.terms.latestDeductionTotal || 0).toLocaleString()})</div>
          <div class="m-table-wrapper">
            <table class="m-table">
              <thead>
                <tr>
                  <th>扣款項目名稱</th>
                  <th>約定/月均金額</th>
                  <th>性質與計算備註</th>
                </tr>
              </thead>
              <tbody>
                \${(d.terms.latestDeductions && d.terms.latestDeductions.length > 0) ? d.terms.latestDeductions.map(item => \`
                  <tr>
                    <td style="font-weight:600; white-space:nowrap;">\${item.name}</td>
                    <td style="color:#2563eb; font-weight:700; white-space:nowrap;">NT$ \${item.amount.toLocaleString()}</td>
                    <td style="font-size:11px; color:#475569;">\${item.note || item.month || '最新合約約定設定'}</td>
                  </tr>
                \`).join('') : \`
                  <tr>
                    <td colspan="3" style="text-align:center; color:#94a3b8;">無明細資料</td>
                  </tr>
                \`}
              </tbody>
            </table>
          </div>
        </div>

        <div class="m-footer">
          Minerva-ETL 系統自動產生 ｜ 機密文件請勿外流 ｜ 產生時間：\${new Date().toISOString().substring(0, 10)}
        </div>
      </div>
    \`;

    const commonStyle = \`
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      body { background: #0f172a; color: #f8fafc; min-height: 100vh; padding: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
      .mobile-doc { background: #f8fafc; color: #1e293b; border-radius: 12px; padding: 16px; width: 100%; max-width: 500px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
      .m-header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 14px; }
      .m-badge { display: inline-block; background: #0f172a; color: #f8fafc; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 4px; margin-bottom: 6px; }
      .m-title { font-size: 20px; font-weight: 800; color: #0f172a; }
      .m-sub { font-size: 12px; color: #64748b; margin-top: 4px; }
      .m-period { font-size: 12px; color: #0284c7; font-weight: 600; margin-top: 2px; }
      .m-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 12px; }
      .decision-card { background: linear-gradient(135deg, #1e3a8a, #0f172a); color: #fff; border: none; }
      .d-label { font-size: 11px; color: #93c5fd; font-weight: 700; }
      .d-val { font-size: 17px; font-weight: 800; color: #fde047; margin: 4px 0 10px; line-height: 1.3; }
      .d-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: rgba(255,255,255,0.08); border-radius: 6px; padding: 8px 10px; margin-bottom: 10px; }
      .d-sublabel { font-size: 11px; color: #93c5fd; display: block; }
      .d-highlight { font-size: 14px; color: #fff; font-weight: 700; }
      .d-rule { font-size: 12px; line-height: 1.4; color: #cbd5e1; }
      .m-sec-title { font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 8px; display: flex; align-items: center; gap: 4px; }
      .m-list { list-style: none; font-size: 12px; color: #334155; line-height: 1.5; }
      .m-list li { margin-bottom: 6px; position: relative; padding-left: 14px; }
      .m-list li::before { content: "•"; position: absolute; left: 0; color: #0284c7; font-weight: bold; }
      .stat-row { display: flex; justify-content: space-between; font-size: 12px; padding: 5px 0; border-bottom: 1px solid #f1f5f9; }
      .m-table-wrapper { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .m-table { width: 100%; border-collapse: collapse; font-size: 11px; text-align: left; }
      .m-table th { background: #f1f5f9; color: #475569; padding: 6px 4px; border: 1px solid #e2e8f0; font-weight: 600; white-space: nowrap; }
      .m-table td { padding: 6px 4px; border: 1px solid #e2e8f0; }
      .m-footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 10px; }
    \`;

    let finalHtml = '';
    let outFileName = '';

    if (isEnc) {
      // 模式 A：AES-256 加密輸出
      outFileName = \`專櫃合約評估_\${d.meta.counterId}_高管手機加密報告.html\`;
      const enc = new TextEncoder();
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const keyMaterial = await window.crypto.subtle.importKey('raw', enc.encode(pwd), 'PBKDF2', false, ['deriveKey']);
      const key = await window.crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );
      const encrypted = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(reportHtml));
      const payload = {
        salt: btoa(String.fromCharCode(...salt)),
        iv: btoa(String.fromCharCode(...iv)),
        ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted)))
      };

      finalHtml = \`<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>🔒 專櫃合約評估報告 (密碼保護)</title>
  <style>
    \${commonStyle}
    .lock-box { background: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 28px 20px; width: 100%; max-width: 380px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .lock-icon { font-size: 40px; margin-bottom: 12px; }
    .lock-title { font-size: 18px; font-weight: 700; color: #38bdf8; margin-bottom: 6px; }
    .lock-desc { font-size: 13px; color: #94a3b8; margin-bottom: 20px; line-height: 1.4; }
    .pwd-input { width: 100%; padding: 12px 14px; font-size: 16px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #fff; text-align: center; margin-bottom: 14px; }
    .pwd-input:focus { outline: none; border-color: #38bdf8; }
    .unlock-btn { width: 100%; padding: 12px; font-size: 15px; font-weight: 700; border-radius: 8px; border: none; background: #0284c7; color: #fff; cursor: pointer; transition: 0.2s; }
    .unlock-btn:hover { background: #0369a1; }
    .err-msg { color: #f87171; font-size: 13px; margin-top: 10px; display: none; }
    #reportContent { display: none; width: 100%; max-width: 500px; }
  </style>
</head>
<body>
  <div class="lock-box" id="lockBox">
    <div class="lock-icon">🔒</div>
    <div class="lock-title">專櫃合約評估與抽成決策</div>
    <div class="lock-desc">本文件包含核心營收與機密抽成費率，已透過 AES-256 銀行級技術加密保護。</div>
    <input type="password" class="pwd-input" id="unlockPwd" placeholder="請輸入高管解密密碼" autofocus>
    <button class="unlock-btn" id="unlockBtn">解密開啟報告</button>
    <div class="err-msg" id="errMsg">⚠️ 密碼錯誤，無法解密</div>
  </div>
  <div id="reportContent"></div>
  <script>
    const payload = \${JSON.stringify(payload)};
    function base64ToBuf(b64) {
      const bin = atob(b64);
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      return buf;
    }
    document.getElementById('unlockBtn').addEventListener('click', async () => {
      const pwd = document.getElementById('unlockPwd').value.trim();
      if (!pwd) return;
      try {
        const enc = new TextEncoder();
        const salt = base64ToBuf(payload.salt);
        const iv = base64ToBuf(payload.iv);
        const data = base64ToBuf(payload.ciphertext);
        const keyMat = await window.crypto.subtle.importKey('raw', enc.encode(pwd), 'PBKDF2', false, ['deriveKey']);
        const key = await window.crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
          keyMat,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt']
        );
        const dec = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
        const decHtml = new TextDecoder().decode(dec);
        document.getElementById('lockBox').style.display = 'none';
        const rep = document.getElementById('reportContent');
        rep.innerHTML = decHtml;
        rep.style.display = 'block';
      } catch (e) {
        document.getElementById('errMsg').style.display = 'block';
      }
    });
    document.getElementById('unlockPwd').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('unlockBtn').click();
    });
  \\x3C/script>
</body>
</html>\`;
    } else {
      // 模式 B：明文免密碼直接開啟
      outFileName = \`專櫃合約評估_\${d.meta.counterId}_高管手機報告.html\`;
      finalHtml = \`<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>專櫃合約評估報告 (直讀免密碼)</title>
  <style>
    \${commonStyle}
  </style>
</head>
<body>
  \${reportHtml}
</body>
</html>\`;
    }

    // 標準瀏覽器 Blob 下載 (直接落入使用者的 Downloads 資料夾)
    const blob = new Blob([finalHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const aLink = document.createElement('a');
    aLink.href = url;
    aLink.download = outFileName;
    document.body.appendChild(aLink);
    aLink.click();
    document.body.removeChild(aLink);
    URL.revokeObjectURL(url);
  });`;

if (oldMobileEventRegex.test(html)) {
  html = html.replace(oldMobileEventRegex, newMobileEvent);
  console.log('✅ 成功替換 btnExportMobile 為無彈窗、支援加密與明文雙模直接下載！');
} else {
  console.error('❌ 未匹配到 oldMobileEventRegex');
}

// 5. 更新 btnExportPdf 點擊事件：直接下載至 Downloads 資料夾，支援加密與未加密，絕不跳彈窗
const oldPdfEventRegex = /\/\/ 下載 LINE 加密 PDF \(支援自訂密碼即時動態加密\)[\s\S]*?function closePdfModal\(\)\s*\{[\s\S]*?\}/;

const newPdfEvent = `// 下載 LINE PDF (直接下載至電腦 Downloads 資料夾，無任何彈窗干擾)
  document.getElementById('btnExportPdf').addEventListener('click', async () => {
    if (!state.dossier) return;
    const isEnc = document.getElementById('chkEncrypt').checked;
    const d = state.dossier;
    const cId = d.meta.counterId;
    const pwd = document.getElementById('reportPassword').value.trim() || 'boss';
    const pdfFileName = isEnc 
      ? \`專櫃合約評估_\${cId}_高管手機加密報告.pdf\`
      : \`專櫃合約評估_\${cId}_高管手機報告.pdf\`;

    // 1. 純前端純本機即時生成並直接下載至 Downloads 資料夾
    if (window.PdfLibEncrypt && window.PDFLib && (window[\`__RAW_PDF_\${cId}__\`] || window.__RAW_PDF_TEMPLATE__)) {
      try {
        const rawB64 = window[\`__RAW_PDF_\${cId}__\`] || window.__RAW_PDF_TEMPLATE__;
        const binaryString = atob(rawB64);
        const rawBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          rawBytes[i] = binaryString.charCodeAt(i);
        }

        let downloadBytes = rawBytes;
        if (isEnc) {
          // 啟用加密：即時套用使用者輸入的最新密碼
          window.PdfLibEncrypt.configure(window.PDFLib);
          downloadBytes = await window.PdfLibEncrypt.lock(rawBytes, pwd);
        }

        // 直接觸發瀏覽器下載至使用者的 Downloads 目錄
        const blob = new Blob([downloadBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = pdfFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      } catch (err) {
        console.warn('前端即時生成 PDF 失敗，回退至伺服器檔案下載:', err);
      }
    }

    // 2. 回退備用方案
    const pdfPath = \`output/\${pdfFileName}\`;
    const a = document.createElement('a');
    a.href = pdfPath;
    a.download = pdfFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });`;

if (oldPdfEventRegex.test(html)) {
  html = html.replace(oldPdfEventRegex, newPdfEvent);
  console.log('✅ 成功替換 btnExportPdf 為無彈窗、直接下載至 Downloads 資料夾！');
} else {
  console.error('❌ 未匹配到 oldPdfEventRegex');
}

fs.writeFileSync('index.html', html, 'utf8');
console.log('🎉 index.html 完整修正完成！');

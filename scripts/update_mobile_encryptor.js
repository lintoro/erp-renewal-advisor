const fs = require('fs');

const mobileEncryptorContent = `/**
 * 行動端手機專用報告生成與 AES-256-GCM 加密封裝器 (v2.2 完整營收與包底狀態版)
 */
const crypto = require('crypto');

function encryptContentWithPassword(plainText, password) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // 合併密文與 tag (Web Crypto API 規格：cipherText + tag)
  const combined = Buffer.concat([encrypted, tag]);

  return {
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    data: combined.toString('base64')
  };
}

function generateMobileReportHTML(dossier, advisory) {
  const records = dossier.financials.monthlyRecords || dossier.records || [];
  const totalSales = dossier.financials.totalSales || dossier.totalSales || 0;
  const totalComm = dossier.financials.totalCommission || dossier.totalComm || 0;
  const totalDeduct = dossier.financials.totalDeductions || dossier.totalDeduct || 0;
  const shortfallCount = dossier.financials.shortfallCount !== undefined ? dossier.financials.shortfallCount : (records.filter(r => (r.baseRentShortfall || 0) > 0).length);

  return \`
  <div class="mobile-doc">
    <div class="m-header">
      <div class="m-badge">高管機密決策簡報</div>
      <h1 class="m-title">[\${dossier.meta.counterId}] \${dossier.meta.counterName}</h1>
      <div class="m-sub">所屬樓層：\${dossier.meta.floor} ｜ 業種：\${dossier.meta.industry} ｜ 面積：\${dossier.meta.storeArea || '未填寫'}</div>
      <div class="m-period">評估期別：第 \${dossier.meta.selectedVersions.join('、')} 期 (\${dossier.meta.startDate} ~ \${dossier.meta.endDate})</div>
    </div>

    <!-- 核心續約與調%決策卡 -->
    <div class="m-card decision-card">
      <div class="d-label">招商決策建議結論</div>
      <div class="d-val">\${advisory.renewalAction}</div>
      <div class="d-grid">
        <div class="d-item">
          <span class="d-sublabel">建議抽成調整</span>
          <strong class="d-highlight">\${advisory.currentBaseRate || advisory.currentRate} ➔ \${advisory.recommendedBaseRate || advisory.recRate} (\${advisory.rateChangeDelta || advisory.rateChange})</strong>
        </div>
        <div class="d-item">
          <span class="d-sublabel">建議月包底金額</span>
          <strong class="d-highlight">\${advisory.recommendedBaseRent || advisory.recBaseRent}</strong>
        </div>
      </div>
      <div class="d-rule">
        <strong>抽成模式策略：</strong>\${advisory.commissionStrategy || advisory.strategy}<br>
        <span style="font-size:12px; color:#e2e8f0; margin-top:4px; display:inline-block;">\${advisory.recommendedTierRule || ''}</span>
      </div>
    </div>

    <!-- 談判作戰要點 -->
    <div class="m-card">
      <div class="m-sec-title">🎯 招商同仁談判作戰籌碼 (Talking Points)</div>
      <ul class="m-list">
        \${(advisory.negotiationPoints || advisory.points || []).map(p => \`<li>\${p}</li>\`).join('')}
      </ul>
    </div>

    <!-- 營運財務精算摘要 -->
    <div class="m-card">
      <div class="m-sec-title">📊 期間營運與費用精算數據</div>
      <div class="stat-row">
        <span>累計銷售淨額 (未稅)：</span>
        <strong style="color: #059669;">NT$ \${totalSales.toLocaleString()}</strong>
      </div>
      <div class="stat-row">
        <span>累計商場抽成 (含稅)：</span>
        <strong style="color: #d97706;">NT$ \${totalComm.toLocaleString()}</strong>
      </div>
      <div class="stat-row">
        <span>合約期間實扣總額：</span>
        <strong style="color: #2563eb;">NT$ \${totalDeduct.toLocaleString()}</strong>
      </div>
      <div class="stat-row">
        <span>歷史月均實扣款：</span>
        <strong>\${advisory.avgMonthlyDeductions || advisory.avgMonthlyDeduct || 'NT$ 0'}</strong>
      </div>
      <div class="stat-row">
        <span>包底不足觸發次數：</span>
        <strong style="\${shortfallCount > 0 ? 'color: #dc2626;' : 'color: #059669;'}">\${shortfallCount > 0 ? \`🔴 未達標共 \${shortfallCount} 次\` : '🟢 全數達標 (0次)'}</strong>
      </div>
      <div class="stat-row">
        <span>納入評估月份數：</span>
        <strong>\${records.length} 個月</strong>
      </div>
    </div>

    <!-- 近 12 個月收支清單 (營業額、抽成額、實扣款、包底條件識別) -->
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
              const deduct = r.deductions !== undefined ? r.deductions : (r.deduct || 0);
              const sf = r.baseRentShortfall || 0;
              
              let noteHtml = '<span style=\"color:#059669; font-weight:600;\">🟢 達標</span>';
              if (sf > 0) {
                noteHtml = \`<span style=\"color:#dc2626; font-weight:700;\">🔴 補足差額<br>NT$ \${sf.toLocaleString()}</span>\`;
              }

              return \`
              <tr>
                <td style=\"font-weight:600; white-space:nowrap;\">\${r.month}</td>
                <td>
                  <div style=\"font-weight:600;\">NT$ \${sUn.toLocaleString()}</div>
                  <div style=\"font-size:10px; color:#64748b;\">含稅 \${sTot.toLocaleString()}</div>
                </td>
                <td>
                  <div style=\"font-weight:600;\">NT$ \${cUn.toLocaleString()}</div>
                  <div style=\"font-size:10px; color:#64748b;\">含稅 \${cTot.toLocaleString()}</div>
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

    <div class="m-footer">
      Minerva-ETL 系統自動產生 ｜ 機密文件請勿外流 ｜ 產生時間：\${dossier.meta.generatedAt || new Date().toISOString().substring(0, 10)}
    </div>
  </div>
  \`;
}

function buildEncryptedMobilePackage(dossier, advisory, password) {
  const innerHtml = generateMobileReportHTML(dossier, advisory);
  const encryptedPkg = encryptContentWithPassword(innerHtml, password);

  const htmlTemplate = \`<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>🔒 專櫃合約評估報告 (密碼保護)</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #0f172a; color: #f8fafc; min-height: 100vh; padding: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; }

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
    .mobile-doc { background: #f8fafc; color: #1e293b; border-radius: 12px; padding: 16px; width: 100%; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
    .m-header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 14px; }
    .m-badge { display: inline-block; background: #fee2e2; color: #b91c1c; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 10px; margin-bottom: 6px; }
    .m-title { font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
    .m-sub { font-size: 12px; color: #64748b; margin-bottom: 2px; }
    .m-period { font-size: 11px; color: #2563eb; font-weight: 600; }

    .m-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 12px; }
    .decision-card { background: linear-gradient(135deg, #1e3a8a, #1e40af); color: #fff; border: none; }
    .d-label { font-size: 11px; text-transform: uppercase; color: #93c5fd; font-weight: 700; margin-bottom: 4px; }
    .d-val { font-size: 18px; font-weight: 800; color: #fde047; margin-bottom: 12px; }
    .d-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: rgba(255,255,255,0.1); border-radius: 8px; padding: 10px; margin-bottom: 10px; }
    .d-sublabel { font-size: 11px; color: #bfdbfe; display: block; margin-bottom: 2px; }
    .d-highlight { font-size: 14px; color: #fff; }
    .d-rule { font-size: 13px; line-height: 1.4; color: #e2e8f0; }

    .m-sec-title { font-size: 14px; font-weight: 700; color: #1e3a8a; margin-bottom: 8px; border-left: 3px solid #3b82f6; padding-left: 6px; }
    .m-list { margin-left: 18px; font-size: 13px; color: #334155; line-height: 1.5; }
    .m-list li { margin-bottom: 6px; }

    .stat-row { display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; }
    .stat-row:last-child { border-bottom: none; }

    .m-table-wrapper { overflow-x: auto; margin-top: 6px; }
    .m-table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .m-table th, .m-table td { padding: 6px 4px; text-align: left; border: 1px solid #e2e8f0; }
    .m-table th { background: #f1f5f9; font-weight: 700; color: #475569; white-space: nowrap; }

    .m-footer { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 14px; }
  </style>
</head>
<body>

  <div class="lock-box" id="lockBox">
    <div class="lock-icon">🔒</div>
    <div class="lock-title">專櫃合約評估與抽成決策</div>
    <div class="lock-desc">本文件包含核心營收與機密抽成費率，已透過 AES-256 銀行級技術加密保護。</div>
    <input type="password" class="pwd-input" id="pwdInput" placeholder="請輸入高管解密密碼">
    <button class="unlock-btn" id="unlockBtn">解密開啟報告</button>
    <div class="err-msg" id="errMsg">⚠️ 密碼錯誤，請重新確認！</div>
  </div>

  <div id="reportContent"></div>

  <script>
    const encryptedData = __PAYLOAD_DATA__;

    function base64ToBytes(b64) {
      const bin = window.atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; ++i) arr[i] = bin.charCodeAt(i);
      return arr;
    }

    async function decryptPackage(password) {
      try {
        const salt = base64ToBytes(encryptedData.salt);
        const iv = base64ToBytes(encryptedData.iv);
        const combined = base64ToBytes(encryptedData.data);

        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
          'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
        );

        const key = await window.crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt']
        );

        const decrypted = await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          key,
          combined
        );

        const dec = new TextDecoder();
        return dec.decode(decrypted);
      } catch (err) {
        console.error('Decryption failed:', err);
        return null;
      }
    }

    document.getElementById('unlockBtn').addEventListener('click', async () => {
      const pwd = document.getElementById('pwdInput').value;
      const errMsg = document.getElementById('errMsg');
      const btn = document.getElementById('unlockBtn');
      if (!pwd) return;

      btn.innerText = '正在解密...';
      btn.disabled = true;

      const html = await decryptPackage(pwd);
      if (html) {
        document.getElementById('lockBox').style.display = 'none';
        const rep = document.getElementById('reportContent');
        rep.innerHTML = html;
        rep.style.display = 'block';
      } else {
        errMsg.style.display = 'block';
        btn.innerText = '解密開啟報告';
        btn.disabled = false;
      }
    });

    document.getElementById('pwdInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') document.getElementById('unlockBtn').click();
    });
  </script>
</body>
</html>\`;

  return htmlTemplate.replace('__PAYLOAD_DATA__', JSON.stringify(encryptedPkg));
}

module.exports = {
  encryptContentWithPassword,
  generateMobileReportHTML,
  buildEncryptedMobilePackage
};
`;

fs.writeFileSync('src/mobile/mobile_encryptor.js', mobileEncryptorContent, 'utf8');
console.log('Successfully updated src/mobile/mobile_encryptor.js');

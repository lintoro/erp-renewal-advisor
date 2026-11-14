const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// 找到 document.getElementById('btnExportMobile').addEventListener('click' 的起始位置
const targetStr = "document.getElementById('btnExportMobile').addEventListener('click'";
const startIdx = content.indexOf(targetStr);
if (startIdx === -1) {
  throw new Error("Cannot find btnExportMobile in index.html");
}

const newHandler = `document.getElementById('btnExportMobile').addEventListener('click', async () => {
    if (!state.dossier || !state.advisory) return;
    const pwd = document.getElementById('reportPassword').value.trim() || 'boss';
    const d = state.dossier;
    const a = state.advisory;

    const reportHtml = \`
      <div class="mobile-doc">
        <div class="m-header">
          <div class="m-badge">高管機密決策簡報</div>
          <h1 class="m-title">[\${d.meta.counterId}] \${d.meta.counterName}</h1>
          <div class="m-sub">所屬樓層：\${d.meta.floor} ｜ 業種：\${d.meta.industry}</div>
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
          <div class="stat-row"><span>月均代扣款負擔：</span><strong>\${a.avgMonthlyDeduct}</strong></div>
          <div class="stat-row"><span>合約期間實扣總額：</span><strong style="color: #2563eb;">NT$ \${d.totalDeduct.toLocaleString()}</strong></div>
          <div class="stat-row"><span>納入評估月份數：</span><strong>\${d.records.length} 個月</strong></div>
        </div>

        <div class="m-card">
          <div class="m-sec-title">📅 月度費用實扣清單 (近 12 個月)</div>
          <div class="m-table-wrapper">
            <table class="m-table">
              <thead><tr><th>月份</th><th>實扣款項</th></tr></thead>
              <tbody>
                \${d.records.slice(-12).map(r => \`<tr><td>\${r.month}</td><td>NT$ \${r.deduct.toLocaleString()}</td></tr>\`).join('')}
              </tbody>
            </table>
          </div>
        </div>
        <div class="m-footer">
          Minerva-ETL 系統自動產生 ｜ 機密文件請勿外流 ｜ 產生時間：\${new Date().toISOString().substring(0, 10)}
        </div>
      </div>
    \`;

    // 瀏覽器端 Web Crypto API 加密
    const enc = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const keyMaterial = await window.crypto.subtle.importKey('raw', enc.encode(pwd), { name: 'PBKDF2' }, false, ['deriveKey']);
    const key = await window.crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const encryptedBuf = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(reportHtml));
    const encryptedBytes = new Uint8Array(encryptedBuf);

    function arrayBufferToBase64(bytes) {
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
    }

    const payload = {
      salt: arrayBufferToBase64(salt),
      iv: arrayBufferToBase64(iv),
      data: arrayBufferToBase64(encryptedBytes)
    };

    // 獨立單檔外殼範本
    const template = \`<!DOCTYPE html>
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
    #reportContent { display: none; width: 100%; max-width: 480px; }
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
    .m-table-wrapper { overflow-x: auto; margin-top: 6px; }
    .m-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .m-table th, .m-table td { padding: 6px 8px; text-align: left; border: 1px solid #e2e8f0; }
    .m-table th { background: #f1f5f9; font-weight: 700; color: #475569; }
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

        return new TextDecoder().decode(decrypted);
      } catch (err) {
        console.error('Decryption failed:', err);
        return null;
      }
    }

    document.getElementById('unlockBtn').addEventListener('click', async () => {
      const p = document.getElementById('pwdInput').value;
      const errMsg = document.getElementById('errMsg');
      const btn = document.getElementById('unlockBtn');
      if (!p) return;

      btn.innerText = '正在解密...';
      btn.disabled = true;

      const html = await decryptPackage(p);
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
  <\/script>
</body>
</html>\`;

    const finalHtml = template.replace('__PAYLOAD_DATA__', JSON.stringify(payload));
    const blob = new Blob([finalHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const aLink = document.createElement('a');
    aLink.href = url;
    aLink.download = \`專櫃合約評估_\${d.meta.counterId}_高管手機加密報告.html\`;
    aLink.click();
    URL.revokeObjectURL(url);
  });
</script>

</body>
</html>
`;

// 替換結尾
content = content.substring(0, startIdx) + newHandler;
fs.writeFileSync(indexPath, content, 'utf8');
console.log('✅ Successfully updated index.html with rock-solid decryption handler!');

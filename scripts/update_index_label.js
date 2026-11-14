const fs = require('fs');

let s = fs.readFileSync('index.html', 'utf8');

s = s.replace(
  '<button class="btn btn-mobile" id="btnExportMobile" disabled>📱 匯出手機加密報告</button>',
  '<button class="btn btn-mobile" id="btnExportMobile" disabled>📱 匯出高管手機加密報告 (HTML)</button>'
);

fs.writeFileSync('index.html', s, 'utf8');
console.log('Updated index.html button label successfully.');

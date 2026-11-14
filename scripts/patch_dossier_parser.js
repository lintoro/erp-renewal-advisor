const fs = require('fs');

let code = fs.readFileSync('src/etl/dossier_generator.js', 'utf8');

const targetStr = `  const colHeaders = {};
  if (isDoubleHeader) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const topCell = sheet[XLSX.utils.encode_cell({ r: headerRowIdx, c: C })];
      const subCell = sheet[XLSX.utils.encode_cell({ r: headerRowIdx + 1, c: C })];
      const topVal = topCell ? String(topCell.v).trim() : '';
      const subVal = subCell ? String(subCell.v).trim() : '';
      colHeaders[C] = topVal && subVal ? \`\${topVal}_\${subVal}\` : (subVal || topVal || \`COL_\${C}\`);
    }
  }`;

const replacementStr = `  const colHeaders = {};
  if (isDoubleHeader) {
    let currentCategory = '';
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const topCell = sheet[XLSX.utils.encode_cell({ r: headerRowIdx, c: C })];
      const subCell = sheet[XLSX.utils.encode_cell({ r: headerRowIdx + 1, c: C })];
      const topVal = topCell ? String(topCell.v).trim() : '';
      const subVal = subCell ? String(subCell.v).trim() : '';
      if (topVal) currentCategory = topVal;

      if (currentCategory && subVal) {
        colHeaders[C] = \`\${currentCategory}_\${subVal}\`;
      } else if (subVal) {
        colHeaders[C] = subVal;
      } else if (topVal) {
        colHeaders[C] = topVal;
      } else {
        colHeaders[C] = \`COL_\${C}\`;
      }
    }
  }`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replacementStr);
  fs.writeFileSync('src/etl/dossier_generator.js', code, 'utf8');
  console.log('Successfully updated parseTableRows in dossier_generator.js');
} else {
  console.log('Target string not found in dossier_generator.js');
}

const fs = require('fs');

let code = fs.readFileSync('src/etl/dossier_generator.js', 'utf8');

const targetStr = `    financials: {
      monthlyRecords,
      totalSales,
      totalCommission,
      totalDeductions,
      totalNetPayout
    },`;

const replacementStr = `    financials: {
      monthlyRecords,
      totalSales,
      totalCommission,
      totalDeductions,
      totalNetPayout,
      shortfallCount: baseRentShortfallCount
    },`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replacementStr);
  fs.writeFileSync('src/etl/dossier_generator.js', code, 'utf8');
  console.log('Successfully added shortfallCount to financials in dossier_generator.js');
} else {
  console.log('Target string not found in dossier_generator.js');
}

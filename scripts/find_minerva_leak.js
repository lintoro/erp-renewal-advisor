const fs = require('fs');
const s = fs.readFileSync('Minerva_Dossier_Standalone.html', 'utf8');

const target = 'function(e){return"00,"';
const p = s.indexOf(target);
console.log('Pos in Minerva_Dossier_Standalone.html:', p);
if (p !== -1) {
  console.log('100 chars before target:');
  console.log(JSON.stringify(s.slice(p - 100, p)));
  console.log('Target itself and 100 chars after:');
  console.log(JSON.stringify(s.slice(p, p + 100)));
}

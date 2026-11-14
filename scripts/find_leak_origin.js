const fs = require('fs');
const s = fs.readFileSync('node_modules/xlsx/dist/xlsx.full.min.js', 'utf8');

// The image shows: "].replace(/^\d*$/,function(e){return"00,"+(e.length<3?P(0,3-e.length):"")+e}+"."+P(s,i[1].length)...
const leaked = '].replace(/^\\d*$,function(e){return"00,"';
const p = s.indexOf('function(e){return"00,"');
console.log('Pos of function(e){return"00,":', p);
if (p !== -1) {
  console.log('Before pos:', JSON.stringify(s.slice(p - 80, p)));
}

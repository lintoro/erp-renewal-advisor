const fs = require('fs');
const s = fs.readFileSync('index.html', 'utf8');

const p1 = s.indexOf('<script src="node_modules/xlsx/dist/xlsx.full.min.js"></script>');
const p2 = s.indexOf('<script>', p1 + 50);
const p3 = s.lastIndexOf('</script>');
console.log('Script tag 1:', p1, 'Tag 2:', p2, 'Tag 3:', p3);
console.log('Trailing chars:', JSON.stringify(s.slice(p3 + 9)));

// Check for any unescaped script tag inside JS
const jsContent = s.slice(p2 + 8, p3);
const re = /<\/?script\b/gi;
let m;
let hasBadScript = false;
while ((m = re.exec(jsContent)) !== null) {
  console.log('Found unescaped script tag inside JS at:', m.index, m[0]);
  hasBadScript = true;
}
if (!hasBadScript) {
  console.log('🎉 Perfect! No unescaped script tags found inside JS code.');
}

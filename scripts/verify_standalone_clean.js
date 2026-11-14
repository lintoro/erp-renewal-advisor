const fs = require('fs');
const s = fs.readFileSync('Minerva_Dossier_Standalone.html', 'utf8');

// Find all script tags in the standalone file
const re = /<\/?script\b[^>]*>/gi;
let m;
const tags = [];
while ((m = re.exec(s)) !== null) {
  tags.push({ tag: m[0], pos: m.index });
}

console.log('Total script tags in Standalone HTML:', tags.length);
tags.forEach((t, i) => console.log(`  Tag ${i}: ${t.tag} at pos ${t.pos}`));

// Check if any code leaks out before </body>
const bodyClosePos = s.lastIndexOf('</body>');
const lastScriptClose = s.lastIndexOf('</script>');
console.log('lastScriptClose:', lastScriptClose, 'bodyClosePos:', bodyClosePos);
const inBetween = s.slice(lastScriptClose + 9, bodyClosePos).trim();
console.log('Text between last </script> and </body>:', JSON.stringify(inBetween));
if (inBetween === '') {
  console.log('🎉 100% CLEAN! No code leakage in Standalone HTML!');
} else {
  console.log('⚠️ Warning: Found text between </script> and </body>:', inBetween);
}

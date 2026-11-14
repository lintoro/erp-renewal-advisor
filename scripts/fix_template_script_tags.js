const fs = require('fs');

let s = fs.readFileSync('index.html', 'utf8');

// Replace <script> with \x3Cscript\x3E and </script> with \x3C/script\x3E inside the template string
const targetScriptOpen = '<div id="reportContent"></div>\n  <script>';
const repScriptOpen = '<div id="reportContent"></div>\\n  \\x3Cscript\\x3E';

const targetScriptClose = '  </script>\n</body>\n</html>`;';
const repScriptClose = '  \\x3C/script\\x3E\\n</body>\\n</html>`;';

s = s.replace('<div id="reportContent"></div>\n  <script>', '<div id="reportContent"></div>\n  \\x3Cscript\\x3E');
s = s.replace('<div id="reportContent"></div>\r\n  <script>', '<div id="reportContent"></div>\r\n  \\x3Cscript\\x3E');

s = s.replace('  </script>\n</body>\n</html>`;', '  \\x3C/script\\x3E\n</body>\n</html>`;');
s = s.replace('  </script>\r\n</body>\r\n</html>`;', '  \\x3C/script\\x3E\r\n</body>\r\n</html>`;');

fs.writeFileSync('index.html', s, 'utf8');
console.log('Done hex escaping.');

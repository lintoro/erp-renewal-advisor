const fs = require('fs');
let s = fs.readFileSync('index.html', 'utf8');

const target1 = "storeArea: document.getElementById('inputArea') ? document.getElementById('inputArea').value : '15 坪',";
const rep1 = "storeArea: (document.getElementById('inputArea') && document.getElementById('inputArea').value.trim()) ? document.getElementById('inputArea').value.trim() : '',";

const target2 = '<input type="text" class="form-control" id="inputArea" value="15 坪" placeholder="例如: 15 坪">';
const rep2 = '<input type="text" class="form-control" id="inputArea" value="" placeholder="例如: 15 坪 (選填)">';

if (s.includes(target1)) s = s.replace(target1, rep1);
if (s.includes(target2)) s = s.replace(target2, rep2);

fs.writeFileSync('index.html', s, 'utf8');
console.log('Removed hardcoded 15 坪 successfully.');

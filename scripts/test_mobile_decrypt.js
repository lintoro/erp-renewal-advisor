const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const filePath = path.join(__dirname, '../output/專櫃合約評估_00032_高管手機加密報告.html');
const html = fs.readFileSync(filePath, 'utf8');

const p = html.indexOf('const encryptedData = ');
const pEnd = html.indexOf(';', p);
const jsonStr = html.slice(p + 'const encryptedData = '.length, pEnd);
const encryptedData = JSON.parse(jsonStr);

console.log('Encrypted payload present. Attempting decryption with password "boss"...');

function base64ToBytes(b64) {
  return Buffer.from(b64, 'base64');
}

const salt = base64ToBytes(encryptedData.salt);
const iv = base64ToBytes(encryptedData.iv);
const combined = base64ToBytes(encryptedData.data);

// Combined has ciphertext + 16 bytes tag
const tag = combined.slice(combined.length - 16);
const ciphertext = combined.slice(0, combined.length - 16);

const key = crypto.pbkdf2Sync('boss', salt, 100000, 32, 'sha256');
const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
decipher.setAuthTag(tag);

try {
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  console.log('🎉 Decryption successful!');
  console.log('Decrypted snippet:');
  console.log(decrypted.slice(0, 400));
  console.log('\nHas 近 12 個月收支清單?', decrypted.includes('近 12 個月收支與包底檢核清單'));
  console.log('Has shortfall note?', decrypted.includes('補足差額'));
} catch (err) {
  console.error('Decryption failed:', err);
}

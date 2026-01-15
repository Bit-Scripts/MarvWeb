// build-pug.js
const fs = require('fs');
const path = require('path');
const pug = require('pug');

const viewsDir = path.join(__dirname, 'views');
const outDir = path.join(__dirname, 'dist');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

console.log("build-pug.js: START");

try {
  const html = pug.renderFile(path.join(viewsDir, 'index.pug'), { pretty: false });
  fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
  console.log("Pug compiled -> dist/index.html");
} catch (e) {
  console.error("Pug compile failed:", e);
  process.exit(1);
}

console.log("build-pug.js: END");


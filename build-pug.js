// build-pug.js
const fs = require('fs');
const path = require('path');
const pug = require('pug');

const viewsDir = path.join(__dirname, 'views');
const outDir = path.join(__dirname, 'dist');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

console.log('build-pug.js: START');

try {
  const html = pug.renderFile(path.join(viewsDir, 'index.pug'), {
    pretty: false,
    // variables globales si besoin
  });

  fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
  console.log('Pug compiled -> dist/index.html');
  console.log('build-pug.js: END');
} catch (e) {
  console.error('build-pug.js: ERROR');
  console.error(e);
  process.exit(1);
}

// Build only the backend. The independent external application remains untouched.
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const extension = read('backoffice-extension.js') + '\n' + read('current-backoffice.js');
const core = read('core.js');
if (!/render\(\);\s*\}\)\(\);\s*$/.test(core)) throw Error('Missing core entry');
const app = core.replace(/render\(\);\s*\}\)\(\);\s*$/, () => extension + '\nrender();\n})();');
fs.writeFileSync(path.join(root, 'app.js'), app);
let packed = app;
for (const name of fs.readdirSync(root).filter(n => /\.(png|svg)$/.test(n))) {
  const uri = 'data:' + (name.endsWith('.png') ? 'image/png' : 'image/svg+xml') + ';base64,' + fs.readFileSync(path.join(root,name)).toString('base64');
  packed = packed.split(name).join(uri);
}
const safe = text => text.replace(/<\/script/gi, '<\\/script');
const html = read('index.html')
  .replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, name) => '<style>' + read(name) + '</style>')
  .replace(/<script defer src="[^"]+"><\/script>/g, '')
  .replace('</body>', () => '<script>' + safe(read('data.js')) + '</script><script>' + safe(packed) + '</script></body>');
fs.writeFileSync(path.join(root, 'backoffice.html'), html);
console.log('Built standalone backoffice.html:', Buffer.byteLength(html), 'bytes');

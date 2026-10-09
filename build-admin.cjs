// Build only the backend. The independent external application remains untouched.
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const extension = ['backoffice-extension.js','current-backoffice.js','merchant-table-state.js','onboarding-v2-data.js','onboarding-document-schema.js','onboarding-v2.js','upload-controls.js','br-integration.js','onboarding-risk.js','internal-review.js','onboarding-document-feedback.js','multi-document-workflow.js','azure-i18n.js','azure-auth.js','azure-ktc.js','azure-ui.js'].map(read).join('\n');
const core = read('core.js');
if (!/render\(\);\s*\}\)\(\);\s*$/.test(core)) throw Error('Missing core entry');
const libs=['node_modules/qrcode-generator/dist/qrcode.js','node_modules/opencc-js/dist/umd/t2cn.js'].map(read).join('\n');
const app = libs+'\n'+core.replace(/render\(\);\s*\}\)\(\);\s*$/, () => 'const AZURE_EXTERNAL=false;\n'+extension + '\nrender();\n})();').replaceAll('4864c.png','azure-logo.png').replaceAll('ALLINPAY International','Azure');
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

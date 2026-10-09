// Build only the external demo from its checked-in sources and asset manifest.
// Do not import untracked artwork or rebuild the independent backoffice.
const fs=require('node:fs'),path=require('node:path');
const root=__dirname,read=name=>fs.readFileSync(path.join(root,name),'utf8');
const assets=JSON.parse(read('asset-manifest.json'));
for(const [key,file] of Object.entries({'4864c.png':'azure-logo.png','b851a.png':'azure-login-cafe.png','d5909.png':'azure-login-online.png','800bf.png':'azure-login-retail.png'}))assets[key]='data:image/png;base64,'+fs.readFileSync(path.join(root,file)).toString('base64');
const safe=text=>text.replace(/<\/script/gi,'<\\/script');
const shared='const AZURE_EXTERNAL=true;\n'+['external-onboarding-bootstrap.js','onboarding-v2-data.js','onboarding-document-schema.js','onboarding-v2.js','upload-controls.js','br-integration.js','onboarding-document-feedback.js','multi-document-workflow.js','external-onboarding-shell.js','azure-i18n.js','azure-auth.js','azure-ktc.js','azure-ktc-camera.js','azure-ui.js'].map(read).join('\n');
const source=read('external.js');
const entry="document.addEventListener('input',e=>{const t=e.target;";
if(!source.includes(entry))throw Error('Missing External extension entry');
const html=read('external.template.html')
 .replace('/* BUNDLE_CSS */',()=>['external.css','onboarding-v2.css','br-integration.css','document-feedback.css','external-onboarding.css','azure-theme.css'].map(read).join('\n'))
 .replace('/* BUNDLE_ASSETS */',()=>safe(['node_modules/qrcode-generator/dist/qrcode.js','node_modules/opencc-js/dist/umd/t2cn.js'].map(read).join('\n')+'\nconst ASSETS='+JSON.stringify(assets)+';'))
 .replace('/* BUNDLE_JS */',()=>safe(source.replace(entry,()=>shared+'\n'+entry).replaceAll('透過 AllinPay 商戶申請平台','透過 Azure 商戶申請平台').replaceAll('© AllinPay','© Azure').replaceAll('ALLINPAY International','Azure')));
fs.writeFileSync(path.join(root,'external.html'),html);
console.log('Built standalone external.html:',Buffer.byteLength(html),'bytes');

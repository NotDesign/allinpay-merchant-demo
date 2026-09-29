// Build only the external demo from its checked-in sources and asset manifest.
// Do not import untracked artwork or rebuild the independent backoffice.
const fs=require('node:fs'),path=require('node:path');
const root=__dirname,read=name=>fs.readFileSync(path.join(root,name),'utf8');
const assets=JSON.parse(read('asset-manifest.json'));
const safe=text=>text.replace(/<\/script/gi,'<\\/script');
const shared=['external-onboarding-bootstrap.js','onboarding-v2-data.js','onboarding-document-schema.js','onboarding-v2.js','br-integration.js','onboarding-document-feedback.js','multi-document-workflow.js','external-onboarding-shell.js'].map(read).join('\n');
const source=read('external.js');
const entry="document.addEventListener('input',e=>{const t=e.target;";
if(!source.includes(entry))throw Error('Missing External extension entry');
const html=read('external.template.html')
 .replace('/* BUNDLE_CSS */',()=>['external.css','onboarding-v2.css','br-integration.css','document-feedback.css','external-onboarding.css'].map(read).join('\n'))
 .replace('/* BUNDLE_ASSETS */',()=>safe('const ASSETS='+JSON.stringify(assets)+';'))
 .replace('/* BUNDLE_JS */',()=>safe(source.replace(entry,()=>shared+'\n'+entry)));
fs.writeFileSync(path.join(root,'external.html'),html);
console.log('Built standalone external.html:',Buffer.byteLength(html),'bytes');

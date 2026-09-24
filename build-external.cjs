// Build only the external demo from its checked-in sources and asset manifest.
// Do not import untracked artwork or rebuild the independent backoffice.
const fs=require('node:fs'),path=require('node:path');
const root=__dirname,read=name=>fs.readFileSync(path.join(root,name),'utf8');
const assets=JSON.parse(read('asset-manifest.json'));
const safe=text=>text.replace(/<\/script/gi,'<\\/script');
const html=read('external.template.html')
 .replace('/* BUNDLE_CSS */',()=>read('external.css'))
 .replace('/* BUNDLE_ASSETS */',()=>safe('const ASSETS='+JSON.stringify(assets)+';'))
 .replace('/* BUNDLE_JS */',()=>safe(read('external.js')));
fs.writeFileSync(path.join(root,'external.html'),html);
console.log('Built standalone external.html:',Buffer.byteLength(html),'bytes');

// Reproducible standalone HTML bundle; embeds CSS, JavaScript and exact Figma assets.
const fs=require('node:fs'),path=require('node:path');
const root=__dirname,read=n=>fs.readFileSync(path.join(root,n),'utf8');
const assets=fs.existsSync(path.join(root,'asset-manifest.json'))?JSON.parse(read('asset-manifest.json')):{};if(fs.existsSync(path.join(root,'assets')))for(const f of fs.readdirSync(path.join(root,'assets'))){const ext=path.extname(f).slice(1);assets[f]='data:'+({png:'image/png',svg:'image/svg+xml',jpg:'image/jpeg'}[ext]||'application/octet-stream')+';base64,'+fs.readFileSync(path.join(root,'assets',f)).toString('base64');}fs.writeFileSync(path.join(root,'asset-manifest.json'),JSON.stringify(assets));
const out=read('external.template.html').replace('/* BUNDLE_CSS */',()=>read('external.css')).replace('/* BUNDLE_ASSETS */',()=>`const ASSETS=${JSON.stringify(assets)};`).replace('/* BUNDLE_JS */',()=>read('external.js').replace(/<\/script/gi,'<\\/script'));
fs.writeFileSync(path.join(root,'external.html'),out);console.log('external.html',Buffer.byteLength(out),'bytes; standalone / offline ready');
require('./build-admin.cjs');

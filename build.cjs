// Reproducible standalone HTML bundle; embeds CSS, JavaScript and exact Figma assets.
const fs=require('node:fs'),path=require('node:path');
const root=__dirname,read=n=>fs.readFileSync(path.join(root,n),'utf8');
const assets=fs.existsSync(path.join(root,'asset-manifest.json'))?JSON.parse(read('asset-manifest.json')):{};if(fs.existsSync(path.join(root,'assets')))for(const f of fs.readdirSync(path.join(root,'assets'))){const ext=path.extname(f).slice(1);assets[f]='data:'+({png:'image/png',svg:'image/svg+xml',jpg:'image/jpeg'}[ext]||'application/octet-stream')+';base64,'+fs.readFileSync(path.join(root,'assets',f)).toString('base64');}fs.writeFileSync(path.join(root,'asset-manifest.json'),JSON.stringify(assets));
const out=read('external.template.html').replace('/* BUNDLE_CSS */',()=>read('external.css')).replace('/* BUNDLE_ASSETS */',()=>`const ASSETS=${JSON.stringify(assets)};`).replace('/* BUNDLE_JS */',()=>read('external.js').replace(/<\/script/gi,'<\\/script'));
fs.writeFileSync(path.join(root,'external.html'),out);console.log('external.html',Buffer.byteLength(out),'bytes; standalone / offline ready');
const core=read('core.js'),extension=read('backoffice-extension.js');
if(!/render\(\);\s*\}\)\(\);\s*$/.test(core))throw new Error('Core entry point not found');
const app=core.replace(/render\(\);\s*\}\)\(\);\s*$/,()=>extension+'\nrender();\n})();\n');
fs.writeFileSync(path.join(root,'app.js'),app);
let packed=app;for(const name of fs.readdirSync(root).filter(n=>/\.(png|svg)$/.test(n))){const mime=name.endsWith('.png')?'image/png':'image/svg+xml',url='data:'+mime+';base64,'+fs.readFileSync(path.join(root,name)).toString('base64');packed=packed.split(name).join(url);}
const standalone=read('index.html').replace('<link rel="stylesheet" href="styles.css">',()=>'<style>'+read('styles.css')+'</style>').replace('<link rel="stylesheet" href="backoffice.css">',()=>'<style>'+read('backoffice.css')+'</style>').replace('<script defer src="data.js"></script>','').replace('<script defer src="app.js"></script>','').replace('</body>',()=>'<script>'+read('data.js').replace(/<\/script/gi,'<\\/script')+'</script><script>'+packed.replace(/<\/script/gi,'<\\/script')+'</script></body>');
fs.writeFileSync(path.join(root,'backoffice.html'),standalone);console.log('backoffice.html',Buffer.byteLength(standalone),'bytes; standalone / offline ready');

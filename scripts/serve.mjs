import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),port=Number(process.env.PORT||4321);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.wasm':'application/wasm','.gz':'application/gzip','.png':'image/png','.jpg':'image/jpeg','.pdf':'application/pdf','.svg':'image/svg+xml','.bcmap':'application/octet-stream','.ttf':'font/ttf','.woff2':'font/woff2'};
http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
 if(!['127.0.0.1','localhost','[::1]'].includes((req.headers.host||'').replace(/:\d+$/,''))){res.writeHead(403);return res.end();}
 try{const decoded=decodeURIComponent(new URL(req.url,'http://localhost').pathname),name=decoded==='/'?'index.html':decoded.slice(1);if(name.includes('..')||name.includes('\\')||name.includes('\0')||!( /^(br-engine|vendor|fixtures)\/[\w./-]+$/.test(name)||/^[\w-]+\.(html|js|css|png|svg|txt)$/.test(name)))throw Error();const data=await readFile(path.join(root,name));res.writeHead(200,{'Content-Type':mime[path.extname(name)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:data);}catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`AllinPay backoffice: http://127.0.0.1:${port}/backoffice.html`));

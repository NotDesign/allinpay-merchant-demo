import {cp,mkdir,readdir,writeFile,rm,readFile,rename} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),out=new URL('_pages/',root);
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
const files=['index.html','backoffice.html','external.html','app.js','data.js','styles.css','backoffice.css','current-backoffice.css','onboarding-v2.css','br-integration.css','internal-review.css','document-feedback.css','azure-theme.css','robots.txt','THIRD_PARTY_NOTICES.md','DEMO_GUIDE.md','LICENSE-OpenCC.txt','LICENSE-QR-Code.txt'];
for(const f of await readdir(root))if(/\.(svg|png)$/.test(f)&&!f.startsWith('qa-'))files.push(f);
for(const f of files)await cp(new URL(f,root),new URL(f,out));
for(const folder of ['br-engine','fixtures'])await cp(new URL(folder,root),new URL(folder,out),{recursive:true});
// Package exactly the generated runtime manifest, excluding local/cloud duplicate files.
const runtime=JSON.parse(await readFile(new URL('vendor-manifest.json',root),'utf8'));
for(const item of runtime){
 const source=new URL('vendor/'+item.path,root),destination=new URL('vendor/'+item.path,out);
 const data=await readFile(source);
 if(data.length!==item.bytes||createHash('sha256').update(data).digest('hex')!==item.sha256)throw Error('Runtime integrity mismatch: '+item.path);
 await mkdir(new URL('./',destination),{recursive:true});await writeFile(destination,data);
}
await writeFile(new URL('.nojekyll',out),'');
await mkdir(new URL('scripts/',out));await cp(new URL('scripts/serve.mjs',root),new URL('scripts/serve.mjs',out));
const version={version:'2026.10.09-control-spacing-v3',builtAt:new Date().toISOString(),commit:process.env.GITHUB_SHA||'local',brand:'Azure',visibleSteps:7,otp:'simulated',ktc:'photo-capture-demo',ktcCodeRequired:true,mobileCamera:true,biometricVerification:false,crossDeviceCallback:'manual-demo-code',brLocalOCR:true,multiDocumentOCR:true,optionalDocuments:true,fullCertificateNumber:true,unifiedFileDrop:true,batchDocumentAssignment:true,excelColumnFreeze:true,nullableMidStates:true};
await writeFile(new URL('version.json',out),JSON.stringify(version,null,2));
const zipName='azure-merchant-demo-20261009.zip';
execFileSync('zip',['-X','-q','-r',fileURLToPath(new URL(zipName,root)),'.'],{cwd:fileURLToPath(out)});
await mkdir(new URL('downloads/',out));await rename(new URL(zipName,root),new URL('downloads/'+zipName,out));
console.log(`Prepared Pages artifact with ${files.length} root assets and local OCR runtime.`);

import {cp,mkdir,readFile,writeFile,rename,stat,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const releases=JSON.parse(await readFile(path.join(root,'demo-releases.json'),'utf8'));
const frozen=releases.frozen;
if(!process.argv[2])throw Error('Pass the Pages artifact built from the pinned frozen source commit.');
const source=path.resolve(process.argv[2]);
async function rejectLinks(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    if(entry.isSymbolicLink())throw Error('Symlink is not allowed in a frozen artifact: '+path.join(directory,entry.name));
    if(entry.isDirectory())await rejectLinks(path.join(directory,entry.name));
  }
}
await rejectLinks(source);
const metadata=JSON.parse(await readFile(path.join(source,'version.json'),'utf8'));
if(metadata.commit!==frozen.sourceCommit||metadata.version!==frozen.version)throw Error('Wrong frozen artifact: refusing to publish.');
const destination=path.join(root,'_pages',frozen.directory);
if(await stat(destination).catch(()=>null))throw Error('Frozen destination already exists: refusing to overwrite. Rebuild the main artifact first.');
await mkdir(path.dirname(destination),{recursive:true});
await cp(source,destination,{recursive:true,filter:entry=>path.relative(source,entry).split(path.sep)[0]!=='downloads'});
// Preserve the pinned UI and behavior. Only relocate absolute sibling links so
// invitations and login links cannot accidentally open the restored main Demo.
const base='https://notdesign.github.io/allinpay-merchant-demo/';
const archiveBase=base+frozen.directory+'/';
const relocated=[];
for(const filename of ['app.js','backoffice.html','external.html','DEMO_GUIDE.md']){
  const target=path.join(destination,filename);
  const before=await readFile(target,'utf8');
  const after=before.replaceAll(base,archiveBase);
  if(after!==before){await writeFile(target,after);relocated.push(filename);}
}
await writeFile(path.join(destination,'archive.json'),JSON.stringify({
  frozen:true,version:frozen.version,sourceCommit:frozen.sourceCommit,
  sourceBranch:frozen.branch,relocatedLinks:relocated,
  note:'Only absolute links are relocated for the archive subdirectory. The pinned design and Demo flows are unchanged. Browser-local Demo data is not archived or deleted.'
},null,2));
const zipTemporary=path.join(root,'_pages',frozen.zip);
execFileSync('zip',['-X','-q','-r',zipTemporary,'.'],{cwd:destination});
await mkdir(path.join(destination,'downloads'));
await rename(zipTemporary,path.join(destination,'downloads',frozen.zip));
console.log('Frozen release appended:',frozen.version,frozen.sourceCommit);

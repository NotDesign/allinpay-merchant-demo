import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'_pages');
const releases=JSON.parse(await readFile(path.join(root,'demo-releases.json'),'utf8'));
const hashes={
  main:{'app.js':'913b43068106716070b9c882cd67e859fc02f9aa3fb4976f4ba360ef2ed0d50b','backoffice.html':'43757b95ecf6e6aeecc0c523a03173ea873be98382896dff80e3d342508eac31','external.html':'454313778949d0df62d5922b9a45fe101cd6c96f69e9e294a7d7b53fa0102860'},
  frozen:{'app.js':'5abe1d561290c963c317437220822fb22b48d183eb841d77a0be094a320bfc20','backoffice.html':'d7ab07e511034cd5dd8cb8576b1bc88acc04886574e48975bd84c379e74cfbc5','external.html':'be2ee036bc5b45f667b7d98375bce4aa28d43bb564a42840c086d058073d46d9','azure-theme.css':'93e50d9adb2b5300965e9b189e6948b8a4bc15cf81cf17c35082a35d9f3153e2'}
};
const base='https://notdesign.github.io/allinpay-merchant-demo/';
for(const [kind,expected] of Object.entries(hashes)){
  const directory=kind==='main'?out:path.join(out,releases.frozen.directory);
  const version=JSON.parse(await readFile(path.join(directory,'version.json'),'utf8'));
  assert.equal(version.version,releases[kind==='main'?'active':'frozen'].version);
  assert.equal(kind==='main'?version.sourceCommit:version.commit,releases[kind==='main'?'active':'frozen'].sourceCommit);
  for(const [filename,hash] of Object.entries(expected)){
    let contents=await readFile(path.join(directory,filename),'utf8');
    if(kind==='frozen')contents=contents.replaceAll(base+releases.frozen.directory+'/',base);
    assert.equal(createHash('sha256').update(contents).digest('hex'),hash,kind+': source fidelity '+filename);
  }
  const zip=path.join(directory,'downloads',releases[kind==='main'?'active':'frozen'].zip);
  execFileSync('unzip',['-tq',zip],{stdio:'pipe'});
  const names=execFileSync('unzip',['-Z1',zip],{encoding:'utf8'}).trim().split('\n');
  assert(!names.some(n=>n.startsWith('/')||n.split('/').includes('..')||/^downloads\//.test(n)||/^\.git\//.test(n)),'Safe standalone ZIP paths');
  for(const filename of [...Object.keys(expected),'version.json']){
    assert.deepEqual(execFileSync('unzip',['-p',zip,filename],{maxBuffer:20*1024*1024}),await readFile(path.join(directory,filename)),kind+': ZIP matches website '+filename);
  }
}
console.log('PASS: September 29 source fidelity; immutable October 9 source fidelity (routing-only relocation); both standalone ZIPs match their website.');

import { cp, mkdir, readdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const source = p => new URL(`node_modules/${p}`, root);
const target = p => new URL(`vendor/${p}`, root);
await rm(target(''),{recursive:true,force:true});
await mkdir(target(''), { recursive: true });
await cp(source('tesseract.js/dist'), target('tesseract'), { recursive: true });
await cp(source('tesseract.js-core'), target('core'), { recursive: true });
await mkdir(target('lang'), { recursive: true });
for (const lang of ['eng', 'chi_tra']) await copyFile(source(`@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`), target(`lang/${lang}.traineddata.gz`));
for (const lang of ['eng','chi_tra']) { for (const f of ['README.md','package.json']) await copyFile(source(`@tesseract.js-data/${lang}/${f}`), target(`lang/${lang}.${f}`)); }
for (const folder of ['build','cmaps','standard_fonts','wasm']) await cp(source(`pdfjs-dist/${folder}`), target(`pdfjs/${folder}`), { recursive: true });
for (const pkg of ['pdfjs-dist', 'tesseract.js']) await copyFile(source(`${pkg}/${pkg === 'tesseract.js' ? 'LICENSE.md' : 'LICENSE'}`), target(`${pkg}.LICENSE`));
const manifest = [];
async function walk(dir, prefix='') { for (const entry of await readdir(dir, { withFileTypes: true })) {
  const relative = prefix + entry.name;
  if (entry.isDirectory()) await walk(new URL(`${entry.name}/`, dir), relative+'/');
  else { const data = await readFile(new URL(entry.name, dir)); manifest.push({path:relative,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')}); }
} }
await walk(target(''));
await writeFile(new URL('vendor-manifest.json', root), JSON.stringify(manifest,null,2));
console.log(`Prepared ${manifest.length} local OCR/PDF assets. No CDN is required at runtime.`);

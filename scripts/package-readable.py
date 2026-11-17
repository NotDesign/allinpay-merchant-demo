#!/usr/bin/env python3
"""Package only this materialized readable edition; never scan private workspace assets."""
from pathlib import Path
import argparse,hashlib,json,zipfile,subprocess,stat
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--output',type=Path,default=ROOT.parent/'meepay-readable-output')
parser.add_argument('--commit',default='local-unpublished')
a=parser.parse_args();out=a.output.resolve();out.mkdir(parents=True,exist_ok=True)
if out==ROOT or ROOT in out.parents:raise SystemExit('Output must be outside source checkout')
# Explicit inventory: checked-in source plus the dedicated assets decoded from the public manifest.
ignored={'node_modules','vendor','.git','dist','outputs','downloads','versions'}
def source_files():
 for f in sorted(ROOT.rglob('*')):
  rel=f.relative_to(ROOT)
  if any(x in ignored for x in rel.parts) or not f.is_file():continue
  if f.is_symlink():raise SystemExit(f'Symlink rejected: {rel}')
  if f.name=='vendor-manifest.json' or f.name.startswith('qa-') or f.suffix in {'.zip','.log','.pyc'} or '__pycache__' in rel.parts:continue
  yield f,rel.as_posix()
sources=list(source_files());assert (ROOT/'vendor-manifest.json').exists() and (ROOT/'vendor').is_dir(),'Run npm run setup first'
expected={'qa-developer-report.json','qa-products-catalog-report.json','qa-products-contract-report.json','qa-bank-autofill-report.json','qa-searchable-selects-report.json','qa-mcc-reference-report.json','qa-session-timeout-report.json'}
qa=[f for f in sorted(ROOT.glob('qa-*.json')) if f.name in expected and json.loads(f.read_text()).get('passed') is True]
assert expected.issubset({f.name for f in qa}),f'Missing passing reports: {expected-{f.name for f in qa}}'
entries={};add=lambda name,data:entries.__setitem__(name,data)
for f,rel in sources:add('source/'+rel,f.read_bytes())
# Runtime excludes builders and tests but keeps HTML, readable JS, CSS, logos and schemas.
for f,rel in sources:
 if '/' not in rel and (f.suffix in {'.html','.css','.js','.png','.svg'} or rel=='vendor-manifest.json'):
  if not rel.startswith('verify-'):add('demo/'+rel,f.read_bytes())
 elif rel.startswith(('assets/','br-engine/','fixtures/','import-templates/','references/')):add('demo/'+rel,f.read_bytes())
add('demo/vendor-manifest.json',(ROOT/'vendor-manifest.json').read_bytes())
for f in sorted((ROOT/'vendor').rglob('*')):
 if f.is_file() and not f.is_symlink():add('demo/'+f.relative_to(ROOT).as_posix(),f.read_bytes())
for f in qa:add('qa/'+f.name,f.read_bytes())
for f in ROOT.glob('qa-developer-*.png'):add('qa/'+f.name,f.read_bytes())
add('README.txt',('''Mee Pay — 兩商戶可讀開發版 / 2026-11-17 v1.12

source/ = 可編輯分檔原始碼，先讀 source/README.md。
demo/ = 已準備本機 OCR/PDF/Excel 依賴的可執行 Demo。
qa/ = 本次通過的檢查報告及畫面。

Mac: 開啟 start-demo.command 後，用瀏覽器開啟：
http://127.0.0.1:4321/backoffice.html#/login
http://127.0.0.1:4321/external.html#/login

亦可執行：python3 -m http.server 4321 --bind 127.0.0.1 --directory demo
後台：admin@example.com / Demo1234!
External：demo@example.com / 驗證碼 123456

只有兩間初始示例商戶。原產品、費率、表單、權限 UI 保留。
資料為本機 Demo，後台與 External 沒有正式後端同步。
source/ 不含 node_modules；從 GitHub 下載後請 npm ci --ignore-scripts、npm run setup、npm run dev。
SHA256SUMS.txt 涵蓋其他所有檔案，可用 python3 verify-package.py 檢查。
''').encode())
add('start-demo.command',b'#!/bin/bash\nset -e\ncd "$(dirname "$0")"\nexec python3 -m http.server 4321 --bind 127.0.0.1 --directory demo\n')
add('verify-package.py',b'''from pathlib import Path
import hashlib
root=Path(__file__).resolve().parent
expected={}
for line in (root/'SHA256SUMS.txt').read_text().splitlines():
 digest,name=line.split('  ',1);p=root/name
 assert not p.is_symlink() and p.is_file(),name
 assert hashlib.sha256(p.read_bytes()).hexdigest()==digest,name
 expected[name]=digest
actual={p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() and p.name!='SHA256SUMS.txt'}
assert actual==set(expected), (actual-set(expected),set(expected)-actual)
print('PASS package SHA256 and complete inventory:',len(expected),'files')
''')
manifest={'edition':'2026.11.17-dev2-v1.12','sourceCommit':a.commit,'upstreamApplication':'3c6eb82f933b0e7885bf2a0ab71a17ddb081f4f0','parentHandoff':'423badbdcdc4749f44fcc6dfd54ce5d9383a37b9','merchants':2,'sourceFiles':len(sources),'runtimeFiles':sum(k.startswith('demo/') for k in entries),'verifiedReports':[f.name for f in qa],'files':{k:{'bytes':len(v),'sha256':hashlib.sha256(v).hexdigest()} for k,v in sorted(entries.items())}}
add('package-manifest.json',(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode())
add('SHA256SUMS.txt',''.join(hashlib.sha256(v).hexdigest()+'  '+k+'\n' for k,v in sorted(entries.items())).encode())
def write_zip(dest,items):
 with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  for name,data in sorted(items.items()):
   info=zipfile.ZipInfo(name,(2026,11,17,11,44,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=((stat.S_IFREG|0o755) if name.endswith('.command') else (stat.S_IFREG|0o644))<<16;z.writestr(info,data)
 with zipfile.ZipFile(dest) as z:
  assert z.testzip() is None
  assert len(set(z.namelist()))==len(z.namelist())
  for name in z.namelist():assert not name.startswith('/') and '..' not in Path(name).parts
 return {'file':dest.name,'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
full=write_zip(out/'MeePay-Developer-2Merchants-Readable-20261117-v1.12.zip',entries)
source=write_zip(out/'MeePay-Readable-Source-20261117-v1.12.zip',{rel:f.read_bytes() for f,rel in sources})
(out/'package-receipt.json').write_text(json.dumps({'sourceCommit':a.commit,'packages':[source,full]},indent=2)+'\n')
print(json.dumps({'packages':[source,full],'sourceFiles':len(sources)},indent=2))

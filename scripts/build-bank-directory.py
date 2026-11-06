"""Read official bank/branch and BIC workbooks without modifying the sources."""
import argparse,json,re,hashlib,zipfile,collections,xml.etree.ElementTree as E
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--branches',required=True);p.add_argument('--bics',required=True);p.add_argument('--output',default='bank-directory-data.js');a=p.parse_args()
ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
def sheets(path):
 z=zipfile.ZipFile(path);strings=[''.join(t.itertext()) for t in E.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',ns)];result=[]
 for name in sorted(n for n in z.namelist() if re.fullmatch(r'xl/worksheets/sheet\d+.xml',n)):
  rows=[]
  for row in E.fromstring(z.read(name)).findall('.//m:sheetData/m:row',ns):
   values={}
   for c in row.findall('m:c',ns):
    v=c.find('m:v',ns);s=v.text if v is not None else ''
    if s:values[re.sub(r'\d','',c.get('r'))]=strings[int(s)] if c.get('t')=='s' else s
   if values:rows.append(values)
  result.append(rows)
 return result
old=json.loads(Path('bank-code-data.js').read_text().split(' = ',1)[1].rstrip(';\n'));banks={x['code']:{'code':x['code'],'en':x['en'],'zh':x['zh'],'branches':[],'swift':''} for x in old['banks']}
for r in sheets(a.branches)[1][1:]:
 if r.get('B') in banks and re.fullmatch(r'\d{3}',r.get('D','')):
  branch={'code':r['D'],'name':r.get('C','').strip(),'address':re.sub(r'\s+',' ',r.get('E','')).strip()}
  if branch not in banks[r['B']]['branches']:banks[r['B']]['branches'].append(branch)
for r in sheets(a.bics)[0][1:]:
 if r.get('A') in banks and re.fullmatch(r'[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?',r.get('C','')):
  if banks[r['A']]['swift'] and banks[r['A']]['swift']!=r['C']:raise ValueError('Ambiguous BIC '+r['A'])
  banks[r['A']]['swift']=r['C']
for bank in banks.values():bank['branches'].sort(key=lambda x:x['code'])
data={'verifiedAt':'2026-11-06','branchDate':'2026-11-02','bicDate':'2026-07-10','branchSource':'https://fps.hkicl.com.hk/eng/information_centre/clearing_code_and_branch_code_list.php','bicSource':'https://www.hkicl.com.hk/eng/information_centre/list_of_live_and_t%26t_bics_of_members.php','branchSha256':hashlib.sha256(Path(a.branches).read_bytes()).hexdigest(),'bicSha256':hashlib.sha256(Path(a.bics).read_bytes()).hexdigest(),'banks':list(banks.values())}
Path(a.output).write_text('// Bank identity, branch address and member BIC facts kept separately.\nconst BANK_DIRECTORY_DATA = '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n')
print(json.dumps({'banks':len(banks),'branches':sum(len(x['branches']) for x in banks.values()),'bics':sum(bool(x['swift']) for x in banks.values())}))

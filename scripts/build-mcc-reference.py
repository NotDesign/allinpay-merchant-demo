"""Build the active MCC directory from the client CSV, preserving source identifiers."""
import argparse,csv,hashlib,json,re
from pathlib import Path
parser=argparse.ArgumentParser()
parser.add_argument('--csv',default=str(Path(__file__).resolve().parents[1]/'references/mcc_list.csv'))
parser.add_argument('--output',default=str(Path(__file__).resolve().parents[1]/'mcc-reference-data.js'))
args=parser.parse_args();source=Path(args.csv);rows=list(csv.DictReader(source.open(encoding='utf-8-sig',newline='')))
if set(rows[0])!={'code','key','en','zh'}:raise ValueError('Expected code/key/en/zh columns')
entries=[];seen=set()
for row in rows:
 if not re.fullmatch(r'\d{4}',row['code']) or row['code'] in seen or not all(row.values()):raise ValueError('Invalid or duplicate MCC: '+row['code'])
 seen.add(row['code']);entry=dict(row)
 if row['code'] in ['7800','7801','7802']:entry['countries']=['USA']
 if row['code']=='9406':entry['excludedCountries']=['USA']
 entries.append(entry)
data={'source':'client-provided','title':'客戶 MCC 對照表','sourceFile':'mcc_list.csv','edition':'client-provided-2026-11-06','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'entries':sorted(entries,key=lambda x:x['code'])}
Path(args.output).write_text('// Active code, key and bilingual names from the client CSV; no risk weights.\nconst MCC_REFERENCE_DATA = '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n')
print(json.dumps({'count':len(entries),'sourceSha256':data['sourceSha256']}))

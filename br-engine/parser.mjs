// Deterministic Hong Kong BR extraction. Candidates always require human review.
export const FIELD_DEFS = [
  {key:'businessNameZh',label:'業務／法團名稱（中文）',target:'merchantName'},
  {key:'businessNameEn',label:'業務／法團名稱（英文）',target:'merchantEnglishName'},
  {key:'brNumber',label:'BR 號碼及分支碼',target:'registerCertNo'},
  {key:'certificateNumber',label:'證書完整編號',target:null},
  {key:'businessAddressZh',label:'業務地址（中文原文）',target:'addrStreet'},
  {key:'businessAddressEn',label:'業務地址（英文原文）',target:'addrStreetEn'},
  {key:'natureOfBusiness',label:'業務性質',target:'merchantProfile'},
  {key:'legalStatus',label:'法律地位',target:'legalStatus'},
  {key:'startDate',label:'本張 BR 生效日期',target:null},
  {key:'expiryDate',label:'BR 屆滿日期',target:'registerCertPeriod'},
];
const han = /[\u3400-\u9fff]/;
const normalize = text => text.normalize('NFKC').replace(/[‐‑–—−]/g,'-').replace(/[ \t]+/g,' ').trim();
const labels = [
 ['name', /(?:業務\s*[\/／]?\s*法團所用名稱|業務名稱|法團名稱|Name\s+of\s+Business\s*[\/／]?\s*(?:Corporation)?|Corporation(?:\s+Name)?)/i],
 ['branch', /(?:業務\s*[\/／]\s*分行名稱|^Business\s*[\/／]\s*(?:Branch\s*Name)?|Branch\s*Name)/i],
 ['address', /(?:地\s*址|(?:Business\s+)?Address)/i],
 ['nature', /(?:業務性質|Nature\s+of\s+Business)/i],
 ['status', /(?:法律地位|(?:Legal\s+)?Status)/i],
 ['start', /(?:生效日期|Date\s+of\s+Commencement)/i],
 ['expiry', /(?:屆滿日期|Date\s+of\s+Expiry|Expiry\s+Date)/i],
 ['cert', /(?:登記證號碼|Certificate\s*(?:No\.?|Number)|Business\s+Registration\s*(?:No\.?|Number))/i],
 ['fees', /(?:登記費及徵費|Fee\s+and\s+Levy)/i],
];
function clean(value) {return normalize(value).replace(/^[:：\s|]+|[|\s]+$/g,'').replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff0-9])/g,'$1').replace(/([0-9])\s+(?=[\u3400-\u9fff])/g,'$1');}
export function parseDate(value) {
 const v=normalize(value);let y,m,d;
 let match=v.match(/\b(20\d{2}|19\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
 if(match) [,y,m,d]=match;
 else {match=v.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|19\d{2})\b/); if(match) [,d,m,y]=match;
 else {match=v.match(/(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日/);if(match)[,y,m,d]=match;}}
 if(!y)return '';
 const date=new Date(Date.UTC(+y,+m-1,+d));
 if(date.getUTCFullYear()!==+y||date.getUTCMonth()!==+m-1||date.getUTCDate()!==+d)return '';
 return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
const dateRE=/(?:\b(?:19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b|\b\d{1,2}[-/.]\d{1,2}[-/.](?:19|20)\d{2}\b|20\d{2}年\s*\d{1,2}月\s*\d{1,2}日)/g;
export function parseBR(text,{method='ocr',page=1,today=new Date().toISOString().slice(0,10)}={}) {
 const rawText=String(text||'');const lines=rawText.split(/\r?\n/).map(clean).filter(Boolean);
 const fields=Object.fromEntries(FIELD_DEFS.map(f=>[f.key,{value:'',source:'',method,page,reviewRequired:true}]));
 const warnings=[];
 function set(key,value,source) {value=clean(value);if(value)fields[key]={...fields[key],value,source};}
 const sections={};let current=null;
 for(const line of lines) {
  if(/^(?:PLEASE PRODUCE|WILL ONLY BECOME|RECEIVED FEE|IRDB|IRDT)/i.test(line)){current=null;continue;}
  const matches=labels.map(([key,re])=>({key,match:re.exec(line)})).filter(x=>x.match).sort((a,b)=>a.match.index-b.match.index);
  if(matches.length>1) {current=null;continue;} // Column headers are handled separately below.
  if(matches.length) {const {key,match}=matches[0];current=key;sections[key]??=[];
    const before=line.slice(0,match.index).trim();const after=clean(line.slice(match.index+match[0].length));
    // A bilingual label can precede the value; discard the Chinese label, not the value.
    if(after&&!/^[*＊\-_/\s:：]+$/.test(after))sections[key].push({value:after,source:line});
    if(before&&key==='name'&&!/業務|法團/.test(before))sections[key].push({value:before,source:line});
  } else if(current && !/^(?:請注意|Please note|SEE OVERLEAF|IRDB|IRDT|第\s*\d|根據|本證)/i.test(line)) {
    if(!/^[*＊\-_/\s:：]+$/.test(line))sections[current].push({value:line,source:line});
  } else current=null;
 }
 const join=(items,filter)=>items.filter(x=>filter(x.value)).map(x=>x.value).join(' ');
 const evidence=items=>items.map(x=>x.source).join('\n');
 const names=(sections.name||[]).filter(x=>!/^(?:SPECIMEN|SAMPLE|TEST DOCUMENT|測試文件)\s*$/i.test(x.value));
 set('businessNameZh',join(names,v=>han.test(v)),evidence(names));
 set('businessNameEn',join(names,v=>/[a-z]/i.test(v)&&!han.test(v)),evidence(names));
 const address=(sections.address||[]).filter(x=>!/^(?:SPECIMEN|SAMPLE)\s*$/i.test(x.value));
 set('businessAddressZh',join(address,v=>han.test(v)),evidence(address));
 set('businessAddressEn',join(address,v=>!han.test(v)),evidence(address));
 const nature=(sections.nature||[]).filter(x=>!/SPECIMEN/i.test(x.value));
 set('natureOfBusiness',join(nature,()=>true),evidence(nature));
 const status=(sections.status||[]).map(x=>x.value).join(' ');
 for(const [re,value] of [[/BODY\s*CORPORATE|法人團體/i,'法人團體 · Body Corporate'],[/INDIVIDUAL|個人/i,'個人 · Individual'],[/PARTNERSHIP|合夥/i,'合夥 · Partnership'],[/UNINCORPORATED\s*BODY|非屬法團/i,'非屬法團 · Unincorporated Body']]) if(re.test(status)){set('legalStatus',value,evidence(sections.status));break;}
 // Require the printed branch code. Never guess -000 or correct O/0 automatically.
 const certs=[...rawText.normalize('NFKC').replace(/[‐‑–—−]/g,'-').matchAll(/(?<![\dA-Z])(\d{8})\s*-\s*(\d{3})(?:\s*-\s*(\d{2})\s*-\s*(\d{2})\s*-\s*([A-Z]))?(?!\d)/gi)];
 const unique=[...new Set(certs.map(m=>m[1]+'-'+m[2]))];
 if(unique.length===1){const m=certs[0];set('brNumber',unique[0],m[0]);set('certificateNumber',[m[1],m[2],m[3],m[4],m[5]].filter(Boolean).join('-'),m[0]);}
 else if(unique.length>1)warnings.push('同頁出現不同 BR 號碼，請手動確認；系統沒有自動選取。');
 // Single-column label/value dates.
 for(const [section,key] of [['start','startDate'],['expiry','expiryDate']]){
  const items=sections[section]||[];const dates=items.flatMap(x=>(x.value.match(dateRE)||[]).map(v=>({date:parseDate(v),source:x.source}))).filter(x=>x.date);
  if(dates.length===1)set(key,dates[0].date,dates[0].source);
 }
 // Standard BR has two date headings over one row. Only use the adjacent pair after both headings.
 for(let i=0;i<lines.length;i++) {
  if(!labels.find(x=>x[0]==='start')[1].test(lines[i]))continue;
  const header=lines.slice(i,i+4).join(' ');
  if(!labels.find(x=>x[0]==='expiry')[1].test(header))continue;
  for(const line of lines.slice(i,i+7)){
   const matches=(line.match(dateRE)||[]).map(parseDate).filter(Boolean);
   if(matches.length===2){set('startDate',matches[0],line);set('expiryDate',matches[1],line);break;}
  }
 }
 const compact=rawText.replace(/\s/g,'');
 const isBR=/Business\s*[\/X]*\s*(?:Branch\s*)?Registration\s+Certificate/i.test(rawText)||/商業.{0,8}登記證/.test(compact);
 for(const [key,f] of Object.entries(fields))if(f.value.length>(/Address/.test(key)?250:/Name|nature/.test(key)?160:100)){f.value='';warnings.push('一個欄位超出合理長度，已留空供核對。');}
 const fieldCount=Object.values(fields).filter(f=>f.value).length;
 const identityCount=['businessNameEn','businessNameZh','brNumber','businessAddressEn','businessAddressZh'].filter(k=>fields[k].value).length;
 const recognized=isBR&&identityCount>=2;
 if(!recognized)warnings.push('未能可靠確認為 BR；請核對文件種類或改用手動填寫。');
 if(!fields.brNumber.value)warnings.push('未能辨識完整 BR 號碼及分支碼，不會補出缺少的數字。');
 if(fields.expiryDate.value&&fields.expiryDate.value<today)warnings.push('這張 BR 的屆滿日期已過，請確認是否有更新版本。');
 if(fields.startDate.value&&fields.expiryDate.value&&fields.startDate.value>fields.expiryDate.value){warnings.push('生效日期晚於屆滿日期，請對照原件修正。');fields.startDate.reviewRequired=true;fields.expiryDate.reviewRequired=true;}
 if(/SPECIMEN|SAMPLE|TEST DOCUMENT|測試文件/i.test(rawText))warnings.push('這是標示為樣本／測試用途的文件。');
 return {fields,rawText,method,page,recognized,warnings,fieldCount,score:(isBR?10:0)+identityCount*3+fieldCount};
}
export function validateFields(fields) {
 const errors={};const get=k=>String(fields[k]?.value||'').trim();
 if(get('brNumber')&&!/^\d{8}-\d{3}$/.test(get('brNumber')))errors.brNumber='請輸入 8 位號碼及 3 位分支碼，例如 12345678-000。';
 for(const k of ['startDate','expiryDate'])if(get(k)&&!/^\d{4}-\d{2}-\d{2}$/.test(get(k)))errors[k]='請使用 YYYY-MM-DD。';else if(get(k)&&parseDate(get(k))!==get(k))errors[k]='日期不存在。';
 if(get('startDate')&&get('expiryDate')&&get('startDate')>get('expiryDate'))errors.expiryDate='屆滿日期不可早於生效日期。';
 return errors;
}
export function toApplication(fields,selected) {
 const output={};for(const f of FIELD_DEFS) if(f.target&&selected.has(f.key)&&fields[f.key]?.value)output[f.target]=fields[f.key].value;
 if(selected.has('businessNameEn')&&fields.businessNameEn?.value)output.registerCertName=fields.businessNameEn.value;
 if(selected.has('brNumber')&&fields.brNumber?.value)output.registerCertType='01 營業執照／BR';
 return output;
}

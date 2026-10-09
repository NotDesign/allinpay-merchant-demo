import {parseBR} from './parser.mjs?v=20260929-uploads';
export function candidatesFromBR(br){
 const result=[];
 if(!br.recognized)return result;
 for(const [source,key,step]of [['businessNameZh','merchantName',2],['businessNameEn','merchantEnglishName',2],['certificateNumber','registerCertNo',2],['expiryDate','registerCertPeriod',2],['legalStatus','legalStatus',2],['businessAddressZh','addrStreet',3],['businessAddressEn','addrStreetEn',3],['natureOfBusiness','remark',3]]){
  const field=br.fields[source],value=field?.value;if(!value)continue;
  result.push({key,value,step,confidence:field.confidence??null,autoSelect:field.autoSelect!==false});
  if(source==='businessNameEn')result.push({key:'registerCertName',value,step,autoSelect:field.autoSelect!==false});
  if(source==='certificateNumber')result.push({key:'registerCertType',value:'01',step,autoSelect:field.autoSelect!==false});
 }
 return result;
}
// Classify by document headings, never by a customer's filename or known data.
// Identity roles, photos and generic address proofs remain for user assignment.
export function classifyDocument(text,{brRecognized=false}={}) {
 const raw=String(text||'').normalize('NFKC');
 const rules=[
  ['140101',/Business\s*(?:\/\s*Branch\s*)?Registration\s+Certificate|商業.{0,5}登記證/i],
  ['140201',/Certificate\s+of\s+Incorporation|公司註冊證書/i],
  ['140301',/Company\s+Search\s+Report|公司(?:註冊登記)?查冊/i],
  ['141101',/Annual\s+Return|\bNAR1\b|\bNNC1\b|周年申報表/i],
  ['140401',/Bank\s+Statement|銀行月結單|銀行結單/i],
  ['140701',/Payment\s+Services?\s+Agreement|支付服務合作協議/i],
  ['141401',/Lease\s+Agreement|Tenancy\s+Agreement|租賃協議|租約/i],
  ['141601',/Customer\s+Terms\s+and\s+Conditions|商戶與消費者.*條款/i],
  ['141201',/PCI\s+DSS.{0,20}(?:Certificate|Compliance)|PCI\s+DSS\s*證書/i],
  ['141701',/Annual\s+Financial\s+Report|年度財務報告/i],
 ];
 const matches=rules.filter(([,r])=>r.test(raw)).map(([id])=>id);
 if(brRecognized&&!matches.includes('140101'))matches.push('140101');
 if(matches.includes('140401')&&/Three[- ]month\s+Bank\s+Statements|近三個月銀行月結單/i.test(raw))matches.splice(matches.indexOf('140401'),1,'141301');
 const ids=[...new Set(matches)];
 return {id:ids.length===1?ids[0]:'',ambiguous:ids.length>1,reason:ids.length===1?'按文件內文標題判斷':ids.length>1?'文件包含多種標題，請選擇對應位置':'無法確定文件種類或持有人角色，請選擇對應位置'};
}
// Conservative label-based extraction. No value is inferred from a file name.
export function extractCandidates(text,type='AUTO') {
  const result=[];
  const add=(key,value,step=2)=>{if(value?.trim()&&!result.some(x=>x.key===key&&x.value===value.trim()))result.push({key,value:value.trim(),step});};
  const raw=String(text||'');
  if(type==='BR'||type==='AUTO') {
    const br=parseBR(raw,{method:'document-text',page:1});
    if(br.recognized) for(const [source,key,step] of [['businessNameZh','merchantName',2],['businessNameEn','merchantEnglishName',2],['certificateNumber','registerCertNo',2],['expiryDate','registerCertPeriod',2],['legalStatus','legalStatus',2],['businessAddressZh','addrStreet',3],['businessAddressEn','addrStreetEn',3],['natureOfBusiness','remark',3]]) {
      const value=br.fields[source]?.value;add(key,value,step);
      if(source==='businessNameEn')add('registerCertName',value);
      if(source==='certificateNumber'&&value)add('registerCertType','01');
    }
  }
  const lines=raw.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const types={CI:/CERTIFICATE OF INCORPORATION|公司註冊證書/i,NAR1:/ANNUAL RETURN|NAR1|NNC1|周年申報/i,ID:/IDENTITY CARD|身份證|身分證/i,BANK:/BANK STATEMENT|銀行月結單|銀行結單/i};
  const permits=t=>type===t||(type==='AUTO'&&types[t].test(raw));
  function labelled(pattern){for(let i=0;i<lines.length;i++){const m=lines[i].match(pattern);if(m)return(m[1]||lines[i+1]||'').trim();}return '';}
  if(permits('CI'))add('crCode',labelled(/^(?:Company (?:Registration )?Number|Certificate No\.?|公司註冊編號)\s*[:：#]\s*(.*)$/i).replace(/\s/g,''));
  if(permits('NAR1'))add('directors[0].name',labelled(/^(?:Director Name|董事姓名)\s*[:：]\s*(.*)$/i));
  // A plain identity card does not establish a company role. Never infer director.
  if(permits('ID')&&/Director(?:['’]s)?\s+Identity|董事身[份分]證/i.test(raw)){
    add('directors[0].name',labelled(/^(?:Name|姓名)\s*[:：]\s*(.*)$/i));
    const id=labelled(/^(?:Identity Card (?:No\.?|Number)|身份證號碼|身分證號碼)\s*[:：]\s*(.*)$/i);
    if(/^[A-Z]{1,2}\d{6}\([0-9A]\)$/i.test(id.replace(/\s/g,'')))add('directors[0].idcardNo',id.replace(/\s/g,''));
    const birth=labelled(/^(?:Date of Birth|出生日期)\s*[:：]\s*(.*)$/i).replaceAll('/','-');
    if(/^\d{4}-\d{2}-\d{2}$/.test(birth))add('directors[0].birthDay',birth);
  }
  if(permits('BANK')){
    add('cardName',labelled(/^(?:Account (?:Name|Holder)|戶名|賬戶名稱|帳戶名稱)\s*[:：]\s*(.*)$/i),4);
    const account=labelled(/^(?:Account (?:No\.?|Number)|帳戶號碼|賬戶號碼|銀行帳號)\s*[:：]\s*(.*)$/i);
    if(/^[\d -]{6,34}$/.test(account))add('cardNo',account,4);
    const code=labelled(/^(?:Bank Code|銀行代碼|銀行編號)\s*[:：]\s*(.*)$/i);
    if(/^\d{3}$/.test(code))add('cardBankCode',code,4);
  }
  return result;
}

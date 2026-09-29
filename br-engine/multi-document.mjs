import {parseBR} from './parser.mjs';
// Conservative label-based extraction. No value is inferred from a file name.
export function extractCandidates(text,type='AUTO') {
  const result=[];
  const add=(key,value,step=2)=>{if(value?.trim()&&!result.some(x=>x.key===key&&x.value===value.trim()))result.push({key,value:value.trim(),step});};
  const raw=String(text||'');
  if(type==='BR'||type==='AUTO') {
    const br=parseBR(raw,{method:'document-text',page:1});
    if(br.recognized) for(const [source,key,step] of [['businessNameZh','merchantName',2],['businessNameEn','merchantEnglishName',2],['brNumber','registerCertNo',2],['expiryDate','registerCertPeriod',2],['legalStatus','legalStatus',2],['businessAddressZh','addrStreet',3],['businessAddressEn','addrStreetEn',3],['natureOfBusiness','remark',3]]) {
      const value=br.fields[source]?.value;add(key,value,step);
      if(source==='businessNameEn')add('registerCertName',value);
      if(source==='brNumber'&&value)add('registerCertType','01');
    }
  }
  const lines=raw.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const types={CI:/CERTIFICATE OF INCORPORATION|公司註冊證書/i,NAR1:/ANNUAL RETURN|NAR1|NNC1|周年申報/i,ID:/IDENTITY CARD|身份證|身分證/i,BANK:/BANK STATEMENT|銀行月結單|銀行結單/i};
  const permits=t=>type===t||(type==='AUTO'&&types[t].test(raw));
  function labelled(pattern){for(let i=0;i<lines.length;i++){const m=lines[i].match(pattern);if(m)return(m[1]||lines[i+1]||'').trim();}return '';}
  if(permits('CI'))add('crCode',labelled(/^(?:Company (?:Registration )?Number|Certificate No\.?|公司註冊編號)\s*[:：#]\s*(.*)$/i).replace(/\s/g,''));
  if(permits('NAR1'))add('directors[0].name',labelled(/^(?:Director Name|董事姓名)\s*[:：]\s*(.*)$/i));
  if(permits('ID')){
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

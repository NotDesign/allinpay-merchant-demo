import {parseBR,parseDate} from './parser.mjs?v=20261102-samples';
export function candidatesFromBR(br){
 const result=[];
 if(!br.recognized)return result;
 for(const [source,key,step]of [['businessNameZh','merchantName',2],['businessNameEn','merchantEnglishName',2],['certificateNumber','registerCertNo',2],['expiryDate','registerCertPeriod',2],['legalStatus','legalStatus',2],['businessAddressZh','addrStreet',3],['businessAddressEn','addrStreetEn',3],['natureOfBusiness','remark',3]]){
  const field=br.fields[source],value=field?.value;if(!value)continue;
  result.push({key,value,step,confidence:field.confidence??null,autoSelect:field.autoSelect!==false,warning:field.warning});
  if(source==='businessNameEn')result.push({key:'registerCertName',value,step,autoSelect:field.autoSelect!==false});
  if(source==='certificateNumber')result.push({key:'registerCertType',value:'01',step,autoSelect:field.autoSelect!==false});
 }
 return result;
}
// Classify by document headings, never by a customer's filename or known data.
// Identity roles, photos and generic address proofs remain for user assignment.
export function classifyDocument(text,{brRecognized=false}={}) {
 const raw=String(text||'').normalize('NFKC'),compact=raw.replace(/\s/g,'');
 // Prioritise the document's own title over its list of supporting documents.
 if(/Corporate\s+Authorization\s+Letter/i.test(raw)||/公司授權書/.test(compact))return {id:'109701',kind:'AUTHORIZATION',ambiguous:false,reason:'公司授權書：歸入附屬材料，手寫資料須人工核對'};
 if(/Merchant\s+(?:Onboarding\s+)?Application.{0,40}(?:Agreement|Cooperation)/i.test(raw)||/商戶入駐申請及合作協議/.test(compact))return {id:'140701',kind:'APPLICATION',ambiguous:false,reason:'商戶申請及合作協議：手寫資料須人工核對，不當作銀行結單'};
 if(/HONG\s*KONG\s*(?:PERMANENT\s*)?IDENTITY\s*CARD/i.test(raw)||/香港(?:永久性居民)?身[份分]證/.test(compact))return {id:'',kind:'ID',ambiguous:false,reason:'已辨識為身份證；請選擇持有人角色及對應附件位置'};

 const rules=[
  ['140101',/Business\s*(?:\/\s*Branch\s*)?Registration\s+Certificate|商業.{0,5}登記證/i],
  ['140201',/Certificate\s+of\s+Incorporation|公司註冊證書/i],
  ['140301',/Company\s+Search\s+Report|公司(?:註冊登記)?查冊/i],
  ['141101',/Annual\s+Return|\bNAR1\b|\bNNC1\b|周年申報表/i],
  ['140401',/(?:Bank|HSBC\s+Business\s+Direct)\s+Statement|銀行月結單|銀行結單/i],
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
  const add=(key,value,step=2,extra={})=>{if(value?.trim()&&!result.some(x=>x.key===key&&x.value===value.trim()))result.push({key,value:value.trim(),step,...extra});};
  const raw=String(text||'').normalize('NFKC').replace(/[‐‑–—−]/g,'-');
  const classification=classifyDocument(raw);
  if(['APPLICATION','AUTHORIZATION'].includes(classification.kind))return result;
  if(type==='BR'||type==='AUTO') {
    const br=parseBR(raw,{method:'document-text',page:1});
    if(br.recognized) for(const [source,key,step] of [['businessNameZh','merchantName',2],['businessNameEn','merchantEnglishName',2],['certificateNumber','registerCertNo',2],['expiryDate','registerCertPeriod',2],['legalStatus','legalStatus',2],['businessAddressZh','addrStreet',3],['businessAddressEn','addrStreetEn',3],['natureOfBusiness','remark',3]]) {
      const value=br.fields[source]?.value;add(key,value,step);
      if(source==='businessNameEn')add('registerCertName',value);
      if(source==='certificateNumber'&&value)add('registerCertType','01');
    }
  }
  const lines=raw.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const types={CI:/CERTIFICATE OF INCORPORATION|公司註冊證書/i,NAR1:/ANNUAL RETURN|NAR1|NNC1|周年申報/i,ID:/IDENTITY CARD|身份證|身分證/i,BANK:/(?:BANK|HSBC\s+BUSINESS\s+DIRECT)\s+STATEMENT|銀行月結單|銀行結單/i};
  const permits=t=>type===t||(type==='AUTO'&&types[t].test(raw));
  function labelled(pattern){for(let i=0;i<lines.length;i++){const m=lines[i].match(pattern);if(m)return(m[1]||lines[i+1]||'').trim();}return '';}
  if(permits('CI'))add('crCode',labelled(/^(?:Company (?:Registration )?Number|Certificate No\.?|公司註冊編號)\s*[:：#]\s*(.*)$/i).replace(/\s/g,''));
  if(permits('NAR1'))add('directors[0].name',labelled(/^(?:Director Name|董事姓名)\s*[:：]\s*(.*)$/i));
  // A plain identity card does not establish a company role. Never infer director.
  if(permits('ID')&&/Director(?:'s)?\s+Identity|董事身[份分]證/i.test(raw)){
    add('directors[0].name',labelled(/^(?:Name|姓名)\s*[:：]\s*(.*)$/i));
    const id=labelled(/^(?:Identity Card (?:No\.?|Number)|身份證號碼|身分證號碼)\s*[:：]\s*(.*)$/i);
    if(/^[A-Z]{1,2}\d{6}\([0-9A]\)$/i.test(id.replace(/\s/g,'')))add('directors[0].idcardNo',id.replace(/\s/g,''));
    const birth=labelled(/^(?:Date of Birth|出生日期)\s*[:：]\s*(.*)$/i).replaceAll('/','-');
    if(/^\d{4}-\d{2}-\d{2}$/.test(birth))add('directors[0].birthDay',birth);
  }
  if(permits('BANK')){
    const unique=items=>[...new Set(items.filter(Boolean))];
    const bankLines=raw.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    const accountPattern=/\bAccount\s*(?:No\.?|Number)|[帳賬]戶號碼|戶口號碼|銀行帳號/i;
    const accounts=[];
    for(let i=0;i<bankLines.length;i++){
      const line=bankLines[i],label=accountPattern.exec(line)||(/HSBC\s+Business\s+Direct\s+Statement/i.test(raw)&&/\bNumber\b/i.exec(line));
      if(!label)continue;
      const tail=line.slice(label.index+label[0].length).replace(/\s/g,'');
      // Preserve all printed digits and separators. No O/0 correction, balance,
      // date, telephone or unlabeled number is used as an account number.
      const read=s=>s.match(/(?:^|[^A-Z0-9])([0-9]{2,6}(?:[- ][0-9]{2,12}){1,3}|[0-9]{6,34})(?![A-Z0-9])/i)?.[1]||'';
      const value=read(tail)||(/^[:：#\s\u3400-\u9fff/]*$/.test(tail)?read(bankLines[i+1]||''):'');
      if(value)accounts.push(value);
    }
    const accountValues=unique(accounts);
    if(accountValues.length===1)add('cardNo',accountValues[0],4,{source:'帳號標籤及其相鄰數字'});
    const names=unique(bankLines.flatMap((line,i)=>{
      const m=line.match(/^(?:Account (?:Name|Holder)|戶名|[帳賬]戶名稱)\s*[:：]\s*(.*)$/i);
      return m?[m[1]||bankLines[i+1]||'']:[];
    }));
    if(names.length===1)add('cardName',names[0],4);
    // A Business Direct statement prints the addressee in its top address
    // block rather than an "Account Name:" field. Use only that bounded block.
    if(!names.length&&/HSBC\s+Business\s+Direct\s+Statement/i.test(raw)){
      const header=bankLines.slice(0,Math.min(30,bankLines.findIndex(l=>/Branch|Portfolio Summary|Keep your business/i.test(l))<0?30:bankLines.findIndex(l=>/Branch|Portfolio Summary|Keep your business/i.test(l))));
      const companies=unique(header.flatMap(l=>{
        const left=l.split(/\bNumber\b/i)[0].trim();
        return /^[A-Z0-9][A-Z0-9 &.,'()/-]+(?:LIMITED|LTD\.?|CORPORATION)$/i.test(left)&&!/^The Hongkong and Shanghai|^HSBC\b/i.test(left)?[left]:[];
      }));
      if(companies.length===1)add('cardName',companies[0],4,{autoSelect:false,warning:'由結單抬頭讀取戶名，請對照銀行原件確認'});
    }
    const code=labelled(/^(?:Bank Code|銀行代碼|銀行編號)\s*[:：]\s*(.*)$/i);
    if(/^\d{3}$/.test(code))add('cardBankCode',code,4);
    if(/HSBC\s+Business\s+Direct\s+Statement/i.test(raw)){
      add('cardBankName','香港上海匯豐銀行有限公司',4,{autoSelect:false,warning:'按結單銀行標題辨識，請確認開戶銀行'});
      if(!code)add('cardBankCode','004',4,{autoSelect:false,warning:'按結單 HSBC 標題對應銀行代碼清單；並非取自帳號前綴，請核對'});
    }
  }
  return result;
}

// Neutral identity fields: the card never establishes whether its holder is a
// director, shareholder or authorised signer. The review UI assigns that role.
export function extractIdentity(text){
 const raw=String(text||'').normalize('NFKC').replace(/[‐‑–—−]/g,'-');
 if(classifyDocument(raw).kind!=='ID'&&!/IDENTITY\s*CARD/i.test(raw))return {};
 const lines=raw.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),out={};
 const ids=[...new Set([...raw.matchAll(/(?<![A-Z0-9])([A-Z]{1,2})\s*(\d{6})\s*\(\s*([0-9A])\s*\)(?![A-Z0-9])/gi)].map(m=>(m[1]+m[2]+'('+m[3]+')').toUpperCase()))];
 if(ids.length===1)out.idcardNo=ids[0];
 const nameAt=lines.findIndex(l=>/^[A-Z][A-Z '-]+,\s*[A-Za-z][A-Za-z '-]+/.test(l));
 if(nameAt>=0){
   const m=lines[nameAt].match(/^([A-Z][A-Z '-]+),\s*([A-Za-z]+(?:[ '-][A-Za-z]+)*)/);
   if(m){out.lastNameEn=m[1].trim();out.firstNameEn=m[2].trim();}
   const zh=lines[nameAt-1]?.match(/^([\u3400-\u9fff\s]{2,})/)?.[1].replace(/\s/g,'');
   if(zh&&zh.length<=12&&!/香港|身份|身分|姓名/.test(zh))out.name=zh;
 }
 const dates=[];
 for(let i=0;i<lines.length;i++)if(/Date\s*of\s*Birth|出生日期/i.test(lines[i].replace(/(?<=[\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g,''))){
  const bounded=lines.slice(i,i+3).join(' ').split(/Date\s*of\s*Issue|簽發日期/i)[0],date=parseDate(bounded);
  if(date)dates.push(date);
 }
 const births=[...new Set(dates)];if(births.length===1)out.birthDay=births[0];
 if(out.idcardNo)out.idcardType='01';
 return out;
}

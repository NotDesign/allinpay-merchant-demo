/* Shared, versioned merchant-template and import model. No browser/storage APIs. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MerchantTemplateModel=api;})(globalThis,function(){
 'use strict';
 const clone=value=>structuredClone(value);
 const text=value=>value==null?'':String(value).trim();
 const codes=value=>[...new Set((Array.isArray(value)?value:text(value).split(/[;,，；、\s]+/)).map(text).filter(Boolean))];
 function parseCSV(source){
  source=source.replace(/^\uFEFF/,'');const rows=[];let row=[],cell='',quoted=false,closed=false;
  for(let i=0;i<source.length;i++){
   const ch=source[i];
   if(quoted){if(ch==='"'){if(source[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=ch;continue;}
   if(ch==='"'){if(cell||closed)throw Error('CSV 引號位置不正確');quoted=true;continue;}
   if(ch===','||ch==='\n'||ch==='\r'){row.push(cell);cell='';closed=false;if(ch!==','){if(ch==='\r'&&source[i+1]==='\n')i++;if(row.some(v=>v.trim()))rows.push(row);row=[];}continue;}
   if(closed&&!/\s/.test(ch))throw Error('CSV 引號後只能接逗號或換行');if(!closed)cell+=ch;
  }
  if(quoted)throw Error('CSV 有未關閉的引號');row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
  if(!rows.length)throw Error('文件沒有資料');const headers=rows.shift().map(text);
  if(headers.some(h=>!h)||new Set(headers).size!==headers.length)throw Error('CSV 標題不可留白或重複');
  return rows.map((r,i)=>{if(r.length!==headers.length)throw Error('CSV 第 '+(i+2)+' 列欄位數與標題不一致');return Object.fromEntries(headers.map((h,j)=>[h,r[j]]));});
 }
 function csv(rows){return '\uFEFF'+rows.map(row=>row.map(v=>'"'+text(v).replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';}
 function create(data){
  const fields=data.forms.flatMap(f=>f.sections.flatMap(s=>s.fields)),byId=Object.fromEntries(fields.map(f=>[f.id,f]));
  const identity=['merchantName','merchantShortName','merchantEnglishName','merchantEnglishShortName','merchantType','groupId','parentMerchant','inspectionDate','registerCertNo','registerCertName','registerCertPeriod','crCode','nar1Period','creditCode','creditCodePeriod','organCode','organCodePeriod','taxCode','taxCodePeriod','cardName','cardNo','cardIdcardNo'];
  const settlement=data.forms[2].sections.flatMap(s=>s.fields.map(f=>f.id)).filter(k=>!identity.includes(k));
  const productFields=data.forms[3].sections.flatMap(s=>s.fields.map(f=>f.id));
  const profile=fields.map(f=>f.id).filter(k=>!k.includes('[]')&&!identity.includes(k)&&!settlement.includes(k)&&!productFields.includes(k)&&!['mcc','mccName','riskLevel','riskOverrideReason','merchantAgreementNum','groupId'].includes(k));
  const scopeFields={profile,mcc:['mcc','mccCodes'],settlement,products:productFields,identity};
  const labels={profile:'商戶共用資料',mcc:'MCC 行業代碼',settlement:'結算參數',products:'產品與費率',identity:'公司專屬資料（僅單家公司）'};
  const rateDefs=Object.fromEntries(data.catalog.GROUPS.flatMap(g=>g.rows.map((r,i)=>[g.k+'|'+i,{g,r}])));
  const groups=new Set(data.catalog.GROUPS.map(g=>g.k));
  const comboKeys=new Set(data.catalog.GROUPS.flatMap(g=>(g.combo||[]).map(c=>g.k+'|'+c)));
  function cleanFields(input){
   const out={};if(!input||typeof input!=='object'||Array.isArray(input))return out;
   for(const [key,value]of Object.entries(input)){
    if(key==='mccCodes'){const list=codes(value);if(list.some(c=>!/^\d{4}$/.test(c))||list.length>50)throw Error('MCC 必須是 4 位數字，每家公司最多 50 個');out[key]=list;continue;}
    const base=key.replace(/\[\d+\]/g,'[]');if(!Object.hasOwn(byId,base)||['riskLevel','riskOverrideReason','merchantAgreementNum'].includes(key))continue;
    if(value!==null&&!['string','number','boolean'].includes(typeof value))throw Error('欄位 '+key+' 的格式不正確');
    const val=text(value);if(val.length>2000)throw Error('欄位 '+key+' 過長');if(/\[(\d+)\]/.test(key)&&+RegExp.$1>=20)throw Error('每類人士最多 20 位');out[key]=val;
   }
   if(out.mcc&&!/^\d{4}$/.test(out.mcc))throw Error('主要 MCC 必須是 4 位數字');
   if(out.mccCodes||out.mcc){out.mccCodes=codes(out.mccCodes||out.mcc);if(out.mcc&&!out.mccCodes.includes(out.mcc))out.mccCodes.unshift(out.mcc);out.mcc||=out.mccCodes[0]||'';}
   for(const [k,v]of Object.entries(out))if(v&&/Email$/.test(k)&&!/^\S+@\S+\.\S+$/.test(v))throw Error(k+' 電郵格式不正確');
   return out;
  }
  function cleanProducts(input){
   if(input==null)return null;if(typeof input!=='object'||Array.isArray(input))throw Error('產品設定格式不正確');
   const out={groups:Object.fromEntries([...groups].map(k=>[k,false])),rates:Object.fromEntries(Object.entries(rateDefs).map(([k,d])=>[k,{on:false,ct:d.r.ct||null,v:{}}])),combo:{},sme:{}};
   for(const [k,v]of Object.entries(input.groups||{})){if(!groups.has(k))throw Error('未知產品類別：'+k);out.groups[k]=!!v;}
   for(const [k,r]of Object.entries(input.rates||{})){
    if(!Object.hasOwn(rateDefs,k))throw Error('未知產品項目：'+k);if(!r||typeof r!=='object')throw Error('產品費率格式不正確');
    if(r.ct!=null&&!['Regional','Blended','Wallet'].includes(r.ct))throw Error('收費類型不正確：'+k);
    const value={};for(const [field,val]of Object.entries(r.v||{})){
     if(!/^[a-z][a-z0-9_]{0,30}$/.test(field)||['constructor','prototype','__proto__'].includes(field))throw Error('費率欄位不正確');
     if(typeof val==='boolean'){value[field]=val;continue;}const str=text(val);
     if(!/^\d+(\.\d{1,2})?$/.test(str)&&!['Y','N',''].includes(str))throw Error('費率／金額格式不正確：'+field);
     if(/rate|ratio/.test(field)&&+str>100)throw Error('費率不可超過 100%');value[field]=str;
    }
    out.rates[k]={on:!!r.on,ct:r.ct??rateDefs[k].r.ct??null,v:value};
   }
   for(const [k,v]of Object.entries(input.combo||{})){if(!comboKeys.has(k))throw Error('未知產品功能：'+k);out.combo[k]=!!v;}
   for(const [k,v]of Object.entries(input.sme||{})){if(!['VISA','MASTERCARD','AMERICAEXPRESS'].includes(k)||!v||!['SME','SMESMK','SMEB2B'].includes(v.type))throw Error('特計商戶設定不正確');out.sme[k]={on:!!v.on,type:v.type};}
   return out;
  }
  function cleanTemplate(input){
   if(!input||typeof input!=='object')throw Error('模板格式不正確');const name=text(input.name);if(!name||name.length>80)throw Error('請填寫 80 字以內的模板名稱');
   const values=cleanFields(input.values),products=cleanProducts(input.products),scopes=Object.keys(labels).filter(s=>(input.scopes||Object.keys(labels)).includes(s));
   if(!scopes.length)throw Error('模板至少選擇一個範圍');
   const allowed=new Set(scopes.flatMap(s=>scopeFields[s]));for(const key of Object.keys(values))if(values[key]===''||Array.isArray(values[key])&&!values[key].length||!allowed.has(key)&&!(scopes.includes('identity')&&key.includes('[')))delete values[key];
   const people={};for(const k of ['directors','authSigners','shareHolders'])people[k]=Math.min(20,Math.max(k==='directors'?1:0,Number(input.people?.[k])||0));
   return {id:text(input.id).slice(0,100),name,version:Math.max(1,Number(input.version)||1),scopes,values,products:scopes.includes('products')?products:null,people,createdAt:text(input.createdAt),updatedAt:text(input.updatedAt)};
  }
  function apply(snapshot,template,selected,mode='replace',allowIdentity=false){
   const out=clone(snapshot),values=out.values??={},changes=[];out.people||={directors:1,authSigners:0,shareHolders:0};
   const scopes=selected.filter(s=>template.scopes.includes(s)&&(s!=='identity'||allowIdentity));
   const allow=new Set(scopes.flatMap(s=>scopeFields[s]));
   for(const [key,val]of Object.entries(template.values)){
    if(!allow.has(key)&&!(scopes.includes('identity')&&key.includes('[')))continue;
    if(mode==='blank'&&(Array.isArray(values[key])?values[key].length:!!text(values[key])))continue;
    if(JSON.stringify(values[key]??'')!==JSON.stringify(val)){changes.push({key,before:clone(values[key]??''),after:clone(val)});values[key]=clone(val);}
   }
   if(scopes.includes('identity'))out.people=clone(template.people);
   if(values.__v2&&changes.some(c=>['cardBankName','cardBankCode'].includes(c.key))){values.__v2.bankCustom=false;delete values.__v2.bankAutoName;}
   if(scopes.includes('mcc')){values.mccCodes=codes(values.mccCodes||values.mcc);if(!values.mccCodes.includes(values.mcc))values.mcc=values.mccCodes[0]||'';}
   if(scopes.includes('products')&&template.products){
    const m=values.__v2||={version:2,groups:{},rates:{},combo:{},sme:{},links:{authSigners:{},shareHolders:{}},signals:{},ocr:[],ack:{},manualRisk:false};
    const old=Object.fromEntries(['groups','rates','combo','sme'].map(k=>[k,clone(m[k]||{})]));
    if(mode==='replace'||!Object.keys(m.rates||{}).some(k=>m.groups?.[k.split('|')[0]]&&m.rates[k]?.on)){
     for(const key of ['groups','rates','combo','sme'])m[key]=clone(template.products[key]||{});
     if(JSON.stringify(old)!==JSON.stringify(template.products))changes.push({key:'_products',before:old,after:clone(template.products)});
    }
   }
   if(changes.some(c=>c.key==='contactEmail'))out.emailVerified=false;
   if(changes.length){out.checks={};out.signature='';values.signer='';values.signerTitle='';if(values.__v2)values.__v2.ack={};}
   values.__templateApplied={id:template.id,name:template.name,version:template.version,scopes,time:new Date().toISOString()};
   return {snapshot:out,changes,scopes};
  }
  const aliases={'中文名稱':'merchantName','英文名稱':'merchantEnglishName','中文簡稱':'merchantShortName','英文簡稱':'merchantEnglishShortName','BR號碼':'registerCertNo','BR有效期':'registerCertPeriod','MCC代碼':'mccCodes','主要MCC':'mcc','聯絡人':'contactName','聯絡電話':'contactPhone','聯絡電郵':'contactEmail','中文地址':'addrStreet','英文地址':'addrStreetEn','結算週期':'settlePeriod','幣種':'currency','銀行代碼':'cardBankCode','銀行名稱':'cardBankName','銀行帳戶名稱':'cardName','銀行帳號':'cardNo'};
  const csvHeaders=['客戶編號','客戶名稱','公司代號','公司角色','母公司代號','參數模板',...Object.keys(aliases),'收單VISA本地費率(%)','收單VISA跨境費率(%)','CNPVISA本地費率(%)','CNPVISA跨境費率(%)'];
  function csvBundle(source){
   const records=parseCSV(source),unknown=Object.keys(records[0]||{}).filter(key=>!csvHeaders.includes(key)&&key!=='主公司代號'&&!Object.hasOwn(byId,key.replace(/\[\d+\]/g,'[]'))&&key!=='mccCodes');
   if(unknown.length)throw Error('CSV 含未識別欄位：'+unknown.join('、')+'。請依下載範本或表單欄位 ID 填寫。');
   return {format:'allinpay.merchant-bundle',version:1,companies:records.map((row,i)=>{
    const values={};for(const [key,val]of Object.entries(row)){const id=aliases[key]||key;if(Object.hasOwn(byId,id.replace(/\[\d+\]/g,'[]'))||id==='mccCodes')values[id]=val;}
    const products={groups:{},rates:{},combo:{},sme:{}};
    for(const [header,group,field]of [['收單VISA本地費率(%)','POS','loc_rate'],['收單VISA跨境費率(%)','POS','crs_rate'],['CNPVISA本地費率(%)','CNP','loc_rate'],['CNPVISA跨境費率(%)','CNP','crs_rate']])if(text(row[header])){products.groups[group]=true;const key=group+'|0';products.rates[key]??={on:true,ct:'Regional',v:{}};products.rates[key].v[field]=text(row[header]);}
    return {key:row['公司代號']||'ROW-'+(i+1),customerId:row['客戶編號'],customerName:row['客戶名稱'],role:row['公司角色']||'independent',parentKey:row['母公司代號']||row['主公司代號'],templateName:row['參數模板'],values,products:Object.keys(products.rates).length?products:null};
   })};
  }
  function bundle(input,knownTemplates=[]){
   if(!input||input.format!=='allinpay.merchant-bundle'||input.version!==1)throw Error('請使用版本 1 的商戶資料匯入文件');
   if(input.companies&&!Array.isArray(input.companies)||(input.companies||[]).length>100||!(input.companies||[]).length&&!input.templates?.length)throw Error('每次可匯入 1–100 家公司，或至少一份模板');
   if(input.templates&&!Array.isArray(input.templates)||input.templates?.length>50)throw Error('每次最多 50 份模板');
   const templates=(input.templates||[]).map(cleanTemplate),seen=new Set();if(new Set(templates.map(t=>t.name)).size!==templates.length)throw Error('同一文件不可包含重複模板名稱');
   const companies=(input.companies||[]).map((entry,index)=>{
    const key=text(entry.key)||'ROW-'+(index+1);if(seen.has(key))throw Error('公司代號重複：'+key);seen.add(key);
    const values=cleanFields(entry.values),role=({'母公司':'parent','主公司':'parent','子公司':'subsidiary','獨立公司':'independent'})[entry.role]||entry.role||'independent';
    if(!['parent','subsidiary','independent'].includes(role))throw Error(key+' 公司角色不正確');
    if(!values.merchantName&&!values.merchantEnglishName)throw Error(key+' 請填寫公司中文或英文名稱');
    const customerId=text(entry.customerId||input.customer?.id),customerName=text(entry.customerName||input.customer?.name);
    const templateName=text(entry.templateName||input.defaultTemplate);
    if(templateName&&![...templates,...knownTemplates].some(t=>t.name===templateName))throw Error(key+' 找不到參數模板：'+templateName);
    const people={};for(const group of ['directors','authSigners','shareHolders']){const inferred=Object.keys(values).filter(k=>k.startsWith(group+'[')).map(k=>Number(k.match(/\[(\d+)\]/)[1])+1);people[group]=Math.max(group==='directors'?1:0,Number(entry.people?.[group])||0,...inferred);if(!Number.isInteger(people[group])||people[group]>20)throw Error('每種人員類型最多 20 人');}
    return {key,values,people,products:cleanProducts(entry.products),customerId:customerId||customerName,customerName:customerName||customerId,role,parentKey:text(entry.parentKey),templateName};
   });
   const byKey=new Map(companies.map(c=>[c.key,c]));
   for(const c of companies){
    if(c.role==='subsidiary'){const parent=byKey.get(c.parentKey);if(!parent||parent===c||parent.role!=='parent'||!c.customerId||c.customerId!==parent.customerId)throw Error(c.key+' 子公司須對應同一客戶內的母公司');}
    else if(c.parentKey)throw Error(c.key+' 只有子公司可填寫母公司代號');
   }
   return {format:input.format,version:1,templates,companies};
  }
  return {scopeFields,labels,identity,cleanFields,cleanProducts,cleanTemplate,apply,csvBundle,bundle,csvHeaders,codes,parseCSV,csv};
 }
 return {create,codes,parseCSV,csv};
});

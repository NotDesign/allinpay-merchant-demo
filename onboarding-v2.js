// OATS V2 onboarding. Browser-only demonstration; no OCR, screening or payment API calls.
const V2 = V2_DATA;
const v2Groups = V2.catalog.GROUPS;
const v2Fields = V2.forms.flatMap(f => f.sections.flatMap(s => s.fields));
const v2ById = Object.fromEntries(v2Fields.map(f => [f.id, f]));
const v2PersonKeys = ['name','firstNameEn','lastNameEn','idcardType','idcardNo','idcardNoPeriod','birthDay'];
let v2FeeEdit = null;
let v2OcrEdit = null;
const v2Raw = k => String(state.values[k] ?? '').trim();
const v2Num = k => Number(v2Raw(k)) || 0;
const v2Model = () => state.values.__v2;
const v2RowKey = (g,i) => g.k + '|' + i;
const v2Rows = () => v2Groups.flatMap(g => v2Model().groups[g.k] ? g.rows.map((r,i) => ({g,r,i,key:v2RowKey(g,i),st:v2Model().rates[v2RowKey(g,i)]})).filter(x => x.st?.on) : []);
const v2Has = (key, predicate=()=>true) => v2Rows().some(x => x.g.k===key && predicate(x.r));
const v2Cnp = () => v2Has('CNP') || v2Has('PBL',r=>!!r.brand);
const v2Offline = () => v2Has('POS') || v2Has('INQR');
const v2Amex = () => ['HKG','SGP'].includes(v2Raw('addrCountryCode')) && v2Rows().some(x=>['POS','CTV','CNP','PBL','ONE'].includes(x.g.k)&&x.r.brand==='AMERICAEXPRESS');
const v2DateDays = d => d ? Math.round((new Date(d+'T00:00:00')-new Date(new Date().toDateString()))/86400000) : 99999;
const v2NormalizeName = s => String(s).toUpperCase().replace(/LIMITED/g,'LTD').replace(/ROAD/g,'RD').replace(/[^A-Z0-9\u3400-\u9fff]/g,'');
function v2Options(id) {
  if (/ProvinceCode$/.test(id)) {const k=id.startsWith('card')?'card':'addr',country=v2Raw(k+'CountryCode');return V2.catalog.PROVINCES[k==='card'&&country==='HKG'?'HKG_CARD':country]||[];}
  if (/CityCode$/.test(id)) return V2.catalog.CITIES[v2Raw((id.startsWith('card')?'card':'addr')+'ProvinceCode')]||[];
  return V2.options[id] || V2.options[id.split('.').pop()] || [];
}
function v2Canonical(k,v) {
  if (v===undefined || v===null || v==='') return '';
  const list=V2.options[k]||V2.options[k.split('.').pop()]||[];
  if(list.some(o=>o[0]===v))return v;
  const aliases={legalStatus:{'法人團體 · Body Corporate':'BODY_CORPORATE','個人 · Individual':'PERSON','合夥 · Partnership':'PARTNER','非屬法團 · Unincorporated Body':'NO_CORPORATION'},riskLevel:{'一般':'1'},chargeWay:{'按月結算':'MONTH_SETTLE','月結扣費':'MONTH_SETTLE','預付費':'PRE_FEE','餘額扣費':'BALANCE'}};
  if(aliases[k]?.[v])return aliases[k][v];
  const clean=s=>String(s).replace(/[\s–—-]/g,'');
  const match=list.find(o=>String(v).startsWith(o[0]+' ')||clean(v)===clean(o[1]));
  return match?.[0] ?? String(v);
}
function v2Ensure() {
  if(v2Model()?.version===2)return;
  const hadData=!!state.values.merchantName;
  if(!hadData)state.people={directors:1,authSigners:0,shareHolders:0};
  for(const k of Object.keys(state.values))state.values[k]=v2Canonical(k,state.values[k]);
  for(const [k,v] of Object.entries(V2.defaults))if(state.values[k]===undefined||k==='riskLevel'&&!['1','2','3'].includes(state.values[k]))state.values[k]=v;
  if(v2Raw('settlePeriod').includes('系統'))state.values.settlePeriod='T1';
  if(v2Raw('cardBankCode'))state.values.cardBankCode=v2Raw('cardBankCode').split(' ')[0];
  const geoAlias={'香港':'HK-HKI','九龍':'HK-KLN','新界':'HK-NT','廣東省':'CN-GD','上海市':'CN-SH','北京市':'CN-BJ','深圳市':'CN-GD-SZ','廣州市':'CN-GD-GZ'};
  for(const k of ['addrProvinceCode','addrCityCode','cardProvinceCode','cardCityCode'])if(geoAlias[v2Raw(k)])state.values[k]=k==='cardProvinceCode'&&v2Raw('cardCountryCode')==='HKG'?'HKG':geoAlias[v2Raw(k)];
  state.values.__v2={version:2,groups:{},rates:{},combo:{},sme:{},links:{authSigners:{},shareHolders:{}},signals:{},ocr:[],ack:{},manualRisk:false,legacy:hadData};
  if(hadData)for(const [id,g] of [['603:4689','POS'],['603:4745','INQR'],['603:4709','CNP']])if(state.checks[id])v2SetGroup(g,true);
  state.values.mccName=V2.catalog.MCCS.find(m=>m.c===v2Raw('mcc'))?.n||'';
}
function v2Reset() {
  state.values=structuredClone(V2.defaults);state.checks={};state.files={};state.people={directors:1,authSigners:0,shareHolders:0};
  state.emailVerified=false;state.errors={};state.draftId=null;state.savedAt=null;state.editing=null;DEMO.br=null;v2Ensure();
}
defaults=()=>{Object.assign(state.values,structuredClone(V2.defaults));v2Ensure();};
v2Ensure();
function v2SetGroup(k,on) {const m=v2Model(),g=v2Groups.find(g=>g.k===k);m.groups[k]=on;g.rows.forEach((r,i)=>{m.rates[v2RowKey(g,i)]??={on:!r.off,ct:r.ct||null,v:{}};});}
function v2Score() {
  const items=[],add=(label,n)=>items.push({label,n}),m=V2.catalog.MCCS.find(m=>m.c===v2Raw('mcc')),s=v2Model().signals;
  if(v2Raw('licencePeriod')==='01')add('經營年限少於 1 年',15);else if(v2Raw('licencePeriod')==='02')add('經營年限 1–3 年',8);
  if(v2Raw('legalStatus')==='PERSON')add('法律地位為個人',10);
  if(v2Raw('registerCapital')==='01')add('註冊資本少於 10 萬',6);
  if(v2Raw('registerCertPeriod')&&v2DateDays(v2Raw('registerCertPeriod'))<90)add('註冊證書距到期少於 90 天',8);
  if(m?.lv==='high')add('MCC 屬高風險',25);else if(m?.lv==='mid')add('MCC 屬中風險',12);
  if(v2Cnp())add('開通 CNP／PayByLink 卡產品',15);
  if(v2Cnp()&&v2Raw('connectType')==='0')add('卡產品採直連',10);
  if(v2Num('avgMonthAmount')>500000)add('月銷售超過 500,000',10);
  if(v2Num('maxAmount')>20000)add('單筆最高超過 20,000',8);
  if(m&&v2Num('avgPerAmount')>m.avg*3)add('平均單筆偏離行業常態超過 3 倍',12);
  const edits=v2Model().ocr.filter(o=>o.applied&&v2Raw(o.key)!==String(o.applied)).length;
  if(s.ocr||edits>=2)add('OCR 與人工修改差異不少於 2 項',10);
  if(s.virtual||v2Offline()&&!state.files['101401'])add('無門店照／虛擬辦公室',12);
  if(v2Raw('isCompay')==='N')add('結算帳戶為對私',8);
  if(v2Raw('isCompay')==='Y'&&v2Raw('cardName')&&v2Raw('merchantEnglishName')&&v2NormalizeName(v2Raw('cardName'))!==v2NormalizeName(v2Raw('merchantEnglishName')))add('對公帳戶名稱與英文商戶名稱不一致',15);
  if(s.cardlink)add('帳戶已關聯其他商戶',20);if(s.prepaid)add('涉及預付／儲值／預售',20);
  const total=Math.min(100,items.reduce((n,x)=>n+x.n,0)),reject=s.sanction?'命中制裁／PEP 名單':s.frozen?'關聯已凍結／關閉商戶':total>70?'風控評分超過 70':null;
  return {items,total,reject,level:total<=20?'1':total<=45?'2':'3'};
}
function v2SyncDerived() {
  for(const group of ['authSigners','shareHolders'])for(const [i,d] of Object.entries(v2Model().links[group])){
    if(d===null||d===undefined||+d>=state.people.directors)continue;
    for(const k of v2PersonKeys)state.values[`${group}[${i}].${k}`]=state.values[`directors[${d}].${k}`]||'';
  }
  state.values.mccName=V2.catalog.MCCS.find(m=>m.c===v2Raw('mcc'))?.n||(v2Raw('mcc').length===4?'未列入清單，待人工核定':'');
  if(!v2Model().manualRisk)state.values.riskLevel=v2Score().level;
}
function v2FileRequired() {
  const v=state.values,level=v2Score().reject?'D':v.riskLevel,extra=Object.keys(v2Model().links.shareHolders).filter(i=>v2Model().links.shareHolders[i]!==null).length;
  const unlinked=state.people.shareHolders-extra>0,cnp=v2Cnp(),offline=v2Offline();
  return {'140101':true,'140201':v.legalStatus==='BODY_CORPORATE','141101':v.legalStatus==='BODY_CORPORATE','140301':false,'100301':v.signType==='01','100302':v.signType==='01','140901':state.people.directors>1,'140902':level!=='1','141001':unlinked,'141002':level==='3'&&unlinked,'140401':true,'141301':['2','3'].includes(level),'101401':v.signType==='01'||offline,'101402':v.signType==='01'||offline,'140701':false,'141401':offline&&level!=='1','141601':cnp,'141201':cnp&&v.connectType==='0','141701':v2Num('avgMonthAmount')>500000||level==='3','109701':false,'109702':false};
}
requiredFiles=()=>Object.entries(v2FileRequired()).filter(([,yes])=>yes).map(([id])=>id);
function v2Required() {
  const v=state.values,r=new Set(['legalStatus','merchantType','merchantName','merchantShortName','merchantEnglishName','merchantEnglishShortName','registerCertType','registerCertNo','registerCertName','registerCertPeriod','registerCapital','licencePeriod','workerNumber','addrCountryCode','addrProvinceCode','addrStreet','addrStreetEn','mcc','riskLevel','avgPerAmount','maxAmount','avgMonthAmount','contactName','contactPhone','contactEmail','merchantAgreementPeriod','signType','currency','cardCountryCode','cardProvinceCode','cardBankCode','cardName','cardNo','isCompay']);
  if(v.legalStatus==='BODY_CORPORATE')r.add('nar1Period');
  if(v.addrCountryCode==='CHN'){r.add('addrCityCode');if(v.legalStatus!=='PERSON'){r.add('threeCertFlag');if(v.threeCertFlag==='0')for(const k of ['creditCode','organCode','taxCode'])r.add(k);}}
  if(v.cardCountryCode==='CHN'){r.add('cardCityCode');r.add('cardBranchCode');}else r.add('cardBankName');
  if(v.isCompay==='N')r.add('cardIdcardNo');if(v2Cnp())r.add('webUrl');
  if(v2Has('AV')&&v.chargeWay==='MONTH_SETTLE')r.add('monthMinPrice');
  if(v2Model().manualRisk&&+v.riskLevel<+v2Score().level)r.add('riskOverrideReason');
  return r;
}
function v2Visible(f) {
  const k=f.id,v=state.values;
  if(k==='groupId')return v.merchantType==='GENERAL';if(k==='nar1Period')return v.legalStatus==='BODY_CORPORATE';
  if(k==='threeCertFlag'||/^(creditCode|organCode|taxCode)/.test(k))return v.addrCountryCode==='CHN'&&v.legalStatus!=='PERSON'&&(k==='threeCertFlag'||v.threeCertFlag==='0');
  if(k==='addrCityCode')return v.addrCountryCode==='CHN';if(k==='cardCityCode')return v.cardCountryCode==='CHN';
  if(['swiftCode','cardBankName'].includes(k))return v.cardCountryCode!=='CHN';
  if(k==='cardIdcardNo')return v.isCompay==='N';if(k==='webUrl')return v2Cnp();
  if(k==='riskOverrideReason')return v2Required().has(k);return true;
}
function v2Display(k,v=state.values[k]) {return (v2Options(k).find(o=>o[0]===v)?.[1]||String(v??''))||'尚未填寫';}
function v2Field(f,index=0,linked=false) {
  if(!v2Visible(f))return '';
  const key=f.id.replace('[]',`[${index}]`),v=state.values[key]??'',id='field-'+key.replace(/[^\w-]/g,'-'),required=v2Required().has(f.id)||(f.id.includes('[]')&&(['name','firstNameEn','lastNameEn','idcardType','idcardNo'].includes(f.id.split('.').pop())||f.id.startsWith('authSigners')&&f.id.endsWith('birthDay'))),error=state.errors[key];
  const ro=linked||['mccName','merchantAgreementNum'].includes(key),type=f.placeholder==='YYYY/MM/DD'||/Period$|birthDay$/.test(key)&&!['settlePeriod','licencePeriod'].includes(key)?'date':/Email$/.test(key)?'email':/Phone$/.test(key)?'tel':key==='webUrl'?'url':'text';
  let label=f.label.split(/\s{2,}/);const heading=esc(label[0].replace(/\s*\*/g,''))+(required?' <span class="required">*</span>':'')+(label.length>1?`<span class="en">${esc(label.slice(1).join(' '))}</span>`:'');
  const attrs=`id="${id}" data-field="${esc(key)}" data-v2-field="${esc(key)}" ${ro?'readonly':''} ${required?'aria-required="true"':''} ${error?'aria-invalid="true"':''} ${f.max?'maxlength="'+f.max+'"':''}`;
  let control;
  if(f.type==='Select'&&key!=='cardBankCode'){const opts=v2Options(f.id);control=`<select ${attrs} ${ro?'disabled':''}><option value="">請選擇</option>${opts.map(([v1,l])=>`<option value="${esc(v1)}" ${v1===v?'selected':''}>${esc(l)}</option>`).join('')}${v&&!opts.some(o=>o[0]===v)?`<option value="${esc(v)}" selected>${esc(v)}（請重新選擇）</option>`:''}</select>`;}
  else control=`<input ${attrs} type="${type}" value="${esc(v)}" placeholder="${esc(f.placeholder)}" ${key==='mcc'?'list="v2-mcc" inputmode="numeric"':key==='cardBankCode'&&v2Raw('cardCountryCode')==='HKG'?'list="v2-banks" inputmode="numeric"':key==='settlePeriod'?'list="v2-settlement"':''}>`;
  return `<div class="field ${error?'invalid':''}" data-field-wrap="${esc(key)}"><label for="${id}">${heading}</label>${control}${f.hint?`<div class="hint">${esc(f.hint)}</div>`:''}${key==='contactEmail'?btn(state.emailVerified?'已驗證（模擬）':'驗證電郵（模擬）','verify-email','mini-action'):''}${error?`<div class="error" role="alert">${esc(error)}</div>`:''}</div>`;
}
function v2Card(title,copy,body) {return `<section class="card" data-section="${esc(title)}"><h2>${esc(title)}</h2>${copy?`<p class="hint">${esc(copy)}</p>`:''}${body}</section>`;}
function v2PersonSection(s) {
  const group=s.fields[0].id.split('[')[0],links=v2Model().links[group];let html='';
  for(let i=0;i<state.people[group];i++){const linked=links?.[i]!==undefined&&links?.[i]!==null;
    html+=`<div class="repeat"><div class="repeat-heading"><strong>${esc(s.name)} ${i+1}</strong>${btn('移除此人','v2-remove-person','danger',`data-group="${group}" data-index="${i}"`)}</div>${group!=='directors'?`<div class="v2-person-link"><label class="check"><input type="checkbox" data-v2-link="${group}" data-index="${i}" ${linked?'checked':''} ${!state.people.directors?'disabled':''}>與董事相同</label><select aria-label="沿用哪位董事" data-v2-director="${group}" data-index="${i}" ${!state.people.directors?'disabled':''}>${Array.from({length:state.people.directors},(_,j)=>`<option value="${j}" ${links?.[i]===j?'selected':''}>董事 ${j+1} · ${esc(v2Raw('directors['+j+'].name')||'未填姓名')}</option>`).join('')}</select><small class="hint">${linked?'董事修改時同步更新；取消勾選可獨立修改。':'可沿用已登記董事資料及證件。'}</small></div>`:''}<div class="grid">${s.fields.map(f=>v2Field(f,i,linked)).join('')}</div></div>`;
  }
  return v2Card(s.name,s.texts[1],html+btn('＋ 新增一位','v2-add-person','',`data-group="${group}" ${group==='authSigners'&&v2Amex()&&state.people[group]>=1?'disabled':''}`)+' <span class="hint">制裁／PEP：Demo 未執行真實篩查</span>');
}
function v2FormSections(index) {return V2.forms[index].sections.map(s=>{if(!s.fields.length)return '';if(s.fields[0]?.id.includes('[]'))return v2PersonSection(s);const fs=s.fields.filter(v2Visible);if(!fs.length)return '';let tail='';if(s.name==='結算參數')tail=`<div class="toolbar v2-quick">${['T1','T2','T3','T7'].map(x=>btn(x,'v2-settlement','',`data-value="${x}"`)).join('')}${btn('使用建議值 '+({1:'T1',2:'T2',3:'T3'}[state.values.riskLevel]),'v2-settlement','',`data-value="${({1:'T1',2:'T2',3:'T3'}[state.values.riskLevel])}"`)}</div>`;if(fs.some(f=>f.id==='riskLevel'))tail=v2RiskSummary();return v2Card(s.name,s.texts[1],`<div class="grid">${fs.map(f=>v2Field(f)).join('')}</div>`+tail);}).join('');}
function v2RiskSummary(){const score=v2Score();return `<div class="notice ${score.reject?'error':'warn'} v2-risk-summary"><strong>V2 風控示例：${score.total} 分 · ${score.reject?'拒件':v2Display('riskLevel',score.level)}</strong><p>${score.items.map(x=>esc(x.label)+' +'+x.n).join('；')||'暫無加分項。'}</p>${v2Model().manualRisk?btn('恢復系統建議','v2-reset-risk'):''}<small>只模擬參考原型規則，不代表正式審核結果。</small></div>`;}
function v2SmeOptions(brand) {const m=+v2Raw('mcc'),rules=V2.catalog.SME_RULES[brand];return ['SME','SMESMK','SMEB2B'].filter(t=>{const r=rules[t];return r&&m&&(r.only?r.only.includes(m):!r.ex.some(x=>Array.isArray(x)?m>=x[0]&&m<=x[1]:m===x));});}
function v2Sme() {return v2Card('特計商戶 SME 配置','依 MCC 及卡組織清單只列出適用方案。',`<div class="grid">${['VISA','MASTERCARD','AMERICAEXPRESS'].map(b=>{const opts=v2SmeOptions(b),s=v2Model().sme[b]||{};return `<div class="v2-sme"><label class="check"><input type="checkbox" data-v2-sme="${b}" ${s.on?'checked':''} ${!opts.length?'disabled':''}>${b}</label><select aria-label="${b} 特計商戶類型" data-v2-sme-type="${b}" ${!opts.length?'disabled':''}>${opts.map(o=>`<option ${s.type===o?'selected':''}>${o}</option>`).join('')||'<option>目前 MCC 不適用</option>'}</select></div>`;}).join('')}</div>`);}
function v2FeeSummary(r,st) {const v=st.v,ct=st.ct;if(r.mode==='NONE')return '無手續費';if(r.mode==='PER')return '每筆 HKD '+(v.per_fix??'0.00');if(r.mode==='INST')return V2.catalog.TENORS.filter(t=>v['t'+t+'_on']).map(t=>t+' 期').join('／')||'請設定開通期數';if(ct==='Regional')return '本地 '+(v.loc_rate??'0.00')+'%／跨境 '+(v.crs_rate??'0.00')+'%';if(ct==='Wallet')return '國內錢包 '+(v.cn_rate??'0.00')+'%／香港錢包 '+(v.hk_rate??'0.00')+'%';return (v.std_rate??'0.00')+'% + HKD '+(v.std_fix??'0.00');}
function v2Products() {
  let html=v2Card('產品配置','先選擇產品類別，再設定每項產品。V2 共 11 類、117 個項目。',`<div class="check-grid">${v2Groups.map(g=>`<label class="check"><input type="checkbox" data-v2-group="${g.k}" ${v2Model().groups[g.k]?'checked':''}>${g.n}</label>`).join('')}</div>`)+v2Sme();
  html+=v2Groups.filter(g=>v2Model().groups[g.k]).map(g=>v2Card(g.n+' · 產品項目',g.tip||'每項產品可獨立設定收費類型及費率。',`${g.combo?`<div class="toolbar">${g.combo.map(c=>`<label class="check"><input type="checkbox" data-v2-combo="${g.k+'|'+c}" ${v2Model().combo[g.k+'|'+c]?'checked':''}>${esc(c)}</label>`).join('')}</div>`:''}<div class="v2-product-grid">${g.rows.map((r,i)=>{const key=v2RowKey(g,i),st=v2Model().rates[key];return `<div class="v2-product ${st.on?'selected':''}"><label class="check"><input type="checkbox" data-v2-product="${key}" ${st.on?'checked':''}>${esc(r.n)}</label><div class="v2-product-foot"><div><span class="hint">${r.mode==='INST'?'分期':r.mode==='PER'?'按筆':r.ct?esc(st.ct):''}</span><small>${esc(v2FeeSummary(r,st))}</small></div>${r.mode!=='NONE'?btn('設定費率','v2-fee','',`data-key="${key}" ${st.on?'':'disabled'}`):''}</div>${r.note?`<p class="hint">${esc(r.note)}</p>`:''}</div>`;}).join('')}</div>`)).join('');
  return html+v2FormSections(3);
}
function v2FeeInputs(prefix,values,fields=[['rate','費率（%）','0.00'],['fix','每筆費用（HKD）','0.00'],['min','保底（HKD）','0'],['max','封頂（HKD）','0']],disabled=false) {
  return `<div class="v2-fee-grid">${fields.map(([k,l,d])=>{const key=prefix?prefix+'_'+k:k;return `<div class="field"><label for="fee-${key}">${l} <span class="required">*</span></label><input id="fee-${key}" data-v2-fee-field="${key}" inputmode="decimal" value="${esc(values[key]??d)}" ${disabled?'disabled':''}></div>`;}).join('')}</div>`;
}
function v2FeeModal(key,keep=false) {
  const [gk,idx]=key.split('|'),g=v2Groups.find(g=>g.k===gk),r=g.rows[+idx];if(!keep)v2FeeEdit={key,...structuredClone(v2Model().rates[key])};const st=v2FeeEdit,v=st.v;
  let html=`<p class="hint">只修改目前產品；所有金額以 HKD 計算。儲存後才會套用，取消保留原費率。</p>`;
  if(r.ct)html+=`<div class="field"><label for="v2-pricing">收費類型 <span class="required">*</span></label><select id="v2-pricing">${(r.wal?['Wallet','Blended']:['Regional','Blended']).map(x=>`<option ${st.ct===x?'selected':''}>${x}</option>`).join('')}</select></div>`;
  if(r.mode==='INST')html+=V2.catalog.TENORS.map(t=>`<section class="v2-fee-section"><label class="check"><input type="checkbox" data-v2-term="${t}" ${v['t'+t+'_on']?'checked':''}>${t} 期</label>${v2FeeInputs('t'+t,v,[['rate','費率（%）','0.00'],['fix','固定費用（HKD）','0']],!v['t'+t+'_on'])}</section>`).join('');
  else if(r.mode==='PER')html+=v2FeeInputs('',v,[['per_fix','每筆費用（HKD）','0.00']]);
  else {
    if(st.ct==='Regional'){if(r.pref)html+=`<section class="v2-fee-section"><label class="check"><input type="checkbox" id="v2-pref" ${v.pref_on?'checked':''}>啟用優惠費率</label>${v2FeeInputs('pref',v,undefined,!v.pref_on)}</section>`;html+=['loc','crs'].map((p,i)=>`<section class="v2-fee-section"><h3>${i?'跨境卡':'本地卡'}</h3>${v2FeeInputs(p,v)}</section>`).join('');}
    else if(st.ct==='Wallet')html+=['cn','hk'].map((p,i)=>`<section class="v2-fee-section"><h3>${i?'香港錢包':'國內錢包'}</h3>${v2FeeInputs(p,v)}</section>`).join('');
    else html+=v2FeeInputs('std',v);
    if(r.dcc)html+=`<section class="v2-fee-section"><h3>DCC 交易</h3><p class="hint">${v2Model().combo[gk+'|DCC交易']?'DCC 已啟用':'請先在產品頁勾選 DCC 交易後設定'}</p>${v2FeeInputs('dcc',v,[['rate','DCC（%）','0.00'],['fix','每筆費用（HKD）','0.00'],['markup','Markup（%）','0.00']],!v2Model().combo[gk+'|DCC交易'])}</section>`;
    if(r.upi)html+=`<div class="field"><label for="v2-upi">開通優計劃</label><select id="v2-upi"><option value="N" ${v.upi!=='Y'?'selected':''}>否</option><option value="Y" ${v.upi==='Y'?'selected':''}>是</option></select></div>`;
  }
  modal(esc(r.n)+' · 費率設定',html+'<p id="v2-fee-error" class="error" role="alert"></p>',btn('取消','close')+btn('儲存費率','v2-fee-save','primary'));
}
function v2CaptureFees() {$$('[data-v2-fee-field]').forEach(i=>{if(!i.disabled)v2FeeEdit.v[i.dataset.v2FeeField]=i.value;});if($('#v2-upi'))v2FeeEdit.v.upi=$('#v2-upi').value;}
function v2FeeErrors(r,st) {
  const e=[],v=st.v,number=(k,d,percent=false)=>{const raw=String(v[k]??d);if(!/^\d+(\.\d{1,2})?$/.test(raw)||Number(raw)<0||percent&&Number(raw)>100)e.push('請填寫有效的'+(percent?' 0–100 費率':'非負金額')+'（最多 2 位小數）');};
  const line=p=>{number(p+'_rate','0',true);for(const k of ['fix','min','max'])number(p+'_'+k,'0');if(+v[p+'_max']>0&&+v[p+'_min']>+v[p+'_max'])e.push('保底不可大於封頂');};
  if(r.mode==='NONE')return e;if(r.mode==='INST'){const terms=V2.catalog.TENORS.filter(t=>v['t'+t+'_on']);if(!terms.length)e.push('請至少選擇一個分期期數');for(const t of terms){number('t'+t+'_rate','0',true);number('t'+t+'_fix','0');}}
  else if(r.mode==='PER')number('per_fix','0');else {for(const p of st.ct==='Regional'?['loc','crs']:st.ct==='Wallet'?['cn','hk']:['std'])line(p);if(r.pref&&st.ct==='Regional'&&v.pref_on)line('pref');if(r.dcc&&v2Model().combo['POS|DCC交易']){number('dcc_rate','0',true);number('dcc_fix','0');number('dcc_markup','0',true);}}
  return [...new Set(e)];
}
const v2Label=k=>(v2ById[k.replace(/\[\d+\]/,'[]')]?.label||'資料欄位').split(/\s{2,}/)[0].replace(/\s*\*/g,'');
const v2MissingDocs=()=>V2.documents.filter(d=>v2FileRequired()[d.id]&&(!state.files[d.id]||state.files[d.id].needsReselect));
function v2Consistency() {
  const list=[],add=(key,title,values,step,hard=false)=>{const filled=values.filter(x=>x[1]);if(filled.length<2)return;const same=filled.every(x=>v2NormalizeName(x[1])===v2NormalizeName(filled[0][1]));const fingerprint=JSON.stringify(filled);list.push({key,title,values:filled,step,hard,same,fingerprint,confirmed:!same&&v2Model().ack[key]?.fingerprint===fingerprint});};
  if(v2Raw('isCompay')==='Y')add('bank-name','公司英文名稱與對公帳戶名稱',[['商戶',v2Raw('merchantEnglishName')],['銀行帳戶',v2Raw('cardName')]],4);
  for(const o of v2Model().ocr.filter(o=>o.applied))add('ocr-'+o.key,v2Label(o.key)+' · 文件與表單',[['已核對辨識',o.applied],['目前表單',v2Raw(o.key)]],o.step||2);
  return list;
}
function v2ConsistencyCard() {
  const list=v2Consistency();return v2Card('資料一致性檢查','比較本次表單及已套用的辨識結果；尚未提供的文件不代表已完成核實。',list.length?`<div class="v2-consistency">${list.map(c=>`<div class="v2-check-row"><div><strong>${esc(c.title)}</strong><small>${c.values.map(([l,v])=>esc(l)+'：'+esc(v)).join('／')}</small></div>${pill(c.same?'一致':c.confirmed?'已確認差異':'待核對',c.same?'green':c.confirmed?'blue':'amber')}${!c.same?btn('查看差異','v2-difference','',`data-key="${esc(c.key)}"`):''}</div>`).join('')}</div>`:'<p class="hint">尚未有足夠資料可比對。可先填寫表單，或匯入 BR 核對後套用。</p>');
}
function v2BrStatus(){const count=v2Model().ocr.filter(o=>o.applied&&/BR/.test(o.source)).length;return `<section class="v2-br-status"><div><p>${count?'已從 BR 帶入 '+count+' 個欄位，請繼續核對':'尚未匯入 BR，可先手動填寫'}</p><small>BR 可預填名稱、證書資料、完整地址及業務性質；MCC、地區及聯絡方式需另行填寫。</small></div>${btn(count?'查看辨識來源':'匯入 BR 並辨識',count?'br-sources':'br-start')}</section>`;}
function v2Documents() {
  const miss=v2MissingDocs(),req=requiredFiles(),log=v2Model().ocr;
  return `<section class="br-callout"><div><h2>文件上傳與識別</h2><p>先匯入 BR，在 Overlay 核對後帶入 Step 2 主體資料及 Step 3 經營與聯繫。</p><small>BR 支援 PDF、JPG、PNG，文件僅在瀏覽器本機辨識；其他文件提供示例流程。</small></div><div>${btn('匯入 BR','br-start','primary')}${btn('多文件辨識示例','v2-ocr')}</div></section>`+v2Card('辨識結果及來源','只會套用你已核對並選取的欄位；低信心或無法辨識的項目不會自動寫入。',log.length?`<div class="table-scroll"><table><thead><tr><th>欄位</th><th>核對內容</th><th>辨識來源</th><th>狀態</th></tr></thead><tbody>${log.map(o=>`<tr><td>${esc(v2Label(o.key))}</td><td>${esc(o.value)}</td><td>${esc(o.source)}${o.confidence==null?'':' · 示例信心 '+o.confidence+'%'}</td><td>${pill(o.applied?'已套用':'待核對',o.applied?'green':'amber')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="hint">尚未匯入文件，可先手動填寫。</p>')+v2ConsistencyCard()+v2Card('必交文件檢查','必交清單會隨法律主體、風險級別、產品及董事／股東設定更新。',`<div class="notice ${miss.length?'warn':''}">${req.length-miss.length}／${req.length} 項必交文件已備妥${miss.length?'；仍缺 '+miss.length+' 項':''}</div>${miss.length?'<ul class="v2-missing">'+miss.map(d=>`<li>${esc(d.name.split('\n')[0])}</li>`).join('')+'</ul>':''}`)+v2Card('文件材料','PDF／JPG／PNG／ZIP，每檔上限 10 MB。多頁或多位董事資料可合併為 PDF／ZIP；本機附件不會上傳。',`<div class="upload-list">${V2.documents.map(d=>uploadRow(d)).join('')}</div>`);
}
function v2ValidateFields(index) {
  const errors={},required=v2Required();
  for(const s of V2.forms[index].sections)for(const f of s.fields.filter(v2Visible)){
    const group=f.id.includes('[]')?f.id.split('[')[0]:null;
    for(let i=0;i<(group?state.people[group]:1);i++){
      const k=f.id.replace('[]',`[${i}]`),v=v2Raw(k),name=v2Label(k),personKey=k.split('.').pop();
      const req=required.has(k)||(group&&(['name','firstNameEn','lastNameEn','idcardType','idcardNo'].includes(personKey)||group==='authSigners'&&personKey==='birthDay'));
      if(req&&!v){errors[k]='請填寫'+name;continue;}if(!v)continue;
      if(f.type==='Select'&&k!=='cardBankCode'&&!v2Options(f.id).some(o=>o[0]===v))errors[k]='請重新選擇有效的'+name;
      if(f.max&&v.length>+f.max)errors[k]=name+'不可超過 '+f.max+' 個字元';
      if(['merchantName','merchantShortName'].includes(k)&&new TextEncoder().encode(v).length>100)errors[k]='中文名稱上限 100 bytes，請縮短內容';
      if((/English/.test(k)||['firstNameEn','lastNameEn'].includes(personKey))&&!/^[\x20-\x7E]+$/.test(v))errors[k]='請使用英文、數字及英文標點';
      if(/Email$/.test(k)&&!/^\S+@\S+\.[a-z]{2,}$/i.test(v))errors[k]='請輸入有效電郵地址';
      if(/Phone$/.test(k)&&!/^\+\d{7,15}$/.test(v.replace(/[\s-]/g,'')))errors[k]='請填寫含國際區號的電話，例如 +852 6123 4567';
      if((/Period$|birthDay$/.test(k)&&!['settlePeriod','licencePeriod'].includes(k))&&!/^\d{4}-\d{2}-\d{2}$/.test(v))errors[k]='請選擇有效日期';
      if(personKey==='birthDay'&&v2DateDays(v)>0)errors[k]='出生日期不能是未來日期';
      if(personKey==='idcardNoPeriod'&&v2DateDays(v)<0)errors[k]='證件已到期，請更新';
      if(k==='mcc'&&!/^\d{4}$/.test(v))errors[k]='請輸入 4 位 MCC 行業代碼';
      if(k==='registerCertNo'&&v2Raw('addrCountryCode')==='HKG'&&!/^\d{8}-?\d{3}$/.test(v))errors[k]='香港 BR 格式為 8 位數字及 3 位分支碼';
      if(k==='registerCertPeriod'&&v2DateDays(v)<30)errors[k]='BR 有效期不足 30 天；仍可儲存草稿';
      if(k==='nar1Period'&&v2DateDays(v)<30)errors[k]='NAR1 有效期不足 30 天，請提供最新周年申報表';
      if(k==='merchantAgreementPeriod'&&v2DateDays(v)<0)errors[k]=name+'已到期，請核對';
      if(k==='webUrl'&&!/^https?:\/\/\S+\.\S+$/i.test(v))errors[k]='請輸入包含 https:// 的有效網站';
      if(k==='settlePeriod'&&!/^[TD]\d{1,2}$/.test(v))errors[k]='結算週期格式：T1、T2、T7 或 D1';
      if(k==='swiftCode'&&!/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(v))errors[k]='SWIFT Code 為 8 或 11 位大寫英文／數字（選填）';
      if(k==='cardBankCode'&&v2Raw('cardCountryCode')==='HKG'&&!/^\d{3}$/.test(v))errors[k]='香港銀行代碼須為 3 位數字';
      if(k==='cardBranchCode'&&v2Raw('cardCountryCode')==='HKG'&&!/^\d{3}$/.test(v))errors[k]='香港分行代碼須為 3 位數字（選填）';
      if(k==='cardNo'&&!/^[A-Za-z0-9 -]{6,34}$/.test(v))errors[k]='請填寫有效銀行帳號（6–34 位英文或數字）';
      if(/Amount$|Rate$|Ratio$|Cycle$|Price$|Fix$|^markup$|^minStlAmt$/.test(k)){
        if(!/^\d+(\.\d{1,2})?$/.test(v))errors[k]='請輸入非負數值，最多 2 位小數';
        if(/Rate$|Ratio$|^markup$/.test(k)&&+v>100)errors[k]='比例或費率不可超過 100%';
        if(/Cycle$/.test(k)&&(!/^\d+$/.test(v)||+v>180))errors[k]='週期須為 0–180 的整數天數';
      }
    }
  }
  return errors;
}
validateStep=function(step){
  v2Ensure();v2SyncDerived();const e=step===1?{}:step<=5?v2ValidateFields(({2:0,3:1,4:2,5:3})[step]):{};
  if(step===1)for(const d of v2MissingDocs())e['file-'+d.id]='請提供'+d.name.split('\n')[0];
  if(step===2){if(!state.people.directors)e._directors='請至少新增一位董事';if(v2Amex()&&state.people.authSigners!==1)e._auth='香港／新加坡開通 AMEX 時，須有且僅有一位授權簽名人';}
  if(step===3){if(!state.emailVerified)e.contactEmail=e.contactEmail||'請完成電郵模擬驗證';if(v2Num('avgPerAmount')>v2Num('maxAmount'))e.maxAmount='最高消費金額不可小於平均單筆金額';}
  if(step===4&&v2Raw('isCompay')==='N'&&!Array.from({length:state.people.directors},(_,i)=>v2Raw(`directors[${i}].idcardNo`)).includes(v2Raw('cardIdcardNo')))e.cardIdcardNo='對私結算持有人須為已登記董事，證件號碼必須一致';
  if(step===5){
    if(!v2Rows().length)e._products='請至少選擇一項產品';
    for(const x of v2Rows()){const err=v2FeeErrors(x.r,x.st);if(err.length)e['_fee-'+x.key]=x.g.n+'／'+x.r.n+'：'+err.join('；');}
    for(const [ratio,cycle] of [['depositRatio','depositCycle'],['posCashDepRatio','posDepCycle'],['onQRDepRatio','onQRDepCycle'],['inQRDepRatio','inQRDepCycle']])if(v2Num(ratio)>0&&v2Num(cycle)<1)e[cycle]='比例大於 0 時，釋放週期須為 1–180 天';
    for(const [brand,s] of Object.entries(v2Model().sme))if(s.on&&!v2SmeOptions(brand).includes(s.type))e['_sme-'+brand]=brand+' 特計類型不適用目前 MCC，請重新選擇';
  }
  if(step===6){if(v2Score().reject)e._risk='風控阻擋：'+v2Score().reject+'（Demo）';for(const c of v2Consistency())if(!c.same&&!c.confirmed)e['_check-'+c.key]=c.title+'有差異，請核對並確認原因';}
  return e;
};
validateAll=()=>Object.assign({},...[1,2,3,4,5,6].map(validateStep));
productChecks=()=>v2Rows().map(x=>({id:x.key,label:x.g.n+'／'+x.r.n}));
function v2Review() {
  const errors=validateAll(),missing=Object.keys(errors).length;
  const signals=[['sanction','制裁／PEP 命中'],['cardlink','銀行帳號關聯其他商戶'],['frozen','關聯已凍結／關閉商戶'],['virtual','虛擬辦公室／無實體店'],['prepaid','預付／儲值／預售'],['ocr','OCR 與人工修改差異較大']];
  let html=v2Card('提交前檢查','按更新後的 V2 欄位、條件文件及產品配置檢查。',`<div class="notice ${missing?'warn':''}">${missing?'尚有 '+missing+' 項資料需要確認':'✓ 必填資料已填寫 · ✓ 文件已備妥 · ✓ 電郵已驗證（模擬）'}</div>${missing?'<ul class="v2-missing">'+[1,2,3,4,5,6].map(s=>{const e=Object.values(validateStep(s));return e.length?`<li>${btn('Step '+s+' '+steps[s-1]+' · '+e.length+' 項','step','text-button',`data-step="${s}"`)}<small>${esc(e.slice(0,3).join('；'))}${e.length>3?'……':''}</small></li>`:'';}).join('')+'</ul>':''}`);
  html+=v2Card('風控示例設定','以下為可切換的 Demo 狀態，不會查詢真實制裁名單或銀行資料。',`<div class="check-grid">${signals.map(([key,label])=>`<label class="check"><input type="checkbox" data-v2-signal="${key}" ${v2Model().signals[key]?'checked':''}>${label}</label>`).join('')}</div>`+v2RiskSummary())+v2ConsistencyCard();
  for(const [idx,step] of [[0,2],[1,3],[2,4],[3,5]]){
    html+=v2Card(steps[step-1],'',`<div class="toolbar">${btn('返回修改','step','',`data-step="${step}"`)}</div><div class="v2-summary">${V2.forms[idx].sections.flatMap(s=>s.fields.filter(v2Visible).flatMap(f=>{const group=f.id.includes('[]')?f.id.split('[')[0]:null;return Array.from({length:group?state.people[group]:1},(_,i)=>{const key=f.id.replace('[]',`[${i}]`),raw=v2Raw(key);if(!raw)return '';return `<div><dt>${group?esc(s.name)+' '+(i+1)+' · ':''}${esc(v2Label(key))}</dt><dd>${esc(key==='cardNo'?mask(raw):v2Display(f.id,raw))}</dd></div>`;});})).join('')}</div>`+(step===5?`<h3>已選 ${v2Rows().length} 項產品</h3><div class="v2-summary">${v2Rows().map(x=>`<div><dt>${esc(x.g.n+'／'+x.r.n)}</dt><dd>${esc(v2FeeSummary(x.r,x.st))}</dd></div>`).join('')}</div>`:''));
  }
  html+=v2Card('文件材料','',`<div class="toolbar">${btn('返回修改','step','',`data-step="1"`)}</div><div class="v2-summary">${V2.documents.filter(d=>state.files[d.id]||v2FileRequired()[d.id]).map(d=>`<div><dt>${esc(d.name.split('\n')[0])}</dt><dd>${esc(state.files[d.id]?.name||'尚未提供')}${state.files[d.id]?.needsReselect?'（須重新選取）':''}</dd></div>`).join('')}</div>`);
  html+=v2Card('帳單名稱預覽','建議使用全大寫「品牌名*城市」，25 字元內。',`<div class="statement">${esc(v2Raw('merchantEnglishShortName')||'尚未填寫')}</div>`)+v2Card('聲明及確認','此 Demo 只產生本機申請紀錄，不會向正式平台提交。',check({id:'613:4956',label:'我已核對申請資料，並確認獲授權代表此商戶提交。'}));return html;
}
application=function(step){v2Ensure();v2SyncDerived();return `<div class="v2-form" data-schema="oats-v2">${demoBar(true)}<div class="v2-version">OATS V2 · 六步申請流程</div>${v2Model().legacy?'<div class="notice warn">已保留舊草稿內容。欄位及產品規則已更新至 V2，請重新核對選項、產品費率及新增必填資料。</div>':''}${state.editing?`<div class="notice">正在編輯 ${esc(state.editing)} 的模擬資料</div>`:''}${state.errors._form?`<div class="notice error" role="alert">${esc(state.errors._form)}<ul>${Object.entries(state.errors).filter(([k])=>k.startsWith('_')&&k!=='_form').map(([,v])=>`<li>${esc(v)}</li>`).join('')}</ul></div>`:''}${[2,3].includes(step)?v2BrStatus():''}${step===1?v2Documents():step===5?v2Products():step===6?v2Review():v2FormSections(step-2)}<datalist id="v2-mcc">${V2.catalog.MCCS.map(m=>`<option value="${m.c}">${esc(m.n)}</option>`).join('')}</datalist><datalist id="v2-banks">${[['004','滙豐銀行'],['003','渣打銀行'],['012','中國銀行（香港）'],['024','恒生銀行'],['015','東亞銀行'],['016','星展銀行（香港）']].map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</datalist><datalist id="v2-settlement">${['T1','T2','T3','T7','D1'].map(v=>`<option>${v}</option>`).join('')}</datalist></div>`;};
fillSample=function(row){
  const existing=row;row=row||rows[0];
  v2Reset();const future=n=>{const d=new Date();d.setFullYear(d.getFullYear()+n);return d.toISOString().slice(0,10);};
  Object.assign(state.values,{legalStatus:'BODY_CORPORATE',merchantName:row['客戶中文名稱']||'海港科技有限公司',merchantShortName:'海港示例',merchantEnglishName:row['客戶英文名稱']||'SAMPLE HARBOUR LIMITED',merchantEnglishShortName:'HARBOUR*HK',dbaNo:row['DBA no.']||'DEMO-DBA-001',registerCertNo:'12345678-000',registerCertName:row['客戶英文名稱']||'SAMPLE HARBOUR LIMITED',registerCertPeriod:future(2),crCode:'7654321',nar1Period:future(1),registerCapital:'04',licencePeriod:'04',workerNumber:'03',addrCountryCode:'HKG',addrProvinceCode:'HK-HKI',addrStreet:'香港中環示例道 88 號（假資料）',addrStreetEn:'88 SAMPLE ROAD, CENTRAL, HONG KONG',mcc:'5812',avgPerAmount:'250.00',maxAmount:'3000.00',avgMonthAmount:'100000.00',contactName:'陳示例',contactPhone:'+85261234567',contactEmail:'merchant@example.com',maintainerName:'林示例',maintainerEmail:'maintainer@example.com',developer:BO.user?.agencyCode||'MA-001',developerEmail:'agency@example.com',cardProvinceCode:'HKG',cardBankName:'滙豐銀行',cardBankCode:'004',cardBranchCode:'812',cardName:row['客戶英文名稱']||'SAMPLE HARBOUR LIMITED',cardNo:'004812345678838',cardAddress:'1 SAMPLE ROAD, HONG KONG',swiftCode:'HSBCHKHHHKH',webUrl:'https://example.com',remark:'純演示資料，不是真實商戶。'});
  if(existing){
    for(const [key,column] of [['mcc','MCC 行業代碼'],['cardBankName','銀行名稱'],['cardBankCode','銀行代碼'],['cardBranchCode','分行代碼'],['contactName','客戶聯繫人'],['contactPhone','聯絡人電話'],['contactEmail','聯絡人電郵']])if(existing[column]!==undefined)state.values[key]=String(existing[column]);
    const br=String(existing.BR||'').replace(/^BR\s*/, '');if(br)state.values.registerCertNo=/^\d{8}$/.test(br)?br+'-000':br;
    if(existing['BR 有效期'])state.values.registerCertPeriod=existing['BR 有效期'].replaceAll('/','-');if(existing.bank)state.values.cardNo=existing.bank;v2Model().legacy=true;
  }
  for(const [key,val] of Object.entries({name:'陳示例',firstNameEn:'DEMO',lastNameEn:'CHAN',idcardType:'01',idcardNo:'Z123456(0)',idcardNoPeriod:future(4),birthDay:'1990-01-01'}))state.values['directors[0].'+key]=val;
  v2SetGroup('POS',true);for(const r of Object.values(v2Model().rates))r.on=false;
  v2Model().rates['POS|0']={on:true,ct:'Regional',v:{loc_rate:'1.50',loc_fix:'0.00',loc_min:'0',loc_max:'0',crs_rate:'2.50',crs_fix:'0.00',crs_min:'0',crs_max:'0'}};
  state.files['101401']={name:'DEMO-storefront.png',demo:true};v2SyncDerived();for(const id of requiredFiles())state.files[id]={name:'DEMO-'+id+'.pdf',size:1024,demo:true};state.emailVerified=true;v2SyncDerived();
};
// The independent BR tool remains unchanged; the backoffice entry uses only V2 fields.
const v2OldBrStart=actions['br-start'];
actions['br-start']=()=>{v2OldBrStart();DEMO.br.values=[['merchantName','中文名稱','海港科技有限公司'],['merchantEnglishName','英文名稱','SAMPLE HARBOUR TECHNOLOGY LIMITED'],['registerCertName','註冊證書名稱','SAMPLE HARBOUR TECHNOLOGY LIMITED'],['registerCertNo','BR 號碼','12345678-000'],['registerCertPeriod','證書有效期','2028-08-31'],['legalStatus','法律地位','BODY_CORPORATE'],['registerCertType','證書類型','01']];};
brReview=function(ready=false){const b=DEMO.br;b.phase=ready?'ready':'review';modal(ready?'已核對，準備套用':'核對辨識結果',`<p class="hint">${esc(b.filename)} · 固定示例辨識結果，並非讀取上傳文件。</p><div class="br-fields">${b.values.map(([k,l,v])=>`<div class="field"><label for="br-${k}">${l}</label>${V2.options[k]?`<select id="br-${k}" data-br-field="${k}" ${ready?'disabled':''}>${V2.options[k].map(([val,label])=>`<option value="${val}" ${v===val?'selected':''}>${label}</option>`).join('')}</select>`:`<input id="br-${k}" data-br-field="${k}" value="${esc(v)}" ${ready?'readonly':''}>`}</div>`).join('')}</div><div class="notice warn">仍待核對：英文營業地址；無法辨識：BR 繳款日期。這些項目不會帶入。</div>${ready?'<p class="br-status">已核對，可套用；地址仍待確認。</p>':'<label class="check"><input type="checkbox" id="br-checked">我已核對以上 7 個欄位，確認可套用。</label>'}<p id="br-error" class="error"></p>`,btn('取消，保留原資料','close')+btn(ready?'確認並套用 7 個欄位':'已核對，準備套用',ready?'br-apply':'br-ready','primary'));};
function v2ImportResult(imported,pending,unrecognized=[],done='close',unchanged=[]) {
  const list=items=>`<ol>${items.map(item=>`<li>${esc(item)}</li>`).join('')}</ol>`;
  modal(imported.length?'已成功寫入申請資料':'已完成匯入核對',`<div class="v2-import-result" data-figma-node="948:6768"><section class="v2-import-success"><h3>完成匯入 · ${imported.length} 個欄位已帶入</h3>${imported.length?list(imported):'<p>本次沒有需要新增或取代的欄位。</p>'}${unchanged.length?'<p>'+unchanged.length+' 個欄位與目前表單一致，已保留原值。</p>':''}</section><section class="v2-import-pending"><h3>仍待核對 · ${pending.length} 個欄位未帶入</h3>${pending.length?list(pending):'<p>本次沒有仍待核對的欄位。</p>'}</section><section class="v2-import-unrecognized"><h3>無法辨識</h3>${unrecognized.length?list(unrecognized):'<p>本次沒有無法辨識的欄位。</p>'}</section><p class="v2-import-note">尚未帶入的項目不會覆蓋原有資料。按「完成」返回申請表後，可繼續核對及補充。</p></div>`,btn('完成',done,'primary'));
  $('#modal .modal-head [data-action="close"]').remove();
}
brResult=function(){const b=DEMO.br;v2ImportResult(b.values.map(([k,l,v])=>`${l}：${k==='registerCertPeriod'?v.replaceAll('-','/'):v2Display(k,v)}`),['英文地址：請對照 BR 原件核對完整地址後，再手動填寫。']);};
function v2OcrStart(){v2OcrEdit=null;modal('多文件辨識（模擬）','<div class="notice warn">使用固定假資料演示，沒有 OCR 服務，選取的文件不會上傳。</div><p>可選擇多份空白測試文件，或直接使用示例。</p><input id="v2-ocr-files" type="file" multiple accept=".pdf,.png,.jpg,.jpeg"><p class="hint">PDF／PNG／JPG，每檔不超過 10 MB。</p>',btn('取消','close')+btn('使用示例辨識','v2-ocr-recognize','primary'));}
function v2OcrReview(ready=false){modal(ready?'已核對，準備套用':'核對辨識結果',`<div class="notice warn">以下全為示例資料，請確認選取欄位。低信心地址先保留，不會帶入。</div><div class="v2-ocr-list">${v2OcrEdit.map((o,i)=>`<label><input type="checkbox" data-v2-ocr-item="${i}" ${o.selected?'checked':''} ${ready||o.confidence<80?'disabled':''}><span><strong>${esc(v2Label(o.key))}</strong><small>${esc(o.value)}</small><small class="hint">${o.source} · 信心 ${o.confidence}%${o.confidence<80?' · 仍待核對':''}</small></span></label>`).join('')}</div><p class="hint">${ready?'已核對的欄位可套用；地址仍待確認。':'請勾選已確認可套用的資料，未選項目保留原值。'}</p><p id="v2-ocr-error" class="error" role="alert"></p>`,btn('取消，保留原資料','close')+btn(ready?'確認並套用':'已核對，準備套用',ready?'v2-ocr-apply':'v2-ocr-ready','primary'));}
function v2OcrRecognize(){
  const files=[...($('#v2-ocr-files')?.files||[])];if(files.some(f=>f.size>10485760||!/\.(pdf|png|jpe?g)$/i.test(f.name)))return toast('請選擇每檔 10 MB 以下的 PDF／PNG／JPG');
  modal('辨識中','<div class="progress-demo"></div><p>正在載入固定示例，未讀取或分析文件內容。</p>','');
  setTimeout(()=>{if(!$('#modal').open)return;if(state.fail)return modal('暫時無法辨識文件','<div class="notice warn">模擬辨識失敗，尚未寫入任何資料。</div>',btn('手動填寫','close')+btn('重試','v2-ocr','primary'));
    v2OcrEdit=[['merchantName','海港科技有限公司','BR',2],['merchantEnglishName','SAMPLE HARBOUR TECHNOLOGY LIMITED','BR',2],['registerCertName','SAMPLE HARBOUR TECHNOLOGY LIMITED','BR',2],['registerCertNo','12345678-000','BR',2],['registerCertPeriod','2028-08-31','BR',2],['crCode','7654321','CI',2],['nar1Period','2028-08-31','NAR1',2],['directors[0].name','陳示例','NAR1',2],['directors[0].idcardNo','Z123456(0)','身份證',2],['directors[0].birthDay','1990-01-01','身份證',2],['cardName','SAMPLE HARBOUR TECHNOLOGY LIMITED','銀行月結單',4],['cardNo','004812345678838','銀行月結單',4],['addrStreetEn','88 SAMPLE ROAD, HONG KONG','BR',3]].map(([key,value,source,step],i)=>({key,value,source:'示例 '+source,step,confidence:i===12?65:98,selected:i!==12}));v2OcrReview();},400);
}
submit=function(){if(!can(1))return deny();const errors=validateAll();if(Object.keys(errors).length){const step=[1,2,3,4,5,6].find(s=>Object.keys(validateStep(s)).length);showErrors(validateStep(step),step);return;}
  if(!state.checks['613:4956'])return toast('請先勾選聲明及確認');
  if(state.fail)return modal('申請提交失敗','<div class="notice error">本次模擬提交未成功，所有輸入及文件記錄仍保留。</div><p>可關閉失敗模擬後重試，或先儲存草稿。</p>',btn('返回檢閱','close')+btn('儲存草稿','save-draft')+btn('重試提交','submit','primary'));
  modal('確認提交申請',`<p>將為「${esc(v2Raw('merchantName'))}」建立本機模擬申請。</p><p class="hint">不會連接 All-In Pay、發送電郵或上傳文件。</p>`,btn('取消','close')+btn('確認提交（模擬）','confirm-submit','primary'));
};actions.submit=submit;
Object.assign(actions,{
  'confirm-clear':()=>{v2Reset();$('#modal').close();render();},
  'v2-add-person':el=>{const g=el.dataset.group;if(g==='authSigners'&&v2Amex()&&state.people[g]>=1)return toast('此情境只可有一位授權簽名人');state.people[g]++;render();},
  'v2-remove-person':el=>{const g=el.dataset.group,i=+el.dataset.index,n=state.people[g];if(g==='directors'&&n===1)return toast('董事至少保留一位');for(let j=i;j<n-1;j++)for(const k of v2PersonKeys)state.values[`${g}[${j}].${k}`]=state.values[`${g}[${j+1}].${k}`]||'';for(const k of v2PersonKeys)delete state.values[`${g}[${n-1}].${k}`];state.people[g]--;if(g==='directors'){for(const links of Object.values(v2Model().links))for(const key of Object.keys(links))if(links[key]===i)links[key]=null;else if(links[key]>i)links[key]--;}
    else{const links=v2Model().links[g];for(let j=i;j<n-1;j++)links[j]=links[j+1]??null;delete links[n-1];}render();},
  'v2-settlement':el=>{state.values.settlePeriod=el.dataset.value;render();},
  'v2-reset-risk':()=>{v2Model().manualRisk=false;render();},
  'v2-fee':el=>v2FeeModal(el.dataset.key),
  'v2-fee-save':()=>{v2CaptureFees();const [gk,i]=v2FeeEdit.key.split('|'),r=v2Groups.find(g=>g.k===gk).rows[+i],e=v2FeeErrors(r,v2FeeEdit);if(e.length){$('#v2-fee-error').textContent=e.join('；');return;}const {key,...data}=v2FeeEdit;v2Model().rates[key]=structuredClone(data);$('#modal').close();render();toast('此產品費率已套用，記得儲存草稿');},
  'v2-difference':el=>{const c=v2Consistency().find(c=>c.key===el.dataset.key);if(!c)return;modal('核對資料差異',`<h3>${esc(c.title)}</h3><ul>${c.values.map(([l,v])=>`<li>${esc(l)}：${esc(v)}</li>`).join('')}</ul><div class="field"><label for="v2-difference-reason">確認差異原因 <span class="required">*</span></label><textarea id="v2-difference-reason" maxlength="500" rows="3">${esc(v2Model().ack[c.key]?.reason||'')}</textarea></div><p class="hint">確認只針對目前資料；相關內容再次修改後須重新核對。</p><p id="v2-difference-error" class="error"></p>`,btn('返回修改','step','',`data-step="${c.step}"`)+btn('確認差異','v2-ack','primary',`data-key="${esc(c.key)}"`));},
  'v2-ack':el=>{const reason=$('#v2-difference-reason').value.trim();if(!reason){$('#v2-difference-error').textContent='請填寫確認原因';return;}const c=v2Consistency().find(c=>c.key===el.dataset.key);v2Model().ack[c.key]={fingerprint:c.fingerprint,reason};$('#modal').close();render();},
  'v2-ocr':v2OcrStart,'v2-ocr-recognize':v2OcrRecognize,
  'v2-ocr-ready':()=>{if(!v2OcrEdit.some(o=>o.selected)){$('#v2-ocr-error').textContent='請至少選取一個已核對欄位';return;}v2OcrReview(true);},
  'v2-ocr-apply':()=>{if(state.fail)return modal('資料寫入失敗','<div class="notice error">尚未寫入，原有申請內容保留。關閉失敗模擬後可重新核對。</div>',btn('返回核對','v2-ocr-back','primary')+btn('取消','close'));const selected=v2OcrEdit.filter(o=>o.selected);for(const o of selected){state.values[o.key]=o.value;o.applied=o.value;}v2Model().ocr=structuredClone(v2OcrEdit);v2SyncDerived();modal('已成功寫入申請資料',`<div class="notice">${selected.length} 個欄位已帶入</div><div class="import-result"><section><h3>完成匯入</h3><ol>${selected.map(o=>`<li>${esc(v2Label(o.key))}：${esc(o.value)}</li>`).join('')}</ol></section><section><h3>仍待核對 · 未帶入</h3><ol>${v2OcrEdit.filter(o=>!o.selected).map(o=>`<li>${esc(v2Label(o.key))}：${esc(o.value)}</li>`).join('')||'<li>沒有待核對項目</li>'}</ol><h3>無法辨識 · 未帶入</h3><p>商業登記證繳款日期（示例）。</p></section></div><p class="hint">示例不會代替必交文件，請返回文件材料補齊。</p>`,btn('完成','v2-ocr-done','primary'));},
  'v2-ocr-back':()=>v2OcrReview(),'v2-ocr-done':()=>{$('#modal').close();render();}
});
const v2OldRestore=actions.restore;actions.restore=el=>{v2OldRestore(el);v2Ensure();v2SyncDerived();if(route().page==='application')render();};
const v2OldEdit=actions['confirm-edit'];actions['confirm-edit']=el=>{v2OldEdit(el);v2Ensure();v2SyncDerived();if(route().page==='application')render();};
const v2Step=actions.step;actions.step=el=>{if($('#modal').open)$('#modal').close();v2Step(el);};
const v2SubmitConfirm=actions['confirm-submit'];actions['confirm-submit']=()=>{if(state.fail)return submit();v2SubmitConfirm();};
document.addEventListener('change',e=>{
  const t=e.target;if(t.dataset.v2Field){const k=t.dataset.v2Field;if(k==='riskLevel')v2Model().manualRisk=true;if(k==='settlePeriod'){state.values[k]=t.value.trim().toUpperCase();t.value=state.values[k];}v2SyncDerived();const mccName=$('[data-field="mccName"]');if(mccName)mccName.value=state.values.mccName;if(t.tagName==='SELECT'&&route().page==='application')render();}
  if(t.dataset.v2Group){v2SetGroup(t.dataset.v2Group,t.checked);render();}
  if(t.dataset.v2Product){v2Model().rates[t.dataset.v2Product].on=t.checked;render();}
  if(t.dataset.v2Combo){v2Model().combo[t.dataset.v2Combo]=t.checked;render();}
  if(t.dataset.v2Link){v2Model().links[t.dataset.v2Link][t.dataset.index]=t.checked?+t.closest('.v2-person-link').querySelector('select').value:null;render();}
  if(t.dataset.v2Director){v2Model().links[t.dataset.v2Director][t.dataset.index]=+t.value;render();}
  if(t.dataset.v2Signal){v2Model().signals[t.dataset.v2Signal]=t.checked;render();}
  if(t.dataset.v2Sme){const b=t.dataset.v2Sme;v2Model().sme[b]={on:t.checked,type:v2Model().sme[b]?.type||v2SmeOptions(b)[0]};render();}
  if(t.dataset.v2SmeType){const b=t.dataset.v2SmeType;v2Model().sme[b]={on:v2Model().sme[b]?.on||false,type:t.value};}
  if(t.id==='v2-pricing'){v2CaptureFees();v2FeeEdit.ct=t.value;v2FeeModal(v2FeeEdit.key,true);}
  if(t.id==='v2-pref'){v2CaptureFees();v2FeeEdit.v.pref_on=t.checked;v2FeeModal(v2FeeEdit.key,true);}
  if(t.dataset.v2Term){v2CaptureFees();v2FeeEdit.v['t'+t.dataset.v2Term+'_on']=t.checked;v2FeeModal(v2FeeEdit.key,true);}
  if(t.dataset.v2OcrItem!==undefined)v2OcrEdit[+t.dataset.v2OcrItem].selected=t.checked;
});
// Updated, read-only QA inventory. All form mutations remain in the visible UI.
Object.assign(window.AllinPayDemo,{version:'2026.09.23-oats-v2',getOnboarding:()=>({version:2,fields:v2Fields.map(f=>f.id),documents:V2.documents.map(d=>d.id),products:v2Groups.map(g=>({key:g.k,count:g.rows.length})),errors:validateAll(),score:v2Score(),selectedProducts:v2Rows().map(x=>({key:x.key,name:x.r.n,pricing:x.st.ct,values:{...x.st.v}}))})});

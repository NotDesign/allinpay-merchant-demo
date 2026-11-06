// Bank identity, actual branch address and principal business address are separate.
const bankDirectory=new Map(BANK_DIRECTORY_DATA.banks.map(bank=>[bank.code,bank]));
const bankFormState=new WeakMap();
let bankExplicit='',bankApiState={status:'idle',records:[],message:'',updatedAt:''};
const bankApiUrl='https://api.hkma.gov.hk/public/bank-svf-info/register-ais-lros';
function bankAddressNote(bank){const branch=bankBranch(bank);return branch?'已對應 '+branch.code+' · '+branch.name+'；可按實際資料修改。':bank.branches.length?'此銀行有多個分行；請選取分行以帶入地址，或手動填寫。':'參考資料未有分行地址，請手動填寫。';}
function bankCurrent(){return v2Raw('cardCountryCode')==='HKG'?bankDirectory.get(v2Raw('cardBankCode')):null;}
function bankBranch(bank=bankCurrent()){const matches=bank?.branches.filter(b=>b.code===v2Raw('cardBranchCode'))||[];return new Set(matches.map(b=>b.address)).size===1?matches[0]:null;}
function bankAutofill(){
 if(state.readonly){bankExplicit='';return;}
 const v=state.values,key=v2Raw('cardCountryCode')+'|'+v2Raw('cardBankCode'),previous=bankFormState.get(v),explicit=bankExplicit;bankExplicit='';
 const changed=!!previous&&previous.key!==key,bank=bankCurrent();
 if(explicit==='bank'&&changed)v.cardBranchCode='';
 if(!bank){
  if(explicit==='bank'&&changed){v.swiftCode='';v.cardAddress='';if(bankDirectory.has(previous.key.split('|')[1]))v.cardBankName='';}
  else if(changed&&previous){for(const f of ['swiftCode','cardAddress'])if(v[f]===previous.auto[f])v[f]='';}
  bankFormState.set(v,{key,branch:v2Raw('cardBranchCode'),auto:{}});return;
 }
 if(explicit==='bank'){
  v.cardBankName=ONBOARDING_BANKS[bank.code];v2Model().bankCustom=false;v2Model().bankCodeCustom=false;
 }
 const auto={...(previous?.auto||{})};
 if(explicit==='bank'||!v2Raw('swiftCode')){v.swiftCode=bank.swift;auto.swiftCode=bank.swift;}
 let branch=bankBranch(bank),address=branch?.address||'';
 if(!v2Raw('cardBranchCode')&&new Set(bank.branches.map(b=>b.address).filter(Boolean)).size===1){address=bank.branches[0].address;if(bank.branches.length===1)v.cardBranchCode=bank.branches[0].code;}
 if(explicit==='bank'||explicit==='branch'&&v2Raw('cardBranchCode').length===3||!v2Raw('cardAddress')){
  if(address||explicit==='bank'||previous?.auto.cardAddress===v.cardAddress){v.cardAddress=address;auto.cardAddress=address;}
 }
 bankFormState.set(v,{key,branch:v2Raw('cardBranchCode'),auto});const source=$('.bank-address-source');if(source)source.textContent=bankAddressNote(bank);
 for(const f of ['cardAddress','swiftCode','cardBranchCode']){const el=$('[data-field="'+f+'"]');if(el&&el.value!==v2Raw(f))el.value=v2Raw(f);}
}
const bankBaseDerived=v2SyncDerived;
v2SyncDerived=function(...args){const result=bankBaseDerived.apply(this,args);bankAutofill();return result;};
// Reuse the existing picker handlers; their shared sync now fills the dependent fields.
for(const [name,handler] of [['code',clientPickBankCode],['name',usabilityPickBank]]){
 for(const type of ['input','change'])document.removeEventListener(type,handler,true);
 const wrapper=e=>{const t=e.target,hit=name==='code'?(t.hasAttribute('data-bank-code-picker')||t.hasAttribute('data-other-bank-code')):t.hasAttribute('data-bank-picker');if(hit)bankExplicit='bank';handler(e);if(hit&&t.hasAttribute('data-other-bank-code')){v2SyncDerived();if(/^\d{3}$/.test(t.value)&&ONBOARDING_BANKS[t.value])queueMicrotask(()=>render());}};
 for(const type of ['input','change'])document.addEventListener(type,wrapper,true);
}
for(const type of ['input','change'])window.addEventListener(type,e=>{if(e.target.dataset.v2Field==='cardBranchCode')bankExplicit='branch';},true);
const bankBaseField=v2Field;
v2Field=function(f,...args){
 let html=bankBaseField.call(this,f,...args);if(v2Raw('cardCountryCode')!=='HKG')return html;
 const bank=bankCurrent();
 if(f.id==='cardBranchCode'&&bank){html=html.replace(/(<input\b[^>]*data-v2-field="cardBranchCode"[^>]*)(>)/,'$1 list="bank-branch-options" autocomplete="off"$2');const end=html.lastIndexOf('</div>');html=html.slice(0,end)+`<datalist id="bank-branch-options">${bank.branches.map(b=>`<option value="${b.code}" label="${esc(b.name)}"></option>`).join('')}</datalist><small class="hint">輸入或選取 3 位分行編號，自動帶入該分行地址。</small>`+html.slice(end);}
 if(f.id==='cardAddress'){
  html=html.replace(/<input\b[^>]*data-v2-field="cardAddress"[^>]*>/,input=>input.replace(/^<input/,'<textarea').replace(/\s+type="[^"]*"/,'').replace(/\s+value="[^"]*"/,'').replace(/>$/,' rows="3" class="bank-address-input">')+esc(v2Raw('cardAddress'))+'</textarea>');
  if(bank){const end=html.lastIndexOf('</div>'),note=bankAddressNote(bank);html=html.slice(0,end)+'<small class="hint bank-address-source">'+esc(note)+'</small>'+html.slice(end);}
 }
 if(f.id==='swiftCode'&&bank){const end=html.lastIndexOf('</div>');html=html.slice(0,end)+'<small class="hint">'+(bank.swift?'已帶入 HKICL 會員 SWIFT／BIC，可按收款銀行指示修改。':'參考資料未有 SWIFT／BIC，請按銀行指示填寫。')+'</small>'+html.slice(end);}
 if(f.id==='cardBankCode'){const end=html.lastIndexOf('</div>');html=html.slice(0,end)+'<div class="bank-api-control"><button type="button" data-action="bank-hkma" '+(state.readonly||!bank?'disabled':'')+'>查詢金管局主要地址</button><small class="hint">分行：HKICL '+BANK_DIRECTORY_DATA.branchDate+' · SWIFT：'+BANK_DIRECTORY_DATA.bicDate+'</small></div>'+html.slice(end);}
 return html;
};
const bankNormalize=name=>String(name||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/^THE\s+|\s*\(THE\)$/g,'').replace(/\bLIMITED\b/g,'LTD').replace(/[^A-Z0-9]/g,'');
function bankPrincipalMatch(bank){const names=[bank.en].map(bankNormalize),matches=bankApiState.records.filter(r=>names.includes(bankNormalize(r.name)));return matches.length===1?matches[0]:null;}
function bankApiModal(){
 const bank=bankCurrent();if(!bank)return;const record=bankPrincipalMatch(bank),loading=bankApiState.status==='loading';
 modal('銀行主要業務地址',`<p><strong>${esc(ONBOARDING_BANKS[bank.code])} · ${bank.code}</strong></p><p class="hint">金管局提供的是香港主要業務地址，與開戶分行地址、BIC 登記地址及指定匯款地址不同；不會自動覆寫開戶行地址。</p>${loading?'<div class="notice" role="status">正在連接金管局…</div>':record?`<dl><dt>香港主要業務地址</dt><dd>${esc(record.local_address)}</dd><dt>銀行類別</dt><dd>${esc(record.type)}</dd></dl><p class="hint">查詢時間：${esc(bankApiState.updatedAt)}</p>`:`<div class="notice warn" role="status">${esc(bankApiState.message||'按「連接金管局」查詢最新主要業務地址。')}</div>`}<p class="hint">銀行名稱、分行地址及會員 SWIFT／BIC 可使用已內建的官方對照資料；網路失敗不影響填寫。<a href="https://apidocs.hkma.gov.hk/chi/documentation/bank-svf-info/register-ais-lros/" target="_blank" rel="noopener">資料來源</a></p>`,btn('關閉','close')+btn(loading?'連接中…':'連接金管局／重試','bank-hkma-fetch','primary',loading?'disabled':''));
}
actions['bank-hkma']=bankApiModal;
actions['bank-hkma-fetch']=async()=>{
 if(bankApiState.status==='loading')return;const values=state.values,code=v2Raw('cardBankCode');bankApiState.status='loading';bankApiModal();
 try{
  const records=[];for(let offset=0;offset<3000;offset+=1000){const response=await fetch(bankApiUrl+'?lang=en&pagesize=1000&offset='+offset,{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('HTTP '+response.status);const json=await response.json();if(json.header?.success!==true||!Array.isArray(json.result?.records))throw Error('資料格式無法確認');const page=json.result.records;if(!page.every(r=>typeof r.name==='string'&&typeof r.local_address==='string'))throw Error('缺少銀行名稱或地址');records.push(...page);if(page.length<1000)break;if(offset===2000)throw Error('資料超出預期範圍');}
  bankApiState={status:'success',records,message:'沒有找到可唯一對應的銀行；請使用原資料或向銀行確認。',updatedAt:new Date().toLocaleString('zh-HK')};
 }catch(error){bankApiState={status:'failed',records:[],message:'暫時無法連接金管局，請稍後重試。原有資料已保留；你可以繼續使用內建對照表或手動填寫。',updatedAt:''};}
 if(state.values===values&&v2Raw('cardBankCode')===code&&$('#modal[open] #modal-title')?.textContent==='銀行主要業務地址')bankApiModal();
};
const bankStyle=document.createElement('style');bankStyle.textContent='.bank-address-input{height:auto!important;min-height:84px;line-height:1.6;resize:vertical;overflow-wrap:anywhere}.bank-api-control{display:flex;align-items:flex-start;flex-direction:column;gap:8px;margin-top:8px}.bank-api-control button{padding:8px 12px;min-height:36px;font-size:13px;white-space:normal}.bank-address-source{display:block;margin-top:8px}';document.head.append(bankStyle);
Object.assign(AllinPayDemo,{getBankDirectory:()=>({banks:bankDirectory.size,branches:BANK_DIRECTORY_DATA.banks.reduce((n,b)=>n+b.branches.length,0),bics:BANK_DIRECTORY_DATA.banks.filter(b=>b.swift).length,branchDate:BANK_DIRECTORY_DATA.branchDate,bicDate:BANK_DIRECTORY_DATA.bicDate,apiStatus:bankApiState.status}),lookupBank:code=>structuredClone(bankDirectory.get(String(code))||null)});

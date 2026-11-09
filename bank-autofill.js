// Bank and branch lookups use the bundled directory without network requests.
const bankDirectory=new Map(BANK_DIRECTORY_DATA.banks.map(bank=>[bank.code,bank]));
const bankFormState=new WeakMap();
let bankExplicit='';
const bankFieldOrder=['cardCountryCode','cardProvinceCode','cardCityCode','cardBankCode','cardBankName','swiftCode','cardBranchCode','cardAddress'];
for(const form of V2.forms)for(const section of form.sections)if(section.fields.some(f=>f.id==='cardBankCode')){
 section.fields.sort((a,b)=>bankFieldOrder.indexOf(a.id)-bankFieldOrder.indexOf(b.id));
 section.texts[1]='先選銀行所在地及行號，再選開戶分行。香港銀行名稱、SWIFT 及分行地址使用內建資料自動帶入。';
 for(const field of section.fields){
  if(field.id==='cardBankCode')field.hint='搜尋行號或銀行名稱；選取後自動帶入銀行名稱及 SWIFT。';
  if(field.id==='cardBankName')field.hint='按行號自動帶入；也可直接選擇銀行。';
  if(field.id==='cardBranchCode')field.hint='選取開戶分行後自動帶入地址；清單以外可手動填寫。';
 }
}
function bankAddressNote(bank){const branch=bankBranch(bank);return branch?'已對應 '+branch.code+' · '+branch.name+'；可按實際資料修改。':v2Raw('cardBranchCode')?'內建資料未有此分行，請核實分行編號並手動填寫地址。':bank.branches.length?'選取開戶分行後，自動帶入該分行地址。':'內建資料未有分行地址，請手動填寫。';}
function bankCurrent(){return v2Raw('cardCountryCode')==='HKG'?bankDirectory.get(v2Raw('cardBankCode')):null;}
function bankBranch(bank=bankCurrent()){const matches=bank?.branches.filter(b=>b.code===v2Raw('cardBranchCode'))||[];return new Set(matches.map(b=>b.address)).size===1?matches[0]:null;}
function bankAutofill(){
 if(state.readonly){bankExplicit='';return;}
 const v=state.values,key=v2Raw('cardCountryCode')+'|'+v2Raw('cardBankCode'),previous=bankFormState.get(v),explicit=bankExplicit;bankExplicit='';
 const changed=!!previous&&previous.key!==key,bank=bankCurrent();
 if(explicit==='bank'&&changed){v.cardBranchCode='';v2Model().bankBranchCustom=false;}
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
 if(explicit==='bank'||explicit==='branch'||!v2Raw('cardAddress')){
  if(address||explicit==='bank'||previous?.auto.cardAddress===v.cardAddress){v.cardAddress=address;auto.cardAddress=address;}
 }
 bankFormState.set(v,{key,branch:v2Raw('cardBranchCode'),auto});const source=$('.bank-address-source');if(source)source.textContent=bankAddressNote(bank);
 for(const f of ['cardAddress','swiftCode','cardBranchCode']){const el=$('[data-field="'+f+'"]'),value=f==='cardBranchCode'&&el?.hasAttribute('data-bank-branch-picker')&&v2Model().bankBranchCustom?'__other':v2Raw(f);if(el&&el.value!==value)el.value=value;}
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
for(const type of ['input','change'])document.addEventListener(type,e=>{
 const control=e.target;if(!control.hasAttribute('data-bank-branch-picker'))return;e.stopImmediatePropagation();
 v2Model().bankBranchCustom=control.value==='__other';state.values.cardBranchCode=control.value==='__other'?'':control.value;
 delete state.errors.cardBranchCode;bankExplicit='branch';v2SyncDerived();queueMicrotask(()=>render());
},true);
actions['bank-branch-list']=()=>{v2Model().bankBranchCustom=false;render();};
const bankBaseField=v2Field;
v2Field=function(f,...args){
 let html=bankBaseField.call(this,f,...args);if(v2Raw('cardCountryCode')!=='HKG')return html;
 const bank=bankCurrent();
 if(f.id==='cardBranchCode'&&(!v2Raw('cardBankCode')||bank?.branches.length)){
  const current=v2Raw('cardBranchCode'),branches=[...new Map((bank?.branches||[]).map(b=>[b.code,b])).values()].sort((a,b)=>a.code.localeCompare(b.code)),custom=!!v2Model().bankBranchCustom;
  const control=custom?`<input id="field-cardBranchCode" data-field="cardBranchCode" data-v2-field="cardBranchCode" value="${esc(current)}" maxlength="3" inputmode="numeric" placeholder="輸入 3 位分行編號" ${state.readonly?'readonly':''}><button type="button" class="bank-branch-list" data-action="bank-branch-list" ${state.readonly?'disabled':''}>從分行清單選擇</button>`:`<select id="field-cardBranchCode" data-field="cardBranchCode" data-v2-field="cardBranchCode" data-bank-branch-picker ${!bank||state.readonly?'disabled':''}><option value="">${bank?'請選擇開戶分行':'請先選擇銀行行號'}</option>${branches.map(b=>`<option value="${b.code}" data-description="${esc(b.address)}" ${b.code===current?'selected':''}>${b.code} · ${esc(b.name)}</option>`).join('')}${current&&!branches.some(b=>b.code===current)?`<option value="${esc(current)}" selected>${esc(current)}（手動填寫）</option>`:''}<option value="__other">其他分行（手動填寫）</option></select>`;
  html=html.replace(/<input\b[^>]*data-v2-field="cardBranchCode"[^>]*>/,control);
 }
 if(f.id==='cardAddress'){
  html=html.replace(/<input\b[^>]*data-v2-field="cardAddress"[^>]*>/,input=>input.replace(/^<input/,'<textarea').replace(/\s+type="[^"]*"/,'').replace(/\s+value="[^"]*"/,'').replace(/>$/,' rows="3" class="bank-address-input">')+esc(v2Raw('cardAddress'))+'</textarea>');
  if(bank){const end=html.lastIndexOf('</div>'),note=bankAddressNote(bank);html=html.slice(0,end)+'<small class="hint bank-address-source">'+esc(note)+'</small>'+html.slice(end);}
 }
 if(f.id==='swiftCode'&&bank){const end=html.lastIndexOf('</div>');html=html.slice(0,end)+'<small class="hint">'+(bank.swift?'已帶入 HKICL 會員 SWIFT／BIC，可按收款銀行指示修改。':'參考資料未有 SWIFT／BIC，請按銀行指示填寫。')+'</small>'+html.slice(end);}
 return html;
};
const bankStyle=document.createElement('style');bankStyle.textContent='.bank-address-input{height:auto!important;min-height:84px;line-height:1.6;resize:vertical;overflow-wrap:anywhere}.bank-address-source{display:block;margin-top:8px}.v2-form [data-section="開戶行歸屬地"] [data-field-wrap="cardAddress"]{grid-column:1/-1!important}.v2-form [data-section="開戶行歸屬地"]>.grid{align-items:start}.v2-form [data-section="開戶行歸屬地"]>.grid>.field>label{min-height:40px}.bank-branch-list{margin-top:8px;padding:8px 12px;font-size:12px}@media(max-width:700px){.v2-form [data-section="開戶行歸屬地"]>.grid{grid-template-columns:minmax(0,1fr)!important}.v2-form [data-section="開戶行歸屬地"]>.grid>.field>label{min-height:0}}';document.head.append(bankStyle);
Object.assign(AllinPayDemo,{getBankDirectory:()=>({banks:bankDirectory.size,branches:BANK_DIRECTORY_DATA.banks.reduce((n,b)=>n+b.branches.length,0),bics:BANK_DIRECTORY_DATA.banks.filter(b=>b.swift).length,branchDate:BANK_DIRECTORY_DATA.branchDate,bicDate:BANK_DIRECTORY_DATA.bicDate,lookupSource:'built-in',remoteLookup:false}),lookupBank:code=>structuredClone(bankDirectory.get(String(code))||null)});

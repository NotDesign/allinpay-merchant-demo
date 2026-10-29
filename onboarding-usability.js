// October 29 review: optional business fields, editable signer DOB and bank picker.
for(const form of V2.forms)for(const section of form.sections){
 if(section.name==='聯絡人及協議')section.texts[1]='聯絡人姓名、電話及電郵各自獨立；請核對聯絡方式。';
 if(section.name==='交易規模')section.texts[1]='以下均為選填；填寫時請保留最多 2 位小數。';
 for(const f of section.fields){
  if(f.id==='contactEmail')f.hint='用於接收申請及補件通知，無需驗證';
  if(f.id==='webUrl')f.hint='選填；如提供，請填寫完整 https:// 網址';
  if(['avgPerAmount','maxAmount','avgMonthAmount'].includes(f.id))f.hint='選填；最多 2 位小數';
  if(f.id==='cardBankName')f.hint='選擇銀行後，自動帶入右側銀行行號';
  if(f.id==='cardBankCode')f.hint='由銀行選單自動帶入；其他銀行可手動填寫';
 }
}
const usabilityOriginalField=v2Field;
const usabilityOriginalBankSync=syncBankName;
syncBankName=function(changed){if(v2Raw('cardCountryCode')==='HKG'&&v2Model().bankCustom){state.values.cardBankCode=v2Raw('cardBankCode').split(/\s+/)[0];return;}usabilityOriginalBankSync(changed);};
v2Field=function(f,index=0,linked=false){
 if(f.id==='authSigners[].birthDay')return usabilityOriginalField(f,index,false);
 let html=usabilityOriginalField(f,index,linked);
 if(v2Raw('cardCountryCode')!=='HKG')return html;
 const name=v2Raw('cardBankName'),code=v2Raw('cardBankCode'),known=Object.entries(ONBOARDING_BANKS),custom=!!v2Model().bankCustom||!!(name&&!known.some(([,n])=>n===name))||!!(code&&!ONBOARDING_BANKS[code]);
 if(f.id==='cardBankName'){
  const select=`<select id="field-cardBankName" data-field="cardBankName" data-v2-field="cardBankName" data-bank-picker aria-required="true"><option value="">請選擇銀行</option>${known.map(([c,n])=>`<option value="${esc(n)}" ${name===n&&!custom?'selected':''}>${esc(n)}</option>`).join('')}<option value="__other" ${custom?'selected':''}>其他銀行（手動填寫）</option></select>${custom?`<label for="other-bank-name" class="hint">銀行名稱</label><input id="other-bank-name" data-other-bank-name maxlength="100" value="${esc(name)}" placeholder="請填寫銀行名稱">`:''}`;
  html=html.replace(/<input[^>]*data-field="cardBankName"[^>]*>/,select);
 }
 if(f.id==='cardBankCode'&&!custom)html=html.replace(/<input([^>]*data-field="cardBankCode"[^>]*)>/,'<input$1 readonly aria-readonly="true">');
 return html;
};
function usabilityPickBank(e){
 const t=e.target;if(!t.hasAttribute('data-bank-picker'))return;e.stopImmediatePropagation();
 if(t.value==='__other'&&v2Model().bankCustom)return;
 if(t.value==='__other'){v2Model().bankCustom=true;state.values.cardBankName='';state.values.cardBankCode='';delete v2Model().bankAutoName;}
 else{v2Model().bankCustom=false;state.values.cardBankName=t.value;state.values.cardBankCode=Object.entries(ONBOARDING_BANKS).find(([,name])=>name===t.value)?.[0]||'';delete v2Model().bankAutoName;}
 delete state.errors.cardBankName;delete state.errors.cardBankCode;v2SyncDerived();queueMicrotask(()=>render());
}
// Update both fields before the shared input/status listeners can restore the old bank.
document.addEventListener('input',usabilityPickBank,true);
document.addEventListener('change',usabilityPickBank,true);
document.addEventListener('input',e=>{if(e.target.hasAttribute('data-other-bank-name')){state.values.cardBankName=e.target.value;delete state.errors.cardBankName;}});
const usabilityOriginalReview=v2Review;
v2Review=()=>usabilityOriginalReview().replace('✓ 電郵已驗證（模擬）','✓ 聯絡資料已填寫');
const usabilityOriginalPeople=v2PersonSection;
v2PersonSection=section=>usabilityOriginalPeople(section).replace(section.fields[0]?.id.startsWith('authSigners')?'董事修改時同步更新；取消勾選可獨立修改。':'__no_replacement__','身分資料跟隨董事；出生日期可獨立修改。');

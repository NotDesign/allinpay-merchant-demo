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
// Summarize optional document information without repeating full-width empty cards.
const usabilityOriginalDocuments=v2Documents;
v2Documents=function(){
 const template=document.createElement('template');template.innerHTML=usabilityOriginalDocuments().replaceAll('PDF／JPG／PNG／ZIP','PDF／JPG／PNG').replaceAll('PDF／ZIP','PDF');
 const ocr=template.content.querySelector('[data-section="辨識結果及來源"]'),consistency=template.content.querySelector('[data-section="資料一致性檢查"]'),provided=template.content.querySelector('[data-section="文件提供狀態"],[data-section="必交文件檢查"]');
 const log=v2Model().ocr,list=v2Consistency(),pending=list.filter(c=>!c.same&&!c.confirmed),selected=Object.keys(state.files).length;
 const cards=[];
 function detail(card,title,badge,color,open=false){if(!card)return '';card.querySelector('h2')?.remove();card.querySelector(':scope > p.hint')?.remove();return `<details class="mt-document-detail ${open?'needs-review':''}" ${open?'open':''}><summary><strong>${title}</strong>${pill(badge,color)}</summary><div class="mt-document-detail-body">${card.innerHTML}</div></details>`;}
 if(log.length)cards.push(detail(ocr,'辨識結果及來源',log.filter(o=>o.applied).length+'／'+log.length+' 已套用','blue'));
 if(list.length)cards.push(detail(consistency,'資料一致性檢查',pending.length?pending.length+' 項待核對':list.length+' 項已核對',pending.length?'amber':'green',!!pending.length));
 const notice=`<div class="mt-document-notice" role="status"><strong>文件為選填</strong><span>已選 ${selected} 份 · 未提供不會阻擋下一步</span><small>辨識只在本機處理；核對並勾選後才帶入表單。</small></div>`;
 const marker=document.createElement('div');marker.className='mt-document-status';marker.innerHTML=notice+(cards.length?'<div class="mt-document-status-grid">'+cards.join('')+'</div>':'');
 (ocr||consistency||provided)?.before(marker);ocr?.remove();consistency?.remove();provided?.remove();return template.innerHTML;
};

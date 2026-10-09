/* Seven visible steps; retain existing stable six data-step IDs for legacy drafts/links. */
const azureStepLabels=['文件材料','KTC 認證','主體資料','經營與聯繫','結算帳戶','產品與費率','確認提交'];
const azureStepIds=['1','ktc','2','3','4','5','6'];
let ktcPending=null,ktcReview=false,ktcMobileStage='consent';
const ktcChannel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('azure-ktc-demo'):null;
const ktcValues=()=>state.values.__ktc||(state.values.__ktc={});
const ktcFingerprint=()=>JSON.stringify(['directors[0].name','directors[0].idcardNo','directors[0].birthDay'].map(k=>state.values[k]||'').concat(Object.entries(state.files).filter(([id])=>V2.documents.find(d=>d.id===id)?.name.match(/身[份分].*證/)).map(([id,f])=>[id,f.name,f.size])));
const ktcPassed=()=>ktcValues().passed===true&&ktcValues().codeVerified===true&&ktcValues().fingerprint===ktcFingerprint();
function ktcImported(){return ['directors[0].name','directors[0].idcardNo'].every(key=>v2Model().ocr.some(o=>o.key===key&&o.applied&&String(o.value)===v2Raw(key)))&&Object.keys(state.files).some(id=>V2.documents.find(d=>d.id===id)?.name.match(/身[份分].*證/));}
const ktcCanSkip=()=>ktcImported()&&ktcValues().confirmed===ktcFingerprint();
function ktcGo(){go((AZURE_EXTERNAL?'form/':'application/')+'ktc');}
function ktcSteps(current){return `<nav class="${AZURE_EXTERNAL?'external-v2-steps':'stepper'}" aria-label="申請步驟">${azureStepIds.map((id,i)=>`<button type="button" class="step ${String(current)===id?'active':''}" data-action="${id==='ktc'?'ktc-open':'step'}" data-step="${id}" ${String(current)===id?'aria-current="step"':''}><span class="number">${i+1}</span>${azureStepLabels[i]}</button>`).join('')}</nav>`;}
function ktcRenderPanel(){
 const passed=ktcPassed(),skip=ktcCanSkip(),expired=ktcPending&&Date.now()>ktcPending.expires;
 let body='';
 if(ktcReview){body=`<h1>核對身分證資訊</h1><p>只有成功匯入且已核對的身分證資訊才可略過手機拍照。</p><div class="ktc-check"><dl><dt>姓名</dt><dd>${esc(v2Raw('directors[0].name')||'尚未導入')}</dd><dt>身分證號碼</dt><dd>${esc(v2Raw('directors[0].idcardNo')||'尚未導入')}</dd></dl></div><label class="check"><input id="ktc-id-confirm" type="checkbox" ${ktcImported()?'':'disabled'}>我已核對原始證件及以上欄位，確認正確</label><p class="hint">${ktcImported()?'確認後只需進行人像識別。':'尚未成功導入身分證姓名及號碼，請返回文件材料使用多文件辨識，或進行手機拍照示例。'}</p><div class="actions">${btn('返回 KTC','ktc-review-back')}${btn('確認資料正確','ktc-confirm-id','primary',ktcImported()?'':'disabled')}${btn('返回文件材料','step','','data-step="1"')}</div>`;}
 else if(ktcPending){
  const link=new URL('external.html',location.href);link.searchParams.set('v','20261009-ktc-camera-v2');link.hash='/ktc-mobile/'+ktcPending.token+'/'+ktcPending.mode+'/'+ktcPending.expires;
  body=`<h1>${expired?'識別連結已過期':'使用手機完成 KTC 認證'}</h1><p>${skip?'身分證資訊已確認，只進行人像識別。':'手機拍照 — 身分證 → 核對資料 → 人像識別'}</p>${expired?'<div class="notice warn">請重新產生 QR Code。舊連結及回傳已失效。</div>':`
   <div class="azure-qr">${azureQR(link.href)}</div><p class="center">連結及驗證碼有效 10 分鐘</p>
   <a class="ktc-link" href="${esc(link.href)}" target="_blank" rel="noopener">開啟手機識別 Demo ↗</a>
   <p class="hint">完成手機識別後，請在此輸入手機顯示的 6 位數驗證碼。同一瀏覽器也需要輸入驗證碼，才會完成認證。</p>
   <p id="ktc-return-status" role="status">${ktcPending.returned?'已收到手機識別結果，請輸入驗證碼以完成認證。':'等待手機識別完成及驗證碼確認。'}</p>
   <p id="ktc-demo-code-hint" class="hint" ${ktcPending.demoCodeShown?'':'hidden'}>示例驗證碼：<strong id="ktc-demo-code">${ktcPending.demoCodeShown?ktcReturnCode(ktcPending.token):''}</strong></p>
   <label for="ktc-return-code">手機識別驗證碼（Demo）</label><input id="ktc-return-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" aria-describedby="ktc-return-error" placeholder="手機完成後顯示的 6 位數">
   <p id="ktc-return-error" class="error" role="alert"></p><div class="actions">${btn('確認驗證碼','ktc-return','primary')}</div>`}
   <div class="actions">${btn('重新產生 QR Code','ktc-start')}${btn('取消識別','ktc-cancel')}${!expired?btn('模擬手機識別完成（顯示驗證碼）','ktc-demo-result')+btn('模擬連結過期','ktc-expire'):''}</div>`;
 }
 else {body=`<h1>KTC 認證</h1><p>完成身分證資料核對及人像識別後，繼續填寫主體資料。</p><div class="notice ${passed?'success':skip?'':'warn'}"><strong>${passed?'識別成功（Demo）':skip?'身分證資訊已核對，只需人像識別':'需要手機拍照及人像識別'}</strong><p>${passed?'此狀態只代表已完成原型演示，不是正式身分認證。':skip?'已成功導入並確認身分證資訊，可跳過手機拍照。':'目前尚未有已成功導入、並經你確認的身分證資訊。'}</p></div><div class="ktc-check"><h2>1. 手機拍照 — 身分證</h2><p>${skip?'已核對，可跳過此步驟':'使用手機拍攝證件，預覽並人工核對照片。'}</p></div><div class="ktc-check"><h2>2. 人像識別</h2><p>掃描 QR Code 開啟手機識別頁，依提示完成操作。</p></div><div class="actions">${btn(passed?'重新進行 KTC 認證':'開始 KTC 認證','ktc-start','primary')}${btn('查看／核對已導入身分證資訊','ktc-review')}</div>`;}
 return `<div class="ktc-layout"><section class="ktc-panel">${body}<p class="azure-demo-label">Demo：經你允許後開啟手機相機，照片只在手機頁面暫存，不上傳、不寫入草稿。不執行正式證件辨識、人臉比對或活體驗證；請使用測試證件。</p><div class="actions">${btn('上一步','step','','data-step="1"')}${btn('儲存草稿',AZURE_EXTERNAL?'save':'save-draft')}${btn('下一步：主體資料','ktc-next','primary',passed?'':'disabled')}</div></section>${typeof v2RiskOverview==='function'?'<aside class="ktc-status-sidebar" aria-label="申請狀態">'+v2RiskOverview()+'</aside>':''}</div>`;
}
function ktcReturnCode(token){let n=0;for(const c of token)n=(n*31+c.charCodeAt(0))%1000000;return String(n).padStart(6,'0');}
const ktcSessionValid=()=>!!ktcPending&&Date.now()<ktcPending.expires&&ktcPending.fingerprint===ktcFingerprint();
function ktcReceive(data){
 if(!ktcSessionValid()||data?.token!==ktcPending.token||data.status!=='success')return false;
 // A phone callback is only a result notification, never verification of the entered code.
 ktcPending.returned=true;
 if($('#ktc-return-status'))$('#ktc-return-status').textContent='已收到手機識別結果，請輸入驗證碼以完成認證。';
 return true;
}
function ktcVerifyCode(){
 const input=$('#ktc-return-code'),code=input?.value.trim()||'';
 const error=!ktcSessionValid()?'資料已變更或連結已失效，請重新開始識別。':!/^\d{6}$/.test(code)?'請輸入完整的 6 位數驗證碼。':code!==ktcReturnCode(ktcPending.token)?'驗證碼不正確，請核對手機顯示的驗證碼。':'';
 if(error){if($('#ktc-return-error'))$('#ktc-return-error').textContent=error;else toast(error);input?.setAttribute('aria-invalid','true');input?.focus();return;}
 // This is the only entry point allowed to complete KTC and display the success overlay.
 Object.assign(ktcValues(),{passed:true,codeVerified:true,fingerprint:ktcFingerprint(),completedAt:new Date().toISOString(),demo:true});
 ktcPending=null;render();
 modal('識別成功','<div class="notice success">驗證碼已確認，已完成 KTC 認證示例</div><p>可以繼續下一步：主體資料。</p><p class="hint">此為 Demo 驗證流程，未執行真實身分／人像驗證。</p>',btn('繼續下一步','ktc-next','primary'));
}
ktcChannel?.addEventListener('message',e=>ktcReceive(e.data));
window.addEventListener('storage',e=>{if(e.key==='azure-ktc-demo-result'){try{ktcReceive(JSON.parse(e.newValue));}catch{}}});
Object.assign(actions,{
 'ktc-open':()=>{ktcReview=false;ktcGo();},'ktc-review':()=>{ktcReview=true;render();},'ktc-review-back':()=>{ktcReview=false;render();},
 'ktc-confirm-id':()=>{if(!ktcImported()||!$('#ktc-id-confirm')?.checked)return toast('請核對資料並勾選確認');ktcValues().confirmed=ktcFingerprint();ktcReview=false;render();},
 'ktc-start':()=>{ktcPending={token:crypto.randomUUID(),mode:ktcCanSkip()?'face':'full',expires:Date.now()+600000,fingerprint:ktcFingerprint(),returned:false};ktcValues().passed=false;ktcValues().codeVerified=false;ktcReview=false;render();},
 'ktc-cancel':()=>{ktcPending=null;render();},'ktc-expire':()=>{if(ktcPending)ktcPending.expires=Date.now()-1;render();},
 'ktc-demo-result':()=>{if(!ktcReceive({token:ktcPending?.token,status:'success'}))return toast('識別連結已失效，請重新開始');ktcPending.demoCodeShown=true;$('#ktc-demo-code').textContent=ktcReturnCode(ktcPending.token);$('#ktc-demo-code-hint').hidden=false;},
 'ktc-return':ktcVerifyCode,
 'ktc-next':()=>{if(!ktcPassed())return toast('請先完成 KTC 認證');$('#modal').close();go('application/2');}
});
document.addEventListener('keydown',e=>{if(e.target.id==='ktc-return-code'&&e.key==='Enter'){e.preventDefault();ktcVerifyCode();}});
// Mobile camera capture lives in azure-ktc-camera.js and never uploads photos.
const azureNext=actions.next,azurePrevious=actions.previous,azureStep=actions.step;
actions.next=()=>{if(route().step===1){ktcGo();return;}azureNext();};
if(!AZURE_EXTERNAL)actions.previous=()=>route().step===2?ktcGo():azurePrevious();
const azureSubmit=actions.submit,azureConfirmSubmit=actions['confirm-submit'];
for(const [key,fn] of [['submit',azureSubmit],['confirm-submit',azureConfirmSubmit]])actions[key]=el=>{if(!ktcPassed()){modal('請先完成 KTC 認證','<p>完成身分證核對及人像識別示例後，才可提交申請。</p>',btn('前往 KTC 認證','ktc-open','primary'));return;}fn(el);};
Object.assign(window.AllinPayDemo,{getKTC:()=>({passed:ktcPassed(),canSkipPhoto:ktcCanSkip(),imported:ktcImported(),importedFields:(v2Model().ocr||[]).filter(o=>o.applied&&String(o.value)===v2Raw(o.key)).map(o=>o.key),pending:!!ktcPending,demo:true})});

/* Seven visible steps; retain existing stable six data-step IDs for legacy drafts/links. */
const azureStepLabels=['文件材料','KTC 認證','主體資料','經營與聯繫','結算帳戶','產品與費率','確認提交'];
const azureStepIds=['1','ktc','2','3','4','5','6'];
let ktcPending=null,ktcReview=false,ktcMobileStage='consent';
const ktcChannel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('azure-ktc-demo'):null;
const ktcValues=()=>state.values.__ktc||(state.values.__ktc={});
const ktcFingerprint=()=>JSON.stringify(['directors[0].name','directors[0].idcardNo','directors[0].birthDay'].map(k=>state.values[k]||'').concat(Object.entries(state.files).filter(([id])=>V2.documents.find(d=>d.id===id)?.name.match(/身[份分].*證/)).map(([id,f])=>[id,f.name,f.size])));
const ktcPassed=()=>ktcValues().passed===true&&ktcValues().fingerprint===ktcFingerprint();
function ktcImported(){return ['directors[0].name','directors[0].idcardNo'].every(key=>v2Model().ocr.some(o=>o.key===key&&o.applied&&String(o.value)===v2Raw(key)))&&Object.keys(state.files).some(id=>V2.documents.find(d=>d.id===id)?.name.match(/身[份分].*證/));}
const ktcCanSkip=()=>ktcImported()&&ktcValues().confirmed===ktcFingerprint();
function ktcGo(){go((AZURE_EXTERNAL?'form/':'application/')+'ktc');}
function ktcSteps(current){return `<nav class="${AZURE_EXTERNAL?'external-v2-steps':'stepper'}" aria-label="申請步驟">${azureStepIds.map((id,i)=>`<button type="button" class="step ${String(current)===id?'active':''}" data-action="${id==='ktc'?'ktc-open':'step'}" data-step="${id}" ${String(current)===id?'aria-current="step"':''}><span class="number">${i+1}</span>${azureStepLabels[i]}</button>`).join('')}</nav>`;}
function ktcRenderPanel(){
 const passed=ktcPassed(),skip=ktcCanSkip(),expired=ktcPending&&Date.now()>ktcPending.expires;
 let body='';
 if(ktcReview){body=`<h1>核對身分證資訊</h1><p>只有成功匯入且已核對的身分證資訊才可略過手機拍照。</p><div class="ktc-check"><dl><dt>姓名</dt><dd>${esc(v2Raw('directors[0].name')||'尚未導入')}</dd><dt>身分證號碼</dt><dd>${esc(v2Raw('directors[0].idcardNo')||'尚未導入')}</dd></dl></div><label class="check"><input id="ktc-id-confirm" type="checkbox" ${ktcImported()?'':'disabled'}>我已核對原始證件及以上欄位，確認正確</label><p class="hint">${ktcImported()?'確認後只需進行人像識別。':'尚未成功導入身分證姓名及號碼，請返回文件材料使用多文件辨識，或進行手機拍照示例。'}</p><div class="actions">${btn('返回 KTC','ktc-review-back')}${btn('確認資料正確','ktc-confirm-id','primary',ktcImported()?'':'disabled')}${btn('返回文件材料','step','','data-step="1"')}</div>`;}
 else if(ktcPending){const link=new URL('external.html',location.href);link.hash='/ktc-mobile/'+ktcPending.token+'/'+ktcPending.mode+'/'+ktcPending.expires;body=`<h1>${expired?'識別連結已過期':'使用手機完成 KTC 認證'}</h1><p>${skip?'身分證資訊已確認，只進行人像識別。':'手機拍照 — 身分證 → 核對資料 → 人像識別'}</p>${expired?'<div class="notice warn">請重新產生 QR Code。舊連結及回傳已失效。</div>':`<div class="azure-qr">${azureQR(link.href)}</div><p class="center">等待識別結果 · 連結有效 10 分鐘</p><a class="ktc-link" href="${esc(link.href)}" target="_blank" rel="noopener">開啟手機識別 Demo ↗</a><p class="hint">同一瀏覽器分頁可自動回傳；跨手機因沒有後端，完成後須輸入手機顯示的 Demo 回傳碼。</p><label for="ktc-return-code">手機 Demo 回傳碼</label><input id="ktc-return-code" inputmode="numeric" maxlength="6" placeholder="手機完成後顯示的 6 位數"><div class="actions">${btn('確認手機回傳碼','ktc-return')}</div>`}<div class="actions">${btn('重新產生 QR Code','ktc-start','primary')}${btn('取消識別','ktc-cancel')}${!expired?btn('模擬識別成功回傳','ktc-demo-success')+btn('模擬連結過期','ktc-expire'):''}</div>`;}
 else {body=`<h1>KTC 認證</h1><p>完成身分證資料核對及人像識別後，繼續填寫主體資料。</p><div class="notice ${passed?'success':skip?'':'warn'}"><strong>${passed?'識別成功（Demo）':skip?'身分證資訊已核對，只需人像識別':'需要手機拍照及人像識別'}</strong><p>${passed?'此狀態只代表已完成原型演示，不是正式身分認證。':skip?'已成功導入並確認身分證資訊，可跳過手機拍照。':'目前尚未有已成功導入、並經你確認的身分證資訊。'}</p></div><div class="ktc-check"><h2>1. 手機拍照 — 身分證</h2><p>${skip?'已核對，可跳過此步驟':'使用手機拍攝證件，核對辨識後的資料。'}</p></div><div class="ktc-check"><h2>2. 人像識別</h2><p>掃描 QR Code 開啟手機識別頁，依提示完成操作。</p></div><div class="actions">${btn(passed?'重新進行 KTC 認證':'開始 KTC 認證','ktc-start','primary')}${btn('查看／核對已導入身分證資訊','ktc-review')}</div>`;}
 return `<div class="ktc-layout"><section class="ktc-panel">${body}<p class="azure-demo-label">Demo：不連接身分驗證服務，不拍攝或上傳人像；請勿使用真實身分證。正式跨裝置回傳需接入服務端。</p><div class="actions">${btn('上一步','step','','data-step="1"')}${btn('儲存草稿',AZURE_EXTERNAL?'save':'save-draft')}${btn('下一步：主體資料','ktc-next','primary',passed?'':'disabled')}</div></section>${typeof v2RiskOverview==='function'?'<aside>'+v2RiskOverview()+'</aside>':''}</div>`;
}
function ktcReturnCode(token){let n=0;for(const c of token)n=(n*31+c.charCodeAt(0))%1000000;return String(n).padStart(6,'0');}
function ktcReceive(data){
 if(!ktcPending||data?.token!==ktcPending.token||data.status!=='success'||Date.now()>ktcPending.expires||ktcPending.fingerprint!==ktcFingerprint())return false;
 ktcValues().passed=true;ktcValues().fingerprint=ktcFingerprint();ktcValues().completedAt=new Date().toISOString();ktcValues().demo=true;ktcPending=null;render();
 modal('識別成功','<div class="notice success">已完成 KTC 認證示例</div><p>可以繼續下一步：主體資料。</p><p class="hint">此為 Demo 成功回傳，未執行真實身分／人像驗證。</p>',btn('繼續下一步','ktc-next','primary'));return true;
}
ktcChannel?.addEventListener('message',e=>ktcReceive(e.data));
window.addEventListener('storage',e=>{if(e.key==='azure-ktc-demo-result'){try{ktcReceive(JSON.parse(e.newValue));}catch{}}});
Object.assign(actions,{
 'ktc-open':()=>{ktcReview=false;ktcGo();},'ktc-review':()=>{ktcReview=true;render();},'ktc-review-back':()=>{ktcReview=false;render();},
 'ktc-confirm-id':()=>{if(!ktcImported()||!$('#ktc-id-confirm')?.checked)return toast('請核對資料並勾選確認');ktcValues().confirmed=ktcFingerprint();ktcReview=false;render();},
 'ktc-start':()=>{ktcPending={token:crypto.randomUUID(),mode:ktcCanSkip()?'face':'full',expires:Date.now()+600000,fingerprint:ktcFingerprint()};ktcValues().passed=false;ktcReview=false;render();},
 'ktc-cancel':()=>{ktcPending=null;render();},'ktc-expire':()=>{if(ktcPending)ktcPending.expires=Date.now()-1;render();},
 'ktc-demo-success':()=>{if(!ktcReceive({token:ktcPending?.token,status:'success'}))toast('識別連結已失效，請重新開始');},
 'ktc-return':()=>{if($('#ktc-return-code')?.value!==ktcReturnCode(ktcPending?.token||''))return toast('回傳碼不正確');actions['ktc-demo-success']();},
 'ktc-next':()=>{if(!ktcPassed())return toast('請先完成 KTC 認證');$('#modal').close();go('application/2');}
});
// Mobile HTML has no biometric implementation: exercise consent, photo/review, face, failure and callback states.
function ktcMobile(){
 const parts=location.hash.slice(2).split('/'),token=parts[1],mode=parts[2],expires=+parts[3];
 const valid=/^[a-f0-9-]{36}$/.test(token||'')&&['full','face'].includes(mode)&&expires>Date.now()&&expires<Date.now()+660000;
 const logo=AZURE_EXTERNAL?ASSETS['4864c.png']:'azure-logo.png';let body='';
 const face='<div class="ktc-photo" style="height:310px"><div style="width:164px;height:210px;border:2px solid #3973f4;border-radius:50%"></div></div>';
 if(!valid)body='<h1>識別連結已過期或無效</h1><p>請返回電腦頁面，重新產生 QR Code。</p>';
 else if(ktcMobileStage==='consent')body='<h1>KTC 認證</h1><p>'+ (mode==='face'?'身分證資訊已核對，只需完成人像識別。':'手機拍照 — 身分證 → 核對資料 → 人像識別。')+'</p><div class="notice warn">這是操作原型。不會啟動相機、不會收集證件或人像。</div><label class="check"><input type="checkbox" id="ktc-consent">我了解並同意進行 Demo 演示</label>'+btn('開始認證','ktc-mobile-start','primary');
 else if(ktcMobileStage==='photo')body='<h1>手機拍照 — 身分證</h1><p>請將完整證件四角置於框內，確保光線均勻。</p><div class="ktc-photo">身分證相機預覽（示意）</div>'+btn('使用示例照片','ktc-mobile-photo','primary');
 else if(ktcMobileStage==='review')body='<h1>核對身分證資訊</h1><div class="ktc-check"><p>姓名：DEMO USER</p><p>證件號碼：DEMO-ID-001</p><small>純示例，不會覆寫目前申請人的真實欄位。</small></div><label class="check"><input type="checkbox" id="ktc-mobile-confirm">已核對示例辨識資料</label>'+btn('確認並繼續','ktc-mobile-face','primary')+btn('重新拍照','ktc-mobile-retake');
 else if(ktcMobileStage==='face')body='<h1>人像識別</h1><p>請正視鏡頭，將臉部保持在框內，依画面提示完成動作。</p>'+face+btn('完成人像識別（Demo）','ktc-mobile-success','primary')+btn('預覽無法識別','ktc-mobile-failure');
 else if(ktcMobileStage==='failed')body='<h1>暫時無法識別</h1><p>請移除遮擋、保持光線充足後重試。</p>'+btn('重新進行人像識別','ktc-mobile-retry','primary');
 else body='<h1 class="ktc-success">識別成功（Demo）</h1><p>已發出示例回傳。同一瀏覽器的電腦分頁會自動顯示成功。</p><div class="ktc-check"><h2>跨手機 Demo 回傳碼</h2><strong style="font-size:28px">'+ktcReturnCode(token)+'</strong></div><p>使用另一部手機時，請在電腦輸入此碼以完成模擬回傳。</p>';
 $('#app').innerHTML='<main class="ktc-mobile"><a class="brand" href="#/login"><img src="'+logo+'" alt="Azure"></a><small>安全身分認證 · KTC · Demo</small>'+body+'<p class="azure-demo-label">僅供功能演示，不代表通過正式身分認證。</p></main>';
}
Object.assign(actions,{
 'ktc-mobile-start':()=>{if(!$('#ktc-consent')?.checked)return toast('請先確認 Demo 說明');ktcMobileStage=location.hash.split('/')[3]==='face'?'face':'photo';render();},
 'ktc-mobile-photo':()=>{ktcMobileStage='review';render();},'ktc-mobile-retake':()=>{ktcMobileStage='photo';render();},
 'ktc-mobile-face':()=>{if(!$('#ktc-mobile-confirm')?.checked)return toast('請先核對示例資料');ktcMobileStage='face';render();},
 'ktc-mobile-failure':()=>{ktcMobileStage='failed';render();},'ktc-mobile-retry':()=>{ktcMobileStage='face';render();},
 'ktc-mobile-success':()=>{if(ktcMobileStage!=='face')return;const parts=location.hash.slice(2).split('/');if(+parts[3]<Date.now())return render();const data={token:parts[1],status:'success'};ktcChannel?.postMessage(data);try{localStorage.setItem('azure-ktc-demo-result',JSON.stringify(data));localStorage.removeItem('azure-ktc-demo-result');}catch{}ktcMobileStage='success';render();}
});
const azureNext=actions.next,azurePrevious=actions.previous,azureStep=actions.step;
actions.next=()=>{if(route().step===1){ktcGo();return;}azureNext();};
if(!AZURE_EXTERNAL)actions.previous=()=>route().step===2?ktcGo():azurePrevious();
const azureSubmit=actions.submit,azureConfirmSubmit=actions['confirm-submit'];
for(const [key,fn] of [['submit',azureSubmit],['confirm-submit',azureConfirmSubmit]])actions[key]=el=>{if(!ktcPassed()){modal('請先完成 KTC 認證','<p>完成身分證核對及人像識別示例後，才可提交申請。</p>',btn('前往 KTC 認證','ktc-open','primary'));return;}fn(el);};
Object.assign(window.AllinPayDemo,{getKTC:()=>({passed:ktcPassed(),canSkipPhoto:ktcCanSkip(),imported:ktcImported(),importedFields:(v2Model().ocr||[]).filter(o=>o.applied&&String(o.value)===v2Raw(o.key)).map(o=>o.key),pending:!!ktcPending,demo:true})});

const sharedExternalApplication=application;
application=function(step){state.step=step;return `<section class="external-v2 application"><header class="application-head"><div><h1>商戶申請表</h1><p>${esc(state.id||'新申請')} · 文件為選填，可辨識帶入或直接手動填寫</p></div>${btn('我的申請','home')}</header><nav class="external-v2-steps" aria-label="申請步驟">${steps.map((n,i)=>btn((i+1)+' '+n,'step',i+1===step?'active':'',`data-step="${i+1}" ${i+1===step?'aria-current="step"':''}`)).join('')}</nav>${sharedExternalApplication(step)}${step===6?externalSignature():''}<footer class="form-actions">${step>1?btn('上一步','step','',`data-step="${step-1}"`):''}${btn('儲存草稿','save')}${btn(step===6?'提交申請':'下一步',step===6?'submit':'next','primary')}</footer></section>`;};
function externalSignature(){return `<section class="card"><h2>聲明及簽署</h2><p class="hint">此簽名只用作本機 Demo，不構成正式電子簽署。</p><div class="grid">${field(['signer','簽署人姓名','text',true])}${field(['signerTitle','簽署人職位','text',true])}</div><canvas id="signature" class="signature" aria-label="請在此簽名"></canvas>${btn('清除重簽','clear-signature')} ${btn('使用 Demo 簽名','demo-signature')}</section>`;}
const externalSubmit=submit;
submit=function(){if(!Object.keys(validateAll()).length&&(!state.signature||!state.values.signer||!state.values.signerTitle))return modal('請完成簽署','<p>請填寫簽署人姓名、職位，並完成簽名。</p>');externalSubmit();};actions.submit=submit;
actions.next=()=>{const e=validateStep(state.step);if(Object.keys(e).length)return showErrors(e,state.step);go('form/'+Math.min(6,state.step+1));};
actions['verify-email']=()=>{state.emailVerified=true;render();toast('已完成電郵模擬驗證，未發送真實電郵');};
actions['clear-form']=()=>modal('清空目前表單','<p>已儲存草稿不受影響。</p>',btn('取消','close')+btn('確認清空','confirm-clear','primary'));
actions['save-draft']=()=>save();
actions['show-errors']=()=>showErrors(validateStep(state.step),state.step);
const previousNew=newApplication;
newApplication=function(){previousNew();v2Reset();state.values.contactEmail=state.email;state.emailVerified=state.session;state.checks={};state.step=1;};
const oldVerify=actions.verify;
actions.verify=()=>{const seed=state.registerSeed;oldVerify();if(seed&&state.session&&!state.registerSeed){state.values.merchantEnglishName=seed.companyEn||'';state.values.contactName=[seed.lastName,seed.firstName].filter(Boolean).join(' ');render();}};
sample=function(){fillSample();state.values.contactEmail=state.email||'merchant@example.com';state.values.signer='DEMO USER';state.values.signerTitle='董事';state.errors={};};
const oldSnapshot=snapshot;
snapshot=function(status='草稿'){const r=oldSnapshot(status);r.schema=V2.version;r.values.companyZh=r.values.merchantName;r.values.companyEn=r.values.merchantEnglishName;r.checks={...state.checks};r.emailVerified=state.emailVerified;return r;};
const legacyReview=review;
review=function(){v2Ensure();return `<section class="external-v2 review"><div class="page-heading"><h1>已提交申請資料</h1>${btn('我的申請','home')}</div><div class="notice">已提交資料為唯讀。進度為本機示例，不代表正式審核結果。</div><div class="v2-form external-readonly">${v2Review()}</div>${state.signature?`<img class="signature-image" alt="Demo 簽名" src="${esc(state.signature)}">`:''}</section>`;};
loadRecord=function(r){if(!r)return;const saved=structuredClone(r);for(const key of ['values','files','people','directors','shops','methods','scenes','sales','signature'])state[key]=saved[key]??(key==='signature'?'':key==='values'||key==='files'?{}:[]);state.id=r.id;state.checks=saved.checks||{};state.errors={};state.readonly=r.status!=='草稿';state.emailVerified=!!saved.emailVerified;
 if(!state.values.__v2){
  // Keep the original record untouched; migrate a working copy and preserve unmapped data.
  const old={...state.values};state.values.__legacyExternal=old;
  for(const [from,to]of Object.entries({companyZh:'merchantName',companyEn:'merchantEnglishName',br:'registerCertNo',brExpiry:'registerCertPeriod',address:'addrStreet',email:'contactEmail',mobile:'contactPhone',bankName:'cardName',bankAccount:'cardNo',website:'webUrl'}))if(old[from])state.values[to]=old[from];
  state.people={directors:Math.max(1,state.directors.length),authSigners:0,shareHolders:0};
  state.directors.forEach((p,i)=>{state.values[`directors[${i}].name`]=[p.last,p.first].filter(Boolean).join(' ');});
  const legacyFiles=state.files;state.files={};if(legacyFiles.statement?.[0])state.files['140401']=legacyFiles.statement[0];state.values.__legacyFiles=legacyFiles;v2Ensure();state.step=1;
 }else state.step=r.step||1;
 for(const [id,f] of Object.entries(state.files))if(!f.demo)f.needsReselect=!DEMO.fileURLs.has(id);v2SyncDerived();go(state.readonly?'review':'form/'+state.step);
};
const oldRenderExternal=render;
render=function(){oldRenderExternal();document.querySelectorAll('.external-readonly input,.external-readonly select,.external-readonly button').forEach(el=>el.disabled=true);};
document.addEventListener('change',e=>{const t=e.target;if(t.dataset.check)state.checks[t.dataset.check]=t.checked;if(t.id==='simulate-failure')state.fail=t.checked;if(t.dataset.v2Field){state.values[t.dataset.v2Field]=t.value;delete state.errors[t.dataset.v2Field];}} ,true);
Object.assign(window.AllinPayDemo,{getState:()=>structuredClone({values:state.values,files:state.files,step:state.step,checks:state.checks}),external:true});

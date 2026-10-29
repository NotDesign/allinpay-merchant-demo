// Explainable Demo rules. Weights belong to this prototype, not a provider model.
const onboardingRiskVersion='DEMO-RISK-20261029-v2';
const onboardingRiskRules=[
 ['BUS-01','商戶背景','經營年限少於 1 年',15,()=>v2Raw('licencePeriod')==='01'],
 ['BUS-02','商戶背景','經營年限 1–3 年',8,()=>v2Raw('licencePeriod')==='02'],
 ['BUS-03','商戶背景','法律地位為個人',10,()=>v2Raw('legalStatus')==='PERSON'],
 ['BUS-04','商戶背景','註冊資本少於 10 萬',6,()=>v2Raw('registerCapital')==='01'],
 ['BUS-05','商戶背景','註冊證書距到期少於 90 天',8,()=>!!v2Raw('registerCertPeriod')&&v2DateDays(v2Raw('registerCertPeriod'))<90],
 ['MCC-01','行業風險','所選 MCC 含高風險',25,()=>mtMccList().some(c=>V2.catalog.MCCS.find(m=>m.c===c)?.lv==='high')],
 ['MCC-02','行業風險','所選 MCC 含中風險',12,()=>!onboardingRiskRules[5][4]()&&mtMccList().some(c=>V2.catalog.MCCS.find(m=>m.c===c)?.lv==='mid')],
 ['PAY-01','產品與交易','開通 CNP／PayByLink 卡產品',15,()=>v2Cnp()],
 ['PAY-02','產品與交易','卡產品採直連',10,()=>v2Cnp()&&v2Raw('connectType')==='0'],
 ['PAY-03','產品與交易','月銷售超過 500,000',10,()=>v2Num('avgMonthAmount')>500000],
 ['PAY-04','產品與交易','單筆最高超過 20,000',8,()=>v2Num('maxAmount')>20000],
 ['PAY-05','產品與交易','平均單筆偏離所選行業常態超過 3 倍',12,()=>mtMccList().some(c=>{const m=V2.catalog.MCCS.find(m=>m.c===c);return m&&v2Num('avgPerAmount')>m.avg*3;})],
 ['DOC-01','資料與實體核對','OCR 與人工修改差異不少於 2 項',10,()=>v2Model().signals.ocr||v2Model().ocr.filter(o=>o.applied&&v2Raw(o.key)!==String(o.applied)).length>=2],
 ['DOC-02','資料與實體核對','無門店照／虛擬辦公室',12,()=>v2Model().signals.virtual||v2Offline()&&!state.files['101401']],
 ['BANK-01','結算與關聯','結算帳戶為對私',8,()=>v2Raw('isCompay')==='N'],
 ['BANK-02','結算與關聯','對公帳戶名稱與英文商戶名稱不一致',15,()=>v2Raw('isCompay')==='Y'&&!!v2Raw('cardName')&&!!v2Raw('merchantEnglishName')&&v2NormalizeName(v2Raw('cardName'))!==v2NormalizeName(v2Raw('merchantEnglishName'))],
 ['BANK-03','結算與關聯','帳戶已關聯其他商戶',20,()=>!!v2Model().signals.cardlink],
 ['PAY-06','產品與交易','涉及預付／儲值／預售',20,()=>!!v2Model().signals.prepaid]
];
function onboardingRiskCoverage(){return [
 {label:'MCC 行業',done:mtMccList().length>0&&mtMccList().every(c=>V2.catalog.MCCS.some(m=>m.c===c))},
 {label:'開通產品',done:v2Rows().length>0},
 {label:'結算帳戶',done:!!(v2Raw('cardName')&&v2Raw('cardNo')&&v2Raw('cardBankCode'))}
];}
v2Score=function(){const items=onboardingRiskRules.filter(r=>r[4]()).map(([id,category,label,n])=>({id,category,label:label+(id.startsWith('MCC-')?'（'+mtMccList().filter(c=>V2.catalog.MCCS.find(m=>m.c===c)?.lv===(id==='MCC-01'?'high':'mid')).join('、')+'）':''),n})),raw=items.reduce((s,r)=>s+r.n,0),total=Math.min(100,raw),s=v2Model().signals;return {items,total,raw,level:total<=20?'1':total<=45?'2':'3',reject:s.sanction?'命中制裁名單（示例）':s.frozen?'關聯已凍結／關閉商戶':total>70?'風控評分超過 70':null,modelVersion:onboardingRiskVersion,coverage:onboardingRiskCoverage()};};
const onboardingProgressOpen={};
function onboardingFillProgress(){
 const required=v2Required(),pages=[];
 for(let step=1;step<=6;step++){
  const errors=validateStep(step),items=[];
  const add=(key,label,done,message='')=>{if(!items.some(i=>i.key===key))items.push({key,label,done:!!done,message});};
  if(step>=2&&step<=5)for(const section of V2.forms[step-2].sections)for(const field of section.fields.filter(v2Visible)){
   const group=field.id.includes('[]')?field.id.split('[')[0]:null;
   for(let i=0;i<(group?state.people[group]:1);i++){
    const key=field.id.replace('[]',`[${i}]`),person=key.split('.').pop(),isRequired=required.has(key)||group&&(['name','firstNameEn','lastNameEn','idcardType','idcardNo'].includes(person)||group==='authSigners'&&person==='birthDay');
    if(isRequired||errors[key])add(key,(group?section.name+' '+(i+1)+' · ':'')+v2Label(key),!!v2Raw(key)&&!errors[key],errors[key]||'尚未填寫');
   }
  }
  if(step===2&&state.values.__customer?.id)add('_customer','客戶及公司關係',!!state.values.__customer.name&&!errors._customer,errors._customer||'請填寫客戶名稱');
  if(step===5){add('_products','選擇開通產品',v2Rows().length>0,'請至少選擇一項產品');for(const x of v2Rows())add('_fee-'+x.key,x.g.n+' · '+x.r.n+'費率',!v2FeeErrors(x.r,x.st).length,v2FeeErrors(x.r,x.st).join('；'));}
  if(step===6){add('_review','資料一致性及風控核對',!Object.keys(errors).length,Object.values(errors)[0]||'');add('_declaration','聲明及確認',!!state.checks['613:4956'],'請勾選提交聲明');if(MT_EXTERNAL){add('signer','簽署人姓名',!!v2Raw('signer'),'請填寫簽署人姓名');add('signerTitle','簽署人職位',!!v2Raw('signerTitle'),'請填寫簽署人職位');add('_signature','電子簽名',!!state.signature,'請完成簽名');}}
  for(const [key,message] of Object.entries(errors))if(!items.some(i=>i.key===key))add(key,v2Fields.some(f=>f.id===key)?v2Label(key):message,false,message);
  const completed=items.filter(i=>i.done).length,total=items.length;pages.push({step,name:steps[step-1],completed,total,percent:total?Math.round(completed/total*100):100,missing:items.filter(i=>!i.done),optional:step===1,files:step===1?Object.keys(state.files).length:0});
 }
 const total=pages.reduce((s,p)=>s+p.total,0),completed=pages.reduce((s,p)=>s+p.completed,0);return {pages,total,completed,percent:total?Math.round(completed/total*100):0};
}
function onboardingProgressCard(){const d=onboardingFillProgress(),current=route().step;return `<article class="mt-fill-progress" aria-label="目前填寫進度"><h2>目前填寫進度</h2><div class="mt-progress-total"><strong>${d.percent}%</strong><span>${d.completed}／${d.total} 關鍵資料完成</span></div><progress value="${d.percent}" max="100" aria-label="整體填寫進度"></progress><p class="hint">按頁查看缺漏或格式問題，點選即可返回填寫。</p><div class="mt-progress-pages">${d.pages.map(p=>`<details data-progress-step="${p.step}" ${onboardingProgressOpen[p.step]??(p.step===current)?'open':''}><summary><span class="mt-progress-dot ${p.optional?'optional':p.missing.length?'pending':'done'}">${p.step}</span><strong>${esc(p.name)}</strong><span>${p.optional?'選填':p.completed+'／'+p.total}</span></summary><div class="mt-progress-page-body">${p.optional?`<p>已上傳 ${p.files} 份文件；未提供不阻擋填寫。</p>`:p.missing.length?`<ul>${p.missing.map(i=>`<li>${btn(esc(i.label),'progress-go','text-button',`data-step="${p.step}" data-key="${esc(i.key)}"`)}<small>${esc(i.message)}</small></li>`).join('')}</ul>`:'<p class="mt-progress-done">關鍵資料已完成</p>'}${btn('前往此頁 →','progress-go','text-button',`data-step="${p.step}"`)}</div></details>`).join('')}</div><small class="hint">進度依目前資料與驗證規則計算，並非審批結果。</small></article>`;}
const onboardingOriginalOverview=v2RiskOverview;
v2RiskOverview=function(){const score=v2Score(),missing=score.coverage.filter(c=>!c.done),html=onboardingOriginalOverview().replace('aria-label="申請即時狀態">','aria-label="申請即時狀態">'+onboardingProgressCard());const banner=`<div class="mt-risk-live ${missing.length?'incomplete':''}"><span>${missing.length?'初步評估 · 待補 '+missing.map(c=>c.label).join('、'):score.total?'已依目前資料計分':'已完成計分 · 未命中加分條件'}</span>${btn('計分邏輯','risk-logic','text-button')}</div>`;return html.replace('<div class="v2-status-score">',banner+'<div class="v2-status-score">').replace(missing.length?'<small>系統建議</small>':'__no_match__','<small>初步建議</small>').replace('暫無加分項','目前資料未命中加分條件（0 分）；資料變更後即時重算');};
const onboardingOriginalRefresh=v2RefreshStatus;
let onboardingCurrentEvent=null;
for(const type of ['input','change','click'])document.addEventListener(type,e=>onboardingCurrentEvent=e,true);
v2RefreshStatus=function(){const t=onboardingCurrentEvent?.target;if(onboardingCurrentEvent?.type==='input'&&t?.dataset.v2Field)state.values[t.dataset.v2Field]=t.value;v2SyncDerived();const textCommit=onboardingCurrentEvent?.type==='change'&&t?.matches('input:not([type="checkbox"]):not([type="file"]):not([type="radio"])')&&(t.dataset.field||t.dataset.mtRelation);if(!textCommit)onboardingOriginalRefresh();const industry=$('[data-field="mccName"]');if(industry)industry.value=v2Raw('mccName');const level=$('[data-field="riskLevel"]');if(level)level.value=v2Raw('riskLevel');};
// Preserve an explicit operator choice before input-driven recalculation runs.
document.addEventListener('input',e=>{if(e.target.dataset.v2Field==='riskLevel')v2Model().manualRisk=true;},true);
actions['progress-go']=el=>{const key=el.dataset.key;actions.step({dataset:{step:el.dataset.step}});setTimeout(()=>{if(!key)return;const node=$(`[data-field-wrap="${CSS.escape(key)}"]`)||(key==='_declaration'?$('[data-check="613:4956"]'):key==='_signature'?$('#signature'):key.startsWith('_fee-')?$(`[data-v2-product="${CSS.escape(key.slice(5))}"]`):key==='_customer'?$('#mt-customer'):null);node?.scrollIntoView({behavior:'smooth',block:'center'});(node?.matches('input,select,textarea,button,canvas')?node:node?.querySelector('input,select,textarea,button,summary'))?.focus({preventScroll:true});},0);};
actions['risk-logic']=()=>{const score=v2Score(),active=new Set(score.items.map(i=>i.id));modal('風控計分邏輯',`<div class="notice">規則版本：${onboardingRiskVersion}<br>總分＝命中規則加分總和（上限 100）。目前 ${score.raw} 分，顯示 ${score.total}／100。</div><p>0–20 低、21–45 中、46–70 高；超過 70 分或命中制裁／凍結示例會阻擋 Demo 提交。MCC 取最高風險一次計分，同一規則不重複加分。</p><div class="mt-risk-rule-list">${onboardingRiskRules.map(([id,category,label,n])=>`<div class="${active.has(id)?'matched':''}"><span><small>${category} · ${id}</small><strong>${label}</strong></span><b>+${n}</b>${pill(active.has(id)?'已命中':'未命中',active.has(id)?'amber':'gray')}</div>`).join('')}</div><p class="hint">以上分值、門檻、MCC 常態金額及處置均為本 Demo 規則，未經真實交易資料校準。未上傳文件不阻擋填寫；線下產品未有門店照僅保留原型的風險提示。沒有實際接入名單、退款或拒付數據。</p><p>設計參考：<a href="https://support.stripe.com/questions/stripe-credit-underwriting-process" target="_blank" rel="noopener">Stripe 商戶審查因素</a>、<a href="https://docs.adyen.com/platforms/manage-account-holder-risk" target="_blank" rel="noopener">Adyen 帳戶規則及處置</a>。參考評估維度與可追溯方式，非其專有演算法。</p>`,btn('返回填寫','close','primary'));};
document.addEventListener('click',e=>{const summary=e.target.closest('details[data-progress-step]>summary');if(summary)requestAnimationFrame(()=>onboardingProgressOpen[summary.parentElement.dataset.progressStep]=summary.parentElement.open);});
document.addEventListener('input',e=>{if(e.target.dataset.mtRelation||e.target.dataset.check)v2RefreshStatus();});
for(const key of ['demo-signature','clear-signature']){const action=actions[key];if(action)actions[key]=el=>{action(el);v2RefreshStatus();};}
for(const event of ['mouseup','touchend'])document.addEventListener(event,e=>{if(e.target.id==='signature')requestAnimationFrame(()=>v2RefreshStatus());});
const onboardingOriginalReview=v2Review;v2Review=()=>onboardingOriginalReview().replace('制裁／PEP 命中','制裁名單命中（示例）');
Object.assign(window.AllinPayDemo,{getFillProgress:()=>onboardingFillProgress(),getRiskRules:()=>({version:onboardingRiskVersion,score:v2Score(),rules:onboardingRiskRules.map(([id,category,label,points,test])=>({id,category,label,points,matched:!!test()}))})});

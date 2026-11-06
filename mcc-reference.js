// Reference classifications and Demo risk parameters are deliberately separate.
const mccDemoParameters=new Map(V2.catalog.MCCS.map(m=>[m.c,{...m}]));
const mccReferenceByCode=new Map(MCC_REFERENCE_DATA.entries.map(entry=>[entry.code,entry]));
V2.catalog.MCCS=MCC_REFERENCE_DATA.entries.map(entry=>{
 const demo=mccDemoParameters.get(entry.code),name=entry.zh;
 return {c:entry.code,n:name,en:entry.en,key:entry.key,countries:entry.countries||null,excludedCountries:entry.excludedCountries||null,lv:demo?.lv||'unrated',avg:demo?.avg||null};
});
const mccByCode=new Map(V2.catalog.MCCS.map(m=>[m.c,m]));
const mccName=code=>{const m=mccByCode.get(code);return m?(m.n===m.en?m.en:m.n+' / '+m.en):code+'（未列入參考文件，待核定）';};
const mccUnrated=()=>mtMccList().filter(code=>!['low','mid','high'].includes(mccByCode.get(code)?.lv));
const mccCountryMismatch=()=>mtMccList().filter(code=>{const m=mccByCode.get(code);const country=v2Raw('addrCountryCode');return country&&(m?.countries&&!m.countries.includes(country)||m?.excludedCountries?.includes(country));});
const mccBaseSync=v2SyncDerived;
v2SyncDerived=function(...args){const result=mccBaseSync.apply(this,args);state.values.mccName=mtMccList().map(mccName).join('\n');return result;};
mtMccOptions=function(query=''){
 const selected=mtMccList(),options=[...V2.catalog.MCCS,...selected.filter(code=>!mccByCode.has(code)).map(c=>({c,n:'待核定行業',en:''}))],q=query.trim().toLowerCase();
 if(/^\d{4}$/.test(q)&&!options.some(m=>m.c===q))options.push({c:q,n:'待核定行業',en:''});
 return options.filter(m=>(m.c+' '+m.n+' '+m.en).toLowerCase().includes(q)).map(m=>`<label class="check" data-mt-mcc-option="${m.c}"><input type="checkbox" data-mt-mcc="${m.c}" aria-label="MCC ${m.c}" ${selected.includes(m.c)?'checked':''}><span>${m.c}</span>${m.c===v2Raw('mcc')?'<small>主要</small>':''}</label>`).join('')||'<p class="hint">沒有符合的項目；其他代碼可輸入完整 4 位數字，另行核定。</p>';
};
const mccBaseField=v2Field;
v2Field=function(f,...args){
 let html=mccBaseField.call(this,f,...args);if(!html)return html;
 if(f.id==='mcc'){
  const end=html.lastIndexOf('</div>');html=html.slice(0,end)+'<small class="hint mcc-source">客戶提供 MCC 對照表 · '+MCC_REFERENCE_DATA.entries.length+' 個具名代碼。名稱於「行業名稱」欄位顯示；實際受理須由 AllinPay 核定。</small>'+html.slice(end);
 }
 if(f.id==='mccName'){
  html=html.replace(/<input\b[^>]*data-v2-field="mccName"[^>]*>/,input=>input.replace(/^<input/,'<textarea').replace(/\s+type="[^"]*"/,'').replace(/\s+value="[^"]*"/,'').replace(/>$/,' rows="2" class="mcc-names" aria-label="所選 MCC 對應名稱">')+esc(v2Raw('mccName'))+'</textarea>');
  const mismatch=mccCountryMismatch();
  if(mismatch.length){const end=html.lastIndexOf('</div>');html=html.slice(0,end)+`<small class="error">${esc(mismatch.join('、'))} 為參考文件的地區限定代碼，與目前營業國家／地區不符。</small>`+html.slice(end);}
 }
 return html;
};
const mccBaseValidate=validateStep;
validateStep=function(step){const errors=mccBaseValidate(step);if(step===3&&mccCountryMismatch().length)errors.mcc='所選 MCC '+mccCountryMismatch().join('、')+' 為地區限定代碼，與目前營業國家／地區不符。';return errors;};
const mccBaseScore=v2Score;
v2Score=function(...args){const score=mccBaseScore.apply(this,args);return {...score,pendingMccRisk:mccUnrated()};};
const mccBaseOverview=v2RiskOverview;
v2RiskOverview=function(...args){
 const html=mccBaseOverview.apply(this,args),pending=mccUnrated();if(!pending.length)return html;
 return html.replace(/<article class="v2-status-card" data-risk-tier="[^"]*">[\s\S]*?<\/article>/,card=>{
  card=card.replace(/<div class="v2-status-tier"><b>[\s\S]*?<\/small><\/div>/,'<div class="v2-status-tier"><b>待評估</b><small>行業風險待核定</small></div>');
  card=card.replace('<div class="v2-status-score">',`<div class="notice warn mcc-risk-pending">MCC ${esc(pending.join('、'))} 尚未設定 Demo 風險參數。目前分數未包含這些行業風險，請人工核定風控級別。</div><div class="v2-status-score">`);
  if(!v2Model().manualRisk)card=card.replace(/<p>採用風控級別：[\s\S]*?<\/p>/,'<p>行業風險尚待評估；請核對並人工設定風控級別。</p>').replace(/<dl>[\s\S]*?<\/dl>/,'<p class="hint">行業風險未核定前，不提供自動處置建議。</p>');
  return card;
 });
};
const mccBaseSummary=v2RiskSummary;
v2RiskSummary=function(...args){const pending=mccUnrated(),html=mccBaseSummary.apply(this,args);return pending.length?html.replace(/<strong>[\s\S]*?<\/strong>/,'<strong>部分資料計分 · MCC 行業風險待評估</strong>')+'<p class="hint">新增參考代碼不會自動獲配低風險或平均交易金額；請人工核定。</p>':html;};
const mccStyle=document.createElement('style');mccStyle.textContent='.mcc-names{height:auto!important;min-height:76px;max-height:220px;resize:vertical;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6}.mcc-source{display:block;margin-top:8px;line-height:1.6}.mcc-risk-pending{font-size:13px;line-height:1.6;margin:12px 0}.mt-mcc-options .check>span{font-variant-numeric:tabular-nums}';document.head.append(mccStyle);
Object.assign(window.AllinPayDemo,{getMccReference:()=>({source:MCC_REFERENCE_DATA.source,edition:MCC_REFERENCE_DATA.edition,count:MCC_REFERENCE_DATA.entries.length,sourceSha256:MCC_REFERENCE_DATA.sourceSha256}),lookupMcc:code=>structuredClone(mccByCode.get(String(code))||null)});

// Shared application status, derived from the supplied OATS V2 prototype.
// Advisory demo values only: never silently overwrite the merchant's fee settings.
const v2RiskPolicies={
 '1':{label:'低',cycle:'T1',deposit:'0%',limit:'單筆 20,000／月 500,000',path:'L1 抽檢 10% → 送 OATS',sla:'4 小時內'},
 '2':{label:'中',cycle:'T2',deposit:'收單 5%，釋放 30 天',limit:'單筆 30,000／月 1,000,000',path:'L1 全審 → L2 風控複審 → 送 OATS',sla:'T+1'},
 '3':{label:'高',cycle:'T3',deposit:'收單 10%，釋放 60 天；CNP 10%，釋放 180 天',limit:'逐戶設定，首月壓縮 50%',path:'L1 → L2 → L3 終審（須書面理由）',sla:'T+3'},
 D:{label:'拒件',cycle:'—',deposit:'—',limit:'—',path:'直接拒絕，30 天內不得重提',sla:'即時'}
};
const v2RiskOpen={risk:true,blocks:true};
function v2ProgressData(){
 const errors=validateAll(),required=[...v2Required()],unfilled=required.filter(k=>!v2Raw(k)),completed=required.length-unfilled.length,percent=Math.round(completed/required.length*100);
 const score=v2Score(),checks=v2Consistency(),missing=v2MissingDocs();
 const policy=v2RiskPolicies[score.reject?'D':v2Raw('riskLevel')]||v2RiskPolicies[score.level];
 const recommended=v2RiskPolicies[score.reject?'D':score.level];
 const blocks=[];
 if(unfilled.length)blocks.push({step:2,label:'尚有 '+unfilled.length+' 項必填未完成：'+unfilled.slice(0,3).map(v2Label).join('、')+(unfilled.length>3?'等':'')});
 for(const step of [2,3,4,5,6]){const entries=Object.entries(validateStep(step)).filter(([k])=>!unfilled.includes(k));if(entries.length)blocks.push({step,label:entries[0][1]+(entries.length>1?'（另有 '+(entries.length-1)+' 項）':'')});}
 if(missing.length)blocks.push({step:1,label:'缺件／需重新提供 '+missing.length+' 項：'+missing.slice(0,2).map(d=>d.name.split('\n')[0]).join('、')+(missing.length>2?'等':'')});
 return {errors,score,policy,recommended,required:required.length,completed,percent,unfilled,missing,checks,blocks};
}
function v2RiskOverview(){
 const d=v2ProgressData(),s=d.score,tier=s.reject?'D':s.level;
 const row=(label,value,cls='')=>`<div class="v2-status-line ${cls}"><span>${label}</span><strong>${value}</strong></div>`;
 const details=(key,label,html)=>`<details data-v2-status-details="${key}" ${v2RiskOpen[key]?'open':''}><summary>${label}</summary>${html}</details>`;
 return `<section class="v2-status-overview" aria-label="申請即時狀態">
 <article class="v2-status-card" data-risk-tier="${tier}"><h2>風控評分（系統參考）</h2><div class="v2-status-score"><strong data-risk-score>${s.total}</strong><span>／100</span><div class="v2-status-tier"><b>${d.recommended.label}</b><small>系統建議</small></div></div><meter min="0" max="100" value="${s.total}" aria-label="風控評分"></meter><div class="v2-status-ticks"><span>0</span><span>20 低</span><span>45 中</span><span>70 高</span><span>100</span></div><p>採用風控級別：<b>${d.policy.label}</b>（${v2Model().manualRisk?'人工設定':'跟隨系統建議'}）</p>${details('risk','評分明細與處置',`<h3>評分明細</h3>${s.reject?row(esc(s.reject),'阻擋','danger'):''}${s.items.map(i=>row(esc(i.label),'+'+i.n)).join('')||'<p class="hint">暫無加分項</p>'}<h3>按風控級別處置 · 系統參考</h3><dl>${[['風控級別',s.reject?'—':v2Raw('riskLevel')],['結算週期',d.policy.cycle],['保證金',d.policy.deposit],['限額',d.policy.limit],['審批路徑',d.policy.path],['目標時效',d.policy.sla]].map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl><small class="hint">此為原型的系統參考，不代表實際審核結果；不會覆寫已填費率或結算設定。</small>`)}</article>
 <article class="v2-status-card"><h2>資料核對與缺件</h2>${row('資料不一致',d.checks.filter(c=>!c.same).length+' 項')}${row('差異待人工確認',d.checks.filter(c=>!c.same&&!c.confirmed).length+' 項')}${row('缺件／需重新提供',`<span data-risk-missing>${d.missing.length}</span> 項`,d.missing.length?'danger':'')}${row('補件通知',d.missing.length?'未發送':'無需','muted')}<div class="v2-status-links">${btn('查看核對明細 →','v2-status-checks','text-button')}${btn('查看缺件 →','step','text-button','data-step="1"')}</div></article>
 <article class="v2-status-card"><h2>提交完整度</h2><progress max="100" value="${d.percent}" aria-label="必填項目完成度"></progress><p class="v2-status-fill"><span><b data-risk-completed>${d.completed}</b>／${d.required} 必填項已填寫</span><strong>${d.percent}%</strong></p><small class="hint">填寫率不等於驗證通過；格式、文件與費率仍須核對。</small><div class="v2-status-blockers">${d.blocks.slice(0,2).map(b=>`<button data-action="step" data-step="${b.step}"><span>${esc(b.label)}</span><strong>阻擋</strong></button>`).join('')||'<p class="v2-status-ok">目前無阻擋項</p>'}</div>${d.blocks.length>2?details('blocks','另有 '+(d.blocks.length-2)+' 項待處理',d.blocks.slice(2).map(b=>`<button class="v2-status-extra" data-action="step" data-step="${b.step}">${esc(b.label)} →</button>`).join('')):''}</article></section>`;
}
const v2ApplicationWithoutStatus=application;
application=function(step){const html=v2ApplicationWithoutStatus(step),marker='<div class="v2-version">OATS V2 · 六步申請流程</div>',split=html.indexOf(marker)+marker.length;return html.slice(0,split)+'<div class="v2-application-columns"><div class="v2-application-main">'+html.slice(split,-6)+'</div><aside id="v2-application-status" aria-label="申請狀態側欄">'+v2RiskOverview()+'</aside></div></div>';};
actions['v2-status-checks']=()=>modal('資料核對明細',v2ConsistencyCard()+`<h3>缺件／需重新提供</h3><ul>${v2MissingDocs().map(d=>`<li>${esc(d.name.split('\n')[0])}</li>`).join('')||'<li>沒有缺件</li>'}</ul>`,btn('關閉','close')+btn('前往文件材料','step','primary','data-step="1"'));
function v2RefreshStatus(){const n=document.getElementById('v2-application-status');if(n&&route().page==='application'){const top=n.scrollTop;n.innerHTML=v2RiskOverview();n.scrollTop=top;}}
document.addEventListener('toggle',e=>{if(e.target.dataset.v2StatusDetails)v2RiskOpen[e.target.dataset.v2StatusDetails]=e.target.open;},true);
document.addEventListener('input',e=>{if(e.target.dataset.field||e.target.dataset.v2InlineKey)v2RefreshStatus();});
document.addEventListener('change',e=>{if(e.target.closest('.v2-form'))v2RefreshStatus();});
Object.assign(window.AllinPayDemo,{getApplicationStatus:()=>{const d=v2ProgressData();return {step:route().step,score:d.score,policy:d.policy,required:d.required,completed:d.completed,percent:d.percent,missing:d.missing.length,blockers:d.blocks.length};}});

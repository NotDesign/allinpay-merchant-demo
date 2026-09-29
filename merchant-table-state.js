// Row identity is independent of the nullable MID returned by All-In Pay.
Object.assign(statusNames,{Syncing:'同步處理中',AwaitingResponse:'等待 All-In Pay 回應'});
Object.assign(statusColors,{Syncing:'blue',AwaitingResponse:'amber'});
function visibleMerchantColumns(){
 const boundary=BO.order.indexOf(BO.freezeThrough);
 const cols=BO.order.filter(h=>!BO.hidden.has(h));
 BO.pins=boundary<0?[]:BO.order.slice(0,boundary+1).filter(h=>!BO.hidden.has(h));
 return cols;
}
function midInfo(r){
 if(r['公司 MID'])return {label:r['公司 MID'],color:'',hint:'All-In Pay 已回傳 MID（Demo）',assigned:true};
 const states={Draft:['尚未提交','gray','尚未提交完整申請資料'],MoreInfo:['待補資料','amber','補齊資料並通過審核後才可同步'],Pending:['待審核','amber','審核通過後才可同步至 All-In Pay'],Approved:['待同步','purple','尚未送出至 All-In Pay'],Syncing:['處理中','blue','已送出，All-In Pay 正在處理，尚未產生 MID'],AwaitingResponse:['等待回應','amber','尚未收到 All-In Pay 回應；請查詢結果，勿重複提交'],SyncFailed:['同步失敗','red','同步失敗，尚未取得 MID；請查看失敗原因'],Rejected:['未獲批','red','申請未通過審核，尚未同步']};
 const [label,color,hint]=states[r.status]||['尚未取得 MID','gray','尚未收到 MID，請核對同步結果'];
 return {label,color,hint,assigned:false};
}
function midDisplay(r){const m=midInfo(r);return `<span class="merchant-mid" data-mid-state="${m.assigned?'assigned':esc(r.status)}" title="${esc(m.hint)}">${m.assigned?esc(m.label):pill(m.label,m.color)}</span>`;}
// Migrate saved demo rows without clearing drafts, selections or company edits.
// Legacy synthetic M numbers become stable internal IDs, not unassigned MIDs.
rows.forEach(r=>{
 // Previous form submissions generated M + 9 timestamp digits before any sync.
 // Recognize that legacy format only on saved applications with no success response.
 const legacyApplication=r.application&&/^M\d{9}$/.test(r['公司 MID']||'')&&!r.syncRespondedAt&&!['Synced','Enabled','Disabled'].includes(r.status);
 if(legacyApplication){r.id||=r['公司 MID'];r['公司 MID']='';}
 if(r.id)return;
 const legacy=r['公司 MID'];r.id=legacy||'APP-'+crypto.randomUUID();
 const seeded=/^M\d{6}$/.test(legacy||'');
 if(seeded&&!['Synced','Enabled','Disabled'].includes(r.status))r['公司 MID']='';
 if(seeded&&r.id==='M001006'&&r.status==='SyncFailed'){r.status='Syncing';r['公司 MID']='';}
 if(seeded&&r.id==='M001007'&&r.status==='Rejected'){r.status='AwaitingResponse';r['公司 MID']='';}
});
const midSync=sync;
sync=function(ids){
 if(!can(8))return deny();
 const eligible=ids.map(accessibleRow).filter(r=>r&&['Approved','SyncFailed'].includes(r.status));
 if(!eligible.length)return midSync(ids);
 if(state.fail)return midSync(ids);
 eligible.forEach(r=>{r.status='Syncing';r.syncRequestedAt=new Date().toISOString();});
 persistMerchantChange('模擬送出同步 · '+eligible.length+' 間，等待回應');
 modal('已送出，正在處理',`<div class="notice">${eligible.length} 間商戶已模擬送出，尚未取得新的 MID。</div><p>只有收到 All-In Pay 的成功回應後才會產生 MID。</p><p class="hint">此為 Demo，以下可演示不同回應；沒有向 All-In Pay 發送資料。</p>`,btn('關閉','close')+btn('等待回應','mid-demo-wait')+btn('模擬失敗','mid-demo-fail')+btn('模擬成功回應','mid-demo-success','primary'));
 BO.syncPending=eligible.map(rowKey);
};
function settleDemoSync(kind){
 if(!can(8))return deny();
 const list=(BO.syncPending||[]).map(accessibleRow).filter(r=>r&&['Syncing','AwaitingResponse'].includes(r.status));
 if(!list.length)return toast('沒有等待回應的商戶');
 list.forEach(r=>{
  r.status=kind==='success'?'Synced':kind==='fail'?'SyncFailed':'AwaitingResponse';
  if(kind==='success'){r['公司 MID']||='M'+crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase();r.syncRespondedAt=new Date().toISOString();}
  if(kind==='fail')r.syncReason='模擬回應：銀行資料驗證失敗，請核對後重試';
 });
 persistMerchantChange('模擬同步回應 · '+list.length+' 間');
 BO.syncPending=[];
 modal(kind==='success'?'同步完成':kind==='fail'?'同步失敗':'等待 All-In Pay 回應',`<div class="notice">${list.map(r=>esc(r['客戶中文名稱'])+'：'+midDisplay(r)).join('<br>')}</div><p class="hint">以上為本機 Demo 回應，未連接正式 All-In Pay。</p>`,btn('完成','close','primary'));
}
Object.assign(actions,{
 'mid-demo-success':()=>settleDemoSync('success'),'mid-demo-fail':()=>settleDemoSync('fail'),'mid-demo-wait':()=>settleDemoSync('wait'),
 'mid-check':el=>{const r=accessibleRow(el.dataset.mid);if(!r||!can(8)||!['Syncing','AwaitingResponse'].includes(r.status))return deny();BO.syncPending=[rowKey(r)];modal('查詢同步結果（Demo）',`<p>${esc(r['客戶中文名稱'])}</p><p>公司 MID：${midDisplay(r)}</p><p class="hint">沒有連接正式系統，請選擇要演示的回應。</p>`,btn('關閉','close')+btn('等待回應','mid-demo-wait')+btn('模擬失敗','mid-demo-fail')+btn('模擬成功回應','mid-demo-success','primary'));},
 'export-merchants':()=>{if(!can(4))return deny();const cols=BO.order.filter(h=>!['選取','操作'].includes(h));downloadCSV('allinpay-merchants-demo.csv',[[...cols,'MID 狀態'],...filteredRows().map(r=>[...cols.map(c=>c==='商戶狀態'?statusNames[r.status]:r[c]??''),midInfo(r).assigned?'已取得':midInfo(r).label])]);}
});

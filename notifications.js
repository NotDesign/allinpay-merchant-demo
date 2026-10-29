// Station notifications for the local demo. Reading never changes merchant state.
const NF_KEY='allinpay-station-notifications-v1';
let nfTab='all',nfActiveOwner='',nfVolatile={};
const nfHash=value=>{let h=2166136261;for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(36);};
function nfStore(){try{const value=JSON.parse(localStorage.getItem(NF_KEY)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}}
function nfAccount(){const owner=mtOwner();return {...{events:[],read:{}},...(nfStore()[owner]||{}),...(nfVolatile[owner]||{})};}
function nfSave(account){const owner=mtOwner();if(!owner)return;nfVolatile[owner]=account;try{const store=nfStore();store[owner]=account;localStorage.setItem(NF_KEY,JSON.stringify(store));delete nfVolatile[owner];}catch{ /* Notification storage must not block business operations. */ }}
function nfPush(event){try{if(!mtOwner())return;const a=nfAccount(),id=event.id||'event:'+crypto.randomUUID();a.events=[{...event,id,time:new Date().toISOString()},...a.events.filter(e=>e.id!==id)].slice(0,100);nfSave(a);nfRefresh();}catch{}}
function nfEntity(id){return MT_EXTERNAL?state.records.find(r=>r.id===id&&r.email===state.email):(accessibleRow(id)||scopedDrafts().find(d=>d.id===id));}
function nfFeed(){
 if(!mtOwner())return [];
 const account=nfAccount(),events=account.events.filter(e=>!e.ids?.length||e.ids.some(id=>!!nfEntity(id))).map(e=>({...e,needsAction:!!e.needsAction&&(e.type==='sync'?e.ids.some(id=>['SyncFailed','Syncing','AwaitingResponse'].includes(nfEntity(id)?.status)):e.type==='review'?e.ids.some(id=>['Pending','MoreInfo','Approved'].includes(nfEntity(id)?.status)):true)}));
 const tasks=[];
 const add=(id,type,title,description,list,target,severity='info',needsAction=true)=>{if(list.length)tasks.push({id:'task:'+id,type,title,description,ids:list.map(r=>MT_EXTERNAL?r.id:rowKey(r)),target,severity,needsAction,current:true});};
 if(MT_EXTERNAL){const list=state.records.filter(r=>r.email===state.email);add('drafts','application','尚有 '+list.filter(r=>r.status==='草稿').length+' 份草稿待完成','可從上次儲存的位置繼續填寫。',list.filter(r=>r.status==='草稿'),'drafts');for(const status of ['審核中','已完成']){const items=list.filter(r=>r.status===status);add(status,'application',items.length+' 份申請'+status,status==='已完成'?'可查看已完成的 Demo 申請與資料。':'申請已提交，等待審核回應。',items,'applications','info',false);}}
 else{
 const list=scopedRows();
 for(const [status,type,label,description,severity] of [
 ['SyncFailed','sync','同步失敗','請核對失敗原因與銀行資料，再重新同步。','error'],
 ['MoreInfo','application','待補資料','請依補件清單補齊後重新提交。','warning'],
 ['Pending','review','待審核',can(7)?'可進入商戶資料或內審控制台處理。':'申請已提交，等待有權限的同事審核。','info'],
 ['Approved','sync','審核通過，等待同步','核對設定後，可同步至 All-In Pay。','info'],
 ['AwaitingResponse','sync','等待 All-In Pay 回應','可查詢處理結果；尚未收到成功回應前不會產生 MID。','warning']]){const items=list.filter(r=>r.status===status);add(status,type,items.length+' 家商戶'+label,description,items,'status:'+status,severity);}
 const today=new Date();today.setHours(0,0,0,0);const expiring=list.filter(r=>{const raw=r.application?.values?.registerCertPeriod||r['BR 有效期'],match=String(raw||'').match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);if(!match)return false;const days=(new Date(+match[1],+match[2]-1,+match[3])-today)/86400000;return days<=30;});
 add('expiry','expiry',expiring.length+' 家商戶 BR 已到期或將於 30 天內到期','請核對證照有效期，並更新文件與到期日。',expiring,'expiry','warning');
 }
 return [...events,...tasks].map(n=>{const fingerprint=nfHash(JSON.stringify([n.title,n.description,n.ids,n.needsAction,n.time]));return {...n,fingerprint,unread:account.read[n.id]!==fingerprint};});
}
const nfTypeName=type=>({application:'申請與補件',review:'審核',sync:'同步與 MID',expiry:'證照提醒',batch:'批量作業',import:'資料匯入'}[type]||'系統');
function nfRead(id){const item=nfFeed().find(n=>n.id===id);if(!item)return;const a=nfAccount();a.read[item.id]=item.fingerprint;nfSave(a);nfRefresh();}
function nfPanel(){
 let node=$('#nf-center');if(node)return node;node=document.createElement('dialog');node.id='nf-center';node.setAttribute('aria-labelledby','nf-title');document.body.append(node);node.addEventListener('click',e=>{if(e.target===node){const b=node.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)node.close();}});return node;
}
function nfPaint(){
 const node=nfPanel(),all=nfFeed(),unread=all.filter(n=>n.unread).length,todo=all.filter(n=>n.needsAction).length,list=all.filter(n=>nfTab==='unread'?n.unread:nfTab==='todo'?n.needsAction:true);
 node.innerHTML=`<header class="nf-head"><div><h2 id="nf-title">通知中心</h2><p>${unread} 則未讀 · ${todo} 項待處理</p></div>${btn('×','nf-close','nf-close','aria-label="關閉通知中心"')}</header><nav class="nf-tabs" aria-label="通知分類">${[['all','全部',all.length],['unread','未讀',unread],['todo','待處理',todo]].map(([key,label,count])=>btn(label+' <span>'+count+'</span>','nf-tab',nfTab===key?'active':'',`data-tab="${key}" aria-pressed="${nfTab===key}"`)).join('')}</nav><div class="nf-tools"><span>已讀不會清除待辦</span>${btn('全部標為已讀','nf-read-all','',unread?'':'disabled')}</div><div class="nf-list">${list.map(n=>`<article class="nf-item ${n.unread?'unread':''}" data-nf-item="${esc(n.id)}"><div class="nf-item-meta"><span class="nf-category ${esc(n.severity||'info')}">${nfTypeName(n.type)}</span><span>${n.current?'目前待辦':esc(new Date(n.time).toLocaleString('zh-TW',{hour12:false}))}</span>${n.unread?'<b class="nf-dot" aria-label="未讀"></b>':''}</div><h3>${esc(n.title)}</h3><p>${esc(n.description||'')}</p><div class="nf-item-foot"><span class="${n.needsAction?'nf-pending':'nf-done'}">${n.needsAction?'待處理':'作業記錄'}</span><div>${n.unread?btn('標為已讀','nf-read','',`data-nf-id="${esc(n.id)}"`):''}${btn(n.needsAction?'前往處理':'查看詳情','nf-view','primary',`data-nf-id="${esc(n.id)}"`)}</div></div></article>`).join('')||'<div class="nf-empty"><strong>'+ (nfTab==='unread'?'目前沒有未讀通知':nfTab==='todo'?'目前沒有待處理事項':'目前沒有通知')+'</strong><p>申請、審核、同步及批量作業的結果會集中顯示於此。</p></div>'}</div><footer class="nf-foot">Demo 站內通知 · 僅記錄此瀏覽器的模擬作業</footer>`;
}
const nfBell=()=>`<button type="button" class="nf-bell" data-action="nf-open" aria-label="開啟通知中心" title="通知中心"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span class="nf-badge" hidden></span></button>`;
function nfRefresh(){if(!mtOwner())return;const count=nfFeed().filter(n=>n.unread).length;for(const bell of $$('.nf-bell')){bell.setAttribute('aria-label','通知中心，'+count+' 則未讀');const badge=bell.querySelector('.nf-badge');badge.hidden=!count;badge.textContent=count>99?'99+':count;}if($('#nf-center')?.open)nfPaint();}
function nfMount(){
 const owner=mtOwner();if(!owner){$('#nf-center')?.close();nfActiveOwner='';return;}if(nfActiveOwner!==owner){$('#nf-center')?.close();nfTab='all';nfActiveOwner=owner;}
 if(!$('.nf-bell')){if(MT_EXTERNAL){$('.header-actions')?.insertAdjacentHTML('afterbegin',nfBell());}else{const tab=$('.main>.tabs');if(tab){const wrap=document.createElement('div');wrap.className='nf-header';tab.before(wrap);wrap.append(tab);wrap.insertAdjacentHTML('beforeend',nfBell());}else $('.main')?.insertAdjacentHTML('afterbegin','<div class="nf-standalone-bar">'+nfBell()+'</div>');}}
 nfRefresh();
}
function nfView(el){
 const item=nfFeed().find(n=>n.id===el.dataset.nfId);if(!item)return;nfRead(item.id);$('#nf-center').close();
 if(MT_EXTERNAL){const record=item.ids?.map(nfEntity).find(Boolean);if(record&&!item.current)loadRecord(record);else go('applications');return;}
 const status=item.target?.startsWith('status:')?item.target.slice(7):'';
 if(status||item.target==='expiry'){state.search='';state.searchScope='全部欄位';state.status=status?statusNames[status]:'全部狀態';state.page=1;DEMO.columnFilters=item.target==='expiry'?{'BR 有效期':[...new Set(scopedRows().filter(r=>item.ids.includes(rowKey(r))).map(r=>cellValue(r,'BR 有效期')))]}:{};go('merchants');return;}
 const row=item.ids?.map(id=>accessibleRow(id)).find(Boolean);if(row){detail(rowKey(row));return;}
 if(item.target==='drafts'||item.ids?.some(id=>scopedDrafts().some(d=>d.id===id)))go('drafts');else go('activity');
}
Object.assign(actions,{'nf-open':()=>{nfTab='all';nfPaint();nfPanel().showModal();$('#nf-center [data-action="nf-close"]').focus();},'nf-close':()=>$('#nf-center').close(),'nf-tab':el=>{nfTab=el.dataset.tab;nfPaint();},'nf-read':el=>nfRead(el.dataset.nfId),'nf-read-all':()=>{const a=nfAccount();for(const n of nfFeed())a.read[n.id]=n.fingerprint;nfSave(a);nfRefresh();},'nf-view':nfView});
const nfRender=render;render=function(){nfRender();nfMount();};
// Completed actions only: a preview or an unsuccessful validation does not notify.
const nfSubmit=actions['confirm-submit'];actions['confirm-submit']=el=>{const before=MT_EXTERNAL?new Map(state.records.map(r=>[r.id,r])):new Map(rows.map(r=>[rowKey(r),r.status]));nfSubmit(el);if($('#modal-title')?.textContent!=='申請提交成功')return;const row=MT_EXTERNAL?state.records.find(r=>r.id===state.id&&r.status!=='草稿'):rows.find(r=>r.status==='Pending'&&(!before.has(rowKey(r))||rowKey(r)===state.editing));if(row){const id=MT_EXTERNAL?row.id:rowKey(row);nfPush({id:'submit:'+id,type:'application',title:'申請已提交 · '+(MT_EXTERNAL?row.values.merchantName||row.values.companyZh||row.values.companyEn:row['客戶中文名稱']),description:'已建立 Demo 申請，等待審核；可查看提交資料及目前進度。',ids:[id],target:'entity'});}};
if(!MT_EXTERNAL){
 const nfReview=actions['review-save'];actions['review-save']=el=>{const id=DEMO.review?.mid,before=accessibleRow(id)?.status;nfReview(el);const row=accessibleRow(id);if(row&&row.status!==before)nfPush({id:'review:'+id,type:'review',title:'審核結果 · '+row['客戶中文名稱'],description:statusNames[row.status]+(row.reviewNote?' · '+row.reviewNote:''),ids:[id],target:'entity',needsAction:['MoreInfo','Approved'].includes(row.status),severity:row.status==='MoreInfo'?'warning':'info'});};
 const nfIrSave=actions['ir-save'];actions['ir-save']=el=>{const id=IR.pending?.mid,before=accessibleRow(id)?.internalReview?.revision||0;nfIrSave(el);const row=accessibleRow(id);if(row&&(row.internalReview?.revision||0)>before)nfPush({id:'review:'+id,type:'review',title:'內審結果 · '+row['客戶中文名稱'],description:row.internalReview.trail.at(-1).message,ids:[id],target:'entity',needsAction:['Pending','MoreInfo','Approved'].includes(row.status),severity:row.status==='MoreInfo'?'warning':'info'});};
 const nfSettle=settleDemoSync;settleDemoSync=kind=>{const ids=(BO.syncPending||[]).filter(id=>['Syncing','AwaitingResponse'].includes(accessibleRow(id)?.status));nfSettle(kind);if(!ids.length||!can(8))return;nfPush({id:'sync:'+nfHash([...ids].sort().join('|')),type:'sync',title:kind==='success'?ids.length+' 家商戶同步完成，已取得 MID':kind==='fail'?ids.length+' 家商戶同步失敗':ids.length+' 家商戶等待 All-In Pay 回應',description:kind==='success'?'可查看 All-In Pay 模擬回傳的 MID。':kind==='fail'?'請核對失敗原因與銀行資料後重試。':'尚未收到成功回應，請稍後查詢結果。',ids,target:ids.length>1?'status:'+(kind==='success'?'Synced':kind==='fail'?'SyncFailed':'AwaitingResponse'):'entity',needsAction:kind!=='success',severity:kind==='fail'?'error':kind==='wait'?'warning':'info'});};
}
const nfWrite=mtWriteTargets;mtWriteTargets=function(plans,message){const ids=plans.map(p=>p.id).filter(Boolean),id='batch:'+nfHash([...ids].sort().join('|'));try{const result=nfWrite(plans,message);nfPush({id,type:'batch',title:plans.length+' 家商戶已套用參數模板',description:message+'；每家公司仍需獨立核對及提交。',ids,target:'drafts'});return result;}catch(e){nfPush({id,type:'batch',title:plans.length+' 家商戶批量套用失敗',description:'所有設定仍保留原值。請返回模板批量設定後重試。',ids,target:'drafts',needsAction:true,severity:'error'});throw e;}};
const nfImport=actions['mt-import-confirm'];actions['mt-import-confirm']=el=>{const before=new Set((MT_EXTERNAL?state.records:state.drafts).map(r=>r.id));nfImport(el);const additions=(MT_EXTERNAL?state.records.filter(r=>r.email===state.email):scopedDrafts()).filter(r=>!before.has(r.id));if(additions.length)nfPush({id:'import:'+nfHash(additions.map(r=>r.id).sort().join('|')),type:'import',title:'已匯入 '+additions.length+' 家公司草稿',description:'母／子公司關係、MCC 及產品費率已帶入。可前往草稿核對。',ids:additions.map(r=>r.id),target:'drafts'});};
window.addEventListener('storage',e=>{if([NF_KEY,MT_EXTERNAL?KEY:DBKEY].includes(e.key))nfRefresh();});

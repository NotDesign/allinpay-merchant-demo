// Shared onboarding tools: MCC, company relationships, templates and batch import.
const MT=MerchantTemplateModel.create(V2),MT_EXTERNAL=!!window.AllinPayDemo.external;
const MT_KEY='allinpay-merchant-templates-v1';
const MT_CUSTOMERS_KEY='allinpay-customer-groups-v1';
let mtFlow=null,mtImport=null,mtImportSequence=0,mtStartTemplate=false;
let mtCreatingCustomerOpen=false,mtCompanyNameInRelationship=false;
let mtRenderPending=false;
function mtRefreshForm(){if(mtRenderPending)return;mtRenderPending=true;queueMicrotask(()=>{mtRenderPending=false;if(['application','merchant-setup'].includes(route().page))render();});}
const mtOwner=()=>MT_EXTERNAL?(state.session&&state.email?'external:'+state.email.toLowerCase():''):(BO.user?'backoffice:'+BO.user.id:'');
const mtAllowed=()=>!!mtOwner()&&!state.readonly&&(MT_EXTERNAL||can(1));
const mtRoleName=role=>({parent:'母公司',subsidiary:'子公司',independent:'獨立公司'}[role]||'獨立公司');
const mtNow=()=>new Date().toLocaleString('zh-HK',{hour12:false});
// Native dialogs occupy the top layer; notifications need their own top-layer entry.
toast=function(text){const node=$('#toast');node.textContent=text;node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.classList.add('visible');if(node.showPopover){node.setAttribute('popover','manual');if(node.matches(':popover-open'))node.hidePopover();node.showPopover();}else if($('#modal').open)$('#modal').append(node);clearTimeout(toast.timer);toast.timer=setTimeout(()=>{node.classList.remove('visible');if(node.hidePopover&&node.matches(':popover-open'))node.hidePopover();if(!node.showPopover)document.body.append(node);},3500);};
const mtError=message=>{const node=$('#mt-error');if(node)node.textContent=message;else toast(message);};
function mtStorage(){try{const value=JSON.parse(localStorage.getItem(MT_KEY)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}}
function mtTemplates(){return (mtStorage()[mtOwner()]||[]).map(t=>{try{return MT.cleanTemplate(t);}catch{return null;}}).filter(Boolean);}
function mtSaveTemplates(list){if(!mtAllowed())throw Error('請先登入');const store=mtStorage();store[mtOwner()]=list;localStorage.setItem(MT_KEY,JSON.stringify(store));}
function mtMccList(values=state.values){return MT.codes(values.mccCodes||values.mcc);}
function mtSyncMcc(){
 const primary=v2Raw('mcc');if(!primary){state.values.mccCodes=[];return;}
 const list=mtMccList();if(/^\d{4}$/.test(primary)&&!list.includes(primary))list.unshift(primary);state.values.mccCodes=list;
}
const mtOriginalSync=v2SyncDerived;
v2SyncDerived=function(){mtSyncMcc();mtSyncRelationship();mtOriginalSync();state.values.mccName=mtMccList().map(c=>V2.catalog.MCCS.find(m=>m.c===c)?.n||c+'（待核定）').join('、');};
const mtOriginalScore=v2Score;
v2Score=function(){
 const result=mtOriginalScore(),selected=mtMccList().map(c=>V2.catalog.MCCS.find(m=>m.c===c)).filter(Boolean);
 const industryItems=result.items.filter(i=>!/^MCC 屬|^平均單筆偏離/.test(i.label));
 const high=selected.filter(m=>m.lv==='high'),mid=selected.filter(m=>m.lv==='mid');
 if(high.length)industryItems.push({label:'所選 MCC 含高風險（'+high.map(m=>m.c).join('、')+'）',n:25});
 else if(mid.length)industryItems.push({label:'所選 MCC 含中風險（'+mid.map(m=>m.c).join('、')+'）',n:12});
 if(selected.some(m=>v2Num('avgPerAmount')>m.avg*3))industryItems.push({label:'平均單筆偏離所選行業常態超過 3 倍',n:12});
 const total=Math.min(100,industryItems.reduce((s,i)=>s+i.n,0)),s=v2Model().signals;
 return {...result,items:industryItems,total,level:total<=20?'1':total<=45?'2':'3',reject:s.sanction?'命中制裁／PEP 名單':s.frozen?'關聯已凍結／關閉商戶':total>70?'風控評分超過 70':null};
};
v2SmeOptions=function(brand){const list=mtMccList().map(Number),rules=V2.catalog.SME_RULES[brand];return ['SME','SMESMK','SMEB2B'].filter(type=>{const r=rules[type];return r&&list.length&&list.every(m=>r.only?r.only.includes(m):!r.ex.some(x=>Array.isArray(x)?m>=x[0]&&m<=x[1]:m===x));});};
const mtOriginalField=v2Field;
v2Field=function(f,index=0,linked=false){
 if(f.id==='merchantName'&&mtCompanyNameInRelationship)return '';
 if(['groupId','parentMerchant'].includes(f.id)&&state.values.__customer?.id){const group=f.id==='groupId';return mtOriginalField({...f,placeholder:group?'依上方選取的客戶／集團帶入':state.values.__customer.role==='subsidiary'?'請先選擇所屬母公司':'無上級商戶',hint:group?'由上方「選取客戶／集團」自動帶入；修改請使用「管理客戶／集團」。':'由上方「所屬母公司」自動帶入；母公司及獨立公司無上級商戶。'},index,true);}
 const original=mtOriginalField(f,index,linked);if(f.id!=='mcc'||!original)return original;
 const list=mtMccList(),error=state.errors.mcc;
 return `<div class="field mt-mcc-field ${error?'invalid':''}" data-field-wrap="mcc"><label id="mt-mcc-label">MCC 行業代碼 <span class="required">*</span><span class="en">Merchant Category Code</span></label><details class="mt-mcc-picker"><summary id="field-mcc" aria-labelledby="mt-mcc-label mt-mcc-value"><span id="mt-mcc-value">${list.length?'已選 '+list.length+' 個 MCC':'請選擇 MCC（可複選）'}</span><span class="mt-mcc-arrow" aria-hidden="true"></span></summary><div class="mt-mcc-panel"><label for="mt-mcc-search" class="sr-only">搜尋 MCC 代碼或行業名稱</label><input id="mt-mcc-search" placeholder="搜尋代碼或行業名稱" autocomplete="off"><div class="mt-mcc-options" role="group" aria-label="MCC 複選選項">${mtMccOptions()}</div><div class="mt-mcc-panel-foot"><small>可連續勾選，第一個為主要代碼</small>${btn('完成','mt-mcc-done')}</div></div></details><div class="mt-mcc-chips" aria-label="已選 MCC">${list.map(code=>`<span>${code===v2Raw('mcc')?`<strong>${esc(code)} · 主要</strong>`:btn(esc(code),'mt-mcc-primary','',`data-code="${esc(code)}" aria-label="設 ${esc(code)} 為主要 MCC"`)}${btn('×','mt-mcc-remove','',`data-code="${esc(code)}" aria-label="移除 MCC ${esc(code)}"`)}</span>`).join('')}</div><small class="hint">風控參考採最高風險；特計方案須同時適用所有所選代碼。點選標籤代碼可設為主要。</small>${error?`<div class="error" role="alert">${esc(error)}</div>`:''}</div>`;
};
function mtMccOptions(query=''){
 const selected=mtMccList(),known=new Set(V2.catalog.MCCS.map(m=>m.c)),options=[...V2.catalog.MCCS,...selected.filter(c=>!known.has(c)).map(c=>({c,n:'待核定行業'}))],q=query.trim().toLowerCase();
 if(/^\d{4}$/.test(q)&&!options.some(m=>m.c===q))options.push({c:q,n:'其他行業（待核定）'});
 return options.filter(m=>(m.c+' '+m.n).toLowerCase().includes(q)).map(m=>`<label class="check" data-mt-mcc-option="${m.c}"><input type="checkbox" data-mt-mcc="${m.c}" ${selected.includes(m.c)?'checked':''}><span>${m.c} · ${esc(m.n)}</span>${m.c===v2Raw('mcc')?'<small>主要</small>':''}</label>`).join('')||'<p class="hint">沒有符合的項目；其他代碼可輸入完整 4 位數字。</p>';
}
function mtRenderMcc(){
 const picker=$('.mt-mcc-picker'),open=picker?.open,query=$('#mt-mcc-search')?.value||'',scroll=$('.mt-mcc-options')?.scrollTop||0,active=document.activeElement,code=active?.dataset.mtMcc,focusSearch=active?.id==='mt-mcc-search';
 v2SyncDerived();render();const next=$('.mt-mcc-picker');if(!next)return;next.open=!!open;
 if(query){$('#mt-mcc-search').value=query;$('.mt-mcc-options').innerHTML=mtMccOptions(query);}$('.mt-mcc-options').scrollTop=scroll;
 if(open){const focus=focusSearch?$('#mt-mcc-search'):code?$(`[data-mt-mcc="${code}"]`):$('#field-mcc');focus?.focus({preventScroll:true});}
}
function mtCloseMcc(){const picker=$('.mt-mcc-picker');if(picker?.open){picker.open=false;$('#mt-mcc-search').value='';$('.mt-mcc-options').innerHTML=mtMccOptions();$('#field-mcc')?.focus({preventScroll:true});}}
function mtSnapshot(){v2Ensure();v2SyncDerived();return {values:structuredClone(state.values),people:structuredClone(state.people),files:structuredClone(state.files),checks:structuredClone(state.checks),emailVerified:state.emailVerified,signature:state.signature||''};}
function mtBlank(values={},people={directors:1,authSigners:0,shareHolders:0}){
 const saved={values:state.values,people:state.people,files:state.files,checks:state.checks,emailVerified:state.emailVerified};
 try{state.values=structuredClone(V2.defaults);state.people={directors:1,authSigners:0,shareHolders:0};state.files={};state.checks={};state.emailVerified=false;v2Ensure();Object.assign(state.people,structuredClone(people));Object.assign(state.values,structuredClone(values));v2Model().legacy=false;v2SyncDerived();return mtSnapshot();}finally{Object.assign(state,saved);}
}
function mtUpgradeSnapshot(snapshot){
 if(snapshot.values?.__v2?.version===2)return snapshot;
 const saved={values:state.values,people:state.people,files:state.files,checks:state.checks,emailVerified:state.emailVerified};
 try{state.values=structuredClone(snapshot.values||{});state.people=structuredClone(snapshot.people||{directors:1,authSigners:0,shareHolders:0});state.files=structuredClone(snapshot.files||{});state.checks=structuredClone(snapshot.checks||{});state.emailVerified=!!snapshot.emailVerified;v2Ensure();v2SyncDerived();return {...snapshot,values:structuredClone(state.values),people:structuredClone(state.people)};}finally{Object.assign(state,saved);}
}
function mtTargets(){
 if(!mtAllowed())return [];
 if(MT_EXTERNAL)return state.records.filter(r=>r.email===state.email&&r.status==='草稿').map(r=>({key:'record:'+r.id,id:r.id,kind:'record',record:r,snapshot:r,name:r.values.merchantName||r.values.companyZh||r.values.merchantEnglishName||'未命名商戶'}));
 const drafts=scopedDrafts().map(d=>({key:'draft:'+d.id,id:d.id,kind:'draft',record:d,snapshot:mtUpgradeSnapshot(d),name:d.values.merchantName||d.values.merchantEnglishName||'未命名商戶'}));
 const rowTargets=can(2)?scopedRows().filter(r=>r.status==='Draft').map(r=>({key:'row:'+rowKey(r),id:rowKey(r),kind:'row',record:r,snapshot:r.application||mtBlank({merchantName:r['客戶中文名稱'],merchantEnglishName:r['客戶英文名稱'],registerCertNo:r.BR,mcc:r['MCC 行業代碼']?.split(/[、,;]/)[0]||'',contactName:r['客戶聯繫人'],contactPhone:r['聯絡人電話'],contactEmail:r['聯絡人電郵']}),name:r['客戶中文名稱']})):[];
 return [...drafts,...rowTargets];
}
function mtCompanies(){
 const own=mtTargets();if(MT_EXTERNAL)return [...own,...state.records.filter(r=>r.email===state.email&&r.status!=='草稿').map(r=>({id:r.id,name:r.values.merchantName||r.values.companyZh,snapshot:r}))];
 return [...own,...scopedRows().filter(r=>r.status!=='Draft').map(r=>({id:rowKey(r),name:r['客戶中文名稱'],snapshot:r.application||{values:{}}}))];
}
function mtCustomerStore(){try{const store=JSON.parse(localStorage.getItem(MT_CUSTOMERS_KEY)||'{}');return store&&typeof store==='object'&&!Array.isArray(store)?store:{};}catch{return {};}}
function mtParentMerchantName(relation){
 // Read scoped saved records directly: mtCompanies also constructs blank snapshots.
 const id=String(relation.parentId||''),name=v=>v?.merchantName||v?.merchantEnglishName||'';
 if(MT_EXTERNAL){const parent=state.records.find(r=>r.email===state.email&&String(r.id)===id);return name(parent?.values);}
 const draft=scopedDrafts().find(d=>String(d.id)===id);if(draft)return name(draft.values);
 const row=scopedRows().find(r=>String(rowKey(r))===id);return name(row?.application?.values)||row?.['客戶中文名稱']||row?.['客戶英文名稱']||'';
}
function mtSyncRelationship(values=state.values,parentName){
 const relation=values.__customer;
 if(!relation?.id){if(values.__relationshipLinked){values.groupId='';values.parentMerchant='';delete values.__relationshipLinked;}return values;}
 const stored=mtCustomerStore()[mtOwner()]?.[relation.id];if(stored?.name)relation.name=stored.name;
 values.groupId=relation.name||'';
 values.parentMerchant=relation.role==='subsidiary'?(relation.parentType==='group'?relation.name||'':parentName??mtParentMerchantName(relation)):'';
 values.__relationshipLinked=true;
 return values;
}
function mtDefaultParent(relation){if(relation.role!=='subsidiary'){relation.parentId='';delete relation.parentType;}else if(relation.id&&relation.name&&!relation.parentId){relation.parentId=relation.id;relation.parentType='group';}return relation;}
function mtOpenCreateCustomer(){
 if(!mtAllowed())return;const select=$('#mt-customer');if(select)select.value=state.values.__customer?.id||'';
 mtCreatingCustomerOpen=true;mtDialog('新建客戶／集團',`<p class="hint">建立共用的客戶／集團後，再於主畫面填寫本次申請的公司名稱。</p><div class="field"><label for="mt-new-customer-name">客戶／集團名稱 <span class="required">*</span></label><input id="mt-new-customer-name" maxlength="100" autocomplete="off" placeholder="例如：ABC 集團"><small class="hint">建立後會自動選取，可供同一客戶的其他公司使用。</small></div>`,btn('取消','mt-close')+btn('建立並選取','mt-customer-create','primary'));$('#modal').classList.add('mt-customer-dialog');$('#mt-new-customer-name').focus();
}
function mtCreateCustomer(){
 if(!mtAllowed()||!mtCreatingCustomerOpen)return;
 try{const name=$('#mt-new-customer-name').value.trim();if(!name||name.length>100)throw Error('請輸入 1–100 字的客戶／集團名稱');if(mtCustomers().some(c=>c.name.trim().toLocaleLowerCase()===name.toLocaleLowerCase()))throw Error('已有同名客戶／集團，請返回主畫面直接選取');if(mtFailureActive())throw Error('模擬儲存失敗，請關閉失敗模擬後重試；目前資料保持原值。');
  const customer={id:'CUS-'+crypto.randomUUID(),name},store=mtCustomerStore();store[mtOwner()]={...(store[mtOwner()]||{}),[customer.id]:customer};localStorage.setItem(MT_CUSTOMERS_KEY,JSON.stringify(store));
  state.values.__customer=mtDefaultParent({...customer,role:state.values.__customer?.role||'independent',parentId:''});delete state.errors._customer;mtCreatingCustomerOpen=false;mtClose();render();$('#field-merchantName')?.focus({preventScroll:true});toast('已建立並選取「'+name+'」');
 }catch(e){mtError(e.message);$('#mt-new-customer-name')?.focus();}
}
function mtCustomers(){const map=new Map();for(const c of mtCompanies()){const relation=c.snapshot.values?.__customer;if(relation?.id)map.set(relation.id,{...relation,name:relation.name||'待命名客戶／集團（'+c.name+'）'});}for(const c of Object.values(mtCustomerStore()[mtOwner()]||{}))if(c.id&&c.name)map.set(c.id,c);const current=state.values.__customer;if(current?.id&&current.name)map.set(current.id,current);return [...map.values()];}
function mtManageCustomers(){if(!mtAllowed())return;const groups=mtCustomers();mtDialog('管理客戶／集團',`<p class="hint">可修改名稱或刪除分組；各公司的資料會保留。</p><div class="mt-customer-list">${groups.map(c=>{const count=mtCompanies().filter(x=>x.snapshot.values?.__customer?.id===c.id).length;return `<article data-mt-group-row="${esc(c.id)}"><div class="field"><label>客戶／集團名稱 <small>· ${count} 家公司</small><input aria-label="${esc(c.name)} 新名稱" data-mt-group-name maxlength="100" value="${esc(c.name)}"></label></div><div class="mt-template-actions">${btn('儲存名稱','mt-group-rename','primary',`data-id="${esc(c.id)}"`)}${btn('刪除分組','mt-group-delete','danger',`data-id="${esc(c.id)}"`)}</div></article>`;}).join('')||'<p>尚未建立客戶／集團。請在表單選擇「新建客戶／集團」，再於視窗中建立。</p>'}</div>`,btn('完成','mt-close'));}
let mtGroupDelete=null;
function mtDeleteCustomer(id,selected=''){
 const group=mtCustomers().find(c=>c.id===id);if(!group)return mtManageCustomers();const others=mtCustomers().filter(c=>c.id!==id),companies=mtCompanies().filter(c=>c.snapshot.values?.__customer?.id===id);mtGroupDelete={id,targetId:selected,preview:false};
 mtDialog('移轉公司並刪除客戶／集團',`<p>即將刪除 <strong>${esc(group.name)}</strong>，目前關聯 ${companies.length} 家公司。</p><div class="field"><label for="mt-group-replacement">選擇替代的客戶／集團</label><select id="mt-group-replacement"><option value="">請選擇處理方式</option>${others.map(c=>`<option value="${esc(c.id)}" ${c.id===selected?'selected':''}>移轉至 ${esc(c.name)}</option>`).join('')}<option value="__ungroup" ${selected==='__ungroup'?'selected':''}>不指定替代集團，解除分組</option></select></div><p class="hint">移轉時保留公司資料與原母／子公司關係；解除分組則改為獨立公司。下一步可先確認影響範圍。</p>`,btn('取消','mt-customer-manage')+btn('預覽移轉與刪除','mt-group-delete-preview','primary'));
}
function mtDeleteCustomerPreview(){
 if(!mtGroupDelete)return;const targetId=$('#mt-group-replacement')?.value,group=mtCustomers().find(c=>c.id===mtGroupDelete.id),target=mtCustomers().find(c=>c.id===targetId);if(!targetId||targetId!=='__ungroup'&&!target)return mtError('請選擇替代的客戶／集團，或明確選擇解除分組');const companies=mtCompanies().filter(c=>c.snapshot.values?.__customer?.id===mtGroupDelete.id);mtGroupDelete={...mtGroupDelete,targetId,preview:true,fingerprint:JSON.stringify(companies.map(c=>[c.id,c.snapshot.values.__customer]))};
 mtDialog('確認移轉與刪除',`<div class="notice warn">刪除「${esc(group.name)}」後，${companies.length} 家公司將${target?'移轉至「'+esc(target.name)+'」':'解除分組並改為獨立公司'}。公司及申請資料保留。</div><div class="mt-customer-move-preview">${companies.map(c=>`<div><strong>${esc(c.name)}</strong><span>${esc(group.name)} → ${target?esc(target.name):'未分組'} · ${target?mtRoleName(c.snapshot.values.__customer.role):'獨立公司'}</span></div>`).join('')||'<p>沒有已儲存的公司關聯；目前表單的分組也會同步更新。</p>'}</div>`,btn('返回選擇','mt-group-delete-back')+btn('確認移轉並刪除','mt-group-delete-confirm','danger'));
}
function mtUpdateCustomerReferences(id,relation){
 if(mtFailureActive())throw Error('模擬儲存失敗，所有公司與客戶分組保持原值。請關閉失敗模擬後重試。');
 const patch=record=>record.values?.__customer?.id===id?{...record,values:mtSyncRelationship({...record.values,__relationshipLinked:true,__customer:relation(record.values.__customer)})}:record;
 if(MT_EXTERNAL){const next=state.records.map(r=>r.email===state.email?patch(r):r);localStorage.setItem(KEY,JSON.stringify(next));state.records=next;return;}
 const beforeDrafts=state.drafts,beforeRows=[...rows],beforeAudit=BO.audit,draftIds=new Set(scopedDrafts().map(d=>d.id)),rowIds=new Set(scopedRows().map(rowKey));
 try{state.drafts=state.drafts.map(d=>draftIds.has(d.id)?patch(d):d);rows.splice(0,rows.length,...rows.map(row=>{if(!rowIds.has(rowKey(row)))return row;const app=row.application?patch(row.application):row.application;return {...row,application:app,...(row.application?.values?.__customer?.id===id?{'所屬集團':app.values.groupId||''}:{}),customer:row.customer?.id===id?relation(row.customer):row.customer};}));BO.audit=[{time:mtNow(),user:BO.user.name,message:'更新客戶／集團分組關聯'},...BO.audit];if(!persistDemo())throw Error('瀏覽器儲存失敗，所有公司分組仍保留原值');}
 catch(e){state.drafts=beforeDrafts;rows.splice(0,rows.length,...beforeRows);BO.audit=beforeAudit;throw e;}
}
function mtChangeCustomer(id,name,remove=false,targetId=''){
 try{if(!mtAllowed())return;const store=mtCustomerStore(),before=localStorage.getItem(MT_CUSTOMERS_KEY),target=remove&&targetId!=='__ungroup'?mtCustomers().find(c=>c.id===targetId):null;
  if(remove&&(!mtGroupDelete?.preview||mtGroupDelete.id!==id||targetId!=='__ungroup'&&(!target||target.id===id)))throw Error('請先預覽並確認有效的替代集團');
  if(remove){const current=mtCompanies().filter(c=>c.snapshot.values?.__customer?.id===id);if(JSON.stringify(current.map(c=>[c.id,c.snapshot.values.__customer]))!==mtGroupDelete.fingerprint)throw Error('公司關聯已變動，請返回重新預覽');}
  if(!remove&&(!name.trim()||name.trim().length>100))throw Error('請輸入 1–100 字的客戶／集團名稱');
  const relation=c=>remove?(target?{...c,id:target.id,name:target.name,...(c.parentType==='group'?{parentId:target.id}:{})}:{id:'',name:'',role:'independent',parentId:''}):{...c,name:name.trim()};
  store[mtOwner()]={...(store[mtOwner()]||{})};if(remove)delete store[mtOwner()][id];else store[mtOwner()][id]={id,name:name.trim()};
  localStorage.setItem(MT_CUSTOMERS_KEY,JSON.stringify(store));try{mtUpdateCustomerReferences(id,relation);}catch(e){if(before===null)localStorage.removeItem(MT_CUSTOMERS_KEY);else localStorage.setItem(MT_CUSTOMERS_KEY,before);throw e;}
  if(state.values.__customer?.id===id)state.values.__customer=relation(state.values.__customer);mtGroupDelete=null;render();mtManageCustomers();toast(remove?'已完成移轉並刪除分組；公司資料保留':'已更新客戶／集團名稱');
 }catch(e){mtError(e.message);}
}
function mtRelationship(setup=false){
 const relation=state.values.__customer||{},current=MT_EXTERNAL?state.id:state.draftId||state.editing;
 const parents=mtCompanies().filter(c=>{const r=c.snapshot.values?.__customer;return c.id!==current&&r?.role==='parent'&&r.id===relation.id;});
 const company=setup?`<div class="field"><label for="field-merchantName">本次公司名稱（可稍後填寫）<span class="en">Company Name</span></label><input id="field-merchantName" data-field="merchantName" data-v2-field="merchantName" maxlength="100" value="${esc(state.values.merchantName||'')}" placeholder="可稍後由 BR 辨識帶入"><small class="hint">僅設定本次申請；不會修改集團名稱。</small></div>`:v2Field({...v2ById.merchantName,label:'目前公司名稱（中文）  Company Name',placeholder:'請輸入本次申請的公司名稱',hint:'本次商戶申請使用的公司名稱，上限 100 bytes。'});
 return v2Card('客戶及公司關係','先選擇或新建客戶／集團，再填寫本次申請的公司名稱。',`<div class="grid mt-relationship"><div class="field"><label for="mt-customer">選取客戶／集團<span class="en">Customer / Group</span></label><select id="mt-customer" data-mt-relation="customer"><option value="">尚未分組</option>${mtCustomers().map(c=>`<option value="${esc(c.id)}" ${c.id===relation.id?'selected':''}>${esc(c.name)}</option>`).join('')}<option value="__new">＋ 新建客戶／集團</option></select><div class="mt-customer-tools"><small class="hint">選擇「新建客戶／集團」可另開視窗建立。</small>${btn('管理客戶／集團','mt-customer-manage')}</div></div>${company}<div class="field"><label for="mt-company-role">公司關係<span class="en">Company Relationship</span></label><select id="mt-company-role" data-mt-relation="role">${['independent','parent','subsidiary'].map(r=>`<option value="${r}" ${r===(relation.role||'independent')?'selected':''}>${mtRoleName(r)}</option>`).join('')}</select></div>${relation.role==='subsidiary'?`<div class="field"><label for="mt-parent-company">所屬母公司<span class="en">Parent Company</span></label><select id="mt-parent-company" data-mt-relation="parentId"><option value="">請選擇所屬母公司</option>${relation.id&&relation.name?`<option value="group:${esc(relation.id)}" ${relation.parentType==='group'?'selected':''}>${esc(relation.name)}（集團主體）</option>`:''}${parents.map(c=>`<option value="${esc(c.id)}" ${relation.parentType!=='group'&&c.id===relation.parentId?'selected':''}>${esc(c.name)}</option>`).join('')}</select><small class="hint">${relation.id?'可歸屬目前集團，或選擇同一集團已建立的母公司。':'請先選擇或新建客戶／集團。'}</small></div>`:''}</div>${state.errors._customer?`<p class="error" role="alert">${esc(state.errors._customer)}</p>`:''}`);
}
const mtOriginalSections=v2FormSections;
v2FormSections=function(index){if(index!==0)return mtOriginalSections(index);const relationship=mtRelationship();try{mtCompanyNameInRelationship=true;return relationship+mtOriginalSections(index);}finally{mtCompanyNameInRelationship=false;}};
const mtOriginalValidate=validateStep;
validateStep=function(step){const errors=mtOriginalValidate(step);if(step===3){const list=mtMccList();if(!list.length||list.some(c=>!/^\d{4}$/.test(c)))errors.mcc='請選擇至少一個有效的 4 位 MCC';if(list.length>50)errors.mcc='每家公司最多可選 50 個 MCC';}
 if(step===2){const relation=state.values.__customer;if(relation?.id&&!relation.name?.trim())errors._customer='請在管理客戶／集團中補上名稱';if(relation?.role==='subsidiary'){const p=mtCompanies().find(c=>c.id===relation.parentId),r=p?.snapshot.values?.__customer;const own=MT_EXTERNAL?state.id:state.draftId||state.editing,valid=relation.parentType==='group'?relation.parentId===relation.id&&mtCustomers().some(c=>c.id===relation.id&&c.name):p&&p.id!==own&&r?.role==='parent'&&r.id===relation.id;if(!relation.name||!valid)errors._customer='子公司須選擇所屬集團或同一集團內的母公司';}}
 return errors;};
const mtOriginalReview=v2Review;
v2Review=function(){const relation=state.values.__customer;return (relation?.id?v2Card('客戶及公司關係','',`<div class="mt-relation-summary"><strong>${esc(relation.name)}</strong><span>${mtRoleName(relation.role)}</span>${relation.parentId?`<span>母公司：${esc(relation.parentType==='group'?relation.name+'（集團主體）':mtCompanies().find(c=>c.id===relation.parentId)?.name||relation.parentId)}</span>`:''}</div>`):'')+v2Card('MCC 複選資料','',`<p>主要 MCC：<b>${esc(v2Raw('mcc')||'尚未選擇')}</b></p><p>全部代碼：${esc(mtMccList().join('、')||'尚未選擇')}</p>`)+mtOriginalReview();};
function mtToolActions(compact=false){return `<div class="mt-tool-actions" aria-label="模板與批量設定">${!compact?btn('複製已有商戶','ns-copy-open'):''}${btn('選取模板','mt-library')}${!compact?btn('儲存為模板','mt-save-open'):''}${btn('匯入資料','mt-import-open')}${btn('批量套用參數模板','mt-batch-open','primary')}</div>`;}
function mtToolbar(){return `<section class="mt-quick-tools" aria-label="快速填寫及參數模板"><div><strong>快速填寫</strong><small>帶入商戶資料、MCC、結算參數及產品費率</small></div>${mtToolActions()}</section>`;}
const mtOriginalApplication=application;
application=function(step){const html=mtOriginalApplication(step);if(!mtAllowed())return html;return html.replace('<div class="v2-version">OATS V2 · 六步申請流程</div>','<div class="v2-version">OATS V2 · 六步申請流程</div>'+mtToolbar());};
if(MT_EXTERNAL){const originalApplications=applications;applications=function(){return originalApplications().replace(btn('載入進度示例','seed'),btn('載入進度示例','seed')+mtToolActions(true));};}
else{const oldMerchants=merchants;merchants=function(){const html=oldMerchants();return mtAllowed()?html.replace('<span class="grow"></span>','<span class="grow"></span>'+mtToolActions(true)):html;};const oldDrafts=draftView;draftView=function(){const html=oldDrafts();return mtAllowed()?html.replace('<section class="card">','<div class="toolbar mt-list-toolbar">'+mtToolActions(true)+'</div><section class="card">'):html;};}
const mtOriginalReset=v2Reset;v2Reset=function(){mtOriginalReset();};
function mtDialog(title,body,foot){modal(title,body+'<p id="mt-error" class="error" role="alert"></p>',foot);$('#modal').classList.add('mt-dialog');}
function mtClose(){mtStartTemplate=false;mtFlow=null;$('#modal').classList.remove('mt-dialog','mt-customer-dialog');$('#modal').close();}
function mtDownload(filename,value,type='application/json'){const blob=new Blob([type==='application/json'?JSON.stringify(value,null,2):value],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function mtScopeInputs(template,selected,batch=false){return `<fieldset class="mt-scopes"><legend>套用範圍</legend>${template.scopes.map(scope=>`<label class="check"><input type="checkbox" data-mt-scope="${scope}" ${selected.includes(scope)?'checked':''} ${batch&&scope==='identity'?'disabled':''}><span>${MT.labels[scope]}</span></label>`).join('')}${batch&&template.scopes.includes('identity')?'<small>批量套用保留每家公司的名稱、BR、董事及銀行帳號。</small>':''}</fieldset>`;}
function mtProductCount(products){return Object.entries(products?.rates||{}).filter(([key,r])=>r.on&&products.groups?.[key.split('|')[0]]).length;}
function mtLibrary(){
 if(!mtAllowed())return;const list=mtTemplates();
 mtDialog('商戶資料與參數模板',`<p class="hint">可把共用資料、MCC、結算參數及產品費率記錄為一份設定，套用至一家或多家新商戶。</p><div class="mt-library-actions">${btn('將目前設定儲存為模板','mt-save-open','primary',mtStartTemplate?'disabled':'')}${btn('匯入模板／商戶資料','mt-import-open')}</div><div class="mt-template-list">${list.map(t=>`<article><div><h3>${esc(t.name)}</h3><p>${t.scopes.map(s=>esc(MT.labels[s])).join(' · ')}</p><small>v${t.version} · ${Object.keys(t.values).length} 個欄位 · ${mtProductCount(t.products)} 項產品</small></div><div class="mt-template-actions">${btn('套用至目前表單','mt-use','',`data-id="${esc(t.id)}" ${route().page!=='application'&&!mtStartTemplate?'disabled':''}`)}${btn('複選商戶並批量套用','mt-batch-template','primary',`data-id="${esc(t.id)}"`)}${btn('更新為目前設定','mt-save-open','',`data-id="${esc(t.id)}" ${route().page!=='application'?'disabled':''}`)}${btn('匯出','mt-export','',`data-id="${esc(t.id)}"`)}${btn('刪除','mt-delete','',`data-id="${esc(t.id)}"`)}</div></article>`).join('')||'<div class="mt-empty"><h3>尚未建立模板</h3><p>填寫一次資料及費率後儲存，或匯入已有的 Excel／CSV 設定。</p></div>'}</div>`,btn('關閉','mt-close'));
}
function mtOpenSave(id=''){
 if(!mtAllowed())return;const existing=mtTemplates().find(t=>t.id===id);mtFlow={kind:'save',id:existing?.id||'',scopes:existing?.scopes||['profile','mcc','settlement','products']};
 mtDialog(existing?'更新參數模板':'儲存為參數模板',`<div class="field"><label for="mt-template-name">模板名稱 <span class="required">*</span></label><input id="mt-template-name" maxlength="80" value="${esc(existing?.name||'')}" placeholder="例如：集團餐飲標準設定"></div>${mtScopeInputs({scopes:Object.keys(MT.labels)},mtFlow.scopes)}<p class="hint">共用模板可同時包含商戶資料與費率。公司專屬資料可另外選存，只能逐家公司套用；文件附件、驗證及簽署狀態不會納入模板。</p>`,btn('取消','mt-close')+btn(existing?'確認更新模板':'儲存模板','mt-save','primary'));
}
function mtSave(){
 try{if(!mtAllowed())return;const list=mtTemplates(),previous=list.find(t=>t.id===mtFlow.id),snapshot=mtSnapshot();const t=MT.cleanTemplate({id:previous?.id||crypto.randomUUID(),name:$('#mt-template-name').value,version:(previous?.version||0)+1,scopes:mtFlow.scopes,values:snapshot.values,products:snapshot.values.__v2,people:snapshot.people,createdAt:previous?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()});if(list.some(x=>x.name===t.name&&x.id!==t.id))throw Error('已有同名模板，請改名或從清單選擇更新');mtSaveTemplates([t,...list.filter(x=>x.id!==t.id)]);mtLibrary();toast('已儲存模板，可一次套用至多家新商戶');}catch(e){mtError(e.message);}
}
function mtOpenApply(batch,id=''){
 if(!mtAllowed())return;const templates=mtTemplates();if(!templates.length)return mtLibrary();const t=templates.find(t=>t.id===id)||templates[0];const preselected=!MT_EXTERNAL?[...state.selected].map(id=>'row:'+id):[];
 mtFlow={kind:batch?'batch':'form',templateId:t.id,scopes:t.scopes.filter(s=>s!=='identity'),mode:'replace',selected:new Set(preselected),query:'',customer:'',role:'',page:1,size:20,preview:false};if(!batch&&route().step===5&&t.scopes.includes('products'))mtFlow.scopes=['products'];mtApplyModal();
}
function mtCurrentTarget(){if(mtStartTemplate)return {key:'current',id:null,name:'新商戶（確認後建立）',kind:'current',snapshot:mtBlank()};return {key:'current',id:MT_EXTERNAL?state.id:state.draftId,name:state.values.merchantName||state.values.merchantEnglishName||'目前新商戶',kind:'current',snapshot:mtSnapshot()};}
function mtFilteredTargets(){return mtTargets().filter(t=>{const c=t.snapshot.values?.__customer||{};return (!mtFlow.customer||c.id===mtFlow.customer)&&(!mtFlow.role||(c.role||'independent')===mtFlow.role)&&(!mtFlow.query||(t.name+' '+t.id+' '+(c.name||'')).toLowerCase().includes(mtFlow.query.toLowerCase()));});}
function mtRepaint(callback){const active=document.activeElement,id=active?.id,position=active?.selectionStart,scroll=$('#modal .modal-body')?.scrollTop||0;callback();const next=id?document.getElementById(id):null;next?.focus({preventScroll:true});if(position!=null&&typeof next?.setSelectionRange==='function')try{next.setSelectionRange(position,position);}catch{}const body=$('#modal .modal-body');if(body)body.scrollTop=scroll;}
function mtPrepare(template,targets){
 return targets.map(target=>{
  let snapshot=target.snapshot;const currentId=MT_EXTERNAL?state.id:state.draftId||state.editing;if(target.kind!=='current'&&target.id===currentId&&route().page==='application')snapshot=mtSnapshot();
  const linked=snapshot.values?.__customer?.id,source=linked?{...template,values:Object.fromEntries(Object.entries(template.values).filter(([key])=>!['groupId','parentMerchant'].includes(key)))}:template;
  const plan=MT.apply(snapshot,source,mtFlow.scopes,mtFlow.mode,mtFlow.kind==='form');mtSyncRelationship(plan.snapshot.values);
  return {...target,...plan,fingerprint:JSON.stringify(target.snapshot)};
 });
}
function mtChangeValue(value){if(value&&typeof value==='object'){if(Array.isArray(value))return value.join('、');return Object.entries(value.rates||{}).filter(([key,r])=>r.on&&value.groups?.[key.split('|')[0]]).map(([key,r])=>{const [group,index]=key.split('|'),definition=v2Groups.find(g=>g.k===group)?.rows[+index];return definition?definition.n+'：'+v2FeeSummary(definition,r):key;}).join('；')||'未選產品';}return String(value??'')||'空白';}
function mtPreviewHTML(plans){return `<div class="notice">即將套用至 <b>${plans.length}</b> 家商戶 · 共 ${plans.reduce((s,p)=>s+p.changes.length,0)} 項變更。${mtFlow.kind==='batch'?'每家公司的名稱、BR、董事、銀行帳號與公司關係保留。':''}</div><div class="mt-preview-list">${plans.map(p=>`<details ${plans.length===1?'open':''}><summary><strong>${esc(p.name)}</strong><span>${p.changes.length} 項變更</span></summary>${p.changes.length?`<div class="mt-diff-list">${p.changes.map(c=>`<div><strong>${esc(c.key==='_products'?'產品與費率':c.key==='mccCodes'?'MCC 複選清單':v2Label(c.key))}</strong><del>${esc(mtChangeValue(c.before))}</del><ins>${esc(mtChangeValue(c.after))}</ins></div>`).join('')}</div>`:'<p>設定相同，無需修改。</p>'}</details>`).join('')}</div>`;}
const mtFailureActive=()=>!!(state.fail||state.failSave);
function mtDisableSimulation(){state.fail=false;state.failSave=false;state.failSubmit=false;const checkbox=$('#simulate-failure');if(checkbox)checkbox.checked=false;}
function mtFailureNotice(){return mtFlow?.kind==='batch'&&mtFailureActive()?`<div class="notice warn mt-failure-notice"><span>目前已啟用「模擬儲存／提交失敗」，確認套用將保留所有商戶原值。</span>${btn('關閉失敗模擬','mt-disable-simulation')}</div>`:'';}
function mtApplyModal(){
 const f=mtFlow,t=mtTemplates().find(t=>t.id===f.templateId);if(!t)return mtLibrary();
 const available=mtTargets(),selected=f.kind==='form'?[mtCurrentTarget()]:available.filter(a=>f.selected.has(a.key));
 if(f.preview){mtFlow.plans=mtPrepare(t,selected);return mtDialog('確認'+(f.kind==='batch'?'批量':'')+'套用參數模板',`${mtFailureNotice()}<p><strong>${esc(t.name)}</strong> · v${t.version} · ${f.scopes.map(s=>MT.labels[s]).join('、')}</p>${mtPreviewHTML(mtFlow.plans)}<p class="hint">套用後仍需逐家公司核對聯絡資料、費率及提交。</p>`,btn('返回選擇','mt-preview-back')+btn('確認套用至 '+selected.length+' 家','mt-apply-confirm','primary',selected.length?'':'disabled'));}
 const filtered=f.kind==='batch'?mtFilteredTargets():[],pages=Math.max(1,Math.ceil(filtered.length/f.size));f.page=Math.min(f.page,pages);const shown=filtered.slice((f.page-1)*f.size,f.page*f.size);
 const table=f.kind==='batch'?`<div class="mt-batch-filters"><div class="field"><label for="mt-target-search">搜尋新商戶</label><input id="mt-target-search" placeholder="公司名稱、編號、客戶" value="${esc(f.query)}"></div><div class="field"><label for="mt-target-customer">客戶／集團</label><select id="mt-target-customer"><option value="">全部客戶</option>${mtCustomers().map(c=>`<option value="${esc(c.id)}" ${f.customer===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label for="mt-target-role">公司關係</label><select id="mt-target-role"><option value="">全部關係</option>${['parent','subsidiary','independent'].map(r=>`<option value="${r}" ${f.role===r?'selected':''}>${mtRoleName(r)}</option>`).join('')}</select></div></div><div class="mt-select-bar"><label class="check"><input type="checkbox" id="mt-select-filtered" ${filtered.length&&filtered.every(x=>f.selected.has(x.key))?'checked':''} ${!filtered.length?'disabled':''}>全選篩選結果（${filtered.length} 家，包含所有頁面）</label><strong id="mt-selected-count">已選 ${selected.length} 家</strong>${btn('清除選取','mt-clear-selected')}</div><div class="mt-target-list">${shown.map(a=>{const c=a.snapshot.values?.__customer||{};return `<label class="mt-target-row"><input type="checkbox" data-mt-target="${esc(a.key)}" ${f.selected.has(a.key)?'checked':''}><span><strong>${esc(a.name)}</strong><small>${esc(a.id)}</small></span><span>${esc(c.name||'未分組')}<small>${mtRoleName(c.role)}</small></span></label>`;}).join('')||'<div class="mt-empty">沒有符合條件的新商戶草稿。</div>'}</div><div class="mt-pagination"><label>每頁 <select id="mt-page-size">${[20,50,100].map(n=>`<option ${f.size===n?'selected':''}>${n}</option>`).join('')}</select> 家</label><span>共 ${filtered.length} 家 · ${f.page}／${pages} 頁</span>${btn('上一頁','mt-target-page','',`data-page="${f.page-1}" ${f.page<=1?'disabled':''}`)}${btn('下一頁','mt-target-page','',`data-page="${f.page+1}" ${f.page>=pages?'disabled':''}`)}</div><p class="hint">只列出有權限編輯的新商戶草稿，已提交或已開通商戶不在批量套用範圍。</p>`:`<p class="notice">套用對象：${esc(selected[0].name)}</p>`;
 mtDialog(f.kind==='batch'?'批量套用參數模板':'套用商戶模板',`${mtFailureNotice()}<div class="mt-apply-header"><div class="field"><label for="mt-template-select">選取一份設定記錄</label><select id="mt-template-select">${mtTemplates().map(x=>`<option value="${esc(x.id)}" ${t.id===x.id?'selected':''}>${esc(x.name)} · v${x.version}</option>`).join('')}</select></div><div class="field"><label for="mt-apply-mode">處理現有值</label><select id="mt-apply-mode"><option value="replace" ${f.mode==='replace'?'selected':''}>套用模板設定（預覽後取代所選範圍）</option><option value="blank" ${f.mode==='blank'?'selected':''}>只補空白，保留已填資料</option></select></div></div>${mtScopeInputs(t,f.scopes,f.kind==='batch')}${table}`,btn('取消','mt-close')+btn('預覽套用至 '+selected.length+' 家','mt-apply-preview','primary',selected.length&&f.scopes.length?'':'disabled'));
}
function mtWriteTargets(plans,message){
 const time=mtNow();if(state.fail||state.failSave)throw Error('模擬儲存失敗：所有商戶設定仍保留原值');
 if(MT_EXTERNAL){const before=state.records,next=before.map(r=>{const plan=plans.find(p=>p.kind==='record'&&p.id===r.id);if(!plan)return r;if(r.email!==state.email||r.status!=='草稿')throw Error('商戶權限或狀態已變更，請重新選擇');return {...r,...plan.snapshot,updated:time};});localStorage.setItem(KEY,JSON.stringify(next));state.records=next;}
 else{
 const beforeDrafts=state.drafts,beforeRows=[...rows],beforeAudit=BO.audit,beforeCount=state.noticeCount;
  const available=new Set(mtTargets().map(t=>t.key));if(plans.some(p=>!available.has(p.key)))throw Error('商戶權限或狀態已變更，請重新選擇');
  try{state.drafts=state.drafts.map(d=>{const p=plans.find(p=>p.kind==='draft'&&p.id===d.id);return p?{...d,...p.snapshot,savedAt:time}:d;});
   rows.splice(0,rows.length,...rows.map(row=>{const p=plans.find(p=>p.kind==='row'&&p.id===rowKey(row));if(!p)return row;const v=p.snapshot.values;return {...row,application:{...p.snapshot,id:p.id,owner:row.owner,step:1,savedAt:time},'MCC 行業代碼':mtMccList(v).join('、'),'行業類型':mtMccList(v).map(c=>V2.catalog.MCCS.find(m=>m.c===c)?.n||c).join('、'),'客戶聯繫人':v.contactName||row['客戶聯繫人'],'聯絡人電話':v.contactPhone||row['聯絡人電話'],'聯絡人電郵':v.contactEmail||row['聯絡人電郵'],'最後更新':time};}));
   BO.audit=[{time,user:BO.user.name,message},...BO.audit];state.noticeCount+=plans.length;if(!persistDemo())throw Error('瀏覽器儲存空間不足，未套用任何商戶');
  }catch(e){state.drafts=beforeDrafts;rows.splice(0,rows.length,...beforeRows);BO.audit=beforeAudit;state.noticeCount=beforeCount;throw e;}
 }
 const id=MT_EXTERNAL?state.id:state.draftId||state.editing,p=plans.find(p=>p.id===id);if(p&&route().page==='application'){Object.assign(state,{values:structuredClone(p.snapshot.values),people:structuredClone(p.snapshot.people),checks:structuredClone(p.snapshot.checks||{}),emailVerified:!!p.snapshot.emailVerified,errors:{}});if(MT_EXTERNAL)state.signature=p.snapshot.signature||'';}
}
function mtConfirmApply(){
 try{if(!mtAllowed()||!mtFlow?.preview)throw Error('請先預覽套用內容');const plans=mtFlow.plans||[],template=mtTemplates().find(t=>t.id===mtFlow.templateId);if(!plans.length||!template)throw Error('模板或商戶清單已變更');
  if(mtFlow.kind==='form'){const p=mtPrepare(template,[mtCurrentTarget()])[0];Object.assign(state,{values:p.snapshot.values,people:p.snapshot.people,checks:p.snapshot.checks||{},emailVerified:!!p.snapshot.emailVerified,errors:{}});if(MT_EXTERNAL)state.signature=p.snapshot.signature||'';v2SyncDerived();mtClose();render();toast('已帶入模板，請核對並儲存草稿');return;}
  const targets=mtTargets();for(const plan of plans){const now=targets.find(t=>t.key===plan.key);if(!now||JSON.stringify(now.snapshot)!==plan.fingerprint)throw Error('商戶資料在預覽後已有變動，請返回重新預覽');}
  mtWriteTargets(plans,'批量套用模板「'+template.name+'」至 '+plans.length+' 家新商戶');const count=plans.length;mtClose();render();mtDialog('批量套用完成',`<div class="notice">已同時儲存 ${count} 家商戶的設定。</div><p>模板：${esc(template.name)} · v${template.version}</p><p>每家公司可繼續獨立核對、修改及提交。</p>`,btn('完成','mt-close','primary'));
 }catch(e){mtError(e.message);if(mtFailureActive()&&mtFlow?.preview&&mtFlow.kind==='batch')$('#mt-error')?.insertAdjacentHTML('beforeend',`<span class="mt-retry-help">已選商戶與預覽仍保留。${btn('關閉失敗模擬並重試','mt-retry-apply','primary')}</span>`);}
}
function mtOpenImport(){if(!mtAllowed())return;mtImport=null;mtImportSequence++;mtDialog('匯入商戶資料與費率',`<p>可匯入同一客戶的母公司與子公司，同時帶入各公司的基本資料、MCC、結算參數、產品及費率。</p><div class="mt-library-actions">${btn('下載 CSV 空白範本','mt-csv-download')}${btn('下載 Excel 範本（含下拉選單）','mt-excel-download')}${btn('下載 Excel 填寫範例','mt-excel-example')}</div>${fileDropControl({inputId:'mt-import-file',accept:'.xlsx,.csv',title:'拖入 Excel／CSV 商戶資料',hint:'每次最多 100 家公司／50 份模板 · 文件上限 2 MB'})}<p class="hint">建議使用 Excel 範本，內含下拉選單、商戶關係及產品費率工作表。CSV 請使用 UTF-8 格式；多個 MCC 可使用分號分隔。</p><div id="mt-import-result"></div>`,btn('取消','mt-close'));}
async function mtReadImport(file){
 const sequence=++mtImportSequence,owner=mtOwner();try{if(!file||file.size>2*1024*1024||!/\.(csv|json)$/i.test(file.name))throw Error('請選擇 2 MB 以下的 CSV／JSON');const source=await file.text();if(sequence!==mtImportSequence||owner!==mtOwner()||!$('#mt-import-file'))return;const bundle=MT.bundle(/\.csv$/i.test(file.name)?MT.csvBundle(source):JSON.parse(source),mtTemplates());bundle.templates=bundle.templates.map(t=>({...t,id:crypto.randomUUID(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}));
  for(const company of bundle.companies){const customer=mtCustomers().find(c=>c.id===company.customerId||c.name===company.customerName);if(customer){company.customerId=customer.id;company.customerName=customer.name;}}
  const existing=mtCompanies(),brs=new Set(existing.map(c=>c.snapshot.values?.registerCertNo).filter(Boolean)),seen=new Set();
  const errors=[];for(const c of bundle.companies){const br=c.values.registerCertNo;if(br&&(brs.has(br)||seen.has(br)))errors.push(c.key+'：BR 已存在或於文件中重複');if(br)seen.add(br);}
  mtImport={...bundle,filename:file.name,errors,selected:new Set(bundle.companies.map(c=>c.key)),single:bundle.companies.length===1&&route().page==='application'};mtImportResult();
 }catch(e){mtImport=null;mtError(e instanceof SyntaxError?'JSON 格式不正確，請使用下載的範例格式':e.message);}
}
function mtImportResult(){const b=mtImport;if(!b)return;const host=$('#mt-import-result');if(!host)return;
 host.innerHTML=`<h3>匯入預覽</h3><p>${b.companies.length} 家公司 · ${b.templates.length} 份模板 · ${esc(b.filename)}</p>${b.errors.length?`<div class="notice error">${b.errors.map(esc).join('<br>')}</div>`:''}<div class="mt-import-companies">${b.companies.map(c=>`<article><strong>${esc(c.values.merchantName||c.values.merchantEnglishName)}</strong><span>${esc(c.customerName||'未分組')} · ${mtRoleName(c.role)}${c.parentKey?' · 母公司 '+esc(c.parentKey):''}</span><small>BR：${esc(c.values.registerCertNo||'待填寫')} · MCC：${esc(MT.codes(c.values.mccCodes||c.values.mcc).join('、')||'待填寫')} · ${Object.keys(c.values).length} 個欄位 · ${mtProductCount(c.products)} 項產品</small></article>`).join('')}</div>${b.single?'<p class="hint">會帶入目前新商戶表單，匯入前可查看所有欄位差異。</p>':'<p class="hint">確認後一次建立全部公司草稿；公司間的母／子關係會一併建立。</p>'}<div class="mt-library-actions">${btn(b.single?'預覽帶入目前表單':'確認匯入並建立 '+b.companies.length+' 家草稿','mt-import-confirm','primary',b.errors.length?'disabled':'')}</div>`;}
function mtImportSettings(company){const template=[...(mtImport?.templates||[]),...mtTemplates()].find(t=>t.name===company.templateName);const inherited=template?MT.apply({values:{},people:{}},template,template.scopes.filter(s=>s!=='identity'),'replace',false).snapshot.values:{};return {values:{...inherited,...company.values},products:company.products||template?.products||null};}
function mtImportedSnapshot(company,ids){const settings=mtImportSettings(company),snapshot=mtBlank(settings.values,company.people);if(settings.products)for(const k of ['groups','rates','combo','sme'])snapshot.values.__v2[k]=structuredClone(settings.products[k]);snapshot.values.__customer={id:company.customerId,name:company.customerName,role:company.role,parentId:ids[company.parentKey]||''};const parent=mtImport?.companies.find(c=>c.key===company.parentKey);mtSyncRelationship(snapshot.values,parent?.values.merchantName||parent?.values.merchantEnglishName||'');snapshot.emailVerified=false;return snapshot;}
function mtCommitImport(){
 try{if(!mtAllowed()||!mtImport||mtImport.errors.length)throw Error('請先選擇有效的匯入文件');const b=mtImport;
  if(b.single&&!b.ready){const c=b.companies[0],before=mtSnapshot(),snap=mtImportedSnapshot(c,{}),settings=mtImportSettings(c);const imported=MT.cleanTemplate({id:'import',name:b.filename,scopes:Object.keys(MT.labels),values:settings.values,products:settings.products,people:snap.people});mtFlow={kind:'form',scopes:imported.scopes};const plan=MT.apply(before,imported,imported.scopes,'replace',true);plan.snapshot.values.__customer=snap.values.__customer;b.ready=true;b.plan=plan;$('#mt-import-result').innerHTML=mtPreviewHTML([{...plan,name:c.values.merchantName||c.values.merchantEnglishName}])+btn('確認帶入目前表單','mt-import-confirm','primary');return;}
  if(state.fail||state.failSave)throw Error('模擬儲存失敗，沒有建立或修改商戶');
  const oldTemplates=mtTemplates(),incoming=b.templates;
  if(incoming.some(t=>oldTemplates.some(old=>old.name===t.name)))throw Error('已有同名模板，請先重新命名，或在模板清單更新設定');
  const merged=[...incoming,...oldTemplates];if(merged.length>100)throw Error('目前最多可保存 100 份模板，請先整理已有模板');
  if(b.single){if(incoming.length)mtSaveTemplates(merged);Object.assign(state,{values:b.plan.snapshot.values,people:b.plan.snapshot.people,checks:{},emailVerified:false,errors:{}});if(MT_EXTERNAL)state.signature='';v2SyncDerived();mtClose();render();toast('已一次帶入商戶資料、MCC 及產品費率，請核對並儲存');return;}
  const ids=Object.fromEntries(b.companies.map(c=>[c.key,'DRAFT-'+crypto.randomUUID()])),time=mtNow();
  const additions=b.companies.map(c=>{const snap=mtImportedSnapshot(c,ids);return MT_EXTERNAL?{...snap,id:ids[c.key],email:state.email,status:'草稿',schema:2,step:1,created:time,updated:time,directors:[],shops:[],methods:[],scenes:[],sales:[],signature:'',values:{...snap.values,companyZh:snap.values.merchantName,companyEn:snap.values.merchantEnglishName}}:{...snap,id:ids[c.key],owner:BO.user.id,step:1,savedAt:time};});
  if(incoming.length)mtSaveTemplates(merged);
  try{if(MT_EXTERNAL){const next=[...additions,...state.records];localStorage.setItem(KEY,JSON.stringify(next));state.records=next;}else{const before=state.drafts;state.drafts=[...additions,...before];if(!persistDemo()){state.drafts=before;throw Error('儲存空間不足，沒有建立任何公司草稿');}}}catch(e){if(incoming.length)mtSaveTemplates(oldTemplates);throw e;}
  mtClose();render();mtDialog('資料匯入完成',`<div class="notice">已建立 ${additions.length} 家公司草稿，並匯入 ${incoming.length} 份模板。</div><p>母／子公司關係、各自的 MCC、產品與費率均已保留。接下來可複選所有新商戶一次套用同一份參數設定。</p>`,btn('查看全部草稿','mt-open-drafts')+btn('批量套用參數模板','mt-batch-open','primary'));
 }catch(e){mtError(e.message);}
}
function mtJSONExample(){return {
 format:'allinpay.merchant-bundle',version:1,customer:{id:'CUS-DEMO-GROUP',name:'示例餐飲集團'},defaultTemplate:'餐飲共用參數（示例）',
 templates:[{name:'餐飲共用參數（示例）',scopes:['profile','mcc','settlement','products'],values:{contactName:'示例聯絡人',contactPhone:'+85260000000',contactEmail:'demo@example.com',mcc:'5812',mccCodes:['5812','5814'],settlePeriod:'T2',currency:'HKD'},products:{groups:{POS:true},rates:{'POS|0':{on:true,ct:'Regional',v:{loc_rate:'1.50',crs_rate:'2.50'}}}}}],
 companies:[
  {key:'MAIN',role:'parent',values:{merchantName:'示例餐飲母公司',merchantEnglishName:'DEMO RESTAURANT HOLDINGS LIMITED',registerCertNo:'12345678-000-03-26-7',mcc:'5812',mccCodes:['5812','5814']}},
  {key:'SUB-A',role:'subsidiary',parentKey:'MAIN',values:{merchantName:'示例餐飲子公司甲',merchantEnglishName:'DEMO RESTAURANT A LIMITED',registerCertNo:'12345679-000-03-26-7',mcc:'5812'}},
  {key:'SUB-B',role:'subsidiary',parentKey:'MAIN',values:{merchantName:'示例餐飲子公司乙',merchantEnglishName:'DEMO RESTAURANT B LIMITED',registerCertNo:'12345680-000-03-26-7',mcc:'5814'}}
 ]
};}
Object.assign(actions,{
 'mt-close':mtClose,'mt-library':mtLibrary,'mt-save-open':el=>mtOpenSave(el?.dataset?.id||''),'mt-save':mtSave,
 'mt-customer-manage':mtManageCustomers,'mt-group-rename':el=>mtChangeCustomer(el.dataset.id,el.closest('[data-mt-group-row]').querySelector('[data-mt-group-name]').value),
 'mt-customer-create':mtCreateCustomer,
 'mt-group-delete':el=>mtDeleteCustomer(el.dataset.id),'mt-group-delete-preview':mtDeleteCustomerPreview,'mt-group-delete-back':()=>mtDeleteCustomer(mtGroupDelete.id,mtGroupDelete.targetId),
 'mt-group-delete-confirm':()=>mtGroupDelete&&mtChangeCustomer(mtGroupDelete.id,'',true,mtGroupDelete.targetId),
 'mt-use':el=>mtOpenApply(false,el.dataset.id),'mt-batch-open':()=>mtOpenApply(true),'mt-batch-template':el=>mtOpenApply(true,el.dataset.id),
 'mt-export':el=>{const t=mtTemplates().find(t=>t.id===el.dataset.id);if(t)mtDownload('merchant-template.json',{format:'allinpay.merchant-bundle',version:1,templates:[t],companies:[]});},
 'mt-delete':el=>{const t=mtTemplates().find(t=>t.id===el.dataset.id);if(t)mtDialog('刪除模板',`<p>刪除「${esc(t.name)}」？已套用至商戶的設定仍會保留。</p>`,btn('取消','mt-library')+btn('確認刪除','mt-delete-confirm','danger',`data-id="${esc(t.id)}"`));},
 'mt-delete-confirm':el=>{try{mtSaveTemplates(mtTemplates().filter(t=>t.id!==el.dataset.id));mtLibrary();}catch(e){mtError(e.message);}},
 'mt-apply-preview':()=>{if(!mtFlow?.scopes.length)return mtError('請至少選擇一個套用範圍');mtFlow.preview=true;mtApplyModal();},'mt-preview-back':()=>{mtFlow.preview=false;mtApplyModal();},'mt-apply-confirm':mtConfirmApply,
 'mt-target-page':el=>{mtFlow.page=+el.dataset.page;mtApplyModal();},'mt-clear-selected':()=>{mtFlow.selected.clear();mtApplyModal();},
 'mt-disable-simulation':()=>{mtDisableSimulation();mtApplyModal();},'mt-retry-apply':()=>{mtDisableSimulation();mtConfirmApply();},
 'mt-mcc-done':mtCloseMcc,'mt-mcc-primary':el=>{state.values.mcc=el.dataset.code;state.values.mccCodes=[el.dataset.code,...mtMccList().filter(c=>c!==el.dataset.code)];mtRenderMcc();},
 'mt-mcc-remove':el=>{const list=mtMccList().filter(c=>c!==el.dataset.code);state.values.mccCodes=list;if(v2Raw('mcc')===el.dataset.code)state.values.mcc=list[0]||'';mtRenderMcc();},
 'mt-import-open':mtOpenImport,'mt-import-confirm':mtCommitImport,'mt-csv-download':()=>mtDownload('merchant-import-template.csv',MT.csv([MT.csvHeaders]),'text/csv;charset=utf-8'),
 'mt-json-download':()=>mtDownload('merchant-import-example.json',mtJSONExample()),
 'mt-open-drafts':()=>{mtClose();go(MT_EXTERNAL?'applications':'drafts');}
});
document.addEventListener('input',e=>{const t=e.target;if(t.id==='mt-mcc-search')$('.mt-mcc-options').innerHTML=mtMccOptions(t.value);if(t.id==='mt-target-search'&&mtFlow){mtFlow.query=t.value;mtFlow.page=1;mtRepaint(mtApplyModal);}});
document.addEventListener('change',e=>{const t=e.target;if(!t.dataset.mtMcc)return;e.stopImmediatePropagation();const list=mtMccList(),code=t.dataset.mtMcc;if(t.checked&&list.length>=50){t.checked=false;return toast('每家公司最多可選 50 個 MCC');}state.values.mccCodes=t.checked?[...new Set([...list,code])]:list.filter(c=>c!==code);if(!state.values.mccCodes.includes(v2Raw('mcc')))state.values.mcc=state.values.mccCodes[0]||'';delete state.errors.mcc;mtRenderMcc();},true);
document.addEventListener('click',e=>{const picker=$('.mt-mcc-picker');if(picker?.open&&!e.target.closest('.mt-mcc-field'))picker.open=false;});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&e.target.closest('.mt-mcc-picker')){e.preventDefault();mtCloseMcc();}if(e.key==='Enter'&&e.target.id==='mt-new-customer-name'){e.preventDefault();mtCreateCustomer();}});
document.addEventListener('change',e=>{
 const t=e.target;
 if(t.dataset.field==='mcc'){mtSyncMcc();v2SyncDerived();mtRefreshForm();}
 if(t.dataset.mtRelation){if(t.dataset.mtRelation==='customer'&&t.value==='__new')return mtOpenCreateCustomer();const relation=state.values.__customer??={role:'independent'};if(t.dataset.mtRelation==='customer'){const existing=mtCustomers().find(c=>c.id===t.value);state.values.__customer=mtDefaultParent({id:existing?.id||'',name:existing?.name||'',role:t.value?relation.role||'independent':'independent',parentId:''});}else if(t.dataset.mtRelation==='parentId'){const group=t.value==='group:'+relation.id;relation.parentId=group?relation.id:t.value;if(group)relation.parentType='group';else delete relation.parentType;}else{relation[t.dataset.mtRelation]=t.value;mtDefaultParent(relation);}delete state.errors._customer;mtRefreshForm();}
 if(t.dataset.mtScope&&mtFlow){mtFlow.scopes=t.checked?[...new Set([...mtFlow.scopes,t.dataset.mtScope])]:mtFlow.scopes.filter(s=>s!==t.dataset.mtScope);if(mtFlow.kind!=='save')mtRepaint(mtApplyModal);}
 if(t.id==='mt-template-select'&&mtFlow){const template=mtTemplates().find(x=>x.id===t.value);mtFlow.templateId=template.id;mtFlow.scopes=template.scopes.filter(s=>s!=='identity');mtApplyModal();}
 if(t.id==='mt-apply-mode'&&mtFlow)mtFlow.mode=t.value;
 if(t.dataset.mtTarget&&mtFlow){t.checked?mtFlow.selected.add(t.dataset.mtTarget):mtFlow.selected.delete(t.dataset.mtTarget);mtRepaint(mtApplyModal);}
 if(t.id==='mt-select-filtered'&&mtFlow){mtFilteredTargets().forEach(x=>t.checked?mtFlow.selected.add(x.key):mtFlow.selected.delete(x.key));mtRepaint(mtApplyModal);}
 if(t.id==='mt-target-customer'||t.id==='mt-target-role'||t.id==='mt-page-size'){if(!mtFlow)return;if(t.id==='mt-target-customer')mtFlow.customer=t.value;if(t.id==='mt-target-role')mtFlow.role=t.value;if(t.id==='mt-page-size')mtFlow.size=+t.value;mtFlow.page=1;mtRepaint(mtApplyModal);}
 if(t.id==='mt-import-file')void mtReadImport(t.files?.[0]);
});
if(!MT_EXTERNAL){const originalConfirm=actions['confirm-submit'];actions['confirm-submit']=()=>{const before=new Set(rows);originalConfirm();if($('#modal-title')?.textContent!=='申請提交成功')return;const row=rows.find(r=>!before.has(r))||rows.find(r=>rowKey(r)===state.editing);if(row){row['MCC 行業代碼']=mtMccList().join('、');row['行業類型']=state.values.mccName;row.customer=structuredClone(state.values.__customer||null);persistDemo();}};}
const mtOriginalClose=actions.close;actions.close=()=>{mtImportSequence++;$('#modal').classList.remove('mt-dialog','mt-customer-dialog');mtOriginalClose();};
$('#modal').addEventListener('close',()=>{if(!$('#modal').open){mtStartTemplate=false;$('#modal').classList.remove('mt-dialog','mt-customer-dialog');if(mtCreatingCustomerOpen){mtCreatingCustomerOpen=false;$('#mt-customer')?.focus({preventScroll:true});}}});
Object.assign(window.AllinPayDemo,{templateFeatures:true,getTemplateState:()=>({mccCodes:mtMccList(),primaryMcc:v2Raw('mcc'),customer:structuredClone(state.values.__customer||null),templates:mtTemplates().map(t=>({id:t.id,name:t.name,version:t.version,scopes:t.scopes})),targets:mtTargets().map(t=>({key:t.key,id:t.id,name:t.name,customer:structuredClone(t.snapshot.values?.__customer||null),mccCodes:mtMccList(t.snapshot.values),primaryMcc:t.snapshot.values?.mcc||'',template:t.snapshot.values?.__templateApplied||null}))})});

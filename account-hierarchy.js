// Client review: account hierarchy is enforced when reading and mutating demo data.
const AC_CHILD_ROLES={
 '最高管理員':['最高管理員','基本管理員','主代理商','次代理商','下線帳戶'],
 '基本管理員':['基本管理員','主代理商','次代理商','下線帳戶'],
 '主代理商':['次代理商','下線帳戶'],
 '次代理商':['下線帳戶'],
 '下線帳戶':[]
};
const isAgencyAccount=a=>!!a&&roles.slice(2).includes(a.role);
function acDescendants(id,list=accounts){const found=new Set(),queue=[id];while(queue.length){const parent=queue.shift();for(const a of list)if(a.parentId===parent&&!found.has(a.id)&&a.id!==id){found.add(a.id);queue.push(a.id);}}return found;}
function acAncestor(a,role,list=accounts){const seen=new Set();let current=a;while(current&&!seen.has(current.id)){seen.add(current.id);if(current.role===role)return current;current=list.find(x=>x.id===current.parentId);}return null;}
function agencyCodeForRole(a,kind){return acAncestor(a,kind==='main'?roles[2]:roles[3])?.agencyCode||'';}
function acCanManage(target,user=BO.user){if(!user||!target||!can(9))return false;if(user.role===roles[0])return true;if(user.role===roles[1])return target.role!==roles[0];return target.id!==user.id&&AC_CHILD_ROLES[user.role]?.includes(target.role)&&acDescendants(user.id).has(target.id);}
function acVisibleAccounts(){if(!BO.user)return [];if(BO.restricted)return accounts.filter(a=>a.id===BO.user.id);if(BO.user.role===roles[0])return accounts;if(BO.user.role===roles[1])return accounts.filter(a=>a.role!==roles[0]);const ids=acDescendants(BO.user.id);return accounts.filter(a=>a.id===BO.user.id||ids.has(a.id));}
function acScopedRows(){if(!BO.user||!can(0))return [];if(!isAgencyAccount(BO.user))return rows;const ids=acDescendants(BO.user.id);ids.add(BO.user.id);const main=BO.user.role===roles[2]?BO.user.agencyCode:'',sub=agencyCodeForRole(BO.user,'sub');return rows.filter(r=>ids.has(r.owner)||(main&&r['主代理商代碼']===main)||(sub&&r['次代理商代碼']===sub));}
function acScopedDrafts(){if(!BO.user)return [];if(!isAgencyAccount(BO.user))return state.drafts;const ids=acDescendants(BO.user.id);ids.add(BO.user.id);return state.drafts.filter(d=>ids.has(d.owner));}
function acMigrate(){
 const root=accounts.find(a=>a.role===roles[0]),admin=accounts.find(a=>a.role===roles[1])||root;
 for(const a of accounts){
  if(a.parentId===undefined){const matchingMain=accounts.find(p=>p.role===roles[2]&&p.agency===a.agency);a.parentId=a.role===roles[0]?'':a.role===roles[1]?root?.id||'':a.role===roles[2]?admin?.id||'':matchingMain?.id||admin?.id||'';}
  if(!a.accountPolicyVersion){const defaults=rolePermissions(a.role);a.permissions=Array.isArray(a.permissions)?a.permissions.slice(0,permissionLabels.length):defaults;if(a.role!==roles[4])for(const i of [9,10])a.permissions[i]=defaults[i];a.accountPolicyVersion=1;}
 }
 if(!accounts.some(a=>a.role===roles[4])){const parent=accounts.find(a=>a.role===roles[3]&&a.status==='已啟用');if(parent)accounts.push({id:'ACC-DOWNLINE-DEMO',name:'陳曉晴',email:'downline@example.com',role:roles[4],agency:parent.agency,agencyCode:'DL-001',parentId:parent.id,status:'已啟用',last:'—',permissions:rolePermissions(roles[4]),scope:'本人及獲指派的商戶',accountPolicyVersion:1});}
 if(BO.user)BO.user=accounts.find(a=>a.id===BO.user.id)||null;
}
acMigrate();
function acParents(role,targetId=''){
 const descendants=targetId?acDescendants(targetId):new Set(),user=BO.user,rank=r=>roles.indexOf(r);
 return accounts.filter(p=>p.id!==targetId&&!descendants.has(p.id)&&p.role!==roles[4]&&rank(p.role)<=rank(role)&&(p.role!==roles[2]||[roles[3],roles[4]].includes(role))&&(p.role!==roles[3]||role===roles[4])&&(user.role===roles[0]||user.role===roles[1]&&p.role!==roles[0]||p.id===user.id||acDescendants(user.id).has(p.id)));
}
function acParentOptions(role,target){const parents=acParents(role,target?.id);const existing=accounts.find(a=>a.id===target?.parentId);if(existing&&!parents.some(p=>p.id===existing.id))parents.push({...existing,name:'系統管理（現有上級）'});return parents.map(p=>`<option value="${esc(p.id)}" ${p.id===(target?.parentId||BO.user.id)?'selected':''}>${esc(p.name)} · ${esc(p.role)}</option>`).join('');}
function acCommit(next,message){
 const record={time:new Date().toLocaleString('zh-HK',{hour12:false}),message,user:BO.user.name,accountId:BO.user.id},events=[record,...BO.audit].slice(0,300);
 try{if(mtFailureActive())throw Error('模擬儲存失敗');localStorage.setItem(DBKEY,JSON.stringify({version:1,rows,accounts:next,drafts:state.drafts,audit:events,noticeCount:state.noticeCount}));}
 catch{const error=$('#password-error')||$('#acc-error');if(error)error.textContent='儲存失敗，所有帳號仍保留原值，請重試。';else toast('儲存失敗，帳號資料保持原值');return false;}
 accounts=next;BO.audit=events;BO.user=accounts.find(a=>a.id===BO.user.id)||BO.user;return true;
}
function acValidateChange(id,role,parentId,next){
 const original=accounts.find(a=>a.id===id),operator=BO.user;
 if(!AC_CHILD_ROLES[operator.role]?.includes(role)||original&&!acCanManage(original))throw Error('不能管理此帳號或授予這個角色。');
 if(role===roles[0]){if(operator.role!==roles[0])throw Error('不能授予最高管理員角色。');parentId='';}
 else if(!parentId||parentId===id||acDescendants(id).has(parentId))throw Error('請選擇有效的上級帳號，不能循環歸屬。');
 else{const parent=accounts.find(a=>a.id===parentId);if(!parent||!AC_CHILD_ROLES[parent.role]?.includes(role))throw Error('上級帳號不能管理所選角色。');if(operator.role!==roles[0]&&operator.role!==roles[1]&&parent.id!==operator.id&&!acDescendants(operator.id).has(parent.id))throw Error('不能把帳號加入其他代理商的層級。');}
 if(accounts.some(a=>a.parentId===id&&!AC_CHILD_ROLES[role]?.includes(a.role)))throw Error('此帳號仍有下層帳號，請先調整下層歸屬再變更角色。');
 if(!next.some(a=>a.role===roles[0]&&a.status==='已啟用'&&a.permissions[9]&&a.permissions[10]))throw Error('至少保留一位可管理帳號與權限的最高管理員。');
 return parentId;
}
accountList=function(){
 const list=acVisibleAccounts().filter(a=>(!BO.search||[a.name,a.email,a.agency,accounts.find(p=>p.id===a.parentId)?.name].some(v=>String(v||'').toLowerCase().includes(BO.search.toLowerCase())))&&(BO.role==='全部角色'||a.role===BO.role)),pages=Math.max(1,Math.ceil(list.length/20));BO.accountPage=Math.max(1,Math.min(pages,BO.accountPage));const shown=list.slice((BO.accountPage-1)*20,BO.accountPage*20),create=can(9)&&AC_CHILD_ROLES[BO.user.role]?.length;
 return `${heading('帳號管理','管理可登入平台的帳號、角色與所屬層級。')}${demoBar()}<section class="card"><div class="permission-toolbar"><div><h2>帳號列表</h2><p class="hint">${esc(BO.user.role)}：${BO.user.role===roles[0]?'可管理所有身份':BO.user.role===roles[1]?'可管理最高管理員以外的身份':BO.user.role===roles[2]?'可管理所屬次代理商與下線帳戶':BO.user.role===roles[3]?'只可管理自己的下線帳戶':'可查看自己的帳號資料'}</p></div>${BO.user.role===roles[0]?(BO.restricted?btn('返回最高管理員 Demo','full-access'):btn('Demo：權限不足','limited-access')):''}${create?btn('新增帳號','add-account','primary'):''}</div><div class="account-filter"><input id="account-search" aria-label="搜尋帳號" placeholder="搜尋姓名、電郵、代理商或上級" value="${esc(BO.search)}"><select id="account-role" aria-label="角色">${['全部角色',...roles.filter(r=>BO.user.role!==roles[1]||r!==roles[0])].map(r=>`<option ${r===BO.role?'selected':''}>${r}</option>`).join('')}</select>${btn('搜尋','search-accounts')}${btn('重設','ac-reset')}</div><div class="table-scroll"><table class="accounts-table"><thead><tr><th>姓名／登入電郵</th><th>角色</th><th>所屬代理商／上級帳號</th><th>狀態</th><th>最後登入</th><th>操作</th></tr></thead><tbody>${shown.map(a=>{const manageable=acCanManage(a),parent=accounts.find(p=>p.id===a.parentId);return `<tr data-account-id="${esc(a.id)}"><td>${esc(a.name)}<small>${esc(a.email)}</small></td><td>${esc(a.role)}</td><td>${esc(a.agency||'—')}<small>${parent&&parent.role!==roles[0]?esc(parent.name)+' · '+esc(parent.role):'系統管理'}</small></td><td>${pill(a.status,a.status==='已啟用'?'green':a.status==='已停用'?'red':'amber')}</td><td>${esc(a.last||'—')}</td><td><div class="account-actions">${manageable?btn('編輯','edit-account','',`data-id="${a.id}"`)+btn(a.status==='待啟用'?'重寄邀請':'重設密碼',a.status==='待啟用'?'invite-account':'reset-account','',`data-id="${a.id}"`)+(can(10)?btn('帳號權限管理','permissions','',`data-id="${a.id}"`):'')+btn(a.status==='已啟用'?'停用':'啟用','toggle-account',a.status==='已啟用'?'danger':'',`data-id="${a.id}" ${a.id===BO.user.id?'disabled':''}`):'<span class="hint">唯讀</span>'}</div></td></tr>`;}).join('')||'<tr><td colspan="6">沒有符合條件的帳號。</td></tr>'}</tbody></table></div><div class="table-footer"><span>顯示 ${list.length?(BO.accountPage-1)*20+1:0}–${Math.min(BO.accountPage*20,list.length)}，共 ${list.length} 個帳號</span>${pageButtons(BO.accountPage,pages,'account-page')}</div></section>`;
};
accountForm=function(id){
 const target=accounts.find(a=>a.id===id);if(!can(9)||target&&!acCanManage(target)||!AC_CHILD_ROLES[BO.user.role]?.length)return deny();
 const a=target||{name:'',email:'',role:AC_CHILD_ROLES[BO.user.role].at(-1),agency:BO.user.agency==='—'?'':BO.user.agency,parentId:BO.user.id};BO.editId=id||null;
 modal(id?'編輯帳號':'新增帳號',`<div class="grid">${[['acc-name','姓名 *',a.name],['acc-email','登入電郵 *',a.email],['acc-agency','所屬代理商',a.agency]].map(([i,l,v])=>`<div class="field"><label for="${i}">${l}</label><input id="${i}" value="${esc(v||'')}"></div>`).join('')}<div class="field"><label for="acc-role">角色 *</label><select id="acc-role" data-account-role>${AC_CHILD_ROLES[BO.user.role].map(r=>`<option ${r===a.role?'selected':''}>${r}</option>`).join('')}</select></div><div class="field" id="acc-parent-field" ${a.role===roles[0]?'hidden':''}><label for="acc-parent">所屬上級帳號 *</label><select id="acc-parent">${acParentOptions(a.role,a)}</select></div></div><p class="hint">下線帳戶沿用次代理商的商戶操作功能，操作者身份會分開記錄。</p><p id="acc-error" class="modal-error" role="alert"></p><p class="hint">新增帳號為待啟用示例，不會寄送真實邀請。</p>`,btn('取消','close')+btn('儲存帳號','save-account','primary'));
};
permissionModal=function(id){
 const a=accounts.find(x=>x.id===id);if(!can(10)||!acCanManage(a))return deny();BO.permissionId=id;
 modal('帳號權限管理',`<div class="profile-summary"><strong>${esc(a.name)}</strong> · ${esc(a.email)}<br>${esc(a.role)}</div><p class="hint">只修改所選帳號，不會影響同角色其他帳號；資料範圍由所屬層級決定。</p><div class="field"><label for="permission-role">帳號角色</label><select id="permission-role">${AC_CHILD_ROLES[BO.user.role].map(r=>`<option ${r===a.role?'selected':''}>${r}</option>`).join('')}</select></div><table class="permission-table"><thead><tr><th>功能</th><th>允許此帳號</th></tr></thead><tbody>${permissionLabels.map((p,i)=>`<tr><td>${p}</td><td><input type="checkbox" aria-label="${p}" data-permission="${i}" ${a.permissions[i]?'checked':''} ${!BO.user.permissions[i]?'disabled':''}></td></tr>`).join('')}</tbody></table><p class="modal-error" id="acc-error" role="alert"></p>`,btn('取消','close')+btn('儲存此帳號權限','save-permissions','primary'));
};
const acOldLogin=loginAs;loginAs=function(a){acMigrate();return acOldLogin(accounts.find(x=>x.id===a?.id));};
Object.assign(actions,{
 'pick-role':el=>{const a=accounts.find(a=>a.role===roles[+el.dataset.index]&&a.status==='已啟用');if(a){$('#login-email').value=a.email;$('#login-password').value=P;BO.loginEmail=a.email;}},
 'ac-reset':()=>{BO.search='';BO.role='全部角色';BO.accountPage=1;render();},
 'save-account':()=>{try{if(!can(9))return deny();const id=BO.editId,original=accounts.find(a=>a.id===id),role=$('#acc-role').value,parentId=role===roles[0]?'':$('#acc-parent').value,name=$('#acc-name').value.trim(),email=$('#acc-email').value.trim(),agency=$('#acc-agency').value.trim();if(!name||!/^\S+@\S+\.\S+$/.test(email)||accounts.some(a=>a.id!==id&&a.email.toLowerCase()===email.toLowerCase()))throw Error('請輸入姓名及未被使用的有效電郵。');const next=structuredClone(accounts),a=next.find(a=>a.id===id)||{id:'ACC-'+crypto.randomUUID(),last:'—',status:'待啟用',permissions:rolePermissions(role).map((v,i)=>v&&!!BO.user.permissions[i]),scope:'本人及獲指派的商戶',accountPolicyVersion:1};if(a.role&&a.role!==role)a.permissions=rolePermissions(role).map((v,i)=>v&&!!BO.user.permissions[i]);Object.assign(a,{name,email,role,parentId,agency});if(!a.agencyCode||original?.role!==role)a.agencyCode=roles.indexOf(role)>1?({[roles[2]]:'MA',[roles[3]]:'SA',[roles[4]]:'DL'}[role])+'-'+a.id.slice(-6).toUpperCase():'';if(!original)next.push(a);a.parentId=acValidateChange(a.id,role,parentId,next);passwordGate('儲存帳號 '+name,()=>{try{acValidateChange(a.id,role,a.parentId,next);return acCommit(next,'新增／更新帳號 '+name);}catch(e){$('#password-error').textContent=e.message;return false;}});}catch(e){$('#acc-error').textContent=e.message;}},
 'save-permissions':()=>{try{const a=accounts.find(a=>a.id===BO.permissionId);if(!can(10)||!acCanManage(a))return deny();const role=$('#permission-role').value,values=$$('[data-permission]').map(c=>c.checked);if(values.some((v,i)=>v&&!BO.user.permissions[i]))throw Error('不能授予超過目前帳號的權限。');const next=structuredClone(accounts),target=next.find(x=>x.id===a.id);Object.assign(target,{role,permissions:values});target.parentId=acValidateChange(a.id,role,target.parentId,next);passwordGate('變更 '+a.name+' 的個別權限',()=>{if(!can(10)||!acCanManage(accounts.find(x=>x.id===a.id)))return false;try{acValidateChange(a.id,role,target.parentId,next);return acCommit(next,'變更帳號權限 '+a.name);}catch(e){$('#password-error').textContent=e.message;return false;}});}catch(e){$('#acc-error').textContent=e.message;}},
 'toggle-account':el=>{const a=accounts.find(a=>a.id===el.dataset.id);if(!acCanManage(a))return deny();if(a.id===BO.user.id)return toast('不能停用目前登入帳號');const next=structuredClone(accounts),target=next.find(x=>x.id===a.id);target.status=a.status==='已啟用'?'已停用':'已啟用';try{acValidateChange(a.id,a.role,a.parentId,next);}catch(e){return toast(e.message);}passwordGate(target.status+'帳號 '+a.name,()=>acCanManage(accounts.find(x=>x.id===a.id))&&acCommit(next,target.status+'帳號 '+a.name));},
 'reset-account':el=>{const a=accounts.find(a=>a.id===el.dataset.id);if(!acCanManage(a))return deny();passwordGate('重設 '+a.name+' 的密碼',()=>acCanManage(accounts.find(x=>x.id===a.id))&&acCommit(structuredClone(accounts),'模擬重設密碼 '+a.name));},
 'invite-account':el=>{const a=accounts.find(a=>a.id===el.dataset.id);if(!acCanManage(a))return deny();modal('邀請已重新寄送（模擬）',`<p>${esc(a.email)}</p><p>沒有真正發送電郵。</p>`);}
});
document.addEventListener('change',e=>{if(e.target.hasAttribute('data-account-role')){const role=e.target.value,original=accounts.find(a=>a.id===BO.editId);$('#acc-parent-field').hidden=role===roles[0];$('#acc-parent').innerHTML=acParentOptions(role,original);}});
const acSummary=window.AllinPayDemo.getSummary;window.AllinPayDemo.getSummary=()=>({...acSummary(),accounts:acVisibleAccounts().length});

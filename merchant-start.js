// Guided entry keeps starting a new merchant separate from editing an existing one.
let nsCopySource='',nsCopyScopes=['profile','mcc','settlement','products'];
const nsCanStart=()=>!!mtOwner()&&(MT_EXTERNAL||can(1));
const nsIcon=kind=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${kind==='new'?'<path d="M12 5v14M5 12h14"/>':kind==='copy'?'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>':'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12"/>'}</svg>`;
function nsSources(){
 if(!nsCanStart())return [];
 if(MT_EXTERNAL)return state.records.filter(r=>r.email===state.email).map(r=>({key:'record:'+r.id,name:r.values.merchantName||r.values.companyZh||r.values.merchantEnglishName||'未命名商戶',snapshot:r}));
 return [...scopedDrafts().map(d=>({key:'draft:'+d.id,name:d.values.merchantName||d.values.merchantEnglishName||'未命名草稿',snapshot:d})),...scopedRows().map(r=>({key:'row:'+rowKey(r),name:r['客戶中文名稱']||r['客戶英文名稱'],snapshot:r.application||{values:{mcc:r['MCC 行業代碼']?.split(/[、,;]/)[0]||'',contactName:r['客戶聯繫人'],contactPhone:r['聯絡人電話'],contactEmail:r['聯絡人電郵'],cardBankName:r['銀行名稱'],cardBankCode:r['銀行代碼']}}}))];
}
function nsLanding(){
 const drafts=MT_EXTERNAL?state.records.filter(r=>r.email===state.email&&r.status==='草稿').length:scopedDrafts().length;
 const templates=mtTemplates().length,sources=nsSources().length;
 return `<section class="ns-start"><header class="ns-intro"><span class="ns-eyebrow">商戶入網 · 開始申請</span><h1>選擇適合你的新增方式</h1><p>從空白開始，或沿用已有資料，減少重複填寫。選擇後進入相同的六步申請流程。</p></header><div class="ns-start-cards">${[
 ['new','全新建立','第一次申請，或需要從空白資料開始。','開始新增','ns-blank','primary','先上傳文件，也可直接手動填寫'],
 ['copy','複製已有商戶','沿用共用資料、MCC、結算參數及產品費率。','選擇已有商戶','ns-copy-open','','可選 '+sources+' 家商戶／草稿'],
 ['template','使用已存模板','套用團隊已儲存的標準設定，再補上公司專屬資料。','選取模板','ns-template','','目前 '+templates+' 份模板']
 ].map(([icon,title,copy,label,action,style,meta])=>`<article class="ns-start-card"><span class="ns-icon">${nsIcon(icon)}</span><h2>${title}</h2><p>${copy}</p><small>${meta}</small>${btn(label,action,style)}</article>`).join('')}</div><div class="ns-secondary"><div><strong>已經有資料？</strong><p>Excel／CSV 可同時帶入多家公司；未完成的申請可繼續填寫。</p></div><div>${btn('匯入資料','mt-import-open')}${btn('繼續草稿（'+drafts+'）','ns-drafts')}${!MT_EXTERNAL&&invitationSource()?btn('邀請客戶填寫','share-agency'):''}</div></div><div class="ns-preparation"><section class="card"><h2>申請共 6 個 Step</h2><ol class="ns-step-list">${steps.map((name,i)=>`<li><b>${i+1}</b><span>${esc(name)}</span></li>`).join('')}</ol><p class="hint">每一步都可儲存草稿，右側進度會提示缺少的資料。</p></section><section class="card"><h2>建議先預備</h2><ul class="ns-doc-list"><li>商業登記證 BR、公司註冊證書 CI</li><li>負責人／董事的身分與地址證明</li><li>銀行月結單、結算帳戶及聯絡資料</li><li>需要開通的產品與預定費率</li></ul><p class="hint">文件可稍後補齊，不會阻擋開始填寫。支援 PDF／JPG／PNG，每份上限 10 MB。</p></section></div></section>`;
}
function nsBlankState(){
 if(MT_EXTERNAL)newApplication();else v2Reset();state.readonly=false;state.errors={};
}
function nsStartBlank(template=false){if(!nsCanStart())return deny();nsBlankState();go('application/1');if(template)requestAnimationFrame(()=>mtLibrary());}
function nsSourceOptions(query=''){const q=query.trim().toLocaleLowerCase();return nsSources().filter(s=>(s.name+' '+s.snapshot.values?.__customer?.name).toLocaleLowerCase().includes(q)).map(s=>`<option value="${esc(s.key)}" ${s.key===nsCopySource?'selected':''}>${esc(s.name)}${s.snapshot.values?.__customer?.name?' · '+esc(s.snapshot.values.__customer.name):''}</option>`).join('');}
function nsCopyOpen(){
 if(!nsCanStart())return deny();nsCopySource='';nsCopyScopes=['profile','mcc','settlement','products'];mtDialog('複製已有商戶',`<p>選擇有權限查看的商戶，沿用已儲存的共用設定，再建立一份新的申請；來源未填的項目會保持空白。</p><div class="grid"><div class="field"><label for="ns-source-search">搜尋公司／集團</label><input id="ns-source-search" placeholder="輸入名稱搜尋"></div><div class="field"><label for="ns-copy-source">來源商戶</label><select id="ns-copy-source"><option value="">請選擇已有商戶</option>${nsSourceOptions()}</select></div></div><fieldset class="mt-scopes"><legend>需要沿用的設定</legend>${nsCopyScopes.map(key=>`<label class="check"><input type="checkbox" data-ns-scope="${key}" checked>${MT.labels[key]}</label>`).join('')}</fieldset><div class="notice">公司名稱、BR、銀行帳號、人員證件、附件與簽署／驗證狀態會重新填寫。來源商戶不會被修改。</div><p id="ns-source-preview" class="hint">選擇來源後，可建立新的商戶申請。</p>`,btn('取消','mt-close')+btn('複製並開始填寫','ns-copy-confirm','primary'));
}
function nsCopyConfirm(){
 try{if(!nsCanStart())return deny();const source=nsSources().find(s=>s.key===nsCopySource);if(!source)throw Error('請先選擇來源商戶');if(!nsCopyScopes.length)throw Error('請至少選擇一項需要沿用的設定');
 const snapshot=source.snapshot,template=MT.cleanTemplate({id:'copy',name:('複製自 '+source.name).slice(0,80),scopes:nsCopyScopes,values:snapshot.values,products:snapshot.values?.__v2,people:{}});
 nsBlankState();const applied=MT.apply(mtSnapshot(),template,nsCopyScopes,'replace',false).snapshot;state.values=applied.values;state.people=applied.people;state.files={};state.checks={};state.emailVerified=false;state.signature='';state.values.signer='';state.values.signerTitle='';delete state.values.__templateApplied;
 const relation=snapshot.values?.__customer;if(relation?.id&&relation.name)state.values.__customer={id:relation.id,name:relation.name,role:'independent',parentId:''};v2SyncDerived();mtClose();go('application/1');toast('已建立新的申請並沿用所選設定，請填寫本次公司資料');
 }catch(e){mtError(e.message);}
}
Object.assign(actions,{'ns-blank':()=>nsStartBlank(),'ns-template':()=>nsStartBlank(true),'ns-copy-open':nsCopyOpen,'ns-copy-confirm':nsCopyConfirm,'ns-drafts':()=>go(MT_EXTERNAL?'applications':'drafts')});
actions.new=()=>{if(!nsCanStart())return deny();go('new-merchant');};
if(!MT_EXTERNAL){const nsSidebar=sidebar,nsTabs=tabs;sidebar=page=>nsSidebar(page==='new-merchant'?'application':page).replace('href="#/application/1"','href="#/new-merchant"');tabs=page=>nsTabs(page==='new-merchant'?'application':page);}
const nsRender=render;render=function(){nsRender();if(route().page!=='new-merchant'||!nsCanStart())return;const target=MT_EXTERNAL?$('#app .main'):$('#app .content');if(target)target.innerHTML=nsLanding();};
document.addEventListener('input',e=>{if(e.target.id==='ns-source-search'){const select=$('#ns-copy-source');select.innerHTML='<option value="">請選擇已有商戶</option>'+nsSourceOptions(e.target.value);if(select.value!==nsCopySource)nsCopySource='';}});
document.addEventListener('change',e=>{const t=e.target;if(t.id==='ns-copy-source'){nsCopySource=t.value;const source=nsSources().find(s=>s.key===t.value);$('#ns-source-preview').textContent=source?'將複製「'+source.name+'」的所選設定，建立新的申請。':'請選擇來源商戶。';}if(t.dataset.nsScope)nsCopyScopes=t.checked?[...nsCopyScopes,t.dataset.nsScope]:nsCopyScopes.filter(k=>k!==t.dataset.nsScope);});

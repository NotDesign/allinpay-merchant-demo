// Independent default-rate editor. Reuse the merchant fee renderer without changing its fields.
let bfDraft=null;
function bfEntry(key){const definition=MW.products.find(p=>p.key===key);if(!definition)throw Error('找不到產品');return bfDraft.rates[key]??={ct:definition.r.ct||null,v:{}};}
function bfContext(run){
 const values=state.values,errors=state.errors;
 try{const model={version:2,groups:{},rates:{},combo:{'POS|DCC交易':true},sme:{},links:{authSigners:{},shareHolders:{}},signals:{},ocr:[],ack:{},manualRisk:false};
  for(const group of v2Groups){model.groups[group.k]=true;group.rows.forEach((row,index)=>{const key=v2RowKey(group,index),entry=bfEntry(key);model.rates[key]={on:true,ct:entry.ct,v:entry.v};});}
  state.values={...V2.defaults,__v2:model};state.errors={};return run();
 }finally{state.values=values;state.errors=errors;}
}
function bfIssues(key){const definition=MW.products.find(p=>p.key===key),entry=bfEntry(key);if(definition.r.mode==='INST'&&!V2.catalog.TENORS.some(t=>entry.v['t'+t+'_on']))return [];
 return bfContext(()=>v2FeeErrors(definition.r,entry));}
function bfProductsHTML(){
 const group=v2Groups.find(g=>g.k===bfDraft.group),template=document.createElement('template');template.innerHTML=bfContext(v2Products);
 const card=[...template.content.querySelectorAll('[data-section]')].find(n=>n.dataset.section===group.n+' · 產品項目');
 card.querySelector(':scope > p.hint')?.remove();card.querySelector(':scope > .toolbar')?.remove();
 const query=bfDraft.query.trim().toLocaleLowerCase();let matches=0;
 for(const row of card.querySelectorAll('[data-v2-rate-row]')){
  const key=row.dataset.v2RateRow,definition=MW.products.find(p=>p.key===key);if(query&&!definition.label.toLocaleLowerCase().includes(query)){row.remove();continue;}matches++;
  row.querySelector('[data-v2-product]')?.remove();const error=row.querySelector('[data-v2-rate-error]');if(error){error.removeAttribute('data-v2-rate-error');error.dataset.bfError=key;error.textContent=bfIssues(key).join('；');}
 }
 for(const control of card.querySelectorAll('[data-v2-inline-key],[data-v2-inline-pricing]')){
  for(const [original,target]of [['v2-inline-key','bf-key'],['v2-inline-field','bf-field'],['v2-inline-toggle','bf-toggle'],['v2-inline-pricing','bf-pricing']])if(control.hasAttribute('data-'+original)){control.setAttribute('data-'+target,control.getAttribute('data-'+original));control.removeAttribute('data-'+original);}
 }
 for(const node of card.querySelectorAll('[id]'))node.id='bf-'+node.id;
 for(const label of card.querySelectorAll('label[for]'))label.htmlFor='bf-'+label.htmlFor;
 const result=document.createElement('div');result.className='bf-editor v2-form';result.innerHTML='<div class="v2-products-page">'+(matches?card.outerHTML:'<p class="bf-empty">找不到符合的產品，請調整搜尋內容。</p>')+'</div>';
 bfDraft.matches=matches;return result.outerHTML;
}
function bfRefreshProducts(focusId=''){
 if(!bfDraft||!$('#bf-products'))return;const body=$('#modal .modal-body'),top=body.scrollTop;$('#bf-products').innerHTML=bfProductsHTML();$('#bf-match-count').textContent='顯示 '+bfDraft.matches+' 項產品';body.scrollTop=top;if(focusId)document.getElementById(focusId)?.focus({preventScroll:true});
 for(const button of $$('[data-action="bf-group"]'))button.classList.toggle('primary',button.dataset.group===bfDraft.group);
 const other=$('#bf-other-category');if(other)other.value=['POS','CNP','INQR'].includes(bfDraft.group)?'':bfDraft.group;
}
function bfStatus(text){const status=$('#bf-status');if(status)status.textContent=text;}
function bfOpen(){
 if(!bfCanEdit())return deny();const saved=bfRead();bfDraft={rates:bfClean(saved.rates),group:'POS',query:'',revision:saved.revision||0};
 const templates=mtTemplates().filter(t=>t.scopes.includes('products'));
 mtDialog('基礎費率設定',`<p class="bf-intro">直接修改各產品的預設費率，再按「儲存基礎費率」。新商戶預設使用這些數值，產品仍需另行勾選開通。</p><div class="bf-controls"><div class="bf-categories" aria-label="費率產品類別">${v2Groups.filter(g=>['POS','CNP','INQR'].includes(g.k)).map(g=>btn(g.n,'bf-group',g.k==='POS'?'primary':'',`data-group="${g.k}"`)).join('')}</div><div class="field"><label for="bf-other-category">其他產品類別</label><select id="bf-other-category"><option value="">請選擇</option>${v2Groups.filter(g=>!['POS','CNP','INQR'].includes(g.k)).map(g=>`<option value="${g.k}">${esc(g.n)}</option>`).join('')}</select></div><div class="field"><label for="bf-product-search">搜尋產品</label><input id="bf-product-search" type="search" placeholder="輸入產品或卡組織名稱"></div></div><details class="bf-import"><summary>帶入現有費率（選填）</summary><div class="bf-import-controls">${btn('帶入目前表單費率','bf-current','',route().page==='application'?'':'disabled')}<label for="bf-template">帶入費率模板</label><select id="bf-template"><option value="">選擇模板</option>${templates.map(t=>`<option value="${esc(t.id)}">${esc(t.name)} · v${t.version}</option>`).join('')}</select></div></details><p class="hint bf-result-count" id="bf-match-count"></p><div id="bf-products">${bfProductsHTML()}</div>`, `<span class="hint bf-status" id="bf-status">尚未修改 · 目前儲存版本 v${saved.revision||0}</span>${btn('全部設為 0','bf-zero')}${btn('取消','mt-close')}${btn('儲存基礎費率','bf-save','primary')}`);
 $('#modal').classList.add('bf-config');bfRefreshProducts();
}
function bfSave(){
 try{if(!bfCanEdit()||!bfDraft)return deny();const rates=bfClean(bfDraft.rates);for(const key of Object.keys(rates)){const issues=bfIssues(key);if(issues.length)throw Error(MW.products.find(p=>p.key===key).label+'：'+issues.join('；'));}
  if(bfRead().revision!==bfDraft.revision&&!(bfRead().revision===undefined&&bfDraft.revision===0))throw Error('基礎費率已由其他操作更新，請重新開啟核對');
  if(mtFailureActive())throw Error('模擬儲存失敗，基礎費率保持原值');
  localStorage.setItem(BF_KEY,JSON.stringify({rates,revision:bfDraft.revision+1,label:'自訂基礎費率',updatedAt:new Date().toISOString()}));mtClose();toast('基礎費率已儲存，之後新增商戶會帶入預設值');
 }catch(error){mtError(error.message);}
}
Object.assign(actions,{'bf-open':bfOpen,'bf-save':bfSave,'bf-group':el=>{if(!bfDraft)return;bfDraft.group=el.dataset.group;bfRefreshProducts();},'bf-zero':()=>{if(!bfDraft)return;bfDraft.rates={};bfRefreshProducts();bfStatus('已全部設為 0，按儲存後生效');},'bf-current':()=>{if(!bfCanEdit()||!bfDraft||route().page!=='application')return deny();bfDraft.rates=bfClean(v2Model().rates);bfRefreshProducts();bfStatus('已帶入目前表單費率，可繼續修改');}});
function bfEditEvent(event){
 const target=event.target;if(!bfDraft||!target.closest('#modal.bf-config'))return;event.stopImmediatePropagation();
 if(target.id==='bf-product-search'){bfDraft.query=target.value;bfRefreshProducts();return;}
 if(target.id==='bf-other-category'){if(target.value){bfDraft.group=target.value;bfRefreshProducts();}return;}
 if(target.id==='bf-template'){if(!target.value)return;const template=mtTemplates().find(t=>t.id===target.value);if(template){bfDraft.rates=bfClean(template.products?.rates);bfRefreshProducts();bfStatus('已帶入「'+template.name+'」，可繼續修改');}return;}
 const key=target.dataset.bfKey||target.dataset.bfPricing;if(!key)return;const entry=bfEntry(key);
 if(target.dataset.bfPricing){entry.ct=target.value;bfRefreshProducts(target.id);}
 else if(target.dataset.bfToggle){entry.v[target.dataset.bfToggle]=target.checked;bfRefreshProducts(target.id);}
 else if(target.dataset.bfField){entry.v[target.dataset.bfField]=target.value;const error=[...$$('[data-bf-error]')].find(n=>n.dataset.bfError===key);if(error)error.textContent=bfIssues(key).join('；');}
 bfStatus('有未儲存的費率修改');
}
document.addEventListener('input',bfEditEvent,true);document.addEventListener('change',bfEditEvent,true);
$('#modal').addEventListener('close',()=>{if(!$('#modal').open){$('#modal').classList.remove('bf-config');bfDraft=null;}});

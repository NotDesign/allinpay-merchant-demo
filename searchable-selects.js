// Progressive enhancement: original select elements, option values and events stay intact.
(()=>{
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const normalize=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/滙/g,'匯').replace(/恆/g,'恒').replace(/臺/g,'台').replace(/\s+/g,' ').trim();
 const compact=value=>normalize(value).replace(/[\s_.(),（）/\-]/g,'');
 const commonBanks=['004','012','024','003','015','009','016','018','020','025','027','028','035','039','040','041','043','072','128','250','382','387','388','389','390','391','392','393','395'];
 const bankAliases={'004':'HSBC 匯豐 滙豐','012':'BOCHK BOC 中銀 中國銀行','024':'Hang Seng 恒生 恆生','003':'SCB Standard Chartered 渣打','015':'BEA 東亞','016':'DBS 星展','018':'CITIC 中信','020':'Wing Lung 永隆','035':'OCBC 華僑 永亨','072':'ICBC 工銀 工商','250':'Citi 花旗'};
 let active=null;
 const eligible=el=>el instanceof HTMLSelectElement&&!el.multiple&&el.size<=1&&!el.matches(':disabled')&&!el.closest('[inert]');
 function sourceLabel(select){return select.getAttribute('aria-label')||select.labels?.[0]?.textContent.trim().replace(/\s+/g,' ')||select.closest('.field')?.querySelector('label')?.textContent.trim()||'選項';}
 function optionsFor(select){
  const bankSelect=select.matches('[data-bank-picker],[data-bank-code-picker]');
  const options=Array.from(select.options).map((option,index)=>{
   const bank=bankSelect?BANK_CODE_REFERENCE.banks.find(b=>b.code===option.value||b.name===option.value):null;
   const priority=bank?commonBanks.indexOf(bank.code):-1;
   return {index,value:option.value,label:option.label,description:option.dataset.description||'',disabled:option.disabled||!!option.closest('optgroup:disabled'),hidden:option.hidden,bank,group:bank?(priority>=0?'香港常用銀行':'其他在港銀行／清算參考'):option.parentElement instanceof HTMLOptGroupElement?option.parentElement.label:'',rank:bank?(priority>=0?priority+1:1000+Number(bank.code)):option.value===''?-1:10000+index,search:normalize([option.label,option.value,option.dataset.description,bank?.en,bank?.zh,bank?.code,bank&&bankAliases[bank.code]].filter(Boolean).join(' '))};
  }).filter(o=>!o.hidden);
  if(bankSelect)options.sort((a,b)=>a.rank-b.rank);
  return {options,bankSelect};
 }
 function restoreAttribute(select,name,value){if(value===null)select.removeAttribute(name);else select.setAttribute(name,value);}
 function close(restoreFocus=false){
  if(!active)return;const previous=active;active=null;
  if(typeof previous.panel.hidePopover==='function'&&previous.panel.matches(':popover-open'))previous.panel.hidePopover();previous.panel.remove();
  for(const [name,value] of Object.entries(previous.attributes))restoreAttribute(previous.select,name,value);
  if(restoreFocus&&previous.select.isConnected&&!previous.select.disabled)previous.select.focus({preventScroll:true});
 }
 function position(){
  if(!active)return;const {select,panel}=active;
  if(!select.isConnected||select.disabled){close();return;}
  const rect=select.getBoundingClientRect(),viewport=window.visualViewport,left=viewport?.offsetLeft||0,top=viewport?.offsetTop||0,width=viewport?.width||innerWidth,height=viewport?.height||innerHeight;
  if(rect.bottom<top||rect.top>top+height){close();return;}
  const panelWidth=Math.min(Math.max(rect.width,280),520,width-16),below=top+height-rect.bottom-12,above=rect.top-top-12,up=below<240&&above>below,available=Math.max(below,above),maxHeight=Math.min(420,Math.max(160,available),height-16);
  panel.style.width=panelWidth+'px';panel.style.maxHeight=maxHeight+'px';panel.style.left=Math.max(left+8,Math.min(rect.left,left+width-panelWidth-8))+'px';
  const actualHeight=Math.min(panel.scrollHeight,maxHeight);
  panel.style.top=Math.max(top+8,Math.min(up?rect.top-actualHeight-6:rect.bottom+6,top+height-actualHeight-8))+'px';
 }
 function highlight(index,scroll=false){
  if(!active)return;const enabled=active.filtered.filter(o=>!o.disabled);const option=enabled.find(o=>o.index===index)||enabled[0];active.highlight=option?.index??-1;
  active.panel.querySelectorAll('[data-sdd-option]').forEach(button=>button.classList.toggle('highlighted',Number(button.dataset.sddOption)===active.highlight));
  if(option){active.input.setAttribute('aria-activedescendant','sdd-option-'+option.index);if(scroll)active.panel.querySelector('#sdd-option-'+option.index)?.scrollIntoView({block:'nearest'});}else active.input.removeAttribute('aria-activedescendant');
 }
 function renderOptions(){
  if(!active)return;const a=active,q=normalize(a.input.value),tokens=q.split(' ').filter(Boolean);a.filtered=a.options.filter(o=>tokens.every(token=>o.search.includes(token)||compact(o.search).includes(compact(token))));
  let group=null;
  a.list.innerHTML=a.filtered.map(option=>{
   const heading=option.group&&option.group!==group?'<div class="sdd-group" role="presentation">'+escape(option.group)+'</div>':'';group=option.group;
   const selected=option.index===a.select.selectedIndex,details=option.bank?(a.bankSelect&&a.select.hasAttribute('data-bank-picker')?option.bank.code+' · '+option.bank.en:option.bank.en):option.description;
   return heading+`<button type="button" role="option" tabindex="-1" id="sdd-option-${option.index}" data-sdd-option="${option.index}" aria-selected="${selected}" aria-disabled="${option.disabled}" ${option.disabled?'disabled':''}><span class="sdd-option-text"><span>${escape(option.label)}</span>${details?'<small>'+escape(details)+'</small>':''}</span><span class="sdd-check" aria-hidden="true">${selected?'✓':''}</span></button>`;
  }).join('')||'<div class="sdd-empty">沒有符合的選項，請換個關鍵字。</div>';
  const other=a.options.find(o=>o.value==='__other'&&!o.disabled);
  if(!a.filtered.length&&other)a.list.innerHTML+=`<button type="button" class="sdd-other" data-sdd-option="${other.index}">${escape(other.label)}</button>`;
  a.count.textContent=(q?'找到 '+a.filtered.length+' 個':'共 '+a.options.length+' 個')+'選項';a.clear.disabled=!a.input.value;
  highlight(a.filtered.some(o=>o.index===a.highlight)?a.highlight:a.filtered.find(o=>o.index===a.select.selectedIndex)?.index);position();
 }
 function choose(index){
  if(!active)return;const {select}=active,option=active.options.find(o=>o.index===index);if(!option||option.disabled||!select.isConnected||select.disabled)return;
  const changed=select.selectedIndex!==option.index;close(true);if(!changed)return;
  select.selectedIndex=option.index;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));
 }
 function open(select,query=''){
  if(!eligible(select))return;if(active?.select===select){active.input.focus({preventScroll:true});return;}close();
  const {options,bankSelect}=optionsFor(select),panel=document.createElement('div'),label=sourceLabel(select);panel.id='searchable-select-popover';panel.className='sdd-popover';panel.setAttribute('popover','manual');
  panel.innerHTML=`<div class="sdd-search"><input type="search" id="sdd-search-input" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="sdd-options" aria-label="${escape('搜尋'+label)}" placeholder="${bankSelect?'搜尋銀行名稱、英文或香港行號':'輸入文字搜尋選項'}" autocomplete="off" spellcheck="false"><button type="button" class="sdd-clear" aria-label="清除搜尋">清除</button></div><div id="sdd-options" class="sdd-options" role="listbox" aria-label="${escape(label)}"></div><div class="sdd-count" role="status" aria-live="polite"></div>`;
  const attributes=Object.fromEntries(['aria-expanded','aria-controls','aria-haspopup'].map(name=>[name,select.getAttribute(name)]));select.setAttribute('aria-expanded','true');select.setAttribute('aria-controls',panel.id);select.setAttribute('aria-haspopup','listbox');
  (select.closest('dialog[open]')||document.body).append(panel);active={select,panel,options,filtered:[],bankSelect,attributes,input:panel.querySelector('input'),list:panel.querySelector('.sdd-options'),clear:panel.querySelector('.sdd-clear'),count:panel.querySelector('.sdd-count'),highlight:select.selectedIndex};
  active.input.value=query;active.input.addEventListener('input',renderOptions);active.clear.addEventListener('click',()=>{if(!active)return;active.input.value='';renderOptions();active.input.focus({preventScroll:true});});
  panel.addEventListener('click',event=>{const button=event.target.closest('[data-sdd-option]');if(button){event.preventDefault();event.stopPropagation();choose(Number(button.dataset.sddOption));}});
  if(typeof panel.showPopover==='function')panel.showPopover();else panel.setAttribute('data-sdd-open','');renderOptions();active?.input.focus({preventScroll:true});position();
 }
 window.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;const select=event.target.closest?.('select');
  if(eligible(select)){event.preventDefault();event.stopImmediatePropagation();if(active&&active.select!==select)close();}
  else if(active&&!active.panel.contains(event.target))close();
 },true);
 window.addEventListener('mousedown',event=>{if(eligible(event.target.closest?.('select'))){event.preventDefault();event.stopImmediatePropagation();}},true);
 // Open after pointer release so an upward menu cannot intercept the opening click.
 window.addEventListener('click',event=>{const select=event.target.closest?.('select');if(event.button!==0||!eligible(select))return;event.preventDefault();event.stopImmediatePropagation();if(active?.select===select)close(true);else open(select);},true);
 window.addEventListener('keydown',event=>{
  if(event.isComposing)return;
  if(active){
   if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close(true);return;}
   if(event.key==='Tab'){close(true);return;}
   if(!active.panel.contains(event.target))return;
   const enabled=active.filtered.filter(o=>!o.disabled),current=enabled.findIndex(o=>o.index===active.highlight);
   if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();const index=event.key==='Home'?0:event.key==='End'?enabled.length-1:event.key==='ArrowDown'?Math.min(enabled.length-1,current+1):Math.max(0,current-1);highlight(enabled[index]?.index,true);}
   else if(event.key==='Enter'){event.preventDefault();event.stopImmediatePropagation();choose(active.highlight);}
   return;
  }
  const select=event.target;if(!eligible(select)||event.ctrlKey||event.metaKey||event.altKey&&event.key!=='ArrowDown')return;
  if(['ArrowDown','ArrowUp','Enter',' ','Home','End'].includes(event.key)||event.key.length===1){event.preventDefault();event.stopImmediatePropagation();open(select,event.key.length===1&&event.key!==' '?event.key:'');}
 },true);
 window.addEventListener('resize',position);window.visualViewport?.addEventListener('resize',position);window.visualViewport?.addEventListener('scroll',position);window.addEventListener('scroll',position,true);
 document.addEventListener('focusin',event=>{if(active&&!active.panel.contains(event.target)&&event.target!==active.select)close();});
 new MutationObserver(records=>{
  if(!active)return;if(!active.select.isConnected||active.select.disabled||document.querySelector('#idle-session-dialog[open]')){close();return;}
  if(records.some(record=>record.target===active.select||active.select.contains(record.target))){Object.assign(active,optionsFor(active.select));renderOptions();}
 }).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','selected','label','value','hidden']});
 const style=document.createElement('style');style.textContent=`.sdd-popover{position:fixed;inset:auto;margin:0!important;padding:0;border:1px solid #cbd7e6;border-radius:8px;background:#fff;color:#263247;box-shadow:0 8px 28px #14254f26;z-index:100010;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;font:14px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.sdd-search{padding:12px;display:flex;gap:8px;align-items:center;border-bottom:1px solid #e2e8f0;flex:none}.sdd-search input{box-sizing:border-box;width:100%;min-width:0;flex:1;margin:0;padding:9px 12px;border:1px solid #afc4dc;border-radius:6px;font:inherit;color:#263247;background:#fff;min-height:40px;height:40px;outline:none}.sdd-search input:focus{border-color:#168fc7;box-shadow:0 0 0 2px #168fc722}.sdd-search button{flex:none;margin:0;padding:6px 8px;font:inherit;font-size:12px;min-width:0;min-height:32px;border:1px solid #d4deeb;border-radius:5px;background:#fff;color:#52657d}.sdd-options{overflow:auto;overscroll-behavior:contain;min-height:48px;flex:1;padding:4px}.sdd-options button{box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-width:0;min-height:40px;height:auto;padding:10px 12px;margin:0;border:1px solid transparent;border-radius:4px;background:#fff;color:#263247;font:inherit;text-align:left;white-space:normal;cursor:pointer;line-height:1.5}.sdd-options button:hover,.sdd-options button.highlighted{background:#eff7fc;border-color:#98c9e4}.sdd-options button[aria-selected="true"]{background:#e4f3fc;color:#126b9c}.sdd-options button:disabled{opacity:.5;cursor:not-allowed}.sdd-option-text{display:block;min-width:0;overflow-wrap:anywhere}.sdd-option-text>span{display:block}.sdd-option-text small{display:block;font-size:11px;line-height:1.5;color:#6b7c92;margin-top:3px;overflow-wrap:anywhere}.sdd-check{flex:none;width:18px;color:#168fc7;text-align:center}.sdd-group{padding:9px 12px 5px;font-size:12px;font-weight:600;color:#6a7a91}.sdd-count{padding:8px 14px;border-top:1px solid #e2e8f0;font-size:12px;color:#6b7c92;flex:none}.sdd-empty{padding:18px 12px;color:#6b7c92;line-height:1.6}.sdd-options .sdd-other{color:#126b9c}`;document.head.append(style);
 Object.assign(window.AllinPayDemo||{}, {getSearchableSelectState:()=>({eligible:Array.from(document.querySelectorAll('select')).filter(eligible).length,open:!!active,sourceId:active?.select.id||'',query:active?.input.value||'',results:active?.filtered.length||0})});
})();

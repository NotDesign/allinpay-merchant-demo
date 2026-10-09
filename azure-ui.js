const azureIsKTC=()=>/^#\/(application|form)\/ktc$/.test(location.hash);
const azureLanguageSelect=()=>'<select class="azure-language" aria-label="語言" data-azure-language><option value="zh-Hant">繁體中文</option><option value="zh-Hans">简体中文</option><option value="en">English</option></select>';
if(!AZURE_EXTERNAL){
 const baseOverview=v2RiskOverview;
 v2RiskOverview=function(){return (route().page==='application'&&route().step===1&&!azureIsKTC()?invitation():'')+baseOverview();};
}
function azureAfterRender(){
 document.title=AZURE_EXTERNAL?'Azure · 商戶申請 Demo':'Azure · 後台管理 Demo';
 document.documentElement.dataset.release='2026.10.09-azure-otp-ktc';
 const ktc=azureIsKTC(),r=route(),form=r.page==='application';
 if(form&&(AZURE_EXTERNAL?state.session:BO.user)){
  const nav=$(AZURE_EXTERNAL?'.external-v2-steps':'.stepper');if(nav)nav.outerHTML=ktcSteps(ktc?'ktc':r.step);
  if(!AZURE_EXTERNAL){$$('.agency-invitation').forEach(n=>{if(!n.closest('#v2-application-status'))n.remove();});}
  if(ktc){
   if(AZURE_EXTERNAL){$('.external-v2 .v2-form')?.remove();$('.external-v2 .form-actions')?.remove();$('.external-v2')?.insertAdjacentHTML('beforeend',ktcRenderPanel());}
   else{$('.form-content').innerHTML=ktcRenderPanel();$('.footer')?.remove();}
  }else{
   const title=$('.v2-version');if(title)title.textContent='Azure · 七步申請流程';
   const summary=$('.footer .actions .hint');if(summary)summary.textContent='Step '+(r.step===1?1:r.step+1)+'／7';
   if(AZURE_EXTERNAL&&r.step===2){const b=$('.form-actions [data-step="1"]');if(b)b.dataset.action='ktc-open';}
   if(r.step===6){const review=$('.v2-form');review?.insertAdjacentHTML('afterbegin','<div class="notice '+(ktcPassed()?'success':'warn')+'">KTC 認證：'+(ktcPassed()?'已完成（Demo）':'尚未完成')+' '+btn('查看 KTC','ktc-open')+'</div>');}
  }
 }
 $$('.brand').forEach(n=>{n.setAttribute('aria-label','Azure');n.querySelector('img')?.setAttribute('alt','Azure');});
 const sidebarBottom=$('.sidebar-bottom');if(sidebarBottom&&!sidebarBottom.querySelector('[data-azure-language]')){
  [...sidebarBottom.children].find(c=>c.textContent.trim()==='繁體中文')?.remove();sidebarBottom.insertAdjacentHTML('afterbegin',azureLanguageSelect());
 }
 const login=$('.login-wrap');if(login&&!login.querySelector('[data-azure-language]'))login.insertAdjacentHTML('afterbegin',azureLanguageSelect());
 $$('.auth-top select,.header-actions>select').forEach(n=>{if(!n.dataset.azureLanguage)n.outerHTML=azureLanguageSelect();});
 azureLocalize();
}
const azureRender=render;
render=function(){
 if(location.hash.startsWith('#/ktc-mobile/')){ktcMobile();azureLocalize();return;}
 if(location.hash.startsWith('#/azure-')){azureShowAuth();azureAfterRender();return;}
 azureRender();azureAfterRender();
};
const azureModal=modal;
modal=function(...args){azureModal(...args);azureLocalize($('#modal'));};
// Localisation changes presentation only. Inputs, option values, customer records and draft keys stay original.
let azureLocale='zh-Hant';try{azureLocale=localStorage.getItem('azure-demo-language')||'zh-Hant';}catch{}
if(!['zh-Hant','zh-Hans','en'].includes(azureLocale))azureLocale='zh-Hant';
const azureToSimplified=OpenCC.Converter({from:'tw',to:'cn'});
const azureTextCache=new WeakMap();
for(const f of v2Fields){const parts=f.label.split(/\s{2,}/);if(parts[1])AZURE_EN[parts[0].replace('*','').trim()]=parts.slice(1).join(' ').trim();}
function azureTranslate(text,migrateSteps=false){
 let t=text.replace('六步申請流程','七步申請流程').replace('六個步驟','七個步驟');
 if(migrateSteps)t=t.replace(/Step ([2-6])(?!\d)/g,(_,s)=>'Step '+(+s+1));
 if(azureLocale==='zh-Hans')return azureToSimplified(t);
 if(azureLocale!=='en')return t;
 if(AZURE_EN[t.trim()])return t.replace(t.trim(),AZURE_EN[t.trim()]);
 const english=t.match(/^\s*[^a-zA-Z]*?\s{2,}([A-Za-z][\s\S]*)$/);if(english)return english[1];
 return t;
}
function azureLocalize(root=document.body){
 document.documentElement.lang=azureLocale;
 $$('[data-azure-language]').forEach(el=>el.value=azureLocale);
 let preview=$('#azure-locale-preview');if(azureLocale==='en'&&!preview){preview=document.createElement('div');preview.id='azure-locale-preview';preview.className='azure-locale-preview';preview.textContent='English UI preview: some detailed guidance remains in Chinese. Customer records stay in their original language.';document.body.append(preview);}else if(azureLocale!=='en')preview?.remove();
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
 for(const n of nodes){const p=n.parentElement;if(!p||p.closest('script,style,textarea,input,svg,[data-azure-language],.batch-text,dd,td,.file-state'))continue;
  if(!n.textContent.trim())continue;
  if(p.tagName==='OPTION'&&!p.hasAttribute('value'))p.value=p.textContent;
  const old=azureTextCache.get(n),original=old&&n.textContent===old.result?old.original:n.textContent,result=azureTranslate(original,!p.closest('.footer,.ktc-panel,.ktc-mobile,.azure-auth-card,.external-v2-steps,.stepper'));
  azureTextCache.set(n,{original,result});if(n.textContent!==result)n.textContent=result;
 }
 root.querySelectorAll?.('input[placeholder],textarea[placeholder]').forEach(el=>{el.dataset.azurePlaceholder??=el.placeholder;el.placeholder=azureTranslate(el.dataset.azurePlaceholder);});
}
document.addEventListener('change',e=>{if(e.target.hasAttribute('data-azure-language')){azureLocale=e.target.value;try{localStorage.setItem('azure-demo-language',azureLocale);}catch{}azureLocalize();}});
new MutationObserver(records=>{if(records.some(r=>r.addedNodes.length))azureLocalize();}).observe(document.body,{childList:true,subtree:true});
setInterval(()=>{if(ktcPending&&Date.now()>ktcPending.expires&&!ktcPending.expiredRendered){ktcPending.expiredRendered=true;if(azureIsKTC())render();}},1000);
Object.assign(window.AllinPayDemo,{version:'2026.10.09-azure-otp-ktc',getRelease:()=>({version:'2026.10.09-azure-otp-ktc',steps:azureStepLabels,locale:azureLocale,otp:'simulated',ktc:'simulated',crossDeviceCallback:'manual-demo-code',ocr:'browser-local'})});

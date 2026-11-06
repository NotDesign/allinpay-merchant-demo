// Browser-local Demo idle session. Production APIs must enforce expiry server-side.
(()=>{
 const external=typeof MT_EXTERNAL!=='undefined'&&MT_EXTERNAL;
 const duration=5*60*1000,warning=30*1000;
 const key='allinpay-idle-session-'+(external?'external':'backoffice')+'-v1';
 const logoutAction=external?'confirm-logout':'bo-logout',baseLogout=actions[logoutAction];
 let identity='',expiresAt=0,alarm=0,countdown=0,lastWrite=0,ending=false,expiredNotice=false,previousFocus=null;
 const who=()=>external?(state.session?state.email:''):(BO.user?.id||'');
 const dialog=()=>document.getElementById('idle-session-dialog');
 function remember(force=false){
  if(!identity||(!force&&Date.now()-lastWrite<1000))return;
  lastWrite=Date.now();try{sessionStorage.setItem(key,JSON.stringify({identity,expiresAt}));}catch{}
 }
 function closeWarning(restore=false){const d=dialog();if(d){d.close();d.remove();}clearInterval(countdown);countdown=0;if(restore&&previousFocus?.isConnected)previousFocus.focus();previousFocus=null;}
 function stop(){clearTimeout(alarm);alarm=0;closeWarning();identity='';expiresAt=0;lastWrite=0;try{sessionStorage.removeItem(key);}catch{}}
 function schedule(){clearTimeout(alarm);if(identity)alarm=setTimeout(check,Math.max(1,expiresAt-Date.now()-(dialog()?0:warning)));}
 function begin(fresh=false){
  const id=who();if(!id){stop();return;}
  identity=id;expiresAt=Date.now()+duration;
  if(!fresh)try{const stored=JSON.parse(sessionStorage.getItem(key)||'null');if(stored?.identity===id&&Number.isFinite(stored.expiresAt)&&stored.expiresAt>0)expiresAt=Math.min(stored.expiresAt,expiresAt);}catch{}
  remember(true);schedule();
 }
 function showWarning(){
  if(dialog())return;
  previousFocus=document.activeElement;
  const d=document.createElement('dialog');d.id='idle-session-dialog';d.className='idle-session-dialog';d.setAttribute('role','alertdialog');d.setAttribute('aria-labelledby','idle-session-title');d.setAttribute('aria-describedby','idle-session-copy');
  d.innerHTML='<div class="idle-session-body"><h2 id="idle-session-title">登入即將逾時</h2><p id="idle-session-copy">你已閒置一段時間，系統即將自動登出。</p><p class="idle-session-count"><strong id="idle-session-seconds"></strong> 秒後登出</p><p class="hint">未儲存的內容不會保留。請選擇「繼續使用」，返回表單儲存草稿。</p></div><div class="idle-session-actions"><button type="button" data-idle-action="logout">立即登出</button><button type="button" class="primary" data-idle-action="continue" autofocus>繼續使用</button></div>';
  d.addEventListener('cancel',e=>e.preventDefault());document.body.append(d);d.showModal();updateCountdown();countdown=setInterval(check,1000);
 }
 function updateCountdown(){const el=document.getElementById('idle-session-seconds');if(el)el.textContent=String(Math.max(0,Math.ceil((expiresAt-Date.now())/1000)));}
 function leave(expired){
  if(ending)return;ending=true;expiredNotice=expired;stop();
  // Close every native overlay so protected content cannot remain above login.
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.getElementById('column-popover')?.remove();
  state.pendingDraft=null;state.registerSeed=null;state.otpExpires=0;state.resendAt=0;state.otpError='';
  if(!external){BO.otpUntil=0;BO.pendingMutation=null;}
  try{baseLogout();}finally{ending=false;render();}
 }
 function check(){
  if(ending)return true;
  const id=who();if(!id){if(identity||expiresAt)stop();return true;}
  if(id!==identity)begin();
  if(Date.now()>=expiresAt){leave(true);return false;}
  if(expiresAt-Date.now()<=warning)showWarning();
  updateCountdown();schedule();return true;
 }
 function activity(e){
  if(!e.isTrusted||!who())return;
  if(!check()){e.preventDefault();e.stopImmediatePropagation();return;}
  if(dialog())return;
  expiresAt=Date.now()+duration;remember();schedule();
 }
 const baseRender=render;
 render=function(...args){
  if(!check())return;
  const result=baseRender.apply(this,args);
  if(expiredNotice&&!who()&&!document.getElementById('idle-session-expired')){
   const form=document.getElementById(external?'auth-form':'bo-auth-form');
   const isLogin=external?route()[0]==='login':route().page==='login';
   if(form&&isLogin){const note=document.createElement('div');note.id='idle-session-expired';note.className='notice warn';note.setAttribute('role','alert');note.textContent='已閒置 5 分鐘，系統已自動登出。請重新登入；已儲存的草稿仍會保留。';form.querySelector('h1,h2')?.after(note);}
  }
  return result;
 };
 actions[logoutAction]=()=>leave(false);
 if(external){const verify=actions.verify;actions.verify=function(...args){const before=who(),result=verify.apply(this,args);if(!before&&who()){expiredNotice=false;begin(true);check();}return result;};}
 else{const login=loginAs;loginAs=function(...args){stop();expiredNotice=false;const result=login.apply(this,args);if(who())begin(true);return result;};}
 for(const type of ['pointerdown','pointermove','click','keydown','input','change','wheel','touchstart','scroll'])window.addEventListener(type,activity,{capture:true,passive:false});
 window.addEventListener('click',e=>{const b=e.target.closest('[data-idle-action]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();if(!check())return;if(b.dataset.idleAction==='logout')leave(false);else{closeWarning(true);expiresAt=Date.now()+duration;remember(true);schedule();}},true);
 for(const type of ['focus','pageshow','hashchange'])window.addEventListener(type,check);
 document.addEventListener('visibilitychange',check);
 window.addEventListener('pagehide',()=>{if(who())remember(true);});
 const style=document.createElement('style');style.textContent='.idle-session-dialog{box-sizing:border-box;width:min(440px,calc(100vw - 32px));max-height:calc(100dvh - 32px);padding:0;border:1px solid var(--line,#dbe2ed);border-radius:8px;color:var(--ink,#242c3a);background:#fff;font:inherit;overflow:auto;box-shadow:0 12px 48px #14254f33}.idle-session-dialog::backdrop{background:#14254f70;backdrop-filter:blur(3px)}.idle-session-body{padding:24px}.idle-session-body h2{margin:0 0 16px;font-size:20px;line-height:1.4}.idle-session-body p{line-height:1.7;margin:12px 0}.idle-session-count{text-align:center;color:var(--brand,#168fc7)}.idle-session-count strong{font-size:40px;margin-right:8px;font-variant-numeric:tabular-nums}.idle-session-actions{display:flex;gap:12px;padding:20px 24px;border-top:1px solid var(--line,#dbe2ed);background:var(--canvas,#f7f8fb)}.idle-session-actions button{flex:1;min-width:0;min-height:44px;padding:10px 12px;margin:0;line-height:22px;text-align:center}.idle-session-actions button.primary{background:var(--brand,#168fc7);color:white;border-color:var(--brand,#168fc7)}#idle-session-expired{margin:16px 0;font-size:14px;line-height:1.7}';document.head.append(style);
 Object.assign(window.AllinPayDemo,{getSessionTimeout:()=>({timeoutMs:duration,warningMs:warning,authenticated:!!who(),expiresAt,remainingMs:Math.max(0,expiresAt-Date.now()),warningOpen:!!dialog()})});
})();

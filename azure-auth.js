/* Shared, explicitly simulated second-factor flow. No credentials leave this browser. */
const azureAuth={stage:null,pending:null,expires:0,error:'',register:false,verified:false};
const azureBackupCodes=['DEMO-4821','DEMO-6039','DEMO-1754','DEMO-9286','DEMO-3107','DEMO-8462'];
function azureQR(text){const qr=qrcode(0,'M');qr.addData(text);qr.make();return qr.createSvgTag({cellSize:4,margin:16,scalable:true});}
function azureStartAuth(pending,register=false){azureAuth.pending=pending;azureAuth.register=register;azureAuth.stage=register?'email':'otp';azureAuth.expires=Date.now()+600000;azureAuth.error='';azureAuth.verified=false;go('azure-'+azureAuth.stage);}
function azureAuthCard(){
 const s=azureAuth.stage,email=AZURE_EXTERNAL?state.email:azureAuth.pending?.email||BO.loginEmail;
 const code=label=>`<label for="azure-code">${label}</label><input id="azure-code" inputmode="${s==='recovery'?'text':'numeric'}" autocomplete="one-time-code" maxlength="${s==='recovery'?16:6}" placeholder="${s==='recovery'?'DEMO-4821':'請輸入 6 位數驗證碼'}" aria-describedby="azure-auth-error">`;
 let body='';
 if(s==='email')body='<h1>驗證電郵地址</h1><p>請核對電郵並輸入示例驗證碼；完成後設定兩步驟驗證。</p><p>'+esc(email)+'</p>'+code('電郵驗證碼')+btn('驗證電郵','azure-auth-check','primary');
 if(s==='setup')body='<h1>綁定驗證器</h1><p>電郵已驗證。此 QR Code 與金鑰只作 Demo 示意，請勿加入真實帳戶。</p><div class="azure-qr">'+azureQR('AZURE DEMO ONLY - NOT A REAL AUTHENTICATOR SECRET')+'</div><p>示例金鑰：JBSW Y3DP EHPK 3PXP</p>'+code('驗證器驗證碼')+'<small>Demo 請輸入 123456，不使用真實驗證器。</small>'+btn('驗證並啟用','azure-auth-check','primary');
 if(s==='otp')body='<h1>兩步驟驗證</h1><p>開啟驗證器，輸入此帳戶的 6 位數驗證碼。</p><p>'+esc(email)+'</p>'+code('驗證器驗證碼')+'<small>Demo 請輸入 123456；此處不驗證真實 TOTP。</small>'+btn('驗證並登入','azure-auth-check','primary')+btn('改用備用碼','azure-auth-recovery');
 if(s==='recovery')body='<h1>使用備用碼</h1><p>每組示例備用碼僅能在本瀏覽器使用一次。</p>'+code('備用碼')+btn('驗證備用碼','azure-auth-check','primary')+btn('返回驗證器','azure-auth-otp');
 if(s==='backup')body='<h1>保存備用碼</h1><p>兩步驟驗證已啟用（Demo）。以下不是正式帳戶憑證。</p><div class="notice warn">請妥善保存備用碼。每組只能使用一次。</div><div class="azure-backup">'+azureBackupCodes.map(c=>'<strong>'+c+'</strong>').join('')+'</div>'+btn('下載備用碼（Demo）','azure-backup-download')+'<label class="check"><input type="checkbox" id="azure-backup-saved">我已保存備用碼</label>'+btn('完成註冊','azure-auth-finish','primary');
 return `<form class="azure-auth-card" id="azure-auth-form">${body}<p class="error" id="azure-auth-error" role="alert">${esc(azureAuth.error)}</p>${btn('返回登入','azure-auth-cancel')}<small>前端 Demo · 電郵、OTP 與帳戶保護皆為模擬。請勿輸入真實密碼。</small></form>`;
}
function azureShowAuth(){
 if(!azureAuth.pending||!azureAuth.stage){azureAuth.stage=null;go('login');return;}
 if(AZURE_EXTERNAL){$('#app').innerHTML=auth('login');$('.auth-form').outerHTML=azureAuthCard();}
 else {$('#app').innerHTML=authPage('login');$('.login-card').outerHTML=azureAuthCard();}
 $('#azure-auth-form').addEventListener('submit',e=>{e.preventDefault();actions[azureAuth.stage==='backup'?'azure-auth-finish':'azure-auth-check']();});
}
function azureFinishAuth(){
 if(!azureAuth.pending||!azureAuth.verified)return;
 const pending=azureAuth.pending,registered=azureAuth.register;azureAuth.stage=null;azureAuth.pending=null;
 if(AZURE_EXTERNAL){state.session=true;state.emailVerified=true;if(state.pendingDraft){const d=state.pendingDraft;state.pendingDraft=null;loadRecord(d);}else if(registered){const seed=state.registerSeed;newApplication();if(seed){state.values.merchantEnglishName=seed.companyEn||'';state.values.contactName=[seed.lastName,seed.firstName].filter(Boolean).join(' ');}state.registerSeed=null;go('form/1');}else go('applications');}
 else {if(registered){pending.status='已啟用';accounts.push(pending);if(!saveAccounts()){accounts.pop();azureAuth.pending=pending;azureAuth.stage='backup';return;}}azureOriginalLogin(pending);}
}
Object.assign(actions,{
 'azure-auth-check':()=>{
  if(!azureAuth.pending)return;
  if(Date.now()>azureAuth.expires){azureAuth.error='驗證工作階段已過期，請返回登入後重試。';render();return;}
  const code=$('#azure-code')?.value.trim().toUpperCase()||'',s=azureAuth.stage;
  if(s==='recovery'){
   const key='azure-demo-used-backup-'+(AZURE_EXTERNAL?state.email:azureAuth.pending.email);let used=[];
   try{used=JSON.parse(localStorage.getItem(key)||'[]');}catch{}
   if(!azureBackupCodes.includes(code)||used.includes(code)){azureAuth.error='備用碼不正確或已使用，請換一組。';render();return;}
   try{localStorage.setItem(key,JSON.stringify([...used,code]));}catch{azureAuth.error='無法保存備用碼使用紀錄，請改用驗證器。';render();return;}
  }else if(code!=='123456'){azureAuth.error='驗證碼不正確，Demo 請輸入 123456。';render();return;}
  azureAuth.error='';
  if(s==='email'){azureAuth.stage='setup';go('azure-setup');}
  else if(s==='setup'){azureAuth.verified=true;azureAuth.stage='backup';go('azure-backup');}
  else {azureAuth.verified=true;azureFinishAuth();}
 },
 'azure-auth-recovery':()=>{azureAuth.stage='recovery';azureAuth.error='';go('azure-recovery');},
 'azure-auth-otp':()=>{azureAuth.stage='otp';azureAuth.error='';go('azure-otp');},
 'azure-auth-cancel':()=>{Object.assign(azureAuth,{pending:null,stage:null,error:'',verified:false});go('login');},
 'azure-auth-finish':()=>{if(!$('#azure-backup-saved')?.checked){azureAuth.error='請先保存備用碼並勾選確認。';render();return;}azureFinishAuth();},
 'azure-backup-download':()=>{const url=URL.createObjectURL(new Blob(['Azure DEMO ONLY\n'+azureBackupCodes.join('\n')],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download='Azure-Demo-backup-codes.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
});
let azureOriginalLogin;
if(!AZURE_EXTERNAL){
 azureOriginalLogin=loginAs;
 loginAs=function(a){if(!a||a.status!=='已啟用')return azureOriginalLogin(a);BO.user=null;azureStartAuth(a);};
 actions['bo-register']=()=>{const n=$('#reg-name').value.trim(),email=$('#login-email').value.trim().toLowerCase(),p=$('#reg-password').value;
  if(!n||!/^\S+@\S+\.\S+$/.test(email)||p.length<8||!/[A-Za-z]/.test(p)||!/\d/.test(p)||p!==$('#reg-confirm').value||!$('#reg-terms').checked){BO.authError='請填妥資料、至少 8 位英數密碼、相同確認密碼及條款。';render();return;}
  if(accounts.some(a=>a.email.toLowerCase()===email)){BO.authError='示例帳號已存在。';render();return;}
  BO.loginEmail=email;BO.authError='';azureStartAuth({id:'ACC-'+Date.now(),name:n,email,role:roles[3],agency:'—',last:'—',permissions:rolePermissions(roles[3]),scope:'本人及獲指派的商戶'},true);
 };
 actions['security-settings']=()=>modal('登入安全設定','<p>本 Demo 已包含註冊電郵驗證、驗證器綁定、登入 OTP 與一次性備用碼演示。</p><div class="notice warn">純前端流程不提供正式安全防護；正式環境須由伺服器驗證 TOTP、管理憑證及限制重試。</div>');
}else{
 actions.verify=()=>{const code=$$('[data-otp]').map(i=>i.value).join('');if(Date.now()>state.otpExpires||code!=='123456'){state.otpError='驗證碼不正確或已過期，請重新發送。';render();return;}azureStartAuth({email:state.email},!!state.registerSeed);if(state.registerSeed){azureAuth.stage='setup';go('azure-setup');}};
}

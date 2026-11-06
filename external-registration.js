// External account registration is browser-local Demo state, independent of
// merchant applications. A verified registration exists even before draft save.
const ER_KEY='allinpay-external-registrations-v1';
const erEmail=value=>String(value||'').normalize('NFKC').trim().toLowerCase();
const erName=value=>String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const erPage=()=>route()[0]||'login';
const erQuery=new URLSearchParams(location.search);
const erInvited=erQuery.has('inviter')||erQuery.has('agency');
const erCode=value=>/^[A-Za-z0-9_-]{1,100}$/.test(value||'')?value:'';
const erInvitation={inviter:erCode(erQuery.get('inviter')),agency:erCode(erQuery.get('agency'))};
let erLoginProfile=null;
function erReadList(key){
 const raw=localStorage.getItem(key);if(!raw)return [];
 const list=JSON.parse(raw);if(!Array.isArray(list))throw Error('Invalid local record');
 return list.filter(x=>x&&typeof x==='object'&&!Array.isArray(x));
}
function erRecords(){
 const byId=new Map();for(const r of [...state.records,...erReadList(KEY)])if(r.id)byId.set(r.id,r);
 return [...byId.values()];
}
function erCompanyNames(record){const v=record.values||{};return [record.company,record.companyEn,v.merchantName,v.merchantEnglishName,v.companyZh,v.companyEn].map(erName).filter(Boolean);}
function erCountry(value){return ({HKG:regions[0],CHN:regions[1],MAC:regions[2],TWN:regions[3],SGP:regions[4],GBR:regions[5],USA:regions[6]})[value]||String(value||'');}
function erFind(profile){
 const email=erEmail(profile.email),company=erName(profile.companyEn),country=erCountry(profile.country);
 const entities=[...erReadList(ER_KEY),...erRecords()];
 if(email&&entities.some(r=>erEmail(r.email)===email))return 'email';
 if(company&&entities.some(r=>{const other=erCountry(r.country||r.values?.registerCountry||r.values?.country);return erCompanyNames(r).includes(company)&&(!country||!other||country===other);}))return 'company';
 return '';
}
function erProfile(){return {email:erEmail(state.values.authEmail),companyEn:String(state.values.registerCompany||'').trim(),country:String(state.values.registerCountry||'').trim(),lastName:String(state.values.registerLast||'').trim(),firstName:String(state.values.registerFirst||'').trim()};}
function erStorageError(){modal('註冊暫時未能完成','<div class="notice error" role="alert">暫時未能讀取或儲存帳戶資料，請稍後重試。已填資料會保留。</div>',btn('返回重試','close','primary'));}
function erDuplicate(profile){
 erLoginProfile={...profile};state.registerSeed=null;state.otpExpires=0;state.otpError='';state.session=false;
 modal('商戶已註冊','<div class="notice warn" role="alert"><strong>該商戶已經註冊過，請重新登入。</strong><p>請使用原註冊電郵登入，完成驗證後再繼續填寫商戶申請資料。</p></div>',btn('返回修改','close')+btn('前往登入','er-existing-login','primary'));
}
function erApplyProfile(profile){
 if(!profile)return;
 if(profile.companyEn){if(/[\u3400-\u9fff]/.test(profile.companyEn)){state.values.merchantName=profile.companyEn;state.values.merchantEnglishName='';}else state.values.merchantEnglishName=profile.companyEn;}
 if(profile.lastName||profile.firstName)state.values.contactName=[profile.lastName,profile.firstName].filter(Boolean).join(' ');
 state.values.contactEmail=state.email;
}
function erAttachInvitation(){
 if(!erInvited||state.values.__externalInvitation)return;
 state.values.__externalInvitation={...erInvitation};
 state.values.referrer=erInvitation.agency||erInvitation.inviter||state.values.referrer||'';
}
function erContinue(profile,pending,registered){
 if(!state.session||pending||!erInvited)return;
 if(registered){erApplyProfile(profile);erAttachInvitation();go('application/1');return;}
 let records;try{records=erRecords();}catch{records=state.records;}
 state.records=records;
 const owned=records.filter(r=>erEmail(r.email)===state.email),company=erName(profile?.companyEn);
 const matching=company?owned.filter(r=>erCompanyNames(r).includes(company)):owned;
 const drafts=matching.filter(r=>r.status==='草稿');
 if(drafts.length===1){loadRecord(drafts[0]);erAttachInvitation();render();toast('已登入，繼續填寫已儲存的草稿');return;}
 if(matching.length){go('applications');toast(drafts.length?'請選擇要繼續填寫的草稿':'已登入，可查看申請或新增申請');return;}
 newApplication();erApplyProfile(profile);erAttachInvitation();go('application/1');
}
const erAuth=auth;
auth=function(page){
 let html=erAuth(page);
 if(page==='register'){
  html=html.replace('<h2>商戶註冊</h2>','<h2>商戶註冊</h2><p class="center hint">先註冊帳戶，再填寫商戶申請資料。已註冊商戶請先登入。</p>');
  if(erInvited&&(erInvitation.agency||erInvitation.inviter))html=html.replace(/(<input\b[^>]*id="referrer"[^>]*)(>)/,'$1 readonly$2');
 }
 return html;
};
const erRegister=actions.register,erLogin=actions.login,erVerify=actions.verify;
actions.register=()=>{
 for(const k of ['authEmail','registerCompany','registerLast','registerFirst'])state.values[k]=String(state.values[k]||'').trim();
 state.values.authEmail=erEmail(state.values.authEmail);const profile=erProfile();
 try{if(erFind(profile))return erDuplicate(profile);}catch{return erStorageError();}
 erLoginProfile=null;erRegister();
 if(state.registerSeed)state.registerSeed={...state.registerSeed,email:profile.email,country:profile.country};
};
actions.login=()=>{
 state.registerSeed=null;state.values.authEmail=erEmail(state.values.authEmail);erLogin();
};
actions['er-existing-login']=()=>{
 const email=erLoginProfile?.email||erEmail(state.values.authEmail);
 state.session=false;state.registerSeed=null;state.pendingDraft=null;state.email='';state.values.authEmail=email;go('login');
};
actions.verify=()=>{
 const seed=state.registerSeed&&{...state.registerSeed},pending=!!state.pendingDraft;
 const valid=$$('[data-otp]').map(i=>i.value).join('')==='123456'&&Date.now()<=state.otpExpires;
 if(seed&&valid){
  const profile={...seed,email:erEmail(state.email)};
  try{
   if(erFind(profile))return erDuplicate(profile);
   const next=[...erReadList(ER_KEY),{id:crypto.randomUUID(),...profile,company:profile.companyEn,createdAt:new Date().toISOString()}];
   localStorage.setItem(ER_KEY,JSON.stringify(next));
  }catch{return erStorageError();}
 }
 erVerify();if(!state.session)return;
 if(seed){erApplyProfile(seed);erAttachInvitation();render();}
 erContinue(seed||erLoginProfile,pending,!!seed);erLoginProfile=null;
};
// A new invitation, including an older direct-form URL, starts at registration.
// Login/retrieve links remain navigable once the landing page has been shown.
if(erInvited){
 state.values.referrer=erInvitation.agency||erInvitation.inviter||'';
 if(!['register','verify','retrieve'].includes(erPage()))history.replaceState(null,'',location.pathname+location.search+'#/register');
}
document.addEventListener('click',e=>{
 if(e.target.closest('a[href="#/login"]')&&erPage()==='register')erLoginProfile=erProfile();
},true);

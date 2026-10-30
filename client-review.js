// Customer review, October 30: base rates are local Demo configuration, not live pricing.
const BF_KEY='allinpay-base-fees-20261030-v1';
function bfRead(){try{return JSON.parse(localStorage.getItem(BF_KEY))||{rates:{},revision:0};}catch{return {rates:{},revision:0};}}
function bfCanEdit(){return !MT_EXTERNAL&&!!BO.user&&[roles[0],roles[1]].includes(BO.user.role)&&can(10);}
function bfClean(rates){const clean={};for(const [key,st] of Object.entries(rates||{})){const def=MW.products.find(p=>p.key===key);if(!def)continue;const values={};for(const [field,value] of Object.entries(st.v||{})){if(/_(rate|fix|min|max|markup)$/.test(field)){const n=Number(value);if(value!==''&&(!Number.isFinite(n)||n<0||(/_(rate|markup)$/.test(field)&&n>100)))throw Error(def.label+'：費率須為 0–100，其他金額不得小於 0');values[field]=value===''?'0.00':String(value);}else values[field]=value;}clean[key]={ct:st.ct||def.r.ct||null,v:values};}return clean;}
// Defaults change values only. The platform product catalog, fields and choices remain unchanged.
function bfSeed(){state.baseFeeDefaults=structuredClone(bfRead().rates||{});delete state.values.__baseFees;delete state.values.__copiedFrom;}
const bfReset=v2Reset;v2Reset=function(){bfReset();bfSeed();};
const bfOriginalGroup=v2SetGroup;v2SetGroup=function(key,on){const previous=new Set(Object.keys(v2Model().rates));bfOriginalGroup(key,on);if(!on||!state.baseFeeDefaults||v2Model().legacy||state.editing||state.draftId||(MT_EXTERNAL&&state.id))return;for(const [id,st] of Object.entries(v2Model().rates))if(!previous.has(id)&&state.baseFeeDefaults[id]){st.ct=state.baseFeeDefaults[id].ct||st.ct;st.v=structuredClone(state.baseFeeDefaults[id].v||{});}};
if(!Object.keys(v2Model().rates).length&&!v2Raw('merchantName'))bfSeed();
if(!MT_EXTERNAL){const settings=actions.settings;actions.settings=()=>{settings();if(bfCanEdit())$('#modal .modal-foot')?.insertAdjacentHTML('afterbegin',btn('基礎費率設定','bf-open'));};}
// Keep raw files per application in this tab only. Saved storage holds metadata only.
const clientFileRecords=new Map();
function clientRememberFiles(key,files=state.files){clientBindFiles();const originals={};for(const [id,meta] of Object.entries(files)){const source=DEMO.sourceFiles?.get(id);if(source?.file&&source.fileToken&&source.fileToken===state.files[id]?.localFileToken&&source.file.name===meta.name&&source.file.size===meta.size&&!meta.needsReselect)originals[id]={file:source.file,token:source.fileToken};}clientFileRecords.set(key,originals);}
function clientFilesFor(key,metadata){const found=clientFileRecords.get(key)||{};return Object.fromEntries(Object.entries(found).filter(([id,entry])=>metadata[id]?.localFileToken===entry.token&&metadata[id]?.name===entry.file.name&&metadata[id]?.size===entry.file.size).map(([id,entry])=>[id,entry.file]));}
function clientBindFiles(){
 const keys=MT_EXTERNAL?['record:'+state.id]:['row:'+state.editing,'draft:'+state.draftId,'draft:'+rows.find(r=>rowKey(r)===state.editing)?.application?.id];
 for(const [id,meta] of Object.entries(state.files||{})){
  if(meta.demo)continue;const active=DEMO.sourceFiles?.get(id);
  if(active?.file&&!active.fileToken&&active.file.name===meta.name&&active.file.size===meta.size&&!meta.needsReselect){active.fileToken=crypto.randomUUID();meta.localFileToken=active.fileToken;}
  if(active?.fileToken&&active.fileToken===meta.localFileToken){meta.needsReselect=false;continue;}
  const file=keys.map(key=>clientFilesFor(key,state.files)[id]).find(Boolean);
  if(file){const url=URL.createObjectURL(file);DEMO.fileURLs.set(id,url);DEMO.sourceFiles.set(id,{file,url,fileToken:meta.localFileToken});meta.needsReselect=false;}
  else{meta.needsReselect=true;DEMO.fileURLs.delete(id);}
 }
}
const clientFileRender=render;render=function(){clientBindFiles();return clientFileRender();};
if(MT_EXTERNAL){const old=snapshot;snapshot=function(status){clientBindFiles();const result=old(status);clientRememberFiles('record:'+result.id,result.files);return result;};}
else{const old=draftSnapshot;draftSnapshot=function(id){clientBindFiles();const result=old(id);clientRememberFiles('draft:'+result.id,result.files);if(state.editing)clientRememberFiles('row:'+state.editing,result.files);return result;};}
if(!MT_EXTERNAL){
 function clientReviewFile(r,index=IR.doc){const code=irDocTypes[index][1],meta=r.application?.files||{},doc=V2.documents.find(d=>d.code===code||d.id===code||d.name.includes(code)),id=doc?.id||Object.keys(meta).find(k=>k.includes(code));const raw=clientFilesFor('row:'+rowKey(r),meta)[id]||clientFilesFor('draft:'+r.application?.id,meta)[id];return {meta:meta[id],raw,id,blocked:!!raw&&['140401','141301'].includes(code)&&!can(5)};}
 const originalDocument=irDocument,previewURLs=new WeakMap();irDocument=function(r,index=IR.doc){const f=clientReviewFile(r,index);if(f.blocked)return '<div class="notice warn">查看銀行文件原件需要完整銀行帳號權限。</div>';if(f.raw){let url=previewURLs.get(f.raw);if(!url){url=URL.createObjectURL(f.raw);previewURLs.set(f.raw,url);}return `<p class="hint">上傳原文件 · ${esc(f.raw.name)}</p>${/\.pdf$/i.test(f.raw.name)?`<iframe class="br-pdf-preview" src="${esc(url)}" title="${esc(f.raw.name)}"></iframe>`:`<img class="document-preview" src="${esc(url)}" alt="${esc(f.raw.name)}">`}`;}if(f.meta&&!f.meta.demo)return '<div class="notice warn">原文件未保留，請重新上傳後查看或下載。</div>';return originalDocument(r,index);};
 const docs=irDocuments;irDocuments=function(r){const f=clientReviewFile(r);return docs(r).replace(btn('放大預覽','ir-zoom'),`<div class="ir-download-tools">${btn('放大預覽','ir-zoom')}${btn(f.raw?'下載原文件':f.meta&&!f.meta.demo?'下載文件（需重新上傳）':'下載示例文件','ir-download','',f.blocked?'disabled':'')}<small>${f.raw?'原文件只保留在此瀏覽器分頁':f.meta&&!f.meta.demo?'原件未保留，請先重新上傳':'示例內容供操作展示，並非商戶原文件'}</small></div>`);};
 actions['ir-download']=()=>{const r=irCurrent();if(!r||!can(7))return deny();const f=clientReviewFile(r);if(f.blocked)return deny();if(f.meta&&!f.meta.demo&&!f.raw)return modal('原文件未保留','<p>目前只有文件記錄。請重新上傳原文件後再下載。</p>');const label=irDocTypes[IR.doc][0],blob=f.raw||new Blob(['<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>'+esc(label)+' · Demo 示例</title><style>body{font:16px sans-serif;padding:32px;line-height:1.7}article{max-width:900px}table{border-collapse:collapse}td,th{border:1px solid #ccd;padding:12px}</style><h1>Demo 示例文件</h1><p>此文件為模擬資料，並非上傳原件。</p>'+irDocument(r)+'</html>'],{type:'text/html;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=f.raw?.name||('Demo-'+r['客戶中文名稱']+'-'+label).replace(/[\\/:*?"<>|]/g,'_')+'.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);};
}
Object.assign(window.AllinPayDemo,{clientReviewFeatures:true,getBaseFeeState:()=>({revision:bfRead().revision||0,rates:structuredClone(bfRead().rates||{}),canEdit:bfCanEdit()})});
if(MT_EXTERNAL){const verifyInvitation=actions.verify;let invitationEntered=false;actions.verify=()=>{const pending=!!state.pendingDraft,registration=!!state.registerSeed;verifyInvitation();const query=new URLSearchParams(location.search);if(state.session&&!pending&&!invitationEntered&&(query.has('inviter')||query.has('agency'))){invitationEntered=true;if(!registration)newApplication();go('application/1');}};}

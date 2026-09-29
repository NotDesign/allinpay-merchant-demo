// Reuse the exact backend schema/renderer/validators inside the existing External shell.
const steps=['文件材料','主體資料','經營與聯繫','結算帳戶','產品與費率','確認提交'];
names.splice(0,names.length,...steps);
const DEMO={br:null,fileURLs:new Map()},BO={user:null},rows=[{'客戶中文名稱':'海港科技有限公司（示例）','客戶英文名稱':'SAMPLE HARBOUR LIMITED'}];
let defaults=()=>{},requiredFiles=()=>[],validateStep=()=>({}),productChecks=()=>[],fillSample=()=>{},brStart=()=>{},brReview=()=>{},brResult=()=>{};
const can=()=>true,deny=()=>{},mask=v=>String(v||''),labelHTML=v=>esc(v).replaceAll('\n','<br>');
const pill=(v,c='')=>`<span class="status ${c}">${esc(v)}</span>`;
const check=x=>`<label class="check"><input type="checkbox" data-check="${x.id}" ${state.checks[x.id]?'checked':''}>${esc(x.label)}</label>`;
const demoBar=()=>`<div class="demo"><div class="demo-controls"><span>DEMO · 文件在本機辨識，其他業務流程為示例</span>${btn('填入完整示例','sample')}${btn('清空表單','clear-form')}<label><input type="checkbox" id="simulate-failure" ${state.fail?'checked':''}>模擬提交失敗</label></div></div>`;
const oldExternalRoute=route;
route=function(){const r=oldExternalRoute();r.page=r[0]==='form'?'application':r[0];r.step=Math.max(1,Math.min(6,+r[1]||1));return r;};
const oldExternalGo=go;
go=function(p){oldExternalGo(p.replace(/^application\//,'form/'));};
function showErrors(errors,step){state.errors={...errors,_form:'請檢查標示欄位；也可先儲存草稿後補充。'};state.step=step;if(location.hash==='#/form/'+step)render();else location.hash='/form/'+step;}
state.checks={};state.emailVerified=false;state.fail=false;state.people={directors:1,authSigners:0,shareHolders:0};
window.AllinPayDemo={};
actions.restore=()=>{};actions['confirm-edit']=()=>{};actions['br-start']=()=>{};
let uploadRow=d=>{const f=state.files[d.id];return `<div class="upload-row" data-upload-row="${d.id}"><div class="upload-heading"><strong>${labelHTML(d.name)}</strong>${pill(f?'已選取':'選填',f?'green':'gray')}</div><p class="hint">${esc(d.hint)}</p><div class="file-state">${f?esc(f.name)+(f.needsReselect?' · 請重新選取':''):'尚未選擇文件'}</div><div class="upload-actions">${f?btn('預覽','preview-demo-file','',`data-id="${d.id}"`)+btn('移除','document-remove-file','danger',`data-id="${d.id}"`):''}${btn('選擇文件','demo-upload','',`data-id="${d.id}"`)}<input hidden type="file" data-demo-upload="${d.id}" accept=".pdf,.jpg,.jpeg,.png,.zip"></div></div>`;};
actions['demo-upload']=el=>$(`[data-demo-upload="${el.dataset.id}"]`).click();
actions['preview-demo-file']=el=>{const f=state.files[el.dataset.id],url=DEMO.fileURLs.get(el.dataset.id);modal('文件預覽',url&&/\.(png|jpe?g)$/i.test(f.name)?`<img class="batch-preview" alt="文件預覽" src="${url}">`:`<p>${esc(f?.name||'未選取')} · ${f?.demo?'示例附件':'請重新選取以預覽'}</p>`);};
actions['document-remove-file']=el=>{const url=DEMO.fileURLs.get(el.dataset.id);if(url)URL.revokeObjectURL(url);DEMO.fileURLs.delete(el.dataset.id);delete state.files[el.dataset.id];render();};

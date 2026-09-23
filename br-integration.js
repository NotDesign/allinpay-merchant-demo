// BR is part of the backoffice. Original documents and raw OCR stay in memory.
// No upload API, external OCR, or automatic persistence of review candidates.
let brModules;
const brDefs = [
  ['businessNameZh','中文名稱','merchantName',2],
  ['businessNameEn','英文名稱','merchantEnglishName',2],
  ['brNumber','BR 號碼及分支碼','registerCertNo',2],
  ['expiryDate','註冊證書有效期','registerCertPeriod',2],
  ['legalStatus','法律地位','legalStatus',2],
  ['businessAddressZh','中文地址','addrStreet',3],
  ['businessAddressEn','英文地址','addrStreetEn',3],
  ['natureOfBusiness','業務性質','remark',3],
];
const brTargets = {businessNameEn:['merchantEnglishName','registerCertName'],brNumber:['registerCertNo','registerCertType']};
const brLabels = Object.fromEntries(brDefs.map(([,label,target])=>[target,label]));
Object.assign(brLabels,{registerCertName:'註冊證書名稱',registerCertType:'註冊證書類型',remark:'備註（BR 業務性質）'});
const brAlive = b => DEMO.br === b && !b.disposed;
async function brLoadModules(){
  if(location.protocol==='file:')throw Error('本機檔案辨識需要 HTTP 服務。請開啟同一後台的 GitHub 網址，或以 npm run serve 啟動下載的完整原始碼。單一 HTML 仍可使用示範資料。');
  if(!brModules)brModules=Promise.all([import('./br-engine/engine.mjs'),import('./br-engine/parser.mjs')]).catch(e=>{brModules=null;throw e;});
  return brModules;
}
function brRelease(b=DEMO.br){
  if(!b||b.disposed)return;b.disposed=true;b.controller?.abort();clearTimeout(b.timer);
  if(b.page)b.page.canvas.width=1;
  Promise.resolve(b.document?.destroy()).catch(()=>{});
  b.document=null;b.page=null;b.file=null;b.result=null;b.fields={};b.rawText='';
}
function brModal(title,body,buttons,kind='review'){
  modal(title,body,buttons);$('#modal').classList.add('br-dialog');$('#modal').dataset.br=kind;
}
function brUpload(error=''){
  const b=DEMO.br;if(!brAlive(b))return;b.phase='upload';
  brModal('匯入香港商業登記證',`<p class="hint">選擇文件後，先確認 BR 所在頁面，再開始辨識。</p>${error?`<p class="notice error" role="alert">${esc(error)}</p>`:''}<section class="br-drop" id="br-drop"><h3>拖曳 BR 到這裡，或選擇本機檔案</h3><p>PDF、JPG、PNG · 每檔最多 10 MB／PDF 最多 5 頁</p><label class="br-file-label" for="demo-br-file">選擇檔案</label><input id="demo-br-file" type="file" accept=".pdf,.jpg,.jpeg,.png" class="br-file-input"><p class="hint">文件只在此瀏覽器處理，不會傳送至外部辨識服務。</p></section>${b.document?`<div class="br-file-summary"><strong>${esc(b.filename)}</strong><label>BR 頁面 <select id="br-page" aria-label="選擇 BR 頁面">${Array.from({length:b.document.pages},(_,i)=>`<option value="${i+1}" ${b.pageNumber===i+1?'selected':''}>第 ${i+1} 頁／共 ${b.document.pages} 頁</option>`).join('')}</select></label><span>${(b.file.size/1024/1024).toFixed(2)} MB</span></div><div id="br-upload-preview" class="br-upload-preview"></div>`:'<p class="hint">未準備文件時，可使用虛構示範資料查看完整流程。</p>'}<p class="hint br-privacy">首次圖片辨識會下載本網站的辨識模型，可能需要較長時間。辨識原文不會存入草稿；按「儲存草稿」才會把已填表單欄位保存在此瀏覽器。</p>`,btn('取消','close')+(b.document?btn('開始辨識','br-recognize','primary'):btn('使用示範資料','br-recognize','primary')),'upload');
  if(b.page){const c=b.page.canvas.cloneNode();c.getContext('2d').drawImage(b.page.canvas,0,0);c.setAttribute('aria-label','所選 BR 原件預覽');$('#br-upload-preview').append(c);}
}
brStart=function(){brRelease();DEMO.br={phase:'upload',disposed:false,fields:{},selected:new Set(),choices:{},filename:'',pageNumber:1,confirmed:false,applied:false};brUpload();};
async function brAccept(file){
  const b=DEMO.br;if(!brAlive(b)||b.phase==='loading'||b.phase==='processing')return;
  if(!file)return;b.phase='loading';b.controller=new AbortController();const source=b.controller;
  brModal('正在開啟 BR',`<div class="progress-demo"></div><p>正在本機讀取 ${esc(file.name)}…</p>`,btn('取消','close'),'progress');
  try{
    const [engine]=await brLoadModules();if(!brAlive(b)||source.signal.aborted)return;
    const opened=await engine.loadDocument(file);if(!brAlive(b)||source.signal.aborted){await opened.destroy();return;}
    if(b.page)b.page.canvas.width=1;await b.document?.destroy();b.document=opened;b.file=file;b.filename=file.name;b.pageNumber=1;b.fields={};b.result=null;b.selected.clear();b.choices={};b.demo=false;
    const page=await opened.render(1);if(!brAlive(b)){page.canvas.width=1;return;}b.page=page;b.controller=null;brUpload();
  }catch(e){if(brAlive(b))brUpload(e.message||'文件無法開啟，請重新選擇。');}
}
async function brPage(number){
  const b=DEMO.br;if(!brAlive(b)||b.phase!=='upload')return;b.phase='loading';$('#br-page').disabled=true;$('#modal [data-action=br-recognize]').disabled=true;
  try{const page=await b.document.render(number);if(!brAlive(b)){page.canvas.width=1;return;}if(b.page)b.page.canvas.width=1;b.page=page;b.pageNumber=number;b.result=null;b.fields={};b.selected.clear();b.choices={};brUpload();}
  catch(e){if(brAlive(b))brUpload('此頁無法讀取，請重新選擇文件。');}
}
function brDemo(){
  const b=DEMO.br;b.demo=true;b.filename='SAMPLE-BR（虛構資料）';b.fields=Object.fromEntries(brDefs.map(([key])=>[key,{value:'',source:'虛構示例',page:1}]));
  const values={businessNameZh:'示例海港科技有限公司',businessNameEn:'SAMPLE HARBOUR TECHNOLOGY LIMITED',brNumber:'12345678-000',expiryDate:'2028-08-31',legalStatus:'法人團體 · Body Corporate',businessAddressEn:'UNIT 1201, 12/F, 88 EXAMPLE ROAD, HONG KONG',natureOfBusiness:'TECHNOLOGY SERVICES'};
  for(const [k,v]of Object.entries(values))b.fields[k].value=v;
  b.fields.businessAddressEn.warning='示例低信心地址，請對照原件核對。';b.fields.businessAddressEn.autoSelect=false;
  b.result={recognized:true,warnings:[],method:'demo'};b.selected=new Set(brDefs.filter(([k])=>values[k]&&b.fields[k].autoSelect!==false).map(([k])=>k));b.choices={};brReview();
}
async function brRecognize(){
  const b=DEMO.br;if(!brAlive(b))return;if(!b.document)return brDemo();if(!b.page||b.phase!=='upload')return;
  b.phase='processing';b.confirmed=false;b.controller=new AbortController();const controller=b.controller;
  brModal('正在辨識你的 BR',`<p>${esc(b.filename)} · 第 ${b.pageNumber} 頁</p><section class="br-progress"><h3 id="br-progress-label">載入本機辨識引擎</h3><progress id="br-progress" max="1" value="0"></progress><p>校正文件方向、讀取文字並整理可預填欄位。</p></section><p class="hint">原件與辨識原文只留在本頁；你可以隨時取消。</p>`,btn('取消辨識','br-cancel'),'progress');
  b.timer=setTimeout(()=>{if(brAlive(b)&&b.phase==='processing'){b.timedOut=true;controller.abort();}},120000);
  try{
    const [engine]=await brLoadModules();const result=await engine.recognizeDocument({...b.page,page:b.pageNumber,signal:controller.signal,onProgress:({progress,label})=>{if(brAlive(b)&&b.phase==='processing'){$('#br-progress').value=progress;$('#br-progress-label').textContent=label;}}});
    if(!brAlive(b)||controller.signal.aborted)return;b.result=result;b.fields=result.fields;b.selected=new Set(brDefs.filter(([k])=>result.recognized&&b.fields[k]?.value&&b.fields[k].autoSelect!==false).map(([k])=>k));b.choices={};b.demo=false;
    if(!brDefs.some(([k])=>b.fields[k]?.value))brModal('暫時無法辨識這份 BR','<div class="notice warn">未找到可預填欄位。請使用較清晰、完整的文件，或手動填寫。</div>',btn('手動填寫','close')+btn('重新選檔','br-start','primary'),'failure');else brReview();
  }catch(e){if(brAlive(b))brUpload(controller.signal.aborted?(b.timedOut?'辨識超過 120 秒，已停止。可換一份較清晰的文件，或手動填寫。':'已取消辨識，尚未更改申請資料。'):'本機辨識未完成。請重試或改用較清晰的文件。');}
  finally{clearTimeout(b.timer);b.controller=null;b.timedOut=false;}
}
function brValue(key,b=DEMO.br){return String(b.fields[key]?.value||'').trim();}
function brPlan(b=DEMO.br){
  const planned=[];for(const [key,,target,step]of brDefs){if(!b.selected.has(key)||!brValue(key,b))continue;
    for(const to of brTargets[key]||[target]){const value=to==='registerCertType'?'01':v2Canonical(to,brValue(key,b)),before=v2Raw(to);planned.push({key,target:to,value,before,step,label:brLabels[to],conflict:!!before&&before!==value,same:before===value,write:!before||before!==value&&b.choices[to]==='replace'});}}
  return planned;
}
function brInvalidate(){const b=DEMO.br;if(!b)return;b.confirmed=false;const c=$('#br-checked');if(c)c.checked=false;const submit=$('[data-action="br-ready"]');if(submit)submit.disabled=true;}
brReview=function(ready=false){
  const b=DEMO.br;if(!brAlive(b))return;b.phase=ready?'ready':'review';b.confirmed=ready;
  const plans=brPlan(b);const warnings=b.result?.warnings||[];
  const rows=brDefs.map(([key,label,target,step])=>{const d=b.fields[key]||{value:''},candidate=brValue(key),targets=brTargets[key]||[target];
    const conflicts=targets.map(to=>{const val=to==='registerCertType'?'01':v2Canonical(to,candidate),before=v2Raw(to);return candidate&&before&&before!==val?`<div class="br-conflict"><small>目前${esc(brLabels[to])}：${esc(v2Display(to,before))}</small><label>套用方式<select aria-label="${esc(brLabels[to])}衝突處理" data-br-conflict="${to}" ${ready?'disabled':''}><option value="keep" ${b.choices[to]!=='replace'?'selected':''}>保留原有資料</option><option value="replace" ${b.choices[to]==='replace'?'selected':''}>使用本次核對值</option></select></label></div>`:'';}).join('');
    return `<section class="br-candidate ${d.warning||d.autoSelect===false?'attention':''}"><label class="check"><input type="checkbox" data-br-select="${key}" aria-label="帶入${esc(label)}" ${b.selected.has(key)?'checked':''} ${ready?'disabled':''}><strong>${esc(label)}</strong><span>${!candidate?'未辨識':d.warning||d.autoSelect===false?'待核對':'待確認'}</span></label><label class="sr-only" for="br-${key}">${esc(label)}辨識值</label><input id="br-${key}" data-br-value="${key}" value="${esc(candidate)}" ${ready?'readonly':''} autocomplete="off" spellcheck="false"><small>帶入：Step ${step} · ${targets.map(t=>esc(brLabels[t])).join('、')}</small>${d.warning?`<p class="hint">${esc(d.warning)}</p>`:''}${d.alternatives?.length?`<p class="hint">候選：${d.alternatives.map(esc).join('／')}</p>`:''}${!b.demo&&d.source?`<details><summary>查看來源文字 · 第 ${d.page||b.pageNumber} 頁</summary><p>${esc(d.source)}</p></details>`:''}${conflicts}<p class="error" data-br-error="${key}" role="alert"></p></section>`;
  }).join('');
  brModal(ready?'已核對，準備套用':'核對辨識結果',`<p class="hint">對照原件核對資料，再帶入其他步驟。向下捲動查看所有欄位；不確定的資料先留空。</p>${b.demo?'<div class="notice warn">目前使用虛構示範資料，並未讀取文件。</div>':`<div class="notice ${warnings.length?'warn':''}">${warnings.length?warnings.map(w=>esc(w)).join('<br>'):'辨識完成。所有候選欄位均需對照原件核對。'}</div>`}<div class="br-workbench"><aside class="br-original"><h3>原件預覽</h3><p>${esc(b.filename)} · 第 ${b.pageNumber} 頁</p><div id="br-original-canvas"></div>${b.demo?'<div class="br-synthetic"><h3>商業登記證</h3><p>BUSINESS REGISTRATION CERTIFICATE</p><p>示例海港科技有限公司<br>SAMPLE HARBOUR TECHNOLOGY LIMITED</p><p>12345678-000</p><p>僅供介面演示 · 非真實文件</p></div>':''}<p class="hint">文件只留在本機。OCR 信心分數不代表實際辨識正確率。</p></aside><div class="br-candidates">${rows}${b.fields.certificateNumber?.value||b.fields.startDate?.value?`<div class="notice"><strong>只供核對，不自動帶入</strong><p>完整證書號碼：${esc(b.fields.certificateNumber?.value||'未辨識')}<br>本張 BR 生效日期：${esc(b.fields.startDate?.value||'未辨識')}</p><small>生效日期不是公司成立日期；不推算經營年限。</small></div>`:''}</div></div><section class="br-confirm"><p>預設只填空欄；有差異的欄位須逐項選擇保留或取代。</p>${ready?`<p class="br-status">已核對 · ${plans.filter(p=>p.write).length} 個欄位將寫入 · ${plans.filter(p=>!p.write).length} 個保留原值</p>`:'<label class="check"><input type="checkbox" id="br-checked">我已對照原件，核對勾選欄位及取代選項。</label>'}<p id="br-error" class="error" role="alert"></p></section>`,btn('取消，保留原資料','close')+(ready?btn('返回核對','br-return'):'')+btn(ready?'確認並套用':'已核對，準備套用',ready?'br-apply':'br-ready','primary',ready?'':'disabled'));
  if(b.page){const c=document.createElement('canvas');c.width=b.page.canvas.width;c.height=b.page.canvas.height;c.getContext('2d').drawImage(b.page.canvas,0,0);c.setAttribute('aria-label','BR 原件');$('#br-original-canvas').append(c);}
};
async function brReady(){
  const b=DEMO.br;if(!brAlive(b)||!$('#br-checked')?.checked)return;
  if(!brDefs.some(([k])=>b.selected.has(k)&&brValue(k))){$('#br-error').textContent='請至少選取一個已核對、非空白的欄位。';return;}
  let errors={};if(!b.demo){try{const [,parser]=await brLoadModules();errors=parser.validateFields(Object.fromEntries(Object.entries(b.fields).filter(([k])=>b.selected.has(k)||k==='startDate')));}catch{errors._load='驗證引擎未能載入，請重試。';}}
  else {if(b.selected.has('brNumber')&&!/^\d{8}-\d{3}$/.test(brValue('brNumber')))errors.brNumber='請輸入 8 位號碼及 3 位分支碼。';}
  if(!brAlive(b)||b.phase!=='review'||!$('#br-checked')?.checked)return;
  for(const [key,,target]of brDefs){if(!b.selected.has(key))continue;const val=v2Canonical(target,brValue(key));if(V2.options[target]&&val&&!V2.options[target].some(o=>o[0]===val))errors[key]='辨識值不符合此欄位的選項，請對照原件修正。';}
  for(const [k,msg]of Object.entries(errors)){const el=$(`[data-br-error="${k}"]`);if(el)el.textContent=msg;}
  if(Object.keys(errors).length){$('#br-error').textContent='請修正標示的欄位，或取消選取該項。';return;}brReview(true);
}
function brApply(){
  const b=DEMO.br;if(!brAlive(b)||!b.confirmed||b.phase!=='ready')return;
  if(state.fail)return brModal('資料寫入失敗','<div class="notice error">這次資料尚未寫入，原有申請內容已保留。</div><p>本頁仍保留核對結果。關閉失敗模擬後可重試。</p>',btn('取消','close')+btn('返回核對','br-return')+btn('關閉失敗模擬並重試','br-retry','primary'),'failure');
  const plans=brPlan(b),before=structuredClone(state.values),files=structuredClone(state.files);let fileURL;
  try{
    const apply=plans.filter(p=>p.write);for(const p of apply)state.values[p.target]=p.value;
    const oldLog=v2Model().ocr.filter(o=>!apply.some(p=>p.target===o.key));
    v2Model().ocr=[...oldLog,...apply.map(p=>({key:p.target,value:p.value,applied:p.value,source:b.demo?'BR 虛構示例':'BR · 本機辨識 · 第 '+b.pageNumber+' 頁',step:p.step,confidence:null,selected:true,method:b.result.method}))];
    if(b.file){fileURL=URL.createObjectURL(b.file);state.files['140101']={name:b.file.name,size:b.file.size,type:b.file.type,demo:false,needsReselect:false,page:b.pageNumber};}
    else if(!state.files['140101'])state.files['140101']={name:'SAMPLE-BR.pdf',size:0,demo:true};
    v2SyncDerived();state.errors={};state.savedAt=null;
    b.applied=true;b.phase='result';b.imported=apply.map(p=>p.label+'：'+v2Display(p.target,p.value));
    b.pending=plans.filter(p=>!p.write&&!p.same).map(p=>p.label+'：保留原有資料');
    for(const [k,l]of brDefs)if(!b.selected.has(k)&&brValue(k))b.pending.push(l+'：未選取，待核對');
    b.unrecognized=brDefs.filter(([k])=>!brValue(k)).map(([,l])=>l+'：未取得候選值');
    render();v2ImportResult(b.imported,b.pending,b.unrecognized,'close',plans.filter(p=>p.same));$('#modal').classList.remove('br-dialog');delete $('#modal').dataset.br;
    if(fileURL){const previous=DEMO.fileURLs.get('140101');DEMO.fileURLs.set('140101',fileURL);if(previous)URL.revokeObjectURL(previous);}
  }catch(e){b.phase='ready';b.applied=false;state.values=before;state.files=files;if(fileURL)URL.revokeObjectURL(fileURL);brModal('資料寫入失敗','<div class="notice error">未能完成套用，已還原申請資料。請重試或返回核對。</div>',btn('取消','close')+btn('返回核對','br-return')+btn('重試寫入','br-apply','primary'),'failure');}
}
Object.assign(actions,{'br-start':brStart,'br-recognize':()=>void brRecognize(),'br-ready':()=>void brReady(),'br-return':()=>brReview(),'br-apply':brApply,'br-retry':()=>{state.fail=false;brApply();},'br-cancel':()=>DEMO.br?.controller?.abort()});
document.addEventListener('change',e=>{const el=e.target;
  if(el.id==='demo-br-file')void brAccept(el.files[0]);
  if(el.id==='br-page')void brPage(+el.value);
  if(el.id==='br-checked'){$('[data-action="br-ready"]').disabled=!el.checked;}
  if(el.dataset.brSelect){el.checked?DEMO.br.selected.add(el.dataset.brSelect):DEMO.br.selected.delete(el.dataset.brSelect);brInvalidate();}
  if(el.dataset.brConflict){DEMO.br.choices[el.dataset.brConflict]=el.value;brInvalidate();}
});
document.addEventListener('input',e=>{if(e.target.dataset.brValue){const b=DEMO.br;b.fields[e.target.dataset.brValue].value=e.target.value;brInvalidate();}});
// Rebuild conflict controls after an edit, preserving keyboard focus and scroll.
document.addEventListener('change',e=>{if(e.target.dataset.brValue){const id=e.target.id,pos=$('.br-workbench')?.scrollTop||0;brReview();$('#'+id)?.focus();$('.br-workbench').scrollTop=pos;}});
document.addEventListener('dragover',e=>{if(e.target.closest('#br-drop'))e.preventDefault();});
document.addEventListener('drop',e=>{if(!e.target.closest('#br-drop'))return;e.preventDefault();if(e.dataTransfer.files.length!==1)return brUpload('請一次選擇一份 BR 文件。');void brAccept(e.dataTransfer.files[0]);});
$('#modal').addEventListener('close',()=>{brRelease();$('#modal').classList.remove('br-dialog');delete $('#modal').dataset.br;});
addEventListener('pagehide',()=>brRelease());
const brOldPreview=actions['preview-demo-file'];
actions['preview-demo-file']=el=>{const f=state.files[el.dataset.id],url=DEMO.fileURLs.get(el.dataset.id);if(f&&url&&/\.pdf$/i.test(f.name))modal('文件預覽',`<p>${esc(f.name)}</p><iframe class="br-pdf-preview" src="${url}" title="所選 PDF 原件"></iframe><p class="hint">本機文件預覽，未上傳至伺服器。</p>`);else brOldPreview(el);};
Object.assign(window.AllinPayDemo,{version:'2026.09.23-backoffice-br-integrated',brLocalOCR:true});

actions['br-sources']=()=>modal('BR 辨識來源',v2ConsistencyCard(),btn('關閉','close')+btn('重新匯入 BR','br-start','primary'));

let documentBatch=null;
const documentTypes=[['AUTO','自動判斷'],['BR','BR 商業登記證'],['CI','CI 公司註冊證書'],['NAR1','NAR1／NNC1'],['ID','身份證'],['BANK','銀行月結單']];
const batchDocName=id=>V2.documents.find(d=>d.id===id)?.name.split('\n')[0]||'待手動分配';
function batchDispose(){const b=documentBatch;if(!b)return;b.cancelled=true;b.controller?.abort();for(const f of b.files)if(f.url)URL.revokeObjectURL(f.url);documentBatch=null;}
function batchOpen(){batchDispose();documentBatch={files:[],items:[],failures:[],phase:'upload'};batchUpload();}
function batchUpload(){const b=documentBatch;b.phase='upload';modal('多文件辨識',
 '<div class="notice">一次加入所有文件，辨識後預覽附件位置及表單欄位，再確認套用。文件只在本瀏覽器處理，不會上傳。</div>'+
 fileDropControl({inputId:'document-batch-files',accept:'.pdf,.png,.jpg,.jpeg,.zip',multiple:true,title:'拖曳一份或多份文件至此',hint:'最多 30 份／合計 100 MB · 每份 10 MB／PDF 5 頁',selected:b.files.length?'已加入 '+b.files.length+' 份文件':''})+
 '<div class="batch-files">'+b.files.map((f,i)=>'<div class="batch-file"><span>'+esc(f.file.name)+'</span><select aria-label="'+esc(f.file.name)+' 文件類型" data-document-type="'+i+'">'+documentTypes.map(([v,n])=>'<option value="'+v+'" '+(f.type===v?'selected':'')+'>'+n+'</option>').join('')+'</select>'+btn('移除','document-remove','','data-index="'+i+'"')+'</div>').join('')+'</div>'+
 '<p class="hint">按文件內容判斷 BR、CI、銀行月結單等；身份證持有人角色、照片及 ZIP 可能須手動分配。不確定或重複的位置不會自動覆蓋。</p>',
 btn('取消','close')+btn('開始辨識','document-recognize','primary',b.files.length?'':'disabled'));}
function batchAdd(files){
 const b=documentBatch;if(!b||b.phase!=='upload')return;
 if(b.files.length+files.length>30)return toast('每次最多 30 份文件');
 if([...b.files.map(f=>f.file),...files].reduce((n,f)=>n+f.size,0)>100*1048576)return toast('文件合計不可超過 100 MB');
 if(files.some(f=>!f.size||f.size>10485760||!/\.(pdf|png|jpe?g|zip)$/i.test(f.name)))return toast('請選擇非空白、10 MB 以下 PDF／PNG／JPG／ZIP；原有清單不受影響');
 for(const file of files)b.files.push({file,type:'AUTO',url:URL.createObjectURL(file),destination:'',include:false,replace:false});batchUpload();
}
async function batchRecognize(){
 const b=documentBatch;if(!b?.files.length||b.phase!=='upload')return;b.phase='reading';b.controller=new AbortController();
 modal('多文件辨識中','<p id="document-progress" role="status">正在載入本機辨識引擎…</p><progress id="document-progress-bar" max="100" value="0"></progress><p class="hint">辨識文件種類及可填欄位。可隨時取消，現有資料不受影響。</p>',btn('取消辨識','close'));let timer;
 try{
  const [[engine],parser]=await Promise.all([brLoadModules(),import('./br-engine/multi-document.mjs?v=20260929-uploads')]);
  for(let i=0;i<b.files.length;i++){
   if(b.cancelled)return;const entry=b.files[i];entry.text=[];let doc;const classifications=[];
   try{
    if(/\.zip$/i.test(entry.file.name)){entry.reason='ZIP 不自動解壓或辨識，請選擇附件位置';continue;}
    doc=await engine.loadDocument(entry.file);
    for(let p=1;p<=doc.pages;p++){
     if(b.cancelled)return;let view;
     try{
      view=await doc.render(p);timer=setTimeout(()=>b.controller.abort(),120000);
      const progress=n=>{if(!b.cancelled)$('#document-progress').textContent=(i+1)+'／'+b.files.length+' · '+entry.file.name+' · 第 '+p+' 頁 · '+Math.round(n*100)+'%';};
      const tryBR=entry.type==='BR'||entry.type==='AUTO'&&(!view.text.trim()||parser.classifyDocument(view.text).id==='140101');
      const br=tryBR?await engine.recognizeDocument({...view,page:p,signal:b.controller.signal,onProgress:x=>progress(x.progress)}):null;
      const result=br?.recognized?{text:br.rawText,method:br.method,confidence:br.ocrConfidence}:await engine.extractDocumentText({...view,signal:b.controller.signal,onProgress:progress});clearTimeout(timer);
      if(b.cancelled)return;entry.text.push(result.text);classifications.push(parser.classifyDocument(result.text,{brRecognized:!!br?.recognized}));
      const candidates=br?.recognized?parser.candidatesFromBR(br):parser.extractCandidates(result.text,entry.type);
      for(const candidate of candidates){const value=v2Canonical(candidate.key,candidate.value);if(!b.items.some(o=>o.key===candidate.key&&o.value===value&&o.fileIndex===i))b.items.push({...candidate,value,fileIndex:i,page:p,source:entry.file.name+' · 第 '+p+' 頁',method:result.method,confidence:candidate.confidence??result.confidence,selected:false,replace:false});}
     }finally{clearTimeout(timer);if(view)view.canvas.width=1;}
    }
    const ids=[...new Set(classifications.map(c=>c.id).filter(Boolean))];
    entry.destination=ids.length===1&&!classifications.some(c=>c.ambiguous)?ids[0]:'';
    entry.reason=entry.destination?'按文件內文判斷：'+batchDocName(entry.destination):'未能確定唯一文件種類，請選擇附件位置';
   }catch(error){if(b.cancelled)return;entry.reason='未完成辨識，仍可手動分配附件';b.failures.push(entry.file.name+'：'+(error.name==='AbortError'?'辨識逾時，請重試或手動分配。':error.message));if(b.controller.signal.aborted)b.controller=new AbortController();}
   finally{await doc?.destroy();if(!b.cancelled)$('#document-progress-bar').value=(i+1)/b.files.length*100;}
  }
  if(b.cancelled)return;
  for(const f of b.files)f.include=!!f.destination&&!state.files[f.destination]&&b.files.filter(x=>x.destination===f.destination).length===1;
  for(const o of b.items)o.selected=!!b.files[o.fileIndex].destination&&o.autoSelect!==false&&!v2Raw(o.key)&&b.items.filter(x=>x.key===o.key).length===1;
  batchReview();
 }catch(error){if(!b.cancelled){b.failures.push(error.message);batchReview();}}finally{clearTimeout(timer);}
}
function batchAssignments(ready){const b=documentBatch;return '<h3>文件自動分配</h3><p class="hint">確認每份文件的上傳位置。重複位置或已有附件須自行選擇；未勾選的文件不會加入。</p><div class="batch-assignments">'+b.files.map((f,i)=>{
 const duplicate=f.destination&&b.files.filter(x=>x.destination===f.destination).length>1,old=state.files[f.destination];
 return '<section class="batch-assignment"><strong>'+esc(f.file.name)+'</strong><small>'+esc(f.reason||'請選擇附件位置')+'</small><label>對應上傳位置<select aria-label="文件 '+(i+1)+' 對應上傳位置" data-document-destination="'+i+'" '+(ready?'disabled':'')+'><option value="">待手動分配／略過</option>'+
 V2.documents.map(d=>'<option value="'+d.id+'" '+(f.destination===d.id?'selected':'')+'>'+esc(batchDocName(d.id))+'</option>').join('')+'</select></label>'+
 (duplicate?'<p class="error">多份文件對應同一位置，請只選一份，或合併 PDF 後重新加入。</p>':'')+
 (old?'<p class="hint">原有附件：'+esc(old.name)+'</p><label class="check"><input type="checkbox" data-document-file-replace="'+i+'" '+(f.replace?'checked':'')+' '+(ready?'disabled':'')+'>確認取代此位置原有附件</label>':'')+
 '<label class="check"><input type="checkbox" data-document-include="'+i+'" '+(f.include?'checked':'')+' '+(ready||!f.destination?'disabled':'')+'>將此文件加入對應位置</label></section>';
 }).join('')+'</div>';}
function batchReview(ready=false){
 const b=documentBatch;if(!b)return;b.phase=ready?'ready':'review';if(!ready)b.confirmed=false;
 modal(ready?'已核對，準備套用':'核對多文件辨識結果',
 '<div class="notice warn">已預填可確定的分配位置及候選值；請核對後一次套用。沒有讀取到的資料不會猜測。</div>'+
 '<div class="batch-source-list">'+b.files.map((f,i)=>btn('查看文件 '+(i+1),'document-source','','data-index="'+i+'"')).join('')+'</div>'+
 batchAssignments(ready)+'<h3>表單欄位</h3><div class="batch-candidates">'+
 (b.items.map((o,i)=>{const existing=v2Raw(o.key),conflict=existing&&existing!==o.value;return '<section class="batch-candidate"><label class="check"><input type="checkbox" data-document-select="'+i+'" '+(o.selected?'checked':'')+' '+(ready?'disabled':'')+'><strong>'+esc(v2Label(o.key))+'</strong></label><input aria-label="核對 '+esc(v2Label(o.key))+'" data-document-value="'+i+'" value="'+esc(o.value)+'" '+(ready?'readonly':'')+'><small>'+esc(o.source)+' · '+esc(o.method)+'</small>'+
 (existing?'<p class="hint">原有內容：'+esc(existing)+'</p>':'')+(conflict?'<label class="check"><input type="checkbox" data-document-replace="'+i+'" '+(o.replace?'checked':'')+' '+(ready?'disabled':'')+'>確認以此值取代原有內容</label>':'')+'</section>';}).join('')||'<p>沒有可帶入的候選欄位；仍可將文件分配到附件位置。</p>')+'</div>'+
 (b.failures.length?'<div class="notice warn"><strong>仍需手動補充</strong><ul>'+b.failures.map(f=>'<li>'+esc(f)+'</li>').join('')+'</ul></div>':'')+
 (ready?'':'<label class="check"><input type="checkbox" id="batch-reviewed">我已核對文件位置、欄位內容及取代選項</label>')+'<p id="document-error" class="error" role="alert"></p>',
 btn('取消，保留原資料','close')+(ready?btn('返回核對','document-review'):'')+btn(ready?'確認並套用':'已核對，準備套用',ready?'document-apply':'document-ready','primary'));
}
function batchValidate(){
 const b=documentBatch,selected=b.items.filter(o=>o.selected),files=b.files.filter(f=>f.include),keys=new Set(),slots=new Set();
 if(!selected.length&&!files.length)return '請至少選擇一份文件或一個已核對欄位。';
 for(const f of files){if(!V2.documents.some(d=>d.id===f.destination))return '請選擇有效的文件位置。';if(slots.has(f.destination))return batchDocName(f.destination)+'有多份文件，請只選一份。';slots.add(f.destination);if(state.files[f.destination]&&!f.replace)return '請確認取代「'+batchDocName(f.destination)+'」的原有附件。';}
 for(const o of selected){if(!o.value.trim())return '選取的欄位不可空白。';if(keys.has(o.key))return v2Label(o.key)+'有多個結果，請只選一個。';keys.add(o.key);if(o.key==='registerCertNo'&&!/^\d{8}-\d{3}-\d{2}-\d{2}-[A-Z0-9]$/i.test(o.value))return '請按原件核對完整登記證號碼，包含最後三段。';if(v2Raw(o.key)&&v2Raw(o.key)!==o.value&&!o.replace)return '請確認要取代「'+v2Label(o.key)+'」的原有內容。';}
 return '';
}
function batchReady(){const error=batchValidate()||(!$('#batch-reviewed')?.checked?'請先確認已核對文件位置及欄位。':'');if(error){$('#document-error').textContent=error;return;}documentBatch.confirmed=true;batchReview(true);}
function batchApply(){
 const b=documentBatch;if(b?.phase!=='ready'||!b.confirmed)return;const error=batchValidate();if(error){batchReview();$('#document-error').textContent=error;return;}
 if(state.fail)return modal('資料寫入失敗','<p>原有表單、附件及辨識結果均保留，可返回核對。</p>',btn('取消','close')+btn('返回核對','document-review','primary'));
 const before=structuredClone(state.values),beforeFiles=structuredClone(state.files),beforePeople={...state.people},changed=[];
 try{
  const selected=b.items.filter(o=>o.selected),files=b.files.filter(f=>f.include);
  for(const o of selected){if(o.key.startsWith('directors[0]'))state.people.directors=Math.max(1,state.people.directors);state.values[o.key]=o.value;v2Model().ocr.push({key:o.key,value:o.value,source:o.source,step:o.step,applied:o.value,method:o.method,confidence:o.confidence});}
  for(const f of files){const id=f.destination,url=URL.createObjectURL(f.file);changed.push({id,url,old:DEMO.fileURLs.get(id)});DEMO.fileURLs.set(id,url);state.files[id]={name:f.file.name,size:f.file.size,type:f.file.type,demo:false,needsReselect:false};}
  v2SyncDerived();const done=[...files.map(f=>batchDocName(f.destination)+'：'+f.file.name),...selected.map(o=>v2Label(o.key)+'：'+v2Display(o.key,o.value))],pending=[...b.files.filter(f=>!f.include).map(f=>f.file.name+'：尚未加入附件位置'),...b.items.filter(o=>!o.selected).map(o=>v2Label(o.key)+'：'+o.value)],failures=[...b.failures];
  render();v2ImportResult(done,pending,failures);$('#modal .v2-import-success h3').textContent='完成匯入 · '+files.length+' 份文件、'+selected.length+' 個欄位';$('#modal .v2-import-pending h3').textContent='仍待核對 · '+pending.length+' 個項目未帶入';for(const x of changed)if(x.old)URL.revokeObjectURL(x.old);batchDispose();
 }catch(error){state.values=before;state.files=beforeFiles;state.people=beforePeople;for(const x of changed){URL.revokeObjectURL(x.url);if(x.old)DEMO.fileURLs.set(x.id,x.old);else DEMO.fileURLs.delete(x.id);}modal('資料寫入失敗','<p>已還原原有資料及附件，請重新核對。</p>',btn('返回核對','document-review','primary'));}
}
Object.assign(actions,{'v2-ocr':batchOpen,'document-recognize':batchRecognize,'document-ready':batchReady,'document-apply':batchApply,'document-review':()=>batchReview(),'document-remove':el=>{const f=documentBatch.files.splice(+el.dataset.index,1)[0];URL.revokeObjectURL(f.url);batchUpload();},'document-source':el=>{const f=documentBatch.files[+el.dataset.index];modal('原始文件與辨識文字','<p>'+esc(f.file.name)+'</p>'+(/\.pdf$/i.test(f.file.name)?'<iframe class="batch-preview" title="原始 PDF" src="'+f.url+'"></iframe>':/\.(png|jpe?g)$/i.test(f.file.name)?'<img class="batch-preview" alt="原始文件" src="'+f.url+'">':'<p>ZIP 不在瀏覽器解壓，請在本機查看。</p>')+'<details><summary>查看辨識文字（只保留於記憶體）</summary><pre class="batch-text">'+esc((f.text||[]).join('\n\n'))+'</pre></details>',btn('返回核對','document-review','primary'));}});
document.addEventListener('change',e=>{const t=e.target,b=documentBatch;if(t.id==='document-batch-files')batchAdd([...t.files]);if(!b)return;if(t.dataset.documentType!==undefined)b.files[+t.dataset.documentType].type=t.value;if(t.dataset.documentSelect!==undefined)b.items[+t.dataset.documentSelect].selected=t.checked;if(t.dataset.documentReplace!==undefined)b.items[+t.dataset.documentReplace].replace=t.checked;if(t.dataset.documentDestination!==undefined){const f=b.files[+t.dataset.documentDestination];f.destination=t.value;f.include=!!t.value;f.replace=false;batchReview();}if(t.dataset.documentInclude!==undefined)b.files[+t.dataset.documentInclude].include=t.checked;if(t.dataset.documentFileReplace!==undefined)b.files[+t.dataset.documentFileReplace].replace=t.checked;});
document.addEventListener('input',e=>{if(e.target.dataset.documentValue!==undefined)documentBatch.items[+e.target.dataset.documentValue].value=e.target.value;});
$('#modal').addEventListener('close',()=>{if(documentBatch){batchDispose();render();}});
window.addEventListener('pagehide',batchDispose);

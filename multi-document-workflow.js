let documentBatch=null;
const documentTypes=[['AUTO','自動判斷'],['BR','BR 商業登記證'],['CI','CI 公司註冊證書'],['NAR1','NAR1／NNC1'],['ID','身份證'],['BANK','銀行月結單']];
function batchDispose(){const b=documentBatch;if(!b)return;b.cancelled=true;b.controller?.abort();for(const f of b.files)if(f.url)URL.revokeObjectURL(f.url);documentBatch=null;}
function batchOpen(){batchDispose();documentBatch={files:[],items:[],failures:[],phase:'upload'};batchUpload();}
function batchUpload(){const b=documentBatch;b.phase='upload';modal('多文件辨識',`<div class="notice">文件只在本瀏覽器處理，不會上傳。每次最多 10 份，每份不超過 10 MB／5 頁。</div><div id="document-batch-drop" class="batch-drop"><p>將多份 PDF／JPG／PNG 拖曳到這裡</p><input id="document-batch-files" aria-label="選取多份辨識文件" type="file" multiple accept=".pdf,.png,.jpg,.jpeg"></div><div class="batch-files">${b.files.map((f,i)=>`<div class="batch-file"><span>${esc(f.file.name)}</span><select aria-label="${esc(f.file.name)} 文件類型" data-document-type="${i}">${documentTypes.map(([v,n])=>`<option value="${v}" ${f.type===v?'selected':''}>${n}</option>`).join('')}</select>${btn('移除','document-remove','',`data-index="${i}"`)}</div>`).join('')}</div><p class="hint">一般文件採文字及標籤擷取；不同版式可能無法自動對應欄位。沒有讀取到的項目請手動補充，不會套用示例值。</p>`,btn('取消','close')+btn('開始辨識','document-recognize','primary',b.files.length?'':'disabled'));}
function batchAdd(files){const b=documentBatch;if(!b||b.phase!=='upload')return;if(b.files.length+files.length>10)return toast('每次最多 10 份文件');if(files.some(f=>!f.size||f.size>10485760||!/\.(pdf|png|jpe?g)$/i.test(f.name)))return toast('請選擇非空白、10 MB 以下 PDF／PNG／JPG；原有清單不受影響');for(const file of files)b.files.push({file,type:'AUTO',url:URL.createObjectURL(file)});batchUpload();}
async function batchRecognize(){const b=documentBatch;if(!b?.files.length||b.phase!=='upload')return;b.phase='reading';b.controller=new AbortController();modal('多文件辨識中','<p id="document-progress" role="status">正在載入本機辨識引擎…</p><progress id="document-progress-bar" max="100" value="0"></progress><p class="hint">可取消，現有表單資料不受影響。</p>',btn('取消辨識','close'));let timer;
 try{
  const [[engine],parser]=await Promise.all([brLoadModules(),import('./br-engine/multi-document.mjs')]);
  for(let i=0;i<b.files.length;i++){
   if(b.cancelled)return;const entry=b.files[i];let doc;
   try{doc=await engine.loadDocument(entry.file);entry.text=[];
    for(let p=1;p<=doc.pages;p++){
     if(b.cancelled)return;let view;
     try{view=await doc.render(p);timer=setTimeout(()=>b.controller.abort(),120000);const result=await engine.extractDocumentText({...view,signal:b.controller.signal,onProgress:n=>{if(!b.cancelled){$('#document-progress').textContent=`${i+1}／${b.files.length} · ${entry.file.name} · 第 ${p} 頁 · ${Math.round(n*100)}%`;}}});clearTimeout(timer);
      if(b.cancelled)return;entry.text.push(result.text);
      const candidates=parser.extractCandidates(result.text,entry.type);
      for(const candidate of candidates)b.items.push({...candidate,value:v2Canonical(candidate.key,candidate.value),fileIndex:i,page:p,source:entry.file.name+' · 第 '+p+' 頁',method:result.method,confidence:result.confidence,selected:false,replace:false});
      if(!candidates.length)b.failures.push(entry.file.name+' · 第 '+p+' 頁：未能對應表單欄位，請查看文字或手動補充。');
     }finally{clearTimeout(timer);if(view)view.canvas.width=1;}
    }
   }catch(error){if(b.cancelled)return;b.failures.push(entry.file.name+'：'+(error.name==='AbortError'?'辨識逾時，請使用較清晰文件。':error.message));if(b.controller.signal.aborted)b.controller=new AbortController();}finally{await doc?.destroy();}
   if(!b.cancelled)$('#document-progress-bar').value=(i+1)/b.files.length*100;
  }
  if(!b.cancelled)batchReview();
 }catch(error){if(!b.cancelled){b.failures.push(error.message);batchReview();}}finally{clearTimeout(timer);}
}
function batchReview(ready=false){const b=documentBatch;if(!b)return;b.phase=ready?'ready':'review';modal(ready?'已核對，準備套用':'核對多文件辨識結果',`<div class="notice warn">所有候選值都須逐項核對；未選取的欄位不會帶入。若同一欄位來自多個文件，只能選一個結果。</div><div class="batch-source-list">${b.files.map((f,i)=>btn('查看文件 '+(i+1),'document-source','',`data-index="${i}"`)).join('')}</div><div class="batch-candidates">${b.items.map((o,i)=>{const existing=v2Raw(o.key),conflict=existing&&existing!==o.value;return `<section class="batch-candidate"><label class="check"><input type="checkbox" data-document-select="${i}" ${o.selected?'checked':''} ${ready?'disabled':''}><strong>${esc(v2Label(o.key))}</strong></label><input aria-label="核對 ${esc(v2Label(o.key))}" data-document-value="${i}" value="${esc(o.value)}" ${ready?'readonly':''}><small>${esc(o.source)} · ${esc(o.method)}${o.confidence==null?'':' · 文字信心 '+o.confidence+'%（非欄位準確率）'}</small>${existing?`<p class="hint">原有內容：${esc(existing)}</p>`:''}${conflict?`<label class="check"><input type="checkbox" data-document-replace="${i}" ${o.replace?'checked':''} ${ready?'disabled':''}>確認以此值取代原有內容</label>`:''}</section>`;}).join('')||'<p>沒有可帶入的候選欄位；請查看辨識文字並手動填寫。</p>'}</div>${b.failures.length?'<div class="notice warn"><strong>仍需手動補充</strong><ul>'+b.failures.map(f=>'<li>'+esc(f)+'</li>').join('')+'</ul></div>':''}<p id="document-error" class="error" role="alert"></p>`,btn('取消，保留原資料','close')+(b.items.length?btn(ready?'確認並套用':'已核對，準備套用',ready?'document-apply':'document-ready','primary'):'') );}
function batchValidate(){const b=documentBatch,selected=b.items.filter(o=>o.selected),keys=new Set();if(!selected.length)return '請至少勾選一個已核對的欄位。';for(const o of selected){if(!o.value.trim())return '選取的欄位不可空白。';if(keys.has(o.key))return v2Label(o.key)+'有多個結果，請只選一個。';keys.add(o.key);if(v2Raw(o.key)&&v2Raw(o.key)!==o.value&&!o.replace)return '請確認要取代「'+v2Label(o.key)+'」的原有內容。';}return '';}
function batchReady(){const error=batchValidate();if(error){$('#document-error').textContent=error;return;}batchReview(true);}
function batchApply(){const b=documentBatch;if(b?.phase!=='ready')return;const error=batchValidate();if(error){batchReview();$('#document-error').textContent=error;return;}if(state.fail)return modal('資料寫入失敗','<p>原有表單及辨識結果均保留，可返回核對。</p>',btn('取消','close')+btn('返回核對','document-review','primary'));
 const before=structuredClone(state.values),beforePeople={...state.people};
 try{const selected=b.items.filter(o=>o.selected);for(const o of selected){if(o.key.startsWith('directors[0]'))state.people.directors=Math.max(1,state.people.directors);state.values[o.key]=o.value;v2Model().ocr.push({key:o.key,value:o.value,source:o.source,step:o.step,applied:o.value,method:o.method,confidence:o.confidence});}v2SyncDerived();
  const done=selected.map(o=>v2Label(o.key)+'：'+v2Display(o.key,o.value)),pending=b.items.filter(o=>!o.selected).map(o=>v2Label(o.key)+'：'+o.value),failures=[...b.failures];batchDispose();render();v2ImportResult(done,pending,failures);
 }catch(error){state.values=before;state.people=beforePeople;modal('資料寫入失敗','<p>已還原原有資料，請重新核對。</p>',btn('返回核對','document-review','primary'));}
}
Object.assign(actions,{'v2-ocr':batchOpen,'document-recognize':batchRecognize,'document-ready':batchReady,'document-apply':batchApply,'document-review':()=>batchReview(),'document-remove':el=>{const f=documentBatch.files.splice(+el.dataset.index,1)[0];URL.revokeObjectURL(f.url);batchUpload();},'document-source':el=>{const f=documentBatch.files[+el.dataset.index];modal('原始文件與辨識文字',`<p>${esc(f.file.name)}</p>${/\.pdf$/i.test(f.file.name)?`<iframe class="batch-preview" title="原始 PDF" src="${f.url}"></iframe>`:`<img class="batch-preview" alt="原始文件" src="${f.url}">`}<details><summary>查看辨識文字（只保留於記憶體）</summary><pre class="batch-text">${esc((f.text||[]).join('\n\n'))}</pre></details>`,btn('返回核對','document-review','primary'));}});
document.addEventListener('change',e=>{const t=e.target;if(t.id==='document-batch-files')batchAdd([...t.files]);if(t.dataset.documentType!==undefined)documentBatch.files[+t.dataset.documentType].type=t.value;if(t.dataset.documentSelect!==undefined)documentBatch.items[+t.dataset.documentSelect].selected=t.checked;if(t.dataset.documentReplace!==undefined)documentBatch.items[+t.dataset.documentReplace].replace=t.checked;});
document.addEventListener('input',e=>{if(e.target.dataset.documentValue!==undefined)documentBatch.items[+e.target.dataset.documentValue].value=e.target.value;});
document.addEventListener('dragover',e=>{if(e.target.closest('#document-batch-drop'))e.preventDefault();});
document.addEventListener('drop',e=>{if(e.target.closest('#document-batch-drop')){e.preventDefault();batchAdd([...e.dataTransfer.files]);}});
$('#modal').addEventListener('close',()=>{batchDispose();render();});
window.addEventListener('pagehide',batchDispose);

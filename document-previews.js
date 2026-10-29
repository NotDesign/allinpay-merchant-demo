// Preview bytes stay in memory; persisted drafts contain metadata only.
const documentThumbnails=new Map();
DEMO.sourceFiles??=new Map();
uploadRow=function(d){
 const f=state.files[d.id],id='document-file-'+d.id,error=state.errors['file-'+d.id],url=f&&!f.needsReselect?DEMO.fileURLs.get(d.id):'',image=f&&/\.(png|jpe?g)$/i.test(f.name),pdf=f&&/\.pdf$/i.test(f.name);
 const hint=d.hint&&!/選填|不會阻擋|上限|稍後補/.test(d.hint)?`<p class="hint">${esc(d.hint)}</p>`:'';
 const preview=f?`<div class="mt-upload-preview"><button type="button" class="mt-preview-button" data-action="preview-demo-file" data-id="${d.id}" aria-label="預覽 ${esc(f.name)}" ${!url&&!f.demo?'disabled':''}>${url&&image?`<img src="${esc(url)}" alt="${esc(f.name)} 縮圖">`:url&&pdf?`<img data-preview-source="${esc(url)}" alt="${esc(f.name)} 第一頁預覽" hidden><span class="mt-thumb-state">正在產生 PDF 預覽…</span>`:`<span class="mt-preview-placeholder">${pdf?'PDF':'圖片'}<small>${f.demo?'示例文件':f.needsReselect?'請重新上傳以預覽':'文件預覽'}</small></span>`}</button><div class="mt-preview-info"><strong>${esc(f.name)}</strong><small>${f.size?(f.size/1048576).toFixed(2)+' MB · ':''}${f.demo?'示例附件':f.needsReselect?'原文件未保留，請重新上傳':'僅保留於本機'}</small><div class="upload-actions">${btn('查看文件','preview-demo-file','',`data-id="${d.id}" ${!url&&!f.demo?'disabled':''}`)}${btn('重新上傳','choose-file','',`data-input-id="${id}"`)}${btn('刪除','document-remove-file','danger',`data-id="${d.id}"`)}</div><small>也可拖入新文件取代</small></div><input hidden type="file" id="${id}" data-demo-upload="${d.id}" accept=".pdf,.jpg,.jpeg,.png"></div>`:fileDropControl({inputId:id,accept:'.pdf,.jpg,.jpeg,.png',hint:'PDF／JPG／PNG · 每份上限 10 MB',attributes:`data-demo-upload="${d.id}"`});
 return `<div class="upload-row ${f?'has-document':''}" data-upload-row="${d.id}" data-document-drop="${d.id}" data-file-drop data-file-input="${id}"><div class="upload-heading"><strong>${labelHTML(d.name)}</strong>${pill(f?'已上傳':'選填',f?'green':'gray')}</div>${hint}${preview}${error?`<p class="error">${esc(error)}</p>`:''}</div>`;
};
async function makeDocumentThumbnail(url){
 let task;try{
  const pdfjs=await import('./vendor/pdfjs/build/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/build/pdf.worker.mjs',location.href).href;
  const source=[...DEMO.sourceFiles.values()].find(s=>s.url===url)?.file;if(!source)throw Error('請重新上傳文件');const bytes=new Uint8Array(await source.arrayBuffer());
  task=pdfjs.getDocument({data:bytes,isEvalSupported:false,cMapUrl:new URL('./vendor/pdfjs/cmaps/',location.href).href,cMapPacked:true,standardFontDataUrl:new URL('./vendor/pdfjs/standard_fonts/',location.href).href,wasmUrl:new URL('./vendor/pdfjs/wasm/',location.href).href});
  const doc=await task.promise,page=await doc.getPage(1),base=page.getViewport({scale:1}),view=page.getViewport({scale:Math.min(1,320/base.width)}),canvas=document.createElement('canvas');canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);
  await page.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;const src=canvas.toDataURL('image/png');canvas.width=canvas.height=1;return {src,pages:doc.numPages};
 }catch{return {error:'無法產生縮圖，可按「查看文件」開啟原件。'};}finally{try{await task?.destroy();}catch{}}
}
function showDocumentThumbnail(url,result){
 for(const image of $$('[data-preview-source]').filter(n=>n.dataset.previewSource===url)){
  const caption=image.parentElement.querySelector('.mt-thumb-state');
  if(result.src){image.src=result.src;image.hidden=false;if(caption)caption.textContent='第 1／'+result.pages+' 頁';}
  else if(caption)caption.textContent=result.error;
 }
}
let documentThumbnailQueue=Promise.resolve();
function refreshDocumentThumbnails(){
 const active=new Set(DEMO.fileURLs.values());for(const url of documentThumbnails.keys())if(!active.has(url))documentThumbnails.delete(url);
 for(const image of $$('[data-preview-source]')){const url=image.dataset.previewSource,entry=documentThumbnails.get(url);if(entry?.result){showDocumentThumbnail(url,entry.result);continue;}if(entry)continue;
  const record={result:null};documentThumbnails.set(url,record);documentThumbnailQueue=documentThumbnailQueue.then(async()=>{if(![...DEMO.fileURLs.values()].includes(url))return;record.result=await makeDocumentThumbnail(url);if(documentThumbnails.get(url)===record)showDocumentThumbnail(url,record.result);});
 }
}
const documentPreviewRender=render;render=function(){documentPreviewRender();queueMicrotask(refreshDocumentThumbnails);};
actions['preview-demo-file']=el=>{
 const f=state.files[el.dataset.id],url=f&&!f.needsReselect?DEMO.fileURLs.get(el.dataset.id):'';if(!f)return;
 const body=url?/\.pdf$/i.test(f.name)?`<iframe class="br-pdf-preview" src="${esc(url)}" title="${esc(f.name)} 原文件"></iframe>`:`<img class="batch-preview" alt="${esc(f.name)}" src="${esc(url)}">`:`<div class="notice">${f.demo?'這是完整示例中的附件記錄，沒有真實文件。可用「重新上傳」加入自己的文件。':'請重新上傳文件以查看原件。'}</div>`;
 modal('文件預覽',`<p><strong>${esc(f.name)}</strong></p>${body}`,btn('關閉','close')+(url?btn('開啟原文件','document-open-original','',`data-id="${el.dataset.id}"`):'')+btn('重新上傳','document-replace','primary',`data-id="${el.dataset.id}"`));
};
actions['document-open-original']=el=>{const f=state.files[el.dataset.id],url=f&&!f.needsReselect?DEMO.fileURLs.get(el.dataset.id):'';if(url)window.open(url,'_blank','noopener');};
actions['document-replace']=el=>{$('#modal').close();document.getElementById('document-file-'+el.dataset.id)?.click();};
const documentDeleteAction=actions['document-remove-file']||actions['remove-file'];
actions['document-remove-file']=el=>{const url=DEMO.fileURLs.get(el.dataset.id);if(url)URL.revokeObjectURL(url);DEMO.fileURLs.delete(el.dataset.id);DEMO.sourceFiles.delete(el.dataset.id);documentDeleteAction(el);};

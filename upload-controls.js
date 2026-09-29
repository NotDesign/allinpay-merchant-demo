// One upload interaction for cards, BR, batch OCR, and supporting dialogs.
// File selection and file drops dispatch the same existing change handlers.
function fileDropControl({inputId,accept='.pdf,.jpg,.jpeg,.png',multiple=false,title='拖曳文件至此',hint='PDF／JPG／PNG · 每份上限 10 MB',selected='',attributes=''}) {
 return `<div class="file-drop-zone" data-file-drop data-file-input="${esc(inputId)}" role="group" aria-label="文件上傳"><svg class="file-drop-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 16V4m-4 4 4-4 4 4M4 15v5h16v-5"/></svg><strong class="file-drop-title">${esc(title)}</strong><small>${esc(hint)}</small>${btn('選擇文件','choose-file','',`data-input-id="${esc(inputId)}"`)}<input hidden type="file" id="${esc(inputId)}" accept="${esc(accept)}" ${multiple?'multiple':''} ${attributes}><span class="file-drop-status" role="status">${esc(selected||'或按「選擇文件」從電腦加入')}</span></div>`;
}
actions['choose-file']=el=>{const input=document.getElementById(el.dataset.inputId);if(input&&!input.disabled&&!input.closest('.external-readonly'))input.click();};
const uploadFileDrag=e=>Array.from(e.dataTransfer?.types||[]).includes('Files');
const uploadZone=e=>e.target instanceof Element?e.target.closest('[data-file-drop]'):e.target?.parentElement?.closest('[data-file-drop]');
const uploadInput=zone=>zone&&document.getElementById(zone.dataset.fileInput);
const uploadEnabled=zone=>{const input=uploadInput(zone);return input&&!input.disabled&&!zone.closest('.external-readonly');};
const clearUploadHover=()=>document.querySelectorAll('.document-drag').forEach(z=>z.classList.remove('document-drag'));
document.addEventListener('dragover',e=>{if(!uploadFileDrag(e))return;const zone=uploadZone(e);e.preventDefault();clearUploadHover();if(uploadEnabled(zone)){zone.classList.add('document-drag');e.dataTransfer.dropEffect='copy';}else e.dataTransfer.dropEffect='none';},true);
document.addEventListener('dragleave',e=>{const zone=uploadZone(e);if(zone&&!zone.contains(e.relatedTarget))zone.classList.remove('document-drag');});
document.addEventListener('dragend',clearUploadHover);
document.addEventListener('drop',e=>{
 if(!uploadFileDrag(e))return;e.preventDefault();e.stopImmediatePropagation();clearUploadHover();const zone=uploadZone(e);
 if(!uploadEnabled(zone))return;const input=uploadInput(zone),files=[...e.dataTransfer.files];
 if(!files.length)return toast('請拖入文件，不支援資料夾。');
 if(!input.multiple&&files.length!==1)return toast('此位置接受一份文件；多份請使用「多文件辨識」。');
 input.files=e.dataTransfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
},true);
document.addEventListener('change',e=>{const t=e.target;if(t.type!=='file'||t.dataset.demoUpload||['demo-br-file','document-batch-files'].includes(t.id))return;const status=t.closest('[data-file-drop]')?.querySelector('.file-drop-status');if(status)status.textContent=[...t.files].map(f=>f.name).join('、')||'尚未選擇文件';},true);
// Preserve each existing input, accept attribute, selection and event handlers.
// The few auxiliary dialogs use the same control without maintaining copies.
let uploadInputSequence=0;
function enhanceFileUploads(){
 for(const input of document.querySelectorAll('input[type="file"]:not([hidden])')){
  if(input.closest('[data-file-drop]'))continue;
  input.id||='upload-aux-'+(++uploadInputSequence);
  const host=document.createElement('div');host.innerHTML=fileDropControl({inputId:input.id,accept:input.accept,multiple:input.multiple,title:input.multiple?'拖曳一份或多份文件至此':'拖曳文件至此',hint:(input.accept||'支援文件')+' · 每份上限 10 MB'});
  const zone=host.firstElementChild,placeholder=zone.querySelector('input');
  input.before(zone);input.hidden=true;placeholder.replaceWith(input);zone.querySelector('button').disabled=input.disabled;
 }
}
new MutationObserver(enhanceFileUploads).observe(document.body,{childList:true,subtree:true});

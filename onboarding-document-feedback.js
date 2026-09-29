// Shared functional corrections from the supplied Word. No risk-policy changes.
const documentStepNames=['文件材料','主體資料','經營與聯繫','結算帳戶','產品與費率','確認提交'];
function syncBankName(changed) {
  const v=state.values, m=v2Model(), code=String(v.cardBankCode||'').trim().split(/\s+/)[0];
  v.cardBankCode=code;
  const name=v.cardCountryCode==='HKG'?ONBOARDING_BANKS[code]:null;
  if(name){v.cardBankName=name;m.bankAutoName=name;}
  else if(changed||m.bankAutoName===v.cardBankName){v.cardBankName='';delete m.bankAutoName;}
  const input=$('[data-v2-field="cardBankName"]');if(input){input.value=v.cardBankName||'';input.readOnly=!!name;}
}
const feedbackField=v2Field;
v2Field=function(f,...args){let html=feedbackField(f,...args);if(f.id==='cardBankName'&&v2Raw('cardCountryCode')==='HKG'&&ONBOARDING_BANKS[v2Raw('cardBankCode')])html=html.replace('type="text"','type="text" readonly');return html;};
const feedbackDerived=v2SyncDerived;
v2SyncDerived=function(){feedbackDerived();if(v2Raw('cardCountryCode')==='HKG'&&ONBOARDING_BANKS[v2Raw('cardBankCode')])syncBankName(false);};
const feedbackValidation=v2ValidateFields;
v2ValidateFields=function(index){const e=feedbackValidation(index),v=v2Raw('inspectionDate');if(index===0&&v&&(!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v+'T00:00:00'))||new Date(v+'T00:00:00').toLocaleDateString('sv-SE')!==v))e.inspectionDate='請選擇有效考察日期';return e;};
const feedbackDocuments=v2Documents;
v2Documents=function(){return feedbackDocuments()
 .replace('多文件辨識示例','多文件辨識')
 .replace('BR 支援 PDF、JPG、PNG，文件僅在瀏覽器本機辨識；其他文件提供示例流程。','可一次選取多份 PDF、JPG、PNG，在瀏覽器本機辨識；先核對，再套用。')
 .replace('必交文件檢查','文件提供狀態')
 .replace('必交清單會隨法律主體、風險級別、產品及董事／股東設定更新。','所有文件均為選填。未提供不會阻擋下一步或提交；已填文字資料仍須驗證。')
 .replace('0／0 項必交文件已備妥',Object.keys(state.files).length+' 份文件已選取 · 全部為選填')
 .replaceAll(' · 示例信心 ',' · 辨識信心 ');};
const feedbackReview=v2Review;
v2Review=function(){return feedbackReview().replace('✓ 文件已備妥','文件為選填').replace('條件文件','選填文件');};
const feedbackUpload=uploadRow;
uploadRow=function(d){return feedbackUpload(d).replace('data-upload-row=', 'data-document-drop="'+esc(d.id)+'" data-upload-row=').replace('尚未選擇文件','拖曳文件至此，或按「選擇文件」（選填）');};
function acceptDocumentFile(id,files){
  if(files.length!==1)return toast('每個上傳位置接受一份文件；多頁可合併 PDF，多文件辨識請使用上方按鈕。');
  const f=files[0];if(!f||!f.size||f.size>10485760||!/\.(pdf|png|jpe?g|zip)$/i.test(f.name))return modal('文件格式不符','<p>請選擇非空白、10 MB 以下的 PDF／JPG／PNG／ZIP。原有文件不受影響。</p>');
  const old=DEMO.fileURLs.get(id);if(old)URL.revokeObjectURL(old);
  DEMO.fileURLs.set(id,URL.createObjectURL(f));state.files[id]={name:f.name,size:f.size,type:f.type,demo:false,needsReselect:false};delete state.errors['file-'+id];render();toast('已選取文件，沒有上傳至伺服器');
}
// Capture makes the picker and drag/drop use exactly the same validation path.
document.addEventListener('change',e=>{const t=e.target;if(t.dataset.demoUpload){e.stopImmediatePropagation();acceptDocumentFile(t.dataset.demoUpload,[...t.files]);}},true);
document.addEventListener('change',e=>{if(['cardBankCode','cardCountryCode'].includes(e.target.dataset.v2Field)){syncBankName(true);const bank=$('[data-v2-field="cardBankName"]');if(bank)bank.dispatchEvent(new Event('input',{bubbles:true}));}});
document.addEventListener('input',e=>{if(e.target.dataset.v2Field==='cardBankCode'){state.values.cardBankCode=e.target.value;syncBankName(true);}});
document.addEventListener('dragover',e=>{const d=e.target.closest('[data-document-drop]');if(d){e.preventDefault();d.classList.add('document-drag');}});
document.addEventListener('dragleave',e=>e.target.closest('[data-document-drop]')?.classList.remove('document-drag'));
document.addEventListener('drop',e=>{const d=e.target.closest('[data-document-drop]');if(d){e.preventDefault();e.stopPropagation();d.classList.remove('document-drag');acceptDocumentFile(d.dataset.documentDrop,[...e.dataTransfer.files]);}});
Object.assign(window.AllinPayDemo,{version:'2026.09.29-document-feedback'});
/* MULTI_DOCUMENT_WORKFLOW */

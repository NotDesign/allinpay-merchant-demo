/* Opt-in, browser-local photo capture. No upload, OCR, face matching or liveness claim. */
const ktcCapture={session:'',stream:null,request:0,consented:false,facing:'environment',photos:{id:null,face:null},error:''};
function ktcMobileSession(){
 const [,token,mode,expiry]=location.hash.slice(2).split('/'),expires=Number(expiry);
 return {token,mode,expires,valid:/^[a-f0-9-]{36}$/.test(token||'')&&['full','face'].includes(mode)&&expires>Date.now()&&expires<Date.now()+660000};
}
function ktcStopCamera(){
 ktcCapture.request++;
 ktcCapture.stream?.getTracks().forEach(track=>track.stop());ktcCapture.stream=null;
 const video=$('#ktc-camera');if(video)video.srcObject=null;
 const button=$('[data-action="ktc-camera-capture"]');if(button)button.disabled=true;
}
function ktcClearPhoto(kind){if(ktcCapture.photos[kind])URL.revokeObjectURL(ktcCapture.photos[kind].url);ktcCapture.photos[kind]=null;}
function ktcClearCapture(){ktcStopCamera();ktcClearPhoto('id');ktcClearPhoto('face');ktcCapture.consented=false;ktcCapture.session='';ktcCapture.error='';ktcMobileStage='consent';}
function ktcCameraError(message){ktcCapture.error=message;if($('#ktc-camera-error'))$('#ktc-camera-error').textContent=message;}
function ktcCameraView(kind){
 const face=kind==='face';
 return `<h1>${face?'人像拍攝':'手機拍照 — 身分證'}</h1><p>${face?'請正視鏡頭，將臉部放入框內。這是實拍 Demo，不執行人臉比對或活體驗證。':'請將完整證件四角放入框內，避免反光。此步只拍照與人工核對，不會自動辨識證件內容。'}</p>
 <div class="ktc-camera-frame ${face?'is-face':''}"><video id="ktc-camera" autoplay muted playsinline aria-label="相機即時預覽"></video><div class="ktc-camera-guide" aria-hidden="true"></div></div>
 <p id="ktc-camera-status" role="status">請允許相機權限，或使用下方系統相機。</p><p id="ktc-camera-error" class="error" role="alert">${esc(ktcCapture.error)}</p>
 <div class="ktc-camera-actions">${btn('開啟／重試相機','ktc-camera-open')}${btn('切換前後鏡頭','ktc-camera-switch')}${btn(face?'拍攝人像':'拍攝身分證','ktc-camera-capture','primary','disabled')}</div>
 <details><summary>無法開啟預覽？使用系統相機／照片</summary>${fileDropControl({inputId:'ktc-photo-file',accept:'image/*',title:'拍照或選擇照片',hint:'照片只在此手機頁面暫存 · 每份上限 10 MB',attributes:'capture="'+(face?'user':'environment')+'" data-ktc-photo="'+kind+'"'})}</details>`;
}
function ktcMobile(){
 const session=ktcMobileSession();
 if(ktcCapture.session!==location.hash){ktcClearCapture();ktcCapture.session=location.hash;}
 // Any re-render releases the prior preview; explicit user actions reopen it.
 ktcStopCamera();
 let body='';
 if(!session.valid){ktcClearPhoto('id');ktcClearPhoto('face');body='<h1>識別連結已過期或無效</h1><p>請返回電腦頁面，重新產生 QR Code。</p>';}
 else if(ktcMobileStage==='consent')body='<h1>KTC／KYC 手機實拍 Demo</h1><p>'+(session.mode==='face'?'已導入並核對身分證資訊，只需拍攝人像。':'手機拍攝身分證 → 預覽核對 → 前鏡頭拍攝人像。')+'</p><div class="notice warn">需由你允許相機權限。照片只暫存在此頁，不上傳、不寫入草稿；離開或重新整理會清除。不執行正式身分、人臉比對或活體驗證。</div><label class="check"><input type="checkbox" id="ktc-consent">我了解照片的本機暫存方式，並同意開啟相機進行實拍 Demo</label>'+btn('同意並開始拍照','ktc-mobile-start','primary');
 else if(ktcMobileStage==='photo'||ktcMobileStage==='face')body=ktcCameraView(ktcMobileStage==='photo'?'id':'face');
 else if(ktcMobileStage==='review')body='<h1>核對身分證照片</h1><img class="ktc-captured-photo" src="'+ktcCapture.photos.id.url+'" alt="剛拍攝的身分證照片"><p>請確認照片完整、清晰且無反光。本 Demo 沒有辨識或填入證件欄位。</p><label class="check"><input type="checkbox" id="ktc-mobile-confirm">照片完整且清晰，我已核對</label>'+btn('確認並拍攝人像','ktc-mobile-face','primary')+btn('重新拍攝身分證','ktc-mobile-retake');
 else if(ktcMobileStage==='face-review')body='<h1>核對人像照片</h1><img class="ktc-captured-photo face-photo" src="'+ktcCapture.photos.face.url+'" alt="剛拍攝的人像照片"><p>請確認臉部清晰且未被遮擋。本 Demo 不執行人臉比對或活體驗證。</p><label class="check"><input type="checkbox" id="ktc-face-confirm">人像清晰，我確認使用此照片演示</label>'+btn('確認照片並取得驗證碼','ktc-mobile-success','primary')+btn('重新拍攝人像','ktc-face-retake');
 else body='<h1>照片已確認（Demo）</h1><p>請返回電腦，輸入以下驗證碼並按「確認驗證碼」，才會顯示識別成功。</p><div class="ktc-check"><h2>手機識別驗證碼（Demo）</h2><strong style="font-size:28px">'+ktcReturnCode(session.token)+'</strong></div><p>照片已從本頁釋放，沒有上傳。這不代表通過正式 KYC 認證。</p>';
 const logo=AZURE_EXTERNAL?ASSETS['4864c.png']:'azure-logo.png';
 $('#app').innerHTML='<main class="ktc-mobile"><a class="brand" href="#/login"><img src="'+logo+'" alt="Azure"></a><small>手機實拍 · KTC／KYC Demo</small>'+body+(session.valid&&ktcMobileStage!=='consent'&&ktcMobileStage!=='success'?btn('取消並清除照片','ktc-mobile-cancel'):'')+'<p class="azure-demo-label">僅供拍攝流程演示；正式證件辨識、人臉比對及活體驗證尚未串接。</p></main>';
}
async function ktcOpenCamera(){
 const session=ktcMobileSession();
 if(!session.valid||!ktcCapture.consented||!['photo','face'].includes(ktcMobileStage))return;
 ktcStopCamera();ktcCameraError('');
 if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){ktcCameraError('請使用 HTTPS 網址並在 Safari／Chrome／Brave 開啟，或改用系統相機。');return;}
 const request=ktcCapture.request,hash=location.hash,stage=ktcMobileStage;
 $('#ktc-camera-status').textContent='正在請求相機權限…';
 try{
  const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:ktcCapture.facing},width:{ideal:1600},height:{ideal:1200}}});
  if(request!==ktcCapture.request||hash!==location.hash||stage!==ktcMobileStage||!ktcMobileSession().valid){stream.getTracks().forEach(t=>t.stop());return;}
  ktcCapture.stream=stream;const video=$('#ktc-camera');video.srcObject=stream;video.muted=true;
  video.classList.toggle('mirrored',ktcCapture.facing==='user');await video.play();
  if(request!==ktcCapture.request)return;
  $('#ktc-camera-status').textContent='相機已開啟，只會在你按下拍攝時擷取一張照片。';
  $('[data-action="ktc-camera-capture"]').disabled=false;
 }catch(error){
  if(request!==ktcCapture.request)return;ktcStopCamera();
  ktcCameraError(error.name==='NotAllowedError'?'相機權限未開啟。請在瀏覽器設定允許相機後重試，或使用系統相機。':error.name==='NotFoundError'?'找不到可用相機，請改用有相機的手機。':'相機暫時無法使用，請關閉其他相機程式後重試，或使用系統相機。');
  if($('#ktc-camera-status'))$('#ktc-camera-status').textContent='尚未拍攝照片。';
 }
}
function ktcStorePhoto(kind,blob){
 ktcClearPhoto(kind);ktcCapture.photos[kind]={url:URL.createObjectURL(blob)};
 ktcStopCamera();ktcCapture.error='';ktcMobileStage=kind==='id'?'review':'face-review';render();
}
async function ktcTakePhoto(){
 const video=$('#ktc-camera'),session=ktcMobileSession();
 if(!session.valid||!ktcCapture.consented||!ktcCapture.stream||!video||video.readyState<2||!video.videoWidth)return ktcCameraError('相機尚未就緒，請稍候或重新開啟。');
 const kind=ktcMobileStage==='photo'?'id':'face',request=ktcCapture.request;
 const canvas=document.createElement('canvas'),scale=Math.min(1,1600/Math.max(video.videoWidth,video.videoHeight));canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
 $('[data-action="ktc-camera-capture"]').disabled=true;
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));canvas.width=1;
 if(request!==ktcCapture.request||!ktcMobileSession().valid)return;
 if(!blob){ktcCameraError('無法擷取照片，請重試。');$('[data-action="ktc-camera-capture"]').disabled=false;return;}
 ktcStorePhoto(kind,blob);
}
async function ktcReadPhoto(file,kind){
 if(!ktcMobileSession().valid||!ktcCapture.consented||kind!==(ktcMobileStage==='photo'?'id':ktcMobileStage==='face'?'face':''))return;
 if(!file||file.size===0||file.size>10*1048576||!/^image\//.test(file.type)){ktcCameraError('請使用 10 MB 以下的照片。');return;}
 ktcStopCamera();const request=ktcCapture.request,url=URL.createObjectURL(file),img=new Image();
 try{
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});
  if(request!==ktcCapture.request||!ktcMobileSession().valid)return;
  if(img.naturalWidth*img.naturalHeight>32000000)throw Error('size');
  const canvas=document.createElement('canvas'),scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));canvas.width=1;
  if(request!==ktcCapture.request||!ktcMobileSession().valid)return;
  if(!blob)throw Error('decode');ktcStorePhoto(kind,blob);
 }catch{if(request===ktcCapture.request)ktcCameraError('照片無法讀取或尺寸過大，請重新拍照或改用 JPG／PNG。');}
 finally{URL.revokeObjectURL(url);img.src='';}
}
Object.assign(actions,{
 'ktc-mobile-start':()=>{if(!$('#ktc-consent')?.checked)return toast('請先閱讀並同意相機及照片說明');ktcCapture.consented=true;ktcMobileStage=ktcMobileSession().mode==='face'?'face':'photo';ktcCapture.facing=ktcMobileStage==='face'?'user':'environment';render();void ktcOpenCamera();},
 'ktc-camera-open':()=>void ktcOpenCamera(),
 'ktc-camera-switch':()=>{ktcCapture.facing=ktcCapture.facing==='user'?'environment':'user';void ktcOpenCamera();},
 'ktc-camera-capture':()=>void ktcTakePhoto(),
 'ktc-mobile-retake':()=>{ktcClearPhoto('id');ktcMobileStage='photo';ktcCapture.facing='environment';render();void ktcOpenCamera();},
 'ktc-mobile-face':()=>{if(!ktcCapture.photos.id||!$('#ktc-mobile-confirm')?.checked)return toast('請先核對身分證照片');ktcClearPhoto('id');ktcMobileStage='face';ktcCapture.facing='user';render();void ktcOpenCamera();},
 'ktc-face-retake':()=>{ktcClearPhoto('face');ktcMobileStage='face';ktcCapture.facing='user';render();void ktcOpenCamera();},
 'ktc-mobile-success':()=>{const session=ktcMobileSession();if(!session.valid)return render();if(ktcMobileStage!=='face-review'||!ktcCapture.photos.face||!$('#ktc-face-confirm')?.checked)return toast('請先核對人像照片');ktcStopCamera();ktcClearPhoto('id');ktcClearPhoto('face');const data={token:session.token,status:'success'};ktcChannel?.postMessage(data);try{localStorage.setItem('azure-ktc-demo-result',JSON.stringify(data));localStorage.removeItem('azure-ktc-demo-result');}catch{}ktcMobileStage='success';render();},
 'ktc-mobile-cancel':()=>{ktcClearCapture();render();}
});
document.addEventListener('change',e=>{if(e.target.dataset.ktcPhoto)void ktcReadPhoto(e.target.files[0],e.target.dataset.ktcPhoto);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){ktcStopCamera();if($('#ktc-camera-status'))$('#ktc-camera-status').textContent='相機已暫停，請按「開啟／重試相機」。';}});
window.addEventListener('pagehide',ktcClearCapture);
window.addEventListener('pageshow',e=>{if(e.persisted&&location.hash.startsWith('#/ktc-mobile/'))render();});
window.addEventListener('hashchange',()=>{if(!location.hash.startsWith('#/ktc-mobile/'))ktcClearCapture();});
setInterval(()=>{if(location.hash.startsWith('#/ktc-mobile/')&&!ktcMobileSession().valid&&(ktcCapture.stream||ktcCapture.photos.id||ktcCapture.photos.face)){ktcStopCamera();ktcClearPhoto('id');ktcClearPhoto('face');render();}},1000);

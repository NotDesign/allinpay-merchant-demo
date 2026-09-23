import * as pdfjs from '../vendor/pdfjs/build/pdf.mjs';
import {prepareSmallScan} from './layout.mjs';
import {recoverCompactBR} from './compact-recovery.mjs';
import Tesseract from '../vendor/tesseract/tesseract.esm.min.js';
import {parseBR} from './parser.mjs';
import {rotateCanvas,estimateSkew,enhanceCanvas} from './image-processing.mjs';
const asset = path => new URL(`../vendor/${path}`, import.meta.url).href;
pdfjs.GlobalWorkerOptions.workerSrc=asset('pdfjs/build/pdf.worker.mjs');
const MAX_BYTES=10*1024*1024,MAX_PAGES=5,MAX_PIXELS=32_000_000;
export async function loadDocument(file) {
 if(!file||file.size===0)throw new Error('檔案是空的，請重新選擇。');
 if(file.size>MAX_BYTES)throw new Error('檔案超過 10 MB，請先縮小或拆分文件。');
 const signature=new Uint8Array(await file.slice(0,12).arrayBuffer());
 const pdf=String.fromCharCode(...signature.slice(0,5))==='%PDF-';
 const png=signature[0]===137&&signature[1]===80&&signature[2]===78&&signature[3]===71;
 const jpeg=signature[0]===255&&signature[1]===216&&signature[2]===255;
 if(!pdf&&!png&&!jpeg)throw new Error('請選擇真正的 PDF、JPG 或 PNG 檔案；目前不支援 HEIC 或其他格式。');
 if(pdf) {
  const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,disableAutoFetch:true,disableStream:true,cMapUrl:asset('pdfjs/cmaps/'),cMapPacked:true,standardFontDataUrl:asset('pdfjs/standard_fonts/'),wasmUrl:asset('pdfjs/wasm/'),useSystemFonts:false,stopAtErrors:true});
  let doc;
  try{doc=await task.promise;}catch(error){await task.destroy();if(error.name==='PasswordException')throw new Error('這是加密 PDF，請先在本機解鎖後再選擇。');throw new Error('PDF 無法開啟，請檢查檔案是否損毀。');}
  if(doc.numPages>MAX_PAGES){await task.destroy();throw new Error('測試版最多接受 5 頁，請只保留 BR 所在的頁面。');}
  return {kind:'pdf',pages:doc.numPages,name:file.name,size:file.size,async render(pageNumber){
   const page=await doc.getPage(pageNumber);const base=page.getViewport({scale:1});const scale=Math.min(3,2600/Math.max(base.width,base.height));const viewport=page.getViewport({scale});
   const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
   await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
   const content=await page.getTextContent();const rows=[];
   // Group text by baseline then by X; preserve table row order and adjacent date columns.
   for(const item of content.items){if(!item.str?.trim())continue;const x=item.transform[4],y=item.transform[5];let row=rows.find(r=>Math.abs(r.y-y)<Math.max(2,item.height*.3));if(!row){row={y,items:[]};rows.push(row);}row.items.push({x,text:item.str});}
   const text=rows.sort((a,b)=>b.y-a.y).map(row=>row.items.sort((a,b)=>a.x-b.x).map(i=>i.text).join(' ')).join('\n');
   page.cleanup();return {canvas,text};
  },destroy:()=>task.destroy()};
 }
 let bitmap;
 try{bitmap=await createImageBitmap(file);}catch{throw new Error('圖片無法解碼，請改存為 JPG 或 PNG。');}
 if(bitmap.width*bitmap.height>MAX_PIXELS){bitmap.close();throw new Error('圖片超過 3,200 萬像素，請先縮小圖片。');}
 return {kind:'image',pages:1,name:file.name,size:file.size,async render(){return {canvas:rotateCanvas(bitmap,0),text:''};},destroy(){bitmap.close();}};
}
export async function recognizeDocument({canvas,text,page=1,forceOCR=false,signal,onProgress=()=>{}}) {
 const abort=()=>{if(signal?.aborted)throw new DOMException('Aborted','AbortError');};abort();
 const native=parseBR(text,{method:'pdf-text',page});
 if(!forceOCR&&native.recognized&&native.fields.brNumber.value&&native.fieldCount>=6){
  onProgress({progress:1,label:'已讀取 PDF 文字，請對照原件核對。'});
  return {...native,rotation:0,skew:0,elapsed:0,ocrConfidence:null};
 }
 let worker=null,cancelled=false;
 const start=performance.now();let phase='載入本機中英文辨識模型';
 const cancel=()=>{cancelled=true;if(worker)void worker.terminate();};signal?.addEventListener('abort',cancel,{once:true});
 try {
  onProgress({progress:.02,label:phase});
  const workerPromise=Tesseract.createWorker(['eng','chi_tra'],Tesseract.OEM.LSTM_ONLY,{
   workerPath:asset('tesseract/worker.min.js'),
   corePath:asset('core/'),
   langPath:asset('lang'),
   cacheMethod:'none',workerBlobURL:false,
   logger:m=>{if(!cancelled)onProgress({progress:Math.max(.03,Math.min(.95,(m.progress||0)*.9)),label:phase});},
   errorHandler:()=>{},
  });
  workerPromise.then(w=>{if(signal?.aborted)void w.terminate();},()=>{});
  worker=await abortable(workerPromise,signal);if(cancelled){await worker.terminate();abort();}
  await abortable(worker.setParameters({preserve_interword_spaces:'1',tessedit_pageseg_mode:Tesseract.PSM.AUTO,user_defined_dpi:'300'}),signal);
  // Tiny web images need enlargement and value-column recovery before the general page OCR.
  if(Math.max(canvas.width,canvas.height)<1400){
   for(const rotation of [0,180,90,270]){
    abort();const turned=rotateCanvas(canvas,rotation);const correction=await estimateSkew(turned,signal);
    const aligned=rotateCanvas(turned,correction.angle);turned.width=1;
    try {
     const recovered=await recoverCompactBR({worker,canvas:aligned,page,signal,run:promise=>abortable(promise,signal),onProgress});
     if(recovered){onProgress({progress:1,label:'已完成分區辨識，請逐項核對低畫質欄位。'});return {...recovered,rotation,skew:correction.angle,elapsed:performance.now()-start};}
    }finally{aligned.width=1;}
   }
   await abortable(worker.reinitialize(['eng','chi_tra']),signal);
   await abortable(worker.setParameters({tessedit_pageseg_mode:Tesseract.PSM.AUTO,tessedit_char_whitelist:'',preserve_interword_spaces:'1'}),signal);
  }
  let best=null;
  for(const rotation of [0,180,90,270]) {
   abort();phase=rotation===0?'校正歪斜並辨識文件':'嘗試其他方向，自動轉正';onProgress({progress:.12,label:phase});
   const turned=rotateCanvas(canvas,rotation);const correction=await estimateSkew(turned,signal);abort();
   const aligned=rotateCanvas(turned,correction.angle);const enhanced=Math.max(aligned.width,aligned.height)<1400?prepareSmallScan(aligned):enhanceCanvas(aligned);turned.width=1;aligned.width=1;
   phase=`正在辨識${rotation?`（轉向 ${rotation}°）`:''}，文件仍在本機`;
   let data;
   try {({data}=await abortable(worker.recognize(enhanced,{}, {text:true,blocks:true}),signal));}finally{enhanced.width=1;enhanced.height=1;}
   abort();const result=parseBR(textByPosition(data),{method:'ocr',page});
   const candidate={...result,rotation,skew:correction.angle,ocrConfidence:Math.round(data.confidence),elapsed:performance.now()-start};
   if(correction.limited)candidate.warnings.push('歪斜角度接近校正上限，建議重新拍攝或掃描。');
   if(!best||candidate.score>best.score||(candidate.score===best.score&&candidate.ocrConfidence>best.ocrConfidence))best=candidate;
   if(result.recognized&&result.fields.brNumber.value&&result.fields.expiryDate.value&&result.fieldCount>=7&&data.confidence>=60)break;
  }
  if(best.ocrConfidence<65)best.warnings.push('文字辨識信心偏低，請仔細核對或改用較清晰的文件。');
  onProgress({progress:1,label:'辨識完成，請核對候選欄位。'});return best;
 } finally {signal?.removeEventListener('abort',cancel);if(worker)await worker.terminate().catch(()=>{});}
}

// OCR reading order can visit the entire label column before the value column.
// Rebuild physical rows from word coordinates before applying BR labels.
export function textByPosition(data) {
 const words=(data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>(p.lines||[]).flatMap(l=>l.words||[]))).filter(w=>w.text?.trim());
 if(!words.length)return data.text||'';
 const rows=[];
 for(const word of words.sort((a,b)=>a.bbox.y0-b.bbox.y0)){
  const box=word.bbox,h=box.y1-box.y0,cy=(box.y0+box.y1)/2;
  let row=rows.find(r=>Math.abs(r.cy-cy)<Math.max(r.height,h)*.55);
  if(!row){row={cy,height:h,words:[]};rows.push(row);}
  row.words.push(word);row.height=Math.max(row.height,h);
 }
 return rows.sort((a,b)=>a.cy-b.cy).map(r=>r.words.sort((a,b)=>a.bbox.x0-b.bbox.x0).map(w=>w.text).join(' ')).join('\n');
}

function abortable(promise,signal) {
 if(!signal)return promise;
 if(signal.aborted)return Promise.reject(new DOMException('Aborted','AbortError'));
 return new Promise((resolve,reject)=>{
  const abort=()=>{signal.removeEventListener('abort',abort);reject(new DOMException('Aborted','AbortError'));};
  signal.addEventListener('abort',abort,{once:true});
  promise.then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});
 });
}

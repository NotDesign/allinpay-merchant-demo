import {parseBR,parseDate} from './parser.mjs?v=20260929-uploads';
import {ocrRows,cropCanvas,prepareSmallScan,findCompactLayout} from './layout.mjs';

// Printed labels locate the value column. Never identify a document by filename,
// company name, certificate number, or a cached customer-specific answer.
export async function recoverLabelledBR({worker,canvas,page,signal,run,onProgress=()=>{}}){
 const check=()=>{if(signal?.aborted)throw new DOMException('Aborted','AbortError');};
 check();await run(worker.reinitialize('eng'));
 await run(worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1',tessedit_char_whitelist:'',user_defined_dpi:'300'}));
 const prepared=prepareSmallScan(canvas);
 try{
  onProgress({progress:.28,label:'依印刷標籤定位 BR 欄位，排除頁框與說明文字'});
  const {data}=await run(worker.recognize(prepared,{}, {text:true,blocks:true}));
  const layout=findCompactLayout(data,prepared.width,prepared.height);if(!layout)return null;
  const rows=ocrRows(data),statusIndex=layout.status.words.findIndex(w=>/^(BODY|INDIVIDUAL|PARTNERSHIP|UNINCORPORATED)$/i.test(w.text));
  if(statusIndex<0)return null;
  const x=layout.status.words[statusIndex].bbox.x0,h=layout.company.height;
  const label=(pattern)=>rows.find(r=>pattern.test(r.words.filter(w=>w.bbox.x1<x-10).map(w=>w.text).join(' ')));
  const name=label(/^Name of Business\/?$/i),branch=label(/^Branch Name$/i),address=label(/^Address$/i),nature=label(/^Nature of Business$/i),status=label(/\bStatus$/i);
  const dates=rows.find(r=>/Date of Commencement.*Date of Expiry.*Certificate No/i.test(r.words.map(w=>w.text).join(' ')));
  if(!name||!branch||!address||!nature||!status||!dates||!(name.cy<branch.cy&&branch.cy<address.cy&&address.cy<nature.cy&&nature.cy<status.cy&&status.cy<dates.cy))return null;
  // Dashed vertical borders otherwise become repeated I / 1 OCR characters.
  const narrow=rows.flatMap(r=>r.words).filter(w=>w.bbox.x0>x+h*15&&w.bbox.x1-w.bbox.x0<h*.4);
  const border=narrow.find(w=>narrow.filter(v=>Math.abs(v.bbox.x0-w.bbox.x0)<h*.3).length>=8);
  const right=border?border.bbox.x0-h*.5:prepared.width;
  const labelTop=r=>Math.min(...r.words.filter(w=>w.bbox.x1<x-10).map(w=>w.bbox.y0))-h*2;
  const companyWords=layout.company.words.filter(w=>w.bbox.x0>=x-h*.5&&w.bbox.x1<right);
  if(!companyWords.length)return null;
  const company=companyWords.map(w=>w.text).join(' ');
  const boxes={
   businessNameEn:{x:x-h*.5,y:Math.min(...companyWords.map(w=>w.bbox.y0))-h*.5,width:right-x,height:h*2},
   businessAddressEn:{x:x-h*.5,y:labelTop(address),width:right-x,height:labelTop(nature)-labelTop(address)},
   natureOfBusiness:{x:x-h*.5,y:labelTop(nature),width:right-x,height:Math.min(...layout.status.words.slice(statusIndex,statusIndex+2).map(w=>w.bbox.y0))-labelTop(nature)-h*.5},
   legalStatus:{x:x-h*.5,y:Math.min(...layout.status.words.slice(statusIndex,statusIndex+2).map(w=>w.bbox.y0))-h*.4,width:right-x,height:h*2},
  };
  const read={},sources=[];
  for(const [key,box]of Object.entries(boxes)){
   check();const piece=cropCanvas(prepared,box,1.5);
   try{const {data:found}=await run(worker.recognize(piece,{}, {text:true,blocks:true}));
    const lines=ocrRows(found).map(r=>r.words.map(w=>w.text).join(' ').trim()).filter(Boolean);
    read[key]={value:lines.join(' '),confidence:found.confidence};sources.push(found.text.trim());
   }finally{piece.width=1;}
  }
  // Require the separately cropped name to agree with the location pass.
  if(read.businessNameEn.value!==company||read.businessNameEn.confidence<75||!read.businessAddressEn.value)return null;
  const dateRow=rows.find(r=>r.cy>dates.cy&&r.cy<dates.cy+h*4&&r.words.filter(w=>parseDate(w.text)).length===2);
  if(!dateRow)return null;
  const tokens=dateRow.words.filter(w=>parseDate(w.text));
  const cert=dateRow.words.find(w=>/^\d{8}-\d{3}(?:-\d{2}-\d{2}-[A-Z0-9])?$/i.test(w.text));
  if(!cert)return null;
  const dateValues={};
  await run(worker.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-/',preserve_interword_spaces:'0'}));
  for(const [key,word]of [['startDate',tokens[0]],['expiryDate',tokens[1]],['certificateNumber',cert]]){
   const b=word.bbox,piece=cropCanvas(prepared,{x:b.x0-8,y:b.y0-8,width:b.x1-b.x0+16,height:b.y1-b.y0+16},1.5);
   try{const {data:found}=await run(worker.recognize(piece,{}, {text:true}));const value=found.text.trim();
    if(value!==word.text)return null;dateValues[key]=value;sources.push(value);
   }finally{piece.width=1;}
  }
  const text=['Business Registration Certificate',`Name of Business/Corporation ${read.businessNameEn.value}`,'Business/Branch Name',`Address ${read.businessAddressEn.value}`,`Nature of Business ${read.natureOfBusiness.value}`,`Status ${read.legalStatus.value}`,`Date of Commencement ${dateValues.startDate}`,`Date of Expiry ${dateValues.expiryDate}`,`Certificate No. ${dateValues.certificateNumber}`].join('\n');
  const result=parseBR(text,{method:'ocr-regions',page});
  if(!result.recognized||!result.fields.legalStatus.value)return null;
  for(const [key,r]of Object.entries(read)){
   result.fields[key].source=r.value;result.fields[key].confidence=r.confidence;
   // The name was independently read twice with exact agreement; still reviewed
   // by the user before applying, like all other selected candidates.
   result.fields[key].autoSelect=r.confidence>=80||(key==='businessNameEn'&&r.confidence>=75);
   if(!result.fields[key].autoSelect)result.fields[key].warning='分區辨識信心不足，請對照原件後再選取。';
  }
  result.rawText=sources.join('\n');result.recovered=true;result.ocrConfidence=null;
  result.warnings.push('已按標籤分區核對。中文名稱／地址如未印在原件，請保持空白；不會自動翻譯。');
  return result;
 }finally{prepared.width=1;}
}

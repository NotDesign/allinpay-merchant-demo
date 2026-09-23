import {parseBR,parseDate} from './parser.mjs';
import {findCompactLayout,cropCanvas,prepareSmallScan,ocrRows,adaptiveCanvas} from './layout.mjs';
const flatText=data=>ocrRows(data).map(r=>r.words.map(w=>w.text).join(' ')).join('\n')||data.text||'';
const trimText=text=>text.split('\n').map(s=>s.trim().replace(/^[|~_’'`]+\s*|[\s|~_]+$/g,'')).filter(s=>/[A-Za-z0-9\u3400-\u9fff]/.test(s)).join('\n');
const validLatinLine=line=>/^[A-Z0-9][A-Z0-9 /,.'’&()#*-]*$/.test(line)&&(line.match(/[A-Z]/g)||[]).length>=2;
function aborted(signal){if(signal?.aborted)throw new DOMException('Aborted','AbortError');}
// Recover the value column only after finding a printed company-name row and legal-status row.
// Regions are derived from those anchors, not from filenames, known values or fixed pixel coordinates.
export async function recoverCompactBR({worker,canvas,page,signal,run,onProgress=()=>{}}){
 aborted(signal);await run(worker.reinitialize('eng'));await run(worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1',tessedit_char_whitelist:'',user_defined_dpi:'300'}));
 const prepared=prepareSmallScan(canvas);let regions={};let nameImage=null;
 try{
  onProgress({progress:.35,label:'放大小字，辨識舊版 BR 的欄位位置'});
  const {data}=await run(worker.recognize(prepared,{}, {text:true,blocks:true}));aborted(signal);
  const layout=findCompactLayout(data,prepared.width,prepared.height);if(!layout)return null;
  const {company,status,span}=layout;const x=company.x-8,n=company.row.cy,s=status.cy;
  const geometry={address:{x,y:n+span*.34,width:prepared.width-x,height:span*.43},nature:{x,y:s-span*.27,width:prepared.width-x,height:span*.22},status:{x,y:s-span*.06,width:prepared.width-x,height:span*.14},dates:{x:Math.max(0,x-span*.7),y:s+span*.10,width:prepared.width,height:span*.42}};
  const extracted={};const alternate={};const rawParts=[{label:'整頁定位',text:flatText(data)}];
  for(const[key,box]of Object.entries(geometry)){
   aborted(signal);onProgress({progress:.45,label:'逐區讀取公司資料、地址和證書日期'});
   const region=cropCanvas(prepared,box);regions[key]=region;
   const {data:found}=await run(worker.recognize(region,{}, {text:true,blocks:true}));
   extracted[key]={data:found,text:trimText(flatText(found)),confidence:found.confidence};rawParts.push({label:key,text:flatText(found)});
  }
  for(const key of ['address','dates']){
   const image=adaptiveCanvas(regions[key]);
   try{const {data:found}=await run(worker.recognize(image,{}, {text:true,blocks:true}));alternate[key]={data:found,text:trimText(flatText(found)),confidence:found.confidence};rawParts.push({label:key+' / 對比處理',text:flatText(found)});}finally{image.width=1;}
  }
  const dates=extracted.dates;

  const dateRow=ocrRows(dates.data).find(row=>row.words.filter(w=>/\d{1,2}\/\d{1,2}\/\d{4}/.test(w.text)).length>=2);
  if(!dateRow)return null; // No date table: do not impose BR structure on arbitrary documents.
  const dateTokens=dateRow.words.filter(w=>/\d{1,2}\/\d{1,2}\/\d{4}/.test(w.text));
  const certToken=dateRow.words.find(w=>/[0-9Xx].*-{1,2}[0-9Xx]/.test(w.text)&&w.bbox.x0>dateTokens[1].bbox.x1);
  const alternateRow=ocrRows(alternate.dates.data).find(row=>row.words.filter(w=>/\d{1,2}\/\d{1,2}\/\d{4}/.test(w.text)).length>=2);
  const alternateDates=alternateRow?.words.filter(w=>/\d{1,2}\/\d{1,2}\/\d{4}/.test(w.text))||[];
  const alternateCert=alternateRow?.words.find(w=>/[0-9Xx].*-{1,2}[0-9Xx]/.test(w.text)&&w.bbox.x0>alternateDates[1]?.bbox.x1)?.text||'';
  const detail=[];

  await run(worker.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-/',preserve_interword_spaces:'0'}));
  for(const [key,token]of [['startDate',dateTokens[0]],['expiryDate',dateTokens[1]],['brNumber',certToken]]){
   if(!token)continue;aborted(signal);const b=token.bbox;
   const piece=cropCanvas(regions.dates,{x:b.x0-5,y:b.y0-5,width:b.x1-b.x0+10,height:b.y1-b.y0+10},1.5);
   try{const {data:read}=await run(worker.recognize(piece,{}, {text:true}));detail.push({key,first:token.text,second:read.text.trim(),confidence:read.confidence,firstConfidence:token.confidence});rawParts.push({label:key,text:read.text.trim()});}finally{piece.width=1;}
  }
  const baseAddress=extracted.address.text.split('\n').filter(validLatinLine).join(' ');
  const columnAddress=layout.rows.filter(row=>row.cy>=geometry.address.y&&row.cy<geometry.address.y+geometry.address.height).map(row=>row.words.filter(w=>w.bbox.x0>=x&&w.bbox.x1<x+span*2).map(w=>w.text).join(' ')).filter(validLatinLine).join(' ');
  const address=columnAddress.replace(/\s/g,'')===baseAddress.replace(/\s/g,'')?columnAddress:baseAddress;
  const source=['Business Registration Certificate',`Name of Business/Corporation ${company.value}`,'Business/Branch Name',`Address ${address}`,`Nature of Business ${extracted.nature.text.split('\n').filter(validLatinLine).join(' ')}`,`Status ${extracted.status.text.split('\n').filter(validLatinLine).join(' ')}`].join('\n');
  const result=parseBR(source,{method:'ocr',page});result.warnings=[];result.rawText=rawParts.map(p=>`[${p.label}]\n${p.text}`).join('\n\n');result.recovered=true;
  const set=(key,value,source,confidence)=>{result.fields[key]={...result.fields[key],value,source,confidence,reviewRequired:true,lowResolution:true,autoSelect:confidence===undefined||confidence>=80};if(confidence!==undefined&&confidence<80)result.fields[key].warning=['certificateNumber','startDate'].includes(key)?'小字辨識信心不足，請對照原件核對。':'小字辨識信心不足，尚未勾選帶入；請對照原件修正或確認。';};
  for(const field of ['businessNameEn','businessAddressEn','natureOfBusiness','legalStatus'])result.fields[field].lowResolution=true;
  result.fields.businessNameEn.source=company.words.map(w=>w.text).join(' ');
  result.fields.businessAddressEn.source=extracted.address.text;result.fields.natureOfBusiness.source=extracted.nature.text;result.fields.legalStatus.source=extracted.status.text;
  const addressVariant=alternate.address.text.split('\n').filter(validLatinLine).join(' ');
  if(alternate.address.confidence>=60&&addressVariant&&addressVariant.replace(/\s/g,'')!==address.replace(/\s/g,'')){
   result.fields.businessAddressEn.autoSelect=false;
   result.fields.businessAddressEn.warning='地址有字元在不同影像處理中不一致，請對照原件修正後勾選帶入。';
   result.fields.businessAddressEn.alternatives=[addressVariant];
  }
  for(const item of detail){

   if(item.key==='brNumber'){
    if(/[Xx]{2,}/.test(item.first+item.second+alternateCert)){
     result.maskedBR=true;result.fields.brNumber.warning='證書號碼有遮蔽字元，請使用未遮蔽文件或手動補充。';
     result.warnings.push('BR 號碼被 X 遮蔽：其他可讀欄位仍可帶入，號碼保持空白。');continue;
    }
    const candidates=[item.first,item.second,alternateCert].map(v=>v.match(/(?<![\dA-Z])(\d{8})-{1,2}(\d{3})(?!\d)/)?.slice(1).join('-')).filter(Boolean);
    const unique=[...new Set(candidates)];
    if(unique.length===1)set('brNumber',unique[0],`${item.first}\n${item.second}`,item.confidence);
    else if(unique.length>1){result.fields.brNumber.alternatives=unique;result.fields.brNumber.warning='兩次辨識的數字不一致，請對照原件輸入。';result.warnings.push('BR 號碼的辨識版本不一致，已留空，沒有自動挑選數字。');}
    const full=([item.second,alternateCert].find(v=>/\b\d{8}-\d{3}-\d{2}-\d{2}-[A-Z0-9]\b/.test(v))||'').match(/\b\d{8}-\d{3}-\d{2}-\d{2}-[A-Z0-9]\b/);if(full&&unique.length===1)set('certificateNumber',full[0],item.second,item.confidence);
   }else{
    const candidates=[...new Set([parseDate(item.first),item.confidence>=40?parseDate(item.second):'',parseDate(alternateDates[item.key==='startDate'?0:1]?.text||'')].filter(Boolean))];
    if(candidates.length===1)set(item.key,candidates[0],`${item.first}\n${item.second}`,Math.max(item.firstConfidence||0,item.confidence));
    else if(candidates.length>1){result.fields[item.key].alternatives=candidates;result.fields[item.key].warning='兩次日期辨識不一致，請對照原件輸入。';result.warnings.push('有日期在兩次辨識中不一致，該欄位已留空供核對。');}
   }
  }
  // Chinese names are a separate script and can be above the English-name row.
  await run(worker.reinitialize('chi_tra'));await run(worker.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:'',preserve_interword_spaces:'0'}));
  nameImage=cropCanvas(prepared,{x,y:n-company.height*2.6,width:prepared.width-x,height:company.height*1.65});
  const {data:chinese}=await run(worker.recognize(nameImage,{}, {text:true}));
  const zh=chinese.text.trim().replace(/\s+/g,'').replace(/[|~_]+$/g,'');
  // Leave a tiny/uncertain Chinese line empty rather than making up a company name.
  if(chinese.confidence>=75&&/[\u3400-\u9fff]{4}/.test(zh)&&/^[Xx0-9A-Z\u3400-\u9fff（）()·.&-]+$/.test(zh))set('businessNameZh',zh,chinese.text.trim(),chinese.confidence);
  if(result.fields.expiryDate.value&&result.fields.expiryDate.value<new Date().toISOString().slice(0,10))result.warnings.push('這張 BR 的屆滿日期已過，請確認是否有更新版本。');
  result.warnings.unshift('這張圖片解析度較低，已放大並分區辨識。姓名、地址、日期和號碼可能有錯字，帶入前請逐一核對。');
  if(!result.fields.brNumber.value&&!result.maskedBR&&!result.fields.brNumber.alternatives)result.warnings.push('未能可靠讀取完整 BR 號碼；可先帶入其他欄位。');
  result.recognized=true;result.fieldCount=Object.values(result.fields).filter(f=>f.value).length;result.score=20+result.fieldCount*4;
  result.ocrConfidence=null;return result;
 }finally{prepared.width=1;for(const image of Object.values(regions))image.width=1;if(nameImage)nameImage.width=1;}
}

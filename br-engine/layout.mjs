// Layout helpers for compact, older Hong Kong BR scans. No customer values/templates stored.
export function ocrRows(data) {
 const words=(data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>(p.lines||[]).flatMap(l=>l.words||[]))).filter(w=>w.text?.trim());
 const rows=[];
 for(const word of words.sort((a,b)=>a.bbox.y0-b.bbox.y0)){
  const box=word.bbox,h=box.y1-box.y0,cy=(box.y0+box.y1)/2;
  let row=rows.find(r=>Math.abs(r.cy-cy)<Math.max(r.height,h)*.55);
  if(!row){row={cy,height:h,words:[]};rows.push(row);}row.words.push(word);row.height=Math.max(row.height,h);
 }
 return rows.sort((a,b)=>a.cy-b.cy).map(r=>({...r,words:r.words.sort((a,b)=>a.bbox.x0-b.bbox.x0)}));
}
export function findCompactLayout(data,width,height) {
 const rows=ocrRows(data);let company=null;
 for(const row of rows){
  if(row.cy<height*.12||row.cy>height*.40)continue;
  const last=row.words.findLastIndex(w=>/^(?:COMPANY|LIMITED|LTD\.?|CORPORATION)$/i.test(w.text));if(last<0)continue;
  const suffix=row.words[last];const charHeight=suffix.bbox.y1-suffix.bbox.y0;
  let first=last;
  while(first>0){const w=row.words[first-1];if(!/^[A-Z0-9&.'’()-]+$/.test(w.text)||w.bbox.y1-w.bbox.y0<charHeight*.65||row.words[first].bbox.x0-w.bbox.x1>charHeight*5)break;first--;}
  if(last-first<1)continue;
  const words=row.words.slice(first,last+1);const candidate={row,words,value:words.map(w=>w.text).join(' '),x:words[0].bbox.x0,height:charHeight};
  if(!company||candidate.words.length>company.words.length)company=candidate;
 }
 if(!company)return null;
 const status=rows.find(r=>r.cy>company.row.cy+height*.10&&r.cy<height*.67&&/\b(?:BODY\s+CORPORATE|INDIVIDUAL|PARTNERSHIP|UNINCORPORATED\s+BODY)\b/i.test(r.words.map(w=>w.text).join(' ')));
 if(!status)return null;
 const span=status.cy-company.row.cy;
 if(span<height*.15||span>height*.38)return null;
 return {company,status,span,rows};
}
export function cropCanvas(source,{x,y,width,height},scale=1){
 const left=Math.max(0,Math.floor(x)),top=Math.max(0,Math.floor(y));
 const w=Math.max(1,Math.min(source.width-left,Math.ceil(width))),h=Math.max(1,Math.min(source.height-top,Math.ceil(height)));
 const canvas=document.createElement('canvas');canvas.width=w*scale;canvas.height=h*scale;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingQuality='high';ctx.drawImage(source,left,top,w,h,0,0,canvas.width,canvas.height);return canvas;
}
export function prepareSmallScan(source,mode='color-lift'){
 const scale=Math.max(1,Math.min(4,2500/Math.max(source.width,source.height)));
 const canvas=cropCanvas(source,{x:0,y:0,width:source.width,height:source.height},scale);
 const ctx=canvas.getContext('2d',{willReadFrequently:true});const frame=ctx.getImageData(0,0,canvas.width,canvas.height),d=frame.data;
 for(let i=0;i<d.length;i+=4){let v=Math.max(d[i],d[i+1],d[i+2]);if(mode==='contrast')v=Math.max(0,Math.min(255,(v-145)*2.4));d[i]=d[i+1]=d[i+2]=v;}
 ctx.putImageData(frame,0,0);return canvas;
}
export function adaptiveCanvas(source){
 const canvas=cropCanvas(source,{x:0,y:0,width:source.width,height:source.height});
 const ctx=canvas.getContext('2d',{willReadFrequently:true}),frame=ctx.getImageData(0,0,canvas.width,canvas.height),d=frame.data,W=canvas.width,H=canvas.height;
 const integral=new Float64Array((W+1)*(H+1));
 for(let y=0;y<H;y++){let sum=0;for(let x=0;x<W;x++){sum+=d[(y*W+x)*4];integral[(y+1)*(W+1)+x+1]=integral[y*(W+1)+x+1]+sum;}}
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const x0=Math.max(0,x-28),x1=Math.min(W,x+29),y0=Math.max(0,y-28),y1=Math.min(H,y+29);
  const mean=(integral[y1*(W+1)+x1]-integral[y0*(W+1)+x1]-integral[y1*(W+1)+x0]+integral[y0*(W+1)+x0])/((x1-x0)*(y1-y0));
  const i=(y*W+x)*4,v=d[i]<mean-10?0:255;d[i]=d[i+1]=d[i+2]=v;
 }
 ctx.putImageData(frame,0,0);return canvas;
}

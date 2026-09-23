export function rotateCanvas(source,degrees,maxSide=2600) {
 const theta=degrees*Math.PI/180;const scale=Math.min(1,maxSide/Math.max(source.width,source.height));
 const w=source.width*scale,h=source.height*scale;const result=document.createElement('canvas');
 result.width=Math.ceil(Math.abs(w*Math.cos(theta))+Math.abs(h*Math.sin(theta)));
 result.height=Math.ceil(Math.abs(w*Math.sin(theta))+Math.abs(h*Math.cos(theta)));
 const ctx=result.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,result.width,result.height);
 ctx.translate(result.width/2,result.height/2);ctx.rotate(theta);ctx.drawImage(source,-w/2,-h/2,w,h);return result;
}
// Projection profile search; handles planar skew up to 15 degrees, not perspective correction.
export async function estimateSkew(source,signal) {
 const small=rotateCanvas(source,0,800);const {width:w,height:h}=small;
 const data=small.getContext('2d').getImageData(0,0,w,h).data;const points=[];
 for(let y=8;y<h-8;y++)for(let x=8;x<w-8;x++){const i=(y*w+x)*4;if((data[i]+data[i+1]+data[i+2])/3<125)points.push([x-w/2,y-h/2]);}
 small.width=1;small.height=1;
 if(points.length<100)return {angle:0,limited:false};
 function score(angle){const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);const bins=new Float64Array(Math.ceil(w+h)+4);const off=Math.floor(bins.length/2);
 for(const [x,y]of points){const i=Math.round(x*s+y*c)+off;if(i>=0&&i<bins.length)bins[i]++;}
 let sum=0;for(let i=1;i<bins.length;i++)sum+=bins[i]**2;return sum;
 }
 let best={angle:0,score:score(0)};
 for(let angle=-15;angle<=15;angle+=0.5){if(signal?.aborted)throw new DOMException('Aborted','AbortError');const value=score(angle);if(value>best.score)best={angle,score:value};
 if(angle%5===0)await new Promise(resolve=>setTimeout(resolve,0));}
 const base=score(0);const angle=best.score>base*1.08?best.angle:0;
 return {angle,limited:Math.abs(angle)>=14.5};
}
export function enhanceCanvas(source) {
 const result=rotateCanvas(source,0);const ctx=result.getContext('2d',{willReadFrequently:true});const frame=ctx.getImageData(0,0,result.width,result.height);
 const d=frame.data;for(let i=0;i<d.length;i+=4){const g=.299*d[i]+.587*d[i+1]+.114*d[i+2];const v=Math.max(0,Math.min(255,(g-128)*1.18+140));d[i]=d[i+1]=d[i+2]=v;}
 ctx.putImageData(frame,0,0);return result;
}

const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const root=(process.env.DEMO_URL||'http://127.0.0.1:4340/backoffice.html').replace(/\/(backoffice|external|index)\.html.*$/,''),errors=[],checks=[];
const originalSha='41350467a3bbe2326eb386d069547c65d1e6727d1088f07680102978660d5f56',whiteSha='5ba6765e16f15c8536d1297b1209c5b1bb237c6fae3a914ac074108d67236b6d';
async function artwork(p,selector,label,tone='original'){
 const white=tone==='white',expectedSha=white?whiteSha:originalSha;
 const img=p.locator(selector+' img[alt="Mee Pay — Mobility evolution ethics"]');
 assert.equal(await img.count(),1,label+' logo exists');
 await img.evaluate(async e=>{await e.decode()});
 const result=await img.evaluate(e=>{
  const c=document.createElement('canvas');c.width=e.naturalWidth;c.height=e.naturalHeight;
  const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(e,0,0);
  const pixel=(x,y)=>Array.from(ctx.getImageData(x,y,1,1).data);
  const r=e.getBoundingClientRect(),w=e.parentElement.getBoundingClientRect();
  return {src:e.src,width:e.naturalWidth,height:e.naturalHeight,ratio:r.width/r.height,
   wrapperBackground:getComputedStyle(e.parentElement).backgroundColor,linkBackground:getComputedStyle(e.parentElement.parentElement).backgroundColor,imageFilter:getComputedStyle(e).filter,
   wrapper:{left:w.left,right:w.right,top:w.top,bottom:w.bottom,width:w.width,height:w.height},
   background:pixel(100,100),letterCounter:pixel(1185,360),letterCounterP:pixel(1430,320),title:pixel(1040,340),tagline:pixel(1030,510),fingerprint:pixel(600,330),shape:pixel(600,390)};
 });
 assert.equal(result.width,2060);assert.equal(result.height,763);
 assert(Math.abs(result.ratio-2060/763)<.01,label+' original image proportions');
 assert(result.background[3]<=1,label+' real transparent background');
 assert(result.letterCounter[3]<=1&&result.letterCounterP[3]<=1,label+' letter counters also show the background');
 assert.equal(result.wrapperBackground,'rgba(0, 0, 0, 0)',label+' no white logo wrapper');
 assert.equal(result.linkBackground,'rgba(0, 0, 0, 0)',label+' no white logo link');
 assert.equal(result.imageFilter,'none',label+' no recoloring filter');
 // Brave may add one-bit canvas noise; the independent SHA check below still requires exact original asset bytes.
 const pixel=(actual,expected,name)=>assert(actual.every((v,i)=>Math.abs(v-expected[i])<=(i===3?1:2)),label+' '+name+': '+JSON.stringify(actual));
 pixel(result.title,white?[255,255,255,255]:[46,35,53,255],white?'white title on dark background':'original title on light background');
 pixel(result.tagline,white?[255,255,255,255]:[49,39,56,255],white?'white tagline on dark background':'original tagline on light background');
 pixel(result.fingerprint,[247,240,249,255],'fingerprint remains opaque');
 pixel(result.shape,[140,116,216,255],'original artwork color');
 assert(Math.abs(result.wrapper.width/result.wrapper.height-1384/458)<.015,label+' complete artwork frame');
 const bytes=result.src.startsWith('data:')?Buffer.from(result.src.split(',')[1],'base64'):await (await p.request.get(result.src)).body();
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),expectedSha,label+' correct logo bytes');
 return result;
}
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));
  await p.goto(root+'/backoffice.html#/login');
  for(const width of [1440,1024,768,390,320]){
   await p.setViewportSize({width,height:1000});const r=await artwork(p,'.auth-brand-panel .brand','Backend login '+width,'white');
   assert(r.wrapper.left>=0&&r.wrapper.right<=width,'Backend login logo fits');
   if(width===1440||width===390)await p.screenshot({path:'qa-mee-pay-backoffice-login-'+width+'.png'});
  }
  await p.locator('[data-action="pick-role"]').first().click();await p.locator('[data-action="bo-login"]').click();await p.waitForSelector('.metrics');
  for(const width of [1440,1024,768,390,320]){
   await p.setViewportSize({width,height:1000});if(await p.locator('.mobile-menu').isVisible()&&!await p.locator('.sidebar').evaluate(e=>e.classList.contains('open')))await p.locator('[data-action="mobile-menu"]').click();
   await p.waitForFunction(()=>{const t=getComputedStyle(document.querySelector('.sidebar')).transform;return t==='none'||Math.abs(new DOMMatrixReadOnly(t).m41)<.01;});
   const r=await artwork(p,'.sidebar .brand','Backend sidebar '+width,'white');assert(r.wrapper.left>=0&&r.wrapper.right<=width,JSON.stringify({width,rect:r.wrapper}));
   for(const text of ['儀表板','商戶入網','新增商戶','商戶管理','內審控制台'])assert((await p.locator('.sidebar').innerText()).includes(text),'Side menu retains '+text);
   if(width===1440||width===390)await p.locator('.sidebar').screenshot({path:'qa-mee-pay-sidebar-'+width+'.png'});
  }
  await p.setViewportSize({width:1440,height:1000});await p.goto(root+'/external.html#/login');
  for(const width of [1440,1024,768,390,320]){
   await p.setViewportSize({width,height:1000});const r=await artwork(p,'.auth-top .brand','External login '+width);assert(r.wrapper.left>=0&&r.wrapper.right<=width);
   if(width===1440||width===390)await p.screenshot({path:'qa-mee-pay-external-login-'+width+'.png'});
  }
  await p.locator('#authEmail').fill('brand.qa@example.com');await p.locator('[data-action="login"]').click();for(let i=0;i<6;i++)await p.locator('[data-otp="'+i+'"]').fill(''+(i+1));await p.locator('[data-action="verify"]').click();await p.waitForSelector('.header');
  for(const width of [1440,1024,768,390,320]){await p.setViewportSize({width,height:1000});const r=await artwork(p,'.header .brand','External header '+width);assert(r.wrapper.left>=0&&r.wrapper.right<=width);}
  checks.push('Backend login/sidebar and External login/header at 1440/1024/768/390/320: original artwork proportions, transparent alpha and CSS containers without white backgrounds, white backend wordmark, original dark External wordmark, unchanged colored symbol/fingerprint, expected asset hash and preserved side menu');
  assert.deepEqual(errors,[]);fs.writeFileSync('qa-brand-report.json',JSON.stringify({passed:true,root,date:new Date().toISOString(),assetSha256:{original:originalSha,white:whiteSha},checks,errors},null,2));console.log('PASS Mee Pay brand:',checks.join('\n'));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});

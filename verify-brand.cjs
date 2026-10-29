const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const root=(process.env.DEMO_URL||'http://127.0.0.1:4340/backoffice.html').replace(/\/(backoffice|external|index)\.html.*$/,''),errors=[],checks=[];
const expectedSha='bd887c2f1b0bf6363308b9994695b7f23a9960414a089030ae6ec2191f595094';
async function artwork(p,selector,label){
 const img=p.locator(selector+' img[alt="Mee Pay — Mobility evolution ethics"]');
 assert.equal(await img.count(),1,label+' logo exists');
 await img.evaluate(async e=>{await e.decode()});
 const result=await img.evaluate(e=>{
  const c=document.createElement('canvas');c.width=e.naturalWidth;c.height=e.naturalHeight;
  const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(e,0,0);
  const pixel=(x,y)=>Array.from(ctx.getImageData(x,y,1,1).data);
  const r=e.getBoundingClientRect(),w=e.parentElement.getBoundingClientRect();
  return {src:e.src,width:e.naturalWidth,height:e.naturalHeight,ratio:r.width/r.height,
   wrapper:{left:w.left,right:w.right,top:w.top,bottom:w.bottom,width:w.width,height:w.height},
   background:pixel(100,100),title:pixel(1040,340),tagline:pixel(1030,510),fingerprint:pixel(600,330),shape:pixel(600,390)};
 });
 assert.equal(result.width,2060);assert.equal(result.height,763);
 assert(Math.abs(result.ratio-2060/763)<.01,label+' original image proportions');
 assert(result.background[3]<=1,label+' real transparent background');
 // Brave may add one-bit canvas noise; the independent SHA check below still requires exact original asset bytes.
 const pixel=(actual,expected,name)=>assert(actual.every((v,i)=>Math.abs(v-expected[i])<=(i===3?1:2)),label+' '+name+': '+JSON.stringify(actual));
 pixel(result.title,[46,35,53,255],'original title color');
 pixel(result.tagline,[49,39,56,255],'original tagline color');
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
   await p.setViewportSize({width,height:1000});const r=await artwork(p,'.auth-brand-panel .brand','Backend login '+width);
   assert(r.wrapper.left>=0&&r.wrapper.right<=width,'Backend login logo fits');
   if(width===1440||width===390)await p.screenshot({path:'qa-mee-pay-backoffice-login-'+width+'.png'});
  }
  await p.locator('[data-action="pick-role"]').first().click();await p.locator('[data-action="bo-login"]').click();await p.waitForSelector('.metrics');
  for(const width of [1440,1024,768,390,320]){
   await p.setViewportSize({width,height:1000});if(await p.locator('.mobile-menu').isVisible()&&!await p.locator('.sidebar').evaluate(e=>e.classList.contains('open')))await p.locator('[data-action="mobile-menu"]').click();
   await p.waitForFunction(()=>{const t=getComputedStyle(document.querySelector('.sidebar')).transform;return t==='none'||Math.abs(new DOMMatrixReadOnly(t).m41)<.01;});
   const r=await artwork(p,'.sidebar .brand','Backend sidebar '+width);assert(r.wrapper.left>=0&&r.wrapper.right<=width,JSON.stringify({width,rect:r.wrapper}));
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
  checks.push('Backend login/sidebar and External login/header at 1440/1024/768/390/320: original artwork proportions, transparent alpha, exact title/tagline/fingerprint/artwork colors, expected asset hash and preserved side menu');
  assert.deepEqual(errors,[]);fs.writeFileSync('qa-brand-report.json',JSON.stringify({passed:true,root,date:new Date().toISOString(),assetSha256:expectedSha,checks,errors},null,2));console.log('PASS Mee Pay brand:',checks.join('\n'));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});

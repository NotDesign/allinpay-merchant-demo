const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const root=(process.env.DEMO_URL||'http://127.0.0.1:4321/backoffice.html').replace(/\/(backoffice|external|index)\.html.*$/,''),checks=[],errors=[];
const click=async(p,action)=>{const modal=p.locator('#modal[open] [data-action="'+action+'"]');await(await modal.count()?modal.first():p.locator('[data-action="'+action+'"]').first()).click();};
const input=p=>p.locator('#sdd-search-input'),panel=p=>p.locator('#searchable-select-popover');
async function choose(p,select,query,value){
 await select.click();await input(p).waitFor();await input(p).fill(query);
 const index=await select.evaluate((el,value)=>Array.from(el.options).findIndex(o=>o.value===value),value);assert(index>=0,'Native option exists: '+value);
 await p.locator('#sdd-options [data-sdd-option="'+index+'"]').click();await panel(p).waitFor({state:'detached'});
}
async function inspectSelects(p,label){
 const select=p.locator('select:visible:enabled');let tested=0;
 for(let index=0;index<await select.count();index++){
  const el=select.nth(index);if(await el.evaluate(e=>e.multiple||e.size>1))continue;
  const before=await el.inputValue();await el.click();try{await input(p).waitFor({timeout:2500});}catch(error){throw Error(label+' select '+index+' did not open: '+JSON.stringify(await el.evaluate(e=>({id:e.id,html:e.outerHTML.slice(0,300),rect:e.getBoundingClientRect().toJSON(),focus:document.activeElement?.outerHTML.slice(0,200),panel:document.querySelector("#searchable-select-popover")?.outerHTML.slice(0,200)}))));}
  const query=await el.evaluate(e=>Array.from(e.options).find(o=>!o.disabled&&!o.hidden&&o.value)?.label||'');if(query){await input(p).fill(query);assert(await p.locator('#sdd-options [data-sdd-option]').count()>0,label+': search match');}
  await input(p).press('Escape');assert.equal(await el.inputValue(),before,label+': search/Escape do not change data');assert.equal(await panel(p).count(),0);tested++;
 }
 return tested;
}
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});try{for(const surface of ['backoffice','external']){
 const context=await browser.newContext({viewport:{width:1600,height:1100}}),p=await context.newPage();p.on('pageerror',e=>errors.push(surface+': '+e.message));await p.goto(root+'/'+surface+'.html#/login');
 if(surface==='external'){
  await click(p,'to-register');const country=p.locator('#registerCountry');await choose(p,country,'香港','香港特別行政區');assert.equal(await country.inputValue(),'香港特別行政區');await p.goto(root+'/external.html#/login');await p.locator('#authEmail').fill('select.qa@example.com');await click(p,'login');for(let i=0;i<6;i++)await p.locator('[data-otp="'+i+'"]').fill(String(i+1));await click(p,'verify');await p.locator('.cards').waitFor();
 }else{await p.locator('[data-action="pick-role"][data-index="0"]').click();await click(p,'bo-login');await p.locator('.metrics').waitFor();}
 await click(p,'new');await click(p,'sample');await click(p,'confirm-sample');const go=async step=>{await p.evaluate(({surface,step})=>location.hash='/'+(surface==='backoffice'?'application':'form')+'/'+step,{surface,step});await p.locator('.v2-form').waitFor();await p.waitForTimeout(120);};
 let total=0;for(const step of [1,2,3,4,5,6]){await go(step);total+=await inspectSelects(p,surface+' step '+step);}
 assert(total>30,surface+' all form selects exercised');
 await go(4);const field=key=>p.locator('[data-field="'+key+'"]');assert.equal(await field('cardCountryCode').inputValue(),'HKG');
 const nativeBankValues=await field('cardBankCode').locator('option').evaluateAll(es=>es.filter(e=>e.value&&e.value!=='__other').slice(0,4).map(e=>e.value));assert.deepEqual(nativeBankValues,['004','012','024','003']);
 await field('cardBankName').click();const top=await p.locator('#sdd-options [data-sdd-option]').allTextContents();assert.match(top[1],/香港上海匯豐/);assert.match(top[2],/中國銀行\(香港\)/);assert.match(top[3],/恒生/);assert.match(await panel(p).innerText(),/香港常用銀行/);
 await input(p).fill('HSBC');assert((await p.locator('#sdd-options').innerText()).includes('004'));await input(p).fill('滙豐');assert((await p.locator('#sdd-options').innerText()).includes('004'));await input(p).fill('004');assert.equal(await p.locator('#sdd-options [data-sdd-option]').count(),1);await input(p).press('Enter');assert.equal(await field('cardBankCode').inputValue(),'004');assert.equal(await field('swiftCode').inputValue(),'HSBCHKHHHKH');
 await choose(p,field('cardBankName'),'HangSeng','恒生銀行有限公司');assert.equal(await field('cardBankCode').inputValue(),'024');await choose(p,field('cardBankName'),'恆生','恒生銀行有限公司');
 await choose(p,field('cardBankCode'),'渣打','003');assert.equal(await field('cardBankName').inputValue(),'渣打銀行(香港)有限公司');assert.equal(await field('swiftCode').inputValue(),'SCBLHKHHXXX');
 await field('cardBankCode').click();await input(p).fill('no-bank-matches-this');assert.match(await panel(p).innerText(),/沒有符合/);assert.equal(await field('cardBankCode').inputValue(),'003');await input(p).press('Enter');assert.equal(await field('cardBankCode').inputValue(),'003');await p.locator('.sdd-clear').click();assert.equal(await input(p).inputValue(),'');await input(p).press('Escape');assert.equal(await field('cardBankCode').inputValue(),'003');assert(await field('cardBankCode').evaluate(e=>document.activeElement===e));
 await field('cardBankCode').focus();await field('cardBankCode').press('ArrowDown');await input(p).fill('012');await input(p).dispatchEvent('keydown',{key:'Enter',isComposing:true,bubbles:true});assert.equal(await field('cardBankCode').inputValue(),'003');await input(p).press('Enter');assert.equal(await field('cardBankCode').inputValue(),'012');
 // Existing programmatic/native changes remain compatible with the application handlers.
 await field('cardBankCode').selectOption('004');assert.equal(await field('swiftCode').inputValue(),'HSBCHKHHHKH');await field('cardBranchCode').fill('812');await field('cardBranchCode').blur();assert.match(await field('cardAddress').inputValue(),/Sun Hung Kai/);
 for(const width of [1600,1024,768,390,320]){
  await p.setViewportSize({width,height:800});await field('cardBankCode').click();await input(p).fill('香港');const rect=await panel(p).boundingBox();assert(rect.x>=0&&rect.x+rect.width<=width+1&&rect.y>=0&&rect.y+rect.height<=801,surface+' popover fits '+width);assert(await panel(p).evaluate(e=>e.scrollWidth<=e.clientWidth+1));if(width===1600||width===390)await p.screenshot({path:'qa-searchable-bank-'+surface+'-'+width+'.png'});await input(p).press('Escape');
 }
 await p.setViewportSize({width:1600,height:1100});
 await choose(p,field('cardCountryCode'),'CHN','CHN');assert.equal(await field('cardCityCode').count(),1);await choose(p,field('cardProvinceCode'),'廣東','CN-GD');await choose(p,field('cardCityCode'),'深圳','CN-GD-SZ');assert.equal(await field('cardCityCode').inputValue(),'CN-GD-SZ');
 await go(5);const pricing=p.locator('[data-v2-inline-pricing]').first();await choose(p,pricing,'Blended','Blended');assert.equal(await pricing.inputValue(),'Blended');
 // Customer creation opens a new overlay only after an actual selection.
 await go(2);await p.locator('#mt-customer').click();await input(p).fill('新建');await input(p).press('Escape');assert.equal(await p.locator('#modal[open]').count(),0);await choose(p,p.locator('#mt-customer'),'新建','__new');await p.locator('#mt-new-customer-name').fill('香港搜尋測試集團');await click(p,'mt-customer-create');assert.equal(await p.locator('#mt-customer option:checked').innerText(),'香港搜尋測試集團');
 if(surface==='backoffice'){
  await p.evaluate(()=>location.hash='/accounts');await p.locator('.accounts-table').waitFor();await click(p,'add-account');await choose(p,p.locator('#acc-parent'),'陳偉明','ACC-3');assert.equal(await p.locator('#acc-role').isDisabled(),false);await p.locator('#acc-role').click();assert(await panel(p).evaluate(e=>e.closest('dialog')?.open));await input(p).fill('次代理商');assert.equal(await p.locator('#sdd-options [data-sdd-option]').count(),1);await input(p).press('Escape');assert.equal(await p.locator('#modal[open]').count(),1);await choose(p,p.locator('#acc-role'),'下線','下線帳戶');assert.equal(await p.locator('#acc-role').inputValue(),'下線帳戶');await p.locator('#acc-parent').click();await p.locator('#modal [data-action="close"]').first().click();assert.equal(await panel(p).count(),0);
  await p.evaluate(()=>location.hash='/merchants');await p.locator('.merchant-table-new').waitFor();total+=await inspectSelects(p,'merchant list');
 }
 checks.push(surface+': '+total+' original selects searched across six steps and management controls; Hong Kong banks first, Chinese/English/code/alias search, exact bank/SWIFT/branch linkage, keyboard/IME/Escape, no-result preservation, responsive top-layer popovers, nested account controls and existing MCC multiselect retained.');
 await context.close();
 }assert.deepEqual(errors,[]);fs.writeFileSync('qa-searchable-selects-report.json',JSON.stringify({passed:true,date:new Date().toISOString(),root,checks,errors},null,2));console.log('PASS searchable selects:',checks.join('\n'));}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});

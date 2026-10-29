const {chromium}=require('playwright'),ExcelJS=require('exceljs'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const root=(process.env.DEMO_URL||'http://127.0.0.1:4340/backoffice.html').replace(/\/(backoffice|external|index)\.html.*$/,'');
const context={};vm.runInNewContext(fs.readFileSync(__dirname+'/onboarding-v2-data.js','utf8')+'\n'+fs.readFileSync(__dirname+'/onboarding-document-schema.js','utf8')+';this.data=V2_DATA;',context);const MT=require('./merchant-template-model.js').create(context.data),MW=require('./merchant-workbook-model.js').create(context.data,MT),checks=[],errors=[];
for(const header of ['母公司代號','主公司代號']){const parsed=MT.bundle(MT.csvBundle(MT.csv([['公司代號','客戶名稱','公司角色',header,'中文名稱'],['P','兼容集團','母公司','','母公司甲'],['C','兼容集團','子公司','P','子公司乙']])));assert.equal(parsed.companies[1].parentKey,'P');}
function validateLists(book){
 const values=name=>{
  const ranges=book.definedNames.getRanges(name).ranges;
  assert(ranges.length,`List source ${name} must exist`);
  return ranges.flatMap(ref=>{
   assert.match(ref,/^'[^']+'!\$[A-Z]+\$\d+:\$[A-Z]+\$\d+$/,`List source must use absolute references: ${ref}`);
   const [,sheetName,start,end]=ref.match(/^'([^']+)'!(\$[A-Z]+\$\d+):(\$[A-Z]+\$\d+)$/),sheet=book.getWorksheet(sheetName);
   assert(sheet,`Missing source sheet ${sheetName}`);
   const a=sheet.getCell(start.replaceAll('$','')),z=sheet.getCell(end.replaceAll('$','')),items=[];
   for(let row=a.row;row<=z.row;row++)for(let col=a.col;col<=z.col;col++){const value=sheet.getCell(row,col).value;if(value!==null&&String(value).trim())items.push(String(value));}
   return items;
  });
 };
 let count=0;
 for(const sheet of book.worksheets)for(const rule of Object.values(sheet.dataValidations.model)){
  if(rule.type!=='list')continue;
  const source=rule.formulae?.[0];
  assert.match(source,/^OATS_(Option_\d+|CompanyIDs|TemplateNames)$/,'Dropdowns must use compatible named ranges, without INDIRECT');
  const options=values(source);if(source.startsWith('OATS_Option_'))assert(options.length,`Empty options for ${source}`);count++;
 }
 assert(count>=53,'All input list validations must remain');
 const merchant=book.getWorksheet('商戶資料'),headers=merchant.getRow(4).values;
 const column=label=>{const i=headers.indexOf(label);assert(i>0,`Missing header ${label}`);return i;};
 const optionsAt=label=>values(merchant.getCell(5,column(label)).dataValidation.formulae[0]);
 assert.deepEqual(optionsAt('幣別'),['HKD 港元','CNY 人民幣','USD 美元','EUR 歐元','GBP 英鎊','JPY 日圓','AUD 澳元']);
 assert(optionsAt('開戶銀行').includes('香港上海滙豐銀行'));
 assert(optionsAt('MCC 行業代碼').some(v=>v.startsWith('5814')));
 const savedCompany=merchant.getCell('A5').value,templates=book.getWorksheet('參數模板'),savedTemplate=templates.getCell('A5').value;
 merchant.getCell('A5').value='QA-PARENT';templates.getCell('A5').value='QA-TEMPLATE';
 assert(values('OATS_CompanyIDs').includes('QA-PARENT'));
 assert(values('OATS_TemplateNames').includes('QA-TEMPLATE'));
 merchant.getCell('A5').value=savedCompany;templates.getCell('A5').value=savedTemplate;
 return count;
}
async function sheets(buffer){const b=new ExcelJS.Workbook();await b.xlsx.load(buffer);validateLists(b);const rows={};for(const s of MW.specs){const sheet=b.getWorksheet(s.name);assert(sheet);assert(Object.keys(sheet.dataValidations.model).length>0);const headers=sheet.getRow(4).values.slice(1);assert.equal(new Set(headers).size,headers.length);rows[s.name]=[];for(let i=5;i<=sheet.rowCount;i++){const r=Object.fromEntries(headers.map((h,j)=>[h,sheet.getCell(i,j+1).value??'']));if(Object.values(r).some(v=>String(v).trim()))rows[s.name].push(r);}}return rows;}
(async()=>{const blank=await sheets(fs.readFileSync(__dirname+'/import-templates/merchant-import-template.xlsx'));assert(Object.values(blank).every(r=>!r.length));const example=MT.bundle(MW.fromSheets(await sheets(fs.readFileSync(__dirname+'/import-templates/merchant-import-example.xlsx'))));assert.equal(example.companies.length,3);assert.equal(example.templates.length,1);assert.equal(example.companies[0].role,'parent');assert.equal(example.companies[1].parentKey,'MAIN');assert.equal(example.companies[0].values.registerCertNo,'12345678-000-03-26-7');assert.equal(+example.templates[0].products.rates['POS|0'].v.loc_rate,1.5);const legacy=await sheets(fs.readFileSync(__dirname+'/import-templates/merchant-import-example.xlsx'));for(const row of legacy['商戶資料']){row['主公司代號']=row['母公司代號'];delete row['母公司代號'];if(row['公司關係']==='母公司')row['公司關係']='主公司';}assert.equal(MT.bundle(MW.fromSheets(legacy)).companies[1].parentKey,'MAIN');checks.push('All 53 dropdown rules resolve to populated named ranges; currencies, banks and MCC options are present; company/template references update when data is entered');checks.push('Blank template has no import data; all four input sheets have native list validation; populated workbook preserves group, main/subsidiary, full BR, MCC and fees');
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});try{for(const target of ['backoffice','external']){const p=await browser.newPage();p.on('pageerror',e=>errors.push(e.message));const click=async a=>{const m=p.locator('#modal[open] [data-action="'+a+'"]');await (await m.count()?m.first():p.locator('[data-action="'+a+'"]').first()).click();};await p.goto(root+'/'+target+'.html#/login');if(target==='backoffice'){await click('pick-role');await click('bo-login');await p.waitForSelector('.metrics');await p.evaluate(()=>location.hash='/application/1');}else{await p.locator('#authEmail').fill('workbook.qa@example.com');await click('login');for(let i=0;i<6;i++)await p.locator('[data-otp="'+i+'"]').fill(''+(i+1));await click('verify');await click('new');await click('ns-blank');}
 await click('mt-import-open');assert(!(await p.locator('#modal').innerText()).includes('JSON'));assert.match(await p.locator('#mt-import-file').getAttribute('accept'),/xlsx/);const download=p.waitForEvent('download');await click('mt-excel-example');const file=await download;assert.equal(file.suggestedFilename(),'merchant-import-example.xlsx');await p.locator('#mt-import-file').setInputFiles({name:file.suggestedFilename(),mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:fs.readFileSync(await file.path())});await p.locator('#mt-import-result h3').waitFor();await click('mt-import-confirm');await p.getByRole('heading',{name:'資料匯入完成',exact:true}).waitFor();const state=await p.evaluate(()=>AllinPayDemo.getTemplateState());assert.equal(state.templates.length,1);assert.equal(state.targets.filter(t=>t.customer?.name==='示例餐飲集團').length,3);await click('close');await click('mt-library');const exported=p.waitForEvent('download');await click('mt-export');const exp=await exported;assert.equal(exp.suggestedFilename(),'merchant-template.xlsx');const parsed=MW.fromSheets(await sheets(fs.readFileSync(await exp.path())));assert.equal(parsed.templates[0].name,'餐飲共用參數（示例）');assert.equal(+parsed.templates[0].products.rates['POS|0'].v.crs_rate,2.5);checks.push(target+': no JSON UI; download, import, three-company linkage and template Excel export work through the visible controls');await p.close();}}finally{await browser.close();}
 assert.deepEqual(errors,[]);fs.writeFileSync('qa-merchant-workbook-report.json',JSON.stringify({passed:true,date:new Date().toISOString(),root,checks,errors},null,2));console.log('PASS Excel workbooks:',checks.join('\n'));
})().catch(e=>{console.error(e);process.exit(1)});

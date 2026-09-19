const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const dom = new Map();
const document = {
  querySelector(selector) {
    if (!dom.has(selector)) dom.set(selector, { innerHTML: '', textContent: '', open: false, classList: { add() {}, remove() {} }, showModal() { this.open = true; }, close() { this.open = false; } });
    return dom.get(selector);
  },
  querySelectorAll() { return []; },
  addEventListener() {},
};
const storage = new Map();
const context = { document, console, structuredClone, Date, TextEncoder, setTimeout: () => 0, clearTimeout() {}, location: { hash: '#/dashboard' }, localStorage: { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v) }, addEventListener() {}, scrollTo() {} };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8'), context);
const source = fs.readFileSync(path.join(__dirname, 'core.js'), 'utf8');
vm.runInContext(source.replace(/render\(\);\s*\}\)\(\);\s*$/, 'window.__test={state,forms,rows,headers,fillSample,validateStep,validateAll,application,merchants,saveDraft,actions,filteredRows,fieldOptions};\n})();'), context);
const t = context.__test;
assert(t, 'Test instrumentation is isolated to this VM');
assert.equal(t.forms.length, 6);
assert.equal(t.headers.length, 27);
assert.equal(t.rows.length, 120);
assert.equal(t.forms[4].sections[0].uploads.length, 27);
assert.deepEqual(Array.from(t.forms, f => f.sections.length), [8,4,3,11,2,4]);
assert(Object.keys(t.validateStep(1)).length > 0, 'Empty form must fail');
t.fillSample();
assert.equal(Object.keys(t.validateAll()).length, 0, JSON.stringify(t.validateAll()));
for(let step=1;step<=5;step++) {
  const html = t.application(step);
  for(const section of t.forms[step-1].sections) {
    for(const field of section.fields) assert(html.includes('data-field="'+field.id.replace('[]','[0]')+'"'), 'Missing field '+field.id);
    for(const upload of section.uploads) assert(html.includes('data-upload="'+upload.id+'"'), 'Missing upload '+upload.id);
    for(const check of section.checks) assert(html.includes('data-check="'+check.id+'"'), 'Missing product '+check.id);
  }
}
t.state.values.mcc='581'; assert(t.validateStep(2).mcc);t.state.values.mcc='5814';
t.state.values.cardBranchCode='12';assert(t.validateStep(3).cardBranchCode);t.state.values.cardBranchCode='001';
t.state.values.cardName='Mismatch';assert(t.validateStep(3).cardName);t.state.values.cardName=t.state.values.merchantEnglishName;
t.state.values.registerCertPeriod='2020-01-01';assert(t.validateStep(1).registerCertPeriod);t.state.values.registerCertPeriod='2028-08-31';
t.state.values.posDepCycle='181';assert(t.validateStep(4).posDepCycle);t.state.values.posDepCycle='30';
t.state.values.localCardRate='101';assert(t.validateStep(4).localCardRate);t.state.values.localCardRate='1.65';
t.state.emailVerified=false;assert(t.validateStep(2).contactEmail);t.state.emailVerified=true;
delete t.state.files['140101'];assert(t.validateStep(5)['file-140101']);t.fillSample();
t.state.values.merchantName='<script>alert(1)</script>';assert(!t.application(6).includes('<script>alert(1)</script>'));t.fillSample();
t.state.search='海港科技';assert.equal(t.filteredRows().length,24);t.state.search='';
t.state.status='通過審核';assert.equal(t.filteredRows().length,24);t.state.status='全部狀態';
t.state.search='not-present';assert(t.merchants().includes('沒有符合條件'));t.state.search='';
context.location.hash='#/application/3';t.saveDraft();assert.equal(t.state.drafts.length,1);assert(storage.size);
t.state.fail=true;t.state.values.merchantName='Unsaved';t.saveDraft();assert.notEqual(t.state.drafts[0].values.merchantName,'Unsaved');
t.state.fail=false;t.actions.restore({dataset:{id:t.state.drafts[0].id}});assert.equal(t.state.values.merchantName,'海港科技有限公司');
for(const asset of ['4864c.png','d0541.svg','f57a5.svg','d2a18.svg','65f1e.svg','dashboard-icon.svg','merchant-icon.svg'])assert(fs.statSync(path.join(__dirname,asset)).size>0);
const fieldCount=t.forms.reduce((sum,f)=>sum+f.sections.reduce((n,s)=>n+s.fields.length,0),0);
console.log('PASS: 8 scoped pages; '+fieldCount+' source fields; 27 documents; 27 merchant columns; validation, escaping, search, pagination data, draft save/failure/restore and local assets.');

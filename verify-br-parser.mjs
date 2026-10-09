import assert from 'node:assert/strict';
import {parseBR,toApplication,validateFields} from './br-engine/parser.mjs';
import {candidatesFromBR,classifyDocument,extractCandidates} from './br-engine/multi-document.mjs';
const source=`Please display the certificate at business address.
Business Registration Certificate
Name of Business/Corporation SAMPLE ALPHA LIMITED
Business/Branch Name
Address ROOM 9, 2F., TEST BUILDING, 88 EXAMPLE ROAD, HK
Nature of Business SERVICES
Status BODY CORPORATE
Date of Commencement 30/03/2026
Date of Expiry 29/03/2027
Certificate No. 12345678-000-03-26-7
Please note the following requirements
Address in this footer is NOT an address value`;
const r=parseBR(source);
assert(r.recognized);assert.equal(r.fields.certificateNumber.value,'12345678-000-03-26-7');
assert.equal(r.fields.brNumber.value,'12345678-000');assert.equal(r.fields.startDate.value,'2026-03-30');assert.equal(r.fields.expiryDate.value,'2027-03-29');
assert.equal(r.fields.businessNameEn.value,'SAMPLE ALPHA LIMITED');assert.equal(r.fields.businessAddressZh.value,'');assert.equal(r.fields.businessNameZh.value,'');
assert.equal(r.fields.businessAddressEn.value,'ROOM 9, 2F., TEST BUILDING, 88 EXAMPLE ROAD, HK');
const fields=toApplication(r.fields,new Set(Object.keys(r.fields)));assert.equal(fields.remark,'SERVICES');assert.equal(fields.merchantProfile,undefined);
assert.equal(fields.registerCertNo,'12345678-000-03-26-7');
assert.equal(candidatesFromBR(r).find(f=>f.key==='registerCertNo').value,'12345678-000-03-26-7');
assert.deepEqual(validateFields({certificateNumber:r.fields.certificateNumber}),{});
assert(validateFields({certificateNumber:{value:'12345678-000'}}).certificateNumber);
const partial=parseBR(source.replace('12345678-000-03-26-7','12345678-000'));
assert.equal(partial.fields.certificateNumber.value,'');assert.equal(toApplication(partial.fields,new Set(['certificateNumber'])).registerCertNo,undefined);
const conflict=parseBR(source+'\nCertificate No. 12345678-000-03-26-A');assert.equal(conflict.fields.certificateNumber.value,'');
assert.equal(candidatesFromBR(r).length,8);assert.equal(parseBR('Not a BR').recognized,false);
assert.equal(parseBR(source.replace('12345678-000-03-26-7','12345678-000-03-26-A')).fields.certificateNumber.value,'12345678-000-03-26-A');
console.log('PASS synthetic BR suffix, source boundaries, absent Chinese fields, and target mappings');
for(const [text,id]of [['Business Registration Certificate','140101'],['Certificate of Incorporation','140201'],['Company Search Report','140301'],['Annual Return NAR1','141101'],['Bank Statement','140401'],['Three-month Bank Statements','141301'],['Payment Services Agreement','140701'],['Tenancy Agreement','141401'],['Customer Terms and Conditions','141601'],['PCI DSS Certificate','141201'],['Annual Financial Report','141701']])assert.equal(classifyDocument(text).id,id,text);
assert.equal(classifyDocument('Identity Card\nName: SAMPLE PERSON').id,'');
assert.deepEqual(extractCandidates('Identity Card\nName: SAMPLE PERSON\nIdentity Card Number: A123456(7)'),[]);
for(const quote of ["'",'’'])assert.deepEqual(extractCandidates(`Director${quote}s Identity Card\nName: DEMO USER\nIdentity Card Number: Z123456(0)\nDate of Birth: 1985-06-15`).map(f=>f.key),['directors[0].name','directors[0].idcardNo','directors[0].birthDay']);
assert.equal(classifyDocument('Business Registration Certificate\nCertificate of Incorporation').ambiguous,true);
assert.equal(classifyDocument('Unlabelled photo').id,'');
assert.deepEqual(extractCandidates('Bank Statement\nAccount Number: 001-234567-890\nBank Code: 016','AUTO').map(f=>[f.key,f.value]),[['cardNo','001-234567-890'],['cardBankCode','016']]);
console.log('PASS content-based document classification, ambiguous and unknown types, bank fields');

import assert from 'node:assert/strict';
import {parseBR,toApplication} from './br-engine/parser.mjs';
import {candidatesFromBR} from './br-engine/multi-document.mjs';
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
assert.equal(candidatesFromBR(r).length,8);assert.equal(parseBR('Not a BR').recognized,false);
assert.equal(parseBR(source.replace('12345678-000-03-26-7','12345678-000-03-26-A')).fields.certificateNumber.value,'12345678-000-03-26-A');
console.log('PASS synthetic BR suffix, source boundaries, absent Chinese fields, and target mappings');

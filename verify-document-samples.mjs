// Synthetic layout regressions only. Client files and extracted personal data
// stay outside the repository and the published Demo/ZIP.
import assert from 'node:assert/strict';
import {classifyDocument,extractCandidates,extractIdentity} from './br-engine/multi-document.mjs';
import {ocrRows} from './br-engine/layout.mjs';
const statement=`HSBC Business Direct Statement
SAMPLE ALPHA TRADING LIMITED Number 戶口號碼: 012-345678-901
SHOP 5, 88 EXAMPLE ROAD
Branch 分行: SAMPLE BRANCH
26 June 2026
Asset Portfolio
Total balance in HKD 99,888.77
Telephone 2748 8288
The Hongkong and Shanghai Banking Corporation Limited`;
assert.equal(classifyDocument(statement).id,'140401');
const bank=extractCandidates(statement),byKey=k=>bank.find(x=>x.key===k);
assert.equal(byKey('cardNo').value,'012-345678-901');
assert.equal(byKey('cardName').value,'SAMPLE ALPHA TRADING LIMITED');
assert.equal(byKey('cardName').autoSelect,false);
assert.equal(byKey('cardBankName').value,'香港上海匯豐銀行有限公司');
assert.equal(byKey('cardBankCode').value,'004','bank title maps to the existing reference; never take the account prefix');
assert.equal(byKey('cardBankCode').autoSelect,false);
assert.equal(bank.some(x=>x.value.includes('99,888')||x.value.includes('2748')),false);
assert.equal(extractCandidates(statement+'\nAccount Number: 999-888888-777').some(x=>x.key==='cardNo'),false,'conflicting accounts require manual review');
assert.equal(extractCandidates(statement.replace('012-345678-901','012-****-901')).some(x=>x.key==='cardNo'),false,'masked numbers stay blank');
assert.equal(extractCandidates('Bank Statement\nAccount Number: 000123456789').find(x=>x.key==='cardNo').value,'000123456789');
assert.equal(extractCandidates('Bank Statement\nAccount Number:\n001-234567-890').find(x=>x.key==='cardNo').value,'001-234567-890');
const id=`HONG KONG PERMANENT IDENTITY CARD
陳 示 例
CHAN, Tai Man
5555 1111 2222
出生日期 DateofBirth
21-05-1985 男 M
Date of Issue
13-12-19 A123456(7)`;
assert.equal(classifyDocument(id).kind,'ID');assert.equal(classifyDocument(id).id,'','holder role never inferred');
assert.deepEqual(extractIdentity(id),{idcardNo:'A123456(7)',lastNameEn:'CHAN',firstNameEn:'Tai Man',name:'陳示例',birthDay:'1985-05-21',idcardType:'01'});
assert.deepEqual(extractCandidates(id),[],'neutral fields require an explicit owner choice');
assert.equal(extractIdentity(id).idcardNoPeriod,undefined,'issue date is not expiry');
assert.equal(extractIdentity(id+'\nB654321(0)').idcardNo,undefined,'conflicting identity readings remain unresolved');
assert.equal(extractIdentity(id.replace('A123456(7)','A123O56(7)')).idcardNo,undefined,'never repair O into 0');
assert.equal(extractIdentity(id.replace('21-05-1985','31-02-1985')).birthDay,undefined);
const agreement='商 戶 入 駐 申 請 及 合 作 協 議\n附件清單\n商業登記證副本\n銀行戶口證明 (Bank Statement)';
assert.equal(classifyDocument(agreement).id,'140701');assert.deepEqual(extractCandidates(agreement),[]);
const authorization='公司授權書 Corporate Authorization Letter\nBusiness Registration No.: 12345678-000\nConfirm and verify bank account details';
assert.equal(classifyDocument(authorization).id,'109701');assert.deepEqual(extractCandidates(authorization),[]);
assert.equal(classifyDocument('Business Registration Certificate\nCertificate of Incorporation').ambiguous,true);
assert.deepEqual(extractIdentity('Unlabelled photo'),{});
// A falsely recognised vertical border must not join distant physical rows.
const word=(text,x,y,w=60,h=18)=>({text,bbox:{x0:x,y0:y,x1:x+w,y1:y+h}});
const data={blocks:[{paragraphs:[{lines:[{words:[word('|',600,10,2,800),word('Address',10,100),word('ROOM',200,100),word('9',270,100),word('ROAD',200,135),word('Status',10,220),word('BODY',200,220),word('CORPORATE',270,220)]}]}]}]};
assert.deepEqual(ocrRows(data).map(r=>r.words.map(w=>w.text).join(' ')),['Address ROOM 9','ROAD','Status BODY CORPORATE']);
console.log('PASS sample-shaped bank headings, account boundaries, neutral HKID, handwritten-form classification and OCR border isolation');

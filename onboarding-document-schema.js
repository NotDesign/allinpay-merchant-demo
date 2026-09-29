// Word feedback, 2026-09-29. Shared by backend and External; risk rules are unchanged.
V2_DATA.version = 'OATS-V2-20260929-document-feedback';
for (const form of V2_DATA.forms) for (const section of form.sections) {
  section.fields = section.fields.filter(f => f.id !== 'dbaNo');
  if (section.name === '法律主體') {
    section.texts = section.texts.map(t => t.replace('及必須上傳的文件', '；上傳文件均為選填'));
    const group = section.fields.find(f => f.id === 'groupId');
    Object.assign(group, {label:'所屬集團  Group', placeholder:'請輸入所屬集團', max:100});
    for (const f of [
      {id:'parentMerchant',label:'上級商戶  Parent Merchant',placeholder:'請輸入上級商戶',hint:'選填；填寫所屬上級商戶',type:'Text',max:100},
      {id:'inspectionDate',label:'考察日期  Inspection Date',placeholder:'YYYY/MM/DD',hint:'選填；實際考察日期',type:'Text'}
    ]) if (!section.fields.some(x => x.id === f.id)) section.fields.push(f);
  }
  for (const field of section.fields) {
    if (field.id === 'registerCertNo') Object.assign(field, {placeholder:'12345678-000-03-26-7', hint:'香港 BR 請填寫 Certificate No. 的完整號碼，包含最後三段；不會由日期推算尾碼'});
    if (['merchantShortName','merchantEnglishShortName'].includes(field.id)) field.hint += '；DBA 即中文或英文簡稱，不另設編號';
    if (field.id === 'cardBankName') field.hint = '按香港銀行代碼帶入；未列出銀行或其他地區請手動填寫';
  }
}
for (const doc of V2_DATA.documents) doc.hint = '選填；可選取或拖曳文件，未提供不會阻擋下一步。每檔上限 10 MB。';
const ONBOARDING_BANKS = Object.freeze({'003':'渣打銀行（香港）','004':'香港上海滙豐銀行','012':'中國銀行（香港）','015':'東亞銀行','016':'星展銀行（香港）','024':'恒生銀行'});

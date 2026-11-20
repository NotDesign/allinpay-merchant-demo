// Same-origin, browser-local Demo handoff. No server/API or cross-device sync is implied.
(() => {
  const external = typeof MT_EXTERNAL !== 'undefined' && MT_EXTERNAL;
  const externalKey = 'allinpay-external-v2';
  let lastError = '';
  if (external) {
    // All External writes (form save, import, template/batch update) share this store.
    function storeExternalRecords(records) {
      const previous = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(records) || !Array.isArray(previous)) throw Error('Invalid External records');
      const saved = new Map(previous.filter(r=>r && typeof r==='object').map(r=>[r.id,r]));
      const baseline = new Map(state.records.map(r=>[r.id,r]));
      const contextInvitation = typeof erInvited!=='undefined' && erInvited ? erInvitation : {};
      const comparable = record=>{const {demoUpdatedAt,...rest}=record;return JSON.stringify(rest);};
      const next = records.map(candidate=>{
        const old = saved.get(candidate.id);
        // Unchanged records carried through a batch must not overwrite newer edits
        // saved by another tab, or reset a backend review with a fresh timestamp.
        if (old && candidate===baseline.get(candidate.id)) return old;
        const invitation = old?.values?.__externalInvitation || old?.demoInvitation
          || candidate.values?.__externalInvitation || candidate.demoInvitation || contextInvitation;
        const record = {...candidate,
          values:{...candidate.values,__externalInvitation:structuredClone(invitation)},
          demoInvitation:structuredClone(invitation)};
        record.demoUpdatedAt = old && comparable(record)===comparable(old)
          ? old.demoUpdatedAt : new Date().toISOString();
        return record;
      });
      localStorage.setItem(KEY,JSON.stringify(next));
    }
    window.MeePayDemoBridge = Object.freeze({storeExternalRecords});
    return;
  }
  function fingerprint(record) {
    // Change detection only, never an authentication or integrity boundary.
    const text = JSON.stringify(record); let hash = 2166136261;
    for (let i=0;i<text.length;i++) hash = Math.imul(hash ^ text.charCodeAt(i),16777619);
    return text.length + '-' + (hash >>> 0).toString(16);
  }
  function toMerchant(record, previous, accountList = accounts) {
    const v = structuredClone(record.values || {});
    for (const [from,to] of Object.entries({companyZh:'merchantName',companyEn:'merchantEnglishName',
      br:'registerCertNo',brExpiry:'registerCertPeriod',address:'addrStreet',email:'contactEmail',
      mobile:'contactPhone',bankName:'cardName',bankAccount:'cardNo',website:'webUrl'}))
      if (!v[to] && v[from]) v[to] = v[from];
    const invitation = v.__externalInvitation || record.demoInvitation || {};
    const inviter = accountList.find(a=>a.id===invitation.inviter)
      || accountList.find(a=>a.agencyCode && a.agencyCode===invitation.agency)
      || accountList.find(a=>a.id===v.referrer || a.agencyCode && a.agencyCode===v.referrer);
    const owner = (previous && accountList.find(a=>a.id===previous.owner))
      || inviter || accountList.find(a=>a.role===roles[0]);
    const main = inviter && acAncestor(inviter,roles[2],accountList);
    const sub = inviter && acAncestor(inviter,roles[3],accountList);
    const mcc = Array.isArray(v.mccCodes) ? v.mccCodes.join('、') : String(v.mcc || '');
    const bank = String(v.cardNo || '');
    const files = structuredClone(record.files || {});
    for (const meta of Object.values(files)) if (meta && !Array.isArray(meta) && !meta.demo) meta.needsReselect = true;
    const id = previous?.id || 'EXTERNAL-' + record.id;
    const status = {'草稿':'Draft','審核中':'Pending','已完成':'Approved'}[record.status] || 'Pending';
    const application = {...structuredClone(record), id, owner:owner?.id || '',
      values:v,files,checks:structuredClone(record.checks || {}),
      people:record.people && !Array.isArray(record.people) ? structuredClone(record.people)
        : {directors:Math.max(1,record.directors?.length || 1),authSigners:0,shareHolders:0},
      savedAt:record.updated || record.created || '',emailVerified:!!record.emailVerified};
    return {...previous, id, source:'External', externalId:record.id,externalEmail:record.email,
      externalFingerprint:fingerprint(record),owner:owner?.id || '',status,application,
      '客戶中文名稱':v.merchantName || '', '客戶英文名稱':v.merchantEnglishName || '',
      '公司 MID':previous?.['公司 MID'] || '', BR:v.registerCertNo || '',
      'BR 有效期':String(v.registerCertPeriod || '').replaceAll('-','/'),
      'CR 有效期':v.nar1Period || '', 'DBA no.':v.dbaNo || record.id,
      '地區':v.addrProvinceCode || '香港', '客戶類型':v.merchantType==='GROUP'?'集團':'普通',
      '主代理商':main?.name || '', '主代理商代碼':main?.agencyCode || '',
      '次代理商':sub?.name || '', '次代理商代碼':sub?.agencyCode || '',
      '客戶聯繫人':v.contactName || '', '聯絡人電話':v.contactPhone || '',
      '聯絡人電郵':v.contactEmail || record.email || '', 'MCC 行業代碼':mcc,
      '行業類型':mcc.split('、').filter(Boolean).map(code=>V2.catalog.MCCS.find(m=>m.c===code)?.n || code).join('、'),
      '銀行名稱':v.cardBankName || '', '銀行代碼':v.cardBankCode || '', '分行代碼':v.cardBranchCode || '',
      '銀行帳號':bank ? bank.slice(0,4)+' **** '+bank.slice(-4) : '',bank,
      '單筆最高交易金額':v.maxAmount || '', '官網連結':v.webUrl || '',
      '最後更新':record.updated || record.created || '',createdDay:new Date().getDate(),
      missing:[],vip:false};
  }
  const previousScopedRows = acScopedRows;
  acScopedRows = function() {
    const visible = previousScopedRows();
    if (!BO.user) return [];
    const owned = acDescendants(BO.user.id);owned.add(BO.user.id);
    return visible.filter(row=>row.source!=='External' || owned.has(row.owner));
  };
  function syncExternalRecords() {
    let list;
    try {
      list = JSON.parse(localStorage.getItem(externalKey) || '[]');
      if (!Array.isArray(list)) throw Error('Invalid External records');
    } catch {lastError='無法讀取 External 本機申請資料；後台資料已保留。';return false;}
    // Start from the latest persisted account/draft/merchant state so a background
    // External save cannot overwrite changes made in another backoffice tab.
    let base;
    try {
      base = JSON.parse(localStorage.getItem(DBKEY) || 'null');
      if (base && (base.version!==1 || !Array.isArray(base.rows)
          || !Array.isArray(base.accounts) || !Array.isArray(base.drafts))) throw Error('Invalid backend state');
    } catch {lastError='無法讀取後台本機資料；原資料已保留。';return false;}
    base ||= {version:1,rows:rows.slice(),accounts,drafts:state.drafts,
      audit:BO.audit,noticeCount:state.noticeCount,rolePolicies:BO.rolePolicies || {}};
    const nextRows = base.rows.slice();let changed = 0;
    for (const record of list) {
      if (!record || typeof record!=='object' || !/^[\w-]{1,100}$/.test(record.id || '')
          || !record.values || typeof record.values!=='object' || Array.isArray(record.values)) continue;
      const existing = nextRows.find(r=>r.externalId===record.id && r.source==='External');
      if (existing?.externalFingerprint===fingerprint(record)) continue;
      const next = toMerchant(record,existing,base.accounts);
      if (existing) nextRows[nextRows.indexOf(existing)] = next;else nextRows.unshift(next);
      changed++;
    }
    if (!changed) {lastError='';return false;}
    const nextAudit = [{time:new Date().toLocaleString('zh-HK',{hour12:false}),user:'External Demo',
      message:'同步 External 商戶申請 · '+changed+' 筆（本機）'},...(base.audit || [])].slice(0,300);
    const noticeCount = (base.noticeCount || 0) + changed;
    try {
      localStorage.setItem(DBKEY,JSON.stringify({...base,rows:nextRows,audit:nextAudit,noticeCount}));
    } catch {lastError='後台本機儲存失敗，External 原紀錄及後台資料已保留。';return false;}
    rows.splice(0,rows.length,...nextRows);accounts=base.accounts;state.drafts=base.drafts;
    BO.audit=nextAudit;state.noticeCount=noticeCount;BO.rolePolicies=base.rolePolicies || {};
    acMigrate();lastError='';return true;
  }

  const syncAndRefresh = () => {
    if (!syncExternalRecords() || !BO.user) return;
    if (['dashboard','merchants','internal-review','drafts'].includes(route().page)
        && !document.querySelector('#modal[open]')) render();
  };
  syncExternalRecords();
  window.addEventListener('storage',e=>{if(e.key===externalKey || e.key===null)syncAndRefresh();});
  window.addEventListener('focus',syncAndRefresh);
  Object.assign(window.AllinPayDemo,{syncExternalRecords,getExternalBridgeState:()=>({
    imported:rows.filter(r=>r.source==='External').length,error:lastError})});
})();

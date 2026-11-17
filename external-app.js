// Keep explicitly versioned bookmarks on the release they originally named.
(() => {
  const version = new URLSearchParams(location.search).get("v") || "";
  if (location.pathname.includes("/versions/")) return;
  const directory = ["20260929-restored", "391f597"].includes(version)
    ? "versions/20260929/"
    : version === "20261009-control-spacing-v3"
      ? "versions/20261009-control-spacing-v3/"
      : "";
  if (!directory) return;
  const filename = location.pathname.endsWith("external.html")
    ? "external.html"
    : "backoffice.html";
  const target = new URL(directory + filename, location.href);
  target.search = location.search;
  target.hash = location.hash || "#/login";
  location.replace(target.href);
})();

/* Standalone Figma prototype. No requests, real authentication, KYC or submission. */
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s),
    $$ = (s) => [...document.querySelectorAll(s)],
    esc = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      );
  const names = [
      "公司資料",
      "業務資料",
      "銀行資料",
      "主要聯絡人",
      "收款資料",
      "最終受益人及董事",
    ],
    KEY = "meepay-dev2-20261117-allinpay-external-v2";
  const regions = [
    "香港特別行政區",
    "中國內地",
    "澳門特別行政區",
    "台灣",
    "新加坡",
    "英國",
    "美國",
    "其他",
  ];
  const fields = [
    [
      ["country", "公司註冊國家／地區", "select", false, regions],
      [
        "companyType",
        "公司類型",
        "select",
        true,
        ["有限公司", "無限公司", "獨資經營", "合夥經營", "其他"],
      ],
      ["companyEn", "法定企業名稱 (英文)", "text"],
      ["companyZh", "法定企業名稱 (中文)", "text"],
      ["br", "商業登記證號碼", "text", true],
      ["brExpiry", "商業登記證到期日", "date"],
      ["address", "商業登記證地址", "textarea"],
    ],
    [
      [
        "industry",
        "行業性質",
        "select",
        true,
        [
          "食品雜貨店和超市",
          "餐飲服務",
          "電腦軟件",
          "服裝零售",
          "珠寶鐘錶",
          "其他",
        ],
      ],
      [
        "delivery",
        "交貨最長日數",
        "select",
        true,
        ["即日", "1–7 天", "8–14 天", "15–29 天", "30天或以上"],
      ],
      ["supplier", "主要供應商的國家／地區", "select", true, regions],
      ["consumer", "主要消費者的國家／地區", "select", true, regions],
      ["transactions", "每月交易宗數", "number", true],
      ["average", "平均每宗交易金額 (HKD)", "number", true],
    ],
    [
      ["bankCountry", "銀行所在國家 / 地區", "select", true, regions],
      [
        "bank",
        "銀行",
        "select",
        true,
        [
          "003 渣打銀行（香港）",
          "004 香港上海滙豐銀行",
          "012 中國銀行（香港）",
          "015 東亞銀行",
          "024 恒生銀行",
          "其他",
        ],
      ],
      ["bankName", "銀行帳戶名稱", "text", true],
      ["bankAccount", "銀行帳戶號碼", "text", true],
    ],
    [
      ["lastName", "姓氏", "text", true],
      ["firstName", "名稱", "text", true],
      ["position", "職位", "text"],
      ["email", "電郵地址", "email"],
      ["companyPhone", "公司電話號碼", "tel"],
      ["mobile", "手提電話號碼", "tel", true],
    ],
    [
      ["website", "收款網址", "url", true],
      ["appId", "小程序 App ID", "text"],
      ["miniLink", "小程序連結", "url"],
      ["appUrl", "手機應用程式網址", "url"],
    ],
    [],
  ];
  let state = {
    email: "",
    session: false,
    values: {
      country: regions[0],
      bankCountry: regions[0],
      bankReady: "可以",
      webReady: "可以",
    },
    files: {},
    people: [],
    directors: [],
    shops: [],
    methods: [],
    scenes: [],
    sales: [],
    errors: {},
    records: [],
    id: null,
    step: 1,
    signature: "",
    failSave: false,
    failSubmit: false,
    otpExpires: 0,
    resendAt: 0,
    readonly: false,
  };
  try {
    state.records = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(state.records)) state.records = [];
  } catch {
    state.records = [];
  }
  const btn = (t, a, cls = "", attr = "") =>
      `<button type="button" class="${cls}" data-action="${a}" ${attr}>${t}</button>`,
    link = (t, p) => `<a href="#/${p}">${t}</a>`;
  const brand = () =>
    `<a class="brand" href="#/${state.session ? "applications" : "login"}" aria-label="Mee Pay"><span class="brand-logo"><img src="${ASSETS["mee-pay-logo.png"]}" alt="Mee Pay — Mobility evolution ethics"></span></a>`;
  const footer = () =>
    '<footer class="footer"><span>© AllinPay International</span><span>Application Agency System · 商戶申請</span></footer>';
  const demo = () =>
    '<div class="demo">DEMO · 僅限測試資料。不會寄信、上傳文件或向正式系統提交申請。</div>';
  function toast(t) {
    $("#toast").textContent = t;
    $("#toast").classList.add("visible");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(
      () => $("#toast").classList.remove("visible"),
      3500,
    );
  }
  function modal(title, body, actions = btn("確定", "close", "primary")) {
    $("#modal").innerHTML =
      `<header class="modal-head"><h2 id="modal-title">${title}</h2>${btn("關閉", "close")}</header><div class="modal-body">${body}</div><footer class="modal-foot">${actions}</footer>`;
    if (!$("#modal").open) $("#modal").showModal();
  }
  function go(p) {
    $("#modal").close();
    state.errors = {};
    if (location.hash === "#/" + p) render();
    else location.hash = "/" + p;
    window.scrollTo(0, 0);
  }
  let route = () => location.hash.slice(2).split("/");
  function field(f, extra = "") {
    let [id, label, type, required, options] = f,
      v = state.values[id] ?? "",
      err = state.errors[id];
    return `<div class="field ${type === "textarea" ? "full" : ""} ${err ? "invalid" : ""}" id="wrap-${id}"><label for="${id}">${required ? '<span class="required">* </span>' : ""}${esc(label)}</label>${type === "select" ? `<select id="${id}" data-field="${id}" aria-invalid="${!!err}" ${extra}><option value="">請選擇</option>${options.map((o) => `<option ${o === v ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>` : type === "textarea" ? `<textarea id="${id}" data-field="${id}" placeholder="請輸入${esc(label)}" ${extra}>${esc(v)}</textarea>` : `<input id="${id}" data-field="${id}" type="${type || "text"}" value="${esc(v)}" placeholder="${type === "tel" ? "+852" : type === "number" ? "0" : "請輸入"}" ${type === "number" ? 'min="0" step="any"' : ""} ${extra} aria-invalid="${!!err}" ${err ? `aria-describedby="err-${id}"` : ""}>`}${err ? `<span class="error" id="err-${id}">${esc(err)}</span>` : ""}</div>`;
  }
  function errorSummary() {
    const es = Object.entries(state.errors);
    return es.length
      ? `<div class="notice error" role="alert"><strong>請修正以下 ${es.length} 項資料</strong><ul>${es.map(([k, v]) => `<li><a href="#" data-action="focus-error" data-id="${esc(k)}">${esc(v)}</a></li>`).join("")}</ul><small>資料會保留，亦可先儲存草稿。</small></div>`
      : "";
  }
  function auth(page) {
    let otp = page === "verify",
      reg = page === "register",
      restore = page === "retrieve";
    return `<main class="auth ${reg ? "register" : ""}"><section class="marketing"><h1>數碼支付新時代<br><span>支付，超乎您的想像</span></h1><p>透過 AllinPay 商戶申請平台，集中填寫企業資料、上傳證明文件及選擇收款方式。您可以儲存草稿，稍後繼續完成申請。</p><div class="collage"><img src="${ASSETS["b851a.png"]}" alt="商戶數碼收款"><img src="${ASSETS["d5909.png"]}" alt="網上支付"><img src="${ASSETS["800bf.png"]}" alt="零售商戶"></div><img class="payment-logos" src="${ASSETS["f1c7a.png"]}" alt="支援多種付款方式"></section><section class="auth-side"><div class="auth-inner"><div class="auth-top">${brand()}<select aria-label="語言"><option>繁體中文</option></select></div><form class="auth-form" id="auth-form"><h2>${otp ? "帳戶驗證" : reg ? "商戶註冊" : restore ? "提取草稿" : "商戶申請"}</h2>${demo()}${errorSummary()}${otp ? `<p class="center muted">請輸入發送至 ${esc(maskEmail(state.email))} 的驗證碼</p><p class="center hint">Demo 不會寄出電郵，請輸入 <strong>123456</strong>。</p><div class="otp ${state.otpError ? "invalid" : ""}">${Array.from({ length: 6 }, (_, i) => `<input aria-label="第 ${i + 1} 位驗證碼" inputmode="numeric" autocomplete="one-time-code" maxlength="1" data-otp="${i}">`).join("")}</div><p class="error" id="otp-error" role="alert">${esc(state.otpError || "")}</p>${btn("驗證", "verify", "primary")}<div class="auth-links">沒有收到驗證碼？${btn("重新發送", "resend", "", `id="resend"`)}</div><p class="center hint" id="otp-timer"></p><div class="auth-links">${link("返回登入頁面", "login")}${btn("Demo：驗證碼過期", "expire")}</div>` : reg ? `${field(["registerCountry", "公司註冊國家／地區", "select", false, regions])}${field(["registerCompany", "法定企業名稱", "text", true])}<div class="grid">${field(["registerLast", "姓氏", "text", true])}${field(["registerFirst", "名稱", "text", true])}</div>${field(["authEmail", "電郵地址", "email", true])}${field(["referrer", "推薦人", "text"])}<label class="agreement"><input type="checkbox" id="authority">本人乃申請人之董事或獲正式授權代表申請人申請 AllinPay 服務。</label><label class="agreement"><input type="checkbox" id="terms">本人確認已閱讀、理解並同意個人資料收集聲明、私隱政策及一般條款（Demo）。</label>${btn("註冊並繼續", "register", "primary")}<div class="auth-links">已經有帳戶？${link("登入", "login")}</div>` : restore ? `${field(["lookup", "電郵地址或申請編號", "text", true])}${btn("提取草稿", "retrieve", "primary")}<p class="hint">只查詢本瀏覽器已儲存的 Demo 草稿。跨裝置不會同步。</p><div class="auth-links">${link("返回登入", "login")}</div>` : `${field(["authEmail", "電郵地址", "email", true])}${btn("登 入", "login", "primary")}<div class="auth-links">還沒有帳戶？${btn("立即申請", "to-register")}</div><div class="auth-links">${link("提取已儲存草稿", "retrieve")}</div>`}</form></div>${footer()}</section></main>`;
  }
  function maskEmail(e) {
    return e.replace(/^(.{2}).*(@.*)$/, "$1***$2");
  }
  function header() {
    return `<header class="header">${brand()}<div class="header-actions"><select aria-label="語言"><option>繁體中文</option></select><span class="email hint" title="${esc(state.email)}">${esc(state.email)}</span>${btn("我的申請", "home")}${btn("登出", "logout")}</div></header>`;
  }
  function controls() {
    return `<div class="demo demo-controls"><span>DEMO 測試控制</span>${btn("填入示例", "sample")}${btn("顯示錯誤提示", "show-errors")}<label><input type="checkbox" data-toggle="failSave" ${state.failSave ? "checked" : ""}>儲存失敗</label><label><input type="checkbox" data-toggle="failSubmit" ${state.failSubmit ? "checked" : ""}>提交失敗</label></div>`;
  }
  function newApplication() {
    Object.assign(state, {
      values: {
        country: regions[0],
        bankCountry: regions[0],
        bankReady: "可以",
        webReady: "可以",
        email: state.email,
      },
      files: {},
      people: [],
      directors: [],
      shops: [],
      methods: [],
      scenes: [],
      sales: [],
      id: null,
      step: 1,
      signature: "",
      declaration: false,
      readonly: false,
      errors: {},
    });
  }
  function applications() {
    const rs = state.records.filter((r) => r.email === state.email);
    return `<div class="page-heading"><div><h1>我的申請</h1><p class="hint">查看申請資料、繼續填寫草稿及追蹤審核進度。</p></div>${btn("新增申請", "new", "primary")}</div>${demo()}<div class="row"><label>顯示 <select id="status-filter"><option>全部</option><option>草稿</option><option>審核中</option><option>已完成</option></select></label><span class="hint">共 ${rs.length} 份申請 · 僅儲存於此瀏覽器</span>${btn("載入進度示例", "seed")}</div><div class="cards">${rs
      .filter(
        (r) =>
          !state.filter || state.filter === "全部" || r.status === state.filter,
      )
      .map(
        (r) =>
          `<article class="card"><div class="card-head"><span class="hint">參考編號<br><strong>${esc(r.id)}</strong></span><span class="status ${r.status === "草稿" ? "gray" : r.status === "已完成" ? "green" : ""}">${r.status}</span></div><p class="hint">公司名稱</p><h3>${esc(r.values.companyZh || r.values.companyEn || "未命名商戶")}</h3><p class="hint">申請進度</p><ul class="timeline"><li class="done">建立申請表<small>${esc(r.created)}</small></li><li class="${r.status !== "草稿" ? "done" : ""}">${r.status === "草稿" ? "尚未提交 · " + names[r.step - 1] : "提交申請表"}<small>最後更新 ${esc(r.updated)}</small></li>${r.status !== "草稿" ? `<li class="${r.status === "已完成" ? "done" : ""}">${r.status === "已完成" ? "審核已完成" : "等待審核"}</li>` : ""}</ul>${btn(r.status === "草稿" ? "繼續填寫" : "查看詳情", "open", "", `data-id="${r.id}"`)}${r.status !== "草稿" ? btn("查看進度", "progress", "", `data-id="${r.id}"`) : ""}</article>`,
      )
      .join(
        "",
      )}<button class="card new-card" data-action="new"><strong>＋</strong><span>新增申請</span></button></div>`;
  }
  function choice(key, opts) {
    return `<div class="checks" id="wrap-${key}">${opts.map((o) => `<label><input type="checkbox" data-list="${key}" value="${esc(o)}" ${state[key].includes(o) ? "checked" : ""}>${esc(o)}</label>`).join("")}</div>${state.errors[key] ? `<p class="error">${esc(state.errors[key])}</p>` : ""}`;
  }
  function readyChoice(key) {
    return `<div class="checks"><label><input type="radio" name="${key}" data-field="${key}" value="可以" ${state.values[key] !== "後補資料" ? "checked" : ""}>可以</label><label><input type="radio" name="${key}" data-field="${key}" value="後補資料" ${state.values[key] === "後補資料" ? "checked" : ""}>後補資料</label></div>`;
  }
  function upload(key, label, max = 10, imageOnly = false) {
    const files = state.files[key] || [];
    return `<div class="full" id="wrap-${key}"><p>${esc(label)}</p><div class="upload" data-drop="${key}" data-max="${max}" data-image="${imageOnly}">${btn("選擇文件", "upload", "", `data-key="${key}"`)}<input type="file" data-file="${key}" data-max="${max}" data-image="${imageOnly}" accept="${imageOnly ? ".jpg,.jpeg,.png" : ".jpg,.jpeg,.png,.pdf"}" ${key === "statement" ? "multiple" : ""} hidden><div>點擊或拖拽文件到此區域</div><small>${imageOnly ? "JPG、PNG" : "JPG、PNG、PDF"} · 上限 ${max} MB · 僅儲存檔名，不上傳</small></div>${state.errors[key] ? `<p class="error">${esc(state.errors[key])}</p>` : ""}<ul class="file-list">${files.map((f, i) => `<li><span>${esc(f.name)} <small>${f.demo ? "示例" : (f.size / 1024).toFixed(1) + " KB"}${f.needsReselect ? " · 請重新選取" : ""}</small></span><div class="row">${btn("預覽", "preview-file", "", `data-key="${key}" data-index="${i}"`)}${btn("移除", "remove-file", "danger", `data-key="${key}" data-index="${i}"`)}</div></li>`).join("")}</ul></div>`;
  }
  function peopleList(group) {
    return state[group].length
      ? state[group]
          .map(
            (p, i) =>
              `<div class="person"><h3>${esc(p.company || [p.last, p.first].filter(Boolean).join(" "))}</h3><p>${p.share ? "持有股份 " + esc(p.share) + "%" : ""}<br>${esc(p.email || "")}</p><div class="actions">${btn("編輯", "edit-person", "", `data-group="${group}" data-index="${i}"`)}${btn("移除", "remove-person", "danger", `data-group="${group}" data-index="${i}"`)}</div></div>`,
          )
          .join("")
      : '<p class="empty">尚未新增資料。</p>';
  }
  function formBody(step) {
    if (step === 1)
      return `<div class="grid">${fields[0].map((f) => field(f, f[0] === "country" ? "" : "")).join("")}</div>`;
    if (step === 2)
      return `<div class="grid">${field(fields[1][0])}<div class="field"><label>銷售類型 <span class="required">*</span></label>${choice("sales", ["產品", "服務"])}</div>${fields[1]
        .slice(1)
        .map((f) => field(f))
        .join("")}</div>`;
    if (step === 3)
      return `<p>現時能否提供公司銀行帳戶資料？ <span class="required">*</span></p>${readyChoice("bankReady")}${state.values.bankReady === "後補資料" ? '<div class="notice">您可先繼續申請，銀行資料需要於審核時補交。</div>' : `<div class="grid">${fields[2].map((f) => field(f)).join("")}</div><div style="margin-top:24px">${upload("statement", "銀行帳戶月結單")}</div><p class="hint">請提供最近 3 個月內的公司銀行帳戶月結單。</p>`}`;
    if (step === 4)
      return `<div class="grid">${fields[3].map((f) => field(f)).join("")}</div>`;
    if (step === 5)
      return `<h3>申請收款方式 <span class="required">*</span></h3>${choice("methods", ["支付寶", "微信支付", "Visa / Mastercard", "JCB", "銀聯", "轉數快", "八達通", "PayMe"])}<h3>收款場景 <span class="required">*</span></h3>${choice("scenes", ["實體店鋪", "網站", "微信小程序", "手機應用程式"])}${upload("logo", "公司標誌 *", 5, true)}<p class="hint">正方形，闊高不超過 1024 px。</p>${state.scenes.includes("實體店鋪") ? `<div class="divider"></div><h3>店鋪資料</h3><div id="wrap-shops">${state.shops.map((s, i) => `<div class="person"><h3>${esc(s.name)}</h3><p>${esc(s.address)}</p><small>BR：${esc(s.br)} · 終端機：${esc(s.terminals)}</small><p>${esc(s.file?.name || "")}</p>${btn("編輯", "edit-shop", "", `data-index="${i}"`)} ${btn("移除", "remove-shop", "danger", `data-index="${i}"`)}</div>`).join("") || '<p class="empty">尚未新增收款店鋪。</p>'}</div>${state.errors.shops ? `<p class="error">${state.errors.shops}</p>` : ""}${btn("新增收款店鋪", "add-shop")}` : ""}${state.scenes.includes("網站") ? `<div class="divider"></div><h3>網站資料</h3><p>現時能否提供收款網址？</p>${readyChoice("webReady")}${state.values.webReady === "後補資料" ? '<div class="notice">收款網址將於稍後補交。</div>' : field(fields[4][0])}` : ""}${
        state.scenes.includes("微信小程序")
          ? `<div class="divider"></div><h3>微信小程序</h3><div class="grid">${fields[4]
              .slice(1, 3)
              .map((f) => field(f))
              .join("")}</div>${upload("paymentFlow", "支付流程截圖")}`
          : ""
      }${state.scenes.includes("手機應用程式") ? `<div class="divider"></div><h3>手機應用程式資料</h3>${field(fields[4][3])}` : ""}`;
    return `<h3>最終受益人資料</h3><p class="hint">請新增持有公司股份 25% 或以上的最終受益人。</p><div id="wrap-people">${peopleList("people")}</div>${state.errors.people ? `<p class="error">${state.errors.people}</p>` : ""}<div class="row">${btn("新增個人", "add-person", "", `data-group="people" data-kind="person"`)}${btn("新增公司", "add-person", "", `data-group="people" data-kind="company"`)}</div><div class="divider"></div><h3>董事資料</h3><div id="wrap-directors">${peopleList("directors")}</div>${state.errors.directors ? `<p class="error">${state.errors.directors}</p>` : ""}<div class="row">${btn("新增個人董事", "add-person", "", `data-group="directors" data-kind="person"`)}${btn("新增公司董事", "add-person", "", `data-group="directors" data-kind="company"`)}</div>`;
  }
  function application(step) {
    state.step = step;
    return `${controls()}<section class="application"><header class="application-head"><div><h2>商戶申請表</h2><p>${esc(state.id || "新申請")} · 尚未提交</p></div>${btn("更多選項", "more")}</header><div class="form-layout"><nav class="stepnav" aria-label="申請步驟">${names.map((n, i) => btn(n, "step", i + 1 === step ? "active" : "", `data-step="${i + 1}" ${i + 1 === step ? 'aria-current="step"' : ""}`)).join("")}</nav><div class="form-body"><h3>${names[step - 1]}</h3>${errorSummary()}${formBody(step)}<footer class="form-actions">${btn("儲存草稿", "save")}${btn(step === 6 ? "檢閱申請" : "保存並繼續", "next", "primary")}</footer></div></div></section>`;
  }
  function validate(step) {
    const e = {},
      v = state.values,
      req = (k, l) => {
        if (!String(v[k] ?? "").trim()) e[k] = "請填寫" + l;
      };
    for (const f of fields[step - 1]) {
      if (step === 3 && v.bankReady === "後補資料") continue;
      if (step === 5) continue;
      if (f[3]) req(f[0], f[1]);
      if (v[f[0]] && f[2] === "email" && !/^\S+@\S+\.\S+$/.test(v[f[0]]))
        e[f[0]] = "請輸入有效的電郵地址";
    }
    if (step === 1) {
      if (v.br && !/^\d{8}(?:-\d{3})?$/.test(v.br))
        e.br = "商業登記證號碼須為 8 位數字，可包含 3 位分行編號";
      if (!v.companyEn && !v.companyZh)
        e.companyEn = "請填寫至少一個法定企業名稱";
    }
    if (step === 2) {
      if (!state.sales.length) e.sales = "請選擇銷售類型";
      if (
        v.transactions &&
        (!/^\d+$/.test(v.transactions) || +v.transactions < 1)
      )
        e.transactions = "每月交易宗數須為正整數";
      if (v.average && !(+v.average > 0))
        e.average = "平均每宗交易金額須大於 0";
    }
    if (step === 3 && v.bankReady !== "後補資料") {
      if (v.bankAccount && !/^[\d -]{6,30}$/.test(v.bankAccount))
        e.bankAccount = "請輸入有效銀行帳戶號碼";
      if (!(state.files.statement || []).some((f) => !f.needsReselect))
        e.statement = "請加入公司銀行帳戶月結單";
    }
    if (step === 4) {
      if (v.mobile && !/^\+?[\d ()-]{8,20}$/.test(v.mobile))
        e.mobile = "請輸入有效手提電話及國際區號";
      if (v.companyPhone && !/^\+?[\d ()-]{8,20}$/.test(v.companyPhone))
        e.companyPhone = "公司電話格式不正確";
    }
    if (step === 5) {
      if (!state.methods.length) e.methods = "請選擇至少一種收款方式";
      if (!state.scenes.length) e.scenes = "請選擇至少一種收款場景";
      if (!(state.files.logo || []).some((f) => !f.needsReselect))
        e.logo = "請上傳公司標誌";
      if (state.scenes.includes("實體店鋪") && !state.shops.length)
        e.shops = "請新增收款店鋪";
      if (state.scenes.includes("網站") && v.webReady !== "後補資料")
        req("website", "收款網址");
      for (const [scene, key] of [
        ["網站", "website"],
        ["微信小程序", "miniLink"],
        ["手機應用程式", "appUrl"],
      ])
        if (
          state.scenes.includes(scene) &&
          v[key] &&
          !/^https:\/\/[^\s.]+(?:\.[^\s]+)+/.test(v[key])
        )
          e[key] = "請輸入以 https:// 開頭的有效網址";
    }
    if (step === 6) {
      if (!state.people.length) e.people = "請新增最終受益人";
      if (!state.directors.length) e.directors = "請新增董事";
      if (state.people.reduce((s, p) => s + Number(p.share || 0), 0) > 100)
        e.people = "股份持有量合計不可超過 100%";
    }
    return e;
  }
  function validateAll() {
    return Object.assign({}, ...[1, 2, 3, 4, 5, 6].map(validate));
  }
  function snapshot(status = "草稿") {
    const old = state.records.find((r) => r.id === state.id),
      now = new Date().toLocaleString("zh-HK", { hour12: false });
    return {
      id: state.id || "AIP-" + Date.now().toString().slice(-9),
      email: state.email,
      status,
      step: state.step,
      created: old?.created || now,
      updated: now,
      values: { ...state.values },
      files: JSON.parse(JSON.stringify(state.files)),
      people: structuredClone(state.people),
      directors: structuredClone(state.directors),
      shops: structuredClone(state.shops),
      methods: [...state.methods],
      scenes: [...state.scenes],
      sales: [...state.sales],
      signature: state.signature,
    };
  }
  function persist(record) {
    const next = [record, ...state.records.filter((r) => r.id !== record.id)];
    localStorage.setItem(KEY, JSON.stringify(next));
    state.records = next;
    state.id = record.id;
  }
  function save() {
    if (state.failSave)
      return modal(
        "草稿儲存失敗",
        '<div class="notice error">模擬儲存失敗，內容仍保留。請不要關閉此頁。</div><p>可關閉失敗模擬後重試，或下載草稿備份。</p>',
        btn("返回編輯", "close") +
          btn("下載草稿", "export") +
          btn("重試儲存", "retry-save", "primary"),
      );
    try {
      persist(snapshot());
      modal(
        "草稿儲存成功",
        `<div class="notice success">已儲存至目前瀏覽器。</div><p>申請編號：<strong>${state.id}</strong></p><p class="hint">可從「我的申請」或「提取草稿」繼續。附件只保留檔名，重新開啟時請重新選取檔案；清除瀏覽器資料會移除草稿。</p>`,
        btn("我的申請", "home") + btn("繼續填寫", "close", "primary"),
      );
    } catch {
      modal(
        "草稿儲存失敗",
        "<p>瀏覽器儲存空間不可用。輸入仍保留，請下載備份。</p>",
        btn("返回編輯", "close") + btn("下載草稿", "export", "primary"),
      );
    }
  }
  function loadRecord(r) {
    for (const k of [
      "values",
      "files",
      "people",
      "directors",
      "shops",
      "methods",
      "scenes",
      "sales",
      "signature",
    ])
      state[k] = structuredClone(r[k] ?? (k === "signature" ? "" : {}));
    state.id = r.id;
    state.step = r.step || 1;
    state.readonly = r.status !== "草稿";
    Object.values(state.files)
      .flat()
      .forEach((f) => {
        if (!f.demo) f.needsReselect = true;
      });
    go(state.readonly ? "review" : "form/" + state.step);
  }
  function review() {
    return `<div class="review"><div class="page-heading"><h1>${state.readonly ? "申請資料" : "檢閱資料"}</h1>${btn("我的申請", "home")}</div>${demo()}${state.readonly ? '<div class="notice">已提交資料為唯讀，申請進度可返回「我的申請」查看。</div>' : controls()}${names
      .map(
        (n, i) =>
          `<section class="review-section"><header><h2>${n}</h2>${!state.readonly ? btn("編輯", "step", "", `data-step="${i + 1}"`) : ""}</header><dl>${fields[
            i
          ]
            .filter((f) => i !== 2 || state.values.bankReady !== "後補資料")
            .map(
              (f) =>
                `<div><dt>${f[1]}</dt><dd>${esc(state.values[f[0]] || "—")}</dd></div>`,
            )
            .join(
              "",
            )}${i === 1 ? `<div><dt>銷售類型</dt><dd>${esc(state.sales.join("、"))}</dd></div>` : ""}${i === 2 ? `<div><dt>公司銀行帳戶資料</dt><dd>${esc(state.values.bankReady)}</dd></div>` : ""}${i === 4 ? `<div><dt>申請收款方式</dt><dd>${esc(state.methods.join("、"))}</dd></div><div><dt>收款場景</dt><dd>${esc(state.scenes.join("、"))}</dd></div><div><dt>收款店鋪</dt><dd>${state.shops.map((s) => esc(s.name + " · " + s.address)).join("<br>") || "—"}</dd></div>` : ""}${i === 5 ? ["people", "directors"].map((g) => `<div><dt>${g === "people" ? "最終受益人" : "董事"}</dt><dd>${state[g].map((p) => esc((p.company || p.last + " " + p.first) + (p.share ? " · " + p.share + "%" : "") + " · " + (p.email || ""))).join("<br>") || "—"}</dd></div>`).join("") : ""}</dl>${
            i === 2 || i === 4
              ? `<p class="hint" style="margin-top:16px">附件：${
                  Object.entries(state.files)
                    .filter(([k]) =>
                      i === 2 ? k === "statement" : k !== "statement",
                    )
                    .flatMap(([, fs]) =>
                      fs.map(
                        (f) =>
                          esc(f.name) +
                          (f.needsReselect ? "（請重新選取）" : ""),
                      ),
                    )
                    .join("、") || "未提供"
                }</p>`
              : ""
          }</section>`,
      )
      .join(
        "",
      )}<section class="review-section"><h2>聲明及簽署</h2><p class="hint">此簽名只用作流程展示，不構成正式電子簽署。</p>${state.readonly ? `<img class="signature-image" alt="Demo 簽名" src="${state.signature}">` : `<div class="grid">${field(["signer", "簽署人姓名", "text", true])}${field(["signerTitle", "簽署人職位", "text", true])}</div><canvas id="signature" class="signature" aria-label="請在此簽名"></canvas>${btn("清除重簽", "clear-signature")} ${btn("使用 Demo 簽名", "demo-signature")}<label class="agreement"><input type="checkbox" id="declaration" ${state.declaration ? "checked" : ""}>本人確認以上資料正確，並已獲授權代表商戶提交此申請。</label><footer class="form-actions">${btn("返回", "step", "", `data-step="6"`)}${btn("儲存草稿", "save")}${btn("提交申請", "submit", "primary")}</footer>`}</section></div>`;
  }
  function submit() {
    let first = [1, 2, 3, 4, 5, 6].find((s) => Object.keys(validate(s)).length);
    if (first) {
      go("form/" + first);
      state.errors = validate(first);
      render();
      return;
    }
    if (
      !state.values.signer ||
      !state.values.signerTitle ||
      !state.signature ||
      !state.declaration
    )
      return modal(
        "請完成簽署",
        '<div class="notice error">請填寫簽署人姓名、職位、簽名並勾選確認聲明。</div>',
      );
    if (state.failSubmit)
      return modal(
        "申請未能提交",
        '<div class="notice error">已模擬提交失敗。輸入資料及簽名仍保留，可重試或先儲存草稿。</div>',
        btn("返回檢閱", "close") +
          btn("儲存草稿", "save") +
          btn("重試提交", "retry-submit", "primary"),
      );
    modal(
      "確認提交申請",
      '<p>確認資料正確後，將建立本機的模擬申請。</p><p class="hint">不會傳送至 AllinPay 正式系統。</p>',
      btn("取消", "close") + btn("確認提交", "confirm-submit", "primary"),
    );
  }
  function personModal(group, kind, index = -1) {
    state.personEdit = { group, kind, index };
    let p = state[group][index] || {};
    let specs =
      kind === "company"
        ? [["company", "公司名稱"]]
        : [
            ["last", "姓氏"],
            ["first", "名字"],
            ["email", "電郵地址"],
            ["phone", "手提電話"],
          ];
    if (group === "people") specs.push(["share", "股份持有量（%）"]);
    modal(
      "新增／編輯" + (group === "people" ? "最終受益人" : "董事"),
      `<div class="grid">${specs.map(([k, l]) => `<div class="field"><label for="person-${k}">${l}${k !== "phone" ? '<span class="required"> *</span>' : ""}</label><input id="person-${k}" data-person="${k}" type="${k === "email" ? "email" : k === "share" ? "number" : "text"}" value="${esc(p[k] || "")}" ${k === "share" ? 'min="25" max="100"' : ""}></div>`).join("")}</div><p class="error" id="person-error"></p>`,
      btn("取消", "close") + btn("儲存", "save-person", "primary"),
    );
  }
  function shopModal(index = -1) {
    state.shopIndex = index;
    let s = state.shops[index] || {};
    state.shopFile = s.file;
    modal(
      "新增／編輯收款店鋪",
      `<div class="grid">${[
        ["name", "店鋪名稱"],
        ["address", "店鋪地址"],
        ["br", "BR 及分行編號"],
        ["terminals", "終端機數量"],
      ]
        .map(
          ([k, l]) =>
            `<div class="field"><label>${l}<span class="required"> *</span></label><input data-shop="${k}" value="${esc(s[k] || "")}" ${k === "terminals" ? 'type="number" min="1"' : 'type="text"'}></div>`,
        )
        .join(
          "",
        )}<div class="field full"><label>店鋪 BR 文件 *</label><input type="file" id="shop-file" accept=".jpg,.jpeg,.png,.pdf"><small>${esc(s.file?.name || "JPG、PNG 或 PDF · 上限 10 MB")}</small></div></div><p id="shop-error" class="error"></p>`,
      btn("取消", "close") + btn("儲存店鋪", "save-shop", "primary"),
    );
  }
  async function acceptFiles(key, files, max, imageOnly) {
    let added = [];
    for (const f of files) {
      if (
        f.size > max * 1024 * 1024 ||
        !(imageOnly ? /\.(png|jpe?g)$/i : /\.(png|jpe?g|pdf)$/i).test(f.name)
      ) {
        modal(
          "文件上傳失敗",
          `<div class="notice error">${esc(f.name)} 格式不符或超過 ${max} MB。原有附件不受影響。</div>`,
        );
        return;
      }
      if (imageOnly) {
        const img = new Image(),
          url = URL.createObjectURL(f);
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
          img.src = url;
        });
        URL.revokeObjectURL(url);
        if (!img.width || img.width !== img.height || img.width > 1024) {
          modal(
            "公司標誌格式不符",
            '<div class="notice error">請選擇正方形 JPG／PNG，闊高不超過 1024 px。</div>',
          );
          return;
        }
      }
      added.push({
        name: f.name,
        size: f.size,
        type: f.type,
        url: URL.createObjectURL(f),
      });
    }
    state.files[key] =
      key === "statement" ? [...(state.files[key] || []), ...added] : added;
    delete state.errors[key];
    render();
    toast("文件已加入，僅供本機預覽，不會上傳");
  }
  function signatureCanvas() {
    const c = $("#signature");
    if (!c) return;
    const dpr = devicePixelRatio || 1;
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    const ctx = c.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#263c5b";
    if (state.signature) {
      let i = new Image();
      i.onload = () => ctx.drawImage(i, 0, 0, c.clientWidth, c.clientHeight);
      i.src = state.signature;
    }
    let drawing = false;
    c.onpointerdown = (e) => {
      drawing = true;
      c.setPointerCapture(e.pointerId);
      let r = c.getBoundingClientRect();
      ctx.beginPath();
      ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
      ctx.lineTo(e.clientX - r.left + 0.2, e.clientY - r.top + 0.2);
      ctx.stroke();
    };
    c.onpointermove = (e) => {
      if (!drawing) return;
      let r = c.getBoundingClientRect();
      ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
      ctx.stroke();
    };
    c.onpointerup = c.onpointercancel = () => {
      if (drawing) {
        drawing = false;
        state.signature = c.toDataURL();
      }
    };
  }
  function sample() {
    Object.assign(state.values, {
      companyType: "有限公司",
      companyZh: "示例科技有限公司",
      companyEn: "DEMO TECHNOLOGY LIMITED",
      br: "12345678",
      brExpiry: "2028-09-30",
      address: "香港示例道 18 號（非真實地址）",
      industry: "電腦軟件",
      delivery: "1–7 天",
      supplier: regions[0],
      consumer: regions[0],
      transactions: "100",
      average: "500.00",
      bankReady: "可以",
      bank: "004 香港上海滙豐銀行",
      bankName: "DEMO TECHNOLOGY LIMITED",
      bankAccount: "000000000001",
      lastName: "陳",
      firstName: "大文",
      email: state.email || "demo@example.com",
      position: "董事",
      mobile: "+852 6000 0000",
      website: "https://example.com",
      webReady: "可以",
      signer: "DEMO USER",
      signerTitle: "董事",
    });
    state.sales = ["服務"];
    state.methods = ["Visa / Mastercard", "轉數快"];
    state.scenes = ["網站"];
    state.people = [
      {
        kind: "person",
        last: "陳",
        first: "大文",
        email: "owner@example.com",
        phone: "+85260000000",
        share: "100",
      },
    ];
    state.directors = [
      {
        kind: "person",
        last: "陳",
        first: "大文",
        email: "director@example.com",
      },
    ];
    state.files = {
      statement: [{ name: "DEMO-bank-statement.pdf", size: 10240, demo: true }],
      logo: [{ name: "DEMO-logo.png", size: 2048, demo: true }],
    };
    state.errors = {};
  }
  const actions = {
    close: () => $("#modal").close(),
    "to-register": () => go("register"),
    home: () => {
      state.readonly = false;
      go("applications");
    },
    logout: () =>
      modal(
        "登出",
        "<p>未儲存的內容會遺失。已儲存草稿仍保留於本瀏覽器。</p>",
        btn("取消", "close") + btn("確認登出", "confirm-logout", "primary"),
      ),
    "confirm-logout": () => {
      state.session = false;
      state.email = "";
      newApplication();
      go("login");
    },
    login: () => {
      const email = state.values.authEmail || "";
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        state.errors.authEmail = "請輸入有效的電郵地址";
        render();
        return;
      }
      state.email = email.toLowerCase();
      state.pendingDraft = null;
      startOtp();
    },
    register: () => {
      const es = {};
      for (const [k, l] of [
        ["registerCompany", "法定企業名稱"],
        ["registerLast", "姓氏"],
        ["registerFirst", "名稱"],
        ["authEmail", "電郵地址"],
      ])
        if (!state.values[k]) es[k] = "請填寫" + l;
      if (!/^\S+@\S+\.\S+$/.test(state.values.authEmail || ""))
        es.authEmail = "請輸入有效電郵地址";
      if (!$("#authority").checked || !$("#terms").checked)
        es.terms = "請確認授權聲明及條款";
      if (Object.keys(es).length) {
        state.errors = es;
        render();
        return;
      }
      state.email = state.values.authEmail.toLowerCase();
      state.registerSeed = {
        companyEn: state.values.registerCompany,
        lastName: state.values.registerLast,
        firstName: state.values.registerFirst,
      };
      startOtp();
    },
    verify: () => {
      const code = $$("[data-otp]")
        .map((i) => i.value)
        .join("");
      if (Date.now() > state.otpExpires) {
        state.otpError = "驗證碼已過期，請重新發送。";
        render();
        return;
      }
      if (code !== "123456") {
        state.otpError = "驗證碼不正確，請輸入 Demo 驗證碼 123456。";
        render();
        return;
      }
      state.session = true;
      if (state.pendingDraft) {
        loadRecord(state.pendingDraft);
        state.pendingDraft = null;
      } else if (state.registerSeed) {
        const seed = state.registerSeed;
        newApplication();
        Object.assign(state.values, seed);
        state.registerSeed = null;
        go("form/1");
      } else go("applications");
    },
    resend: () => {
      if (Date.now() < state.resendAt) return;
      startOtp();
      toast("示例驗證碼已更新為 123456，未寄出真實電郵");
    },
    expire: () => {
      state.otpExpires = Date.now() - 1;
      state.otpError = "驗證碼已過期，請重新發送。";
      state.resendAt = 0;
      render();
    },
    retrieve: () => {
      let q = (state.values.lookup || "").toLowerCase();
      let r = state.records.find(
        (r) =>
          r.status === "草稿" && (r.id.toLowerCase() === q || r.email === q),
      );
      if (!r) {
        modal(
          "草稿查詢失敗",
          '<div class="notice error">本瀏覽器沒有符合的草稿。請確認電郵地址或申請編號。</div>',
        );
        return;
      }
      state.email = r.email;
      state.pendingDraft = r;
      startOtp();
    },
    new: () => {
      newApplication();
      go("form/1");
    },
    step: (el) => {
      state.readonly = false;
      state.errors = {};
      go("form/" + el.dataset.step);
    },
    next: () => {
      let es = validate(state.step);
      if (Object.keys(es).length) {
        state.errors = es;
        render();
        $(".notice.error")?.scrollIntoView({ block: "center" });
        return;
      }
      go(state.step === 6 ? "review" : "form/" + (state.step + 1));
    },
    save,
    "retry-save": () => {
      state.failSave = false;
      save();
    },
    "retry-submit": () => {
      state.failSubmit = false;
      submit();
    },
    submit,
    "confirm-submit": () => {
      try {
        persist(snapshot("審核中"));
        modal(
          "申請提交成功",
          `<div class="notice success">模擬申請已建立，等待審核。</div><p>申請編號：<strong>${state.id}</strong></p><p>您可在「我的申請」查看資料及進度。</p>`,
          btn("返回我的申請", "home", "primary"),
        );
      } catch {
        modal(
          "申請未能提交",
          '<div class="notice error">本機儲存失敗，內容仍保留。請下載草稿備份。</div>',
          btn("返回檢閱", "close") + btn("下載草稿", "export", "primary"),
        );
      }
    },
    open: (el) => loadRecord(state.records.find((r) => r.id === el.dataset.id)),
    progress: (el) => {
      let r = state.records.find((r) => r.id === el.dataset.id);
      modal(
        "申請進度",
        `<p>${esc(r.id)} · ${esc(r.values.companyZh || r.values.companyEn)}</p><ul class="timeline"><li class="done">建立申請表<small>${esc(r.created)}</small></li><li class="done">已提交申請</li><li class="${r.status === "已完成" ? "done" : ""}">${r.status === "已完成" ? "審核完成" : "審核中"}</li></ul><p class="hint">此進度為本機 Demo 狀態，不是正式審核結果。</p>`,
      );
    },
    sample: () =>
      modal(
        "填入示例資料",
        "<p>這會取代目前未儲存的輸入，已儲存草稿不受影響。</p>",
        btn("取消", "close") + btn("確認填入", "confirm-sample", "primary"),
      ),
    "confirm-sample": () => {
      sample();
      $("#modal").close();
      render();
    },
    "show-errors": () => {
      state.errors = validate(state.step);
      if (!Object.keys(state.errors).length) toast("目前此頁資料沒有發現錯誤");
      else render();
    },
    "focus-error": (el) => {
      const target = $("#wrap-" + el.dataset.id);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.querySelector("input,select,textarea,button")?.focus();
    },
    more: () =>
      modal(
        "更多選項",
        "<p>可隨時儲存草稿、下載備份，或返回我的申請。</p>",
        btn("我的申請", "home") +
          btn("下載草稿", "export") +
          btn("儲存草稿", "save", "primary"),
      ),
    export: () => {
      const blob = new Blob([JSON.stringify(snapshot(), null, 2)], {
          type: "application/json",
        }),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = "allinpay-draft-" + (state.id || "new") + ".json";
      a.click();
      URL.revokeObjectURL(url);
      toast("已下載草稿 JSON 備份");
    },
    upload: (el) => $(`[data-file="${el.dataset.key}"]`).click(),
    "remove-file": (el) => {
      state.files[el.dataset.key].splice(+el.dataset.index, 1);
      render();
    },
    "preview-file": (el) => {
      let f = state.files[el.dataset.key][+el.dataset.index];
      if (f.url && !f.needsReselect) window.open(f.url, "_blank", "noopener");
      else
        modal(
          "附件資訊",
          `<p>${esc(f.name)}</p><p class="hint">${f.demo ? "這是示例附件，沒有真實文件內容。" : "草稿只儲存檔名，請重新選取檔案以預覽。"}</p>`,
        );
    },
    "add-person": (el) => personModal(el.dataset.group, el.dataset.kind),
    "edit-person": (el) =>
      personModal(
        el.dataset.group,
        state[el.dataset.group][+el.dataset.index].kind,
        +el.dataset.index,
      ),
    "remove-person": (el) => {
      state[el.dataset.group].splice(+el.dataset.index, 1);
      render();
    },
    "save-person": () => {
      let p = { kind: state.personEdit.kind };
      $$("[data-person]").forEach(
        (i) => (p[i.dataset.person] = i.value.trim()),
      );
      let req =
        state.personEdit.kind === "company"
          ? ["company"]
          : ["last", "first", "email"];
      if (state.personEdit.group === "people") req.push("share");
      if (
        req.some((k) => !p[k]) ||
        (p.email && !/^\S+@\S+\.\S+$/.test(p.email)) ||
        (p.share && (+p.share < 25 || +p.share > 100))
      ) {
        $("#person-error").textContent =
          "請填妥必填資料、有效電郵及 25–100% 股份持有量。";
        return;
      }
      let { group, index } = state.personEdit;
      if (index < 0) state[group].push(p);
      else state[group][index] = p;
      $("#modal").close();
      render();
    },
    "add-shop": () => shopModal(),
    "edit-shop": (el) => shopModal(+el.dataset.index),
    "remove-shop": (el) => {
      state.shops.splice(+el.dataset.index, 1);
      render();
    },
    "save-shop": () => {
      const p = { file: state.shopFile };
      $$("[data-shop]").forEach((i) => (p[i.dataset.shop] = i.value.trim()));
      if (
        !p.name ||
        !p.address ||
        !/^\d{8}(?:-\d{3})?$/.test(p.br) ||
        !Number.isInteger(+p.terminals) ||
        +p.terminals < 1 ||
        !p.file
      ) {
        $("#shop-error").textContent =
          "請填妥店鋪資料、有效 BR、終端機正整數及 BR 文件。";
        return;
      }
      if (state.shopIndex < 0) state.shops.push(p);
      else state.shops[state.shopIndex] = p;
      $("#modal").close();
      render();
    },
    "clear-signature": () => {
      state.signature = "";
      signatureCanvas();
    },
    "demo-signature": () => {
      let c = $("#signature"),
        ctx = c.getContext("2d");
      ctx.font = "italic 30px Arial";
      ctx.fillText("DEMO SIGNATURE", 30, 90);
      state.signature = c.toDataURL();
    },
    seed: () => {
      if (
        state.records.some(
          (r) => r.email === state.email && r.id.startsWith("DEMO-"),
        )
      ) {
        toast("進度示例已存在");
        return;
      }
      const saved = structuredClone(state);
      sample();
      for (const [i, status] of ["草稿", "審核中", "已完成"].entries()) {
        state.id = "DEMO-" + (i + 1);
        let r = snapshot(status);
        r.step = i + 1;
        r.values.companyZh = [
          "海港科技有限公司（示例）",
          "新星零售有限公司（示例）",
          "城市精選有限公司（示例）",
        ][i];
        persist(r);
      }
      const records = state.records;
      state = { ...saved, records };
      render();
    },
  };
  function startOtp() {
    state.otpExpires = Date.now() + 600000;
    state.resendAt = Date.now() + 60000;
    state.otpError = "";
    go("verify");
  }
  function render() {
    let [page, num] = route();
    page = page || "login";
    if (
      !state.session &&
      !["login", "register", "verify", "retrieve"].includes(page)
    ) {
      location.hash = "/login";
      return;
    }
    if (["login", "register", "verify", "retrieve"].includes(page))
      $("#app").innerHTML = auth(page);
    else
      $("#app").innerHTML =
        `<div class="shell">${header()}<main class="main">${page === "applications" ? applications() : page === "review" ? review() : application(Math.max(1, Math.min(6, +num || 1)))}</main>${footer()}</div>`;
    signatureCanvas();
    $("#auth-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      actions[
        page === "verify"
          ? "verify"
          : page === "register"
            ? "register"
            : page === "retrieve"
              ? "retrieve"
              : "login"
      ]();
    });
    updateTimer();
  }
  function updateTimer() {
    let b = $("#resend"),
      t = $("#otp-timer");
    if (!b) return;
    const secs = Math.max(0, Math.ceil((state.resendAt - Date.now()) / 1000));
    b.disabled = secs > 0;
    b.textContent = secs ? `重新發送（${secs}s）` : "重新發送";
    t.textContent =
      Date.now() > state.otpExpires
        ? "驗證碼已過期"
        : "有效時間：" +
          Math.max(0, Math.ceil((state.otpExpires - Date.now()) / 1000)) +
          " 秒";
  }
  
// SOURCE MODULE: external-onboarding-bootstrap.js
// Reuse the exact backend schema/renderer/validators inside the existing External shell.
const steps = [
  "文件材料",
  "主體資料",
  "經營與聯繫",
  "結算帳戶",
  "產品與費率",
  "確認提交",
];
names.splice(0, names.length, ...steps);
const DEMO = { br: null, fileURLs: new Map() },
  BO = { user: null },
  rows = [
    {
      客戶中文名稱: "海港科技有限公司（示例）",
      客戶英文名稱: "SAMPLE HARBOUR LIMITED",
    },
  ];
let defaults = () => {},
  requiredFiles = () => [],
  validateStep = () => ({}),
  productChecks = () => [],
  fillSample = () => {},
  brStart = () => {},
  brReview = () => {},
  brResult = () => {};
const can = () => true,
  deny = () => {},
  mask = (v) => String(v || ""),
  labelHTML = (v) => esc(v).replaceAll("\n", "<br>");
const pill = (v, c = "") => `<span class="status ${c}">${esc(v)}</span>`;
const check = (x) =>
  `<label class="check"><input type="checkbox" data-check="${x.id}" ${state.checks[x.id] ? "checked" : ""}>${esc(x.label)}</label>`;
const demoBar = () =>
  `<div class="demo"><div class="demo-controls"><span>DEMO · 文件在本機辨識，其他業務流程為示例</span>${btn("填入完整示例", "sample")}${btn("清空表單", "clear-form")}<label><input type="checkbox" id="simulate-failure" ${state.fail ? "checked" : ""}>模擬提交失敗</label></div></div>`;
const oldExternalRoute = route;
route = function () {
  const r = oldExternalRoute();
  r.page = r[0] === "form" ? "application" : r[0];
  r.step = Math.max(1, Math.min(6, +r[1] || 1));
  return r;
};
const oldExternalGo = go;
go = function (p) {
  oldExternalGo(p.replace(/^application\//, "form/"));
};
function showErrors(errors, step) {
  state.errors = { ...errors, _form: "請檢查標示欄位；也可先儲存草稿後補充。" };
  state.step = step;
  if (location.hash === "#/form/" + step) render();
  else location.hash = "/form/" + step;
}
state.checks = {};
state.emailVerified = false;
state.fail = false;
state.people = { directors: 1, authSigners: 0, shareHolders: 0 };
window.AllinPayDemo = {};
actions.restore = () => {};
actions["confirm-edit"] = () => {};
actions["br-start"] = () => {};
let uploadRow = (d) => {
  const f = state.files[d.id];
  return `<div class="upload-row" data-upload-row="${d.id}"><div class="upload-heading"><strong>${labelHTML(d.name)}</strong>${pill(f ? "已選取" : "選填", f ? "green" : "gray")}</div><p class="hint">${esc(d.hint)}</p><div class="file-state">${f ? esc(f.name) + (f.needsReselect ? " · 請重新選取" : "") : "尚未選擇文件"}</div><div class="upload-actions">${f ? btn("預覽", "preview-demo-file", "", `data-id="${d.id}"`) + btn("移除", "document-remove-file", "danger", `data-id="${d.id}"`) : ""}${btn("選擇文件", "demo-upload", "", `data-id="${d.id}"`)}<input hidden type="file" data-demo-upload="${d.id}" accept=".pdf,.jpg,.jpeg,.png,.zip"></div></div>`;
};
actions["demo-upload"] = (el) =>
  $(`[data-demo-upload="${el.dataset.id}"]`).click();
actions["preview-demo-file"] = (el) => {
  const f = state.files[el.dataset.id],
    url = DEMO.fileURLs.get(el.dataset.id);
  modal(
    "文件預覽",
    url && /\.(png|jpe?g)$/i.test(f.name)
      ? `<img class="batch-preview" alt="文件預覽" src="${url}">`
      : `<p>${esc(f?.name || "未選取")} · ${f?.demo ? "示例附件" : "請重新選取以預覽"}</p>`,
  );
};
actions["document-remove-file"] = (el) => {
  const url = DEMO.fileURLs.get(el.dataset.id);
  if (url) URL.revokeObjectURL(url);
  DEMO.fileURLs.delete(el.dataset.id);
  delete state.files[el.dataset.id];
  render();
};


// SOURCE MODULE: onboarding-v2.js
// OATS V2 onboarding. Browser-only demonstration; no OCR, screening or payment API calls.
const V2 = V2_DATA;
const v2Groups = V2.catalog.GROUPS;
const v2Fields = V2.forms.flatMap((f) => f.sections.flatMap((s) => s.fields));
const v2ById = Object.fromEntries(v2Fields.map((f) => [f.id, f]));
const v2PersonKeys = [
  "name",
  "firstNameEn",
  "lastNameEn",
  "idcardType",
  "idcardNo",
  "idcardNoPeriod",
  "birthDay",
];
let v2OcrEdit = null;
const v2Raw = (k) => String(state.values[k] ?? "").trim();
const v2Num = (k) => Number(v2Raw(k)) || 0;
const v2Model = () => state.values.__v2;
const v2RowKey = (g, i) => g.k + "|" + i;
const v2Rows = () =>
  v2Groups.flatMap((g) =>
    v2Model().groups[g.k]
      ? g.rows
          .map((r, i) => ({
            g,
            r,
            i,
            key: v2RowKey(g, i),
            st: v2Model().rates[v2RowKey(g, i)],
          }))
          .filter((x) => x.st?.on)
      : [],
  );
const v2Has = (key, predicate = () => true) =>
  v2Rows().some((x) => x.g.k === key && predicate(x.r));
const v2Cnp = () => v2Has("CNP") || v2Has("PBL", (r) => !!r.brand);
const v2Offline = () => v2Has("POS") || v2Has("INQR");
const v2Amex = () =>
  ["HKG", "SGP"].includes(v2Raw("addrCountryCode")) &&
  v2Rows().some(
    (x) =>
      ["POS", "CTV", "CNP", "PBL", "ONE"].includes(x.g.k) &&
      x.r.brand === "AMERICAEXPRESS",
  );
const v2DateDays = (d) =>
  d
    ? Math.round(
        (new Date(d + "T00:00:00") - new Date(new Date().toDateString())) /
          86400000,
      )
    : 99999;
const v2NormalizeName = (s) =>
  String(s)
    .toUpperCase()
    .replace(/LIMITED/g, "LTD")
    .replace(/ROAD/g, "RD")
    .replace(/[^A-Z0-9\u3400-\u9fff]/g, "");
function v2Options(id) {
  if (/ProvinceCode$/.test(id)) {
    const k = id.startsWith("card") ? "card" : "addr",
      country = v2Raw(k + "CountryCode");
    return (
      V2.catalog.PROVINCES[
        k === "card" && country === "HKG" ? "HKG_CARD" : country
      ] || []
    );
  }
  if (/CityCode$/.test(id))
    return (
      V2.catalog.CITIES[
        v2Raw((id.startsWith("card") ? "card" : "addr") + "ProvinceCode")
      ] || []
    );
  return V2.options[id] || V2.options[id.split(".").pop()] || [];
}
function v2Canonical(k, v) {
  if (v === undefined || v === null || v === "") return "";
  const list = V2.options[k] || V2.options[k.split(".").pop()] || [];
  if (list.some((o) => o[0] === v)) return v;
  const aliases = {
    legalStatus: {
      "法人團體 · Body Corporate": "BODY_CORPORATE",
      "個人 · Individual": "PERSON",
      "合夥 · Partnership": "PARTNER",
      "非屬法團 · Unincorporated Body": "NO_CORPORATION",
    },
    riskLevel: { 一般: "1" },
    chargeWay: {
      按月結算: "MONTH_SETTLE",
      月結扣費: "MONTH_SETTLE",
      預付費: "PRE_FEE",
      餘額扣費: "BALANCE",
    },
  };
  if (aliases[k]?.[v]) return aliases[k][v];
  const clean = (s) => String(s).replace(/[\s–—-]/g, "");
  const match = list.find(
    (o) => String(v).startsWith(o[0] + " ") || clean(v) === clean(o[1]),
  );
  return match?.[0] ?? String(v);
}
function v2Ensure() {
  if (v2Model()?.version === 2) return;
  const hadData = !!state.values.merchantName;
  if (!hadData)
    state.people = { directors: 1, authSigners: 0, shareHolders: 0 };
  for (const k of Object.keys(state.values))
    state.values[k] = v2Canonical(k, state.values[k]);
  for (const [k, v] of Object.entries(V2.defaults))
    if (
      state.values[k] === undefined ||
      (k === "riskLevel" && !["1", "2", "3"].includes(state.values[k]))
    )
      state.values[k] = v;
  if (v2Raw("settlePeriod").includes("系統")) state.values.settlePeriod = "T1";
  if (v2Raw("cardBankCode"))
    state.values.cardBankCode = v2Raw("cardBankCode").split(" ")[0];
  const geoAlias = {
    香港: "HK-HKI",
    九龍: "HK-KLN",
    新界: "HK-NT",
    廣東省: "CN-GD",
    上海市: "CN-SH",
    北京市: "CN-BJ",
    深圳市: "CN-GD-SZ",
    廣州市: "CN-GD-GZ",
  };
  for (const k of [
    "addrProvinceCode",
    "addrCityCode",
    "cardProvinceCode",
    "cardCityCode",
  ])
    if (geoAlias[v2Raw(k)])
      state.values[k] =
        k === "cardProvinceCode" && v2Raw("cardCountryCode") === "HKG"
          ? "HKG"
          : geoAlias[v2Raw(k)];
  state.values.__v2 = {
    version: 2,
    groups: {},
    rates: {},
    combo: {},
    sme: {},
    links: { authSigners: {}, shareHolders: {} },
    signals: {},
    ocr: [],
    ack: {},
    manualRisk: false,
    legacy: hadData,
  };
  if (hadData)
    for (const [id, g] of [
      ["603:4689", "POS"],
      ["603:4745", "INQR"],
      ["603:4709", "CNP"],
    ])
      if (state.checks[id]) v2SetGroup(g, true);
  // A new merchant starts with no categories or products selected.
  state.values.mccName =
    V2.catalog.MCCS.find((m) => m.c === v2Raw("mcc"))?.n || "";
}
function v2Reset() {
  state.values = structuredClone(V2.defaults);
  state.checks = {};
  state.files = {};
  state.people = { directors: 1, authSigners: 0, shareHolders: 0 };
  state.emailVerified = false;
  state.errors = {};
  state.draftId = null;
  state.savedAt = null;
  state.editing = null;
  DEMO.br = null;
  v2Ensure();
}
defaults = () => {
  Object.assign(state.values, structuredClone(V2.defaults));
  v2Ensure();
};
v2Ensure();
function v2SetGroup(k, on) {
  const m = v2Model(),
    g = v2Groups.find((g) => g.k === k);
  m.groups[k] = on;
  g.rows.forEach((r, i) => {
    m.rates[v2RowKey(g, i)] ??= { on: false, ct: r.ct || null, v: {} };
  });
}
function v2Score() {
  const items = [],
    add = (label, n) => items.push({ label, n }),
    m = V2.catalog.MCCS.find((m) => m.c === v2Raw("mcc")),
    s = v2Model().signals;
  if (v2Raw("licencePeriod") === "01") add("經營年限少於 1 年", 15);
  else if (v2Raw("licencePeriod") === "02") add("經營年限 1–3 年", 8);
  if (v2Raw("legalStatus") === "PERSON") add("法律地位為個人", 10);
  if (v2Raw("registerCapital") === "01") add("註冊資本少於 10 萬", 6);
  if (
    v2Raw("registerCertPeriod") &&
    v2DateDays(v2Raw("registerCertPeriod")) < 90
  )
    add("註冊證書距到期少於 90 天", 8);
  if (m?.lv === "high") add("MCC 屬高風險", 25);
  else if (m?.lv === "mid") add("MCC 屬中風險", 12);
  if (v2Cnp()) add("開通 CNP／PayByLink 卡產品", 15);
  if (v2Cnp() && v2Raw("connectType") === "0") add("卡產品採直連", 10);
  if (v2Num("avgMonthAmount") > 500000) add("月銷售超過 500,000", 10);
  if (v2Num("maxAmount") > 20000) add("單筆最高超過 20,000", 8);
  if (m && m.avg > 0 && v2Num("avgPerAmount") > m.avg * 3)
    add("平均單筆偏離行業常態超過 3 倍", 12);
  const edits = v2Model().ocr.filter(
    (o) => o.applied && v2Raw(o.key) !== String(o.applied),
  ).length;
  if (s.ocr || edits >= 2) add("OCR 與人工修改差異不少於 2 項", 10);
  if (s.virtual || (v2Offline() && !state.files["101401"]))
    add("無門店照／虛擬辦公室", 12);
  if (v2Raw("isCompay") === "N") add("結算帳戶為對私", 8);
  if (
    v2Raw("isCompay") === "Y" &&
    v2Raw("cardName") &&
    v2Raw("merchantEnglishName") &&
    v2NormalizeName(v2Raw("cardName")) !==
      v2NormalizeName(v2Raw("merchantEnglishName"))
  )
    add("對公帳戶名稱與英文商戶名稱不一致", 15);
  if (s.cardlink) add("帳戶已關聯其他商戶", 20);
  if (s.prepaid) add("涉及預付／儲值／預售", 20);
  const total = Math.min(
      100,
      items.reduce((n, x) => n + x.n, 0),
    ),
    reject = s.sanction
      ? "命中制裁／PEP 名單"
      : s.frozen
        ? "關聯已凍結／關閉商戶"
        : total > 70
          ? "風控評分超過 70"
          : null;
  return {
    items,
    total,
    reject,
    level: total <= 20 ? "1" : total <= 45 ? "2" : "3",
  };
}
function v2SyncDerived() {
  for (const group of ["authSigners", "shareHolders"])
    for (const [i, d] of Object.entries(v2Model().links[group])) {
      if (d === null || d === undefined || +d >= state.people.directors)
        continue;
      for (const k of v2PersonKeys)
        if (!(group === "authSigners" && k === "birthDay"))
          state.values[`${group}[${i}].${k}`] =
            state.values[`directors[${d}].${k}`] || "";
    }
  state.values.mccName =
    V2.catalog.MCCS.find((m) => m.c === v2Raw("mcc"))?.n ||
    (v2Raw("mcc").length === 4 ? "未列入清單，待人工核定" : "");
  if (!v2Model().manualRisk) state.values.riskLevel = v2Score().level;
}
function v2FileRequired() {
  return Object.fromEntries(V2.documents.map((d) => [d.id, false]));
}
requiredFiles = () =>
  Object.entries(v2FileRequired())
    .filter(([, yes]) => yes)
    .map(([id]) => id);
function v2Required() {
  const v = state.values,
    r = new Set([
      "legalStatus",
      "merchantType",
      "merchantName",
      "merchantShortName",
      "merchantEnglishName",
      "merchantEnglishShortName",
      "registerCertType",
      "registerCertNo",
      "registerCertName",
      "registerCertPeriod",
      "registerCapital",
      "licencePeriod",
      "workerNumber",
      "addrCountryCode",
      "addrProvinceCode",
      "addrStreet",
      "addrStreetEn",
      "mcc",
      "riskLevel",
      "contactName",
      "contactPhone",
      "contactEmail",
      "merchantAgreementPeriod",
      "signType",
      "currency",
      "cardCountryCode",
      "cardProvinceCode",
      "cardBankCode",
      "cardName",
      "cardNo",
      "isCompay",
    ]);
  if (v.legalStatus === "BODY_CORPORATE") r.add("nar1Period");
  if (v.addrCountryCode === "CHN") {
    r.add("addrCityCode");
    if (v.legalStatus !== "PERSON") {
      r.add("threeCertFlag");
      if (v.threeCertFlag === "0")
        for (const k of ["creditCode", "organCode", "taxCode"]) r.add(k);
    }
  }
  if (v.cardCountryCode === "CHN") {
    r.add("cardCityCode");
    r.add("cardBranchCode");
  } else r.add("cardBankName");
  if (v.isCompay === "N") r.add("cardIdcardNo");
  if (v2Has("AV") && v.chargeWay === "MONTH_SETTLE") r.add("monthMinPrice");
  if (v2Model().manualRisk && +v.riskLevel < +v2Score().level)
    r.add("riskOverrideReason");
  return r;
}
function v2Visible(f) {
  const k = f.id,
    v = state.values;
  if (k === "groupId") return v.merchantType === "GENERAL";
  if (k === "nar1Period") return v.legalStatus === "BODY_CORPORATE";
  if (k === "threeCertFlag" || /^(creditCode|organCode|taxCode)/.test(k))
    return (
      v.addrCountryCode === "CHN" &&
      v.legalStatus !== "PERSON" &&
      (k === "threeCertFlag" || v.threeCertFlag === "0")
    );
  if (k === "addrCityCode") return v.addrCountryCode === "CHN";
  if (k === "cardCityCode") return v.cardCountryCode === "CHN";
  if (["swiftCode", "cardBankName"].includes(k))
    return v.cardCountryCode !== "CHN";
  if (k === "cardIdcardNo") return v.isCompay === "N";
  if (k === "webUrl") return v2Cnp();
  if (k === "riskOverrideReason") return v2Required().has(k);
  return true;
}
function v2Display(k, v = state.values[k]) {
  return (
    v2Options(k).find((o) => o[0] === v)?.[1] || String(v ?? "") || "尚未填寫"
  );
}
function v2Field(f, index = 0, linked = false) {
  if (!v2Visible(f)) return "";
  const key = f.id.replace("[]", `[${index}]`),
    v = state.values[key] ?? "",
    id = "field-" + key.replace(/[^\w-]/g, "-"),
    required =
      v2Required().has(f.id) ||
      (f.id.includes("[]") &&
        ([
          "name",
          "firstNameEn",
          "lastNameEn",
          "idcardType",
          "idcardNo",
        ].includes(f.id.split(".").pop()) ||
          (f.id.startsWith("authSigners") && f.id.endsWith("birthDay")))),
    error = state.errors[key];
  const ro = linked || ["mccName", "merchantAgreementNum"].includes(key),
    type =
      f.placeholder === "YYYY/MM/DD" ||
      (/Period$|birthDay$/.test(key) &&
        !["settlePeriod", "licencePeriod"].includes(key))
        ? "date"
        : /Email$/.test(key)
          ? "email"
          : /Phone$/.test(key)
            ? "tel"
            : key === "webUrl"
              ? "url"
              : "text";
  let label = f.label.split(/\s{2,}/);
  const heading =
    esc(label[0].replace(/\s*\*/g, "")) +
    (required ? ' <span class="required">*</span>' : "") +
    (label.length > 1
      ? `<span class="en">${esc(label.slice(1).join(" "))}</span>`
      : "");
  const attrs = `id="${id}" data-field="${esc(key)}" data-v2-field="${esc(key)}" ${ro ? "readonly" : ""} ${required ? 'aria-required="true"' : ""} ${error ? 'aria-invalid="true"' : ""} ${f.max ? 'maxlength="' + f.max + '"' : ""}`;
  let control;
  if (f.type === "Select" && key !== "cardBankCode") {
    const opts = v2Options(f.id);
    control = `<select ${attrs} ${ro ? "disabled" : ""}><option value="">請選擇</option>${opts.map(([v1, l]) => `<option value="${esc(v1)}" ${v1 === v ? "selected" : ""}>${esc(l)}</option>`).join("")}${v && !opts.some((o) => o[0] === v) ? `<option value="${esc(v)}" selected>${esc(v)}（請重新選擇）</option>` : ""}</select>`;
  } else
    control = `<input ${attrs} type="${type}" value="${esc(v)}" placeholder="${esc(f.placeholder)}" ${key === "mcc" ? 'list="v2-mcc" inputmode="numeric"' : key === "cardBankCode" && v2Raw("cardCountryCode") === "HKG" ? 'list="v2-banks" inputmode="numeric"' : key === "settlePeriod" ? 'list="v2-settlement"' : ""}>`;
  return `<div class="field ${error ? "invalid" : ""}" data-field-wrap="${esc(key)}"><label for="${id}">${heading}</label>${control}${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ""}${error ? `<div class="error" role="alert">${esc(error)}</div>` : ""}</div>`;
}
function v2Card(title, copy, body) {
  return `<section class="card" data-section="${esc(title)}"><h2>${esc(title)}</h2>${copy ? `<p class="hint">${esc(copy)}</p>` : ""}${body}</section>`;
}
function v2PersonSection(s) {
  const group = s.fields[0].id.split("[")[0],
    links = v2Model().links[group];
  let html = "";
  for (let i = 0; i < state.people[group]; i++) {
    const linked = links?.[i] !== undefined && links?.[i] !== null;
    html += `<div class="repeat"><div class="repeat-heading"><strong>${esc(s.name)} ${i + 1}</strong>${btn("移除此人", "v2-remove-person", "danger", `data-group="${group}" data-index="${i}"`)}</div>${group !== "directors" ? `<div class="v2-person-link"><label class="check"><input type="checkbox" data-v2-link="${group}" data-index="${i}" ${linked ? "checked" : ""} ${!state.people.directors ? "disabled" : ""}>與董事相同</label><select aria-label="沿用哪位董事" data-v2-director="${group}" data-index="${i}" ${!state.people.directors ? "disabled" : ""}>${Array.from({ length: state.people.directors }, (_, j) => `<option value="${j}" ${links?.[i] === j ? "selected" : ""}>董事 ${j + 1} · ${esc(v2Raw("directors[" + j + "].name") || "未填姓名")}</option>`).join("")}</select><small class="hint">${linked ? "董事修改時同步更新；取消勾選可獨立修改。" : "可沿用已登記董事資料及證件。"}</small></div>` : ""}<div class="grid">${s.fields.map((f) => v2Field(f, i, linked)).join("")}</div></div>`;
  }
  return v2Card(
    s.name,
    s.texts[1],
    html +
      btn(
        "＋ 新增一位",
        "v2-add-person",
        "",
        `data-group="${group}" ${group === "authSigners" && v2Amex() && state.people[group] >= 1 ? "disabled" : ""}`,
      ) +
      ' <span class="hint">制裁／PEP：Demo 未執行真實篩查</span>',
  );
}
function v2FormSections(index) {
  return V2.forms[index].sections
    .map((s) => {
      if (!s.fields.length) return "";
      if (s.fields[0]?.id.includes("[]")) return v2PersonSection(s);
      const fs = s.fields.filter(v2Visible);
      if (!fs.length) return "";
      let tail = "";
      if (s.name === "結算參數")
        tail = `<div class="toolbar v2-quick">${["T1", "T2", "T3", "T7"].map((x) => btn(x, "v2-settlement", "", `data-value="${x}"`)).join("")}${btn("使用建議值 " + { 1: "T1", 2: "T2", 3: "T3" }[state.values.riskLevel], "v2-settlement", "", `data-value="${{ 1: "T1", 2: "T2", 3: "T3" }[state.values.riskLevel]}"`)}</div>`;
      if (fs.some((f) => f.id === "riskLevel")) tail = v2RiskSummary();
      return v2Card(
        s.name,
        s.texts[1],
        `<div class="grid">${fs.map((f) => v2Field(f)).join("")}</div>` + tail,
      );
    })
    .join("");
}
function v2RiskSummary() {
  const score = v2Score();
  return `<div class="notice ${score.reject ? "error" : "warn"} v2-risk-summary"><strong>V2 風控示例：${score.total} 分 · ${score.reject ? "拒件" : v2Display("riskLevel", score.level)}</strong><p>${score.items.map((x) => esc(x.label) + " +" + x.n).join("；") || "暫無加分項。"}</p>${v2Model().manualRisk ? btn("恢復系統建議", "v2-reset-risk") : ""}<small>只模擬參考原型規則，不代表正式審核結果。</small></div>`;
}
function v2SmeOptions(brand) {
  const m = +v2Raw("mcc"),
    rules = V2.catalog.SME_RULES[brand];
  return ["SME", "SMESMK", "SMEB2B"].filter((t) => {
    const r = rules[t];
    return (
      r &&
      m &&
      (r.only
        ? r.only.includes(m)
        : !r.ex.some((x) =>
            Array.isArray(x) ? m >= x[0] && m <= x[1] : m === x,
          ))
    );
  });
}
function v2Sme() {
  return v2Card(
    "特計商戶",
    "",
    `<div class="v2-sme-table-wrap"><table class="v2-sme-table"><thead><tr><th scope="col">開通</th><th scope="col">卡組織</th><th scope="col">特計商戶類型</th></tr></thead><tbody>${[
      "VISA",
      "MASTERCARD",
      "AMERICAEXPRESS",
    ]
      .map((b) => {
        const opts = v2SmeOptions(b),
          s = v2Model().sme[b] || {},
          hasMcc = !!v2Raw("mcc");
        return `<tr><td><input aria-label="開通 ${b} 特計商戶" type="checkbox" data-v2-sme="${b}" ${s.on ? "checked" : ""} ${!opts.length ? "disabled" : ""}></td><th scope="row">${b}</th><td>${!hasMcc ? '<span class="hint">請先在第 3 步填寫 MCC</span>' : !opts.length ? '<span class="hint">目前 MCC 不適用任何特計商戶類型</span>' : `<select aria-label="${b} 特計商戶類型" data-v2-sme-type="${b}">${opts.map((o) => `<option ${s.type === o ? "selected" : ""}>${o}</option>`).join("")}</select>`}</td></tr>`;
      })
      .join(
        "",
      )}</tbody></table></div><p class="hint v2-sme-help">下拉只列出目前 MCC 可用的特計類型（按卡組織排除清單自動判定）。</p>`,
  );
}
function v2FeeSummary(r, st) {
  const v = st.v,
    ct = st.ct;
  if (r.mode === "NONE") return "無手續費";
  if (r.mode === "PER") return "每筆 HKD " + (v.per_fix ?? "0.00");
  if (r.mode === "INST")
    return (
      V2.catalog.TENORS.filter((t) => v["t" + t + "_on"])
        .map((t) => t + " 期")
        .join("／") || "請設定開通期數"
    );
  if (ct === "Regional")
    return (
      "本地 " +
      (v.loc_rate ?? "0.00") +
      "%／跨境 " +
      (v.crs_rate ?? "0.00") +
      "%"
    );
  if (ct === "Wallet")
    return (
      "國內錢包 " +
      (v.cn_rate ?? "0.00") +
      "%／香港錢包 " +
      (v.hk_rate ?? "0.00") +
      "%"
    );
  return (v.std_rate ?? "0.00") + "% + HKD " + (v.std_fix ?? "0.00");
}
function v2Products() {
  const shown = v2Groups.filter(
    (g) => ["POS", "CNP", "INQR"].includes(g.k) || v2Model().groups[g.k],
  );
  let html =
    v2Card(
      "產品配置",
      "先選擇產品類別，再勾選開通項目；費率直接顯示於產品同列，毋須逐項開啟視窗。",
      `<div class="check-grid">${v2Groups.map((g) => `<label class="check"><input type="checkbox" data-v2-group="${g.k}" ${v2Model().groups[g.k] ? "checked" : ""}>${g.n}</label>`).join("")}</div>`,
    ) + v2Sme();
  if (!shown.length)
    html +=
      '<div class="notice v2-catalog-empty">尚未選擇產品類別。請勾選上方類別以設定產品與費率。</div>';
  html += shown
    .map((g) => {
      const enabled = !!v2Model().groups[g.k];
      return v2Card(
        g.n + " · 產品項目",
        (g.tip ? g.tip + " " : "") +
          "勾選產品後直接編輯同列費率；未開通時只顯示、不帶入申請。",
        `${g.combo ? `<div class="toolbar">${g.combo.map((c) => `<label class="check"><input type="checkbox" data-v2-combo="${g.k + "|" + c}" ${enabled && v2Model().combo[g.k + "|" + c] ? "checked" : ""} ${enabled ? "" : "disabled"}>${esc(c)}</label>`).join("")}</div>` : ""}<div class="v2-product-grid">${g.rows
          .map((r, i) => {
            const key = v2RowKey(g, i),
              st = v2Model().rates[key] || {
                on: false,
                ct: r.ct || null,
                v: {},
              },
              selected = enabled && st.on;
            const mode =
              r.mode === "INST"
                ? "分期費率"
                : r.mode === "PER"
                  ? "按筆收費"
                  : r.mode === "NONE"
                    ? "無手續費"
                    : "固定費率";
            return `<div class="v2-product ${selected ? "selected" : "preview"}" data-v2-rate-row="${key}"><div class="v2-product-name"><label class="check"><input type="checkbox" data-v2-product="${key}" ${selected ? "checked" : ""} ${enabled ? "" : "disabled"}><span>${esc(r.n)}</span></label>${r.note ? `<p class="hint v2-product-note">${esc(r.note)}</p>` : ""}</div><div class="v2-inline-pricing"><label for="pricing-${key}">收費類型</label>${r.ct ? `<select id="pricing-${key}" data-v2-inline-pricing="${key}" aria-label="${esc(r.n)} 收費類型" ${selected ? "" : "disabled"}>${(r.wal ? ["Wallet", "Blended"] : ["Regional", "Blended"]).map((x) => `<option ${st.ct === x ? "selected" : ""}>${x}</option>`).join("")}</select>` : `<span>${mode}</span>`}</div><div class="v2-inline-fees">${v2InlineFees(g, r, key, st, !selected)}<p class="error v2-inline-error" data-v2-rate-error="${key}" role="alert">${selected ? esc(v2FeeErrors(r, st).join("；")) : ""}</p></div></div>`;
          })
          .join("")}</div>`,
      );
    })
    .join("");
  return '<div class="v2-products-page">' + html + v2FormSections(3) + "</div>";
}
function v2InlineFees(g,r,key,st,disabled) {
  const v=st.v,standard=[['rate','費率（%）','0.00'],['fix','每筆費用（HKD）','0.00'],['min','保底（HKD）','0'],['max','封頂（HKD）','0']];
  const header=fields=>`<div class="v2-rate-line v2-rate-head" style="--fee-count:${fields.length}" aria-hidden="true"><span>適用範圍</span>${fields.map(f=>`<span>${f[1]}</span>`).join('')}</div>`;
  const line=(prefix,label,fields=standard,toggle=null,locked=false)=>`<div class="v2-rate-line" style="--fee-count:${fields.length}">${toggle?`<label class="check v2-rate-scope"><input type="checkbox" data-v2-inline-key="${key}" data-v2-inline-toggle="${toggle}" ${v[toggle]?'checked':''}>${label}</label>`:`<span class="v2-rate-scope">${label}</span>`}${fields.map(([k,l,d])=>{const f=prefix?prefix+'_'+k:k,id='rate-'+key+'-'+f;return `<div class="v2-rate-input"><label for="${id}">${label} ${l}</label><input id="${id}" aria-label="${esc(r.n)} · ${label} ${l}" data-v2-inline-key="${key}" data-v2-inline-field="${f}" inputmode="decimal" value="${esc(v[f]??d)}" ${locked?'disabled':''}></div>`;}).join('')}</div>`;
  let html='';
  if(r.mode==='NONE')html='<span>此項服務無手續費</span>';
  else if(r.mode==='INST'){const fields=[['rate','費率（%）','0.00'],['fix','固定費用（HKD）','0']];html=header(fields)+V2.catalog.TENORS.map(t=>line('t'+t,t+' 期',fields,'t'+t+'_on',!v['t'+t+'_on'])).join('');}
  else if(r.mode==='PER'){const fields=[['per_fix','每筆費用（HKD）','0.00']];html=header(fields)+line('','每筆',fields);}
  else {
    html=header(standard);
    if(st.ct==='Regional'){html+=line('loc','本地卡')+line('crs','跨境卡');if(r.pref)html+=line('pref','優惠費率',standard,'pref_on',!v.pref_on);}
    else if(st.ct==='Wallet')html+=line('cn','國內錢包')+line('hk','香港錢包');
    else html+=line('std','統一費率');
    if(r.dcc){const fields=[['rate','DCC（%）','0.00'],['fix','每筆費用（HKD）','0.00'],['markup','Markup（%）','0.00']];html+=`<p class="hint">DCC 交易 · ${v2Model().combo[g.k+'|DCC交易']?'已啟用':'勾選上方 DCC 交易後可編輯'}</p>`+header(fields)+line('dcc','DCC',fields,null,!v2Model().combo[g.k+'|DCC交易']);}
    if(r.upi)html+=`<div class="v2-rate-upi"><label for="upi-${key}">開通優計劃</label><select id="upi-${key}" data-v2-inline-key="${key}" data-v2-inline-field="upi"><option value="N" ${v.upi!=='Y'?'selected':''}>否</option><option value="Y" ${v.upi==='Y'?'selected':''}>是</option></select></div>`;
  }
  return `<fieldset class="v2-inline-fieldset" aria-label="${esc(r.n)} 費率" ${disabled?'disabled':''}>${html}</fieldset>`;
}
// Page-local edits update the application model; draft persistence remains explicit.
function v2InlineChange(t) {
  const key = t.dataset.v2InlineKey || t.dataset.v2InlinePricing;
  if (!key || t.matches(":disabled")) return;
  const st = v2Model().rates[key],
    [gk, index] = key.split("|");
  if (!st?.on || !v2Model().groups[gk]) return;
  const r = v2Groups.find((g) => g.k === gk).rows[+index];
  if (t.dataset.v2InlinePricing) {
    st.ct = t.value;
    render();
    return;
  }
  if (t.dataset.v2InlineToggle) {
    st.v[t.dataset.v2InlineToggle] = t.checked;
    render();
    return;
  }
  if (t.dataset.v2InlineField) {
    st.v[t.dataset.v2InlineField] = t.value;
    const error = t
      .closest("[data-v2-rate-row]")
      .querySelector("[data-v2-rate-error]");
    error.textContent = v2FeeErrors(r, st).join("；");
    t.setAttribute("aria-invalid", String(!!error.textContent));
  }
}
function v2FeeErrors(r,st) {
  const e=[],v=st.v,number=(k,d,percent=false)=>{const raw=String(v[k]??d);if(!/^\d+(\.\d{1,2})?$/.test(raw)||Number(raw)<0||percent&&Number(raw)>100)e.push('請填寫有效的'+(percent?' 0–100 費率':'非負金額')+'（最多 2 位小數）');};
  const line=p=>{number(p+'_rate','0',true);for(const k of ['fix','min','max'])number(p+'_'+k,'0');if(+v[p+'_max']>0&&+v[p+'_min']>+v[p+'_max'])e.push('保底不可大於封頂');};
  if(r.mode==='NONE')return e;if(r.mode==='INST'){const terms=V2.catalog.TENORS.filter(t=>v['t'+t+'_on']);if(!terms.length)e.push('請至少選擇一個分期期數');for(const t of terms){number('t'+t+'_rate','0',true);number('t'+t+'_fix','0');}}
  else if(r.mode==='PER')number('per_fix','0');else {for(const p of st.ct==='Regional'?['loc','crs']:st.ct==='Wallet'?['cn','hk']:['std'])line(p);if(r.pref&&st.ct==='Regional'&&v.pref_on)line('pref');if(r.dcc&&v2Model().combo['POS|DCC交易']){number('dcc_rate','0',true);number('dcc_fix','0');number('dcc_markup','0',true);}}
  return [...new Set(e)];
}
const v2Label= (k) =>
  (v2ById[k.replace(/\[\d+\]/, "[]")]?.label || "資料欄位")
    .split(/\s{2,}/)[0]
    .replace(/\s*\*/g, "");
const v2MissingDocs = () =>
  V2.documents.filter(
    (d) =>
      v2FileRequired()[d.id] &&
      (!state.files[d.id] || state.files[d.id].needsReselect),
  );
function v2Consistency() {
  const list = [],
    add = (key, title, values, step, hard = false) => {
      const filled = values.filter((x) => x[1]);
      if (filled.length < 2) return;
      const same = filled.every(
        (x) => v2NormalizeName(x[1]) === v2NormalizeName(filled[0][1]),
      );
      const fingerprint = JSON.stringify(filled);
      list.push({
        key,
        title,
        values: filled,
        step,
        hard,
        same,
        fingerprint,
        confirmed: !same && v2Model().ack[key]?.fingerprint === fingerprint,
      });
    };
  if (v2Raw("isCompay") === "Y")
    add(
      "bank-name",
      "公司英文名稱與對公帳戶名稱",
      [
        ["商戶", v2Raw("merchantEnglishName")],
        ["銀行帳戶", v2Raw("cardName")],
      ],
      4,
    );
  for (const o of v2Model().ocr.filter((o) => o.applied))
    add(
      "ocr-" + o.key,
      v2Label(o.key) + " · 文件與表單",
      [
        ["已核對辨識", o.applied],
        ["目前表單", v2Raw(o.key)],
      ],
      o.step || 2,
    );
  return list;
}
function v2ConsistencyCard() {
  const list = v2Consistency();
  return v2Card(
    "資料一致性檢查",
    "比較本次表單及已套用的辨識結果；尚未提供的文件不代表已完成核實。",
    list.length
      ? `<div class="v2-consistency">${list.map((c) => `<div class="v2-check-row"><div><strong>${esc(c.title)}</strong><small>${c.values.map(([l, v]) => esc(l) + "：" + esc(v)).join("／")}</small></div>${pill(c.same ? "一致" : c.confirmed ? "已確認差異" : "待核對", c.same ? "green" : c.confirmed ? "blue" : "amber")}${!c.same ? btn("查看差異", "v2-difference", "", `data-key="${esc(c.key)}"`) : ""}</div>`).join("")}</div>`
      : '<p class="hint">尚未有足夠資料可比對。可先填寫表單，或匯入 BR 核對後套用。</p>',
  );
}
function v2BrStatus() {
  const count = v2Model().ocr.filter(
    (o) => o.applied && /BR/.test(o.source),
  ).length;
  return `<section class="v2-br-status"><div><p>${count ? "已從 BR 帶入 " + count + " 個欄位，請繼續核對" : "尚未匯入 BR，可先手動填寫"}</p><small>BR 可預填名稱、證書資料、完整地址及業務性質；MCC、地區及聯絡方式需另行填寫。</small></div>${btn(count ? "查看辨識來源" : "匯入 BR 並辨識", count ? "br-sources" : "br-start")}</section>`;
}
function v2Documents() {
  const miss = v2MissingDocs(),
    req = requiredFiles(),
    log = v2Model().ocr;
  return (
    `<section class="br-callout"><div><h2>文件上傳與識別</h2><p>先匯入 BR，在 Overlay 核對後帶入 Step 2 主體資料及 Step 3 經營與聯繫。</p><small>BR 支援 PDF、JPG、PNG，文件僅在瀏覽器本機辨識；其他文件提供示例流程。</small></div><div>${btn("匯入 BR", "br-start", "primary")}${btn("多文件辨識示例", "v2-ocr")}</div></section>` +
    v2Card(
      "辨識結果及來源",
      "只會套用你已核對並選取的欄位；低信心或無法辨識的項目不會自動寫入。",
      log.length
        ? `<div class="table-scroll"><table><thead><tr><th>欄位</th><th>核對內容</th><th>辨識來源</th><th>狀態</th></tr></thead><tbody>${log.map((o) => `<tr><td>${esc(v2Label(o.key))}</td><td>${esc(o.value)}</td><td>${esc(o.source)}${o.confidence == null ? "" : " · 示例信心 " + o.confidence + "%"}</td><td>${pill(o.applied ? "已套用" : "待核對", o.applied ? "green" : "amber")}</td></tr>`).join("")}</tbody></table></div>`
        : '<p class="hint">尚未匯入文件，可先手動填寫。</p>',
    ) +
    v2ConsistencyCard() +
    v2Card(
      "必交文件檢查",
      "必交清單會隨法律主體、風險級別、產品及董事／股東設定更新。",
      `<div class="notice ${miss.length ? "warn" : ""}">${req.length - miss.length}／${req.length} 項必交文件已備妥${miss.length ? "；仍缺 " + miss.length + " 項" : ""}</div>${miss.length ? '<ul class="v2-missing">' + miss.map((d) => `<li>${esc(d.name.split("\n")[0])}</li>`).join("") + "</ul>" : ""}`,
    ) +
    v2Card(
      "文件材料",
      "PDF／JPG／PNG／ZIP，每檔上限 10 MB。多頁或多位董事資料可合併為 PDF／ZIP；本機附件不會上傳。",
      `<div class="upload-list">${V2.documents.map((d) => uploadRow(d)).join("")}</div>`,
    )
  );
}
function v2ValidateFields(index) {
  const errors = {},
    required = v2Required();
  for (const s of V2.forms[index].sections)
    for (const f of s.fields.filter(v2Visible)) {
      const group = f.id.includes("[]") ? f.id.split("[")[0] : null;
      for (let i = 0; i < (group ? state.people[group] : 1); i++) {
        const k = f.id.replace("[]", `[${i}]`),
          v = v2Raw(k),
          name = v2Label(k),
          personKey = k.split(".").pop();
        const req =
          required.has(k) ||
          (group &&
            ([
              "name",
              "firstNameEn",
              "lastNameEn",
              "idcardType",
              "idcardNo",
            ].includes(personKey) ||
              (group === "authSigners" && personKey === "birthDay")));
        if (req && !v) {
          errors[k] = "請填寫" + name;
          continue;
        }
        if (!v) continue;
        if (
          f.type === "Select" &&
          k !== "cardBankCode" &&
          !v2Options(f.id).some((o) => o[0] === v)
        )
          errors[k] = "請重新選擇有效的" + name;
        if (f.max && v.length > +f.max)
          errors[k] = name + "不可超過 " + f.max + " 個字元";
        if (
          ["merchantName", "merchantShortName"].includes(k) &&
          new TextEncoder().encode(v).length > 100
        )
          errors[k] = "中文名稱上限 100 bytes，請縮短內容";
        if (
          (/English/.test(k) ||
            ["firstNameEn", "lastNameEn"].includes(personKey)) &&
          !/^[\x20-\x7E]+$/.test(v)
        )
          errors[k] = "請使用英文、數字及英文標點";
        if (/Email$/.test(k) && !/^\S+@\S+\.[a-z]{2,}$/i.test(v))
          errors[k] = "請輸入有效電郵地址";
        if (/Phone$/.test(k) && !/^\+\d{7,15}$/.test(v.replace(/[\s-]/g, "")))
          errors[k] = "請填寫含國際區號的電話，例如 +852 6123 4567";
        if (
          /Period$|birthDay$/.test(k) &&
          !["settlePeriod", "licencePeriod"].includes(k) &&
          !/^\d{4}-\d{2}-\d{2}$/.test(v)
        )
          errors[k] = "請選擇有效日期";
        if (personKey === "birthDay" && v2DateDays(v) > 0)
          errors[k] = "出生日期不能是未來日期";
        if (personKey === "idcardNoPeriod" && v2DateDays(v) < 0)
          errors[k] = "證件已到期，請更新";
        if (k === "mcc" && !/^\d{4}$/.test(v))
          errors[k] = "請輸入 4 位 MCC 行業代碼";
        if (
          k === "registerCertNo" &&
          v2Raw("addrCountryCode") === "HKG" &&
          !/^\d{8}-?\d{3}(?:-\d{2}-\d{2}-[A-Z0-9])?$/i.test(v)
        )
          errors[k] = "請按原件輸入完整登記證號碼，例如 12345678-000-03-26-7";
        if (k === "registerCertPeriod" && v2DateDays(v) < 30)
          errors[k] = "BR 有效期不足 30 天；仍可儲存草稿";
        if (k === "nar1Period" && v2DateDays(v) < 30)
          errors[k] = "NAR1 有效期不足 30 天，請提供最新周年申報表";
        if (k === "merchantAgreementPeriod" && v2DateDays(v) < 0)
          errors[k] = name + "已到期，請核對";
        if (k === "webUrl" && !/^https?:\/\/\S+\.\S+$/i.test(v))
          errors[k] = "請輸入包含 https:// 的有效網站";
        if (k === "settlePeriod" && !/^[TD]\d{1,2}$/.test(v))
          errors[k] = "結算週期格式：T1、T2、T7 或 D1";
        if (k === "swiftCode" && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(v))
          errors[k] = "SWIFT Code 為 8 或 11 位大寫英文／數字（選填）";
        if (
          k === "cardBankCode" &&
          v2Raw("cardCountryCode") === "HKG" &&
          !/^\d{3}$/.test(v)
        )
          errors[k] = "香港銀行代碼須為 3 位數字";
        if (
          k === "cardBranchCode" &&
          v2Raw("cardCountryCode") === "HKG" &&
          !/^\d{3}$/.test(v)
        )
          errors[k] = "香港分行代碼須為 3 位數字（選填）";
        if (k === "cardNo" && !/^[A-Za-z0-9 -]{6,34}$/.test(v))
          errors[k] = "請填寫有效銀行帳號（6–34 位英文或數字）";
        if (
          /Amount$|Rate$|Ratio$|Cycle$|Price$|Fix$|^markup$|^minStlAmt$/.test(k)
        ) {
          if (!/^\d+(\.\d{1,2})?$/.test(v))
            errors[k] = "請輸入非負數值，最多 2 位小數";
          if (/Rate$|Ratio$|^markup$/.test(k) && +v > 100)
            errors[k] = "比例或費率不可超過 100%";
          if (/Cycle$/.test(k) && (!/^\d+$/.test(v) || +v > 180))
            errors[k] = "週期須為 0–180 的整數天數";
        }
      }
    }
  return errors;
}
validateStep = function (step) {
  v2Ensure();
  v2SyncDerived();
  const e =
    step === 1
      ? {}
      : step <= 5
        ? v2ValidateFields({ 2: 0, 3: 1, 4: 2, 5: 3 }[step])
        : {};
  if (step === 1)
    for (const d of v2MissingDocs())
      e["file-" + d.id] = "請提供" + d.name.split("\n")[0];
  if (step === 2) {
    if (!state.people.directors) e._directors = "請至少新增一位董事";
    if (v2Amex() && state.people.authSigners !== 1)
      e._auth = "香港／新加坡開通 AMEX 時，須有且僅有一位授權簽名人";
  }
  if (
    step === 3 &&
    v2Raw("avgPerAmount") &&
    v2Raw("maxAmount") &&
    v2Num("avgPerAmount") > v2Num("maxAmount")
  )
    e.maxAmount = "最高消費金額不可小於平均單筆金額";
  if (
    step === 4 &&
    v2Raw("isCompay") === "N" &&
    !Array.from({ length: state.people.directors }, (_, i) =>
      v2Raw(`directors[${i}].idcardNo`),
    ).includes(v2Raw("cardIdcardNo"))
  )
    e.cardIdcardNo = "對私結算持有人須為已登記董事，證件號碼必須一致";
  if (step === 5) {
    if (!v2Rows().length) e._products = "請至少選擇一項產品";
    for (const x of v2Rows()) {
      const err = v2FeeErrors(x.r, x.st);
      if (err.length)
        e["_fee-" + x.key] = x.g.n + "／" + x.r.n + "：" + err.join("；");
    }
    for (const [ratio, cycle] of [
      ["depositRatio", "depositCycle"],
      ["posCashDepRatio", "posDepCycle"],
      ["onQRDepRatio", "onQRDepCycle"],
      ["inQRDepRatio", "inQRDepCycle"],
    ])
      if (v2Num(ratio) > 0 && v2Num(cycle) < 1)
        e[cycle] = "比例大於 0 時，釋放週期須為 1–180 天";
    for (const [brand, s] of Object.entries(v2Model().sme))
      if (s.on && !v2SmeOptions(brand).includes(s.type))
        e["_sme-" + brand] = brand + " 特計類型不適用目前 MCC，請重新選擇";
  }
  if (step === 6) {
    if (v2Score().reject)
      e._risk = "風控阻擋：" + v2Score().reject + "（Demo）";
    for (const c of v2Consistency())
      if (!c.same && !c.confirmed)
        e["_check-" + c.key] = c.title + "有差異，請核對並確認原因";
  }
  return e;
};
validateAll = () => Object.assign({}, ...[1, 2, 3, 4, 5, 6].map(validateStep));
productChecks = () =>
  v2Rows().map((x) => ({ id: x.key, label: x.g.n + "／" + x.r.n }));
function v2Review() {
  const errors = validateAll(),
    missing = Object.keys(errors).length;
  const signals = [
    ["sanction", "制裁／PEP 命中"],
    ["cardlink", "銀行帳號關聯其他商戶"],
    ["frozen", "關聯已凍結／關閉商戶"],
    ["virtual", "虛擬辦公室／無實體店"],
    ["prepaid", "預付／儲值／預售"],
    ["ocr", "OCR 與人工修改差異較大"],
  ];
  let html = v2Card(
    "提交前檢查",
    "按更新後的 V2 欄位、條件文件及產品配置檢查。",
    `<div class="notice ${missing ? "warn" : ""}">${missing ? "尚有 " + missing + " 項資料需要確認" : "✓ 必填資料已填寫 · ✓ 文件已備妥 · ✓ 電郵已驗證（模擬）"}</div>${
      missing
        ? '<ul class="v2-missing">' +
          [1, 2, 3, 4, 5, 6]
            .map((s) => {
              const e = Object.values(validateStep(s));
              return e.length
                ? `<li>${btn("Step " + s + " " + steps[s - 1] + " · " + e.length + " 項", "step", "text-button", `data-step="${s}"`)}<small>${esc(e.slice(0, 3).join("；"))}${e.length > 3 ? "……" : ""}</small></li>`
                : "";
            })
            .join("") +
          "</ul>"
        : ""
    }`,
  );
  html +=
    v2Card(
      "風控示例設定",
      "以下為可切換的 Demo 狀態，不會查詢真實制裁名單或銀行資料。",
      `<div class="check-grid">${signals.map(([key, label]) => `<label class="check"><input type="checkbox" data-v2-signal="${key}" ${v2Model().signals[key] ? "checked" : ""}>${label}</label>`).join("")}</div>` +
        v2RiskSummary(),
    ) + v2ConsistencyCard();
  for (const [idx, step] of [
    [0, 2],
    [1, 3],
    [2, 4],
    [3, 5],
  ]) {
    html += v2Card(
      steps[step - 1],
      "",
      `<div class="toolbar">${btn("返回修改", "step", "", `data-step="${step}"`)}</div><div class="v2-summary">${V2.forms[
        idx
      ].sections
        .flatMap((s) =>
          s.fields.filter(v2Visible).flatMap((f) => {
            const group = f.id.includes("[]") ? f.id.split("[")[0] : null;
            return Array.from(
              { length: group ? state.people[group] : 1 },
              (_, i) => {
                const key = f.id.replace("[]", `[${i}]`),
                  raw = v2Raw(key);
                if (!raw) return "";
                return `<div><dt>${group ? esc(s.name) + " " + (i + 1) + " · " : ""}${esc(v2Label(key))}</dt><dd>${esc(key === "cardNo" ? mask(raw) : v2Display(f.id, raw))}</dd></div>`;
              },
            );
          }),
        )
        .join("")}</div>` +
        (step === 5
          ? `<h3>已選 ${v2Rows().length} 項產品</h3><div class="v2-summary">${v2Rows()
              .map(
                (x) =>
                  `<div><dt>${esc(x.g.n + "／" + x.r.n)}</dt><dd>${esc(v2FeeSummary(x.r, x.st))}</dd></div>`,
              )
              .join("")}</div>`
          : ""),
    );
  }
  html += v2Card(
    "文件材料",
    "",
    `<div class="toolbar">${btn("返回修改", "step", "", `data-step="1"`)}</div><div class="v2-summary">${V2.documents
      .filter((d) => state.files[d.id] || v2FileRequired()[d.id])
      .map(
        (d) =>
          `<div><dt>${esc(d.name.split("\n")[0])}</dt><dd>${esc(state.files[d.id]?.name || "尚未提供")}${state.files[d.id]?.needsReselect ? "（須重新選取）" : ""}</dd></div>`,
      )
      .join("")}</div>`,
  );
  html +=
    v2Card(
      "帳單名稱預覽",
      "建議使用全大寫「品牌名*城市」，25 字元內。",
      `<div class="statement">${esc(v2Raw("merchantEnglishShortName") || "尚未填寫")}</div>`,
    ) +
    v2Card(
      "聲明及確認",
      "此 Demo 只產生本機申請紀錄，不會向正式平台提交。",
      check({
        id: "613:4956",
        label: "我已核對申請資料，並確認獲授權代表此商戶提交。",
      }),
    );
  return html;
}
application = function (step) {
  v2Ensure();
  v2SyncDerived();
  return `<div class="v2-form" data-schema="oats-v2">${demoBar(true)}<div class="v2-version">OATS V2 · 六步申請流程</div>${v2Model().legacy ? '<div class="notice warn">已保留舊草稿內容。欄位及產品規則已更新至 V2，請重新核對選項、產品費率及新增必填資料。</div>' : ""}${state.editing ? `<div class="notice">正在編輯 ${esc(state.editing)} 的模擬資料</div>` : ""}${
    state.errors._form
      ? `<div class="notice error" role="alert">${esc(state.errors._form)}<ul>${Object.entries(
          state.errors,
        )
          .filter(([k]) => k.startsWith("_") && k !== "_form")
          .map(([, v]) => `<li>${esc(v)}</li>`)
          .join("")}</ul></div>`
      : ""
  }${[2, 3].includes(step) ? v2BrStatus() : ""}${step === 1 ? v2Documents() : step === 5 ? v2Products() : step === 6 ? v2Review() : v2FormSections(step - 2)}<datalist id="v2-mcc">${V2.catalog.MCCS.map((m) => `<option value="${m.c}">${esc(m.n)}</option>`).join("")}</datalist><datalist id="v2-banks">${[
    ["004", "滙豐銀行"],
    ["003", "渣打銀行"],
    ["012", "中國銀行（香港）"],
    ["024", "恒生銀行"],
    ["015", "東亞銀行"],
    ["016", "星展銀行（香港）"],
  ]
    .map(([v, l]) => `<option value="${v}">${l}</option>`)
    .join(
      "",
    )}</datalist><datalist id="v2-settlement">${["T1", "T2", "T3", "T7", "D1"].map((v) => `<option>${v}</option>`).join("")}</datalist></div>`;
};
fillSample = function (row) {
  const existing = row;
  row = row || rows[0];
  v2Reset();
  const future = (n) => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + n);
    return d.toISOString().slice(0, 10);
  };
  Object.assign(state.values, {
    legalStatus: "BODY_CORPORATE",
    merchantName: row["客戶中文名稱"] || "海港科技有限公司",
    merchantShortName: "海港示例",
    merchantEnglishName: row["客戶英文名稱"] || "SAMPLE HARBOUR LIMITED",
    merchantEnglishShortName: "HARBOUR*HK",
    dbaNo: row["DBA no."] || "DEMO-DBA-001",
    registerCertNo: "12345678-000",
    registerCertName: row["客戶英文名稱"] || "SAMPLE HARBOUR LIMITED",
    registerCertPeriod: future(2),
    crCode: "7654321",
    nar1Period: future(1),
    registerCapital: "04",
    licencePeriod: "04",
    workerNumber: "03",
    addrCountryCode: "HKG",
    addrProvinceCode: "HK-HKI",
    addrStreet: "香港中環示例道 88 號（假資料）",
    addrStreetEn: "88 SAMPLE ROAD, CENTRAL, HONG KONG",
    mcc: "5812",
    avgPerAmount: "250.00",
    maxAmount: "3000.00",
    avgMonthAmount: "100000.00",
    contactName: "陳示例",
    contactPhone: "+85261234567",
    contactEmail: "merchant@example.com",
    maintainerName: "林示例",
    maintainerEmail: "maintainer@example.com",
    developer: BO.user?.agencyCode || "MA-001",
    developerEmail: "agency@example.com",
    cardProvinceCode: "HKG",
    cardBankName: "滙豐銀行",
    cardBankCode: "004",
    cardBranchCode: "812",
    cardName: row["客戶英文名稱"] || "SAMPLE HARBOUR LIMITED",
    cardNo: "004812345678838",
    cardAddress: "1 SAMPLE ROAD, HONG KONG",
    swiftCode: "HSBCHKHHHKH",
    webUrl: "https://example.com",
    remark: "純演示資料，不是真實商戶。",
  });
  // A complete new-merchant example demonstrates three real rules: 8 + 10 + 8.
  if (!existing)
    Object.assign(state.values, {
      licencePeriod: "02",
      maxAmount: "25000.00",
      avgMonthAmount: "600000.00",
    });
  if (existing) {
    for (const [key, column] of [
      ["mcc", "MCC 行業代碼"],
      ["cardBankName", "銀行名稱"],
      ["cardBankCode", "銀行代碼"],
      ["cardBranchCode", "分行代碼"],
      ["contactName", "客戶聯繫人"],
      ["contactPhone", "聯絡人電話"],
      ["contactEmail", "聯絡人電郵"],
    ])
      if (existing[column] !== undefined)
        state.values[key] = String(existing[column]);
    const br = String(existing.BR || "").replace(/^BR\s*/, "");
    if (br) state.values.registerCertNo = /^\d{8}$/.test(br) ? br + "-000" : br;
    if (existing["BR 有效期"])
      state.values.registerCertPeriod = existing["BR 有效期"].replaceAll(
        "/",
        "-",
      );
    if (existing.bank) state.values.cardNo = existing.bank;
    v2Model().legacy = true;
  }
  for (const [key, val] of Object.entries({
    name: "陳示例",
    firstNameEn: "DEMO",
    lastNameEn: "CHAN",
    idcardType: "01",
    idcardNo: "Z123456(0)",
    idcardNoPeriod: future(4),
    birthDay: "1990-01-01",
  }))
    state.values["directors[0]." + key] = val;
  v2SetGroup("POS", true);
  for (const r of Object.values(v2Model().rates)) r.on = false;
  v2Model().rates["POS|0"] = {
    on: true,
    ct: "Regional",
    v: {
      loc_rate: "1.50",
      loc_fix: "0.00",
      loc_min: "0",
      loc_max: "0",
      crs_rate: "2.50",
      crs_fix: "0.00",
      crs_min: "0",
      crs_max: "0",
    },
  };
  state.files["101401"] = { name: "DEMO-storefront.png", demo: true };
  v2SyncDerived();
  for (const id of requiredFiles())
    state.files[id] = { name: "DEMO-" + id + ".pdf", size: 1024, demo: true };
  state.emailVerified = true;
  v2SyncDerived();
};
// The independent BR tool remains unchanged; the backoffice entry uses only V2 fields.
const v2OldBrStart = actions["br-start"];
actions["br-start"] = () => {
  v2OldBrStart();
  DEMO.br.values = [
    ["merchantName", "中文名稱", "海港科技有限公司"],
    ["merchantEnglishName", "英文名稱", "SAMPLE HARBOUR TECHNOLOGY LIMITED"],
    ["registerCertName", "註冊證書名稱", "SAMPLE HARBOUR TECHNOLOGY LIMITED"],
    ["registerCertNo", "BR 號碼", "12345678-000"],
    ["registerCertPeriod", "證書有效期", "2028-08-31"],
    ["legalStatus", "法律地位", "BODY_CORPORATE"],
    ["registerCertType", "證書類型", "01"],
  ];
};
brReview = function (ready = false) {
  const b = DEMO.br;
  b.phase = ready ? "ready" : "review";
  modal(
    ready ? "已核對，準備套用" : "核對辨識結果",
    `<p class="hint">${esc(b.filename)} · 固定示例辨識結果，並非讀取上傳文件。</p><div class="br-fields">${b.values.map(([k, l, v]) => `<div class="field"><label for="br-${k}">${l}</label>${V2.options[k] ? `<select id="br-${k}" data-br-field="${k}" ${ready ? "disabled" : ""}>${V2.options[k].map(([val, label]) => `<option value="${val}" ${v === val ? "selected" : ""}>${label}</option>`).join("")}</select>` : `<input id="br-${k}" data-br-field="${k}" value="${esc(v)}" ${ready ? "readonly" : ""}>`}</div>`).join("")}</div><div class="notice warn">仍待核對：英文營業地址；無法辨識：BR 繳款日期。這些項目不會帶入。</div>${ready ? '<p class="br-status">已核對，可套用；地址仍待確認。</p>' : '<label class="check"><input type="checkbox" id="br-checked">我已核對以上 7 個欄位，確認可套用。</label>'}<p id="br-error" class="error"></p>`,
    btn("取消，保留原資料", "close") +
      btn(
        ready ? "確認並套用 7 個欄位" : "已核對，準備套用",
        ready ? "br-apply" : "br-ready",
        "primary",
      ),
  );
};
function v2ImportResult(
  imported,
  pending,
  unrecognized = [],
  done = "close",
  unchanged = [],
) {
  const list = (items) =>
    `<ol>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ol>`;
  modal(
    imported.length ? "已成功寫入申請資料" : "已完成匯入核對",
    `<div class="v2-import-result" data-figma-node="948:6768"><section class="v2-import-success"><h3>完成匯入 · ${imported.length} 個欄位已帶入</h3>${imported.length ? list(imported) : "<p>本次沒有需要新增或取代的欄位。</p>"}${unchanged.length ? "<p>" + unchanged.length + " 個欄位與目前表單一致，已保留原值。</p>" : ""}</section><section class="v2-import-pending"><h3>仍待核對 · ${pending.length} 個欄位未帶入</h3>${pending.length ? list(pending) : "<p>本次沒有仍待核對的欄位。</p>"}</section><section class="v2-import-unrecognized"><h3>無法辨識</h3>${unrecognized.length ? list(unrecognized) : "<p>本次沒有無法辨識的欄位。</p>"}</section><p class="v2-import-note">尚未帶入的項目不會覆蓋原有資料。按「完成」返回申請表後，可繼續核對及補充。</p></div>`,
    btn("完成", done, "primary"),
  );
  $('#modal .modal-head [data-action="close"]').remove();
}
brResult = function () {
  const b = DEMO.br;
  v2ImportResult(
    b.values.map(
      ([k, l, v]) =>
        `${l}：${k === "registerCertPeriod" ? v.replaceAll("-", "/") : v2Display(k, v)}`,
    ),
    ["英文地址：請對照 BR 原件核對完整地址後，再手動填寫。"],
  );
};
function v2OcrStart() {
  v2OcrEdit = null;
  modal(
    "多文件辨識（模擬）",
    '<div class="notice warn">使用固定假資料演示，沒有 OCR 服務，選取的文件不會上傳。</div><p>可選擇多份空白測試文件，或直接使用示例。</p><input id="v2-ocr-files" type="file" multiple accept=".pdf,.png,.jpg,.jpeg"><p class="hint">PDF／PNG／JPG，每檔不超過 10 MB。</p>',
    btn("取消", "close") + btn("使用示例辨識", "v2-ocr-recognize", "primary"),
  );
}
function v2OcrReview(ready = false) {
  modal(
    ready ? "已核對，準備套用" : "核對辨識結果",
    `<div class="notice warn">以下全為示例資料，請確認選取欄位。低信心地址先保留，不會帶入。</div><div class="v2-ocr-list">${v2OcrEdit.map((o, i) => `<label><input type="checkbox" data-v2-ocr-item="${i}" ${o.selected ? "checked" : ""} ${ready || o.confidence < 80 ? "disabled" : ""}><span><strong>${esc(v2Label(o.key))}</strong><small>${esc(o.value)}</small><small class="hint">${o.source} · 信心 ${o.confidence}%${o.confidence < 80 ? " · 仍待核對" : ""}</small></span></label>`).join("")}</div><p class="hint">${ready ? "已核對的欄位可套用；地址仍待確認。" : "請勾選已確認可套用的資料，未選項目保留原值。"}</p><p id="v2-ocr-error" class="error" role="alert"></p>`,
    btn("取消，保留原資料", "close") +
      btn(
        ready ? "確認並套用" : "已核對，準備套用",
        ready ? "v2-ocr-apply" : "v2-ocr-ready",
        "primary",
      ),
  );
}
function v2OcrRecognize() {
  const files = [...($("#v2-ocr-files")?.files || [])];
  if (
    files.some((f) => f.size > 10485760 || !/\.(pdf|png|jpe?g)$/i.test(f.name))
  )
    return toast("請選擇每檔 10 MB 以下的 PDF／PNG／JPG");
  modal(
    "辨識中",
    '<div class="progress-demo"></div><p>正在載入固定示例，未讀取或分析文件內容。</p>',
    "",
  );
  setTimeout(() => {
    if (!$("#modal").open) return;
    if (state.fail)
      return modal(
        "暫時無法辨識文件",
        '<div class="notice warn">模擬辨識失敗，尚未寫入任何資料。</div>',
        btn("手動填寫", "close") + btn("重試", "v2-ocr", "primary"),
      );
    v2OcrEdit = [
      ["merchantName", "海港科技有限公司", "BR", 2],
      ["merchantEnglishName", "SAMPLE HARBOUR TECHNOLOGY LIMITED", "BR", 2],
      ["registerCertName", "SAMPLE HARBOUR TECHNOLOGY LIMITED", "BR", 2],
      ["registerCertNo", "12345678-000", "BR", 2],
      ["registerCertPeriod", "2028-08-31", "BR", 2],
      ["crCode", "7654321", "CI", 2],
      ["nar1Period", "2028-08-31", "NAR1", 2],
      ["directors[0].name", "陳示例", "NAR1", 2],
      ["directors[0].idcardNo", "Z123456(0)", "身份證", 2],
      ["directors[0].birthDay", "1990-01-01", "身份證", 2],
      ["cardName", "SAMPLE HARBOUR TECHNOLOGY LIMITED", "銀行月結單", 4],
      ["cardNo", "004812345678838", "銀行月結單", 4],
      ["addrStreetEn", "88 SAMPLE ROAD, HONG KONG", "BR", 3],
    ].map(([key, value, source, step], i) => ({
      key,
      value,
      source: "示例 " + source,
      step,
      confidence: i === 12 ? 65 : 98,
      selected: i !== 12,
    }));
    v2OcrReview();
  }, 400);
}
submit = function () {
  if (!can(1)) return deny();
  const errors = validateAll();
  if (Object.keys(errors).length) {
    const step = [1, 2, 3, 4, 5, 6].find(
      (s) => Object.keys(validateStep(s)).length,
    );
    showErrors(validateStep(step), step);
    return;
  }
  if (!state.checks["613:4956"]) return toast("請先勾選聲明及確認");
  if (state.fail)
    return modal(
      "申請提交失敗",
      '<div class="notice error">本次模擬提交未成功，所有輸入及文件記錄仍保留。</div><p>可關閉失敗模擬後重試，或先儲存草稿。</p>',
      btn("返回檢閱", "close") +
        btn("儲存草稿", "save-draft") +
        btn("重試提交", "submit", "primary"),
    );
  modal(
    "確認提交申請",
    `<p>將為「${esc(v2Raw("merchantName"))}」建立本機模擬申請。</p><p class="hint">不會連接 All-In Pay、發送電郵或上傳文件。</p>`,
    btn("取消", "close") + btn("確認提交（模擬）", "confirm-submit", "primary"),
  );
};
actions.submit = submit;
Object.assign(actions, {
  "confirm-clear": () => {
    v2Reset();
    $("#modal").close();
    render();
  },
  "v2-add-person": (el) => {
    const g = el.dataset.group;
    if (g === "authSigners" && v2Amex() && state.people[g] >= 1)
      return toast("此情境只可有一位授權簽名人");
    state.people[g]++;
    render();
  },
  "v2-remove-person": (el) => {
    const g = el.dataset.group,
      i = +el.dataset.index,
      n = state.people[g];
    if (g === "directors" && n === 1) return toast("董事至少保留一位");
    for (let j = i; j < n - 1; j++)
      for (const k of v2PersonKeys)
        state.values[`${g}[${j}].${k}`] =
          state.values[`${g}[${j + 1}].${k}`] || "";
    for (const k of v2PersonKeys) delete state.values[`${g}[${n - 1}].${k}`];
    state.people[g]--;
    if (g === "directors") {
      for (const links of Object.values(v2Model().links))
        for (const key of Object.keys(links))
          if (links[key] === i) links[key] = null;
          else if (links[key] > i) links[key]--;
    } else {
      const links = v2Model().links[g];
      for (let j = i; j < n - 1; j++) links[j] = links[j + 1] ?? null;
      delete links[n - 1];
    }
    render();
  },
  "v2-settlement": (el) => {
    state.values.settlePeriod = el.dataset.value;
    render();
  },
  "v2-reset-risk": () => {
    v2Model().manualRisk = false;
    render();
  },
  "v2-difference": (el) => {
    const c = v2Consistency().find((c) => c.key === el.dataset.key);
    if (!c) return;
    modal(
      "核對資料差異",
      `<h3>${esc(c.title)}</h3><ul>${c.values.map(([l, v]) => `<li>${esc(l)}：${esc(v)}</li>`).join("")}</ul><div class="field"><label for="v2-difference-reason">確認差異原因 <span class="required">*</span></label><textarea id="v2-difference-reason" maxlength="500" rows="3">${esc(v2Model().ack[c.key]?.reason || "")}</textarea></div><p class="hint">確認只針對目前資料；相關內容再次修改後須重新核對。</p><p id="v2-difference-error" class="error"></p>`,
      btn("返回修改", "step", "", `data-step="${c.step}"`) +
        btn("確認差異", "v2-ack", "primary", `data-key="${esc(c.key)}"`),
    );
  },
  "v2-ack": (el) => {
    const reason = $("#v2-difference-reason").value.trim();
    if (!reason) {
      $("#v2-difference-error").textContent = "請填寫確認原因";
      return;
    }
    const c = v2Consistency().find((c) => c.key === el.dataset.key);
    v2Model().ack[c.key] = { fingerprint: c.fingerprint, reason };
    $("#modal").close();
    render();
  },
  "v2-ocr": v2OcrStart,
  "v2-ocr-recognize": v2OcrRecognize,
  "v2-ocr-ready": () => {
    if (!v2OcrEdit.some((o) => o.selected)) {
      $("#v2-ocr-error").textContent = "請至少選取一個已核對欄位";
      return;
    }
    v2OcrReview(true);
  },
  "v2-ocr-apply": () => {
    if (state.fail)
      return modal(
        "資料寫入失敗",
        '<div class="notice error">尚未寫入，原有申請內容保留。關閉失敗模擬後可重新核對。</div>',
        btn("返回核對", "v2-ocr-back", "primary") + btn("取消", "close"),
      );
    const selected = v2OcrEdit.filter((o) => o.selected);
    for (const o of selected) {
      state.values[o.key] = o.value;
      o.applied = o.value;
    }
    v2Model().ocr = structuredClone(v2OcrEdit);
    v2SyncDerived();
    modal(
      "已成功寫入申請資料",
      `<div class="notice">${selected.length} 個欄位已帶入</div><div class="import-result"><section><h3>完成匯入</h3><ol>${selected.map((o) => `<li>${esc(v2Label(o.key))}：${esc(o.value)}</li>`).join("")}</ol></section><section><h3>仍待核對 · 未帶入</h3><ol>${
        v2OcrEdit
          .filter((o) => !o.selected)
          .map((o) => `<li>${esc(v2Label(o.key))}：${esc(o.value)}</li>`)
          .join("") || "<li>沒有待核對項目</li>"
      }</ol><h3>無法辨識 · 未帶入</h3><p>商業登記證繳款日期（示例）。</p></section></div><p class="hint">示例不會代替必交文件，請返回文件材料補齊。</p>`,
      btn("完成", "v2-ocr-done", "primary"),
    );
  },
  "v2-ocr-back": () => v2OcrReview(),
  "v2-ocr-done": () => {
    $("#modal").close();
    render();
  },
});
const v2OldRestore = actions.restore;
actions.restore = (el) => {
  v2OldRestore(el);
  v2Ensure();
  v2SyncDerived();
  if (route().page === "application") render();
};
const v2OldEdit = actions["confirm-edit"];
actions["confirm-edit"] = (el) => {
  v2OldEdit(el);
  v2Ensure();
  v2SyncDerived();
  if (route().page === "application") render();
};
const v2Step = actions.step;
actions.step = (el) => {
  if ($("#modal").open) $("#modal").close();
  v2Step(el);
};
const v2SubmitConfirm = actions["confirm-submit"];
actions["confirm-submit"] = () => {
  if (state.fail) return submit();
  v2SubmitConfirm();
};
document.addEventListener("input", (e) => {
  if (e.target.dataset.v2InlineField && e.target.tagName === "INPUT")
    v2InlineChange(e.target);
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.v2Field) {
    const k = t.dataset.v2Field;
    if (k === "riskLevel") v2Model().manualRisk = true;
    if (k === "settlePeriod") {
      state.values[k] = t.value.trim().toUpperCase();
      t.value = state.values[k];
    }
    v2SyncDerived();
    const mccName = $('[data-field="mccName"]');
    if (mccName) mccName.value = state.values.mccName;
    if (t.tagName === "SELECT" && route().page === "application") render();
  }
  if (t.dataset.v2Group) {
    v2SetGroup(t.dataset.v2Group, t.checked);
    render();
  }
  if (t.dataset.v2Product) {
    v2Model().rates[t.dataset.v2Product].on = t.checked;
    render();
  }
  if (t.dataset.v2Combo) {
    v2Model().combo[t.dataset.v2Combo] = t.checked;
    render();
  }
  if (t.dataset.v2Link) {
    const group = t.dataset.v2Link,
      director = +t.closest(".v2-person-link").querySelector("select").value;
    v2Model().links[group][t.dataset.index] = t.checked ? director : null;
    if (group === "authSigners" && t.checked)
      state.values[`authSigners[${t.dataset.index}].birthDay`] =
        state.values[`directors[${director}].birthDay`] || "";
    render();
  }
  if (t.dataset.v2Director) {
    const group = t.dataset.v2Director;
    v2Model().links[group][t.dataset.index] = +t.value;
    if (group === "authSigners")
      state.values[`authSigners[${t.dataset.index}].birthDay`] =
        state.values[`directors[${t.value}].birthDay`] || "";
    render();
  }
  if (t.dataset.v2Signal) {
    v2Model().signals[t.dataset.v2Signal] = t.checked;
    render();
  }
  if (t.dataset.v2Sme) {
    const b = t.dataset.v2Sme;
    v2Model().sme[b] = {
      on: t.checked,
      type: v2Model().sme[b]?.type || v2SmeOptions(b)[0],
    };
    render();
  }
  if (t.dataset.v2SmeType) {
    const b = t.dataset.v2SmeType;
    v2Model().sme[b] = { on: v2Model().sme[b]?.on || false, type: t.value };
  }
  if (t.dataset.v2InlineKey || t.dataset.v2InlinePricing) v2InlineChange(t);
  if (t.dataset.v2OcrItem !== undefined)
    v2OcrEdit[+t.dataset.v2OcrItem].selected = t.checked;
});
// Updated, read-only QA inventory. All form mutations remain in the visible UI.
Object.assign(window.AllinPayDemo, {
  version: "2026.09.24-inline-products-risk-sidebar",
  getOnboarding: () => ({
    version: 2,
    fields: v2Fields.map((f) => f.id),
    documents: V2.documents.map((d) => d.id),
    products: v2Groups.map((g) => ({ key: g.k, count: g.rows.length })),
    errors: validateAll(),
    score: v2Score(),
    selectedProducts: v2Rows().map((x) => ({
      key: x.key,
      name: x.r.n,
      pricing: x.st.ct,
      values: { ...x.st.v },
    })),
  }),
});


// SOURCE MODULE: upload-controls.js
// One upload interaction for cards, BR, batch OCR, and supporting dialogs.
// File selection and file drops dispatch the same existing change handlers.
function fileDropControl({
  inputId,
  accept = ".pdf,.jpg,.jpeg,.png",
  multiple = false,
  title = "拖曳文件至此",
  hint = "PDF／JPG／PNG · 每份上限 10 MB",
  selected = "",
  attributes = "",
}) {
  return `<div class="file-drop-zone" data-file-drop data-file-input="${esc(inputId)}" role="group" aria-label="文件上傳"><svg class="file-drop-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 16V4m-4 4 4-4 4 4M4 15v5h16v-5"/></svg><strong class="file-drop-title">${esc(title)}</strong><small>${esc(hint)}</small>${btn("選擇文件", "choose-file", "", `data-input-id="${esc(inputId)}"`)}<input hidden type="file" id="${esc(inputId)}" accept="${esc(accept)}" ${multiple ? "multiple" : ""} ${attributes}><span class="file-drop-status" role="status">${esc(selected || "或按「選擇文件」從電腦加入")}</span></div>`;
}
actions["choose-file"] = (el) => {
  const input = document.getElementById(el.dataset.inputId);
  if (input && !input.disabled && !input.closest(".external-readonly"))
    input.click();
};
const uploadFileDrag = (e) =>
  Array.from(e.dataTransfer?.types || []).includes("Files");
const uploadZone = (e) =>
  e.target instanceof Element
    ? e.target.closest("[data-file-drop]")
    : e.target?.parentElement?.closest("[data-file-drop]");
const uploadInput = (zone) =>
  zone && document.getElementById(zone.dataset.fileInput);
const uploadEnabled = (zone) => {
  const input = uploadInput(zone);
  return input && !input.disabled && !zone.closest(".external-readonly");
};
const clearUploadHover = () =>
  document
    .querySelectorAll(".document-drag")
    .forEach((z) => z.classList.remove("document-drag"));
document.addEventListener(
  "dragover",
  (e) => {
    if (!uploadFileDrag(e)) return;
    const zone = uploadZone(e);
    e.preventDefault();
    clearUploadHover();
    if (uploadEnabled(zone)) {
      zone.classList.add("document-drag");
      e.dataTransfer.dropEffect = "copy";
    } else e.dataTransfer.dropEffect = "none";
  },
  true,
);
document.addEventListener("dragleave", (e) => {
  const zone = uploadZone(e);
  if (zone && !zone.contains(e.relatedTarget))
    zone.classList.remove("document-drag");
});
document.addEventListener("dragend", clearUploadHover);
document.addEventListener(
  "drop",
  (e) => {
    if (!uploadFileDrag(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    clearUploadHover();
    const zone = uploadZone(e);
    if (!uploadEnabled(zone)) return;
    const input = uploadInput(zone),
      files = [...e.dataTransfer.files];
    if (!files.length) return toast("請拖入文件，不支援資料夾。");
    if (!input.multiple && files.length !== 1)
      return toast("此位置接受一份文件；多份請使用「多文件辨識」。");
    input.files = e.dataTransfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  },
  true,
);
document.addEventListener(
  "change",
  (e) => {
    const t = e.target;
    if (
      t.type !== "file" ||
      t.dataset.demoUpload ||
      ["demo-br-file", "document-batch-files"].includes(t.id)
    )
      return;
    const status = t
      .closest("[data-file-drop]")
      ?.querySelector(".file-drop-status");
    if (status)
      status.textContent =
        [...t.files].map((f) => f.name).join("、") || "尚未選擇文件";
  },
  true,
);
// Preserve each existing input, accept attribute, selection and event handlers.
// The few auxiliary dialogs use the same control without maintaining copies.
let uploadInputSequence = 0;
function enhanceFileUploads() {
  for (const input of document.querySelectorAll(
    'input[type="file"]:not([hidden])',
  )) {
    if (input.closest("[data-file-drop]")) continue;
    input.id ||= "upload-aux-" + ++uploadInputSequence;
    const host = document.createElement("div");
    host.innerHTML = fileDropControl({
      inputId: input.id,
      accept: input.accept,
      multiple: input.multiple,
      title: input.multiple ? "拖曳一份或多份文件至此" : "拖曳文件至此",
      hint: (input.accept || "支援文件") + " · 每份上限 10 MB",
    });
    const zone = host.firstElementChild,
      placeholder = zone.querySelector("input");
    input.before(zone);
    input.hidden = true;
    placeholder.replaceWith(input);
    zone.querySelector("button").disabled = input.disabled;
  }
}
new MutationObserver(enhanceFileUploads).observe(document.body, {
  childList: true,
  subtree: true,
});


// SOURCE MODULE: br-integration.js
// BR is part of the backoffice. Original documents and raw OCR stay in memory.
// No upload API, external OCR, or automatic persistence of review candidates.
let brModules;
const brDefs = [
  ["businessNameZh", "中文名稱", "merchantName", 2],
  ["businessNameEn", "英文名稱", "merchantEnglishName", 2],
  ["certificateNumber", "登記證完整號碼", "registerCertNo", 2],
  ["expiryDate", "註冊證書有效期", "registerCertPeriod", 2],
  ["legalStatus", "法律地位", "legalStatus", 2],
  ["businessAddressZh", "中文地址", "addrStreet", 3],
  ["businessAddressEn", "英文地址", "addrStreetEn", 3],
  ["natureOfBusiness", "業務性質", "remark", 3],
];
const brTargets = {
  businessNameEn: ["merchantEnglishName", "registerCertName"],
  certificateNumber: ["registerCertNo", "registerCertType"],
};
const brLabels = Object.fromEntries(
  brDefs.map(([, label, target]) => [target, label]),
);
Object.assign(brLabels, {
  registerCertName: "註冊證書名稱",
  registerCertType: "註冊證書類型",
  remark: "備註（BR 業務性質）",
});
const brAlive = (b) => DEMO.br === b && !b.disposed;
async function brLoadModules() {
  if (location.protocol === "file:")
    throw Error(
      "本機檔案辨識需要 HTTP 服務。請開啟同一後台的 GitHub 網址，或以 npm run serve 啟動下載的完整原始碼。單一 HTML 仍可使用示範資料。",
    );
  if (!brModules)
    brModules = Promise.all([
      import("./br-engine/engine.mjs?v=20261102-samples"),
      import("./br-engine/parser.mjs?v=20261102-samples"),
    ]).catch((e) => {
      brModules = null;
      throw e;
    });
  return brModules;
}
function brRelease(b = DEMO.br) {
  if (!b || b.disposed) return;
  b.disposed = true;
  b.controller?.abort();
  clearTimeout(b.timer);
  if (b.page) b.page.canvas.width = 1;
  Promise.resolve(b.document?.destroy()).catch(() => {});
  b.document = null;
  b.page = null;
  b.file = null;
  b.result = null;
  b.fields = {};
  b.rawText = "";
}
function brModal(title, body, buttons, kind = "review") {
  modal(title, body, buttons);
  $("#modal").classList.add("br-dialog");
  $("#modal").dataset.br = kind;
}
function brUpload(error = "") {
  const b = DEMO.br;
  if (!brAlive(b)) return;
  b.phase = "upload";
  brModal(
    "匯入香港商業登記證",
    `<p class="hint">選擇文件後，先確認 BR 所在頁面，再開始辨識。</p>${error ? `<p class="notice error" role="alert">${esc(error)}</p>` : ""}${fileDropControl({ inputId: "demo-br-file", title: "拖曳 BR 文件至此", hint: "PDF／JPG／PNG · 每份 10 MB／PDF 5 頁", selected: b.filename || "" })}<p class="hint">文件只在此瀏覽器處理，不會傳送至外部辨識服務。</p>${b.document ? `<div class="br-file-summary"><strong>${esc(b.filename)}</strong><label>BR 頁面 <select id="br-page" aria-label="選擇 BR 頁面">${Array.from({ length: b.document.pages }, (_, i) => `<option value="${i + 1}" ${b.pageNumber === i + 1 ? "selected" : ""}>第 ${i + 1} 頁／共 ${b.document.pages} 頁</option>`).join("")}</select></label><span>${(b.file.size / 1024 / 1024).toFixed(2)} MB</span></div><div id="br-upload-preview" class="br-upload-preview"></div>` : '<p class="hint">未準備文件時，可使用虛構示範資料查看完整流程。</p>'}<p class="hint br-privacy">首次圖片辨識會下載本網站的辨識模型，可能需要較長時間。辨識原文不會存入草稿；按「儲存草稿」才會把已填表單欄位保存在此瀏覽器。</p>`,
    btn("取消", "close") +
      (b.document
        ? btn("開始辨識", "br-recognize", "primary")
        : btn("使用示範資料", "br-recognize", "primary")),
    "upload",
  );
  if (b.page) {
    const c = b.page.canvas.cloneNode();
    c.getContext("2d").drawImage(b.page.canvas, 0, 0);
    c.setAttribute("aria-label", "所選 BR 原件預覽");
    $("#br-upload-preview").append(c);
  }
}
brStart = function () {
  brRelease();
  DEMO.br = {
    phase: "upload",
    disposed: false,
    fields: {},
    selected: new Set(),
    choices: {},
    filename: "",
    pageNumber: 1,
    confirmed: false,
    applied: false,
  };
  brUpload();
};
async function brAccept(file) {
  const b = DEMO.br;
  if (!brAlive(b) || b.phase === "loading" || b.phase === "processing") return;
  if (!file) return;
  b.phase = "loading";
  b.controller = new AbortController();
  const source = b.controller;
  brModal(
    "正在開啟 BR",
    `<div class="progress-demo"></div><p>正在本機讀取 ${esc(file.name)}…</p>`,
    btn("取消", "close"),
    "progress",
  );
  try {
    const [engine] = await brLoadModules();
    if (!brAlive(b) || source.signal.aborted) return;
    const opened = await engine.loadDocument(file);
    if (!brAlive(b) || source.signal.aborted) {
      await opened.destroy();
      return;
    }
    if (b.page) b.page.canvas.width = 1;
    await b.document?.destroy();
    b.document = opened;
    b.file = file;
    b.filename = file.name;
    b.pageNumber = 1;
    b.fields = {};
    b.result = null;
    b.selected.clear();
    b.choices = {};
    b.demo = false;
    const page = await opened.render(1);
    if (!brAlive(b)) {
      page.canvas.width = 1;
      return;
    }
    b.page = page;
    b.controller = null;
    brUpload();
  } catch (e) {
    if (brAlive(b)) brUpload(e.message || "文件無法開啟，請重新選擇。");
  }
}
async function brPage(number) {
  const b = DEMO.br;
  if (!brAlive(b) || b.phase !== "upload") return;
  b.phase = "loading";
  $("#br-page").disabled = true;
  $("#modal [data-action=br-recognize]").disabled = true;
  try {
    const page = await b.document.render(number);
    if (!brAlive(b)) {
      page.canvas.width = 1;
      return;
    }
    if (b.page) b.page.canvas.width = 1;
    b.page = page;
    b.pageNumber = number;
    b.result = null;
    b.fields = {};
    b.selected.clear();
    b.choices = {};
    brUpload();
  } catch (e) {
    if (brAlive(b)) brUpload("此頁無法讀取，請重新選擇文件。");
  }
}
function brDemo() {
  const b = DEMO.br;
  b.demo = true;
  b.filename = "SAMPLE-BR（虛構資料）";
  b.fields = Object.fromEntries(
    brDefs.map(([key]) => [key, { value: "", source: "虛構示例", page: 1 }]),
  );
  const values = {
    businessNameZh: "示例海港科技有限公司",
    businessNameEn: "SAMPLE HARBOUR TECHNOLOGY LIMITED",
    certificateNumber: "12345678-000-09-26-A",
    expiryDate: "2028-08-31",
    legalStatus: "法人團體 · Body Corporate",
    businessAddressEn: "UNIT 1201, 12/F, 88 EXAMPLE ROAD, HONG KONG",
    natureOfBusiness: "TECHNOLOGY SERVICES",
  };
  for (const [k, v] of Object.entries(values)) b.fields[k].value = v;
  b.fields.businessAddressEn.warning = "示例低信心地址，請對照原件核對。";
  b.fields.businessAddressEn.autoSelect = false;
  b.result = { recognized: true, warnings: [], method: "demo" };
  b.selected = new Set(
    brDefs
      .filter(([k]) => values[k] && b.fields[k].autoSelect !== false)
      .map(([k]) => k),
  );
  b.choices = {};
  brReview();
}
async function brRecognize() {
  const b = DEMO.br;
  if (!brAlive(b)) return;
  if (!b.document) return brDemo();
  if (!b.page || b.phase !== "upload") return;
  b.phase = "processing";
  b.confirmed = false;
  b.controller = new AbortController();
  const controller = b.controller;
  brModal(
    "正在辨識你的 BR",
    `<p>${esc(b.filename)} · 第 ${b.pageNumber} 頁</p><section class="br-progress"><h3 id="br-progress-label">載入本機辨識引擎</h3><progress id="br-progress" max="1" value="0"></progress><p>校正文件方向、讀取文字並整理可預填欄位。</p></section><p class="hint">原件與辨識原文只留在本頁；你可以隨時取消。</p>`,
    btn("取消辨識", "br-cancel"),
    "progress",
  );
  b.timer = setTimeout(() => {
    if (brAlive(b) && b.phase === "processing") {
      b.timedOut = true;
      controller.abort();
    }
  }, 120000);
  try {
    const [engine] = await brLoadModules();
    const result = await engine.recognizeDocument({
      ...b.page,
      page: b.pageNumber,
      signal: controller.signal,
      onProgress: ({ progress, label }) => {
        if (brAlive(b) && b.phase === "processing") {
          $("#br-progress").value = progress;
          $("#br-progress-label").textContent = label;
        }
      },
    });
    if (!brAlive(b) || controller.signal.aborted) return;
    b.result = result;
    b.fields = result.fields;
    b.selected = new Set(
      brDefs
        .filter(
          ([k]) =>
            result.recognized &&
            b.fields[k]?.value &&
            b.fields[k].autoSelect !== false,
        )
        .map(([k]) => k),
    );
    b.choices = {};
    b.demo = false;
    if (!brDefs.some(([k]) => b.fields[k]?.value))
      brModal(
        "暫時無法辨識這份 BR",
        '<div class="notice warn">未能取得可預填欄位。請先確認所選頁面是商業登記證（BR）；若原件正確，請重新辨識或手動填寫，這不代表文件一定不清晰。</div>',
        btn("手動填寫", "close") + btn("重新選檔", "br-start", "primary"),
        "failure",
      );
    else brReview();
  } catch (e) {
    if (brAlive(b))
      brUpload(
        controller.signal.aborted
          ? b.timedOut
            ? "辨識超過 120 秒，已停止。可換一份較清晰的文件，或手動填寫。"
            : "已取消辨識，尚未更改申請資料。"
          : "本機辨識未完成。請重試或改用較清晰的文件。",
      );
  } finally {
    clearTimeout(b.timer);
    b.controller = null;
    b.timedOut = false;
  }
}
function brValue(key, b = DEMO.br) {
  return String(b.fields[key]?.value || "").trim();
}
function brPlan(b = DEMO.br) {
  const planned = [];
  for (const [key, , target, step] of brDefs) {
    if (!b.selected.has(key) || !brValue(key, b)) continue;
    for (const to of brTargets[key] || [target]) {
      const value =
          to === "registerCertType" ? "01" : v2Canonical(to, brValue(key, b)),
        before = v2Raw(to);
      planned.push({
        key,
        target: to,
        value,
        before,
        step,
        label: brLabels[to],
        conflict: !!before && before !== value,
        same: before === value,
        write: !before || (before !== value && b.choices[to] === "replace"),
      });
    }
  }
  return planned;
}
function brInvalidate() {
  const b = DEMO.br;
  if (!b) return;
  b.confirmed = false;
  const c = $("#br-checked");
  if (c) c.checked = false;
  const submit = $('[data-action="br-ready"]');
  if (submit) submit.disabled = true;
}
brReview = function (ready = false) {
  const b = DEMO.br;
  if (!brAlive(b)) return;
  b.phase = ready ? "ready" : "review";
  b.confirmed = ready;
  const plans = brPlan(b);
  const warnings = b.result?.warnings || [];
  const rows = brDefs
    .map(([key, label, target, step]) => {
      const d = b.fields[key] || { value: "" },
        candidate = brValue(key),
        targets = brTargets[key] || [target];
      const conflicts = targets
        .map((to) => {
          const val =
              to === "registerCertType" ? "01" : v2Canonical(to, candidate),
            before = v2Raw(to);
          return candidate && before && before !== val
            ? `<div class="br-conflict"><small>目前${esc(brLabels[to])}：${esc(v2Display(to, before))}</small><label>套用方式<select aria-label="${esc(brLabels[to])}衝突處理" data-br-conflict="${to}" ${ready ? "disabled" : ""}><option value="keep" ${b.choices[to] !== "replace" ? "selected" : ""}>保留原有資料</option><option value="replace" ${b.choices[to] === "replace" ? "selected" : ""}>使用本次核對值</option></select></label></div>`
            : "";
        })
        .join("");
      return `<section class="br-candidate ${d.warning || d.autoSelect === false ? "attention" : ""}"><label class="check"><input type="checkbox" data-br-select="${key}" aria-label="帶入${esc(label)}" ${b.selected.has(key) ? "checked" : ""} ${ready ? "disabled" : ""}><strong>${esc(label)}</strong><span>${!candidate ? "未辨識" : d.warning || d.autoSelect === false ? "待核對" : "待確認"}</span></label><label class="sr-only" for="br-${key}">${esc(label)}辨識值</label><input id="br-${key}" data-br-value="${key}" value="${esc(candidate)}" ${ready ? "readonly" : ""} autocomplete="off" spellcheck="false"><small>帶入：Step ${step} · ${targets.map((t) => esc(brLabels[t])).join("、")}</small>${d.warning ? `<p class="hint">${esc(d.warning)}</p>` : ""}${d.alternatives?.length ? `<p class="hint">候選：${d.alternatives.map(esc).join("／")}</p>` : ""}${!b.demo && d.source ? `<details><summary>查看來源文字 · 第 ${d.page || b.pageNumber} 頁</summary><p>${esc(d.source)}</p></details>` : ""}${conflicts}<p class="error" data-br-error="${key}" role="alert"></p></section>`;
    })
    .join("");
  brModal(
    ready ? "已核對，準備套用" : "核對辨識結果",
    `<p class="hint">對照原件核對資料，再帶入其他步驟。向下捲動查看所有欄位；不確定的資料先留空。</p>${b.demo ? '<div class="notice warn">目前使用虛構示範資料，並未讀取文件。</div>' : `<div class="notice ${warnings.length ? "warn" : ""}">${warnings.length ? warnings.map((w) => esc(w)).join("<br>") : "辨識完成。所有候選欄位均需對照原件核對。"}</div>`}<div class="br-workbench"><aside class="br-original"><h3>原件預覽</h3><p>${esc(b.filename)} · 第 ${b.pageNumber} 頁</p><div id="br-original-canvas"></div>${b.demo ? '<div class="br-synthetic"><h3>商業登記證</h3><p>BUSINESS REGISTRATION CERTIFICATE</p><p>示例海港科技有限公司<br>SAMPLE HARBOUR TECHNOLOGY LIMITED</p><p>12345678-000</p><p>僅供介面演示 · 非真實文件</p></div>' : ""}<p class="hint">文件只留在本機。OCR 信心分數不代表實際辨識正確率。</p></aside><div class="br-candidates">${rows}${b.fields.startDate?.value ? `<div class="notice"><strong>只供核對，不自動帶入</strong><p>本張 BR 生效日期：${esc(b.fields.startDate?.value || "未辨識")}</p><small>生效日期不是公司成立日期；不推算經營年限。</small></div>` : ""}</div></div><section class="br-confirm"><p>預設只填空欄；有差異的欄位須逐項選擇保留或取代。</p>${ready ? `<p class="br-status">已核對 · ${plans.filter((p) => p.write).length} 個欄位將寫入 · ${plans.filter((p) => !p.write).length} 個保留原值</p>` : '<label class="check"><input type="checkbox" id="br-checked">我已對照原件，核對勾選欄位及取代選項。</label>'}<p id="br-error" class="error" role="alert"></p></section>`,
    btn("取消，保留原資料", "close") +
      (ready ? btn("返回核對", "br-return") : "") +
      btn(
        ready ? "確認並套用" : "已核對，準備套用",
        ready ? "br-apply" : "br-ready",
        "primary",
        ready ? "" : "disabled",
      ),
  );
  if (b.page) {
    const c = document.createElement("canvas");
    c.width = b.page.canvas.width;
    c.height = b.page.canvas.height;
    c.getContext("2d").drawImage(b.page.canvas, 0, 0);
    c.setAttribute("aria-label", "BR 原件");
    $("#br-original-canvas").append(c);
  }
};
async function brReady() {
  const b = DEMO.br;
  if (!brAlive(b) || !$("#br-checked")?.checked) return;
  if (!brDefs.some(([k]) => b.selected.has(k) && brValue(k))) {
    $("#br-error").textContent = "請至少選取一個已核對、非空白的欄位。";
    return;
  }
  let errors = {};
  if (!b.demo) {
    try {
      const [, parser] = await brLoadModules();
      errors = parser.validateFields(
        Object.fromEntries(
          Object.entries(b.fields).filter(
            ([k]) => b.selected.has(k) || k === "startDate",
          ),
        ),
      );
    } catch {
      errors._load = "驗證引擎未能載入，請重試。";
    }
  } else {
    if (
      b.selected.has("certificateNumber") &&
      !/^\d{8}-\d{3}-\d{2}-\d{2}-[A-Z0-9]$/i.test(brValue("certificateNumber"))
    )
      errors.certificateNumber = "請填寫完整登記證號碼，包含最後三段。";
  }
  if (!brAlive(b) || b.phase !== "review" || !$("#br-checked")?.checked) return;
  for (const [key, , target] of brDefs) {
    if (!b.selected.has(key)) continue;
    const val = v2Canonical(target, brValue(key));
    if (
      V2.options[target] &&
      val &&
      !V2.options[target].some((o) => o[0] === val)
    )
      errors[key] = "辨識值不符合此欄位的選項，請對照原件修正。";
  }
  for (const [k, msg] of Object.entries(errors)) {
    const el = $(`[data-br-error="${k}"]`);
    if (el) el.textContent = msg;
  }
  if (Object.keys(errors).length) {
    $("#br-error").textContent = "請修正標示的欄位，或取消選取該項。";
    return;
  }
  brReview(true);
}
function brApply() {
  const b = DEMO.br;
  if (!brAlive(b) || !b.confirmed || b.phase !== "ready") return;
  if (state.fail)
    return brModal(
      "資料寫入失敗",
      '<div class="notice error">這次資料尚未寫入，原有申請內容已保留。</div><p>本頁仍保留核對結果。關閉失敗模擬後可重試。</p>',
      btn("取消", "close") +
        btn("返回核對", "br-return") +
        btn("關閉失敗模擬並重試", "br-retry", "primary"),
      "failure",
    );
  const plans = brPlan(b),
    before = structuredClone(state.values),
    files = structuredClone(state.files),
    previousURL = DEMO.fileURLs.get("140101"),
    previousSource = DEMO.sourceFiles?.get("140101");
  let fileURL;
  try {
    const apply = plans.filter((p) => p.write);
    for (const p of apply) state.values[p.target] = p.value;
    const oldLog = v2Model().ocr.filter(
      (o) => !apply.some((p) => p.target === o.key),
    );
    v2Model().ocr = [
      ...oldLog,
      ...apply.map((p) => ({
        key: p.target,
        value: p.value,
        applied: p.value,
        source: b.demo
          ? "BR 虛構示例"
          : "BR · 本機辨識 · 第 " + b.pageNumber + " 頁",
        step: p.step,
        confidence: null,
        selected: true,
        method: b.result.method,
      })),
    ];
    if (b.file) {
      fileURL = URL.createObjectURL(b.file);
      DEMO.fileURLs.set("140101", fileURL);
      (DEMO.sourceFiles ??= new Map()).set("140101", {
        file: b.file,
        url: fileURL,
      });
      state.files["140101"] = {
        name: b.file.name,
        size: b.file.size,
        type: b.file.type,
        demo: false,
        needsReselect: false,
        page: b.pageNumber,
      };
    } else if (!state.files["140101"])
      state.files["140101"] = { name: "SAMPLE-BR.pdf", size: 0, demo: true };
    v2SyncDerived();
    state.errors = {};
    state.savedAt = null;
    b.applied = true;
    b.phase = "result";
    b.imported = apply.map(
      (p) => p.label + "：" + v2Display(p.target, p.value),
    );
    b.pending = plans
      .filter((p) => !p.write && !p.same)
      .map((p) => p.label + "：保留原有資料");
    for (const [k, l] of brDefs)
      if (!b.selected.has(k) && brValue(k))
        b.pending.push(l + "：未選取，待核對");
    b.unrecognized = brDefs
      .filter(([k]) => !brValue(k))
      .map(([, l]) => l + "：未取得候選值");
    render();
    v2ImportResult(
      b.imported,
      b.pending,
      b.unrecognized,
      "close",
      plans.filter((p) => p.same),
    );
    $("#modal").classList.remove("br-dialog");
    delete $("#modal").dataset.br;
    if (fileURL && previousURL) URL.revokeObjectURL(previousURL);
  } catch (e) {
    b.phase = "ready";
    b.applied = false;
    state.values = before;
    state.files = files;
    if (fileURL) {
      URL.revokeObjectURL(fileURL);
      if (previousURL) DEMO.fileURLs.set("140101", previousURL);
      else DEMO.fileURLs.delete("140101");
      if (previousSource) DEMO.sourceFiles.set("140101", previousSource);
      else DEMO.sourceFiles?.delete("140101");
    }
    brModal(
      "資料寫入失敗",
      '<div class="notice error">未能完成套用，已還原申請資料。請重試或返回核對。</div>',
      btn("取消", "close") +
        btn("返回核對", "br-return") +
        btn("重試寫入", "br-apply", "primary"),
      "failure",
    );
  }
}
Object.assign(actions, {
  "br-start": brStart,
  "br-recognize": () => void brRecognize(),
  "br-ready": () => void brReady(),
  "br-return": () => brReview(),
  "br-apply": brApply,
  "br-retry": () => {
    state.fail = false;
    brApply();
  },
  "br-cancel": () => DEMO.br?.controller?.abort(),
});
document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.id === "demo-br-file") void brAccept(el.files[0]);
  if (el.id === "br-page") void brPage(+el.value);
  if (el.id === "br-checked") {
    $('[data-action="br-ready"]').disabled = !el.checked;
  }
  if (el.dataset.brSelect) {
    el.checked
      ? DEMO.br.selected.add(el.dataset.brSelect)
      : DEMO.br.selected.delete(el.dataset.brSelect);
    brInvalidate();
  }
  if (el.dataset.brConflict) {
    DEMO.br.choices[el.dataset.brConflict] = el.value;
    brInvalidate();
  }
});
document.addEventListener("input", (e) => {
  if (e.target.dataset.brValue) {
    const b = DEMO.br;
    b.fields[e.target.dataset.brValue].value = e.target.value;
    brInvalidate();
  }
});
// Rebuild conflict controls after an edit, preserving keyboard focus and scroll.
document.addEventListener("change", (e) => {
  if (e.target.dataset.brValue) {
    const id = e.target.id,
      pos = $(".br-workbench")?.scrollTop || 0;
    brReview();
    $("#" + id)?.focus();
    $(".br-workbench").scrollTop = pos;
  }
});
$("#modal").addEventListener("close", () => {
  brRelease();
  if ($("#modal").classList.contains("br-dialog"))
    $("#modal").replaceChildren();
  $("#modal").classList.remove("br-dialog");
  delete $("#modal").dataset.br;
});
addEventListener("pagehide", () => brRelease());
const brOldPreview = actions["preview-demo-file"];
actions["preview-demo-file"] = (el) => {
  const f = state.files[el.dataset.id],
    url = DEMO.fileURLs.get(el.dataset.id);
  if (f && url && /\.pdf$/i.test(f.name))
    modal(
      "文件預覽",
      `<p>${esc(f.name)}</p><iframe class="br-pdf-preview" src="${url}" title="所選 PDF 原件"></iframe><p class="hint">本機文件預覽，未上傳至伺服器。</p>`,
    );
  else brOldPreview(el);
};
Object.assign(window.AllinPayDemo, {
  version: "2026.09.23-backoffice-br-integrated",
  brLocalOCR: true,
});

actions["br-sources"] = () =>
  modal(
    "BR 辨識來源",
    v2ConsistencyCard(),
    btn("關閉", "close") + btn("重新匯入 BR", "br-start", "primary"),
  );


// SOURCE MODULE: onboarding-risk.js
// Shared application status, derived from the supplied OATS V2 prototype.
// Advisory demo values only: never silently overwrite the merchant's fee settings.
const v2RiskPolicies = {
  1: {
    label: "低",
    cycle: "T1",
    deposit: "0%",
    limit: "單筆 20,000／月 500,000",
    path: "L1 抽檢 10% → 送 OATS",
    sla: "4 小時內",
  },
  2: {
    label: "中",
    cycle: "T2",
    deposit: "收單 5%，釋放 30 天",
    limit: "單筆 30,000／月 1,000,000",
    path: "L1 全審 → L2 風控複審 → 送 OATS",
    sla: "T+1",
  },
  3: {
    label: "高",
    cycle: "T3",
    deposit: "收單 10%，釋放 60 天；CNP 10%，釋放 180 天",
    limit: "逐戶設定，首月壓縮 50%",
    path: "L1 → L2 → L3 終審（須書面理由）",
    sla: "T+3",
  },
  D: {
    label: "拒件",
    cycle: "—",
    deposit: "—",
    limit: "—",
    path: "直接拒絕，30 天內不得重提",
    sla: "即時",
  },
};
const v2RiskOpen = { risk: true, blocks: true };
function v2ProgressData() {
  const errors = validateAll(),
    required = [...v2Required()],
    unfilled = required.filter((k) => !v2Raw(k)),
    completed = required.length - unfilled.length,
    percent = Math.round((completed / required.length) * 100);
  const score = v2Score(),
    checks = v2Consistency(),
    missing = v2MissingDocs();
  const policy =
    v2RiskPolicies[score.reject ? "D" : v2Raw("riskLevel")] ||
    v2RiskPolicies[score.level];
  const recommended = v2RiskPolicies[score.reject ? "D" : score.level];
  const blocks = [];
  if (unfilled.length)
    blocks.push({
      step: 2,
      label:
        "尚有 " +
        unfilled.length +
        " 項必填未完成：" +
        unfilled.slice(0, 3).map(v2Label).join("、") +
        (unfilled.length > 3 ? "等" : ""),
    });
  for (const step of [2, 3, 4, 5, 6]) {
    const entries = Object.entries(validateStep(step)).filter(
      ([k]) => !unfilled.includes(k),
    );
    if (entries.length)
      blocks.push({
        step,
        label:
          entries[0][1] +
          (entries.length > 1
            ? "（另有 " + (entries.length - 1) + " 項）"
            : ""),
      });
  }
  if (missing.length)
    blocks.push({
      step: 1,
      label:
        "缺件／需重新提供 " +
        missing.length +
        " 項：" +
        missing
          .slice(0, 2)
          .map((d) => d.name.split("\n")[0])
          .join("、") +
        (missing.length > 2 ? "等" : ""),
    });
  return {
    errors,
    score,
    policy,
    recommended,
    required: required.length,
    completed,
    percent,
    unfilled,
    missing,
    checks,
    blocks,
  };
}
function v2RiskOverview() {
  const d = v2ProgressData(),
    s = d.score,
    tier = s.reject ? "D" : s.level;
  const row = (label, value, cls = "") =>
    `<div class="v2-status-line ${cls}"><span>${label}</span><strong>${value}</strong></div>`;
  const details = (key, label, html) =>
    `<details data-v2-status-details="${key}" ${v2RiskOpen[key] ? "open" : ""}><summary>${label}</summary>${html}</details>`;
  return `<section class="v2-status-overview" aria-label="申請即時狀態">
 <article class="v2-status-card" data-risk-tier="${tier}"><h2>風控評分（系統參考）</h2><div class="v2-status-score"><strong data-risk-score>${s.total}</strong><span>／100</span><div class="v2-status-tier"><b>${d.recommended.label}</b><small>系統建議</small></div></div><meter min="0" max="100" value="${s.total}" aria-label="風控評分"></meter><div class="v2-status-ticks"><span>0</span><span>20 低</span><span>45 中</span><span>70 高</span><span>100</span></div><p>採用風控級別：<b>${d.policy.label}</b>（${v2Model().manualRisk ? "人工設定" : "跟隨系統建議"}）</p>${details(
   "risk",
   "評分明細與處置",
   `<h3>評分明細</h3>${s.reject ? row(esc(s.reject), "阻擋", "danger") : ""}${s.items.map((i) => row(esc(i.label), "+" + i.n)).join("") || '<p class="hint">暫無加分項</p>'}<h3>按風控級別處置 · 系統參考</h3><dl>${[
     ["風控級別", s.reject ? "—" : v2Raw("riskLevel")],
     ["結算週期", d.policy.cycle],
     ["保證金", d.policy.deposit],
     ["限額", d.policy.limit],
     ["審批路徑", d.policy.path],
     ["目標時效", d.policy.sla],
   ]
     .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
     .join(
       "",
     )}</dl><small class="hint">此為原型的系統參考，不代表實際審核結果；不會覆寫已填費率或結算設定。</small>`,
 )}</article>
 <article class="v2-status-card"><h2>資料核對與缺件</h2>${row("資料不一致", d.checks.filter((c) => !c.same).length + " 項")}${row("差異待人工確認", d.checks.filter((c) => !c.same && !c.confirmed).length + " 項")}${row("缺件／需重新提供", `<span data-risk-missing>${d.missing.length}</span> 項`, d.missing.length ? "danger" : "")}${row("補件通知", d.missing.length ? "未發送" : "無需", "muted")}<div class="v2-status-links">${btn("查看核對明細 →", "v2-status-checks", "text-button")}${btn("查看缺件 →", "step", "text-button", 'data-step="1"')}</div></article>
 <article class="v2-status-card"><h2>提交完整度</h2><progress max="100" value="${d.percent}" aria-label="必填項目完成度"></progress><p class="v2-status-fill"><span><b data-risk-completed>${d.completed}</b>／${d.required} 必填項已填寫</span><strong>${d.percent}%</strong></p><small class="hint">填寫率不等於驗證通過；格式、文件與費率仍須核對。</small><div class="v2-status-blockers">${
   d.blocks
     .slice(0, 2)
     .map(
       (b) =>
         `<button data-action="step" data-step="${b.step}"><span>${esc(b.label)}</span><strong>阻擋</strong></button>`,
     )
     .join("") || '<p class="v2-status-ok">目前無阻擋項</p>'
 }</div>${
   d.blocks.length > 2
     ? details(
         "blocks",
         "另有 " + (d.blocks.length - 2) + " 項待處理",
         d.blocks
           .slice(2)
           .map(
             (b) =>
               `<button class="v2-status-extra" data-action="step" data-step="${b.step}">${esc(b.label)} →</button>`,
           )
           .join(""),
       )
     : ""
 }</article></section>`;
}
const v2ApplicationWithoutStatus = application;
application = function (step) {
  const html = v2ApplicationWithoutStatus(step),
    marker = '<div class="v2-version">OATS V2 · 六步申請流程</div>',
    split = html.indexOf(marker) + marker.length;
  return (
    html.slice(0, split) +
    '<div class="v2-application-columns"><div class="v2-application-main">' +
    html.slice(split, -6) +
    '</div><aside id="v2-application-status" aria-label="申請狀態側欄">' +
    v2RiskOverview() +
    "</aside></div></div>"
  );
};
actions["v2-status-checks"] = () =>
  modal(
    "資料核對明細",
    v2ConsistencyCard() +
      `<h3>缺件／需重新提供</h3><ul>${
        v2MissingDocs()
          .map((d) => `<li>${esc(d.name.split("\n")[0])}</li>`)
          .join("") || "<li>沒有缺件</li>"
      }</ul>`,
    btn("關閉", "close") +
      btn("前往文件材料", "step", "primary", 'data-step="1"'),
  );
function v2RefreshStatus() {
  const n = document.getElementById("v2-application-status");
  if (n && route().page === "application") {
    const top = n.scrollTop;
    n.innerHTML = v2RiskOverview();
    n.scrollTop = top;
  }
}
document.addEventListener(
  "toggle",
  (e) => {
    if (e.target.dataset.v2StatusDetails)
      v2RiskOpen[e.target.dataset.v2StatusDetails] = e.target.open;
  },
  true,
);
document.addEventListener("input", (e) => {
  if (e.target.dataset.field || e.target.dataset.v2InlineKey) v2RefreshStatus();
});
document.addEventListener("change", (e) => {
  if (e.target.closest(".v2-form")) v2RefreshStatus();
});
Object.assign(window.AllinPayDemo, {
  getApplicationStatus: () => {
    const d = v2ProgressData();
    return {
      step: route().step,
      score: d.score,
      policy: d.policy,
      required: d.required,
      completed: d.completed,
      percent: d.percent,
      missing: d.missing.length,
      blockers: d.blocks.length,
    };
  },
});


// SOURCE MODULE: onboarding-document-feedback.js
// Shared functional corrections from the supplied Word. No risk-policy changes.
const documentStepNames = [
  "文件材料",
  "主體資料",
  "經營與聯繫",
  "結算帳戶",
  "產品與費率",
  "確認提交",
];
function syncBankName(changed) {
  const v = state.values,
    m = v2Model(),
    code = String(v.cardBankCode || "")
      .trim()
      .split(/\s+/)[0];
  v.cardBankCode = code;
  const name = v.cardCountryCode === "HKG" ? ONBOARDING_BANKS[code] : null;
  if (name) {
    v.cardBankName = name;
    m.bankAutoName = name;
  } else if (changed || m.bankAutoName === v.cardBankName) {
    v.cardBankName = "";
    delete m.bankAutoName;
  }
  const input = $('[data-v2-field="cardBankName"]');
  if (input) {
    input.value = v.cardBankName || "";
    input.readOnly = !!name;
  }
}
const feedbackField = v2Field;
v2Field = function (f, ...args) {
  let html = feedbackField(f, ...args);
  if (
    f.id === "cardBankName" &&
    v2Raw("cardCountryCode") === "HKG" &&
    ONBOARDING_BANKS[v2Raw("cardBankCode")]
  )
    html = html.replace('type="text"', 'type="text" readonly');
  return html;
};
const feedbackDerived = v2SyncDerived;
v2SyncDerived = function () {
  feedbackDerived();
  if (
    v2Raw("cardCountryCode") === "HKG" &&
    ONBOARDING_BANKS[v2Raw("cardBankCode")]
  )
    syncBankName(false);
};
const feedbackValidation = v2ValidateFields;
v2ValidateFields = function (index) {
  const e = feedbackValidation(index),
    v = v2Raw("inspectionDate");
  if (
    index === 0 &&
    v &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(v) ||
      Number.isNaN(Date.parse(v + "T00:00:00")) ||
      new Date(v + "T00:00:00").toLocaleDateString("sv-SE") !== v)
  )
    e.inspectionDate = "請選擇有效考察日期";
  return e;
};
const feedbackDocuments = v2Documents;
v2Documents = function () {
  return feedbackDocuments()
    .replace("多文件辨識示例", "多文件辨識")
    .replace(
      "BR 支援 PDF、JPG、PNG，文件僅在瀏覽器本機辨識；其他文件提供示例流程。",
      "可一次選取多份 PDF、JPG、PNG，在瀏覽器本機辨識；先核對，再套用。",
    )
    .replace("必交文件檢查", "文件提供狀態")
    .replace(
      "必交清單會隨法律主體、風險級別、產品及董事／股東設定更新。",
      "所有文件均為選填。未提供不會阻擋下一步或提交；已填文字資料仍須驗證。",
    )
    .replace(
      "0／0 項必交文件已備妥",
      Object.keys(state.files).length + " 份文件已選取 · 全部為選填",
    )
    .replaceAll(" · 示例信心 ", " · 辨識信心 ");
};
const feedbackReview = v2Review;
v2Review = function () {
  return feedbackReview()
    .replace("✓ 文件已備妥", "文件為選填")
    .replace("條件文件", "選填文件");
};
uploadRow = function (d) {
  const f = state.files[d.id],
    id = "document-file-" + d.id,
    error = state.errors["file-" + d.id];
  return `<div class="upload-row" data-upload-row="${d.id}" data-document-drop="${d.id}" data-file-drop data-file-input="${id}"><div class="upload-heading"><strong>${labelHTML(d.name)}</strong>${pill(f ? "已選取" : "選填", f ? "green" : "gray")}</div><p class="hint">${esc(d.hint)}</p>${fileDropControl({ inputId: id, accept: ".pdf,.jpg,.jpeg,.png", hint: "PDF／JPG／PNG · 每份上限 10 MB", selected: f ? f.name + (f.needsReselect ? " · 請重新選取" : " · 僅本機") : "", attributes: `data-demo-upload="${d.id}"` })}${error ? `<p class="error">${esc(error)}</p>` : ""}${f ? `<div class="upload-actions">${btn("預覽", "preview-demo-file", "", `data-id="${d.id}"`) + btn("移除", actions["document-remove-file"] ? "document-remove-file" : "remove-file", "danger", `data-id="${d.id}"`)}</div>` : ""}</div>`;
};
function acceptDocumentFile(id, files) {
  if (files.length !== 1)
    return toast(
      "每個上傳位置接受一份文件；多頁可合併 PDF，多文件辨識請使用上方按鈕。",
    );
  const f = files[0];
  if (!f || !f.size || f.size > 10485760 || !/\.(pdf|png|jpe?g)$/i.test(f.name))
    return modal(
      "文件格式不符",
      "<p>請選擇非空白、10 MB 以下的 PDF／JPG／PNG。原有文件不受影響。</p>",
    );
  const old = DEMO.fileURLs.get(id);
  if (old) URL.revokeObjectURL(old);
  const url = URL.createObjectURL(f);
  DEMO.fileURLs.set(id, url);
  (DEMO.sourceFiles ??= new Map()).set(id, { file: f, url });
  state.files[id] = {
    name: f.name,
    size: f.size,
    type: f.type,
    demo: false,
    needsReselect: false,
  };
  delete state.errors["file-" + id];
  render();
  toast("文件已上傳至 Demo，僅保留於本機");
}
// Capture makes the picker and drag/drop use exactly the same validation path.
document.addEventListener(
  "change",
  (e) => {
    const t = e.target;
    if (t.dataset.demoUpload) {
      e.stopImmediatePropagation();
      acceptDocumentFile(t.dataset.demoUpload, [...t.files]);
    }
  },
  true,
);
document.addEventListener("change", (e) => {
  if (["cardBankCode", "cardCountryCode"].includes(e.target.dataset.v2Field)) {
    syncBankName(true);
    const bank = $('[data-v2-field="cardBankName"]');
    if (bank) bank.dispatchEvent(new Event("input", { bubbles: true }));
  }
});
document.addEventListener("input", (e) => {
  if (e.target.dataset.v2Field === "cardBankCode") {
    state.values.cardBankCode = e.target.value;
    syncBankName(true);
  }
});
Object.assign(window.AllinPayDemo, {
  version: "2026.09.29-full-br-unified-uploads",
});
/* MULTI_DOCUMENT_WORKFLOW */


// SOURCE MODULE: multi-document-workflow.js
let documentBatch = null;
const documentTypes = [
  ["AUTO", "自動判斷"],
  ["BR", "BR 商業登記證"],
  ["CI", "CI 公司註冊證書"],
  ["NAR1", "NAR1／NNC1"],
  ["ID", "身份證"],
  ["BANK", "銀行月結單"],
];
const batchDocName = (id) =>
  V2.documents.find((d) => d.id === id)?.name.split("\n")[0] || "待手動分配";
function batchDispose() {
  const b = documentBatch;
  if (!b) return;
  b.cancelled = true;
  b.controller?.abort();
  for (const f of b.files) if (f.url) URL.revokeObjectURL(f.url);
  documentBatch = null;
}
function batchOpen() {
  batchDispose();
  documentBatch = { files: [], items: [], failures: [], phase: "upload" };
  batchUpload();
}
function batchUpload() {
  const b = documentBatch;
  b.phase = "upload";
  modal(
    "多文件辨識",
    '<div class="notice">一次加入所有文件，辨識後預覽附件位置及表單欄位，再確認套用。文件只在本瀏覽器處理，不會上傳。</div>' +
      fileDropControl({
        inputId: "document-batch-files",
        accept: ".pdf,.png,.jpg,.jpeg",
        multiple: true,
        title: "拖曳一份或多份文件至此",
        hint: "最多 30 份／合計 100 MB · 每份 10 MB／PDF 5 頁",
        selected: b.files.length ? "已加入 " + b.files.length + " 份文件" : "",
      }) +
      '<div class="batch-files">' +
      b.files
        .map(
          (f, i) =>
            '<div class="batch-file"><span>' +
            esc(f.file.name) +
            '</span><select aria-label="' +
            esc(f.file.name) +
            ' 文件類型" data-document-type="' +
            i +
            '">' +
            documentTypes
              .map(
                ([v, n]) =>
                  '<option value="' +
                  v +
                  '" ' +
                  (f.type === v ? "selected" : "") +
                  ">" +
                  n +
                  "</option>",
              )
              .join("") +
            "</select>" +
            btn("移除", "document-remove", "", 'data-index="' + i + '"') +
            "</div>",
        )
        .join("") +
      "</div>" +
      '<p class="hint">按文件內容判斷 BR、CI、銀行月結單等；身份證持有人角色、照片 可能須手動分配。不確定或重複的位置不會自動覆蓋。</p>',
    btn("取消", "close") +
      btn(
        "開始辨識",
        "document-recognize",
        "primary",
        b.files.length ? "" : "disabled",
      ),
  );
}
function batchAdd(files) {
  const b = documentBatch;
  if (!b || b.phase !== "upload") return;
  if (b.files.length + files.length > 30) return toast("每次最多 30 份文件");
  if (
    [...b.files.map((f) => f.file), ...files].reduce((n, f) => n + f.size, 0) >
    100 * 1048576
  )
    return toast("文件合計不可超過 100 MB");
  if (
    files.some(
      (f) =>
        !f.size || f.size > 10485760 || !/\.(pdf|png|jpe?g)$/i.test(f.name),
    )
  )
    return toast("請選擇非空白、10 MB 以下 PDF／PNG／JPG；原有清單不受影響");
  for (const file of files)
    b.files.push({
      file,
      type: "AUTO",
      url: URL.createObjectURL(file),
      destination: "",
      include: false,
      replace: false,
    });
  batchUpload();
}
async function batchRecognize() {
  const b = documentBatch;
  if (!b?.files.length || b.phase !== "upload") return;
  b.phase = "reading";
  b.controller = new AbortController();
  modal(
    "多文件辨識中",
    '<p id="document-progress" role="status">正在載入本機辨識引擎…</p><progress id="document-progress-bar" max="100" value="0"></progress><p class="hint">辨識文件種類及可填欄位。可隨時取消，現有資料不受影響。</p>',
    btn("取消辨識", "close"),
  );
  let timer;
  try {
    const [[engine], parser] = await Promise.all([
      brLoadModules(),
      import("./br-engine/multi-document.mjs?v=20261102-samples"),
    ]);
    for (let i = 0; i < b.files.length; i++) {
      if (b.cancelled) return;
      const entry = b.files[i];
      entry.text = [];
      entry.identities = [];
      let doc;
      const classifications = [];
      try {
        doc = await engine.loadDocument(entry.file);
        for (let p = 1; p <= doc.pages; p++) {
          if (b.cancelled) return;
          let view;
          try {
            view = await doc.render(p);
            timer = setTimeout(() => b.controller.abort(), 120000);
            const progress = (n) => {
              if (!b.cancelled)
                $("#document-progress").textContent =
                  i +
                  1 +
                  "／" +
                  b.files.length +
                  " · " +
                  entry.file.name +
                  " · 第 " +
                  p +
                  " 頁 · " +
                  Math.round(n * 100) +
                  "%";
            };
            // Identify scanned documents before invoking the BR-specific pipeline.
            // A filename or a document checklist does not establish its type.
            let result =
              entry.type === "BR"
                ? null
                : await engine.extractDocumentText({
                    ...view,
                    signal: b.controller.signal,
                    onProgress: progress,
                  });
            const tryBR =
              entry.type === "BR" ||
              (entry.type === "AUTO" &&
                parser.classifyDocument(result.text).id === "140101");
            const br = tryBR
              ? await engine.recognizeDocument({
                  ...view,
                  page: p,
                  signal: b.controller.signal,
                  onProgress: (x) => progress(x.progress),
                })
              : null;
            result = br?.recognized
              ? {
                  text: br.rawText,
                  method: br.method,
                  confidence: br.ocrConfidence,
                }
              : result ||
                (await engine.extractDocumentText({
                  ...view,
                  signal: b.controller.signal,
                  onProgress: progress,
                }));
            clearTimeout(timer);
            if (b.cancelled) return;
            entry.text.push(result.text);
            const classification = parser.classifyDocument(result.text, {
              brRecognized: !!br?.recognized,
            });
            classifications.push(classification);
            if (classification.kind === "ID")
              entry.identities.push({
                values: parser.extractIdentity(result.text),
                page: p,
                method: result.method,
              });
            const candidates = br?.recognized
              ? parser.candidatesFromBR(br)
              : parser.extractCandidates(result.text, entry.type);
            for (const candidate of candidates) {
              const value = v2Canonical(candidate.key, candidate.value);
              if (
                !b.items.some(
                  (o) =>
                    o.key === candidate.key &&
                    o.value === value &&
                    o.fileIndex === i,
                )
              )
                b.items.push({
                  ...candidate,
                  value,
                  fileIndex: i,
                  page: p,
                  source:
                    (br?.recognized ? "BR · " : "") +
                    entry.file.name +
                    " · 第 " +
                    p +
                    " 頁",
                  method: result.method,
                  confidence: candidate.confidence ?? result.confidence,
                  selected: false,
                  replace: false,
                });
            }
          } finally {
            clearTimeout(timer);
            if (view) view.canvas.width = 1;
          }
        }
        const ids = [
            ...new Set(classifications.map((c) => c.id).filter(Boolean)),
          ],
          kinds = [
            ...new Set(
              classifications
                .map((c) => (c.kind === "ID" ? "IDENTITY" : c.id))
                .filter(Boolean),
            ),
          ];
        entry.destination =
          ids.length === 1 &&
          kinds.length === 1 &&
          !classifications.some((c) => c.ambiguous)
            ? ids[0]
            : "";
        entry.kind =
          kinds.length === 1
            ? classifications.find((c) => c.kind)?.kind || ""
            : "";
        entry.reason = entry.kind
          ? classifications.find((c) => c.kind).reason
          : entry.destination
            ? "按文件內文判斷：" + batchDocName(entry.destination)
            : "未能確定唯一文件種類，請選擇附件位置";
        entry.identity = {};
        for (const key of v2PersonKeys) {
          const values = [
            ...new Set(
              entry.identities.map((x) => x.values[key]).filter(Boolean),
            ),
          ];
          if (values.length === 1) entry.identity[key] = values[0];
        }
      } catch (error) {
        if (b.cancelled) return;
        entry.reason = "未完成辨識，仍可手動分配附件";
        b.failures.push(
          entry.file.name +
            "：" +
            (error.name === "AbortError"
              ? "辨識逾時，請重試或手動分配。"
              : error.message),
        );
        if (b.controller.signal.aborted) b.controller = new AbortController();
      } finally {
        await doc?.destroy();
        if (!b.cancelled)
          $("#document-progress-bar").value = ((i + 1) / b.files.length) * 100;
      }
    }
    if (b.cancelled) return;
    for (const f of b.files)
      f.include =
        !!f.destination &&
        !state.files[f.destination] &&
        b.files.filter((x) => x.destination === f.destination).length === 1;
    for (const o of b.items)
      o.selected =
        !!b.files[o.fileIndex].destination &&
        o.autoSelect !== false &&
        !v2Raw(o.key) &&
        b.items.filter((x) => x.key === o.key).length === 1;
    batchReview();
  } catch (error) {
    if (!b.cancelled) {
      b.failures.push(error.message);
      batchReview();
    }
  } finally {
    clearTimeout(timer);
  }
}
function batchIdentityOwners() {
  return [
    ["directors", "董事"],
    ["authSigners", "授權簽名人"],
    ["shareHolders", "股東"],
  ].flatMap(([g, label]) =>
    Array.from({ length: Math.max(1, state.people[g] || 0) }, (_, i) => ({
      value: g + "[" + i + "]",
      label:
        label +
        " " +
        (i + 1) +
        " · " +
        (v2Raw(g + "[" + i + "].name") || "待填姓名"),
    })),
  );
}
function batchSetIdentityOwner(index, owner) {
  const b = documentBatch,
    f = b.files[index];
  if (!batchIdentityOwners().some((o) => o.value === owner)) owner = "";
  b.items = b.items.filter((o) => o.fileIndex !== index || !o.identity);
  f.owner = owner;
  if (owner) {
    const group = owner.split("[")[0];
    f.destination =
      group === "directors"
        ? "140901"
        : group === "shareHolders"
          ? "141001"
          : "100301";
    f.include =
      !state.files[f.destination] &&
      !b.files.some(
        (x, i) => i !== index && x.include && x.destination === f.destination,
      );
    f.replace = false;
    for (const [key, value] of Object.entries(f.identity || {}))
      b.items.push({
        key: owner + "." + key,
        value,
        step: 2,
        fileIndex: index,
        page: f.identities?.[0]?.page || 1,
        source: f.file.name + " · 身份證（持有人由你指定）",
        method: f.identities?.[0]?.method || "本機 OCR",
        identity: true,
        autoSelect: false,
        selected: false,
        replace: false,
        warning: "請核對姓名、證件號碼及出生日期；不會以簽發日期推算有效期",
      });
  }
  batchReview();
}
function batchAssignments(ready) {
  const b = documentBatch;
  return (
    '<h3>文件自動分配</h3><p class="hint">確認每份文件的上傳位置。重複位置或已有附件須自行選擇；未勾選的文件不會加入。</p><div class="batch-assignments">' +
    b.files
      .map((f, i) => {
        const duplicate =
            f.destination &&
            b.files.filter((x) => x.destination === f.destination).length > 1,
          old = state.files[f.destination];
        return (
          '<section class="batch-assignment"><strong>' +
          esc(f.file.name) +
          "</strong><small>" +
          esc(f.reason || "請選擇附件位置") +
          "</small>" +
          (f.kind === "ID"
            ? '<label>身份證持有人<select aria-label="文件 ' +
              (i + 1) +
              ' 身份證持有人" data-document-owner="' +
              i +
              '" ' +
              (ready ? "disabled" : "") +
              '><option value="">先選擇持有人，再核對欄位</option>' +
              batchIdentityOwners()
                .map(
                  (o) =>
                    '<option value="' +
                    o.value +
                    '" ' +
                    (o.value === f.owner ? "selected" : "") +
                    ">" +
                    esc(o.label) +
                    "</option>",
                )
                .join("") +
              '</select></label><p class="hint">身份證不會自動歸為董事；選定持有人後，下方顯示可核對欄位。</p>'
            : "") +
          '<label>對應上傳位置<select aria-label="文件 ' +
          (i + 1) +
          ' 對應上傳位置" data-document-destination="' +
          i +
          '" ' +
          (ready ? "disabled" : "") +
          '><option value="">待手動分配／略過</option>' +
          V2.documents
            .map(
              (d) =>
                '<option value="' +
                d.id +
                '" ' +
                (f.destination === d.id ? "selected" : "") +
                ">" +
                esc(batchDocName(d.id)) +
                "</option>",
            )
            .join("") +
          "</select></label>" +
          (duplicate
            ? '<p class="error">多份文件對應同一位置，請只選一份，或合併 PDF 後重新加入。</p>'
            : "") +
          (old
            ? '<p class="hint">原有附件：' +
              esc(old.name) +
              '</p><label class="check"><input type="checkbox" data-document-file-replace="' +
              i +
              '" ' +
              (f.replace ? "checked" : "") +
              " " +
              (ready ? "disabled" : "") +
              ">確認取代此位置原有附件</label>"
            : "") +
          '<label class="check"><input type="checkbox" data-document-include="' +
          i +
          '" ' +
          (f.include ? "checked" : "") +
          " " +
          (ready || !f.destination ? "disabled" : "") +
          ">將此文件加入對應位置</label></section>"
        );
      })
      .join("") +
    "</div>"
  );
}
function batchReview(ready = false) {
  const b = documentBatch;
  if (!b) return;
  b.phase = ready ? "ready" : "review";
  if (!ready) b.confirmed = false;
  modal(
    ready ? "已核對，準備套用" : "核對多文件辨識結果",
    '<div class="notice warn">已預填可確定的分配位置及候選值；請核對後一次套用。沒有讀取到的資料不會猜測。</div>' +
      '<div class="batch-source-list">' +
      b.files
        .map((f, i) =>
          btn(
            "查看文件 " + (i + 1),
            "document-source",
            "",
            'data-index="' + i + '"',
          ),
        )
        .join("") +
      "</div>" +
      batchAssignments(ready) +
      '<h3>表單欄位</h3><div class="batch-candidates">' +
      (b.items
        .map((o, i) => {
          const existing = v2Raw(o.key),
            conflict = existing && existing !== o.value;
          return (
            '<section class="batch-candidate"><label class="check"><input type="checkbox" data-document-select="' +
            i +
            '" ' +
            (o.selected ? "checked" : "") +
            " " +
            (ready ? "disabled" : "") +
            "><strong>" +
            esc(v2Label(o.key)) +
            '</strong></label><input aria-label="核對 ' +
            esc(v2Label(o.key)) +
            '" data-document-value="' +
            i +
            '" value="' +
            esc(o.value) +
            '" ' +
            (ready ? "readonly" : "") +
            "><small>" +
            esc(o.source) +
            " · " +
            esc(o.method) +
            "</small>" +
            (o.warning
              ? '<p class="notice warn">' + esc(o.warning) + "</p>"
              : "") +
            (existing
              ? '<p class="hint">原有內容：' + esc(existing) + "</p>"
              : "") +
            (conflict
              ? '<label class="check"><input type="checkbox" data-document-replace="' +
                i +
                '" ' +
                (o.replace ? "checked" : "") +
                " " +
                (ready ? "disabled" : "") +
                ">確認以此值取代原有內容</label>"
              : "") +
            "</section>"
          );
        })
        .join("") ||
        "<p>沒有可帶入的候選欄位；仍可將文件分配到附件位置。</p>") +
      "</div>" +
      (b.failures.length
        ? '<div class="notice warn"><strong>仍需手動補充</strong><ul>' +
          b.failures.map((f) => "<li>" + esc(f) + "</li>").join("") +
          "</ul></div>"
        : "") +
      (ready
        ? ""
        : '<label class="check"><input type="checkbox" id="batch-reviewed">我已核對文件位置、欄位內容及取代選項</label>') +
      '<p id="document-error" class="error" role="alert"></p>',
    btn("取消，保留原資料", "close") +
      (ready ? btn("返回核對", "document-review") : "") +
      btn(
        ready ? "確認並套用" : "已核對，準備套用",
        ready ? "document-apply" : "document-ready",
        "primary",
      ),
  );
}
function batchValidate() {
  const b = documentBatch,
    selected = b.items.filter((o) => o.selected),
    files = b.files.filter((f) => f.include),
    keys = new Set(),
    slots = new Set();
  if (!selected.length && !files.length)
    return "請至少選擇一份文件或一個已核對欄位。";
  for (const f of files) {
    if (!V2.documents.some((d) => d.id === f.destination))
      return "請選擇有效的文件位置。";
    if (slots.has(f.destination))
      return batchDocName(f.destination) + "有多份文件，請只選一份。";
    slots.add(f.destination);
    if (state.files[f.destination] && !f.replace)
      return "請確認取代「" + batchDocName(f.destination) + "」的原有附件。";
  }
  for (const o of selected) {
    if (!o.value.trim()) return "選取的欄位不可空白。";
    if (keys.has(o.key)) return v2Label(o.key) + "有多個結果，請只選一個。";
    keys.add(o.key);
    if (
      o.key === "registerCertNo" &&
      !/^\d{8}-\d{3}-\d{2}-\d{2}-[A-Z0-9]$/i.test(o.value)
    )
      return "請按原件核對完整登記證號碼，包含最後三段。";
    if (o.identity) {
      const owner = documentBatch.files[o.fileIndex].owner,
        m = owner?.match(/^(directors|authSigners|shareHolders)\[(\d+)\]$/);
      if (!m || !o.key.startsWith(owner + "."))
        return "請重新選擇身份證持有人。";
      if (v2Model().links[m[1]]?.[m[2]] != null)
        return "此持有人正沿用董事資料，請先取消「與董事相同」，或將文件指定給對應董事。";
      if (
        o.key.endsWith(".idcardNo") &&
        !/^[A-Z]{1,2}\d{6}\([0-9A]\)$/i.test(o.value)
      )
        return "請按原件核對完整身份證號碼。";
    }
    if (v2Raw(o.key) && v2Raw(o.key) !== o.value && !o.replace)
      return "請確認要取代「" + v2Label(o.key) + "」的原有內容。";
  }
  return "";
}
function batchReady() {
  const error =
    batchValidate() ||
    (!$("#batch-reviewed")?.checked ? "請先確認已核對文件位置及欄位。" : "");
  if (error) {
    $("#document-error").textContent = error;
    return;
  }
  documentBatch.confirmed = true;
  batchReview(true);
}
function batchApply() {
  const b = documentBatch;
  if (b?.phase !== "ready" || !b.confirmed) return;
  const error = batchValidate();
  if (error) {
    batchReview();
    $("#document-error").textContent = error;
    return;
  }
  if (state.fail)
    return modal(
      "資料寫入失敗",
      "<p>原有表單、附件及辨識結果均保留，可返回核對。</p>",
      btn("取消", "close") + btn("返回核對", "document-review", "primary"),
    );
  const before = structuredClone(state.values),
    beforeFiles = structuredClone(state.files),
    beforePeople = { ...state.people },
    changed = [];
  try {
    const selected = b.items.filter((o) => o.selected),
      files = b.files.filter((f) => f.include);
    for (const o of selected) {
      const person = o.key.match(
        /^(directors|authSigners|shareHolders)\[(\d+)\]/,
      );
      if (person)
        state.people[person[1]] = Math.max(
          +person[2] + 1,
          state.people[person[1]] || 0,
        );
      state.values[o.key] = o.value;
      v2Model().ocr.push({
        key: o.key,
        value: o.value,
        source: o.source,
        step: o.step,
        applied: o.value,
        method: o.method,
        confidence: o.confidence,
      });
    }
    for (const f of files) {
      const id = f.destination,
        url = URL.createObjectURL(f.file);
      changed.push({
        id,
        url,
        old: DEMO.fileURLs.get(id),
        oldSource: DEMO.sourceFiles?.get(id),
      });
      DEMO.fileURLs.set(id, url);
      (DEMO.sourceFiles ??= new Map()).set(id, { file: f.file, url });
      state.files[id] = {
        name: f.file.name,
        size: f.file.size,
        type: f.file.type,
        demo: false,
        needsReselect: false,
      };
    }
    v2SyncDerived();
    const done = [
        ...files.map((f) => batchDocName(f.destination) + "：" + f.file.name),
        ...selected.map(
          (o) => v2Label(o.key) + "：" + v2Display(o.key, o.value),
        ),
      ],
      pending = [
        ...b.files
          .filter((f) => !f.include)
          .map((f) => f.file.name + "：尚未加入附件位置"),
        ...b.items
          .filter((o) => !o.selected)
          .map((o) => v2Label(o.key) + "：" + o.value),
      ],
      failures = [...b.failures];
    render();
    v2ImportResult(done, pending, failures);
    $("#modal .v2-import-success h3").textContent =
      "完成匯入 · " + files.length + " 份文件、" + selected.length + " 個欄位";
    $("#modal .v2-import-pending h3").textContent =
      "仍待核對 · " + pending.length + " 個項目未帶入";
    for (const x of changed) if (x.old) URL.revokeObjectURL(x.old);
    batchDispose();
  } catch (error) {
    state.values = before;
    state.files = beforeFiles;
    state.people = beforePeople;
    for (const x of changed) {
      URL.revokeObjectURL(x.url);
      if (x.old) DEMO.fileURLs.set(x.id, x.old);
      else DEMO.fileURLs.delete(x.id);
      if (x.oldSource) DEMO.sourceFiles.set(x.id, x.oldSource);
      else DEMO.sourceFiles?.delete(x.id);
    }
    modal(
      "資料寫入失敗",
      "<p>已還原原有資料及附件，請重新核對。</p>",
      btn("返回核對", "document-review", "primary"),
    );
  }
}
Object.assign(actions, {
  "v2-ocr": batchOpen,
  "document-recognize": batchRecognize,
  "document-ready": batchReady,
  "document-apply": batchApply,
  "document-review": () => batchReview(),
  "document-remove": (el) => {
    const f = documentBatch.files.splice(+el.dataset.index, 1)[0];
    URL.revokeObjectURL(f.url);
    batchUpload();
  },
  "document-source": (el) => {
    const f = documentBatch.files[+el.dataset.index];
    modal(
      "原始文件與辨識文字",
      "<p>" +
        esc(f.file.name) +
        "</p>" +
        (/\.pdf$/i.test(f.file.name)
          ? '<iframe class="batch-preview" title="原始 PDF" src="' +
            f.url +
            '"></iframe>'
          : /\.(png|jpe?g)$/i.test(f.file.name)
            ? '<img class="batch-preview" alt="原始文件" src="' + f.url + '">'
            : "<p>此文件無法預覽。</p>") +
        '<details><summary>查看辨識文字（只保留於記憶體）</summary><pre class="batch-text">' +
        esc((f.text || []).join("\n\n")) +
        "</pre></details>",
      btn("返回核對", "document-review", "primary"),
    );
  },
});
document.addEventListener("change", (e) => {
  const t = e.target,
    b = documentBatch;
  if (t.id === "document-batch-files") batchAdd([...t.files]);
  if (!b) return;
  if (t.dataset.documentOwner !== undefined) {
    batchSetIdentityOwner(+t.dataset.documentOwner, t.value);
    return;
  }
  if (t.dataset.documentType !== undefined)
    b.files[+t.dataset.documentType].type = t.value;
  if (t.dataset.documentSelect !== undefined)
    b.items[+t.dataset.documentSelect].selected = t.checked;
  if (t.dataset.documentReplace !== undefined)
    b.items[+t.dataset.documentReplace].replace = t.checked;
  if (t.dataset.documentDestination !== undefined) {
    const f = b.files[+t.dataset.documentDestination];
    f.destination = t.value;
    f.include = !!t.value;
    f.replace = false;
    batchReview();
  }
  if (t.dataset.documentInclude !== undefined)
    b.files[+t.dataset.documentInclude].include = t.checked;
  if (t.dataset.documentFileReplace !== undefined)
    b.files[+t.dataset.documentFileReplace].replace = t.checked;
});
document.addEventListener("input", (e) => {
  if (e.target.dataset.documentValue !== undefined)
    documentBatch.items[+e.target.dataset.documentValue].value = e.target.value;
});
$("#modal").addEventListener("close", () => {
  if (documentBatch) {
    batchDispose();
    render();
  }
});
window.addEventListener("pagehide", batchDispose);


// SOURCE MODULE: external-onboarding-shell.js
const sharedExternalApplication = application;
application = function (step) {
  state.step = step;
  return `<section class="external-v2 application"><header class="application-head"><div><h1>商戶申請表</h1><p>${esc(state.id || "新申請")} · 文件為選填，可辨識帶入或直接手動填寫</p></div>${btn("我的申請", "home")}</header>${nsStepperHTML(step, true)}${sharedExternalApplication(step)}${step === 6 ? externalSignature() : ""}<footer class="form-actions">${step > 1 ? btn("上一步", "step", "", `data-step="${step - 1}"`) : ""}${btn("儲存草稿", "save")}${btn(step === 6 ? "提交申請" : "下一步", step === 6 ? "submit" : "next", "primary")}</footer></section>`;
};
function externalSignature() {
  return `<section class="card"><h2>聲明及簽署</h2><p class="hint">此簽名只用作本機 Demo，不構成正式電子簽署。</p><div class="grid">${field(["signer", "簽署人姓名", "text", true])}${field(["signerTitle", "簽署人職位", "text", true])}</div><canvas id="signature" class="signature" aria-label="請在此簽名"></canvas>${btn("清除重簽", "clear-signature")} ${btn("使用 Demo 簽名", "demo-signature")}</section>`;
}
const externalSubmit = submit;
submit = function () {
  if (
    !Object.keys(validateAll()).length &&
    (!state.signature || !state.values.signer || !state.values.signerTitle)
  )
    return modal("請完成簽署", "<p>請填寫簽署人姓名、職位，並完成簽名。</p>");
  externalSubmit();
};
actions.submit = submit;
actions.next = () => {
  const e = validateStep(state.step);
  if (Object.keys(e).length) return showErrors(e, state.step);
  go("form/" + Math.min(6, state.step + 1));
};
actions["verify-email"] = () => {
  state.emailVerified = true;
  render();
  toast("已完成電郵模擬驗證，未發送真實電郵");
};
actions["clear-form"] = () =>
  modal(
    "清空目前表單",
    "<p>已儲存草稿不受影響。</p>",
    btn("取消", "close") + btn("確認清空", "confirm-clear", "primary"),
  );
actions["save-draft"] = () => save();
actions["show-errors"] = () => showErrors(validateStep(state.step), state.step);
const previousNew = newApplication;
newApplication = function () {
  previousNew();
  v2Reset();
  state.values.contactEmail = state.email;
  state.emailVerified = state.session;
  state.checks = {};
  state.step = 1;
};
const oldVerify = actions.verify;
actions.verify = () => {
  const seed = state.registerSeed;
  oldVerify();
  if (seed && state.session && !state.registerSeed) {
    state.values.merchantEnglishName = seed.companyEn || "";
    state.values.contactName = [seed.lastName, seed.firstName]
      .filter(Boolean)
      .join(" ");
    render();
  }
};
sample = function () {
  fillSample();
  state.values.contactEmail = state.email || "merchant@example.com";
  state.values.signer = "DEMO USER";
  state.values.signerTitle = "董事";
  state.errors = {};
};
const oldSnapshot = snapshot;
snapshot = function (status = "草稿") {
  const r = oldSnapshot(status);
  r.schema = V2.version;
  r.values.companyZh = r.values.merchantName;
  r.values.companyEn = r.values.merchantEnglishName;
  r.checks = { ...state.checks };
  r.emailVerified = state.emailVerified;
  return r;
};
const legacyReview = review;
review = function () {
  v2Ensure();
  return `<section class="external-v2 review"><div class="page-heading"><h1>已提交申請資料</h1>${btn("我的申請", "home")}</div><div class="notice">已提交資料為唯讀。進度為本機示例，不代表正式審核結果。</div><div class="v2-form external-readonly">${v2Review()}</div>${state.signature ? `<img class="signature-image" alt="Demo 簽名" src="${esc(state.signature)}">` : ""}</section>`;
};
loadRecord = function (r) {
  if (!r) return;
  const saved = structuredClone(r);
  for (const key of [
    "values",
    "files",
    "people",
    "directors",
    "shops",
    "methods",
    "scenes",
    "sales",
    "signature",
  ])
    state[key] =
      saved[key] ??
      (key === "signature"
        ? ""
        : key === "values" || key === "files"
          ? {}
          : []);
  state.id = r.id;
  state.checks = saved.checks || {};
  state.errors = {};
  state.readonly = r.status !== "草稿";
  state.emailVerified = !!saved.emailVerified;
  if (!state.values.__v2) {
    // Keep the original record untouched; migrate a working copy and preserve unmapped data.
    const old = { ...state.values };
    state.values.__legacyExternal = old;
    for (const [from, to] of Object.entries({
      companyZh: "merchantName",
      companyEn: "merchantEnglishName",
      br: "registerCertNo",
      brExpiry: "registerCertPeriod",
      address: "addrStreet",
      email: "contactEmail",
      mobile: "contactPhone",
      bankName: "cardName",
      bankAccount: "cardNo",
      website: "webUrl",
    }))
      if (old[from]) state.values[to] = old[from];
    state.people = {
      directors: Math.max(1, state.directors.length),
      authSigners: 0,
      shareHolders: 0,
    };
    state.directors.forEach((p, i) => {
      state.values[`directors[${i}].name`] = [p.last, p.first]
        .filter(Boolean)
        .join(" ");
    });
    const legacyFiles = state.files;
    state.files = {};
    if (legacyFiles.statement?.[0])
      state.files["140401"] = legacyFiles.statement[0];
    state.values.__legacyFiles = legacyFiles;
    v2Ensure();
    state.step = 1;
  } else state.step = r.step || 1;
  for (const [id, f] of Object.entries(state.files))
    if (!f.demo) f.needsReselect = !DEMO.fileURLs.has(id);
  v2SyncDerived();
  go(state.readonly ? "review" : "form/" + state.step);
};
const oldRenderExternal = render;
render = function () {
  oldRenderExternal();
  document
    .querySelectorAll(
      ".external-readonly input,.external-readonly select,.external-readonly button",
    )
    .forEach((el) => (el.disabled = true));
};
document.addEventListener(
  "change",
  (e) => {
    const t = e.target;
    if (t.dataset.check) state.checks[t.dataset.check] = t.checked;
    if (t.id === "simulate-failure") state.fail = t.checked;
    if (t.dataset.v2Field) {
      state.values[t.dataset.v2Field] = t.value;
      delete state.errors[t.dataset.v2Field];
    }
  },
  true,
);
Object.assign(window.AllinPayDemo, {
  getState: () =>
    structuredClone({
      values: state.values,
      files: state.files,
      step: state.step,
      checks: state.checks,
    }),
  external: true,
});


// SOURCE MODULE: onboarding-usability.js
// October 29 review: optional business fields, editable signer DOB and bank picker.
for (const form of V2.forms)
  for (const section of form.sections) {
    if (section.name === "聯絡人及協議")
      section.texts[1] = "聯絡人姓名、電話及電郵各自獨立；請核對聯絡方式。";
    if (section.name === "交易規模")
      section.texts[1] = "以下均為選填；填寫時請保留最多 2 位小數。";
    for (const f of section.fields) {
      if (f.id === "contactEmail") f.hint = "用於接收申請及補件通知，無需驗證";
      if (f.id === "webUrl") f.hint = "選填；如提供，請填寫完整 https:// 網址";
      if (["avgPerAmount", "maxAmount", "avgMonthAmount"].includes(f.id))
        f.hint = "選填；最多 2 位小數";
      if (f.id === "cardBankName") f.hint = "選擇銀行後，自動帶入右側銀行行號";
      if (f.id === "cardBankCode")
        f.hint = "可直接選擇銀行代碼，銀行名稱會同步更新";
    }
  }
const usabilityHongKongBanks = [
  "004",
  "012",
  "024",
  "003",
  "015",
  "009",
  "016",
  "018",
  "020",
  "025",
  "027",
  "028",
  "035",
  "039",
  "040",
  "041",
  "043",
  "072",
  "128",
  "250",
  "382",
  "387",
  "388",
  "389",
  "390",
  "391",
  "392",
  "393",
  "395",
];
const usabilityOriginalField = v2Field;
const usabilityOriginalBankSync = syncBankName;
syncBankName = function (changed) {
  if (v2Raw("cardCountryCode") === "HKG" && v2Model().bankCustom) {
    state.values.cardBankCode = v2Raw("cardBankCode").split(/\s+/)[0];
    return;
  }
  usabilityOriginalBankSync(changed);
};
v2Field = function (f, index = 0, linked = false) {
  if (f.id === "authSigners[].birthDay")
    return usabilityOriginalField(f, index, false);
  let html = usabilityOriginalField(f, index, linked);
  if (v2Raw("cardCountryCode") !== "HKG") return html;
  const name = v2Raw("cardBankName"),
    code = v2Raw("cardBankCode"),
    known = Object.entries(ONBOARDING_BANKS).sort(([a], [b]) => {
      const ai = usabilityHongKongBanks.indexOf(a),
        bi = usabilityHongKongBanks.indexOf(b);
      return (
        (ai < 0 ? 1000 + Number(a) : ai) - (bi < 0 ? 1000 + Number(b) : bi)
      );
    }),
    custom =
      !!v2Model().bankCustom ||
      !!(name && !known.some(([, n]) => n === name)) ||
      !!(code && !ONBOARDING_BANKS[code]);
  if (f.id === "cardBankName") {
    const select = `<select id="field-cardBankName" data-field="cardBankName" data-v2-field="cardBankName" data-bank-picker aria-required="true"><option value="">請選擇銀行</option>${known.map(([c, n]) => `<option value="${esc(n)}" ${name === n && !custom ? "selected" : ""}>${esc(n)}</option>`).join("")}<option value="__other" ${custom ? "selected" : ""}>其他銀行（手動填寫）</option></select>${custom ? `<label for="other-bank-name" class="hint">銀行名稱</label><input id="other-bank-name" data-other-bank-name maxlength="100" value="${esc(name)}" placeholder="請填寫銀行名稱">` : ""}`;
    html = html.replace(/<input[^>]*data-field="cardBankName"[^>]*>/, select);
  }
  if (f.id === "cardBankCode") {
    const other =
      !!v2Model().bankCodeCustom || !!(code && !ONBOARDING_BANKS[code]);
    const control = `<select id="field-cardBankCode" data-field="cardBankCode" data-v2-field="cardBankCode" data-bank-code-picker aria-required="true" ${state.readonly ? "disabled" : ""}><option value="">請選擇銀行代碼</option>${known.map(([c, n]) => `<option value="${c}" ${!other && code === c ? "selected" : ""}>${c} · ${esc(n)}</option>`).join("")}<option value="__other" ${other ? "selected" : ""}>其他代碼（手動填寫）</option></select>${other ? `<label for="other-bank-code" class="hint">銀行代碼（3 位數字）</label><input id="other-bank-code" data-other-bank-code value="${esc(code)}" maxlength="3" inputmode="numeric">` : ""}<a class="bank-reference-download" href="references/Bank_Code.pdf" download="香港銀行代碼清單.pdf">下載銀行代碼清單</a>`;
    html = html.replace(/<input[^>]*data-field="cardBankCode"[^>]*>/, control);
  }
  return html;
};
function usabilityPickBank(e) {
  const t = e.target;
  if (!t.hasAttribute("data-bank-picker")) return;
  e.stopImmediatePropagation();
  if (t.value === "__other" && v2Model().bankCustom) return;
  if (t.value === "__other") {
    v2Model().bankCustom = true;
    state.values.cardBankName = "";
    state.values.cardBankCode = "";
    delete v2Model().bankAutoName;
  } else {
    v2Model().bankCustom = false;
    v2Model().bankCodeCustom = false;
    state.values.cardBankName = t.value;
    state.values.cardBankCode =
      Object.entries(ONBOARDING_BANKS).find(
        ([, name]) => name === t.value,
      )?.[0] || "";
    delete v2Model().bankAutoName;
  }
  delete state.errors.cardBankName;
  delete state.errors.cardBankCode;
  v2SyncDerived();
  queueMicrotask(() => render());
}
// Update both fields before the shared input/status listeners can restore the old bank.
document.addEventListener("input", usabilityPickBank, true);
document.addEventListener("change", usabilityPickBank, true);
document.addEventListener("input", (e) => {
  if (e.target.hasAttribute("data-other-bank-name")) {
    state.values.cardBankName = e.target.value;
    delete state.errors.cardBankName;
  }
});
const usabilityOriginalReview = v2Review;
v2Review = () =>
  usabilityOriginalReview().replace("✓ 電郵已驗證（模擬）", "✓ 聯絡資料已填寫");
const usabilityOriginalPeople = v2PersonSection;
v2PersonSection = (section) =>
  usabilityOriginalPeople(section).replace(
    section.fields[0]?.id.startsWith("authSigners")
      ? "董事修改時同步更新；取消勾選可獨立修改。"
      : "__no_replacement__",
    "身分資料跟隨董事；出生日期可獨立修改。",
  );
// Summarize optional document information without repeating full-width empty cards.
const usabilityOriginalDocuments = v2Documents;
v2Documents = function () {
  const template = document.createElement("template");
  template.innerHTML = usabilityOriginalDocuments()
    .replaceAll("PDF／JPG／PNG／ZIP", "PDF／JPG／PNG")
    .replaceAll("PDF／ZIP", "PDF");
  const ocr = template.content.querySelector('[data-section="辨識結果及來源"]'),
    consistency = template.content.querySelector(
      '[data-section="資料一致性檢查"]',
    ),
    provided = template.content.querySelector(
      '[data-section="文件提供狀態"],[data-section="必交文件檢查"]',
    );
  const log = v2Model().ocr,
    list = v2Consistency(),
    pending = list.filter((c) => !c.same && !c.confirmed),
    selected = Object.keys(state.files).length;
  const cards = [];
  function detail(card, title, badge, color, open = false) {
    if (!card) return "";
    card.querySelector("h2")?.remove();
    card.querySelector(":scope > p.hint")?.remove();
    return `<details class="mt-document-detail ${open ? "needs-review" : ""}" ${open ? "open" : ""}><summary><strong>${title}</strong>${pill(badge, color)}</summary><div class="mt-document-detail-body">${card.innerHTML}</div></details>`;
  }
  if (log.length)
    cards.push(
      detail(
        ocr,
        "辨識結果及來源",
        log.filter((o) => o.applied).length + "／" + log.length + " 已套用",
        "blue",
      ),
    );
  if (list.length)
    cards.push(
      detail(
        consistency,
        "資料一致性檢查",
        pending.length
          ? pending.length + " 項待核對"
          : list.length + " 項已核對",
        pending.length ? "amber" : "green",
        !!pending.length,
      ),
    );
  const notice = `<div class="mt-document-notice" role="status"><strong>文件為選填</strong><span>已選 ${selected} 份 · 未提供不會阻擋下一步</span><small>辨識只在本機處理；核對並勾選後才帶入表單。</small></div>`;
  const marker = document.createElement("div");
  marker.className = "mt-document-status";
  marker.innerHTML =
    notice +
    (cards.length
      ? '<div class="mt-document-status-grid">' + cards.join("") + "</div>"
      : "");
  (ocr || consistency || provided)?.before(marker);
  ocr?.remove();
  consistency?.remove();
  provided?.remove();
  return template.innerHTML;
};

function clientPickBankCode(e) {
  const t = e.target;
  if (t.hasAttribute("data-bank-code-picker")) {
    e.stopImmediatePropagation();
    if (t.value === "__other") {
      v2Model().bankCodeCustom = true;
      v2Model().bankCustom = true;
      state.values.cardBankCode = "";
    } else {
      v2Model().bankCodeCustom = false;
      v2Model().bankCustom = false;
      state.values.cardBankCode = t.value;
      if (ONBOARDING_BANKS[t.value])
        state.values.cardBankName = ONBOARDING_BANKS[t.value];
      else state.values.cardBankName = "";
    }
    delete state.errors.cardBankCode;
    delete state.errors.cardBankName;
    v2SyncDerived();
    queueMicrotask(() => render());
  }
  if (t.hasAttribute("data-other-bank-code")) {
    e.stopImmediatePropagation();
    state.values.cardBankCode = t.value;
    delete state.errors.cardBankCode;
  }
}
document.addEventListener("input", clientPickBankCode, true);
document.addEventListener("change", clientPickBankCode, true);


// SOURCE MODULE: merchant-template-model.js
/* Shared, versioned merchant-template and import model. No browser/storage APIs. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MerchantTemplateModel = api;
})(globalThis, function () {
  "use strict";
  const clone = (value) => structuredClone(value);
  const text = (value) => (value == null ? "" : String(value).trim());
  const codes = (value) => [
    ...new Set(
      (Array.isArray(value) ? value : text(value).split(/[;,，；、\s]+/))
        .map(text)
        .filter(Boolean),
    ),
  ];
  function parseCSV(source) {
    source = source.replace(/^\uFEFF/, "");
    const rows = [];
    let row = [],
      cell = "",
      quoted = false,
      closed = false;
    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      if (quoted) {
        if (ch === '"') {
          if (source[i + 1] === '"') {
            cell += '"';
            i++;
          } else {
            quoted = false;
            closed = true;
          }
        } else cell += ch;
        continue;
      }
      if (ch === '"') {
        if (cell || closed) throw Error("CSV 引號位置不正確");
        quoted = true;
        continue;
      }
      if (ch === "," || ch === "\n" || ch === "\r") {
        row.push(cell);
        cell = "";
        closed = false;
        if (ch !== ",") {
          if (ch === "\r" && source[i + 1] === "\n") i++;
          if (row.some((v) => v.trim())) rows.push(row);
          row = [];
        }
        continue;
      }
      if (closed && !/\s/.test(ch)) throw Error("CSV 引號後只能接逗號或換行");
      if (!closed) cell += ch;
    }
    if (quoted) throw Error("CSV 有未關閉的引號");
    row.push(cell);
    if (row.some((v) => v.trim())) rows.push(row);
    if (!rows.length) throw Error("文件沒有資料");
    const headers = rows.shift().map(text);
    if (headers.some((h) => !h) || new Set(headers).size !== headers.length)
      throw Error("CSV 標題不可留白或重複");
    return rows.map((r, i) => {
      if (r.length !== headers.length)
        throw Error("CSV 第 " + (i + 2) + " 列欄位數與標題不一致");
      return Object.fromEntries(headers.map((h, j) => [h, r[j]]));
    });
  }
  function csv(rows) {
    return (
      "\uFEFF" +
      rows
        .map((row) =>
          row.map((v) => '"' + text(v).replaceAll('"', '""') + '"').join(","),
        )
        .join("\r\n") +
      "\r\n"
    );
  }
  function create(data) {
    const fields = data.forms.flatMap((f) =>
        f.sections.flatMap((s) => s.fields),
      ),
      byId = Object.fromEntries(fields.map((f) => [f.id, f]));
    const identity = [
      "merchantName",
      "merchantShortName",
      "merchantEnglishName",
      "merchantEnglishShortName",
      "merchantType",
      "groupId",
      "parentMerchant",
      "inspectionDate",
      "registerCertNo",
      "registerCertName",
      "registerCertPeriod",
      "crCode",
      "nar1Period",
      "creditCode",
      "creditCodePeriod",
      "organCode",
      "organCodePeriod",
      "taxCode",
      "taxCodePeriod",
      "cardName",
      "cardNo",
      "cardIdcardNo",
    ];
    const settlement = data.forms[2].sections
      .flatMap((s) => s.fields.map((f) => f.id))
      .filter((k) => !identity.includes(k));
    const productFields = data.forms[3].sections.flatMap((s) =>
      s.fields.map((f) => f.id),
    );
    const profile = fields
      .map((f) => f.id)
      .filter(
        (k) =>
          !k.includes("[]") &&
          !identity.includes(k) &&
          !settlement.includes(k) &&
          !productFields.includes(k) &&
          ![
            "mcc",
            "mccName",
            "riskLevel",
            "riskOverrideReason",
            "merchantAgreementNum",
            "groupId",
          ].includes(k),
      );
    const scopeFields = {
      profile,
      mcc: ["mcc", "mccCodes"],
      settlement,
      products: productFields,
      identity,
    };
    const labels = {
      profile: "商戶共用資料",
      mcc: "MCC 行業代碼",
      settlement: "結算參數",
      products: "產品與費率",
      identity: "公司專屬資料（僅單家公司）",
    };
    const rateDefs = Object.fromEntries(
      data.catalog.GROUPS.flatMap((g) =>
        g.rows.map((r, i) => [g.k + "|" + i, { g, r }]),
      ),
    );
    const groups = new Set(data.catalog.GROUPS.map((g) => g.k));
    const comboKeys = new Set(
      data.catalog.GROUPS.flatMap((g) =>
        (g.combo || []).map((c) => g.k + "|" + c),
      ),
    );
    function cleanFields(input) {
      const out = {};
      if (!input || typeof input !== "object" || Array.isArray(input))
        return out;
      for (const [key, value] of Object.entries(input)) {
        if (key === "mccCodes") {
          const list = codes(value);
          if (list.some((c) => !/^\d{4}$/.test(c)) || list.length > 50)
            throw Error("MCC 必須是 4 位數字，每家公司最多 50 個");
          out[key] = list;
          continue;
        }
        const base = key.replace(/\[\d+\]/g, "[]");
        if (
          !Object.hasOwn(byId, base) ||
          ["riskLevel", "riskOverrideReason", "merchantAgreementNum"].includes(
            key,
          )
        )
          continue;
        if (
          value !== null &&
          !["string", "number", "boolean"].includes(typeof value)
        )
          throw Error("欄位 " + key + " 的格式不正確");
        const val = text(value);
        if (val.length > 2000) throw Error("欄位 " + key + " 過長");
        if (/\[(\d+)\]/.test(key) && +RegExp.$1 >= 20)
          throw Error("每類人士最多 20 位");
        out[key] = val;
      }
      if (out.mcc && !/^\d{4}$/.test(out.mcc))
        throw Error("主要 MCC 必須是 4 位數字");
      if (out.mccCodes || out.mcc) {
        out.mccCodes = codes(out.mccCodes || out.mcc);
        if (out.mcc && !out.mccCodes.includes(out.mcc))
          out.mccCodes.unshift(out.mcc);
        out.mcc ||= out.mccCodes[0] || "";
      }
      for (const [k, v] of Object.entries(out))
        if (v && /Email$/.test(k) && !/^\S+@\S+\.\S+$/.test(v))
          throw Error(k + " 電郵格式不正確");
      return out;
    }
    function cleanProducts(input) {
      if (input == null) return null;
      if (typeof input !== "object" || Array.isArray(input))
        throw Error("產品設定格式不正確");
      const out = {
        groups: Object.fromEntries([...groups].map((k) => [k, false])),
        rates: Object.fromEntries(
          Object.entries(rateDefs).map(([k, d]) => [
            k,
            { on: false, ct: d.r.ct || null, v: {} },
          ]),
        ),
        combo: {},
        sme: {},
      };
      for (const [k, v] of Object.entries(input.groups || {})) {
        if (!groups.has(k)) throw Error("未知產品類別：" + k);
        out.groups[k] = !!v;
      }
      for (const [k, r] of Object.entries(input.rates || {})) {
        if (!Object.hasOwn(rateDefs, k)) throw Error("未知產品項目：" + k);
        if (!r || typeof r !== "object") throw Error("產品費率格式不正確");
        if (r.ct != null && !["Regional", "Blended", "Wallet"].includes(r.ct))
          throw Error("收費類型不正確：" + k);
        const value = {};
        for (const [field, val] of Object.entries(r.v || {})) {
          if (
            !/^[a-z][a-z0-9_]{0,30}$/.test(field) ||
            ["constructor", "prototype", "__proto__"].includes(field)
          )
            throw Error("費率欄位不正確");
          if (typeof val === "boolean") {
            value[field] = val;
            continue;
          }
          const str = text(val);
          if (!/^\d+(\.\d{1,2})?$/.test(str) && !["Y", "N", ""].includes(str))
            throw Error("費率／金額格式不正確：" + field);
          if (/rate|ratio/.test(field) && +str > 100)
            throw Error("費率不可超過 100%");
          value[field] = str;
        }
        out.rates[k] = {
          on: !!r.on,
          ct: r.ct ?? rateDefs[k].r.ct ?? null,
          v: value,
        };
      }
      for (const [k, v] of Object.entries(input.combo || {})) {
        if (!comboKeys.has(k)) throw Error("未知產品功能：" + k);
        out.combo[k] = !!v;
      }
      for (const [k, v] of Object.entries(input.sme || {})) {
        if (
          !["VISA", "MASTERCARD", "AMERICAEXPRESS"].includes(k) ||
          !v ||
          !["SME", "SMESMK", "SMEB2B"].includes(v.type)
        )
          throw Error("特計商戶設定不正確");
        out.sme[k] = { on: !!v.on, type: v.type };
      }
      return out;
    }
    function cleanTemplate(input) {
      if (!input || typeof input !== "object") throw Error("模板格式不正確");
      const name = text(input.name);
      if (!name || name.length > 80) throw Error("請填寫 80 字以內的模板名稱");
      const values = cleanFields(input.values),
        products = cleanProducts(input.products),
        scopes = Object.keys(labels).filter((s) =>
          (input.scopes || Object.keys(labels)).includes(s),
        );
      if (!scopes.length) throw Error("模板至少選擇一個範圍");
      const allowed = new Set(scopes.flatMap((s) => scopeFields[s]));
      for (const key of Object.keys(values))
        if (
          values[key] === "" ||
          (Array.isArray(values[key]) && !values[key].length) ||
          (!allowed.has(key) &&
            !(scopes.includes("identity") && key.includes("[")))
        )
          delete values[key];
      const people = {};
      for (const k of ["directors", "authSigners", "shareHolders"])
        people[k] = Math.min(
          20,
          Math.max(k === "directors" ? 1 : 0, Number(input.people?.[k]) || 0),
        );
      return {
        id: text(input.id).slice(0, 100),
        name,
        version: Math.max(1, Number(input.version) || 1),
        scopes,
        values,
        products: scopes.includes("products") ? products : null,
        people,
        createdAt: text(input.createdAt),
        updatedAt: text(input.updatedAt),
      };
    }
    function apply(
      snapshot,
      template,
      selected,
      mode = "replace",
      allowIdentity = false,
    ) {
      const out = clone(snapshot),
        values = (out.values ??= {}),
        changes = [];
      out.people ||= { directors: 1, authSigners: 0, shareHolders: 0 };
      const scopes = selected.filter(
        (s) =>
          template.scopes.includes(s) && (s !== "identity" || allowIdentity),
      );
      const allow = new Set(scopes.flatMap((s) => scopeFields[s]));
      for (const [key, val] of Object.entries(template.values)) {
        if (
          !allow.has(key) &&
          !(scopes.includes("identity") && key.includes("["))
        )
          continue;
        if (
          mode === "blank" &&
          (Array.isArray(values[key])
            ? values[key].length
            : !!text(values[key]))
        )
          continue;
        if (JSON.stringify(values[key] ?? "") !== JSON.stringify(val)) {
          changes.push({
            key,
            before: clone(values[key] ?? ""),
            after: clone(val),
          });
          values[key] = clone(val);
        }
      }
      if (scopes.includes("identity")) out.people = clone(template.people);
      if (
        values.__v2 &&
        changes.some((c) => ["cardBankName", "cardBankCode"].includes(c.key))
      ) {
        values.__v2.bankCustom = false;
        delete values.__v2.bankAutoName;
      }
      if (scopes.includes("mcc")) {
        values.mccCodes = codes(values.mccCodes || values.mcc);
        if (!values.mccCodes.includes(values.mcc))
          values.mcc = values.mccCodes[0] || "";
      }
      if (scopes.includes("products") && template.products) {
        const m = (values.__v2 ||= {
          version: 2,
          groups: {},
          rates: {},
          combo: {},
          sme: {},
          links: { authSigners: {}, shareHolders: {} },
          signals: {},
          ocr: [],
          ack: {},
          manualRisk: false,
        });
        const old = Object.fromEntries(
          ["groups", "rates", "combo", "sme"].map((k) => [
            k,
            clone(m[k] || {}),
          ]),
        );
        if (
          mode === "replace" ||
          !Object.keys(m.rates || {}).some(
            (k) => m.groups?.[k.split("|")[0]] && m.rates[k]?.on,
          )
        ) {
          for (const key of ["groups", "rates", "combo", "sme"])
            m[key] = clone(template.products[key] || {});
          if (JSON.stringify(old) !== JSON.stringify(template.products))
            changes.push({
              key: "_products",
              before: old,
              after: clone(template.products),
            });
        }
      }
      if (changes.some((c) => c.key === "contactEmail"))
        out.emailVerified = false;
      if (changes.length) {
        out.checks = {};
        out.signature = "";
        values.signer = "";
        values.signerTitle = "";
        if (values.__v2) values.__v2.ack = {};
      }
      values.__templateApplied = {
        id: template.id,
        name: template.name,
        version: template.version,
        scopes,
        time: new Date().toISOString(),
      };
      return { snapshot: out, changes, scopes };
    }
    const aliases = {
      中文名稱: "merchantName",
      英文名稱: "merchantEnglishName",
      中文簡稱: "merchantShortName",
      英文簡稱: "merchantEnglishShortName",
      BR號碼: "registerCertNo",
      BR有效期: "registerCertPeriod",
      MCC代碼: "mccCodes",
      主要MCC: "mcc",
      聯絡人: "contactName",
      聯絡電話: "contactPhone",
      聯絡電郵: "contactEmail",
      中文地址: "addrStreet",
      英文地址: "addrStreetEn",
      結算週期: "settlePeriod",
      幣種: "currency",
      銀行代碼: "cardBankCode",
      銀行名稱: "cardBankName",
      銀行帳戶名稱: "cardName",
      銀行帳號: "cardNo",
    };
    const csvHeaders = [
      "客戶編號",
      "客戶名稱",
      "公司代號",
      "公司角色",
      "母公司代號",
      "參數模板",
      ...Object.keys(aliases),
      "收單VISA本地費率(%)",
      "收單VISA跨境費率(%)",
      "CNPVISA本地費率(%)",
      "CNPVISA跨境費率(%)",
    ];
    function csvBundle(source) {
      const records = parseCSV(source),
        unknown = Object.keys(records[0] || {}).filter(
          (key) =>
            !csvHeaders.includes(key) &&
            key !== "主公司代號" &&
            !Object.hasOwn(byId, key.replace(/\[\d+\]/g, "[]")) &&
            key !== "mccCodes",
        );
      if (unknown.length)
        throw Error(
          "CSV 含未識別欄位：" +
            unknown.join("、") +
            "。請依下載範本或表單欄位 ID 填寫。",
        );
      return {
        format: "allinpay.merchant-bundle",
        version: 1,
        companies: records.map((row, i) => {
          const values = {};
          for (const [key, val] of Object.entries(row)) {
            const id = aliases[key] || key;
            if (
              Object.hasOwn(byId, id.replace(/\[\d+\]/g, "[]")) ||
              id === "mccCodes"
            )
              values[id] = val;
          }
          const products = { groups: {}, rates: {}, combo: {}, sme: {} };
          for (const [header, group, field] of [
            ["收單VISA本地費率(%)", "POS", "loc_rate"],
            ["收單VISA跨境費率(%)", "POS", "crs_rate"],
            ["CNPVISA本地費率(%)", "CNP", "loc_rate"],
            ["CNPVISA跨境費率(%)", "CNP", "crs_rate"],
          ])
            if (text(row[header])) {
              products.groups[group] = true;
              const key = group + "|0";
              products.rates[key] ??= { on: true, ct: "Regional", v: {} };
              products.rates[key].v[field] = text(row[header]);
            }
          return {
            key: row["公司代號"] || "ROW-" + (i + 1),
            customerId: row["客戶編號"],
            customerName: row["客戶名稱"],
            role: row["公司角色"] || "independent",
            parentKey: row["母公司代號"] || row["主公司代號"],
            templateName: row["參數模板"],
            values,
            products: Object.keys(products.rates).length ? products : null,
          };
        }),
      };
    }
    function bundle(input, knownTemplates = []) {
      if (
        !input ||
        input.format !== "allinpay.merchant-bundle" ||
        input.version !== 1
      )
        throw Error("請使用版本 1 的商戶資料匯入文件");
      if (
        (input.companies && !Array.isArray(input.companies)) ||
        (input.companies || []).length > 100 ||
        (!(input.companies || []).length && !input.templates?.length)
      )
        throw Error("每次可匯入 1–100 家公司，或至少一份模板");
      if (
        (input.templates && !Array.isArray(input.templates)) ||
        input.templates?.length > 50
      )
        throw Error("每次最多 50 份模板");
      const templates = (input.templates || []).map(cleanTemplate),
        seen = new Set();
      if (new Set(templates.map((t) => t.name)).size !== templates.length)
        throw Error("同一文件不可包含重複模板名稱");
      const companies = (input.companies || []).map((entry, index) => {
        const key = text(entry.key) || "ROW-" + (index + 1);
        if (seen.has(key)) throw Error("公司代號重複：" + key);
        seen.add(key);
        const values = cleanFields(entry.values),
          role =
            {
              母公司: "parent",
              主公司: "parent",
              子公司: "subsidiary",
              獨立公司: "independent",
            }[entry.role] ||
            entry.role ||
            "independent";
        if (!["parent", "subsidiary", "independent"].includes(role))
          throw Error(key + " 公司角色不正確");
        if (!values.merchantName && !values.merchantEnglishName)
          throw Error(key + " 請填寫公司中文或英文名稱");
        const customerId = text(entry.customerId || input.customer?.id),
          customerName = text(entry.customerName || input.customer?.name);
        const templateName = text(entry.templateName || input.defaultTemplate);
        if (
          templateName &&
          ![...templates, ...knownTemplates].some(
            (t) => t.name === templateName,
          )
        )
          throw Error(key + " 找不到參數模板：" + templateName);
        const people = {};
        for (const group of ["directors", "authSigners", "shareHolders"]) {
          const inferred = Object.keys(values)
            .filter((k) => k.startsWith(group + "["))
            .map((k) => Number(k.match(/\[(\d+)\]/)[1]) + 1);
          people[group] = Math.max(
            group === "directors" ? 1 : 0,
            Number(entry.people?.[group]) || 0,
            ...inferred,
          );
          if (!Number.isInteger(people[group]) || people[group] > 20)
            throw Error("每種人員類型最多 20 人");
        }
        return {
          key,
          values,
          people,
          products: cleanProducts(entry.products),
          customerId: customerId || customerName,
          customerName: customerName || customerId,
          role,
          parentKey: text(entry.parentKey),
          templateName,
        };
      });
      const byKey = new Map(companies.map((c) => [c.key, c]));
      for (const c of companies) {
        if (c.role === "subsidiary") {
          const parent = byKey.get(c.parentKey);
          if (
            !parent ||
            parent === c ||
            parent.role !== "parent" ||
            !c.customerId ||
            c.customerId !== parent.customerId
          )
            throw Error(c.key + " 子公司須對應同一客戶內的母公司");
        } else if (c.parentKey)
          throw Error(c.key + " 只有子公司可填寫母公司代號");
      }
      return { format: input.format, version: 1, templates, companies };
    }
    return {
      scopeFields,
      labels,
      identity,
      cleanFields,
      cleanProducts,
      cleanTemplate,
      apply,
      csvBundle,
      bundle,
      csvHeaders,
      codes,
      parseCSV,
      csv,
    };
  }
  return { create, codes, parseCSV, csv };
});


// SOURCE MODULE: merchant-templates.js
// Shared onboarding tools: MCC, company relationships, templates and batch import.
const MT = MerchantTemplateModel.create(V2),
  MT_EXTERNAL = !!window.AllinPayDemo.external;
const MT_KEY = "meepay-dev2-20261117-allinpay-merchant-templates-v1";
const MT_CUSTOMERS_KEY = "meepay-dev2-20261117-allinpay-customer-groups-v1";
let mtFlow = null,
  mtImport = null,
  mtImportSequence = 0,
  mtStartTemplate = false;
let mtCreatingCustomerOpen = false,
  mtCompanyNameInRelationship = false;
let mtRenderPending = false;
function mtRefreshForm() {
  if (mtRenderPending) return;
  mtRenderPending = true;
  queueMicrotask(() => {
    mtRenderPending = false;
    if (["application", "merchant-setup"].includes(route().page)) render();
  });
}
const mtOwner = () =>
  MT_EXTERNAL
    ? state.session && state.email
      ? "external:" + state.email.toLowerCase()
      : ""
    : BO.user
      ? "backoffice:" + BO.user.id
      : "";
const mtAllowed = () =>
  !!mtOwner() && !state.readonly && (MT_EXTERNAL || can(1));
const mtRoleName = (role) =>
  ({ parent: "母公司", subsidiary: "子公司", independent: "獨立公司" })[role] ||
  "獨立公司";
const mtNow = () => new Date().toLocaleString("zh-HK", { hour12: false });
// Native dialogs occupy the top layer; notifications need their own top-layer entry.
toast = function (text) {
  const node = $("#toast");
  node.textContent = text;
  node.setAttribute("role", "status");
  node.setAttribute("aria-live", "polite");
  node.classList.add("visible");
  if (node.showPopover) {
    node.setAttribute("popover", "manual");
    if (node.matches(":popover-open")) node.hidePopover();
    node.showPopover();
  } else if ($("#modal").open) $("#modal").append(node);
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    node.classList.remove("visible");
    if (node.hidePopover && node.matches(":popover-open")) node.hidePopover();
    if (!node.showPopover) document.body.append(node);
  }, 3500);
};
const mtError = (message) => {
  const node = $("#mt-error");
  if (node) node.textContent = message;
  else toast(message);
};
function mtStorage() {
  try {
    const value = JSON.parse(localStorage.getItem(MT_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  } catch {
    return {};
  }
}
function mtTemplates() {
  return (mtStorage()[mtOwner()] || [])
    .map((t) => {
      try {
        return MT.cleanTemplate(t);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}
function mtSaveTemplates(list) {
  if (!mtAllowed()) throw Error("請先登入");
  const store = mtStorage();
  store[mtOwner()] = list;
  localStorage.setItem(MT_KEY, JSON.stringify(store));
}
function mtMccList(values = state.values) {
  return MT.codes(values.mccCodes || values.mcc);
}
function mtSyncMcc() {
  const primary = v2Raw("mcc");
  if (!primary) {
    state.values.mccCodes = [];
    return;
  }
  const list = mtMccList();
  if (/^\d{4}$/.test(primary) && !list.includes(primary)) list.unshift(primary);
  state.values.mccCodes = list;
}
const mtOriginalSync = v2SyncDerived;
v2SyncDerived = function () {
  mtSyncMcc();
  mtSyncRelationship();
  mtOriginalSync();
  state.values.mccName = mtMccList()
    .map((c) => V2.catalog.MCCS.find((m) => m.c === c)?.n || c + "（待核定）")
    .join("、");
};
const mtOriginalScore = v2Score;
v2Score = function () {
  const result = mtOriginalScore(),
    selected = mtMccList()
      .map((c) => V2.catalog.MCCS.find((m) => m.c === c))
      .filter(Boolean);
  const industryItems = result.items.filter(
    (i) => !/^MCC 屬|^平均單筆偏離/.test(i.label),
  );
  const high = selected.filter((m) => m.lv === "high"),
    mid = selected.filter((m) => m.lv === "mid");
  if (high.length)
    industryItems.push({
      label: "所選 MCC 含高風險（" + high.map((m) => m.c).join("、") + "）",
      n: 25,
    });
  else if (mid.length)
    industryItems.push({
      label: "所選 MCC 含中風險（" + mid.map((m) => m.c).join("、") + "）",
      n: 12,
    });
  if (selected.some((m) => m.avg > 0 && v2Num("avgPerAmount") > m.avg * 3))
    industryItems.push({ label: "平均單筆偏離所選行業常態超過 3 倍", n: 12 });
  const total = Math.min(
      100,
      industryItems.reduce((s, i) => s + i.n, 0),
    ),
    s = v2Model().signals;
  return {
    ...result,
    items: industryItems,
    total,
    level: total <= 20 ? "1" : total <= 45 ? "2" : "3",
    reject: s.sanction
      ? "命中制裁／PEP 名單"
      : s.frozen
        ? "關聯已凍結／關閉商戶"
        : total > 70
          ? "風控評分超過 70"
          : null,
  };
};
v2SmeOptions = function (brand) {
  const list = mtMccList().map(Number),
    rules = V2.catalog.SME_RULES[brand];
  return ["SME", "SMESMK", "SMEB2B"].filter((type) => {
    const r = rules[type];
    return (
      r &&
      list.length &&
      list.every((m) =>
        r.only
          ? r.only.includes(m)
          : !r.ex.some((x) =>
              Array.isArray(x) ? m >= x[0] && m <= x[1] : m === x,
            ),
      )
    );
  });
};
const mtOriginalField = v2Field;
v2Field = function (f, index = 0, linked = false) {
  if (f.id === "merchantName" && mtCompanyNameInRelationship) return "";
  if (
    ["groupId", "parentMerchant"].includes(f.id) &&
    state.values.__customer?.id
  ) {
    const group = f.id === "groupId";
    return mtOriginalField(
      {
        ...f,
        placeholder: group
          ? "依上方選取的客戶／集團帶入"
          : state.values.__customer.role === "subsidiary"
            ? "請先選擇所屬母公司"
            : "無上級商戶",
        hint: group
          ? "由上方「選取客戶／集團」自動帶入；修改請使用「管理客戶／集團」。"
          : "由上方「所屬母公司」自動帶入；母公司及獨立公司無上級商戶。",
      },
      index,
      true,
    );
  }
  const original = mtOriginalField(f, index, linked);
  if (f.id !== "mcc" || !original) return original;
  const list = mtMccList(),
    error = state.errors.mcc;
  return `<div class="field mt-mcc-field ${error ? "invalid" : ""}" data-field-wrap="mcc"><label id="mt-mcc-label">MCC 行業代碼 <span class="required">*</span><span class="en">Merchant Category Code</span></label><details class="mt-mcc-picker"><summary id="field-mcc" aria-labelledby="mt-mcc-label mt-mcc-value"><span id="mt-mcc-value">${list.length ? "已選 " + list.length + " 個 MCC" : "請選擇 MCC（可複選）"}</span><span class="mt-mcc-arrow" aria-hidden="true"></span></summary><div class="mt-mcc-panel"><label for="mt-mcc-search" class="sr-only">搜尋 MCC 代碼或行業名稱</label><input id="mt-mcc-search" placeholder="搜尋代碼或行業名稱" autocomplete="off"><div class="mt-mcc-options" role="group" aria-label="MCC 複選選項">${mtMccOptions()}</div><div class="mt-mcc-panel-foot"><small>可連續勾選，第一個為主要代碼</small>${btn("完成", "mt-mcc-done")}</div></div></details><div class="mt-mcc-chips" aria-label="已選 MCC">${list.map((code) => `<span>${code === v2Raw("mcc") ? `<strong>${esc(code)} · 主要</strong>` : btn(esc(code), "mt-mcc-primary", "", `data-code="${esc(code)}" aria-label="設 ${esc(code)} 為主要 MCC"`)}${btn("×", "mt-mcc-remove", "", `data-code="${esc(code)}" aria-label="移除 MCC ${esc(code)}"`)}</span>`).join("")}</div><small class="hint">風控參考採最高風險；特計方案須同時適用所有所選代碼。點選標籤代碼可設為主要。</small>${error ? `<div class="error" role="alert">${esc(error)}</div>` : ""}</div>`;
};
function mtMccOptions(query = "") {
  const selected = mtMccList(),
    known = new Set(V2.catalog.MCCS.map((m) => m.c)),
    options = [
      ...V2.catalog.MCCS,
      ...selected
        .filter((c) => !known.has(c))
        .map((c) => ({ c, n: "待核定行業" })),
    ],
    q = query.trim().toLowerCase();
  if (/^\d{4}$/.test(q) && !options.some((m) => m.c === q))
    options.push({ c: q, n: "其他行業（待核定）" });
  return (
    options
      .filter((m) => (m.c + " " + m.n).toLowerCase().includes(q))
      .map(
        (m) =>
          `<label class="check" data-mt-mcc-option="${m.c}"><input type="checkbox" data-mt-mcc="${m.c}" ${selected.includes(m.c) ? "checked" : ""}><span>${m.c} · ${esc(m.n)}</span>${m.c === v2Raw("mcc") ? "<small>主要</small>" : ""}</label>`,
      )
      .join("") ||
    '<p class="hint">沒有符合的項目；其他代碼可輸入完整 4 位數字。</p>'
  );
}
function mtRenderMcc() {
  const picker = $(".mt-mcc-picker"),
    open = picker?.open,
    query = $("#mt-mcc-search")?.value || "",
    scroll = $(".mt-mcc-options")?.scrollTop || 0,
    active = document.activeElement,
    code = active?.dataset.mtMcc,
    focusSearch = active?.id === "mt-mcc-search";
  v2SyncDerived();
  render();
  const next = $(".mt-mcc-picker");
  if (!next) return;
  next.open = !!open;
  if (query) {
    $("#mt-mcc-search").value = query;
    $(".mt-mcc-options").innerHTML = mtMccOptions(query);
  }
  $(".mt-mcc-options").scrollTop = scroll;
  if (open) {
    const focus = focusSearch
      ? $("#mt-mcc-search")
      : code
        ? $(`[data-mt-mcc="${code}"]`)
        : $("#field-mcc");
    focus?.focus({ preventScroll: true });
  }
}
function mtCloseMcc() {
  const picker = $(".mt-mcc-picker");
  if (picker?.open) {
    picker.open = false;
    $("#mt-mcc-search").value = "";
    $(".mt-mcc-options").innerHTML = mtMccOptions();
    $("#field-mcc")?.focus({ preventScroll: true });
  }
}
function mtSnapshot() {
  v2Ensure();
  v2SyncDerived();
  return {
    values: structuredClone(state.values),
    people: structuredClone(state.people),
    files: structuredClone(state.files),
    checks: structuredClone(state.checks),
    emailVerified: state.emailVerified,
    signature: state.signature || "",
  };
}
function mtBlank(
  values = {},
  people = { directors: 1, authSigners: 0, shareHolders: 0 },
) {
  const saved = {
    values: state.values,
    people: state.people,
    files: state.files,
    checks: state.checks,
    emailVerified: state.emailVerified,
  };
  try {
    state.values = structuredClone(V2.defaults);
    state.people = { directors: 1, authSigners: 0, shareHolders: 0 };
    state.files = {};
    state.checks = {};
    state.emailVerified = false;
    v2Ensure();
    Object.assign(state.people, structuredClone(people));
    Object.assign(state.values, structuredClone(values));
    v2Model().legacy = false;
    v2SyncDerived();
    return mtSnapshot();
  } finally {
    Object.assign(state, saved);
  }
}
function mtUpgradeSnapshot(snapshot) {
  if (snapshot.values?.__v2?.version === 2) return snapshot;
  const saved = {
    values: state.values,
    people: state.people,
    files: state.files,
    checks: state.checks,
    emailVerified: state.emailVerified,
  };
  try {
    state.values = structuredClone(snapshot.values || {});
    state.people = structuredClone(
      snapshot.people || { directors: 1, authSigners: 0, shareHolders: 0 },
    );
    state.files = structuredClone(snapshot.files || {});
    state.checks = structuredClone(snapshot.checks || {});
    state.emailVerified = !!snapshot.emailVerified;
    v2Ensure();
    v2SyncDerived();
    return {
      ...snapshot,
      values: structuredClone(state.values),
      people: structuredClone(state.people),
    };
  } finally {
    Object.assign(state, saved);
  }
}
function mtTargets() {
  if (!mtAllowed()) return [];
  if (MT_EXTERNAL)
    return state.records
      .filter((r) => r.email === state.email && r.status === "草稿")
      .map((r) => ({
        key: "record:" + r.id,
        id: r.id,
        kind: "record",
        record: r,
        snapshot: r,
        name:
          r.values.merchantName ||
          r.values.companyZh ||
          r.values.merchantEnglishName ||
          "未命名商戶",
      }));
  const drafts = scopedDrafts().map((d) => ({
    key: "draft:" + d.id,
    id: d.id,
    kind: "draft",
    record: d,
    snapshot: mtUpgradeSnapshot(d),
    name: d.values.merchantName || d.values.merchantEnglishName || "未命名商戶",
  }));
  const rowTargets = can(2)
    ? scopedRows()
        .filter((r) => r.status === "Draft")
        .map((r) => ({
          key: "row:" + rowKey(r),
          id: rowKey(r),
          kind: "row",
          record: r,
          snapshot:
            r.application ||
            mtBlank({
              merchantName: r["客戶中文名稱"],
              merchantEnglishName: r["客戶英文名稱"],
              registerCertNo: r.BR,
              mcc: r["MCC 行業代碼"]?.split(/[、,;]/)[0] || "",
              contactName: r["客戶聯繫人"],
              contactPhone: r["聯絡人電話"],
              contactEmail: r["聯絡人電郵"],
            }),
          name: r["客戶中文名稱"],
        }))
    : [];
  return [...drafts, ...rowTargets];
}
function mtCompanies() {
  const own = mtTargets();
  if (MT_EXTERNAL)
    return [
      ...own,
      ...state.records
        .filter((r) => r.email === state.email && r.status !== "草稿")
        .map((r) => ({
          id: r.id,
          name: r.values.merchantName || r.values.companyZh,
          snapshot: r,
        })),
    ];
  return [
    ...own,
    ...scopedRows()
      .filter((r) => r.status !== "Draft")
      .map((r) => ({
        id: rowKey(r),
        name: r["客戶中文名稱"],
        snapshot: r.application || { values: {} },
      })),
  ];
}
function mtCustomerStore() {
  try {
    const store = JSON.parse(localStorage.getItem(MT_CUSTOMERS_KEY) || "{}");
    return store && typeof store === "object" && !Array.isArray(store)
      ? store
      : {};
  } catch {
    return {};
  }
}
function mtParentMerchantName(relation) {
  // Read scoped saved records directly: mtCompanies also constructs blank snapshots.
  const id = String(relation.parentId || ""),
    name = (v) => v?.merchantName || v?.merchantEnglishName || "";
  if (MT_EXTERNAL) {
    const parent = state.records.find(
      (r) => r.email === state.email && String(r.id) === id,
    );
    return name(parent?.values);
  }
  const draft = scopedDrafts().find((d) => String(d.id) === id);
  if (draft) return name(draft.values);
  const row = scopedRows().find((r) => String(rowKey(r)) === id);
  return (
    name(row?.application?.values) ||
    row?.["客戶中文名稱"] ||
    row?.["客戶英文名稱"] ||
    ""
  );
}
function mtSyncRelationship(values = state.values, parentName) {
  const relation = values.__customer;
  if (!relation?.id) {
    if (values.__relationshipLinked) {
      values.groupId = "";
      values.parentMerchant = "";
      delete values.__relationshipLinked;
    }
    return values;
  }
  const stored = mtCustomerStore()[mtOwner()]?.[relation.id];
  if (stored?.name) relation.name = stored.name;
  values.groupId = relation.name || "";
  values.parentMerchant =
    relation.role === "subsidiary"
      ? relation.parentType === "group"
        ? relation.name || ""
        : (parentName ?? mtParentMerchantName(relation))
      : "";
  values.__relationshipLinked = true;
  return values;
}
function mtDefaultParent(relation) {
  if (relation.role !== "subsidiary") {
    relation.parentId = "";
    delete relation.parentType;
  } else if (relation.id && relation.name && !relation.parentId) {
    relation.parentId = relation.id;
    relation.parentType = "group";
  }
  return relation;
}
function mtOpenCreateCustomer() {
  if (!mtAllowed()) return;
  const select = $("#mt-customer");
  if (select) select.value = state.values.__customer?.id || "";
  mtCreatingCustomerOpen = true;
  mtDialog(
    "新建客戶／集團",
    `<p class="hint">建立共用的客戶／集團後，再於主畫面填寫本次申請的公司名稱。</p><div class="field"><label for="mt-new-customer-name">客戶／集團名稱 <span class="required">*</span></label><input id="mt-new-customer-name" maxlength="100" autocomplete="off" placeholder="例如：ABC 集團"><small class="hint">建立後會自動選取，可供同一客戶的其他公司使用。</small></div>`,
    btn("取消", "mt-close") +
      btn("建立並選取", "mt-customer-create", "primary"),
  );
  $("#modal").classList.add("mt-customer-dialog");
  $("#mt-new-customer-name").focus();
}
function mtCreateCustomer() {
  if (!mtAllowed() || !mtCreatingCustomerOpen) return;
  try {
    const name = $("#mt-new-customer-name").value.trim();
    if (!name || name.length > 100)
      throw Error("請輸入 1–100 字的客戶／集團名稱");
    if (
      mtCustomers().some(
        (c) => c.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    )
      throw Error("已有同名客戶／集團，請返回主畫面直接選取");
    if (mtFailureActive())
      throw Error("模擬儲存失敗，請關閉失敗模擬後重試；目前資料保持原值。");
    const customer = { id: "CUS-" + crypto.randomUUID(), name },
      store = mtCustomerStore();
    store[mtOwner()] = { ...(store[mtOwner()] || {}), [customer.id]: customer };
    localStorage.setItem(MT_CUSTOMERS_KEY, JSON.stringify(store));
    state.values.__customer = mtDefaultParent({
      ...customer,
      role: state.values.__customer?.role || "independent",
      parentId: "",
    });
    delete state.errors._customer;
    mtCreatingCustomerOpen = false;
    mtClose();
    render();
    $("#field-merchantName")?.focus({ preventScroll: true });
    toast("已建立並選取「" + name + "」");
  } catch (e) {
    mtError(e.message);
    $("#mt-new-customer-name")?.focus();
  }
}
function mtCustomers() {
  const map = new Map();
  for (const c of mtCompanies()) {
    const relation = c.snapshot.values?.__customer;
    if (relation?.id)
      map.set(relation.id, {
        ...relation,
        name: relation.name || "待命名客戶／集團（" + c.name + "）",
      });
  }
  for (const c of Object.values(mtCustomerStore()[mtOwner()] || {}))
    if (c.id && c.name) map.set(c.id, c);
  const current = state.values.__customer;
  if (current?.id && current.name) map.set(current.id, current);
  return [...map.values()];
}
function mtManageCustomers() {
  if (!mtAllowed()) return;
  const groups = mtCustomers();
  mtDialog(
    "管理客戶／集團",
    `<p class="hint">可修改名稱或刪除分組；各公司的資料會保留。</p><div class="mt-customer-list">${
      groups
        .map((c) => {
          const count = mtCompanies().filter(
            (x) => x.snapshot.values?.__customer?.id === c.id,
          ).length;
          return `<article data-mt-group-row="${esc(c.id)}"><div class="field"><label>客戶／集團名稱 <small>· ${count} 家公司</small><input aria-label="${esc(c.name)} 新名稱" data-mt-group-name maxlength="100" value="${esc(c.name)}"></label></div><div class="mt-template-actions">${btn("儲存名稱", "mt-group-rename", "primary", `data-id="${esc(c.id)}"`)}${btn("刪除分組", "mt-group-delete", "danger", `data-id="${esc(c.id)}"`)}</div></article>`;
        })
        .join("") ||
      "<p>尚未建立客戶／集團。請在表單選擇「新建客戶／集團」，再於視窗中建立。</p>"
    }</div>`,
    btn("完成", "mt-close"),
  );
}
let mtGroupDelete = null;
function mtDeleteCustomer(id, selected = "") {
  const group = mtCustomers().find((c) => c.id === id);
  if (!group) return mtManageCustomers();
  const others = mtCustomers().filter((c) => c.id !== id),
    companies = mtCompanies().filter(
      (c) => c.snapshot.values?.__customer?.id === id,
    );
  mtGroupDelete = { id, targetId: selected, preview: false };
  mtDialog(
    "移轉公司並刪除客戶／集團",
    `<p>即將刪除 <strong>${esc(group.name)}</strong>，目前關聯 ${companies.length} 家公司。</p><div class="field"><label for="mt-group-replacement">選擇替代的客戶／集團</label><select id="mt-group-replacement"><option value="">請選擇處理方式</option>${others.map((c) => `<option value="${esc(c.id)}" ${c.id === selected ? "selected" : ""}>移轉至 ${esc(c.name)}</option>`).join("")}<option value="__ungroup" ${selected === "__ungroup" ? "selected" : ""}>不指定替代集團，解除分組</option></select></div><p class="hint">移轉時保留公司資料與原母／子公司關係；解除分組則改為獨立公司。下一步可先確認影響範圍。</p>`,
    btn("取消", "mt-customer-manage") +
      btn("預覽移轉與刪除", "mt-group-delete-preview", "primary"),
  );
}
function mtDeleteCustomerPreview() {
  if (!mtGroupDelete) return;
  const targetId = $("#mt-group-replacement")?.value,
    group = mtCustomers().find((c) => c.id === mtGroupDelete.id),
    target = mtCustomers().find((c) => c.id === targetId);
  if (!targetId || (targetId !== "__ungroup" && !target))
    return mtError("請選擇替代的客戶／集團，或明確選擇解除分組");
  const companies = mtCompanies().filter(
    (c) => c.snapshot.values?.__customer?.id === mtGroupDelete.id,
  );
  mtGroupDelete = {
    ...mtGroupDelete,
    targetId,
    preview: true,
    fingerprint: JSON.stringify(
      companies.map((c) => [c.id, c.snapshot.values.__customer]),
    ),
  };
  mtDialog(
    "確認移轉與刪除",
    `<div class="notice warn">刪除「${esc(group.name)}」後，${companies.length} 家公司將${target ? "移轉至「" + esc(target.name) + "」" : "解除分組並改為獨立公司"}。公司及申請資料保留。</div><div class="mt-customer-move-preview">${companies.map((c) => `<div><strong>${esc(c.name)}</strong><span>${esc(group.name)} → ${target ? esc(target.name) : "未分組"} · ${target ? mtRoleName(c.snapshot.values.__customer.role) : "獨立公司"}</span></div>`).join("") || "<p>沒有已儲存的公司關聯；目前表單的分組也會同步更新。</p>"}</div>`,
    btn("返回選擇", "mt-group-delete-back") +
      btn("確認移轉並刪除", "mt-group-delete-confirm", "danger"),
  );
}
function mtUpdateCustomerReferences(id, relation) {
  if (mtFailureActive())
    throw Error(
      "模擬儲存失敗，所有公司與客戶分組保持原值。請關閉失敗模擬後重試。",
    );
  const patch = (record) =>
    record.values?.__customer?.id === id
      ? {
          ...record,
          values: mtSyncRelationship({
            ...record.values,
            __relationshipLinked: true,
            __customer: relation(record.values.__customer),
          }),
        }
      : record;
  if (MT_EXTERNAL) {
    const next = state.records.map((r) =>
      r.email === state.email ? patch(r) : r,
    );
    localStorage.setItem(KEY, JSON.stringify(next));
    state.records = next;
    return;
  }
  const beforeDrafts = state.drafts,
    beforeRows = [...rows],
    beforeAudit = BO.audit,
    draftIds = new Set(scopedDrafts().map((d) => d.id)),
    rowIds = new Set(scopedRows().map(rowKey));
  try {
    state.drafts = state.drafts.map((d) => (draftIds.has(d.id) ? patch(d) : d));
    rows.splice(
      0,
      rows.length,
      ...rows.map((row) => {
        if (!rowIds.has(rowKey(row))) return row;
        const app = row.application ? patch(row.application) : row.application;
        return {
          ...row,
          application: app,
          ...(row.application?.values?.__customer?.id === id
            ? { 所屬集團: app.values.groupId || "" }
            : {}),
          customer:
            row.customer?.id === id ? relation(row.customer) : row.customer,
        };
      }),
    );
    BO.audit = [
      { time: mtNow(), user: BO.user.name, message: "更新客戶／集團分組關聯" },
      ...BO.audit,
    ];
    if (!persistDemo()) throw Error("瀏覽器儲存失敗，所有公司分組仍保留原值");
  } catch (e) {
    state.drafts = beforeDrafts;
    rows.splice(0, rows.length, ...beforeRows);
    BO.audit = beforeAudit;
    throw e;
  }
}
function mtChangeCustomer(id, name, remove = false, targetId = "") {
  try {
    if (!mtAllowed()) return;
    const store = mtCustomerStore(),
      before = localStorage.getItem(MT_CUSTOMERS_KEY),
      target =
        remove && targetId !== "__ungroup"
          ? mtCustomers().find((c) => c.id === targetId)
          : null;
    if (
      remove &&
      (!mtGroupDelete?.preview ||
        mtGroupDelete.id !== id ||
        (targetId !== "__ungroup" && (!target || target.id === id)))
    )
      throw Error("請先預覽並確認有效的替代集團");
    if (remove) {
      const current = mtCompanies().filter(
        (c) => c.snapshot.values?.__customer?.id === id,
      );
      if (
        JSON.stringify(
          current.map((c) => [c.id, c.snapshot.values.__customer]),
        ) !== mtGroupDelete.fingerprint
      )
        throw Error("公司關聯已變動，請返回重新預覽");
    }
    if (!remove && (!name.trim() || name.trim().length > 100))
      throw Error("請輸入 1–100 字的客戶／集團名稱");
    const relation = (c) =>
      remove
        ? target
          ? {
              ...c,
              id: target.id,
              name: target.name,
              ...(c.parentType === "group" ? { parentId: target.id } : {}),
            }
          : { id: "", name: "", role: "independent", parentId: "" }
        : { ...c, name: name.trim() };
    store[mtOwner()] = { ...(store[mtOwner()] || {}) };
    if (remove) delete store[mtOwner()][id];
    else store[mtOwner()][id] = { id, name: name.trim() };
    localStorage.setItem(MT_CUSTOMERS_KEY, JSON.stringify(store));
    try {
      mtUpdateCustomerReferences(id, relation);
    } catch (e) {
      if (before === null) localStorage.removeItem(MT_CUSTOMERS_KEY);
      else localStorage.setItem(MT_CUSTOMERS_KEY, before);
      throw e;
    }
    if (state.values.__customer?.id === id)
      state.values.__customer = relation(state.values.__customer);
    mtGroupDelete = null;
    render();
    mtManageCustomers();
    toast(
      remove ? "已完成移轉並刪除分組；公司資料保留" : "已更新客戶／集團名稱",
    );
  } catch (e) {
    mtError(e.message);
  }
}
function mtRelationship(setup = false) {
  const relation = state.values.__customer || {},
    current = MT_EXTERNAL ? state.id : state.draftId || state.editing;
  const parents = mtCompanies().filter((c) => {
    const r = c.snapshot.values?.__customer;
    return c.id !== current && r?.role === "parent" && r.id === relation.id;
  });
  const company = setup
    ? `<div class="field"><label for="field-merchantName">本次公司名稱（可稍後填寫）<span class="en">Company Name</span></label><input id="field-merchantName" data-field="merchantName" data-v2-field="merchantName" maxlength="100" value="${esc(state.values.merchantName || "")}" placeholder="可稍後由 BR 辨識帶入"><small class="hint">僅設定本次申請；不會修改集團名稱。</small></div>`
    : v2Field({
        ...v2ById.merchantName,
        label: "目前公司名稱（中文）  Company Name",
        placeholder: "請輸入本次申請的公司名稱",
        hint: "本次商戶申請使用的公司名稱，上限 100 bytes。",
      });
  return v2Card(
    "客戶及公司關係",
    "先選擇或新建客戶／集團，再填寫本次申請的公司名稱。",
    `<div class="grid mt-relationship"><div class="field"><label for="mt-customer">選取客戶／集團<span class="en">Customer / Group</span></label><select id="mt-customer" data-mt-relation="customer"><option value="">尚未分組</option>${mtCustomers()
      .map(
        (c) =>
          `<option value="${esc(c.id)}" ${c.id === relation.id ? "selected" : ""}>${esc(c.name)}</option>`,
      )
      .join(
        "",
      )}<option value="__new">＋ 新建客戶／集團</option></select><div class="mt-customer-tools"><small class="hint">選擇「新建客戶／集團」可另開視窗建立。</small>${btn("管理客戶／集團", "mt-customer-manage")}</div></div>${company}<div class="field"><label for="mt-company-role">公司關係<span class="en">Company Relationship</span></label><select id="mt-company-role" data-mt-relation="role">${["independent", "parent", "subsidiary"].map((r) => `<option value="${r}" ${r === (relation.role || "independent") ? "selected" : ""}>${mtRoleName(r)}</option>`).join("")}</select></div>${relation.role === "subsidiary" ? `<div class="field"><label for="mt-parent-company">所屬母公司<span class="en">Parent Company</span></label><select id="mt-parent-company" data-mt-relation="parentId"><option value="">請選擇所屬母公司</option>${relation.id && relation.name ? `<option value="group:${esc(relation.id)}" ${relation.parentType === "group" ? "selected" : ""}>${esc(relation.name)}（集團主體）</option>` : ""}${parents.map((c) => `<option value="${esc(c.id)}" ${relation.parentType !== "group" && c.id === relation.parentId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select><small class="hint">${relation.id ? "可歸屬目前集團，或選擇同一集團已建立的母公司。" : "請先選擇或新建客戶／集團。"}</small></div>` : ""}</div>${state.errors._customer ? `<p class="error" role="alert">${esc(state.errors._customer)}</p>` : ""}`,
  );
}
const mtOriginalSections = v2FormSections;
v2FormSections = function (index) {
  if (index !== 0) return mtOriginalSections(index);
  const relationship = mtRelationship();
  try {
    mtCompanyNameInRelationship = true;
    return relationship + mtOriginalSections(index);
  } finally {
    mtCompanyNameInRelationship = false;
  }
};
const mtOriginalValidate = validateStep;
validateStep = function (step) {
  const errors = mtOriginalValidate(step);
  if (step === 3) {
    const list = mtMccList();
    if (!list.length || list.some((c) => !/^\d{4}$/.test(c)))
      errors.mcc = "請選擇至少一個有效的 4 位 MCC";
    if (list.length > 50) errors.mcc = "每家公司最多可選 50 個 MCC";
  }
  if (step === 2) {
    const relation = state.values.__customer;
    if (relation?.id && !relation.name?.trim())
      errors._customer = "請在管理客戶／集團中補上名稱";
    if (relation?.role === "subsidiary") {
      const p = mtCompanies().find((c) => c.id === relation.parentId),
        r = p?.snapshot.values?.__customer;
      const own = MT_EXTERNAL ? state.id : state.draftId || state.editing,
        valid =
          relation.parentType === "group"
            ? relation.parentId === relation.id &&
              mtCustomers().some((c) => c.id === relation.id && c.name)
            : p && p.id !== own && r?.role === "parent" && r.id === relation.id;
      if (!relation.name || !valid)
        errors._customer = "子公司須選擇所屬集團或同一集團內的母公司";
    }
  }
  return errors;
};
const mtOriginalReview = v2Review;
v2Review = function () {
  const relation = state.values.__customer;
  return (
    (relation?.id
      ? v2Card(
          "客戶及公司關係",
          "",
          `<div class="mt-relation-summary"><strong>${esc(relation.name)}</strong><span>${mtRoleName(relation.role)}</span>${relation.parentId ? `<span>母公司：${esc(relation.parentType === "group" ? relation.name + "（集團主體）" : mtCompanies().find((c) => c.id === relation.parentId)?.name || relation.parentId)}</span>` : ""}</div>`,
        )
      : "") +
    v2Card(
      "MCC 複選資料",
      "",
      `<p>主要 MCC：<b>${esc(v2Raw("mcc") || "尚未選擇")}</b></p><p>全部代碼：${esc(mtMccList().join("、") || "尚未選擇")}</p>`,
    ) +
    mtOriginalReview()
  );
};
function mtToolActions(compact = false) {
  return `<div class="mt-tool-actions" aria-label="模板與批量設定">${!compact ? btn("複製已有商戶", "ns-copy-open") : ""}${btn("選取模板", "mt-library")}${!compact ? btn("儲存為模板", "mt-save-open") : ""}${btn("匯入資料", "mt-import-open")}${btn("批量套用參數模板", "mt-batch-open", "primary")}</div>`;
}
function mtToolbar() {
  return `<section class="mt-quick-tools" aria-label="快速填寫及參數模板"><div><strong>快速填寫</strong><small>帶入商戶資料、MCC、結算參數及產品費率</small></div>${mtToolActions()}</section>`;
}
const mtOriginalApplication = application;
application = function (step) {
  const html = mtOriginalApplication(step);
  if (!mtAllowed()) return html;
  return html.replace(
    '<div class="v2-version">OATS V2 · 六步申請流程</div>',
    '<div class="v2-version">OATS V2 · 六步申請流程</div>' + mtToolbar(),
  );
};
if (MT_EXTERNAL) {
  const originalApplications = applications;
  applications = function () {
    return originalApplications().replace(
      btn("載入進度示例", "seed"),
      btn("載入進度示例", "seed") + mtToolActions(true),
    );
  };
} else {
  const oldMerchants = merchants;
  merchants = function () {
    const html = oldMerchants();
    return mtAllowed()
      ? html.replace(
          '<span class="grow"></span>',
          '<span class="grow"></span>' + mtToolActions(true),
        )
      : html;
  };
  const oldDrafts = draftView;
  draftView = function () {
    const html = oldDrafts();
    return mtAllowed()
      ? html.replace(
          '<section class="card">',
          '<div class="toolbar mt-list-toolbar">' +
            mtToolActions(true) +
            '</div><section class="card">',
        )
      : html;
  };
}
const mtOriginalReset = v2Reset;
v2Reset = function () {
  mtOriginalReset();
};
function mtDialog(title, body, foot) {
  modal(title, body + '<p id="mt-error" class="error" role="alert"></p>', foot);
  $("#modal").classList.add("mt-dialog");
}
function mtClose() {
  mtStartTemplate = false;
  mtFlow = null;
  $("#modal").classList.remove("mt-dialog", "mt-customer-dialog");
  $("#modal").close();
}
function mtDownload(filename, value, type = "application/json") {
  const blob = new Blob(
      [type === "application/json" ? JSON.stringify(value, null, 2) : value],
      { type },
    ),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function mtScopeInputs(template, selected, batch = false) {
  return `<fieldset class="mt-scopes"><legend>套用範圍</legend>${template.scopes.map((scope) => `<label class="check"><input type="checkbox" data-mt-scope="${scope}" ${selected.includes(scope) ? "checked" : ""} ${batch && scope === "identity" ? "disabled" : ""}><span>${MT.labels[scope]}</span></label>`).join("")}${batch && template.scopes.includes("identity") ? "<small>批量套用保留每家公司的名稱、BR、董事及銀行帳號。</small>" : ""}</fieldset>`;
}
function mtProductCount(products) {
  return Object.entries(products?.rates || {}).filter(
    ([key, r]) => r.on && products.groups?.[key.split("|")[0]],
  ).length;
}
function mtLibrary() {
  if (!mtAllowed()) return;
  const list = mtTemplates();
  mtDialog(
    "商戶資料與參數模板",
    `<p class="hint">可把共用資料、MCC、結算參數及產品費率記錄為一份設定，套用至一家或多家新商戶。</p><div class="mt-library-actions">${btn("將目前設定儲存為模板", "mt-save-open", "primary", mtStartTemplate ? "disabled" : "")}${btn("匯入模板／商戶資料", "mt-import-open")}</div><div class="mt-template-list">${list.map((t) => `<article><div><h3>${esc(t.name)}</h3><p>${t.scopes.map((s) => esc(MT.labels[s])).join(" · ")}</p><small>v${t.version} · ${Object.keys(t.values).length} 個欄位 · ${mtProductCount(t.products)} 項產品</small></div><div class="mt-template-actions">${btn("套用至目前表單", "mt-use", "", `data-id="${esc(t.id)}" ${route().page !== "application" && !mtStartTemplate ? "disabled" : ""}`)}${btn("複選商戶並批量套用", "mt-batch-template", "primary", `data-id="${esc(t.id)}"`)}${btn("更新為目前設定", "mt-save-open", "", `data-id="${esc(t.id)}" ${route().page !== "application" ? "disabled" : ""}`)}${btn("匯出", "mt-export", "", `data-id="${esc(t.id)}"`)}${btn("刪除", "mt-delete", "", `data-id="${esc(t.id)}"`)}</div></article>`).join("") || '<div class="mt-empty"><h3>尚未建立模板</h3><p>填寫一次資料及費率後儲存，或匯入已有的 Excel／CSV 設定。</p></div>'}</div>`,
    btn("關閉", "mt-close"),
  );
}
function mtOpenSave(id = "") {
  if (!mtAllowed()) return;
  const existing = mtTemplates().find((t) => t.id === id);
  mtFlow = {
    kind: "save",
    id: existing?.id || "",
    scopes: existing?.scopes || ["profile", "mcc", "settlement", "products"],
  };
  mtDialog(
    existing ? "更新參數模板" : "儲存為參數模板",
    `<div class="field"><label for="mt-template-name">模板名稱 <span class="required">*</span></label><input id="mt-template-name" maxlength="80" value="${esc(existing?.name || "")}" placeholder="例如：集團餐飲標準設定"></div>${mtScopeInputs({ scopes: Object.keys(MT.labels) }, mtFlow.scopes)}<p class="hint">共用模板可同時包含商戶資料與費率。公司專屬資料可另外選存，只能逐家公司套用；文件附件、驗證及簽署狀態不會納入模板。</p>`,
    btn("取消", "mt-close") +
      btn(existing ? "確認更新模板" : "儲存模板", "mt-save", "primary"),
  );
}
function mtSave() {
  try {
    if (!mtAllowed()) return;
    const list = mtTemplates(),
      previous = list.find((t) => t.id === mtFlow.id),
      snapshot = mtSnapshot();
    const t = MT.cleanTemplate({
      id: previous?.id || crypto.randomUUID(),
      name: $("#mt-template-name").value,
      version: (previous?.version || 0) + 1,
      scopes: mtFlow.scopes,
      values: snapshot.values,
      products: snapshot.values.__v2,
      people: snapshot.people,
      createdAt: previous?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (list.some((x) => x.name === t.name && x.id !== t.id))
      throw Error("已有同名模板，請改名或從清單選擇更新");
    mtSaveTemplates([t, ...list.filter((x) => x.id !== t.id)]);
    mtLibrary();
    toast("已儲存模板，可一次套用至多家新商戶");
  } catch (e) {
    mtError(e.message);
  }
}
function mtOpenApply(batch, id = "") {
  if (!mtAllowed()) return;
  const templates = mtTemplates();
  if (!templates.length) return mtLibrary();
  const t = templates.find((t) => t.id === id) || templates[0];
  const preselected = !MT_EXTERNAL
    ? [...state.selected].map((id) => "row:" + id)
    : [];
  mtFlow = {
    kind: batch ? "batch" : "form",
    templateId: t.id,
    scopes: t.scopes.filter((s) => s !== "identity"),
    mode: "replace",
    selected: new Set(preselected),
    query: "",
    customer: "",
    role: "",
    page: 1,
    size: 20,
    preview: false,
  };
  if (!batch && route().step === 5 && t.scopes.includes("products"))
    mtFlow.scopes = ["products"];
  mtApplyModal();
}
function mtCurrentTarget() {
  if (mtStartTemplate)
    return {
      key: "current",
      id: null,
      name: "新商戶（確認後建立）",
      kind: "current",
      snapshot: mtBlank(),
    };
  return {
    key: "current",
    id: MT_EXTERNAL ? state.id : state.draftId,
    name:
      state.values.merchantName ||
      state.values.merchantEnglishName ||
      "目前新商戶",
    kind: "current",
    snapshot: mtSnapshot(),
  };
}
function mtFilteredTargets() {
  return mtTargets().filter((t) => {
    const c = t.snapshot.values?.__customer || {};
    return (
      (!mtFlow.customer || c.id === mtFlow.customer) &&
      (!mtFlow.role || (c.role || "independent") === mtFlow.role) &&
      (!mtFlow.query ||
        (t.name + " " + t.id + " " + (c.name || ""))
          .toLowerCase()
          .includes(mtFlow.query.toLowerCase()))
    );
  });
}
function mtRepaint(callback) {
  const active = document.activeElement,
    id = active?.id,
    position = active?.selectionStart,
    scroll = $("#modal .modal-body")?.scrollTop || 0;
  callback();
  const next = id ? document.getElementById(id) : null;
  next?.focus({ preventScroll: true });
  if (position != null && typeof next?.setSelectionRange === "function")
    try {
      next.setSelectionRange(position, position);
    } catch {}
  const body = $("#modal .modal-body");
  if (body) body.scrollTop = scroll;
}
function mtPrepare(template, targets) {
  return targets.map((target) => {
    let snapshot = target.snapshot;
    const currentId = MT_EXTERNAL ? state.id : state.draftId || state.editing;
    if (
      target.kind !== "current" &&
      target.id === currentId &&
      route().page === "application"
    )
      snapshot = mtSnapshot();
    const linked = snapshot.values?.__customer?.id,
      source = linked
        ? {
            ...template,
            values: Object.fromEntries(
              Object.entries(template.values).filter(
                ([key]) => !["groupId", "parentMerchant"].includes(key),
              ),
            ),
          }
        : template;
    const plan = MT.apply(
      snapshot,
      source,
      mtFlow.scopes,
      mtFlow.mode,
      mtFlow.kind === "form",
    );
    mtSyncRelationship(plan.snapshot.values);
    return { ...target, ...plan, fingerprint: JSON.stringify(target.snapshot) };
  });
}
function mtChangeValue(value) {
  if (value && typeof value === "object") {
    if (Array.isArray(value)) return value.join("、");
    return (
      Object.entries(value.rates || {})
        .filter(([key, r]) => r.on && value.groups?.[key.split("|")[0]])
        .map(([key, r]) => {
          const [group, index] = key.split("|"),
            definition = v2Groups.find((g) => g.k === group)?.rows[+index];
          return definition
            ? definition.n + "：" + v2FeeSummary(definition, r)
            : key;
        })
        .join("；") || "未選產品"
    );
  }
  return String(value ?? "") || "空白";
}
function mtPreviewHTML(plans) {
  return `<div class="notice">即將套用至 <b>${plans.length}</b> 家商戶 · 共 ${plans.reduce((s, p) => s + p.changes.length, 0)} 項變更。${mtFlow.kind === "batch" ? "每家公司的名稱、BR、董事、銀行帳號與公司關係保留。" : ""}</div><div class="mt-preview-list">${plans.map((p) => `<details ${plans.length === 1 ? "open" : ""}><summary><strong>${esc(p.name)}</strong><span>${p.changes.length} 項變更</span></summary>${p.changes.length ? `<div class="mt-diff-list">${p.changes.map((c) => `<div><strong>${esc(c.key === "_products" ? "產品與費率" : c.key === "mccCodes" ? "MCC 複選清單" : v2Label(c.key))}</strong><del>${esc(mtChangeValue(c.before))}</del><ins>${esc(mtChangeValue(c.after))}</ins></div>`).join("")}</div>` : "<p>設定相同，無需修改。</p>"}</details>`).join("")}</div>`;
}
const mtFailureActive = () => !!(state.fail || state.failSave);
function mtDisableSimulation() {
  state.fail = false;
  state.failSave = false;
  state.failSubmit = false;
  const checkbox = $("#simulate-failure");
  if (checkbox) checkbox.checked = false;
}
function mtFailureNotice() {
  return mtFlow?.kind === "batch" && mtFailureActive()
    ? `<div class="notice warn mt-failure-notice"><span>目前已啟用「模擬儲存／提交失敗」，確認套用將保留所有商戶原值。</span>${btn("關閉失敗模擬", "mt-disable-simulation")}</div>`
    : "";
}
function mtApplyModal() {
  const f = mtFlow,
    t = mtTemplates().find((t) => t.id === f.templateId);
  if (!t) return mtLibrary();
  const available = mtTargets(),
    selected =
      f.kind === "form"
        ? [mtCurrentTarget()]
        : available.filter((a) => f.selected.has(a.key));
  if (f.preview) {
    mtFlow.plans = mtPrepare(t, selected);
    return mtDialog(
      "確認" + (f.kind === "batch" ? "批量" : "") + "套用參數模板",
      `${mtFailureNotice()}<p><strong>${esc(t.name)}</strong> · v${t.version} · ${f.scopes.map((s) => MT.labels[s]).join("、")}</p>${mtPreviewHTML(mtFlow.plans)}<p class="hint">套用後仍需逐家公司核對聯絡資料、費率及提交。</p>`,
      btn("返回選擇", "mt-preview-back") +
        btn(
          "確認套用至 " + selected.length + " 家",
          "mt-apply-confirm",
          "primary",
          selected.length ? "" : "disabled",
        ),
    );
  }
  const filtered = f.kind === "batch" ? mtFilteredTargets() : [],
    pages = Math.max(1, Math.ceil(filtered.length / f.size));
  f.page = Math.min(f.page, pages);
  const shown = filtered.slice((f.page - 1) * f.size, f.page * f.size);
  const table =
    f.kind === "batch"
      ? `<div class="mt-batch-filters"><div class="field"><label for="mt-target-search">搜尋新商戶</label><input id="mt-target-search" placeholder="公司名稱、編號、客戶" value="${esc(f.query)}"></div><div class="field"><label for="mt-target-customer">客戶／集團</label><select id="mt-target-customer"><option value="">全部客戶</option>${mtCustomers()
          .map(
            (c) =>
              `<option value="${esc(c.id)}" ${f.customer === c.id ? "selected" : ""}>${esc(c.name)}</option>`,
          )
          .join(
            "",
          )}</select></div><div class="field"><label for="mt-target-role">公司關係</label><select id="mt-target-role"><option value="">全部關係</option>${["parent", "subsidiary", "independent"].map((r) => `<option value="${r}" ${f.role === r ? "selected" : ""}>${mtRoleName(r)}</option>`).join("")}</select></div></div><div class="mt-select-bar"><label class="check"><input type="checkbox" id="mt-select-filtered" ${filtered.length && filtered.every((x) => f.selected.has(x.key)) ? "checked" : ""} ${!filtered.length ? "disabled" : ""}>全選篩選結果（${filtered.length} 家，包含所有頁面）</label><strong id="mt-selected-count">已選 ${selected.length} 家</strong>${btn("清除選取", "mt-clear-selected")}</div><div class="mt-target-list">${
          shown
            .map((a) => {
              const c = a.snapshot.values?.__customer || {};
              return `<label class="mt-target-row"><input type="checkbox" data-mt-target="${esc(a.key)}" ${f.selected.has(a.key) ? "checked" : ""}><span><strong>${esc(a.name)}</strong><small>${esc(a.id)}</small></span><span>${esc(c.name || "未分組")}<small>${mtRoleName(c.role)}</small></span></label>`;
            })
            .join("") ||
          '<div class="mt-empty">沒有符合條件的新商戶草稿。</div>'
        }</div><div class="mt-pagination"><label>每頁 <select id="mt-page-size">${[20, 50, 100].map((n) => `<option ${f.size === n ? "selected" : ""}>${n}</option>`).join("")}</select> 家</label><span>共 ${filtered.length} 家 · ${f.page}／${pages} 頁</span>${btn("上一頁", "mt-target-page", "", `data-page="${f.page - 1}" ${f.page <= 1 ? "disabled" : ""}`)}${btn("下一頁", "mt-target-page", "", `data-page="${f.page + 1}" ${f.page >= pages ? "disabled" : ""}`)}</div><p class="hint">只列出有權限編輯的新商戶草稿，已提交或已開通商戶不在批量套用範圍。</p>`
      : `<p class="notice">套用對象：${esc(selected[0].name)}</p>`;
  mtDialog(
    f.kind === "batch" ? "批量套用參數模板" : "套用商戶模板",
    `${mtFailureNotice()}<div class="mt-apply-header"><div class="field"><label for="mt-template-select">選取一份設定記錄</label><select id="mt-template-select">${mtTemplates()
      .map(
        (x) =>
          `<option value="${esc(x.id)}" ${t.id === x.id ? "selected" : ""}>${esc(x.name)} · v${x.version}</option>`,
      )
      .join(
        "",
      )}</select></div><div class="field"><label for="mt-apply-mode">處理現有值</label><select id="mt-apply-mode"><option value="replace" ${f.mode === "replace" ? "selected" : ""}>套用模板設定（預覽後取代所選範圍）</option><option value="blank" ${f.mode === "blank" ? "selected" : ""}>只補空白，保留已填資料</option></select></div></div>${mtScopeInputs(t, f.scopes, f.kind === "batch")}${table}`,
    btn("取消", "mt-close") +
      btn(
        "預覽套用至 " + selected.length + " 家",
        "mt-apply-preview",
        "primary",
        selected.length && f.scopes.length ? "" : "disabled",
      ),
  );
}
function mtWriteTargets(plans, message) {
  const time = mtNow();
  if (state.fail || state.failSave)
    throw Error("模擬儲存失敗：所有商戶設定仍保留原值");
  if (MT_EXTERNAL) {
    const before = state.records,
      next = before.map((r) => {
        const plan = plans.find((p) => p.kind === "record" && p.id === r.id);
        if (!plan) return r;
        if (r.email !== state.email || r.status !== "草稿")
          throw Error("商戶權限或狀態已變更，請重新選擇");
        return { ...r, ...plan.snapshot, updated: time };
      });
    localStorage.setItem(KEY, JSON.stringify(next));
    state.records = next;
  } else {
    const beforeDrafts = state.drafts,
      beforeRows = [...rows],
      beforeAudit = BO.audit,
      beforeCount = state.noticeCount;
    const available = new Set(mtTargets().map((t) => t.key));
    if (plans.some((p) => !available.has(p.key)))
      throw Error("商戶權限或狀態已變更，請重新選擇");
    try {
      state.drafts = state.drafts.map((d) => {
        const p = plans.find((p) => p.kind === "draft" && p.id === d.id);
        return p ? { ...d, ...p.snapshot, savedAt: time } : d;
      });
      rows.splice(
        0,
        rows.length,
        ...rows.map((row) => {
          const p = plans.find((p) => p.kind === "row" && p.id === rowKey(row));
          if (!p) return row;
          const v = p.snapshot.values;
          return {
            ...row,
            application: {
              ...p.snapshot,
              id: p.id,
              owner: row.owner,
              step: 1,
              savedAt: time,
            },
            "MCC 行業代碼": mtMccList(v).join("、"),
            行業類型: mtMccList(v)
              .map((c) => V2.catalog.MCCS.find((m) => m.c === c)?.n || c)
              .join("、"),
            客戶聯繫人: v.contactName || row["客戶聯繫人"],
            聯絡人電話: v.contactPhone || row["聯絡人電話"],
            聯絡人電郵: v.contactEmail || row["聯絡人電郵"],
            最後更新: time,
          };
        }),
      );
      BO.audit = [{ time, user: BO.user.name, message }, ...BO.audit];
      state.noticeCount += plans.length;
      if (!persistDemo()) throw Error("瀏覽器儲存空間不足，未套用任何商戶");
    } catch (e) {
      state.drafts = beforeDrafts;
      rows.splice(0, rows.length, ...beforeRows);
      BO.audit = beforeAudit;
      state.noticeCount = beforeCount;
      throw e;
    }
  }
  const id = MT_EXTERNAL ? state.id : state.draftId || state.editing,
    p = plans.find((p) => p.id === id);
  if (p && route().page === "application") {
    Object.assign(state, {
      values: structuredClone(p.snapshot.values),
      people: structuredClone(p.snapshot.people),
      checks: structuredClone(p.snapshot.checks || {}),
      emailVerified: !!p.snapshot.emailVerified,
      errors: {},
    });
    if (MT_EXTERNAL) state.signature = p.snapshot.signature || "";
  }
}
function mtConfirmApply() {
  try {
    if (!mtAllowed() || !mtFlow?.preview) throw Error("請先預覽套用內容");
    const plans = mtFlow.plans || [],
      template = mtTemplates().find((t) => t.id === mtFlow.templateId);
    if (!plans.length || !template) throw Error("模板或商戶清單已變更");
    if (mtFlow.kind === "form") {
      const p = mtPrepare(template, [mtCurrentTarget()])[0];
      Object.assign(state, {
        values: p.snapshot.values,
        people: p.snapshot.people,
        checks: p.snapshot.checks || {},
        emailVerified: !!p.snapshot.emailVerified,
        errors: {},
      });
      if (MT_EXTERNAL) state.signature = p.snapshot.signature || "";
      v2SyncDerived();
      mtClose();
      render();
      toast("已帶入模板，請核對並儲存草稿");
      return;
    }
    const targets = mtTargets();
    for (const plan of plans) {
      const now = targets.find((t) => t.key === plan.key);
      if (!now || JSON.stringify(now.snapshot) !== plan.fingerprint)
        throw Error("商戶資料在預覽後已有變動，請返回重新預覽");
    }
    mtWriteTargets(
      plans,
      "批量套用模板「" + template.name + "」至 " + plans.length + " 家新商戶",
    );
    const count = plans.length;
    mtClose();
    render();
    mtDialog(
      "批量套用完成",
      `<div class="notice">已同時儲存 ${count} 家商戶的設定。</div><p>模板：${esc(template.name)} · v${template.version}</p><p>每家公司可繼續獨立核對、修改及提交。</p>`,
      btn("完成", "mt-close", "primary"),
    );
  } catch (e) {
    mtError(e.message);
    if (mtFailureActive() && mtFlow?.preview && mtFlow.kind === "batch")
      $("#mt-error")?.insertAdjacentHTML(
        "beforeend",
        `<span class="mt-retry-help">已選商戶與預覽仍保留。${btn("關閉失敗模擬並重試", "mt-retry-apply", "primary")}</span>`,
      );
  }
}
function mtOpenImport() {
  if (!mtAllowed()) return;
  mtImport = null;
  mtImportSequence++;
  mtDialog(
    "匯入商戶資料與費率",
    `<p>可匯入同一客戶的母公司與子公司，同時帶入各公司的基本資料、MCC、結算參數、產品及費率。</p><div class="mt-library-actions">${btn("下載 CSV 空白範本", "mt-csv-download")}${btn("下載 Excel 範本（含下拉選單）", "mt-excel-download")}${btn("下載 Excel 填寫範例", "mt-excel-example")}</div>${fileDropControl({ inputId: "mt-import-file", accept: ".xlsx,.csv", title: "拖入 Excel／CSV 商戶資料", hint: "每次最多 100 家公司／50 份模板 · 文件上限 2 MB" })}<p class="hint">建議使用 Excel 範本，內含下拉選單、商戶關係及產品費率工作表。CSV 請使用 UTF-8 格式；多個 MCC 可使用分號分隔。</p><div id="mt-import-result"></div>`,
    btn("取消", "mt-close"),
  );
}
async function mtReadImport(file) {
  const sequence = ++mtImportSequence,
    owner = mtOwner();
  try {
    if (
      !file ||
      file.size > 2 * 1024 * 1024 ||
      !/\.(csv|json)$/i.test(file.name)
    )
      throw Error("請選擇 2 MB 以下的 CSV／JSON");
    const source = await file.text();
    if (
      sequence !== mtImportSequence ||
      owner !== mtOwner() ||
      !$("#mt-import-file")
    )
      return;
    const bundle = MT.bundle(
      /\.csv$/i.test(file.name) ? MT.csvBundle(source) : JSON.parse(source),
      mtTemplates(),
    );
    bundle.templates = bundle.templates.map((t) => ({
      ...t,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    for (const company of bundle.companies) {
      const customer = mtCustomers().find(
        (c) => c.id === company.customerId || c.name === company.customerName,
      );
      if (customer) {
        company.customerId = customer.id;
        company.customerName = customer.name;
      }
    }
    const existing = mtCompanies(),
      brs = new Set(
        existing.map((c) => c.snapshot.values?.registerCertNo).filter(Boolean),
      ),
      seen = new Set();
    const errors = [];
    for (const c of bundle.companies) {
      const br = c.values.registerCertNo;
      if (br && (brs.has(br) || seen.has(br)))
        errors.push(c.key + "：BR 已存在或於文件中重複");
      if (br) seen.add(br);
    }
    mtImport = {
      ...bundle,
      filename: file.name,
      errors,
      selected: new Set(bundle.companies.map((c) => c.key)),
      single: bundle.companies.length === 1 && route().page === "application",
    };
    mtImportResult();
  } catch (e) {
    mtImport = null;
    mtError(
      e instanceof SyntaxError
        ? "JSON 格式不正確，請使用下載的範例格式"
        : e.message,
    );
  }
}
function mtImportResult() {
  const b = mtImport;
  if (!b) return;
  const host = $("#mt-import-result");
  if (!host) return;
  host.innerHTML = `<h3>匯入預覽</h3><p>${b.companies.length} 家公司 · ${b.templates.length} 份模板 · ${esc(b.filename)}</p>${b.errors.length ? `<div class="notice error">${b.errors.map(esc).join("<br>")}</div>` : ""}<div class="mt-import-companies">${b.companies.map((c) => `<article><strong>${esc(c.values.merchantName || c.values.merchantEnglishName)}</strong><span>${esc(c.customerName || "未分組")} · ${mtRoleName(c.role)}${c.parentKey ? " · 母公司 " + esc(c.parentKey) : ""}</span><small>BR：${esc(c.values.registerCertNo || "待填寫")} · MCC：${esc(MT.codes(c.values.mccCodes || c.values.mcc).join("、") || "待填寫")} · ${Object.keys(c.values).length} 個欄位 · ${mtProductCount(c.products)} 項產品</small></article>`).join("")}</div>${b.single ? '<p class="hint">會帶入目前新商戶表單，匯入前可查看所有欄位差異。</p>' : '<p class="hint">確認後一次建立全部公司草稿；公司間的母／子關係會一併建立。</p>'}<div class="mt-library-actions">${btn(b.single ? "預覽帶入目前表單" : "確認匯入並建立 " + b.companies.length + " 家草稿", "mt-import-confirm", "primary", b.errors.length ? "disabled" : "")}</div>`;
}
function mtImportSettings(company) {
  const template = [...(mtImport?.templates || []), ...mtTemplates()].find(
    (t) => t.name === company.templateName,
  );
  const inherited = template
    ? MT.apply(
        { values: {}, people: {} },
        template,
        template.scopes.filter((s) => s !== "identity"),
        "replace",
        false,
      ).snapshot.values
    : {};
  return {
    values: { ...inherited, ...company.values },
    products: company.products || template?.products || null,
  };
}
function mtImportedSnapshot(company, ids) {
  const settings = mtImportSettings(company),
    snapshot = mtBlank(settings.values, company.people);
  if (settings.products)
    for (const k of ["groups", "rates", "combo", "sme"])
      snapshot.values.__v2[k] = structuredClone(settings.products[k]);
  snapshot.values.__customer = {
    id: company.customerId,
    name: company.customerName,
    role: company.role,
    parentId: ids[company.parentKey] || "",
  };
  const parent = mtImport?.companies.find((c) => c.key === company.parentKey);
  mtSyncRelationship(
    snapshot.values,
    parent?.values.merchantName || parent?.values.merchantEnglishName || "",
  );
  snapshot.emailVerified = false;
  return snapshot;
}
function mtCommitImport() {
  try {
    if (!mtAllowed() || !mtImport || mtImport.errors.length)
      throw Error("請先選擇有效的匯入文件");
    const b = mtImport;
    if (b.single && !b.ready) {
      const c = b.companies[0],
        before = mtSnapshot(),
        snap = mtImportedSnapshot(c, {}),
        settings = mtImportSettings(c);
      const imported = MT.cleanTemplate({
        id: "import",
        name: b.filename,
        scopes: Object.keys(MT.labels),
        values: settings.values,
        products: settings.products,
        people: snap.people,
      });
      mtFlow = { kind: "form", scopes: imported.scopes };
      const plan = MT.apply(before, imported, imported.scopes, "replace", true);
      plan.snapshot.values.__customer = snap.values.__customer;
      b.ready = true;
      b.plan = plan;
      $("#mt-import-result").innerHTML =
        mtPreviewHTML([
          {
            ...plan,
            name: c.values.merchantName || c.values.merchantEnglishName,
          },
        ]) + btn("確認帶入目前表單", "mt-import-confirm", "primary");
      return;
    }
    if (state.fail || state.failSave)
      throw Error("模擬儲存失敗，沒有建立或修改商戶");
    const oldTemplates = mtTemplates(),
      incoming = b.templates;
    if (incoming.some((t) => oldTemplates.some((old) => old.name === t.name)))
      throw Error("已有同名模板，請先重新命名，或在模板清單更新設定");
    const merged = [...incoming, ...oldTemplates];
    if (merged.length > 100)
      throw Error("目前最多可保存 100 份模板，請先整理已有模板");
    if (b.single) {
      if (incoming.length) mtSaveTemplates(merged);
      Object.assign(state, {
        values: b.plan.snapshot.values,
        people: b.plan.snapshot.people,
        checks: {},
        emailVerified: false,
        errors: {},
      });
      if (MT_EXTERNAL) state.signature = "";
      v2SyncDerived();
      mtClose();
      render();
      toast("已一次帶入商戶資料、MCC 及產品費率，請核對並儲存");
      return;
    }
    const ids = Object.fromEntries(
        b.companies.map((c) => [c.key, "DRAFT-" + crypto.randomUUID()]),
      ),
      time = mtNow();
    const additions = b.companies.map((c) => {
      const snap = mtImportedSnapshot(c, ids);
      return MT_EXTERNAL
        ? {
            ...snap,
            id: ids[c.key],
            email: state.email,
            status: "草稿",
            schema: 2,
            step: 1,
            created: time,
            updated: time,
            directors: [],
            shops: [],
            methods: [],
            scenes: [],
            sales: [],
            signature: "",
            values: {
              ...snap.values,
              companyZh: snap.values.merchantName,
              companyEn: snap.values.merchantEnglishName,
            },
          }
        : {
            ...snap,
            id: ids[c.key],
            owner: BO.user.id,
            step: 1,
            savedAt: time,
          };
    });
    if (incoming.length) mtSaveTemplates(merged);
    try {
      if (MT_EXTERNAL) {
        const next = [...additions, ...state.records];
        localStorage.setItem(KEY, JSON.stringify(next));
        state.records = next;
      } else {
        const before = state.drafts;
        state.drafts = [...additions, ...before];
        if (!persistDemo()) {
          state.drafts = before;
          throw Error("儲存空間不足，沒有建立任何公司草稿");
        }
      }
    } catch (e) {
      if (incoming.length) mtSaveTemplates(oldTemplates);
      throw e;
    }
    mtClose();
    render();
    mtDialog(
      "資料匯入完成",
      `<div class="notice">已建立 ${additions.length} 家公司草稿，並匯入 ${incoming.length} 份模板。</div><p>母／子公司關係、各自的 MCC、產品與費率均已保留。接下來可複選所有新商戶一次套用同一份參數設定。</p>`,
      btn("查看全部草稿", "mt-open-drafts") +
        btn("批量套用參數模板", "mt-batch-open", "primary"),
    );
  } catch (e) {
    mtError(e.message);
  }
}
function mtJSONExample() {
  return {
    format: "allinpay.merchant-bundle",
    version: 1,
    customer: { id: "CUS-DEMO-GROUP", name: "示例餐飲集團" },
    defaultTemplate: "餐飲共用參數（示例）",
    templates: [
      {
        name: "餐飲共用參數（示例）",
        scopes: ["profile", "mcc", "settlement", "products"],
        values: {
          contactName: "示例聯絡人",
          contactPhone: "+85260000000",
          contactEmail: "demo@example.com",
          mcc: "5812",
          mccCodes: ["5812", "5814"],
          settlePeriod: "T2",
          currency: "HKD",
        },
        products: {
          groups: { POS: true },
          rates: {
            "POS|0": {
              on: true,
              ct: "Regional",
              v: { loc_rate: "1.50", crs_rate: "2.50" },
            },
          },
        },
      },
    ],
    companies: [
      {
        key: "MAIN",
        role: "parent",
        values: {
          merchantName: "示例餐飲母公司",
          merchantEnglishName: "DEMO RESTAURANT HOLDINGS LIMITED",
          registerCertNo: "12345678-000-03-26-7",
          mcc: "5812",
          mccCodes: ["5812", "5814"],
        },
      },
      {
        key: "SUB-A",
        role: "subsidiary",
        parentKey: "MAIN",
        values: {
          merchantName: "示例餐飲子公司甲",
          merchantEnglishName: "DEMO RESTAURANT A LIMITED",
          registerCertNo: "12345679-000-03-26-7",
          mcc: "5812",
        },
      },
      {
        key: "SUB-B",
        role: "subsidiary",
        parentKey: "MAIN",
        values: {
          merchantName: "示例餐飲子公司乙",
          merchantEnglishName: "DEMO RESTAURANT B LIMITED",
          registerCertNo: "12345680-000-03-26-7",
          mcc: "5814",
        },
      },
    ],
  };
}
Object.assign(actions, {
  "mt-close": mtClose,
  "mt-library": mtLibrary,
  "mt-save-open": (el) => mtOpenSave(el?.dataset?.id || ""),
  "mt-save": mtSave,
  "mt-customer-manage": mtManageCustomers,
  "mt-group-rename": (el) =>
    mtChangeCustomer(
      el.dataset.id,
      el.closest("[data-mt-group-row]").querySelector("[data-mt-group-name]")
        .value,
    ),
  "mt-customer-create": mtCreateCustomer,
  "mt-group-delete": (el) => mtDeleteCustomer(el.dataset.id),
  "mt-group-delete-preview": mtDeleteCustomerPreview,
  "mt-group-delete-back": () =>
    mtDeleteCustomer(mtGroupDelete.id, mtGroupDelete.targetId),
  "mt-group-delete-confirm": () =>
    mtGroupDelete &&
    mtChangeCustomer(mtGroupDelete.id, "", true, mtGroupDelete.targetId),
  "mt-use": (el) => mtOpenApply(false, el.dataset.id),
  "mt-batch-open": () => mtOpenApply(true),
  "mt-batch-template": (el) => mtOpenApply(true, el.dataset.id),
  "mt-export": (el) => {
    const t = mtTemplates().find((t) => t.id === el.dataset.id);
    if (t)
      mtDownload("merchant-template.json", {
        format: "allinpay.merchant-bundle",
        version: 1,
        templates: [t],
        companies: [],
      });
  },
  "mt-delete": (el) => {
    const t = mtTemplates().find((t) => t.id === el.dataset.id);
    if (t)
      mtDialog(
        "刪除模板",
        `<p>刪除「${esc(t.name)}」？已套用至商戶的設定仍會保留。</p>`,
        btn("取消", "mt-library") +
          btn(
            "確認刪除",
            "mt-delete-confirm",
            "danger",
            `data-id="${esc(t.id)}"`,
          ),
      );
  },
  "mt-delete-confirm": (el) => {
    try {
      mtSaveTemplates(mtTemplates().filter((t) => t.id !== el.dataset.id));
      mtLibrary();
    } catch (e) {
      mtError(e.message);
    }
  },
  "mt-apply-preview": () => {
    if (!mtFlow?.scopes.length) return mtError("請至少選擇一個套用範圍");
    mtFlow.preview = true;
    mtApplyModal();
  },
  "mt-preview-back": () => {
    mtFlow.preview = false;
    mtApplyModal();
  },
  "mt-apply-confirm": mtConfirmApply,
  "mt-target-page": (el) => {
    mtFlow.page = +el.dataset.page;
    mtApplyModal();
  },
  "mt-clear-selected": () => {
    mtFlow.selected.clear();
    mtApplyModal();
  },
  "mt-disable-simulation": () => {
    mtDisableSimulation();
    mtApplyModal();
  },
  "mt-retry-apply": () => {
    mtDisableSimulation();
    mtConfirmApply();
  },
  "mt-mcc-done": mtCloseMcc,
  "mt-mcc-primary": (el) => {
    state.values.mcc = el.dataset.code;
    state.values.mccCodes = [
      el.dataset.code,
      ...mtMccList().filter((c) => c !== el.dataset.code),
    ];
    mtRenderMcc();
  },
  "mt-mcc-remove": (el) => {
    const list = mtMccList().filter((c) => c !== el.dataset.code);
    state.values.mccCodes = list;
    if (v2Raw("mcc") === el.dataset.code) state.values.mcc = list[0] || "";
    mtRenderMcc();
  },
  "mt-import-open": mtOpenImport,
  "mt-import-confirm": mtCommitImport,
  "mt-csv-download": () =>
    mtDownload(
      "merchant-import-template.csv",
      MT.csv([MT.csvHeaders]),
      "text/csv;charset=utf-8",
    ),
  "mt-json-download": () =>
    mtDownload("merchant-import-example.json", mtJSONExample()),
  "mt-open-drafts": () => {
    mtClose();
    go(MT_EXTERNAL ? "applications" : "drafts");
  },
});
document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.id === "mt-mcc-search")
    $(".mt-mcc-options").innerHTML = mtMccOptions(t.value);
  if (t.id === "mt-target-search" && mtFlow) {
    mtFlow.query = t.value;
    mtFlow.page = 1;
    mtRepaint(mtApplyModal);
  }
});
document.addEventListener(
  "change",
  (e) => {
    const t = e.target;
    if (!t.dataset.mtMcc) return;
    e.stopImmediatePropagation();
    const list = mtMccList(),
      code = t.dataset.mtMcc;
    if (t.checked && list.length >= 50) {
      t.checked = false;
      return toast("每家公司最多可選 50 個 MCC");
    }
    state.values.mccCodes = t.checked
      ? [...new Set([...list, code])]
      : list.filter((c) => c !== code);
    if (!state.values.mccCodes.includes(v2Raw("mcc")))
      state.values.mcc = state.values.mccCodes[0] || "";
    delete state.errors.mcc;
    mtRenderMcc();
  },
  true,
);
document.addEventListener("click", (e) => {
  const picker = $(".mt-mcc-picker");
  if (picker?.open && !e.target.closest(".mt-mcc-field")) picker.open = false;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && e.target.closest(".mt-mcc-picker")) {
    e.preventDefault();
    mtCloseMcc();
  }
  if (e.key === "Enter" && e.target.id === "mt-new-customer-name") {
    e.preventDefault();
    mtCreateCustomer();
  }
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.field === "mcc") {
    mtSyncMcc();
    v2SyncDerived();
    mtRefreshForm();
  }
  if (t.dataset.mtRelation) {
    if (t.dataset.mtRelation === "customer" && t.value === "__new")
      return mtOpenCreateCustomer();
    const relation = (state.values.__customer ??= { role: "independent" });
    if (t.dataset.mtRelation === "customer") {
      const existing = mtCustomers().find((c) => c.id === t.value);
      state.values.__customer = mtDefaultParent({
        id: existing?.id || "",
        name: existing?.name || "",
        role: t.value ? relation.role || "independent" : "independent",
        parentId: "",
      });
    } else if (t.dataset.mtRelation === "parentId") {
      const group = t.value === "group:" + relation.id;
      relation.parentId = group ? relation.id : t.value;
      if (group) relation.parentType = "group";
      else delete relation.parentType;
    } else {
      relation[t.dataset.mtRelation] = t.value;
      mtDefaultParent(relation);
    }
    delete state.errors._customer;
    mtRefreshForm();
  }
  if (t.dataset.mtScope && mtFlow) {
    mtFlow.scopes = t.checked
      ? [...new Set([...mtFlow.scopes, t.dataset.mtScope])]
      : mtFlow.scopes.filter((s) => s !== t.dataset.mtScope);
    if (mtFlow.kind !== "save") mtRepaint(mtApplyModal);
  }
  if (t.id === "mt-template-select" && mtFlow) {
    const template = mtTemplates().find((x) => x.id === t.value);
    mtFlow.templateId = template.id;
    mtFlow.scopes = template.scopes.filter((s) => s !== "identity");
    mtApplyModal();
  }
  if (t.id === "mt-apply-mode" && mtFlow) mtFlow.mode = t.value;
  if (t.dataset.mtTarget && mtFlow) {
    t.checked
      ? mtFlow.selected.add(t.dataset.mtTarget)
      : mtFlow.selected.delete(t.dataset.mtTarget);
    mtRepaint(mtApplyModal);
  }
  if (t.id === "mt-select-filtered" && mtFlow) {
    mtFilteredTargets().forEach((x) =>
      t.checked ? mtFlow.selected.add(x.key) : mtFlow.selected.delete(x.key),
    );
    mtRepaint(mtApplyModal);
  }
  if (
    t.id === "mt-target-customer" ||
    t.id === "mt-target-role" ||
    t.id === "mt-page-size"
  ) {
    if (!mtFlow) return;
    if (t.id === "mt-target-customer") mtFlow.customer = t.value;
    if (t.id === "mt-target-role") mtFlow.role = t.value;
    if (t.id === "mt-page-size") mtFlow.size = +t.value;
    mtFlow.page = 1;
    mtRepaint(mtApplyModal);
  }
  if (t.id === "mt-import-file") void mtReadImport(t.files?.[0]);
});
if (!MT_EXTERNAL) {
  const originalConfirm = actions["confirm-submit"];
  actions["confirm-submit"] = () => {
    const before = new Set(rows);
    originalConfirm();
    if ($("#modal-title")?.textContent !== "申請提交成功") return;
    const row =
      rows.find((r) => !before.has(r)) ||
      rows.find((r) => rowKey(r) === state.editing);
    if (row) {
      row["MCC 行業代碼"] = mtMccList().join("、");
      row["行業類型"] = state.values.mccName;
      row.customer = structuredClone(state.values.__customer || null);
      persistDemo();
    }
  };
}
const mtOriginalClose = actions.close;
actions.close = () => {
  mtImportSequence++;
  $("#modal").classList.remove("mt-dialog", "mt-customer-dialog");
  mtOriginalClose();
};
$("#modal").addEventListener("close", () => {
  if (!$("#modal").open) {
    mtStartTemplate = false;
    $("#modal").classList.remove("mt-dialog", "mt-customer-dialog");
    if (mtCreatingCustomerOpen) {
      mtCreatingCustomerOpen = false;
      $("#mt-customer")?.focus({ preventScroll: true });
    }
  }
});
Object.assign(window.AllinPayDemo, {
  templateFeatures: true,
  getTemplateState: () => ({
    mccCodes: mtMccList(),
    primaryMcc: v2Raw("mcc"),
    customer: structuredClone(state.values.__customer || null),
    templates: mtTemplates().map((t) => ({
      id: t.id,
      name: t.name,
      version: t.version,
      scopes: t.scopes,
    })),
    targets: mtTargets().map((t) => ({
      key: t.key,
      id: t.id,
      name: t.name,
      customer: structuredClone(t.snapshot.values?.__customer || null),
      mccCodes: mtMccList(t.snapshot.values),
      primaryMcc: t.snapshot.values?.mcc || "",
      template: t.snapshot.values?.__templateApplied || null,
    })),
  }),
});


// SOURCE MODULE: onboarding-progress-risk.js
// Explainable Demo rules. Weights belong to this prototype, not a provider model.
const onboardingRiskVersion = "DEMO-RISK-20261029-v2";
const onboardingRiskRules = [
  [
    "BUS-01",
    "商戶背景",
    "經營年限少於 1 年",
    15,
    () => v2Raw("licencePeriod") === "01",
  ],
  [
    "BUS-02",
    "商戶背景",
    "經營年限 1–3 年",
    8,
    () => v2Raw("licencePeriod") === "02",
  ],
  [
    "BUS-03",
    "商戶背景",
    "法律地位為個人",
    10,
    () => v2Raw("legalStatus") === "PERSON",
  ],
  [
    "BUS-04",
    "商戶背景",
    "註冊資本少於 10 萬",
    6,
    () => v2Raw("registerCapital") === "01",
  ],
  [
    "BUS-05",
    "商戶背景",
    "註冊證書距到期少於 90 天",
    8,
    () =>
      !!v2Raw("registerCertPeriod") &&
      v2DateDays(v2Raw("registerCertPeriod")) < 90,
  ],
  [
    "MCC-01",
    "行業風險",
    "所選 MCC 含高風險",
    25,
    () =>
      mtMccList().some(
        (c) => V2.catalog.MCCS.find((m) => m.c === c)?.lv === "high",
      ),
  ],
  [
    "MCC-02",
    "行業風險",
    "所選 MCC 含中風險",
    12,
    () =>
      !onboardingRiskRules[5][4]() &&
      mtMccList().some(
        (c) => V2.catalog.MCCS.find((m) => m.c === c)?.lv === "mid",
      ),
  ],
  ["PAY-01", "產品與交易", "開通 CNP／PayByLink 卡產品", 15, () => v2Cnp()],
  [
    "PAY-02",
    "產品與交易",
    "卡產品採直連",
    10,
    () => v2Cnp() && v2Raw("connectType") === "0",
  ],
  [
    "PAY-03",
    "產品與交易",
    "月銷售超過 500,000",
    10,
    () => v2Num("avgMonthAmount") > 500000,
  ],
  [
    "PAY-04",
    "產品與交易",
    "單筆最高超過 20,000",
    8,
    () => v2Num("maxAmount") > 20000,
  ],
  [
    "PAY-05",
    "產品與交易",
    "平均單筆偏離所選行業常態超過 3 倍",
    12,
    () =>
      mtMccList().some((c) => {
        const m = V2.catalog.MCCS.find((m) => m.c === c);
        return m && m.avg > 0 && v2Num("avgPerAmount") > m.avg * 3;
      }),
  ],
  [
    "DOC-01",
    "資料與實體核對",
    "OCR 與人工修改差異不少於 2 項",
    10,
    () =>
      v2Model().signals.ocr ||
      v2Model().ocr.filter(
        (o) => o.applied && v2Raw(o.key) !== String(o.applied),
      ).length >= 2,
  ],
  [
    "DOC-02",
    "資料與實體核對",
    "無門店照／虛擬辦公室",
    12,
    () => v2Model().signals.virtual || (v2Offline() && !state.files["101401"]),
  ],
  [
    "BANK-01",
    "結算與關聯",
    "結算帳戶為對私",
    8,
    () => v2Raw("isCompay") === "N",
  ],
  [
    "BANK-02",
    "結算與關聯",
    "對公帳戶名稱與英文商戶名稱不一致",
    15,
    () =>
      v2Raw("isCompay") === "Y" &&
      !!v2Raw("cardName") &&
      !!v2Raw("merchantEnglishName") &&
      v2NormalizeName(v2Raw("cardName")) !==
        v2NormalizeName(v2Raw("merchantEnglishName")),
  ],
  [
    "BANK-03",
    "結算與關聯",
    "帳戶已關聯其他商戶",
    20,
    () => !!v2Model().signals.cardlink,
  ],
  [
    "PAY-06",
    "產品與交易",
    "涉及預付／儲值／預售",
    20,
    () => !!v2Model().signals.prepaid,
  ],
];
function onboardingRiskCoverage() {
  return [
    {
      label: "MCC 行業",
      done:
        mtMccList().length > 0 &&
        mtMccList().every((c) =>
          V2.catalog.MCCS.some(
            (m) => m.c === c && ["low", "mid", "high"].includes(m.lv),
          ),
        ),
    },
    { label: "開通產品", done: v2Rows().length > 0 },
    {
      label: "結算帳戶",
      done: !!(v2Raw("cardName") && v2Raw("cardNo") && v2Raw("cardBankCode")),
    },
  ];
}
v2Score = function () {
  const items = onboardingRiskRules
      .filter((r) => r[4]())
      .map(([id, category, label, n]) => ({
        id,
        category,
        label:
          label +
          (id.startsWith("MCC-")
            ? "（" +
              mtMccList()
                .filter(
                  (c) =>
                    V2.catalog.MCCS.find((m) => m.c === c)?.lv ===
                    (id === "MCC-01" ? "high" : "mid"),
                )
                .join("、") +
              "）"
            : ""),
        n,
      })),
    raw = items.reduce((s, r) => s + r.n, 0),
    total = Math.min(100, raw),
    s = v2Model().signals;
  return {
    items,
    total,
    raw,
    level: total <= 20 ? "1" : total <= 45 ? "2" : "3",
    reject: s.sanction
      ? "命中制裁名單（示例）"
      : s.frozen
        ? "關聯已凍結／關閉商戶"
        : total > 70
          ? "風控評分超過 70"
          : null,
    modelVersion: onboardingRiskVersion,
    coverage: onboardingRiskCoverage(),
  };
};
const onboardingProgressOpen = {};
function onboardingFillProgress() {
  const required = v2Required(),
    pages = [];
  for (let step = 1; step <= 6; step++) {
    const errors = validateStep(step),
      items = [];
    const add = (key, label, done, message = "") => {
      if (!items.some((i) => i.key === key))
        items.push({ key, label, done: !!done, message });
    };
    if (step >= 2 && step <= 5)
      for (const section of V2.forms[step - 2].sections)
        for (const field of section.fields.filter(v2Visible)) {
          const group = field.id.includes("[]") ? field.id.split("[")[0] : null;
          for (let i = 0; i < (group ? state.people[group] : 1); i++) {
            const key = field.id.replace("[]", `[${i}]`),
              person = key.split(".").pop(),
              isRequired =
                required.has(key) ||
                (group &&
                  ([
                    "name",
                    "firstNameEn",
                    "lastNameEn",
                    "idcardType",
                    "idcardNo",
                  ].includes(person) ||
                    (group === "authSigners" && person === "birthDay")));
            if (isRequired || errors[key])
              add(
                key,
                (group ? section.name + " " + (i + 1) + " · " : "") +
                  v2Label(key),
                !!v2Raw(key) && !errors[key],
                errors[key] || "尚未填寫",
              );
          }
        }
    if (step === 2 && state.values.__customer?.id)
      add(
        "_customer",
        "客戶及公司關係",
        !!state.values.__customer.name && !errors._customer,
        errors._customer || "請填寫客戶名稱",
      );
    if (step === 5) {
      add(
        "_products",
        "選擇開通產品",
        v2Rows().length > 0,
        "請至少選擇一項產品",
      );
      for (const x of v2Rows())
        add(
          "_fee-" + x.key,
          x.g.n + " · " + x.r.n + "費率",
          !v2FeeErrors(x.r, x.st).length,
          v2FeeErrors(x.r, x.st).join("；"),
        );
    }
    if (step === 6) {
      add(
        "_review",
        "資料一致性及風控核對",
        !Object.keys(errors).length,
        Object.values(errors)[0] || "",
      );
      add(
        "_declaration",
        "聲明及確認",
        !!state.checks["613:4956"],
        "請勾選提交聲明",
      );
      if (MT_EXTERNAL) {
        add("signer", "簽署人姓名", !!v2Raw("signer"), "請填寫簽署人姓名");
        add(
          "signerTitle",
          "簽署人職位",
          !!v2Raw("signerTitle"),
          "請填寫簽署人職位",
        );
        add("_signature", "電子簽名", !!state.signature, "請完成簽名");
      }
    }
    for (const [key, message] of Object.entries(errors))
      if (!items.some((i) => i.key === key))
        add(
          key,
          v2Fields.some((f) => f.id === key) ? v2Label(key) : message,
          false,
          message,
        );
    const completed = items.filter((i) => i.done).length,
      total = items.length;
    pages.push({
      step,
      name: steps[step - 1],
      completed,
      total,
      percent: total ? Math.round((completed / total) * 100) : 100,
      missing: items.filter((i) => !i.done),
      optional: step === 1,
      files: step === 1 ? Object.keys(state.files).length : 0,
    });
  }
  const total = pages.reduce((s, p) => s + p.total, 0),
    completed = pages.reduce((s, p) => s + p.completed, 0);
  return {
    pages,
    total,
    completed,
    percent: total ? Math.round((completed / total) * 100) : 0,
  };
}
function onboardingProgressCard() {
  const d = onboardingFillProgress(),
    current = route().step;
  return `<article class="mt-fill-progress" aria-label="目前填寫進度"><h2>目前填寫進度</h2><div class="mt-progress-total"><strong>${d.percent}%</strong><span>${d.completed}／${d.total} 關鍵資料完成</span></div><progress value="${d.percent}" max="100" aria-label="整體填寫進度"></progress><p class="hint">按頁查看缺漏或格式問題，點選即可返回填寫。</p><div class="mt-progress-pages">${d.pages.map((p) => `<details data-progress-step="${p.step}" ${(onboardingProgressOpen[p.step] ?? p.step === current) ? "open" : ""}><summary><span class="mt-progress-dot ${p.optional ? "optional" : p.missing.length ? "pending" : "done"}">${p.step}</span><strong>${esc(p.name)}</strong><span>${p.optional ? "選填" : p.completed + "／" + p.total}</span></summary><div class="mt-progress-page-body">${p.optional ? `<p>已上傳 ${p.files} 份文件；未提供不阻擋填寫。</p>` : p.missing.length ? `<ul>${p.missing.map((i) => `<li>${btn(esc(i.label), "progress-go", "text-button", `data-step="${p.step}" data-key="${esc(i.key)}"`)}<small>${esc(i.message)}</small></li>`).join("")}</ul>` : '<p class="mt-progress-done">關鍵資料已完成</p>'}${btn("前往此頁 →", "progress-go", "text-button", `data-step="${p.step}"`)}</div></details>`).join("")}</div><small class="hint">進度依目前資料與驗證規則計算，並非審批結果。</small></article>`;
}
const onboardingOriginalOverview = v2RiskOverview;
v2RiskOverview = function () {
  const score = v2Score(),
    missing = score.coverage.filter((c) => !c.done),
    html = onboardingOriginalOverview().replace(
      'aria-label="申請即時狀態">',
      'aria-label="申請即時狀態">' + onboardingProgressCard(),
    );
  const banner = `<div class="mt-risk-live ${missing.length ? "incomplete" : ""}"><span>${missing.length ? "初步評估 · 待補 " + missing.map((c) => c.label).join("、") : score.total ? "已依目前資料計分" : "已完成計分 · 未命中加分條件"}</span>${btn("計分邏輯", "risk-logic", "text-button")}</div>`;
  return html
    .replace(
      '<div class="v2-status-score">',
      banner + '<div class="v2-status-score">',
    )
    .replace(
      missing.length ? "<small>系統建議</small>" : "__no_match__",
      "<small>初步建議</small>",
    )
    .replace(
      "暫無加分項",
      "目前資料未命中加分條件（0 分）；資料變更後即時重算",
    );
};
const onboardingOriginalRefresh = v2RefreshStatus;
let onboardingCurrentEvent = null;
for (const type of ["input", "change", "click"])
  document.addEventListener(type, (e) => (onboardingCurrentEvent = e), true);
v2RefreshStatus = function () {
  const t = onboardingCurrentEvent?.target;
  if (onboardingCurrentEvent?.type === "input" && t?.dataset.v2Field)
    state.values[t.dataset.v2Field] = t.value;
  v2SyncDerived();
  const textCommit =
    onboardingCurrentEvent?.type === "change" &&
    t?.matches(
      'input:not([type="checkbox"]):not([type="file"]):not([type="radio"])',
    ) &&
    (t.dataset.field || t.dataset.mtRelation);
  if (!textCommit) onboardingOriginalRefresh();
  const industry = $('[data-field="mccName"]');
  if (industry) industry.value = v2Raw("mccName");
  const level = $('[data-field="riskLevel"]');
  if (level) level.value = v2Raw("riskLevel");
};
// Preserve an explicit operator choice before input-driven recalculation runs.
document.addEventListener(
  "input",
  (e) => {
    if (e.target.dataset.v2Field === "riskLevel") v2Model().manualRisk = true;
  },
  true,
);
actions["progress-go"] = (el) => {
  const key = el.dataset.key;
  actions.step({ dataset: { step: el.dataset.step } });
  setTimeout(() => {
    if (!key) return;
    const node =
      $(`[data-field-wrap="${CSS.escape(key)}"]`) ||
      (key === "_declaration"
        ? $('[data-check="613:4956"]')
        : key === "_signature"
          ? $("#signature")
          : key.startsWith("_fee-")
            ? $(`[data-v2-product="${CSS.escape(key.slice(5))}"]`)
            : key === "_customer"
              ? $("#mt-customer")
              : null);
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
    (node?.matches("input,select,textarea,button,canvas")
      ? node
      : node?.querySelector("input,select,textarea,button,summary")
    )?.focus({ preventScroll: true });
  }, 0);
};
actions["risk-logic"] = () => {
  const score = v2Score(),
    active = new Set(score.items.map((i) => i.id));
  modal(
    "風控計分邏輯",
    `<div class="notice">規則版本：${onboardingRiskVersion}<br>總分＝命中規則加分總和（上限 100）。目前 ${score.raw} 分，顯示 ${score.total}／100。</div><p>0–20 低、21–45 中、46–70 高；超過 70 分或命中制裁／凍結示例會阻擋 Demo 提交。MCC 取最高風險一次計分，同一規則不重複加分。</p><div class="mt-risk-rule-list">${onboardingRiskRules.map(([id, category, label, n]) => `<div class="${active.has(id) ? "matched" : ""}"><span><small>${category} · ${id}</small><strong>${label}</strong></span><b>+${n}</b>${pill(active.has(id) ? "已命中" : "未命中", active.has(id) ? "amber" : "gray")}</div>`).join("")}</div><p class="hint">以上分值、門檻、MCC 常態金額及處置均為本 Demo 規則，未經真實交易資料校準。未上傳文件不阻擋填寫；線下產品未有門店照僅保留原型的風險提示。沒有實際接入名單、退款或拒付數據。</p><p>設計參考：<a href="https://support.stripe.com/questions/stripe-credit-underwriting-process" target="_blank" rel="noopener">Stripe 商戶審查因素</a>、<a href="https://docs.adyen.com/platforms/manage-account-holder-risk" target="_blank" rel="noopener">Adyen 帳戶規則及處置</a>。參考評估維度與可追溯方式，非其專有演算法。</p>`,
    btn("返回填寫", "close", "primary"),
  );
};
document.addEventListener("click", (e) => {
  const summary = e.target.closest("details[data-progress-step]>summary");
  if (summary)
    requestAnimationFrame(
      () =>
        (onboardingProgressOpen[summary.parentElement.dataset.progressStep] =
          summary.parentElement.open),
    );
});
document.addEventListener("input", (e) => {
  if (e.target.dataset.mtRelation || e.target.dataset.check) v2RefreshStatus();
});
for (const key of ["demo-signature", "clear-signature"]) {
  const action = actions[key];
  if (action)
    actions[key] = (el) => {
      action(el);
      v2RefreshStatus();
    };
}
for (const event of ["mouseup", "touchend"])
  document.addEventListener(event, (e) => {
    if (e.target.id === "signature")
      requestAnimationFrame(() => v2RefreshStatus());
  });
const onboardingOriginalReview = v2Review;
v2Review = () =>
  onboardingOriginalReview().replace("制裁／PEP 命中", "制裁名單命中（示例）");
Object.assign(window.AllinPayDemo, {
  getFillProgress: () => onboardingFillProgress(),
  getRiskRules: () => ({
    version: onboardingRiskVersion,
    score: v2Score(),
    rules: onboardingRiskRules.map(([id, category, label, points, test]) => ({
      id,
      category,
      label,
      points,
      matched: !!test(),
    })),
  }),
});


// SOURCE MODULE: mcc-reference.js
// Reference classifications and Demo risk parameters are deliberately separate.
const mccDemoParameters = new Map(V2.catalog.MCCS.map((m) => [m.c, { ...m }]));
const mccReferenceByCode = new Map(
  MCC_REFERENCE_DATA.entries.map((entry) => [entry.code, entry]),
);
V2.catalog.MCCS = MCC_REFERENCE_DATA.entries.map((entry) => {
  const demo = mccDemoParameters.get(entry.code),
    name = entry.zh;
  return {
    c: entry.code,
    n: name,
    en: entry.en,
    key: entry.key,
    countries: entry.countries || null,
    excludedCountries: entry.excludedCountries || null,
    lv: demo?.lv || "unrated",
    avg: demo?.avg || null,
  };
});
const mccByCode = new Map(V2.catalog.MCCS.map((m) => [m.c, m]));
const mccName = (code) => {
  const m = mccByCode.get(code);
  return m
    ? m.n === m.en
      ? m.en
      : m.n + " / " + m.en
    : code + "（未列入參考文件，待核定）";
};
const mccUnrated = () =>
  mtMccList().filter(
    (code) => !["low", "mid", "high"].includes(mccByCode.get(code)?.lv),
  );
const mccCountryMismatch = () =>
  mtMccList().filter((code) => {
    const m = mccByCode.get(code);
    const country = v2Raw("addrCountryCode");
    return (
      country &&
      ((m?.countries && !m.countries.includes(country)) ||
        m?.excludedCountries?.includes(country))
    );
  });
const mccBaseSync = v2SyncDerived;
v2SyncDerived = function (...args) {
  const result = mccBaseSync.apply(this, args);
  state.values.mccName = mtMccList().map(mccName).join("\n");
  return result;
};
mtMccOptions = function (query = "") {
  const selected = mtMccList(),
    options = [
      ...V2.catalog.MCCS,
      ...selected
        .filter((code) => !mccByCode.has(code))
        .map((c) => ({ c, n: "待核定行業", en: "" })),
    ],
    q = query.trim().toLowerCase();
  if (/^\d{4}$/.test(q) && !options.some((m) => m.c === q))
    options.push({ c: q, n: "待核定行業", en: "" });
  return (
    options
      .filter((m) => (m.c + " " + m.n + " " + m.en).toLowerCase().includes(q))
      .map(
        (m) =>
          `<label class="check" data-mt-mcc-option="${m.c}"><input type="checkbox" data-mt-mcc="${m.c}" aria-label="MCC ${m.c}" ${selected.includes(m.c) ? "checked" : ""}><span>${m.c}</span>${m.c === v2Raw("mcc") ? "<small>主要</small>" : ""}</label>`,
      )
      .join("") ||
    '<p class="hint">沒有符合的項目；其他代碼可輸入完整 4 位數字，另行核定。</p>'
  );
};
const mccBaseField = v2Field;
v2Field = function (f, ...args) {
  let html = mccBaseField.call(this, f, ...args);
  if (!html) return html;
  if (f.id === "mcc") {
    const end = html.lastIndexOf("</div>");
    html =
      html.slice(0, end) +
      '<small class="hint mcc-source">客戶提供 MCC 對照表 · ' +
      MCC_REFERENCE_DATA.entries.length +
      " 個具名代碼。名稱於「行業名稱」欄位顯示；實際受理須由 AllinPay 核定。</small>" +
      html.slice(end);
  }
  if (f.id === "mccName") {
    html = html.replace(
      /<input\b[^>]*data-v2-field="mccName"[^>]*>/,
      (input) =>
        input
          .replace(/^<input/, "<textarea")
          .replace(/\s+type="[^"]*"/, "")
          .replace(/\s+value="[^"]*"/, "")
          .replace(
            />$/,
            ' rows="2" class="mcc-names" aria-label="所選 MCC 對應名稱">',
          ) +
        esc(v2Raw("mccName")) +
        "</textarea>",
    );
    const mismatch = mccCountryMismatch();
    if (mismatch.length) {
      const end = html.lastIndexOf("</div>");
      html =
        html.slice(0, end) +
        `<small class="error">${esc(mismatch.join("、"))} 為參考文件的地區限定代碼，與目前營業國家／地區不符。</small>` +
        html.slice(end);
    }
  }
  return html;
};
const mccBaseValidate = validateStep;
validateStep = function (step) {
  const errors = mccBaseValidate(step);
  if (step === 3 && mccCountryMismatch().length)
    errors.mcc =
      "所選 MCC " +
      mccCountryMismatch().join("、") +
      " 為地區限定代碼，與目前營業國家／地區不符。";
  return errors;
};
const mccBaseScore = v2Score;
v2Score = function (...args) {
  const score = mccBaseScore.apply(this, args);
  return { ...score, pendingMccRisk: mccUnrated() };
};
const mccBaseOverview = v2RiskOverview;
v2RiskOverview = function (...args) {
  const html = mccBaseOverview.apply(this, args),
    pending = mccUnrated();
  if (!pending.length) return html;
  return html.replace(
    /<article class="v2-status-card" data-risk-tier="[^"]*">[\s\S]*?<\/article>/,
    (card) => {
      card = card.replace(
        /<div class="v2-status-tier"><b>[\s\S]*?<\/small><\/div>/,
        '<div class="v2-status-tier"><b>待評估</b><small>行業風險待核定</small></div>',
      );
      card = card.replace(
        '<div class="v2-status-score">',
        `<div class="notice warn mcc-risk-pending">MCC ${esc(pending.join("、"))} 尚未設定 Demo 風險參數。目前分數未包含這些行業風險，請人工核定風控級別。</div><div class="v2-status-score">`,
      );
      if (!v2Model().manualRisk)
        card = card
          .replace(
            /<p>採用風控級別：[\s\S]*?<\/p>/,
            "<p>行業風險尚待評估；請核對並人工設定風控級別。</p>",
          )
          .replace(
            /<dl>[\s\S]*?<\/dl>/,
            '<p class="hint">行業風險未核定前，不提供自動處置建議。</p>',
          );
      return card;
    },
  );
};
const mccBaseSummary = v2RiskSummary;
v2RiskSummary = function (...args) {
  const pending = mccUnrated(),
    html = mccBaseSummary.apply(this, args);
  return pending.length
    ? html.replace(
        /<strong>[\s\S]*?<\/strong>/,
        "<strong>部分資料計分 · MCC 行業風險待評估</strong>",
      ) +
        '<p class="hint">新增參考代碼不會自動獲配低風險或平均交易金額；請人工核定。</p>'
    : html;
};
const mccStyle = document.createElement("style");
mccStyle.textContent =
  ".mcc-names{height:auto!important;min-height:76px;max-height:220px;resize:vertical;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6}.mcc-source{display:block;margin-top:8px;line-height:1.6}.mcc-risk-pending{font-size:13px;line-height:1.6;margin:12px 0}.mt-mcc-options .check>span{font-variant-numeric:tabular-nums}";
document.head.append(mccStyle);
Object.assign(window.AllinPayDemo, {
  getMccReference: () => ({
    source: MCC_REFERENCE_DATA.source,
    edition: MCC_REFERENCE_DATA.edition,
    count: MCC_REFERENCE_DATA.entries.length,
    sourceSha256: MCC_REFERENCE_DATA.sourceSha256,
  }),
  lookupMcc: (code) => structuredClone(mccByCode.get(String(code)) || null),
});


// SOURCE MODULE: document-previews.js
// Preview bytes stay in memory; persisted drafts contain metadata only.
const documentThumbnails = new Map();
DEMO.sourceFiles ??= new Map();
uploadRow = function (d) {
  const f = state.files[d.id],
    id = "document-file-" + d.id,
    error = state.errors["file-" + d.id],
    url = f && !f.needsReselect ? DEMO.fileURLs.get(d.id) : "",
    image = f && /\.(png|jpe?g)$/i.test(f.name),
    pdf = f && /\.pdf$/i.test(f.name);
  const hint =
    d.hint && !/選填|不會阻擋|上限|稍後補/.test(d.hint)
      ? `<p class="hint">${esc(d.hint)}</p>`
      : "";
  const preview = f
    ? `<div class="mt-upload-preview"><button type="button" class="mt-preview-button" data-action="preview-demo-file" data-id="${d.id}" aria-label="預覽 ${esc(f.name)}" ${!url && !f.demo ? "disabled" : ""}>${url && image ? `<img src="${esc(url)}" alt="${esc(f.name)} 縮圖">` : url && pdf ? `<img data-preview-source="${esc(url)}" alt="${esc(f.name)} 第一頁預覽" hidden><span class="mt-thumb-state">正在產生 PDF 預覽…</span>` : `<span class="mt-preview-placeholder">${pdf ? "PDF" : "圖片"}<small>${f.demo ? "示例文件" : f.needsReselect ? "請重新上傳以預覽" : "文件預覽"}</small></span>`}</button><div class="mt-preview-info"><strong>${esc(f.name)}</strong><small>${f.size ? (f.size / 1048576).toFixed(2) + " MB · " : ""}${f.demo ? "示例附件" : f.needsReselect ? "原文件未保留，請重新上傳" : "僅保留於本機"}</small><div class="upload-actions">${btn("查看文件", "preview-demo-file", "", `data-id="${d.id}" ${!url && !f.demo ? "disabled" : ""}`)}${btn("重新上傳", "choose-file", "", `data-input-id="${id}"`)}${btn("刪除", "document-remove-file", "danger", `data-id="${d.id}"`)}</div><small>也可拖入新文件取代</small></div><input hidden type="file" id="${id}" data-demo-upload="${d.id}" accept=".pdf,.jpg,.jpeg,.png"></div>`
    : fileDropControl({
        inputId: id,
        accept: ".pdf,.jpg,.jpeg,.png",
        hint: "PDF／JPG／PNG · 每份上限 10 MB",
        attributes: `data-demo-upload="${d.id}"`,
      });
  return `<div class="upload-row ${f ? "has-document" : ""}" data-upload-row="${d.id}" data-document-drop="${d.id}" data-file-drop data-file-input="${id}"><div class="upload-heading"><strong>${labelHTML(d.name)}</strong>${pill(f ? "已上傳" : "選填", f ? "green" : "gray")}</div>${hint}${preview}${error ? `<p class="error">${esc(error)}</p>` : ""}</div>`;
};
async function makeDocumentThumbnail(url) {
  let task;
  try {
    const pdfjs = await import("./vendor/pdfjs/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "./vendor/pdfjs/build/pdf.worker.mjs",
      location.href,
    ).href;
    const source = [...DEMO.sourceFiles.values()].find(
      (s) => s.url === url,
    )?.file;
    if (!source) throw Error("請重新上傳文件");
    const bytes = new Uint8Array(await source.arrayBuffer());
    task = pdfjs.getDocument({
      data: bytes,
      isEvalSupported: false,
      cMapUrl: new URL("./vendor/pdfjs/cmaps/", location.href).href,
      cMapPacked: true,
      standardFontDataUrl: new URL(
        "./vendor/pdfjs/standard_fonts/",
        location.href,
      ).href,
      wasmUrl: new URL("./vendor/pdfjs/wasm/", location.href).href,
    });
    const doc = await task.promise,
      page = await doc.getPage(1),
      base = page.getViewport({ scale: 1 }),
      view = page.getViewport({ scale: Math.min(1, 320 / base.width) }),
      canvas = document.createElement("canvas");
    canvas.width = Math.ceil(view.width);
    canvas.height = Math.ceil(view.height);
    await page.render({
      canvasContext: canvas.getContext("2d"),
      viewport: view,
    }).promise;
    const src = canvas.toDataURL("image/png");
    canvas.width = canvas.height = 1;
    return { src, pages: doc.numPages };
  } catch {
    return { error: "無法產生縮圖，可按「查看文件」開啟原件。" };
  } finally {
    try {
      await task?.destroy();
    } catch {}
  }
}
function showDocumentThumbnail(url, result) {
  for (const image of $$("[data-preview-source]").filter(
    (n) => n.dataset.previewSource === url,
  )) {
    const caption = image.parentElement.querySelector(".mt-thumb-state");
    if (result.src) {
      image.src = result.src;
      image.hidden = false;
      if (caption) caption.textContent = "第 1／" + result.pages + " 頁";
    } else if (caption) caption.textContent = result.error;
  }
}
let documentThumbnailQueue = Promise.resolve();
function refreshDocumentThumbnails() {
  const active = new Set(DEMO.fileURLs.values());
  for (const url of documentThumbnails.keys())
    if (!active.has(url)) documentThumbnails.delete(url);
  for (const image of $$("[data-preview-source]")) {
    const url = image.dataset.previewSource,
      entry = documentThumbnails.get(url);
    if (entry?.result) {
      showDocumentThumbnail(url, entry.result);
      continue;
    }
    if (entry) continue;
    const record = { result: null };
    documentThumbnails.set(url, record);
    documentThumbnailQueue = documentThumbnailQueue.then(async () => {
      if (![...DEMO.fileURLs.values()].includes(url)) return;
      record.result = await makeDocumentThumbnail(url);
      if (documentThumbnails.get(url) === record)
        showDocumentThumbnail(url, record.result);
    });
  }
}
const documentPreviewRender = render;
render = function () {
  documentPreviewRender();
  queueMicrotask(refreshDocumentThumbnails);
};
actions["preview-demo-file"] = (el) => {
  const f = state.files[el.dataset.id],
    url = f && !f.needsReselect ? DEMO.fileURLs.get(el.dataset.id) : "";
  if (!f) return;
  const body = url
    ? /\.pdf$/i.test(f.name)
      ? `<iframe class="br-pdf-preview" src="${esc(url)}" title="${esc(f.name)} 原文件"></iframe>`
      : `<img class="batch-preview" alt="${esc(f.name)}" src="${esc(url)}">`
    : `<div class="notice">${f.demo ? "這是完整示例中的附件記錄，沒有真實文件。可用「重新上傳」加入自己的文件。" : "請重新上傳文件以查看原件。"}</div>`;
  modal(
    "文件預覽",
    `<p><strong>${esc(f.name)}</strong></p>${body}`,
    btn("關閉", "close") +
      (url
        ? btn(
            "開啟原文件",
            "document-open-original",
            "",
            `data-id="${el.dataset.id}"`,
          )
        : "") +
      btn(
        "重新上傳",
        "document-replace",
        "primary",
        `data-id="${el.dataset.id}"`,
      ),
  );
};
actions["document-open-original"] = (el) => {
  const f = state.files[el.dataset.id],
    url = f && !f.needsReselect ? DEMO.fileURLs.get(el.dataset.id) : "";
  if (url) window.open(url, "_blank", "noopener");
};
actions["document-replace"] = (el) => {
  $("#modal").close();
  document.getElementById("document-file-" + el.dataset.id)?.click();
};
const documentDeleteAction =
  actions["document-remove-file"] || actions["remove-file"];
actions["document-remove-file"] = (el) => {
  const url = DEMO.fileURLs.get(el.dataset.id);
  if (url) URL.revokeObjectURL(url);
  DEMO.fileURLs.delete(el.dataset.id);
  DEMO.sourceFiles.delete(el.dataset.id);
  documentDeleteAction(el);
};


// SOURCE MODULE: merchant-workbook-model.js
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MerchantWorkbookModel = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function create(V2, MT) {
    const fields = V2.forms
        .flatMap((f) => f.sections.flatMap((s) => s.fields))
        .filter((f) => !f.id.includes("[]")),
      byId = Object.fromEntries(fields.map((f) => [f.id, f])),
      title = (k) =>
        byId[k]?.label
          .split(/\s{2,}/)[0]
          .replace(/\s*\*/g, "")
          .trim() || k;
    const common = [
      "merchantName",
      "merchantEnglishName",
      "registerCertNo",
      "mcc",
      "contactName",
      "contactPhone",
      "contactEmail",
      "settlePeriod",
      "currency",
      "cardBankName",
      "cardBankCode",
      "cardName",
      "cardNo",
      "addrStreet",
      "addrStreetEn",
    ];
    const templateFields = [
      ...new Set([
        "mcc",
        ...MT.scopeFields.profile,
        ...MT.scopeFields.settlement,
        ...MT.scopeFields.products,
        ...MT.scopeFields.identity,
      ]),
    ].filter(
      (k) => byId[k] && !["mccName", "merchantAgreementNum"].includes(k),
    );
    const banks = V2.bankCodeReference
      ? Object.fromEntries(
          V2.bankCodeReference.banks.map((b) => [b.code, b.name]),
        )
      : {
          "003": "渣打銀行（香港）",
          "004": "香港上海滙豐銀行",
          "012": "中國銀行（香港）",
          "015": "東亞銀行",
          "016": "星展銀行（香港）",
          "024": "恒生銀行",
        };
    const products = V2.catalog.GROUPS.flatMap((g) =>
      g.rows.map((r, i) => ({
        key: g.k + "|" + i,
        label: g.n + "／" + r.n,
        g,
        r,
      })),
    );
    const segment = {
      loc: "本地卡",
      crs: "跨境卡",
      pref: "優惠費率",
      std: "統一費率",
      cn: "國內錢包",
      hk: "香港錢包",
      dcc: "DCC",
      per: "每筆費用",
    };
    for (const t of V2.catalog.TENORS) segment["t" + t] = t + " 期分期";
    const companyHeaders = [
      "公司代號",
      "客戶／集團名稱",
      "公司關係",
      "母公司代號",
      "參數模板",
      ...common.map(title),
      "其他 MCC 1",
      "其他 MCC 2",
      "其他 MCC 3",
      "其他 MCC（以分號分隔）",
    ];
    const templateHeaders = [
      "模板名稱",
      "套用範圍",
      ...templateFields.map(title),
      "其他 MCC（以分號分隔）",
    ];
    const feeHeaders = [
      "公司代號",
      "模板名稱",
      "產品項目",
      "開通類別",
      "開通項目",
      "收費類型",
      "適用範圍",
      "費率（%）",
      "每筆費用（HKD）",
      "保底（HKD）",
      "封頂（HKD）",
      "Markup（%）",
      "啟用該範圍",
      "優計劃",
    ];
    const featureHeaders = [
      "公司代號",
      "模板名稱",
      "產品類別",
      "功能項目",
      "開通",
      "特計類型",
    ];
    const personFields = [
        ["name", "姓名"],
        ["firstNameEn", "英文名"],
        ["lastNameEn", "英文姓"],
        ["idcardType", "證件類型"],
        ["idcardNo", "證件號碼"],
        ["idcardNoPeriod", "證件有效期"],
        ["birthDay", "出生日期"],
      ],
      personGroups = {
        directors: "董事",
        authSigners: "授權簽名人",
        shareHolders: "股東",
      };
    const specs = [
      { name: "商戶資料", headers: companyHeaders, fields: common },
      { name: "參數模板", headers: templateHeaders, fields: templateFields },
      { name: "產品費率", headers: feeHeaders },
      { name: "產品功能", headers: featureHeaders },
      {
        name: "人員資料",
        headers: [
          "公司代號",
          "模板名稱",
          "人員類型",
          "序號",
          ...personFields.map(([, label]) => label),
        ],
      },
    ];
    const value = (k, v) =>
      V2.options[k]?.find((o) => o[0] === String(v))?.[1] || String(v ?? "");
    function canonical(k, v) {
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      let s = String(v ?? "").trim();
      if (
        /Period$|birthDay$/.test(k) &&
        !["settlePeriod", "licencePeriod"].includes(k) &&
        s.includes("/")
      ) {
        const [y, m, d] = s.split("/");
        if (y?.length === 4 && m && d)
          s = y + "-" + m.padStart(2, "0") + "-" + d.padStart(2, "0");
      }
      if (k === "mcc") return s.match(/^\d{4}/)?.[0] || s;
      if (k === "cardBankCode" && /^\d{1,3}$/.test(s))
        return s.padStart(3, "0");
      return V2.options[k]?.find((o) => o[1] === s)?.[0] || s;
    }
    const yes = (v) => ["是", "Y", "true", "1"].includes(String(v));
    function toSheets(bundle) {
      const sheets = Object.fromEntries(specs.map((s) => [s.name, []]));
      const addPeople = (owner, company = "", template = "") => {
        for (const [group, label] of Object.entries(personGroups)) {
          const keys = Object.keys(owner.values || {}).filter((k) =>
              k.startsWith(group + "["),
            ),
            count = Math.max(
              Number(owner.people?.[group]) || 0,
              ...keys.map((k) => Number(k.match(/\[(\d+)\]/)[1]) + 1),
            );
          for (let i = 0; i < count; i++)
            sheets["人員資料"].push([
              company,
              template,
              label,
              i + 1,
              ...personFields.map(([k]) =>
                value(k, owner.values?.[group + "[" + i + "]." + k]),
              ),
            ]);
        }
      };
      const addProducts = (p, company = "", template = "") => {
        if (!p) return;
        for (const [key, st] of Object.entries(p.rates || {})) {
          const def = products.find((x) => x.key === key);
          if (!def) continue;
          const prefixes = Object.keys(segment).filter((prefix) =>
            Object.keys(st.v || {}).some((k) => k.startsWith(prefix + "_")),
          );
          if (!prefixes.length && st.on)
            prefixes.push(
              st.ct === "Regional"
                ? "loc"
                : st.ct === "Wallet"
                  ? "cn"
                  : def.r.mode === "PER"
                    ? "per"
                    : "std",
            );
          for (const prefix of prefixes) {
            const v = st.v || {},
              enabled =
                prefix === "pref"
                  ? v.pref_on
                  : prefix.startsWith("t")
                    ? v[prefix + "_on"]
                    : true;
            sheets["產品費率"].push([
              company,
              template,
              def.label,
              p.groups?.[def.g.k] ? "是" : "否",
              st.on ? "是" : "否",
              st.ct || "",
              segment[prefix],
              v[prefix + "_rate"] ?? "",
              v[prefix + "_fix"] ?? "",
              v[prefix + "_min"] ?? "",
              v[prefix + "_max"] ?? "",
              v[prefix + "_markup"] ?? "",
              enabled ? "是" : "否",
              v.upi === "Y" ? "是" : "否",
            ]);
          }
        }
        for (const [key, on] of Object.entries(p.groups || {}))
          sheets["產品功能"].push([
            company,
            template,
            V2.catalog.GROUPS.find((x) => x.k === key)?.n || key,
            "產品類別開通",
            on ? "是" : "否",
            "",
          ]);
        for (const [key, on] of Object.entries(p.combo || {})) {
          const [g, feature] = key.split("|");
          sheets["產品功能"].push([
            company,
            template,
            V2.catalog.GROUPS.find((x) => x.k === g)?.n || g,
            feature,
            on ? "是" : "否",
            "",
          ]);
        }
        for (const [brand, s] of Object.entries(p.sme || {}))
          sheets["產品功能"].push([
            company,
            template,
            "收單",
            "特計商戶 " + brand,
            s.on ? "是" : "否",
            s.type,
          ]);
      };
      for (const t of bundle.templates || []) {
        sheets["參數模板"].push([
          t.name,
          (t.scopes || ["profile", "mcc", "settlement", "products"])
            .map((s) => MT.labels[s])
            .join(";"),
          ...templateFields.map((k) => value(k, t.values?.[k])),
          MT.codes(t.values?.mccCodes || t.values?.mcc)
            .filter((c) => c !== t.values?.mcc)
            .join(";"),
        ]);
        addProducts(t.products, "", t.name);
        if (t.scopes?.includes("identity")) addPeople(t, "", t.name);
      }
      for (const c of bundle.companies || []) {
        const v = c.values || {},
          mcc = MT.codes(v.mccCodes || v.mcc).filter((x) => x !== v.mcc);
        sheets["商戶資料"].push([
          c.key,
          c.customerName || bundle.customer?.name || "",
          { parent: "母公司", subsidiary: "子公司", independent: "獨立公司" }[
            c.role
          ] || "獨立公司",
          c.parentKey || "",
          c.templateName || bundle.defaultTemplate || "",
          ...common.map((k) => value(k, v[k])),
          ...Array.from({ length: 3 }, (_, i) => mcc[i] || ""),
          mcc.slice(3).join(";"),
        ]);
        addProducts(c.products, c.key);
        addPeople(c, c.key);
      }
      return sheets;
    }
    function fromSheets(sheets) {
      const templates = [],
        companies = [],
        targets = new Map(),
        unpack = (row, keys) =>
          Object.fromEntries(
            keys
              .map((k) => [k, canonical(k, row[title(k)])])
              .filter(([, v]) => v !== ""),
          );
      for (const row of sheets["參數模板"] || []) {
        const name = String(row["模板名稱"] || "").trim();
        if (!name) continue;
        if (targets.has("T:" + name)) throw Error("模板名稱重複：" + name);
        const values = unpack(row, templateFields);
        values.mccCodes = MT.codes(
          [values.mcc, ...MT.codes(row["其他 MCC（以分號分隔）"])].filter(
            Boolean,
          ),
        );
        const t = {
          name,
          scopes: row["套用範圍"]
            ? String(row["套用範圍"])
                .split(/[;；]/)
                .map(
                  (s) =>
                    Object.keys(MT.labels).find(
                      (k) => MT.labels[k] === s.trim(),
                    ) || s.trim(),
                )
            : ["profile", "mcc", "settlement", "products"],
          values,
          products: { groups: {}, rates: {}, combo: {}, sme: {} },
        };
        templates.push(t);
        targets.set("T:" + name, t);
      }
      for (const row of sheets["商戶資料"] || []) {
        const key = String(row["公司代號"] || "").trim();
        if (!key) {
          if (Object.values(row).some((v) => String(v || "").trim()))
            throw Error("商戶資料有已填內容，但缺少公司代號");
          continue;
        }
        if (targets.has("C:" + key)) throw Error("公司代號重複：" + key);
        const values = unpack(row, common),
          bank = Object.entries(banks).find(
            ([, n]) => n === values.cardBankName,
          );
        if (bank) values.cardBankCode = bank[0];
        values.mccCodes = MT.codes(
          [
            values.mcc,
            ...[row["其他 MCC 1"], row["其他 MCC 2"], row["其他 MCC 3"]].map(
              (v) => canonical("mcc", v),
            ),
            ...MT.codes(row["其他 MCC（以分號分隔）"]),
          ].filter(Boolean),
        );
        const c = {
          key,
          customerName: String(row["客戶／集團名稱"] || ""),
          role:
            {
              母公司: "parent",
              主公司: "parent",
              子公司: "subsidiary",
              獨立公司: "independent",
            }[row["公司關係"]] ||
            row["公司關係"] ||
            "independent",
          parentKey: row["母公司代號"] || row["主公司代號"] || "",
          templateName: row["參數模板"] || "",
          values,
          products: { groups: {}, rates: {}, combo: {}, sme: {} },
        };
        companies.push(c);
        targets.set("C:" + key, c);
      }
      const get = (row) => {
        const company = String(row["公司代號"] || "").trim(),
          template = String(row["模板名稱"] || "").trim();
        if (!!company === !!template)
          throw Error("產品設定須填寫公司代號或模板名稱，二者擇一");
        const t = targets.get(company ? "C:" + company : "T:" + template);
        if (!t) throw Error("產品設定找不到對象：" + (company || template));
        return t;
      };
      const seen = new Set();
      for (const row of sheets["產品費率"] || []) {
        if (!Object.values(row).some((v) => String(v || "").trim())) continue;
        const t = get(row),
          def = products.find((p) => p.label === row["產品項目"]),
          prefix = Object.entries(segment).find(
            ([, n]) => n === row["適用範圍"],
          )?.[0];
        if (!def || !prefix) throw Error("請從下拉選單選擇產品項目及適用範圍");
        const unique =
          (row["公司代號"] || row["模板名稱"]) + "|" + def.key + "|" + prefix;
        if (seen.has(unique))
          throw Error("產品適用範圍重複：" + def.label + " " + row["適用範圍"]);
        seen.add(unique);
        const p = t.products,
          ct = row["收費類型"] || def.r.ct || null,
          groupOn = yes(row["開通類別"]),
          on = yes(row["開通項目"]);
        if (p.groups[def.g.k] !== undefined && p.groups[def.g.k] !== groupOn)
          throw Error("同一產品類別的開通設定不一致");
        p.groups[def.g.k] = groupOn;
        p.rates[def.key] ??= { on, ct, v: {} };
        const st = p.rates[def.key];
        if (st.on !== on || st.ct !== ct)
          throw Error("同一產品的開通或收費類型不一致");
        for (const [head, suffix] of [
          ["費率（%）", "rate"],
          ["每筆費用（HKD）", "fix"],
          ["保底（HKD）", "min"],
          ["封頂（HKD）", "max"],
          ["Markup（%）", "markup"],
        ])
          if (String(row[head] ?? "").trim() !== "")
            st.v[prefix + "_" + suffix] =
              typeof row[head] === "number" &&
              ["rate", "fix", "markup"].includes(suffix)
                ? row[head].toFixed(2)
                : String(row[head]);
        if (prefix === "pref" || prefix.startsWith("t"))
          st.v[prefix + "_on"] = yes(row["啟用該範圍"]);
        if (def.r.upi) st.v.upi = yes(row["優計劃"]) ? "Y" : "N";
      }
      for (const row of sheets["產品功能"] || []) {
        if (!Object.values(row).some((v) => String(v || "").trim())) continue;
        const t = get(row),
          feature = String(row["功能項目"] || "");
        if (feature.startsWith("特計商戶 ")) {
          const brand = feature.slice(5);
          t.products.sme[brand] = {
            on: yes(row["開通"]),
            type: row["特計類型"],
          };
        } else if (feature === "產品類別開通") {
          const g = V2.catalog.GROUPS.find((x) => x.n === row["產品類別"]);
          if (!g) throw Error("產品類別不正確");
          const enabled = yes(row["開通"]);
          if (
            t.products.groups[g.k] !== undefined &&
            t.products.groups[g.k] !== enabled
          )
            throw Error("產品類別開通與費率列設定不一致");
          t.products.groups[g.k] = enabled;
        } else {
          const group = V2.catalog.GROUPS.find((g) => g.n === row["產品類別"]);
          if (!group || !group.combo?.includes(feature))
            throw Error("產品功能與類別不符");
          t.products.combo[group.k + "|" + feature] = yes(row["開通"]);
        }
      }
      const peopleSeen = new Set();
      for (const row of sheets["人員資料"] || []) {
        if (!Object.values(row).some((v) => String(v || "").trim())) continue;
        const t = get(row),
          group = Object.keys(personGroups).find(
            (k) => personGroups[k] === row["人員類型"],
          ),
          number = Number(row["序號"]);
        if (!group || !Number.isInteger(number) || number < 1 || number > 20)
          throw Error("人員資料須選擇類型，序號為 1–20");
        const unique =
          (row["公司代號"] ? "C:" : "T:") +
          (row["公司代號"] || row["模板名稱"]) +
          "|" +
          group +
          "|" +
          number;
        if (peopleSeen.has(unique)) throw Error("人員類型與序號重複");
        peopleSeen.add(unique);
        t.people ??= { directors: 1, authSigners: 0, shareHolders: 0 };
        t.people[group] = Math.max(t.people[group], number);
        for (const [k, label] of personFields) {
          const v = canonical(k, row[label]);
          if (v) t.values[group + "[" + (number - 1) + "]." + k] = v;
        }
      }
      for (const c of companies) {
        if (!c.values.mccCodes?.length) delete c.values.mccCodes;
        const p = c.products;
        if (
          !Object.keys(p.groups).length &&
          !Object.keys(p.rates).length &&
          !Object.keys(p.combo).length &&
          !Object.keys(p.sme).length
        )
          c.products = null;
      }
      return {
        format: "allinpay.merchant-bundle",
        version: 1,
        templates,
        companies,
      };
    }
    return {
      specs,
      common,
      templateFields,
      title,
      banks,
      products,
      segment,
      toSheets,
      fromSheets,
    };
  }
  return { create };
});


// SOURCE MODULE: merchant-workbook.js
const MW = MerchantWorkbookModel.create(V2, MT);
let workbookLibrary = null;
function loadWorkbookLibrary() {
  return (workbookLibrary ??= new Promise((resolve, reject) => {
    if (window.ExcelJS) return resolve(window.ExcelJS);
    const script = document.createElement("script");
    script.src = "./vendor/exceljs/exceljs.min.js";
    script.onload = () => resolve(window.ExcelJS);
    script.onerror = () => {
      workbookLibrary = null;
      reject(Error("Excel 讀取元件未能載入，請重試或使用 CSV"));
    };
    document.head.append(script);
  }));
}
async function readWorkbook(file) {
  const library = await loadWorkbookLibrary(),
    workbook = new library.Workbook();
  await workbook.xlsx.load(validateWorkbookArchive(await file.arrayBuffer()));
  const sheets = {};
  for (const spec of MW.specs) {
    const sheet = workbook.getWorksheet(spec.name);
    if (!sheet) continue;
    if (sheet.rowCount > 1005) throw Error("每個工作表最多 1,000 列資料");
    const heads = sheet
      .getRow(4)
      .values.slice(1)
      .map((v) =>
        String(v || "")
          .replace(/[＊*]/g, "")
          .trim(),
      );
    if (new Set(heads).size !== heads.length)
      throw Error(spec.name + " 有重複的標題");
    const rows = [];
    for (let row = 5; row <= sheet.rowCount; row++) {
      const object = {};
      heads.forEach((h, i) => {
        const cell = sheet.getCell(row, i + 1),
          value = cell.value;
        if (
          value &&
          typeof value === "object" &&
          value.formula &&
          !("result" in value)
        ) {
          object[h] = "";
          return;
        }
        const raw =
          value && typeof value === "object" && value.formula
            ? value.result
            : value;
        object[h] =
          raw instanceof Date
            ? raw.toISOString().slice(0, 10)
            : raw?.richText
              ? raw.richText.map((t) => t.text).join("")
              : raw?.text || (raw ?? "");
      });
      if (Object.values(object).some((v) => String(v).trim()))
        rows.push(object);
    }
    sheets[spec.name] = rows;
  }
  if (!sheets["商戶資料"] && !sheets["參數模板"])
    throw Error("請使用下載的 Excel 範本，保留工作表及第 4 列標題");
  return MW.fromSheets(sheets);
}
const readMerchantImport = mtReadImport;
function validateWorkbookArchive(bytes) {
  const view = new DataView(bytes);
  let end = -1;
  for (
    let i = view.byteLength - 22;
    i >= Math.max(0, view.byteLength - 65557);
    i--
  )
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw Error("Excel 文件格式不正確");
  const count = view.getUint16(end + 10, true);
  let position = view.getUint32(end + 16, true),
    total = 0;
  if (count > 2000) throw Error("Excel 文件項目過多");
  for (let i = 0; i < count; i++) {
    if (
      position + 46 > view.byteLength ||
      view.getUint32(position, true) !== 0x02014b50
    )
      throw Error("Excel 文件已損毀");
    total += view.getUint32(position + 24, true);
    if (total > 32 * 1048576)
      throw Error("Excel 解壓後資料超過上限，請分批匯入");
    position +=
      46 +
      view.getUint16(position + 28, true) +
      view.getUint16(position + 30, true) +
      view.getUint16(position + 32, true);
  }
  return bytes;
}
mtReadImport = async function (file) {
  if (!file) return;
  if (!/\.xlsx$/i.test(file.name)) return readMerchantImport(file);
  const sequence = ++mtImportSequence,
    owner = mtOwner();
  try {
    if (file.size > 2 * 1048576) throw Error("請選擇 2 MB 以下的 Excel 檔案");
    mtError("正在讀取 Excel 工作表…");
    const bundle = await readWorkbook(file);
    if (
      sequence !== mtImportSequence ||
      owner !== mtOwner() ||
      !$("#mt-import-file")
    )
      return;
    await readMerchantImport(
      new File([JSON.stringify(bundle)], "workbook.json", {
        type: "application/json",
      }),
    );
    if (mtImport) {
      mtImport.filename = file.name;
      mtImportResult();
      mtError("");
    }
  } catch (e) {
    mtError(e.message || "Excel 文件無法開啟，請使用下載的範本");
  }
};
function downloadWorkbook(name) {
  const a = document.createElement("a");
  a.href = "./import-templates/" + name;
  a.download = name;
  a.click();
}
async function exportMerchantWorkbook(template) {
  try {
    const library = await loadWorkbookLibrary(),
      book = new library.Workbook();
    await book.xlsx.load(
      await (
        await fetch("./import-templates/merchant-import-template.xlsx")
      ).arrayBuffer(),
    );
    const rows = MW.toSheets({ templates: [template], companies: [] });
    for (const spec of MW.specs) {
      const sheet = book.getWorksheet(spec.name);
      for (let i = 5; i <= sheet.rowCount; i++)
        sheet.getRow(i).eachCell((c) => {
          c.value = null;
        });
      (rows[spec.name] || []).forEach(
        (values, i) => (sheet.getRow(5 + i).values = values),
      );
    }
    const buffer = await book.xlsx.writeBuffer(),
      blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "merchant-template.xlsx";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (e) {
    mtError(e.message || "模板匯出失敗，請重試");
  }
}
actions["mt-excel-download"] = () =>
  downloadWorkbook("merchant-import-template.xlsx");
actions["mt-excel-example"] = () =>
  downloadWorkbook("merchant-import-example.xlsx");
actions["mt-export"] = (el) => {
  const template = mtTemplates().find((t) => t.id === el.dataset.id);
  if (template) void exportMerchantWorkbook(template);
};


// SOURCE MODULE: merchant-start.js
// Guided entry keeps starting a new merchant separate from editing an existing one.
let nsCopySource = "",
  nsCopyScopes = ["profile", "mcc", "settlement", "products"],
  nsCopyGroup = "",
  nsCopyQuery = "",
  nsCopyPage = 1,
  nsMode = "blank";
const nsCanStart = () => !!mtOwner() && (MT_EXTERNAL || can(1));
const nsIcon = (kind) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${kind === "new" ? '<path d="M12 5v14M5 12h14"/>' : kind === "copy" ? '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>' : '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12"/>'}</svg>`;
function nsGroupOf(values = {}, legacy = "") {
  const relation = values.__customer || {},
    name = relation.name || values.groupId || legacy || "";
  const known = Object.values(mtCustomerStore()[mtOwner()] || {}).find(
    (g) => g.id === relation.id || g.name === name,
  );
  return { id: known?.id || relation.id || name, name: known?.name || name };
}
function nsSources() {
  if (!nsCanStart()) return [];
  if (MT_EXTERNAL)
    return state.records
      .filter((r) => r.email === state.email)
      .map((r) => ({
        key: "record:" + r.id,
        name:
          r.values.merchantName ||
          r.values.companyZh ||
          r.values.merchantEnglishName ||
          "未命名商戶",
        group: nsGroupOf(r.values),
        status: r.status,
        snapshot: r,
      }));
  return [
    ...scopedDrafts().map((d) => ({
      key: "draft:" + d.id,
      name:
        d.values.merchantName || d.values.merchantEnglishName || "未命名草稿",
      group: nsGroupOf(d.values),
      status: "草稿",
      snapshot: d,
    })),
    ...scopedRows().map((r) => ({
      key: "row:" + rowKey(r),
      name: r["客戶中文名稱"] || r["客戶英文名稱"],
      group: nsGroupOf(r.application?.values, r["所屬集團"]),
      status: statusNames[r.status],
      snapshot: r.application || {
        values: {
          merchantName: r["客戶中文名稱"],
          merchantEnglishName: r["客戶英文名稱"],
          registerCertNo: r.BR,
          registerCertPeriod: r["BR 有效期"],
          dbaNo: r["DBA no."],
          groupId: r["所屬集團"],
          parentMerchant: r["上級商戶"],
          cardNo: r.bank,
          cardBranchCode: r["分行代碼"],
          mcc: r["MCC 行業代碼"]?.split(/[、,;]/)[0] || "",
          contactName: r["客戶聯繫人"],
          contactPhone: r["聯絡人電話"],
          contactEmail: r["聯絡人電郵"],
          cardBankName: r["銀行名稱"],
          cardBankCode: r["銀行代碼"],
        },
      },
    })),
  ];
}
function nsGroups() {
  const groups = new Map(
    mtCustomers().map((g) => [g.id, { id: g.id, name: g.name }]),
  );
  for (const source of nsSources())
    if (source.group.id && !groups.has(source.group.id))
      groups.set(source.group.id, source.group);
  return [...groups.values()];
}
const nsSearchText = (value) =>
  String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
function nsFilteredSources() {
  const query = nsSearchText(nsCopyQuery);
  return nsSources().filter(
    (source) =>
      (!nsCopyGroup || nsCopyGroup === "__none"
        ? !nsCopyGroup || !source.group.id
        : source.group.id === nsCopyGroup) &&
      (!query ||
        nsSearchText(
          [
            source.name,
            source.snapshot.values?.merchantEnglishName,
            source.group.name,
            source.snapshot.values?.registerCertNo,
          ].join(" "),
        ).includes(query)),
  );
}
function nsBlankState() {
  if (MT_EXTERNAL) newApplication();
  else v2Reset();
  state.readonly = false;
  state.errors = {};
  if (typeof bfSeed === "function") bfSeed();
}
function nsStartBlank(template = false) {
  if (!nsCanStart()) return deny();
  if (template) {
    mtStartTemplate = true;
    mtLibrary();
    return;
  }
  nsBlankState();
  nsMode = "blank";
  go("application/1");
}
function nsEnter() {
  go("application/1");
}
function nsCopyResults() {
  const list = nsFilteredSources(),
    size = 10,
    pages = Math.max(1, Math.ceil(list.length / size));
  nsCopyPage = Math.max(1, Math.min(pages, nsCopyPage));
  const shown = list.slice((nsCopyPage - 1) * size, nsCopyPage * size),
    matchingGroups = nsGroups().filter((g) =>
      nsSearchText(g.name).includes(nsSearchText(nsCopyQuery)),
    );
  const empty =
    (nsCopyGroup && nsCopyGroup !== "__none") ||
    (nsCopyQuery && matchingGroups.length)
      ? "這個客戶／集團尚沒有符合條件的已儲存商戶。請先儲存一家公司，或調整搜尋條件。"
      : "沒有符合的商戶，請調整公司或集團名稱。";
  return `<div class="ns-result-meta" role="status" aria-live="polite">找到 ${list.length} 家商戶${list.length ? " · 顯示 " + ((nsCopyPage - 1) * size + 1) + "–" + Math.min(nsCopyPage * size, list.length) : ""}</div><div class="ns-source-list" role="radiogroup" aria-label="來源商戶">${shown.map((source) => `<label class="ns-source-row ${source.key === nsCopySource ? "selected" : ""}"><input type="radio" name="ns-source" data-ns-source value="${esc(source.key)}" ${source.key === nsCopySource ? "checked" : ""}><span><strong>${esc(source.name)}</strong><small>${esc(source.group.name || "未分組")}${source.snapshot.values?.merchantEnglishName ? " · " + esc(source.snapshot.values.merchantEnglishName) : ""}</small></span><span class="status gray">${esc(source.status || "已有商戶")}</span></label>`).join("") || `<p class="ns-empty">${empty}</p>`}</div>${pages > 1 ? `<div class="ns-source-pages">${btn("上一頁", "ns-copy-page", "", `data-page="${nsCopyPage - 1}" ${nsCopyPage === 1 ? "disabled" : ""}`)}<span>${nsCopyPage}／${pages}</span>${btn("下一頁", "ns-copy-page", "", `data-page="${nsCopyPage + 1}" ${nsCopyPage === pages ? "disabled" : ""}`)}</div>` : ""}`;
}
function nsRefreshCopy() {
  const host = $("#ns-source-results");
  if (!host) return;
  const focused = document.activeElement?.matches("[data-ns-source]")
    ? document.activeElement.value
    : null;
  host.innerHTML = nsCopyResults();
  if (focused)
    [...host.querySelectorAll("[data-ns-source]")]
      .find((input) => input.value === focused)
      ?.focus({ preventScroll: true });
  const source = nsSources().find((s) => s.key === nsCopySource);
  $("#ns-source-preview").textContent = source
    ? "已選「" + source.name + "」；確認後完整複製來源已儲存的表單資料及費率。"
    : "請選擇來源商戶，確認後才會建立新的申請。";
}
function nsCopyOpen() {
  if (!nsCanStart()) return deny();
  nsCopySource = "";
  nsCopyGroup = "";
  nsCopyQuery = "";
  nsCopyPage = 1;
  nsCopyScopes = ["profile", "mcc", "settlement", "products"];
  mtDialog(
    "複製已有商戶",
    `<p>先選客戶／集團，再搜尋來源商戶。只沿用來源已儲存的資料；缺少的項目會保持空白。</p><div class="grid"><div class="field"><label for="ns-copy-group">1 選擇客戶／集團</label><select id="ns-copy-group"><option value="">全部客戶／集團</option><option value="__none">未分組商戶</option>${nsGroups()
      .map((g) => `<option value="${esc(g.id)}">${esc(g.name)}</option>`)
      .join(
        "",
      )}</select></div><div class="field"><label for="ns-source-search">2 搜尋並選擇來源商戶</label><input id="ns-source-search" type="search" placeholder="公司、英文名稱、集團或 BR"></div></div><div id="ns-source-results">${nsCopyResults()}</div><p id="ns-source-preview" class="hint">請選擇來源商戶，確認後才會建立新的申請。</p><div class="notice">完整複製公司資料、BR、董事／人員、結算帳戶及產品費率。簽署、驗證與審批須重新完成；來源商戶不會被修改。附件原件只在目前瀏覽器可用，未保留的文件須重新上傳。</div>`,
    btn("取消", "mt-close") +
      btn("確認複製並開始填寫", "ns-copy-confirm", "primary"),
  );
}
function nsCopyConfirm() {
  try {
    if (!nsCanStart()) return deny();
    const source = nsSources().find((s) => s.key === nsCopySource);
    if (!source) throw Error("請先選擇來源商戶");
    const saved = mtUpgradeSnapshot(structuredClone(source.snapshot)),
      files =
        typeof clientFilesFor === "function"
          ? clientFilesFor(source.key, saved.files || {})
          : {};
    nsBlankState();
    Object.assign(state, {
      values: structuredClone(saved.values || {}),
      people: structuredClone(
        saved.people || { directors: 1, authSigners: 0, shareHolders: 0 },
      ),
      files: structuredClone(saved.files || {}),
      checks: {},
      emailVerified: false,
      signature: "",
      errors: {},
      readonly: false,
      editing: null,
      draftId: null,
      savedAt: null,
    });
    if (MT_EXTERNAL) {
      state.id = null;
      state.step = 1;
    }
    v2Ensure();
    state.values.signer = "";
    state.values.signerTitle = "";
    delete state.values.__templateApplied;
    state.baseFeeDefaults = null;
    delete state.values.__baseFees;
    delete state.values.__copiedFrom;
    v2Model().ack = {};
    v2Model().ocr = [];
    DEMO.fileURLs.clear();
    DEMO.sourceFiles?.clear();
    for (const [id, f] of Object.entries(state.files)) {
      const original = files[id];
      if (original) {
        const url = URL.createObjectURL(original);
        DEMO.fileURLs.set(id, url);
        DEMO.sourceFiles.set(id, { file: original, url });
        f.needsReselect = false;
      } else if (!f.demo) f.needsReselect = true;
    }
    v2SyncDerived();
    nsMode = "copy";
    mtClose();
    go("application/1");
    toast("已複製全部已儲存資料及來源費率，請核對本次申請");
  } catch (e) {
    mtError(e.message);
  }
}
const nsConfirmTemplate = mtConfirmApply;
mtConfirmApply = function () {
  if (!mtStartTemplate || mtFlow?.kind !== "form") return nsConfirmTemplate();
  try {
    if (!mtFlow.preview) throw Error("請先預覽套用內容");
    const template = mtTemplates().find((t) => t.id === mtFlow.templateId);
    if (!template) throw Error("模板已變更，請重新選擇");
    const plan = mtPrepare(template, [mtCurrentTarget()])[0];
    nsBlankState();
    Object.assign(state, {
      values: plan.snapshot.values,
      people: plan.snapshot.people,
      files: {},
      checks: {},
      emailVerified: false,
      signature: "",
      errors: {},
    });
    nsMode = "template";
    mtClose();
    v2SyncDerived();
    go("application/1");
    toast("已確認模板，請核對並繼續填寫");
  } catch (e) {
    mtError(e.message);
  }
};
Object.assign(actions, {
  "ns-blank": () => nsStartBlank(),
  "ns-template": () => nsStartBlank(true),
  "ns-copy-open": nsCopyOpen,
  "ns-copy-confirm": nsCopyConfirm,
  "ns-copy-page": (el) => {
    nsCopyPage = +el.dataset.page;
    nsRefreshCopy();
  },
  "ns-enter": nsEnter,
  "ns-back": () => go("application/1"),
  "mt-apply-confirm": mtConfirmApply,
  "ns-drafts": () => go(MT_EXTERNAL ? "applications" : "drafts"),
});
actions.new = () => nsStartBlank();
if (!MT_EXTERNAL) {
  const nsSidebar = sidebar,
    nsTabs = tabs;
  sidebar = (page) =>
    nsSidebar(
      ["new-merchant", "merchant-setup"].includes(page) ? "application" : page,
    ).replace(
      'href="#/application/1"',
      'href="#/application/1" data-action="new"',
    );
  tabs = (page) =>
    nsTabs(
      ["new-merchant", "merchant-setup"].includes(page) ? "application" : page,
    );
}
const nsRender = render;
render = function () {
  if (["new-merchant", "merchant-setup"].includes(route().page))
    history.replaceState(
      null,
      "",
      "#/" + (MT_EXTERNAL ? "form" : "application") + "/1",
    );
  nsRender();
};
document.addEventListener("input", (e) => {
  if (e.target.id === "ns-source-search") {
    nsCopyQuery = e.target.value;
    nsCopyPage = 1;
    nsCopySource = "";
    nsRefreshCopy();
  }
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "ns-copy-group") {
    nsCopyGroup = t.value;
    nsCopyPage = 1;
    nsCopySource = "";
    nsRefreshCopy();
  }
  if (t.dataset.nsSource !== undefined) {
    nsCopySource = t.value;
    nsRefreshCopy();
  }
  if (t.dataset.nsScope)
    nsCopyScopes = t.checked
      ? [...nsCopyScopes, t.dataset.nsScope]
      : nsCopyScopes.filter((k) => k !== t.dataset.nsScope);
});
function nsStepperHTML(current, external = false) {
  const pages = onboardingFillProgress().pages;
  return `<nav class="${external ? "external-v2-steps" : "stepper"} ns-progress" aria-label="申請步驟">${pages
    .map((p) => {
      const complete = p.optional
          ? p.files > 0
          : p.total > 0 && !p.missing.length,
        active = p.step === current;
      return `<button type="button" class="step ${active ? "active" : ""} ${complete ? "done" : ""}" data-action="step" data-step="${p.step}" data-step-state="${active ? "current" : complete ? "complete" : "pending"}" ${active ? 'aria-current="step"' : ""} aria-label="${p.step} ${esc(p.name)}${complete ? "，資料已完成" : ""}"><span class="number">${p.step}</span><span class="step-text">${esc(p.name)}</span></button>`;
    })
    .join("")}</nav>`;
}
if (!MT_EXTERNAL) stepper = (current) => nsStepperHTML(current);
let nsProgressQueued = false;
function nsUpdateProgress() {
  if (nsProgressQueued || route().page !== "application") return;
  nsProgressQueued = true;
  requestAnimationFrame(() => {
    nsProgressQueued = false;
    const nav = $(".ns-progress");
    if (nav && !document.activeElement?.closest(".ns-progress"))
      nav.outerHTML = nsStepperHTML(route().step, MT_EXTERNAL);
  });
}
for (const event of ["input", "change"])
  document.addEventListener(event, (e) => {
    if (e.target.closest(".v2-form")) nsUpdateProgress();
  });


// SOURCE MODULE: notifications.js
// Station notifications for the local demo. Reading never changes merchant state.
const NF_KEY = "meepay-dev2-20261117-allinpay-station-notifications-v1";
let nfTab = "all",
  nfActiveOwner = "",
  nfVolatile = {};
const nfHash = (value) => {
  let h = 2166136261;
  for (const c of String(value)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
};
function nfStore() {
  try {
    const value = JSON.parse(localStorage.getItem(NF_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  } catch {
    return {};
  }
}
function nfAccount() {
  const owner = mtOwner();
  return {
    ...{ events: [], read: {} },
    ...(nfStore()[owner] || {}),
    ...(nfVolatile[owner] || {}),
  };
}
function nfSave(account) {
  const owner = mtOwner();
  if (!owner) return;
  nfVolatile[owner] = account;
  try {
    const store = nfStore();
    store[owner] = account;
    localStorage.setItem(NF_KEY, JSON.stringify(store));
    delete nfVolatile[owner];
  } catch {
    /* Notification storage must not block business operations. */
  }
}
function nfPush(event) {
  try {
    if (!mtOwner()) return;
    const a = nfAccount(),
      id = event.id || "event:" + crypto.randomUUID();
    a.events = [
      { ...event, id, time: new Date().toISOString() },
      ...a.events.filter((e) => e.id !== id),
    ].slice(0, 100);
    nfSave(a);
    nfRefresh();
  } catch {}
}
function nfEntity(id) {
  return MT_EXTERNAL
    ? state.records.find((r) => r.id === id && r.email === state.email)
    : accessibleRow(id) || scopedDrafts().find((d) => d.id === id);
}
function nfFeed() {
  if (!mtOwner()) return [];
  const account = nfAccount(),
    events = account.events
      .filter((e) => !e.ids?.length || e.ids.some((id) => !!nfEntity(id)))
      .map((e) => ({
        ...e,
        needsAction:
          !!e.needsAction &&
          (e.type === "sync"
            ? e.ids.some((id) =>
                ["SyncFailed", "Syncing", "AwaitingResponse"].includes(
                  nfEntity(id)?.status,
                ),
              )
            : e.type === "review"
              ? e.ids.some((id) =>
                  ["Pending", "MoreInfo", "Approved"].includes(
                    nfEntity(id)?.status,
                  ),
                )
              : true),
      }));
  const tasks = [];
  const add = (
    id,
    type,
    title,
    description,
    list,
    target,
    severity = "info",
    needsAction = true,
  ) => {
    if (list.length)
      tasks.push({
        id: "task:" + id,
        type,
        title,
        description,
        ids: list.map((r) => (MT_EXTERNAL ? r.id : rowKey(r))),
        target,
        severity,
        needsAction,
        current: true,
      });
  };
  if (MT_EXTERNAL) {
    const list = state.records.filter((r) => r.email === state.email);
    add(
      "drafts",
      "application",
      "尚有 " +
        list.filter((r) => r.status === "草稿").length +
        " 份草稿待完成",
      "可從上次儲存的位置繼續填寫。",
      list.filter((r) => r.status === "草稿"),
      "drafts",
    );
    for (const status of ["審核中", "已完成"]) {
      const items = list.filter((r) => r.status === status);
      add(
        status,
        "application",
        items.length + " 份申請" + status,
        status === "已完成"
          ? "可查看已完成的 Demo 申請與資料。"
          : "申請已提交，等待審核回應。",
        items,
        "applications",
        "info",
        false,
      );
    }
  } else {
    const list = scopedRows();
    for (const [status, type, label, description, severity] of [
      [
        "SyncFailed",
        "sync",
        "同步失敗",
        "請核對失敗原因與銀行資料，再重新同步。",
        "error",
      ],
      [
        "MoreInfo",
        "application",
        "待補資料",
        "請依補件清單補齊後重新提交。",
        "warning",
      ],
      [
        "Pending",
        "review",
        "待審核",
        can(7)
          ? "可進入商戶資料或內審控制台處理。"
          : "申請已提交，等待有權限的同事審核。",
        "info",
      ],
      [
        "Approved",
        "sync",
        "審核通過，等待同步",
        "核對設定後，可同步至 All-In Pay。",
        "info",
      ],
      [
        "AwaitingResponse",
        "sync",
        "等待 All-In Pay 回應",
        "可查詢處理結果；尚未收到成功回應前不會產生 MID。",
        "warning",
      ],
    ]) {
      const items = list.filter((r) => r.status === status);
      add(
        status,
        type,
        items.length + " 家商戶" + label,
        description,
        items,
        "status:" + status,
        severity,
      );
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiring = list.filter((r) => {
      const raw = r.application?.values?.registerCertPeriod || r["BR 有效期"],
        match = String(raw || "").match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
      if (!match) return false;
      const days =
        (new Date(+match[1], +match[2] - 1, +match[3]) - today) / 86400000;
      return days <= 30;
    });
    add(
      "expiry",
      "expiry",
      expiring.length + " 家商戶 BR 已到期或將於 30 天內到期",
      "請核對證照有效期，並更新文件與到期日。",
      expiring,
      "expiry",
      "warning",
    );
  }
  return [...events, ...tasks].map((n) => {
    const fingerprint = nfHash(
      JSON.stringify([n.title, n.description, n.ids, n.needsAction, n.time]),
    );
    return { ...n, fingerprint, unread: account.read[n.id] !== fingerprint };
  });
}
const nfTypeName = (type) =>
  ({
    application: "申請與補件",
    review: "審核",
    sync: "同步與 MID",
    expiry: "證照提醒",
    batch: "批量作業",
    import: "資料匯入",
  })[type] || "系統";
function nfRead(id) {
  const item = nfFeed().find((n) => n.id === id);
  if (!item) return;
  const a = nfAccount();
  a.read[item.id] = item.fingerprint;
  nfSave(a);
  nfRefresh();
}
function nfPanel() {
  let node = $("#nf-center");
  if (node) return node;
  node = document.createElement("dialog");
  node.id = "nf-center";
  node.setAttribute("aria-labelledby", "nf-title");
  document.body.append(node);
  node.addEventListener("click", (e) => {
    if (e.target === node) {
      const b = node.getBoundingClientRect();
      if (
        e.clientX < b.left ||
        e.clientX > b.right ||
        e.clientY < b.top ||
        e.clientY > b.bottom
      )
        node.close();
    }
  });
  return node;
}
function nfPaint() {
  const node = nfPanel(),
    all = nfFeed(),
    unread = all.filter((n) => n.unread).length,
    todo = all.filter((n) => n.needsAction).length,
    list = all.filter((n) =>
      nfTab === "unread" ? n.unread : nfTab === "todo" ? n.needsAction : true,
    );
  node.innerHTML = `<header class="nf-head"><div><h2 id="nf-title">通知中心</h2><p>${unread} 則未讀 · ${todo} 項待處理</p></div>${btn("×", "nf-close", "nf-close", 'aria-label="關閉通知中心"')}</header><nav class="nf-tabs" aria-label="通知分類">${[
    ["all", "全部", all.length],
    ["unread", "未讀", unread],
    ["todo", "待處理", todo],
  ]
    .map(([key, label, count]) =>
      btn(
        label + " <span>" + count + "</span>",
        "nf-tab",
        nfTab === key ? "active" : "",
        `data-tab="${key}" aria-pressed="${nfTab === key}"`,
      ),
    )
    .join(
      "",
    )}</nav><div class="nf-tools"><span>已讀不會清除待辦</span>${btn("全部標為已讀", "nf-read-all", "", unread ? "" : "disabled")}</div><div class="nf-list">${list.map((n) => `<article class="nf-item ${n.unread ? "unread" : ""}" data-nf-item="${esc(n.id)}"><div class="nf-item-meta"><span class="nf-category ${esc(n.severity || "info")}">${nfTypeName(n.type)}</span><span>${n.current ? "目前待辦" : esc(new Date(n.time).toLocaleString("zh-TW", { hour12: false }))}</span>${n.unread ? '<b class="nf-dot" aria-label="未讀"></b>' : ""}</div><h3>${esc(n.title)}</h3><p>${esc(n.description || "")}</p><div class="nf-item-foot"><span class="${n.needsAction ? "nf-pending" : "nf-done"}">${n.needsAction ? "待處理" : "作業記錄"}</span><div>${n.unread ? btn("標為已讀", "nf-read", "", `data-nf-id="${esc(n.id)}"`) : ""}${btn(n.needsAction ? "前往處理" : "查看詳情", "nf-view", "primary", `data-nf-id="${esc(n.id)}"`)}</div></div></article>`).join("") || '<div class="nf-empty"><strong>' + (nfTab === "unread" ? "目前沒有未讀通知" : nfTab === "todo" ? "目前沒有待處理事項" : "目前沒有通知") + "</strong><p>申請、審核、同步及批量作業的結果會集中顯示於此。</p></div>"}</div><footer class="nf-foot">Demo 站內通知 · 僅記錄此瀏覽器的模擬作業</footer>`;
}
const nfBell = () =>
  `<button type="button" class="nf-bell" data-action="nf-open" aria-label="開啟通知中心" title="通知中心"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span class="nf-badge" hidden></span></button>`;
function nfRefresh() {
  if (!mtOwner()) return;
  const count = nfFeed().filter((n) => n.unread).length;
  for (const bell of $$(".nf-bell")) {
    bell.setAttribute("aria-label", "通知中心，" + count + " 則未讀");
    const badge = bell.querySelector(".nf-badge");
    badge.hidden = !count;
    badge.textContent = count > 99 ? "99+" : count;
  }
  if ($("#nf-center")?.open) nfPaint();
}
function nfMount() {
  const owner = mtOwner();
  if (!owner) {
    $("#nf-center")?.close();
    nfActiveOwner = "";
    return;
  }
  if (nfActiveOwner !== owner) {
    $("#nf-center")?.close();
    nfTab = "all";
    nfActiveOwner = owner;
  }
  if (!$(".nf-bell")) {
    if (MT_EXTERNAL) {
      $(".header-actions")?.insertAdjacentHTML("afterbegin", nfBell());
    } else {
      const tab = $(".main>.tabs");
      if (tab) {
        const wrap = document.createElement("div");
        wrap.className = "nf-header";
        tab.before(wrap);
        wrap.append(tab);
        wrap.insertAdjacentHTML("beforeend", nfBell());
      } else
        $(".main")?.insertAdjacentHTML(
          "afterbegin",
          '<div class="nf-standalone-bar">' + nfBell() + "</div>",
        );
    }
  }
  nfRefresh();
}
function nfView(el) {
  const item = nfFeed().find((n) => n.id === el.dataset.nfId);
  if (!item) return;
  nfRead(item.id);
  $("#nf-center").close();
  if (MT_EXTERNAL) {
    const record = item.ids?.map(nfEntity).find(Boolean);
    if (record && !item.current) loadRecord(record);
    else go("applications");
    return;
  }
  const status = item.target?.startsWith("status:") ? item.target.slice(7) : "";
  if (status || item.target === "expiry") {
    state.search = "";
    state.searchScope = "全部欄位";
    state.status = status ? statusNames[status] : "全部狀態";
    state.page = 1;
    DEMO.columnFilters =
      item.target === "expiry"
        ? {
            "BR 有效期": [
              ...new Set(
                scopedRows()
                  .filter((r) => item.ids.includes(rowKey(r)))
                  .map((r) => cellValue(r, "BR 有效期")),
              ),
            ],
          }
        : {};
    go("merchants");
    return;
  }
  const row = item.ids?.map((id) => accessibleRow(id)).find(Boolean);
  if (row) {
    detail(rowKey(row));
    return;
  }
  if (
    item.target === "drafts" ||
    item.ids?.some((id) => scopedDrafts().some((d) => d.id === id))
  )
    go("drafts");
  else go("activity");
}
Object.assign(actions, {
  "nf-open": () => {
    nfTab = "all";
    nfPaint();
    nfPanel().showModal();
    $('#nf-center [data-action="nf-close"]').focus();
  },
  "nf-close": () => $("#nf-center").close(),
  "nf-tab": (el) => {
    nfTab = el.dataset.tab;
    nfPaint();
  },
  "nf-read": (el) => nfRead(el.dataset.nfId),
  "nf-read-all": () => {
    const a = nfAccount();
    for (const n of nfFeed()) a.read[n.id] = n.fingerprint;
    nfSave(a);
    nfRefresh();
  },
  "nf-view": nfView,
});
const nfRender = render;
render = function () {
  nfRender();
  nfMount();
};
// Completed actions only: a preview or an unsuccessful validation does not notify.
const nfSubmit = actions["confirm-submit"];
actions["confirm-submit"] = (el) => {
  const before = MT_EXTERNAL
    ? new Map(state.records.map((r) => [r.id, r]))
    : new Map(rows.map((r) => [rowKey(r), r.status]));
  nfSubmit(el);
  if ($("#modal-title")?.textContent !== "申請提交成功") return;
  const row = MT_EXTERNAL
    ? state.records.find((r) => r.id === state.id && r.status !== "草稿")
    : rows.find(
        (r) =>
          r.status === "Pending" &&
          (!before.has(rowKey(r)) || rowKey(r) === state.editing),
      );
  if (row) {
    const id = MT_EXTERNAL ? row.id : rowKey(row);
    nfPush({
      id: "submit:" + id,
      type: "application",
      title:
        "申請已提交 · " +
        (MT_EXTERNAL
          ? row.values.merchantName ||
            row.values.companyZh ||
            row.values.companyEn
          : row["客戶中文名稱"]),
      description: "已建立 Demo 申請，等待審核；可查看提交資料及目前進度。",
      ids: [id],
      target: "entity",
    });
  }
};
if (!MT_EXTERNAL) {
  const nfReview = actions["review-save"];
  actions["review-save"] = (el) => {
    const id = DEMO.review?.mid,
      before = accessibleRow(id)?.status;
    nfReview(el);
    const row = accessibleRow(id);
    if (row && row.status !== before)
      nfPush({
        id: "review:" + id,
        type: "review",
        title: "審核結果 · " + row["客戶中文名稱"],
        description:
          statusNames[row.status] +
          (row.reviewNote ? " · " + row.reviewNote : ""),
        ids: [id],
        target: "entity",
        needsAction: ["MoreInfo", "Approved"].includes(row.status),
        severity: row.status === "MoreInfo" ? "warning" : "info",
      });
  };
  const nfIrSave = actions["ir-save"];
  actions["ir-save"] = (el) => {
    const id = IR.pending?.mid,
      before = accessibleRow(id)?.internalReview?.revision || 0;
    nfIrSave(el);
    const row = accessibleRow(id);
    if (row && (row.internalReview?.revision || 0) > before)
      nfPush({
        id: "review:" + id,
        type: "review",
        title: "內審結果 · " + row["客戶中文名稱"],
        description: row.internalReview.trail.at(-1).message,
        ids: [id],
        target: "entity",
        needsAction: ["Pending", "MoreInfo", "Approved"].includes(row.status),
        severity: row.status === "MoreInfo" ? "warning" : "info",
      });
  };
  const nfSettle = settleDemoSync;
  settleDemoSync = (kind) => {
    const ids = (BO.syncPending || []).filter((id) =>
      ["Syncing", "AwaitingResponse"].includes(accessibleRow(id)?.status),
    );
    nfSettle(kind);
    if (!ids.length || !can(8)) return;
    nfPush({
      id: "sync:" + nfHash([...ids].sort().join("|")),
      type: "sync",
      title:
        kind === "success"
          ? ids.length + " 家商戶同步完成，已取得 MID"
          : kind === "fail"
            ? ids.length + " 家商戶同步失敗"
            : ids.length + " 家商戶等待 All-In Pay 回應",
      description:
        kind === "success"
          ? "可查看 All-In Pay 模擬回傳的 MID。"
          : kind === "fail"
            ? "請核對失敗原因與銀行資料後重試。"
            : "尚未收到成功回應，請稍後查詢結果。",
      ids,
      target:
        ids.length > 1
          ? "status:" +
            (kind === "success"
              ? "Synced"
              : kind === "fail"
                ? "SyncFailed"
                : "AwaitingResponse")
          : "entity",
      needsAction: kind !== "success",
      severity:
        kind === "fail" ? "error" : kind === "wait" ? "warning" : "info",
    });
  };
}
const nfWrite = mtWriteTargets;
mtWriteTargets = function (plans, message) {
  const ids = plans.map((p) => p.id).filter(Boolean),
    id = "batch:" + nfHash([...ids].sort().join("|"));
  try {
    const result = nfWrite(plans, message);
    nfPush({
      id,
      type: "batch",
      title: plans.length + " 家商戶已套用參數模板",
      description: message + "；每家公司仍需獨立核對及提交。",
      ids,
      target: "drafts",
    });
    return result;
  } catch (e) {
    nfPush({
      id,
      type: "batch",
      title: plans.length + " 家商戶批量套用失敗",
      description: "所有設定仍保留原值。請返回模板批量設定後重試。",
      ids,
      target: "drafts",
      needsAction: true,
      severity: "error",
    });
    throw e;
  }
};
const nfImport = actions["mt-import-confirm"];
actions["mt-import-confirm"] = (el) => {
  const before = new Set(
    (MT_EXTERNAL ? state.records : state.drafts).map((r) => r.id),
  );
  nfImport(el);
  const additions = (
    MT_EXTERNAL
      ? state.records.filter((r) => r.email === state.email)
      : scopedDrafts()
  ).filter((r) => !before.has(r.id));
  if (additions.length)
    nfPush({
      id:
        "import:" +
        nfHash(
          additions
            .map((r) => r.id)
            .sort()
            .join("|"),
        ),
      type: "import",
      title: "已匯入 " + additions.length + " 家公司草稿",
      description: "母／子公司關係、MCC 及產品費率已帶入。可前往草稿核對。",
      ids: additions.map((r) => r.id),
      target: "drafts",
    });
};
window.addEventListener("storage", (e) => {
  if ([NF_KEY, MT_EXTERNAL ? KEY : DBKEY].includes(e.key)) nfRefresh();
});


// SOURCE MODULE: client-review.js
// Customer review, October 30: base rates are local Demo configuration, not live pricing.
const BF_KEY = "meepay-dev2-20261117-allinpay-base-fees-20261030-v1";
function bfRead() {
  try {
    return (
      JSON.parse(localStorage.getItem(BF_KEY)) || { rates: {}, revision: 0 }
    );
  } catch {
    return { rates: {}, revision: 0 };
  }
}
function bfCanEdit() {
  return (
    !MT_EXTERNAL &&
    !!BO.user &&
    [roles[0], roles[1]].includes(BO.user.role) &&
    can(10)
  );
}
function bfClean(rates) {
  const clean = {};
  for (const [key, st] of Object.entries(rates || {})) {
    const def = MW.products.find((p) => p.key === key);
    if (!def) continue;
    const values = {};
    for (const [field, value] of Object.entries(st.v || {})) {
      if (/_(rate|fix|min|max|markup)$/.test(field)) {
        const n = Number(value);
        if (
          value !== "" &&
          (!Number.isFinite(n) ||
            n < 0 ||
            (/_(rate|markup)$/.test(field) && n > 100))
        )
          throw Error(def.label + "：費率須為 0–100，其他金額不得小於 0");
        values[field] = value === "" ? "0.00" : String(value);
      } else values[field] = value;
    }
    clean[key] = { ct: st.ct || def.r.ct || null, v: values };
  }
  return clean;
}
// Defaults change values only. The platform product catalog, fields and choices remain unchanged.
function bfSeed() {
  state.baseFeeDefaults = structuredClone(bfRead().rates || {});
  delete state.values.__baseFees;
  delete state.values.__copiedFrom;
}
const bfReset = v2Reset;
v2Reset = function () {
  bfReset();
  bfSeed();
};
const bfOriginalGroup = v2SetGroup;
v2SetGroup = function (key, on) {
  const previous = new Set(Object.keys(v2Model().rates));
  bfOriginalGroup(key, on);
  if (
    !on ||
    !state.baseFeeDefaults ||
    v2Model().legacy ||
    state.editing ||
    state.draftId ||
    (MT_EXTERNAL && state.id)
  )
    return;
  for (const [id, st] of Object.entries(v2Model().rates))
    if (!previous.has(id) && state.baseFeeDefaults[id]) {
      st.ct = state.baseFeeDefaults[id].ct || st.ct;
      st.v = structuredClone(state.baseFeeDefaults[id].v || {});
    }
};
if (!Object.keys(v2Model().rates).length && !v2Raw("merchantName")) bfSeed();
// Keep raw files per application in this tab only. Saved storage holds metadata only.
const clientFileRecords = new Map();
function clientRememberFiles(key, files = state.files) {
  clientBindFiles();
  const originals = {};
  for (const [id, meta] of Object.entries(files)) {
    const source = DEMO.sourceFiles?.get(id);
    if (
      source?.file &&
      source.fileToken &&
      source.fileToken === state.files[id]?.localFileToken &&
      source.file.name === meta.name &&
      source.file.size === meta.size &&
      !meta.needsReselect
    )
      originals[id] = { file: source.file, token: source.fileToken };
  }
  clientFileRecords.set(key, originals);
}
function clientFilesFor(key, metadata) {
  const found = clientFileRecords.get(key) || {};
  return Object.fromEntries(
    Object.entries(found)
      .filter(
        ([id, entry]) =>
          metadata[id]?.localFileToken === entry.token &&
          metadata[id]?.name === entry.file.name &&
          metadata[id]?.size === entry.file.size,
      )
      .map(([id, entry]) => [id, entry.file]),
  );
}
function clientBindFiles() {
  const keys = MT_EXTERNAL
    ? ["record:" + state.id]
    : [
        "row:" + state.editing,
        "draft:" + state.draftId,
        "draft:" +
          rows.find((r) => rowKey(r) === state.editing)?.application?.id,
      ];
  for (const [id, meta] of Object.entries(state.files || {})) {
    if (meta.demo) continue;
    const active = DEMO.sourceFiles?.get(id);
    if (
      active?.file &&
      !active.fileToken &&
      active.file.name === meta.name &&
      active.file.size === meta.size &&
      !meta.needsReselect
    ) {
      active.fileToken = crypto.randomUUID();
      meta.localFileToken = active.fileToken;
    }
    if (active?.fileToken && active.fileToken === meta.localFileToken) {
      meta.needsReselect = false;
      continue;
    }
    const file = keys
      .map((key) => clientFilesFor(key, state.files)[id])
      .find(Boolean);
    if (file) {
      const url = URL.createObjectURL(file);
      DEMO.fileURLs.set(id, url);
      DEMO.sourceFiles.set(id, { file, url, fileToken: meta.localFileToken });
      meta.needsReselect = false;
    } else {
      meta.needsReselect = true;
      DEMO.fileURLs.delete(id);
    }
  }
}
const clientFileRender = render;
render = function () {
  clientBindFiles();
  return clientFileRender();
};
if (MT_EXTERNAL) {
  const old = snapshot;
  snapshot = function (status) {
    clientBindFiles();
    const result = old(status);
    clientRememberFiles("record:" + result.id, result.files);
    return result;
  };
} else {
  const old = draftSnapshot;
  draftSnapshot = function (id) {
    clientBindFiles();
    const result = old(id);
    clientRememberFiles("draft:" + result.id, result.files);
    if (state.editing)
      clientRememberFiles("row:" + state.editing, result.files);
    return result;
  };
}
if (!MT_EXTERNAL) {
  function clientReviewFile(r, index = IR.doc) {
    const code = irDocTypes[index][1],
      meta = r.application?.files || {},
      doc = V2.documents.find(
        (d) => d.code === code || d.id === code || d.name.includes(code),
      ),
      id = doc?.id || Object.keys(meta).find((k) => k.includes(code));
    const raw =
      clientFilesFor("row:" + rowKey(r), meta)[id] ||
      clientFilesFor("draft:" + r.application?.id, meta)[id];
    return {
      meta: meta[id],
      raw,
      id,
      blocked: !!raw && ["140401", "141301"].includes(code) && !can(5),
    };
  }
  const originalDocument = irDocument,
    previewURLs = new WeakMap();
  irDocument = function (r, index = IR.doc) {
    const f = clientReviewFile(r, index);
    if (f.blocked)
      return '<div class="notice warn">查看銀行文件原件需要完整銀行帳號權限。</div>';
    if (f.raw) {
      let url = previewURLs.get(f.raw);
      if (!url) {
        url = URL.createObjectURL(f.raw);
        previewURLs.set(f.raw, url);
      }
      return `<p class="hint">上傳原文件 · ${esc(f.raw.name)}</p>${/\.pdf$/i.test(f.raw.name) ? `<iframe class="br-pdf-preview" src="${esc(url)}" title="${esc(f.raw.name)}"></iframe>` : `<img class="document-preview" src="${esc(url)}" alt="${esc(f.raw.name)}">`}`;
    }
    if (f.meta && !f.meta.demo)
      return '<div class="notice warn">原文件未保留，請重新上傳後查看或下載。</div>';
    return originalDocument(r, index);
  };
  const originalDetail = irDetail;
  irDetail = function (r) {
    const f = clientReviewFile(r),
      label = irDocTypes[IR.doc][0],
      description = f.blocked
        ? "查看銀行原件需要完整銀行帳號權限"
        : f.raw
          ? "下載上傳原文件"
          : f.meta && !f.meta.demo
            ? "原件未保留，請重新上傳"
            : "Demo 示例文件，非商戶原件";
    const template = document.createElement("template");
    template.innerHTML = originalDetail(r);
    const section = template.content.firstElementChild,
      title = section.querySelector("#ir-company"),
      summary = title.nextElementSibling,
      header = document.createElement("div");
    header.className = "ir-case-header";
    header.innerHTML = `<div class="ir-case-identity"></div><div class="ir-case-download">${btn("下載文件", "ir-download", "primary", `aria-label="下載文件：${esc(label)}" ${f.blocked ? "disabled" : ""}`)}<small>目前選取：${esc(label)}</small><small>${esc(description)}</small></div>`;
    header.firstElementChild.append(title, summary);
    section.prepend(header);
    return section.outerHTML;
  };
  actions["ir-download"] = () => {
    const r = irCurrent();
    if (!r || !can(7)) return deny();
    const f = clientReviewFile(r);
    if (f.blocked) return deny();
    if (f.meta && !f.meta.demo && !f.raw)
      return modal(
        "原文件未保留",
        "<p>目前只有文件記錄。請重新上傳原文件後再下載。</p>",
      );
    const label = irDocTypes[IR.doc][0],
      blob =
        f.raw ||
        new Blob(
          [
            '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>' +
              esc(label) +
              " · Demo 示例</title><style>body{font:16px sans-serif;padding:32px;line-height:1.7}article{max-width:900px}table{border-collapse:collapse}td,th{border:1px solid #ccd;padding:12px}</style><h1>Demo 示例文件</h1><p>此文件為模擬資料，並非上傳原件。</p>" +
              irDocument(r) +
              "</html>",
          ],
          { type: "text/html;charset=utf-8" },
        );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download =
      f.raw?.name ||
      ("Demo-" + r["客戶中文名稱"] + "-" + label).replace(
        /[\\/:*?"<>|]/g,
        "_",
      ) + ".html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };
}
Object.assign(window.AllinPayDemo, {
  clientReviewFeatures: true,
  getBaseFeeState: () => ({
    revision: bfRead().revision || 0,
    rates: structuredClone(bfRead().rates || {}),
    canEdit: bfCanEdit(),
  }),
});
// External invitation entry and post-login continuation are handled in external-registration.js.


// SOURCE MODULE: base-fee-editor.js
// Independent default-rate editor. Reuse the merchant fee renderer without changing its fields.
let bfDraft = null;
const bfProductTools = mtToolActions;
mtToolActions = function (compact = false) {
  const html = bfProductTools(compact);
  return !compact &&
    bfCanEdit() &&
    route().page === "application" &&
    Number(route().step) === 5
    ? html.replace(">", ">" + btn("基礎費率設定", "bf-open"))
    : html;
};
function bfEntry(key) {
  const definition = MW.products.find((p) => p.key === key);
  if (!definition) throw Error("找不到產品");
  return (bfDraft.rates[key] ??= { ct: definition.r.ct || null, v: {} });
}
function bfContext(run) {
  const values = state.values,
    errors = state.errors;
  try {
    const model = {
      version: 2,
      groups: {},
      rates: {},
      combo: { "POS|DCC交易": true },
      sme: {},
      links: { authSigners: {}, shareHolders: {} },
      signals: {},
      ocr: [],
      ack: {},
      manualRisk: false,
    };
    for (const group of v2Groups) {
      model.groups[group.k] = true;
      group.rows.forEach((row, index) => {
        const key = v2RowKey(group, index),
          entry = bfEntry(key);
        model.rates[key] = { on: true, ct: entry.ct, v: entry.v };
      });
    }
    state.values = { ...V2.defaults, __v2: model };
    state.errors = {};
    return run();
  } finally {
    state.values = values;
    state.errors = errors;
  }
}
function bfIssues(key) {
  const definition = MW.products.find((p) => p.key === key),
    entry = bfEntry(key);
  if (
    definition.r.mode === "INST" &&
    !V2.catalog.TENORS.some((t) => entry.v["t" + t + "_on"])
  )
    return [];
  return bfContext(() => v2FeeErrors(definition.r, entry));
}
function bfProductsHTML() {
  const group = v2Groups.find((g) => g.k === bfDraft.group),
    template = document.createElement("template");
  template.innerHTML = bfContext(v2Products);
  const card = [...template.content.querySelectorAll("[data-section]")].find(
    (n) => n.dataset.section === group.n + " · 產品項目",
  );
  card.querySelector(":scope > p.hint")?.remove();
  card.querySelector(":scope > .toolbar")?.remove();
  const query = bfDraft.query.trim().toLocaleLowerCase();
  let matches = 0;
  for (const row of card.querySelectorAll("[data-v2-rate-row]")) {
    const key = row.dataset.v2RateRow,
      definition = MW.products.find((p) => p.key === key);
    if (query && !definition.label.toLocaleLowerCase().includes(query)) {
      row.remove();
      continue;
    }
    matches++;
    row.querySelector("[data-v2-product]")?.remove();
    const error = row.querySelector("[data-v2-rate-error]");
    if (error) {
      error.removeAttribute("data-v2-rate-error");
      error.dataset.bfError = key;
      error.textContent = bfIssues(key).join("；");
    }
  }
  for (const control of card.querySelectorAll(
    "[data-v2-inline-key],[data-v2-inline-pricing]",
  )) {
    for (const [original, target] of [
      ["v2-inline-key", "bf-key"],
      ["v2-inline-field", "bf-field"],
      ["v2-inline-toggle", "bf-toggle"],
      ["v2-inline-pricing", "bf-pricing"],
    ])
      if (control.hasAttribute("data-" + original)) {
        control.setAttribute(
          "data-" + target,
          control.getAttribute("data-" + original),
        );
        control.removeAttribute("data-" + original);
      }
  }
  for (const node of card.querySelectorAll("[id]")) node.id = "bf-" + node.id;
  for (const label of card.querySelectorAll("label[for]"))
    label.htmlFor = "bf-" + label.htmlFor;
  const result = document.createElement("div");
  result.className = "bf-editor v2-form";
  result.innerHTML =
    '<div class="v2-products-page">' +
    (matches
      ? card.outerHTML
      : '<p class="bf-empty">找不到符合的產品，請調整搜尋內容。</p>') +
    "</div>";
  bfDraft.matches = matches;
  return result.outerHTML;
}
function bfRefreshProducts(focusId = "") {
  if (!bfDraft || !$("#bf-products")) return;
  const body = $("#modal .modal-body"),
    top = body.scrollTop;
  $("#bf-products").innerHTML = bfProductsHTML();
  $("#bf-match-count").textContent = "顯示 " + bfDraft.matches + " 項產品";
  body.scrollTop = top;
  if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
  for (const button of $$('[data-action="bf-group"]'))
    button.classList.toggle("primary", button.dataset.group === bfDraft.group);
  const other = $("#bf-other-category");
  if (other)
    other.value = ["POS", "CNP", "INQR"].includes(bfDraft.group)
      ? ""
      : bfDraft.group;
}
function bfStatus(text) {
  const status = $("#bf-status");
  if (status) status.textContent = text;
}
function bfOpen() {
  if (!bfCanEdit()) return deny();
  const saved = bfRead();
  bfDraft = {
    rates: bfClean(saved.rates),
    group: "POS",
    query: "",
    revision: saved.revision || 0,
  };
  const templates = mtTemplates().filter((t) => t.scopes.includes("products"));
  mtDialog(
    "基礎費率設定",
    `<p class="bf-intro">直接修改各產品的預設費率，再按「儲存基礎費率」。新商戶預設使用這些數值，產品仍需另行勾選開通。</p><div class="bf-controls"><div class="bf-categories" aria-label="費率產品類別">${v2Groups
      .filter((g) => ["POS", "CNP", "INQR"].includes(g.k))
      .map((g) =>
        btn(
          g.n,
          "bf-group",
          g.k === "POS" ? "primary" : "",
          `data-group="${g.k}"`,
        ),
      )
      .join(
        "",
      )}</div><div class="field"><label for="bf-other-category">其他產品類別</label><select id="bf-other-category"><option value="">請選擇</option>${v2Groups
      .filter((g) => !["POS", "CNP", "INQR"].includes(g.k))
      .map((g) => `<option value="${g.k}">${esc(g.n)}</option>`)
      .join(
        "",
      )}</select></div><div class="field"><label for="bf-product-search">搜尋產品</label><input id="bf-product-search" type="search" placeholder="輸入產品或卡組織名稱"></div></div><details class="bf-import"><summary>帶入現有費率（選填）</summary><div class="bf-import-controls">${btn("帶入目前表單費率", "bf-current", "", route().page === "application" ? "" : "disabled")}<label for="bf-template">帶入費率模板</label><select id="bf-template"><option value="">選擇模板</option>${templates.map((t) => `<option value="${esc(t.id)}">${esc(t.name)} · v${t.version}</option>`).join("")}</select></div></details><p class="hint bf-result-count" id="bf-match-count"></p><div id="bf-products">${bfProductsHTML()}</div>`,
    `<span class="hint bf-status" id="bf-status">尚未修改 · 目前儲存版本 v${saved.revision || 0}</span>${btn("全部設為 0", "bf-zero")}${btn("取消", "mt-close")}${btn("儲存基礎費率", "bf-save", "primary")}`,
  );
  $("#modal").classList.add("bf-config");
  bfRefreshProducts();
}
function bfSave() {
  try {
    if (!bfCanEdit() || !bfDraft) return deny();
    const rates = bfClean(bfDraft.rates);
    for (const key of Object.keys(rates)) {
      const issues = bfIssues(key);
      if (issues.length)
        throw Error(
          MW.products.find((p) => p.key === key).label +
            "：" +
            issues.join("；"),
        );
    }
    if (
      bfRead().revision !== bfDraft.revision &&
      !(bfRead().revision === undefined && bfDraft.revision === 0)
    )
      throw Error("基礎費率已由其他操作更新，請重新開啟核對");
    if (mtFailureActive()) throw Error("模擬儲存失敗，基礎費率保持原值");
    localStorage.setItem(
      BF_KEY,
      JSON.stringify({
        rates,
        revision: bfDraft.revision + 1,
        label: "自訂基礎費率",
        updatedAt: new Date().toISOString(),
      }),
    );
    mtClose();
    toast("基礎費率已儲存，之後新增商戶會帶入預設值");
  } catch (error) {
    mtError(error.message);
  }
}
Object.assign(actions, {
  "bf-open": bfOpen,
  "bf-save": bfSave,
  "bf-group": (el) => {
    if (!bfDraft) return;
    bfDraft.group = el.dataset.group;
    bfRefreshProducts();
  },
  "bf-zero": () => {
    if (!bfDraft) return;
    bfDraft.rates = {};
    bfRefreshProducts();
    bfStatus("已全部設為 0，按儲存後生效");
  },
  "bf-current": () => {
    if (!bfCanEdit() || !bfDraft || route().page !== "application")
      return deny();
    bfDraft.rates = bfClean(v2Model().rates);
    bfRefreshProducts();
    bfStatus("已帶入目前表單費率，可繼續修改");
  },
});
function bfEditEvent(event) {
  const target = event.target;
  if (!bfDraft || !target.closest("#modal.bf-config")) return;
  event.stopImmediatePropagation();
  if (target.id === "bf-product-search") {
    bfDraft.query = target.value;
    bfRefreshProducts();
    return;
  }
  if (target.id === "bf-other-category") {
    if (target.value) {
      bfDraft.group = target.value;
      bfRefreshProducts();
    }
    return;
  }
  if (target.id === "bf-template") {
    if (!target.value) return;
    const template = mtTemplates().find((t) => t.id === target.value);
    if (template) {
      bfDraft.rates = bfClean(template.products?.rates);
      bfRefreshProducts();
      bfStatus("已帶入「" + template.name + "」，可繼續修改");
    }
    return;
  }
  const key = target.dataset.bfKey || target.dataset.bfPricing;
  if (!key) return;
  const entry = bfEntry(key);
  if (target.dataset.bfPricing) {
    entry.ct = target.value;
    bfRefreshProducts(target.id);
  } else if (target.dataset.bfToggle) {
    entry.v[target.dataset.bfToggle] = target.checked;
    bfRefreshProducts(target.id);
  } else if (target.dataset.bfField) {
    entry.v[target.dataset.bfField] = target.value;
    const error = [...$$("[data-bf-error]")].find(
      (n) => n.dataset.bfError === key,
    );
    if (error) error.textContent = bfIssues(key).join("；");
  }
  bfStatus("有未儲存的費率修改");
}
document.addEventListener("input", bfEditEvent, true);
document.addEventListener("change", bfEditEvent, true);
$("#modal").addEventListener("close", () => {
  if (!$("#modal").open) {
    $("#modal").classList.remove("bf-config");
    bfDraft = null;
  }
});


// SOURCE MODULE: external-registration.js
// External account registration is browser-local Demo state, independent of
// merchant applications. A verified registration exists even before draft save.
const ER_KEY = "meepay-dev2-20261117-allinpay-external-registrations-v1";
const erEmail = (value) =>
  String(value || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase();
const erName = (value) =>
  String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
const erPage = () => route()[0] || "login";
const erQuery = new URLSearchParams(location.search);
const erInvited = erQuery.has("inviter") || erQuery.has("agency");
const erCode = (value) =>
  /^[A-Za-z0-9_-]{1,100}$/.test(value || "") ? value : "";
const erInvitation = {
  inviter: erCode(erQuery.get("inviter")),
  agency: erCode(erQuery.get("agency")),
};
let erLoginProfile = null;
function erReadList(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  const list = JSON.parse(raw);
  if (!Array.isArray(list)) throw Error("Invalid local record");
  return list.filter((x) => x && typeof x === "object" && !Array.isArray(x));
}
function erRecords() {
  const byId = new Map();
  for (const r of [...state.records, ...erReadList(KEY)])
    if (r.id) byId.set(r.id, r);
  return [...byId.values()];
}
function erCompanyNames(record) {
  const v = record.values || {};
  return [
    record.company,
    record.companyEn,
    v.merchantName,
    v.merchantEnglishName,
    v.companyZh,
    v.companyEn,
  ]
    .map(erName)
    .filter(Boolean);
}
function erCountry(value) {
  return (
    {
      HKG: regions[0],
      CHN: regions[1],
      MAC: regions[2],
      TWN: regions[3],
      SGP: regions[4],
      GBR: regions[5],
      USA: regions[6],
    }[value] || String(value || "")
  );
}
function erFind(profile) {
  const email = erEmail(profile.email),
    company = erName(profile.companyEn),
    country = erCountry(profile.country);
  const entities = [...erReadList(ER_KEY), ...erRecords()];
  if (email && entities.some((r) => erEmail(r.email) === email)) return "email";
  if (
    company &&
    entities.some((r) => {
      const other = erCountry(
        r.country || r.values?.registerCountry || r.values?.country,
      );
      return (
        erCompanyNames(r).includes(company) &&
        (!country || !other || country === other)
      );
    })
  )
    return "company";
  return "";
}
function erProfile() {
  return {
    email: erEmail(state.values.authEmail),
    companyEn: String(state.values.registerCompany || "").trim(),
    country: String(state.values.registerCountry || "").trim(),
    lastName: String(state.values.registerLast || "").trim(),
    firstName: String(state.values.registerFirst || "").trim(),
  };
}
function erStorageError() {
  modal(
    "註冊暫時未能完成",
    '<div class="notice error" role="alert">暫時未能讀取或儲存帳戶資料，請稍後重試。已填資料會保留。</div>',
    btn("返回重試", "close", "primary"),
  );
}
function erDuplicate(profile) {
  erLoginProfile = { ...profile };
  state.registerSeed = null;
  state.otpExpires = 0;
  state.otpError = "";
  state.session = false;
  modal(
    "商戶已註冊",
    '<div class="notice warn" role="alert"><strong>該商戶已經註冊過，請重新登入。</strong><p>請使用原註冊電郵登入，完成驗證後再繼續填寫商戶申請資料。</p></div>',
    btn("返回修改", "close") + btn("前往登入", "er-existing-login", "primary"),
  );
}
function erApplyProfile(profile) {
  if (!profile) return;
  if (profile.companyEn) {
    if (/[\u3400-\u9fff]/.test(profile.companyEn)) {
      state.values.merchantName = profile.companyEn;
      state.values.merchantEnglishName = "";
    } else state.values.merchantEnglishName = profile.companyEn;
  }
  if (profile.lastName || profile.firstName)
    state.values.contactName = [profile.lastName, profile.firstName]
      .filter(Boolean)
      .join(" ");
  state.values.contactEmail = state.email;
}
function erAttachInvitation() {
  if (!erInvited || state.values.__externalInvitation) return;
  state.values.__externalInvitation = { ...erInvitation };
  state.values.referrer =
    erInvitation.agency || erInvitation.inviter || state.values.referrer || "";
}
function erContinue(profile, pending, registered) {
  if (!state.session || pending || !erInvited) return;
  if (registered) {
    erApplyProfile(profile);
    erAttachInvitation();
    go("application/1");
    return;
  }
  let records;
  try {
    records = erRecords();
  } catch {
    records = state.records;
  }
  state.records = records;
  const owned = records.filter((r) => erEmail(r.email) === state.email),
    company = erName(profile?.companyEn);
  const matching = company
    ? owned.filter((r) => erCompanyNames(r).includes(company))
    : owned;
  const drafts = matching.filter((r) => r.status === "草稿");
  if (drafts.length === 1) {
    loadRecord(drafts[0]);
    erAttachInvitation();
    render();
    toast("已登入，繼續填寫已儲存的草稿");
    return;
  }
  if (matching.length) {
    go("applications");
    toast(
      drafts.length ? "請選擇要繼續填寫的草稿" : "已登入，可查看申請或新增申請",
    );
    return;
  }
  newApplication();
  erApplyProfile(profile);
  erAttachInvitation();
  go("application/1");
}
const erAuth = auth;
auth = function (page) {
  let html = erAuth(page);
  if (page === "register") {
    html = html.replace(
      "<h2>商戶註冊</h2>",
      '<h2>商戶註冊</h2><p class="center hint">先註冊帳戶，再填寫商戶申請資料。已註冊商戶請先登入。</p>',
    );
    if (erInvited && (erInvitation.agency || erInvitation.inviter))
      html = html.replace(
        /(<input\b[^>]*id="referrer"[^>]*)(>)/,
        "$1 readonly$2",
      );
  }
  return html;
};
const erRegister = actions.register,
  erLogin = actions.login,
  erVerify = actions.verify;
actions.register = () => {
  for (const k of [
    "authEmail",
    "registerCompany",
    "registerLast",
    "registerFirst",
  ])
    state.values[k] = String(state.values[k] || "").trim();
  state.values.authEmail = erEmail(state.values.authEmail);
  const profile = erProfile();
  try {
    if (erFind(profile)) return erDuplicate(profile);
  } catch {
    return erStorageError();
  }
  erLoginProfile = null;
  erRegister();
  if (state.registerSeed)
    state.registerSeed = {
      ...state.registerSeed,
      email: profile.email,
      country: profile.country,
    };
};
actions.login = () => {
  state.registerSeed = null;
  state.values.authEmail = erEmail(state.values.authEmail);
  erLogin();
};
actions["er-existing-login"] = () => {
  const email = erLoginProfile?.email || erEmail(state.values.authEmail);
  state.session = false;
  state.registerSeed = null;
  state.pendingDraft = null;
  state.email = "";
  state.values.authEmail = email;
  go("login");
};
actions.verify = () => {
  const seed = state.registerSeed && { ...state.registerSeed },
    pending = !!state.pendingDraft;
  const valid =
    $$("[data-otp]")
      .map((i) => i.value)
      .join("") === "123456" && Date.now() <= state.otpExpires;
  if (seed && valid) {
    const profile = { ...seed, email: erEmail(state.email) };
    try {
      if (erFind(profile)) return erDuplicate(profile);
      const next = [
        ...erReadList(ER_KEY),
        {
          id: crypto.randomUUID(),
          ...profile,
          company: profile.companyEn,
          createdAt: new Date().toISOString(),
        },
      ];
      localStorage.setItem(ER_KEY, JSON.stringify(next));
    } catch {
      return erStorageError();
    }
  }
  erVerify();
  if (!state.session) return;
  if (seed) {
    erApplyProfile(seed);
    erAttachInvitation();
    render();
  }
  erContinue(seed || erLoginProfile, pending, !!seed);
  erLoginProfile = null;
};
// A new invitation, including an older direct-form URL, starts at registration.
// Login/retrieve links remain navigable once the landing page has been shown.
if (erInvited) {
  state.values.referrer = erInvitation.agency || erInvitation.inviter || "";
  if (!["register", "verify", "retrieve"].includes(erPage()))
    history.replaceState(
      null,
      "",
      location.pathname + location.search + "#/register",
    );
}
document.addEventListener(
  "click",
  (e) => {
    if (e.target.closest('a[href="#/login"]') && erPage() === "register")
      erLoginProfile = erProfile();
  },
  true,
);


// SOURCE MODULE: bank-autofill.js
// Bank and branch lookups use the bundled directory without network requests.
const bankDirectory = new Map(
  BANK_DIRECTORY_DATA.banks.map((bank) => [bank.code, bank]),
);
const bankFormState = new WeakMap();
let bankExplicit = "";
const bankFieldOrder = [
  "cardCountryCode",
  "cardProvinceCode",
  "cardCityCode",
  "cardBankCode",
  "cardBankName",
  "swiftCode",
  "cardBranchCode",
  "cardAddress",
];
for (const form of V2.forms)
  for (const section of form.sections)
    if (section.fields.some((f) => f.id === "cardBankCode")) {
      section.fields.sort(
        (a, b) => bankFieldOrder.indexOf(a.id) - bankFieldOrder.indexOf(b.id),
      );
      section.texts[1] =
        "銀行所在地預設為中國香港。先選銀行行號，再選開戶分行；銀行名稱、SWIFT 及分行地址使用內建資料自動帶入。";
      for (const field of section.fields) {
        if (field.id === "cardCountryCode")
          field.hint = "銀行所在地預設為中國香港。";
        if (field.id === "cardBankCode")
          field.hint = "搜尋行號或銀行名稱；選取後自動帶入銀行名稱及 SWIFT。";
        if (field.id === "cardBankName")
          field.hint = "按行號自動帶入；也可直接選擇銀行。";
        if (field.id === "cardBranchCode")
          field.hint = "選取開戶分行後自動帶入地址；清單以外可手動填寫。";
      }
    }
function bankAddressNote(bank) {
  const branch = bankBranch(bank);
  return branch
    ? "已對應 " + branch.code + " · " + branch.name + "；可按實際資料修改。"
    : v2Raw("cardBranchCode")
      ? "內建資料未有此分行，請核實分行編號並手動填寫地址。"
      : bank.branches.length
        ? "選取開戶分行後，自動帶入該分行地址。"
        : "內建資料未有分行地址，請手動填寫。";
}
function bankCurrent() {
  return v2Raw("cardCountryCode") === "HKG"
    ? bankDirectory.get(v2Raw("cardBankCode"))
    : null;
}
function bankBranch(bank = bankCurrent()) {
  const matches =
    bank?.branches.filter((b) => b.code === v2Raw("cardBranchCode")) || [];
  return new Set(matches.map((b) => b.address)).size === 1 ? matches[0] : null;
}
function bankAutofill() {
  if (state.readonly) {
    bankExplicit = "";
    return;
  }
  const v = state.values,
    key = v2Raw("cardCountryCode") + "|" + v2Raw("cardBankCode"),
    previous = bankFormState.get(v),
    explicit = bankExplicit;
  bankExplicit = "";
  const changed = !!previous && previous.key !== key,
    bank = bankCurrent();
  if (explicit === "bank" && changed) {
    v.cardBranchCode = "";
    v2Model().bankBranchCustom = false;
  }
  if (!bank) {
    if (explicit === "bank" && changed) {
      v.swiftCode = "";
      v.cardAddress = "";
      if (bankDirectory.has(previous.key.split("|")[1])) v.cardBankName = "";
    } else if (changed && previous) {
      for (const f of ["swiftCode", "cardAddress"])
        if (v[f] === previous.auto[f]) v[f] = "";
    }
    bankFormState.set(v, { key, branch: v2Raw("cardBranchCode"), auto: {} });
    return;
  }
  if (explicit === "bank") {
    v.cardBankName = ONBOARDING_BANKS[bank.code];
    v2Model().bankCustom = false;
    v2Model().bankCodeCustom = false;
  }
  const auto = { ...(previous?.auto || {}) };
  if (explicit === "bank" || !v2Raw("swiftCode")) {
    v.swiftCode = bank.swift;
    auto.swiftCode = bank.swift;
  }
  let branch = bankBranch(bank),
    address = branch?.address || "";
  if (
    !v2Raw("cardBranchCode") &&
    new Set(bank.branches.map((b) => b.address).filter(Boolean)).size === 1
  ) {
    address = bank.branches[0].address;
    if (bank.branches.length === 1) v.cardBranchCode = bank.branches[0].code;
  }
  if (explicit === "bank" || explicit === "branch" || !v2Raw("cardAddress")) {
    if (
      address ||
      explicit === "bank" ||
      previous?.auto.cardAddress === v.cardAddress
    ) {
      v.cardAddress = address;
      auto.cardAddress = address;
    }
  }
  bankFormState.set(v, { key, branch: v2Raw("cardBranchCode"), auto });
  const source = $(".bank-address-source");
  if (source) source.textContent = bankAddressNote(bank);
  for (const f of ["cardAddress", "swiftCode", "cardBranchCode"]) {
    const el = $('[data-field="' + f + '"]'),
      value =
        f === "cardBranchCode" &&
        el?.hasAttribute("data-bank-branch-picker") &&
        v2Model().bankBranchCustom
          ? "__other"
          : v2Raw(f);
    if (el && el.value !== value) el.value = value;
  }
}
const bankBaseDerived = v2SyncDerived;
v2SyncDerived = function (...args) {
  if (!state.readonly && !v2Raw("cardCountryCode"))
    state.values.cardCountryCode = "HKG";
  const result = bankBaseDerived.apply(this, args);
  bankAutofill();
  return result;
};
// Reuse the existing picker handlers; their shared sync now fills the dependent fields.
for (const [name, handler] of [
  ["code", clientPickBankCode],
  ["name", usabilityPickBank],
]) {
  for (const type of ["input", "change"])
    document.removeEventListener(type, handler, true);
  const wrapper = (e) => {
    const t = e.target,
      hit =
        name === "code"
          ? t.hasAttribute("data-bank-code-picker") ||
            t.hasAttribute("data-other-bank-code")
          : t.hasAttribute("data-bank-picker");
    if (hit) bankExplicit = "bank";
    handler(e);
    if (hit && t.hasAttribute("data-other-bank-code")) {
      v2SyncDerived();
      if (/^\d{3}$/.test(t.value) && ONBOARDING_BANKS[t.value])
        queueMicrotask(() => render());
    }
  };
  for (const type of ["input", "change"])
    document.addEventListener(type, wrapper, true);
}
for (const type of ["input", "change"])
  window.addEventListener(
    type,
    (e) => {
      if (e.target.dataset.v2Field === "cardBranchCode")
        bankExplicit = "branch";
    },
    true,
  );
for (const type of ["input", "change"])
  document.addEventListener(
    type,
    (e) => {
      const control = e.target;
      if (!control.hasAttribute("data-bank-branch-picker")) return;
      e.stopImmediatePropagation();
      v2Model().bankBranchCustom = control.value === "__other";
      state.values.cardBranchCode =
        control.value === "__other" ? "" : control.value;
      delete state.errors.cardBranchCode;
      bankExplicit = "branch";
      v2SyncDerived();
      queueMicrotask(() => render());
    },
    true,
  );
actions["bank-branch-list"] = () => {
  v2Model().bankBranchCustom = false;
  render();
};
const bankBaseField = v2Field;
v2Field = function (f, ...args) {
  const country = v2Raw("cardCountryCode"),
    legacyCountry = country && country !== "HKG";
  const field =
    f.id === "cardCountryCode" && legacyCountry
      ? { ...f, hint: "此筆既有資料的銀行所在地已保留。" }
      : f;
  let html = bankBaseField.call(this, field, ...args);
  if (f.id === "cardCountryCode") {
    const label = country ? v2Display("cardCountryCode", country) : "未提供";
    return html.replace(
      /<select\b[^>]*data-v2-field="cardCountryCode"[\s\S]*?<\/select>/,
      () =>
        `<input id="field-cardCountryCode" type="text" data-bank-country-display value="${esc(label)}" readonly aria-readonly="true"><input type="hidden" data-field="cardCountryCode" data-v2-field="cardCountryCode" value="${esc(country)}">`,
    );
  }
  if (country !== "HKG") return html;
  const bank = bankCurrent();
  if (
    f.id === "cardBranchCode" &&
    (!v2Raw("cardBankCode") || bank?.branches.length)
  ) {
    const current = v2Raw("cardBranchCode"),
      branches = [
        ...new Map((bank?.branches || []).map((b) => [b.code, b])).values(),
      ].sort((a, b) => a.code.localeCompare(b.code)),
      custom = !!v2Model().bankBranchCustom;
    const control = custom
      ? `<input id="field-cardBranchCode" data-field="cardBranchCode" data-v2-field="cardBranchCode" value="${esc(current)}" maxlength="3" inputmode="numeric" placeholder="輸入 3 位分行編號" ${state.readonly ? "readonly" : ""}><button type="button" class="bank-branch-list" data-action="bank-branch-list" ${state.readonly ? "disabled" : ""}>從分行清單選擇</button>`
      : `<select id="field-cardBranchCode" data-field="cardBranchCode" data-v2-field="cardBranchCode" data-bank-branch-picker ${!bank || state.readonly ? "disabled" : ""}><option value="">${bank ? "請選擇開戶分行" : "請先選擇銀行行號"}</option>${branches.map((b) => `<option value="${b.code}" data-description="${esc(b.address)}" ${b.code === current ? "selected" : ""}>${b.code} · ${esc(b.name)}</option>`).join("")}${current && !branches.some((b) => b.code === current) ? `<option value="${esc(current)}" selected>${esc(current)}（手動填寫）</option>` : ""}<option value="__other">其他分行（手動填寫）</option></select>`;
    html = html.replace(
      /<input\b[^>]*data-v2-field="cardBranchCode"[^>]*>/,
      control,
    );
  }
  if (f.id === "cardAddress") {
    html = html.replace(
      /<input\b[^>]*data-v2-field="cardAddress"[^>]*>/,
      (input) =>
        input
          .replace(/^<input/, "<textarea")
          .replace(/\s+type="[^"]*"/, "")
          .replace(/\s+value="[^"]*"/, "")
          .replace(/>$/, ' rows="3" class="bank-address-input">') +
        esc(v2Raw("cardAddress")) +
        "</textarea>",
    );
    if (bank) {
      const end = html.lastIndexOf("</div>"),
        note = bankAddressNote(bank);
      html =
        html.slice(0, end) +
        '<small class="hint bank-address-source">' +
        esc(note) +
        "</small>" +
        html.slice(end);
    }
  }
  if (f.id === "swiftCode" && bank) {
    const end = html.lastIndexOf("</div>");
    html =
      html.slice(0, end) +
      '<small class="hint">' +
      (bank.swift
        ? "已帶入 HKICL 會員 SWIFT／BIC，可按收款銀行指示修改。"
        : "參考資料未有 SWIFT／BIC，請按銀行指示填寫。") +
      "</small>" +
      html.slice(end);
  }
  return html;
};
const bankStyle = document.createElement("style");
bankStyle.textContent =
  '.bank-address-input{height:auto!important;min-height:84px;line-height:1.6;resize:vertical;overflow-wrap:anywhere}.bank-address-source{display:block;margin-top:8px}.v2-form [data-section="開戶行歸屬地"] [data-field-wrap="cardAddress"]{grid-column:1/-1!important}.v2-form [data-section="開戶行歸屬地"]>.grid{align-items:start}.v2-form [data-section="開戶行歸屬地"]>.grid>.field>label{min-height:40px}.bank-branch-list{margin-top:8px;padding:8px 12px;font-size:12px}@media(max-width:700px){.v2-form [data-section="開戶行歸屬地"]>.grid{grid-template-columns:minmax(0,1fr)!important}.v2-form [data-section="開戶行歸屬地"]>.grid>.field>label{min-height:0}}';
document.head.append(bankStyle);
Object.assign(AllinPayDemo, {
  getBankDirectory: () => ({
    banks: bankDirectory.size,
    branches: BANK_DIRECTORY_DATA.banks.reduce(
      (n, b) => n + b.branches.length,
      0,
    ),
    bics: BANK_DIRECTORY_DATA.banks.filter((b) => b.swift).length,
    branchDate: BANK_DIRECTORY_DATA.branchDate,
    bicDate: BANK_DIRECTORY_DATA.bicDate,
    lookupSource: "built-in",
    remoteLookup: false,
  }),
  lookupBank: (code) =>
    structuredClone(bankDirectory.get(String(code)) || null),
});


// SOURCE MODULE: session-timeout.js
// Browser-local Demo idle session. Production APIs must enforce expiry server-side.
(() => {
  const external = typeof MT_EXTERNAL !== "undefined" && MT_EXTERNAL;
  const duration = 5 * 60 * 1000,
    warning = 30 * 1000;
  const key =
    "meepay-dev2-20261117-allinpay-idle-session-" +
    (external ? "external" : "backoffice") +
    "-v1";
  const logoutAction = external ? "confirm-logout" : "bo-logout",
    baseLogout = actions[logoutAction];
  let identity = "",
    expiresAt = 0,
    alarm = 0,
    countdown = 0,
    lastWrite = 0,
    ending = false,
    expiredNotice = false,
    previousFocus = null;
  const who = () =>
    external ? (state.session ? state.email : "") : BO.user?.id || "";
  const dialog = () => document.getElementById("idle-session-dialog");
  function remember(force = false) {
    if (!identity || (!force && Date.now() - lastWrite < 1000)) return;
    lastWrite = Date.now();
    try {
      sessionStorage.setItem(key, JSON.stringify({ identity, expiresAt }));
    } catch {}
  }
  function closeWarning(restore = false) {
    const d = dialog();
    if (d) {
      d.close();
      d.remove();
    }
    clearInterval(countdown);
    countdown = 0;
    if (restore && previousFocus?.isConnected) previousFocus.focus();
    previousFocus = null;
  }
  function stop() {
    clearTimeout(alarm);
    alarm = 0;
    closeWarning();
    identity = "";
    expiresAt = 0;
    lastWrite = 0;
    try {
      sessionStorage.removeItem(key);
    } catch {}
  }
  function schedule() {
    clearTimeout(alarm);
    if (identity)
      alarm = setTimeout(
        check,
        Math.max(1, expiresAt - Date.now() - (dialog() ? 0 : warning)),
      );
  }
  function begin(fresh = false) {
    const id = who();
    if (!id) {
      stop();
      return;
    }
    identity = id;
    expiresAt = Date.now() + duration;
    if (!fresh)
      try {
        const stored = JSON.parse(sessionStorage.getItem(key) || "null");
        if (
          stored?.identity === id &&
          Number.isFinite(stored.expiresAt) &&
          stored.expiresAt > 0
        )
          expiresAt = Math.min(stored.expiresAt, expiresAt);
      } catch {}
    remember(true);
    schedule();
  }
  function showWarning() {
    if (dialog()) return;
    previousFocus = document.activeElement;
    const d = document.createElement("dialog");
    d.id = "idle-session-dialog";
    d.className = "idle-session-dialog";
    d.setAttribute("role", "alertdialog");
    d.setAttribute("aria-labelledby", "idle-session-title");
    d.setAttribute("aria-describedby", "idle-session-copy");
    d.innerHTML =
      '<div class="idle-session-body"><h2 id="idle-session-title">登入即將逾時</h2><p id="idle-session-copy">你已閒置一段時間，系統即將自動登出。</p><p class="idle-session-count"><strong id="idle-session-seconds"></strong> 秒後登出</p><p class="hint">未儲存的內容不會保留。請選擇「繼續使用」，返回表單儲存草稿。</p></div><div class="idle-session-actions"><button type="button" data-idle-action="logout">立即登出</button><button type="button" class="primary" data-idle-action="continue" autofocus>繼續使用</button></div>';
    d.addEventListener("cancel", (e) => e.preventDefault());
    document.body.append(d);
    d.showModal();
    updateCountdown();
    countdown = setInterval(check, 1000);
  }
  function updateCountdown() {
    const el = document.getElementById("idle-session-seconds");
    if (el)
      el.textContent = String(
        Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)),
      );
  }
  function leave(expired) {
    if (ending) return;
    ending = true;
    expiredNotice = expired;
    stop();
    // Close every native overlay so protected content cannot remain above login.
    document.querySelectorAll("dialog[open]").forEach((d) => d.close());
    document.getElementById("column-popover")?.remove();
    state.pendingDraft = null;
    state.registerSeed = null;
    state.otpExpires = 0;
    state.resendAt = 0;
    state.otpError = "";
    if (!external) {
      BO.otpUntil = 0;
      BO.pendingMutation = null;
    }
    try {
      baseLogout();
    } finally {
      ending = false;
      render();
    }
  }
  function check() {
    if (ending) return true;
    const id = who();
    if (!id) {
      if (identity || expiresAt) stop();
      return true;
    }
    if (id !== identity) begin();
    if (Date.now() >= expiresAt) {
      leave(true);
      return false;
    }
    if (expiresAt - Date.now() <= warning) showWarning();
    updateCountdown();
    schedule();
    return true;
  }
  function activity(e) {
    if (!e.isTrusted || !who()) return;
    if (!check()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (dialog()) return;
    expiresAt = Date.now() + duration;
    remember();
    schedule();
  }
  const baseRender = render;
  render = function (...args) {
    if (!check()) return;
    const result = baseRender.apply(this, args);
    if (
      expiredNotice &&
      !who() &&
      !document.getElementById("idle-session-expired")
    ) {
      const form = document.getElementById(
        external ? "auth-form" : "bo-auth-form",
      );
      const isLogin = external
        ? route()[0] === "login"
        : route().page === "login";
      if (form && isLogin) {
        const note = document.createElement("div");
        note.id = "idle-session-expired";
        note.className = "notice warn";
        note.setAttribute("role", "alert");
        note.textContent =
          "已閒置 5 分鐘，系統已自動登出。請重新登入；已儲存的草稿仍會保留。";
        form.querySelector("h1,h2")?.after(note);
      }
    }
    return result;
  };
  actions[logoutAction] = () => leave(false);
  if (external) {
    const verify = actions.verify;
    actions.verify = function (...args) {
      const before = who(),
        result = verify.apply(this, args);
      if (!before && who()) {
        expiredNotice = false;
        begin(true);
        check();
      }
      return result;
    };
  } else {
    const login = loginAs;
    loginAs = function (...args) {
      stop();
      expiredNotice = false;
      const result = login.apply(this, args);
      if (who()) begin(true);
      return result;
    };
  }
  for (const type of [
    "pointerdown",
    "pointermove",
    "click",
    "keydown",
    "input",
    "change",
    "wheel",
    "touchstart",
    "scroll",
  ])
    window.addEventListener(type, activity, { capture: true, passive: false });
  window.addEventListener(
    "click",
    (e) => {
      const b = e.target.closest("[data-idle-action]");
      if (!b) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!check()) return;
      if (b.dataset.idleAction === "logout") leave(false);
      else {
        closeWarning(true);
        expiresAt = Date.now() + duration;
        remember(true);
        schedule();
      }
    },
    true,
  );
  for (const type of ["focus", "pageshow", "hashchange"])
    window.addEventListener(type, check);
  document.addEventListener("visibilitychange", check);
  window.addEventListener("pagehide", () => {
    if (who()) remember(true);
  });
  const style = document.createElement("style");
  style.textContent =
    ".idle-session-dialog{box-sizing:border-box;width:min(440px,calc(100vw - 32px));max-height:calc(100dvh - 32px);padding:0;border:1px solid var(--line,#dbe2ed);border-radius:8px;color:var(--ink,#242c3a);background:#fff;font:inherit;overflow:auto;box-shadow:0 12px 48px #14254f33}.idle-session-dialog::backdrop{background:#14254f70;backdrop-filter:blur(3px)}.idle-session-body{padding:24px}.idle-session-body h2{margin:0 0 16px;font-size:20px;line-height:1.4}.idle-session-body p{line-height:1.7;margin:12px 0}.idle-session-count{text-align:center;color:var(--brand,#168fc7)}.idle-session-count strong{font-size:40px;margin-right:8px;font-variant-numeric:tabular-nums}.idle-session-actions{display:flex;gap:12px;padding:20px 24px;border-top:1px solid var(--line,#dbe2ed);background:var(--canvas,#f7f8fb)}.idle-session-actions button{flex:1;min-width:0;min-height:44px;padding:10px 12px;margin:0;line-height:22px;text-align:center}.idle-session-actions button.primary{background:var(--brand,#168fc7);color:white;border-color:var(--brand,#168fc7)}#idle-session-expired{margin:16px 0;font-size:14px;line-height:1.7}";
  document.head.append(style);
  Object.assign(window.AllinPayDemo, {
    getSessionTimeout: () => ({
      timeoutMs: duration,
      warningMs: warning,
      authenticated: !!who(),
      expiresAt,
      remainingMs: Math.max(0, expiresAt - Date.now()),
      warningOpen: !!dialog(),
    }),
  });
})();


// SOURCE MODULE: searchable-selects.js
// Progressive enhancement: original select elements, option values and events stay intact.
(() => {
  const escape = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const normalize = (value) =>
    String(value ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/滙/g, "匯")
      .replace(/恆/g, "恒")
      .replace(/臺/g, "台")
      .replace(/\s+/g, " ")
      .trim();
  const compact = (value) => normalize(value).replace(/[\s_.(),（）/\-]/g, "");
  const commonBanks = [
    "004",
    "012",
    "024",
    "003",
    "015",
    "009",
    "016",
    "018",
    "020",
    "025",
    "027",
    "028",
    "035",
    "039",
    "040",
    "041",
    "043",
    "072",
    "128",
    "250",
    "382",
    "387",
    "388",
    "389",
    "390",
    "391",
    "392",
    "393",
    "395",
  ];
  const bankAliases = {
    "004": "HSBC 匯豐 滙豐",
    "012": "BOCHK BOC 中銀 中國銀行",
    "024": "Hang Seng 恒生 恆生",
    "003": "SCB Standard Chartered 渣打",
    "015": "BEA 東亞",
    "016": "DBS 星展",
    "018": "CITIC 中信",
    "020": "Wing Lung 永隆",
    "035": "OCBC 華僑 永亨",
    "072": "ICBC 工銀 工商",
    250: "Citi 花旗",
  };
  let active = null;
  const eligible = (el) =>
    el instanceof HTMLSelectElement &&
    !el.multiple &&
    el.size <= 1 &&
    !el.matches(":disabled") &&
    !el.closest("[inert]");
  function sourceLabel(select) {
    return (
      select.getAttribute("aria-label") ||
      select.labels?.[0]?.textContent.trim().replace(/\s+/g, " ") ||
      select.closest(".field")?.querySelector("label")?.textContent.trim() ||
      "選項"
    );
  }
  function optionsFor(select) {
    const bankSelect = select.matches(
      "[data-bank-picker],[data-bank-code-picker]",
    );
    const options = Array.from(select.options)
      .map((option, index) => {
        const bank = bankSelect
          ? BANK_CODE_REFERENCE.banks.find(
              (b) => b.code === option.value || b.name === option.value,
            )
          : null;
        const priority = bank ? commonBanks.indexOf(bank.code) : -1;
        return {
          index,
          value: option.value,
          label: option.label,
          description: option.dataset.description || "",
          disabled: option.disabled || !!option.closest("optgroup:disabled"),
          hidden: option.hidden,
          bank,
          group: bank
            ? priority >= 0
              ? "香港常用銀行"
              : "其他在港銀行／清算參考"
            : option.parentElement instanceof HTMLOptGroupElement
              ? option.parentElement.label
              : "",
          rank: bank
            ? priority >= 0
              ? priority + 1
              : 1000 + Number(bank.code)
            : option.value === ""
              ? -1
              : 10000 + index,
          search: normalize(
            [
              option.label,
              option.value,
              option.dataset.description,
              bank?.en,
              bank?.zh,
              bank?.code,
              bank && bankAliases[bank.code],
            ]
              .filter(Boolean)
              .join(" "),
          ),
        };
      })
      .filter((o) => !o.hidden);
    if (bankSelect) options.sort((a, b) => a.rank - b.rank);
    return { options, bankSelect };
  }
  function restoreAttribute(select, name, value) {
    if (value === null) select.removeAttribute(name);
    else select.setAttribute(name, value);
  }
  function close(restoreFocus = false) {
    if (!active) return;
    const previous = active;
    active = null;
    if (
      typeof previous.panel.hidePopover === "function" &&
      previous.panel.matches(":popover-open")
    )
      previous.panel.hidePopover();
    previous.panel.remove();
    for (const [name, value] of Object.entries(previous.attributes))
      restoreAttribute(previous.select, name, value);
    if (
      restoreFocus &&
      previous.select.isConnected &&
      !previous.select.disabled
    )
      previous.select.focus({ preventScroll: true });
  }
  function position() {
    if (!active) return;
    const { select, panel } = active;
    if (!select.isConnected || select.disabled) {
      close();
      return;
    }
    const rect = select.getBoundingClientRect(),
      viewport = window.visualViewport,
      left = viewport?.offsetLeft || 0,
      top = viewport?.offsetTop || 0,
      width = viewport?.width || innerWidth,
      height = viewport?.height || innerHeight;
    if (rect.bottom < top || rect.top > top + height) {
      close();
      return;
    }
    const panelWidth = Math.min(Math.max(rect.width, 280), 520, width - 16),
      below = top + height - rect.bottom - 12,
      above = rect.top - top - 12,
      up = below < 240 && above > below,
      available = Math.max(below, above),
      maxHeight = Math.min(420, Math.max(160, available), height - 16);
    panel.style.width = panelWidth + "px";
    panel.style.maxHeight = maxHeight + "px";
    panel.style.left =
      Math.max(left + 8, Math.min(rect.left, left + width - panelWidth - 8)) +
      "px";
    const actualHeight = Math.min(panel.scrollHeight, maxHeight);
    panel.style.top =
      Math.max(
        top + 8,
        Math.min(
          up ? rect.top - actualHeight - 6 : rect.bottom + 6,
          top + height - actualHeight - 8,
        ),
      ) + "px";
  }
  function highlight(index, scroll = false) {
    if (!active) return;
    const enabled = active.filtered.filter((o) => !o.disabled);
    const option = enabled.find((o) => o.index === index) || enabled[0];
    active.highlight = option?.index ?? -1;
    active.panel
      .querySelectorAll("[data-sdd-option]")
      .forEach((button) =>
        button.classList.toggle(
          "highlighted",
          Number(button.dataset.sddOption) === active.highlight,
        ),
      );
    if (option) {
      active.input.setAttribute(
        "aria-activedescendant",
        "sdd-option-" + option.index,
      );
      if (scroll)
        active.panel
          .querySelector("#sdd-option-" + option.index)
          ?.scrollIntoView({ block: "nearest" });
    } else active.input.removeAttribute("aria-activedescendant");
  }
  function renderOptions() {
    if (!active) return;
    const a = active,
      q = normalize(a.input.value),
      tokens = q.split(" ").filter(Boolean);
    a.filtered = a.options.filter((o) =>
      tokens.every(
        (token) =>
          o.search.includes(token) ||
          compact(o.search).includes(compact(token)),
      ),
    );
    let group = null;
    a.list.innerHTML =
      a.filtered
        .map((option) => {
          const heading =
            option.group && option.group !== group
              ? '<div class="sdd-group" role="presentation">' +
                escape(option.group) +
                "</div>"
              : "";
          group = option.group;
          const selected = option.index === a.select.selectedIndex,
            details = option.bank
              ? a.bankSelect && a.select.hasAttribute("data-bank-picker")
                ? option.bank.code + " · " + option.bank.en
                : option.bank.en
              : option.description;
          return (
            heading +
            `<button type="button" role="option" tabindex="-1" id="sdd-option-${option.index}" data-sdd-option="${option.index}" aria-selected="${selected}" aria-disabled="${option.disabled}" ${option.disabled ? "disabled" : ""}><span class="sdd-option-text"><span>${escape(option.label)}</span>${details ? "<small>" + escape(details) + "</small>" : ""}</span><span class="sdd-check" aria-hidden="true">${selected ? "✓" : ""}</span></button>`
          );
        })
        .join("") ||
      '<div class="sdd-empty">沒有符合的選項，請換個關鍵字。</div>';
    const other = a.options.find((o) => o.value === "__other" && !o.disabled);
    if (!a.filtered.length && other)
      a.list.innerHTML += `<button type="button" class="sdd-other" data-sdd-option="${other.index}">${escape(other.label)}</button>`;
    a.count.textContent =
      (q
        ? "找到 " + a.filtered.length + " 個"
        : "共 " + a.options.length + " 個") + "選項";
    a.clear.disabled = !a.input.value;
    highlight(
      a.filtered.some((o) => o.index === a.highlight)
        ? a.highlight
        : a.filtered.find((o) => o.index === a.select.selectedIndex)?.index,
    );
    position();
  }
  function choose(index) {
    if (!active) return;
    const { select } = active,
      option = active.options.find((o) => o.index === index);
    if (!option || option.disabled || !select.isConnected || select.disabled)
      return;
    const changed = select.selectedIndex !== option.index;
    close(true);
    if (!changed) return;
    select.selectedIndex = option.index;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function open(select, query = "") {
    if (!eligible(select)) return;
    if (active?.select === select) {
      active.input.focus({ preventScroll: true });
      return;
    }
    close();
    const { options, bankSelect } = optionsFor(select),
      panel = document.createElement("div"),
      label = sourceLabel(select);
    panel.id = "searchable-select-popover";
    panel.className = "sdd-popover";
    panel.setAttribute("popover", "manual");
    panel.innerHTML = `<div class="sdd-search"><input type="search" id="sdd-search-input" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="sdd-options" aria-label="${escape("搜尋" + label)}" placeholder="${bankSelect ? "搜尋銀行名稱、英文或香港行號" : "輸入文字搜尋選項"}" autocomplete="off" spellcheck="false"><button type="button" class="sdd-clear" aria-label="清除搜尋">清除</button></div><div id="sdd-options" class="sdd-options" role="listbox" aria-label="${escape(label)}"></div><div class="sdd-count" role="status" aria-live="polite"></div>`;
    const attributes = Object.fromEntries(
      ["aria-expanded", "aria-controls", "aria-haspopup"].map((name) => [
        name,
        select.getAttribute(name),
      ]),
    );
    select.setAttribute("aria-expanded", "true");
    select.setAttribute("aria-controls", panel.id);
    select.setAttribute("aria-haspopup", "listbox");
    (select.closest("dialog[open]") || document.body).append(panel);
    active = {
      select,
      panel,
      options,
      filtered: [],
      bankSelect,
      attributes,
      input: panel.querySelector("input"),
      list: panel.querySelector(".sdd-options"),
      clear: panel.querySelector(".sdd-clear"),
      count: panel.querySelector(".sdd-count"),
      highlight: select.selectedIndex,
    };
    active.input.value = query;
    active.input.addEventListener("input", renderOptions);
    active.clear.addEventListener("click", () => {
      if (!active) return;
      active.input.value = "";
      renderOptions();
      active.input.focus({ preventScroll: true });
    });
    panel.addEventListener("click", (event) => {
      const button = event.target.closest("[data-sdd-option]");
      if (button) {
        event.preventDefault();
        event.stopPropagation();
        choose(Number(button.dataset.sddOption));
      }
    });
    if (typeof panel.showPopover === "function") panel.showPopover();
    else panel.setAttribute("data-sdd-open", "");
    renderOptions();
    active?.input.focus({ preventScroll: true });
    position();
  }
  window.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0) return;
      const select = event.target.closest?.("select");
      if (eligible(select)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (active && active.select !== select) close();
      } else if (active && !active.panel.contains(event.target)) close();
    },
    true,
  );
  window.addEventListener(
    "mousedown",
    (event) => {
      if (eligible(event.target.closest?.("select"))) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
  // Open after pointer release so an upward menu cannot intercept the opening click.
  window.addEventListener(
    "click",
    (event) => {
      const select = event.target.closest?.("select");
      if (event.button !== 0 || !eligible(select)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (active?.select === select) close(true);
      else open(select);
    },
    true,
  );
  window.addEventListener(
    "keydown",
    (event) => {
      if (event.isComposing) return;
      if (active) {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopImmediatePropagation();
          close(true);
          return;
        }
        if (event.key === "Tab") {
          close(true);
          return;
        }
        if (!active.panel.contains(event.target)) return;
        const enabled = active.filtered.filter((o) => !o.disabled),
          current = enabled.findIndex((o) => o.index === active.highlight);
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const index =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? enabled.length - 1
                : event.key === "ArrowDown"
                  ? Math.min(enabled.length - 1, current + 1)
                  : Math.max(0, current - 1);
          highlight(enabled[index]?.index, true);
        } else if (event.key === "Enter") {
          event.preventDefault();
          event.stopImmediatePropagation();
          choose(active.highlight);
        }
        return;
      }
      const select = event.target;
      if (
        !eligible(select) ||
        event.ctrlKey ||
        event.metaKey ||
        (event.altKey && event.key !== "ArrowDown")
      )
        return;
      if (
        ["ArrowDown", "ArrowUp", "Enter", " ", "Home", "End"].includes(
          event.key,
        ) ||
        event.key.length === 1
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        open(
          select,
          event.key.length === 1 && event.key !== " " ? event.key : "",
        );
      }
    },
    true,
  );
  window.addEventListener("resize", position);
  window.visualViewport?.addEventListener("resize", position);
  window.visualViewport?.addEventListener("scroll", position);
  window.addEventListener("scroll", position, true);
  document.addEventListener("focusin", (event) => {
    if (
      active &&
      !active.panel.contains(event.target) &&
      event.target !== active.select
    )
      close();
  });
  new MutationObserver((records) => {
    if (!active) return;
    if (
      !active.select.isConnected ||
      active.select.disabled ||
      document.querySelector("#idle-session-dialog[open]")
    ) {
      close();
      return;
    }
    if (
      records.some(
        (record) =>
          record.target === active.select ||
          active.select.contains(record.target),
      )
    ) {
      Object.assign(active, optionsFor(active.select));
      renderOptions();
    }
  }).observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["disabled", "selected", "label", "value", "hidden"],
  });
  const style = document.createElement("style");
  style.textContent = `.sdd-popover{position:fixed;inset:auto;margin:0!important;padding:0;border:1px solid #cbd7e6;border-radius:8px;background:#fff;color:#263247;box-shadow:0 8px 28px #14254f26;z-index:100010;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;font:14px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.sdd-search{padding:12px;display:flex;gap:8px;align-items:center;border-bottom:1px solid #e2e8f0;flex:none}.sdd-search input{box-sizing:border-box;width:100%;min-width:0;flex:1;margin:0;padding:9px 12px;border:1px solid #afc4dc;border-radius:6px;font:inherit;color:#263247;background:#fff;min-height:40px;height:40px;outline:none}.sdd-search input:focus{border-color:#168fc7;box-shadow:0 0 0 2px #168fc722}.sdd-search button{flex:none;margin:0;padding:6px 8px;font:inherit;font-size:12px;min-width:0;min-height:32px;border:1px solid #d4deeb;border-radius:5px;background:#fff;color:#52657d}.sdd-options{overflow:auto;overscroll-behavior:contain;min-height:48px;flex:1;padding:4px}.sdd-options button{box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-width:0;min-height:40px;height:auto;padding:10px 12px;margin:0;border:1px solid transparent;border-radius:4px;background:#fff;color:#263247;font:inherit;text-align:left;white-space:normal;cursor:pointer;line-height:1.5}.sdd-options button:hover,.sdd-options button.highlighted{background:#eff7fc;border-color:#98c9e4}.sdd-options button[aria-selected="true"]{background:#e4f3fc;color:#126b9c}.sdd-options button:disabled{opacity:.5;cursor:not-allowed}.sdd-option-text{display:block;min-width:0;overflow-wrap:anywhere}.sdd-option-text>span{display:block}.sdd-option-text small{display:block;font-size:11px;line-height:1.5;color:#6b7c92;margin-top:3px;overflow-wrap:anywhere}.sdd-check{flex:none;width:18px;color:#168fc7;text-align:center}.sdd-group{padding:9px 12px 5px;font-size:12px;font-weight:600;color:#6a7a91}.sdd-count{padding:8px 14px;border-top:1px solid #e2e8f0;font-size:12px;color:#6b7c92;flex:none}.sdd-empty{padding:18px 12px;color:#6b7c92;line-height:1.6}.sdd-options .sdd-other{color:#126b9c}`;
  document.head.append(style);
  Object.assign(window.AllinPayDemo || {}, {
    getSearchableSelectState: () => ({
      eligible: Array.from(document.querySelectorAll("select")).filter(eligible)
        .length,
      open: !!active,
      sourceId: active?.select.id || "",
      query: active?.input.value || "",
      results: active?.filtered.length || 0,
    }),
  });
})();


// SOURCE MODULE: developer-fixtures.js
// Build the two fixtures through the unchanged V2 form model.
// This runs once per storage namespace. Reloads never truncate user-created records.
(() => {
  const external = typeof MT_EXTERNAL !== "undefined" && MT_EXTERNAL;
  const marker =
    "meepay-dev2-20261117-initialized-" +
    (external ? "external" : "backoffice");
  const seeded = localStorage.getItem(marker) === "1";
  const storageKeyForEdition = external ? KEY : DBKEY;
  if (!seeded && !localStorage.getItem(storageKeyForEdition)) {
    const initialState = structuredClone(state);
    for (const [index, fixture] of MEEPAY_DEV_FIXTURES.merchants.entries()) {
      if (external) newApplication();
      fillSample(fixture.row);
      state.values.contactEmail = MEEPAY_DEV_FIXTURES.email;
      state.values.remark = "虛構開發測試資料；費率只供介面與串接欄位核對。";
      const model = v2Model();
      for (const group of v2Groups) v2SetGroup(group.k, false);
      for (const rate of Object.values(model.rates)) rate.on = false;
      for (const [key, fee] of Object.entries(fixture.fees)) {
        v2SetGroup(key.split("|")[0], true);
        const rate = model.rates[key];
        rate.on = true;
        rate.ct = fee.ct;
        Object.assign(rate.v, fee.v);
      }
      v2SyncDerived();
      const application = {
        id: fixture.id,
        owner: "ACC-3",
        step: 5,
        savedAt: "2026/11/17 11:44",
        values: structuredClone(state.values),
        checks: structuredClone(state.checks),
        files: structuredClone(state.files),
        people: structuredClone(state.people),
        emailVerified: true,
      };
      if (external) {
        state.id = fixture.id;
        state.email = MEEPAY_DEV_FIXTURES.email;
        state.step = 5;
        const record = snapshot(fixture.externalStatus);
        record.created = record.updated = "2026/11/17 11:44";
        state.records.push(record);
      } else rows[index].application = application;
    }
    const records = external ? state.records : null;
    Object.assign(state, initialState);
    if (external) {
      state.records = records;
      state.email = "";
      state.session = false;
      localStorage.setItem(KEY, JSON.stringify(records));
    } else persistDemo();
  }
  localStorage.setItem(marker, "1");
  // One reset action touches this edition only, never the full Demo.
  actions["developer-reset"] = () => {
    for (const storage of [localStorage, sessionStorage])
      for (const key of Object.keys(storage))
        if (key.startsWith("meepay-dev2-20261117-")) storage.removeItem(key);
    location.hash = "/login";
    location.reload();
  };
  if (!external)
    actions["reset-demo"] = () =>
      modal(
        "還原兩間開發示例",
        "<p>清除這份開發測試版的本機修改，重新載入兩間虛構商戶。</p>",
        btn("取消", "close") + btn("確認還原", "developer-reset", "primary"),
      );
  if (external)
    actions.seed = () =>
      toast("這份開發版已內建兩間商戶；新增申請可照常儲存。");
  Object.assign(window.AllinPayDemo, {
    developerEdition: MEEPAY_DEV_FIXTURES.version,
    getDeveloperFixtures: () =>
      structuredClone(external ? state.records : rows),
  });
})();


  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.field) {
      state.values[t.dataset.field] = t.value;
      delete state.errors[t.dataset.field];
      t.closest(".field")?.classList.remove("invalid");
      t.closest(".field")?.querySelector(".error")?.remove();
    }
    if (t.dataset.otp !== undefined) {
      const digits = t.value.replace(/\D/g, "").slice(-1);
      if (t.value !== digits) t.value = digits;
      if (digits)
        setTimeout(() => $(`[data-otp="${+t.dataset.otp + 1}"]`)?.focus(), 0);
    }
  });
  document.addEventListener("paste", (e) => {
    if (e.target.dataset.otp === undefined) return;
    const s = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (s) {
      e.preventDefault();
      $$("[data-otp]").forEach((i, n) => (i.value = s[n] || ""));
      $(`[data-otp="${Math.min(5, s.length - 1)}"]`)?.focus();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (
      e.target.dataset.otp !== undefined &&
      e.key === "Backspace" &&
      !e.target.value
    )
      $(`[data-otp="${+e.target.dataset.otp - 1}"]`)?.focus();
  });
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.field) {
      state.values[t.dataset.field] = t.value;
      if (["bankReady", "webReady"].includes(t.dataset.field)) render();
    }
    if (t.dataset.list) {
      let a = state[t.dataset.list];
      t.checked ? a.push(t.value) : a.splice(a.indexOf(t.value), 1);
      if (t.dataset.list === "scenes") render();
    }
    if (t.dataset.toggle) state[t.dataset.toggle] = t.checked;
    if (t.id === "declaration") state.declaration = t.checked;
    if (t.dataset.file)
      acceptFiles(
        t.dataset.file,
        [...t.files],
        +t.dataset.max,
        t.dataset.image === "true",
      );
    if (t.id === "status-filter") {
      state.filter = t.value;
      render();
      $("#status-filter").value = state.filter;
    }
    if (t.id === "shop-file") {
      let f = t.files[0];
      if (f && f.size <= 10 * 1024 * 1024 && /\.(png|jpe?g|pdf)$/i.test(f.name))
        state.shopFile = { name: f.name, size: f.size };
      else $("#shop-error").textContent = "請選擇 10 MB 以下 JPG／PNG／PDF";
    }
  });
  document.addEventListener("dragover", (e) => {
    let d = e.target.closest("[data-drop]");
    if (d) {
      e.preventDefault();
      d.classList.add("drag");
    }
  });
  document.addEventListener("dragleave", (e) =>
    e.target.closest("[data-drop]")?.classList.remove("drag"),
  );
  document.addEventListener("drop", (e) => {
    let d = e.target.closest("[data-drop]");
    if (d) {
      e.preventDefault();
      acceptFiles(
        d.dataset.drop,
        [...e.dataTransfer.files],
        +d.dataset.max,
        d.dataset.image === "true",
      );
    }
  });
  document.addEventListener("click", (e) => {
    let el = e.target.closest("[data-action]");
    if (el) {
      e.preventDefault();
      if (!el.disabled) actions[el.dataset.action]?.(el);
    }
  });
  window.addEventListener("hashchange", render);
  setInterval(updateTimer, 1000);
  render();
})();

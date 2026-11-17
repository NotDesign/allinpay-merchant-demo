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

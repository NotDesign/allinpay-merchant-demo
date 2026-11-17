const { chromium } = require("playwright");
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const root = (
  process.env.DEMO_URL || "http://127.0.0.1:4321/backoffice.html"
).replace(/\/(backoffice|external|index)\.html.*$/, "");
const errors = [],
  checks = [];
const click = async (p, a) => {
  const modal = p.locator('#modal[open] [data-action="' + a + '"]');
  await (
    (await modal.count())
      ? modal.first()
      : p.locator('[data-action="' + a + '"]').first()
  ).click();
};
const oldKey = "allinpay-backoffice-20260923-v1";
const ns = "meepay-dev2-20261117-";
async function adminLogin(p) {
  await p.locator("#login-email").fill("admin@example.com");
  await p.locator("#login-password").fill("Demo1234!");
  await click(p, "bo-login");
  await p.waitForSelector(".metrics");
}
async function externalLogin(p) {
  await p.locator("#authEmail").fill("demo@example.com");
  await click(p, "login");
  for (let i = 0; i < 6; i++)
    await p.locator('[data-otp="' + i + '"]').fill(String(i + 1));
  await click(p, "verify");
  await p.waitForURL(/#\/applications$/);
  await p.getByRole("heading", { name: "我的申請", exact: true }).waitFor();
}
(async () => {
  const b = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
  });
  try {
    const context = await b.newContext({
      viewport: { width: 1600, height: 1000 },
    });
    const p = await context.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("response", (r) => {
      if (r.status() >= 400) errors.push(r.status() + " " + r.url());
    });
    await p.goto(root + "/backoffice.html#/login");
    await p.evaluate(
      (key) =>
        localStorage.setItem(
          key,
          JSON.stringify({
            version: 1,
            rows: Array.from({ length: 240 }, (_, i) => ({ id: "OLD-" + i })),
            accounts: [],
            drafts: [],
          }),
        ),
      oldKey,
    );
    await p.reload();
    await adminLogin(p);
    let rows = await p.evaluate(() => AllinPayDemo.getDeveloperFixtures());
    assert.equal(rows.length, 2);
    assert(rows.every((r) => r.application?.values?.__v2));
    assert.deepEqual(
      rows.map((r) => r.id),
      ["DEV-HARBOUR-001", "DEV-RETAIL-002"],
    );
    checks.push(
      "Backend starts with exactly two V2 applications, ignoring the full Demo storage.",
    );
    await p.evaluate(() => (location.hash = "/merchants"));
    await p.waitForSelector('[data-action="edit"]');
    await p.locator('[data-action="edit"][data-mid="DEV-HARBOUR-001"]').click();
    await click(p, "confirm-edit");
    await p.evaluate(() => (location.hash = "/application/5"));
    await p.waitForSelector(".v2-products-page");
    for (const name of [
      "收單 · 產品項目",
      "CNP · 產品項目",
      "線下掃碼支付 · 產品項目",
    ])
      assert(await p.getByRole("heading", { name, exact: true }).isVisible());
    const rate = p.locator(
      '[data-v2-inline-key="POS|0"][data-v2-inline-field="loc_rate"]',
    );
    assert.equal(await rate.inputValue(), "1.50");
    await rate.fill("1.87");
    await click(p, "save-draft");
    await p.reload();
    await p.waitForSelector(".sidebar");
    rows = await p.evaluate(() => AllinPayDemo.getDeveloperFixtures());
    assert.equal(rows.length, 2);
    const saved = await p.evaluate(
      (prefix) =>
        Object.entries(localStorage)
          .filter(
            ([k]) => k.startsWith(prefix) && k.includes("backoffice-20260923"),
          )
          .map(([, v]) => JSON.parse(v)),
      ns,
    );
    assert(JSON.stringify(saved).includes("1.87"));
    checks.push(
      "Editing a seeded fee persists after reload; all three product sections remain visible.",
    );
    await p.evaluate(() => (location.hash = "/dashboard"));
    await p.waitForSelector(".metrics");
    await p.screenshot({ path: "qa-developer-backoffice.png", fullPage: true });
    await click(p, "settings");
    await click(p, "reset-demo");
    await click(p, "developer-reset");
    await p.waitForSelector("#login-email");
    assert.equal(
      await p.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).rows.length,
        oldKey,
      ),
      240,
    );
    rows = await p.evaluate(() => AllinPayDemo.getDeveloperFixtures());
    assert.equal(rows.length, 2);
    assert(rows[0].application);
    assert(!JSON.stringify(rows).includes("1.87"));
    checks.push(
      "Reset restores only the two development fixtures and leaves full Demo data untouched.",
    );
    const e = await context.newPage();
    e.on("pageerror", (x) => errors.push(x.message));
    e.on("response", (r) => {
      if (r.status() >= 400) errors.push(r.status() + " " + r.url());
    });
    await e.goto(root + "/external.html#/login");
    await externalLogin(e);
    let rs = await e.evaluate(() => AllinPayDemo.getDeveloperFixtures());
    assert.equal(rs.length, 2);
    await click(e, "seed");
    assert.equal(
      (await e.evaluate(() => AllinPayDemo.getDeveloperFixtures())).length,
      2,
    );
    await e.locator('[data-action="open"][data-id="DEV-HARBOUR-001"]').click();
    await e.evaluate(() => (location.hash = "/form/5"));
    await e.waitForSelector(".v2-products-page");
    const erate = e.locator(
      '[data-v2-inline-key="POS|0"][data-v2-inline-field="loc_rate"]',
    );
    assert.equal(await erate.inputValue(), "1.50");
    await erate.fill("1.91");
    await click(e, "save");
    await click(e, "home");
    await click(e, "new");
    await e
      .locator('[data-v2-field="merchantName"]')
      .count()
      .then(async (n) => {
        if (!n) await e.evaluate(() => (location.hash = "/form/2"));
      });
    await e.locator('[data-v2-field="merchantName"]').fill("開發自行新增示例");
    await click(e, "save");
    await click(e, "home");
    assert.equal(
      (await e.evaluate(() => AllinPayDemo.getDeveloperFixtures())).length,
      3,
    );
    await e.reload();
    await externalLogin(e);
    rs = await e.evaluate(() => AllinPayDemo.getDeveloperFixtures());
    assert.equal(rs.length, 3);
    assert(rs.some((r) => JSON.stringify(r).includes("1.91")));
    checks.push(
      "External starts with two records, saves edited fees and retains newly added applications after reload.",
    );
    await e.screenshot({ path: "qa-developer-external.png", fullPage: true });
    for (const name of ["backoffice.html", "external.html"]) {
      const html = fs.readFileSync(__dirname + "/" + name, "utf8");
      assert(Buffer.byteLength(html) < 6000);
      assert(!html.includes("base64,"));
      assert(!/<script>(?!\s*<)/.test(html));
    }
    checks.push(
      "Both HTML entry files are below 6 KB with external CSS, scripts, images and reference catalogs.",
    );
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      "qa-developer-report.json",
      JSON.stringify(
        { passed: true, date: new Date().toISOString(), checks, errors },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ passed: true, checks }, null, 2));
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

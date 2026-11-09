# Mee Pay 開發交付指南 — 2026-11-09 / v1.12

本次應用程式基準為 `3c6eb82f933b0e7885bf2a0ab71a17ddb081f4f0`，版本為 `2026.11.09-hong-kong-bank-default-v1.12`。開發交付分支只補充文件及打包工具，應用程式沿用此基準。

## 先開啟 Demo

完整開發交付 ZIP 內有 `demo/`、`source/`、驗證紀錄及檔案清單。`demo/` 包含已建置 HTML 和本機 OCR 資源，`source/` 是可修改及重建的 GitHub 原始碼。`demo/` 保留發布當時的內容；開發說明以本指南及目前程式為準。

在解壓後的交付包根目錄執行（只需 Node.js，不必先安裝 npm 套件）：

```sh
node demo/scripts/serve.mjs
```

- 後台：<http://127.0.0.1:4321/backoffice.html#/login>
- External：<http://127.0.0.1:4321/external.html#/login>
- 示範帳號 `admin@example.com`，密碼 `Demo1234!`；External 可用示例電郵，示例 OTP 為 `123456`，不寄信。

直接雙擊 HTML 可查看業務流程；文件 OCR 請使用上述 HTTP 入口。校驗與打包工具使用 Python 3.9 以上。請在首次解壓、修改檔案之前執行 `python3 verify-package.py` 檢查交付包完整性。

## 修改與重建原始碼

GitHub 開發交付分支：`codex/developer-handoff-20261109-v112`。可直接選取此分支下載，或執行：

```sh
git clone --branch codex/developer-handoff-20261109-v112 --single-branch https://github.com/NotDesign/allinpay-merchant-demo.git
cd allinpay-merchant-demo
```

完整交付 ZIP 請先進入 `source/`；若直接 clone GitHub，則在 repository 根目錄執行同一組 npm 指令，不必再 `cd source`。使用 Node.js 22 與已提交的 `package-lock.json`。GitHub 原始碼 ZIP 不包含 `vendor/` 和 `node_modules/`，首次準備需要網路。

```sh
npm ci --ignore-scripts
npm run setup
npm run build
npm run build:external
npm run serve
```

`setup` 產生固定版本的 PDF.js、Tesseract、語言模型及 ExcelJS 本機資源。準備完成後，文件辨識不需要外部 OCR 服務。

| 用途 | 維護入口 |
| --- | --- |
| 後台外殼與登入／商戶頁 | `core.js`、`backoffice-extension.js`、`current-backoffice.js` |
| External 登入、邀請註冊及申請 | `external.template.html`、`external.js`、`external-registration.js`、`external-onboarding-bootstrap.js`、`external-onboarding-shell.js` |
| 共用表單、條件必填與產品 | `onboarding-v2-data.js`、`onboarding-v2.js`、`onboarding-v2.css` |
| MCC、香港銀行／分行 | `mcc-reference-data.js`、`mcc-reference.js`、`bank-code-data.js`、`bank-directory-data.js`、`bank-autofill.js` |
| 客戶／母子公司、模板及匯入 | `merchant-template-model.js`、`merchant-templates.js`、`merchant-workbook-model.js`、`merchant-workbook.js` |
| 表格、MID／同步狀態 | `merchant-table-state.js`（含後續覆寫，勿只看早期處理函式） |
| OCR、上傳、文件持有人與預覽 | `br-engine/`、`br-integration.js`、`multi-document-workflow.js`、`upload-controls.js`、`document-previews.js` |
| 風控、填寫進度、內審 | `onboarding-risk.js`、`onboarding-progress-risk.js`、`internal-review.js` |
| 帳號、角色與個別權限、閒置登出 | `account-hierarchy.js`、`account-credentials.js`、`role-permissions.js`、`session-timeout.js` |
| 通知與搜尋下拉 | `notifications.js`、`searchable-selects.js` |
| 樣式、Logo、分頁圖示 | 各功能 CSS、`merchant-templates.css`、`mee-pay-logo*.png`、`mee-pay-favicon.png` |

`build-admin.cjs` 與 `build-external.cjs` 的擴充載入清單有相依順序，模組共用既有 IIFE 作用域；不可當作互不相依的模組任意排序。`app.js`、`backoffice.html`、`external.html` 為生成檔，請修改來源後重建。

**不要使用舊的 `build.cjs` 作為目前建置入口。** 它不包含完整的共用 V2 擴充。`verify.cjs`、`verify-flows.cjs`、`PROGRESS.md` 部分內容是歷史紀錄；目前能力以本指南、最新程式及 `RELEASES.md` 開頭為準。

## 必須保留的欄位與行為

- 110 個表單欄位定義、21 類選填文件、11 類／117 項產品；既有產品費率欄位供其他平台對接，請保留代碼、數值精度及模式。參考 [產品費率契約](fixtures/product-rate-contract.json) 與 `verify-products-contract.cjs`。
- 目前是六步：文件材料 → 主體資料 → 經營與聯繫 → 結算帳戶 → 產品與費率 → 確認提交。1009 的 Azure／七步／KTC 手機示範是封存版本，不能當作目前主流程。
- MCC 使用客戶 CSV 的 292 個四碼代碼，支援複選與一個主要代碼；名稱獨立顯示。不是所有 MCC 都已有正式風險參數。
- 新申請的銀行國家／地區預設香港、只讀；對接仍使用 `cardCountryCode=HKG`。銀行行號帶入名稱及已知 SWIFT，分行帶入對應地址；舊有海外資料保留原國家及帳戶內容。金管局遠端查詢已移除。
- 公司內部 `id` 與 MID 分開；MID 可以為空，必須容納待提交、待同步、處理中、等待回應及失敗重試，正式值應由 All-In Pay 回傳。
- Excel 使用 ExcelJS 實際解析／匯出；範本有原生下拉清單。CSV 支援帶引號欄位，多個 MCC 以分號分隔。文件上傳不接受 ZIP。
- 文件辨識先展示來源與差異，由使用者確認後才套用；身份證必須明確選擇持有人，不可依檔名猜測身份。

來源與規則：[MCC](MCC_REFERENCE.md)、[銀行](BANK_DIRECTORY.md)、[風控](RISK_MODEL.md)、[內審](INTERNAL_REVIEW.md)、[合成測試文件](fixtures/README.md)。上述內審文件的日期為最初設計日期，後續變動需一併查看最新程式與發布紀錄。

## 正式開發仍需接上的服務

| 項目 | 目前實作 | 正式串接方向 |
| --- | --- | --- |
| 登入、註冊、密碼與 OTP | 瀏覽器內示例流程，部分快取密碼雜湊 | 由伺服器驗證、寄送 OTP、管理 session、失敗限制及憑證 |
| 角色、個別權限、內審及稽核 | 前端操作限制與本機紀錄 | 每個伺服器操作重新授權，保存可追溯的審批事件 |
| External／後台共用資料 | 各自的瀏覽器儲存範圍 | 共用商戶、申請、邀請及附件服務，校驗擁有者與版本 |
| 文件上傳／OCR | PDF.js／Tesseract 本機實作；附件留目前分頁記憶體 | 正式附件保存、存取權限及工作結果持久化；保留人工核對 |
| KYC／人像核驗、郵件、簽署 | 無正式服務接入 | 確認服務商、回傳驗證、結果狀態及失敗／逾時流程 |
| All-In Pay／OATS 同步 | MID 與成功／失敗／等待流程均為模擬 | 對接正式 API、回傳、冪等鍵及非同步結果；不要在前端產生正式 MID |
| 通知及風控 | 本機通知與透明規則示例 | 正式事件、收件者與權限；風控門檻需業務核定 |

本專案未附已核定的 OpenAPI 或正式資料庫 schema；上述是接入位置及待確認事項，不是現成的伺服器契約。請勿把 `AllinPayDemo` 診斷方法當作正式 API。

後台主要保存鍵為 `allinpay-backoffice-20260923-v1`，External 為 `allinpay-external-v2`，註冊資料另存 `allinpay-external-registrations-v1`。角色與模板的本機分組不等於正式資料隔離。附件中繼資料可隨草稿保存；重新載入後原文件需重新選取。清除儲存空間會移除 Demo 紀錄，交付包不包含任何目前瀏覽器資料或私人客戶樣本。

## 驗證與發布

先保持 `npm run serve` 執行，再於另一個終端機：

```sh
npx playwright install chromium
export DEMO_URL=http://127.0.0.1:4321/backoffice.html
export EXTERNAL_URL=http://127.0.0.1:4321/external.html
npm test
npm run test:onboarding
npm run test:products
npm run test:bank
npm run test:selects
npm run test:external
npm run test:templates
```

Windows PowerShell 可用 `$env:DEMO_URL='http://127.0.0.1:4321/backoffice.html'` 及 `$env:EXTERNAL_URL='http://127.0.0.1:4321/external.html'` 設定同名環境變數。發布打包需具備 `zip`／`unzip` 的環境，例如 WSL。

以上是常用檢查，不是全部測試。完整操作、文件、權限、閒置登出及其他檢查順序見 [Pages 工作流程](.github/workflows/pages.yml)；`npm test` 只跑後台基礎組。可使用 `CHROME_PATH` 指定 Chromium 系瀏覽器；Linux CI 以 `npx playwright install --with-deps chromium` 準備瀏覽器。

`npm run build:pages` 產生目前版本的 `_pages/` 及 HTML ZIP，需系統 `zip`。`scripts/verify-release.mjs` 還需 `unzip`，且必須先依工作流程加入 0929／1009 封存 artifact，不能在主版本單獨建置後直接執行。封存來源不可直接修改。

重新製作同樣結構的開發交付包：

```sh
python3 scripts/package-developer-handoff.py \
  --source-zip /path/to/github-source.zip \
  --demo-zip /path/to/allinpay-merchant-demo-20261109-v112.zip \
  --source-commit FULL_GITHUB_SOURCE_COMMIT \
  --output-dir /path/to/output
```

打包工具會核對應用版本、原始碼與 Demo 共同檔案，產生逐檔 SHA-256 清單及 ZIP；不讀取瀏覽器、私人樣本、工作目錄憑證或未提交檔案。

`--source-commit` 由打包者提供；交付時應先從對應固定 SHA 的 GitHub URL 下載原始碼 ZIP。打包紀錄保存實際來源 ZIP 的 SHA-256，以便重現與核對。

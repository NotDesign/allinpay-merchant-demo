# Mee Pay 開發交接 · v1.13
2026 年 11 月 20 日。後台與商戶申請端（External）的交付基準為 Git 提交 `0909faed1ca96d930dff9804fe3260013c28b5ac`。

## 啟動與測試
在解壓後的最外層執行以下指令。已建置的 Demo 含本機 OCR、PDF 與試算表套件，只需 Python 3。Windows 可將 `python3` 換成 `py -3`。

```sh
python3 start-demo.py
```

- 後台登入頁為 <http://127.0.0.1:4321/backoffice.html#/login>。示例管理員為 `admin@example.com`，示例密碼為 `Demo1234!`。
- 商戶申請入口為 <http://127.0.0.1:4321/external.html#/login>。Demo 驗證碼為 `123456`。
- 驗收 Sales 歸屬時，請以該 Sales 登入後台，使用「分享我的申請連結」，在同一瀏覽器開啟連結，註冊後儲存或提交。回到「商戶管理」，以公司名稱或 External 參考編號搜尋。該 Sales 和帳號樹中的上級可見，同級 Sales 查無該筆。可執行的操作仍取決於角色及帳號權限。
- 前後台需在相同瀏覽器、網域和連接埠操作。在終端機按 Ctrl+C 可關閉本機伺服器。

## 開發入口

| 路徑 | 用途 |
| --- | --- |
| `source/` | v1.13 完整 GitHub 快照。修改這裡的分檔 JS、CSS 和 HTML 樣板，再建置 |
| `demo/` | v1.13 已建置的後台、External、依賴、匯入範本及合成 OCR 測試檔 |
| `assets/` | 設計交付用的原色與白字透明 PNG Logo、favicon 和 24px 通知 SVG |
| `verification/` | 線上版本、檔案比對、UI、資料同步、Sales 歸屬及其他流程的測試報告 |
| `examples/two-merchants-v1.12/` | 11 月 17 日既有的兩商戶可讀版。含兩筆虛構資料、範例費率、可編輯模組及程式碼對照表 |
| `SHA256SUMS.txt` | 解壓檔案的 SHA-256 清單，可在 macOS 或 Linux 以 `shasum -a 256 -c SHA256SUMS.txt` 檢查 |

兩商戶版可用 `python3 start-demo.py --examples` 單獨啟動。預設使用 4322 埠，OCR、PDF 和 Excel 共用本包的離線依賴。費率範例在 `examples/two-merchants-v1.12/fixtures/dev-merchants.js`。v1.13 的共用介面、資料同步及 Sales 歸屬請以 `source/`、`demo/` 為準。

## 從原始碼建置

在 `source/` 目錄使用 Node.js 22 和 npm。首次安裝依賴需要連線。

```sh
npm ci --ignore-scripts
npm run setup
npm run build
npm run build:external
npm run serve
```

開啟上面的後台和 External 網址。若已啟動預建 Demo，請先關閉占用 4321 埠的伺服器。修改表單時編輯模組或樣板，`app.js`、`backoffice.html`、`external.html` 由建置指令產生。

| 工作項目 | 原始碼位置（相對於 source） |
| --- | --- |
| 按鈕、通知鈴鐺與可搜尋下拉 | `ui-components.js`、`ui-components.css`、`searchable-selects.js`、`notifications.js`、`UI_COMPONENTS.md` |
| External 註冊、商戶儲存、後台同步及邀請歸屬 | `external-registration.js`、`external.js`、`external-demo-bridge.js` |
| 角色與個別帳號權限 | `role-permissions.js`、`account-hierarchy.js`、`account-credentials.js` |
| 收單、CNP、線下掃碼、基礎費率及平台欄位契約 | `onboarding-v2.js`、`onboarding-v2-data.js`、`base-fee-editor.js`、`fixtures/product-rate-contract.json` |
| 香港銀行、分行、SWIFT 與 MCC | `bank-autofill.js`、`bank-directory-data.js`、`references/`、`BANK_DIRECTORY.md`、`MCC_REFERENCE.md` |
| 內審、文件下載、OCR 與風險 | `internal-review.js`、`br-engine/`、`br-integration.js`、`INTERNAL_REVIEW.md`、`RISK_MODEL.md` |
| 商戶模板及批量匯入 | `merchant-templates.js`、`merchant-template-model.js`、`merchant-workbook.js`、`import-templates/` |

在第二個終端機切到 `source/`。安裝測試用瀏覽器後可執行本次交接的重點檢查。

```sh
npx playwright install chromium
npm run test:ui
npm run test:bridge
npm run test:sales-scope
npm run test:products
```

全部測試及執行順序見 `source/.github/workflows/pages.yml`。此版本的完整 CI 結果已保存於 [GitHub Actions](https://github.com/NotDesign/allinpay-merchant-demo/actions/runs/44673649463)。

## 正式串接時的界線
Demo 將資料保存在瀏覽器。正式系統需持久化申請與附件、驗證登入身分，並在每個查詢與處理 API 檢查原 Sales 的帳號階層及操作權限。External 傳到後台的是附件描述，實際上傳的檔案須重新選取。銀行行號、分行及 SWIFT 使用包內的香港銀行對照資料。

[固定提交原始碼](https://github.com/NotDesign/allinpay-merchant-demo/tree/0909faed1ca96d930dff9804fe3260013c28b5ac) · [後台 Demo](https://notdesign.github.io/allinpay-merchant-demo/backoffice.html#/login) · [External](https://notdesign.github.io/allinpay-merchant-demo/external.html#/login)

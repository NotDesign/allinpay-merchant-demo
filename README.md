# Mee Pay — 兩商戶開發版（可讀原始碼）

2026-11-17 / v1.12。針對開發要求，保留現有 UI 與串接欄位，只將預載模擬商戶減至兩間，並改為分檔、可讀的原始碼與多檔案 Demo。

本分支：`codex/two-merchant-readable-20261117-v112`。與線上完整版及原交接分支分開。

## 啟動

Node.js 22 LTS 或以上：

```sh
npm ci --ignore-scripts
npm run setup
npm run dev
```

後台：<http://127.0.0.1:4321/backoffice.html#/login>  
External：<http://127.0.0.1:4321/external.html#/login>

後台帳號 `admin@example.com`，初始密碼 `Demo1234!`。其他角色帳號可用登入頁的示例角色快捷選擇。External 使用 `demo@example.com`，示例驗證碼 `123456`。

完整交接 ZIP 的 `demo/` 已帶本機 OCR/PDF/Excel 依賴，可直接用根目錄 `start-demo.command` 或 `python3 -m http.server 4321 --bind 127.0.0.1 --directory demo` 開啟；GitHub 原始碼 ZIP 需先執行上列安裝步驟。

## 從哪裡修改

| 內容                             | 原始檔                                                                    |
| -------------------------------- | ------------------------------------------------------------------------- |
| 兩間示例商戶、產品選擇與示例費率 | `fixtures/dev-merchants.js`                                               |
| 一次性載入及測試版重設行為       | `developer-fixtures.js`                                                   |
| 後台基礎版面、主框架             | `core.js`, `backoffice-extension.js`, `current-backoffice.js`             |
| External 登入／註冊／申請外框    | `external.js`, `external-registration.js`, `external-onboarding-shell.js` |
| 表單、原有產品／費率欄位與驗證   | `onboarding-v2.js`, `onboarding-v2-data.js`                               |
| 基礎費率直接編輯                 | `base-fee-editor.js`, `client-review.js`                                  |
| 角色及帳號獨立權限               | `role-permissions.js`, `account-hierarchy.js`, `account-credentials.js`   |
| 銀行行號／分行／SWIFT 與帶入     | `bank-code-data.js`, `bank-directory-data.js`, `bank-autofill.js`         |
| MCC 參考對照                     | `mcc-reference-data.js`, `mcc-reference.js`                               |
| HTML 外框／CSS                   | `index.html`, `external.template.html`, 各功能 `.css`                     |
| Logo、圖片                       | 根目錄 Mee Pay 圖檔、`assets/`, `assets.js`, `asset-manifest.json`        |
| 共用載入順序                     | `build-config.json`                                                       |
| 產生檔對照原始模組行數           | `module-map.json`                                                         |

修改原始模組後執行 `npm run build`，再重新整理。`app.js`、`external-app.js`、`backoffice.html`、`external.html` 與 `module-map.json` 是產生檔，請回到上表原始檔修改。

兩個應用程式原本有共用 IIFE 作用域；這次保留作用域與模組執行順序。產生的 JS 是有縮排、原始模組註解及行數對照的串接檔，沒有 minify。參考資料、CSS、圖片不再塞入 HTML 或邏輯 bundle。第三方 `vendor/` 套件保留官方發布格式。

## 兩間預載商戶

| 識別碼          | 商戶                     | 後台   | External | 費率示例                                   |
| --------------- | ------------------------ | ------ | -------- | ------------------------------------------ |
| DEV-HARBOUR-001 | 海港科技有限公司（示例） | 草稿   | 草稿     | POS 本地 1.50%、跨境 2.50%                 |
| DEV-RETAIL-002  | 新星零售有限公司（示例） | 待審核 | 審核中   | CNP 本地 2.00%、跨境 3.00%；線下掃碼 1.20% |

全部為虛構資料，費率只供 UI 和欄位核對。預設基礎費率仍為 0，原產品開通預設未選。兩間商戶由現有 V2 模型建立完整示例快照。示例附件只有中繼資料，沒有真實客戶文件。

後台及 External 是各自的瀏覽器本機示例，尚無正式後端同步；新增／編輯後資料會保留，重新整理不會截回兩筆。完整版的舊資料不會被匯入：本分支所有本機儲存使用 `meepay-dev2-20261117-` 前綴。後台「設定 → 重設全部 Demo 資料」只還原本測試版的兩間商戶。亦可在開發工具清除此前綴；請勿清除完整網域資料。

## 功能保留與驗證

保留六步流程、全部 110 個原欄位、21 類文件、117 個產品定義、原費率識別碼／收費類型／驗證、24 個產品參數、收單／CNP／線下掃碼三區、角色與帳號獨立權限、通知、商戶複製與模板、文件識別入口。完整 MCC／銀行／分行對照表屬於參考資料，沒有縮減成兩項。

```sh
npx playwright install chromium
npm run serve
# 另開終端機
npm test
```

可用 `DEMO_URL` 指定本機地址、`CHROME_PATH` 指定 Chromium/Chrome/Brave 路徑。測試涵蓋兩間初始商戶、儲存後保留、與完整版資料隔離、重設、原產品費率合約、MCC、香港銀行帶入、搜尋下拉、五分鐘閒置登出。較舊的 `verify-*.cjs` 仍留供參考；部分以完整版樣本數為前提，未納入本分支 `npm test`。

`onboarding-v2.js` 中兩個費率函式保留原始字面格式，讓既有 SHA256 合約驗證仍能逐字核對；其他原始碼已格式化。不要把正式平台欄位改名或刪除。原完整版交接文件見 `DEVELOPMENT-UPSTREAM-v112.md`。

認證、註冊、審批、同步等仍是 Demo；實際後端 API／資料庫實作請按開發端契約接入。OCR 本機套件可用，這次驗證不代表實際客戶文件辨識準確率提升。

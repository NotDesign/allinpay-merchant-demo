# ALLINPAY · 商戶申請與後台 Demo

依指定 Figma 設計製作的繁體中文互動原型。2026-09-24 更新後台新增商戶、頁內費率、特計商戶及風控側欄，內含 240 間假商戶、28 個示例帳號、18 份可繼續填寫的草稿。既有外部申請保持獨立。此 Repository 和網站為公開示範，請勿輸入真實密碼、商戶資料或證件。

## 直接使用

- [外部申請](https://notdesign.github.io/allinpay-merchant-demo/external.html)
- [後台登入與系統（單一 HTML）](https://notdesign.github.io/allinpay-merchant-demo/backoffice.html)
- [下載單一 HTML](https://github.com/NotDesign/allinpay-merchant-demo/raw/refs/heads/main/backoffice.html)
- [下載完整原始碼 ZIP](https://github.com/NotDesign/allinpay-merchant-demo/archive/refs/heads/main.zip)

下載 ZIP 後可直接開啟 `external.html` 或 `backoffice.html` 演示業務流程；單一 HTML 內嵌畫面、假資料及互動。**實際 BR 辨識請使用線上 Demo，或安裝本機 OCR 資源並用 HTTP 啟動完整原始碼**（下方指令）。`index.html` 是同一後台的多檔案入口。

## Demo 帳號

| 用途 | 帳號／代碼 |
| --- | --- |
| 外部電郵登入 | 任意有效格式的示例電郵，例如 `demo@example.com` |
| 電郵驗證碼 | `123456`，不寄送郵件 |
| 後台最高管理員 | `admin@example.com` |
| 後台基本管理員 | `manager@example.com` |
| 後台主代理商 | `chan@example.com` |
| 後台次代理商 | `lam@example.com` |
| 後台共用示例密碼／權限修改驗證 | `Demo1234!` |

後台登入頁也可按角色快速填入示例帳號。Google 登入只演示確認流程，不會連接 Google。

## 外部申請流程

登入／登記 → 電郵驗證 → 我的申請 → 六頁資料 → 檢閱及簽署 → 模擬提交 → 查看進度。

- 公司資料、業務資料、公司銀行帳戶、聯絡人、收款方式、最終受益人及董事。
- 表單必填／格式驗證、錯誤摘要、條件選項；「填入示例」可加快演示。
- 可新增／編輯店鋪、個人或公司受益人、董事，並選擇文件。
- 可手寫簽名或使用標明 DEMO 的示例簽名。
- 儲存草稿、模擬儲存失敗及重試、依電郵或申請編號提取本瀏覽器草稿、下載 JSON 備份。
- 「我的申請」顯示草稿、審核中或已完成紀錄；可載入進度示例、繼續填寫或查看資料。
- 模擬提交失敗時保留內容及簽名，可重試或儲存草稿。

## 後台流程

- 登入、註冊、電郵驗證、忘記／重設密碼的示例介面。
- 儀表板動態統計、待審核／待補資料／同步失敗清單；審核通過、拒絕及退回補件，後兩者須選擇原因並補充說明。
- 商戶搜尋及每頁 20／40／80 筆、29 個表格欄位；隱藏、調序、排序及凍結欄位。
- 表頭三角形開啟 260px 小選單；排序單選 Active、輸入後顯示相符內容、全選／取消全選／複選篩選。
- 銀行帳號原位顯示／隱藏、公司詳情四分頁、編輯、重新選取文件、商戶轉換新舊資料對照。
- 新增商戶六步：文件材料、主體資料、經營與聯繫、結算帳戶、產品與費率、確認提交。
- BR 匯入五階段：選檔／選頁 → 本機辨識 → 原件核對 → 準備套用 → 成功／失敗結果。線上版實際處理文字 PDF、掃描 PDF、JPG、PNG，支援方向與平面歪斜校正。
- 新增商戶已同步 OATS V2：109 個欄位定義（含 61 個原型基本欄位、重複人員欄位及產品配置）、21 類文件、11 類／117 項產品。可點擊步驟列，並儲存／還原草稿。
- 地區、法律地位、產品及風險級別決定條件必填；董事可被授權簽名人或控股股東沿用。香港／新加坡 AMEX 情境只可登記一位授權簽名人。
- 11 類產品選項完整保留，預設選取收單、CNP、線下掃碼支付；勾選類別後顯示詳細費率。Regional、Blended、Wallet、按筆及分期直接在頁面編輯，包含優惠費率、DCC、優計劃及 7 種分期期數，毋須逐項開啟 Overlay。
- 六步均顯示右側固定風控、缺件及提交完整度側欄；內容依目前填寫資料更新。特計商戶以三欄表格呈現，未填 MCC 時停用，填寫後依各卡組織規則提供可用方案。
- BR 以外的 CI、NAR1／NNC1、身份證及銀行月結單辨識仍使用固定假資料；缺件及風控是本機規則示例，不代表正式合規驗證。
- 帳號管理、個別帳號權限 Overlay；儲存前輸入示例密碼。修改只影響選取帳號，不影響同角色其他帳號。
- 四層角色及「權限不足」演示：只顯示自己的帳號、隱藏其他人的權限且不可編輯。
- 批量導入示例、操作記錄、設定及登出。
- 最高管理員、基本管理員、主代理商及次代理商均可分享外部申請連結。管理員連結附 `inviter` 帳號 ID，代理商保留 `agency` 代碼；此為追蹤參數示範，不會自動串接外部表單資料。

## Figma 來源

檔案：[`AllinPay_Merchant`](https://www.figma.com/design/sxaOCLv6tQwQeOzZIG4XsY/AllinPay_Merchant)

| 範圍 | 指定節點 |
| --- | --- |
| 外部申請及相關狀態 | `453:4504` |
| 後台登入 | `453:3455` |
| 後台系統 | `99:5` |
| 儀表板／商戶管理 | `619:4815`／`206:1549` |
| 新增商戶六步 | `110:15`、`595:5192`、`110:39`、`110:31`、`110:23`、`595:5298` |
| 帳號管理／權限 | `619:4709`／`658:4613` |
| 商戶轉換／批量導入／草稿 | `241:2918`／`110:47`／`479:4378` |

Logo、圖片及功能圖示使用 Figma 回傳素材。`asset-manifest.json` 保存外部頁素材的內嵌資料，讓下載版本可以離線重建。`source-figma.json` 是原八頁資料快照，並不代表全部新功能的來源快照。

### OATS V2 更新

依照 Figma 六個既有畫面同步後台 HTML；2026-09-24 改為頁內編輯費率。欄位定義、各選項及產品清單保存在 `onboarding-v2-data.js`，互動在 `onboarding-v2.js`，即時狀態在 `onboarding-risk.js`，版面在 `onboarding-v2.css`。未將使用者提供的原始 HTML 或其外部編輯腳本加入公開 Repository。

- 原有 DBA no. 及香港分行代碼選填功能保留。SWIFT Code 改為選填；結算週期可自行輸入。
- MCC 行業名稱由代碼帶出；維護人名稱／電郵替換舊財務聯絡欄位。
- V2 舊草稿保留原值，開啟時提示重新核對選項與新增必填資料，不會自動把未知舊費率視為有效。
- BR 只在確認後寫入已選欄位，原有差異值預設保留，須逐項選擇取代。其他文件的辨識示例不分析本機檔案內容。文件差異的確認只適用當次內容，再修改會重新要求核對。
- 現有外部申請 `external.html` 不在本次後台「新增商戶」欄位更新範圍內，保持原版本。

## 重要界線

- 這是前端互動原型，不是正式登入、授權或商戶系統。BR 具有實際本機 OCR；登入、權限、電郵、KYC、All-In Pay API 及銀行驗證仍為前端示例，沒有正式後端。
- 密碼、OTP、角色和權限都在前端模擬，不提供安全隔離。QR Code／TOTP 功能依要求暫停，未納入。
- 外部申請與後台資料**不會自動串接**；兩者用各自的本機示例資料。
- 草稿和示例帳號存在目前瀏覽器 localStorage，沒有加密或跨裝置同步。不同網址（包含單檔版與伺服器版）可能使用不同儲存空間。清除瀏覽器資料會移除紀錄。
- 檔案不會上傳至伺服器；草稿只保存附件名稱／大小等中繼資料，重新載入後真實附件要重新選取。示例附件並非真實文件。
- 儀表板統計根據目前瀏覽器的假資料計算，會隨提交、審核及同步結果更新。正式商業規則、銀行／MCC／地區清單仍需串接正式資料。
- 批量導入僅處理簡單 CSV 示範格式（不含引號內逗號）；Excel 為明確標示的模擬結果，不是完整試算表解析器。
- 此公開靜態網站的 HTML、JavaScript 及示例資料皆可下載；不索引不代表私人或存取控制。

## 開發與驗證

本機開發需 Node.js 22 以上。先下載固定版本的 OCR／PDF 資源，之後辨識不依賴 CDN 或外部 OCR 服務：

```sh
npm ci --ignore-scripts
npm run setup
npm run build
npm run serve
# http://127.0.0.1:4321/backoffice.html
```

`build.cjs` 重建兩個獨立 HTML 及 `app.js`；`node build-admin.cjs` 只重建後台，不影響外部申請。修改來源後應重新執行。

後台瀏覽器回歸測試（需另裝 Playwright，僅測試使用）：

```sh
npx playwright install chromium
# 先以任意靜態伺服器提供目前目錄，再指定 URL
DEMO_URL=http://127.0.0.1:4321/backoffice.html node verify-admin.cjs
DEMO_URL=http://127.0.0.1:4321/backoffice.html node verify-onboarding-v2.cjs
DEMO_URL=http://127.0.0.1:4321/backoffice.html npm run test:products
DEMO_URL=http://127.0.0.1:4321/backoffice.html npm run test:risk
DEMO_URL=http://127.0.0.1:4321/backoffice.html node verify-admin-extra.cjs
npm run test:br
```

可用 `CHROME_PATH` 指定本機 Chromium 系瀏覽器，或 `PLAYWRIGHT_PATH` 指定既有套件位置。測試使用獨立瀏覽器資料，包含登入錯誤、OTP、審核、個別權限、草稿、新增商戶、行動版及離線單檔。`qa-report.json` 記錄最後一次驗證結果，不代表正式資安驗證。

- 外部來源：`external.template.html`、`external.css`、`external.js`。
- 後台來源：`core.js`、`backoffice-extension.js`、`current-backoffice.js`、`onboarding-v2.js`、`onboarding-v2-data.js` 及對應 CSS、`data.js`。
- `app.js`、`external.html`、`backoffice.html` 為生成檔案，不應直接修改。
- `verify.cjs`／`verify-flows.cjs`：舊版靜態檢查留存，部分舊後台假資料及 DOM 假設不適用本版本；後台以 `verify-admin.cjs` 為準。

另以瀏覽器測試外部簽名、失敗重試、後台權限密碼、權限不足、表格顯隱及凍結，並檢查窄螢幕容器溢出。這些測試不代表正式資安或合規驗證。


## BR 整合與發布紀錄（2026-09-23）

此版的交付目標是整個後台。已結案的獨立 BR 驗證 Demo 未再擴充；沿用其辨識核心，整合在新增客戶內。詳見 [進度與測試清單](PROGRESS.md)。

- `br-integration.js`：Overlay、核對、衝突處理、失敗重試及六步表單映射。
- `br-engine/`：PDF 文字層、OCR、旋轉、歪斜與低解析度補救；原始文件只保存在記憶體。
- `vendor/`：由 `npm run setup` 產生，固定套件版本；模型、WASM、PDF Worker 均由本站提供。
- `fixtures/`：人工合成測試文件，非真實商戶資料。
- 中文／英文名稱、BR 號碼、有效期及法律地位帶入 Step 2；完整地址及業務性質（備註）帶入 Step 3，Step 6 一併顯示。CR 號碼、MCC、地址行政區、公司成立日期、經營年限及聯絡資料不由 BR 猜測。
- 未確認候選及 OCR 原文不會寫入 localStorage；按儲存草稿才保存已填表單欄位和附件中繼資料，重載後須重新選取原件。
- 「90% 以上」仍是驗收目標。合成測試文件通過不等於真實文件集已達此正確率；需使用獲授權的代表性 BR 樣本，按欄位正確率、文件成功率與人工修改率驗收。

GitHub Pages 使用 `.github/workflows/pages.yml`：安裝固定相依套件 → 產生本站 OCR 資源 → 打包 → 後台及 BR 瀏覽器測試 → 發布 `_pages`。採用 [GitHub 官方 Pages 工作流程](https://github.com/actions/starter-workflows/blob/main/pages/static.yml) 的 artifact 部署方式，檔案發布採白名單。執行失敗時不發布新 artifact。

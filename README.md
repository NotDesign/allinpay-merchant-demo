# ALLINPAY · 商戶申請與後台 Demo

依指定 Figma 設計製作的繁體中文互動原型。2026-09-23 更新後台登入與系統，內含 240 間假商戶、28 個示例帳號、18 份可繼續填寫的草稿。既有外部申請保持獨立。此 Repository 和網站為公開示範，請勿輸入真實密碼、商戶資料或證件。

## 直接使用

- [外部申請](https://notdesign.github.io/allinpay-merchant-demo/external.html)
- [後台登入與系統（單一 HTML）](https://notdesign.github.io/allinpay-merchant-demo/backoffice.html)
- [下載單一 HTML](https://github.com/NotDesign/allinpay-merchant-demo/raw/refs/heads/main/backoffice.html)
- [下載完整原始碼 ZIP](https://github.com/NotDesign/allinpay-merchant-demo/archive/refs/heads/main.zip)

下載 ZIP 後可直接開啟 `external.html` 或 `backoffice.html`。兩者皆為獨立單檔，圖片、CSS 和 JavaScript 已內嵌，不需安裝套件。兩檔放在同一資料夾可互相切換。`index.html` 是後台多檔案版入口。

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
- BR 匯入五階段示例：匯入 → 辨識 → 核對 → 已核對、準備套用 → 匯入結果。此單檔以固定假資料模擬，不包含 OCR 引擎。
- 原有 105 個來源欄位、27 個文件項目、可點擊步驟列、草稿及成功／失敗視窗。
- 帳號管理、個別帳號權限 Overlay；儲存前輸入示例密碼。修改只影響選取帳號，不影響同角色其他帳號。
- 四層角色及「權限不足」演示：只顯示自己的帳號、隱藏其他人的權限且不可編輯。
- 批量導入示例、操作記錄、設定及登出。
- 代理商可分享附 agency 代號的外部申請連結；此為追蹤參數示範，不會自動串接外部表單資料。

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

## 重要界線

- 這是前端互動原型，不是正式登入、授權或商戶系統。沒有後端、真正電郵、KYC、OCR、All-In Pay API 或銀行驗證。
- 密碼、OTP、角色和權限都在前端模擬，不提供安全隔離。QR Code／TOTP 功能依要求暫停，未納入。
- 外部申請與後台資料**不會自動串接**；兩者用各自的本機示例資料。
- 草稿和示例帳號存在目前瀏覽器 localStorage，沒有加密或跨裝置同步。不同網址（包含單檔版與伺服器版）可能使用不同儲存空間。清除瀏覽器資料會移除紀錄。
- 檔案不會上傳至伺服器；草稿只保存附件名稱／大小等中繼資料，重新載入後真實附件要重新選取。示例附件並非真實文件。
- 儀表板統計根據目前瀏覽器的假資料計算，會隨提交、審核及同步結果更新。正式商業規則、銀行／MCC／地區清單仍需串接正式資料。
- 批量導入僅處理簡單 CSV 示範格式（不含引號內逗號）；Excel 為明確標示的模擬結果，不是完整試算表解析器。
- 此公開靜態網站的 HTML、JavaScript 及示例資料皆可下載；不索引不代表私人或存取控制。

## 開發與驗證

重建需 Node.js，打包無外部套件依賴：

```sh
node build.cjs
node --check app.js
node --check external.js
```

`build.cjs` 重建兩個獨立 HTML 及 `app.js`；`node build-admin.cjs` 只重建後台，不影響外部申請。修改來源後應重新執行。

後台瀏覽器回歸測試（需另裝 Playwright，僅測試使用）：

```sh
npm install --no-save playwright
npx playwright install chromium
# 先以任意靜態伺服器提供目前目錄，再指定 URL
DEMO_URL=http://127.0.0.1:4319/backoffice.html node verify-admin.cjs
```

可用 `CHROME_PATH` 指定本機 Chromium 系瀏覽器，或 `PLAYWRIGHT_PATH` 指定既有套件位置。測試使用獨立瀏覽器資料，包含登入錯誤、OTP、審核、個別權限、草稿、新增商戶、行動版及離線單檔。`qa-report.json` 記錄最後一次驗證結果，不代表正式資安驗證。

- 外部來源：`external.template.html`、`external.css`、`external.js`。
- 後台來源：`core.js`、`backoffice-extension.js`、`current-backoffice.js`、`styles.css`、`backoffice.css`、`current-backoffice.css`、`data.js`。
- `app.js`、`external.html`、`backoffice.html` 為生成檔案，不應直接修改。
- `verify.cjs`／`verify-flows.cjs`：舊版靜態檢查留存，部分舊後台假資料及 DOM 假設不適用本版本；後台以 `verify-admin.cjs` 為準。

另以瀏覽器測試外部簽名、失敗重試、後台權限密碼、權限不足、表格顯隱及凍結，並檢查窄螢幕容器溢出。這些測試不代表正式資安或合規驗證。

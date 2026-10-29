# Demo 版本紀錄

2026/10/29 · UX v2：MCC 整合搜尋複選、對齊及連續選取；修正示例首次點擊；批量套用可關閉失敗模擬並保留選擇重試。模板工具移入功能列，按鈕改為「匯入資料」。客戶／集團名稱獨立記錄，支援改名與刪除前選取替代集團、預覽公司移轉，保留公司資料。後台及 External 共同新增整體／逐頁填寫進度、可追溯的動態風控規則、PDF／圖片縮圖與查看／換檔／刪除。文件上傳不接受 ZIP；下載用的完整 HTML ZIP 仍提供。

風控數值為本 Demo 的規則式試算，公開參考只用於評估維度與可解釋的呈現方式，非 Stripe／Adyen 正式模型。詳細條件、示範權重及來源見 `RISK_MODEL.md`，亦可在風控卡按「計分邏輯」查看。0929、1009 固定封存版不變。

2026/10/29：主站在 0929 基礎上加入 MCC 複選、客戶及主／子公司關係、商戶與產品費率模板、跨頁批量套用及 Excel／CSV 組合匯入。新增 `versions/20260929/` 固定保存原版；1009 封存入口維持原路徑。舊的明確版本書籤（`v=20260929-restored`／`v=391f597`）會導向 0929 固定入口。

新版 ZIP：`downloads/allinpay-merchant-demo-20261029.zip`。原有 0929 ZIP 下載網址保留為固定版的相同檔案。所有版本與來源均可從 `versions.html` 選取。

以下為 2026/10/09 的歷史回復紀錄：當日按使用者要求，先封存當前版本，再將主站恢復至 2026/09/29 最後發布版本。Figma 不在該次回復範圍。

| 版本 | 原始 commit | 用途 |
| --- | --- | --- |
| 2026.09.29-excel-freeze-mid-states | `391f597dcdbae4a021932ba4ea3db71b31537784` | 目前主站：後台及 External |
| 2026.10.09-control-spacing-v3 | `896fe605744fd0a39a0d06da9b1cd0617255ddcb` | 固定封存：Azure、七步表單、OTP、KTC 手機實拍 Demo |

- [版本入口及兩版 ZIP](https://notdesign.github.io/allinpay-merchant-demo/versions.html)
- [目前主站後台](https://notdesign.github.io/allinpay-merchant-demo/backoffice.html?v=20260929-restored#/login)
- [目前主站 External](https://notdesign.github.io/allinpay-merchant-demo/external.html?v=20260929-restored#/login)
- [10/09 封存後台](https://notdesign.github.io/allinpay-merchant-demo/versions/20261009-control-spacing-v3/backoffice.html#/login)
- [10/09 封存 External](https://notdesign.github.io/allinpay-merchant-demo/versions/20261009-control-spacing-v3/external.html#/login)
- 封存分支：`codex/frozen-20261009-control-spacing-v3`。部署永遠鎖定完整 commit，不跟隨浮動分支。

## 回復範圍與保全

主版本的應用程式、樣式、資源及測試恢復為 9/29 原始內容。只增加版本說明、ZIP 打包與封存部署步驟；沒有混入 10/09 的新介面或功能。Git 歷史不重寫，10/09 源碼仍完整保留。

封存版按固定 commit 重建。為避免邀請／登入連結跳回主版本，打包時只把絕對站內連結移至封存子目錄；設計及功能不改。`archive.json` 記錄這項路徑調整。

版本不包含使用者瀏覽器內的草稿、證件或相機照片，不會清除本機 Demo 資料。同一 origin 的既有儲存鍵可能共用，需要分開比較時使用不同瀏覽器設定檔。

## 重建

`npm ci --ignore-scripts && npm run setup && npm run build:pages` 產生主站及 9/29 ZIP。完整雙版本部署由 `.github/workflows/pages.yml` 執行：另取固定 10/09 commit，重建後執行 `scripts/append-frozen-release.mjs`，最後一併發布到 Pages。

ZIP 含瀏覽器本機 OCR 所需資源。解壓後執行 `node scripts/serve.mjs`，開啟 `http://127.0.0.1:4321/backoffice.html` 或 `external.html`。手機相機 Demo 需要 HTTPS 或 localhost，沒有正式 KYC／人臉比對服務。

# Demo 版本紀錄

2026/10/09 按使用者要求，先封存當前版本，再將主站恢復至 2026/09/29 最後發布版本。Figma 不在這次回復範圍。

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

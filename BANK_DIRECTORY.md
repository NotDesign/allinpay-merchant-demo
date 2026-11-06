# 銀行資料對照及金管局 API

銀行名稱／行號、分行地址及會員 SWIFT／BIC 分開記錄，不共用一個來源地址欄位。

- 名稱及行號沿用原 152 項官方參考清單（`BANK_CODE_REFERENCE`）。
- 分行：HKICL「銀行編號及分行編號一覽表」，2026-11-02 版；與既有銀行代碼精確對應後有 2,767 筆分行記錄。
- SWIFT：HKICL「List of BICs of Members」，2026-07-10 版；148 個既有銀行代碼有會員 BIC。這不是全球分行 BIC 完整目錄，不能替代銀行的指定匯款指示。
- 106、150、164、371 在本次官方分行／BIC 資料中沒有對應資料，不臆測替代銀行或 BIC；保留手動欄位。

## 填表行為

選取行號後帶入名稱及已知會員 SWIFT。地址以「銀行行號＋分行編號」查找，不能把 004、012 等銀行的任意一個分行當成開戶分行。只有唯一地址時直接帶入；其餘輸入／選取分行編號後帶入該分行地址。銀行名稱的選擇仍與行號雙向連動，地址及 SWIFT 可按實際資料修改。換銀行時清除舊分行及其地址，已儲存的手動修改不會因刷新或還原而被覆寫。

資料值的銀行編號、分行編號均為字串，保留前置零。此版不更改既有表單欄位識別碼或平台費率契約。

## 主要業務地址 API

金管局 `register-ais-lros` 提供 `name`、`local_address`、`principle_address`、`type` 等欄位，沒有行號或 SWIFT。`local_address` 為香港主要業務地址，不是開戶分行、BIC 登記或指定匯款地址。

畫面可開啟「查詢金管局主要地址」，明確按「連接金管局／重試」執行公開 GET。僅以銀行名稱精確正規化並唯一匹配；查詢結果只作參考顯示，不覆寫分行地址。請求不附登入憑證或表單內容，逾時保留原值，內建對照及手動填寫繼續可用。後台 CSP 只額外允許 `https://api.hkma.gov.hk`。

2026-11-06 實際本機 HTTP 及瀏覽器連線均逾時，尚未驗證服務實際連通或 CORS。自動測試對成功、格式及失敗分支採模擬 API 回應，不能當作正式服務接通證據。

## 來源

- [HKICL 銀行及分行代碼](https://fps.hkicl.com.hk/eng/information_centre/clearing_code_and_branch_code_list.php)
- [HKICL 會員 BIC](https://www.hkicl.com.hk/eng/information_centre/list_of_live_and_t%26t_bics_of_members.php)
- [金管局 API 規格](https://apidocs.hkma.gov.hk/chi/documentation/bank-svf-info/register-ais-lros/)

原工作簿只作讀取。`bank-directory-data.js` 記錄來源日期、來源網址及工作簿雜湊；以 `scripts/build-bank-directory.py --branches /path/branches.xlsx --bics /path/bics.xlsx` 重建。實際商用資料的更新及供應授權需由正式系統處理；Demo 不宣稱已接入商用銀行目錄服務。

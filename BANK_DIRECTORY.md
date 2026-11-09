# 內建銀行及分行資料對照

銀行名稱／行號、分行地址及會員 SWIFT／BIC 分開記錄，不共用一個來源地址欄位。

- 名稱及行號沿用原 152 項官方參考清單（`BANK_CODE_REFERENCE`）。
- 分行：HKICL「銀行編號及分行編號一覽表」，2026-11-02 版；與既有銀行代碼精確對應後有 2,767 筆分行記錄。
- SWIFT：HKICL「List of BICs of Members」，2026-07-10 版；148 個既有銀行代碼有會員 BIC。這不是全球分行 BIC 完整目錄，不能替代銀行的指定匯款指示。
- 106、150、164、371 在本次官方分行／BIC 資料中沒有對應資料，不臆測替代銀行或 BIC；保留手動欄位。

## 填表行為

選取行號後帶入名稱及已知會員 SWIFT。地址以「銀行行號＋分行編號」查找，不能把 004、012 等銀行的任意一個分行當成開戶分行。只有唯一地址時直接帶入；其餘輸入／選取分行編號後帶入該分行地址。銀行名稱的選擇仍與行號雙向連動，地址及 SWIFT 可按實際資料修改。換銀行時清除舊分行及其地址，已儲存的手動修改不會因刷新或還原而被覆寫。

資料值的銀行編號、分行編號均為字串，保留前置零。此版不更改既有表單欄位識別碼或平台費率契約。

## 操作順序及資料來源

後台及 External 先選銀行所在地及銀行行號，帶入銀行名稱與已知會員 SWIFT；再以可搜尋的分行選單帶入對應地址。分行可按編號、名稱或地址搜尋；清單以外保留手動輸入。換銀行清除舊分行與地址，清除分行時只清除原先自動帶入的地址。已儲存的手動修改仍可還原。

銀行資料使用內建對照表，填寫過程不發出金管局 API 或其他遠端銀行查詢。金管局查詢按鈕、視窗及相關請求已移除。

## 來源

- [HKICL 銀行及分行代碼](https://fps.hkicl.com.hk/eng/information_centre/clearing_code_and_branch_code_list.php)
- [HKICL 會員 BIC](https://www.hkicl.com.hk/eng/information_centre/list_of_live_and_t%26t_bics_of_members.php)

原工作簿只作讀取。`bank-directory-data.js` 記錄來源日期、來源網址及工作簿雜湊；以 `scripts/build-bank-directory.py --branches /path/branches.xlsx --bics /path/bics.xlsx` 重建。實際商用資料的更新及供應授權需由正式系統處理；Demo 不宣稱已接入商用銀行目錄服務。

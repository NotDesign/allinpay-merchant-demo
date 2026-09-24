# 內審控制台 — 2026-09-24

Figma 位於原有「後台」Section，主畫面：
https://www.figma.com/design/sxaOCLv6tQwQeOzZIG4XsY/AllinPay_Merchant?node-id=1153-7176

登入最高／基本管理員後，主選單「商戶入網」群組下方 → **內審控制台**。
HTML route: `backoffice.html#/internal-review`。原有 240 筆假商戶共用同一資料來源，不複製公司資料庫。

## 可操作的功能

- 搜尋公司／MID／BR／DBA／聯繫人／銀行名稱或帳號；指定搜尋範圍與商戶狀態。
- 每頁 5、10、20、50 間；顯示筆數、上一頁／下一頁。切換案件不丟失未提交的備註。
- 六種合成文件預覽、放大；字段差異／風控評分／審批紀錄分頁。
- Demo 身份 L1／L2／L3；依案件階段啟用操作；填單人不可審批自己。
- 通過需確認核對；L3 終審必填理由；駁回或要求補件必選原因並填寫補充說明。
- 成功後隊列與商戶管理共用狀態、追加審批紀錄；模擬失敗／儲存失敗不改變原狀態。
- 角色無審核權限時不顯示入口，直接訪問 route 亦不能查看資料。
- 審批區依最新 Figma Fill：備註與提示滿寬、四個操作等寬並排，窄螢幕自動兩個一列；分頁按鈕與頁碼垂直置中。
- 待審卡片分開顯示風險／審批標籤：A 綠、B 藍、C 橘，L3 紅；沿用 Figma 狀態色與 6px 圓角。

## 安全及資料邊界

前端展示不是正式授權或審批系統。身份切換只為 Demo；不會寄出電郵、呼叫 OATS 或執行真實審批。
文件與 OCR 為清楚標示的合成示例。資料保存在本瀏覽器 localStorage；介面唯讀留痕不等同不可竄改稽核紀錄。
頁面計數依本機資料即時計算，與 Figma 的示例數字可能不同。

## Build / verify

`node build-admin.cjs` builds the standalone HTML. `npm run build:pages` prepares the hosted artifact.

`DEMO_URL=http://127.0.0.1:4321/backoffice.html node verify-internal-review.cjs`

The verification covers search, pagination, previews, field/risk/trail tabs, required reasons, failed writes, state persistence, self-review denial, permission denial, responsive widths and offline single-file use.

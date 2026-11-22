---
source-hash: 85c6a6b9acc6
---

# 主題

介面完全透過 CSS 自訂屬性設定樣式，在應用程式層級套用——絕不是依專案套用。

- **內建主題** — `doru`，應用程式 `themes/` 目錄中的單一 JSON 調色盤檔案：每款主題一個檔案，沒有 CSS。檔案同時包含 `dark` 和 `light` 調色盤；作業系統外觀決定套用哪一個——將作業系統切換到淺色模式，Dóru 會立即跟隨。檔案名稱就是主題 ID（`doru.json`）；內部的 `name` 欄位是顯示名稱。
- 在 `settings.json`（見[設定](settings.md)）中用單一字串選擇主題，或在應用程式內 **設定** 頁面（主題下拉式選單）中選擇；無論哪種方式，選擇都會儲存在 `settings.json` 中。
- 使用中調色盤的 `colors` 會在啟動時對應為 `--doru-*` CSS 自訂屬性。

## 使用者主題

將包含 `dark` 和 `light` 調色盤的 `<id>.json` 檔案放入應用程式資料目錄內的 `themes` 目錄（`settings.json` 所在的位置——見[設定](settings.md)），然後在 `settings.json` 中用 `"theme": "<id>"` 選擇它。新增檔案後請重新啟動應用程式以使其生效。該目錄會在首次執行時建立；ID 與內建主題相符的使用者主題會覆寫它。格式錯誤或與結構描述不符的主題檔案會被略過（並記錄警告），就像檔案不存在一樣，不會出現在主題清單中。內建主題帶有 `$schema` 參照（`https://doru.family/theme.json`）——將同一行新增到您自己的檔案中，即可在支援 JSON Schema 的編輯器中取得自動完成和驗證。

內建主題，每款都有深色與淺色調色盤：

| 主題 ID | 顯示名稱 |
|---|---|
| `doru`（預設） | Dóru |
| `one-dark` | One Dark |
| `github` | GitHub |
| `solarized` | Solarized |
| `gruvbox` | Gruvbox |
| `catppuccin` | Catppuccin |
| `ayu` | Ayu |
| `rose-pine` | Rosé Pine |
| `everforest` | Everforest |

預設 Dóru 調色盤跟隨應用程式圖示：深森林綠搭配溫暖的紙張色調。深色調色盤從接近黑色的綠色畫布逐層過渡到更明亮的介面框架和彈出式視窗；淺色調色盤使用溫暖的紙張和奶油色。

可用變數：

| 變數 | 意義 |
|---|---|
| `--doru-bg-canvas` | 編輯器背景與分頁列 |
| `--doru-bg-chrome` | 活動列、側邊欄、浮動面板表面 |
| `--doru-bg-raised` | 卡片、標籤、聊天輸入框 |
| `--doru-bg-popover` | 選單和選擇器 |
| `--doru-bg-input` | 按鈕、輸入框、選取方塊 |
| `--doru-fg` / `--doru-fg-muted` / `--doru-fg-faint` | 主要、柔和和淡色文字 |
| `--doru-border` / `--doru-border-strong` | 細線和更粗的邊框 |
| `--doru-accent` / `--doru-accent-hover` / `--doru-accent-active` | 強調色（森林/鼠尾草綠） |
| `--doru-on-accent` | 強調背景上的文字 |
| `--doru-accent-alpha` | 半透明強調色（標籤、聊天氣泡） |
| `--doru-focus` | 焦點環顏色 |
| `--doru-overlay-hover` / `--doru-overlay-pressed` | 懸停/按下覆蓋層 |
| `--doru-success` / `--doru-warning` / `--doru-danger` / `--doru-info` | 狀態顏色 |
| `--doru-radius-sm` / `--doru-radius-md` / `--doru-radius-lg` | 4 / 6 / 8 px 圓角 |
| `--doru-control-height` | 控制項高度（28px） |
| `--doru-panel-gutter` | 浮動面板與視窗邊緣之間的間距（4px） |
| `--doru-panel-radius` | 浮動面板圓角半徑（8px） |

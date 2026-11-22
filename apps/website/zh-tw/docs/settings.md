---
source-hash: ecff58fa2a2c
---

# 設定

全域設定位於應用程式資料目錄中的 `settings.json`：

| 作業系統 | 路徑 |
|---|---|
| macOS | `~/Library/Application Support/Doru/settings.json` |
| Linux | `~/.config/Doru/settings.json` |
| Windows | `%APPDATA%\Doru\settings.json` |

**預設值位於應用程式中；檔案只記錄明確的覆寫項目。** 首次執行時，應用程式會建立僅包含 `$schema` 參照的檔案——其他所有內容都會回到內建預設值，因此新的預設值會隨著應用程式更新提供給現有使用者。`$schema` 參照是唯一的文件來源：支援 JSON Schema 的編輯器（VS Code、Zed、JetBrains）可從中取得自動完成、驗證和欄位說明。應用程式僅在您於 **設定** 中變更某項設定時才會將項目寫入檔案；其他內容保持不變。檔案是允許註解的純 JSON——可用任何編輯器編輯；應用程式執行期間變更會即時生效。應用程式在載入時會根據結構描述驗證檔案；如果無法解析或與結構描述不符，則會取代為空白範本（並記錄警告）。AI 提供者在此檔案的 `ai` 區段中設定——見 [AI 與代理人](agents.md)。

完整參考：

```jsonc
{
  "$schema": "https://doru.family/settings.json",

  // AI providers — set from Settings (gear icon) or here directly.
  "ai": {
    // The active provider: ollama | lmstudio | custom | acp
    // (cloud presets return one by one).
    "provider": "ollama",

    // Per-provider settings, keyed by provider id. Only the entry of the
    // active provider is used; the others keep their values and are
    // restored when you switch back.
    "providers": {
      "ollama": {
        "baseUrl": "", // optional override of the provider's default endpoint
        "model": ""
      }
      // For "acp" only: the agent binary to spawn. Add a comma after the
      // "ollama" object above when you enable it.
      // "acp": { "command": "my-agent", "args": [] }
    }
  },

  // Theme: one palette file with a dark and a light section. The OS
  // appearance decides which palette applies.
  "theme": "doru"
}
```

## 記錄

應用程式會將診斷資訊附加到資料目錄中的 `doru.log`（與 `settings.json` 相鄰）。檔案在 5 MB 時輪替——舊檔案保留為 `doru.old.log`。預設詳細程度為 `warn`（開發版本以 `debug` 記錄）；設定 `DORU_LOG_LEVEL=trace|debug|info|warn|error` 可覆寫。結構描述驗證警告（與結構描述不符的設定或主題檔案）會記錄在這裡。設定中的 **開啟記錄檔** 按鈕會在尚未記錄任何內容時視需要建立檔案。

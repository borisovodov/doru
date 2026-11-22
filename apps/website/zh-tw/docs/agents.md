---
source-hash: b3dd07f80d43
---

# AI 與代理人

## 應用程式內聊天

聊天面板位於視窗底部。輸入問題後，代理人可以使用內建工具讀取和編輯家譜：`tree_query`、`tree_get`、`tree_stats`、`tree_edit`、`tree_add_relative`、`sources_add`、`notes_write`。

對話儲存為 **聊天工作階段**：聊天面板的標題列會列出您的工作階段，您可以切換工作階段、開始新聊天或刪除工作階段。工作階段依專案儲存在應用程式資料目錄中（不在 `.doru` 檔案內），標題來自您的第一則訊息，所有內容在應用程式重新啟動後仍然保留。每則回覆都有一個複製按鈕，可將其原始 Markdown 放入系統剪貼簿。

提供者在 `settings.json` 的 `ai` 區段中設定（見[設定](settings.md)）：

- **提供者預設集**：Ollama、LM Studio、自訂 OpenAI 相容端點或 ACP 代理人。雲端預設集會隨著整合重建逐一回歸。在 `"provider"` 中設定 ID；每個預設集提供預設基礎 URL，模型在設定精靈中選擇——本機端點從提供者取得，雲端預設集從隨附的目錄中選擇。每個提供者在 `"providers"` 下保留自己的設定（模型、基礎 URL、推理、金鑰）——切換提供者時會還原各自的已儲存設定。
- **API 金鑰** 儲存在應用程式資料目錄的 `secrets.json`（模式 0600）中，以提供者 ID 為鍵。金鑰永遠不會出現在設定檔案中。

## Dóru AI（離線助手）

預設提供者是 **Dóru AI**：一個完全在您的電腦上執行的本機助手。在 AI 設定中下載一次（單一檔案，約 3 GB）；之後聊天無需帳戶和網際網路連線即可運作。全新安裝時預設選取，需要至少 8 GB 記憶體。

下載的模型是 Qwen3.5-4B（Q4_K_M 量化 GGUF，Apache-2.0 授權——見[模型卡](https://huggingface.co/Qwen/Qwen3.5-4B)）。權重在應用程式清單中透過 SHA-256 固定，並在每次下載後驗證。

## ACP 代理人

設定 `"ai": { "provider": "acp", "providers": { "acp": { "command": "…", "args": [] } } }` 即可與使用 Agent Client Protocol 的代理人（Zed 風格代理人）對話。Dóru 將專案作為 MCP 伺服器傳遞給代理人，因此代理人可以像內建聊天一樣查詢和編輯家譜。

## 作為 MCP 伺服器的 Dóru

任何 MCP 用戶端——Claude Desktop、Cursor、程式設計代理人——都可以處理您的家譜。以伺服器模式執行 Dóru，指向 `.doru` 檔案：

```sh
doru --mcp-server /absolute/path/to/family.doru
```

Claude Desktop 設定範例（`Claude → Settings → Developer → Edit Config`）：

```json
{
  "mcpServers": {
    "doru": {
      "command": "/Applications/Doru.app/Contents/MacOS/doru",
      "args": ["--mcp-server", "/Users/you/FamilyHistory/family.doru"]
    }
  }
}
```

Linux AppImage：指向 AppImage 檔案的路徑。Windows：`"command": "C:\\Program Files\\Doru\\doru.exe"`。無論 UI 語言為何，工具名稱始終保持英文。

伺服器是**無介面且無狀態的**：沒有視窗、沒有 Dock 圖示、沒有聊天工作階段——它直接讀取和編輯家譜檔案，並在用戶端中斷連線時結束。任意數量的用戶端可以同時指向同一個檔案（Claude Desktop、Cursor、多個程式設計代理人）；並行寫入會安全排隊。如果用戶端無法啟動伺服器，請在終端機中執行該命令——輔助程式會將問題記錄到 stderr，其暫存設定檔會在結束時捨棄。

## 範例提示

- *「找出所有 1850 年之前出生的人，並列出他們的來源。」*
- *「將大約生於 1923 年的 Ivan Ivanov 新增為 Petr 和 Maria 的子女。」*
- *「為 Anna 寫一則關於 1901 年人口普查的研究筆記。」*
- *「檢查我的家譜中是否有在父母去世後出生的人。」*

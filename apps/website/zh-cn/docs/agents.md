---
source-hash: b3dd07f80d43
---

# AI 与智能体

## 应用内聊天

聊天面板位于窗口底部。输入问题后，智能体可以使用内置工具读取和编辑家谱：`tree_query`、`tree_get`、`tree_stats`、`tree_edit`、`tree_add_relative`、`sources_add`、`notes_write`。

对话保存为 **聊天会话**：聊天面板的标题栏会列出您的会话，您可以切换会话、开始新聊天或删除会话。会话按项目存储在应用数据目录中（不在 `.doru` 文件内），标题来自您的第一条消息，所有内容在应用重启后仍然保留。每条回复都有一个复制按钮，可将其原始 Markdown 放入系统剪贴板。

提供商在 `settings.json` 的 `ai` 部分配置（见[设置](settings.md)）：

- **提供商预设**：Ollama、LM Studio、自定义 OpenAI 兼容端点或 ACP 智能体。云端预设会随着集成重建逐一回归。在 `"provider"` 中设置 ID；每个预设提供默认基础 URL，模型在设置向导中选择——本地端点从提供商获取，云端预设从随附的目录中选择。每个提供商在 `"providers"` 下保留自己的配置（模型、基础 URL、推理、密钥）——切换提供商时会恢复各自的已保存设置。
- **API 密钥** 存储在应用数据目录的 `secrets.json`（模式 0600）中，以提供商 ID 为键。密钥永远不会出现在设置文件中。

## Dóru AI（离线助手）

默认提供商是 **Dóru AI**：一个完全在您的电脑上运行的本地助手。在 AI 设置中下载一次（单个文件，约 3 GB）；之后聊天无需账户和互联网连接即可工作。全新安装时默认选中，需要至少 8 GB 内存。

下载的模型是 Qwen3.5-4B（Q4_K_M 量化 GGUF，Apache-2.0 许可证——见[模型卡](https://huggingface.co/Qwen/Qwen3.5-4B)）。权重在应用清单中通过 SHA-256 固定，并在每次下载后验证。

## ACP 智能体

设置 `"ai": { "provider": "acp", "providers": { "acp": { "command": "…", "args": [] } } }` 即可与使用 Agent Client Protocol 的智能体（Zed 风格智能体）对话。Dóru 将项目作为 MCP 服务器传递给智能体，因此智能体可以像内置聊天一样查询和编辑家谱。

## 作为 MCP 服务器的 Dóru

任何 MCP 客户端——Claude Desktop、Cursor、编程智能体——都可以处理您的家谱。以服务器模式运行 Dóru，指向 `.doru` 文件：

```sh
doru --mcp-server /absolute/path/to/family.doru
```

Claude Desktop 配置示例（`Claude → Settings → Developer → Edit Config`）：

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

Linux AppImage：指向 AppImage 文件的路径。Windows：`"command": "C:\\Program Files\\Doru\\doru.exe"`。无论 UI 语言如何，工具名称始终保持英文。

服务器是**无界面且无状态的**：没有窗口、没有程序坞图标、没有聊天会话——它直接读取和编辑家谱文件，并在客户端断开连接时退出。任意数量的客户端可以同时指向同一个文件（Claude Desktop、Cursor、多个编程智能体）；并发写入会安全排队。如果客户端无法启动服务器，请在终端中运行该命令——辅助程序会将问题记录到 stderr，其临时配置文件会在退出时丢弃。

## 示例提示

- *“找出所有 1850 年之前出生的人，并列出他们的来源。”*
- *“将大约生于 1923 年的 Ivan Ivanov 添加为 Petr 和 Maria 的子女。”*
- *“为 Anna 写一条关于 1901 年人口普查的研究笔记。”*
- *“检查我的家谱中是否有在父母去世后出生的人。”*

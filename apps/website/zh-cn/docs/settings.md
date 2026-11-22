---
source-hash: cb76eaf45583
---

# 设置

全局设置位于应用数据目录中的 `settings.json`：

| 操作系统 | 路径 |
|---|---|
| macOS | `~/Library/Application Support/Doru/settings.json` |
| Linux | `~/.config/Doru/settings.json` |
| Windows | `%APPDATA%\Doru\settings.json` |

**默认值位于应用中；文件只记录显式覆盖项。** 首次运行时，应用会创建一个仅包含 `$schema` 引用的文件——其他所有内容都回退到内置默认值，因此新的默认值会随应用更新提供给现有用户。`$schema` 引用是唯一的文档来源：支持 JSON Schema 的编辑器（VS Code、Zed、JetBrains）可从中获得自动补全、验证和字段说明。应用仅在您在 **设置** 中更改某项设置时才将条目写入文件；其他内容保持不变。该文件是允许注释的纯 JSON——可用任何编辑器编辑；应用运行期间更改会实时生效。应用在加载时会根据架构验证文件；如果无法解析或与架构不匹配，则会替换为空模板（并记录警告）。AI 提供商在此文件的 `ai` 部分配置——见 [AI 与智能体](agents.md)。

完整参考：

```jsonc
{
  "$schema": "https://doru.family/settings.json",

  // AI 提供商——从设置（齿轮图标）或直接在此处设置。
  "ai": {
    // 活动提供商: ollama | lmstudio | custom | acp
    // （云端预设会逐一回归）。
    "provider": "ollama",

    // 按提供商 ID 的提供商设置。仅使用活动提供商的条目；
    // 其他条目保留其值，并在切换回来时恢复。
    "providers": {
      "ollama": {
        "baseUrl": "", // 可选：覆盖提供商的默认端点
        "model": ""
      }
      // 仅适用于 "acp"：要启动的智能体二进制文件。
      // "acp": { "command": "my-agent", "args": [] }
    }
  },

  // 主题：一个包含深色和浅色部分的调色板文件。
  // 操作系统外观决定应用哪个调色板。
  "theme": "doru"
}
```

## 日志

应用将诊断信息追加到数据目录中的 `doru.log`（与 `settings.json` 相邻）。文件在 5 MB 时轮换——旧文件保留为 `doru.old.log`。默认详细程度为 `warn`（开发版本以 `debug` 记录）；设置 `DORU_LOG_LEVEL=trace|debug|info|warn|error` 可覆盖。架构验证警告（与架构不匹配的设置或主题文件）会记录在这里。设置中的 **打开日志文件** 按钮会在尚未记录任何内容时按需创建文件。

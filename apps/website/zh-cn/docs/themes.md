---
source-hash: 85c6a6b9acc6
---

# 主题

界面完全通过 CSS 自定义属性设置样式，在应用级别应用——绝不是按项目应用。

- **内置主题** — `doru`，应用 `themes/` 目录中的单个 JSON 调色板文件：每款主题一个文件，没有 CSS。文件同时包含 `dark` 和 `light` 调色板；操作系统外观决定应用哪一个——将操作系统切换到浅色模式，Dóru 会立即跟随。文件名就是主题 ID（`doru.json`）；内部的 `name` 字段是显示名称。
- 在 `settings.json`（见[设置](settings.md)）中用单个字符串选择主题，或在应用内 **设置** 页面（主题下拉菜单）中选择；无论哪种方式，选择都会存储在 `settings.json` 中。
- 活动调色板的 `colors` 会在启动时映射为 `--doru-*` CSS 自定义属性。

## 用户主题

将包含 `dark` 和 `light` 调色板的 `<id>.json` 文件放入应用数据目录内的 `themes` 目录（`settings.json` 所在的位置——见[设置](settings.md)），然后在 `settings.json` 中用 `"theme": "<id>"` 选择它。添加文件后请重启应用以使其生效。该目录在首次运行时创建；ID 与内置主题匹配的用户主题会覆盖它。格式错误或与架构不匹配的主题文件会被跳过（并记录警告），就像文件不存在一样，不会出现在主题列表中。内置主题带有 `$schema` 引用（`https://doru.family/theme.json`）——将同一行添加到您自己的文件中，即可在支持 JSON Schema 的编辑器中获得自动补全和验证。

内置主题，每款都有深色和浅色调色板：

| 主题 ID | 显示名称 |
|---|---|
| `doru`（默认） | Dóru |
| `one-dark` | One Dark |
| `github` | GitHub |
| `solarized` | Solarized |
| `gruvbox` | Gruvbox |
| `catppuccin` | Catppuccin |
| `ayu` | Ayu |
| `rose-pine` | Rosé Pine |
| `everforest` | Everforest |

默认 Dóru 调色板跟随应用图标：深森林绿搭配温暖的纸张色调。深色调色板从接近黑色的绿色画布逐层过渡到更明亮的界面框架和弹出层；浅色调色板使用温暖的纸张和奶油色。

可用变量：

| 变量 | 含义 |
|---|---|
| `--doru-bg-canvas` | 编辑器背景和标签条 |
| `--doru-bg-chrome` | 活动栏、侧边栏、浮动面板表面 |
| `--doru-bg-raised` | 卡片、标签、聊天输入框 |
| `--doru-bg-popover` | 菜单和选择器 |
| `--doru-bg-input` | 按钮、输入框、选择框 |
| `--doru-fg` / `--doru-fg-muted` / `--doru-fg-faint` | 主要、柔和和淡色文本 |
| `--doru-border` / `--doru-border-strong` | 细线和更粗的边框 |
| `--doru-accent` / `--doru-accent-hover` / `--doru-accent-active` | 强调色（森林/鼠尾草绿） |
| `--doru-on-accent` | 强调背景上的文本 |
| `--doru-accent-alpha` | 半透明强调色（标签、聊天气泡） |
| `--doru-focus` | 焦点环颜色 |
| `--doru-overlay-hover` / `--doru-overlay-pressed` | 悬停/按下叠加层 |
| `--doru-success` / `--doru-warning` / `--doru-danger` / `--doru-info` | 状态颜色 |
| `--doru-radius-sm` / `--doru-radius-md` / `--doru-radius-lg` | 4 / 6 / 8 px 圆角 |
| `--doru-control-height` | 控件高度（28px） |
| `--doru-panel-gutter` | 浮动面板与窗口边缘之间的间距（4px） |
| `--doru-panel-radius` | 浮动面板圆角半径（8px） |

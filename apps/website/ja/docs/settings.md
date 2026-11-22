---
source-hash: ecff58fa2a2c
---

# 設定

グローバル設定はアプリのデータディレクトリにある `settings.json` に保存されます：

| OS | パス |
|---|---|
| macOS | `~/Library/Application Support/Doru/settings.json` |
| Linux | `~/.config/Doru/settings.json` |
| Windows | `%APPDATA%\Doru\settings.json` |

**デフォルトはアプリ内にあり、ファイルには明示的な上書きだけが記録されます。** 初回起動時、アプリは `$schema` 参照だけを含むファイルを作成します——それ以外はすべて組み込みのデフォルトにフォールバックするため、新しいデフォルトはアプリの更新とともに既存ユーザーにも届きます。`$schema` 参照が唯一のドキュメント情報源です：JSON Schema をサポートするエディター（VS Code、Zed、JetBrains）は、そこから自動補完、検証、フィールドの説明を提供します。アプリがファイルにエントリを書き込むのは、**設定**画面で項目を変更したときだけです。それ以外は手を付けません。ファイルはコメントを許可するプレーンな JSON です——任意のエディターで編集でき、変更はアプリの実行中にリアルタイムで反映されます。アプリは読み込み時にファイルをスキーマに対して検証します。解析できない場合やスキーマに一致しない場合は、空のテンプレートに置き換えられます（警告がログに記録されます）。AI プロバイダーはこのファイルの `ai` セクションで設定します——[AI とエージェント](agents.md)を参照してください。

完全なリファレンス：

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

## ログ

アプリは診断情報をデータディレクトリの `doru.log`（`settings.json` の隣）に追記します。ファイルは 5 MB でローテーションし、前のファイルは `doru.old.log` として保持されます。デフォルトの詳細度は `warn` です（開発ビルドは `debug` で記録します）。`DORU_LOG_LEVEL=trace|debug|info|warn|error` で上書きできます。スキーマ検証の警告（スキーマに一致しない設定ファイルまたはテーマファイル）はここに記録されます。設定の **ログファイルを開く** ボタンは、まだ何も記録されていない場合にファイルをオンデマンドで作成します。

---
source-hash: 85c6a6b9acc6
---

# テーマ

インターフェースは完全に CSS カスタムプロパティでスタイル設定され、アプリレベルで適用されます——プロジェクトごとではありません。

- **組み込みテーマ** — `doru`。アプリの `themes/` ディレクトリにある単一の JSON パレットファイルです。テーマごとに 1 ファイルで、CSS はありません。ファイルには `dark` と `light` の両方のパレットが含まれ、どちらを適用するかはオペレーティングシステムの外観が決めます——OS をライトモードに切り替えると、Dóru は即座に追従します。ファイル名がテーマ ID（`doru.json`）で、内部の `name` フィールドが表示名です。
- テーマは `settings.json`（[設定](settings.md)を参照）で単一の文字列として選ぶか、アプリ内の **設定** ページ（テーマのドロップダウン）から選びます。どちらの場合も選択は `settings.json` に保存されます。
- アクティブなパレットの `colors` は、起動時に `--doru-*` CSS カスタムプロパティに変換されます。

## ユーザーテーマ

`dark` と `light` パレットを含む `<id>.json` ファイルを、アプリのデータディレクトリ内の `themes` ディレクトリ（`settings.json` があるのと同じ場所——[設定](settings.md)を参照）に置き、`settings.json` で `"theme": "<id>"` を指定して選択します。ファイルを追加した後はアプリを再起動すると反映されます。ディレクトリは初回起動時に作成されます。ID が同梱テーマと一致するユーザーテーマは、それを上書きします。形式が不正な、またはスキーマに一致しないテーマファイルはスキップされ（警告がログに記録されます）、存在しない場合と同様にテーマ一覧に表示されません。同梱テーマには `$schema` 参照（`https://doru.family/theme.json`）があります——JSON Schema を理解するエディターで自動補完と検証を得るには、同じ行を自分のファイルに追加してください。

同梱テーマ。それぞれにダークとライトのパレットがあります：

| テーマ ID | 表示名 |
|---|---|
| `doru`（デフォルト） | Dóru |
| `one-dark` | One Dark |
| `github` | GitHub |
| `solarized` | Solarized |
| `gruvbox` | Gruvbox |
| `catppuccin` | Catppuccin |
| `ayu` | Ayu |
| `rose-pine` | Rosé Pine |
| `everforest` | Everforest |

デフォルトの Dóru パレットはアプリアイコンに合わせています。深いフォレストグリーンと温かみのある紙の色合いです。ダークパレットは、黒に近い緑がかったキャンバスから、より明るいクロームとポップオーバーへとサーフェスを重ねます。ライトパレットは温かい紙とクリーム色を使用します。

利用可能な変数：

| 変数 | 意味 |
|---|---|
| `--doru-bg-canvas` | エディターの背景とタブストリップ |
| `--doru-bg-chrome` | アクティビティバー、サイドバー、フローティングパネルのサーフェス |
| `--doru-bg-raised` | カード、チップ、チャット入力欄 |
| `--doru-bg-popover` | メニューとピッカー |
| `--doru-bg-input` | ボタン、入力欄、セレクト |
| `--doru-fg` / `--doru-fg-muted` / `--doru-fg-faint` | メイン、ミュート、かすかなテキスト |
| `--doru-border` / `--doru-border-strong` | 細い線とより強い境界線 |
| `--doru-accent` / `--doru-accent-hover` / `--doru-accent-active` | アクセント（フォレスト／セージグリーン） |
| `--doru-on-accent` | アクセント背景上のテキスト |
| `--doru-accent-alpha` | 半透明のアクセント（チップ、チャットバブル） |
| `--doru-focus` | フォーカスリングの色 |
| `--doru-overlay-hover` / `--doru-overlay-pressed` | ホバー／押下オーバーレイ |
| `--doru-success` / `--doru-warning` / `--doru-danger` / `--doru-info` | 状態色 |
| `--doru-radius-sm` / `--doru-radius-md` / `--doru-radius-lg` | 4 / 6 / 8 px の角丸 |
| `--doru-control-height` | コントロールの高さ（28px） |
| `--doru-panel-gutter` | フローティングパネルとウィンドウ端の間隔（4px） |
| `--doru-panel-radius` | フローティングパネルの角丸半径（8px） |

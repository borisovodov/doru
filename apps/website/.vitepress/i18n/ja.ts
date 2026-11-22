import { SEARCH_TEXT } from './search.ts';
import type { SiteLocale } from './types.ts';

const locale: SiteLocale = {
  label: '日本語',
  lang: 'ja',
  description:
    '家系図のためのデスクトップアプリ。家系図はディスク上の普通のフォルダーにあり、完全にオフラインで動作し、組み込みチャットや任意のMCP/ACPクライアントを通じてAIエージェントに操作されます。',
  footer: '名前は印欧祖語の <em>*dóru</em>「木」に由来します。',
  nav: {
    docs: 'ドキュメント',
    releases: 'リリースノート',
  },
  sidebar: {
    intro: '概要',
    getStarted: 'はじめに',
    installation: 'インストールと更新',
    quickStart: 'クイックスタート',
    guide: 'ガイド',
    tree: '家系図の操作',
    shortcuts: 'キーボードショートカット',
    settings: '設定',
    agents: 'AI とエージェント',
    themes: 'テーマ',
    reference: 'リファレンス',
    dataBackups: 'データとバックアップ',
    troubleshooting: 'トラブルシューティング',
  },
  ui: {
    outline: 'このページ',
    prev: '前のページ',
    next: '次のページ',
    returnToTop: 'トップへ戻る',
    skipToContent: 'コンテンツへスキップ',
    menu: 'メニュー',
    appearance: '外観',
    lightTheme: 'ライトテーマに切り替える',
    darkTheme: 'ダークテーマに切り替える',
    langMenu: '言語を変更',
    mainNavigation: 'メインナビゲーション',
    mobileMenu: 'メニュー',
    moreOptions: 'その他のオプション',
  },
  notFound: {
    title: 'ページが見つかりません',
    quote: 'しかし、方向を変えずに探し続ければ、行き着く先にたどり着くかもしれません。',
    linkLabel: 'ホームへ移動',
    linkText: 'ホームに戻る',
  },
  search: SEARCH_TEXT['ja'],
  markdown: {
    codeCopyButton: {
      tooltipText: 'コードをコピー',
      copiedText: 'コピーしました',
    },
  },
};

export default locale;

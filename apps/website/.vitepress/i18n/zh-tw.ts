import { SEARCH_TEXT } from './search.ts';
import type { SiteLocale } from './types.ts';

const locale: SiteLocale = {
  label: '繁體中文',
  lang: 'zh-tw',
  description:
    '一款家譜桌面應用。您的家譜存放在磁碟上的普通資料夾中，完全離線運作，並透過內建聊天或任何 MCP/ACP 用戶端由 AI 代理人驅動。',
  footer: '名字源自原始印歐語的 <em>*dóru</em>——「樹」。',
  nav: {
    docs: '文件',
    releases: '發行說明',
  },
  sidebar: {
    intro: '簡介',
    getStarted: '入門',
    installation: '安裝與更新',
    quickStart: '快速開始',
    guide: '指南',
    tree: '使用家譜',
    shortcuts: '鍵盤快速鍵',
    settings: '設定',
    agents: 'AI 與代理人',
    themes: '主題',
    reference: '參考',
    dataBackups: '資料與備份',
    troubleshooting: '疑難排解',
  },
  ui: {
    outline: '本頁內容',
    prev: '上一頁',
    next: '下一頁',
    returnToTop: '回到頂端',
    skipToContent: '跳至內容',
    menu: '選單',
    appearance: '外觀',
    lightTheme: '切換至淺色主題',
    darkTheme: '切換至深色主題',
    langMenu: '變更語言',
    mainNavigation: '主導覽',
    mobileMenu: '選單',
    moreOptions: '更多選項',
  },
  notFound: {
    title: '找不到頁面',
    quote: '但如果您不改變方向、繼續尋找，也許終究會抵達您正前往的地方。',
    linkLabel: '前往首頁',
    linkText: '返回首頁',
  },
  search: SEARCH_TEXT['zh-tw'],
  markdown: {
    codeCopyButton: {
      tooltipText: '複製程式碼',
      copiedText: '已複製',
    },
  },
};

export default locale;

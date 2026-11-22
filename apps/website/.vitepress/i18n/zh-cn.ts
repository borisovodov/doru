import { SEARCH_TEXT } from './search.ts';
import type { SiteLocale } from './types.ts';

const locale: SiteLocale = {
  label: '简体中文',
  lang: 'zh-cn',
  description:
    '一款家谱桌面应用。您的家谱存放在磁盘上的普通文件夹中，完全离线运行，并通过内置聊天或任何 MCP/ACP 客户端由 AI 智能体驱动。',
  footer: '名字源自原始印欧语的 <em>*dóru</em>——“树”。',
  nav: {
    docs: '文档',
    releases: '发布说明',
  },
  sidebar: {
    intro: '简介',
    getStarted: '入门',
    installation: '安装与更新',
    quickStart: '快速开始',
    guide: '指南',
    tree: '使用家谱',
    shortcuts: '键盘快捷键',
    settings: '设置',
    agents: 'AI 与智能体',
    themes: '主题',
    reference: '参考',
    dataBackups: '数据与备份',
    troubleshooting: '故障排除',
  },
  ui: {
    outline: '本页内容',
    prev: '上一页',
    next: '下一页',
    returnToTop: '返回顶部',
    skipToContent: '跳到内容',
    menu: '菜单',
    appearance: '外观',
    lightTheme: '切换到浅色主题',
    darkTheme: '切换到深色主题',
    langMenu: '更改语言',
    mainNavigation: '主导航',
    mobileMenu: '菜单',
    moreOptions: '更多选项',
  },
  notFound: {
    title: '页面未找到',
    quote: '但如果你不改变方向，继续寻找，也许最终会到达你正要去的地方。',
    linkLabel: '前往首页',
    linkText: '返回首页',
  },
  search: SEARCH_TEXT['zh-cn'],
  markdown: {
    codeCopyButton: {
      tooltipText: '复制代码',
      copiedText: '已复制',
    },
  },
};

export default locale;

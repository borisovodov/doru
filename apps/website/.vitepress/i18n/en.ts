import type { SiteLocale } from './types.ts';

const locale: SiteLocale = {
  label: 'English',
  lang: 'en-US',
  description:
    'Genealogy for the AI era. A desktop app for your family tree. Your tree lives in a plain folder on your disk, works fully offline, and is driven by AI agents — through the built-in chat or any MCP/ACP client.',
  footer: 'The name comes from Proto-Indo-European <em>*dóru</em> — “tree”.',
  nav: {
    docs: 'Docs',
    releases: 'Release notes',
  },
  sidebar: {
    intro: 'Intro',
    getStarted: 'Get started',
    installation: 'Installation',
    quickStart: 'Quick start',
    guide: 'Guide',
    tree: 'Working with the tree',
    shortcuts: 'Keyboard shortcuts',
    settings: 'Settings',
    agents: 'AI and agents',
    themes: 'Themes',
    reference: 'Reference',
    dataBackups: 'Data and backups',
    troubleshooting: 'Troubleshooting',
  },
  ui: {
    outline: 'On this page',
    prev: 'Previous page',
    next: 'Next page',
    returnToTop: 'Return to top',
    skipToContent: 'Skip to content',
    menu: 'Menu',
    appearance: 'Appearance',
    lightTheme: 'Switch to light theme',
    darkTheme: 'Switch to dark theme',
    langMenu: 'Change language',
    mainNavigation: 'Main Navigation',
    mobileMenu: 'Menu',
    moreOptions: 'More options',
  },
  notFound: {
    title: 'PAGE NOT FOUND',
    quote: "But if you don't change your direction, and if you keep looking, you may end up where you are heading.",
    linkLabel: 'go to home',
    linkText: 'Take me home',
  },
  search: {
    buttonText: 'Search',
    buttonAriaLabel: 'Search',
    displayDetails: 'Display detailed list',
    resetButtonTitle: 'Reset search',
    backButtonTitle: 'Close search',
    noResultsText: 'No results for',
    selectText: 'to select',
    selectKeyAriaLabel: 'enter',
    navigateText: 'to navigate',
    navigateUpKeyAriaLabel: 'up arrow',
    navigateDownKeyAriaLabel: 'down arrow',
    closeText: 'to close',
    closeKeyAriaLabel: 'escape',
  },
  markdown: {
    codeCopyButton: {
      tooltipText: 'Copy code',
      copiedText: 'Copied',
    },
  },
};

export default locale;

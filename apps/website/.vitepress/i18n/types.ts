export interface SearchText {
  buttonText: string;
  buttonAriaLabel: string;
  displayDetails: string;
  resetButtonTitle: string;
  backButtonTitle: string;
  noResultsText: string;
  selectText: string;
  selectKeyAriaLabel: string;
  navigateText: string;
  navigateUpKeyAriaLabel: string;
  navigateDownKeyAriaLabel: string;
  closeText: string;
  closeKeyAriaLabel: string;
}

export interface SiteLocale {
  label: string;
  lang: string;
  description: string;
  footer: string;
  nav: {
    docs: string;
    releases: string;
  };
  sidebar: {
    intro: string;
    getStarted: string;
    installation: string;
    quickStart: string;
    guide: string;
    tree: string;
    shortcuts: string;
    settings: string;
    agents: string;
    themes: string;
    reference: string;
    dataBackups: string;
    troubleshooting: string;
  };
  ui: {
    outline: string;
    prev: string;
    next: string;
    returnToTop: string;
    skipToContent: string;
    menu: string;
    appearance: string;
    lightTheme: string;
    darkTheme: string;
    langMenu: string;
    mainNavigation: string;
    mobileMenu: string;
    moreOptions: string;
  };
  notFound: {
    title: string;
    quote: string;
    linkLabel: string;
    linkText: string;
  };
  search: SearchText;
  markdown: {
    codeCopyButton: {
      tooltipText: string;
      copiedText: string;
    };
  };
}

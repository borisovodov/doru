import { SEARCH_TEXT } from './search.ts';
import type { SiteLocale } from './types.ts';

const locale: SiteLocale = {
  label: 'Čeština',
  lang: 'cs',
  description:
    'Desktopová aplikace pro rodokmeny. Váš rodokmen žije v obyčejné složce na disku, funguje zcela offline a řídí ho AI agenti — prostřednictvím vestavěného chatu nebo jakéhokoli MCP/ACP klienta.',
  footer: 'Název pochází z praindoevropského <em>*dóru</em> — „strom“.',
  nav: {
    docs: 'Dokumentace',
    releases: 'Poznámky k vydání',
  },
  sidebar: {
    intro: 'Úvod',
    getStarted: 'Začínáme',
    installation: 'Instalace a aktualizace',
    quickStart: 'Rychlý start',
    guide: 'Průvodce',
    tree: 'Práce se stromem',
    shortcuts: 'Klávesové zkratky',
    settings: 'Nastavení',
    agents: 'AI a agenti',
    themes: 'Motivy',
    reference: 'Reference',
    dataBackups: 'Data a zálohy',
    troubleshooting: 'Řešení problémů',
  },
  ui: {
    outline: 'Na této stránce',
    prev: 'Předchozí stránka',
    next: 'Další stránka',
    returnToTop: 'Nahoru',
    skipToContent: 'Přejít k obsahu',
    menu: 'Menu',
    appearance: 'Vzhled',
    lightTheme: 'Přepnout na světlé téma',
    darkTheme: 'Přepnout na tmavé téma',
    langMenu: 'Změnit jazyk',
    mainNavigation: 'Hlavní navigace',
    mobileMenu: 'Menu',
    moreOptions: 'Další možnosti',
  },
  notFound: {
    title: 'STRÁNKA NENALEZENA',
    quote: 'Ale pokud nezměníte směr a budete dál hledat, můžete skončit tam, kam míříte.',
    linkLabel: 'přejít na úvod',
    linkText: 'Zpět na úvod',
  },
  search: SEARCH_TEXT['cs'],
  markdown: {
    codeCopyButton: {
      tooltipText: 'Kopírovat kód',
      copiedText: 'Zkopírováno',
    },
  },
};

export default locale;

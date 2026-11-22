import { SEARCH_TEXT } from './search.ts';
import type { SiteLocale } from './types.ts';

const locale: SiteLocale = {
  label: 'Polski',
  lang: 'pl',
  description:
    'Aplikacja desktopowa dla drzew genealogicznych. Twoje drzewo żyje w zwykłym folderze na dysku, działa całkowicie offline i jest prowadzone przez agentów AI — przez wbudowany czat lub dowolnego klienta MCP/ACP.',
  footer: 'Nazwa pochodzi od praindoeuropejskiego <em>*dóru</em> — „drzewo”.',
  nav: {
    docs: 'Dokumentacja',
    releases: 'Informacje o wydaniu',
  },
  sidebar: {
    intro: 'Wprowadzenie',
    getStarted: 'Pierwsze kroki',
    installation: 'Instalacja i aktualizacje',
    quickStart: 'Szybki start',
    guide: 'Przewodnik',
    tree: 'Praca z drzewem',
    shortcuts: 'Skróty klawiszowe',
    settings: 'Ustawienia',
    agents: 'AI i agenci',
    themes: 'Motywy',
    reference: 'Referencje',
    dataBackups: 'Dane i kopie zapasowe',
    troubleshooting: 'Rozwiązywanie problemów',
  },
  ui: {
    outline: 'Na tej stronie',
    prev: 'Poprzednia strona',
    next: 'Następna strona',
    returnToTop: 'Wróć na górę',
    skipToContent: 'Przejdź do treści',
    menu: 'Menu',
    appearance: 'Wygląd',
    lightTheme: 'Przełącz na jasny motyw',
    darkTheme: 'Przełącz na ciemny motyw',
    langMenu: 'Zmień język',
    mainNavigation: 'Nawigacja główna',
    mobileMenu: 'Menu',
    moreOptions: 'Więcej opcji',
  },
  notFound: {
    title: 'NIE ZNALEZIONO STRONY',
    quote: 'Ale jeśli nie zmienisz kierunku i będziesz szukać dalej, możesz trafić tam, dokąd zmierzasz.',
    linkLabel: 'przejdź do strony głównej',
    linkText: 'Wróć do strony głównej',
  },
  search: SEARCH_TEXT['pl'],
  markdown: {
    codeCopyButton: {
      tooltipText: 'Kopiuj kod',
      copiedText: 'Skopiowano',
    },
  },
};

export default locale;

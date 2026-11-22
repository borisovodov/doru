import { SEARCH_TEXT } from './search.ts';
import type { SiteLocale } from './types.ts';

const locale: SiteLocale = {
  label: 'Magyar',
  lang: 'hu',
  description:
    'Asztali alkalmazás családfákhoz. Családfája egy közönséges mappában él a lemezén, teljesen offline működik, és MI-ügynökök vezérlik — a beépített chaten vagy bármely MCP/ACP-kliensen keresztül.',
  footer: 'A név a protoindoeurópai <em>*dóru</em> szóból ered — „fa“.',
  nav: {
    docs: 'Dokumentáció',
    releases: 'Kiadási megjegyzések',
  },
  sidebar: {
    intro: 'Bevezetés',
    getStarted: 'Kezdés',
    installation: 'Telepítés és frissítések',
    quickStart: 'Gyors kezdés',
    guide: 'Útmutató',
    tree: 'A családfa használata',
    shortcuts: 'Billentyűparancsok',
    settings: 'Beállítások',
    agents: 'MI és ügynökök',
    themes: 'Témák',
    reference: 'Referencia',
    dataBackups: 'Adatok és biztonsági mentések',
    troubleshooting: 'Hibaelhárítás',
  },
  ui: {
    outline: 'Ezen az oldalon',
    prev: 'Előző oldal',
    next: 'Következő oldal',
    returnToTop: 'Vissza a tetejére',
    skipToContent: 'Ugrás a tartalomra',
    menu: 'Menü',
    appearance: 'Megjelenés',
    lightTheme: 'Váltás világos témára',
    darkTheme: 'Váltás sötét témára',
    langMenu: 'Nyelv módosítása',
    mainNavigation: 'Fő navigáció',
    mobileMenu: 'Menü',
    moreOptions: 'További lehetőségek',
  },
  notFound: {
    title: 'AZ OLDAL NEM TALÁLHATÓ',
    quote: 'De ha nem változtatsz az irányon, és tovább keresel, oda érkezhetsz, ahová tartasz.',
    linkLabel: 'ugrás a kezdőlapra',
    linkText: 'Vissza a kezdőlapra',
  },
  search: SEARCH_TEXT['hu'],
  markdown: {
    codeCopyButton: {
      tooltipText: 'Kód másolása',
      copiedText: 'Másolva',
    },
  },
};

export default locale;

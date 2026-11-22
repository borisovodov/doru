import { SEARCH_TEXT } from './search.ts';
import type { SiteLocale } from './types.ts';

const locale: SiteLocale = {
  label: 'Italiano',
  lang: 'it',
  description:
    'Un’app desktop per alberi genealogici. Il tuo albero vive in una semplice cartella sul disco, funziona completamente offline ed è guidato da agenti IA — tramite la chat integrata o qualsiasi client MCP/ACP.',
  footer: 'Il nome deriva dal proto-indoeuropeo <em>*dóru</em> — «albero».',
  nav: {
    docs: 'Documentazione',
    releases: 'Note di rilascio',
  },
  sidebar: {
    intro: 'Introduzione',
    getStarted: 'Per iniziare',
    installation: 'Installazione e aggiornamenti',
    quickStart: 'Avvio rapido',
    guide: 'Guida',
    tree: 'Lavorare con l’albero',
    shortcuts: 'Scorciatoie da tastiera',
    settings: 'Impostazioni',
    agents: 'IA e agenti',
    themes: 'Temi',
    reference: 'Riferimento',
    dataBackups: 'Dati e backup',
    troubleshooting: 'Risoluzione dei problemi',
  },
  ui: {
    outline: 'In questa pagina',
    prev: 'Pagina precedente',
    next: 'Pagina successiva',
    returnToTop: 'Torna su',
    skipToContent: 'Vai al contenuto',
    menu: 'Menu',
    appearance: 'Aspetto',
    lightTheme: 'Passa al tema chiaro',
    darkTheme: 'Passa al tema scuro',
    langMenu: 'Cambia lingua',
    mainNavigation: 'Navigazione principale',
    mobileMenu: 'Menu',
    moreOptions: 'Altre opzioni',
  },
  notFound: {
    title: 'PAGINA NON TROVATA',
    quote: 'Ma se non cambi direzione e continui a cercare, potresti finire dove sei diretto.',
    linkLabel: 'vai alla home',
    linkText: 'Torna alla home',
  },
  search: SEARCH_TEXT['it'],
  markdown: {
    codeCopyButton: {
      tooltipText: 'Copia il codice',
      copiedText: 'Copiato',
    },
  },
};

export default locale;

import { SEARCH_TEXT } from './search.ts';
import type { SiteLocale } from './types.ts';

const locale: SiteLocale = {
  label: 'Deutsch',
  lang: 'de',
  description:
    'Eine Desktop-App für Stammbäume. Ihr Stammbaum lebt in einem gewöhnlichen Ordner auf Ihrer Festplatte, funktioniert vollständig offline und wird von KI-Agenten gesteuert — über den eingebauten Chat oder jeden MCP/ACP-Client.',
  footer: 'Der Name kommt vom urindogermanischen <em>*dóru</em> — „Baum“.',
  nav: {
    docs: 'Dokumentation',
    releases: 'Versionshinweise',
  },
  sidebar: {
    intro: 'Einführung',
    getStarted: 'Erste Schritte',
    installation: 'Installation und Updates',
    quickStart: 'Schnellstart',
    guide: 'Anleitung',
    tree: 'Arbeit mit dem Stammbaum',
    shortcuts: 'Tastenkürzel',
    settings: 'Einstellungen',
    agents: 'KI und Agenten',
    themes: 'Themes',
    reference: 'Referenz',
    dataBackups: 'Daten und Sicherungen',
    troubleshooting: 'Fehlerbehebung',
  },
  ui: {
    outline: 'Auf dieser Seite',
    prev: 'Vorherige Seite',
    next: 'Nächste Seite',
    returnToTop: 'Nach oben',
    skipToContent: 'Zum Inhalt springen',
    menu: 'Menü',
    appearance: 'Darstellung',
    lightTheme: 'Zum hellen Design wechseln',
    darkTheme: 'Zum dunklen Design wechseln',
    langMenu: 'Sprache ändern',
    mainNavigation: 'Hauptnavigation',
    mobileMenu: 'Menü',
    moreOptions: 'Weitere Optionen',
  },
  notFound: {
    title: 'SEITE NICHT GEFUNDEN',
    quote:
      'Doch wenn du deine Richtung nicht änderst und weiter suchst, könntest du dort ankommen, wohin du unterwegs bist.',
    linkLabel: 'zur Startseite',
    linkText: 'Zur Startseite',
  },
  search: SEARCH_TEXT['de'],
  markdown: {
    codeCopyButton: {
      tooltipText: 'Code kopieren',
      copiedText: 'Kopiert',
    },
  },
};

export default locale;

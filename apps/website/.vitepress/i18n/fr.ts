import { SEARCH_TEXT } from './search.ts';
import type { SiteLocale } from './types.ts';

const locale: SiteLocale = {
  label: 'Français',
  lang: 'fr',
  description:
    'Une application de bureau pour les arbres généalogiques. Votre arbre vit dans un simple dossier sur votre disque, fonctionne entièrement hors ligne et est piloté par des agents IA — via le chat intégré ou n’importe quel client MCP/ACP.',
  footer: 'Le nom vient du proto-indo-européen <em>*dóru</em> — « arbre ».',
  nav: {
    docs: 'Documentation',
    releases: 'Notes de version',
  },
  sidebar: {
    intro: 'Introduction',
    getStarted: 'Premiers pas',
    installation: 'Installation et mises à jour',
    quickStart: 'Démarrage rapide',
    guide: 'Guide',
    tree: 'Travailler avec l’arbre',
    shortcuts: 'Raccourcis clavier',
    settings: 'Paramètres',
    agents: 'IA et agents',
    themes: 'Thèmes',
    reference: 'Référence',
    dataBackups: 'Données et sauvegardes',
    troubleshooting: 'Dépannage',
  },
  ui: {
    outline: 'Sur cette page',
    prev: 'Page précédente',
    next: 'Page suivante',
    returnToTop: 'Retour en haut',
    skipToContent: 'Aller au contenu',
    menu: 'Menu',
    appearance: 'Apparence',
    lightTheme: 'Passer au thème clair',
    darkTheme: 'Passer au thème sombre',
    langMenu: 'Changer de langue',
    mainNavigation: 'Navigation principale',
    mobileMenu: 'Menu',
    moreOptions: 'Plus d’options',
  },
  notFound: {
    title: 'PAGE INTROUVABLE',
    quote: 'Mais si vous ne changez pas de direction et continuez à chercher, vous pourriez finir là où vous alliez.',
    linkLabel: 'aller à l’accueil',
    linkText: 'Retour à l’accueil',
  },
  search: SEARCH_TEXT['fr'],
  markdown: {
    codeCopyButton: {
      tooltipText: 'Copier le code',
      copiedText: 'Copié',
    },
  },
};

export default locale;

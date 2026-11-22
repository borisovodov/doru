import { SEARCH_TEXT } from './search.ts';
import type { SiteLocale } from './types.ts';

const locale: SiteLocale = {
  label: 'Português (Brasil)',
  lang: 'pt-br',
  description:
    'Um aplicativo desktop para árvores genealógicas. Sua árvore vive em uma pasta comum no seu disco, funciona totalmente offline e é conduzida por agentes de IA — pelo chat integrado ou por qualquer cliente MCP/ACP.',
  footer: 'O nome vem do protoindo-europeu <em>*dóru</em> — «árvore».',
  nav: {
    docs: 'Documentação',
    releases: 'Notas de versão',
  },
  sidebar: {
    intro: 'Introdução',
    getStarted: 'Primeiros passos',
    installation: 'Instalação e atualizações',
    quickStart: 'Início rápido',
    guide: 'Guia',
    tree: 'Trabalhando com a árvore',
    shortcuts: 'Atalhos de teclado',
    settings: 'Configurações',
    agents: 'IA e agentes',
    themes: 'Temas',
    reference: 'Referência',
    dataBackups: 'Dados e backups',
    troubleshooting: 'Solução de problemas',
  },
  ui: {
    outline: 'Nesta página',
    prev: 'Página anterior',
    next: 'Próxima página',
    returnToTop: 'Voltar ao topo',
    skipToContent: 'Ir para o conteúdo',
    menu: 'Menu',
    appearance: 'Aparência',
    lightTheme: 'Mudar para o tema claro',
    darkTheme: 'Mudar para o tema escuro',
    langMenu: 'Alterar idioma',
    mainNavigation: 'Navegação principal',
    mobileMenu: 'Menu',
    moreOptions: 'Mais opções',
  },
  notFound: {
    title: 'PÁGINA NÃO ENCONTRADA',
    quote: 'Mas se você não mudar de direção e continuar procurando, poderá acabar onde está indo.',
    linkLabel: 'ir para o início',
    linkText: 'Voltar ao início',
  },
  search: SEARCH_TEXT['pt-br'],
  markdown: {
    codeCopyButton: {
      tooltipText: 'Copiar código',
      copiedText: 'Copiado',
    },
  },
};

export default locale;

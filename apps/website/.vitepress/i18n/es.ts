import { SEARCH_TEXT } from './search.ts';
import type { SiteLocale } from './types.ts';

const locale: SiteLocale = {
  label: 'Español',
  lang: 'es',
  description:
    'Una app de escritorio para árboles genealógicos. Tu árbol vive en una carpeta normal de tu disco, funciona totalmente sin conexión y lo dirigen agentes de IA — mediante el chat integrado o cualquier cliente MCP/ACP.',
  footer: 'El nombre viene del protoindoeuropeo <em>*dóru</em> — «árbol».',
  nav: {
    docs: 'Documentación',
    releases: 'Notas de la versión',
  },
  sidebar: {
    intro: 'Introducción',
    getStarted: 'Primeros pasos',
    installation: 'Instalación y actualizaciones',
    quickStart: 'Inicio rápido',
    guide: 'Guía',
    tree: 'Trabajar con el árbol',
    shortcuts: 'Atajos de teclado',
    settings: 'Ajustes',
    agents: 'IA y agentes',
    themes: 'Temas',
    reference: 'Referencia',
    dataBackups: 'Datos y copias de seguridad',
    troubleshooting: 'Solución de problemas',
  },
  ui: {
    outline: 'En esta página',
    prev: 'Página anterior',
    next: 'Página siguiente',
    returnToTop: 'Volver arriba',
    skipToContent: 'Ir al contenido',
    menu: 'Menú',
    appearance: 'Apariencia',
    lightTheme: 'Cambiar al tema claro',
    darkTheme: 'Cambiar al tema oscuro',
    langMenu: 'Cambiar idioma',
    mainNavigation: 'Navegación principal',
    mobileMenu: 'Menú',
    moreOptions: 'Más opciones',
  },
  notFound: {
    title: 'PÁGINA NO ENCONTRADA',
    quote: 'Pero si no cambias de dirección y sigues buscando, puede que termines donde te diriges.',
    linkLabel: 'ir al inicio',
    linkText: 'Volver al inicio',
  },
  search: SEARCH_TEXT['es'],
  markdown: {
    codeCopyButton: {
      tooltipText: 'Copiar código',
      copiedText: 'Copiado',
    },
  },
};

export default locale;

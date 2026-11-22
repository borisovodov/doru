import { SEARCH_TEXT } from './search.ts';
import type { SiteLocale } from './types.ts';

const locale: SiteLocale = {
  label: 'Български',
  lang: 'bg',
  description:
    'Десктоп приложение за родословни дървета. Вашето дърво живее в обикновена папка на диска, работи напълно офлайн и се управлява от ИИ агенти — чрез вградения чат или всеки MCP/ACP клиент.',
  footer: 'Името идва от праиндоевропейското <em>*dóru</em> — „дърво“.',
  nav: {
    docs: 'Документация',
    releases: 'Бележки към изданието',
  },
  sidebar: {
    intro: 'Въведение',
    getStarted: 'Начало',
    installation: 'Инсталиране и актуализации',
    quickStart: 'Бърз старт',
    guide: 'Ръководство',
    tree: 'Работа с дървото',
    shortcuts: 'Клавишни комбинации',
    settings: 'Настройки',
    agents: 'ИИ и агенти',
    themes: 'Теми',
    reference: 'Справочник',
    dataBackups: 'Данни и резервни копия',
    troubleshooting: 'Отстраняване на проблеми',
  },
  ui: {
    outline: 'На тази страница',
    prev: 'Предишна страница',
    next: 'Следваща страница',
    returnToTop: 'Нагоре',
    skipToContent: 'Към съдържанието',
    menu: 'Меню',
    appearance: 'Оформление',
    lightTheme: 'Превключване към светла тема',
    darkTheme: 'Превключване към тъмна тема',
    langMenu: 'Смяна на езика',
    mainNavigation: 'Основна навигация',
    mobileMenu: 'Меню',
    moreOptions: 'Още опции',
  },
  notFound: {
    title: 'СТРАНИЦАТА НЕ Е НАМЕРЕНА',
    quote: 'Но ако не промените посоката и продължите да търсите, може да стигнете там, накъдето сте се запътили.',
    linkLabel: 'към началото',
    linkText: 'Обратно към началото',
  },
  search: SEARCH_TEXT['bg'],
  markdown: {
    codeCopyButton: {
      tooltipText: 'Копиране на кода',
      copiedText: 'Копирано',
    },
  },
};

export default locale;

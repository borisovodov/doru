import { SEARCH_TEXT } from './search.ts';
import type { SiteLocale } from './types.ts';

const locale: SiteLocale = {
  label: 'Русский',
  lang: 'ru',
  description:
    'Настольное приложение для семейного древа. Ваше древо живёт в обычной папке на диске, работает полностью офлайн и управляется ИИ-агентами — через встроенный чат или любой MCP/ACP-клиент.',
  footer: 'Название происходит от праиндоевропейского <em>*dóru</em> — «дерево».',
  nav: {
    docs: 'Документация',
    releases: 'Примечания к выпускам',
  },
  sidebar: {
    intro: 'Введение',
    getStarted: 'Начало работы',
    installation: 'Установка и обновления',
    quickStart: 'Быстрый старт',
    guide: 'Руководство',
    tree: 'Работа с деревом',
    shortcuts: 'Горячие клавиши',
    settings: 'Настройки',
    agents: 'ИИ и агенты',
    themes: 'Темы',
    reference: 'Справочник',
    dataBackups: 'Данные и резервные копии',
    troubleshooting: 'Решение проблем',
  },
  ui: {
    outline: 'На этой странице',
    prev: 'Назад',
    next: 'Далее',
    returnToTop: 'Наверх',
    skipToContent: 'Перейти к содержимому',
    menu: 'Меню',
    appearance: 'Оформление',
    lightTheme: 'Переключить на светлую тему',
    darkTheme: 'Переключить на тёмную тему',
    langMenu: 'Сменить язык',
    mainNavigation: 'Основная навигация',
    mobileMenu: 'Меню',
    moreOptions: 'Ещё',
  },
  notFound: {
    title: 'СТРАНИЦА НЕ НАЙДЕНА',
    quote: 'Но если вы не измените направление и будете продолжать искать, вы можете оказаться там, куда направлялись.',
    linkLabel: 'перейти на главную',
    linkText: 'На главную',
  },
  search: SEARCH_TEXT['ru'],
  markdown: {
    codeCopyButton: {
      tooltipText: 'Копировать код',
      copiedText: 'Скопировано',
    },
  },
};

export default locale;

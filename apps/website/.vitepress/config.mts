import { defineConfig, type DefaultTheme, type HeadConfig, type TransformContext } from 'vitepress';

const LOCALIZED = {
  en: {
    label: 'English',
    nav: 'Intro',
    docs: 'Docs',
    relnotes: 'Release notes',
    footer: 'The name comes from Proto-Indo-European <em>*dóru</em> — “tree”.',
  },
  ru: {
    label: 'Русский',
    nav: 'Intro',
    docs: 'Документация',
    relnotes: 'Примечания к выпускам',
    footer: 'Название происходит от праиндоевропейского <em>*dóru</em> — «дерево».',
  },
  fr: {
    label: 'Français',
    nav: 'Intro',
    docs: 'Documentation',
    relnotes: 'Notes de version',
    footer: 'Le nom vient du proto-indo-européen <em>*dóru</em> — « arbre ».',
  },
  de: {
    label: 'Deutsch',
    nav: 'Intro',
    docs: 'Dokumentation',
    relnotes: 'Versionshinweise',
    footer: 'Der Name kommt vom urindogermanischen <em>*dóru</em> — „Baum“.',
  },
  it: {
    label: 'Italiano',
    nav: 'Intro',
    docs: 'Documentazione',
    relnotes: 'Note di rilascio',
    footer: 'Il nome deriva dal proto-indoeuropeo <em>*dóru</em> — «albero».',
  },
  es: {
    label: 'Español',
    nav: 'Intro',
    docs: 'Documentación',
    relnotes: 'Notas de la versión',
    footer: 'El nombre viene del protoindoeuropeo <em>*dóru</em> — «árbol».',
  },
  'pt-br': {
    label: 'Português (Brasil)',
    nav: 'Intro',
    docs: 'Documentação',
    relnotes: 'Notas de versão',
    footer: 'O nome vem do protoindo-europeu <em>*dóru</em> — «árvore».',
  },
  cs: {
    label: 'Čeština',
    nav: 'Intro',
    docs: 'Dokumentace',
    relnotes: 'Poznámky k vydání',
    footer: 'Název pochází z praindoevropského <em>*dóru</em> — „strom“.',
  },
  pl: {
    label: 'Polski',
    nav: 'Intro',
    docs: 'Dokumentacja',
    relnotes: 'Informacje o wydaniu',
    footer: 'Nazwa pochodzi od praindoeuropejskiego <em>*dóru</em> — „drzewo“.',
  },
  hu: {
    label: 'Magyar',
    nav: 'Intro',
    docs: 'Dokumentáció',
    relnotes: 'Kiadási megjegyzések',
    footer: 'A név a protoindoeurópai <em>*dóru</em> szóból ered — „fa“.',
  },
  bg: {
    label: 'Български',
    nav: 'Intro',
    docs: 'Документация',
    relnotes: 'Бележки към изданието',
    footer: 'Името идва от праиндоевропейското <em>*dóru</em> — „дърво“.',
  },
  el: {
    label: 'Ελληνικά',
    nav: 'Intro',
    docs: 'Τεκμηρίωση',
    relnotes: 'Σημειώσεις έκδοσης',
    footer: 'Το όνομα προέρχεται από το πρωτοϊνδοευρωπαϊκό <em>*dóru</em> — «δέντρο».',
  },
  tr: {
    label: 'Türkçe',
    nav: 'Intro',
    docs: 'Belgeler',
    relnotes: 'Sürüm notları',
    footer: 'Adı, Proto-Hint-Avrupa dilindeki <em>*dóru</em> — „ağaç“ sözcüğünden gelir.',
  },
  ja: {
    label: '日本語',
    nav: 'Intro',
    docs: 'ドキュメント',
    relnotes: 'リリースノート',
    footer: '名前は印欧祖語の <em>*dóru</em>「木」に由来します。',
  },
  ko: {
    label: '한국어',
    nav: 'Intro',
    docs: '문서',
    relnotes: '릴리스 노트',
    footer: '이름은 인도유럽조어 <em>*dóru</em> — “나무”에서 유래했습니다.',
  },
  'zh-cn': {
    label: '简体中文',
    nav: 'Intro',
    docs: '文档',
    relnotes: '发布说明',
    footer: '名字源自原始印欧语的 <em>*dóru</em>——“树”。',
  },
  'zh-tw': {
    label: '繁體中文',
    nav: 'Intro',
    docs: '文件',
    relnotes: '發行說明',
    footer: '名字源自原始印歐語的 <em>*dóru</em>——「樹」。',
  },
} as const;

interface SearchText {
  buttonText: string;
  buttonAriaLabel: string;
  displayDetails: string;
  resetButtonTitle: string;
  backButtonTitle: string;
  noResultsText: string;
  selectText: string;
  selectKeyAriaLabel: string;
  navigateText: string;
  navigateUpKeyAriaLabel: string;
  navigateDownKeyAriaLabel: string;
  closeText: string;
  closeKeyAriaLabel: string;
}

// VitePress resolves local-search translations by `localeIndex`; the default
// locale is `root`, and every other locale key mirrors `LOCALIZED`.
const SEARCH_TEXT: Record<string, SearchText> = {
  root: {
    buttonText: 'Search',
    buttonAriaLabel: 'Search',
    displayDetails: 'Display detailed list',
    resetButtonTitle: 'Reset search',
    backButtonTitle: 'Close search',
    noResultsText: 'No results for',
    selectText: 'to select',
    selectKeyAriaLabel: 'enter',
    navigateText: 'to navigate',
    navigateUpKeyAriaLabel: 'up arrow',
    navigateDownKeyAriaLabel: 'down arrow',
    closeText: 'to close',
    closeKeyAriaLabel: 'escape',
  },
  ru: {
    buttonText: 'Поиск',
    buttonAriaLabel: 'Поиск',
    displayDetails: 'Показать подробный список',
    resetButtonTitle: 'Сбросить поиск',
    backButtonTitle: 'Закрыть поиск',
    noResultsText: 'Нет результатов по',
    selectText: 'выбрать',
    selectKeyAriaLabel: 'Enter',
    navigateText: 'перемещаться',
    navigateUpKeyAriaLabel: 'стрелка вверх',
    navigateDownKeyAriaLabel: 'стрелка вниз',
    closeText: 'закрыть',
    closeKeyAriaLabel: 'Escape',
  },
  fr: {
    buttonText: 'Rechercher',
    buttonAriaLabel: 'Rechercher',
    displayDetails: 'Afficher la liste détaillée',
    resetButtonTitle: 'Réinitialiser la recherche',
    backButtonTitle: 'Fermer la recherche',
    noResultsText: 'Aucun résultat pour',
    selectText: 'sélectionner',
    selectKeyAriaLabel: 'Entrée',
    navigateText: 'naviguer',
    navigateUpKeyAriaLabel: 'flèche haut',
    navigateDownKeyAriaLabel: 'flèche bas',
    closeText: 'fermer',
    closeKeyAriaLabel: 'Échap',
  },
  de: {
    buttonText: 'Suchen',
    buttonAriaLabel: 'Suchen',
    displayDetails: 'Detaillierte Liste anzeigen',
    resetButtonTitle: 'Suche zurücksetzen',
    backButtonTitle: 'Suche schließen',
    noResultsText: 'Keine Ergebnisse für',
    selectText: 'auswählen',
    selectKeyAriaLabel: 'Eingabetaste',
    navigateText: 'navigieren',
    navigateUpKeyAriaLabel: 'Pfeil nach oben',
    navigateDownKeyAriaLabel: 'Pfeil nach unten',
    closeText: 'schließen',
    closeKeyAriaLabel: 'Escape',
  },
  it: {
    buttonText: 'Cerca',
    buttonAriaLabel: 'Cerca',
    displayDetails: 'Mostra elenco dettagliato',
    resetButtonTitle: 'Reimposta ricerca',
    backButtonTitle: 'Chiudi ricerca',
    noResultsText: 'Nessun risultato per',
    selectText: 'selezionare',
    selectKeyAriaLabel: 'Invio',
    navigateText: 'navigare',
    navigateUpKeyAriaLabel: 'freccia su',
    navigateDownKeyAriaLabel: 'freccia giù',
    closeText: 'chiudere',
    closeKeyAriaLabel: 'Esc',
  },
  es: {
    buttonText: 'Buscar',
    buttonAriaLabel: 'Buscar',
    displayDetails: 'Mostrar lista detallada',
    resetButtonTitle: 'Restablecer búsqueda',
    backButtonTitle: 'Cerrar búsqueda',
    noResultsText: 'No hay resultados para',
    selectText: 'seleccionar',
    selectKeyAriaLabel: 'Intro',
    navigateText: 'navegar',
    navigateUpKeyAriaLabel: 'flecha arriba',
    navigateDownKeyAriaLabel: 'flecha abajo',
    closeText: 'cerrar',
    closeKeyAriaLabel: 'Esc',
  },
  'pt-br': {
    buttonText: 'Pesquisar',
    buttonAriaLabel: 'Pesquisar',
    displayDetails: 'Mostrar lista detalhada',
    resetButtonTitle: 'Redefinir pesquisa',
    backButtonTitle: 'Fechar pesquisa',
    noResultsText: 'Nenhum resultado para',
    selectText: 'selecionar',
    selectKeyAriaLabel: 'Enter',
    navigateText: 'navegar',
    navigateUpKeyAriaLabel: 'seta para cima',
    navigateDownKeyAriaLabel: 'seta para baixo',
    closeText: 'fechar',
    closeKeyAriaLabel: 'Esc',
  },
  cs: {
    buttonText: 'Hledat',
    buttonAriaLabel: 'Hledat',
    displayDetails: 'Zobrazit podrobný seznam',
    resetButtonTitle: 'Obnovit hledání',
    backButtonTitle: 'Zavřít hledání',
    noResultsText: 'Žádné výsledky pro',
    selectText: 'vybrat',
    selectKeyAriaLabel: 'Enter',
    navigateText: 'navigovat',
    navigateUpKeyAriaLabel: 'šipka nahoru',
    navigateDownKeyAriaLabel: 'šipka dolů',
    closeText: 'zavřít',
    closeKeyAriaLabel: 'Esc',
  },
  pl: {
    buttonText: 'Szukaj',
    buttonAriaLabel: 'Szukaj',
    displayDetails: 'Pokaż szczegółową listę',
    resetButtonTitle: 'Zresetuj wyszukiwanie',
    backButtonTitle: 'Zamknij wyszukiwanie',
    noResultsText: 'Brak wyników dla',
    selectText: 'wybierz',
    selectKeyAriaLabel: 'Enter',
    navigateText: 'nawiguj',
    navigateUpKeyAriaLabel: 'strzałka w górę',
    navigateDownKeyAriaLabel: 'strzałka w dół',
    closeText: 'zamknij',
    closeKeyAriaLabel: 'Esc',
  },
  hu: {
    buttonText: 'Keresés',
    buttonAriaLabel: 'Keresés',
    displayDetails: 'Részletes lista megjelenítése',
    resetButtonTitle: 'Keresés visszaállítása',
    backButtonTitle: 'Keresés bezárása',
    noResultsText: 'Nincs találat erre:',
    selectText: 'kiválasztás',
    selectKeyAriaLabel: 'Enter',
    navigateText: 'navigálás',
    navigateUpKeyAriaLabel: 'felfelé nyíl',
    navigateDownKeyAriaLabel: 'lefelé nyíl',
    closeText: 'bezárás',
    closeKeyAriaLabel: 'Esc',
  },
  bg: {
    buttonText: 'Търсене',
    buttonAriaLabel: 'Търсене',
    displayDetails: 'Покажи подробен списък',
    resetButtonTitle: 'Нулиране на търсенето',
    backButtonTitle: 'Затваряне на търсенето',
    noResultsText: 'Няма резултати за',
    selectText: 'избор',
    selectKeyAriaLabel: 'Enter',
    navigateText: 'навигация',
    navigateUpKeyAriaLabel: 'стрелка нагоре',
    navigateDownKeyAriaLabel: 'стрелка надолу',
    closeText: 'затваряне',
    closeKeyAriaLabel: 'Esc',
  },
  el: {
    buttonText: 'Αναζήτηση',
    buttonAriaLabel: 'Αναζήτηση',
    displayDetails: 'Εμφάνιση λεπτομερούς λίστας',
    resetButtonTitle: 'Επαναφορά αναζήτησης',
    backButtonTitle: 'Κλείσιμο αναζήτησης',
    noResultsText: 'Δεν βρέθηκαν αποτελέσματα για',
    selectText: 'επιλογή',
    selectKeyAriaLabel: 'Enter',
    navigateText: 'περιήγηση',
    navigateUpKeyAriaLabel: 'πάνω βέλος',
    navigateDownKeyAriaLabel: 'κάτω βέλος',
    closeText: 'κλείσιμο',
    closeKeyAriaLabel: 'Esc',
  },
  tr: {
    buttonText: 'Ara',
    buttonAriaLabel: 'Ara',
    displayDetails: 'Ayrıntılı listeyi göster',
    resetButtonTitle: 'Aramayı sıfırla',
    backButtonTitle: 'Aramayı kapat',
    noResultsText: 'Sonuç bulunamadı:',
    selectText: 'seçmek için',
    selectKeyAriaLabel: 'Enter',
    navigateText: 'gezinmek için',
    navigateUpKeyAriaLabel: 'yukarı ok',
    navigateDownKeyAriaLabel: 'aşağı ok',
    closeText: 'kapatmak için',
    closeKeyAriaLabel: 'Esc',
  },
  ja: {
    buttonText: '検索',
    buttonAriaLabel: '検索',
    displayDetails: '詳細リストを表示',
    resetButtonTitle: '検索をリセット',
    backButtonTitle: '検索を閉じる',
    noResultsText: '検索結果なし:',
    selectText: '選択',
    selectKeyAriaLabel: 'Enter',
    navigateText: '移動',
    navigateUpKeyAriaLabel: '上矢印',
    navigateDownKeyAriaLabel: '下矢印',
    closeText: '閉じる',
    closeKeyAriaLabel: 'Esc',
  },
  ko: {
    buttonText: '검색',
    buttonAriaLabel: '검색',
    displayDetails: '상세 목록 표시',
    resetButtonTitle: '검색 초기화',
    backButtonTitle: '검색 닫기',
    noResultsText: '검색 결과 없음:',
    selectText: '선택',
    selectKeyAriaLabel: 'Enter',
    navigateText: '이동',
    navigateUpKeyAriaLabel: '위쪽 화살표',
    navigateDownKeyAriaLabel: '아래쪽 화살표',
    closeText: '닫기',
    closeKeyAriaLabel: 'Esc',
  },
  'zh-cn': {
    buttonText: '搜索',
    buttonAriaLabel: '搜索',
    displayDetails: '显示详细列表',
    resetButtonTitle: '重置搜索',
    backButtonTitle: '关闭搜索',
    noResultsText: '无结果：',
    selectText: '选择',
    selectKeyAriaLabel: 'Enter',
    navigateText: '导航',
    navigateUpKeyAriaLabel: '向上箭头',
    navigateDownKeyAriaLabel: '向下箭头',
    closeText: '关闭',
    closeKeyAriaLabel: 'Esc',
  },
  'zh-tw': {
    buttonText: '搜尋',
    buttonAriaLabel: '搜尋',
    displayDetails: '顯示詳細清單',
    resetButtonTitle: '重設搜尋',
    backButtonTitle: '關閉搜尋',
    noResultsText: '找不到結果：',
    selectText: '選擇',
    selectKeyAriaLabel: 'Enter',
    navigateText: '導覽',
    navigateUpKeyAriaLabel: '向上箭頭',
    navigateDownKeyAriaLabel: '向下箭頭',
    closeText: '關閉',
    closeKeyAriaLabel: 'Esc',
  },
};

function searchLocale(text: SearchText): {
  translations: NonNullable<DefaultTheme.LocalSearchOptions['translations']>;
} {
  return {
    translations: {
      button: { buttonText: text.buttonText, buttonAriaLabel: text.buttonAriaLabel },
      modal: {
        displayDetails: text.displayDetails,
        resetButtonTitle: text.resetButtonTitle,
        backButtonTitle: text.backButtonTitle,
        noResultsText: text.noResultsText,
        footer: {
          selectText: text.selectText,
          selectKeyAriaLabel: text.selectKeyAriaLabel,
          navigateText: text.navigateText,
          navigateUpKeyAriaLabel: text.navigateUpKeyAriaLabel,
          navigateDownKeyAriaLabel: text.navigateDownKeyAriaLabel,
          closeText: text.closeText,
          closeKeyAriaLabel: text.closeKeyAriaLabel,
        },
      },
    },
  };
}

function themeConfig(nav: string, docs: string, relnotes: string, footer: string): DefaultTheme.Config {
  return {
    logo: '/icon.png',
    nav: [
      { text: docs, link: '/docs/' },
      { text: relnotes, link: 'https://github.com/borisovodov/doru/releases' },
      { text: 'GitHub', link: 'https://github.com/borisovodov/doru' },
    ],
    sidebar: {
      '/docs/': [
        { text: nav, link: '/docs/' },
        {
          text: 'Get started',
          collapsed: false,
          items: [
            { text: 'Installation', link: '/docs/installation' },
            { text: 'Quick start', link: '/docs/getting-started' },
          ],
        },
        {
          text: 'Guide',
          collapsed: false,
          items: [
            { text: 'Working with the tree', link: '/docs/tree' },
            { text: 'Keyboard shortcuts', link: '/docs/shortcuts' },
            { text: 'Settings', link: '/docs/settings' },
            { text: 'AI and agents', link: '/docs/agents' },
            { text: 'Themes', link: '/docs/themes' },
          ],
        },
        {
          text: 'Reference',
          collapsed: false,
          items: [
            { text: 'Data and backups', link: '/docs/data-backups' },
            { text: 'Troubleshooting', link: '/docs/troubleshooting' },
          ],
        },
      ],
    },
    footer: { message: footer },
  };
}

const localeConfig = Object.fromEntries(
  (Object.keys(LOCALIZED) as Array<keyof typeof LOCALIZED>)
    .filter((key) => key !== 'en')
    .map((key) => {
      const { label, nav, docs, relnotes, footer } = LOCALIZED[key];
      return [key, { label, lang: key, themeConfig: themeConfig(nav, docs, relnotes, footer) }];
    }),
);

// The site is hosted at https://doru.family (see public/CNAME); social
// scrapers only accept absolute URLs, so og:image/og:url are built from here.
const SITE_URL = 'https://doru.family';

// og:locale wants a language + region tag; the page's locale is encoded in
// the first segment of its path (ru/index.md, docs/…, index.md).
const OG_LOCALE: Record<string, string> = {
  en: 'en_US',
  ru: 'ru_RU',
  fr: 'fr_FR',
  de: 'de_DE',
  it: 'it_IT',
  es: 'es_ES',
  'pt-br': 'pt_BR',
  cs: 'cs_CZ',
  pl: 'pl_PL',
  hu: 'hu_HU',
  bg: 'bg_BG',
  el: 'el_GR',
  tr: 'tr_TR',
  ja: 'ja_JP',
  ko: 'ko_KR',
  'zh-cn': 'zh_CN',
  'zh-tw': 'zh_TW',
};

// Maps a VitePress page path to its clean URL: index.md -> /,
// ru/index.md -> /ru/, docs/installation.md -> /docs/installation.
function pagePath(relativePath: string): string {
  const path = relativePath.replace(/\.md$/, '');
  if (path === 'index') return '/';
  if (path.endsWith('/index')) return `/${path.slice(0, -'/index'.length)}/`;
  return `/${path}`;
}

function ogLocale(relativePath: string): string {
  const segment = relativePath.split('/')[0];
  if (segment === undefined) return 'en_US';
  return OG_LOCALE[segment] ?? 'en_US';
}

// OpenGraph + Twitter Card tags. VitePress passes the fully composed page
// title ("Intro | Dóru") and resolved description (frontmatter description
// or the site-wide fallback) in the transformHead context, so the tags stay
// in sync with the <title>/<meta name="description"> tags automatically.
function openGraphHead({ pageData, title, description }: TransformContext): HeadConfig[] {
  const image = `${SITE_URL}/og-icon.png`;
  const tags: HeadConfig[] = [
    ['meta', { property: 'og:site_name', content: 'Dóru' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: title }],
    ['meta', { property: 'og:description', content: description }],
    ['meta', { property: 'og:image', content: image }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { property: 'og:image:alt', content: 'Dóru — genealogy for the AI era' }],
    ['meta', { property: 'og:locale', content: ogLocale(pageData.relativePath) }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: title }],
    ['meta', { name: 'twitter:description', content: description }],
    ['meta', { name: 'twitter:image', content: image }],
  ];
  if (!pageData.isNotFound) {
    tags.push(['meta', { property: 'og:url', content: `${SITE_URL}${pagePath(pageData.relativePath)}` }]);
  }
  return tags;
}

export default defineConfig({
  lang: 'en-US',
  title: 'Dóru',
  description:
    'Genealogy for the AI era. A desktop app for your family tree. Your tree lives in a plain folder on your disk, works fully offline, and is driven by AI agents — through the built-in chat or any MCP/ACP client.',
  cleanUrls: true,
  // Strict by default in VitePress; keep it explicit so a dead link always
  // fails the build instead of silently regressing.
  ignoreDeadLinks: false,
  appearance: 'force-auto',
  // VitePress resolves build-time flags (including local search) from the
  // top-level theme config, not from locales.root.themeConfig.
  themeConfig: {
    search: {
      provider: 'local',
      options: {
        locales: Object.fromEntries(Object.entries(SEARCH_TEXT).map(([locale, text]) => [locale, searchLocale(text)])),
      },
    },
  },
  transformHead: openGraphHead,
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/icon.png' }],
    // Preload the wordmark face so the hero name never paints in a
    // fallback font (font-display: swap without a preload flashes the
    // fallback for the first frames).
    [
      'link',
      {
        rel: 'preload',
        as: 'font',
        type: 'font/woff2',
        crossorigin: '',
        href: '/fonts/berkshire-swash-latin-400-normal.woff2',
      },
    ],
    [
      'script',
      {},
      `;(function () {
        var SUPPORTED = ['en', 'ru', 'fr', 'de', 'it', 'es', 'pt-br', 'cs', 'pl', 'hu', 'bg', 'el', 'tr', 'ja', 'ko', 'zh-cn', 'zh-tw'];
        var LANG_MAP = { zh: 'zh-cn', pt: 'pt-br' };
        function normalize(l) { return String(l || '').toLowerCase().replace('_', '-'); }
        function pick(langs) {
          for (var i = 0; i < langs.length; i++) {
            var l = normalize(langs[i]);
            if (SUPPORTED.indexOf(l) !== -1) return l;
            var base = l.split('-')[0];
            if (LANG_MAP[base]) return LANG_MAP[base];
            if (SUPPORTED.indexOf(base) !== -1) return base;
          }
          return null;
        }
        try {
          var saved = localStorage.getItem('doru-lang');
          var langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
          var target = saved ? normalize(saved) : pick(langs);
          if (target && target !== 'en' && location.pathname === '/') {
            location.replace('/' + target + '/');
          }
        } catch (e) {}
      })();`,
    ],
  ],
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      themeConfig: themeConfig('Intro', LOCALIZED.en.docs, LOCALIZED.en.relnotes, LOCALIZED.en.footer),
    },
    ...localeConfig,
  },
});

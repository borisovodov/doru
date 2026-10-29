import { defineConfig, type DefaultTheme } from 'vitepress';

const LOCALIZED = {
  en: { label: 'English', nav: 'Intro', relnotes: 'Release notes', footer: 'The name comes from Proto-Indo-European <em>*dóru</em> — “tree”.' },
  ru: { label: 'Русский', nav: 'Intro', relnotes: 'Примечания к выпускам', footer: 'Название происходит от праиндоевропейского <em>*dóru</em> — «дерево».' },
  fr: { label: 'Français', nav: 'Intro', relnotes: 'Notes de version', footer: 'Le nom vient du proto-indo-européen <em>*dóru</em> — « arbre ».' },
  de: { label: 'Deutsch', nav: 'Intro', relnotes: 'Versionshinweise', footer: 'Der Name kommt vom urindogermanischen <em>*dóru</em> — „Baum“.' },
  it: { label: 'Italiano', nav: 'Intro', relnotes: 'Note di rilascio', footer: 'Il nome deriva dal proto-indoeuropeo <em>*dóru</em> — «albero».' },
  es: { label: 'Español', nav: 'Intro', relnotes: 'Notas de la versión', footer: 'El nombre viene del protoindoeuropeo <em>*dóru</em> — «árbol».' },
  'pt-br': { label: 'Português (Brasil)', nav: 'Intro', relnotes: 'Notas de versão', footer: 'O nome vem do protoindo-europeu <em>*dóru</em> — «árvore».' },
  cs: { label: 'Čeština', nav: 'Intro', relnotes: 'Poznámky k vydání', footer: 'Název pochází z praindoevropského <em>*dóru</em> — „strom“.' },
  pl: { label: 'Polski', nav: 'Intro', relnotes: 'Informacje o wydaniu', footer: 'Nazwa pochodzi od praindoeuropejskiego <em>*dóru</em> — „drzewo“.' },
  hu: { label: 'Magyar', nav: 'Intro', relnotes: 'Kiadási megjegyzések', footer: 'A név a protoindoeurópai <em>*dóru</em> szóból ered — „fa“.' },
  bg: { label: 'Български', nav: 'Intro', relnotes: 'Бележки към изданието', footer: 'Името идва от праиндоевропейското <em>*dóru</em> — „дърво“.' },
  el: { label: 'Ελληνικά', nav: 'Intro', relnotes: 'Σημειώσεις έκδοσης', footer: 'Το όνομα προέρχεται από το πρωτοϊνδοευρωπαϊκό <em>*dóru</em> — «δέντρο».' },
  tr: { label: 'Türkçe', nav: 'Intro', relnotes: 'Sürüm notları', footer: 'Adı, Proto-Hint-Avrupa dilindeki <em>*dóru</em> — „ağaç“ sözcüğünden gelir.' },
  ja: { label: '日本語', nav: 'Intro', relnotes: 'リリースノート', footer: '名前は印欧祖語の <em>*dóru</em>「木」に由来します。' },
  ko: { label: '한국어', nav: 'Intro', relnotes: '릴리스 노트', footer: '이름은 인도유럽조어 <em>*dóru</em> — “나무”에서 유래했습니다.' },
  'zh-cn': { label: '简体中文', nav: 'Intro', relnotes: '发布说明', footer: '名字源自原始印欧语的 <em>*dóru</em>——“树”。' },
  'zh-tw': { label: '繁體中文', nav: 'Intro', relnotes: '發行說明', footer: '名字源自原始印歐語的 <em>*dóru</em>——「樹」。' },
} as const;

function themeConfig(nav: string, relnotes: string, footer: string): DefaultTheme.Config {
  return {
    logo: '/icon.png',
    nav: [
      { text: 'Docs', link: '/docs/' },
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
    search: { provider: 'local' },
  };
}

const localeConfig = Object.fromEntries(
  (Object.keys(LOCALIZED) as Array<keyof typeof LOCALIZED>)
    .filter((key) => key !== 'en')
    .map((key) => {
      const { label, nav, relnotes, footer } = LOCALIZED[key];
      return [key, { label, lang: key, themeConfig: themeConfig(nav, relnotes, footer) }];
    }),
);

export default defineConfig({
  lang: 'en-US',
  title: 'Dóru',
  description: 'Local-first genealogy for the AI era. Open source (MIT) — your data stays with you.',
  cleanUrls: true,
  // Strict by default in VitePress; keep it explicit so a dead link always
  // fails the build instead of silently regressing.
  ignoreDeadLinks: false,
  appearance: 'force-auto',
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
    root: { label: 'English', lang: 'en-US', themeConfig: themeConfig('Intro', LOCALIZED.en.relnotes, LOCALIZED.en.footer) },
    ...localeConfig,
  },
});

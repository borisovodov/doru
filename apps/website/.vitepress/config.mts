import { defineConfig, type DefaultTheme } from 'vitepress';

const LOCALIZED = {
  en: { label: 'English', nav: 'Docs', footer: 'Dóru — local-first genealogy for the AI era.' },
  ru: { label: 'Русский', nav: 'Документация', footer: 'Dóru — генеалогия local-first в эру ИИ' },
  fr: { label: 'Français', nav: 'Documentation', footer: "Dóru — la généalogie local-first à l'ère de l'IA" },
  de: { label: 'Deutsch', nav: 'Dokumentation', footer: 'Dóru — Local-first-Genealogie im KI-Zeitalter' },
  it: { label: 'Italiano', nav: 'Documentazione', footer: "Dóru — genealogia local-first nell'era dell'IA" },
  es: { label: 'Español', nav: 'Documentación', footer: 'Dóru — genealogía local-first en la era de la IA' },
  'pt-br': { label: 'Português (Brasil)', nav: 'Documentação', footer: 'Dóru — genealogia local-first na era da IA' },
  cs: { label: 'Čeština', nav: 'Dokumentace', footer: 'Dóru — local-first genealogie v éře AI' },
  pl: { label: 'Polski', nav: 'Dokumentacja', footer: 'Dóru — genealogia local-first w erze AI' },
  hu: { label: 'Magyar', nav: 'Dokumentáció', footer: 'Dóru — local-first családfakutatás a mesterséges intelligencia korában' },
  bg: { label: 'Български', nav: 'Документация', footer: 'Dóru — local-first генеалогия в ерата на ИИ' },
  el: { label: 'Ελληνικά', nav: 'Τεκμηρίωση', footer: 'Dóru — local-first γενεαλογία στην εποχή της τεχνητής νοημοσύνης' },
  tr: { label: 'Türkçe', nav: 'Belgeler', footer: 'Dóru — yapay zekâ çağında local-first soy ağacı' },
  ja: { label: '日本語', nav: 'ドキュメント', footer: 'Dóru — AI時代のlocal-first系図' },
  ko: { label: '한국어', nav: '문서', footer: 'Dóru — AI 시대의 local-first 계보' },
  'zh-cn': { label: '简体中文', nav: '文档', footer: 'Dóru — AI 时代的本地优先家谱' },
  'zh-tw': { label: '繁體中文', nav: '文件', footer: 'Dóru — AI 時代的本地優先家譜' },
} as const;

function themeConfig(nav: string, footer: string): DefaultTheme.Config {
  return {
    logo: '/icon.svg',
    nav: [
      { text: nav, link: '/docs/' },
      { text: 'GitHub', link: 'https://github.com/borisovodov/doru' },
    ],
    sidebar: {
      '/docs/': [{ text: nav, link: '/docs/' }],
    },
    footer: { message: footer },
    search: { provider: 'local' },
  };
}

const localeConfig = Object.fromEntries(
  (Object.keys(LOCALIZED) as Array<keyof typeof LOCALIZED>)
    .filter((key) => key !== 'en')
    .map((key) => {
      const { label, nav, footer } = LOCALIZED[key];
      return [key, { label, lang: key, themeConfig: themeConfig(nav, footer) }];
    }),
);

export default defineConfig({
  lang: 'en-US',
  title: 'Dóru',
  description: 'Local-first genealogy for the AI era.',
  cleanUrls: true,
  appearance: 'force-auto',
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' }],
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
    root: { label: 'English', lang: 'en-US', themeConfig: themeConfig('Docs', LOCALIZED.en.footer) },
    ...localeConfig,
  },
});

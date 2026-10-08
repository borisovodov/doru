import { defineConfig, type DefaultTheme } from 'vitepress';

const LOCALIZED = {
  en: { label: 'English', nav: 'Guide', footer: 'Doru — local-first genealogy for the AI era.' },
  ru: { label: 'Русский', nav: 'Руководство', footer: 'Doru — генеалогия local-first в эру ИИ' },
  fr: { label: 'Français', nav: 'Guide', footer: "Doru — la généalogie local-first à l'ère de l'IA" },
  de: { label: 'Deutsch', nav: 'Anleitung', footer: 'Doru — Local-first-Genealogie im KI-Zeitalter' },
  it: { label: 'Italiano', nav: 'Guida', footer: "Doru — genealogia local-first nell'era dell'IA" },
  es: { label: 'Español', nav: 'Guía', footer: 'Doru — genealogía local-first en la era de la IA' },
  'pt-br': { label: 'Português (Brasil)', nav: 'Guia', footer: 'Doru — genealogia local-first na era da IA' },
  cs: { label: 'Čeština', nav: 'Průvodce', footer: 'Doru — local-first genealogie v éře AI' },
  pl: { label: 'Polski', nav: 'Przewodnik', footer: 'Doru — genealogia local-first w erze AI' },
  hu: { label: 'Magyar', nav: 'Útmutató', footer: 'Doru — local-first családfakutatás a mesterséges intelligencia korában' },
  bg: { label: 'Български', nav: 'Ръководство', footer: 'Doru — local-first генеалогия в ерата на ИИ' },
  el: { label: 'Ελληνικά', nav: 'Οδηγός', footer: 'Doru — local-first γενεαλογία στην εποχή της τεχνητής νοημοσύνης' },
  tr: { label: 'Türkçe', nav: 'Rehber', footer: 'Doru — yapay zekâ çağında local-first soy ağacı' },
  ja: { label: '日本語', nav: 'ガイド', footer: 'Doru — AI時代のlocal-first系図' },
  ko: { label: '한국어', nav: '가이드', footer: 'Doru — AI 시대의 local-first 계보' },
  'zh-cn': { label: '简体中文', nav: '指南', footer: 'Doru — AI 时代的本地优先家谱' },
  'zh-tw': { label: '繁體中文', nav: '指南', footer: 'Doru — AI 時代的本地優先家譜' },
} as const;

function themeConfig(nav: string, footer: string): DefaultTheme.Config {
  return {
    nav: [
      { text: nav, link: '/guide/user-guide' },
      { text: 'GitHub', link: 'https://github.com/borisovodov/doru' },
    ],
    sidebar: {
      '/guide/': [{ text: nav, link: '/guide/user-guide' }],
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/borisovodov/doru' }],
    footer: { message: footer },
    search: { provider: 'local' },
  };
}

const localeConfig = Object.fromEntries(
  (Object.keys(LOCALIZED) as Array<keyof typeof LOCALIZED>).map((key) => {
    const { label, nav, footer } = LOCALIZED[key];
    return [key, { label, lang: key, themeConfig: themeConfig(nav, footer) }];
  }),
);

export default defineConfig({
  lang: 'en-US',
  title: 'Doru',
  description: 'Local-first genealogy for the AI era.',
  cleanUrls: true,
  locales: {
    root: { label: 'English', lang: 'en-US', themeConfig: themeConfig('Guide', LOCALIZED.en.footer) },
    ...localeConfig,
  },
});

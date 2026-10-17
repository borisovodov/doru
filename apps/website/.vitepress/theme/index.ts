import { h, watchEffect } from 'vue';
import { inBrowser, useData, type Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import '@fontsource/berkshire-swash';
import DownloadButtons from './DownloadButtons.vue';
import LangTracker from './LangTracker.vue';
import './style.css';

export default {
  extends: DefaultTheme,
  setup() {
    if (!inBrowser) return;
    const { isDark } = useData();
    watchEffect(() => {
      document.documentElement.classList.toggle('dark', isDark.value);
    });
  },
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'home-hero-actions-after': () => h(DownloadButtons),
      'home-features-before': () =>
        h('div', { class: 'doru-screenshot' }, [
          h('img', { src: '/screenshot.png', alt: 'Dóru screenshot' }),
        ]),
      'layout-top': () => h(LangTracker),
    }),
} satisfies Theme;

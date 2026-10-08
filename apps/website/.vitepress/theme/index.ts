import { h } from 'vue';
import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import DownloadButtons from './DownloadButtons.vue';
import LangTracker from './LangTracker.vue';
import './style.css';

export default {
  extends: DefaultTheme,
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

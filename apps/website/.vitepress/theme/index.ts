import { defineComponent, h, watchEffect } from 'vue';
import { inBrowser, useData, type Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import DownloadButtons from './DownloadButtons.vue';
import LangTracker from './LangTracker.vue';
import './style.css';

const Layout = defineComponent({
  setup() {
    if (inBrowser) {
      const { isDark } = useData();
      watchEffect(() => {
        document.documentElement.classList.toggle('dark', isDark.value);
      });
    }
    return () =>
      h(DefaultTheme.Layout, null, {
        'home-hero-actions-after': () => h(DownloadButtons),
        'home-features-before': () =>
          h('div', { class: 'doru-screenshot' }, [h('img', { src: '/screenshot.png', alt: 'Dóru screenshot' })]),
        'layout-top': () => h(LangTracker),
      });
  },
});

export default {
  extends: DefaultTheme,
  Layout,
} satisfies Theme;

import { defineConfig } from 'vitepress';

export default defineConfig({
  lang: 'en-US',
  title: 'Doru',
  description: 'Local-first genealogy for the AI era.',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/user-guide' },
      { text: 'GitHub', link: 'https://github.com/borisovodov/doru' },
    ],
    sidebar: {
      '/guide/': [{ text: 'User Guide', link: '/guide/user-guide' }],
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/borisovodov/doru' }],
    footer: {
      message: 'Doru — local-first genealogy for the AI era.',
    },
    search: {
      provider: 'local',
    },
  },
});

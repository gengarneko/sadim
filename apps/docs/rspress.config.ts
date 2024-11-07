import * as path from 'path';

import {defineConfig} from 'rspress/config';

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  lang: 'zh',
  icon: '/sadim-icon.png',
  // logo: {
  //   light: '/sadim-light-logo.svg',
  //   dark: '/sadim-dark-logo.svg',
  // },
  // locales 为一个对象数组
  locales: [
    {
      lang: 'en',
      label: 'English',
      title: 'Sadim',
      description: 'ECS-Powered Point Cloud Annotation Platform',
    },
    {
      lang: 'zh',
      label: '简体中文',
      title: 'Sadim',
      description: 'ECS 驱动的点云标注平台',
    },
  ],
  themeConfig: {
    socialLinks: [
      {
        icon: 'github',
        mode: 'link',
        content: 'https://github.com/gengarneko/sadim',
      },
    ],
    locales: [
      {
        lang: 'en',
        label: 'English',
        outlineTitle: 'ON THIS Page',
      },
      {
        lang: 'zh',
        label: '简体中文',
        outlineTitle: '大纲',
      },
    ],
  },
});

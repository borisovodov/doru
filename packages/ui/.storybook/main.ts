import type { StorybookConfig } from '@storybook/react-vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { themePlugin } from './theme-plugin.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y'],
  core: {
    disableTelemetry: true,
  },
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  async viteFinal(config) {
    config.plugins = [...(config.plugins ?? []), themePlugin()];
    config.server = {
      ...config.server,
      fs: {
        ...config.server?.fs,
        allow: [repoRoot],
      },
    };
    return config;
  },
};

export default config;

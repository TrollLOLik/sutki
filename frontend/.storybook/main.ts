import type { StorybookConfig } from '@storybook/react-vite';
import { fileURLToPath, URL } from 'node:url';
import { mergeConfig } from 'vite';

const src = (path: string) => fileURLToPath(new URL(`../src/${path}`, import.meta.url));

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  staticDirs: ['../public'],
  docs: { autodocs: 'tag' },
  async viteFinal(viteConfig) {
    return mergeConfig(viteConfig, {
      resolve: {
        alias: {
          '@': src(''),
          '@app': src('app'),
          '@pages': src('screens'),
          '@features': src('features'),
          '@entities': src('entities'),
          '@widgets': src('widgets'),
          '@shared': src('shared'),
          '@ui': src('shared/ui'),
        },
      },
    });
  },
};

export default config;

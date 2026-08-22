import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming/create';

addons.setConfig({
  theme: create({
    base: 'light',
    brandTitle: 'Sutki UI Kit',
    brandUrl: '/ui-kit',
    brandTarget: '_self',
    colorPrimary: '#ff5a1f',
    colorSecondary: '#ff5a1f',
    appBg: '#f6f7f9',
    appContentBg: '#ffffff',
    barSelectedColor: '#ff5a1f',
  }),
});

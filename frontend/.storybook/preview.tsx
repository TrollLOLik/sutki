import type { Decorator, Preview } from '@storybook/react-vite';
import { UIProvider } from '../src/shared/ui';
import '../src/shared/styles/global.css';
import '../src/shared/ui/tokens.css';
import '../src/shared/ui/ui-kit.css';
import '../src/screens/requests/requests.css';

const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme === 'dark' ? 'dark' : 'light';
  const density = context.globals.density === 'compact' ? 'compact' : 'comfortable';
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  return (
    <UIProvider density={density}>
      <div style={{ minHeight: '100vh', padding: 24, background: 'var(--screen)', color: 'var(--ink)' }}>
        <Story />
      </div>
    </UIProvider>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  initialGlobals: {
    theme: 'light',
    density: 'comfortable',
  },
  globalTypes: {
    theme: {
      description: 'Тема интерфейса',
      toolbar: {
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Светлая' },
          { value: 'dark', title: 'Тёмная' },
        ],
      },
    },
    density: {
      description: 'Плотность интерфейса',
      toolbar: {
        icon: 'component',
        items: [
          { value: 'comfortable', title: 'Комфортная' },
          { value: 'compact', title: 'Компактная' },
        ],
      },
    },
  },
  parameters: {
    a11y: { test: 'error' },
    controls: { expanded: true },
    layout: 'centered',
    backgrounds: { disable: true },
    options: {
      storySort: {
        order: ['Introduction', 'Foundations', 'UI Kit', 'Product', 'Pages'],
      },
    },
    viewport: {
      viewports: {
        mobile360: { name: 'Mobile 360', styles: { width: '360px', height: '800px' } },
        mobile390: { name: 'Mobile 390', styles: { width: '390px', height: '844px' } },
        tablet: { name: 'Tablet', styles: { width: '768px', height: '1024px' } },
        desktop: { name: 'Desktop', styles: { width: '1440px', height: '900px' } },
      },
    },
  },
};

export default preview;

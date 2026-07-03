/** @type {import('tailwindcss').Config} */
// Colors are CSS variables so the theme can flip at runtime (dark mode).
// The variable sets live in src/theme/vars.ts and are applied on the root
// View in src/app/_layout.tsx. Raw values: src/theme/tokens.ts.
const v = (name) => `rgb(var(${name}) / <alpha-value>)`;

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: v('--c-primary'),
          pressed: v('--c-primary-pressed'),
          light: v('--c-primary-light'),
        },
        success: {
          DEFAULT: v('--c-success'),
          light: v('--c-success-light'),
        },
        info: {
          DEFAULT: v('--c-info'),
          light: v('--c-info-light'),
        },
        danger: {
          DEFAULT: v('--c-danger'),
          light: v('--c-danger-light'),
        },
        star: v('--c-star'),
        ink: {
          DEFAULT: v('--c-ink'),
          secondary: v('--c-ink-secondary'),
          muted: v('--c-ink-muted'),
        },
        surface: {
          DEFAULT: v('--c-surface'),
          muted: v('--c-surface-muted'),
          skeleton: v('--c-surface-skeleton'),
        },
        line: v('--c-line'),
      },
      borderRadius: {
        card: '16px',
        field: '12px',
        pill: '999px',
      },
    },
  },
  plugins: [],
};

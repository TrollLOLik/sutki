/** @type {import('tailwindcss').Config} */
// NOTE: keep this palette in sync with src/theme/tokens.ts
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FF5A1F',
          pressed: '#E64A14',
          light: '#FFF1EC',
        },
        success: {
          DEFAULT: '#2EAD6B',
          light: '#E8F7EF',
        },
        info: {
          DEFAULT: '#2F80ED',
          light: '#EAF2FE',
        },
        danger: {
          DEFAULT: '#E5484D',
          light: '#FDECEC',
        },
        star: '#FFB400',
        ink: {
          DEFAULT: '#1A1A1A',
          secondary: '#6B7280',
          muted: '#9AA0A6',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F5F6F8',
          skeleton: '#E9EBEE',
        },
        line: '#ECECEC',
      },
      borderRadius: {
        card: '16px',
        field: '12px',
      },
    },
  },
  plugins: [],
};

import { vars } from 'nativewind';

/**
 * CSS variables that drive every Tailwind color class (see tailwind.config.js:
 * colors are declared as `rgb(var(--c-*) / <alpha-value>)`).
 *
 * The active set is applied as a style on the root View in app/_layout.tsx —
 * this is NativeWind's documented native theming mechanism (there is no CSS
 * cascade / :root on native). Values are space-separated RGB triplets so
 * Tailwind alpha modifiers (e.g. bg-ink/50) keep working.
 *
 * Keep in sync with lightPalette/darkPalette in tokens.ts.
 */
export const lightVars = vars({
  '--c-primary': '255 90 31',
  '--c-primary-pressed': '230 74 20',
  '--c-primary-light': '255 241 236',

  '--c-success': '46 173 107',
  '--c-success-light': '232 247 239',

  '--c-info': '47 128 237',
  '--c-info-light': '234 242 254',

  '--c-danger': '229 72 77',
  '--c-danger-light': '253 236 236',

  '--c-star': '255 180 0',

  '--c-ink': '26 26 26',
  '--c-ink-secondary': '107 114 128',
  '--c-ink-muted': '154 160 166',

  '--c-surface': '255 255 255',
  '--c-surface-muted': '245 246 248',
  '--c-surface-skeleton': '233 235 238',

  '--c-line': '236 236 236',
});

export const darkVars = vars({
  '--c-primary': '255 107 53',
  '--c-primary-pressed': '230 74 20',
  '--c-primary-light': '58 35 24',

  '--c-success': '61 191 124',
  '--c-success-light': '23 50 38',

  '--c-info': '77 148 242',
  '--c-info-light': '22 40 62',

  '--c-danger': '240 86 91',
  '--c-danger-light': '59 29 31',

  '--c-star': '255 180 0',

  '--c-ink': '242 243 245',
  '--c-ink-secondary': '155 161 170',
  '--c-ink-muted': '110 116 125',

  '--c-surface': '23 24 28',
  '--c-surface-muted': '31 33 38',
  '--c-surface-skeleton': '42 45 51',

  '--c-line': '44 47 53',
});

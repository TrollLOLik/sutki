# Mobile app — agent notes

Expo (React Native) + TypeScript app for **«Дом рядом»**, посуточная аренда квартир (Россия).
Part of the `sutki` monorepo: `mobile/` (this app), `backend/` (Go API, WIP), `pages_maket/` (макеты-референс).

## Stack (pinned, do not bump without reason)

- **Expo SDK 56** (React Native 0.85, React 19) — это свежая версия. Перед использованием новых API
  сверяйся с версионированной документацией: https://docs.expo.dev/versions/v56.0.0/
- **expo-router** (file-based, `src/app/`), typed routes enabled.
- **NativeWind v4** + Tailwind v3 (`tailwind.config.js`, токены в `src/theme/tokens.ts` — держать в синхроне).
- **Moti** + reanimated/gesture-handler — анимации, скелетоны.
- **TanStack Query v5** (`src/lib/query.ts`), **Zustand** (`src/store/`), **Zod** + react-hook-form.
- **expo-secure-store** — JWT (`src/lib/secure-storage.ts`).
- Package manager: **pnpm** (`.npmrc` → `node-linker=hoisted`).

## Conventions

- Импорты через alias `@/*` → `src/*`.
- UI-примитивы в `src/components/ui/` (барель `index.ts`); экраны — в `src/app/`.
- Цвета/радиусы — только из `tokens.ts` / Tailwind-классов, без хардкода hex по месту.
- Адаптивность под планшеты без media-queries: `ScreenContainer centered` (maxWidth 600) + брейкпоинты NativeWind.

## Commands

```bash
pnpm install
pnpm exec tsc --noEmit          # типы
npx expo export --platform android   # проверка сборки бандла (Metro + NativeWind)
pnpm start                      # dev (нужен prebuild/дев-клиент, не Expo Go)
```

EAS Cloud Build не используем — сборки локальные (`expo prebuild` → Gradle/Xcode).

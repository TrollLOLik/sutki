# «Дом рядом» — мобильное приложение

Expo (React Native) + TypeScript. Посуточная аренда квартир (Россия, Android-приоритет / iOS).
Каркас Фазы 0: дизайн-система, навигация и слой данных.

## Запуск

```bash
pnpm install
pnpm start          # запустить Metro (нужен dev-клиент/prebuild, не Expo Go)
```

Проверки:

```bash
pnpm exec tsc --noEmit                 # типы
npx expo export --platform android     # сборка JS-бандла (Metro + NativeWind)
```

## Структура

```
src/
  app/                 # экраны (expo-router, file-based)
    (auth)/            # welcome → phone → code → profile-setup
    (tabs)/            # Поиск / Карта / Избранное / Сообщения / Профиль
    listing/[id].tsx   # карточка объявления (заглушка)
    booking/[id].tsx   # заявка на аренду (заглушка)
  components/
    ui/                # дизайн-система: Button, Input, Chip, Badge, Skeleton, ScreenContainer
  lib/                 # api-клиент, react-query, secure-store, env, утилиты
  store/               # zustand: сессия, фильтры
  theme/tokens.ts      # палитра/радиусы (синхронизированы с tailwind.config.js)
```

## Стек

NativeWind v4 · TanStack Query v5 · Zustand · React Hook Form + Zod · expo-router (typed routes) ·
Moti · expo-secure-store.

> Авторизация и данные в Фазе 0 заглушены (моки), пока не подключён Go-бэкенд.

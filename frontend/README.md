# ВИГАЖ Web Platform

Рабочая React + TypeScript + Next.js версия приложения «ВИГАЖ» с адаптивными экранами, серверным рендерингом, изолированными mock-репозиториями, собственным UI Kit и Storybook.

## Быстрый запуск

```powershell
npm install
npm run dev
```

Приложение: `http://127.0.0.1:3000/`

```powershell
npm run storybook
```

Storybook: `http://127.0.0.1:6006/`

## Проверки

Проверки, которые можно запустить сразу без dev-сервера:

```powershell
npm run check:local
```

Полный production pipeline после `npm install`:

```powershell
npm run check
```

Подробности: [`docs/QUALITY_GATES.md`](docs/QUALITY_GATES.md).

## Структура

```text
src/
├── app/                 # Next.js App Router, bootstrap and app composition
├── screens/             # route-level screens, imported through @pages
│   └── <page>/
│       ├── index.ts
│       ├── ui/
│       └── *.stories.tsx
├── widgets/             # large reusable page blocks
├── features/            # user scenarios, state and repositories
├── entities/            # domain entity UI
└── shared/
    ├── api/
    ├── config/
    ├── lib/
    ├── styles/
    ├── types/
    └── ui/              # reusable UI Kit
```

Подробнее: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) и [`docs/REFACTOR_REPORT.md`](docs/REFACTOR_REPORT.md).

## Готовые экраны

Сохранены все уже реализованные маршруты, включая чат и входящие/исходящие заявки:

- `/` — главная и фильтры;
- `/map` — страница карты-заглушки;
- `/listing/1` — деталка объявления;
- `/booking/1` — заявка на бронь;
- `/create` — размещение объявления;
- `/profile` — профиль и настройки;
- `/messages`, `/chat/101` — список чатов и диалог;
- `/incoming`, `/incoming/8401` — входящие заявки;
- `/bookings`, `/bookings/9201` — исходящие заявки;
- `/ui-kit` — каталог компонентов в приложении.

Полный список: [`docs/SCREENS.md`](docs/SCREENS.md).

## UI Kit

UI Kit находится в `src/shared/ui` и включает токены, темы, layout primitives, формы, навигацию, feedback и overlays. Storybook продолжает использовать Vite только как собственный builder. Компоненты импортируются только через публичный API:

```tsx
import { Button, Field, Modal, Stack, TextField } from '@ui';
```

Документация: [`docs/UI_KIT.md`](docs/UI_KIT.md), [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) и [`docs/REFERENCES.md`](docs/REFERENCES.md).

## Mock backend

Чат и заявки работают через repository interfaces. По умолчанию активен session mock: изменения живут до перезагрузки вкладки. Реальный HTTP-адаптер подключается через `.env` без переписывания UI.

```env
NEXT_PUBLIC_CHAT_DATA_MODE=session-mock
NEXT_PUBLIC_REQUESTS_DATA_MODE=session-mock
NEXT_PUBLIC_API_BASE_URL=/api
NEXT_PUBLIC_MOCK_LATENCY_MS=220
```

Подробнее: [`docs/DATA_ADAPTERS.md`](docs/DATA_ADAPTERS.md).

## Генераторы

```powershell
npm run generate:page -- favorites "Избранное"
npm run generate:ui -- PriceBreakdown
```

## Правила разработки

Перед изменениями прочитать `AGENTS.md`. Репозиторий также содержит исходный React skill в `REACT_SKILL.md`.

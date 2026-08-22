# Quality gates

Проект разделяет проверки, которые не требуют установленных frontend-зависимостей, и полный production pipeline.

## Быстрый локальный аудит

```bash
npm run check:local
```

Команда выполняет:

1. `check:architecture` — направление зависимостей и публичные API слоёв;
2. `check:imports` — разрешение относительных и alias-импортов;
3. `check:syntax` — синтаксический разбор всех TS/TSX-файлов;
4. `check:ui-kit` — публичный экспорт и Storybook-покрытие каждого UI-примитива;
5. `test:unit` — route contracts, даты/маски/склонения и валидация формы объявления.

## Полный production pipeline

После `npm install`:

```bash
npm run check
```

Дополнительно запускаются строгий TypeScript, Storybook typecheck, Next.js production build и static Storybook build.

## Правила расширения

- Новая страница обязана иметь `index.ts`, `ui/` и page story.
- Новый UI-компонент обязан экспортироваться через `@ui` и присутствовать в Storybook.
- Новая бизнес-логика должна иметь минимальный unit/component test на наблюдаемое поведение.
- Session mock и HTTP adapter должны реализовывать один repository-контракт.

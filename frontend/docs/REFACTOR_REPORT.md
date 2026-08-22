# Отчёт по архитектурному рефакторингу

## Цель

Сохранить все готовые пользовательские сценарии и превратить демо-проект в читаемую платформу, где страницы быстро собираются из стабильного UI Kit, доменных модулей и заменяемых data adapters.

## Выполнено

- Сохранены все маршруты, включая чат и входящие/исходящие заявки.
- Route-level экраны находятся в `src/screens/<page>/ui`, импортируются через `@pages` и экспортируются через публичный `index.ts`.
- App bootstrap, route parsing, route rendering и поисковые overlays разделены по отдельным границам.
- Тяжёлые route-level экраны загружаются лениво через `React.lazy` и имеют единый pending state.
- Данные чата и заявок скрыты за repository-контрактами с session-mock и HTTP-адаптерами.
- Черновик объявления, профиль и форма бронирования имеют отдельные model/storage boundaries.
- Валидация размещения объявления вынесена из JSX в чистый модуль и покрыта unit-тестами.
- Уведомления приложения переведены с page-specific toast на `Snackbar` из UI Kit.
- Создан UI Kit из 37 публичных компонентов: foundations, actions, forms, navigation, layout, feedback и overlays.
- Добавлены focus trap, Escape, восстановление фокуса, roving tab index и keyboard navigation для составных контролов.
- Storybook настроен на light/dark, comfortable/compact, viewport presets, Autodocs и a11y-error policy.
- У всех готовых страниц есть полноэкранные Storybook stories.
- Добавлены генераторы страниц и UI-компонентов.
- Добавлены автоматические проверки архитектуры, импортов, TS/TSX-синтаксиса, UI Kit contracts и unit-тесты.

## Не изменялось

- Визуальный язык существующих экранов.
- Session-mock сценарии чата и заявок.
- Содержимое и статусы готовых заявок.
- Пользовательские маршруты и demo storage formats.

## Проверки

Успешно выполнены в среде подготовки:

```bash
npm run check:local
```

Результат:

- architecture — passed;
- internal imports — passed;
- TS/TSX syntax — passed для 156 файлов;
- UI Kit contracts — passed для 37 компонентов;
- unit tests — 9 passed.

Полные `typecheck`, `build` и `build-storybook` требуют установленных npm-зависимостей. Установка в среде подготовки не завершилась: внутренний registry вернул `404` для Storybook-пакетов, а прямой npm registry не ответил до timeout. Эти команды не заявляются как пройденные.

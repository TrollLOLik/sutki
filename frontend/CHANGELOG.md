# Changelog

## 3.1.3

- Исправлен session-store заявок: `getSnapshot` теперь возвращает стабильный объект до фактического изменения данных, поэтому страницы входящих заявок и бронирований больше не падают в цикле `useSyncExternalStore`.
- Все desktop-экраны переведены на единый `DesktopTopbar` без локальных вариантов геометрии для чата, карты, профиля, деталки, бронирования и заявок.
- Сохранены активные состояния навигации для каждого раздела.

## 3.1.1 — interaction and layout fixes

- Fixed Storybook MDX doc-block import for the installed addon-docs package.
- Aligned the search dialog header, field, sections and result cards to one content grid.
- Added backdrop dismissal to custom dialogs and nested filter pickers.
- Rebuilt the map workspace with a floating results panel and compact selected-listing preview.
- Restored the chat composer by correcting the dialog grid rows.
- Added a shared scroll-and-focus contract for validation errors across booking, listing creation, filters, profile and chat rejection.

## 3.1.0 — platform architecture and UI Kit hardening

- App routing, route rendering and search overlays split into separate boundaries.
- All ready screens preserved, including incoming/outgoing requests.
- Route-level code splitting and shared pending state added.
- App notifications migrated to UI Kit `Snackbar`.
- Create-listing validation extracted into a pure tested model.
- Storybook page stories enabled for Autodocs.
- Storybook theme/density globals updated and a11y policy set to `error`.
- UI Kit contract check added for public exports and story coverage.
- TS/TSX syntax and CSS token/brace checks added.
- Local quality gate now runs architecture, imports, syntax, styles, UI Kit and unit tests.
## 3.0.1

- Fixed application bootstrap imports: `main.tsx` now imports `App` and `AppProviders` from their authoritative modules instead of relying on the `@app` barrel during Vite dependency scanning.
- This also avoids collisions with stale `src/App.tsx` files when a release is extracted over an older project directory.


## 3.1.2

- Restored the public chat feature export for `useChatSnapshot`.
- Restored all request UI, selector, status, and snapshot exports used by `RequestsPage`.
- Added `check:feature-exports` so missing feature barrel exports fail during local checks before Vite starts.

- Добавлены регрессионные проверки стабильности session-store заявок и единой геометрии desktop-header.
- Корневой AGENTS.md обновлён до актуального набора правил.

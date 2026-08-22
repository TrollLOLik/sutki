# Design system references

Архитектура не копирует сторонний UI Kit, но использует проверенные инварианты крупных React design systems.

## VKUI

- Репозиторий: https://github.com/VKCOM/VKUI
- Токены: https://github.com/VKCOM/vkui-tokens
- Документация токенов: https://vkcom.github.io/vkui-tokens/

В Sutki UI Kit перенесены идеи:

- семантические токены отдельно от продуктовых компонентов;
- provider для плотности и адаптивности;
- единый публичный API;
- mobile/desktop-композиции на общей модели данных;
- продуктовые паттерны поверх низкоуровневых примитивов.

## Storybook

- React + Vite: https://storybook.js.org/docs/get-started/frameworks/react-vite
- Autodocs: https://storybook.js.org/docs/writing-docs/autodocs
- Toolbars and globals: https://storybook.js.org/docs/essentials/toolbars-and-globals
- Accessibility tests: https://storybook.js.org/docs/writing-tests/accessibility-testing

В проекте применены:

- Storybook 10 с React/Vite;
- global toolbar для темы и плотности;
- viewport presets;
- Autodocs для UI Kit и route-level экранов;
- `@storybook/addon-a11y` с режимом `error`;
- отдельные stories для состояний, продуктовых паттернов и всех готовых страниц.

# Sutki UI Kit

UI Kit находится в `src/shared/ui` и строится на семантических токенах, а не на цветах конкретной страницы.

## Состав

### Foundations

- цветовые и тематические токены;
- типографика;
- отступы, радиусы, тени и уровни слоёв;
- комфортная и компактная плотность;
- light/dark темы и `prefers-reduced-motion`.

### Actions

- `Button`;
- `IconButton`;
- `Chip`;
- `Counter`.

### Forms

- `Field`;
- `TextField`;
- `SearchField`;
- `TextArea`;
- `Select`;
- `Checkbox`;
- `Radio`;
- `Switch`.

### Navigation

- `AppHeader`;
- `Tabs`;
- `SegmentedControl`;
- `ListCell`.

### Layout and data display

- `Container`;
- `Stack`;
- `Grid`;
- `Surface`;
- `Card`;
- `Typography`;
- `Avatar`;
- `Badge`;
- `Divider`.

### Feedback and overlays

- `InlineAlert`;
- `EmptyState`;
- `Placeholder`;
- `Skeleton`;
- `Spinner`;
- `Progress`;
- `Snackbar`;
- `Modal`;
- `BottomSheet`;
- `DialogActions`.

## Использование

```tsx
import { Button, Field, Stack, TextField, Typography } from '@ui';

export function ContactForm() {
  return (
    <Stack gap={16}>
      <Typography as="h2" variant="title2">Контакты</Typography>
      <Field label="Телефон" labelFor="contact-phone">
        <TextField id="contact-phone" type="tel" autoComplete="tel" />
      </Field>
      <Button type="submit">Сохранить</Button>
    </Stack>
  );
}
```

## Storybook

```bash
npm run storybook
npm run build-storybook
```

Storybook содержит:

- foundations и все группы UI Kit;
- интерактивные состояния форм и оверлеев;
- продуктовые паттерны;
- карточки и детали заявок;
- полные истории уже готовых страниц.

При добавлении нового UI-компонента обязательны базовая story, disabled/loading/error состояния, dark theme и проверка с клавиатуры.

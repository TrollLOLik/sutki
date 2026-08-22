# Карта компонентов ВИГАЖ

Этот файл фиксирует архитектурный контракт интерфейса. Продуктовые страницы собираются из общего UI-kit и предметных компонентов; локальные визуальные копии одинаковых элементов запрещены.

## Неподвижный контракт мобильной и планшетной версии

- Нельзя менять размеры, отступы, позиционирование, адаптивные границы, анимации и визуальные состояния мобильной/планшетной версии без отдельной явной задачи.
- Архитектурный перенос обязан сохранять существующие CSS-классы и DOM-границы, от которых зависят стили.
- Общий компонент расширяется совместимым режимом. Нельзя менять базовый режим так, чтобы уже готовые страницы визуально изменились.
- В продуктовых TSX запрещены сырые `button`, `a`, `input`, `textarea`, `select` и текстовые теги. Это контролирует `npm run check:components`.
- Кнопки используют только размеры `sm`, `md`, `lg`; кнопки футера — `md`, подтверждения — `sm`.
- Базовые веса текста — `400` и `500`. Обрезание включается снаружи через `truncate`.
- Валидация находится рядом с полем, текст ошибки — 9 px, страница прокручивается к первой ошибке.
- Основное действие — оранжевое. Зелёные action-кнопки не используются; опасное действие — красная окантовка.

## Общий UI-kit

- Текст: `HeroTitle`, `PageTitle`, `SectionTitle`, `BodyText`, `DescriptionText`, `BadgeText`, `Typography`.
- Действия: `Button`, `ButtonLink`, `IconButton`, `IconButtonLink`, `Pressable`, `PressableLink`, `Chip`, `ChoiceCard`, `ToggleCard`, `ListCell`.
- Формы: `Field`, `TextField`, `TextArea`, `Select`, `PhoneField`, `PickerField`, `OneTimeCodeField`, `Checkbox`, `Radio`, `Switch`, `Counter`, `DualRange`.
- Навигация: `AppHeader`, `ListPageHeader`, `DesktopPageHeading`, `PersonalListToolbar`, `SearchField`, `SortSurface`, `Tabs`, `CountedTabs`, `StickyActionBar`, `RouteActionBarPortal`.
- Оверлеи: `Modal`, `FullPageModal`, `BottomSheet`, `ConfirmationDialog`, `OverlaySurface`, `DialogHeader`, `DialogActions`.
- Каркасы: `Surface`, `Card`, `Container`, `Stack`, `Grid`, `FormSection`, `Stat`, `KeyValueRow`, `CompactAlert`, `EmptyState`, `PullToRefreshIndicator`, `Skeleton`, `Divider`.

## Переиспользуемые предметные компоненты

- Каталог: `ListingCard`, компактная карточка, `CatalogToolbar`, `CatalogFilterShortcuts`, `CatalogFeed`, общие поиск и фильтры.
- Мои объявления: `OwnerListingCard`, `MyListingsControls`, `MyListingsResults`, `MyListingsOverlays`.
- Деталка объявления: `ListingGallery`, `ListingDetailContent`, `ListingDesktopBookingCard`, `ListingMobileBookingBar`, `ListingDetailOverlays`.
- Карта: `MapResultsPanel`, `MapCanvas`, `MapResultCard`, `MapSelectedCard`.
- Профиль: `ProfileOverview`, `ProfileSettingsPanels`, `ProfileSessionDialogs`, `ProfileContactDialog`, `ProfileDeleteDialogs`.
- Публичный профиль: `PublicProfileOverview`, `PublicProfileListings`, `PublicProfileOverlays`.
- Заявки: `RequestsListView`, `RequestCard`, `RequestDetail`, `RequestDialog`.
- Отзывы: `MyReviewsContent`, `ReviewCard`, `DeleteReviewDialog`.
- Сообщения: `ConversationSidebar`, `ConversationRow`, `ChatDialog`, `MessageItem`, `ChatComposer`, `ChatDialogs`.
- Бронирование: секции дат, гостей и контактов, `BookingSummaryCard`, мобильный action bar и диалог результата.
- Создание объявления: шесть самостоятельных шагов, `CreateListingHeader`, `CreateListingSidebar`, `CreateListingActionBar`, `CreateListingSuccess`.

## Контроллеры страниц

Состояние и побочные эффекты вынесены из визуальных компонентов в специализированные хуки:

- `useCatalogPageController`
- `useMyListingsPageController`
- `useRequestsPageController`
- `useMyReviewsPageController`
- `useBookingForm`
- `usePublicProfileController`
- `useMessagesListController`
- `useProfileController`
- `useCreateListingController`
- `useListingDetailController`

Контроллеры не задают внешний вид. Компоненты получают готовое состояние и обработчики, сохраняя прежние классы.

## Структурная оценка страниц после переноса

| Состояние | Страницы | Оценка |
| --- | --- | --- |
| Хорошо собраны | Каталог, карта, мои объявления, заявки, отзывы, бронирование, публичный профиль, создание объявления, профиль, уведомления, авторизация | Страница является композицией предметных блоков; управление состоянием вынесено. |
| Нормально, предметная сложность оправдана | Деталка объявления, диалог сообщений | Внутри много связанных интерактивных состояний, но визуальные секции, composer, модалки и карточки разделены. Дальнейшее дробление нужно только при расширении функциональности. |
| Требуют обязательной структурной переделки | Нет | Текущие крупные владельцы разделены; новые функции должны добавляться через существующие компоненты и контроллеры. |

## Автоматические ограничения

- `check-component-usage.mjs` запрещает сырые контролы и типографику в продуктовых TSX.
- `check-ui-ownership.mjs` закрепляет канонические диалоги, scroll-lock и обязательные предметные компоненты страниц.
- `check-architecture.mjs` и `check-imports.mjs` контролируют границы слоёв и внутренние импорты.

## Что остаётся предметным

Не переносить в `shared/ui` бизнес-логику: расчёт бронирования, статусы заявок, модерацию отзывов и вложений, правила публикации объявления, данные карты и галереи. Эти блоки используют общий UI-kit, но остаются внутри своих `features/pages`.

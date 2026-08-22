# Theme audit

Проверены основные интерфейсные зоны в светлом и тёмном режимах на desktop и mobile:

1. Главная: header, desktop menu, быстрые фильтры, карточки, статусы, избранное, empty/loading.
2. Полные фильтры: панели, сегменты, диапазоны, переключатели, вложенные экраны, footer.
3. Календарь: диапазон, disabled/outside dates, пресеты, sheet/modal layout.
4. Детальная: gallery controls, характеристики, удобства, владелец, карта-заглушка, booking card, похожие объявления, lightbox.
5. Заявка: поля, даты, гости, validation, расчёт, sticky submit, success state.
6. Размещение: все шаги, inputs, chips, адрес, карта, правила, фото, preview, sidebar, publish/success.
7. Профиль: карточки, настройки, безопасность, устройства, dialogs, birthday picker, theme selector.
8. Общие состояния: focus, hover, active, disabled, autofill, overlays, glass surfaces, safe areas, overscroll background.

Статические проверки:

- баланс CSS-блоков;
- отсутствие обращений к неопределённым CSS-переменным;
- синтаксическая проверка TS/TSX;
- визуальные контрольные рендеры representative UI в light/dark и desktop/mobile;
- проверка контраста основных текстовых и семантических пар.

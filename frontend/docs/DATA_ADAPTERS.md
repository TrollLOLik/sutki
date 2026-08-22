# Data adapters

Чат и заявки не зависят от конкретного backend.

```text
UI / hooks
  → repository interface
    → session mock adapter
    → HTTP adapter
```

Режим задаётся через публичные переменные окружения Next.js:

```env
NEXT_PUBLIC_CHAT_DATA_MODE=session-mock
NEXT_PUBLIC_REQUESTS_DATA_MODE=session-mock
NEXT_PUBLIC_API_BASE_URL=/api
```

Для подключения сервера нужно реализовать существующие repository-контракты и переключить режим на `http`. UI и страницы при этом не переписываются.

Session mock хранит изменения только в памяти вкладки и восстанавливает seed после перезагрузки.

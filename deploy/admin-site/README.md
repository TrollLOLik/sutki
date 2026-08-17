# ВИГАЖ: операторская панель

Статический same-origin клиент для Admin API. Панель не содержит секретов и не
работает с PostgreSQL напрямую: браузер обращается только к `/api/admin/v1`.

## Локальная проверка файлов

```powershell
node --check assets/admin.js
```

Полный вход требует запущенный Go API, разрешённый `ADMIN_PUBLIC_URL` и
оператора, созданного через bootstrap-команду. Production-развёртывание описано
в `deploy/ADMIN_PANEL_DEPLOY.md`.

## Безопасность

- сессия хранится в `Secure`, `HttpOnly`, `SameSite=Strict` cookie;
- CSRF-токен возвращается только аутентифицированному клиенту и отправляется в
  `X-CSRF-Token` для изменяющих запросов;
- токены не сохраняются в `localStorage` или `sessionStorage`;
- данные API выводятся через `textContent`, без HTML-инъекций;
- все решения повторно проверяются API по роли и записываются в журнал аудита.

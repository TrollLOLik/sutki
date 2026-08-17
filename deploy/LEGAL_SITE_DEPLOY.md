# Публикация правовых документов ВИГАЖ

## 1. Собрать пакет

Из корня репозитория:

```powershell
npm run build:legal
```

Команда подставляет утвержденные значения из
`docs/legal/publish-values.json`, проверяет отсутствие незаполненных
плейсхолдеров и создает статический пакет в `deploy/legal-site`.

## 2. Разместить на VPS

`arenda.wigaj.ru` указывает на VPS с Go API, поэтому файлы из web-root
обычного хостинга Timeweb для этого поддомена недоступны. Статический пакет
нужно положить на тот же VPS в `/var/www/wigaj-arenda`:

```bash
cd /opt/titop_arenda/app

sudo install -d -m 755 /var/www/wigaj-arenda
sudo cp -a deploy/legal-site/legal /var/www/wigaj-arenda/
sudo cp -a deploy/legal-site/assets /var/www/wigaj-arenda/
sudo find /var/www/wigaj-arenda -type d -exec chmod 755 {} \;
sudo find /var/www/wigaj-arenda -type f -exec chmod 644 {} \;
```

Затем установить только snippet с маршрутами документов:

```bash
sudo cp deploy/nginx/wigaj-legal-locations.conf /etc/nginx/snippets/wigaj-legal-locations.conf
```

В действующий `server`-блок `arenda.wigaj.ru` на порту `443` добавить строку
перед общим `location /`:

```nginx
include /etc/nginx/snippets/wigaj-legal-locations.conf;
```

Если отдельный HTTP-блок на порту `80` не делает безусловный redirect на
HTTPS, добавить тот же include и туда. Активный конфиг, изменённый Certbot,
целиком не перезаписывать. После изменения:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Найти активный файл и оба server-блока можно командой:

```bash
sudo nginx -T 2>/dev/null | grep -n -B3 -A8 'server_name arenda.wigaj.ru'
```

## 3. Проверить публичные адреса

```powershell
$urls = @(
  'https://arenda.wigaj.ru/legal/',
  'https://arenda.wigaj.ru/legal/privacy/',
  'https://arenda.wigaj.ru/legal/terms',
  'https://arenda.wigaj.ru/legal/personal-data-consent',
  'https://arenda.wigaj.ru/legal/personal-data-dissemination-consent',
  'https://arenda.wigaj.ru/legal/community-standards/',
  'https://arenda.wigaj.ru/legal/recommendations/',
  'https://arenda.wigaj.ru/legal/requisites/',
  'https://arenda.wigaj.ru/legal/account-deletion/'
)

$urls | ForEach-Object {
  $response = Invoke-WebRequest -Uri $_ -Method Head
  "{0} {1}" -f $response.StatusCode, $_
}
```

Все адреса должны отвечать `200` по HTTPS без авторизации.

## 4. Зафиксировать ту же редакцию в backend

После публикации скопировать значения из
`deploy/legal-audit/hashes.env` в `deploy/.env.production`, затем
пересоздать `api`:

```bash
sudo docker compose \
  --env-file deploy/.env.production \
  -f deploy/compose.production.yml \
  up -d --build --force-recreate api
```

Нельзя редактировать опубликованные тексты вручную после генерации: изменится
SHA-256, а сохраненное backend согласие будет ссылаться на другую редакцию.

## 5. Что хранить для аудита

- каталог `deploy/legal-audit` с точными Markdown-файлами этой редакции;
- `deploy/legal-audit/manifest.json`;
- `deploy/legal-audit/hashes.env` (хранится вне публичного web-root);
- дату фактической публикации;
- подтверждение доступности URL;
- значения legal-переменных, с которыми был запущен backend.

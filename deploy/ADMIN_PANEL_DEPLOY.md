# Operator panel deployment

The operator panel is a static application. Nginx serves its files from
`admin.wigaj.ru` and proxies only `/api/admin/v1/` to the Go API on loopback.
This same-origin layout keeps the admin session cookies host-only and avoids a
separate CORS policy.

## 1. DNS and backend configuration

Create an `A` record for `admin.wigaj.ru` pointing to the production VPS. Set
the exact origin in `deploy/.env.production`:

```dotenv
ADMIN_PUBLIC_URL=https://admin.wigaj.ru
```

Recreate `api` after changing this value. The backend rejects state-changing
admin requests from every other origin.

## 2. Install static files and Nginx site

From the repository directory on the VPS:

```bash
sudo install -d -o root -g www-data -m 0750 /var/www/wigaj-admin
sudo cp -a deploy/admin-site/. /var/www/wigaj-admin/
sudo chown -R root:www-data /var/www/wigaj-admin
sudo find /var/www/wigaj-admin -type d -exec chmod 0750 {} \;
sudo find /var/www/wigaj-admin -type f -exec chmod 0640 {} \;

sudo cp deploy/nginx/wigaj-admin.conf /etc/nginx/sites-available/wigaj-admin
sudo ln -sfn /etc/nginx/sites-available/wigaj-admin /etc/nginx/sites-enabled/wigaj-admin
sudo nginx -t
sudo systemctl reload nginx
```

Issue the certificate only after DNS resolves to this VPS:

```bash
sudo certbot --nginx -d admin.wigaj.ru
sudo nginx -t
sudo systemctl reload nginx
```

Certbot edits the installed file in `/etc/nginx/sites-available`; do not copy
the repository HTTP bootstrap config over it after the certificate is issued.

## 3. First owner and smoke check

Create the first owner with the SQL command documented in `deploy/README.md`,
then verify the static page and the proxied API:

```bash
curl -I https://admin.wigaj.ru/
curl -i https://admin.wigaj.ru/api/admin/v1/auth/me
```

The first request must return `200`; the unauthenticated API check must return
`401`. Complete one OTP login in a browser, open an inbox item, and verify that
a state-changing action is rejected without `X-CSRF-Token` and accepted with
the token supplied by the login response.

## Updating the panel

Only the static directory needs replacement when frontend files change:

```bash
sudo cp -a deploy/admin-site/. /var/www/wigaj-admin/
sudo chown -R root:www-data /var/www/wigaj-admin
```

No container rebuild is required unless the admin API changed too.

## Staff access rules

The `Журнал` and `Сотрудники` sections are available only to the `owner` role.

- Only an existing, active WIGAJ account with an email can be added.
- `support` handles reports, `moderator` also handles manual moderation, and `owner` manages staff access.
- Changing a role or disabling access revokes all active admin sessions for that employee immediately.
- An owner cannot change their own access from the current session or disable the last active owner.
- Every staff change and operator decision is appended to `admin_audit_log`.
- The owner-only `Журнал` screen shows the employee, action, target, reason,
  timestamp, and IP address with server-side pagination.
- Telegram queue alerts open `/?kind=<kind>&id=<source-id>`; this link remains
  valid through the OTP login flow and opens the exact queue item afterward.

The first owner is still provisioned directly in PostgreSQL using the command
in `deploy/README.md`. Further employees are managed from the panel.

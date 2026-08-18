# WIGAJ Arenda production deployment

This deployment starts a clean PostgreSQL cluster with separate databases for
the application and GlitchTip. Postgres is never published to the host network.
The API, Centrifugo, and GlitchTip bind to loopback only; Nginx is the only
public entry point.

## First deployment

1. Copy this repository to `/opt/titop_arenda/app` on the VPS.
2. Copy `.env.production.example` to `.env.production`, fill every required
   value, and run `chmod 600 .env.production`.
3. Validate the manifest:

   ```bash
   sudo docker compose --env-file deploy/.env.production -f deploy/compose.production.yml config
   ```

4. Start the stack:

   ```bash
   sudo docker compose --env-file deploy/.env.production -f deploy/compose.production.yml up -d --build
   ```

5. Watch the one-time application migration and the API:

   ```bash
   sudo docker compose --env-file deploy/.env.production -f deploy/compose.production.yml logs -f migrate api
   ```

The Postgres initialization scripts only run when `postgres_data` is empty.
Never remove that volume on a populated server.

### Existing TiTop Compose migration

The Compose project is now named `wigaj-arenda`. Its volume declarations are
explicitly pinned to the existing production volumes, so PostgreSQL and
GlitchTip data stay attached. On the first deployment after this rename, stop
the old project before starting the new one to avoid loopback port conflicts:

```bash
sudo systemctl start titop-arenda-backup.service
sudo docker compose -p titop-arenda --env-file deploy/.env.production \
  -f deploy/compose.production.yml down
sudo docker compose --env-file deploy/.env.production \
  -f deploy/compose.production.yml up -d --build
```

Do not add `-v` to the `down` command.

## Nginx and TLS

Install host Nginx and Certbot, copy `deploy/nginx/wigaj-arenda.conf` to
`/etc/nginx/sites-available/wigaj-arenda`, symlink it into `sites-enabled`,
then validate with `sudo nginx -t` and reload Nginx. Issue certificates only
after both DNS records resolve to the VPS:

```bash
sudo certbot --nginx -d arenda.wigaj.ru -d errors.wigaj.ru
```

After Certbot creates the HTTPS server blocks, install the shared TLS security
snippet and include it inside **both** `listen 443 ssl` blocks:

```bash
sudo cp deploy/nginx/wigaj-arenda-tls-security.conf \
  /etc/nginx/snippets/wigaj-arenda-tls-security.conf
```

On an existing server, do not copy the baseline HTTP config over the live
Certbot-managed file. Edit `/etc/nginx/sites-available/wigaj-arenda` in place.
Add this line near the certificate directives in both HTTPS blocks:

```nginx
include /etc/nginx/snippets/wigaj-arenda-tls-security.conf;
```

Do not add `includeSubDomains` or `preload`: `wigaj.ru` is shared with other
products, and either directive would make HTTPS mandatory for all of their
subdomains too. Validate and reload after editing:

```bash
sudo nginx -t
sudo systemctl reload nginx
curl -fsSI https://arenda.wigaj.ru/healthz | grep -i strict-transport-security
curl -fsSI https://errors.wigaj.ru/ | grep -i strict-transport-security
sudo certbot renew --dry-run
```

## Health checks

```bash
curl -fsS http://127.0.0.1:8080/healthz
curl -fsS https://arenda.wigaj.ru/healthz
```

## Website deployment

The Symfony/Twig website from `public_html/` is deployed separately to Timeweb
virtual hosting. It is not part of this VPS Compose project and never receives
database credentials. Its production document root must point to
`public_html/public`, and `BACKEND_API_BASE_URL` must be
`https://arenda.wigaj.ru/api/v1`.

The checked deployment script updates only the VPS services. With
`RUN_PUBLIC_SMOKE=1`, the smoke test also verifies the separately hosted public
website:

```bash
sudo env RUN_PUBLIC_SMOKE=1 sh deploy/scripts/deploy-production.sh
```

The public API is also monitored externally by Timeweb Cloud Monitoring:

- URL: `https://arenda.wigaj.ru/healthz`
- method: `GET`
- interval: one minute
- timeout: ten seconds
- redirects: disabled
- SSL monitoring: enabled
- regions: multiple Russian regions

Timeweb Telegram notifications must include both service-unavailable and
service-restored events. This check is intentionally outside the VPS so a
complete host, Nginx, network, or API outage can still raise an alert.

## Updates

Review release notes before changing major image tags. For routine application
updates, pull the repository, then run the same `docker compose up -d --build`
command. The API migration service applies pending additive migrations before
the API is allowed to start. GlitchTip manages its own migrations on startup.

## Legal document evidence and retention

The API is fail-closed in production until the published legal document
version and SHA-256 values are configured. The generated static pages must be
publicly reachable before enabling that revision:

```bash
curl -fsSI https://arenda.wigaj.ru/legal/terms
curl -fsSI https://arenda.wigaj.ru/legal/personal-data-consent
curl -fsSI https://arenda.wigaj.ru/legal/personal-data-dissemination-consent
```

Copy the values generated in `deploy/legal-audit/hashes.env` into
`deploy/.env.production` as
`LEGAL_USER_AGREEMENT_SHA256`, `LEGAL_PERSONAL_DATA_SHA256`, and
`LEGAL_DATA_DISSEMINATION_SHA256`. Set `LEGAL_DOCUMENT_VERSION` to the same
published edition shown by the website. Changing any resolved document text
requires a new version and new hashes before deployment.

Migration `000047_legal_consents_retention` creates the consent evidence
journal and the retention-run journal. The API runs retention once at startup
and then daily. Verify its latest execution after deployment:

```bash
sudo docker compose --env-file deploy/.env.production -f deploy/compose.production.yml \
  exec -T postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "SELECT started_at, finished_at, status, counters, error FROM data_retention_run ORDER BY id DESC LIMIT 5;"'
```

The database worker cannot expire provider-managed backup objects. Keep the
Timeweb lifecycle rule below enabled for `postgres/`; its 90-day expiry is the
enforcement mechanism for deleted data remaining in encrypted backups.

## PostgreSQL backups

Install the backup script and systemd units on the VPS:

```bash
sudo install -m 0750 deploy/backup/postgres-backup.sh /usr/local/sbin/titop-arenda-postgres-backup
sudo install -m 0644 deploy/systemd/titop-arenda-backup.service /etc/systemd/system/
sudo install -m 0644 deploy/systemd/titop-arenda-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now titop-arenda-backup.timer
```

Run and verify the first backup immediately:

```bash
sudo systemctl start titop-arenda-backup.service
sudo systemctl status titop-arenda-backup.service --no-pager
sudo journalctl -u titop-arenda-backup.service -n 50 --no-pager
sudo find /var/backups/titop-arenda/postgres -maxdepth 2 -type f -printf '%M %s %p\n'
```

The timer runs daily at 00:30 UTC with a random delay of up to ten minutes.
Each timestamped directory contains custom-format dumps for the application and
GlitchTip databases, a password-free role snapshot, and SHA-256 checksums.
Backups older than 14 days are removed. Local backups must also be copied to
off-server object storage; the VPS disk is not an independent backup target.

To upload client-side encrypted backups to Timeweb S3, install `awscli` and
create `/etc/titop-arenda-backup.env` owned by root with mode `0600`:

```dotenv
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=...
BACKUP_S3_ENDPOINT=https://...
BACKUP_S3_BUCKET=titop-arenda-backups
BACKUP_ENCRYPTION_KEY=...
```

Generate the encryption key with `openssl rand -hex 32` and store a separate
copy in the project's password manager. The script encrypts the complete dump
directory with AES-256 before upload, uploads a SHA-256 sidecar, and verifies
the remote object with `HeadObject`. The plaintext dumps remain on the VPS and
the temporary encrypted upload file is removed after verification.

Configure a Timeweb lifecycle rule for the `postgres/` prefix to expire current
objects after 90 days. Keep the backup S3 user at read/write access; apply the
lifecycle rule from the Timeweb panel with an account that can manage the
bucket.

Install and run the restore drill periodically and after changing the backup
format or encryption settings:

```bash
sudo install -m 0750 deploy/backup/postgres-restore-drill.sh /usr/local/sbin/titop-arenda-postgres-restore-drill
sudo /usr/local/sbin/titop-arenda-postgres-restore-drill
```

The drill downloads the latest encrypted object, verifies both checksum
layers, decrypts it, restores both dumps into uniquely named temporary
databases, verifies that the restored schemas are non-empty, and removes the
temporary databases and files. It never restores over a production database.

Install the monthly restore timer and GlitchTip failure reporter:

```bash
sudo install -m 0750 deploy/backup/glitchtip-systemd-alert.sh /usr/local/sbin/titop-arenda-glitchtip-alert
sudo install -m 0644 deploy/systemd/titop-arenda-restore-drill.service /etc/systemd/system/
sudo install -m 0644 deploy/systemd/titop-arenda-restore-drill.timer /etc/systemd/system/
sudo install -m 0644 deploy/systemd/titop-arenda-backup-alert@.service /etc/systemd/system/
sudo install -m 0644 deploy/systemd/titop-arenda-backup.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now titop-arenda-restore-drill.timer
```

The drill runs on the first day of each month after the daily backup window.
Backup and restore services share a maintenance lock. A failed monthly drill
posts a metadata-only event to the backend GlitchTip project; no dump content,
credentials, or personal data is included.

## Telegram alerts from GlitchTip

Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and a random 32-byte
`GLITCHTIP_TELEGRAM_WEBHOOK_SECRET` in `deploy/.env.production`. The API then
exposes an authenticated GlitchTip-to-Telegram bridge. Configure this Generic
Webhook recipient in each GlitchTip project alert:

```text
https://arenda.wigaj.ru/internal/webhooks/glitchtip/telegram?token=<webhook-secret>
```

GlitchTip rejects private webhook targets, so the callback uses the public
HTTPS endpoint. The exact Nginx location disables access logging to keep the
query-string secret out of proxy logs, and the API removes the token before its
own request logger runs. The bridge accepts at most 64 KiB of JSON, safely
formats structured Telegram HTML, and returns `502` on Telegram delivery
failure. Such failures are logged but deliberately not recaptured by GlitchTip
to avoid an alert recursion loop.

## Temporary RuStore reviewer login

Create a clean email-only account once after PostgreSQL is running:

```bash
sh deploy/scripts/create-review-account.sh review@wigaj.ru
```

The script is idempotent. It creates no phone, admin role, listings, bookings,
chats, or legal-consent records. Configure its temporary login credential only
in `deploy/.env.production`:

```dotenv
REVIEW_AUTH_ENABLED=true
REVIEW_AUTH_EMAIL=review@wigaj.ru
REVIEW_AUTH_CODE=<random-six-digits>
REVIEW_AUTH_EXPIRES_AT=2026-09-15T00:00:00Z
```

The fixed code is accepted only by the normal email-login request for that
exact existing account. It is bcrypt-hashed into the regular `auth_code` row
and keeps the standard ten-minute TTL, one-time consumption, resend cooldown,
and five-attempt budget. It is not returned by the API, sent by email, accepted
for administrator login, or accepted while changing another account's email.
After `REVIEW_AUTH_EXPIRES_AT`, requests automatically return to ordinary email
delivery. Remove the code from RuStore moderator instructions and set
`REVIEW_AUTH_ENABLED=false` after review.

## Admin authentication foundation

The static operator panel and its Nginx same-origin proxy are deployed using
[`ADMIN_PANEL_DEPLOY.md`](ADMIN_PANEL_DEPLOY.md).

Migration `000050_admin_foundation` creates a separate administrator roster,
opaque browser sessions, and an append-only action journal. Migration
`000051_reversible_admin_sanctions` stores active report sanctions and the
bounded previous state required for an audited rollback. The operator API is
mounted at `/api/admin/v1`; it does not accept mobile JWTs and does not inherit
the mobile minimum-version gate. Configure the exact browser origin and session
limits in `deploy/.env.production`:

```dotenv
ADMIN_PUBLIC_URL=https://admin.wigaj.ru
ADMIN_SESSION_TTL=8h
ADMIN_IDLE_TTL=30m
```

There is intentionally no public bootstrap endpoint. After migrations have
run, grant the first owner role to an existing account with a verified
corporate email:

```bash
sudo docker compose --env-file deploy/.env.production -f deploy/compose.production.yml \
  exec -T -e ADMIN_BOOTSTRAP_EMAIL=owner@wigaj.ru postgres sh -lc \
  'psql -U "$APP_DB_USER" -d "$APP_DB_NAME" -v ON_ERROR_STOP=1 -v admin_email="$ADMIN_BOOTSTRAP_EMAIL"' <<'SQL'
INSERT INTO admin_account (user_id, role)
SELECT id, 'owner'
FROM "user"
WHERE lower(email) = lower(:'admin_email') AND deleted = false
ON CONFLICT (user_id) DO UPDATE
SET role = EXCLUDED.role, enabled = true, updated_at = now();
SQL
```

Admin login codes use the dedicated `admin_email` OTP channel, so they cannot
be replayed as normal application login codes. The session cookie is host-only,
`HttpOnly`, `Secure`, and `SameSite=Strict`; state-changing requests additionally
require `X-CSRF-Token` and the exact configured `Origin`.

The authenticated operator inbox is available at:

```text
GET /api/admin/v1/inbox/summary
GET /api/admin/v1/inbox?kind=<kind>&limit=20&offset=0
GET /api/admin/v1/inbox/<kind>/<id>
GET /api/admin/v1/inbox/<kind>/<id>/media/<media-id>
POST /api/admin/v1/inbox/<kind>/<id>/actions
GET /api/admin/v1/search?kind=<user|listing|review|message>&q=<exact-value>
GET /api/admin/v1/search/<kind>/<id>
GET /api/admin/v1/search/<kind>/<id>/media/<media-id>
GET /api/admin/v1/audit?action=<prefix>&limit=50&offset=0
GET /api/admin/v1/staff
POST /api/admin/v1/staff
PATCH /api/admin/v1/staff/<id>
```

Supported kinds are `report`, `listing`, `review`, `review_reply`, and
`attachment`. The inbox reads the existing source queues instead of copying
their rows. `support` accounts can read reports only; `moderator` and `owner`
accounts can additionally read listings and reviews in `moderation_review` and
chat attachments whose automatic check exhausted its retry budget.

The separate exact-search API does not add items to the queue. User lookup
accepts a complete ID, normalized phone number, or email; object lookup accepts
only a numeric ID. Search detail includes closed reports and both active and
revoked sanctions even when no complaint is currently actionable. Support may
search only bounded user diagnostics. Listing, review, message content, and
related media remain restricted to moderator and owner roles.

The action endpoint requires the admin CSRF header. Report resolution accepts
`{"action":"resolve","reason":"...","sanctions":[...]}` with at most one
content sanction and an optional `disable_user`. Support can update report
status but cannot apply sanctions. Moderator/owner can later send
`{"action":"revoke_sanctions","reason":"...","sanction_ids":[...]}` for the
active sanctions returned by the report detail. Revoking account disablement
restores account visibility and access, but deliberately does not resurrect
previous refresh or administrator sessions. Direct moderation actions remain
`approve`/`reject` for listings, reviews, and review replies. Failed attachments
expose only `retry`: an infrastructure failure is not evidence that media is
safe, so the admin API deliberately has no manual approve shortcut.

Every source-row change and its `admin_audit_log` entry commit in one database
transaction. Conflicting concurrent decisions return HTTP 409. Listing/review
decisions also publish the normal private user event, while attachment retries
wake the media worker immediately.

Hiding a reported message now retains its original database row and attachment
metadata as moderation evidence. Participant-facing reads return only a deleted
message tombstone; the content is available exclusively through the authorized
admin evidence path and remains subject to the configured retention policy.

When `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are configured, the same bot
used by the GlitchTip bridge sends compact alerts for new reports, new manual
listing/review items, and exhausted attachment checks. The message contains no
captured evidence or contact data; those remain available only in the
authenticated operator panel. `ADMIN_PUBLIC_URL` is included as the panel link.
The link contains the queue kind and source-row ID, for example
`https://admin.wigaj.ru/?kind=review&id=42`. After OTP authentication the panel
selects the matching queue and opens that item directly.

The owner-only audit endpoint returns the actor, action, target, reason,
request metadata, and timestamp from the append-only `admin_audit_log`. The
panel paginates this history and can filter it by an action prefix such as
`admin_inbox` or `admin.staff`.

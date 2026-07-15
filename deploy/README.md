# Titop Arenda production deployment

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

## Nginx and TLS

Install host Nginx and Certbot, copy `nginx/titop-arenda.conf` to
`/etc/nginx/sites-available/titop-arenda`, symlink it into `sites-enabled`,
then validate with `sudo nginx -t` and reload Nginx. Issue certificates only
after both DNS records resolve to the VPS:

```bash
sudo certbot --nginx -d arenda.titop.ru -d errors.titop.ru
```

## Health checks

```bash
curl -fsS http://127.0.0.1:8080/healthz
curl -fsS https://arenda.titop.ru/healthz
```

## Updates

Review release notes before changing major image tags. For routine application
updates, pull the repository, then run the same `docker compose up -d --build`
command. The API migration service applies pending additive migrations before
the API is allowed to start. GlitchTip manages its own migrations on startup.

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

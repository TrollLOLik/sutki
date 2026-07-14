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

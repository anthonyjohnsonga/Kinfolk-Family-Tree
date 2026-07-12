# Kinfolk Family Tree

Kinfolk is a private, self-hosted family tree application. It uses a React and TypeScript frontend, a Fastify and TypeScript API, and PostgreSQL for persistent server-side storage.

## Architecture

- **Frontend:** React, TypeScript, and Vite, served by Nginx
- **API:** Fastify and TypeScript
- **Database:** PostgreSQL
- **Database access:** Prisma ORM and tracked SQL migrations
- **Deployment:** Docker Compose

Family information is stored in PostgreSQL on the Docker host. The database is available only to services on the private Compose network and is not published as a host port.

Kinfolk requires an administrator login. On the first visit, the application prompts you to create the initial administrator; after that, all family-tree API routes require an authenticated session.

## Deploy with Docker Compose

Docker with the Compose plugin is required.

1. Create the deployment environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Edit `.env` and replace `POSTGRES_PASSWORD` with a long, unique, URL-safe password using letters, numbers, `_`, and `-`. The `.env` file is ignored by Git.

3. Build and start the complete application:

   ```powershell
   docker compose up --build -d
   ```

4. Open <http://localhost:8080>. Change `KINFOLK_PORT` in `.env` if port 8080 is unavailable.

5. Create the first administrator account when prompted. Use a unique password of at least 12 characters and store it in a password manager. There is no password-recovery workflow yet.

Compose starts PostgreSQL, waits for it to become healthy, applies database migrations, starts the API, and then starts the frontend.

## Operations

View service status and logs:

```powershell
docker compose ps
docker compose logs -f
```

Stop the application without deleting its database:

```powershell
docker compose down
```

The `kinfolk_db` Docker volume stores the database. Do not use `docker compose down --volumes` unless you intend to permanently delete all stored trees.

## Storage options

The default deployment uses the Docker-managed `kinfolk_db` volume. This remains the recommended general-purpose configuration.

### Local host directory for PostgreSQL

To place the live database in a specific local directory, set `KINFOLK_DB_PATH` in `.env`. The directory must be an existing absolute path on the Docker host and writable by the PostgreSQL container.

On Linux:

```bash
sudo mkdir -p /srv/kinfolk/database
sudo chown 999:999 /srv/kinfolk/database
docker compose -f compose.yaml -f compose.storage-bind.yaml up --build -d
```

Do not point `KINFOLK_DB_PATH` at an SMB share. For direct NFS database storage, follow PostgreSQL's NFS requirements, including a `hard` client mount and a synchronous server export. A local database with NAS-hosted backups is safer for most installations.

## Automated backups

Set `KINFOLK_BACKUP_PATH` to an existing local directory or a NAS share already mounted on the Docker host:

```bash
sudo mkdir -p /srv/kinfolk/backups
docker compose -f compose.yaml -f compose.backup.yaml up --build -d
```

The backup service:

- creates a compressed PostgreSQL custom-format dump immediately at startup;
- repeats according to `BACKUP_INTERVAL_SECONDS` (24 hours by default);
- keeps dumps for `BACKUP_RETENTION_DAYS` (30 days by default);
- writes `.partial` files until a dump succeeds;
- stores only completed files as `kinfolk-YYYYMMDDTHHMMSSZ.dump`.

For SMB, mount the share on the host first and use that mounted directory as `KINFOLK_BACKUP_PATH`. For example, mount it at `/mnt/kinfolk-backups`, verify the Docker host can write to it, then set:

```text
KINFOLK_BACKUP_PATH=/mnt/kinfolk-backups
```

This keeps SMB credentials out of Compose and `.env`.

### Direct NFS backup volume

Set `KINFOLK_NFS_ADDR` and `KINFOLK_NFS_EXPORT` in `.env`, then start all three Compose files:

```bash
docker compose \
  -f compose.yaml \
  -f compose.backup.yaml \
  -f compose.backup-nfs.yaml \
  up --build -d
```

The NFS override uses NFSv4 with a hard mount. Ensure the NFS server export allows writes from the Docker host.

### Restore a backup

List available dumps:

```bash
docker compose -f compose.yaml -f compose.backup.yaml exec backup ls -lh /backups
```

Stop application writes, run the one-time restore, and restart the services:

```bash
docker compose -f compose.yaml -f compose.backup.yaml stop frontend api backup
docker compose -f compose.yaml -f compose.backup.yaml run --rm --no-deps \
  --entrypoint sh backup /scripts/restore.sh /backups/kinfolk-TIMESTAMP.dump
docker compose -f compose.yaml -f compose.backup.yaml up -d
```

Test backup restoration periodically. A backup should not be considered reliable until it has been restored successfully.

## Local development

Install dependencies:

```powershell
npm install
```

Start PostgreSQL through Compose, then run the API and web development servers in separate terminals:

```powershell
npm run dev:api
npm run dev:web
```

The Vite server runs at <http://localhost:5173> and proxies API calls to port 3000.

## Current features

- Create, list, and open server-stored family trees
- Add, edit, and delete people
- Connect up to two parents and render multiple generations
- Connect couples with partnership status and marriage dates
- Add full, half, step, adopted, and general sibling relationships
- Customize and persist each tree's style and colors
- Protect all family data with first-run administrator setup and expiring server sessions

## Privacy

- No personal family information or example records are committed.
- `.env`, exported `*.kinfolk.json` files, and `family-tree-data/` are ignored by Git.
- PostgreSQL is not exposed outside the Compose network.
- Passwords use salted `scrypt` hashes; raw passwords and session tokens are never stored in the database.
- Authentication uses HTTP-only, SameSite Strict cookies backed by hashed, expiring server sessions.
- Review [CONTRIBUTING.md](CONTRIBUTING.md) before every commit and push.

## Authentication settings

`SESSION_DAYS` controls session lifetime and defaults to seven days. `COOKIE_SECURE` must remain `false` for plain internal HTTP. Set it to `true` when Kinfolk is served through HTTPS; secure cookies are not transmitted over plain HTTP.

Authentication protects access to the application, but HTTPS is still required before exposing Kinfolk outside a trusted internal network.

## Releases

See [RELEASE.md](RELEASE.md) for the release-candidate gates and tagging process and [CHANGELOG.md](CHANGELOG.md) for notable changes. Git tags publish versioned frontend and API images to GitHub Container Registry and create a GitHub release automatically.

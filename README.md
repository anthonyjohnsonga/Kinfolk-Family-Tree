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

4. Open <http://localhost:3040>. Change `KINFOLK_PORT` in `.env` if port 3040 is unavailable.

5. Create the first administrator account when prompted. Use a unique password of at least 12 characters and store it in a password manager. There is no password-recovery workflow yet.

Compose starts PostgreSQL, waits for it to become healthy, applies database migrations, starts the API, and then starts the frontend.

## Production deployment from release images

`compose.production.yaml` pulls versioned application images from GitHub Container Registry instead of building source on the server. It also requires explicit host storage and allows the configuration file to live outside the repository.

Create the host directories and configuration location:

```bash
sudo mkdir -p /srv/kinfolk/database/postgres /srv/kinfolk/database/backups /srv/kinfolk/configure
sudo chown 999:999 /srv/kinfolk/database/postgres
sudo chown "$(id -u):$(id -g)" /srv/kinfolk/database/backups
sudo cp deploy/kinfolk.env.example /srv/kinfolk/configure/kinfolk.env
sudo chown root:root /srv/kinfolk/configure/kinfolk.env
sudo chmod 600 /srv/kinfolk/configure/kinfolk.env
sudo nano /srv/kinfolk/configure/kinfolk.env
```

Set a real password, the desired release in `KINFOLK_VERSION`, and absolute storage paths. Start the release deployment:

```bash
sudo docker compose \
  --env-file /srv/kinfolk/configure/kinfolk.env \
  -f compose.production.yaml \
  pull

sudo docker compose \
  --env-file /srv/kinfolk/configure/kinfolk.env \
  -f compose.production.yaml \
  up -d
```

The production services use three release images:

- `kinfolk-family-tree-web`
- `kinfolk-family-tree-api`
- `kinfolk-family-tree-migrate`

The dedicated migration image is available beginning with release `v0.0.2`; earlier releases must use the source-build Compose deployment.

The migration container runs to completion before the API starts. `docker compose ps -a` should show `migrate` exited successfully and the other services running or healthy.

### Pull-based updates

Back up the database, edit `/srv/kinfolk/configure/kinfolk.env` to the new release number, then run:

```bash
sudo docker compose --env-file /srv/kinfolk/configure/kinfolk.env -f compose.production.yaml pull
sudo docker compose --env-file /srv/kinfolk/configure/kinfolk.env -f compose.production.yaml up -d
sudo docker compose --env-file /srv/kinfolk/configure/kinfolk.env -f compose.production.yaml ps -a
```

Application containers are replaced while PostgreSQL remains under `KINFOLK_ROOT_PATH/database/postgres` and configuration remains under `KINFOLK_ROOT_PATH/configure`.

### Production backups

Add the backup Compose layer while keeping the same external configuration:

```bash
sudo docker compose \
  --env-file /srv/kinfolk/configure/kinfolk.env \
  -f compose.production.yaml \
  -f compose.backup.yaml \
  up -d
```

Backups are stored under `KINFOLK_ROOT_PATH/database/backups`. An SMB share may be mounted at that directory on the host. Add `-f compose.backup-nfs.yaml` for the direct NFS backup volume.

### Rollback

Set `KINFOLK_VERSION` back to a previously published version, then run `pull` and `up -d` again. Application rollback does not reverse database migrations. If a release introduced an incompatible migration, restore the database backup taken before that update.

If GHCR packages are not public, authenticate the server before pulling:

```bash
echo "$GITHUB_PAT" | sudo docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

Use a fine-grained token with read-only package access and do not store it in the Kinfolk environment file.

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

To place all persistent Kinfolk files under a specific parent directory, set `KINFOLK_ROOT_PATH` in the environment file. The required subdirectories must exist on the Docker host, and the PostgreSQL directory must be writable by the container.

On Linux:

```bash
sudo mkdir -p /srv/kinfolk/database/postgres /srv/kinfolk/database/backups /srv/kinfolk/configure
sudo chown 999:999 /srv/kinfolk/database/postgres
docker compose -f compose.yaml -f compose.storage-bind.yaml up --build -d
```

Do not mount an SMB share at `database/postgres`. For direct NFS database storage, follow PostgreSQL's NFS requirements, including a `hard` client mount and a synchronous server export. A local database with NAS-hosted backups is safer for most installations.

## Automated backups

Create the backup subdirectory locally or mount a NAS share at that location on the Docker host:

```bash
sudo mkdir -p /srv/kinfolk/database/backups
docker compose -f compose.yaml -f compose.backup.yaml up --build -d
```

The backup service:

- creates a compressed PostgreSQL custom-format dump immediately at startup;
- repeats according to `BACKUP_INTERVAL_SECONDS` (24 hours by default);
- keeps dumps for `BACKUP_RETENTION_DAYS` (30 days by default);
- writes `.partial` files until a dump succeeds;
- stores only completed files as `kinfolk-YYYYMMDDTHHMMSSZ.dump`.

For SMB, mount the share on the host directly at the Kinfolk backup subdirectory and verify the Docker host can write to it:

```text
/srv/kinfolk/database/backups
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

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

## Standalone server deployment with release images

This is the recommended approach for a server that should pull published Kinfolk images instead of cloning or building the application source. The example below keeps the Compose file, private environment file, PostgreSQL data, and backup directory under the sample root `/opt/kinfolk`. Replace that path everywhere if you prefer another absolute directory.

The final layout is:

```text
/opt/kinfolk/
├── compose.yaml
├── .env
└── database/
    ├── postgres/
    └── backups/
```

### 1. Create the directories

```bash
sudo mkdir -p /opt/kinfolk/database/postgres /opt/kinfolk/database/backups
sudo chown "$(id -u):$(id -g)" /opt/kinfolk /opt/kinfolk/database /opt/kinfolk/database/backups
sudo chown 999:999 /opt/kinfolk/database/postgres
cd /opt/kinfolk
```

PostgreSQL runs as user ID `999` in the published container, so its host data directory must be writable by that user. Keep `database/postgres` on reliable local storage. A mounted NAS share is better suited to `database/backups` than to the live PostgreSQL directory.

### 2. Create `compose.yaml`

Place this file at `/opt/kinfolk/compose.yaml`:

```yaml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - /opt/kinfolk/database/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  migrate:
    image: ghcr.io/anthonyjohnsonga/kinfolk-family-tree-migrate:${KINFOLK_VERSION}
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
    depends_on:
      db:
        condition: service_healthy
    restart: "no"

  api:
    image: ghcr.io/anthonyjohnsonga/kinfolk-family-tree-api:${KINFOLK_VERSION}
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      PORT: 3000
      SESSION_DAYS: ${SESSION_DAYS}
      COOKIE_SECURE: ${COOKIE_SECURE}
    depends_on:
      migrate:
        condition: service_completed_successfully
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://127.0.0.1:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  frontend:
    image: ghcr.io/anthonyjohnsonga/kinfolk-family-tree-web:${KINFOLK_VERSION}
    ports:
      - "3040:80"
    depends_on:
      api:
        condition: service_healthy
    restart: unless-stopped
```

If you use a root other than `/opt/kinfolk`, update the database volume's host path. Change `3040` only if you want to expose Kinfolk on a different host port.

### 3. Create `.env`

Place `.env` beside `compose.yaml` at `/opt/kinfolk/.env`. Compose loads it automatically when commands are run from this directory.

Generate a URL-safe database password:

```bash
openssl rand -hex 32
```

Create `.env`, replacing the example password with the generated value:

```dotenv
KINFOLK_VERSION=0.0.5

POSTGRES_DB=kinfolk
POSTGRES_USER=kinfolk
POSTGRES_PASSWORD=replace_with_the_generated_password

SESSION_DAYS=7
COOKIE_SECURE=false
```

Do not commit `.env`. Protect it so only its owner can read it:

```bash
chmod 600 /opt/kinfolk/.env
```

Use a hexadecimal password as shown above. Characters with special meaning in a database URL can break `DATABASE_URL` unless they are percent-encoded. Keep `COOKIE_SECURE=false` for plain internal HTTP; set it to `true` when Kinfolk is served through HTTPS.

### 4. Pull and start Kinfolk

```bash
cd /opt/kinfolk
docker compose config --quiet
docker compose pull
docker compose up -d
docker compose ps -a
```

Open `http://SERVER-IP:3040` and create the first administrator when prompted. A healthy deployment shows `db`, `api`, and `frontend` running or healthy. The `migrate` service should show `Exited (0)` after it successfully applies the database migrations; it is not intended to remain running.

View logs when troubleshooting:

```bash
docker compose logs --tail=200
```

### Upgrade to a newer release

Back up the database before every upgrade. At minimum, create a PostgreSQL dump in the persistent backup directory:

```bash
cd /opt/kinfolk
docker compose exec -T db sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > database/backups/before-upgrade.dump
ls -lh database/backups/before-upgrade.dump
```

Confirm the dump is non-empty. Then edit `/opt/kinfolk/.env` and change only `KINFOLK_VERSION` to the desired published version, for example:

```dotenv
KINFOLK_VERSION=0.0.5
```

Pull and apply the update:

```bash
cd /opt/kinfolk
docker compose config --quiet
docker compose pull
docker compose up -d
docker compose ps -a
```

Compose replaces the application containers, preserves PostgreSQL under `/opt/kinfolk/database/postgres`, and runs the release's migrations before starting the API. Verify login and family-tree data after the upgrade.

To roll back application images, restore the previous `KINFOLK_VERSION` and run `docker compose pull` followed by `docker compose up -d`. Database migrations are not automatically reversed, so restore the pre-upgrade database dump if the newer release introduced an incompatible migration.

To stop Kinfolk without deleting its data:

```bash
docker compose down
```

Do not add `--volumes` and do not delete `/opt/kinfolk/database/postgres` unless you intentionally want to erase every stored family tree and account.

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

### Move an existing source-build installation

Switching from the original Docker-managed volume to `compose.production.yaml` changes PostgreSQL's storage location. Move the data with a logical backup; do not simply start the production file and assume the old volume is being used.

Create the new layout and dump the currently running database:

```bash
sudo mkdir -p /srv/kinfolk/database/postgres /srv/kinfolk/database/backups /srv/kinfolk/configure
sudo chown 999:999 /srv/kinfolk/database/postgres
sudo chown "$(id -u):$(id -g)" /srv/kinfolk/database/backups

docker compose exec -T db sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > /srv/kinfolk/database/backups/before-production-move.dump
```

Confirm the dump is non-empty, stop the old stack without deleting its volume, prepare `kinfolk.env`, and start the production stack:

```bash
ls -lh /srv/kinfolk/database/backups/before-production-move.dump
docker compose down

sudo cp deploy/kinfolk.env.example /srv/kinfolk/configure/kinfolk.env
sudo chmod 600 /srv/kinfolk/configure/kinfolk.env
sudo nano /srv/kinfolk/configure/kinfolk.env

sudo docker compose --env-file /srv/kinfolk/configure/kinfolk.env -f compose.production.yaml pull
sudo docker compose --env-file /srv/kinfolk/configure/kinfolk.env -f compose.production.yaml up -d
```

Stop application writes, restore the dump into the new database directory, and restart:

```bash
sudo docker compose --env-file /srv/kinfolk/configure/kinfolk.env -f compose.production.yaml stop frontend api

cat /srv/kinfolk/database/backups/before-production-move.dump | \
  sudo docker compose --env-file /srv/kinfolk/configure/kinfolk.env -f compose.production.yaml \
  exec -T db sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges'

sudo docker compose --env-file /srv/kinfolk/configure/kinfolk.env -f compose.production.yaml up -d
```

Verify login and family-tree data before removing the old Docker volume. Keep the dump until the migration has been tested thoroughly.

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
- View person details and record birth/death places and structured life events
- Connect up to two parents and render multiple generations
- Pan, zoom, and focus the tree on one person's direct family
- Search every person by name, maiden name, or place and jump to their details
- Connect couples with partnership status and marriage dates, including divorces, widowhood, and remarriages
- Add full, half, step, adopted, and general sibling relationships
- Customize and persist each tree's style and colors from the Settings area
- Export trees as GEDCOM 5.5.1 files and import GEDCOM files as new trees
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

See [ROADMAP.md](ROADMAP.md) for planned features, [RELEASE.md](RELEASE.md) for release gates and tagging, and [CHANGELOG.md](CHANGELOG.md) for notable changes. Git tags publish versioned frontend, API, and migration images to GitHub Container Registry and create a GitHub release automatically.

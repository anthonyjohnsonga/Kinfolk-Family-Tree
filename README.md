# Kinfolk Family Tree

Kinfolk is a private, self-hosted family tree application. It uses a React and TypeScript frontend, a Fastify and TypeScript API, and PostgreSQL for persistent server-side storage.

## Architecture

- **Frontend:** React, TypeScript, and Vite, served by Nginx
- **API:** Fastify and TypeScript
- **Database:** PostgreSQL
- **Database access:** Prisma ORM and tracked SQL migrations
- **Deployment:** Docker Compose

Family information is stored in PostgreSQL on the Docker host. The database is available only to services on the private Compose network and is not published as a host port.

> The current foundation does not include user authentication yet. Deploy it only on a trusted internal network until authentication is added.

## Deploy with Docker Compose

Docker with the Compose plugin is required.

1. Create the deployment environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Edit `.env` and replace `POSTGRES_PASSWORD` with a long, unique password. The `.env` file is ignored by Git.

3. Build and start the complete application:

   ```powershell
   docker compose up --build -d
   ```

4. Open <http://localhost:8080>. Change `KINFOLK_PORT` in `.env` if port 8080 is unavailable.

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

## Current migration status

The server-backed foundation currently supports creating, listing, and opening family trees and adding people. The PostgreSQL schema already includes parent, partnership, marriage, sibling, and per-tree theme relationships. The richer relationship editor and visual layout from the original browser-only prototype will be migrated onto these API models next.

## Privacy

- No personal family information or example records are committed.
- `.env`, exported `*.kinfolk.json` files, and `family-tree-data/` are ignored by Git.
- PostgreSQL is not exposed outside the Compose network.
- Review [CONTRIBUTING.md](CONTRIBUTING.md) before every commit and push.

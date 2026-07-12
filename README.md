# Kinfolk

A private, local-first family tree builder that runs entirely in the browser. The repository contains no personal or sample family information.

## Run it

Open `index.html` in a modern browser. No install or build step is required.

For a local development server, run:

```powershell
python -m http.server 8080
```

Then visit `http://localhost:8080`.

## Run with Docker Compose

Docker Desktop or another Docker installation with Compose is required.

Build and start Kinfolk:

```powershell
docker compose up --build -d
```

Open <http://localhost:8080>. To use another host port, set `KINFOLK_PORT` before starting:

```powershell
$env:KINFOLK_PORT = 3000
docker compose up --build -d
```

View status and logs:

```powershell
docker compose ps
docker compose logs -f kinfolk
```

Stop the application:

```powershell
docker compose down
```

Family trees remain in each visitor's browser storage; the container does not receive or persist that information.

## Features

- Home page for creating or reopening trees
- Guided new-tree setup
- Manage multiple trees on one device
- Add, edit, search, and remove family members
- Connect up to two parents per person across unlimited generations
- Record spouse or partner relationships and marriage dates
- Add full, half, step, adopted, and general sibling connections
- Customize each tree's botanical background, colors, and visual style
- Automatic generation layout
- Browser-local persistence
- Portable JSON import and export
- Responsive interface

Each tree stays in the browser's `localStorage`. Use **Export** to create a portable `.kinfolk.json` backup and **Import a tree file** on the home page to open that backup on another device. Exported tree files are ignored by Git to help prevent test family information from being committed. Clearing browser site data removes locally saved trees.

## GitHub Pages

The project has no build step and can be published directly with GitHub Pages. In the repository settings, choose **Pages**, select **Deploy from a branch**, and publish the repository's root directory.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the project's commit, privacy-check, and push process.

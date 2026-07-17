# Changelog

All notable changes to Kinfolk will be documented in this file. The project follows semantic versioning once a release tag is published.

## Unreleased

### Added

- Print the tree as a poster — or save it as a PDF — from Settings, automatically scaled to fit one landscape page with the tree name and date. Focusing the tree first prints just that person's branch.

## [0.0.6] - 2026-07-16

### Added

- Navigate the tree like a canvas: drag to pan, zoom with the mouse wheel or on-screen controls, and reset the view with one click.
- Focus the tree on one person from their details view, showing only their ancestors, descendants, and immediate partners, with a banner to return to the full tree.
- Find anyone instantly with the new people index: search by name, maiden name, or place from the toolbar (or Ctrl/Cmd+K) and jump straight to a person's details.
- Answer "how are we related?" with the relationship calculator in every person's details view: pick any other person to see the connection, from parents and half-siblings to second cousins once removed, including the shared ancestor.
- Give every family member their own account: administrators manage users from the new Users tab in Settings, editors can change family data, and viewers get read-only access. The server enforces roles on every request, keeps at least one administrator at all times, and signs a user out everywhere when their password is changed.
- Change your own password from the new Account tab in Settings; the current device stays signed in while every other session is signed out.

### Security

- Rate-limit sign-in, first-run setup, and password changes to slow down password guessing, using the real client address behind the bundled reverse proxy.

## [0.0.5] - 2026-07-15

### Added

- Record divorces and remarriages: each person can now have multiple partnerships with partnered, married, divorced, or widowed status plus marriage and divorce dates. Former partnerships appear in person details and the life timeline, while only current couples are drawn side by side in the tree.
- Add a Settings area in the top-right toolbar that now hosts the tree design controls alongside a new export and import section.
- Export any tree as a GEDCOM 5.5.1 file, including people, parent and sibling relationships, partnerships with marriage and divorce dates, and life events. Kinfolk-specific details use custom GEDCOM tags so they survive a round trip.
- Import a GEDCOM file as a new tree from the Settings area or directly from the home screen, without changing existing trees and accepting files from Kinfolk and other genealogy software.

### Changed

- Add unit tests for relationship synchronization rules, tree layout calculations, and GEDCOM export/import round trips, and run them in continuous integration.
- Split the API server and React application entry points into focused route, component, type, query, schema, formatting, and utility modules to make the codebase easier to review and maintain without changing user-facing behavior.
- Add a pinned Prettier configuration and formatting commands, format the API and web source consistently, and enforce the formatting check in continuous integration.
- Share API request and response type definitions with the web application through an exported contract module, reducing the risk of client and server types drifting apart.
- Extract generation grouping and family connector calculations into a dedicated layout module so tree-rendering logic is easier to maintain and test without changing its output.

## [0.0.4] - 2026-07-13

### Fixed

- Group children by their parent set and draw one shared family connector, preventing stacked lines for siblings.
- Manage multiple sibling connections, including changing relationship types and removing individual siblings.
- Keep marriage status and saved marriage dates visible on couple connections at every screen size.

### Added

- Add person detail views with birth/death locations and a structured life-event timeline.

### Documentation

- Add a persistent feature roadmap and an automated release preflight command.

## [0.0.3] - 2026-07-13

### Fixed

- Draw a single joined child connector for two-parent relationships instead of overlapping paths.
- Show saved sibling relationships in the tree and keep connected siblings on the same generation.

### Added

- Store and display an optional maiden or birth surname for each person.
- Switch between existing trees or start a new tree from the signed-in toolbar.

### Documentation

- Add a standalone, pull-based Docker Compose installation and upgrade guide.

## [0.0.2] - 2026-07-12

### Fixed

- Omit partnership status when adding or editing a person without a selected partner.

### Changed

- Use host port 3040 as the default for source-build and production deployments.

### Added

- Pull-based production Compose deployment using versioned GHCR images.
- Dedicated release image for applying database migrations.
- External production configuration files and configurable database paths.
- Unified persistent folder layout under one configurable Kinfolk root.

## [0.0.1] - 2026-07-12

### Added

- React and TypeScript family-tree interface
- Fastify and TypeScript server API
- PostgreSQL persistence with Prisma migrations
- Parent, couple, marriage, sibling, and generational relationships
- Customizable tree designs
- First-run administrator setup and database-backed sessions
- Docker Compose deployment with health checks
- Optional bind-mounted database storage
- Scheduled PostgreSQL backups, retention, NFS support, and restore tooling
- Loading, offline, empty, and error states
- CI, container publishing, provenance attestations, and release automation

### Security

- Salted `scrypt` password hashes
- Hashed, expiring session tokens and HTTP-only SameSite cookies
- Private PostgreSQL Compose network
- Git exclusions for secrets, exports, database dumps, and personal test data

## Release naming

- `v0.0.1`: first stable release
- `v0.1.0-rc.1`: initial release candidate used to validate publishing automation

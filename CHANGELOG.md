# Changelog

All notable changes to Kinfolk will be documented in this file. The project follows semantic versioning once a release tag is published.

## Unreleased

No changes yet.

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

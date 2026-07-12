# Changelog

All notable changes to Kinfolk will be documented in this file. The project follows semantic versioning once a release tag is published.

## Unreleased

No changes yet.

## [0.1.0-rc.1] - 2026-07-12

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

- `v0.1.0-rc.1`: first planned release candidate
- `v0.1.0`: first planned stable release after candidate validation

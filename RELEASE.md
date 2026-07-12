# Release Process

The current stable release is `v0.0.1`. Do not create a new stable tag until every required release gate below passes on a clean Docker host.

## Release gates

- [ ] Clone the repository into a new directory on an Ubuntu Docker host.
- [ ] Copy `.env.example` to `.env` and set a unique URL-safe database password.
- [ ] Run `docker compose up --build -d` successfully.
- [ ] Confirm every service becomes healthy with `docker compose ps`.
- [ ] Complete first-run administrator setup.
- [ ] Log out and log back in.
- [ ] Confirm unauthenticated API requests receive HTTP 401.
- [ ] Create a tree with parents, a single parent, a couple, marriage date, and siblings.
- [ ] Restart the Compose stack and confirm all data persists.
- [ ] Verify the local bind-mount deployment override.
- [ ] Create a scheduled backup and verify no `.partial` file remains.
- [ ] Restore that backup successfully and confirm the tree data.
- [ ] Verify the NFS or host-mounted SMB backup destination, if used.
- [ ] Run `npm ci`, `npm run typecheck`, and `npm run build` successfully.
- [ ] Confirm the GitHub `Continuous integration` workflow passes on `main`.
- [ ] Review `CHANGELOG.md` and move release entries from `Unreleased` to the release version.
- [ ] Confirm the working tree is clean and `main` matches `origin/main`.
- [ ] Confirm the release commit author and committer are both `anthonyjohnsonga`.

## Cut a release

After every gate passes:

```bash
git switch main
git pull --ff-only origin main
VERSION=v0.0.2
git tag -a "$VERSION" -m "Kinfolk $VERSION"
git push origin "$VERSION"
```

Pushing the tag triggers `.github/workflows/release.yaml`. It publishes:

- `ghcr.io/anthonyjohnsonga/kinfolk-family-tree-web:<version>`
- `ghcr.io/anthonyjohnsonga/kinfolk-family-tree-api:<version>`
- `ghcr.io/anthonyjohnsonga/kinfolk-family-tree-migrate:<version>`
- a GitHub release with generated notes;
- provenance attestations for both container images.

## Verify published artifacts

```bash
gh attestation verify \
  oci://ghcr.io/anthonyjohnsonga/kinfolk-family-tree-web:0.0.2 \
  -R anthonyjohnsonga/Kinfolk-Family-Tree

gh attestation verify \
  oci://ghcr.io/anthonyjohnsonga/kinfolk-family-tree-api:0.0.2 \
  -R anthonyjohnsonga/Kinfolk-Family-Tree

gh attestation verify \
  oci://ghcr.io/anthonyjohnsonga/kinfolk-family-tree-migrate:0.0.2 \
  -R anthonyjohnsonga/Kinfolk-Family-Tree
```

If the workflow fails before a release is published, correct the problem and use a new version tag. Do not move or overwrite a published release tag.

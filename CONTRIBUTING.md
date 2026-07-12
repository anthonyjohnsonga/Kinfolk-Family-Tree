# Commit and Push Process

This repository is maintained through Codex and GitHub under the account `anthonyjohnsonga`.

## Author identity

All commits must use the repository-local identity:

```text
Name: anthonyjohnsonga
Email: 10941589+anthonyjohnsonga@users.noreply.github.com
```

Verify it before committing:

```powershell
git config user.name
git config user.email
```

## Privacy check

Family information entered in the application is stored in the browser's `localStorage`; it is not stored in the source files.

Before every commit:

1. Review `git status --short`.
2. Review the diff with `git diff` and `git diff --staged`.
3. Do not stage exported family trees or files containing personal test information.
4. Confirm no credentials, tokens, private email addresses, or personal family records are present.

Files ending in `.kinfolk.json` and files inside `family-tree-data/` are ignored as an additional safeguard.

## Commit changes

Stage only the intended project files, then create a descriptive commit:

```powershell
git add <files>
git commit -m "Describe the completed change"
```

Avoid `git add .` when unrelated or private files may be present.

## Push to GitHub

Push commits to the public repository's `main` branch:

```powershell
git push origin main
```

Repository: <https://github.com/anthonyjohnsonga/Kinfolk-Family-Tree>

## Final verification

```powershell
git status --short --branch
git log -1 --format="%h %an <%ae> %s"
```

The local branch should match `origin/main`, and the author should be `anthonyjohnsonga`.

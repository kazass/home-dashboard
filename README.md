# Home Dashboard

Offline-first household dashboard for a dedicated tablet. The app is hosted as
a static PWA on GitHub Pages; household records and uploaded photos stay in the
browser's IndexedDB and are not uploaded to GitHub.

Live app: https://kazass.github.io/home-dashboard/

## Local development

Serve the repository over HTTP so IndexedDB, geolocation, and the service
worker behave like they do in production. On Windows PowerShell:

```powershell
./tools/serve.ps1
```

Then open `http://localhost:8080/`.

## Verification

The project uses Node's built-in test runner and has no package dependencies:

```bash
node --test tests/*.test.js
```

Before releasing, also syntax-check every script and test backup export/import,
offline reload, task completion/undo, recurring dates, and photo views on the
target tablet.

## Data recovery

Use **Backup → Export backup file** regularly. Version 2 backups contain all
IndexedDB records and photos plus application settings and dashboard layout.
Restore validates and decodes the entire file before replacing the current
database, and the database replacement is transactional.

Version 2 restores require all application stores; incomplete files, invalid
store values and unsupported version values are rejected before any writes.
Version 1 backups remain supported and leave existing preferences unchanged.
Synchronous write failures explicitly abort the restore transaction.

## Redesign progress

Work continues on `codex/scalable-dashboard-v3`; `main` remains the existing
live dashboard. The original safety patch is preserved at `7772f28` on
`codex/stage1-safety-fixes`.

- Data protection: ten Node regression tests pass, including backup round-trip
  with photo bytes and preferences, malformed import rejection, scoring undo,
  month-end recurrence and explicit transaction abort on a synchronous error.
  These use in-memory storage/transaction doubles, not a browser IndexedDB engine.
- Still required before release: real-browser restore/rollback, completion/undo,
  offline reload and Samsung tablet checks. The cloud preview browser blocked
  the local test address in this work session; no rendered QA pass is claimed.
- Next implementation: Today-first responsive shell, modular widgets and
  independent themes, retaining existing records and features. The visual
  redesign is not implemented yet.
